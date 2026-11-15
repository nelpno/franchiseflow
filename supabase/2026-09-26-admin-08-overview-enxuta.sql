-- 2026-09-26 admin 08 — get_admin_network_overview() enxuta + coluna phone
--
-- NAO APLICADO. Aplicar junto com o deploy do front da Onda 1 (Unidades.jsx e
-- VerbaAlvoPanel.jsx deixam de chamar getCsFranchiseContacts e passam a ler `phone`).
-- Partiu do pg_get_functiondef() ATUAL lido por SELECT via MCP em 26/09/2026
-- (md5 e2558f664af66ae67e030dd9c56be738, 6.374 chars; identico ao admin-04).
--
-- O QUE MUDA
-- 1) Sai o que nenhuma tela le (grep em src/ e .tmp/harness* depois das correcoes da Onda 1):
--      state_uf, created_at, sales_mtd, last_po_at, last_po_status, last_po_amount,
--      subscription_status, buyers, repeat_buyers, repeat_rate_pct, tier, flags, is_standout,
--      health_computed_at
--    Com tier/flags/recompra fora, o join com franchise_health_cache sai junto: a lista nao
--    depende mais do cache das 13:32 (decisao 3: o tier so aparece no Raio-X da Ficha).
-- 2) FICAM, mesmo sem tela lendo hoje, porque a regua unica (src/lib/networkOverview.js,
--    sinaisUnidade/semVenda/novaNaTrilha) usa:
--      subscription_payment_status, subscription_due_date  -> motivo "Mensalidade vencida desde dd/mm"
--      onboarding_status                                   -> nova com trilha aprovada sai da protecao
--    days_since_last_po continua (Unidades) e passa a vir so de max(ordered_at), ignorando
--    pedido cancelado (mesma regra do "ultimo pedido" da Ficha, admin-10; medido 26/09: 0 de
--    66 unidades mudam hoje, nenhuma tem o cancelado como pedido mais recente).
-- 3) Entra `phone` (depois de owner_name), com a MESMA regra da get_unit_360 (admin-05):
--      so digitos de coalesce(nullif(franchises.phone_number,''),
--                             nullif(franchise_configurations.personal_phone_for_summary,''))
--    Isso tira a 2a chamada (getCsFranchiseContacts) de Unidades e do painel de verba.
--
-- Mudar o RETURNS TABLE exige DROP antes (CREATE OR REPLACE nao troca colunas de saida).
-- DROP e CREATE na MESMA transacao: nenhum instante sem a funcao para o painel.
-- Nenhuma outra funcao nem view depende dela (conferido em pg_proc.prosrc e pg_depend, 26/09).
--
-- TAMANHO (26/09, 66 linhas, como admin; pg_column_size(json_agg(linhas))):
--   antes  80.424 bytes (41 colunas)
--   depois 50.917 bytes (28 colunas, ja com phone; 63 de 66 com telefone) — corpo novo
--          rodado inline por SELECT (sem gravar nada)
--   Mesmos numeros de conferencia do admin-04 (sem_venda7 5, robo7 8, caiu20 17, subiu20 8,
--   novas 8, sem_verba 7, vencidas 3).
--
-- SEGURANCA: igual ao admin-04. SECURITY DEFINER, search_path=public, guard
-- coalesce(is_cs_or_admin() or is_admin_or_manager(), false) (fail-closed), revoke de
-- public/anon, grant a authenticated/service_role. `phone` ja e visivel a esses papeis pela
-- get_unit_360 e pela get_cs_franchise_contacts (nada novo exposto).

begin;

drop function if exists public.get_admin_network_overview();

