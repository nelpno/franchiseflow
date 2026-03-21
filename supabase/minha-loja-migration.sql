-- ============================================
-- MINHA LOJA MIGRATION
-- ============================================

-- 1. inventory_items: add price columns
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

-- 2. sales: add new columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS card_fee_percent NUMERIC(5,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS card_fee_amount NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'retirada';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_value NUMERIC(10,2);

-- 3. sales: expand source CHECK constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE sales ADD CONSTRAINT sales_source_check
  CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'phone_call', 'in_person', 'website', 'other', 'manual', 'bot'));

-- 4. sale_items table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_inventory ON sale_items(inventory_item_id);

-- 5. expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL REFERENCES franchises(evolution_instance_id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_franchise_date ON expenses(franchise_id, expense_date);

-- 5b. Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers: stock management on sale_items
CREATE OR REPLACE FUNCTION public.stock_decrement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS stock_decrement_on_insert ON sale_items;
CREATE TRIGGER stock_decrement_on_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_decrement();

CREATE OR REPLACE FUNCTION public.stock_revert()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.inventory_item_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS stock_revert_on_delete ON sale_items;
CREATE TRIGGER stock_revert_on_delete
  BEFORE DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_revert();

-- 7. updated_at trigger for expenses
DROP TRIGGER IF EXISTS set_updated_at ON expenses;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. RLS: sale_items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_select" ON sale_items FOR SELECT USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT WITH CHECK (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);

-- 9. RLS: expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
