-- 20260417_add_billing_email.sql
-- Desnormaliza email de cobrança para franchises e libera UPDATE ao próprio franqueado.
-- Contexto: ASAAS lia email de franchise_invites (frágil). CPF/endereço já existem.

-- 1. Nova coluna (nullable por ora — franquias legadas completam via UI)
ALTER TABLE public.franchises
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- 2. Backfill do invite mais recente (filtra emails malformados)
UPDATE public.franchises f
SET billing_email = sub.email
FROM (
  SELECT DISTINCT ON (franchise_id) franchise_id, email
  FROM public.franchise_invites
  WHERE email ~* '^[^@]+@[^@]+\.[^@]+$'
  ORDER BY franchise_id, invited_at DESC NULLS LAST
) sub
WHERE f.evolution_instance_id = sub.franchise_id
  AND f.billing_email IS NULL;

-- 3. CHECK de formato (permite NULL — backfill pode não ter atingido todos)
ALTER TABLE public.franchises
  DROP CONSTRAINT IF EXISTS billing_email_format;
ALTER TABLE public.franchises
  ADD CONSTRAINT billing_email_format
  CHECK (billing_email IS NULL OR billing_email ~* '^[^@]+@[^@]+\.[^@]+$');

-- 4. Expandir UPDATE policy — franqueado precisa editar seus dados fiscais no onboarding
--    Policy configs_update já inclui owner. Policy franchises_update ainda restringia a admin/manager.
DROP POLICY IF EXISTS franchises_update ON public.franchises;
CREATE POLICY franchises_update ON public.franchises
  FOR UPDATE
  USING (
    is_admin_or_manager()
    OR evolution_instance_id = ANY (managed_franchise_ids())
  )
  WITH CHECK (
    is_admin_or_manager()
    OR evolution_instance_id = ANY (managed_franchise_ids())
  );
