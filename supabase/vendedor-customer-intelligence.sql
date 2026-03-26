-- ============================================================================
-- get_customer_intelligence(p_phone, p_franchise_id)
-- ============================================================================
-- RPC usada pelo vendedor genérico (n8n) para obter inteligência sobre o
-- cliente antes de responder no WhatsApp.
--
-- Retorna JSON com: segmento (novo/lead/cliente/recorrente/vip/dormindo),
-- nome, endereço, bairro, histórico de compras, produtos favoritos (top 3
-- dos últimos 90 dias), método de pagamento preferido e um resumo textual
-- pronto para o prompt do agente IA.
--
-- SECURITY DEFINER — executa com permissões do owner (bypassa RLS).
-- GRANT apenas para service_role (chamado via n8n, nunca pelo frontend).
--
-- Criado em: 2026-03-26
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customer_intelligence(
  p_phone TEXT,
  p_franchise_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_top_products JSON;
  v_preferred_payment TEXT;
  v_segment TEXT;
  v_days_since_last INTEGER;
BEGIN
  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro,
         c.status, c.purchase_count, c.total_spent,
         c.last_purchase_at, c.last_contact_at
  INTO v_contact
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id AND c.telefone = p_phone
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
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_intelligence TO service_role;
