-- Feature: Taxa de cartao repassada ao cliente (2026-05-15)
-- Aplicada em producao via Supabase MCP apply_migration "add_card_fee_passthrough_2026_05_15_v2"
--
-- O que faz:
--   - franchise_configurations.charges_card_fee_to_customer: default da franquia.
--     Bot vendedor SEMPRE respeita. Caixa manual permite override por venda.
--   - sales.fee_passed_to_customer: override opcional por venda (NULL = usa default).
--   - vw_dadosunidade: expoe charges_card_fee_to_customer + payment_fees ao bot.
--   - save_sale_with_items: aceita fee_passed_to_customer via NULLIF cast (anti-crash em ''::boolean).

ALTER TABLE franchise_configurations
  ADD COLUMN IF NOT EXISTS charges_card_fee_to_customer BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN franchise_configurations.charges_card_fee_to_customer
IS 'Default da franquia: se true, taxa de cartao e SOMADA ao total do cliente (bot vendedor sempre respeita; caixa manual permite override via sales.fee_passed_to_customer).';

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS fee_passed_to_customer BOOLEAN;

COMMENT ON COLUMN sales.fee_passed_to_customer
IS 'NULL = usa default da franquia (charges_card_fee_to_customer). true/false = override desta venda especifica.';

-- View vw_dadosunidade: ver fix-vw-dadosunidade-v2-scale.sql para definicao base.
-- Esta migration adicionou 2 cols ao FINAL (CREATE OR REPLACE VIEW nao permite reorder):
--   COALESCE(payment_fees, '{}'::jsonb) AS payment_fees,
--   COALESCE(charges_card_fee_to_customer, false) AS charges_card_fee_to_customer

-- RPC save_sale_with_items: ver rpc-save-sale-with-items.sql para definicao base.
-- Esta migration adicionou em UPDATE e INSERT:
--   fee_passed_to_customer = NULLIF(p_sale_data->>'fee_passed_to_customer', '')::boolean
