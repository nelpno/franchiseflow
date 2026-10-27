CREATE OR REPLACE FUNCTION public.estacionar_cs_cartao(p_task_id uuid, p_ate date, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := (select auth.uid());
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_now    timestamptz := now();
  v_task   public.cs_tasks%rowtype;
  v_motivo text := nullif(trim(p_motivo), '');
  v_ate_ts timestamptz;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: Sem permissão para estacionar cartão' using errcode = '42501';
  end if;
  select * into v_task from public.cs_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Mural: Cartão não encontrado' using errcode = 'P0002';
  end if;

  if p_ate is null then
    update public.cs_tasks set parked_until = null, parked_reason = null, updated_at = v_now
     where id = v_task.id;
    insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
    values (v_task.id, v_task.franchise_id, 'park', 'Voltou para a fila', v_uid);
    return jsonb_build_object('task_id', v_task.id, 'parked_until', null);
  end if;

  if p_ate <= v_hoje then
    raise exception 'Mural: A data de voltar precisa ser depois de hoje' using errcode = '22023';
  end if;
  if p_ate > v_hoje + 180 then
    raise exception 'Mural: Estacione por no máximo 6 meses' using errcode = '22023';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'Mural: Escreva o motivo de estacionar' using errcode = '22023';
  end if;
  if char_length(v_motivo) > 300 then
    raise exception 'Mural: Motivo com mais de 300 caracteres' using errcode = '22023';
  end if;

  -- volta no comeco do dia escolhido, no horario de Sao Paulo
  v_ate_ts := (p_ate::timestamp at time zone 'America/Sao_Paulo');
  update public.cs_tasks set parked_until = v_ate_ts, parked_reason = v_motivo, updated_at = v_now
   where id = v_task.id;
  insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  values (v_task.id, v_task.franchise_id, 'park',
          'Estacionado até ' || to_char(p_ate, 'DD/MM/YYYY') || ': ' || v_motivo, v_uid);
  return jsonb_build_object('task_id', v_task.id, 'parked_until', v_ate_ts);
end;
$function$
;
