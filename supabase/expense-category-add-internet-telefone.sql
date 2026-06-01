-- Adiciona categoria 'internet_telefone' (Internet / Telefone)
-- Pedido da franquia Santos (01/06/2026): antes lançavam em 'energia' por falta de categoria própria
-- Distingue de 'energia' (conta de luz) e de 'pacote_sistema' (mensalidade Maxi Massas)

BEGIN;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'compra_produto', 'compra_embalagem', 'compra_insumo',
    'aluguel', 'pessoal', 'energia', 'internet_telefone', 'transporte',
    'marketing', 'pacote_sistema', 'impostos', 'outros'
  ));

COMMIT;