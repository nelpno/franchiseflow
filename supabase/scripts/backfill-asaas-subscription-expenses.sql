-- Backfill: gera expense pacote_sistema para subs ASAAS já com fatura paga
-- (current_payment_status='PAID') que ainda não têm a expense espelho.
--
-- Idempotente: roda 2x sem duplicar (UNIQUE INDEX uq_expenses_asaas_sub_payment
-- em (source_id, expense_date) WHERE source='asaas_subscription' protege).
--
-- expense_date = LEAST(current_payment_due_date, CURRENT_DATE) — evita despesa
-- em mês futuro (ex: sub recém-criada com due_date dia 1 do mês seguinte).
--
-- Pré-requisitos: aplicar PRIMEIRO
--   1. expense-source-add-asaas-subscription.sql (CHECK + UNIQUE)
--   2. asaas-subscription-expense-trigger.sql (rewrite)

-- =====================================================================
-- DRY-RUN: rode primeiro para ver o que será afetado
-- =====================================================================
-- SELECT
--   s.franchise_id,
--   s.current_payment_id,
--   s.current_payment_value,
--   s.current_payment_due_date,
--   LEAST(s.current_payment_due_date, CURRENT_DATE) AS calculated_expense_date
-- FROM public.system_subscriptions s
-- WHERE s.current_payment_status = 'PAID'
--   AND s.current_payment_id IS NOT NULL
--   AND s.last_paid_payment_id IS DISTINCT FROM s.current_payment_id;

-- =====================================================================
-- APPLY: insere expenses + atualiza last_paid_payment_id atomicamente
-- =====================================================================
BEGIN;

WITH candidates AS (
  SELECT
    s.id AS sub_id,
    s.franchise_id,
    s.current_payment_id,
    COALESCE(s.current_payment_value, 150) AS amount,
    LEAST(s.current_payment_due_date, CURRENT_DATE) AS expense_date
  FROM public.system_subscriptions s
  WHERE s.current_payment_status = 'PAID'
    AND s.current_payment_id IS NOT NULL
    AND s.last_paid_payment_id IS DISTINCT FROM s.current_payment_id
),
inserted AS (
  INSERT INTO public.expenses (
    franchise_id, category, supplier, description,
    amount, expense_date, source, source_id, created_by
  )
  SELECT
    c.franchise_id,
    'pacote_sistema',
    'Maxi Massas (Pacote Tecnologia)',
    'Pacote Tecnologia + Marketing - vencimento ' || to_char(c.expense_date, 'DD/MM/YYYY'),
    c.amount,
    c.expense_date,
    'asaas_subscription',
    c.sub_id,
    NULL
  FROM candidates c
  ON CONFLICT (source_id, expense_date) WHERE source = 'asaas_subscription' DO NOTHING
  RETURNING source_id
)
UPDATE public.system_subscriptions s
SET last_paid_payment_id = s.current_payment_id
FROM candidates c
WHERE s.id = c.sub_id
  AND s.id IN (SELECT source_id FROM inserted);

COMMIT;

-- =====================================================================
-- VERIFY: deve retornar 1 row por sub PAID, com last_paid_payment_id
-- agora batendo com current_payment_id
-- =====================================================================
-- SELECT
--   s.franchise_id,
--   e.expense_date,
--   e.amount,
--   s.last_paid_payment_id = s.current_payment_id AS idempotency_ok
-- FROM public.expenses e
-- JOIN public.system_subscriptions s ON s.id = e.source_id
-- WHERE e.source = 'asaas_subscription'
-- ORDER BY e.expense_date DESC;
