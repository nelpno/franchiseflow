-- Backup do corpo VIVO antes da S15 (28/09/2026), tirado por pg_get_functiondef.
-- md5(prosrc) em produção = aed704aa9a8724a5bbc9ca193cde6f99
-- Reaplicar este arquivo = voltar a função ao estado de antes da S15.
CREATE OR REPLACE FUNCTION public.generate_expenses_from_purchase_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_cost NUMERIC := 0;
  v_freight NUMERIC := 0;
  v_po_short TEXT;
  v_delivered_date DATE;
BEGIN
  -- Só dispara quando muda PARA 'entregue' E ainda não gerou (idempotente)
  IF NEW.status = 'entregue'
     AND (OLD.status IS NULL OR OLD.status <> 'entregue')
     AND NEW.expenses_generated_at IS NULL THEN

    SELECT COALESCE(SUM(unit_price * quantity), 0)
      INTO v_total_cost
      FROM public.purchase_order_items
     WHERE order_id = NEW.id;

    v_freight := COALESCE(NEW.freight_cost, 0);
    v_po_short := substring(NEW.id::text from 1 for 8);
    v_delivered_date := COALESCE(NEW.delivered_at::date, CURRENT_DATE);

    -- Expense compra_produto
    IF v_total_cost > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id, 'compra_produto', 'Maxi Massas',
        'Pedido #' || v_po_short || ' - Maxi Massas',
        v_total_cost, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    -- Expense transporte (frete)
    IF v_freight > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id, 'transporte', 'Maxi Massas',
        'Frete pedido #' || v_po_short,
        v_freight, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    -- Marca como gerado (BEFORE UPDATE, pode setar NEW direto)
    NEW.expenses_generated_at := NOW();
  END IF;

  RETURN NEW;
END;
$function$
;
