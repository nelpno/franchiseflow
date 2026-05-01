-- Trigger AFTER DELETE em marketing_payments: apaga a despesa auto-gerada (source='marketing_payment').
-- Espelha tr_mkt_generate_expense (BEFORE UPDATE) para manter a invariante:
-- pagamento e despesa nascem juntos e morrem juntos.
-- Idempotente: se a despesa não existir (status era rejected, ou já foi removida), DELETE de 0 linhas.

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_expense_on_marketing_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $func$
BEGIN
  DELETE FROM public.expenses
  WHERE source = 'marketing_payment'
    AND source_id = OLD.id;
  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS tr_mkt_cleanup_expense ON public.marketing_payments;
CREATE TRIGGER tr_mkt_cleanup_expense
  AFTER DELETE ON public.marketing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_expense_on_marketing_delete();

COMMIT;
