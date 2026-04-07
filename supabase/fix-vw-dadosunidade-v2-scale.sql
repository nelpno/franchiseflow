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
--   7. Cast ::numeric em JSONB protegido com NULLIF (empty string → NULL, não crashea)
--   8. Campos numéricos (radius, min_order, prep_time) mantidos NULL se não configurados
--
-- IMPORTANTE: DROP + CREATE porque CREATE OR REPLACE não permite mudar tipo de coluna
-- =============================================================================

DROP VIEW IF EXISTS vw_dadosunidade;

CREATE VIEW vw_dadosunidade
WITH (security_invoker = true)
AS
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
  COALESCE(fc.street_address, '') AS street_address,
  COALESCE(fc.cep, '') AS cep,
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
  COALESCE(fc.delivery_start_time, '') AS delivery_start_time,
  COALESCE(fc.order_cutoff_time, '') AS order_cutoff_time,

  -- === Horários de entrega por dia (JSONB nativo + TEXT gerado para bot) ===
  COALESCE(fc.delivery_schedule, '[]'::jsonb) AS delivery_schedule,

  CASE
    WHEN fc.delivery_schedule IS NOT NULL
      AND fc.delivery_schedule != '[]'::jsonb
      AND jsonb_typeof(fc.delivery_schedule) = 'array'
      AND jsonb_array_length(fc.delivery_schedule) > 0
    THEN (
      SELECT STRING_AGG(
        -- Label dos dias
        COALESCE(
          CASE
            WHEN jsonb_array_length(grp->'days') = 7 THEN 'Todos os dias'
            WHEN jsonb_array_length(grp->'days') = 1 THEN UPPER(LEFT(grp->'days'->>0, 1)) || SUBSTRING(grp->'days'->>0 FROM 2)
            ELSE (
              SELECT STRING_AGG(UPPER(LEFT(d.val, 1)) || SUBSTRING(d.val FROM 2), ', ')
              FROM jsonb_array_elements_text(grp->'days') AS d(val)
            )
          END,
          'Geral'
        ) || ': ' ||
        COALESCE(grp->>'delivery_start', '') || '-' || COALESCE(grp->>'delivery_end', '') ||
        -- Frete info
        CASE
          WHEN (grp->>'charges_fee')::boolean = false THEN ' (frete gratis)'
          WHEN grp->'fee_rules' IS NOT NULL
            AND grp->'fee_rules' != '[]'::jsonb
            AND grp->'fee_rules' != 'null'::jsonb
          THEN ' | Frete: ' ||
            CASE
              WHEN grp->'fee_rules' ? 'mode' AND grp->'fee_rules'->>'mode' = 'modality'
              THEN COALESCE((
                SELECT STRING_AGG(
                  (r->>'label') || ': R$' || REPLACE(TO_CHAR((NULLIF(r->>'fee',''))::numeric, 'FM999G990D00'), '.', ','),
                  ', '
                )
                FROM jsonb_array_elements(grp->'fee_rules'->'rules') r
                WHERE NULLIF(r->>'label','') IS NOT NULL AND NULLIF(r->>'fee','') IS NOT NULL
              ), '')
              ELSE COALESCE((
                SELECT STRING_AGG(
                  'Ate ' || (r->>'max_km') || 'km: R$' || REPLACE(TO_CHAR((NULLIF(r->>'fee',''))::numeric, 'FM999G990D00'), '.', ','),
                  ', '
                  ORDER BY (NULLIF(r->>'max_km',''))::numeric NULLS LAST
                )
                FROM jsonb_array_elements(grp->'fee_rules') r
                WHERE NULLIF(r->>'max_km','') IS NOT NULL AND NULLIF(r->>'fee','') IS NOT NULL
              ), '')
            END
          ELSE ''
        END,
        ' | '
      )
      FROM jsonb_array_elements(fc.delivery_schedule) AS grp
    )
    -- Fallback: campos legados
    ELSE
      CASE
        WHEN COALESCE(fc.delivery_start_time, '') != '' OR COALESCE(fc.order_cutoff_time, '') != ''
        THEN COALESCE(fc.delivery_start_time, '') || '-' || COALESCE(fc.order_cutoff_time, '') ||
          CASE WHEN COALESCE(fc.charges_delivery_fee, true) = false THEN ' (frete gratis)' ELSE '' END
        ELSE ''
      END
  END AS delivery_schedule_text,

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
  COALESCE(fc.charges_delivery_fee, true) AS charges_delivery_fee,
  fc.max_delivery_radius_km,
  fc.min_order_value,
  fc.avg_prep_time_minutes,

  -- === Entrega — regras de frete (JSONB nativo, sem cast ::text) ===
  -- Protege contra formato objeto (mode=modality) que crashea jsonb_array_length
  CASE
    WHEN fc.delivery_fee_rules ? 'mode'
    THEN fc.delivery_fee_rules
    ELSE COALESCE(fc.delivery_fee_rules, '[]'::jsonb)
  END AS delivery_fee_rules,

  -- === Frete — campo TEXT legado (GERADO de delivery_fee_rules se vazio) ===
  -- Formato distância: "Até 5km: R$10,00 | Até 10km: R$18,00"
  -- Formato modalidade: "Entrega programada: R$10,00 | Entrega imediata: R$15,00"
  -- charges_delivery_fee=false → "Entrega grátis"
  -- Prioriza campo antigo se preenchido (backward compat franquias legadas)
  CASE
    WHEN COALESCE(fc.charges_delivery_fee, true) = false
    THEN 'Entrega grátis'
    WHEN COALESCE(NULLIF(fc.shipping_rules_costs, ''), NULL) IS NOT NULL
    THEN fc.shipping_rules_costs
    -- Formato modalidade: { mode: "modality", rules: [{ label, fee }] }
    WHEN fc.delivery_fee_rules ? 'mode'
      AND fc.delivery_fee_rules->>'mode' = 'modality'
    THEN (
      SELECT STRING_AGG(
        (rule->>'label') || ': R$' ||
        REPLACE(TO_CHAR((NULLIF(rule->>'fee', ''))::numeric, 'FM999G990D00'), '.', ','),
        ' | '
      )
      FROM jsonb_array_elements(fc.delivery_fee_rules->'rules') AS rule
      WHERE NULLIF(rule->>'label', '') IS NOT NULL
        AND NULLIF(rule->>'fee', '') IS NOT NULL
    )
    -- Array legado (distância): [{ max_km, fee }]
    WHEN fc.delivery_fee_rules IS NOT NULL
      AND jsonb_array_length(COALESCE(fc.delivery_fee_rules, '[]'::jsonb)) > 0
    THEN (
      SELECT STRING_AGG(
        'Até ' || (rule->>'max_km') || 'km: R$' ||
        REPLACE(TO_CHAR((NULLIF(rule->>'fee', ''))::numeric, 'FM999G990D00'), '.', ','),
        ' | '
        ORDER BY (NULLIF(rule->>'max_km', ''))::numeric NULLS LAST
      )
      FROM jsonb_array_elements(fc.delivery_fee_rules) AS rule
      WHERE NULLIF(rule->>'max_km', '') IS NOT NULL
        AND NULLIF(rule->>'fee', '') IS NOT NULL
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

  -- === Horário de retirada (separado da entrega) ===
  COALESCE(fc.has_custom_pickup_hours, false) AS has_custom_pickup_hours,
  COALESCE(fc.pickup_schedule, '[]'::jsonb) AS pickup_schedule,

  -- pickup_hours_text: texto legível de horários de retirada para o bot
  CASE
    WHEN fc.has_custom_pickup_hours = true
      AND fc.pickup_schedule IS NOT NULL
      AND fc.pickup_schedule != '[]'::jsonb
      AND jsonb_typeof(fc.pickup_schedule) = 'array'
      AND jsonb_array_length(fc.pickup_schedule) > 0
    THEN (
      SELECT STRING_AGG(
        COALESCE(
          CASE
            WHEN jsonb_array_length(grp->'days') = 7 THEN 'Todos os dias'
            WHEN jsonb_array_length(grp->'days') = 1 THEN UPPER(LEFT(grp->'days'->>0, 1)) || SUBSTRING(grp->'days'->>0 FROM 2)
            ELSE (
              SELECT STRING_AGG(UPPER(LEFT(d.val, 1)) || SUBSTRING(d.val FROM 2), ', ')
              FROM jsonb_array_elements_text(grp->'days') AS d(val)
            )
          END,
          'Geral'
        ) || ': ' || COALESCE(grp->>'open', '') || '-' || COALESCE(grp->>'close', ''),
        ' | '
      )
      FROM jsonb_array_elements(fc.pickup_schedule) AS grp
    )
    WHEN COALESCE(fc.has_pickup, false) = true THEN COALESCE(fc.opening_hours, '')
    ELSE NULL
  END AS pickup_hours_text,

  -- === Meta CAPI — per-franchise tracking ===
  COALESCE(fc.facebook_page_id, '') AS facebook_page_id,
  COALESCE(fc.whatsapp_business_account_id, '') AS whatsapp_business_account_id,
  COALESCE(fc.meta_dataset_id, '') AS meta_dataset_id,

  -- === Retirada agendada ===
  COALESCE(fc.pickup_requires_scheduling, true) AS pickup_requires_scheduling,

  -- === Metadata ===
  fc.updated_at

FROM franchise_configurations fc;

-- === Permissões ===
GRANT SELECT ON vw_dadosunidade TO service_role;
GRANT SELECT ON vw_dadosunidade TO anon;
GRANT SELECT ON vw_dadosunidade TO authenticated;

COMMENT ON VIEW vw_dadosunidade IS
  'View para vendedor genérico n8n (V3 Supabase). '
  'Campos TEXT legados (accepted_payment_methods, shipping_rules_costs) gerados automaticamente dos campos estruturados. '
  'Campo personal_phone_wa inclui código 55 para ZuckZapGo API. '
  'JSONB (delivery_fee_rules, delivery_schedule, social_media_links) retornados nativos. '
  'delivery_schedule_text gera texto legível de horários/frete por dia para o bot. '
  'TEXT[] (payment_delivery, payment_pickup) com tipo correto. '
  'Meta CAPI: facebook_page_id, whatsapp_business_account_id, meta_dataset_id para tracking por franquia. '
  'Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName';
