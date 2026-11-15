-- 2026-09-26 admin 05 — get_unit_360(p_evo): tudo que a Ficha da unidade mostra, em 1 chamada
--
-- POR QUE
-- A Ficha da unidade (prototipo, artboard "Ficha") junta diagnostico, numeros, rotina, pedidos,
-- mensalidade e conversas do CS. Hoje isso esta espalhado: o raio-x do FranchiseDrawer usa a
-- linha de get_franchise_health_signals (3,6 s, rede inteira) e o resto nao existe em lugar
-- nenhum. Esta RPC devolve um jsonb unico para UMA unidade; o raio-x vem do cache (admin-03),
-- nao do sinal ao vivo.
--
-- O QUE VOLTA (chaves do jsonb)
--   franchise_id/uuid/name, owner_name, phone (mesma regra de get_cs_franchise_contacts:
--     franchises.phone_number, senao personal_phone_for_summary, so digitos), city, state_uf,
--     status, is_test, created_at, age_days, is_new (< 60 dias), today (data de SP)
--   health ........ tier, flags, is_standout, signals (raio-x: margem, compras 30d, variedade,
--                   itens-chave zerados, conversao do robo, assinatura...), computed_at — do cache
--   sales ......... rev_mtd x rev_prev_same (mesmo trecho do mes anterior), rev_delta_pct (so com
--                   base >= R$ 3.000), sales_mtd, last_sale_date, days_since_last_sale,
--                   weeks[12] = {week_start (segunda), revenue, sales} — o grafico "12 semanas"
--   bot ........... people_7d (pessoas distintas), last_conversation_date,
--                   days_since_last_conversation, network_median_people_7d (mediana das 66
--                   unidades reais, contando as zeradas: "metade da rede recebe X ou mais")
--   customers ..... buyers, repeat_buyers, repeat_rate_pct (ao vivo, so desta unidade: ~1 ms),
--                   top_quartile_repeat_rate_pct (media das 25% que mais faturam em 30d, do cache)
--   daily_actions . sent_7d / last_sent_date do "Quem chamar hoje" (contact_actions status sent),
--                   top_quartile_units / top_quartile_using (das 25% que mais faturam, quantas
--                   mandaram 1+ mensagem em 7 dias) — o "entre as que mais vendem, X usam"
--   marketing ..... calendar_month, target_month (regra dos ultimos 5 dias), months[] dos ultimos
--                   4 meses {month, amount, status, campaign_raised_at}
--   purchase_orders pending_count, last, days_since_last, recent[5]
--   subscription .. status da assinatura e da cobranca atual, vencimento, valor, link, last_synced_at
--   onboarding .... status, pct, approved_at (NULL = unidade sem checklist)
--   cs ............ open_tasks[] (com assignee_name), resolved_count, recent_events[10] (com autor)
-- Unidade inexistente -> NULL. Aceita unidade de teste (o admin pode abrir a ficha dela); quem
-- filtra teste e a lista (admin-04).
--
-- SEGURANCA: SECURITY DEFINER com guard coalesce(is_cs_or_admin() or is_admin_or_manager(), false)
-- no corpo (sem perfil -> NULL, fail-closed). revoke de public/anon. A nota do CS
-- (cs_worklist_events.note) sai aqui: e o mesmo publico que ja le o mural.
--
-- MEDIDO (26/09/2026, corpo inline para Itatiba via execute_sql, cache simulado)
--   21,7 ms de execucao + 8,9 ms de planejamento (o "231 ms" do plano era a soma das consultas
--   soltas do drawer); ~6,8 KB de JSON. O mais caro e a mediana de robo da rede (66 index-only
--   scans, ~15 ms). Numeros batem com o prototipo: ultimo pedido 25/04 R$ 4.470,40 ha 154 dias,
--   30 dias sem venda e sem conversa, 16 de 131 clientes voltaram (12,2%), mensalidade OVERDUE
--   com vencimento 05/09, verba jun/jul/ago e setembro sem pagamento.
--   Obs.: a mediana de robo medida hoje e 69-84 conforme conte ou nao as unidades zeradas; a
--   funcao conta TODAS as 66 (inclusive zeradas), que e o que "metade da rede" quer dizer.
--
-- DEPENDE DE: admin-03 (franchise_health_cache).

