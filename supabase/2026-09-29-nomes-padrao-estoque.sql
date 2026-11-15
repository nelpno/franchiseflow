-- 29/09/2026 · Nomes tortos marcados como produto padrão (S14.7 "Fica"), decisão do Nelson:
--   originais da fábrica → nome da tabela (catalog_products); caseiros/próprios → produto próprio;
--   e a franqueada não muda mais o NOME de produto da fábrica (guard).
-- Vila Formosa "Molho de Tomate Sugo - 500ML" fica de fora (perguntar à unidade).
-- Backup: _backup_inventory_nomes_2026_09_29 (id, product_name, created_by_franchisee).
-- Função antes: docs/db-backups/guard_inventory_cost.2026-09-29-antes.sql
-- ROLLBACK:
--   update inventory_items i set product_name=b.product_name, created_by_franchisee=b.created_by_franchisee
--     from _backup_inventory_nomes_2026_09_29 b where b.id=i.id;
--   \i docs/db-backups/guard_inventory_cost.2026-09-29-antes.sql

create table if not exists public._backup_inventory_nomes_2026_09_29 as
  select id, franchise_id, product_name, created_by_franchisee, now() as backed_up_at
  from public.inventory_items
  where id in (
    '45edba9f-6fbe-4c3a-9248-d9c39731cb7f','4cf5432e-9ebc-4c4f-a3d7-57c8a1ce8f38',
    '99e7bdfd-21a3-436d-bad8-b1408a830b6f','dfcab455-1969-4a52-9c97-1c6d2d3623e5',
    '54a88137-5941-48b0-b8d3-1c345463af76','27865f70-f087-4795-8466-0baa537685db',
    '836c31ba-d3da-4500-b0c6-eb84ca4bb981','2e938ecf-8e08-47cf-919b-968482620798',
    '32b5e60d-8e28-4455-baa2-77c2460c9bc7','a38c004e-29c7-4b1f-9ba7-65e0626e8ca9',
    '92fedb7f-14df-4661-82c5-41f2e50fde6a','dcc9d092-a145-453a-8a8d-7f7d7d9bacb6');
alter table public._backup_inventory_nomes_2026_09_29 enable row level security;
revoke all on public._backup_inventory_nomes_2026_09_29 from anon, authenticated;

-- Originais da fábrica: nome da tabela (preço, custo, venda e estoque intocados).
update public.inventory_items set product_name = 'Conchiglione Brócolis e Mussarela - 700g' where id = '45edba9f-6fbe-4c3a-9248-d9c39731cb7f' and product_name = '7';
update public.inventory_items set product_name = 'Molho de Tomate Sugo - 250g' where id = '4cf5432e-9ebc-4c4f-a3d7-57c8a1ce8f38' and product_name = 'Molho de Tomate- 250g';
update public.inventory_items set product_name = 'Molho de Tomate Sugo - 250g' where id = 'dfcab455-1969-4a52-9c97-1c6d2d3623e5' and product_name = 'Molho de Tomate ao Sugo - 250g';
update public.inventory_items set product_name = 'Massa de Pastel - 500g' where id = '99e7bdfd-21a3-436d-bad8-b1408a830b6f' and product_name = 'Massa de Pastel - 500g (rolo)';
update public.inventory_items set product_name = 'Massa de Pastel - 1kg' where id = '54a88137-5941-48b0-b8d3-1c345463af76' and product_name = 'Massa de Pastel - 1kg (rolo)';
update public.inventory_items set product_name = 'Molho de Tomate Sugo - 250g' where id = '27865f70-f087-4795-8466-0baa537685db' and product_name = 'Molho de Tomate Sugo Mariolla - 250g';

-- Caseiros/próprios: saem do pedido à fábrica e ficam só no Estoque.
update public.inventory_items set created_by_franchisee = true
 where id in ('836c31ba-d3da-4500-b0c6-eb84ca4bb981','2e938ecf-8e08-47cf-919b-968482620798',
              '32b5e60d-8e28-4455-baa2-77c2460c9bc7','a38c004e-29c7-4b1f-9ba7-65e0626e8ca9',
              '92fedb7f-14df-4661-82c5-41f2e50fde6a','dcc9d092-a145-453a-8a8d-7f7d7d9bacb6')
   and coalesce(created_by_franchisee, false) = false;

-- Guard: pela API a franqueada também não muda o NOME de produto da fábrica (preserva calado,
-- como já faz com o custo; a tela trava o campo).
create or replace function public.guard_inventory_cost()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user = 'authenticated'
     and not coalesce((select public.is_admin_or_manager()), false) then
    new.created_by_franchisee := old.created_by_franchisee;
    if coalesce(old.created_by_franchisee, false) = false then
      new.cost_price := old.cost_price;
      new.product_name := old.product_name;
    end if;
  end if;
  return new;
end;
$function$;
