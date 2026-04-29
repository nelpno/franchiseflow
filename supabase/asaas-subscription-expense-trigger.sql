-- 1A.1: Trigger gera expense ao receber pagamento ASAAS confirmado
-- Categoria: pacote_sistema (mensalidade R$ 150 Pacote Tecnologia + Marketing)
-- Idempotência via last_paid_payment_id

BEGIN;

-- 1. Coluna idempotência (armazena último payment_id que virou expense)
ALTER TABLE public.system_subscriptions
  ADD COLUMN IF NOT EXISTS last_paid_payment_id TEXT NULL;

-- 2. Função
CREATE OR REPLACE FUNCTION public.generate_expense_from_subscription_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $func$
DECLARE
  v_due_date DATE;
BEGIN
  -- Status ASAAS válidos para confirmação de pagamento
  IF NEW.current_payment_status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH')
     AND (OLD.current_payment_status IS NULL
          OR OLD.current_payment_status NOT IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'))
     AND NEW.current_payment_id IS NOT NULL
     AND (NEW.last_paid_payment_id IS NULL
          OR NEW.last_paid_payment_id <> NEW.current_payment_id) THEN

    v_due_date := COALESCE(NEW.current_payment_due_date, CURRENT_DATE);

    INSERT INTO public.expenses (
      franchise_id, category, supplier, description,
      amount, expense_date, source, source_id, created_by
    ) VALUES (
      NEW.franchise_id,
      'pacote_sistema',
      'Maxi Massas (Pacote Tecnologia)',
      'Pacote Tecnologia + Marketing - vencimento ' || to_char(v_due_date, 'DD/MM/YYYY'),
      COALESCE(NEW.current_payment_value, 150),
      v_due_date,
      'marketing_payment',  -- reusa source 'marketing_payment' (já no CHECK constraint)
      NEW.id,
      NULL  -- ASAAS é automatizado, não tem usuário criador
    );

    -- Marca como gerado (idempotência)
    NEW.last_paid_payment_id := NEW.current_payment_id;
  END IF;

  RETURN NEW;
END;
$func$;

-- 3. Trigger BEFORE UPDATE (permite setar NEW.last_paid_payment_id direto)
DROP TRIGGER IF EXISTS tr_subscription_payment_expense ON public.system_subscriptions;
CREATE TRIGGER tr_subscription_payment_expense
  BEFORE UPDATE OF current_payment_status ON public.system_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_expense_from_subscription_payment();

COMMIT;
