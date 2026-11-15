-- Backup do corpo VIVO (pg_get_functiondef) antes de supabase/2026-11-10-cs-mural-consertos.sql. Reaplicar este arquivo = voltar.
CREATE OR REPLACE FUNCTION public.cs_card_lanes()
 RETURNS TABLE(task_id uuid, lane text, lane_since date, volta_vencida boolean, motive_rank integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with d as (select public.cs_hoje() as hoje)
  select t.id,
    case
      when t.parked_until > public.cs_agora() then 'estacionado'
      when t.column_status = 'feito' then 'resolvidos'
      when t.escalated_at is not null then 'com_nelson'
      when t.column_status = 'aguardando_retorno'
           and coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7) > d.hoje
        then 'esperando'
      else 'falar_hoje'
    end,
    case
      when t.parked_until > public.cs_agora() then (t.parked_until at time zone 'America/Sao_Paulo')::date
      when t.column_status = 'feito' then (t.resolved_at at time zone 'America/Sao_Paulo')::date
      when t.column_status = 'aguardando_retorno'
        then coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7)
      else (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date
    end,
    (t.column_status = 'aguardando_retorno' and t.next_at is not null and t.next_at <= d.hoje),
    case coalesce(t.motive_key, case when t.source = 'manual' then 'manual' end) when 'sem_venda' then 1 when 'caiu' then 2 when 'nao_lanca' then 3
                      when 'robo_parado' then 4 when 'sem_comprar' then 5 when 'manual' then 6 else 7 end
  from public.cs_tasks t
  cross join d
  left join public.franchises f on f.evolution_instance_id = t.franchise_id
  where not coalesce(f.is_test, false)
    and ( (t.archived_at is null and t.column_status <> 'feito')
       or (t.column_status = 'feito' and t.resolved_at >= public.cs_agora() - interval '30 days')
       or (t.archived_at is null and t.parked_until > public.cs_agora()) )
$function$
;