create or replace function public.get_unit_360(p_evo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $fn$
begin
  if not coalesce((select public.is_cs_or_admin()) or (select public.is_admin_or_manager()), false) then
    return null;
  end if;
  if p_evo is null or btrim(p_evo) = '' then
    return null;
  end if;

  return (
    select z.r from (
  with
  d as (
    select x.hoje,
           date_trunc('month', x.hoje)::date as mes_ini,
           (date_trunc('month', x.hoje) - interval '1 month')::date as ant_ini,
           (x.hoje - interval '1 month')::date as ant_fim,
           date_trunc('week', x.hoje)::date as semana_ini,
           to_char(x.hoje, 'YYYY-MM') as mkt_mes,
           case when extract(day from x.hoje)
                     > extract(day from (date_trunc('month', x.hoje) + interval '1 month - 1 day')) - 5
                then to_char(x.hoje + interval '1 month', 'YYYY-MM')
                else to_char(x.hoje, 'YYYY-MM') end as mkt_alvo
    from (select (now() at time zone 'America/Sao_Paulo')::date as hoje) x
  ),
  u as (
    select f.evolution_instance_id as fid, f.id as uuid, f.name, f.owner_name, f.city, f.state_uf::text as uf,
           f.status, coalesce(f.is_test, false) as is_test, f.created_at,
           nullif(regexp_replace(coalesce(nullif(f.phone_number, ''), nullif(fc.personal_phone_for_summary, '')), '\D', '', 'g'), '') as phone
    from public.franchises f
    left join public.franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
    where f.evolution_instance_id = p_evo
  ),
  sv as (
    select
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.mes_ini and s.sale_date <= d.hoje), 0) as rev_mtd,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.ant_ini and s.sale_date <= d.ant_fim), 0) as rev_prev_same,
      (count(*) filter (where s.sale_date >= d.mes_ini and s.sale_date <= d.hoje))::int as sales_mtd
    from d
    left join public.sales s on s.franchise_id = p_evo and s.sale_date >= d.ant_ini and s.sale_date <= d.hoje
    group by d.hoje
  ),
  ult as (
    select max(s.sale_date) as last_sale
    from public.sales s, d
    where s.franchise_id = p_evo and s.sale_date <= d.hoje
  ),
  sem as (
    select g.ini::date as ini,
           coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)), 0) as valor,
           count(s.id)::int as vendas
    from d
    cross join generate_series((d.semana_ini - 77)::timestamp, d.semana_ini::timestamp, interval '7 days') as g(ini)
    left join public.sales s
      on s.franchise_id = p_evo
     and s.sale_date >= g.ini::date and s.sale_date < g.ini::date + 7 and s.sale_date <= d.hoje
    group by g.ini
  ),
  bot as (
    select
      (select count(distinct b.contact_phone)::int from public.vw_bot_conversations b
        where b.franchise_id = p_evo and b.started_at >= now() - interval '7 days') as people_7d,
      (select (max(b.started_at) at time zone 'America/Sao_Paulo')::date from public.vw_bot_conversations b
        where b.franchise_id = p_evo) as last_bot
  ),
  bot_rede as (
    select percentile_cont(0.5) within group (order by n) as mediana
    from (
      select f.evolution_instance_id,
             (select count(distinct b.contact_phone) from public.vw_bot_conversations b
               where b.franchise_id = f.evolution_instance_id and b.started_at >= now() - interval '7 days') as n
      from public.franchises f
      where f.status = 'active' and not coalesce(f.is_test, false)
    ) t
  ),
  cli as (
    select count(*)::int as buyers,
           (count(*) filter (where c.purchase_count >= 2))::int as repeat_buyers
    from public.contacts c
    where c.franchise_id = p_evo and c.purchase_count >= 1
  ),
  cli_rede as (
    select round(avg(100.0 * hc.repeat_buyers / hc.buyers), 1) as top_repeat_rate_pct
    from (
      select hc.*, ntile(4) over (order by coalesce((hc.signals->>'revenue_30d')::numeric, 0) desc) as q
      from public.franchise_health_cache hc
      where hc.buyers >= 20
    ) hc
    where hc.q = 1
  ),
  acoes as (
    select (count(*) filter (where ca.status = 'sent' and ca.action_date > d.hoje - 7))::int as sent_7d,
           max(ca.action_date) filter (where ca.status = 'sent') as last_sent
    from d
    left join public.contact_actions ca on ca.franchise_id = p_evo
    group by d.hoje
  ),
  acoes_rede as (
    select count(*)::int as top_n,
           (count(*) filter (where exists (
              select 1 from public.contact_actions ca, d
               where ca.franchise_id = hc.franchise_id and ca.status = 'sent' and ca.action_date > d.hoje - 7)))::int as top_usam
    from (
      select hc.franchise_id, ntile(4) over (order by coalesce((hc.signals->>'revenue_30d')::numeric, 0) desc) as q
      from public.franchise_health_cache hc
    ) hc
    where hc.q = 1
  ),
  mkt as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'month', mp.reference_month, 'amount', mp.amount, 'status', mp.status,
             'campaign_raised_at', mp.campaign_raised_at) order by mp.reference_month desc), '[]'::jsonb) as meses
    from public.marketing_payments mp, d
    where mp.franchise_id = p_evo
      and mp.reference_month >= to_char(d.hoje - interval '4 months', 'YYYY-MM')
  ),
  pos as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id, 'ordered_at', x.ordered_at, 'status', x.status,
             'total_amount', x.total_amount, 'delivered_at', x.delivered_at) order by x.ordered_at desc), '[]'::jsonb) as ultimos
    from (
      select p.id, p.ordered_at, p.status, p.total_amount, p.delivered_at
      from public.purchase_orders p
      where p.franchise_id = p_evo
      order by p.ordered_at desc
      limit 5
    ) x
  ),
  pend as (
    select count(*)::int as n from public.purchase_orders p where p.franchise_id = p_evo and p.status = 'pendente'
  ),
  tasks as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'title', t.title, 'column_status', t.column_status, 'source', t.source,
             'assignee', t.assignee, 'assignee_name', pr.full_name, 'priority', t.priority,
             'moved_to_column_at', t.moved_to_column_at, 'parked_until', t.parked_until,
             'created_at', t.created_at) order by t.moved_to_column_at desc), '[]'::jsonb) as abertos
    from public.cs_tasks t
    left join public.profiles pr on pr.id = t.assignee
    where t.franchise_id = p_evo and t.archived_at is null and t.column_status <> 'feito'
  ),
  tasks_feitas as (
    select count(*)::int as n from public.cs_tasks t where t.franchise_id = p_evo and t.column_status = 'feito'
  ),
  eventos as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'task_id', e.task_id, 'event_type', e.event_type, 'note', e.note,
             'created_at', e.created_at, 'created_by_name', e.autor) order by e.created_at desc), '[]'::jsonb) as ultimos
    from (
      select ev.id, ev.task_id, ev.event_type, ev.note, ev.created_at, pr.full_name as autor
      from public.cs_worklist_events ev
      left join public.profiles pr on pr.id = ev.created_by
      where ev.franchise_id = p_evo
      order by ev.created_at desc
      limit 10
    ) e
  )
  select jsonb_build_object(
    'franchise_id', u.fid,
    'franchise_uuid', u.uuid,
    'franchise_name', u.name,
    'owner_name', u.owner_name,
    'phone', u.phone,
    'city', u.city,
    'state_uf', u.uf,
    'status', u.status,
    'is_test', u.is_test,
    'created_at', u.created_at,
    'age_days', (d.hoje - (u.created_at at time zone 'America/Sao_Paulo')::date),
    'is_new', (d.hoje - (u.created_at at time zone 'America/Sao_Paulo')::date) < 60,
    'today', d.hoje,
    'health', jsonb_build_object(
      'tier', hc.tier, 'flags', coalesce(hc.flags, '[]'::jsonb), 'is_standout', hc.is_standout,
      'signals', hc.signals, 'computed_at', hc.computed_at),
    'sales', jsonb_build_object(
      'rev_mtd', sv.rev_mtd,
      'rev_prev_same', sv.rev_prev_same,
      'rev_delta_pct', case when sv.rev_prev_same >= 3000
                            then round(100.0 * (sv.rev_mtd - sv.rev_prev_same) / sv.rev_prev_same, 1) end,
      'sales_mtd', sv.sales_mtd,
      'last_sale_date', ult.last_sale,
      'days_since_last_sale', d.hoje - ult.last_sale,
      'weeks', (select jsonb_agg(jsonb_build_object('week_start', sem.ini, 'revenue', sem.valor, 'sales', sem.vendas) order by sem.ini) from sem)),
    'bot', jsonb_build_object(
      'people_7d', bot.people_7d,
      'last_conversation_date', bot.last_bot,
      'days_since_last_conversation', d.hoje - bot.last_bot,
      'network_median_people_7d', (select round(mediana::numeric, 0) from bot_rede)),
    'customers', jsonb_build_object(
      'buyers', cli.buyers,
      'repeat_buyers', cli.repeat_buyers,
      'repeat_rate_pct', case when cli.buyers >= 20 then round(100.0 * cli.repeat_buyers / cli.buyers, 1) end,
      'top_quartile_repeat_rate_pct', (select top_repeat_rate_pct from cli_rede)),
    'daily_actions', jsonb_build_object(
      'sent_7d', acoes.sent_7d,
      'last_sent_date', acoes.last_sent,
      'top_quartile_units', (select top_n from acoes_rede),
      'top_quartile_using', (select top_usam from acoes_rede)),
    'marketing', jsonb_build_object(
      'calendar_month', d.mkt_mes,
      'target_month', d.mkt_alvo,
      'months', mkt.meses),
    'purchase_orders', jsonb_build_object(
      'pending_count', pend.n,
      'last', pos.ultimos -> 0,
      'days_since_last', d.hoje - ((pos.ultimos -> 0 ->> 'ordered_at')::timestamptz at time zone 'America/Sao_Paulo')::date,
      'recent', pos.ultimos),
    'subscription', (select jsonb_build_object(
      'subscription_status', ss.subscription_status, 'payment_status', ss.current_payment_status,
      'due_date', ss.current_payment_due_date, 'value', ss.current_payment_value,
      'payment_url', ss.current_payment_url, 'last_synced_at', ss.last_synced_at)
      from public.system_subscriptions ss where ss.franchise_id = p_evo),
    'onboarding', (select jsonb_build_object('status', ob.status, 'pct', ob.completion_percentage, 'approved_at', ob.approved_at)
      from public.onboarding_checklists ob where ob.franchise_id = p_evo),
    'cs', jsonb_build_object(
      'open_tasks', tasks.abertos,
      'resolved_count', tasks_feitas.n,
      'recent_events', eventos.ultimos)
  )
  from u
  cross join d
  cross join sv
  cross join ult
  cross join bot
  cross join cli
  cross join acoes
  cross join mkt
  cross join pos
  cross join pend
  cross join tasks
  cross join tasks_feitas
  cross join eventos
  left join public.franchise_health_cache hc on hc.franchise_id = u.fid
    ) z(r)
  );
