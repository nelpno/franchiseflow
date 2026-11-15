-- =============================================================================
-- FEATURE: delivery_schedule — Horários de entrega por dia da semana
--
-- Permite que franqueados configurem horários e taxas de entrega diferentes
-- por grupo de dias (ex: Seg-Sex 06:00-23:00, Sáb 08:00-14:00)
--
-- Estrutura JSONB:
--   [{ days: ["seg","ter",...], delivery_start: "06:00", delivery_end: "23:00",
--      charges_fee: true, fee_rules: [{max_km:"5",fee:"10"}] }]
-- =============================================================================

-- 1. Adicionar coluna
ALTER TABLE franchise_configurations
ADD COLUMN IF NOT EXISTS delivery_schedule JSONB DEFAULT '[]';

-- 2. Migrar dados existentes (campos legados → delivery_schedule)
UPDATE franchise_configurations
SET delivery_schedule = jsonb_build_array(
  jsonb_build_object(
    'days', '["seg","ter","qua","qui","sex","sab","dom"]'::jsonb,
    'delivery_start', COALESCE(delivery_start_time, ''),
    'delivery_end', COALESCE(order_cutoff_time, ''),
    'charges_fee', COALESCE(charges_delivery_fee, true),
    'fee_rules', COALESCE(delivery_fee_rules, '[]'::jsonb)
  )
)
WHERE (delivery_schedule IS NULL OR delivery_schedule = '[]'::jsonb)
  AND (delivery_start_time IS NOT NULL OR order_cutoff_time IS NOT NULL);
