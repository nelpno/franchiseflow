-- 10 — get_franchise_health_signals: O FONTE QUE RODA EM PRODUCAO, extraido em 08/09/2026
--
-- POR QUE ESTE ARQUIVO EXISTE
-- Ate hoje o CLAUDE.md dizia, com razao, que "a get_franchise_health_signals que roda em
-- producao nao existe em .sql nenhum do ecossistema" — e que por isso um CREATE OR REPLACE
-- com o 09-*.sql do repo REGREDIRIA o radar do Celso (perde giro_baixo, marketing_late,
-- cs_agreements, cooldown, parked_until). Isso travava qualquer mudanca no radar.
--
-- Este arquivo destrava: e o `pg_get_functiondef` da funcao VIVA, copiado byte a byte, sem
-- uma linha alterada. Serve de linha de base para comparar antes de qualquer alteracao.
--
-- PARIDADE NO MOMENTO DA EXTRACAO
--   md5(prosrc) = 6e61dfebfccdaee4fd7dde9cd763ff21
--   length(prosrc) = 13548
--
-- Conferir se producao continua igual a este arquivo:
--   select md5(prosrc), length(prosrc) from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_franchise_health_signals';
--
-- 🔴 NAO aplique este arquivo por habito: ele NAO tem a mudanca do limiar relativo (11-*).
-- Ele e o retrato do "antes" e o caminho de rollback.
--
-- ⚠️ Comentario `--` so aqui no cabecalho, NUNCA dentro do corpo delimitado: ele some no
-- apply_migration e a paridade quebra.