create function public.get_admin_network_overview()
returns table (
  franchise_id text,
  franchise_name text,
  owner_name text,
  phone text,
  city text,
  age_days integer,
  is_new boolean,
  rev_mtd numeric,
  rev_prev_same numeric,
  rev_delta_pct numeric,
  rev_90d numeric,
  days_since_last_sale integer,
  people_7d integer,
  days_since_last_bot integer,
  days_since_last_po integer,
  pending_po_count integer,
  marketing_month text,
  marketing_month_paid boolean,
  marketing_month_amount numeric,
  marketing_month_raised_at timestamptz,
  marketing_target_month text,
  marketing_target_paid boolean,
  marketing_target_amount numeric,
  marketing_target_raised_at timestamptz,
  subscription_payment_status text,
  subscription_due_date date,
  onboarding_status text,
  onboarding_pct integer
)
language plpgsql
stable
security definer
set search_path = 'public'
as $fn$
#variable_conflict use_column
begin
  if not coalesce((select public.is_cs_or_admin()) or (select public.is_admin_or_manager()), false) then
    return;
  end if;

  return query
  with
  d as (
    select x.hoje,
           date_trunc('month', x.hoje)::date as mes_ini,
           (date_trunc('month', x.hoje) - interval '1 month')::date as ant_ini,
           (x.hoje - interval '1 month')::date as ant_fim,
           to_char(x.hoje, 'YYYY-MM') as mkt_mes,
           case when extract(day from x.hoje)
                     > extract(day from (date_trunc('month', x.hoje) + interval '1 month - 1 day')) - 5
                then to_char(x.hoje + interval '1 month', 'YYYY-MM')
                else to_char(x.hoje, 'YYYY-MM') end as mkt_alvo
    from (select (now() at time zone 'America/Sao_Paulo')::date as hoje) x
  ),
  fr as (
    select f.evolution_instance_id as fid, f.name, f.owner_name, f.city, f.created_at as criado,
           nullif(regexp_replace(coalesce(nullif(f.phone_number, ''), nullif(fc.personal_phone_for_summary, '')), '\D', '', 'g'), '') as phone
    from public.franchises f
    left join public.franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
    where f.status = 'active' and not coalesce(f.is_test, false) and f.evolution_instance_id is not null
  )
  select
    fr.fid,
    fr.name,
    fr.owner_name,
    fr.phone,
    fr.city,
    (d.hoje - (fr.criado at time zone 'America/Sao_Paulo')::date)::int,
    (d.hoje - (fr.criado at time zone 'America/Sao_Paulo')::date) < 60,
    sv.rev_mtd,
    sv.rev_prev_same,
    case when sv.rev_prev_same >= 3000
         then round(100.0 * (sv.rev_mtd - sv.rev_prev_same) / sv.rev_prev_same, 1) end,
    sv.rev_90d,
    case when sv.last_sale is not null then (d.hoje - sv.last_sale)::int end,
    bt.people_7d,
    case when bt.last_bot is not null then (d.hoje - bt.last_bot)::int end,
    case when po.last_po_at is not null
         then (d.hoje - (po.last_po_at at time zone 'America/Sao_Paulo')::date)::int end,
    pp.pending_po_count,
    d.mkt_mes,
    mk.mes_paid,
    mk.mes_amount,
    mk.mes_raised_at,
    d.mkt_alvo,
    mk.alvo_paid,
    mk.alvo_amount,
    mk.alvo_raised_at,
    ss.current_payment_status,
    ss.current_payment_due_date,
    ob.status,
    ob.completion_percentage
  from fr
  cross join d
  left join lateral (
    select
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.mes_ini and s.sale_date <= d.hoje), 0) as rev_mtd,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.ant_ini and s.sale_date <= d.ant_fim), 0) as rev_prev_same,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 90 and s.sale_date <= d.hoje), 0) as rev_90d,
      max(s.sale_date) filter (where s.sale_date <= d.hoje) as last_sale
    from public.sales s
    where s.franchise_id = fr.fid
      and s.sale_date > least(d.ant_ini, d.hoje - 90) - 1
  ) sv on true
  left join lateral (
    select
      (select count(distinct b.contact_phone)::int
         from public.vw_bot_conversations b
        where b.franchise_id = fr.fid and b.started_at >= now() - interval '7 days') as people_7d,
      (select (max(b.started_at) at time zone 'America/Sao_Paulo')::date
         from public.vw_bot_conversations b
        where b.franchise_id = fr.fid) as last_bot
  ) bt on true
  left join lateral (
    select max(p.ordered_at) as last_po_at
    from public.purchase_orders p
    where p.franchise_id = fr.fid and p.status <> 'cancelado'
  ) po on true
  left join lateral (
    select count(*)::int as pending_po_count
    from public.purchase_orders p
    where p.franchise_id = fr.fid and p.status = 'pendente'
  ) pp on true
  left join lateral (
    select
      coalesce(bool_or(mp.reference_month = d.mkt_mes), false) as mes_paid,
      coalesce(sum(mp.amount) filter (where mp.reference_month = d.mkt_mes), 0) as mes_amount,
      max(mp.campaign_raised_at) filter (where mp.reference_month = d.mkt_mes) as mes_raised_at,
      coalesce(bool_or(mp.reference_month = d.mkt_alvo), false) as alvo_paid,
      coalesce(sum(mp.amount) filter (where mp.reference_month = d.mkt_alvo), 0) as alvo_amount,
      max(mp.campaign_raised_at) filter (where mp.reference_month = d.mkt_alvo) as alvo_raised_at
    from public.marketing_payments mp
    where mp.franchise_id = fr.fid
      and mp.status = 'confirmed'
      and mp.reference_month in (d.mkt_mes, d.mkt_alvo)
  ) mk on true
  left join public.system_subscriptions ss on ss.franchise_id = fr.fid
  left join public.onboarding_checklists ob on ob.franchise_id = fr.fid
  order by fr.name;
