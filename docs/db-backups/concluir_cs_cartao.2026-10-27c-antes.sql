CREATE OR REPLACE FUNCTION public.concluir_cs_cartao(p_task_id uuid, p_desfecho text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid  uuid := (select auth.uid());
  v_now  timestamptz := now();
  v_task public.cs_tasks%rowtype;
  v_note text := nullif(trim(p_note), '');
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: Sem permissão para concluir cartão' using errcode = '42501';
  end if;
  if p_desfecho is null or p_desfecho not in ('resolvido', 'combinado_feito', 'recusou', 'nao_responde', 'vai_para_nelson') then
    raise exception 'Mural: Desfecho inválido' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'Mural: Nota com mais de 1000 caracteres' using errcode = '22023';
  end if;

  select * into v_task from public.cs_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Mural: Cartão não encontrado' using errcode = 'P0002';
  end if;
  if v_task.column_status = 'feito' then
    raise exception 'Mural: Este cartão já está fechado' using errcode = '22023';
  end if;

  if p_desfecho = 'vai_para_nelson' then
    if v_note is null or char_length(v_note) < 3 then
      raise exception 'Mural: Escreva o que o Nelson precisa decidir' using errcode = '22023';
    end if;
    update public.cs_tasks
       set escalated_at = v_now, escalated_note = v_note, updated_at = v_now
     where id = v_task.id;
    insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
    values (v_task.id, v_task.franchise_id, 'escalate', v_note, v_uid);
    return jsonb_build_object('task_id', v_task.id, 'lane', 'com_nelson');
  end if;

  update public.cs_tasks
     set column_status = 'feito', closed_reason = p_desfecho, resolved_at = v_now,
         moved_to_column_at = v_now, next_at = null, updated_at = v_now
   where id = v_task.id;
  insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  values (v_task.id, v_task.franchise_id, 'resolve', v_note, v_uid);
  return jsonb_build_object('task_id', v_task.id, 'lane', 'resolvidos', 'closed_reason', p_desfecho);
end;
$function$
;
