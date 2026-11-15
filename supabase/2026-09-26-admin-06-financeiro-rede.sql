-- 2026-09-26 admin 06 — get_financeiro_rede(p_month): o "Fechamento do mês" do Financeiro em 1 consulta
--
-- POR QUE
-- A tela Financeiro (admin) carregava 13 meses de vendas da rede INTEIRA no front (fetchAll de
-- sales + expenses + inventory_items + sale_items em lotes) para montar uma tabela por unidade.
-- O plano do redesenho (principio 7) pede uma consulta agregada por tela. Esta RPC alimenta a
-- aba "Fechamento do mês" (prototipo Financeiro.dc.html): resumo da rede, "a receber das
-- unidades", vendas sem confirmar pagamento e a tabela por unidade.
--
-- POR QUE NAO REUSAR get_fechamento_mensal (2026-09-07)
-- 1. Corta o mes anterior UM DIA mais curto que o atual: no dia 26 compara 1..26/09 com
--    1..25/08 (v_ant_fim exclusivo = ant_ini + 25 dias). Aqui = get_admin_network_overview:
--    1..hoje x 1..(hoje - 1 mes), os dois inclusivos.
-- 2. Tira teste pelo NOME (!~* 'teste'); aqui e `franchises.is_test` (regra do plano).
-- 3. Verba: so olha reference_month = p_month. No mes corrente a tela precisa da mesma regra de
--    "sem verba" da Unidades (nao pagou o mes do calendario NEM o mes-alvo), senao o numero do
--    Financeiro nao bate com o filtro /Marketing?tab=investimento&filtro=sem_verba.
-- 4. Calcula lucro/despesas que a tela nova nao mostra.
-- A get_fechamento_mensal continua existindo (FechamentoMensal.jsx sai de uso com esta tela;
-- candidata a DROP depois do deploy).
--
-- REGRAS
-- - Faturamento = value - discount_amount + delivery_fee (getSaleNetValue).
-- - Mes corrente: 1..hoje (BRT) x mesmo trecho do mes anterior (31/03 vira 28-29/02 pelo interval).
--   Mes fechado: mes inteiro x mes anterior inteiro. Mes futuro: 0 linhas.
-- - rev_delta_pct so com base >= R$ 3.000 (piso do plano); abaixo vem NULL.
-- - Unidade: nao teste, com evolution_instance_id, ativa OU com venda no mes (mes passado de
--   unidade encerrada ainda conta no faturamento da rede).
-- - Venda sem confirmar = payment_confirmed is not true, no mes.
-- - marketing_month = mes do CALENDARIO (p_month, decisao 2 da Onda 1: e o mes principal, o
--   mesmo nome que Hoje/Unidades/Marketing usam). marketing_target_month = mes-alvo (so difere
--   do calendario no mes corrente, nos ultimos 5 dias: mes seguinte). marketing_month_paid e
--   marketing_target_paid: confirmado em cada um. "Sem verba do mes" = not marketing_month_paid
--   and not marketing_target_paid (mesma regra de public.get_admin_network_overview.semVerba).
-- - Mensalidade: status ATUAL de system_subscriptions (nao e historico do mes).
--
-- SEGURANCA
-- SECURITY DEFINER + guard fail-closed coalesce(is_admin_or_manager(), false) -> 0 linhas;
-- STABLE; search_path fixo; revoke de public/anon.
--
-- MEDIDO (26/09/2026, corpo inline via execute_sql, SELECT puro)
--   setembro: 66 linhas · ~35 KB de JSON · rede R$ 310.943,97 (1..26/09) x R$ 322.851,80
--   (1..26/08, igual ao rev_prev_same somado da get_admin_network_overview) · 175 vendas sem
--   confirmar · sem verba 7 · mensalidades OVERDUE 3 · caiu 20%+ 17 (bate com a overview).
--   Conferido a mao: Tatuape 4.887,70 x 8.804,68, 14 sem confirmar (= prototipo).
--   Tempo: ver o fim do arquivo (EXPLAIN ANALYZE do corpo).
--
-- ROLLBACK
--   drop function if exists public.get_financeiro_rede(text);

-- o tipo de retorno mudou na correcao de 26/09 (marketing_month_paid/target): precisa do drop
drop function if exists public.get_financeiro_rede(text);

create or replace function public.get_financeiro_rede(p_month text)
returns table (
  franchise_id text,
  franchise_name text,
  owner_name text,
  is_active boolean,
  rev_month numeric,
  rev_prev_same numeric,
  rev_delta_pct numeric,
  sales_count integer,
  unconfirmed_count integer,
  unconfirmed_value numeric,
  marketing_month text,
  marketing_month_paid boolean,
  marketing_target_month text,
  marketing_target_paid boolean,
  subscription_status text,
  subscription_payment_status text,
  subscription_due_date date,
  subscription_value numeric,
  period_start date,
  period_end date,
  prev_start date,
  prev_end date
)
language plpgsql
stable
security definer
set search_path = 'public'
as $fn$
#variable_conflict use_column
declare
  v_ini date;