end;
$fn$;

revoke execute on function public.get_admin_network_overview() from public, anon;
grant execute on function public.get_admin_network_overview() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- CONFERENCIA (rodar DEPOIS, em query separada; os dois `materialized` sao obrigatorios)
-- 1) como admin — esperado (26/09): 66 linhas, 28 colunas, sem_venda7 5, robo7 8, caiu20 17,
--    subiu20 8, novas 8, sem_verba 7, vencidas 3, com_phone 63,
--    bytes ~50 KB:
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_admin_network_overview() r)
--    select count(*) linhas,
--           count(*) filter (where days_since_last_sale >= 7 and not is_new) sem_venda7,
--           count(*) filter (where days_since_last_bot >= 7) robo7,
--           count(*) filter (where rev_delta_pct <= -20) caiu20,
--           count(*) filter (where rev_delta_pct >= 20) subiu20,
--           count(*) filter (where is_new) novas,
--           count(*) filter (where not marketing_month_paid and not marketing_target_paid) sem_verba,
--           count(*) filter (where subscription_payment_status = 'OVERDUE') vencidas,
--           count(phone) com_phone,
--           pg_column_size(json_agg(o)) bytes
--    from o;
-- 2) phone igual ao da ficha (0 linhas esperadas):
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_admin_network_overview() r)
--    select o.franchise_id from o, ctx where o.phone is distinct from (public.get_unit_360(o.franchise_id)->>'phone');
-- 3) fail-closed: sem claims (execute_sql puro) -> 0 linhas:
--    select count(*) from public.get_admin_network_overview();
-- 4) anon: POST /rest/v1/rpc/get_admin_network_overview com a chave anon -> 401/permission denied.
-- 5) grants: select grantee, privilege_type from information_schema.routine_privileges
--            where routine_name = 'get_admin_network_overview';  -- postgres, authenticated, service_role

