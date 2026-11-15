-- Primeiros passos: métricas da coorte (SÓ LEITURA). 17/09/2026.
-- Rodar 30 e 60 dias depois da Fase 1 (no ar em 16/09/2026). Duas consultas: por unidade e resumo.
--
-- Coorte FIXA: unidades criadas a partir de `inicio`, sem teste (`franchises.is_test`).
-- As que já rodavam e foram concluídas à mão ficam fora por serem de antes de `inicio`.
-- "Vendeu até o dia N" só conta unidade com N dias de vida (senão o número cai à toa).
-- Base de comparação (16/09): mediana de 23 dias até a 1ª venda e 11 dias até o robô
-- responder; 9 de 18 unidades novas sem checklist.
-- Datas mostradas no horário de São Paulo (a sessão do banco é UTC).
-- Para ensaiar com unidades antigas, troque a data do `inicio` (ex.: 2026-08-01).

-- 1) Por unidade
with params as (
  select timestamptz '2026-09-16 00:00:00-03' as inicio, now() as agora
),
coorte as (
  select f.evolution_instance_id as evo, f.name as unidade, f.created_at as criada_em,
         round((extract(epoch from (p.agora - f.created_at)) / 86400)::numeric, 1) as dias_de_vida
  from public.franchises f, params p
  where f.created_at >= p.inicio and not coalesce(f.is_test, false)
),
modelo as (
  select translate(lower(regexp_replace(trim(name), '\s+', ' ', 'g')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') as chave,
         qtd_pedido_modelo as q
  from public.catalog_products
  where coalesce(qtd_pedido_modelo, 0) > 0
),
primeiro_pedido as (
  select distinct on (po.franchise_id) po.franchise_id, po.id
  from public.purchase_orders po
  join coorte c on c.evo = po.franchise_id
  order by po.franchise_id, coalesce(po.ordered_at, po.created_at), po.id
),
itens as (
  select pp.franchise_id,
         translate(lower(regexp_replace(trim(i.product_name), '\s+', ' ', 'g')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') as chave,
         sum(i.quantity) as q
  from primeiro_pedido pp
  join public.purchase_order_items i on i.order_id = pp.id
  group by 1, 2
),
linhas as (
  select coalesce(a.franchise_id, b.franchise_id) as franchise_id,
         coalesce(a.q, 0) as q_modelo, coalesce(b.q, 0) as q_pedido
  from (select pp.franchise_id, m.chave, m.q from primeiro_pedido pp cross join modelo m) a
  full join itens b on b.franchise_id = a.franchise_id and b.chave = a.chave
),
comparacao as (
  select franchise_id,
         sum(q_pedido) as unidades_pedido,
         sum(q_modelo) as unidades_modelo,
         count(*) filter (where q_modelo > 0 and q_pedido = q_modelo) as linhas_iguais,
         count(*) filter (where q_modelo <> q_pedido) as linhas_mudadas
  from linhas
  group by 1
)
select
  c.unidade,
  (c.criada_em at time zone 'America/Sao_Paulo')::date as criada,
  c.dias_de_vida,
  oc.id is not null as tem_checklist,
  oc.status,
  ((select min(s.created_at) from public.sales s where s.franchise_id = c.evo) at time zone 'America/Sao_Paulo')::date as primeira_venda,
  round((extract(epoch from ((select min(s.created_at) from public.sales s where s.franchise_id = c.evo) - c.criada_em)) / 86400)::numeric, 1) as dias_ate_venda,
  round((extract(epoch from ((select min(m.created_at) from public.conversation_messages m where m.franchise_id = c.evo and m.direction = 'out') - c.criada_em)) / 86400)::numeric, 1) as dias_ate_robo,
  round((extract(epoch from ((select min(coalesce(po.ordered_at, po.created_at)) from public.purchase_orders po where po.franchise_id = c.evo) - c.criada_em)) / 86400)::numeric, 1) as dias_ate_pedido,
  -- datas das confirmações dela: mostram onde cada unidade para
  case when jsonb_typeof(oc.items -> 'p_whatsapp_ok') = 'string' then ((oc.items ->> 'p_whatsapp_ok')::timestamptz at time zone 'America/Sao_Paulo')::date end as conf_whatsapp,
  case when jsonb_typeof(oc.items -> 'p_espaco_ok') = 'string' then ((oc.items ->> 'p_espaco_ok')::timestamptz at time zone 'America/Sao_Paulo')::date end as conf_espaco,
  case when jsonb_typeof(oc.items -> 'p_pedido_ok') = 'string' then ((oc.items ->> 'p_pedido_ok')::timestamptz at time zone 'America/Sao_Paulo')::date end as conf_pedido,
  cmp.unidades_pedido, cmp.unidades_modelo, cmp.linhas_iguais, cmp.linhas_mudadas,
  round((extract(epoch from (oc.approved_at - c.criada_em)) / 86400)::numeric, 1) as dias_ate_concluir
from coorte c
left join public.onboarding_checklists oc on oc.franchise_id = c.evo
left join comparacao cmp on cmp.franchise_id = c.evo
order by c.criada_em;

-- 2) Resumo da coorte
with params as (
  select timestamptz '2026-09-16 00:00:00-03' as inicio, now() as agora
),
coorte as (
  select f.evolution_instance_id as evo, f.created_at as criada_em,
         extract(epoch from (p.agora - f.created_at)) / 86400 as dias_de_vida
  from public.franchises f, params p
  where f.created_at >= p.inicio and not coalesce(f.is_test, false)
),
marcos as (
  select c.*,
    exists (select 1 from public.onboarding_checklists oc where oc.franchise_id = c.evo) as tem_checklist,
    (select oc.approved_at from public.onboarding_checklists oc where oc.franchise_id = c.evo) as concluida_em,
    (select min(s.created_at) from public.sales s where s.franchise_id = c.evo) as primeira_venda,
    (select min(m.created_at) from public.conversation_messages m where m.franchise_id = c.evo and m.direction = 'out') as primeira_resposta_robo
  from coorte c
)
select
  count(*) as unidades,
  round(100.0 * count(*) filter (where tem_checklist) / nullif(count(*), 0), 0) as pct_com_checklist,
  count(*) filter (where dias_de_vida >= 7) as base_d7,
  round(100.0 * count(*) filter (where dias_de_vida >= 7 and primeira_resposta_robo <= criada_em + interval '7 days')
        / nullif(count(*) filter (where dias_de_vida >= 7), 0), 0) as pct_robo_ate_d7,
  count(*) filter (where dias_de_vida >= 14) as base_d14,
  round(100.0 * count(*) filter (where dias_de_vida >= 14 and primeira_venda <= criada_em + interval '14 days')
        / nullif(count(*) filter (where dias_de_vida >= 14), 0), 0) as pct_vendeu_ate_d14,
  count(*) filter (where dias_de_vida >= 30) as base_d30,
  round(100.0 * count(*) filter (where dias_de_vida >= 30 and primeira_venda <= criada_em + interval '30 days')
        / nullif(count(*) filter (where dias_de_vida >= 30), 0), 0) as pct_vendeu_ate_d30,
  count(*) filter (where concluida_em is not null) as concluidas,
  round((percentile_cont(0.5) within group (order by extract(epoch from (concluida_em - criada_em)) / 86400)
         filter (where concluida_em is not null))::numeric, 1) as mediana_dias_ate_concluir
from marcos;
