-- =============================================================================
-- Conversation Messages - Log de mensagens individuais do bot WhatsApp
-- Fase 1 xLLM: captura de dados para sistema determinístico híbrido
-- =============================================================================

-- Tabela principal
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  conversation_id UUID REFERENCES bot_conversations(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'human')),
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN (
    'text','image','audio','video','document','sticker','location','contact','catalog_response'
  )),
  sub_agent_used TEXT,
  model_used TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  response_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  whatsapp_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice UNIQUE parcial para dedup de eventos LID duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_msg_wa_id
  ON conversation_messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_conv_msg_franchise_created
  ON conversation_messages(franchise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_msg_phone_created
  ON conversation_messages(contact_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_msg_conversation
  ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_msg_direction
  ON conversation_messages(direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_msg_model
  ON conversation_messages(model_used, created_at DESC)
  WHERE model_used IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_msg_sub_agent
  ON conversation_messages(sub_agent_used, created_at DESC)
  WHERE sub_agent_used IS NOT NULL;

-- =============================================================================
-- RLS (mesmo padrão de bot_conversations)
-- =============================================================================

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total (bot n8n escreve via service_role)
CREATE POLICY "conv_msg_service_all" ON conversation_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/manager vê tudo, franqueado vê só as suas
CREATE POLICY "conv_msg_select" ON conversation_messages FOR SELECT USING (
  is_admin_or_manager()
  OR franchise_id = ANY(managed_franchise_ids())
);

-- Delete apenas admin
CREATE POLICY "conv_msg_delete" ON conversation_messages FOR DELETE USING (
  is_admin()
);

-- =============================================================================
-- RPC para logging (chamada pelo sub-workflow n8n)
-- =============================================================================

CREATE OR REPLACE FUNCTION log_conversation_message(
  p_franchise_id TEXT,
  p_phone TEXT,
  p_direction TEXT,
  p_content TEXT DEFAULT NULL,
  p_message_type TEXT DEFAULT 'text',
  p_sub_agent TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_tokens_in INTEGER DEFAULT NULL,
  p_tokens_out INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_wa_message_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_msg_id UUID;
BEGIN
  -- Buscar conversa ativa (mesma lógica de upsert_bot_conversation)
  SELECT id INTO v_conversation_id
  FROM bot_conversations
  WHERE franchise_id = p_franchise_id
    AND contact_phone = p_phone
    AND status NOT IN ('converted', 'abandoned', 'escalated')
    AND started_at > now() - interval '24 hours'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Truncar content a 10K chars para evitar bloat
  INSERT INTO conversation_messages (
    franchise_id, contact_phone, conversation_id,
    direction, content, message_type,
    sub_agent_used, model_used, tokens_in, tokens_out,
    response_time_ms, metadata, whatsapp_message_id
  ) VALUES (
    p_franchise_id,
    p_phone,
    v_conversation_id,
    p_direction,
    LEFT(p_content, 10000),
    p_message_type,
    p_sub_agent,
    p_model,
    p_tokens_in,
    p_tokens_out,
    p_response_time_ms,
    p_metadata,
    p_wa_message_id
  )
  ON CONFLICT (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_conversation_message TO service_role;
