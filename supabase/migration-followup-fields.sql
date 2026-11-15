-- Migration: Adiciona campos de followup em bot_conversations
-- Usado pelo sistema de followup automatico no Bot Conversation Analyzer

ALTER TABLE bot_conversations
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_responded BOOLEAN DEFAULT false;

-- Index para busca eficiente de conversas elegiveis para followup
CREATE INDEX IF NOT EXISTS idx_bot_conv_followup
  ON bot_conversations (outcome, followup_attempts, updated_at)
  WHERE outcome = 'abandoned' AND followup_attempts = 0;

COMMENT ON COLUMN bot_conversations.followup_sent_at IS 'Timestamp de quando o followup automatico foi enviado';
COMMENT ON COLUMN bot_conversations.followup_responded IS 'Se o cliente respondeu apos receber followup';
