-- =============================================================================
-- Cleanup contacts 2026-04 (parte do plano de normalizacao de telefone)
-- =============================================================================
-- 1. DROP index redundante idx_contacts_franchise_telefone (131 scans em meses)
--    - contacts_franchise_phone_unique (UNIQUE partial) ja cobre o caso de uso
-- 2. DROP coluna tags (ARRAY) - 0 linhas usando em 6451 contatos
-- 3. VACUUM ANALYZE para refletir mudancas no planner
-- =============================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_contacts_franchise_telefone;

ALTER TABLE public.contacts DROP COLUMN IF EXISTS tags;

VACUUM (ANALYZE) public.contacts;
