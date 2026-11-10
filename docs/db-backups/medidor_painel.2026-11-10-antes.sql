-- backup do corpo vivo (medidor_painel(p_dias integer, p_testes boolean), md5 prosrc b98809d391a331e67e47900b75b94abb); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.medidor_painel(p_dias integer DEFAULT 7, p_testes boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb;
begin
  -- admin do dashboard (is_admin) ou o backend (service_role, usado pela prova automática; nunca vai ao navegador)
  if not (public.is_admin() or coalesce(auth.jwt()->>'role', '') = 'service_role') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  with s as (
    select * from medidor_sessoes
     where unidade = 'imirim' and criado_em >= now() - make_interval(days => greatest(1, least(p_dias, 31)))
       and (p_testes or not teste)
  ),
  ev as (select e.* from medidor_eventos e join s using (sessao)),
  -- pedidos #PED- que chegaram no WhatsApp do Imirim e venda do mesmo telefone em até 72 h (como o funil.sql)
  cod as (select distinct codigo from s where codigo is not null
          union select distinct dado from ev where tipo = 'funil' and alvo = 'enviou' and dado ~ '^PED-[A-Z2-9]{4}$'),
  chegou as (
    select distinct on (x.cod) x.cod, m.contact_phone, m.created_at
      from conversation_messages m,
           lateral (select (regexp_match(m.content, '#(PED-[A-Z2-9]{4})'))[1] as cod) x
     where m.franchise_id = 'franquiasaopaulosp10' and m.direction = 'in'
       and m.created_at >= now() - make_interval(days => greatest(1, least(p_dias, 31)) + 1)
       and x.cod in (select codigo from cod)
     order by x.cod, m.created_at
  ),
  venda as (
    select c.cod, (select s2.value from sales s2
                    where s2.franchise_id = 'franquiasaopaulosp10'
                      and right(regexp_replace(s2.contact_phone, '\D', '', 'g'), 11) = right(regexp_replace(c.contact_phone, '\D', '', 'g'), 11)
                      and s2.created_at between c.created_at and c.created_at + interval '72 hours'
                    order by s2.created_at limit 1) as valor
      from chegou c
  )
  select jsonb_build_object(
    'periodo_dias', greatest(1, least(p_dias, 31)),
    'sessoes', (select count(*) from s),
    'funil', jsonb_build_object(
      'abriu', (select count(*) from s),
      'adicionou', (select count(distinct sessao) from ev where tipo = 'funil' and alvo = 'adicionou'),
      'abriu_carrinho', (select count(distinct sessao) from ev where tipo = 'funil' and alvo = 'abriu_carrinho'),
      'escolheu_modalidade', (select count(distinct sessao) from ev where tipo = 'funil' and alvo = 'escolheu_modalidade'),
      'enviou', (select count(distinct sessao) from ev where tipo = 'funil' and alvo = 'enviou'),
      'pedidos', (select count(*) from cod),
      'chegou_whatsapp', (select count(*) from chegou),
      'venda', (select count(*) from venda where valor is not null),
      'valor_vendido', (select coalesce(sum(valor), 0) from venda)),
    'passos', jsonb_build_object(
      'p1', (select count(distinct sessao) from ev where tipo = 'passo' and passo = 1),
      'p2', (select count(distinct sessao) from ev where tipo = 'passo' and passo = 2),
      'p3', (select count(distinct sessao) from ev where tipo = 'passo' and passo = 3)),
    'massas', coalesce((select jsonb_agg(jsonb_build_object('massa', massa, 'sessoes', n, 'adicionou', a) order by n desc)
                          from (select p.massa, count(distinct p.sessao) n,
                                       (select count(distinct f.sessao) from ev f where f.tipo = 'funil' and f.alvo = 'adicionou' and f.massa = p.massa) a
                                  from ev p where p.tipo = 'passo' and p.passo = 2 and p.massa is not null group by p.massa) q), '[]'),
    'toques', coalesce((select jsonb_agg(jsonb_build_object('passo', passo, 'alvo', alvo, 'toques', n, 'sessoes', ns, 'x', ax, 'y', ay) order by passo, n desc)
                          from (select passo, alvo, count(*) n, count(distinct sessao) ns, round(avg(x)) ax, round(avg(y)) ay
                                  from ev where tipo = 'toque' group by passo, alvo) q), '[]'),
    'pararam', coalesce((select jsonb_agg(jsonb_build_object('passo', ultimo_passo, 'alvo', ultimo_alvo, 'sessoes', n) order by n desc)
                           from (select ultimo_passo, ultimo_alvo, count(*) n from s
                                  where coalesce(chegou, '') <> 'enviou' group by 1, 2 order by 3 desc limit 25) q), '[]'),
    'rolagem', jsonb_build_object(
      'p1', (select percentile_cont(0.5) within group (order by (rolagem->>'1')::int) from s where rolagem ? '1'),
      'p2', (select percentile_cont(0.5) within group (order by (rolagem->>'2')::int) from s where rolagem ? '2'),
      'p3', (select percentile_cont(0.5) within group (order by (rolagem->>'3')::int) from s where rolagem ? '3')),
    'tempo', jsonb_build_object(
      'mediana', (select percentile_cont(0.5) within group (order by tempo_ativo_s) from s),
      'p75', (select percentile_cont(0.75) within group (order by tempo_ativo_s) from s),
      'mediana_enviou', (select percentile_cont(0.5) within group (order by tempo_ativo_s) from s where chegou = 'enviou')),
    'aparelhos', coalesce((select jsonb_agg(jsonb_build_object('nome', k, 'sessoes', n) order by n desc)
                             from (select coalesce(dispositivo, '?') || ' · ' || coalesce(app, '?') k, count(*) n from s group by 1) q), '[]'),
    'origens', coalesce((select jsonb_agg(jsonb_build_object('nome', k, 'sessoes', n) order by n desc)
                           from (select coalesce(nullif(utm_source, ''), origem, case when app is not null and app <> 'navegador' then 'app ' || app end, 'direto') k, count(*) n
                                   from s group by 1 order by 2 desc limit 15) q), '[]'),
    'erros', coalesce((select jsonb_agg(jsonb_build_object('msg', dado, 'vezes', n, 'sessoes', ns, 'ultima', u) order by n desc)
                         from (select dado, count(*) n, count(distinct sessao) ns, max(criado_em) u
                                 from ev where tipo = 'erro' group by dado order by 2 desc limit 30) q), '[]'),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
                         'sessao', s.sessao, 'criado_em', s.criado_em, 'visto_em', s.visto_em, 'teste', s.teste,
                         'tela', s.tela_w || '×' || s.tela_h, 'dispositivo', s.dispositivo, 'so', s.so, 'navegador', s.navegador,
                         'app', s.app, 'origem', coalesce(nullif(s.utm_source, ''), s.origem), 'passo_max', s.passo_max,
                         'chegou', s.chegou, 'massas', s.massas, 'tempo', s.tempo_ativo_s, 'lotes', s.n_lotes, 'kb', round(s.bytes / 1024.0),
                         'erros', s.n_erros, 'codigo_chegou', s.codigo in (select cod from chegou),
                         'virou_venda', s.codigo in (select cod from venda where valor is not null)) order by s.criado_em desc)
                         from (select * from s order by criado_em desc limit 150) s), '[]')
  ) into v;
  return v;
end;
$function$
;
