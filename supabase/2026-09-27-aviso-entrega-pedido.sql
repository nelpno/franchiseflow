-- Aviso de entrega ao franqueado (27/09/2026).
-- Admin seleciona pedidos confirmados em "Para separar e entregar" e clica "Avisar entrega":
-- o front grava estimated_delivery (a data avisada, que a franqueada já vê como "Previsão")
-- + status 'fila'; o n8n (webhook aviso-entrega-pedidos) manda o WhatsApp pelo admin_nelson,
-- com intervalo aleatório entre unidades, e grava 'enviado' (+ delivery_notified_at) ou 'falhou'.
-- Nenhum trigger de purchase_orders reage a essas colunas (só a status).

alter table public.purchase_orders
  add column if not exists delivery_notice_status text,
  add column if not exists delivery_notified_at timestamptz,
  add column if not exists delivery_notice_error text;

alter table public.purchase_orders drop constraint if exists purchase_orders_delivery_notice_status_check;
alter table public.purchase_orders
  add constraint purchase_orders_delivery_notice_status_check
  check (delivery_notice_status is null or delivery_notice_status in ('fila', 'enviado', 'falhou'));

notify pgrst, 'reload schema';
