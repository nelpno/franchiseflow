-- ============================================
-- PURCHASE ORDERS MIGRATION
-- ============================================

-- 1. purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL REFERENCES franchises(evolution_instance_id),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'em_rota', 'entregue', 'cancelado')),
  total_amount NUMERIC(10,2) DEFAULT 0,
  freight_cost NUMERIC(10,2),
  notes TEXT,
  estimated_delivery DATE,
  ordered_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_franchise ON purchase_orders(franchise_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- 2. purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items(order_id);

-- 3. Trigger: auto-increment stock when order delivered
CREATE OR REPLACE FUNCTION public.on_purchase_order_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    UPDATE inventory_items ii
    SET quantity = ii.quantity + poi.quantity
    FROM purchase_order_items poi
    WHERE poi.order_id = NEW.id
      AND poi.inventory_item_id = ii.id;
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS purchase_order_status_change ON purchase_orders;
CREATE TRIGGER purchase_order_status_change
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION on_purchase_order_delivered();

-- 4. updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON purchase_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. RLS: purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- 6. RLS: purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_select" ON purchase_order_items FOR SELECT USING (
  is_admin() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "poi_insert" ON purchase_order_items FOR INSERT WITH CHECK (
  is_admin() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "poi_update" ON purchase_order_items FOR UPDATE USING (is_admin());
CREATE POLICY "poi_delete" ON purchase_order_items FOR DELETE USING (is_admin());
