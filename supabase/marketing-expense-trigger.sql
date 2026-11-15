-- 1A.1 Migration: marketing_payments idempotency + trigger gera expense ao confirmar
-- Status reais: pending/confirmed/rejected. Sem campo payment_date — usa updated_at.
-- expense_date = primeiro dia do reference_month (yyyy-MM) — despesa cai no mês a que o marketing se refere,
-- não na data em que o admin confirmou. Fallback: updated_at / CURRENT_DATE quando reference_month NULL.

BEGIN;

-- 1. Idempotência
ALTER TABLE public.marketing_payments
  ADD COLUMN IF NOT EXISTS expense_generated_at TIMESTAMPTZ NULL;

-- 2. Função
CREATE OR REPLACE FUNCTION public.generate_expense_from_marketing_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $func$
DECLARE
  v_expense_date DATE;
BEGIN
  IF NEW.status = 'confirmed'
     AND (OLD.status IS NULL OR OLD.status <> 'confirmed')
     AND NEW.expense_generated_at IS NULL THEN

    BEGIN
      v_expense_date := (NEW.reference_month || '-01')::date;
    EXCEPTION WHEN OTHERS THEN
      v_expense_date := NULL;
    END;

    INSERT INTO public.expenses (
      franchise_id, category, supplier, description,
      amount, expense_date, source, source_id, created_by
    ) VALUES (
      NEW.franchise_id, 'marketing', 'Maxi Massas Marketing',
      'Marketing - ' || COALESCE(NEW.reference_month, 'mês não informado'),
      NEW.amount,
      COALESCE(v_expense_date, NEW.updated_at::date, CURRENT_DATE),
      'marketing_payment', NEW.id, NEW.created_by
    );

    NEW.expense_generated_at := NOW();
  END IF;

  RETURN NEW;
END;
$func$;

-- 3. Trigger
DROP TRIGGER IF EXISTS tr_mkt_generate_expense ON public.marketing_payments;
CREATE TRIGGER tr_mkt_generate_expense
  BEFORE UPDATE OF status ON public.marketing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_expense_from_marketing_payment();

COMMIT;
