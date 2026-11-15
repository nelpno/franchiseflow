-- 2026-11-10 cs — consertos do Mural do CS (revisao de 10/11/2026, cs-celso/analises/2026-11-10-revisao-fable.md 2.5)
--
-- Partindo dos corpos VIVOS (docs/db-backups/*.2026-11-10-antes.sql, paridade arquivo x banco
-- conferida por md5(prosrc) antes de aplicar):
--   D1  cs_unit_motives: "caiu" pelo mes ate hoje (dia 10+) so abre se a MEDIDA DE BASE tambem cai
--       (28x28; unidade pequena: 8x8 semanas confirmada pelo 28x28). Reconcile segura o cartao
--       'caiu' so pela medida de base (antes: qualquer das duas, e o mes sozinho segurava).
--   D2  unidade pequena (28 dias anteriores < R$ 3 mil) ganha leitura em 8 x 8 semanas (base R$ 3 mil
--       nas 8 semanas anteriores) confirmada pelo 28x28; sem leitura nenhuma, o cartao 'caiu' deixa de
--       ficar preso (fecha como resolveu_sozinho em 3 dias). Colunas novas no fim do RETURNS TABLE:
--       caiu_base_delta, caiu_base_metodo, caiu_base_medida (leitura de hoje mostrada no cartao).
--   D3  acordo cs_agreements signal_key='*' segura o cartao sempre (sem depender de review_at) e
--       cs_card_lanes poe o cartao da unidade em 'com_nelson'.
--   D6  registrar_cs_conversa: 4o "Enviei, sem resposta" (nao_respondeu) seguido no mesmo cartao
--       manda para o Nelson (escalated_at + evento 'escalate' com created_by nulo = sistema).
--       Funcao nova cs_sem_resposta_seguidas(task) (o 3o vira chip "Ligar" na tela).
--   6   get_cs_mural: "Falar hoje" ordena por R$ em risco (base do cartao - ritmo de 28 dias levado a
--       30) e o cartao leva base_mes, ritmo_mes, risco_mes, leitura de hoje, alarme mais grave
--       (top_motivo_*), out_of_rule_since e sem_resposta_seguidas.
--
-- COMO DESFAZER (ROLLBACK), nesta ordem, cada um por node supabase/cs-cockpit/_aplica-lf.mjs <arq>:
--   docs/db-backups/cs_unit_motives.2026-11-10-antes.sql   (tem o drop + grants + comment)
--   docs/db-backups/cs_card_lanes.2026-11-10-antes.sql
--   docs/db-backups/reconcile_cs_auto_tasks.2026-11-10-antes.sql
--   docs/db-backups/get_cs_mural.2026-11-10-antes.sql
--   docs/db-backups/registrar_cs_conversa.2026-11-10-antes.sql
--   e por ultimo: drop function if exists public.cs_sem_resposta_seguidas(uuid);
-- Dado nenhum e alterado por este arquivo (cartoes escalados pelo D6 depois do deploy ficam; desfazer
-- um: update cs_tasks set escalated_at = null, escalated_note = null where id = '<id>').
-- LF. Aplicar por node supabase/cs-cockpit/_aplica-lf.mjs.

begin;

CREATE OR REPLACE FUNCTION public.cs_sem_resposta_seguidas(p_task_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from public.cs_worklist_events e
  where e.task_id = p_task_id
    and e.event_type in ('contact', 'meeting')
    and e.outcome = 'nao_respondeu'
    and e.created_at > coalesce((
          select max(e2.created_at)
          from public.cs_worklist_events e2
          where e2.task_id = p_task_id
            and ( (e2.event_type in ('contact', 'meeting') and e2.outcome is distinct from 'nao_respondeu')
               or e2.event_type in ('resolve', 'auto_resolve') )
        ), '-infinity'::timestamptz)
$function$
;

revoke all on function public.cs_sem_resposta_seguidas(uuid) from public, anon, authenticated;
grant execute on function public.cs_sem_resposta_seguidas(uuid) to service_role;

drop function if exists public.cs_unit_motives(numeric);

CREATE OR REPLACE FUNCTION public.cs_unit_motives(p_corte_rel numeric DEFAULT '-20'::integer)
 RETURNS TABLE(franchise_id text, franchise_name text, owner_name text, phone text, age_days integer, nova_trilha boolean, rev_mtd numeric, rev_prev_same numeric, rev_delta_pct numeric, rede_delta_pct numeric, caiu_delta_pct numeric, caiu_metodo text, caiu_sem_leitura boolean, caiu_qualquer_medida boolean, rev_90d numeric, rev_28d numeric, rev_30d numeric, days_since_last_sale integer, last_sale date, days_since_last_bot integer, days_since_last_po integer, mkt_mes text, mkt_paid boolean, sub_overdue boolean, motives jsonb, top_key text, top_value numeric, top_text text, rev_month_before numeric, baseline_rev_day numeric, agreement jsonb, caiu_base_delta numeric, caiu_base_metodo text, caiu_base_medida boolean)
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
    sv.c56, sv.p56,
    case when sv.rev_prev_same >= 3000
         then round(100.0 * (sv.rev_mtd - sv.rev_prev_same) / sv.rev_prev_same, 1) end as delta,
    case when sv.revprev30 > 0
         then round(100.0 * (sv.rev30 - sv.revprev30) / sv.revprev30, 1) end as delta30,
    case when extract(day from d.hoje) >= 10 and sv.rev_prev_same >= 3000 then 'mes'
         when sv.p28 >= 3000 then '28d'
         when sv.p56 >= 3000 then '56d' end as caiu_metodo,
    case when sv.p28 >= 3000 then '28d'
         when sv.p56 >= 3000 then '56d' end as metodo_base,
    case when sv.p28 >= 3000 then round(100.0 * (sv.c28 - sv.p28) / sv.p28, 1)
         when sv.p56 >= 3000 then round(100.0 * (sv.c56 - sv.p56) / sv.p56, 1) end as delta_base,
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
               filter (where s.sale_date > d.hoje - 56 and s.sale_date <= d.hoje - 28), 0) as p28,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 56 and s.sale_date <= d.hoje), 0) as c56,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where s.sale_date > d.hoje - 112 and s.sale_date <= d.hoje - 56), 0) as p56
    from public.sales s
    where s.franchise_id = fr.fid
      and s.sale_date > least(d.ant_ini, d.hoje - 112) - 1
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
              then round(100.0 * (sum(b.c28) - sum(b.p28)) / sum(b.p28), 1) end as rede_28,
         case when sum(b.p56) > 0
              then round(100.0 * (sum(b.c56) - sum(b.p56)) / sum(b.p56), 1) end as rede_56
  from base0 b
),
base as (
  select b.*,
    case b.caiu_metodo when 'mes' then b.delta
                       when '28d' then round(100.0 * (b.c28 - b.p28) / b.p28, 1)
                       when '56d' then round(100.0 * (b.c56 - b.p56) / b.p56, 1) end as caiu_delta,
    case b.caiu_metodo when 'mes' then r.rede_mes when '28d' then r.rede_28 when '56d' then r.rede_56 end as caiu_rede,
    r.rede_mes,
    ( b.delta_base is not null
      and b.delta_base <= least(-20::numeric, coalesce(case b.metodo_base when '28d' then r.rede_28
                                                                      when '56d' then r.rede_56 end, 0) + p_corte_rel)
      and ( b.metodo_base = '28d'
         or ( b.p28 > 0 and round(100.0 * (b.c28 - b.p28) / b.p28, 1)
                            <= least(-20::numeric, coalesce(r.rede_28, 0) + p_corte_rel) ) ) ) as caiu_base,
    -- caiu em QUALQUER das duas medidas (mes com base, ou 28x28 com base): so informativo desde
    -- 10/11/2026 (o reconcile segura o cartao pela medida de base, caiu_base), nunca para abrir
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
              when '56d' then 'nas últimas 8 semanas até ' || to_char(b.hoje, 'DD/MM')
              else 'nos últimos 28 dias até ' || to_char(b.hoje, 'DD/MM') end
      || coalesce(' (rede ' || replace(b.caiu_rede::text, '.', ',') || '%)', '')
  from base b
  where not b.nova_trilha and b.caiu_delta is not null
    and b.caiu_delta <= least(-20::numeric, coalesce(b.caiu_rede, 0) + p_corte_rel)
    and (b.metodo_base is null or b.caiu_base)
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
         ( a.signal_key = '*'
           or ( a.review_at is not null and a.review_at > d.hoje
                and (a.revenue_baseline is null
                     or coalesce((select b.rev30 from base b where b.fid = a.franchise_id), 0)
                        >= a.revenue_baseline * a.revenue_floor_pct / 100.0) ) ) as segura
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
  b.caiu_delta, b.caiu_metodo, (b.delta is null and b.p28 < 3000 and b.p56 < 3000 and not b.nova_trilha), (b.caiu_qualquer and not b.nova_trilha),
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
     order by ag.segura desc, (ag.signal_key = '*') desc, ag.created_at desc limit 1),
  b.delta_base, b.metodo_base, (b.caiu_base and not b.nova_trilha)
from base b
left join topm t on t.fid = b.fid
$function$
;

revoke all on function public.cs_unit_motives(numeric) from public, anon, authenticated;
grant execute on function public.cs_unit_motives(numeric) to service_role;
comment on function public.cs_unit_motives(numeric) is 'Regua do Mural do CS (Onda 2, 27/09/2026; 10/11/2026: mes so abre com a medida de base, 8x8 semanas para unidade pequena, acordo * segura sempre): motivos por unidade (sem_venda, caiu, nao_lanca, robo_parado, sem_comprar); acordo marca blocked sem apagar. Interna: so RPCs SECURITY DEFINER chamam.';

CREATE OR REPLACE FUNCTION public.cs_card_lanes()
 RETURNS TABLE(task_id uuid, lane text, lane_since date, volta_vencida boolean, motive_rank integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with d as (select public.cs_hoje() as hoje)
  select t.id,
    case
      when t.parked_until > public.cs_agora() then 'estacionado'
      when t.column_status = 'feito' then 'resolvidos'
      when t.escalated_at is not null then 'com_nelson'
      when t.franchise_id is not null and exists (
             select 1 from public.cs_agreements a
              where a.franchise_id = t.franchise_id and a.revoked_at is null and a.signal_key = '*'
                and (a.review_at is null or a.review_at > d.hoje)) then 'com_nelson'
      when t.column_status = 'aguardando_retorno'
           and coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7) > d.hoje
        then 'esperando'
      else 'falar_hoje'
    end,
    case
      when t.parked_until > public.cs_agora() then (t.parked_until at time zone 'America/Sao_Paulo')::date
      when t.column_status = 'feito' then (t.resolved_at at time zone 'America/Sao_Paulo')::date
      when t.column_status = 'aguardando_retorno'
        then coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7)
      else (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date
    end,
    (t.column_status = 'aguardando_retorno' and t.next_at is not null and t.next_at <= d.hoje),
    case coalesce(t.motive_key, case when t.source = 'manual' then 'manual' end) when 'sem_venda' then 1 when 'caiu' then 2 when 'nao_lanca' then 3
                      when 'robo_parado' then 4 when 'sem_comprar' then 5 when 'manual' then 6 else 7 end
  from public.cs_tasks t
  cross join d
  left join public.franchises f on f.evolution_instance_id = t.franchise_id
  where not coalesce(f.is_test, false)
    and ( (t.archived_at is null and t.column_status <> 'feito')
       or (t.column_status = 'feito' and t.resolved_at >= public.cs_agora() - interval '30 days')
       or (t.archived_at is null and t.parked_until > public.cs_agora()) )
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_cs_auto_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now  timestamptz := public.cs_agora();
  v_hoje date := public.cs_hoje();
begin
  if not coalesce((select public.is_cs_or_admin()), false) then raise exception 'forbidden'; end if;

  -- 0) cache da saude da rede (igual ao admin-03: as telas Hoje/Unidades/Ficha leem daqui)
  drop table if exists _h;
  create temp table _h on commit drop as select * from public.get_franchise_health_signals();

  insert into public.franchise_health_cache
    (franchise_id, tier, flags, is_standout, signals, buyers, repeat_buyers, computed_at)
  select h.franchise_id, h.tier, coalesce(h.flags, '[]'::jsonb), coalesce(h.is_standout, false),
         to_jsonb(h) - 'flags' - 'tier' - 'is_standout',
         ct.buyers, ct.repeat_buyers, v_now
  from _h h
  left join lateral (
    select count(*)::int as buyers,
           count(*) filter (where c.purchase_count >= 2)::int as repeat_buyers
    from public.contacts c
    where c.franchise_id = h.franchise_id and c.purchase_count >= 1
  ) ct on true
  where h.franchise_id is not null
  on conflict (franchise_id) do update
    set tier = excluded.tier, flags = excluded.flags, is_standout = excluded.is_standout,
        signals = excluded.signals, buyers = excluded.buyers,
        repeat_buyers = excluded.repeat_buyers, computed_at = excluded.computed_at;

  delete from public.franchise_health_cache c
  where not exists (select 1 from _h h where h.franchise_id = c.franchise_id);

  -- regua do Mural (motivos por unidade; top_key nulo = nenhum motivo que vire cartao)
  drop table if exists _m;
  create temp table _m on commit drop as
    select m.*,
           (select string_agg(x->>'text', ' · ' order by ord)
              from jsonb_array_elements(m.motives) with ordinality as a(x, ord)) as alarmes,
           case when m.top_key is not null
                then m.top_text || case when coalesce(m.rev_month_before, 0) >= 1
                                        then ' · vendia ' || public.cs_money(m.rev_month_before) || '/mês' else '' end end as evidencia,
           -- fora da regra = a unidade nao tem NENHUM motivo (nem os que tem acordo: acordo nao e
           -- "resolveu sozinho", conserto B2). Unidade que saiu da regua (teste/inativa) tambem.
           (jsonb_array_length(m.motives) = 0) as sem_motivo
    from public.cs_unit_motives() m;

  -- 1) cartao AUTO aberto: motivo fica congelado; atualiza os alarmes vivos (description),
  --    o numero do motivo (se o MESMO motivo ainda vale) e o relogio "fora da regra".
  --    Cartao auto antigo (antes da Onda 2, motive_key nulo) congela o motivo aqui, 1 vez.
  --    Cartao 'caiu' que ainda cai na MEDIDA DE BASE (28x28; unidade pequena: 8x8 semanas
  --    confirmada pelo 28x28) nao conta como fora da regra. Desde 10/11/2026 o "mes ate hoje"
  --    sozinho nao segura (abria e segurava cartao que o 28x28 desmentia) e unidade sem leitura
  --    nenhuma fecha (antes ficava presa para sempre). Nos dias 1 a 9 o cartao 'caiu' nao arma
  --    o fechamento de jeito nenhum: cai no mais cedo no dia 12.
  with alvo as (
    select t.id, m.franchise_id as mfid, m.top_key, m.top_value, m.evidencia, m.alarmes,
           m.baseline_rev_day, m.rev_month_before, m.motives,
           ( m.franchise_id is null
             or (m.sem_motivo and not (coalesce(t.motive_key, '') = 'caiu'
                                       and (m.caiu_base_medida
                                            or extract(day from v_hoje) <= 9))) ) as fora
    from cs_tasks t
    left join _m m on m.franchise_id = t.franchise_id
    where t.source = 'auto' and t.archived_at is null and t.column_status <> 'feito'
  )
  update cs_tasks t set
      motive_key       = coalesce(t.motive_key, a.top_key),
      motive_evidence  = coalesce(t.motive_evidence, a.evidencia),
      baseline_rev_day = coalesce(t.baseline_rev_day, case when t.motive_key is null and a.top_key is not null then a.baseline_rev_day end),
      rev_month_before = coalesce(t.rev_month_before, case when t.motive_key is null and a.top_key is not null then a.rev_month_before end),
      motive_value     = coalesce((select (x->>'value')::numeric
                                     from jsonb_array_elements(coalesce(a.motives, '[]'::jsonb)) x
                                    where x->>'key' = coalesce(t.motive_key, a.top_key)
                                      and not (x->>'blocked')::boolean
                                    limit 1), t.motive_value),
      description      = coalesce(a.alarmes, t.description),
      out_of_rule_since = case when a.fora then coalesce(t.out_of_rule_since, v_hoje) end,
      updated_at       = v_now
  from alvo a
  where a.id = t.id
    and ( t.motive_key is null
       or t.description is distinct from coalesce(a.alarmes, t.description)
       or a.fora is distinct from (t.out_of_rule_since is not null)
       or t.motive_value is distinct from coalesce((select (x->>'value')::numeric
                                     from jsonb_array_elements(coalesce(a.motives, '[]'::jsonb)) x
                                    where x->>'key' = coalesce(t.motive_key, a.top_key)
                                      and not (x->>'blocked')::boolean
                                    limit 1), t.motive_value) );

  -- 1b) causa conhecida (estacionado pelo Registrar) volta antes se PIOROU desde a anotacao:
  --     queda 10 p.p. maior (cartao auto 'caiu') ou 7+ dias a mais sem venda do que na anotacao
  --     (qualquer cartao, auto ou manual; dias vem da regua, nao do texto do alarme).
  with acorda as (
    update cs_tasks t set parked_until = null, parked_reason = null,
        espera_valor = null, espera_sem_venda = null, espera_dias = null,
        column_status = 'a_fazer', next_at = null, moved_to_column_at = v_now, updated_at = v_now
    where t.archived_at is null and t.column_status <> 'feito'
      and t.parked_until > v_now and t.espera_sem_venda is not null
      and ( (t.source = 'auto' and t.motive_key = 'caiu' and t.motive_value <= t.espera_valor - 10)
         or exists (select 1 from _m m where m.franchise_id = t.franchise_id
                      and coalesce(m.days_since_last_sale, 0) >= coalesce(t.espera_dias, 0) + 7) )
    returning t.id, t.franchise_id, t.description
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', left('Voltou antes: piorou desde a causa anotada · ' || coalesce(description, ''), 1000), null from acorda;

  -- 2) fechar sozinho: so depois de 3 dias seguidos fora da regra (acaba o pisca-pisca de 1-2
  --    dias). Cartao que foi para o Nelson nao fecha sozinho. Nao arma espera nenhuma.
  with res as (
    update cs_tasks t set column_status = 'feito', closed_reason = 'resolveu_sozinho',
        resolved_at = v_now, moved_to_column_at = v_now, updated_at = v_now,
        parked_until = case when t.espera_sem_venda is not null then null else t.parked_until end,
        parked_reason = case when t.espera_sem_venda is not null then null else t.parked_reason end,
        espera_valor = null, espera_sem_venda = null, espera_dias = null
    where t.source = 'auto' and t.archived_at is null and t.column_status <> 'feito'
      and t.escalated_at is null
      and t.out_of_rule_since is not null and t.out_of_rule_since <= v_hoje - 3
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_resolve', 'Fechado pelo sistema: 3 dias sem motivo para cartão', null from res;

  -- 2b) cartao MANUAL ja conversado (aguardando retorno) com a volta vencida e unidade SEM
  --     nenhum alarme hoje: fecha como 'resolveu_sozinho' em vez de voltar para Falar hoje
  --     (pedido do Celso, 27/10/2026). Se a unidade voltar a ter motivo, o automatico abre na
  --     hora (fechado pelo sistema nao segura os 14 dias). Nao mexe em a_fazer, em andamento,
  --     estacionado nem cartao com o Nelson.
  with fm as (
    update cs_tasks t set column_status = 'feito', closed_reason = 'resolveu_sozinho',
        resolved_at = v_now, moved_to_column_at = v_now, next_at = null, updated_at = v_now
    where t.source = 'manual' and t.archived_at is null and t.column_status = 'aguardando_retorno'
      and t.escalated_at is null
      and (t.parked_until is null or t.parked_until <= v_now)
      and coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7) <= v_hoje
      and exists (select 1 from _m m where m.franchise_id = t.franchise_id and m.sem_motivo
                    and (m.mkt_paid or m.nova_trilha) and not coalesce(m.sub_overdue, false))
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_resolve', 'Fechado pelo sistema: unidade sem alarme hoje (cartão manual)', null from fm;

  -- 3) REABRIR o cartao auto da unidade (o mais recente fechado nos ultimos 60 dias, mesmo
  --    arquivado) quando ela volta a ter motivo e nao tem cartao aberto nem estacionado:
  --    - fechado pelo SISTEMA (resolveu_sozinho): volta no dia;
  --    - fechado por PESSOA: volta depois de 14 dias, ou antes se piorou (queda 10 p.p. maior;
  --      ou 7+ dias a mais sem venda) ou se apareceu um motivo MAIS GRAVE que o do fechamento e
  --      que nao estava nos alarmes quando fechou (conserto M3: motivo de prioridade menor, ou que
  --      ja estava la, nao reabre antes dos 14 dias).
  --    Guarda o fechamento anterior (last_closed_reason/at) e soma reopen_count.
  with ult as (
    select distinct on (t.franchise_id) t.*
    from cs_tasks t
    where t.source = 'auto' and t.column_status = 'feito'
      and t.resolved_at > v_now - interval '60 days'
    order by t.franchise_id, t.resolved_at desc
  ),
  cand as (
    select u.id, u.franchise_id, m.top_key, m.top_value, m.evidencia, m.alarmes,
           m.baseline_rev_day, m.rev_month_before
    from ult u
    join _m m on m.franchise_id = u.franchise_id and m.top_key is not null
    where not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.archived_at is null and o.column_status <> 'feito')
      and not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.parked_until > v_now)
      and not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.source = 'manual' and o.column_status = 'feito'
                        and coalesce(o.closed_reason, '') <> 'resolveu_sozinho'
                        and o.resolved_at > v_now - interval '14 days')
      and ( u.closed_reason = 'resolveu_sozinho'
         or u.resolved_at <= v_now - interval '14 days'
         or ( u.motive_key is not null
              and public.cs_motive_ord(m.top_key) < public.cs_motive_ord(u.motive_key)
              and position(public.cs_motive_prefix(m.top_key) in coalesce(u.description, '')) = 0 )
         or (u.motive_key = 'caiu' and m.top_key = 'caiu' and m.top_value <= u.motive_value - 10)
         or (u.motive_key = 'sem_venda' and m.top_key = 'sem_venda' and m.top_value >= u.motive_value + 7) )
  ),
  reopened as (
    update cs_tasks t set
        column_status = 'a_fazer', resolved_at = null, archived_at = null,
        moved_to_column_at = v_now, updated_at = v_now,
        reopen_count = t.reopen_count + 1,
        last_closed_reason = t.closed_reason, last_closed_at = t.resolved_at,
        closed_reason = null, next_at = null, out_of_rule_since = null,
        escalated_at = null, escalated_note = null,
        motive_key = c.top_key, motive_value = c.top_value, motive_evidence = c.evidencia,
        baseline_rev_day = c.baseline_rev_day, rev_month_before = c.rev_month_before,
        description = c.alarmes,
        assignee = coalesce(t.assignee, public.cs_default_assignee())
    from cand c
    where t.id = c.id
    returning t.id, t.franchise_id, t.motive_evidence
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', 'Reaberto: ' || motive_evidence, null from reopened;

  -- 4) CRIAR cartao auto para unidade com motivo, sem cartao aberto (manual ou auto), sem
  --    cartao estacionado, sem cartao auto fechado nos ultimos 60 dias (esse e reaberto no
  --    passo 3, ou esta na espera de 14 dias) e sem cartao manual fechado por pessoa nos
  --    ultimos 14 dias. Unidade de teste e nova na trilha ja estao fora da regua.
  with cand as (
    select m.*
    from _m m
    where m.top_key is not null
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.archived_at is null and t.column_status <> 'feito')
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.parked_until > v_now)
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.source = 'auto' and t.column_status = 'feito'
                        and t.resolved_at > v_now - interval '60 days')
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.source = 'manual' and t.column_status = 'feito'
                        and coalesce(t.closed_reason, '') <> 'resolveu_sozinho'
                        and t.resolved_at > v_now - interval '14 days')
  ),
  ins as (
    insert into cs_tasks (franchise_id, title, description, column_status, source, signal_key, priority,
                          created_by, motive_key, motive_evidence, motive_value, baseline_rev_day, rev_month_before)
    select c.franchise_id, 'Cuidar da ' || coalesce(c.franchise_name, c.franchise_id),
           c.alarmes, 'a_fazer', 'auto', 'auto:' || c.franchise_id, 'alta', null,
           c.top_key, c.evidencia, c.top_value, c.baseline_rev_day, c.rev_month_before
    from cand c
    on conflict (franchise_id) where source = 'auto' and archived_at is null and column_status <> 'feito'
    do nothing
    returning id, franchise_id, motive_evidence
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', motive_evidence, null from ins;

  -- 5) arquivar 'feito' com +14 dias se a unidade esta sem motivo (o Mural ainda mostra os
  --    resolvidos de 30 dias, arquivados ou nao). Estacionado nao arquiva.
  update cs_tasks t set archived_at = v_now
  where t.column_status = 'feito' and t.archived_at is null
    and coalesce(t.resolved_at, t.moved_to_column_at) < v_now - interval '14 days'
    and (t.parked_until is null or t.parked_until <= v_now)
    and not exists (select 1 from _m m where m.franchise_id = t.franchise_id and m.top_key is not null);
end $function$
;

CREATE OR REPLACE FUNCTION public.get_cs_mural()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoje date := public.cs_hoje();
  v_out  jsonb;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: sem permissão' using errcode = '42501';
  end if;

  with
  ln as (select * from public.cs_card_lanes()),
  mm as (select * from public.cs_unit_motives()),
  meses as (select array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                         'setembro','outubro','novembro','dezembro'] as nomes),
  cards as (
    select
      l.lane, l.lane_since, l.volta_vencida, l.motive_rank, t.created_at as t_created, r.risco_mes,
      jsonb_build_object(
        'id', t.id,
        'franchise_id', t.franchise_id,
        'franchise_name', f.name,
        'owner_name', f.owner_name,
        'phone', nullif(regexp_replace(coalesce(nullif(f.phone_number, ''), nullif(fc.personal_phone_for_summary, '')), '\D', '', 'g'), ''),
        'lane', l.lane,
        'lane_since', l.lane_since,
        'volta_vencida', l.volta_vencida,
        'source', t.source,
        'column_status', t.column_status,
        'motive_key', coalesce(t.motive_key, case when t.source = 'manual' then 'manual' end),
        'motive_evidence', t.motive_evidence,
        'title', t.title,
        'description', t.description,
        'rev_month_before', t.rev_month_before,
        'baseline_rev_day', t.baseline_rev_day,
        'rev_mtd', m.rev_mtd,
        'rev_delta_pct', m.rev_delta_pct,
        'rede_delta_pct', m.rede_delta_pct,
        'days_since_last_sale', m.days_since_last_sale,
        'next_at', t.next_at,
        'moved_to_column_at', t.moved_to_column_at,
        'created_at', t.created_at,
        'resolved_at', t.resolved_at,
        'closed_reason', t.closed_reason,
        'escalated_at', t.escalated_at,
        'escalated_note', t.escalated_note,
        'parked_until', t.parked_until,
        'parked_reason', t.parked_reason,
        'reopen_count', t.reopen_count,
        'last_closed_reason', t.last_closed_reason,
        'last_closed_at', t.last_closed_at,
        'assignee_name', pa.full_name,
        'agreement', m.agreement,
        'base_mes', r.base_mes,
        'rev_28d', m.rev_28d,
        'ritmo_mes', r.ritmo_mes,
        'risco_mes', r.risco_mes,
        'out_of_rule_since', t.out_of_rule_since,
        'top_motivo_key', m.top_key,
        'top_motivo_texto', m.top_text,
        'hoje_motivo', (select x->>'text' from jsonb_array_elements(coalesce(m.motives, '[]'::jsonb)) x
                         where x->>'key' = t.motive_key limit 1),
        'hoje_queda_pct', m.caiu_base_delta,
        'hoje_queda_metodo', m.caiu_base_metodo,
        'sem_resposta_seguidas', public.cs_sem_resposta_seguidas(t.id),
        'alarms', coalesce((
            select jsonb_agg(x.txt order by x.o)
            from (
              select (a.elem->>'text') || case when (a.elem->>'blocked')::boolean then ' (tem acordo)' else '' end as txt, a.ord as o
                from jsonb_array_elements(coalesce(m.motives, '[]'::jsonb)) with ordinality as a(elem, ord)
              union all
              select 'Verba de ' || (select nomes[extract(month from v_hoje)::int] from meses) || ' não paga', 100
               where m.franchise_id is not null and not m.mkt_paid and not m.nova_trilha
              union all
              select 'Mensalidade vencida', 101 where coalesce(m.sub_overdue, false)
            ) x), '[]'::jsonb),
        'last_event', (
            select jsonb_build_object('event_type', e.event_type, 'channel', e.channel, 'outcome', e.outcome,
                                      'note', e.note, 'commitment', e.commitment, 'next_at', e.next_at,
                                      'drive_url', e.drive_url, 'created_at', e.created_at,
                                      'author_name', coalesce(pe.full_name, case when e.created_by is null then 'Sistema' end))
            from public.cs_worklist_events e
            left join public.profiles pe on pe.id = e.created_by
            where e.task_id = t.id
            order by e.created_at desc
            limit 1)
      ) as card,
      t.rev_month_before
    from ln l
    join public.cs_tasks t on t.id = l.task_id
    left join public.franchises f on f.evolution_instance_id = t.franchise_id
    left join public.franchise_configurations fc on fc.franchise_evolution_instance_id = t.franchise_id
    left join mm m on m.franchise_id = t.franchise_id
    left join public.profiles pa on pa.id = t.assignee
    left join lateral (
      select b.base_mes, b.ritmo_mes,
             case when b.base_mes > 0 and b.ritmo_mes is not null
                  then greatest(0, b.base_mes - b.ritmo_mes) end as risco_mes
      from (select round(coalesce(t.rev_month_before, m.rev_month_before)) as base_mes,
                   round(m.rev_28d * 30 / 28.0) as ritmo_mes) b
    ) r on true
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'cards', coalesce((
        select jsonb_agg(c.card order by
          case c.lane when 'falar_hoje' then 1 when 'esperando' then 2 when 'com_nelson' then 3
                      when 'estacionado' then 4 else 5 end,
          case when c.lane = 'falar_hoje' then c.risco_mes end desc nulls last,
          case when c.lane = 'falar_hoje' then (not c.volta_vencida)::int end,
          case when c.lane = 'falar_hoje' then c.motive_rank end,
          case when c.lane = 'falar_hoje' then c.rev_month_before end desc nulls last,
          case when c.lane = 'esperando' then c.lane_since end,
          case when c.lane = 'resolvidos' then c.lane_since end desc,
          c.t_created)
        from cards c), '[]'::jsonb),
    'counts', jsonb_build_object(
        'falar_hoje',       (select count(*) from cards where lane = 'falar_hoje'),
        'esperando',        (select count(*) from cards where lane = 'esperando'),
        'com_nelson',       (select count(*) from cards where lane = 'com_nelson'),
        'estacionado',      (select count(*) from cards where lane = 'estacionado'),
        'resolvidos',       (select count(*) from cards where lane = 'resolvidos'
                               and coalesce(card->>'closed_reason', '') <> 'resolveu_sozinho'),
        'resolveu_sozinho', (select count(*) from cards where lane = 'resolvidos'
                               and card->>'closed_reason' = 'resolveu_sozinho'))
  ) into v_out;

  return v_out;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_cs_conversa(p_franchise_id text, p_task_id uuid, p_channel text, p_outcome text, p_commitment text DEFAULT NULL::text, p_next_at date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_drive_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := (select auth.uid());
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_now   timestamptz := now();
  v_fid   text := nullif(trim(p_franchise_id), '');
  v_task  public.cs_tasks%rowtype;
  v_note  text := nullif(trim(p_note), '');
  v_comm  text := nullif(trim(p_commitment), '');
  v_url   text := nullif(trim(p_drive_url), '');
  v_type  text;
  v_next  date;
  v_ev    uuid;
  v_lane  text := null;
  v_seg   int := 0;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: Sem permissão para registrar conversa' using errcode = '42501';
  end if;
  if p_channel is null or p_channel not in ('mensagem', 'ligacao', 'reuniao') then
    raise exception 'Mural: Canal inválido: use mensagem, ligacao ou reuniao' using errcode = '22023';
  end if;
  if p_outcome is null or p_outcome not in ('vai_fazer', 'recusou', 'nao_respondeu', 'causa_conhecida', 'resolvido') then
    raise exception 'Mural: Resultado inválido: use vai_fazer, recusou, nao_respondeu, causa_conhecida ou resolvido' using errcode = '22023';
  end if;
  if p_outcome = 'causa_conhecida' and char_length(coalesce(v_comm, '')) < 3 then
    raise exception 'Mural: Escreva a causa (aparece no cartão)' using errcode = '22023';
  end if;
  if p_outcome = 'causa_conhecida' and p_next_at > v_hoje + 183 then
    raise exception 'Mural: Rever em no máximo 6 meses' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'Mural: Nota com mais de 1000 caracteres' using errcode = '22023';
  end if;
  if char_length(coalesce(v_comm, '')) > 300 then
    raise exception 'Mural: Combinado com mais de 300 caracteres' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~* '^https://' or char_length(v_url) > 500) then
    raise exception 'Mural: Link da reunião precisa começar com https://' using errcode = '22023';
  end if;
  if p_next_at is not null and p_next_at < v_hoje then
    raise exception 'Mural: A data de voltar não pode ser no passado' using errcode = '22023';
  end if;

  if p_task_id is not null then
    select * into v_task from public.cs_tasks where id = p_task_id;
    if not found then
      raise exception 'Mural: Cartão não encontrado' using errcode = 'P0002';
    end if;
    if v_fid is not null and v_task.franchise_id is distinct from v_fid then
      raise exception 'Mural: O cartão é de outra unidade' using errcode = '22023';
    end if;
    v_fid := v_task.franchise_id;
  else
    if v_fid is null then
      raise exception 'Mural: Informe a unidade ou o cartão' using errcode = '22023';
    end if;
    -- cartao aberto da unidade: o automatico primeiro, depois o mexido mais recente
    select * into v_task from public.cs_tasks
     where franchise_id = v_fid and archived_at is null and column_status <> 'feito'
     order by (source = 'auto') desc, moved_to_column_at desc
     limit 1;
  end if;

  -- unidade so e obrigatoria sem cartao (cartao manual pode nao ter unidade — conserto M2)
  if v_task.id is null
     and (v_fid is null or not exists (select 1 from public.franchises f where f.evolution_instance_id = v_fid)) then
    raise exception 'Mural: Unidade não encontrada' using errcode = 'P0002';
  end if;

  v_type := case when p_channel = 'reuniao' then 'meeting' else 'contact' end;
  v_next := case when p_outcome = 'resolvido' then null
                 else coalesce(p_next_at, v_hoje + case p_outcome when 'causa_conhecida' then 30
                                                                  when 'nao_respondeu' then 3 else 7 end) end;

  insert into public.cs_worklist_events
    (task_id, franchise_id, event_type, note, created_by, channel, outcome, commitment, next_at, drive_url)
  values
    (v_task.id, v_fid, v_type, v_note, v_uid, p_channel, p_outcome, v_comm, v_next, v_url)
  returning id into v_ev;

  if v_task.id is not null and v_task.column_status <> 'feito' then
    if p_outcome = 'resolvido' then
      update public.cs_tasks
         set column_status = 'feito', closed_reason = 'resolvido', resolved_at = v_now,
             moved_to_column_at = v_now, next_at = null, updated_at = v_now,
             parked_until = case when espera_sem_venda is not null then null else parked_until end,
             parked_reason = case when espera_sem_venda is not null then null else parked_reason end,
             espera_valor = null, espera_sem_venda = null, espera_dias = null
       where id = v_task.id;
      v_lane := 'resolvidos';
    else
      update public.cs_tasks
         set column_status = 'aguardando_retorno', next_at = v_next,
             moved_to_column_at = v_now, updated_at = v_now,
             parked_until = case when p_outcome = 'causa_conhecida'
                                 then (v_next::timestamp at time zone 'America/Sao_Paulo')
                                 when espera_sem_venda is not null then null else parked_until end,
             parked_reason = case when p_outcome = 'causa_conhecida' then v_comm
                                  when espera_sem_venda is not null then null else parked_reason end,
             espera_valor = case when p_outcome = 'causa_conhecida' then motive_value end,
             espera_dias = case when p_outcome = 'causa_conhecida'
                                then coalesce((select (c.signals->>'days_since_last_sale')::int
                                                 from public.franchise_health_cache c
                                                where c.franchise_id = cs_tasks.franchise_id), 0) end,
             espera_sem_venda = case when p_outcome = 'causa_conhecida' then true end
       where id = v_task.id;
      v_lane := case when p_outcome = 'causa_conhecida' then 'estacionado'
                     when v_next > v_hoje then 'esperando' else 'falar_hoje' end;
      if p_outcome = 'nao_respondeu' then
        v_seg := public.cs_sem_resposta_seguidas(v_task.id);
        if v_seg >= 4 and v_task.escalated_at is null then
          update public.cs_tasks
             set escalated_at = v_now,
                 escalated_note = 'Sistema: ' || v_seg || ' registros seguidos de "Enviei, sem resposta" neste cartão. Decidir o próximo passo.',
                 updated_at = v_now
           where id = v_task.id;
          insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
          values (v_task.id, v_fid, 'escalate',
                  'Vai para o Nelson sozinho: ' || v_seg || 'º "Enviei, sem resposta" seguido neste cartão', null);
          v_lane := 'com_nelson';
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object('event_id', v_ev, 'task_id', v_task.id, 'franchise_id', v_fid,
                            'next_at', v_next, 'lane', v_lane, 'sem_resposta_seguidas', v_seg);
end;
$function$
;

commit;