-- ROLLBACK (volta EXATAMENTE a versao do admin-04, 41 colunas; o front novo continua
-- funcionando, so volta a pedir o telefone por getCsFranchiseContacts):
/*
begin;

drop function if exists public.get_admin_network_overview();

CREATE FUNCTION public.get_admin_network_overview()
 RETURNS TABLE(franchise_id text, franchise_name text, owner_name text, city text, state_uf text, created_at timestamp with time zone, age_days integer, is_new boolean, rev_mtd numeric, rev_prev_same numeric, rev_delta_pct numeric, rev_90d numeric, sales_mtd integer, days_since_last_sale integer, people_7d integer, days_since_last_bot integer, last_po_at timestamp with time zone, last_po_status text, last_po_amount numeric, days_since_last_po integer, pending_po_count integer, marketing_month text, marketing_month_paid boolean, marketing_month_amount numeric, marketing_month_raised_at timestamp with time zone, marketing_target_month text, marketing_target_paid boolean, marketing_target_amount numeric, marketing_target_raised_at timestamp with time zone, subscription_status text, subscription_payment_status text, subscription_due_date date, buyers integer, repeat_buyers integer, repeat_rate_pct numeric, tier text, flags jsonb, is_standout boolean, health_computed_at timestamp with time zone, onboarding_status text, onboarding_pct integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if not coalesce((select public.is_cs_or_admin()) or (select public.is_admin_or_manager()), false) then
    return;
  end if;

  return query
  with
  d as (
    select x.hoje,
           date_trunc('month', x.hoje)::date as mes_ini,
           (date_trunc('month', x.hoje) - interval '1 month')::date as ant_ini,
           (x.hoje - interval '1 month')::date as ant_fim,
           to_char(x.hoje, 'YYYY-MM') as mkt_mes,
           case when extract(day from x.hoje)
                     > extract(day from (date_trunc('month', x.hoje) + interval '1 month - 1 day')) - 5
                then to_char(x.hoje + interval '1 month', 'YYYY-MM')
                else to_char(x.hoje, 'YYYY-MM') end as mkt_alvo
    from (select (now() at time zone 'America/Sao_Paulo')::date as hoje) x
  ),
  fr as (
    select f.evolution_instance_id as fid, f.name, f.owner_name, f.city, f.state_uf::text as uf, f.created_at as criado
    from public.franchises f
    where f.status = 'active' and not coalesce(f.is_test, false) and f.evolution_instance_id is not null
  )
  select
    fr.fid,
    fr.name,
    fr.owner_name,
    fr.city,
    fr.uf,
    fr.criado,
    (d.hoje - (fr.criado at time zone 'America/Sao_Paulo')::date)::int,
    (d.hoje - (fr.criado at time zone 'America/Sao_Paulo')::date) < 60,
    sv.rev_mtd,
    sv.rev_prev_same,
    case when sv.rev_prev_same >= 3000
         then round(100.0 * (sv.rev_mtd - sv.rev_prev_same) / sv.rev_prev_same, 1) end,
    sv.rev_90d,
    sv.sales_mtd,
    case when sv.last_sale is not null then (d.hoje - sv.last_sale)::int end,
    bt.people_7d,
    case when bt.last_bot is not null then (d.hoje - bt.last_bot)::int end,
    po.last_po_at,
    po.last_po_status,
    po.last_po_amount,
    case when po.last_po_at is not null
         then (d.hoje - (po.last_po_at at time zone 'America/Sao_Paulo')::date)::int end,
    pp.pending_po_count,
    d.mkt_mes,
    mk.mes_paid,
    mk.mes_amount,
    mk.mes_raised_at,
    d.mkt_alvo,
    mk.alvo_paid,
    mk.alvo_amount,
    mk.alvo_raised_at,
    ss.subscription_status,
    ss.current_payment_status,
    ss.current_payment_due_date,
    hc.buyers,
    hc.repeat_buyers,
    case when hc.buyers >= 20 then round(100.0 * hc.repeat_buyers / hc.buyers, 1) end,
    hc.tier,
    hc.flags,
    hc.is_standout,
    hc.computed_at,
    ob.status,
    ob.completion_percentage
  from fr
  cross join d
  left join lateral (
    select
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.mes_ini and s.sale_date <= d.hoje), 0) as rev_mtd,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.ant_ini and s.sale_date <= d.ant_fim), 0) as rev_prev_same,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 90 and s.sale_date <= d.hoje), 0) as rev_90d,
      (count(*) filter (where s.sale_date >= d.mes_ini and s.sale_date <= d.hoje))::int as sales_mtd,
      max(s.sale_date) filter (where s.sale_date <= d.hoje) as last_sale
    from public.sales s
    where s.franchise_id = fr.fid
      and s.sale_date > least(d.ant_ini, d.hoje - 90) - 1
  ) sv on true
  left join lateral (
    select
      (select count(distinct b.contact_phone)::int
         from public.vw_bot_conversations b
        where b.franchise_id = fr.fid and b.started_at >= now() - interval '7 days') as people_7d,
      (select (max(b.started_at) at time zone 'America/Sao_Paulo')::date
         from public.vw_bot_conversations b
        where b.franchise_id = fr.fid) as last_bot
  ) bt on true
  left join lateral (
    select p.ordered_at as last_po_at, p.status as last_po_status, p.total_amount as last_po_amount
    from public.purchase_orders p
    where p.franchise_id = fr.fid
    order by p.ordered_at desc
    limit 1
  ) po on true
  left join lateral (
    select count(*)::int as pending_po_count
    from public.purchase_orders p
    where p.franchise_id = fr.fid and p.status = 'pendente'
  ) pp on true
  left join lateral (
    select
      coalesce(bool_or(mp.reference_month = d.mkt_mes), false) as mes_paid,
      coalesce(sum(mp.amount) filter (where mp.reference_month = d.mkt_mes), 0) as mes_amount,
      max(mp.campaign_raised_at) filter (where mp.reference_month = d.mkt_mes) as mes_raised_at,
      coalesce(bool_or(mp.reference_month = d.mkt_alvo), false) as alvo_paid,
      coalesce(sum(mp.amount) filter (where mp.reference_month = d.mkt_alvo), 0) as alvo_amount,
      max(mp.campaign_raised_at) filter (where mp.reference_month = d.mkt_alvo) as alvo_raised_at
    from public.marketing_payments mp
    where mp.franchise_id = fr.fid
      and mp.status = 'confirmed'
      and mp.reference_month in (d.mkt_mes, d.mkt_alvo)
  ) mk on true
  left join public.system_subscriptions ss on ss.franchise_id = fr.fid
  left join public.onboarding_checklists ob on ob.franchise_id = fr.fid
  left join public.franchise_health_cache hc on hc.franchise_id = fr.fid
  order by fr.name;
end;
$function$;

revoke execute on function public.get_admin_network_overview() from public, anon;
grant execute on function public.get_admin_network_overview() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
*/
