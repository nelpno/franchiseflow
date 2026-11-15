-- Reajuste da tabela de preços da fábrica (custo padrão) — vigência 01/07/2026
-- Fonte: PDF "Tabela-Precos-MaxiMassas-2026-07" (reajuste médio ~5%, coluna Anterior -> Novo)
--
-- O "preço de custo padrão" vive em DOIS lugares:
--   1) catalog_products.price  -> template usado por auto_populate_inventory() ao criar franquia nova
--                                 (seed grava cost_price = price, sale_price = price * 2)
--   2) inventory_items.cost_price WHERE created_by_franchisee = false -> cópias por franquia existente
--
-- IMPORTANTE: só o CUSTO é reajustado. sale_price das franquias ATUAIS fica intacto
--   (cada franqueado sobe o preço de venda no seu tempo). Franquias NOVAS já nascem
--   com a venda atualizada via seed (price * 2 sobre o novo custo).
--
-- Backup criado antes da execução:
--   _backup_reajuste_20260701_inventory (1588 linhas), _backup_reajuste_20260701_catalog (28 linhas)
-- Rollback: UPDATE ... SET cost_price/price = backup por id.

WITH nova_tabela(name, novo) AS (VALUES
  ('Canelone 4 Queijos - 700g', 22.90),
  ('Conchiglione 4 Queijos - 700g', 22.90),
  ('Rondelli 4 Queijos - 700g Rolo', 22.90),
  ('Sofioli 4 Queijos - 700g', 22.90),
  ('Nhoque Recheado com 4 Queijos - 700g', 22.90),
  ('Nhoque Recheado com Mussarela - 700g', 22.90),
  ('Canelone Brócolis e Mussarela - 700g', 19.90),
  ('Canelone Frango e Requeijão - 700g', 19.90),
  ('Canelone Presunto e Mussarela - 700g', 19.90),
  ('Conchiglione Brócolis e Mussarela - 700g', 19.90),
  ('Conchiglione Frango e Requeijão - 700g', 19.90),
  ('Conchiglione Presunto e Mussarela - 700g', 19.90),
  ('Rondelli Brócolis e Mussarela - 700g Rolo', 19.90),
  ('Rondelli Frango e Requeijão - 700g Rolo', 19.90),
  ('Rondelli Presunto e Mussarela - 700g Rolo', 19.90),
  ('Sofioli Brócolis e Mussarela - 700g', 19.90),
  ('Sofioli Frango e Requeijão - 700g', 19.90),
  ('Sofioli Presunto e Mussarela - 700g', 19.90),
  ('Nhoque Recheado com Calabresa - 700g', 19.90),
  ('Nhoque Recheado com Presunto e Mussarela - 700g', 19.90),
  ('Rondelli 4 Queijos - 500g Fatiado', 17.50),
  ('Rondelli Presunto e Mussarela - 500g Fatiado', 15.90),
  ('Nhoque de Batata - 1kg', 13.50),
  ('Nhoque de Batata - 500g', 6.90),
  ('Massa de Pastel - 1kg', 12.90),
  ('Massa de Lasanha - 500g', 7.50),
  ('Massa de Pastel - 500g', 6.90),
  ('Molho de Tomate Sugo - 250g', 6.20)
)
UPDATE catalog_products c SET price = t.novo
  FROM nova_tabela t WHERE c.name = t.name;

