-- 1A.1 patch: adiciona categoria 'pacote_sistema' (mensalidade R$ 150 ASAAS)
-- Distingue de 'marketing' (tráfego pago / leads / panfletos)

BEGIN;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'compra_produto', 'compra_embalagem', 'compra_insumo',
    'aluguel', 'pessoal', 'energia', 'transporte',
    'marketing', 'pacote_sistema', 'impostos', 'outros'
  ));

COMMIT;
