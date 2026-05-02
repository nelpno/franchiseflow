-- 1A.1: Trigger gera expense ao receber pagamento ASAAS confirmado
-- Categoria: pacote_sistema (mensalidade R$ 150 Pacote Tecnologia + Marketing)
-- Idempotência via last_paid_payment_id
--
-- IMPORTANTE: a edge function asaas-billing normaliza status ASAAS
-- (RECEIVED/CONFIRMED/RECEIVED_IN_CASH) para 'PAID' antes de gravar
-- em system_subscriptions.current_payment_status. Ver mapPaymentStatus()
-- em supabase/functions/asaas-billing/index.ts. Por isso o trigger
-- checa 'PAID' (e não os valores ASAAS crus).
--
-- Versão anterior tinha 3 bugs: checava status ASAAS crus, exigia
-- transição OLD→NEW (impedia rollover mensal PAID→PAID com novo
-- payment_id) e usava source='marketing_payment' (semanticamente
-- errado, conflito com tr_mkt_cleanup_expense). Pré-requisito:
-- expense-source-add-asaas-subscription.sql aplicado antes.

BEGIN;

-- 1. Coluna idempotência (idempotente — já existe em produção)
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
  -- Edge function asaas-billing normaliza status para 'PAID'.
  -- Idempotência: só gera expense se este payment_id ainda não foi processado.
  -- Não dependemos de transição OLD→NEW: ASAAS pode trocar current_payment_id
  -- mantendo current_payment_status='PAID' no rollover mensal.
  IF NEW.current_payment_status = 'PAID'
     AND NEW.current_payment_id IS NOT NULL
     AND NEW.last_paid_payment_id IS DISTINCT FROM NEW.current_payment_id THEN

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
      'asaas_subscription',
      NEW.id,
      NULL  -- ASAAS é automatizado, não tem usuário criador
    )
    ON CONFLICT (source_id, expense_date) WHERE source = 'asaas_subscription' DO NOTHING;

    -- Marca como gerado (idempotência forward)
    NEW.last_paid_payment_id := NEW.current_payment_id;
  END IF;

  RETURN NEW;
END;
$func$;

-- 3. Trigger BEFORE UPDATE em current_payment_id E current_payment_status
-- (permite setar NEW.last_paid_payment_id direto + dispara em rollover mensal
-- onde só o id muda mantendo status='PAID')
DROP TRIGGER IF EXISTS tr_subscription_payment_expense ON public.system_subscriptions;
CREATE TRIGGER tr_subscription_payment_expense
  BEFORE UPDATE OF current_payment_id, current_payment_status ON public.system_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_expense_from_subscription_payment();

COMMIT;
