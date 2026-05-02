-- 1A.2: adiciona 'asaas_subscription' ao CHECK de expenses.source
-- + UNIQUE INDEX de defesa-em-profundidade contra UPDATEs concorrentes
-- gerando expense duplicada para a mesma fatura ASAAS.
--
-- Contexto: trigger tr_subscription_payment_expense usava 'marketing_payment'
-- como source — semanticamente errado e ambíguo com tr_mkt_cleanup_expense
-- (que deleta expenses por source='marketing_payment' + source_id).

BEGIN;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_source_check
  CHECK (source IN (
    'manual',
    'purchase_order',
    'marketing_payment',
    'external_purchase',
    'asaas_subscription'
  ));

-- Defesa contra race: dois UPDATEs concorrentes na mesma sub não podem inserir 2 expenses
-- para a mesma fatura. (source_id, expense_date) é único quando source='asaas_subscription'.
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_asaas_sub_payment
  ON public.expenses (source_id, expense_date)
  WHERE source = 'asaas_subscription';

COMMIT;
