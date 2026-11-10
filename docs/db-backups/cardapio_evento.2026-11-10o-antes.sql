CREATE OR REPLACE FUNCTION public.cardapio_evento(p_unidade text, p_sessao text, p_evento text, p_dados jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_slug text := lower(trim(coalesce(p_unidade, '')));
  v_evo text;
  v_produto text;
  v_modalidade text;
  v_codigo text;
  v_total numeric;
  v_itens int;
  v_origem text;
begin
  if coalesce(p_sessao, '') !~ '^[A-Za-z0-9]{8,32}$'
     or coalesce(p_evento, '') not in ('abriu', 'adicionou', 'abriu_carrinho', 'escolheu_modalidade', 'enviou', 'sugeriu', 'aceitou')
     or p_dados is null or jsonb_typeof(p_dados) <> 'object' or length(p_dados::text) > 400 then
    return;
  end if;
  v_evo := public.cardapio_evo_do_slug(v_slug);
  if v_evo is null then
    return;
  end if;

  -- limite de taxa (sem IP nem dado pessoal)
  if (select count(*) from cardapio_eventos where sessao = p_sessao and criado_em > now() - interval '10 minutes') >= 150
     or (select count(*) from cardapio_eventos where unidade = v_slug and criado_em > now() - interval '1 hour') >= 3000
     or (select count(*) from cardapio_eventos where criado_em > now() - interval '1 hour') >= 20000 then
    return;
  end if;

  v_origem := case when p_dados->>'origem' in ('molho', 'par', 'kit', 'leve', 'destaque', 'substituto', 'repetir') then p_dados->>'origem' end;
  if p_evento in ('adicionou', 'sugeriu', 'aceitou') then
    v_produto := left(p_dados->>'produto', 120);
    if v_produto is null or not exists (select 1 from inventory_items where franchise_id = v_evo and product_name = v_produto) then
      return;
    end if;
    if p_evento <> 'adicionou' and v_origem is null then return; end if;
  elsif p_evento = 'escolheu_modalidade' then
    v_modalidade := p_dados->>'modalidade';
    if coalesce(v_modalidade, '') not in ('retirada', 'entrega') then return; end if;
  elsif p_evento = 'enviou' then
    v_codigo := p_dados->>'codigo';
    v_modalidade := p_dados->>'modalidade';
    if coalesce(v_codigo, '') !~ '^PED-[A-Z2-9]{4}$' or coalesce(v_modalidade, '') not in ('retirada', 'entrega') then return; end if;
    begin
      v_total := round((p_dados->>'total')::numeric, 2);
      v_itens := (p_dados->>'itens')::int;
    exception when others then return;
    end;
    if v_total is null or v_itens is null or v_total < 0 or v_total >= 100000 or v_itens < 0 or v_itens > 999 then return; end if;
  end if;

  insert into cardapio_eventos (unidade, sessao, evento, produto, modalidade, codigo, total, itens, origem)
  values (v_slug, p_sessao, p_evento, v_produto, v_modalidade, v_codigo, v_total, v_itens,
          case when p_evento in ('adicionou', 'sugeriu', 'aceitou') then v_origem end)
  on conflict do nothing;  -- 10l: evento repetido na sessão (índice cardapio_eventos_unico) não vira erro 400
end;
$function$;
