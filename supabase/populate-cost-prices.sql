-- Populate cost_price for all 28 standard Maxi Massas products
-- Based on factory price list (March 2026)
-- Uses LIKE with _ wildcard for accented chars (Brócolis)

UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Canelone 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name = 'Canelone 4 Queijos - 700g' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Canelone Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Canelone Frango%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Canelone Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Conchiglione 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Conchiglione Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Conchiglione Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Conchiglione Frango%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 7.00 WHERE product_name LIKE 'Massa de Lasanha%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 12.00 WHERE product_name LIKE 'Massa de Pastel - 1kg%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 6.50 WHERE product_name LIKE 'Massa de Pastel - 500g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 12.90 WHERE product_name LIKE 'Nhoque de Batata - 1kg%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 6.50 WHERE product_name LIKE 'Nhoque de Batata - 500g%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Nhoque Recheado%4 queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Nhoque Recheado com 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Nhoque Recheado%Mussarela%' AND product_name NOT LIKE '%Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Nhoque Recheado%Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Nhoque Recheado%Calabresa%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 16.50 WHERE product_name LIKE 'Fatiado Rondelli 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 14.90 WHERE product_name LIKE 'Fatiado Rondelli Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Rondelli 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Rondelli Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Rondelli Frango%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Rondelli Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 21.90 WHERE product_name LIKE 'Sofioli 4 Queijos%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Sofioli Br_colis%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Sofioli Presunto%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 18.90 WHERE product_name LIKE 'Sofioli Frango%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 5.90 WHERE product_name LIKE 'Molho de tomate%' AND cost_price IS NULL;
UPDATE inventory_items SET cost_price = 5.90 WHERE product_name LIKE 'Molho de Tomate%' AND cost_price IS NULL;
