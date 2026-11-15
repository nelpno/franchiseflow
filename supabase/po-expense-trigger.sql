-- 1A.1 Migration: purchase_orders idempotency + trigger gera expenses ao marcar entregue
-- Adiciona expenses_generated_at + função + trigger BEFORE UPDATE

BEGIN;

-- 1. Idempotência
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS expenses_generated_at TIMESTAMPTZ NULL;

-- 2. Função: ao mudar status para 'entregue', gera 2 expenses (compra_produto + transporte)
CREATE OR REPLACE FUNCTION public.generate_expenses_from_purchase_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $func$
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
$func$;

-- 3. Trigger
DROP TRIGGER IF EXISTS tr_po_generate_expenses ON public.purchase_orders;
CREATE TRIGGER tr_po_generate_expenses
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_expenses_from_purchase_order();

COMMIT;
