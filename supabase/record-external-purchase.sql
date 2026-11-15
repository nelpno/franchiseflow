-- RPC: record_external_purchase
-- Atomic: cria expense + opcionalmente sobe estoque (se tipo=produto)
-- Usado pelo Sheet "Lançar Compra" do TabResultado novo.

CREATE OR REPLACE FUNCTION public.record_external_purchase(
  p_franchise_id TEXT,
  p_type TEXT,                              -- 'produto' | 'embalagem' | 'insumo'
  p_unit_cost NUMERIC,
  p_qty NUMERIC,
  p_supplier TEXT DEFAULT NULL,
  p_expense_date DATE DEFAULT CURRENT_DATE,
  p_inventory_item_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $func$
DECLARE
  v_amount NUMERIC;
  v_category TEXT;
  v_expense_id UUID;
  v_old_qty NUMERIC;
  v_old_cost NUMERIC;
  v_new_qty NUMERIC := NULL;
  v_new_cost NUMERIC := NULL;
BEGIN
  -- ACL: admin/manager OU dono da franquia (consistente com policies de expenses)
  IF NOT (public.is_admin_or_manager() OR p_franchise_id = ANY(public.managed_franchise_ids())) THEN
    RAISE EXCEPTION 'Acesso negado a esta franquia' USING ERRCODE = '42501';
  END IF;

  -- Validações
  IF p_unit_cost IS NULL OR p_unit_cost <= 0 THEN
    RAISE EXCEPTION 'Custo unitário deve ser maior que zero';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  IF p_type NOT IN ('produto', 'embalagem', 'insumo') THEN
    RAISE EXCEPTION 'Tipo inválido: produto, embalagem ou insumo';
  END IF;

  v_category := 'compra_' || p_type;
  v_amount := p_unit_cost * p_qty;

  -- Sobe estoque se for produto
  IF p_type = 'produto' AND p_inventory_item_id IS NOT NULL THEN
    SELECT quantity, cost_price INTO v_old_qty, v_old_cost
      FROM public.inventory_items
     WHERE id = p_inventory_item_id AND franchise_id = p_franchise_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado nesta franquia';
    END IF;

    v_new_qty := COALESCE(v_old_qty, 0) + p_qty;

    -- Custo médio ponderado (proteção div/0 + estoque vazio)
    IF COALESCE(v_old_qty, 0) > 0 AND COALESCE(v_old_cost, 0) > 0 THEN
      v_new_cost := ((v_old_qty * v_old_cost) + (p_qty * p_unit_cost)) / v_new_qty;
    ELSE
      v_new_cost := p_unit_cost;
    END IF;

    UPDATE public.inventory_items
       SET quantity = v_new_qty,
           cost_price = ROUND(v_new_cost, 4),
           updated_at = NOW()
     WHERE id = p_inventory_item_id;
  END IF;

  -- Cria expense
  INSERT INTO public.expenses (
    franchise_id, category, supplier, description,
    amount, expense_date, source, created_by
  ) VALUES (
    p_franchise_id,
    v_category,
    p_supplier,
    COALESCE(p_description,
             'Compra ' || p_type || COALESCE(' - ' || p_supplier, ' externa')),
    v_amount,
    p_expense_date,
    'external_purchase',
    auth.uid()
  )
  RETURNING id INTO v_expense_id;

  RETURN json_build_object(
    'expense_id', v_expense_id,
    'amount', v_amount,
    'inventory_updated', v_new_qty IS NOT NULL,
    'new_quantity', v_new_qty,
    'new_cost_price', v_new_cost
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_external_purchase(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, DATE, UUID, TEXT) TO authenticated;
