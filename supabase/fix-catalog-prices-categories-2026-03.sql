-- Fix catalog_products prices (match PLANILHA PEDIDO 082025.xlsx) and categories
-- Executed: 2026-03-24
-- Fixes 8 wrong prices + categories from individual types to system categories (Massas/Molhos/Outros)

-- 1. Fix catalog_products PRICES
UPDATE catalog_products SET price = 21.90 WHERE name = 'Nhoque Recheado com 4 Queijos - 700g';
UPDATE catalog_products SET price = 16.50 WHERE name LIKE 'Rondelli 4 Queijos%500g%';
UPDATE catalog_products SET price = 14.90 WHERE name LIKE 'Rondelli Presunto%500g%';
UPDATE catalog_products SET price = 21.90 WHERE name LIKE 'Rondelli 4 Queijos%700g%';
UPDATE catalog_products SET price = 18.90 WHERE name LIKE 'Rondelli Br%colis%700g%';
UPDATE catalog_products SET price = 18.90 WHERE name LIKE 'Rondelli Frango%700g%';
UPDATE catalog_products SET price = 18.90 WHERE name LIKE 'Rondelli Presunto%700g%';
UPDATE catalog_products SET price = 5.90 WHERE name LIKE 'Molho%';

-- 2. Fix catalog_products CATEGORIES (Massas, Molhos, Outros — match getCategoryFromName())
UPDATE catalog_products SET category = 'Massas' WHERE category IN ('Canelone', 'Conchiglione', 'Nhoque', 'Rondelli', 'Sofioli');

-- 3. Fix existing inventory_items PRICES (all franchises) — sale_price = cost_price * 2
UPDATE inventory_items SET cost_price = 21.90, sale_price = 43.80 WHERE product_name LIKE 'Nhoque Recheado%4 Queijos%' OR product_name LIKE 'Nhoque Recheado%4 queijos%';
UPDATE inventory_items SET cost_price = 16.50, sale_price = 33.00 WHERE product_name LIKE '%Rondelli 4 Queijos%500g%' OR product_name LIKE 'Fatiado Rondelli 4 Queijos%';
UPDATE inventory_items SET cost_price = 14.90, sale_price = 29.80 WHERE product_name LIKE '%Rondelli Presunto%500g%' OR product_name LIKE 'Fatiado Rondelli Presunto%';
UPDATE inventory_items SET cost_price = 21.90, sale_price = 43.80 WHERE product_name LIKE 'Rondelli 4 Queijos%700g%';
UPDATE inventory_items SET cost_price = 18.90, sale_price = 37.80 WHERE product_name LIKE 'Rondelli Br%colis%700g%';
UPDATE inventory_items SET cost_price = 18.90, sale_price = 37.80 WHERE product_name LIKE 'Rondelli Frango%700g%';
UPDATE inventory_items SET cost_price = 18.90, sale_price = 37.80 WHERE product_name LIKE 'Rondelli Presunto%700g%';
UPDATE inventory_items SET cost_price = 5.90, sale_price = 11.80 WHERE product_name LIKE 'Molho%';

-- 4. Fix existing inventory_items CATEGORIES
UPDATE inventory_items SET category = 'Massas' WHERE category IN ('Canelone', 'Conchiglione', 'Nhoque', 'Rondelli', 'Sofioli');
