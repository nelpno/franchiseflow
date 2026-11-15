-- =============================================================================
-- FASE 5 Etapa 2: Migração vendedor genérico n8n (Base44 → Supabase)
-- Executado em 2026-03-21
-- =============================================================================

-- View vw_dadosunidade: retorna dados no formato esperado pelo workflow n8n
-- MANTÉM nomes em inglês para compatibilidade com expressões existentes nos 15+ nós
-- n8n faz: SELECT * FROM vw_dadosunidade WHERE instance_name = 'franquiasaojoao'
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
  COALESCE(fc.delivery_fee_rules::text, '{}') AS delivery_fee_rules,
  COALESCE(fc.shipping_rules_costs, '') AS shipping_rules_costs,
  COALESCE(fc.agent_name, 'Atendente Maxi') AS agent_name,
  COALESCE(fc.bot_personality, 'professional') AS bot_personality,
  COALESCE(fc.welcome_message, '') AS welcome_message,
  COALESCE(fc.promotions_combo, '') AS promotions_combo,
  COALESCE(fc.price_table_url, '') AS price_table_url,
  COALESCE(fc.catalog_image_url, '') AS catalog_image_url,
  COALESCE(fc.social_media_links::text, '{}') AS social_media_links,
  COALESCE(fc.payment_delivery::text, '{}') AS payment_delivery,
  COALESCE(fc.payment_pickup::text, '{}') AS payment_pickup,
  fc.max_delivery_radius_km,
  fc.min_order_value,
  fc.avg_prep_time_minutes,
  COALESCE(fc.order_cutoff_time, '') AS order_cutoff_time,
  COALESCE(fc.city, '') AS city,
  COALESCE(fc.neighborhood, '') AS neighborhood,
  fc.updated_at
FROM franchise_configurations fc;

COMMENT ON VIEW vw_dadosunidade IS
  'View de compatibilidade para vendedor genérico n8n. '
  'Mantém nomes em inglês para backward compat com expressões do workflow. '
  'Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName';

GRANT SELECT ON vw_dadosunidade TO service_role;

-- =============================================================================
-- Tabela daily_unique_contacts (substitui Base44 DailyUniqueContact)
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_unique_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  contact_phone text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(franchise_id, date, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_duc_franchise_date
  ON daily_unique_contacts (franchise_id, date);

ALTER TABLE daily_unique_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON daily_unique_contacts
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON daily_unique_contacts TO service_role;

-- =============================================================================
-- RPCs para o bot vendedor
-- =============================================================================

CREATE OR REPLACE FUNCTION get_contact_by_phone(
  p_franchise_id text,
  p_telefone text
)
RETURNS TABLE (
  id uuid, nome text, telefone text, endereco text,
  bairro text, status text, purchase_count integer,
  total_spent numeric, last_purchase_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro,
         c.status, c.purchase_count, c.total_spent, c.last_purchase_at
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id AND c.telefone = p_telefone
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION upsert_bot_contact(
  p_franchise_id text, p_telefone text, p_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_contact_id uuid;
BEGIN
  SELECT id INTO v_contact_id FROM contacts
  WHERE franchise_id = p_franchise_id AND telefone = p_telefone;

  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts SET last_contact_at = NOW(),
      -- Proteger nome existente: so atualizar se estiver vazio
      nome = CASE
        WHEN contacts.nome IS NULL OR contacts.nome = '' THEN COALESCE(p_nome, '')
        ELSE contacts.nome
      END,
      updated_at = NOW()
    WHERE id = v_contact_id;
    RETURN v_contact_id;
  ELSE
    INSERT INTO contacts (franchise_id, telefone, nome, status, source, last_contact_at)
    VALUES (p_franchise_id, p_telefone, COALESCE(p_nome, ''), 'novo_lead', 'bot', NOW())
    RETURNING id INTO v_contact_id;
    RETURN v_contact_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_contact_address(
  p_contact_id uuid, p_endereco text, p_bairro text DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE contacts SET endereco = p_endereco,
    bairro = COALESCE(p_bairro, contacts.bairro), updated_at = NOW()
  WHERE id = p_contact_id;
$$;

CREATE INDEX IF NOT EXISTS idx_contacts_franchise_telefone
  ON contacts (franchise_id, telefone);

GRANT SELECT ON vw_dadosunidade TO service_role;
GRANT EXECUTE ON FUNCTION get_contact_by_phone TO service_role;
GRANT EXECUTE ON FUNCTION upsert_bot_contact TO service_role;
GRANT EXECUTE ON FUNCTION update_contact_address TO service_role;
