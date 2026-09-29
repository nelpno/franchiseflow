-- 29/09/2026 · Decisão do Nelson:
--  (1) o nome padrão da massa de pastel passa a ter "(rolo)" (tabela da fábrica + cópias das unidades
--      + peso + foto do robô). Histórico (vendas e pedidos antigos) fica com o nome antigo.
--  (2) Vila Mariana e Rio Preto voltam a ter o molho da fábrica (quantidade 0; ocultam se quiserem).
-- Backup: _backup_pastel_rolo_2026_09_29 (tabela, id, nome antigo).
-- ROLLBACK:
--   update catalog_products c set name=b.nome from _backup_pastel_rolo_2026_09_29 b where b.tabela='catalog_products' and b.id=c.id::text;
--   update inventory_items i set product_name=b.nome from _backup_pastel_rolo_2026_09_29 b where b.tabela='inventory_items' and b.id=i.id::text;
--   update product_weights w set product_name=b.nome from _backup_pastel_rolo_2026_09_29 b where b.tabela='product_weights' and w.product_name=b.id;
--   update product_photos set maps_to_products = array_remove(array_remove(maps_to_products,'Massa de Pastel - 500g (rolo)'),'Massa de Pastel - 1kg (rolo)') where id='pastel_frito';
--   delete from inventory_items where id in (select id::uuid from _backup_pastel_rolo_2026_09_29 where tabela='novo_molho');

create table if not exists public._backup_pastel_rolo_2026_09_29 (tabela text, id text, nome text, novo text, backed_up_at timestamptz default now());
alter table public._backup_pastel_rolo_2026_09_29 enable row level security;
revoke all on public._backup_pastel_rolo_2026_09_29 from anon, authenticated;

insert into public._backup_pastel_rolo_2026_09_29 (tabela, id, nome, novo)
select 'catalog_products', id::text, name, name || ' (rolo)' from public.catalog_products where name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g')
union all
select 'inventory_items', id::text, product_name, product_name || ' (rolo)' from public.inventory_items
 where product_name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g') and coalesce(created_by_franchisee,false) = false
union all
select 'product_weights', product_name || ' (rolo)', product_name, product_name || ' (rolo)' from public.product_weights where product_name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g');

update public.catalog_products set name = name || ' (rolo)' where name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g');
update public.inventory_items set product_name = product_name || ' (rolo)'
 where product_name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g') and coalesce(created_by_franchisee,false) = false;
update public.product_weights set product_name = product_name || ' (rolo)' where product_name in ('Massa de Pastel - 1kg','Massa de Pastel - 500g');
-- Foto do robô: acrescenta os nomes novos (mantém os antigos para histórico).
update public.product_photos
   set maps_to_products = maps_to_products || array['Massa de Pastel - 500g (rolo)','Massa de Pastel - 1kg (rolo)']
 where id = 'pastel_frito' and not ('Massa de Pastel - 1kg (rolo)' = any(maps_to_products));

-- Molho da fábrica de volta (preço de venda = tabela × 2, como o seed; mínimo 3 como a rede).
with novos as (
  insert into public.inventory_items (franchise_id, product_name, category, quantity, unit, min_stock, cost_price, sale_price, created_by_franchisee, active)
  select f.evo, c.name, coalesce(c.category, 'Molhos'), 0, 'un', 3, c.price, c.price * 2, false, true
    from (values ('franquiasaopaulosp15'), ('franquiasaojosedoriopretosp')) f(evo)
    cross join public.catalog_products c
   where c.name = 'Molho de Tomate Sugo - 250g'
     and not exists (select 1 from public.inventory_items i where i.franchise_id = f.evo
                      and i.product_name in ('Molho de Tomate Sugo - 250g','Molho de Tomate Mariolla - 250g'))
  returning id, franchise_id
)
insert into public._backup_pastel_rolo_2026_09_29 (tabela, id, nome, novo)
select 'novo_molho', id::text, franchise_id, 'Molho de Tomate Sugo - 250g' from novos;
