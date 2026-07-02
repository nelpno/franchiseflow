-- =====================================================================
-- Fase 0 — Hardening de segurança (auditoria 2026-07-02)
-- =====================================================================
-- Contexto: verificação no banco VIVO confirmou que RPCs SECURITY DEFINER
-- foram concedidas a anon/PUBLIC (regressão do refactor de normalização de
-- telefone). Frontend NÃO chama as 4 RPCs de contato/PII (grep = 0); o bot
-- n8n as chama via service_role (grants originais eram service_role-only).
-- Logo, revogar de anon/authenticated/PUBLIC restaura o estado seguro.
--
-- REVERSÍVEL: para desfazer, re-GRANT ... TO anon, authenticated.
-- Rodar como migration (transação). Backup do estado de grants abaixo.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) RPCs de PII usadas SÓ pelo bot (service_role) — fechar anon/authenticated/PUBLIC
--    get_customer_intelligence, get_contact_by_phone, upsert_bot_contact, log_conversation_message
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_customer_intelligence','get_contact_by_phone',
                        'upsert_bot_contact','log_conversation_message')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2) add_default_product: escreve no estoque de TODAS as franquias.
--    Adicionar guard is_admin() + fechar anon/PUBLIC (mantém authenticated p/ o admin
--    do dashboard chamar; o guard bloqueia franqueado/anon).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_default_product(
  p_name text,
  p_category text,
  p_unit text DEFAULT 'un'::text,
  p_cost_price numeric DEFAULT 0,
  p_min_stock integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_evo_id text;
BEGIN
  -- Guard: só admin pode semear produto na rede inteira
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem adicionar produto padrão';
  END IF;

  FOR v_evo_id IN
    SELECT DISTINCT franchise_id FROM inventory_items
  LOOP
    INSERT INTO inventory_items (franchise_id, name, category, unit, cost_price, sale_price, min_stock, quantity)
    VALUES (v_evo_id, p_name, p_category, p_unit, p_cost_price, p_cost_price * 2, p_min_stock, 0)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_default_product(text,text,text,numeric,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.add_default_product(text,text,text,numeric,integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) get_standard_product_catalog: fechar anon/PUBLIC (mantém authenticated — TabEstoque usa)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_standard_product_catalog() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_standard_product_catalog() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) search_path mutável (Security Advisor): cs_flags_summary, normalize_phone_br, sync_outcome_on_converted
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('cs_flags_summary','normalize_phone_br','sync_outcome_on_converted')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

-- Recarregar o schema cache do PostgREST após DDL
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- NÃO incluído aqui (avaliar com cuidado, risco de quebrar o bot):
--  - views SECURITY DEFINER vw_bot_inventory_items_lite / vw_bot_conversations_summary
--    (advisor ERROR): trocar p/ security_invoker pode mudar o que o bot lê via RLS.
--  - REVOKE de authenticated nas RPCs guardadas (delete_franchise_cascade etc.):
--    já protegidas por guard interno; WARN by-design.
-- =====================================================================
