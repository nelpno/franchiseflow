-- Migration: Conferência de Pagamentos
-- Adiciona campos para franqueado marcar vendas como "recebidas"

ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Index para filtro por status de confirmação
CREATE INDEX IF NOT EXISTS idx_sales_payment_confirmed ON sales (franchise_id, payment_confirmed);

COMMENT ON COLUMN sales.payment_confirmed IS 'Franqueado confirmou recebimento do pagamento';
COMMENT ON COLUMN sales.confirmed_at IS 'Timestamp da confirmação de recebimento';
