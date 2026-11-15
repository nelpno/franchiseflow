-- Tabela de pedidos (franqueado → fábrica)
CREATE TABLE IF NOT EXISTS public.franchise_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'enviado', 'entregue', 'cancelado')),
  items JSONB NOT NULL DEFAULT '[]',
  total_cost NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para pedidos
ALTER TABLE public.franchise_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select ON franchise_orders FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY orders_insert ON franchise_orders FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY orders_update ON franchise_orders FOR UPDATE USING (is_admin());

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON franchise_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index
CREATE INDEX idx_orders_franchise ON franchise_orders(franchise_id, created_at DESC);

-- Funcao: auto-popular estoque quando criar franquia
-- 7d: sale_price = cost_price * 2 (markup 100%)
CREATE OR REPLACE FUNCTION public.auto_populate_inventory(p_franchise_id TEXT)
RETURNS void AS $$
  INSERT INTO inventory_items (franchise_id, product_name, category, quantity, unit, min_stock, cost_price, sale_price)
  SELECT p_franchise_id, name, category, 0, 'un', 3, price, price * 2
  FROM catalog_products
  WHERE active = true;
$$ LANGUAGE sql;

-- Funcao: abater estoque ao registrar venda
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_franchise_id TEXT, p_items JSONB)
RETURNS void AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_name TEXT, quantity NUMERIC)
  LOOP
    UPDATE inventory_items
    SET quantity = GREATEST(quantity - item.quantity, 0),
        updated_at = now()
    WHERE franchise_id = p_franchise_id
      AND product_name = item.product_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
