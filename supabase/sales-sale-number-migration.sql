-- Número de pedido sequencial por franquia em sales
-- Aplicado em 2026-05-13. Backfill de 4584 vendas, 47 franquias.
--
-- Padrão: cada franquia tem sua própria sequência começando em 1, crescente
-- (similar a iFood/Rappi — nunca reseta, gaps em delete são esperados).
-- Atribuição via trigger BEFORE INSERT com pg_advisory_xact_lock por franquia
-- para serializar inserts concorrentes da mesma franquia.

BEGIN;

-- 1. Coluna
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_number INTEGER;

-- 2. Lock para serializar inserts durante backfill (libera no COMMIT)
LOCK TABLE public.sales IN EXCLUSIVE MODE;

-- 3. Função trigger
CREATE OR REPLACE FUNCTION public.tr_sales_assign_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.sale_number IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sales_seq:' || COALESCE(NEW.franchise_id,'_')));
  SELECT COALESCE(MAX(sale_number), 0) + 1
    INTO NEW.sale_number
    FROM public.sales
   WHERE franchise_id IS NOT DISTINCT FROM NEW.franchise_id;
  RETURN NEW;
END $$;

-- 4. Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_sales_assign_number ON public.sales;
CREATE TRIGGER trg_sales_assign_number
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.tr_sales_assign_number();

-- 5. Backfill (ordem cronológica por created_at, id como tiebreaker)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY franchise_id ORDER BY created_at, id) AS rn
    FROM public.sales
   WHERE sale_number IS NULL
)
UPDATE public.sales s SET sale_number = n.rn
  FROM numbered n WHERE s.id = n.id;

-- 6. Unicidade (franquia + número)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_franchise_number
  ON public.sales (franchise_id, sale_number);

COMMIT;
