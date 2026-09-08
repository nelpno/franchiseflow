-- 2026-09-08 — o Mural do CS passa a se reconciliar sozinho, todo dia as 08:15 BRT
--
-- POR QUE
-- `reconcile_cs_auto_tasks()` e quem abre o cartao automatico da franquia critica e
-- arquiva o que ja foi resolvido. Ela so roda quando ALGUEM ABRE A PAGINA do Customer
-- Success — nao ha cron nenhum chamando (os jobs de hoje sao 5: aggregate-daily-data,
-- auto-close-stale-convs, cleanup_bot_message_dedup, sync-asaas-subscriptions e
-- sentinela-diaria).
--
-- Medido em 08/09/2026: a ultima reconciliacao foi em 03/09 as 14:47 — 4,4 dias atras.
-- Rodando a funcao dentro de uma transacao abortada de proposito, ela criaria AGORA
-- 6 cartoes que nao existem (12 abertos -> 18). Ou seja: 6 unidades entraram em estado
-- critico e ninguem foi avisado, porque o gatilho e alguem abrir a tela.
--
-- O QUE MUDA
-- Nada dentro de `reconcile_cs_auto_tasks()`. 🔴 A versao que roda em producao NAO esta
-- versionada em .sql nenhum (o 09-*.sql do repo e mais velho e um CREATE OR REPLACE com
-- ele REGRIDE o radar do Celso — perde giro_baixo, marketing_late, cs_agreements,
-- cooldown e parked_until). Por isso aqui so existe um INVOLUCRO que a CHAMA.
--
-- O involucro resolve o unico obstaculo: a funcao tem guard `is_cs_or_admin()`, que le
-- `auth.uid()`. O pg_cron roda sem JWT, entao `auth.uid()` e nulo e o guard barra — em
-- silencio, devolvendo zero linhas em vez de erro. `cron_reconcile_cs_auto_tasks()`
-- planta `request.jwt.claims` com o id de um admin real (transaction-local, some no fim)
-- e so entao chama. E o mesmo contorno que o CLAUDE.md ja documenta para rodar RPC com
-- guard pelo MCP.
--
-- Horario: 11:15 UTC = 08:15 BRT, logo depois da sentinela (08:10), para o Celso achar o
-- mural pronto quando abrir.
--
-- ROLLBACK
--   select cron.unschedule('reconcile-cs-auto-tasks');
--   drop function if exists public.cron_reconcile_cs_auto_tasks();
-- Nada mais e tocado: a funcao de reconcile, as tabelas cs_tasks/cs_worklist_events e o
-- comportamento da tela ficam exatamente como estao.

create or replace function public.cron_reconcile_cs_auto_tasks()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin uuid;
  v_antes int;
  v_depois int;
begin
  -- Um admin REAL, escolhido em tempo de execucao. Nao cravamos uuid: se a conta
  -- some, o cron passaria a falhar calado com "usuario nao existe".
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then
    raise exception 'nenhum profile com role=admin — reconcile do CS nao pode rodar';
  end if;

  -- transaction-local: vale so dentro desta execucao do job
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  select count(*) into v_antes from cs_tasks where source = 'auto' and column_status <> 'feito';
  perform public.reconcile_cs_auto_tasks();
  select count(*) into v_depois from cs_tasks where source = 'auto' and column_status <> 'feito';

  return format('reconcile do CS: %s cartoes automaticos abertos (antes %s)', v_depois, v_antes);
end;
$function$;

-- Mesmo criterio de exposicao do resto: nunca para anon.
revoke all on function public.cron_reconcile_cs_auto_tasks() from public;
revoke all on function public.cron_reconcile_cs_auto_tasks() from anon;
grant execute on function public.cron_reconcile_cs_auto_tasks() to postgres, service_role;

select cron.schedule(
  'reconcile-cs-auto-tasks',
  '15 11 * * *',
  $cron$select public.cron_reconcile_cs_auto_tasks();$cron$
);
