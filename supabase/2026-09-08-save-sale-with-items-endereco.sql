-- 2026-09-08 — save_sale_with_items passa a gravar o endereco de entrega
--
-- POR QUE
-- Medido em 07/09/2026: das 6.539 entregas dos ultimos 90 dias, 4.362 (66,7%) nao tem
-- endereco em lugar nenhum — nem em sales.customer_address, nem em contacts.endereco.
-- O cupom do motoboy sai sem endereco e ele liga para a franqueada.
--
-- A causa nao era a que o relatorio dizia ("quem escreve e so o robo"). O trigger
-- sales_fill_customer_snapshot JA copia contacts.endereco/bairro para a venda quando o
-- contato tem endereco — 1.393 das 2.001 vendas COM endereco sao manuais, vindas dai.
-- O buraco e anterior: so 1.805 dos 5.526 contatos com entrega tem endereco, porque o
-- SaleForm nunca pediu um.
--
-- E ao ligar o campo no SaleForm apareceu o segundo buraco, este silencioso: esta RPC
-- ENUMERA as colunas que grava e NAO tem customer_address nem customer_neighborhood.
-- Mandar os campos no p_sale_data era no-op — a venda salvava "com sucesso" e o endereco
-- sumia sem erro nenhum.
--
-- O QUE MUDA
-- As duas colunas entram no INSERT e no UPDATE. A chave so e considerada quando VEM no
-- p_sale_data (`p_sale_data ? 'customer_address'`): assim uma venda de retirada, ou um
-- cliente antigo que nao manda o campo, nao apaga o endereco ja gravado. String vazia vira
-- NULL, e ai o trigger BEFORE INSERT/UPDATE cai de volta no endereco do contato — que e o
-- comportamento desejado.
--
-- ROLLBACK
-- Reaplicar a versao anterior, salva em docs/db-backups/save_sale_with_items.antes-2026-09-08.sql
-- (mesma funcao sem as duas colunas). Nenhuma coluna e criada ou removida aqui, entao o
-- rollback e so o CREATE OR REPLACE de volta; os dados gravados no periodo permanecem.

CREATE OR REPLACE FUNCTION public.save_sale_with_items(
  p_sale_id uuid DEFAULT NULL::uuid,
  p_sale_data jsonb DEFAULT '{}'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
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
    INSERT INTO sales (franchise_id, value, contact_id, source, payment_method,
      card_fee_percent, card_fee_amount, fee_passed_to_customer, delivery_method, delivery_fee,
      discount_amount, discount_type, discount_input, net_value, sale_date, observacoes,
      customer_address, customer_neighborhood)
    VALUES (
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
    RETURNING id INTO v_sale_id;
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
$function$;
