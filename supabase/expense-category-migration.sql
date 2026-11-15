-- 1A.1 Migration: expenses — categoria + fornecedor + auditoria
-- Idempotente. Não-breaking (colunas novas, default seguro).

BEGIN;

-- 1. Adicionar colunas
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category   TEXT NOT NULL DEFAULT 'outros',
  ADD COLUMN IF NOT EXISTS supplier   TEXT NULL,
  ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id  UUID NULL;

-- 2. CHECK constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_check') THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_category_check
      CHECK (category IN (
        'compra_produto', 'compra_embalagem', 'compra_insumo',
        'aluguel', 'pessoal', 'energia', 'transporte',
        'marketing', 'impostos', 'outros'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_source_check') THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_source_check
      CHECK (source IN (
        'manual', 'purchase_order', 'marketing_payment', 'external_purchase'
      ));
  END IF;
END $$;

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_expenses_franchise_category
  ON public.expenses (franchise_id, category);

CREATE INDEX IF NOT EXISTS idx_expenses_source_id
  ON public.expenses (source, source_id)
  WHERE source <> 'manual';

COMMIT;
