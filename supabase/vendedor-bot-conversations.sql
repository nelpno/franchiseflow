-- =============================================================================
-- Bot Conversations Tracking
-- Rastreia o funil de conversão do agente vendedor
-- =============================================================================

CREATE TABLE IF NOT EXISTS bot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'started'
    CHECK (status IN ('started','catalog_sent','items_discussed',
                      'checkout_started','converted','abandoned','escalated')),
  cart_value NUMERIC(10,2),
  converted_at TIMESTAMPTZ,
  abandon_reason TEXT,
  followup_attempts INT DEFAULT 0,
  messages_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_franchise ON bot_conversations(franchise_id, started_at);
CREATE INDEX IF NOT EXISTS idx_bot_conv_phone ON bot_conversations(contact_phone, started_at DESC);

ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;

-- Admin ve tudo, franqueado ve so as suas
CREATE POLICY "bot_conv_select" ON bot_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR franchise_id = ANY(
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = auth.uid()
  )
);

-- Service role tem acesso total (para o bot n8n)
CREATE POLICY "bot_conv_service_all" ON bot_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Funcao para upsert de conversa (chamada pelo bot)
CREATE OR REPLACE FUNCTION upsert_bot_conversation(
  p_franchise_id TEXT,
  p_phone TEXT,
  p_status TEXT DEFAULT 'started',
  p_cart_value NUMERIC DEFAULT NULL,
  p_messages_increment INT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Buscar conversa ativa (ultimas 24h, nao finalizada)
  SELECT id INTO v_id
  FROM bot_conversations
  WHERE franchise_id = p_franchise_id
    AND contact_phone = p_phone
    AND status NOT IN ('converted', 'abandoned', 'escalated')
    AND started_at > now() - interval '24 hours'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Atualizar conversa existente
    UPDATE bot_conversations SET
      status = CASE
        WHEN p_status = 'started' THEN status  -- nao regride status
        ELSE p_status
      END,
      cart_value = COALESCE(p_cart_value, cart_value),
      converted_at = CASE WHEN p_status = 'converted' THEN now() ELSE converted_at END,
      messages_count = messages_count + p_messages_increment,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    -- Criar nova conversa
    INSERT INTO bot_conversations (franchise_id, contact_phone, status, cart_value)
    VALUES (p_franchise_id, p_phone, p_status, p_cart_value)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_bot_conversation TO service_role;
