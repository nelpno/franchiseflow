-- 09 — sinais de ROBÔ e de PAGAMENTO no radar de saúde (2026-08-17)
--
-- POR QUÊ: o Celso escreve cartão manual com os temas "Bot parado" / "Pix não cadastrado"
-- (5 dos 6 cartões manuais dele em ago/26 são disso) e o radar NÃO tinha sinal nenhum dos dois.
-- Consequência medida em 17/08: Araras e Limeira apareciam 🟢 SAUDÁVEL no mural com o robô
-- parado há 38 e 28 dias, e Americana estava 12 dias muda sem cartão nenhum. Como o cartão
-- manual nunca é reescrito pelo reconcile, o Celso lia o texto do dia em que escreveu e ligava
-- para o franqueado cobrando coisa já resolvida — ou deixava de ver o que quebrou depois.
--
-- O QUE MUDA: só o conteúdo de `flags` (jsonb). A assinatura (RETURNS TABLE) fica IGUAL —
-- por isso é CREATE OR REPLACE, sem DROP (o 04 precisou de DROP porque mudou colunas).
--
-- CUSTO: `botlast` usa subquery correlacionada, que casa o índice
-- bot_conversations_lookup_idx(franchise_id, started_at DESC) → Index Only Scan, 1,7ms para as
-- 65 franquias. NÃO trocar por `group by` sobre a view: sem a correlação o planner faz Seq Scan
-- em 90k linhas e o mesmo dado custa 1.402ms (medido 17/08).
--
-- CALIBRAÇÃO (medida em 17/08, 65 franquias): bot_silent 5 · bot_never 4 · payment_unset 4 ·
-- pix_missing 2. Todos 'med' de propósito: 'med' NÃO entra em has_high_churn, então NÃO abre
-- cartão automático sozinho — só sobe o tier de healthy p/ attention (mudou 2: Araras e Limeira)
-- e passa a aparecer na descrição do cartão auto e no card do mural.
--
-- GUARDA `d_sale is not null` em todos: franquia sem venda nos últimos 90d é onboarding
-- (tier dormant) e está FORA da fila do CS — sem isso, Jaraguá/Barueri/Leme entrariam como
-- "robô parado" sendo unidade que ainda não abriu (invariante 2 do cs-celso/CLAUDE.md).
--
-- HERDADO do 04 (a regra continua valendo, o comentário saiu do corpo pra caber aqui):
-- engagement_low foi REMOVIDO em 20/06 porque last_sign_in_at mede re-autenticação, não uso
-- (a sessão persiste) — 26/56 davam falso-positivo. Não há dado confiável de atividade no painel.
--
-- EFEITO COLATERAL COSMÉTICO (medido): acrescentar ramos ao union all reordena as flags de MESMA
-- severidade (o `order by` do jsonb_agg só ordena por sev, empate fica na ordem de leitura).
-- 14 das 65 franquias tiveram o texto reordenado; o CONJUNTO de flags é idêntico em todas as 65.
--
-- COMENTÁRIOS FICAM AQUI NO CABEÇALHO, NUNCA DENTRO DO CORPO DELIMITADO: o corpo deste arquivo
-- é comparado byte a byte com `pg_proc.prosrc` (md5) antes de qualquer replace — foi essa
-- igualdade que provou, em 17/08, que ninguém tinha editado a função direto no banco.
-- Comentário dentro do corpo some no `apply_migration` e quebra a comparação.
-- ⚠️ E não escreva o delimitador literal em comentário nenhum deste arquivo: o script de
-- comparação acha o marcador por busca de texto e pararia na MENÇÃO em vez do delimitador
-- (mordeu em 17/08 — o "corpo" extraído veio 1.286 bytes maior que o real).
drop function if exists public.get_franchise_health_signals(timestamptz);
create or replace function public.get_franchise_health_signals(p_since timestamptz default now()-interval '60 days')
returns table(
  franchise_id text, franchise_name text, city text, state_uf text,
  revenue_30d numeric, revenue_prev_30d numeric, revenue_delta_pct numeric,
  gross_margin_pct_30d numeric, gross_margin_prev_pct numeric,
  days_since_last_sale int, days_since_last_purchase int,
  zeroed_key_items_count int, key_items_total int,
  purchase_count_30d int, purchase_count_prev int,
  mix_distinct_30d int, mix_distinct_prev int,
  bot_conversion_30d numeric, bot_conversion_prev numeric,
  growth_pct numeric, network_median_growth numeric,
  subscription_overdue boolean, marketing_paid_current_month boolean,
  marketing_amount_current numeric, marketing_amount_prev numeric,
  days_since_login int,
  flags jsonb, tier text, is_standout boolean
)
language sql stable security definer set search_path='public' as $func$
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
    count(p.id) filter (where p.ordered_at>now()-interval '60 days' and p.ordered_at<=now()-interval '30 days')::int as cntprev
  from fr left join purchase_orders p on p.franchise_id=fr.fid and p.ordered_at>now()-interval '90 days'
  group by fr.fid
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
    coalesce(pay.has_cfg,false) as has_cfg,
    coalesce(pay.pay_unset,false) as pay_unset,
    coalesce(pay.pix_missing,false) as pix_missing
  from fr
  left join rev on rev.fid=fr.fid
  left join marg on marg.fid=fr.fid
  left join po on po.fid=fr.fid
  left join mix on mix.fid=fr.fid
  left join stock on stock.fid=fr.fid
  left join sub on sub.fid=fr.fid
  left join mkt on mkt.fid=fr.fid
  left join login on login.fid=fr.fid
  left join botsum on botsum.fid=fr.fid
  left join botlast on botlast.fid=fr.fid
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
  union all select fid,'stopped_buying', case when d_po>=30 then 'high' else 'med' end,'Sem comprar há '||d_po||'d' from metrics where d_po is not null and d_po>=21
  union all select fid,'purchase_freq_drop','med','Comprando menos vezes' from metrics where cntprev>=2 and cnt30<cntprev
  union all select fid,'purchase_mix_shrink','med','Menos variedade comprada' from metrics where mixprev>=5 and mix30 < mixprev*0.75
  union all select fid,'key_stock_zero','med',zeroed||' itens-chave zerados' from metrics where zeroed>=3
  union all select fid,'subscription_overdue','med','Assinatura atrasada' from metrics where overdue
  union all select fid,'marketing_unpaid','low','Marketing sem pagar (2 meses)' from metrics where not mkt_paid and not mkt_paid_prev
  union all select fid,'bot_bad','med','Bot: conversão caindo' from metrics where conv30 is not null and convprev is not null and bot_t30>=20 and conv30 < convprev-10
  union all select fid,'bot_silent','med','Robô sem conversa há '||d_bot||'d' from metrics where d_sale is not null and d_bot is not null and d_bot>=7
  union all select fid,'bot_never','med','Robô nunca registrou conversa' from metrics where d_sale is not null and d_bot is null
  union all select fid,'payment_unset','med','Sem forma de pagamento configurada' from metrics where d_sale is not null and has_cfg and pay_unset
  union all select fid,'pix_missing','med','Aceita PIX sem chave cadastrada' from metrics where d_sale is not null and has_cfg and pix_missing
  union all select m.fid,'growth_lagging','low','Crescendo abaixo da rede' from metrics m join growth gr on gr.fid=m.fid cross join net where gr.g is not null and net.med is not null and gr.g<net.med
),
flags_agg as (
  select fid,
    jsonb_agg(jsonb_build_object('key',k,'sev',sev,'label',lbl) order by case sev when 'high' then 0 when 'med' then 1 else 2 end) as flags,
    bool_or(sev='high' and k in ('revenue_drop','stopped_selling','stopped_buying','margin_negative')) as has_high_churn,
    bool_or(sev='med') as has_med,
    count(*)::int as nflags
  from flags_long group by fid
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
  case when m.d_sale is null then 'dormant'
       when coalesce(fa.has_high_churn,false) then 'critical'
       when (coalesce(fa.has_med,false) or coalesce(fa.nflags,0)>=2) then 'attention'
       else 'healthy' end as tier,
  (m.d_sale is not null and coalesce(fa.nflags,0)=0
     and (gr.pr>=0.75 or (gr.g is not null and net.med is not null and gr.g>net.med))) as is_standout
from metrics m
left join growth gr on gr.fid=m.fid
cross join net
left join flags_agg fa on fa.fid=m.fid
where (select public.is_cs_or_admin())
$func$;
revoke all on function public.get_franchise_health_signals(timestamptz) from public;
grant execute on function public.get_franchise_health_signals(timestamptz) to authenticated;