CREATE OR REPLACE FUNCTION public.get_franchise_health_signals(p_since timestamp with time zone DEFAULT (now() - '60 days'::interval))
 RETURNS TABLE(franchise_id text, franchise_name text, city text, state_uf text, revenue_30d numeric, revenue_prev_30d numeric, revenue_delta_pct numeric, gross_margin_pct_30d numeric, gross_margin_prev_pct numeric, days_since_last_sale integer, days_since_last_purchase integer, zeroed_key_items_count integer, key_items_total integer, purchase_count_30d integer, purchase_count_prev integer, mix_distinct_30d integer, mix_distinct_prev integer, bot_conversion_30d numeric, bot_conversion_prev numeric, growth_pct numeric, network_median_growth numeric, subscription_overdue boolean, marketing_paid_current_month boolean, marketing_amount_current numeric, marketing_amount_prev numeric, days_since_login integer, flags jsonb, tier text, is_standout boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
with
fr as (select evolution_instance_id as fid, name, city, state_uf from franchises),
rev as (
  select fr.fid,
    coalesce(sum((s.value-coalesce(s.discount_amount,0)+coalesce(s.delivery_fee,0))) filter (where s.sale_date>current_date-30),0) as rev30,
    coalesce(sum((s.value-coalesce(s.discount_amount,0)+coalesce(s.delivery_fee,0))) filter (where s.sale_date>current_date-60 and s.sale_date<=current_date-30),0) as revprev,
    max(s.sale_date) as last_sale
  from fr left join sales s on s.franchise_id=fr.fid and s.sale_date>current_date-90
  group by fr.fid
),
marg as (
  select fr.fid,
    sum((si.unit_price-coalesce(si.cost_price,0))*si.quantity) filter (where s.sale_date>current_date-30) as gp30,
    nullif(sum(si.unit_price*si.quantity) filter (where s.sale_date>current_date-30),0) as gr30,
    sum((si.unit_price-coalesce(si.cost_price,0))*si.quantity) filter (where s.sale_date>current_date-60 and s.sale_date<=current_date-30) as gpprev,
    nullif(sum(si.unit_price*si.quantity) filter (where s.sale_date>current_date-60 and s.sale_date<=current_date-30),0) as grprev
  from fr left join sales s on s.franchise_id=fr.fid and s.sale_date>current_date-60
    left join sale_items si on si.sale_id=s.id
  group by fr.fid
),
po as (
  select fr.fid,
    max(p.ordered_at) as last_po,
    count(p.id) filter (where p.ordered_at>now()-interval '30 days')::int as cnt30,
    count(p.id) filter (where p.ordered_at>now()-interval '60 days' and p.ordered_at<=now()-interval '30 days')::int as cntprev,
    coalesce(sum(p.total_amount) filter (where p.ordered_at>now()-interval '60 days'),0) as compra60
  from fr left join purchase_orders p on p.franchise_id=fr.fid and p.ordered_at>now()-interval '90 days'
  group by fr.fid
),
ivl as (
  select p.franchise_id as fid,
         p.ordered_at::date - lag(p.ordered_at::date) over (partition by p.franchise_id order by p.ordered_at) as d
  from purchase_orders p where p.ordered_at > now() - interval '6 months'
),
pobase as (
  select fid, count(*)::int as n, percentile_cont(0.5) within group (order by d) as med
  from ivl where d is not null and d > 0 group by fid having count(*) >= 3
),
polim as (
  select fr.fid,
    greatest(14, least(45, round(coalesce(pb.med, 15) * 2)))::int as limiar,
    pb.med::int as med_propria
  from fr left join pobase pb on pb.fid = fr.fid
),
mix as (
  select fr.fid,
    count(distinct pi.product_name) filter (where p.ordered_at>now()-interval '30 days')::int as mix30,
    count(distinct pi.product_name) filter (where p.ordered_at>now()-interval '60 days' and p.ordered_at<=now()-interval '30 days')::int as mixprev
  from fr left join purchase_orders p on p.franchise_id=fr.fid and p.ordered_at>now()-interval '60 days'
    left join purchase_order_items pi on pi.order_id=p.id
  group by fr.fid
),
sold28 as (
  select distinct s.franchise_id as fid, si.inventory_item_id as iid
  from sales s join sale_items si on si.sale_id=s.id
  where s.sale_date>current_date-28 and si.inventory_item_id is not null
),
stock as (
  select sd.fid,
    count(*) filter (where ii.quantity=0 and ii.active is true)::int as zeroed,
    count(*)::int as keytot
  from sold28 sd join inventory_items ii on ii.id=sd.iid
  group by sd.fid
),
sub as (
  select fr.fid, bool_or(ss.current_payment_status='OVERDUE') as overdue
  from fr left join system_subscriptions ss on ss.franchise_id=fr.fid group by fr.fid
),
mkt_target as (
  select to_char(td,'YYYY-MM') as ym, to_char(td - interval '1 month','YYYY-MM') as ym_prev
  from (select case when extract(day from current_date) > extract(day from ((date_trunc('month',current_date)+interval '1 month')::date - 1)) - 5
               then current_date + interval '1 month' else current_date end as td) x
),
mkt as (
  select fr.fid,
    exists(select 1 from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym) as paid_cur,
    exists(select 1 from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym_prev) as paid_prev,
    coalesce((select sum(mp.amount) from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym),0) as amt_cur,
    coalesce((select sum(mp.amount) from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym_prev),0) as amt_prev
  from fr
),
login as (
  select fr.fid, max(u.last_sign_in_at) as last_login
  from fr left join profiles pr on fr.fid = any(pr.managed_franchise_ids)
    left join auth.users u on u.id=pr.id
  group by fr.fid
),
botsum as (
  select franchise_id as fid,
    count(*) filter (where started_at>now()-interval '30 days')::int as t30,
    count(*) filter (where started_at>now()-interval '30 days' and status='converted')::int as c30,
    count(*) filter (where started_at>now()-interval '60 days' and started_at<=now()-interval '30 days')::int as tprev,
    count(*) filter (where started_at>now()-interval '60 days' and started_at<=now()-interval '30 days' and status='converted')::int as cprev
  from vw_bot_conversations where started_at>now()-interval '60 days'
  group by franchise_id
),
botlast as (
  select fr.fid,
    (select max(v.started_at)::date from vw_bot_conversations v where v.franchise_id=fr.fid) as last_bot
  from fr
),
botshare as (
  select bl.fid,
    (select count(*) from sales s where s.franchise_id=bl.fid
       and s.sale_date >  coalesce(bl.last_bot, current_date) - 60
       and s.sale_date <= coalesce(bl.last_bot, current_date))::int as vend_win,
    (select count(*) from sales s where s.franchise_id=bl.fid and s.source='bot'
       and s.sale_date >  coalesce(bl.last_bot, current_date) - 60
       and s.sale_date <= coalesce(bl.last_bot, current_date))::int as vend_bot_win
  from botlast bl
),
pay as (
  select fr.fid,
    fc.id is not null as has_cfg,
    (coalesce(array_length(fc.payment_delivery,1),0)=0 and coalesce(array_length(fc.payment_pickup,1),0)=0) as pay_unset,
    (('pix'=any(fc.payment_delivery) or 'pix'=any(fc.payment_pickup)) and coalesce(trim(fc.pix_key_data),'')='') as pix_missing
  from fr left join franchise_configurations fc on fc.franchise_evolution_instance_id=fr.fid
),
metrics as (
  select fr.fid, fr.name, fr.city, fr.state_uf,
    rev.rev30, rev.revprev,
    case when rev.revprev>=2000 then round(100.0*(rev.rev30-rev.revprev)/rev.revprev,1) end as delta,
    case when rev.last_sale is not null then greatest(0,current_date-rev.last_sale) end as d_sale,
    round(100.0*marg.gp30/marg.gr30,1) as margin30,
    round(100.0*marg.gpprev/marg.grprev,1) as marginprev,
    case when po.last_po is not null then greatest(0,(current_date - po.last_po::date)) end as d_po,
    coalesce(po.cnt30,0) as cnt30, coalesce(po.cntprev,0) as cntprev,
    coalesce(po.compra60,0) as compra60,
    polim.limiar as po_limiar, polim.med_propria as po_med,
    coalesce(mix.mix30,0) as mix30, coalesce(mix.mixprev,0) as mixprev,
    coalesce(stock.zeroed,0) as zeroed, coalesce(stock.keytot,0) as keytot,
    coalesce(sub.overdue,false) as overdue,
    coalesce(mkt.paid_cur,false) as mkt_paid, coalesce(mkt.paid_prev,false) as mkt_paid_prev,
    coalesce(mkt.amt_cur,0) as mkt_amt_cur, coalesce(mkt.amt_prev,0) as mkt_amt_prev,
    case when login.last_login is not null then greatest(0,(current_date - login.last_login::date)) end as d_login,
    case when botsum.t30>0 then round(100.0*botsum.c30/botsum.t30,1) end as conv30,
    case when botsum.tprev>0 then round(100.0*botsum.cprev/botsum.tprev,1) end as convprev,
    coalesce(botsum.t30,0) as bot_t30,
    case when botlast.last_bot is not null then greatest(0,(current_date - botlast.last_bot)) end as d_bot,
    (coalesce(botshare.vend_win,0) >= 5
      and coalesce(botshare.vend_bot_win,0)::numeric / nullif(botshare.vend_win,0) >= 0.20) as bot_era_canal,
    coalesce(pay.has_cfg,false) as has_cfg,
    coalesce(pay.pay_unset,false) as pay_unset,
    coalesce(pay.pix_missing,false) as pix_missing,
    case when coalesce(po.compra60,0) >= 2000
         then round((coalesce(rev.rev30,0)+coalesce(rev.revprev,0)) / po.compra60, 2) end as giro
  from fr
  left join rev on rev.fid=fr.fid
  left join marg on marg.fid=fr.fid
  left join po on po.fid=fr.fid
  left join polim on polim.fid=fr.fid
  left join mix on mix.fid=fr.fid
  left join stock on stock.fid=fr.fid
  left join sub on sub.fid=fr.fid
  left join mkt on mkt.fid=fr.fid
  left join login on login.fid=fr.fid
  left join botsum on botsum.fid=fr.fid
  left join botlast on botlast.fid=fr.fid
  left join botshare on botshare.fid=fr.fid
  left join pay on pay.fid=fr.fid
),
growth as (
  select fid, case when revprev>0 then round(100.0*(rev30-revprev)/revprev,1) end as g,
    percent_rank() over (order by rev30) as pr
  from metrics
),
net as (select percentile_cont(0.5) within group (order by g) as med from growth where g is not null),
flags_long as (
  select fid,'revenue_drop' k, case when delta<=-30 then 'high' else 'med' end sev, 'Faturamento '||delta||'%' lbl from metrics where delta is not null and delta<=-10
  union all select fid,'margin_negative','high','Margem negativa' from metrics where margin30<0
  union all select fid,'margin_squeeze','med','Margem caindo' from metrics where margin30 is not null and marginprev is not null and margin30>=0 and (marginprev-margin30)>10
  union all select fid,'stopped_selling','high','Sem vender há '||d_sale||'d' from metrics where d_sale is not null and d_sale>=7 and revprev>0
  union all select fid,'stopped_buying',
      case when d_po >= least(60, po_limiar*2) then 'high' else 'med' end,
      'Sem comprar há '||d_po||'d'||case when po_med is not null then ' (o normal dela é a cada '||po_med||'d)' else '' end
    from metrics where d_po is not null and d_po >= po_limiar
  union all select fid,'purchase_freq_drop','low','Comprando menos vezes' from metrics where cntprev>=2 and cnt30<cntprev
  union all select fid,'purchase_mix_shrink','low','Menos variedade comprada' from metrics where mixprev>=5 and mix30 < mixprev*0.75
  union all select fid,'key_stock_zero','med',zeroed||' itens-chave zerados' from metrics where zeroed>=5
  union all select fid,'subscription_overdue','med','Assinatura atrasada' from metrics where overdue
  union all select fid,'marketing_late','high','Verba do mês não paga (pagou o mês passado)' from metrics where not mkt_paid and mkt_paid_prev
  union all select fid,'marketing_unpaid','med','Marketing sem pagar (2 meses)' from metrics where not mkt_paid and not mkt_paid_prev
  union all select fid,'giro_baixo', case when giro < 0.30 then 'high' else 'med' end,
      'Comprou R$ '||round(compra60)||' e registrou R$ '||round(rev30+revprev)||' em 60d'
    from metrics where giro is not null and giro < 0.90
  union all select fid,'bot_bad','med','Bot: conversão caindo' from metrics where conv30 is not null and convprev is not null and bot_t30>=20 and conv30 < convprev-10
  union all select fid,'bot_silent','med','Robô sem conversa há '||d_bot||'d' from metrics where d_sale is not null and d_bot is not null and d_bot>=7 and bot_era_canal
  union all select fid,'bot_never','med','Robô nunca registrou conversa' from metrics where d_sale is not null and d_bot is null and bot_era_canal
  union all select fid,'payment_unset','med','Sem forma de pagamento configurada' from metrics where d_sale is not null and has_cfg and pay_unset
  union all select fid,'pix_missing','med','Aceita PIX sem chave cadastrada' from metrics where d_sale is not null and has_cfg and pix_missing
),
flags_agg as (
  select fid,
    jsonb_agg(jsonb_build_object('key',k,'sev',sev,'label',lbl) order by case sev when 'high' then 0 when 'med' then 1 else 2 end) as flags,
    bool_or(sev='high' and k in ('revenue_drop','stopped_selling','stopped_buying','margin_negative')) as has_high_churn,
    bool_or(sev='med') as has_med,
    bool_or(k='giro_baixo') as has_giro,
    count(*)::int as nflags,
    -- flags que NAO sao trabalho do CS: nao contam para promover a unidade a atencao
    count(*) filter (where k not in ('marketing_late','marketing_unpaid'))::int as nflags_cs
  from flags_long fl
   where not exists (
     select 1 from public.cs_agreements a
      where a.franchise_id = fl.fid
        and a.revoked_at is null
        and (a.signal_key = fl.k or a.signal_key = '*')
        and (a.revenue_baseline is null
             or coalesce((select m2.rev30 from metrics m2 where m2.fid = fl.fid), 0)
                >= a.revenue_baseline * a.revenue_floor_pct / 100.0))
   group by fid
)
select m.fid, m.name, m.city, m.state_uf,
  m.rev30, m.revprev, m.delta,
  m.margin30, m.marginprev,
  m.d_sale, m.d_po,
  m.zeroed, m.keytot,
  m.cnt30, m.cntprev, m.mix30, m.mixprev,
  m.conv30, m.convprev,
  gr.g, net.med,
  m.overdue, m.mkt_paid,
  m.mkt_amt_cur, m.mkt_amt_prev,
  m.d_login,
  coalesce(fa.flags,'[]'::jsonb) as flags,
  case when m.d_sale is null and not coalesce(fa.has_giro,false) then 'dormant'
       when coalesce(fa.has_high_churn,false) then 'critical'
       when (coalesce(fa.has_med,false) or coalesce(fa.has_giro,false) or coalesce(fa.nflags_cs,0)>=2) then 'attention'
       else 'healthy' end as tier,
  (m.d_sale is not null and coalesce(fa.nflags,0)=0
     and (gr.pr>=0.75 or (gr.g is not null and net.med is not null and gr.g>net.med))) as is_standout
from metrics m
left join growth gr on gr.fid=m.fid
cross join net
left join flags_agg fa on fa.fid=m.fid
where (select public.is_cs_or_admin())
$func$;
