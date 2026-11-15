-- Add payment_fees JSONB to franchise_configurations
-- Stores per-method fee percentages: {"pix": 0, "card_machine": 3.30, "payment_link": 4.99, "cash": 0}
-- NULL = use legacy fixed card_fee_percent from each sale (backward compatible)

ALTER TABLE franchise_configurations
  ADD COLUMN IF NOT EXISTS payment_fees JSONB DEFAULT NULL;

COMMENT ON COLUMN franchise_configurations.payment_fees IS 'Per-payment-method fee percentages. Keys match PAYMENT_METHODS values. NULL = legacy fixed fee.';
