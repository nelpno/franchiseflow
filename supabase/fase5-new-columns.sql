-- ============================================
-- FASE 5: Novos campos estruturados para vendedor genérico
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================

-- Modalidades de operação
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT true;
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS has_pickup BOOLEAN DEFAULT true;
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'own_fleet' CHECK (delivery_method IN ('own_fleet', 'third_party', 'both'));

-- Pagamento separado por modalidade
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS payment_delivery TEXT[] DEFAULT '{}';
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS payment_pickup TEXT[] DEFAULT '{}';

-- Frete estruturado (substitui shipping_rules_costs TEXT)
-- Formato: [{"max_km": 5, "fee": 10}, {"max_km": 10, "fee": 18}]
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS delivery_fee_rules JSONB DEFAULT '[]';

-- Tipo de chave PIX (para o vendedor informar corretamente)
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS pix_key_type TEXT DEFAULT 'cpf' CHECK (pix_key_type IN ('cpf', 'phone', 'email', 'random'));

-- Horário limite para pedidos
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS order_cutoff_time TEXT;

-- Personalidade do vendedor (tom de voz)
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS bot_personality TEXT DEFAULT 'friendly' CHECK (bot_personality IN ('formal', 'friendly', 'casual'));

-- ============================================
-- COMENTÁRIOS para documentação
-- ============================================
COMMENT ON COLUMN franchise_configurations.has_delivery IS 'Se a franquia faz entrega';
COMMENT ON COLUMN franchise_configurations.has_pickup IS 'Se aceita retirada no local';
COMMENT ON COLUMN franchise_configurations.delivery_method IS 'own_fleet=motoboy próprio, third_party=Uber/Flash, both=ambos';
COMMENT ON COLUMN franchise_configurations.payment_delivery IS 'Formas de pagamento aceitas na ENTREGA: pix, payment_link, card_machine, cash';
COMMENT ON COLUMN franchise_configurations.payment_pickup IS 'Formas de pagamento aceitas na RETIRADA: pix, payment_link, card_machine, cash';
COMMENT ON COLUMN franchise_configurations.delivery_fee_rules IS 'Faixas de frete: [{"max_km": 5, "fee": 10.00}]';
COMMENT ON COLUMN franchise_configurations.pix_key_type IS 'Tipo da chave PIX: cpf, phone, email, random';
COMMENT ON COLUMN franchise_configurations.order_cutoff_time IS 'Horário limite para pedidos (ex: "Pedidos até 17h")';
COMMENT ON COLUMN franchise_configurations.bot_personality IS 'Tom de voz do vendedor: formal, friendly, casual';
