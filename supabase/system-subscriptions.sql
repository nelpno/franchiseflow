-- ============================================================
-- system_subscriptions: ASAAS recurring billing per franchise
-- ============================================================

CREATE TABLE IF NOT EXISTS system_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL UNIQUE,          -- evolution_instance_id
  asaas_customer_id TEXT,                     -- cus_xxx
  asaas_subscription_id TEXT,                 -- sub_xxx
  subscription_status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, INACTIVE, EXPIRED
  current_payment_id TEXT,                    -- pay_xxx (latest payment)
  current_payment_status TEXT,                -- PENDING, OVERDUE, PAID, CANCELLED
  current_payment_due_date DATE,
  current_payment_value NUMERIC(10,2) DEFAULT 150.00,
  current_payment_url TEXT,                   -- bankSlipUrl
  pix_payload TEXT,                           -- pix copia e cola
  pix_qr_code_url TEXT,                       -- QR code image URL
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup by asaas IDs
CREATE INDEX IF NOT EXISTS idx_system_subscriptions_asaas_customer
  ON system_subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_system_subscriptions_asaas_subscription
  ON system_subscriptions(asaas_subscription_id);

-- RLS
ALTER TABLE system_subscriptions ENABLE ROW LEVEL SECURITY;

-- Franchisee sees own subscription only
CREATE POLICY "franchisee_select_own" ON system_subscriptions
  FOR SELECT USING (
    is_admin_or_manager()
    OR franchise_id = ANY(managed_franchise_ids())
  );

-- Only admin (service_role via n8n) can write
CREATE POLICY "admin_insert" ON system_subscriptions
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "admin_update" ON system_subscriptions
  FOR UPDATE USING (is_admin());

CREATE POLICY "admin_delete" ON system_subscriptions
  FOR DELETE USING (is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_system_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_system_subscriptions_updated_at
  BEFORE UPDATE ON system_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_system_subscriptions_updated_at();
