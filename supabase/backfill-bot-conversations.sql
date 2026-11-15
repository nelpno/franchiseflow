-- =============================================================================
-- Backfill: vincular vendas bot às conversas + limpar dados
-- Executar UMA VEZ após fix do EnviaPedidoFechado estar em produção
-- =============================================================================

-- 1. Vincular vendas bot existentes às conversas por franchise_id + phone + janela 48h
-- Match rate esperado: ~27% (muitas vendas têm contact_phone NULL)
WITH matched AS (
  SELECT DISTINCT ON (bc.id)
    bc.id as conv_id,
    s.value + COALESCE(s.delivery_fee, 0) as total_value
  FROM bot_conversations bc
  JOIN sales s ON s.source = 'bot'
    AND s.franchise_id = bc.franchise_id
    AND s.contact_phone = bc.contact_phone
    AND s.created_at BETWEEN bc.started_at AND bc.started_at + interval '48 hours'
  WHERE bc.status NOT IN ('converted')
    AND s.contact_phone IS NOT NULL
    AND bc.contact_phone != ''
  ORDER BY bc.id, s.created_at
)
UPDATE bot_conversations bc
SET status = 'converted',
    cart_value = m.total_value,
    converted_at = now(),
    updated_at = now()
FROM matched m
WHERE bc.id = m.conv_id;

-- 2. Deletar registros órfãos (phone vazio, 0 msgs, criados pelo bug do EnviaPedidoFechado)
DELETE FROM bot_conversations
WHERE contact_phone = ''
  AND messages_count = 0
  AND status = 'converted';

-- 3. Fechar conversas stale (>24h sem atividade, status ativo)
UPDATE bot_conversations
SET status = 'abandoned',
    updated_at = now()
WHERE status IN ('started', 'catalog_sent', 'items_discussed', 'checkout_started')
  AND updated_at < now() - interval '24 hours';
