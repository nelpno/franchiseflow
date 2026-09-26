-- 2026-09-27 cs 02 — radar sem pontos cegos + a regua do Mural (cs_unit_motives)
--
-- O QUE FAZ
-- (A) get_franchise_health_signals: 3 consertos do estudo de 26/09 (secao 2, R1/R2 e "Pendencias"),
--     gerado A PARTIR DO CORPO AO VIVO (backup: docs/db-backups/get_franchise_health_signals.2026-09-27-antes.sql,
--     md5(prosrc) 8e93d566d27f5344ba2a5ef5650772ca, = supabase/2026-09-26-admin-01-health-signals-mkt-teste.sql).
--     Paridade: o cs-cockpit/11-*.sql NAO e o que roda (falta o is_test e o mes-alvo da verba do admin-01);
--     o 10-*.sql e ainda mais antigo. Diferencas para producao, e SO elas (script .tmp/onda2/sql/gen02.mjs,
--     cada troca conferida "exatamente N vezes"):
--       1. current_date (UTC, 20 ocorrencias) -> (now() at time zone 'America/Sao_Paulo')::date.
--       2. fr traz created_at e o status da trilha (onboarding_checklists, 1 por unidade).
--       3. ultima venda sem teto de 90 dias (a soma da receita continua em 90 dias).
--       4. metrics ganha nova_trilha (< 60 dias na rede e trilha nao aprovada).
--       5. stopped_selling: sai o "revprev > 0" (exigia venda nos 30-60 dias anteriores); entra
--          "7+ dias, ou 31+ se nova na trilha". Uberlandia (82 dias) volta a acender.
--       6. flags_agg: o acordo (cs_agreements) NAO apaga mais flag nenhuma. O acordo passa a
--          impedir so o CARTAO daquele motivo, no reconcile (arquivo 03), via cs_unit_motives.
--     Efeito no tier (simulacao 26/09 em .tmp/onda2/simulacao-mural.md): Uberlandia e Sorocaba
--     Maria A Prado deixam de aparecer "saudavel". Assinatura e colunas iguais: as RPCs 04/05 do
--     admin e o cache continuam lendo igual.
-- (B) cs_unit_motives(p_corte_rel): a regua do Mural (ver comentario da funcao). Interna.
--     Revisao 27/09: "caiu" usa 28 dias x 28 anteriores nos dias 1-9 do mes (e quando o mes
--     anterior nao tem base), e devolve caiu_sem_leitura (A1); acordo so segura cartao com
--     review_at futuro e respeita o piso revenue_baseline x revenue_floor_pct (M1).
-- (C) cs_agora()/cs_hoje(): relogio do Mural (now() e a data de SP), com gancho de simulacao
--     set_config('cs.sim_agora', ..., true) que so vale na propria transacao.
-- (D) cs_try_date(texto): to_date tolerante (data invalida vira NULL; usado no placar, B4).
--
-- POR QUE
-- Acordo '*' sem base calava tudo para sempre; unidade parada ha 60+ dias sumia do alarme; e o
-- radar e a regua unica (Ficha/Unidades) discordavam sobre quem "caiu" (estudo R1, R2, R5).
--
-- IDEMPOTENTE (create or replace). LF. Depois do 01. Aplicar pelo execute_sql (apply_migration
-- descarta comentario de dentro do corpo).
--
-- COMO DESFAZER
--   (A) rodar docs/db-backups/get_franchise_health_signals.2026-09-27-antes.sql inteiro.
--   (B-D) so depois de desfazer 03, 05 e 06:
--     drop function public.cs_unit_motives(numeric);
--     drop function public.cs_try_date(text, text);
--     drop function public.cs_hoje(); drop function public.cs_agora();

begin;

