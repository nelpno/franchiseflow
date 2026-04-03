-- Migration: Meta CAPI tracking columns
-- Fecha o loop de atribuição Meta Ads → WhatsApp bot → compra
-- Paths reais verificados em 2026-04-02 (execução n8n 2568273):
--   ctwaClid: data.event.Message.extendedTextMessage.contextInfo.ctwaClid
--   externalAdReply: data.event.Message.extendedTextMessage.contextInfo.externalAdReply

-- Colunas de tracking na tabela contacts (first-touch attribution)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_referral_source_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_referral_source_type TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_referral_body TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_referral_at TIMESTAMPTZ;

-- Índice para lookup por ctwa_clid (relatórios de atribuição futuros)
CREATE INDEX IF NOT EXISTS idx_contacts_ctwa_clid ON contacts(ctwa_clid) WHERE ctwa_clid IS NOT NULL;

-- Colunas na tabela sales para rastrear envio CAPI
ALTER TABLE sales ADD COLUMN IF NOT EXISTS capi_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS capi_event_id TEXT;
