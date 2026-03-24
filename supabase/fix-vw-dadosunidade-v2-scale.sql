-- =============================================================================
-- FIX: vw_dadosunidade — Preparação para escala (todas franquias no V2)
--
-- Problemas resolvidos:
--   1. shipping_rules_costs TEXT vazio → gera automaticamente de delivery_fee_rules JSONB
--   2. accepted_payment_methods TEXT vazio → gera de payment_delivery + payment_pickup TEXT[]
--   3. payment_delivery/payment_pickup com tipo errado (jsonb → text[])
--   4. Telefones sem código de país → campo personal_phone_wa com 55 para WhatsApp API
--   5. delivery_fee_rules retorna JSONB nativo (sem cast ::text)
--   6. social_media_links retorna JSONB nativo
--
-- IMPORTANTE: DROP + CREATE porque CREATE OR REPLACE não permite mudar tipo de coluna
-- =============================================================================

DROP VIEW IF EXISTS vw_dadosunidade;

CREATE VIEW vw_dadosunidade AS
SELECT
  fc.id,
  fc.franchise_evolution_instance_id AS instance_name,
  fc.franchise_evolution_instance_id,
  -- ZuckZapGo instance name (pode diferir do evo_id em franquias legadas)
  -- Fallback: usa evo_id se whatsapp_instance_id não preenchido
  COALESCE(fc.whatsapp_instance_id, fc.franchise_evolution_instance_id) AS zuck_instance_name,

  -- === Dados da unidade ===
  COALESCE(fc.franchise_name, '') AS franchise_name,
  COALESCE(fc.unit_address, '') AS unit_address,
  COALESCE(fc.address_reference, '') AS address_reference,
  COALESCE(fc.city, '') AS city,
  COALESCE(fc.neighborhood, '') AS neighborhood,

  -- === Telefones (11 dígitos, sem 55 — para DB/contacts) ===
  COALESCE(fc.personal_phone_for_summary, '') AS personal_phone_for_summary,

  -- === Telefones WhatsApp (13 dígitos, com 55 — para ZuckZapGo API) ===
  CASE
    WHEN COALESCE(fc.personal_phone_for_summary, '') = '' THEN ''
    WHEN REGEXP_REPLACE(fc.personal_phone_for_summary, '\D', '', 'g') LIKE '55%'
      AND LENGTH(REGEXP_REPLACE(fc.personal_phone_for_summary, '\D', '', 'g')) = 13
    THEN REGEXP_REPLACE(fc.personal_phone_for_summary, '\D', '', 'g')
    ELSE '55' || REGEXP_REPLACE(fc.personal_phone_for_summary, '\D', '', 'g')
  END AS personal_phone_wa,

  -- === Horários (TEXT — wizard salva aqui, NÃO em operating_hours JSONB) ===
  COALESCE(fc.working_days, '') AS working_days,
  COALESCE(fc.opening_hours, '') AS opening_hours,
  COALESCE(fc.order_cutoff_time, '') AS order_cutoff_time,

  -- === Pagamento — campo TEXT legado (GERADO de payment_delivery + payment_pickup se vazio) ===
  -- Prioriza campo antigo se preenchido (backward compat franquias legadas)
  CASE
    WHEN COALESCE(NULLIF(fc.accepted_payment_methods, ''), NULL) IS NOT NULL
    THEN fc.accepted_payment_methods
    WHEN COALESCE(fc.payment_delivery, '{}') != '{}' OR COALESCE(fc.payment_pickup, '{}') != '{}'
    THEN (
      SELECT ARRAY_TO_STRING(
        ARRAY(
          SELECT DISTINCT UNNEST(
            ARRAY_CAT(
              COALESCE(fc.payment_delivery, '{}'::text[]),
              COALESCE(fc.payment_pickup, '{}'::text[])
            )
          )
        ),
        ', '
      )
    )
    ELSE ''
  END AS accepted_payment_methods,

  -- === Pagamento — campos estruturados novos (TEXT[], NÃO JSONB) ===
  COALESCE(fc.payment_delivery, '{}'::text[]) AS payment_delivery,
  COALESCE(fc.payment_pickup, '{}'::text[]) AS payment_pickup,

  -- === Pix ===
  COALESCE(fc.pix_key_type, '') AS pix_key_type,
  COALESCE(fc.pix_key_data, '') AS pix_key_data,
  COALESCE(fc.pix_holder_name, '') AS pix_holder_name,
  COALESCE(fc.pix_bank, '') AS pix_bank,
  COALESCE(fc.payment_link, '') AS payment_link,

  -- === Entrega — config ===
  COALESCE(fc.has_delivery, true) AS has_delivery,
  COALESCE(fc.has_pickup, false) AS has_pickup,
  COALESCE(fc.delivery_method, '') AS delivery_method,
  fc.max_delivery_radius_km,
  fc.min_order_value,
  fc.avg_prep_time_minutes,

  -- === Entrega — regras de frete (JSONB nativo, sem cast ::text) ===
  COALESCE(fc.delivery_fee_rules, '[]'::jsonb) AS delivery_fee_rules,

  -- === Frete — campo TEXT legado (GERADO de delivery_fee_rules se vazio) ===
  -- Formato: "Até 5km: R$10,00 | Até 10km: R$18,00"
  -- Prioriza campo antigo se preenchido (backward compat franquias legadas)
  CASE
    WHEN COALESCE(NULLIF(fc.shipping_rules_costs, ''), NULL) IS NOT NULL
    THEN fc.shipping_rules_costs
    WHEN fc.delivery_fee_rules IS NOT NULL
      AND jsonb_array_length(COALESCE(fc.delivery_fee_rules, '[]'::jsonb)) > 0
    THEN (
      SELECT STRING_AGG(
        'Até ' || (rule->>'max_km') || 'km: R$' ||
        REPLACE(TO_CHAR((rule->>'fee')::numeric, 'FM999G990D00'), '.', ','),
        ' | '
        ORDER BY (rule->>'max_km')::numeric
      )
      FROM jsonb_array_elements(fc.delivery_fee_rules) AS rule
    )
    ELSE ''
  END AS shipping_rules_costs,

  -- === Bot / Vendedor ===
  COALESCE(fc.agent_name, 'Atendente Maxi') AS agent_name,
  COALESCE(fc.bot_personality, 'professional') AS bot_personality,
  COALESCE(fc.welcome_message, '') AS welcome_message,
  COALESCE(fc.promotions_combo, '') AS promotions_combo,

  -- === Catálogo e mídia ===
  COALESCE(fc.price_table_url, '') AS price_table_url,
  COALESCE(fc.catalog_image_url, '') AS catalog_image_url,
  -- JSONB nativo (sem cast ::text) — prompt acessa .instagram
  COALESCE(fc.social_media_links, '{}'::jsonb) AS social_media_links,

  -- === Metadata ===
  fc.updated_at

FROM franchise_configurations fc;

-- === Permissões ===
GRANT SELECT ON vw_dadosunidade TO service_role;
GRANT SELECT ON vw_dadosunidade TO anon;
GRANT SELECT ON vw_dadosunidade TO authenticated;

COMMENT ON VIEW vw_dadosunidade IS
  'View para vendedor genérico n8n (V2 Supabase). '
  'Campos TEXT legados (accepted_payment_methods, shipping_rules_costs) gerados automaticamente dos campos estruturados. '
  'Campo personal_phone_wa inclui código 55 para ZuckZapGo API. '
  'JSONB (delivery_fee_rules, social_media_links) retornados nativos. '
  'TEXT[] (payment_delivery, payment_pickup) com tipo correto. '
  'Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName';
