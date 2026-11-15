-- 2026-09-26 — Redesenho do admin, Fase 0 (B2) — fechar EXECUTE de `anon` nas SECURITY DEFINER
-- Decisao 5 do Nelson (26/09): APROVADO.
--
-- Por que: 21 funcoes SECURITY DEFINER do schema public sao executaveis pela chave ANON (que
-- e publica: esta no bundle do painel). O advisor 0028 lista as mesmas 21.
--
-- 🔴 NAO E SO HIGIENE: 5 delas DEIXAM O ANON PASSAR PELO GUARD. O guard tipico e
--      if not (is_admin_or_manager() or p_franchise_id = any(managed_franchise_ids())) then raise
--    Para anon, managed_franchise_ids() devolve NULL (nao ha linha em profiles), entao
--    `x = any(NULL)` = NULL, `not (false or NULL)` = NULL, e `IF NULL` NAO entra no raise.
--    Provado 26/09 com request.jwt.claims={"role":"anon"}: guard_expr = NULL.
--    E provado pela REST com a chave anon (.tmp/fase0/anon-check.mjs, argumentos inofensivos):
--      get_franchise_report_data  200  -> anon le conversas do robo + vendas de QUALQUER unidade
--      get_marketing_attribution  200  -> anon le faturamento/verba de uma unidade
--      get_franchise_bot_pulse    200  -> anon le atividade do robo de uma unidade
--      get_franchise_ranking      200  -> anon le posicao no ranking
--      record_external_purchase   400 P0001 (parou na validacao de custo, DEPOIS do guard)
--                                  -> com argumentos validos o anon GRAVA despesa e mexe no
--                                     estoque/custo medio de qualquer unidade
--    O evolution_instance_id e adivinhavel (franquia<cidade><uf>), entao o vazamento e pratico.
--    Os outros guards (is_admin(), is_admin_or_manager(), is_cs_or_admin()) usam EXISTS e
--    devolvem false (nunca NULL) -> seguraram (401/42501 ou retorno vazio).
--
-- O que fica ABERTO para anon, de proposito (helpers de policy RLS — revogar faz o
-- deslogado levar 500 em vez de 0 linhas; regra do CLAUDE.md, auditoria set/2026):
--   is_admin() .................. 33 policies
--   is_admin_or_manager() ....... 65 policies (inclui storage.objects)
--   managed_franchise_ids() ..... 49 policies
--   is_cs_or_admin() ............  9 policies
--
-- Quem chama cada revogada (grep em src/, supabase/functions e pg_proc.prosrc; n8n usa
-- service_role e nao e afetado; nenhuma e chamada por tela deslogada — login, set-password e
-- convite nao usam RPC): ver tabela no fim. Todas continuam para authenticated + service_role.
--
-- Trigger/event trigger nao precisam de EXECUTE do chamador para disparar: revogar e seguro.
--
-- Lembrete: revogar de `anon` sozinho NAO basta quando `public` tem EXECUTE (anon herda de
-- public). Por isso revoke de public E anon, e grant explicito a authenticated/service_role.

begin;

-- ── RPCs chamadas pelo app (logado) ─────────────────────────────────────────
revoke execute on function public.delete_user_complete(uuid) from public, anon;
grant  execute on function public.delete_user_complete(uuid) to authenticated, service_role;

revoke execute on function public.get_fechamento_mensal(text) from public, anon;
grant  execute on function public.get_fechamento_mensal(text) to authenticated, service_role;

revoke execute on function public.record_external_purchase(text, text, numeric, numeric, text, date, uuid, text) from public, anon;
grant  execute on function public.record_external_purchase(text, text, numeric, numeric, text, date, uuid, text) to authenticated, service_role;

revoke execute on function public.get_bot_conversation_summary(timestamptz) from public, anon;
grant  execute on function public.get_bot_conversation_summary(timestamptz) to authenticated, service_role;

revoke execute on function public.get_cs_franchise_contacts() from public, anon;
grant  execute on function public.get_cs_franchise_contacts() to authenticated, service_role;

revoke execute on function public.get_franchise_bot_pulse(text) from public, anon;
grant  execute on function public.get_franchise_bot_pulse(text) to authenticated, service_role;

revoke execute on function public.get_franchise_ranking(date, text) from public, anon;
grant  execute on function public.get_franchise_ranking(date, text) to authenticated, service_role;

revoke execute on function public.get_franchise_report_data(text, date, date) from public, anon;
grant  execute on function public.get_franchise_report_data(text, date, date) to authenticated, service_role;

revoke execute on function public.get_human_message_totals(timestamptz) from public, anon;
grant  execute on function public.get_human_message_totals(timestamptz) to authenticated, service_role;

revoke execute on function public.get_marketing_attribution(text, text) from public, anon;
grant  execute on function public.get_marketing_attribution(text, text) to authenticated, service_role;

revoke execute on function public.get_network_funnel_ranking(date, date) from public, anon;
grant  execute on function public.get_network_funnel_ranking(date, date) to authenticated, service_role;

revoke execute on function public.reconcile_cs_auto_tasks() from public, anon;
grant  execute on function public.reconcile_cs_auto_tasks() to authenticated, service_role;

