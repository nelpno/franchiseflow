CREATE OR REPLACE FUNCTION public.registrar_cs_conversa(p_franchise_id text, p_task_id uuid, p_channel text, p_outcome text, p_commitment text DEFAULT NULL::text, p_next_at date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_drive_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := (select auth.uid());
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_now   timestamptz := now();
  v_fid   text := nullif(trim(p_franchise_id), '');
  v_task  public.cs_tasks%rowtype;
  v_note  text := nullif(trim(p_note), '');
  v_comm  text := nullif(trim(p_commitment), '');
  v_url   text := nullif(trim(p_drive_url), '');
  v_type  text;
  v_next  date;
  v_ev    uuid;
  v_lane  text := null;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: Sem permissão para registrar conversa' using errcode = '42501';
  end if;
  if p_channel is null or p_channel not in ('mensagem', 'ligacao', 'reuniao') then
    raise exception 'Mural: Canal inválido: use mensagem, ligacao ou reuniao' using errcode = '22023';
  end if;
  if p_outcome is null or p_outcome not in ('vai_fazer', 'recusou', 'nao_respondeu', 'resolvido') then
    raise exception 'Mural: Resultado inválido: use vai_fazer, recusou, nao_respondeu ou resolvido' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'Mural: Nota com mais de 1000 caracteres' using errcode = '22023';
  end if;
  if char_length(coalesce(v_comm, '')) > 300 then
    raise exception 'Mural: Combinado com mais de 300 caracteres' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~* '^https://' or char_length(v_url) > 500) then
    raise exception 'Mural: Link da reunião precisa começar com https://' using errcode = '22023';
  end if;
  if p_next_at is not null and p_next_at < v_hoje then
    raise exception 'Mural: A data de voltar não pode ser no passado' using errcode = '22023';
  end if;

  if p_task_id is not null then
    select * into v_task from public.cs_tasks where id = p_task_id;
    if not found then
      raise exception 'Mural: Cartão não encontrado' using errcode = 'P0002';
    end if;
    if v_fid is not null and v_task.franchise_id is distinct from v_fid then
      raise exception 'Mural: O cartão é de outra unidade' using errcode = '22023';
    end if;
    v_fid := v_task.franchise_id;
  else
    if v_fid is null then
      raise exception 'Mural: Informe a unidade ou o cartão' using errcode = '22023';
    end if;
    -- cartao aberto da unidade: o automatico primeiro, depois o mexido mais recente
    select * into v_task from public.cs_tasks
     where franchise_id = v_fid and archived_at is null and column_status <> 'feito'
     order by (source = 'auto') desc, moved_to_column_at desc
     limit 1;
  end if;

  -- unidade so e obrigatoria sem cartao (cartao manual pode nao ter unidade — conserto M2)
  if v_task.id is null
     and (v_fid is null or not exists (select 1 from public.franchises f where f.evolution_instance_id = v_fid)) then
    raise exception 'Mural: Unidade não encontrada' using errcode = 'P0002';
  end if;

  v_type := case when p_channel = 'reuniao' then 'meeting' else 'contact' end;
  v_next := case when p_outcome = 'resolvido' then null else coalesce(p_next_at, v_hoje + 7) end;

  insert into public.cs_worklist_events
    (task_id, franchise_id, event_type, note, created_by, channel, outcome, commitment, next_at, drive_url)
  values
    (v_task.id, v_fid, v_type, v_note, v_uid, p_channel, p_outcome, v_comm, v_next, v_url)
  returning id into v_ev;

  if v_task.id is not null and v_task.column_status <> 'feito' then
    if p_outcome = 'resolvido' then
      update public.cs_tasks
         set column_status = 'feito', closed_reason = 'resolvido', resolved_at = v_now,
             moved_to_column_at = v_now, next_at = null, updated_at = v_now
       where id = v_task.id;
      v_lane := 'resolvidos';
    else
      update public.cs_tasks
         set column_status = 'aguardando_retorno', next_at = v_next,
             moved_to_column_at = v_now, updated_at = v_now
       where id = v_task.id;
      v_lane := case when v_next > v_hoje then 'esperando' else 'falar_hoje' end;
    end if;
  end if;

  return jsonb_build_object('event_id', v_ev, 'task_id', v_task.id, 'franchise_id', v_fid,
                            'next_at', v_next, 'lane', v_lane);
end;
$function$
;