CREATE OR REPLACE FUNCTION public.get_franchise_health_signals(p_since timestamp with time zone DEFAULT (now() - '60 days'::interval))
 RETURNS TABLE(franchise_id text, franchise_name text, city text, state_uf text, revenue_30d numeric, revenue_prev_30d numeric, revenue_delta_pct numeric, gross_margin_pct_30d numeric, gross_margin_prev_pct numeric, days_since_last_sale integer, days_since_last_purchase integer, zeroed_key_items_count integer, key_items_total integer, purchase_count_30d integer, purchase_count_prev integer, mix_distinct_30d integer, mix_distinct_prev integer, bot_conversion_30d numeric, bot_conversion_prev numeric, growth_pct numeric, network_median_growth numeric, subscription_overdue boolean, marketing_paid_current_month boolean, marketing_amount_current numeric, marketing_amount_prev numeric, days_since_login integer, flags jsonb, tier text, is_standout boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with
fr as (select f.evolution_instance_id as fid, f.name, f.city, f.state_uf, f.created_at as criado, ob.status as onb_status
       from franchises f left join onboarding_checklists ob on ob.franchise_id = f.evolution_instance_id
       where not coalesce(f.is_test, false)),
rev as (
  select fr.fid,
    coalesce(sum((s.value-coalesce(s.discount_amount,0)+coalesce(s.delivery_fee,0))) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-30),0) as rev30,
    coalesce(sum((s.value-coalesce(s.discount_amount,0)+coalesce(s.delivery_fee,0))) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-60 and s.sale_date<=(now() at time zone 'America/Sao_Paulo')::date-30),0) as revprev,
    (select max(s2.sale_date) from sales s2 where s2.franchise_id=fr.fid and s2.sale_date<=(now() at time zone 'America/Sao_Paulo')::date) as last_sale
  from fr left join sales s on s.franchise_id=fr.fid and s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-90
  group by fr.fid
),
marg as (
  select fr.fid,
    sum((si.unit_price-coalesce(si.cost_price,0))*si.quantity) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-30) as gp30,
    nullif(sum(si.unit_price*si.quantity) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-30),0) as gr30,
    sum((si.unit_price-coalesce(si.cost_price,0))*si.quantity) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-60 and s.sale_date<=(now() at time zone 'America/Sao_Paulo')::date-30) as gpprev,
    nullif(sum(si.unit_price*si.quantity) filter (where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-60 and s.sale_date<=(now() at time zone 'America/Sao_Paulo')::date-30),0) as grprev
  from fr left join sales s on s.franchise_id=fr.fid and s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-60
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
  where s.sale_date>(now() at time zone 'America/Sao_Paulo')::date-28 and si.inventory_item_id is not null
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
  select to_char(h,'YYYY-MM') as ym_cal,
         to_char(h + interval '1 month','YYYY-MM') as ym_next,
         to_char(h - interval '1 month','YYYY-MM') as ym_prev,
         extract(day from h) > extract(day from (date_trunc('month',h) + interval '1 month - 1 day')) - 5 as in_window
  from (select (now() at time zone 'America/Sao_Paulo')::date as h) x
),
mkt as (
  select fr.fid,
    exists(select 1 from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed'
             and (mp.reference_month=t.ym_cal or (t.in_window and mp.reference_month=t.ym_next))) as paid_cur,
    exists(select 1 from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym_prev) as paid_prev,
    coalesce(
      nullif((select sum(mp.amount) from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and mp.reference_month=t.ym_cal),0),
      (select sum(mp.amount) from marketing_payments mp, mkt_target t where mp.franchise_id=fr.fid and mp.status='confirmed' and t.in_window and mp.reference_month=t.ym_next),
      0) as amt_cur,
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
       and s.sale_date >  coalesce(bl.last_bot, (now() at time zone 'America/Sao_Paulo')::date) - 60
       and s.sale_date <= coalesce(bl.last_bot, (now() at time zone 'America/Sao_Paulo')::date))::int as vend_win,
    (select count(*) from sales s where s.franchise_id=bl.fid and s.source='bot'
       and s.sale_date >  coalesce(bl.last_bot, (now() at time zone 'America/Sao_Paulo')::date) - 60
       and s.sale_date <= coalesce(bl.last_bot, (now() at time zone 'America/Sao_Paulo')::date))::int as vend_bot_win
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
    (((now() at time zone 'America/Sao_Paulo')::date - (fr.criado at time zone 'America/Sao_Paulo')::date) < 60 and coalesce(fr.onb_status,'') <> 'approved') as nova_trilha,
    rev.rev30, rev.revprev,
    case when rev.revprev>=2000 then round(100.0*(rev.rev30-rev.revprev)/rev.revprev,1) end as delta,
    case when rev.last_sale is not null then greatest(0,(now() at time zone 'America/Sao_Paulo')::date-rev.last_sale) end as d_sale,
    round(100.0*marg.gp30/marg.gr30,1) as margin30,
    round(100.0*marg.gpprev/marg.grprev,1) as marginprev,
    case when po.last_po is not null then greatest(0,((now() at time zone 'America/Sao_Paulo')::date - po.last_po::date)) end as d_po,
    coalesce(po.cnt30,0) as cnt30, coalesce(po.cntprev,0) as cntprev,
    coalesce(po.compra60,0) as compra60,
    polim.limiar as po_limiar, polim.med_propria as po_med,
    coalesce(mix.mix30,0) as mix30, coalesce(mix.mixprev,0) as mixprev,
    coalesce(stock.zeroed,0) as zeroed, coalesce(stock.keytot,0) as keytot,
    coalesce(sub.overdue,false) as overdue,
    coalesce(mkt.paid_cur,false) as mkt_paid, coalesce(mkt.paid_prev,false) as mkt_paid_prev,
    coalesce(mkt.amt_cur,0) as mkt_amt_cur, coalesce(mkt.amt_prev,0) as mkt_amt_prev,
    case when login.last_login is not null then greatest(0,((now() at time zone 'America/Sao_Paulo')::date - login.last_login::date)) end as d_login,
    case when botsum.t30>0 then round(100.0*botsum.c30/botsum.t30,1) end as conv30,
    case when botsum.tprev>0 then round(100.0*botsum.cprev/botsum.tprev,1) end as convprev,
    coalesce(botsum.t30,0) as bot_t30,
    case when botlast.last_bot is not null then greatest(0,((now() at time zone 'America/Sao_Paulo')::date - botlast.last_bot)) end as d_bot,
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
net_delta as (
  select percentile_cont(0.5) within group (order by delta) as med_cmp,
         count(*)::int as n_cmp
  from metrics where delta is not null
),
corte_queda as (
  select case when nd.n_cmp >= 10 then least(-10::numeric, round((nd.med_cmp - 15)::numeric, 1)) else -10::numeric end as t_med,
         case when nd.n_cmp >= 10 then least(-30::numeric, round((nd.med_cmp - 30)::numeric, 1)) else -30::numeric end as t_high,
         case when nd.n_cmp >= 10 then round(nd.med_cmp::numeric, 1) end as med_rede
  from net_delta nd
),
flags_long as (
  select m.fid,'revenue_drop' k, case when m.delta<=cq.t_high then 'high' else 'med' end sev, 'Faturamento '||m.delta||'%'||case when cq.med_rede is not null then ' (rede '||cq.med_rede||'%)' else '' end lbl from metrics m cross join corte_queda cq where m.delta is not null and m.delta<=cq.t_med
  union all select fid,'margin_negative','high','Margem negativa' from metrics where margin30<0
  union all select fid,'margin_squeeze','med','Margem caindo' from metrics where margin30 is not null and marginprev is not null and margin30>=0 and (marginprev-margin30)>10
  union all select fid,'stopped_selling','high','Sem vender há '||d_sale||'d' from metrics where d_sale is not null and d_sale >= case when nova_trilha then 31 else 7 end
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
$function$
;

-- ---------------------------------------------------------------------------------------------
-- Relogio do Mural. cs_agora() = now(), a nao ser que a transacao tenha feito
-- set_config('cs.sim_agora', '<timestamptz>', true) — gancho SO para simulacao (virar o mes sem
-- esperar o calendario). O cliente (PostgREST) nao consegue chamar set_config; o valor so vale
-- dentro da propria transacao. cs_hoje() = a data de Sao Paulo desse relogio.
-- ---------------------------------------------------------------------------------------------
create or replace function public.cs_agora()
returns timestamptz
language sql
stable
set search_path = 'public'
as $$
  select coalesce(nullif(current_setting('cs.sim_agora', true), '')::timestamptz, now())
$$;

create or replace function public.cs_hoje()
returns date
language sql
stable
set search_path = 'public'
as $$
  select (public.cs_agora() at time zone 'America/Sao_Paulo')::date
$$;

revoke execute on function public.cs_agora() from public, anon;
revoke execute on function public.cs_hoje() from public, anon;
grant execute on function public.cs_agora() to authenticated, service_role;
grant execute on function public.cs_hoje() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- cs_unit_motives(): a regua do Mural, 1 linha por unidade ativa e nao-teste. FONTE UNICA dos
-- motivos de cartao — o reconcile (arquivo 03) abre/fecha por ela, o get_cs_mural (05) mostra
-- os alarmes vivos por ela e o get_cs_progresso (06) lista "quedas sem cartao" por ela.
-- Base = a mesma de get_admin_network_overview (datas de Sao Paulo, piso R$ 3 mil,
-- receita = valor - desconto + frete, por sale_date).
--
-- Motivos (ordem de prioridade = campo ord):
--   1 sem_venda   7+ dias sem venda (ou nunca vendeu), SEM teto de 90 dias. Nova na trilha
--                 (< 60 dias e trilha nao aprovada) so com mais de 30 dias parada.
--   2 caiu        queda <= least(-20, variacao_da_rede + p_corte_rel), com base >= R$ 3 mil.
--                 QUAL queda (conserto A1 da revisao, 27/09):
--                   - do dia 10 em diante, se o mesmo trecho do mes anterior tem base >= R$ 3 mil:
--                     mes ate hoje x mesmo trecho do mes anterior (= rev_delta_pct da regua unica,
--                     o que a Ficha mostra);
--                   - nos dias 1 a 9, ou quando o trecho do mes anterior nao chega a R$ 3 mil:
--                     ultimos 28 dias x os 28 dias antes (base >= R$ 3 mil).
--                   - sem nenhuma das duas bases: caiu_sem_leitura = true (NAO e "melhorou": o
--                     reconcile segura o cartao 'caiu' aberto e nao arma o fechamento automatico).
--                   - caiu_qualquer_medida = caiu no mes (com base, qualquer dia) OU no 28x28: o
--                     reconcile tambem segura o cartao 'caiu' aberto com ele, para a TROCA de medida
--                     (dia 1: mes -> 28d; dia 10: 28d -> mes) nao armar fechamento.
--                 Por que 28x28 no comeco do mes: no dia 2 o "mesmo trecho" tem 1-2 dias, quase
--                 toda unidade fica sem base e as que tem comparam dias da semana diferentes.
--                 variacao_da_rede = soma da REDE INTEIRA na MESMA medida (mes ou 28 dias) — a do
--                 mes e o numero do cartao "Rede" da tela Hoje (resumoRede, networkOverview.js).
--                 Com a rede em -0,5% (26/09) e p_corte_rel = -20 o corte efetivo e -20,5%; com a
--                 rede em -15% seria -35% (Dia das Maes/Pais nao acende meia rede).
--   3 nao_lanca   unidade com 60+ dias, comprou >= R$ 2 mil da fabrica em 60 dias (pedido nao
--                 cancelado) e lancou < 0,9x isso em venda no mesmo periodo.
--   4 robo_parado 7+ dias sem conversa E o robo fechava >= 20% das vendas (bot_era_canal, a
--                 mesma conta do radar de 03/09). Nova na trilha fora.
--   5 sem_comprar dias sem pedido >= o limite dela (2x o intervalo mediano dos ultimos 6 meses,
--                 entre 14 e 45; 30 sem historico) — SEM teto de 90 dias — e so se a venda nao
--                 subiu (rev_delta_pct, ou 30d x 30d anteriores quando nao ha base, <= 0).
--                 Nova na trilha fora.
-- Acordo (cs_agreements) NUNCA apaga o motivo: marca blocked=true. Um acordo so segura o CARTAO
-- se tiver review_at no futuro (conserto M1: chave especifica ou '*', tanto faz; sem data de
-- revisao nao segura nada) E, quando tiver revenue_baseline, so enquanto a venda de 30 dias
-- ficar >= revenue_baseline x revenue_floor_pct / 100 (o piso antigo do radar). '*' segura todos
-- os motivos; chave especifica (do radar ou do Mural) segura o motivo correspondente.
-- Interna: sem EXECUTE para authenticated; so as RPCs SECURITY DEFINER a chamam.
-- ---------------------------------------------------------------------------------------------
create or replace function public.cs_unit_motives(p_corte_rel numeric default -20)
returns table(
  franchise_id text, franchise_name text, owner_name text, phone text,
  age_days integer, nova_trilha boolean,
  rev_mtd numeric, rev_prev_same numeric, rev_delta_pct numeric, rede_delta_pct numeric,
  caiu_delta_pct numeric, caiu_metodo text, caiu_sem_leitura boolean, caiu_qualquer_medida boolean,
  rev_90d numeric, rev_28d numeric, rev_30d numeric,
  days_since_last_sale integer, last_sale date, days_since_last_bot integer, days_since_last_po integer,
  mkt_mes text, mkt_paid boolean, sub_overdue boolean,
  motives jsonb, top_key text, top_value numeric, top_text text,
  rev_month_before numeric, baseline_rev_day numeric, agreement jsonb
)
language sql
stable
set search_path = 'public'
as $$
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
$$;

revoke execute on function public.cs_unit_motives(numeric) from public, anon, authenticated;
grant execute on function public.cs_unit_motives(numeric) to service_role;

comment on function public.cs_unit_motives(numeric) is
  'Regua do Mural do CS (Onda 2, 27/09/2026): motivos por unidade (sem_venda, caiu, nao_lanca, robo_parado, sem_comprar); acordo marca blocked sem apagar. Interna: so RPCs SECURITY DEFINER chamam.';

-- data tolerante (conserto B4): texto que nao e data valida vira NULL em vez de derrubar a consulta
create or replace function public.cs_try_date(p text, p_fmt text default 'DD/MM/YYYY')
returns date
language plpgsql
immutable
set search_path = 'public'
as $$
begin
  if p is null then return null; end if;
  return to_date(p, p_fmt);
exception when others then
  return null;
end;
$$;

revoke execute on function public.cs_try_date(text, text) from public, anon;
grant execute on function public.cs_try_date(text, text) to authenticated, service_role;

commit;
