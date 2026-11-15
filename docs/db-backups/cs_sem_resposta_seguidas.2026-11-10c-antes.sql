-- Backup do corpo VIVO (pg_get_functiondef) antes de supabase/2026-11-10c-cs-mural-revisao.sql. Reaplicar este arquivo = voltar.
CREATE OR REPLACE FUNCTION public.cs_sem_resposta_seguidas(p_task_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from public.cs_worklist_events e
  where e.task_id = p_task_id
    and e.event_type in ('contact', 'meeting')
    and e.outcome = 'nao_respondeu'
    and e.created_at > coalesce((
          select max(e2.created_at)
          from public.cs_worklist_events e2
          where e2.task_id = p_task_id
            and ( (e2.event_type in ('contact', 'meeting') and e2.outcome is distinct from 'nao_respondeu')
               or e2.event_type in ('resolve', 'auto_resolve') )
        ), '-infinity'::timestamptz)
$function$
;
