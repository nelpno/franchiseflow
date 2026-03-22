-- =============================================================================
-- FASE 5 Etapa 2: View de compatibilidade para vendedor genérico n8n
-- Mapeia franchise_configurations → formato que o Agent IA espera (dadosunidade)
-- =============================================================================

-- View vw_dadosunidade: retorna dados da franquia no formato esperado pelo bot
-- O n8n faz: SELECT * FROM vw_dadosunidade WHERE instance_name = 'franquiasaojoao'
CREATE OR REPLACE VIEW vw_dadosunidade AS
SELECT
  fc.id,
  fc.franchise_evolution_instance_id AS instance_name,

  -- Dados da unidade
  COALESCE(fc.franchise_name, '') AS nome_unidade,
  COALESCE(fc.unit_address, '') AS endereco,
  COALESCE(fc.address_reference, '') AS referencia_endereco,
  COALESCE(fc.personal_phone_for_summary, '') AS telefone_pessoal,
  COALESCE(fc.city, '') AS cidade,
  COALESCE(fc.neighborhood, '') AS bairro,

  -- Horários
  COALESCE(fc.working_days, '') AS dias_funcionamento,
  COALESCE(fc.opening_hours, '') AS horarios_funcionamento,

  -- Pagamento (accepted_payment_methods é text, não array)
  COALESCE(fc.accepted_payment_methods, '') AS metodos_pagamento,
  COALESCE(fc.pix_key_type, '') AS tipo_chave_pix,
  COALESCE(fc.pix_key_data, '') AS chave_pix,
  COALESCE(fc.pix_holder_name, '') AS titular_pix,
  COALESCE(fc.pix_bank, '') AS banco_pix,
  COALESCE(fc.payment_link, '') AS link_pagamento,
  COALESCE(fc.payment_delivery::text, '{}') AS pagamento_entrega,
  COALESCE(fc.payment_pickup::text, '{}') AS pagamento_retirada,

  -- Entrega
  COALESCE(fc.has_delivery, true) AS tem_entrega,
  COALESCE(fc.has_pickup, false) AS tem_retirada,
  COALESCE(fc.delivery_method, '') AS metodo_entrega,
  COALESCE(fc.delivery_fee_rules::text, '{}') AS regras_frete,
  COALESCE(fc.shipping_rules_costs, '') AS custos_frete_texto,
  fc.max_delivery_radius_km AS raio_maximo_km,
  fc.min_order_value AS pedido_minimo,
  fc.avg_prep_time_minutes AS tempo_preparo_minutos,
  COALESCE(fc.order_cutoff_time, '') AS horario_corte_pedido,

  -- Vendedor / Bot
  COALESCE(fc.agent_name, 'Atendente Maxi') AS nome_vendedor,
  COALESCE(fc.bot_personality, 'professional') AS personalidade_bot,
  COALESCE(fc.welcome_message, '') AS mensagem_boas_vindas,
  COALESCE(fc.promotions_combo, '') AS promocoes,
  COALESCE(fc.price_table_url, '') AS url_cardapio,
  COALESCE(fc.catalog_image_url, '') AS url_catalogo_imagem,
  COALESCE(fc.social_media_links::text, '{}') AS redes_sociais,

  -- Metadata
  fc.updated_at

FROM franchise_configurations fc;

-- Comentário na view
COMMENT ON VIEW vw_dadosunidade IS
  'View de compatibilidade para vendedor genérico n8n. '
  'Mapeia franchise_configurations para formato esperado pelo Agent IA. '
  'Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName';

-- =============================================================================
-- RPC: buscar contato por telefone (otimizado para o bot)
-- Retorna contato existente ou NULL, evitando lógica complexa no n8n
-- =============================================================================

CREATE OR REPLACE FUNCTION get_contact_by_phone(
  p_franchise_id text,
  p_telefone text
)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  endereco text,
  bairro text,
  status text,
  purchase_count integer,
  total_spent numeric,
  last_purchase_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    c.id,
    c.nome,
    c.telefone,
    c.endereco,
    c.bairro,
    c.status,
    c.purchase_count,
    c.total_spent,
    c.last_purchase_at
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id
    AND c.telefone = p_telefone
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_contact_by_phone IS
  'Busca contato por franchise_id + telefone para o bot vendedor. '
  'Retorna dados incluindo endereço (cache GetDistance) e histórico de compras.';

-- =============================================================================
-- RPC: criar ou atualizar contato (upsert para o bot)
-- Bot chama isso quando recebe mensagem — cria se não existe, atualiza last_contact
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_bot_contact(
  p_franchise_id text,
  p_telefone text,
  p_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  -- Tenta encontrar contato existente
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE franchise_id = p_franchise_id
    AND telefone = p_telefone;

  IF v_contact_id IS NOT NULL THEN
    -- Atualiza last_contact_at e nome (se fornecido)
    UPDATE contacts
    SET
      last_contact_at = NOW(),
      nome = COALESCE(p_nome, contacts.nome),
      updated_at = NOW()
    WHERE id = v_contact_id;

    RETURN v_contact_id;
  ELSE
    -- Cria novo contato
    INSERT INTO contacts (franchise_id, telefone, nome, status, source, last_contact_at)
    VALUES (p_franchise_id, p_telefone, COALESCE(p_nome, ''), 'novo_lead', 'bot', NOW())
    RETURNING id INTO v_contact_id;

    RETURN v_contact_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_bot_contact IS
  'Cria ou atualiza contato via bot WhatsApp. '
  'Se contato existe: atualiza last_contact_at e nome. '
  'Se não existe: cria com status=novo_lead, source=bot.';

-- =============================================================================
-- RPC: atualizar endereço do contato (cache para GetDistance)
-- Bot salva endereço quando cliente informa, evita perguntar de novo
-- =============================================================================

CREATE OR REPLACE FUNCTION update_contact_address(
  p_contact_id uuid,
  p_endereco text,
  p_bairro text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE contacts
  SET
    endereco = p_endereco,
    bairro = COALESCE(p_bairro, contacts.bairro),
    updated_at = NOW()
  WHERE id = p_contact_id;
$$;

COMMENT ON FUNCTION update_contact_address IS
  'Salva endereço do contato para cache GetDistance. '
  'Próxima conversa: bot usa endereço salvo sem perguntar novamente.';

-- =============================================================================
-- Índice para busca por telefone (performance do bot)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_franchise_telefone
  ON contacts (franchise_id, telefone);

-- =============================================================================
-- Grant para service_role (n8n usa service role key)
-- =============================================================================

GRANT SELECT ON vw_dadosunidade TO service_role;
GRANT EXECUTE ON FUNCTION get_contact_by_phone TO service_role;
GRANT EXECUTE ON FUNCTION upsert_bot_contact TO service_role;
GRANT EXECUTE ON FUNCTION update_contact_address TO service_role;