end;
$fn$;

revoke execute on function public.get_unit_360(text) from public, anon;
grant execute on function public.get_unit_360(text) to authenticated, service_role;

-- CONFERÊNCIA (rodar em query separada; os dois `materialized` sao obrigatorios)
-- 1) como admin, Itatiba (esperado: days_since_last_sale 30+, purchase_orders.days_since_last 154+,
--    customers 16/131, subscription.payment_status OVERDUE, health.tier preenchido depois do 1o reconcile):
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         r as materialized (select public.get_unit_360('franquiaitatibasp') as j from ctx)
--    select length(j::text) bytes, j->'sales'->>'days_since_last_sale' sem_venda,
--           j->'purchase_orders'->>'days_since_last' sem_pedido, j->'customers' clientes,
--           j->'subscription'->>'payment_status' mensalidade, j->'health'->>'tier' tier,
--           jsonb_array_length(j->'sales'->'weeks') semanas, jsonb_array_length(j->'cs'->'open_tasks') cartoes
--    from r;
-- 2) fail-closed: sem claims -> NULL:   select public.get_unit_360('franquiaitatibasp');
-- 3) como franqueado (uuid de profiles.role='franchisee') -> NULL, mesmo para a PROPRIA unidade.
-- 4) unidade que nao existe -> NULL:    (com ctx de admin) get_unit_360('nao-existe')
-- 5) anon: POST /rest/v1/rpc/get_unit_360 com a chave anon -> 401/permission denied.
