-- RPC: get_abandoned_for_followup
-- Busca conversas abandonadas elegiveis para followup automatico
-- 5 filtros de seguranca anti-banimento
-- Usado pelo Bot Conversation Analyzer workflow

CREATE OR REPLACE FUNCTION get_abandoned_for_followup(
  p_min_age_min INT DEFAULT 30,   -- minimo 30min sem resposta
  p_max_age_min INT DEFAULT 120,  -- maximo 2h (dentro da janela 24h WhatsApp)
  p_cooldown_days INT DEFAULT 7,  -- nao reenviar para mesmo telefone em 7 dias
  p_limit INT DEFAULT 20          -- max por execucao
)
RETURNS TABLE (
  conv_id UUID,
  franchise_id TEXT,
  franchise_name TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  intent TEXT,
  topics TEXT[],
  summary TEXT,
  whatsapp_instance_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id AS conv_id,
    bc.franchise_id,
    COALESCE(fc.franchise_name, bc.franchise_id) AS franchise_name,
    bc.contact_phone,
    COALESCE(bc.contact_name, c.nome, 'cliente') AS contact_name,
    bc.intent,
    bc.topics,
    bc.summary,
    fc.whatsapp_instance_id
  FROM bot_conversations bc
  LEFT JOIN franchise_configurations fc
    ON fc.franchise_evolution_instance_id = bc.franchise_id
  LEFT JOIN contacts c
    ON c.franchise_id = bc.franchise_id
    AND c.telefone = bc.contact_phone
  WHERE
    -- Filtro 1: outcome abandoned
    bc.outcome = 'abandoned'
    -- Filtro 2: nunca recebeu followup
    AND bc.followup_attempts = 0
    -- Filtro 3: sem msg humana (franqueado nao interviu)
    AND NOT EXISTS (
      SELECT 1 FROM conversation_messages cm
      WHERE cm.conversation_id = bc.id
        AND cm.direction = 'human'
    )
    -- Filtro 4: dentro da janela de timing (30min-2h atras)
    AND bc.updated_at < NOW() - (p_min_age_min || ' minutes')::INTERVAL
    AND bc.updated_at > NOW() - (p_max_age_min || ' minutes')::INTERVAL
    -- Filtro 5: cooldown — mesmo telefone nao recebeu followup recentemente
    AND NOT EXISTS (
      SELECT 1 FROM bot_conversations bc2
      WHERE bc2.contact_phone = bc.contact_phone
        AND bc2.franchise_id = bc.franchise_id
        AND bc2.followup_sent_at IS NOT NULL
        AND bc2.followup_sent_at > NOW() - (p_cooldown_days || ' days')::INTERVAL
    )
    -- Seguranca: tem WhatsApp instance configurada
    AND fc.whatsapp_instance_id IS NOT NULL
    -- Seguranca: tem telefone valido
    AND bc.contact_phone IS NOT NULL
    AND bc.contact_phone != ''
    AND LENGTH(bc.contact_phone) >= 10
  ORDER BY bc.updated_at ASC  -- mais antigos primeiro
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_abandoned_for_followup TO service_role;

COMMENT ON FUNCTION get_abandoned_for_followup IS
'Busca conversas abandonadas elegiveis para followup. 5 filtros anti-banimento: abandoned + 0 followups + sem humano + janela 30min-2h + cooldown 7 dias.';
