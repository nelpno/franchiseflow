-- Backup get_financeiro_rede antes da S15 (28/09/2026). md5(prosrc)=141f73849c645bb5bdb3d8588bc1de55. Reaplicar este arquivo = voltar.
CREATE OR REPLACE FUNCTION public.get_financeiro_rede(p_month text)
 RETURNS TABLE(franchise_id text, franchise_name text, owner_name text, is_active boolean, rev_month numeric, rev_prev_same numeric, rev_delta_pct numeric, sales_count integer, unconfirmed_count integer, unconfirmed_value numeric, marketing_month text, marketing_month_paid boolean, marketing_target_month text, marketing_target_paid boolean, subscription_status text, subscription_payment_status text, subscription_due_date date, subscription_value numeric, period_start date, period_end date, prev_start date, prev_end date, unconfirmed_old_count integer, future_count integer, po_amount numeric, po_prev_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               filter (where s.sale_date >= d.mes_ini and s.payment_confirmed is not true), 0) as v_nc,
      -- NOVO: só a fração da pendência com mais de 7 dias (achado #21 — o "173" mistura
      -- venda de hoje, normal, com pendência de verdade).
      (count(*) filter (where s.sale_date >= d.mes_ini and s.payment_confirmed is not true
                         and s.sale_date <= d.hoje - 7))::int as n_nc_old
    from d
    join public.sales s on s.sale_date >= d.ant_ini and s.sale_date <= d.mes_fim
    where s.sale_date >= d.mes_ini or s.sale_date <= d.ant_fim
    group by s.franchise_id
  ),
  -- NOVO: vendas do mês com data FUTURA (> hoje BRT) — a CTE `sv` acima nem as enxerga
  -- porque o join corta em `d.mes_fim` (achado #22, 7 casos medidos em 26/09).
  fu as (
    select s.franchise_id as fid, count(*)::int as n
    from d
    join public.sales s
      on s.sale_date > d.mes_fim
     and s.sale_date < (d.mes_ini + interval '1 month')::date
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
  ),
  -- NOVO: pedidos à fábrica (entregue + confirmado, nunca cancelado) no mesmo trecho do
  -- mês e do mês anterior, pela data BRT de `ordered_at` (achado #22 — "quanto a Maxi
  -- recebe" não aparecia em lugar nenhum do Financeiro).
  po as (
    select po.franchise_id as fid,
      coalesce(sum(po.total_amount) filter (
        where (po.ordered_at at time zone 'America/Sao_Paulo')::date >= d.mes_ini
          and (po.ordered_at at time zone 'America/Sao_Paulo')::date <= d.mes_fim
      ), 0) as amt,
      coalesce(sum(po.total_amount) filter (
        where (po.ordered_at at time zone 'America/Sao_Paulo')::date >= d.ant_ini
          and (po.ordered_at at time zone 'America/Sao_Paulo')::date <= d.ant_fim
      ), 0) as amt_ant
    from d
    join public.purchase_orders po
      on po.status in ('entregue', 'confirmado')
     and (po.ordered_at at time zone 'America/Sao_Paulo')::date >= d.ant_ini
     and (po.ordered_at at time zone 'America/Sao_Paulo')::date <= d.mes_fim
    group by po.franchise_id
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
    d.ant_fim,
    coalesce(sv.n_nc_old, 0),
    coalesce(fu.n, 0),
    coalesce(po.amt, 0)::numeric,
    coalesce(po.amt_ant, 0)::numeric
  from d
  cross join public.franchises f
  left join sv on sv.fid = f.evolution_instance_id
  left join fu on fu.fid = f.evolution_instance_id
  left join mk on mk.fid = f.evolution_instance_id
  left join po on po.fid = f.evolution_instance_id
  left join public.system_subscriptions ss on ss.franchise_id = f.evolution_instance_id
  where f.evolution_instance_id is not null
    and not coalesce(f.is_test, false)
    and (f.status = 'active' or coalesce(sv.n, 0) > 0)
  order by coalesce(sv.rev, 0) desc;
end;
$function$
;