begin
  if not coalesce((select public.is_admin_or_manager()), false) then
    return;
  end if;

  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    return;
  end if;
  v_ini := to_date(p_month || '-01', 'YYYY-MM-DD');

  return query
  with
  d0 as (
    select p_month as mes, (now() at time zone 'America/Sao_Paulo')::date as hoje, v_ini as mes_ini
  ),
  d as (
    select d0.*,
      case when d0.mes_ini = date_trunc('month', d0.hoje)::date then d0.hoje
           else (d0.mes_ini + interval '1 month' - interval '1 day')::date end as mes_fim,
      (d0.mes_ini - interval '1 month')::date as ant_ini,
      case when d0.mes_ini = date_trunc('month', d0.hoje)::date then (d0.hoje - interval '1 month')::date
           else d0.mes_ini - 1 end as ant_fim,
      case when d0.mes_ini = date_trunc('month', d0.hoje)::date
            and extract(day from d0.hoje)
                > extract(day from (date_trunc('month', d0.hoje) + interval '1 month - 1 day')) - 5
           then to_char(d0.hoje + interval '1 month', 'YYYY-MM')
           else d0.mes end as mkt_alvo
    from d0
    where d0.mes_ini <= date_trunc('month', d0.hoje)::date
  ),
  sv as (
    select s.franchise_id as fid,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.mes_ini), 0) as rev,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date <= d.ant_fim), 0) as rev_ant,
      (count(*) filter (where s.sale_date >= d.mes_ini))::int as n,
      (count(*) filter (where s.sale_date >= d.mes_ini and s.payment_confirmed is not true))::int as n_nc,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.mes_ini and s.payment_confirmed is not true), 0) as v_nc
    from d
    join public.sales s on s.sale_date >= d.ant_ini and s.sale_date <= d.mes_fim
    where s.sale_date >= d.mes_ini or s.sale_date <= d.ant_fim
    group by s.franchise_id
  ),
  mk as (
    select mp.franchise_id as fid,
      bool_or(mp.reference_month = d.mes) as paid_mes,
      bool_or(mp.reference_month = d.mkt_alvo) as paid_alvo
    from d
    join public.marketing_payments mp
      on mp.status = 'confirmed' and mp.reference_month in (d.mes, d.mkt_alvo)
    group by mp.franchise_id
  )
  select
    f.evolution_instance_id,
    f.name,
    f.owner_name,
    (f.status = 'active'),
    coalesce(sv.rev, 0)::numeric,
    coalesce(sv.rev_ant, 0)::numeric,
    case when coalesce(sv.rev_ant, 0) >= 3000
         then round(100.0 * (coalesce(sv.rev, 0) - sv.rev_ant) / sv.rev_ant, 1) end,
    coalesce(sv.n, 0),
    coalesce(sv.n_nc, 0),
    coalesce(sv.v_nc, 0)::numeric,
    d.mes,
    coalesce(mk.paid_mes, false),
    d.mkt_alvo,
    coalesce(mk.paid_alvo, false),
    ss.subscription_status,
    ss.current_payment_status,
    ss.current_payment_due_date,
    ss.current_payment_value::numeric,
    d.mes_ini,
    d.mes_fim,
    d.ant_ini,
    d.ant_fim
  from d
  cross join public.franchises f
  left join sv on sv.fid = f.evolution_instance_id
  left join mk on mk.fid = f.evolution_instance_id
  left join public.system_subscriptions ss on ss.franchise_id = f.evolution_instance_id
  where f.evolution_instance_id is not null
    and not coalesce(f.is_test, false)
    and (f.status = 'active' or coalesce(sv.n, 0) > 0)
  order by coalesce(sv.rev, 0) desc;
end;
$fn$;

revoke execute on function public.get_financeiro_rede(text) from public, anon;
grant execute on function public.get_financeiro_rede(text) to authenticated, service_role;

-- Para o PostgREST enxergar a funcao nova sem esperar:
notify pgrst, 'reload schema';

-- CONFERENCIA (query SEPARADA; os dois `materialized` sao obrigatorios)
-- 1) como admin (esperado em 26/09 a noite: 66 linhas; rede ~R$ 311 mil x R$ 322.851,80;
--    sem_verba 7; vencidas 3; caiu20 17):
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_financeiro_rede('2026-09') r)
--    select count(*), sum(rev_month), sum(rev_prev_same), sum(unconfirmed_count),
--           count(*) filter (where not marketing_month_paid and not marketing_target_paid and is_active) sem_verba,
--           count(*) filter (where subscription_payment_status = 'OVERDUE') vencidas,
--           count(*) filter (where rev_delta_pct <= -20) caiu20
--    from o;
-- 2) fail-closed: sem claims (execute_sql puro) -> 0 linhas:
--    select count(*) from public.get_financeiro_rede('2026-09');
-- 3) mes invalido / futuro -> 0 linhas: get_financeiro_rede('2026-13'), get_financeiro_rede('2099-01').
-- 4) anon: POST /rest/v1/rpc/get_financeiro_rede com a chave anon -> 401/permission denied.
