-- Tabela-mestra de peso por produto (catálogo padrão da rede).
-- weight_kg seedado pelo parser (productWeight.js); is_auto vira false quando
-- ajustado manualmente por admin (override via SQL). Cross-rede, não-sensível.

create table if not exists public.product_weights (
  product_name text primary key,
  weight_kg    numeric(10,3) not null check (weight_kg >= 0),
  is_auto      boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.product_weights enable row level security;

-- Leitura: qualquer usuário autenticado (catálogo cross-rede, não-sensível).
drop policy if exists product_weights_select on public.product_weights;
create policy product_weights_select on public.product_weights
  for select to authenticated using (true);

-- Escrita: só admin/manager (override). service_role bypassa RLS (seed).
drop policy if exists product_weights_write on public.product_weights;
create policy product_weights_write on public.product_weights
  for all to authenticated
  using ((select public.is_admin_or_manager()))
  with check ((select public.is_admin_or_manager()));

grant select, insert, update, delete on table public.product_weights to authenticated, service_role;