-- ── Funcoes de trigger / event trigger (disparam sem EXECUTE do chamador) ───
revoke execute on function public.criar_checklist_da_franquia() from public, anon;
revoke execute on function public.guard_onboarding_checklist() from public, anon;
revoke execute on function public.notificar_onboarding_pronto() from public, anon;
revoke execute on function public.tr_sales_recompute_contact() from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon;

commit;

-- Tabela de decisao (26/09/2026)
-- funcao                        | quem chama                                              | decisao
-- delete_user_complete          | Franchises.jsx (admin); delete_franchise_cascade (DEF)  | revoga anon
-- get_fechamento_mensal         | entities/all.js -> FechamentoMensal (admin)             | revoga anon
-- record_external_purchase      | LancarCompraSheet.jsx (franqueado)                      | revoga anon (GUARD FURADO)
-- get_bot_conversation_summary  | AdminDashboard.jsx                                      | revoga anon
-- get_cs_franchise_contacts     | entities/all.js (Mural CS)                              | revoga anon
-- get_franchise_bot_pulse       | entities/all.js (franqueado/CS)                         | revoga anon (GUARD FURADO)
-- get_franchise_ranking         | entities/all.js (FranchiseeDashboard)                   | revoga anon (GUARD FURADO)
-- get_franchise_report_data     | NINGUEM (Reports.jsx removido 03/07)                    | revoga anon (GUARD FURADO; candidata a DROP)
-- get_human_message_totals      | AdminDashboard.jsx                                      | revoga anon
-- get_marketing_attribution     | entities/all.js (relatorio do mes, admin e franqueado)  | revoga anon (GUARD FURADO)
-- get_network_funnel_ranking    | entities/all.js (CS)                                    | revoga anon
-- reconcile_cs_auto_tasks       | entities/all.js (CS); cron_reconcile_cs_auto_tasks (DEF)| revoga anon
-- criar_checklist_da_franquia   | trigger franchises                                      | revoga anon
-- guard_onboarding_checklist    | trigger onboarding_checklists                           | revoga anon
-- notificar_onboarding_pronto   | trigger onboarding_checklists                           | revoga anon
-- tr_sales_recompute_contact    | 2 triggers em sales                                     | revoga anon
-- rls_auto_enable               | event trigger                                           | revoga anon
-- is_admin / is_admin_or_manager / managed_franchise_ids / is_cs_or_admin | 156 policies  | MANTEM


-- CONFERÊNCIA (rodar em query separada)
-- 1) sobram exatamente os 4 helpers:
-- select coalesce(json_agg(t),'[]'::json) from (
--   select p.oid::regprocedure::text as fn
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
--     and has_function_privilege('anon', p.oid, 'execute')
--   order by 1) t;
--   Esperado: is_admin(), is_admin_or_manager(), is_cs_or_admin(), managed_franchise_ids()
-- 2) authenticated continua com as RPCs do app:
-- select coalesce(json_agg(t),'[]'::json) from (
--   select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as auth_ok
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('delete_user_complete','get_fechamento_mensal',
--     'record_external_purchase','get_bot_conversation_summary','get_cs_franchise_contacts',
--     'get_franchise_bot_pulse','get_franchise_ranking','get_human_message_totals',
--     'get_marketing_attribution','get_network_funnel_ranking','reconcile_cs_auto_tasks')) t;
--   Esperado: auth_ok = true em todas.
-- 3) pela REST, com a chave anon:  node .tmp/fase0/anon-check.mjs   -> "RESULTADO: OK"
--    (antes do revoke o mesmo script da 9 problemas: e o controle positivo)
-- 4) advisor security: o alerta 0028 cai de 21 para 4 (os helpers).

-- ROLLBACK (volta ao estado de 26/09: anon com EXECUTE; public tinha EXECUTE so nas marcadas *)
-- begin;
-- grant execute on function public.delete_user_complete(uuid) to anon;
-- grant execute on function public.get_fechamento_mensal(text) to anon;
-- grant execute on function public.record_external_purchase(text, text, numeric, numeric, text, date, uuid, text) to public, anon; -- *
-- grant execute on function public.get_bot_conversation_summary(timestamptz) to anon;
-- grant execute on function public.get_cs_franchise_contacts() to anon;
-- grant execute on function public.get_franchise_bot_pulse(text) to anon;
-- grant execute on function public.get_franchise_ranking(date, text) to public, anon; -- *
-- grant execute on function public.get_franchise_report_data(text, date, date) to public, anon; -- *
-- grant execute on function public.get_human_message_totals(timestamptz) to anon;
-- grant execute on function public.get_marketing_attribution(text, text) to anon;
-- grant execute on function public.get_network_funnel_ranking(date, date) to anon;
-- grant execute on function public.reconcile_cs_auto_tasks() to anon;
-- grant execute on function public.criar_checklist_da_franquia() to public, anon; -- *
-- grant execute on function public.guard_onboarding_checklist() to public, anon; -- *
-- grant execute on function public.notificar_onboarding_pronto() to public, anon; -- *
-- grant execute on function public.tr_sales_recompute_contact() to public, anon; -- *
-- grant execute on function public.rls_auto_enable() to public, anon; -- *
-- commit;
