-- 2026-09-26 admin 04 — get_admin_network_overview(): 1 linha por unidade, 1 consulta por tela
--
-- POR QUE
-- A home do admin hoje monta a rede no front: ~27 pedidos e ~3,4 MB (fetchAll de sales,
-- bot_conversations etc.). O plano do redesenho (principio 7) pede uma consulta agregada por
-- tela. Esta RPC alimenta "Hoje" (cartoes "quem precisa de voce" e "pendencias") e "Unidades"
-- (lista + chips de filtro) do prototipo https://claude.ai/artifact/UFzS3jtTGbbsPsXdCq4hJk.
--
-- REGRAS APLICADAS (plano, principios 3-5)
-- - So unidade ativa e NAO teste (`status='active'`, `not is_test`): 66 linhas em 26/09.
-- - Datas em Sao Paulo: hoje = (now() at time zone 'America/Sao_Paulo')::date.
-- - Faturamento = value - discount_amount + delivery_fee (mesma formula de getSaleNetValue).
-- - Comparacao honesta: mes ate hoje (1..hoje) x MESMO trecho do mes anterior (1..hoje-1 mes;
--   31/03 vira 28-29/02 pelo proprio interval). `rev_delta_pct` so com base >= R$ 3.000
--   (piso do plano); abaixo disso vem NULL e a tela nao mostra %.
-- - Venda com sale_date no futuro nao conta (<= hoje).
-- - Robo: pessoas DISTINTAS (contact_phone) em vw_bot_conversations nos ultimos 7 dias; a view
--   ja tira manual_sale/duplicate_stale.
-- - Marketing: devolve os DOIS meses, sem escolher pela tela:
--     marketing_month_*   = mes do calendario (o que esta rodando; "pagou e nao subiu" sai daqui)
--     marketing_target_*  = mes-alvo do formulario (nos ultimos 5 dias do mes = mes seguinte;
--                           fora da janela e igual ao do calendario)
--   "Sem verba do mes" correto = not marketing_month_paid and not marketing_target_paid.
--   So `status='confirmed'` conta como pago; `campaign_raised_at` = campanha no ar.
-- - Tier/flags/recompra vem do cache (franchise_health_cache, arquivo admin-03), nunca do sinal
--   ao vivo (3,6 s). `health_computed_at` diz de quando e o cache; NULL = cache ainda vazio.
-- - `is_new` = menos de 60 dias desde franchises.created_at ("Nova na trilha", nunca "sem venda").
--
-- SEGURANCA
-- SECURITY DEFINER (le tabelas da rede inteira) com guard no corpo:
--   coalesce(is_cs_or_admin() or is_admin_or_manager(), false) — sem perfil, os helpers devolvem
--   NULL/false e a funcao devolve 0 linhas (fail-closed; licao da get_onboarding_facts).
-- is_cs_or_admin() ja inclui admin/manager/customer_success; o OR com is_admin_or_manager() e so
-- defesa se um dia o helper do CS mudar. `revoke ... from public, anon`.
--
-- MEDIDO (26/09/2026, corpo inline via execute_sql, sem gravar nada; cache simulado por constante)
--   66 linhas · 87 ms quente / ~380 ms frio (o frio e o index-only scan do robo com heap fetch) ·
--   73 KB de JSON cru com flags vazias; com as flags reais (~190 B por unidade) ~86 KB. Isto e
--   MAIOR que os "~15 KB" do plano (que parece ter sido medido com menos colunas); o tamanho
--   comprimido (gzip do PostgREST) NAO foi medido. Se precisar cortar: tirar created_at, city,
--   state_uf, subscription_status e os *_amount que a lista nao mostra.
--   Bate com o prototipo: sem venda 7+ dias (fora novas) = 5 · robo parado 7+ dias = 8 ·
--   caiu 20%+ = 17 · subiu 20%+ = 8 · novas = 8 · sem verba de setembro = 7 · mensalidade
--   OVERDUE = 3 · rede mes ate hoje R$ 306.793,61 x R$ 322.851,80 no mesmo trecho de agosto.
--   A contagem de recompra (contacts) saiu daqui para o cache: ao vivo ela sozinha custava
--   90-210 ms.
--
-- DEPENDE DE: admin-03 (tabela franchise_health_cache). Sem ela a funcao nem compila.

create or replace function public.get_admin_network_overview()
returns table (
  franchise_id text,
  franchise_name text,
  owner_name text,
  city text,
  state_uf text,
  created_at timestamptz,
  age_days integer,
  is_new boolean,
  rev_mtd numeric,
  rev_prev_same numeric,
  rev_delta_pct numeric,
  rev_90d numeric,
  sales_mtd integer,
  days_since_last_sale integer,
  people_7d integer,
  days_since_last_bot integer,
  last_po_at timestamptz,
  last_po_status text,
  last_po_amount numeric,
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
  subscription_status text,
  subscription_payment_status text,
  subscription_due_date date,
  buyers integer,
  repeat_buyers integer,
  repeat_rate_pct numeric,
  tier text,
  flags jsonb,
  is_standout boolean,
  health_computed_at timestamptz,
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
$fn$;

revoke execute on function public.get_admin_network_overview() from public, anon;
grant execute on function public.get_admin_network_overview() to authenticated, service_role;

-- CONFERÊNCIA (rodar em query separada; os dois `materialized` sao obrigatorios)
-- 1) como admin (esperado em 26/09: 66 linhas; sem_venda7 5; robo7 8; caiu20 17; subiu20 8;
--    novas 8; sem_verba 7; pago_nao_subiu 1; vencidas 3):
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_admin_network_overview() r)
--    select count(*) linhas,
--           count(*) filter (where days_since_last_sale >= 7 and not is_new) sem_venda7,
--           count(*) filter (where days_since_last_bot >= 7) robo7,
--           count(*) filter (where rev_delta_pct <= -20) caiu20,
--           count(*) filter (where rev_delta_pct >= 20) subiu20,
--           count(*) filter (where is_new) novas,
--           count(*) filter (where not marketing_month_paid and not marketing_target_paid) sem_verba,
--           count(*) filter (where marketing_month_paid and marketing_month_raised_at is null) pago_nao_subiu,
--           count(*) filter (where subscription_payment_status = 'OVERDUE') vencidas,
--           count(*) filter (where tier is null) sem_cache,
--           sum(length(row_to_json(o)::text)) bytes
--    from o;
-- 2) fail-closed: sem claims (execute_sql puro) -> 0 linhas:
--    select count(*) from public.get_admin_network_overview();
-- 3) como franqueado (troque o uuid por um profiles.role='franchisee') -> 0 linhas:
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub','<uuid franqueado>')::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_admin_network_overview() r)
--    select count(*) from o;
-- 4) anon: POST /rest/v1/rpc/get_admin_network_overview com a chave anon -> 401/permission denied.
-- 5) tempo: explain (analyze) do corpo inline (a funcao plpgsql aparece opaca no EXPLAIN).
