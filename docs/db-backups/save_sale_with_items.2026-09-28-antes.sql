-- Corpo LIVE de save_sale_with_items em 28/09/2026 antes da S6.2 (md5(prosrc)=aa69bf14813b83625afe6e144b52393f).
-- Voltar = aplicar este arquivo (node supabase/cs-cockpit/_aplica-lf.mjs <este arquivo>).

CREATE OR REPLACE FUNCTION public.save_sale_with_items(p_sale_id uuid DEFAULT NULL::uuid, p_sale_data jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_client_id UUID;
  v_item JSONB;
BEGIN
  IF p_sale_id IS NOT NULL THEN
    UPDATE sales SET
      value = (p_sale_data->>'value')::numeric,
      contact_id = CASE WHEN p_sale_data->>'contact_id' IS NOT NULL AND p_sale_data->>'contact_id' != ''
                        THEN (p_sale_data->>'contact_id')::uuid ELSE NULL END,
      source = COALESCE(p_sale_data->>'source', 'manual'),
      payment_method = p_sale_data->>'payment_method',
      card_fee_percent = (p_sale_data->>'card_fee_percent')::numeric,
      card_fee_amount = (p_sale_data->>'card_fee_amount')::numeric,
      fee_passed_to_customer = NULLIF(p_sale_data->>'fee_passed_to_customer', '')::boolean,
      delivery_method = p_sale_data->>'delivery_method',
      delivery_fee = COALESCE((p_sale_data->>'delivery_fee')::numeric, 0),
      discount_amount = COALESCE((p_sale_data->>'discount_amount')::numeric, 0),
      discount_type = p_sale_data->>'discount_type',
      discount_input = (p_sale_data->>'discount_input')::numeric,
      net_value = (p_sale_data->>'net_value')::numeric,
      sale_date = (p_sale_data->>'sale_date')::date,
      observacoes = p_sale_data->>'observacoes',
      customer_address = CASE WHEN p_sale_data ? 'customer_address'
                              THEN NULLIF(p_sale_data->>'customer_address', '')
                              ELSE sales.customer_address END,
      customer_neighborhood = CASE WHEN p_sale_data ? 'customer_neighborhood'
                                   THEN NULLIF(p_sale_data->>'customer_neighborhood', '')
                                   ELSE sales.customer_neighborhood END
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda % nao encontrada ou sem permissao', p_sale_id;
    END IF;

    DELETE FROM sale_items WHERE sale_id = p_sale_id;
    v_sale_id := p_sale_id;
  ELSE
    v_client_id := NULLIF(p_sale_data->>'client_id', '')::uuid;

    INSERT INTO sales (id, franchise_id, value, contact_id, source, payment_method,
      card_fee_percent, card_fee_amount, fee_passed_to_customer, delivery_method, delivery_fee,
      discount_amount, discount_type, discount_input, net_value, sale_date, observacoes,
      customer_address, customer_neighborhood)
    VALUES (
      COALESCE(v_client_id, gen_random_uuid()),
      p_sale_data->>'franchise_id',
      (p_sale_data->>'value')::numeric,
      CASE WHEN p_sale_data->>'contact_id' IS NOT NULL AND p_sale_data->>'contact_id' != ''
           THEN (p_sale_data->>'contact_id')::uuid ELSE NULL END,
      COALESCE(p_sale_data->>'source', 'manual'),
      p_sale_data->>'payment_method',
      (p_sale_data->>'card_fee_percent')::numeric,
      (p_sale_data->>'card_fee_amount')::numeric,
      NULLIF(p_sale_data->>'fee_passed_to_customer', '')::boolean,
      p_sale_data->>'delivery_method',
      COALESCE((p_sale_data->>'delivery_fee')::numeric, 0),
      COALESCE((p_sale_data->>'discount_amount')::numeric, 0),
      p_sale_data->>'discount_type',
      (p_sale_data->>'discount_input')::numeric,
      (p_sale_data->>'net_value')::numeric,
      (p_sale_data->>'sale_date')::date,
      p_sale_data->>'observacoes',
      NULLIF(p_sale_data->>'customer_address', ''),
      NULLIF(p_sale_data->>'customer_neighborhood', '')
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_sale_id;

    IF v_sale_id IS NULL THEN
      -- Ja gravada numa tentativa anterior: devolve o id, sem duplicar venda nem itens.
      SELECT id INTO v_sale_id FROM sales WHERE id = v_client_id;
      IF v_sale_id IS NULL THEN
        RAISE EXCEPTION 'Venda % nao encontrada ou sem permissao', v_client_id;
      END IF;
      RETURN v_sale_id;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, inventory_item_id, product_name, quantity, unit_price, cost_price)
    VALUES (
      v_sale_id,
      (v_item->>'inventory_item_id')::uuid,
      v_item->>'product_name',
      COALESCE((v_item->>'quantity')::int, 1),
      (v_item->>'unit_price')::numeric,
      (v_item->>'cost_price')::numeric
    );
  END LOOP;

  RETURN v_sale_id;
END;
$function$
;
