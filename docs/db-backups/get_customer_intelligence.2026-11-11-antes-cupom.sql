CREATE OR REPLACE FUNCTION public.get_customer_intelligence(p_phone text, p_franchise_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact RECORD;
  v_top_products JSON;
  v_preferred_payment TEXT;
  v_segment TEXT;
  v_days_since_last INTEGER;
  v_phone TEXT := public.normalize_phone_br(p_phone);
  v_pedido_aberto JSON;
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

  -- Pedido do cardápio digital em aberto (06/11/2026, PED-97BY): último "#PED-" que o cliente mandou nesta unidade
  -- nas últimas 6 h e no mesmo dia BRT, sem venda criada depois (pelo contato ou pelo telefone). Lido pelo Customer
  -- Context do V5 (bots/vendedor/scripts/assets/pedido-aberto-2026-11-06.mjs).
  SELECT json_build_object(
           'codigo', substring(m.content from '#(PED-[A-Za-z0-9]{2,12})'),
           'minutos', floor(extract(epoch from (now() - m.created_at)) / 60)::int,
           'texto', left(m.content, 2000))
    INTO v_pedido_aberto
    FROM conversation_messages m
   WHERE m.franchise_id = p_franchise_id   -- índice idx_conv_msg_franchise_phonekey (formato do telefone não importa)
     AND public.normalize_phone_key(m.contact_phone) = public.normalize_phone_key(v_phone)
     AND m.direction = 'in'
     AND m.created_at >= now() - interval '6 hours'
     AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND m.content LIKE '%#PED-%'
     AND NOT EXISTS (
       SELECT 1 FROM sales s
        WHERE s.franchise_id = p_franchise_id
          AND s.created_at > m.created_at
          AND (s.contact_id = v_contact.id OR public.normalize_phone_br(s.contact_phone) = v_phone))
   ORDER BY m.created_at DESC
   LIMIT 1;

  RETURN json_build_object(
    'segment', v_segment,
    'nome', v_contact.nome,
    'endereco', v_contact.endereco,
    'bairro', v_contact.bairro,
    'ultima_entrega', (SELECT json_build_object('endereco', s.customer_address, 'bairro', s.customer_neighborhood, 'data', to_char(s.sale_date, 'DD/MM'))
        FROM sales s WHERE s.contact_id = v_contact.id AND s.franchise_id = p_franchise_id AND s.delivery_method = 'delivery'
          AND nullif(btrim(s.customer_address), '') IS NOT NULL
        ORDER BY s.sale_date DESC, s.created_at DESC LIMIT 1),
    'compras', v_contact.purchase_count,
    'total_gasto', ROUND(v_contact.total_spent::numeric, 2),
    'dias_sem_compra', v_days_since_last,
    'favoritos', COALESCE(v_top_products, '[]'::json),
    'pagamento_preferido', v_preferred_payment,
    'pedido_aberto', v_pedido_aberto,
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
END; $function$
;
