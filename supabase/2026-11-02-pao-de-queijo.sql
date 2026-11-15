-- 02/11/2026 · Nelson: pão de queijo Dugab (marca Gabi) entra no pedido à fábrica, por caixa de 12 pacotes de 1 kg.
--  Tabela da fábrica R$ 14,90 o pacote (custo Maxi R$ 10,00, NF 48007); venda sugerida R$ 27,90.
--  O pedido grava PACOTES (estoque e venda da unidade são por pacote); a tela pede caixa (src/lib/caixaFechada.js).
--  Santana (franquiasaopaulosp21) entra oculto: está com o estoque todo zerado, e aí o robô mostra tudo.
--  MCD: PAO QUEIJO 1KG (operations/pcp/src/cadastra_pao_de_queijo_mcd_2026-11-02.py).
-- ROLLBACK:
--   delete from inventory_items where id in (select id::uuid from _backup_pao_de_queijo_2026_11_02 where tabela='inventory_items');
--   delete from catalog_products where id in (select id::uuid from _backup_pao_de_queijo_2026_11_02 where tabela='catalog_products');
--   delete from product_weights where product_name = 'Pão de Queijo Tradicional - 1kg';

create table if not exists public._backup_pao_de_queijo_2026_11_02 (tabela text, id text, nome text, backed_up_at timestamptz default now());
alter table public._backup_pao_de_queijo_2026_11_02 enable row level security;
revoke all on public._backup_pao_de_queijo_2026_11_02 from anon, authenticated;

with novo as (
  insert into public.catalog_products (name, description, category, price, cost_price, active, sort_order, qtd_pedido_modelo)
  select 'Pão de Queijo Tradicional - 1kg', 'Caixa com 12 pacotes de 1 kg (Dugab, marca Gabi)', 'Outros', 14.90, 14.90, true, 29, 0
   where not exists (select 1 from public.catalog_products where name = 'Pão de Queijo Tradicional - 1kg')
  returning id, name
)
insert into public._backup_pao_de_queijo_2026_11_02 (tabela, id, nome) select 'catalog_products', id::text, name from novo;

with novos as (
  insert into public.inventory_items (franchise_id, product_name, category, quantity, unit, min_stock, cost_price, sale_price, created_by_franchisee, active)
  select f.evolution_instance_id, 'Pão de Queijo Tradicional - 1kg', 'Outros', 0, 'un', 3, 14.90, 27.90, false,
         f.evolution_instance_id <> 'franquiasaopaulosp21'
    from public.franchises f
   where f.status = 'active'
     and exists (select 1 from public.inventory_items i where i.franchise_id = f.evolution_instance_id and coalesce(i.created_by_franchisee, false) = false)
     and not exists (select 1 from public.inventory_items i where i.franchise_id = f.evolution_instance_id and i.product_name = 'Pão de Queijo Tradicional - 1kg')
  returning id, franchise_id
)
insert into public._backup_pao_de_queijo_2026_11_02 (tabela, id, nome) select 'inventory_items', id::text, franchise_id from novos;

insert into public.product_weights (product_name, weight_kg, is_auto) values ('Pão de Queijo Tradicional - 1kg', 1.0, false)
on conflict (product_name) do nothing;
