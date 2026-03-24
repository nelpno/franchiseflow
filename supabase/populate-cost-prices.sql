-- Populate cost_price for all 28 standard Maxi Massas products
-- Based on PLANILHA PEDIDO 082025.xlsx (source of truth)
-- sale_price = cost_price * 2 (100% markup)
-- Uses LIKE with _ wildcard for accented chars (Brócolis)

-- Canelone (4 products)
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Canelone 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Canelone Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Canelone Frango%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Canelone Presunto%' AND cost_price IS NULL;

-- Conchiglione (4 products)
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Conchiglione 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Conchiglione Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Conchiglione Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Conchiglione Frango%' AND cost_price IS NULL;

-- Massa (3 products)
UPDATE inventory_items SET cost_price = 7.00, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 14.00) WHERE product_name LIKE 'Massa de Lasanha%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 12.00, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 24.00) WHERE product_name LIKE 'Massa de Pastel - 1kg%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 6.50, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 13.00) WHERE product_name LIKE 'Massa de Pastel - 500g%' AND cost_price IS NULL;

-- Nhoque (6 products)
UPDATE inventory_items SET cost_price = 12.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 25.80) WHERE product_name LIKE 'Nhoque de Batata - 1kg%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 6.50, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 13.00) WHERE product_name LIKE 'Nhoque de Batata - 500g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Nhoque Recheado%4 Queijos%' OR product_name LIKE 'Nhoque Recheado%4 queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Nhoque Recheado%Mussarela%' AND product_name NOT LIKE '%Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Nhoque Recheado%Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Nhoque Recheado%Calabresa%' AND cost_price IS NULL;

-- Rondelli Fatiado (2 products)
UPDATE inventory_items SET cost_price = 16.50, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 33.00) WHERE (product_name LIKE '%Rondelli 4 Queijos%500g%' OR product_name LIKE 'Fatiado Rondelli 4 Queijos%') AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 14.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 29.80) WHERE (product_name LIKE '%Rondelli Presunto%500g%' OR product_name LIKE 'Fatiado Rondelli Presunto%') AND cost_price IS NULL;

-- Rondelli 700g (4 products)
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Rondelli 4 Queijos%700g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Rondelli Br_colis%700g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Rondelli Frango%700g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Rondelli Presunto%700g%' AND cost_price IS NULL;

-- Sofioli (4 products)
UPDATE inventory_items SET cost_price = 21.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 43.80) WHERE product_name LIKE 'Sofioli 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Sofioli Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Sofioli Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 37.80) WHERE product_name LIKE 'Sofioli Frango%' AND cost_price IS NULL;

-- Molho (1 product)
UPDATE inventory_items SET cost_price = 5.90, sale_price = COALESCE(NULLIF(sale_price, cost_price * 2), 11.80) WHERE product_name LIKE 'Molho%' AND cost_price IS NULL;
