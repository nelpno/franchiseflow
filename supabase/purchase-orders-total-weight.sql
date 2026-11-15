-- Peso total do pedido (snapshot no momento do pedido). Lido pelo roteirizador.
alter table public.purchase_orders
  add column if not exists total_weight_kg numeric(12,3);

comment on column public.purchase_orders.total_weight_kg is
  'Soma(peso_unit * quantity) no momento do pedido. Snapshot p/ roteirizacao (cap 1500kg). Pedidos antigos = null.';
