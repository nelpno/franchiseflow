-- Encomendas (pedido do Renato/Ribeirao, 17/11/2026; proposta em cs-celso/planos/2026-11-17-proposta-encomendas.md)
-- Cliente encomenda para uma data futura (ate dezembro). NAO mexe em estoque nem faturamento:
-- so vira venda no "Virou venda" (formulario de venda normal, que baixa o estoque pelo trigger de sale_items).
-- RLS por unidade igual a `sales` (is_admin / is_admin_or_manager / managed_franchise_ids), so para `authenticated`.
--
-- ROLLBACK:
--   drop table if exists public.encomendas;
--   (nada mais foi alterado: a tabela e nova, sem trigger de estoque e sem funcao nova)

create table if not exists public.encomendas (
  id uuid primary key default gen_random_uuid(),
  franchise_id text not null,                       -- evolution_instance_id (TEXT), como em sales
  contact_id uuid references public.contacts(id) on delete set null,
  cliente_nome text not null,
  telefone text,
  entregar_em date not null,
  itens jsonb not null default '[]'::jsonb,         -- [{inventory_item_id, nome, qtd}]
  obs text,
  status text not null default 'aberta'
    check (status in ('aberta', 'pedida', 'entregue', 'cancelada')),
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  pedida_em timestamptz,
  entregue_em timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encomendas_itens_array check (jsonb_typeof(itens) = 'array')
);

create index if not exists encomendas_franchise_status_data_idx
  on public.encomendas (franchise_id, status, entregar_em);
create index if not exists encomendas_contact_idx on public.encomendas (contact_id) where contact_id is not null;
create index if not exists encomendas_purchase_order_idx on public.encomendas (purchase_order_id) where purchase_order_id is not null;
create index if not exists encomendas_sale_idx on public.encomendas (sale_id) where sale_id is not null;

create trigger encomendas_updated_at
  before update on public.encomendas
  for each row execute function public.update_updated_at();

alter table public.encomendas enable row level security;

create policy encomendas_select on public.encomendas
  for select to authenticated
  using (
    (select is_admin_or_manager())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  );

create policy encomendas_insert on public.encomendas
  for insert to authenticated
  with check (
    (select is_admin_or_manager())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  );

create policy encomendas_update on public.encomendas
  for update to authenticated
  using (
    (select is_admin_or_manager())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  )
  with check (
    (select is_admin_or_manager())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  );

create policy encomendas_delete on public.encomendas
  for delete to authenticated
  using (
    (select is_admin())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  );

-- Tabela criada apos 30/10/2026: sem o grant some da Data API (CLAUDE.md da Maxi). A RLS e quem isola.
grant select, insert, update, delete on table public.encomendas to anon, authenticated, service_role;

-- Higiene (aplicado em 2a migration no mesmo dia): o default do Supabase tambem da TRUNCATE/REFERENCES/TRIGGER
-- a anon e authenticated; a Data API nao usa, entao sai. Fica so o CRUD que a RLS governa.
revoke truncate, references, trigger on table public.encomendas from anon, authenticated;
