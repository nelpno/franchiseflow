-- Backup do corpo VIVO (pg_get_functiondef) antes de supabase/2026-11-10-cs-mural-consertos.sql.
-- O conserto MUDA o RETURNS TABLE (colunas novas no fim): para voltar, o drop abaixo vem antes do create.
begin;
drop function if exists public.cs_unit_motives(numeric);
CREATE OR REPLACE FUNCTION public.cs_unit_motives(p_corte_rel numeric DEFAULT '-20'::integer)
 RETURNS TABLE(franchise_id text, franchise_name text, owner_name text, phone text, age_days integer, nova_trilha boolean, rev_mtd numeric, rev_prev_same numeric, rev_delta_pct numeric, rede_delta_pct numeric, caiu_delta_pct numeric, caiu_metodo text, caiu_sem_leitura boolean, caiu_qualquer_medida boolean, rev_90d numeric, rev_28d numeric, rev_30d numeric, days_since_last_sale integer, last_sale date, days_since_last_bot integer, days_since_last_po integer, mkt_mes text, mkt_paid boolean, sub_overdue boolean, motives jsonb, top_key text, top_value numeric, top_text text, rev_month_before numeric, baseline_rev_day numeric, agreement jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with
d as (
  select x.hoje, x.agora,
         date_trunc('month', x.hoje)::date as mes_ini,
         (date_trunc('month', x.hoje) - interval '1 month')::date as ant_ini,
         (x.hoje - interval '1 month')::date as ant_fim,
         to_char(x.hoje, 'YYYY-MM') as mkt_mes,
         case when extract(day from x.hoje)
                   > extract(day from (date_trunc('month', x.hoje) + interval '1 month - 1 day')) - 5
              then to_char(x.hoje + interval '1 month', 'YYYY-MM')
              else to_char(x.hoje, 'YYYY-MM') end as mkt_alvo
  from (select public.cs_hoje() as hoje, public.cs_agora() as agora) x
),
fr as (
  select f.evolution_instance_id as fid, f.name, f.owner_name,
         nullif(regexp_replace(coalesce(nullif(f.phone_number, ''), nullif(fc.personal_phone_for_summary, '')), '\D', '', 'g'), '') as phone,
         (d.hoje - (f.created_at at time zone 'America/Sao_Paulo')::date)::int as age_days,
         ob.status as onb_status
  from public.franchises f
  cross join d
  left join public.franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
  left join public.onboarding_checklists ob on ob.franchise_id = f.evolution_instance_id
  where f.status = 'active' and not coalesce(f.is_test, false) and f.evolution_instance_id is not null
    and f.created_at <= d.agora
),
base0 as (
  select fr.fid, fr.name, fr.owner_name, fr.phone, fr.age_days, d.hoje, d.mkt_mes,
    (fr.age_days < 60 and coalesce(fr.onb_status, '') <> 'approved') as nova_trilha,
    sv.rev_mtd, sv.rev_prev_same, sv.rev_90d, sv.rev_28d, sv.rev_60d, sv.rev30, sv.revprev30, sv.c28, sv.p28,
    case when sv.rev_prev_same >= 3000
         then round(100.0 * (sv.rev_mtd - sv.rev_prev_same) / sv.rev_prev_same, 1) end as delta,
    case when sv.revprev30 > 0
         then round(100.0 * (sv.rev30 - sv.revprev30) / sv.revprev30, 1) end as delta30,
    case when extract(day from d.hoje) >= 10 and sv.rev_prev_same >= 3000 then 'mes'
         when sv.p28 >= 3000 then '28d' end as caiu_metodo,
    ls.last_sale,
    case when ls.last_sale is not null then (d.hoje - ls.last_sale)::int end as d_sale,
    ls.rev_90_ate_ultima,
    po.last_po_at, po.compra60,
    case when po.last_po_at is not null
         then (d.hoje - (po.last_po_at at time zone 'America/Sao_Paulo')::date)::int end as d_po,
    pb.med as po_med,
    greatest(14, least(45, round(coalesce(pb.med, 15) * 2)))::int as po_limiar,
    bt.last_bot,
    case when bt.last_bot is not null then (d.hoje - bt.last_bot)::int end as d_bot,
    bs.vend_win, bs.vend_bot_win,
    (coalesce(bs.vend_win, 0) >= 5
      and coalesce(bs.vend_bot_win, 0)::numeric / nullif(bs.vend_win, 0) >= 0.20) as bot_era_canal,
    coalesce(mk.paid, false) as mkt_paid,
    coalesce(ss.current_payment_status = 'OVERDUE', false) as sub_overdue
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
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date >= d.hoje - 28 and s.sale_date < d.hoje), 0) as rev_28d,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 60 and s.sale_date <= d.hoje), 0) as rev_60d,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 30 and s.sale_date <= d.hoje), 0) as rev30,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 60 and s.sale_date <= d.hoje - 30), 0) as revprev30,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 28 and s.sale_date <= d.hoje), 0) as c28,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 56 and s.sale_date <= d.hoje - 28), 0) as p28
    from public.sales s
    where s.franchise_id = fr.fid
      and s.sale_date > least(d.ant_ini, d.hoje - 90) - 1
      and s.sale_date <= d.hoje
  ) sv on true
  left join lateral (
    select u.last_sale,
           (select coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)), 0)
              from public.sales s
             where s.franchise_id = fr.fid
               and s.sale_date > u.last_sale - 90 and s.sale_date <= u.last_sale) as rev_90_ate_ultima
    from (select max(s.sale_date) as last_sale
            from public.sales s where s.franchise_id = fr.fid and s.sale_date <= d.hoje) u
  ) ls on true
  left join lateral (
    select max(p.ordered_at) as last_po_at,
           coalesce(sum(p.total_amount) filter (where p.ordered_at > d.agora - interval '60 days'), 0) as compra60
    from public.purchase_orders p
    where p.franchise_id = fr.fid and p.status <> 'cancelado' and p.ordered_at <= d.agora
  ) po on true
  left join lateral (
    select percentile_cont(0.5) within group (order by x.dd) as med
    from (select p.ordered_at::date - lag(p.ordered_at::date) over (order by p.ordered_at) as dd
            from public.purchase_orders p
           where p.franchise_id = fr.fid and p.status <> 'cancelado'
             and p.ordered_at > d.agora - interval '6 months' and p.ordered_at <= d.agora) x
    where x.dd > 0
    having count(*) >= 3
  ) pb on true
  left join lateral (
    select (max(b.started_at) at time zone 'America/Sao_Paulo')::date as last_bot
    from public.vw_bot_conversations b
    where b.franchise_id = fr.fid and b.started_at <= d.agora
  ) bt on true
  left join lateral (
    select count(*)::int as vend_win,
           count(*) filter (where s.source = 'bot')::int as vend_bot_win
    from public.sales s
    where s.franchise_id = fr.fid
      and s.sale_date >  coalesce(bt.last_bot, d.hoje) - 60
      and s.sale_date <= coalesce(bt.last_bot, d.hoje)
  ) bs on true
  left join lateral (
    select bool_or(true) as paid
    from public.marketing_payments mp
    where mp.franchise_id = fr.fid and mp.status = 'confirmed'
      and mp.reference_month in (d.mkt_mes, d.mkt_alvo)
  ) mk on true
  left join public.system_subscriptions ss on ss.franchise_id = fr.fid
),
rede as (
  select case when sum(b.rev_prev_same) > 0
              then round(100.0 * (sum(b.rev_mtd) - sum(b.rev_prev_same)) / sum(b.rev_prev_same), 1) end as rede_mes,
         case when sum(b.p28) > 0
              then round(100.0 * (sum(b.c28) - sum(b.p28)) / sum(b.p28), 1) end as rede_28
  from base0 b
),
base as (
  select b.*,
    case b.caiu_metodo when 'mes' then b.delta
                       when '28d' then round(100.0 * (b.c28 - b.p28) / b.p28, 1) end as caiu_delta,
    case b.caiu_metodo when 'mes' then r.rede_mes when '28d' then r.rede_28 end as caiu_rede,
    r.rede_mes,
    -- caiu em QUALQUER das duas medidas (mes com base, ou 28x28 com base): so para SEGURAR cartao
    -- 'caiu' aberto na troca de medida (dia 1 e dia 10), nunca para abrir
    ( (b.delta is not null and b.delta <= least(-20::numeric, coalesce(r.rede_mes, 0) + p_corte_rel))
      or (b.p28 >= 3000 and round(100.0 * (b.c28 - b.p28) / b.p28, 1)
                            <= least(-20::numeric, coalesce(r.rede_28, 0) + p_corte_rel)) ) as caiu_qualquer
  from base0 b cross join rede r
),
mot as (
  select b.fid, 'sem_venda'::text as k, 1 as ord, coalesce(b.d_sale, 9999)::numeric as val,
    case when b.last_sale is null then 'Nunca registrou venda'
         else 'Sem venda desde ' || to_char(b.last_sale, 'DD/MM') || ' (' || b.d_sale || ' dias)' end as txt
  from base b
  where case when b.nova_trilha then b.d_sale is not null and b.d_sale > 30
             else b.d_sale is null or b.d_sale >= 7 end
  union all
  select b.fid, 'caiu', 2, b.caiu_delta,
    'Venda ' || replace(b.caiu_delta::text, '.', ',') || '% '
      || case b.caiu_metodo when 'mes' then 'no mês até ' || to_char(b.hoje, 'DD/MM')
              else 'nos últimos 28 dias até ' || to_char(b.hoje, 'DD/MM') end
      || coalesce(' (rede ' || replace(b.caiu_rede::text, '.', ',') || '%)', '')
  from base b
  where not b.nova_trilha and b.caiu_delta is not null
    and b.caiu_delta <= least(-20::numeric, coalesce(b.caiu_rede, 0) + p_corte_rel)
  union all
  select b.fid, 'nao_lanca', 3, round(b.rev_60d / b.compra60, 2),
    'Comprou R$ ' || replace(to_char(round(b.compra60), 'FM999,999,990'), ',', '.')
      || ' da fábrica e lançou R$ ' || replace(to_char(round(b.rev_60d), 'FM999,999,990'), ',', '.')
      || ' em venda nos últimos 60 dias'
  from base b
  where b.age_days >= 60 and b.compra60 >= 2000 and b.rev_60d < 0.9 * b.compra60
  union all
  select b.fid, 'robo_parado', 4, b.d_bot,
    'Robô sem conversa desde ' || to_char(b.last_bot, 'DD/MM') || ' (fechava '
      || round(100.0 * b.vend_bot_win / nullif(b.vend_win, 0)) || '% das vendas)'
  from base b
  where not b.nova_trilha and b.d_sale is not null and b.d_bot is not null
    and b.d_bot >= 7 and b.bot_era_canal
  union all
  select b.fid, 'sem_comprar', 5, b.d_po,
    'Sem comprar da fábrica desde ' || to_char((b.last_po_at at time zone 'America/Sao_Paulo')::date, 'DD/MM')
      || ' (' || b.d_po || ' dias' || coalesce('; o normal dela é a cada ' || round(b.po_med) || ' dias', '') || ')'
  from base b
  where not b.nova_trilha and b.d_po is not null and b.d_po >= b.po_limiar
    and coalesce(b.delta, b.delta30, 0) <= 0
),
ag as (
  -- acordos vivos (para mostrar) e se cada um segura cartao (review_at futuro + piso de receita)
  select a.franchise_id as fid, a.signal_key, a.reason, a.author_name, a.review_at, a.created_at,
         ( a.review_at is not null and a.review_at > d.hoje
           and (a.revenue_baseline is null
                or coalesce((select b.rev30 from base b where b.fid = a.franchise_id), 0)
                   >= a.revenue_baseline * a.revenue_floor_pct / 100.0) ) as segura
  from public.cs_agreements a cross join d
  where a.revoked_at is null
    and (a.review_at is null or a.review_at > d.hoje)
),
mb as (
  select m.*,
    exists (
      select 1 from ag
      where ag.fid = m.fid and ag.segura
        and ( ag.signal_key = '*'
           or ag.signal_key = m.k
           or ag.signal_key = case m.k when 'sem_venda' then 'stopped_selling'
                                       when 'caiu' then 'revenue_drop'
                                       when 'nao_lanca' then 'giro_baixo'
                                       when 'sem_comprar' then 'stopped_buying' end
           or (m.k = 'robo_parado' and ag.signal_key in ('bot_silent', 'bot_never')) )
    ) as bloqueado
  from mot m
),
topm as (
  select distinct on (mb.fid) mb.fid, mb.k, mb.val, mb.txt
  from mb where not mb.bloqueado
  order by mb.fid, mb.ord
)
select b.fid, b.name, b.owner_name, b.phone,
  b.age_days, b.nova_trilha,
  b.rev_mtd, b.rev_prev_same, b.delta, b.rede_mes,
  b.caiu_delta, b.caiu_metodo, (b.delta is null and b.p28 < 3000 and not b.nova_trilha), (b.caiu_qualquer and not b.nova_trilha),
  b.rev_90d, b.rev_28d, b.rev30,
  b.d_sale, b.last_sale, b.d_bot,
  b.d_po,
  b.mkt_mes, b.mkt_paid, b.sub_overdue,
  coalesce((select jsonb_agg(jsonb_build_object('key', mb.k, 'text', mb.txt, 'value', mb.val, 'blocked', mb.bloqueado)
                             order by mb.ord)
              from mb where mb.fid = b.fid), '[]'::jsonb),
  t.k, t.val, t.txt,
  round(case when t.k = 'sem_venda' then coalesce(b.rev_90_ate_ultima, 0) / 3.0
             else b.rev_90d / 3.0 end, 2),
  round(b.rev_28d / 28.0, 2),
  (select jsonb_build_object('signal_key', ag.signal_key, 'reason', ag.reason,
                             'author_name', ag.author_name, 'review_at', ag.review_at,
                             'holds_card', ag.segura)
     from ag where ag.fid = b.fid
     order by ag.segura desc, (ag.signal_key = '*') desc, ag.created_at desc limit 1)
from base b
left join topm t on t.fid = b.fid
$function$
;
revoke all on function public.cs_unit_motives(numeric) from public, anon, authenticated;
grant execute on function public.cs_unit_motives(numeric) to service_role;
comment on function public.cs_unit_motives(numeric) is 'Regua do Mural do CS (Onda 2, 27/09/2026): motivos por unidade (sem_venda, caiu, nao_lanca, robo_parado, sem_comprar); acordo marca blocked sem apagar. Interna: so RPCs SECURITY DEFINER chamam.';
commit;
