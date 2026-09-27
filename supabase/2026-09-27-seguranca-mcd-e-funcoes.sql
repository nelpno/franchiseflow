-- 27/09/2026 — dois furos achados na auditoria de dados.
--
-- 1) Schema mcd (espelho do ERP: produtos com custo, precos, pedidos, producao, estoque) esta
--    publicado na API (pgrst.db_schemas) e a chave ANON (publica, vai no bundle do painel) tinha
--    SELECT/INSERT/UPDATE/DELETE nas 9 tabelas, sem RLS. Quem usa o mcd pela API sao os scripts
--    do PCP (operations/pcp/grade_producao/sync_nuvem.py e sobe_nuvem.py), com a chave SERVICE;
--    o ERP conecta direto no Postgres. Nenhum dos dois depende de anon/authenticated.
--
-- 2) Funcoes SECURITY DEFINER sem checagem de quem chama, executaveis por qualquer usuario
--    logado (ex.: get_conversations_for_analysis devolvia o texto das conversas do robo de TODAS
--    as unidades; deduct_inventory baixava estoque de qualquer unidade). Nenhuma e chamada pelo
--    front (grep em src/); as chamadoras no banco sao SECURITY DEFINER (rodam como dono); crons
--    rodam como postgres; o n8n usa service_role.
--
-- Desfazer: grant usage on schema mcd to anon, authenticated; grant all on all tables in schema
-- mcd to anon, authenticated; grant execute on function <f> to authenticated.

begin;

revoke all on all tables in schema mcd from anon, authenticated;
revoke all on all sequences in schema mcd from anon, authenticated;
revoke usage on schema mcd from anon, authenticated;
alter default privileges in schema mcd revoke all on tables from anon, authenticated;
alter default privileges in schema mcd revoke all on sequences from anon, authenticated;
grant usage on schema mcd to service_role;
grant all on all tables in schema mcd to service_role;
grant all on all sequences in schema mcd to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'public.aggregate_daily_data(date)',
    'public.auto_close_stale_bot_conversations()',
    'public.cron_reconcile_cs_auto_tasks()',
    'public.deduct_inventory(text,jsonb)',
    'public.get_conversations_for_analysis(date,date,text,integer)',
    'public.get_network_touch_ranking(date,date)',
    'public.notify_admins(text,text,text,text,text)',
    'public.rls_auto_enable()',
    'public.sentinela_diaria()',
    'public.sentinela_marketing_duplicado()',
    'public.update_contact_address(uuid,text,text)',
    'public.upsert_bot_conversation(text,text,text,numeric,integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
