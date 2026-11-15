-- 2026-09-26 admin 12 — purchase_orders.confirmed_at (área Pedidos, Onda 1)
--
-- NAO APLICADO. Front (pedidosHelpers.js/PurchaseOrders.jsx/OrderDetailDialog.jsx) já
-- referencia `confirmed_at` e é TOLERANTE a null: enquanto a coluna não existir de verdade
-- no banco, qualquer SELECT que peça essa coluna dá 42703. Rodar isto ANTES de publicar o
-- front da Onda 1 (área Pedidos), ou tirar `confirmed_at` de COLUNAS_PEDIDO até rodar.
--
-- Por quê (achado 26/09, revisão Pedidos): o atraso da seção "Para separar e entregar" e o
-- texto "pedido há N dias" contam a partir de `ordered_at` (data em que a UNIDADE pediu), não
-- da CONFIRMAÇÃO da fábrica. Pedido confirmado ontem, feito há 8 dias, já nascia vermelho; em
-- 26/09 os 6 pedidos de "Para separar" (todos confirmados em 21/09, pedidos em 20/09) ficariam
-- todos vermelhos de uma vez quando passassem de 7 dias corridos desde o PEDIDO, não da
-- confirmação. Mediana pedido→entrega (jul-set): 4,9 dias; novo limiar de atraso pós-
-- confirmação: 5 dias (perto da mediana). Pendente sem confirmar: 3 dias.
--
-- Backfill: pedidos JÁ confirmados/entregues não têm como saber a data exata da confirmação
-- (não existia o campo) — usa `updated_at` como aproximação (é o que o CLAUDE.md do dashboard
-- já registra como referência: "confirmed_by (hoje null) e updated_at = 21/09"). Pedidos ainda
-- 'pendente' ficam com confirmed_at NULL (correto: não foram confirmados ainda). O front trata
-- confirmed_at NULL como "ainda sem essa informação" e cai no fallback de ordered_at — nunca
-- quebra por linha sem backfill.
--
-- Rollback: `alter table public.purchase_orders drop column if exists confirmed_at;`
-- Conferência pós-migração (rodar em query separada, nunca no mesmo CTE do UPDATE):
--   select count(*) from public.purchase_orders where status in ('confirmado','entregue') and confirmed_at is null;
--   -- esperado: 0 (todo confirmado/entregue tem confirmed_at depois do backfill)
--   select count(*) from public.purchase_orders where status = 'pendente' and confirmed_at is not null;
--   -- esperado: 0 (pendente nunca foi confirmado)

begin;

alter table public.purchase_orders
  add column if not exists confirmed_at timestamptz;

comment on column public.purchase_orders.confirmed_at is
  'Quando a fábrica confirmou o pedido (status pendente -> confirmado). NULL = ainda pendente, ou confirmado antes desta coluna existir e sem backfill. Backfill 26/09 usa updated_at como aproximação.';

-- Backfill: só quem já saiu de pendente (confirmado/entregue) e ainda não tem confirmed_at.
update public.purchase_orders
set confirmed_at = updated_at
where status in ('confirmado', 'entregue')
  and confirmed_at is null;

commit;

-- Conferência (rodar depois do commit, em chamada separada):
-- select status, count(*), count(confirmed_at) from public.purchase_orders group by status order by status;
