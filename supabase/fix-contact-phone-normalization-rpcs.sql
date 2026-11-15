-- =============================================================================
-- Normalizacao estrutural de telefone: helper + RPCs (Fase 3 do plano)
-- =============================================================================
-- Canoniza formato de telefone em contacts/bot_conversations/conversation_messages:
-- - strip caracteres nao-digitos
-- - remove DDI 55 quando presente (length >= 12 + left(2) = '55')
-- - retorna NULL para entrada vazia/NULL (nao grava '')
--
-- Preserva comportamento externo de todas as RPCs. Apenas normaliza o
-- parametro de entrada (p_phone / p_telefone) antes de comparar/gravar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper reutilizavel (IMMUTABLE + PARALLEL SAFE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone_br(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = 'public'
AS $$
DECLARE d text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p, '\D', '', 'g');
  IF length(d) >= 12 AND left(d, 2) = '55' THEN
    d := substring(d from 3);
  END IF;
  RETURN NULLIF(d, '');
END; $$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_br(text) TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. get_contact_by_phone: delegar normalizacao ao helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_by_phone(p_franchise_id text, p_telefone text)
RETURNS TABLE(
  id uuid, nome text, telefone text, endereco text, bairro text,
  status text, purchase_count integer, total_spent numeric,
  last_purchase_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_phone text := public.normalize_phone_br(p_telefone);
BEGIN
  IF v_phone IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro,
         c.status, c.purchase_count, c.total_spent, c.last_purchase_at
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id AND c.telefone = v_phone;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_contact_by_phone(text, text) TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. upsert_bot_contact: normalizar antes do SELECT e do INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bot_contact(
  p_franchise_id text,
  p_telefone text,
  p_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact_id uuid;
  v_phone text := public.normalize_phone_br(p_telefone);
BEGIN
  IF v_phone IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_contact_id FROM contacts
  WHERE franchise_id = p_franchise_id AND telefone = v_phone;

  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_at = NOW(),
        nome = CASE
          WHEN contacts.nome IS NULL OR contacts.nome = '' THEN COALESCE(p_nome, '')
          ELSE contacts.nome
        END,
        updated_at = NOW()
    WHERE id = v_contact_id;
    RETURN v_contact_id;
  ELSE
    INSERT INTO contacts (franchise_id, telefone, nome, status, source, last_contact_at)
    VALUES (p_franchise_id, v_phone, COALESCE(p_nome, ''), 'novo_lead', 'bot', NOW())
    RETURNING id INTO v_contact_id;
    RETURN v_contact_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.upsert_bot_contact(text, text, text) TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. get_customer_intelligence: normalizar p_phone no lookup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_intelligence(p_phone text, p_franchise_id text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact RECORD;
  v_top_products JSON;
  v_preferred_payment TEXT;
  v_segment TEXT;
  v_days_since_last INTEGER;
  v_phone TEXT := public.normalize_phone_br(p_phone);
BEGIN
  IF v_phone IS NULL THEN
    RETURN json_build_object(
      'segment', 'novo',
      'resumo', 'Primeiro contato. Apresentar-se, enviar catalogo.'
    );
  END IF;

  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro,
         c.status, c.purchase_count, c.total_spent,
         c.last_purchase_at, c.last_contact_at, c.created_at
  INTO v_contact
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id AND c.telefone = v_phone
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN json_build_object(
      'segment', 'novo',
      'resumo', 'Primeiro contato. Apresentar-se, enviar catalogo.'
    );
  END IF;

  v_days_since_last := EXTRACT(DAY FROM now() -
    COALESCE(v_contact.last_purchase_at, v_contact.last_contact_at, now()))::integer;

  v_segment := CASE
    WHEN v_contact.purchase_count >= 5 THEN 'vip'
    WHEN v_contact.purchase_count >= 2 AND v_days_since_last <= 30 THEN 'recorrente'
    WHEN v_contact.purchase_count >= 1 AND v_days_since_last > 30 THEN 'dormindo'
    WHEN v_contact.purchase_count = 0
         AND v_contact.created_at >= now() - interval '2 minutes' THEN 'novo'
    WHEN v_contact.purchase_count = 0 THEN 'lead'
    ELSE 'cliente'
  END;

  SELECT json_agg(sub) INTO v_top_products FROM (
    SELECT ii.product_name, SUM(si.quantity)::int AS total_qty
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN inventory_items ii ON ii.id = si.inventory_item_id
    WHERE s.contact_id = v_contact.id
      AND s.sale_date >= CURRENT_DATE - 90
    GROUP BY ii.product_name
    ORDER BY total_qty DESC LIMIT 3
  ) sub;

  SELECT s.payment_method INTO v_preferred_payment
  FROM sales s WHERE s.contact_id = v_contact.id
    AND s.payment_method IS NOT NULL
  GROUP BY s.payment_method ORDER BY COUNT(*) DESC LIMIT 1;

  RETURN json_build_object(
    'segment', v_segment,
    'nome', v_contact.nome,
    'endereco', v_contact.endereco,
    'bairro', v_contact.bairro,
    'compras', v_contact.purchase_count,
    'total_gasto', ROUND(v_contact.total_spent::numeric, 2),
    'dias_sem_compra', v_days_since_last,
    'favoritos', COALESCE(v_top_products, '[]'::json),
    'pagamento_preferido', v_preferred_payment,
    'resumo', CASE v_segment
      WHEN 'novo' THEN 'Primeiro contato. Apresentar-se, enviar catalogo.'
      WHEN 'lead' THEN v_contact.nome || ' ja conversou mas nunca comprou. Descobrir objecao.'
      WHEN 'vip' THEN 'VIP! ' || v_contact.nome || ', ' || v_contact.purchase_count
        || ' compras (R$ ' || ROUND(v_contact.total_spent::numeric,0) || '). Prioridade maxima.'
      WHEN 'recorrente' THEN 'Recorrente ativo: ' || v_contact.nome || '. Sugerir repetir pedido.'
      WHEN 'dormindo' THEN 'Ausente ha ' || v_days_since_last || ' dias ('
        || v_contact.nome || '). Reativar com novidades.'
      ELSE v_contact.nome || '. ' || v_contact.purchase_count || ' compra(s).'
    END
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_customer_intelligence(text, text) TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. log_conversation_message: normalizar p_phone no SELECT e nos INSERTs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_conversation_message(
  p_franchise_id text,
  p_phone text,
  p_direction text,
  p_content text DEFAULT NULL,
  p_message_type text DEFAULT 'text',
  p_sub_agent text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_tokens_in integer DEFAULT NULL,
  p_tokens_out integer DEFAULT NULL,
  p_response_time_ms integer DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_wa_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_conversation_id UUID;
  v_last_activity TIMESTAMPTZ;
  v_msg_id UUID;
  v_phone TEXT := public.normalize_phone_br(p_phone);
BEGIN
  IF v_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- Buscar conversa ativa: mesma franquia+telefone, nao finalizada
  SELECT id, updated_at INTO v_conversation_id, v_last_activity
  FROM bot_conversations
  WHERE franchise_id = p_franchise_id
    AND contact_phone = v_phone
    AND status NOT IN ('converted', 'abandoned', 'escalated')
    AND started_at > now() - interval '24 hours'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Se encontrou mas ultima atividade > 2h, criar NOVA conversa
  IF v_conversation_id IS NOT NULL AND v_last_activity < now() - interval '2 hours' THEN
    v_conversation_id := NULL;
  END IF;

  -- Se nao encontrou conversa ativa, criar uma
  IF v_conversation_id IS NULL THEN
    INSERT INTO bot_conversations (franchise_id, contact_phone, status, started_at, messages_count)
    VALUES (p_franchise_id, v_phone, 'started', now(), 0)
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Inserir mensagem (dedup por whatsapp_message_id)
  INSERT INTO conversation_messages (
    franchise_id, contact_phone, conversation_id,
    direction, content, message_type,
    sub_agent_used, model_used, tokens_in, tokens_out,
    response_time_ms, metadata, whatsapp_message_id
  ) VALUES (
    p_franchise_id, v_phone, v_conversation_id,
    p_direction, LEFT(p_content, 10000), p_message_type,
    p_sub_agent, p_model, p_tokens_in, p_tokens_out,
    p_response_time_ms, p_metadata, p_wa_message_id
  )
  ON CONFLICT (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_msg_id;

  -- Incrementar messages_count e atualizar timestamp
  IF v_msg_id IS NOT NULL THEN
    UPDATE bot_conversations
    SET messages_count = messages_count + 1,
        updated_at = now()
    WHERE id = v_conversation_id;
  END IF;

  RETURN v_msg_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.log_conversation_message(text, text, text, text, text, text, text, integer, integer, integer, jsonb, text) TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. get_abandoned_for_followup: normalizar ambos os lados dos joins
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_abandoned_for_followup(
  p_min_age_min integer DEFAULT 30,
  p_max_age_min integer DEFAULT 120,
  p_cooldown_days integer DEFAULT 7,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  conv_id uuid, franchise_id text, franchise_name text,
  contact_phone text, contact_name text, intent text,
  topics text[], summary text, whatsapp_instance_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    AND c.telefone = public.normalize_phone_br(bc.contact_phone)
  WHERE
    bc.outcome = 'abandoned'
    AND bc.followup_attempts = 0
    AND NOT EXISTS (
      SELECT 1 FROM conversation_messages cm
      WHERE cm.conversation_id = bc.id
        AND cm.direction = 'human'
    )
    AND bc.updated_at < NOW() - (p_min_age_min || ' minutes')::INTERVAL
    AND bc.updated_at > NOW() - (p_max_age_min || ' minutes')::INTERVAL
    AND NOT EXISTS (
      SELECT 1 FROM bot_conversations bc2
      WHERE public.normalize_phone_br(bc2.contact_phone) = public.normalize_phone_br(bc.contact_phone)
        AND bc2.franchise_id = bc.franchise_id
        AND bc2.followup_sent_at IS NOT NULL
        AND bc2.followup_sent_at > NOW() - (p_cooldown_days || ' days')::INTERVAL
    )
    AND NOT EXISTS (
      SELECT 1 FROM sales s
      JOIN contacts ct
        ON ct.id = s.contact_id
        AND ct.franchise_id = s.franchise_id
      WHERE ct.telefone = public.normalize_phone_br(bc.contact_phone)
        AND s.franchise_id = bc.franchise_id
        AND s.created_at > NOW() - INTERVAL '48 hours'
    )
    AND fc.whatsapp_instance_id IS NOT NULL
    AND bc.contact_phone IS NOT NULL
    AND bc.contact_phone != ''
    AND LENGTH(regexp_replace(bc.contact_phone, '\D', '', 'g')) >= 10
  ORDER BY bc.updated_at ASC
  LIMIT p_limit;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_abandoned_for_followup(integer, integer, integer, integer) TO PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- Testes de sanidade (executar apos apply)
-- =============================================================================
-- SELECT public.normalize_phone_br('5511963641252');    -- 11963641252
-- SELECT public.normalize_phone_br('(11) 98765-4321');  -- 11987654321
-- SELECT public.normalize_phone_br('11963641252');      -- 11963641252
-- SELECT public.normalize_phone_br('');                 -- NULL
-- SELECT public.normalize_phone_br(NULL);               -- NULL
-- SELECT public.normalize_phone_br('+55 11 98765-4321'); -- 11987654321
