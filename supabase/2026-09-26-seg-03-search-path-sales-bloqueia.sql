-- 2026-09-26 — Redesenho do admin, Fase 0 (B3) — search_path fixo em sales_bloqueia_data_futura
--
-- Por que: e a UNICA funcao do schema public apontada pelo advisor 0011
-- (function_search_path_mutable). Ela e SECURITY INVOKER (prosecdef=false), entao o risco e
-- baixo, mas funcao de trigger sem search_path resolve nomes pelo search_path de quem fez o
-- INSERT/UPDATE em sales. Fixar e o padrao do projeto. ALTER FUNCTION nao mexe no corpo
-- (nao precisa de paridade arquivo x producao).
-- Estado em 26/09: proconfig = NULL; acl = postgres, authenticated, service_role (anon nao).

alter function public.sales_bloqueia_data_futura() set search_path = 'public';


-- CONFERÊNCIA (rodar em query separada)
-- select coalesce(json_agg(t),'[]'::json) from (
--   select p.oid::regprocedure::text as fn, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'sales_bloqueia_data_futura') t;
-- Esperado: proconfig = {search_path=public}. Advisor security: 0011 zerado.
-- Smoke: uma venda manual nova no app continua salvando (o trigger segue disparando).

-- ROLLBACK
-- alter function public.sales_bloqueia_data_futura() reset search_path;
