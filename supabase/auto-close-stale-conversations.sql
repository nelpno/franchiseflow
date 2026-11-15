-- =============================================================================
-- Auto-close stale bot conversations
-- Substitui detecção de abandono que o Analyzer LLM fazia
-- Roda via pg_cron a cada hora
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_close_stale_bot_conversations()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE bot_conversations
  SET status = 'abandoned',
      updated_at = now()
  WHERE status IN ('started', 'catalog_sent', 'items_discussed', 'checkout_started')
    AND updated_at < now() - interval '24 hours';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_close_stale_bot_conversations TO service_role;

-- Agendar execução a cada hora (requer pg_cron habilitado no Supabase)
-- SELECT cron.schedule('auto-close-stale-convs', '0 * * * *', 'SELECT auto_close_stale_bot_conversations()');
