-- =============================================================================
-- FIX: vw_dadosunidade — campos JSONB sem cast ::text
-- Problema: social_media_links, payment_delivery, payment_pickup, delivery_fee_rules
--   estavam sendo convertidos para TEXT via ::text, o que faz o n8n receber uma
--   string "{...}" em vez de um objeto JSON. Resultado: .instagram retorna undefined.
-- =============================================================================

CREATE OR REPLACE VIEW vw_dadosunidade AS
SELECT
  fc.id,
  fc.franchise_evolution_instance_id AS instance_name,
  fc.franchise_evolution_instance_id,
  COALESCE(fc.franchise_name, '') AS franchise_name,
  COALESCE(fc.unit_address, '') AS unit_address,
  COALESCE(fc.address_reference, '') AS address_reference,
  COALESCE(fc.personal_phone_for_summary, '') AS personal_phone_for_summary,
  COALESCE(fc.working_days, '') AS working_days,
  COALESCE(fc.opening_hours, '') AS opening_hours,
  COALESCE(fc.accepted_payment_methods, '') AS accepted_payment_methods,
  COALESCE(fc.pix_key_type, '') AS pix_key_type,
  COALESCE(fc.pix_key_data, '') AS pix_key_data,
  COALESCE(fc.pix_holder_name, '') AS pix_holder_name,
  COALESCE(fc.pix_bank, '') AS pix_bank,
  COALESCE(fc.payment_link, '') AS payment_link,
  COALESCE(fc.has_delivery, true) AS has_delivery,
  COALESCE(fc.has_pickup, false) AS has_pickup,
  COALESCE(fc.delivery_method, '') AS delivery_method,
  -- FIX: JSONB sem cast — n8n precisa acessar sub-campos (.instagram, etc.)
  COALESCE(fc.delivery_fee_rules, '[]'::jsonb) AS delivery_fee_rules,
  COALESCE(fc.shipping_rules_costs, '') AS shipping_rules_costs,
  COALESCE(fc.agent_name, 'Atendente Maxi') AS agent_name,
  COALESCE(fc.bot_personality, 'professional') AS bot_personality,
  COALESCE(fc.welcome_message, '') AS welcome_message,
  COALESCE(fc.promotions_combo, '') AS promotions_combo,
  COALESCE(fc.price_table_url, '') AS price_table_url,
  COALESCE(fc.catalog_image_url, '') AS catalog_image_url,
  -- FIX: JSONB sem cast — prompt usa .instagram
  COALESCE(fc.social_media_links, '{}'::jsonb) AS social_media_links,
  -- FIX: JSONB sem cast — podem ser usados em sub-campos futuros
  COALESCE(fc.payment_delivery, '{}'::jsonb) AS payment_delivery,
  COALESCE(fc.payment_pickup, '{}'::jsonb) AS payment_pickup,
  fc.max_delivery_radius_km,
  fc.min_order_value,
  fc.avg_prep_time_minutes,
  COALESCE(fc.order_cutoff_time, '') AS order_cutoff_time,
  COALESCE(fc.city, '') AS city,
  COALESCE(fc.neighborhood, '') AS neighborhood,
  fc.updated_at
FROM franchise_configurations fc;

-- Manter grants
GRANT SELECT ON vw_dadosunidade TO service_role;
GRANT SELECT ON vw_dadosunidade TO anon;
GRANT SELECT ON vw_dadosunidade TO authenticated;

COMMENT ON VIEW vw_dadosunidade IS
  'View de compatibilidade para vendedor genérico n8n. '
  'Mantém nomes em inglês para backward compat com expressões do workflow. '
  'Campos JSONB retornados nativos (sem cast ::text) para acesso a sub-campos. '
  'Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName';