WITH nova_tabela(name, novo) AS (VALUES
  ('Canelone 4 Queijos - 700g', 22.90),
  ('Conchiglione 4 Queijos - 700g', 22.90),
  ('Rondelli 4 Queijos - 700g Rolo', 22.90),
  ('Sofioli 4 Queijos - 700g', 22.90),
  ('Nhoque Recheado com 4 Queijos - 700g', 22.90),
  ('Nhoque Recheado com Mussarela - 700g', 22.90),
  ('Canelone Brócolis e Mussarela - 700g', 19.90),
  ('Canelone Frango e Requeijão - 700g', 19.90),
  ('Canelone Presunto e Mussarela - 700g', 19.90),
  ('Conchiglione Brócolis e Mussarela - 700g', 19.90),
  ('Conchiglione Frango e Requeijão - 700g', 19.90),
  ('Conchiglione Presunto e Mussarela - 700g', 19.90),
  ('Rondelli Brócolis e Mussarela - 700g Rolo', 19.90),
  ('Rondelli Frango e Requeijão - 700g Rolo', 19.90),
  ('Rondelli Presunto e Mussarela - 700g Rolo', 19.90),
  ('Sofioli Brócolis e Mussarela - 700g', 19.90),
  ('Sofioli Frango e Requeijão - 700g', 19.90),
  ('Sofioli Presunto e Mussarela - 700g', 19.90),
  ('Nhoque Recheado com Calabresa - 700g', 19.90),
  ('Nhoque Recheado com Presunto e Mussarela - 700g', 19.90),
  ('Rondelli 4 Queijos - 500g Fatiado', 17.50),
  ('Rondelli Presunto e Mussarela - 500g Fatiado', 15.90),
  ('Nhoque de Batata - 1kg', 13.50),
  ('Nhoque de Batata - 500g', 6.90),
  ('Massa de Pastel - 1kg', 12.90),
  ('Massa de Lasanha - 500g', 7.50),
  ('Massa de Pastel - 500g', 6.90),
  ('Molho de Tomate Sugo - 250g', 6.20)
)
UPDATE inventory_items i SET cost_price = t.novo, updated_at = now()
  FROM nova_tabela t
 WHERE i.created_by_franchisee = false AND i.product_name = t.name;

-- "Molho de Tomate Mariolla - 250g" É o molho padrão da rede (confirmado por Nelson),
-- só difere no nome do template ("Molho de Tomate Sugo - 250g"). Reajustado junto:
UPDATE inventory_items
   SET cost_price = 6.20, updated_at = now()
 WHERE created_by_franchisee = false
   AND product_name = 'Molho de Tomate Mariolla - 250g';

-- Correção de nome (Sorocaba sp1): "Rondelli frango X Requeijão 700 gramas" -> nome padrão + custo 19,90:
UPDATE inventory_items
   SET product_name = 'Rondelli Frango e Requeijão - 700g Rolo', cost_price = 19.90, updated_at = now()
 WHERE id = '449a2c37-0708-4857-99c5-0836994c4d09';

-- Correção de nomes tortos -> padrão + custo novo (São Paulo sp2 e sp4):
UPDATE inventory_items SET product_name='Rondelli 4 Queijos - 500g Fatiado', cost_price=17.50, updated_at=now()
 WHERE id='33f8edfb-bc4e-4cde-b47c-683ebfb824d8';
UPDATE inventory_items SET product_name='Rondelli Presunto e Mussarela - 500g Fatiado', cost_price=15.90, updated_at=now()
 WHERE id='a3136f71-1ead-4a52-8f1a-91fd02b49860';
UPDATE inventory_items SET product_name='Molho de Tomate Mariolla - 250g', cost_price=6.20, updated_at=now()
 WHERE id='ed0070dc-254d-43ba-a75d-b30eb1a3a88e';

-- Executado em 2026-07-01: 28 catalog_products + 1544 inventory_items + 39 Mariolla + 4 renames.
-- "Molho de Tomate Sugo - 500g" (SP sp13): é molho próprio da franquia (Nelson) — reclassificado
--   como item da franquia, sai do catálogo padrão:
UPDATE inventory_items SET created_by_franchisee = true, updated_at = now()
 WHERE id = '70b58939-6d85-496e-a0e0-a1e23a1c53f3';

-- RESULTADO FINAL 2026-07-01: catálogo padrão = 29 nomes canônicos, 0 variantes.
