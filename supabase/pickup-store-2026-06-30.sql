-- Loja / ponto físico na retirada — 2026-06-30
-- Aplicado via Supabase migration `add_pickup_store_fields`.
-- Adiciona o flag de loja + endereço da loja (opcional) e expõe na view do bot.

ALTER TABLE public.franchise_configurations
  ADD COLUMN IF NOT EXISTS pickup_is_store boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_address text;

-- vw_dadosunidade: acrescenta 2 passthrough no FIM (CREATE OR REPLACE só permite append).
-- Técnica: lê a def viva, insere as colunas antes do FROM final, recria preservando security_invoker.
DO $$
DECLARE body text; newdef text;
BEGIN
  SELECT pg_get_viewdef('public.vw_dadosunidade'::regclass, true) INTO body;
  IF position('pickup_is_store' in body) > 0 THEN
    RAISE NOTICE 'view already has pickup_is_store, skipping recreate';
  ELSE
    newdef := replace(body, 'FROM franchise_configurations fc;',
      ', COALESCE(pickup_is_store, false) AS pickup_is_store, pickup_address FROM franchise_configurations fc;');
    EXECUTE 'CREATE OR REPLACE VIEW public.vw_dadosunidade AS ' || newdef;
  END IF;
END $$;

ALTER VIEW public.vw_dadosunidade SET (security_invoker = true);
NOTIFY pgrst, 'reload schema';

-- Rollback: as colunas/passthrough são aditivas e inertes (pickup_is_store=false por default).
-- Para reverter de fato: DROP da view + recriar sem os 2 passthrough, depois
-- ALTER TABLE ... DROP COLUMN pickup_is_store, DROP COLUMN pickup_address.
