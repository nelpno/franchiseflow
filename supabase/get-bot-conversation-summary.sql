-- get_bot_conversation_summary(p_since)
--
-- Agregados de bot_conversations por franquia × dia para alimentar:
--   - BotSummaryCard (Performance Bot mensal)
--   - AlertsPanel (atividade recente 7d + bot stuck com human msgs)
--   - FranchiseHealthScore (autonomia + conversão por franquia)
--   - healthScore.calcSetupScore (sinal "bot ativo nos últimos 14d")
--
-- Substitui BotConversation.list 90d fetchAll: true (28k rows / 29 round-trips
-- serial / ~20s) por 1 round-trip retornando ~2700 rows agregados.
--
-- FROM vw_bot_conversations: a view exclui status IN ('manual_sale','duplicate_stale')
-- automaticamente — se a view evoluir, o RPC fica auto-sincronizado.
--
-- LEFT JOIN human_convos: CTE materializa subquery uma vez (hash join), evita
-- correlated EXISTS em cada row. Índice idx_conv_msg_direction acelera CTE.

CREATE OR REPLACE FUNCTION public.get_bot_conversation_summary(
  p_since timestamptz DEFAULT (now() - interval '90 days')
)
RETURNS TABLE(
  franchise_id text,
  day date,
  total bigint,
  converted bigint,
  abandoned bigint,
  ongoing bigint,
  autonomous bigint,
  with_human_msgs bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH human_convos AS (
    SELECT DISTINCT cm.conversation_id
    FROM public.conversation_messages cm
    WHERE cm.direction = 'human' AND cm.conversation_id IS NOT NULL
  )
  SELECT
    bc.franchise_id,
    bc.started_at::date AS day,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE bc.outcome = 'converted' OR bc.status = 'converted') AS converted,
    COUNT(*) FILTER (WHERE bc.outcome = 'abandoned' OR bc.status = 'abandoned') AS abandoned,
    COUNT(*) FILTER (
      WHERE bc.outcome = 'ongoing'
      OR (bc.outcome IS NULL AND bc.status = 'started' AND bc.updated_at >= now() - interval '24 hours')
    ) AS ongoing,
    COUNT(*) FILTER (WHERE hc.conversation_id IS NULL) AS autonomous,
    COUNT(*) FILTER (WHERE hc.conversation_id IS NOT NULL) AS with_human_msgs
  FROM public.vw_bot_conversations bc
  LEFT JOIN human_convos hc ON hc.conversation_id = bc.id
  WHERE bc.started_at >= p_since
  GROUP BY bc.franchise_id, bc.started_at::date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bot_conversation_summary(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bot_conversation_summary(timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_bot_conversation_summary IS
  'Agregados de bot_conversations (via vw_bot_conversations) por franquia × dia. Admin/manager only. Substitui BotConversation.list fetchAll do AdminDashboard (28k rows → ~2700 rows agregados).';
