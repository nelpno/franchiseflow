-- 2026-09-27 cs 04 — registrar conversa, concluir e estacionar cartao (RPCs do Mural)
--
-- O QUE FAZ
--   registrar_cs_conversa(franquia, cartao, canal, resultado, combinado, voltar_em, nota, link_drive)
--     grava 1 evento (meeting se canal = reuniao, senao contact) com canal/resultado/combinado/
--     voltar em/link. Sem cartao informado usa o aberto da unidade (o automatico primeiro); sem
--     nenhum aberto, grava so o evento com a unidade (nao cria cartao). Efeito no cartao aberto:
--     resultado 'resolvido' fecha (closed_reason 'resolvido'); os outros levam para
--     aguardando_retorno com next_at = voltar_em ou hoje + 7 (volta sozinho para "Falar hoje").
--   concluir_cs_cartao(cartao, desfecho, nota): resolvido | combinado_feito | recusou |
--     nao_responde fecham com o desfecho (evento 'resolve'); vai_para_nelson NAO fecha: marca
--     escalated_at/escalated_note (evento 'escalate', nota obrigatoria).
--   estacionar_cs_cartao(cartao, ate, motivo): parked_until = comeco do dia 'ate' em SP (ate 6
--     meses), motivo obrigatorio, evento 'park'. ate = null tira do estacionamento.
-- Todas: SECURITY DEFINER, search_path public, guard coalesce(is_cs_or_admin(), false), datas SP,
-- sem EXECUTE para anon/public. Mensagens de erro para a pessoa comecam com "Mural: " —
-- o front precisa acrescentar "Mural:" em PREFIXOS_SEGUROS (src/lib/safeErrorMessage.js),
-- senao o toast mostra o texto generico.
--
-- POR QUE: o Mural so guardava "falei"/"resolvi"; sem resultado, combinado e data de volta nao
-- ha fila do dia nem medida (estudo 26/09, secoes 3 e 5b).
--
-- Cartao manual sem unidade (franchise_id nulo) aceita registro: a unidade so e obrigatoria
-- quando nao ha cartao (M2).
-- IDEMPOTENTE (create or replace). LF. Depois do 01.
--
-- COMO DESFAZER
--   drop function public.registrar_cs_conversa(text, uuid, text, text, text, date, text, text);
--   drop function public.concluir_cs_cartao(uuid, text, text);
--   drop function public.estacionar_cs_cartao(uuid, date, text);

begin;

-- ---------- 1) registrar_cs_conversa ----------
create or replace function public.registrar_cs_conversa(
  p_franchise_id text,
  p_task_id uuid,
  p_channel text,
  p_outcome text,
  p_commitment text default null,
  p_next_at date default null,
  p_note text default null,
  p_drive_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
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
$$;

-- ---------- 2) concluir_cs_cartao ----------
create or replace function public.concluir_cs_cartao(p_task_id uuid, p_desfecho text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
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
$$;

-- ---------- 3) estacionar_cs_cartao ----------
create or replace function public.estacionar_cs_cartao(p_task_id uuid, p_ate date, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
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
$$;

revoke execute on function public.registrar_cs_conversa(text, uuid, text, text, text, date, text, text) from public, anon;
revoke execute on function public.concluir_cs_cartao(uuid, text, text) from public, anon;
revoke execute on function public.estacionar_cs_cartao(uuid, date, text) from public, anon;
grant execute on function public.registrar_cs_conversa(text, uuid, text, text, text, date, text, text) to authenticated, service_role;
grant execute on function public.concluir_cs_cartao(uuid, text, text) to authenticated, service_role;
grant execute on function public.estacionar_cs_cartao(uuid, date, text) to authenticated, service_role;

commit;
