-- 2026-09-26 admin 13 — purchase_orders: delivered_at deixa de ser sempre "agora"
--
-- NAO APLICADO.
--
-- Por quê (achado 26/09, revisão Pedidos): o campo "Entregue em" (data escolhida no diálogo
-- de entrega em lote e no OrderDetailDialog) não tinha efeito nenhum. `entregarLote`
-- (src/pages/PurchaseOrders.jsx) e `OrderDetailDialog.doStatusChange` gravam
-- `delivered_at = meioDiaBRT(dataEntrega)` no MESMO UPDATE que muda o status para 'entregue',
-- mas o trigger BEFORE UPDATE `purchase_order_status_change` -> `on_purchase_order_delivered()`
-- fazia `NEW.delivered_at = now()` incondicionalmente sempre que o status virava 'entregue' —
-- e como o BEFORE roda antes do próprio statement terminar, o valor escolhido na tela nunca
-- chegava a ser salvo. Consequência prática: histórico e `expense_date` das despesas geradas
-- (compra_produto e transporte, tr_po_generate_expenses) sempre saem com a data em que o
-- clique aconteceu, mesmo escolhendo "Ontem" ou uma data anterior.
--
-- Fix: só o trigger define `delivered_at = now()` quando o FRONT não mandou um valor
-- (NEW.delivered_at igual ao OLD, ou seja, a coluna não fez parte do SET do UPDATE). Quando o
-- front já escreveu um valor diferente do que estava salvo (o caso normal: front sempre grava
-- `delivered_at` junto com o status), o trigger respeita esse valor. Isso cobre também
-- qualquer UPDATE futuro que mude o status para 'entregue' sem passar `delivered_at` (ex.: uma
-- correção manual via SQL) — nesse caso continua caindo em `now()`, mesmo comportamento de
-- antes.
--
-- Rollback (versão anterior, sempre now()):
--   create or replace function public.on_purchase_order_delivered()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path to 'public'
--   as $function$ begin
--     if new.status = 'entregue' and old.status != 'entregue' then
--       update inventory_items ii set quantity = ii.quantity + poi.quantity
--       from purchase_order_items poi
--       where poi.order_id = new.id and poi.inventory_item_id = ii.id;
--       new.delivered_at = now();
--     end if;
--     return new;
--   end; $function$;
--
-- Conferência pós-migração (rodar em query separada):
--   select pg_get_functiondef('public.on_purchase_order_delivered'::regproc);
--   -- confirmar que contém "is not distinct from" antes de "new.delivered_at = now()"
--   -- Teste funcional (não destrutivo, faz e desfaz num pedido de teste):
--   --   1. escolher um purchase_orders.id de status 'confirmado' de franquia is_test
--   --   2. update ... set status='entregue', delivered_at='2026-09-20T12:00:00-03:00' where id=<id>;
--   --   3. select status, delivered_at from purchase_orders where id=<id>; -- espera 2026-09-20, não hoje
--   --   4. update ... set status='confirmado', delivered_at=null where id=<id>; -- desfazer

begin;

create or replace function public.on_purchase_order_delivered()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'entregue' and old.status != 'entregue' then
    update inventory_items ii
    set quantity = ii.quantity + poi.quantity
    from purchase_order_items poi
    where poi.order_id = new.id
      and poi.inventory_item_id = ii.id;

    -- Front já grava delivered_at no mesmo UPDATE (data escolhida na tela). Só usar "agora"
    -- quando NADA foi passado (coluna ausente do SET, ou igual ao valor já salvo).
    if new.delivered_at is not distinct from old.delivered_at then
      new.delivered_at = now();
    end if;
  end if;
  return new;
end;
$function$;

commit;
