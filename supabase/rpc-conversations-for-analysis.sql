-- RPC: get_conversations_for_analysis (v2)
-- Default 1000 conversas, cabe no Gemini 3.1 Pro (1M context)
-- sale_source incluido para cruzar bot vs manual


CREATE OR REPLACE FUNCTION get_conversations_for_analysis(
  p_start DATE DEFAULT (CURRENT_DATE - INTERVAL '7 days')::DATE,
  p_end DATE DEFAULT CURRENT_DATE,
  p_franchise_id TEXT DEFAULT NULL,
  p_limit INT DEFAULT 1000
)
RETURNS TABLE (
  conversation_id UUID,
  franchise_id TEXT,
  franchise_name TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  contact_purchase_count INT,
  contact_total_spent NUMERIC,
  contact_last_purchase DATE,
  started_at TIMESTAMPTZ,
  status TEXT,
  intent TEXT,
  sentiment TEXT,
  outcome TEXT,
  quality_score SMALLINT,
  llm_abandon_reason TEXT,
  improvement_hint TEXT,
  summary TEXT,
  topics TEXT[],
  tools_used TEXT[],
  sale_value NUMERIC,
  sale_delivery_fee NUMERIC,
  sale_payment_method TEXT,
  sale_source TEXT,
  messages JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH conv_messages AS (
    SELECT
      cm.conversation_id AS conv_id,
      jsonb_agg(
        jsonb_build_object(
          'time', to_char(cm.created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
          'direction', cm.direction,
          'content', LEFT(cm.content, 2000),
          'message_type', cm.message_type,
          'response_time_ms', cm.response_time_ms
        )
        ORDER BY cm.created_at
      ) AS msgs
    FROM conversation_messages cm
    WHERE cm.created_at >= p_start::TIMESTAMPTZ
      AND cm.created_at < (p_end + INTERVAL '1 day')::TIMESTAMPTZ
      AND (p_franchise_id IS NULL OR cm.franchise_id = p_franchise_id)
    GROUP BY cm.conversation_id
  ),
  bot_sales AS (
    SELECT DISTINCT ON (s.franchise_id, s.contact_phone)
      s.franchise_id AS s_franchise_id,
      s.contact_phone AS s_phone,
      s.value AS s_value,
      s.delivery_fee AS s_delivery_fee,
      s.payment_method AS s_payment_method,
      s.source AS s_source
    FROM sales s
    WHERE s.contact_phone IS NOT NULL AND s.contact_phone != ''
      AND s.sale_date >= p_start
      AND s.sale_date <= p_end
      AND (p_franchise_id IS NULL OR s.franchise_id = p_franchise_id)
    ORDER BY s.franchise_id, s.contact_phone, s.created_at DESC
  )
  SELECT
    bc.id AS conversation_id,
    bc.franchise_id,
    COALESCE(fc.franchise_name, bc.franchise_id) AS franchise_name,
    bc.contact_phone,
    COALESCE(bc.contact_name, c.nome) AS contact_name,
    COALESCE(c.purchase_count, 0)::INT AS contact_purchase_count,
    COALESCE(c.total_spent, 0) AS contact_total_spent,
    c.last_purchase_at::DATE AS contact_last_purchase,
    bc.started_at,
    bc.status,
    bc.intent,
    bc.sentiment,
    bc.outcome,
    bc.quality_score,
    bc.llm_abandon_reason,
    bc.improvement_hint,
    bc.summary,
    bc.topics,
    bc.tools_used,
    bs.s_value AS sale_value,
    bs.s_delivery_fee AS sale_delivery_fee,
    bs.s_payment_method AS sale_payment_method,
    bs.s_source AS sale_source,
    COALESCE(cm.msgs, '[]'::JSONB) AS messages
  FROM bot_conversations bc
  LEFT JOIN conv_messages cm ON cm.conv_id = bc.id
  LEFT JOIN franchise_configurations fc
    ON fc.franchise_evolution_instance_id = bc.franchise_id
  LEFT JOIN contacts c
    ON c.franchise_id = bc.franchise_id
    AND c.telefone = bc.contact_phone
  LEFT JOIN bot_sales bs
    ON bs.s_franchise_id = bc.franchise_id
    AND bs.s_phone = bc.contact_phone
  WHERE bc.started_at >= p_start::TIMESTAMPTZ
    AND bc.started_at < (p_end + INTERVAL '1 day')::TIMESTAMPTZ
    AND (p_franchise_id IS NULL OR bc.franchise_id = p_franchise_id)
  ORDER BY
    CASE
      WHEN bc.outcome = 'converted' THEN 1
      WHEN bc.quality_score <= 5 THEN 2
      ELSE 3
    END,
    bc.quality_score ASC NULLS LAST,
    bc.started_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_conversations_for_analysis TO service_role;

COMMENT ON FUNCTION get_conversations_for_analysis IS
'Busca conversas bot com mensagens + contato + vendas para analise LLM. Default 1000 (cabe no Gemini 1M ctx). Usado pela skill /analisar-bot.';
