-- 2026-09-07 — Auditoria, Onda 3 — SUPERFICIE DE ATAQUE
--
-- 50 funcoes SECURITY DEFINER estavam executaveis por `anon`, isto e, chamaveis por
-- qualquer um que tenha a anon key (que vai no bundle por design) via
-- POST /rest/v1/rpc/<nome>. Entre elas:
--   deduct_inventory        -> baixa estoque de QUALQUER franquia
--   update_contact_address  -> escreve no cadastro de qualquer contato
--   notify_admins           -> enche o sino de todo admin
--   aggregate_daily_data    -> dispara o fechamento na mao
--
-- ANTES de revogar, medido em pg_stat_statements: as RPCs do bot sao chamadas por
-- service_role (1.182.625 execucoes) e pelo app como authenticated (700). ZERO
-- chamadas de RPC do bot como anon — entao revogar de anon nao toca no bot nem no app.
--
-- 🔴 O QUE NAO SE REVOGA DE anon: is_admin, is_admin_or_manager, is_cs_or_admin e
-- managed_franchise_ids. As POLICIES de RLS chamam esses helpers no contexto do papel
-- que esta lendo. Um usuario deslogado que bate numa tabela protegida tem de receber
-- ZERO LINHAS; sem o EXECUTE ele receberia erro de permissao — trocaria silencio por
-- 500 na cara do usuario.
--
-- Tambem se revoga toda funcao de TRIGGER: trigger roda com o privilegio do dono da
-- tabela e nunca precisou de grant para disparar. O grant so servia para alguem
-- chamar a funcao na mao.
--
-- Resultado: 50 -> 21 funcoes expostas a anon, 0 perigosas. As 21 que ficam sao os 4
-- helpers de RLS (obrigatorio) e RPCs de leitura que ja tem guard interno.
--
-- Conferir:
--   select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.prokind='f' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'execute');
do $$
declare
  f record;
  perigosas text[] := array[
    'deduct_inventory', 'update_contact_address', 'notify_admins',
    'aggregate_daily_data', 'auto_close_stale_bot_conversations',
    'get_conversations_for_analysis', 'get_network_touch_ranking',
    'upsert_bot_conversation', 'log_conversation_message',
    'get_unprocessed_conversations'
  ];
  n int := 0;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind = 'f'
      and (p.prorettype = 'pg_catalog.trigger'::regtype or p.proname = any (perigosas))
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from anon, public', f.assinatura);
    n := n + 1;
  end loop;
  raise notice 'revogadas de anon/public: %', n;
end $$;
