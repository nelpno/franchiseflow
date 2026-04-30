-- Backfill retroativo: gera expenses para PO entregues antes do trigger + Marketing já confirmados
-- Idempotente: só toca registros sem expense ainda gerada (expenses_generated_at IS NULL).
-- Análise prévia confirmou ZERO match com despesas manuais → seguro contra duplicação.

BEGIN;

-- 1. Para cada PO entregue sem expense, gera compra_produto
INSERT INTO expenses (franchise_id, category, supplier, description, amount, expense_date, source, source_id, created_by)
SELECT
  po.franchise_id,
  'compra_produto',
  'Maxi Massas',
  'Pedido #' || substring(po.id::text from 1 for 8) || ' - Maxi Massas',
  COALESCE((SELECT SUM(unit_price * quantity) FROM purchase_order_items WHERE order_id = po.id), 0),
  COALESCE(po.delivered_at::date, CURRENT_DATE),
  'purchase_order',
  po.id,
  po.confirmed_by
FROM purchase_orders po
WHERE po.status = 'entregue'
  AND po.expenses_generated_at IS NULL
  AND COALESCE((SELECT SUM(unit_price * quantity) FROM purchase_order_items WHERE order_id = po.id), 0) > 0;

-- 2. Para cada PO entregue com frete, gera transporte
INSERT INTO expenses (franchise_id, category, supplier, description, amount, expense_date, source, source_id, created_by)
SELECT
  po.franchise_id,
  'transporte',
  'Maxi Massas',
  'Frete pedido #' || substring(po.id::text from 1 for 8),
  po.freight_cost,
  COALESCE(po.delivered_at::date, CURRENT_DATE),
  'purchase_order',
  po.id,
  po.confirmed_by
FROM purchase_orders po
WHERE po.status = 'entregue'
  AND po.expenses_generated_at IS NULL
  AND po.freight_cost IS NOT NULL
  AND po.freight_cost > 0;

-- 3. Marca POs como gerados (idempotência futura)
UPDATE purchase_orders
SET expenses_generated_at = NOW()
WHERE status = 'entregue' AND expenses_generated_at IS NULL;

-- 4. Para cada marketing_payment confirmado sem expense, gera marketing
INSERT INTO expenses (franchise_id, category, supplier, description, amount, expense_date, source, source_id, created_by)
SELECT
  mp.franchise_id,
  'marketing',
  'Maxi Massas Marketing',
  'Marketing - ' || COALESCE(mp.reference_month, 'mês não informado'),
  mp.amount,
  -- expense_date = primeiro dia do reference_month (mês a que o marketing se refere),
  -- com fallback pra updated_at quando reference_month NULL/inválido. Mesma regra do trigger.
  COALESCE(
    (CASE WHEN mp.reference_month ~ '^\d{4}-\d{2}$' THEN (mp.reference_month || '-01')::date END),
    mp.updated_at::date,
    CURRENT_DATE
  ),
  'marketing_payment',
  mp.id,
  mp.created_by
FROM marketing_payments mp
WHERE mp.status = 'confirmed'
  AND mp.expense_generated_at IS NULL;

-- 5. Marca marketing_payments como gerados
UPDATE marketing_payments
SET expense_generated_at = NOW()
WHERE status = 'confirmed' AND expense_generated_at IS NULL;

COMMIT;
