-- BACKUP AO VIVO de public.cron_reconcile_cs_auto_tasks tirado em 2026-09-27 (antes da Onda 2 do Mural)
-- md5(prosrc)=079c0f25f0b2495a1094f98b5cb7f660 length=921
-- ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- Restaurar: rodar este arquivo inteiro (CREATE OR REPLACE preserva o ACL).

CREATE OR REPLACE FUNCTION public.cron_reconcile_cs_auto_tasks()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
