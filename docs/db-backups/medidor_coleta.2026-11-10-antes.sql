-- backup do corpo vivo (medidor_coleta(p jsonb), md5 prosrc d38091661b8e7e6fa5947a972d7d1a7d); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.medidor_coleta(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_s text := p->>'s';
  v_m jsonb := p->'meta';
  v_r jsonb := p->'res';
  v_rr jsonb := p->'rr';
  v_ses medidor_sessoes%rowtype;
  v_bytes int := 0;
  v_nev int := 0;
  v_ord text[] := array['abriu', 'adicionou', 'abriu_carrinho', 'escolheu_modalidade', 'enviou'];
begin
  if p is null or jsonb_typeof(p) <> 'object' or coalesce(p->>'u', '') <> 'imirim'
     or coalesce(v_s, '') !~ '^[A-Za-z0-9]{8,32}$' or length(p::text) > 450000 then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_ses from medidor_sessoes where sessao = v_s;
  if not found then
    if (select count(*) from medidor_sessoes where unidade = 'imirim' and criado_em > now() - interval '1 hour') >= 3000 then
      return jsonb_build_object('ok', false, 'parar', true);
    end if;
    insert into medidor_sessoes (sessao, unidade) values (v_s, 'imirim') on conflict (sessao) do nothing;
    select * into v_ses from medidor_sessoes where sessao = v_s;
  end if;
  -- os dados do aparelho entram na 1ª chamada que os trouxer (duas chamadas da abertura podem chegar juntas;
  -- a que não traz "meta" não pode deixar a sessão sem aparelho nem desmarcar o teste)
  if jsonb_typeof(v_m) = 'object' and v_ses.tela_w is null and v_ses.dispositivo is null then
    update medidor_sessoes set
      teste = teste or coalesce(v_m->>'teste' = 'true', false),
      tela_w = case when v_m->>'w' ~ '^\d{1,4}$' then (v_m->>'w')::smallint end,
      tela_h = case when v_m->>'h' ~ '^\d{1,4}$' then (v_m->>'h')::smallint end,
      dpr = case when v_m->>'dpr' ~ '^\d(\.\d{1,3})?$' then round((v_m->>'dpr')::numeric, 1) end,
      dispositivo = case when v_m->>'disp' in ('celular', 'tablet', 'desktop') then v_m->>'disp' end,
      so = case when v_m->>'so' in ('android', 'ios', 'windows', 'mac', 'linux', 'outro') then v_m->>'so' end,
      navegador = case when v_m->>'nav' in ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'outro') then v_m->>'nav' end,
      app = case when v_m->>'app' in ('instagram', 'facebook', 'whatsapp', 'tiktok', 'google', 'navegador') then v_m->>'app' end,
      origem = case when v_m->>'ref' ~ '^[a-z0-9.\-]{1,80}$' then v_m->>'ref' end,
      utm_source = left(regexp_replace(v_m->>'us', '[^A-Za-z0-9_.\- ]', '', 'g'), 60),
      utm_medium = left(regexp_replace(v_m->>'um', '[^A-Za-z0-9_.\- ]', '', 'g'), 60),
      utm_campaign = left(regexp_replace(v_m->>'uc', '[^A-Za-z0-9_.\- ]', '', 'g'), 60),
      clique = case when v_m->>'clique' in ('fbclid', 'gclid', 'ttclid') then v_m->>'clique' end
    where sessao = v_s;
    select * into v_ses from medidor_sessoes where sessao = v_s;
  end if;

  if v_ses.bytes > 3000000 or v_ses.n_lotes >= 500 or v_ses.n_eventos >= 4000 then
    return jsonb_build_object('ok', false, 'parar', true);
  end if;

  -- eventos (toque, passo, funil, erro): valores fora do formato viram nulo ou o evento é descartado
  if jsonb_typeof(p->'ev') = 'array' and jsonb_array_length(p->'ev') between 1 and 300 then
    with e as (
      select x.e from jsonb_array_elements(p->'ev') as x(e) where jsonb_typeof(x.e) = 'array'
    ), ins as (
      insert into medidor_eventos (sessao, t, tipo, alvo, x, y, passo, massa, dado)
      select v_s,
        case when e->>0 ~ '^\d{1,8}$' then case when (e->>0)::int <= 86400000 then (e->>0)::int end end,
        e->>1,
        case when e->>2 ~ '^[A-Za-z0-9:@+_.\-]{1,80}$' then e->>2 else 'outro' end,
        case when e->>3 ~ '^\d{1,4}$' then case when (e->>3)::int <= 1000 then (e->>3)::smallint end end,
        case when e->>4 ~ '^\d{1,4}$' then case when (e->>4)::int <= 1000 then (e->>4)::smallint end end,
        case when e->>5 ~ '^[123]$' then (e->>5)::smallint end,
        case when e->>6 ~ '^[a-z\-]{2,30}$' then e->>6 end,
        left(e->>7, 200)
      from e
      where e->>1 in ('toque', 'passo', 'funil', 'erro')
      returning 1
    )
    select count(*) into v_nev from ins;
  end if;

  -- gravação rrweb (lote comprimido em gzip+base64, ou JSON cru quando a página está fechando)
  if jsonb_typeof(v_rr) = 'object' and v_rr->>'seq' ~ '^\d{1,3}$' and v_rr->>'f' in ('gz64', 'json')
     and jsonb_typeof(v_rr->'d') = 'string' and length(v_rr->>'d') between 2 and 400000
     and ((v_rr->>'f' = 'gz64' and v_rr->>'d' ~ '^[A-Za-z0-9+/=]+$') or (v_rr->>'f' = 'json' and left(v_rr->>'d', 1) = '[')) then
    if (select coalesce(sum(bytes), 0) from medidor_gravacao where criado_em > now() - interval '1 hour') < 80000000 then
      insert into medidor_gravacao (sessao, seq, formato, dados, bytes, n)
      values (v_s, (v_rr->>'seq')::int, v_rr->>'f', v_rr->>'d', length(v_rr->>'d'),
              case when v_rr->>'n' ~ '^\d{1,5}$' then (v_rr->>'n')::int else 0 end)
      on conflict (sessao, seq) do nothing;
      if found then v_bytes := length(v_rr->>'d'); end if;
    end if;
  end if;

  -- resumo acumulado da sessão (o navegador manda o valor corrente; aqui só cresce ou troca por valor válido)
  update medidor_sessoes s set
    visto_em = now(),
    n_eventos = s.n_eventos + v_nev,
    n_lotes = s.n_lotes + (case when v_bytes > 0 then 1 else 0 end),
    bytes = s.bytes + v_bytes,
    passo_max = greatest(s.passo_max, case when v_r->>'pmax' ~ '^[123]$' then (v_r->>'pmax')::smallint else 1 end),
    massas = case when jsonb_typeof(v_r->'massas') = 'array' then coalesce((
               select array_agg(distinct m) from (
                 select unnest(s.massas) m
                 union select x from jsonb_array_elements_text(v_r->'massas') x where x ~ '^[a-z\-]{2,30}$') u), '{}')
               else s.massas end,
    chegou = case when v_r->>'chegou' = any(v_ord)
                   and array_position(v_ord, v_r->>'chegou') > coalesce(array_position(v_ord, s.chegou), 0)
                  then v_r->>'chegou' else s.chegou end,
    codigo = case when v_r->>'codigo' ~ '^PED-[A-Z2-9]{4}$' then v_r->>'codigo' else s.codigo end,
    modalidade = case when v_r->>'mod' in ('retirada', 'entrega') then v_r->>'mod' else s.modalidade end,
    total = case when v_r->>'total' ~ '^\d{1,5}(\.\d{1,2})?$' then (v_r->>'total')::numeric else s.total end,
    rolagem = case when jsonb_typeof(v_r->'rol') = 'object' then (
                select coalesce(jsonb_object_agg(k, greatest(coalesce((s.rolagem->>k)::int, 0), case when v_r->'rol'->>k ~ '^\d{1,3}$' then least((v_r->'rol'->>k)::int, 100) else 0 end)), '{}'::jsonb)
                  from (select k from jsonb_object_keys(v_r->'rol') k where k in ('1', '2', '3') and v_r->'rol'->>k ~ '^\d{1,3}$'
                        union select k from jsonb_object_keys(s.rolagem) k) ks
              ) else s.rolagem end,
    tempo_ativo_s = case when v_r->>'ativo' ~ '^\d{1,5}$' then greatest(s.tempo_ativo_s, least((v_r->>'ativo')::int, 86400)) else s.tempo_ativo_s end,
    ultimo_alvo = case when v_r->>'ualvo' ~ '^[A-Za-z0-9:@+_.\-]{1,80}$' then v_r->>'ualvo' else s.ultimo_alvo end,
    ultimo_passo = case when v_r->>'upasso' ~ '^[123]$' then (v_r->>'upasso')::smallint else s.ultimo_passo end,
    n_erros = case when v_r->>'erros' ~ '^\d{1,4}$' then greatest(s.n_erros, (v_r->>'erros')::int) else s.n_erros end
  where s.sessao = v_s;

  return jsonb_build_object('ok', true);
end;
$function$
;
