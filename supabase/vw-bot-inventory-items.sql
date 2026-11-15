-- 2026-05-08: view consumida pelo bot V4 (nó planilha_estoque1).
-- Esconde APENAS itens com active = false (que a franquia decidiu não vender).
-- Itens zerados (quantity = 0) ficam visíveis para o bot saber que existem e
-- avisar "no momento estamos sem" — a regra de "não oferecer quando quantity=0"
-- vive no systemMessage do Estoque1 (não no SQL).
-- security_invoker = true mantém o RLS de inventory_items.
CREATE OR REPLACE VIEW public.vw_bot_inventory_items
WITH (security_invoker = true) AS
SELECT *
FROM public.inventory_items
WHERE COALESCE(active, true) IS NOT FALSE;

GRANT SELECT ON public.vw_bot_inventory_items TO anon, authenticated, service_role;
COMMENT ON VIEW public.vw_bot_inventory_items IS 'Consumida pelo bot V4 (planilha_estoque1). Esconde apenas itens com active=false (que a franquia decidiu não vender). Itens zerados (quantity=0) ficam visíveis para o bot avisar "no momento estamos sem".';