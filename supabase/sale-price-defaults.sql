-- ============================================================
-- Sale Price Defaults: auto-fill sale_price = cost_price * 2 (100% markup)
-- ============================================================

-- 1. Update existing products that have cost_price but no sale_price
UPDATE inventory_items
SET sale_price = cost_price * 2,
    updated_at = NOW()
WHERE sale_price IS NULL
  AND cost_price IS NOT NULL;

-- 2. Update the on_franchise_created trigger function to include sale_price
-- when populating default products for new franchises.
--
-- NOTE: The trigger function `on_franchise_created` needs to be updated to set
-- sale_price = cost_price * 2 in the INSERT INTO inventory_items statement.
--
-- To find the current trigger definition, run:
--   SELECT routine_name, routine_definition
--   FROM information_schema.routines
--   WHERE routine_name = 'on_franchise_created' AND routine_type = 'FUNCTION';
--
-- Then update the INSERT statement inside the function to include:
--   sale_price = p.default_price * 2
-- (or whatever column holds the cost_price in the product catalog source)
--
-- Example modification (adapt to actual function body):
--
-- CREATE OR REPLACE FUNCTION on_franchise_created()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   ...
--   INSERT INTO inventory_items (franchise_id, product_name, category, unit, cost_price, sale_price, quantity, min_stock)
--   SELECT
--     NEW.evolution_instance_id,
--     p.name,
--     p.category,
--     p.unit,
--     p.default_price,
--     p.default_price * 2,  -- << ADD THIS: sale_price = 100% markup
--     0,
--     p.default_min_stock
--   FROM default_products p;
--   ...
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
