-- Migration: Add created_by_franchisee column to inventory_items
-- Purpose: Distinguish default catalog items (created by on_franchise_created trigger)
--          from custom items added by franchisees.
-- Controls: Admin edits cost_price of default items (false), franchisee edits their own (true).

ALTER TABLE inventory_items
ADD COLUMN created_by_franchisee BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN inventory_items.created_by_franchisee IS
  'false = item from default catalog (admin-controlled cost_price), true = custom item added by franchisee';

-- All existing items are from the default catalog trigger (on_franchise_created)
UPDATE inventory_items SET created_by_franchisee = false WHERE created_by_franchisee IS NULL;
