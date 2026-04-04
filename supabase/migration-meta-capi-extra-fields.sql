-- Migration: Add Meta CAPI intelligence columns to contacts
-- Date: 2026-04-03
-- Purpose: Track ad platform, creative URL, and conversion delay for Meta CAPI attribution

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_source_app TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_media_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meta_conversion_delay_seconds INTEGER;

COMMENT ON COLUMN contacts.meta_source_app IS 'Plataforma de origem do anúncio: facebook ou instagram';
COMMENT ON COLUMN contacts.meta_media_url IS 'URL do criativo (reel/imagem) que gerou o click';
COMMENT ON COLUMN contacts.meta_conversion_delay_seconds IS 'Segundos entre click no anúncio e primeira mensagem';
