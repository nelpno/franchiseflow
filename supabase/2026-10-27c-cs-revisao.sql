-- 2026-10-27 cs (c) — consertos da revisao de codigo da causa conhecida e do manual sem alarme
--
-- Partindo dos corpos VIVOS (docs/db-backups/*.2026-10-27c-antes.sql):
--   cs_tasks.espera_dias = dias sem venda na hora da anotacao (do franchise_health_cache).
--   registrar: outro resultado so desfaz estacionamento feito pela CAUSA (o "Estacionar" a mao fica).
--   reconcile 1b: vale para cartao manual tambem; acorda com 7+ dias a mais sem venda do que na
--     anotacao (regua _m, nao o texto "Sem venda desde"), ou queda 10 p.p. maior no auto 'caiu'.
--   reconcile 2b: manual nao fecha sozinho se a verba do mes ou a mensalidade estao em aberto.
--   estacionar_cs_cartao e concluir_cs_cartao apagam a marca da causa conhecida.
-- COMO DESFAZER: rodar os 4 backups *.2026-10-27c-antes.sql; a coluna pode ficar.
-- LF. Aplicar por node supabase/cs-cockpit/_aplica-lf.mjs.

begin;

alter table public.cs_tasks add column if not exists espera_dias integer;

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
  if p_outcome is null or p_outcome not in ('vai_fazer', 'recusou', 'nao_respondeu', 'causa_conhecida', 'resolvido') then
    raise exception 'Mural: Resultado inválido: use vai_fazer, recusou, nao_respondeu, causa_conhecida ou resolvido' using errcode = '22023';
  end if;
  if p_outcome = 'causa_conhecida' and char_length(coalesce(v_comm, '')) < 3 then
    raise exception 'Mural: Escreva a causa (aparece no cartão)' using errcode = '22023';
  end if;
  if p_outcome = 'causa_conhecida' and p_next_at > v_hoje + 183 then
    raise exception 'Mural: Rever em no máximo 6 meses' using errcode = '22023';
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
  v_next := case when p_outcome = 'resolvido' then null
                 else coalesce(p_next_at, v_hoje + case p_outcome when 'causa_conhecida' then 30
                                                                  when 'nao_respondeu' then 3 else 7 end) end;

  insert into public.cs_worklist_events
    (task_id, franchise_id, event_type, note, created_by, channel, outcome, commitment, next_at, drive_url)
  values
    (v_task.id, v_fid, v_type, v_note, v_uid, p_channel, p_outcome, v_comm, v_next, v_url)
  returning id into v_ev;

  if v_task.id is not null and v_task.column_status <> 'feito' then
    if p_outcome = 'resolvido' then
      update public.cs_tasks
         set column_status = 'feito', closed_reason = 'resolvido', resolved_at = v_now,
             moved_to_column_at = v_now, next_at = null, updated_at = v_now,
             parked_until = case when espera_sem_venda is not null then null else parked_until end,
             parked_reason = case when espera_sem_venda is not null then null else parked_reason end,
             espera_valor = null, espera_sem_venda = null, espera_dias = null
       where id = v_task.id;
      v_lane := 'resolvidos';
    else
      update public.cs_tasks
         set column_status = 'aguardando_retorno', next_at = v_next,
             moved_to_column_at = v_now, updated_at = v_now,
             parked_until = case when p_outcome = 'causa_conhecida'
                                 then (v_next::timestamp at time zone 'America/Sao_Paulo')
                                 when espera_sem_venda is not null then null else parked_until end,
             parked_reason = case when p_outcome = 'causa_conhecida' then v_comm
                                  when espera_sem_venda is not null then null else parked_reason end,
             espera_valor = case when p_outcome = 'causa_conhecida' then motive_value end,
             espera_dias = case when p_outcome = 'causa_conhecida'
                                then coalesce((select (c.signals->>'days_since_last_sale')::int
                                                 from public.franchise_health_cache c
                                                where c.franchise_id = cs_tasks.franchise_id), 0) end,
             espera_sem_venda = case when p_outcome = 'causa_conhecida' then true end
       where id = v_task.id;
      v_lane := case when p_outcome = 'causa_conhecida' then 'estacionado'
                     when v_next > v_hoje then 'esperando' else 'falar_hoje' end;
    end if;
  end if;

  return jsonb_build_object('event_id', v_ev, 'task_id', v_task.id, 'franchise_id', v_fid,
                            'next_at', v_next, 'lane', v_lane);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_cs_auto_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now  timestamptz := public.cs_agora();
  v_hoje date := public.cs_hoje();
begin
  if not coalesce((select public.is_cs_or_admin()), false) then raise exception 'forbidden'; end if;

  -- 0) cache da saude da rede (igual ao admin-03: as telas Hoje/Unidades/Ficha leem daqui)
  drop table if exists _h;
  create temp table _h on commit drop as select * from public.get_franchise_health_signals();

  insert into public.franchise_health_cache
    (franchise_id, tier, flags, is_standout, signals, buyers, repeat_buyers, computed_at)
  select h.franchise_id, h.tier, coalesce(h.flags, '[]'::jsonb), coalesce(h.is_standout, false),
         to_jsonb(h) - 'flags' - 'tier' - 'is_standout',
         ct.buyers, ct.repeat_buyers, v_now
  from _h h
  left join lateral (
    select count(*)::int as buyers,
           count(*) filter (where c.purchase_count >= 2)::int as repeat_buyers
    from public.contacts c
    where c.franchise_id = h.franchise_id and c.purchase_count >= 1
  ) ct on true
  where h.franchise_id is not null
  on conflict (franchise_id) do update
    set tier = excluded.tier, flags = excluded.flags, is_standout = excluded.is_standout,
        signals = excluded.signals, buyers = excluded.buyers,
        repeat_buyers = excluded.repeat_buyers, computed_at = excluded.computed_at;

  delete from public.franchise_health_cache c
  where not exists (select 1 from _h h where h.franchise_id = c.franchise_id);

  -- regua do Mural (motivos por unidade; top_key nulo = nenhum motivo que vire cartao)
  drop table if exists _m;
  create temp table _m on commit drop as
    select m.*,
           (select string_agg(x->>'text', ' · ' order by ord)
              from jsonb_array_elements(m.motives) with ordinality as a(x, ord)) as alarmes,
           case when m.top_key is not null
                then m.top_text || case when coalesce(m.rev_month_before, 0) >= 1
                                        then ' · vendia ' || public.cs_money(m.rev_month_before) || '/mês' else '' end end as evidencia,
           -- fora da regra = a unidade nao tem NENHUM motivo (nem os que tem acordo: acordo nao e
           -- "resolveu sozinho", conserto B2). Unidade que saiu da regua (teste/inativa) tambem.
           (jsonb_array_length(m.motives) = 0) as sem_motivo
    from public.cs_unit_motives() m;

  -- 1) cartao AUTO aberto: motivo fica congelado; atualiza os alarmes vivos (description),
  --    o numero do motivo (se o MESMO motivo ainda vale) e o relogio "fora da regra".
  --    Cartao auto antigo (antes da Onda 2, motive_key nulo) congela o motivo aqui, 1 vez.
  --    Conserto A1: cartao 'caiu' de unidade SEM LEITURA de queda (base < R$ 3 mil nas duas
  --    medidas), ou que ainda cai em alguma das duas medidas, nao conta como fora da regra —
  --    sem numero nao e melhora, e trocar de medida na virada do mes nao e melhora. Nos dias
  --    1 a 9 o cartao 'caiu' nao arma o fechamento de jeito nenhum (a medida de 28 dias ainda
  --    carrega o mes anterior e oscila com data comemorativa): cai no mais cedo no dia 12.
  with alvo as (
    select t.id, m.franchise_id as mfid, m.top_key, m.top_value, m.evidencia, m.alarmes,
           m.baseline_rev_day, m.rev_month_before, m.motives,
           ( m.franchise_id is null
             or (m.sem_motivo and not (coalesce(t.motive_key, '') = 'caiu'
                                       and (m.caiu_sem_leitura or m.caiu_qualquer_medida
                                            or extract(day from v_hoje) <= 9))) ) as fora
    from cs_tasks t
    left join _m m on m.franchise_id = t.franchise_id
    where t.source = 'auto' and t.archived_at is null and t.column_status <> 'feito'
  )
  update cs_tasks t set
      motive_key       = coalesce(t.motive_key, a.top_key),
      motive_evidence  = coalesce(t.motive_evidence, a.evidencia),
      baseline_rev_day = coalesce(t.baseline_rev_day, case when t.motive_key is null and a.top_key is not null then a.baseline_rev_day end),
      rev_month_before = coalesce(t.rev_month_before, case when t.motive_key is null and a.top_key is not null then a.rev_month_before end),
      motive_value     = coalesce((select (x->>'value')::numeric
                                     from jsonb_array_elements(coalesce(a.motives, '[]'::jsonb)) x
                                    where x->>'key' = coalesce(t.motive_key, a.top_key)
                                      and not (x->>'blocked')::boolean
                                    limit 1), t.motive_value),
      description      = coalesce(a.alarmes, t.description),
      out_of_rule_since = case when a.fora then coalesce(t.out_of_rule_since, v_hoje) end,
      updated_at       = v_now
  from alvo a
  where a.id = t.id
    and ( t.motive_key is null
       or t.description is distinct from coalesce(a.alarmes, t.description)
       or a.fora is distinct from (t.out_of_rule_since is not null)
       or t.motive_value is distinct from coalesce((select (x->>'value')::numeric
                                     from jsonb_array_elements(coalesce(a.motives, '[]'::jsonb)) x
                                    where x->>'key' = coalesce(t.motive_key, a.top_key)
                                      and not (x->>'blocked')::boolean
                                    limit 1), t.motive_value) );

  -- 1b) causa conhecida (estacionado pelo Registrar) volta antes se PIOROU desde a anotacao:
  --     queda 10 p.p. maior (cartao auto 'caiu') ou 7+ dias a mais sem venda do que na anotacao
  --     (qualquer cartao, auto ou manual; dias vem da regua, nao do texto do alarme).
  with acorda as (
    update cs_tasks t set parked_until = null, parked_reason = null,
        espera_valor = null, espera_sem_venda = null, espera_dias = null,
        column_status = 'a_fazer', next_at = null, moved_to_column_at = v_now, updated_at = v_now
    where t.archived_at is null and t.column_status <> 'feito'
      and t.parked_until > v_now and t.espera_sem_venda is not null
      and ( (t.source = 'auto' and t.motive_key = 'caiu' and t.motive_value <= t.espera_valor - 10)
         or exists (select 1 from _m m where m.franchise_id = t.franchise_id
                      and coalesce(m.days_since_last_sale, 0) >= coalesce(t.espera_dias, 0) + 7) )
    returning t.id, t.franchise_id, t.description
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', left('Voltou antes: piorou desde a causa anotada · ' || coalesce(description, ''), 1000), null from acorda;

  -- 2) fechar sozinho: so depois de 3 dias seguidos fora da regra (acaba o pisca-pisca de 1-2
  --    dias). Cartao que foi para o Nelson nao fecha sozinho. Nao arma espera nenhuma.
  with res as (
    update cs_tasks t set column_status = 'feito', closed_reason = 'resolveu_sozinho',
        resolved_at = v_now, moved_to_column_at = v_now, updated_at = v_now,
        parked_until = case when t.espera_sem_venda is not null then null else t.parked_until end,
        parked_reason = case when t.espera_sem_venda is not null then null else t.parked_reason end,
        espera_valor = null, espera_sem_venda = null, espera_dias = null
    where t.source = 'auto' and t.archived_at is null and t.column_status <> 'feito'
      and t.escalated_at is null
      and t.out_of_rule_since is not null and t.out_of_rule_since <= v_hoje - 3
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_resolve', 'Fechado pelo sistema: 3 dias sem motivo para cartão', null from res;

  -- 2b) cartao MANUAL ja conversado (aguardando retorno) com a volta vencida e unidade SEM
  --     nenhum alarme hoje: fecha como 'resolveu_sozinho' em vez de voltar para Falar hoje
  --     (pedido do Celso, 27/10/2026). Se a unidade voltar a ter motivo, o automatico abre na
  --     hora (fechado pelo sistema nao segura os 14 dias). Nao mexe em a_fazer, em andamento,
  --     estacionado nem cartao com o Nelson.
  with fm as (
    update cs_tasks t set column_status = 'feito', closed_reason = 'resolveu_sozinho',
        resolved_at = v_now, moved_to_column_at = v_now, next_at = null, updated_at = v_now
    where t.source = 'manual' and t.archived_at is null and t.column_status = 'aguardando_retorno'
      and t.escalated_at is null
      and (t.parked_until is null or t.parked_until <= v_now)
      and coalesce(t.next_at, (t.moved_to_column_at at time zone 'America/Sao_Paulo')::date + 7) <= v_hoje
      and exists (select 1 from _m m where m.franchise_id = t.franchise_id and m.sem_motivo
                    and (m.mkt_paid or m.nova_trilha) and not coalesce(m.sub_overdue, false))
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_resolve', 'Fechado pelo sistema: unidade sem alarme hoje (cartão manual)', null from fm;

  -- 3) REABRIR o cartao auto da unidade (o mais recente fechado nos ultimos 60 dias, mesmo
  --    arquivado) quando ela volta a ter motivo e nao tem cartao aberto nem estacionado:
  --    - fechado pelo SISTEMA (resolveu_sozinho): volta no dia;
  --    - fechado por PESSOA: volta depois de 14 dias, ou antes se piorou (queda 10 p.p. maior;
  --      ou 7+ dias a mais sem venda) ou se apareceu um motivo MAIS GRAVE que o do fechamento e
  --      que nao estava nos alarmes quando fechou (conserto M3: motivo de prioridade menor, ou que
  --      ja estava la, nao reabre antes dos 14 dias).
  --    Guarda o fechamento anterior (last_closed_reason/at) e soma reopen_count.
  with ult as (
    select distinct on (t.franchise_id) t.*
    from cs_tasks t
    where t.source = 'auto' and t.column_status = 'feito'
      and t.resolved_at > v_now - interval '60 days'
    order by t.franchise_id, t.resolved_at desc
  ),
  cand as (
    select u.id, u.franchise_id, m.top_key, m.top_value, m.evidencia, m.alarmes,
           m.baseline_rev_day, m.rev_month_before
    from ult u
    join _m m on m.franchise_id = u.franchise_id and m.top_key is not null
    where not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.archived_at is null and o.column_status <> 'feito')
      and not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.parked_until > v_now)
      and not exists (select 1 from cs_tasks o where o.franchise_id = u.franchise_id
                        and o.source = 'manual' and o.column_status = 'feito'
                        and coalesce(o.closed_reason, '') <> 'resolveu_sozinho'
                        and o.resolved_at > v_now - interval '14 days')
      and ( u.closed_reason = 'resolveu_sozinho'
         or u.resolved_at <= v_now - interval '14 days'
         or ( u.motive_key is not null
              and public.cs_motive_ord(m.top_key) < public.cs_motive_ord(u.motive_key)
              and position(public.cs_motive_prefix(m.top_key) in coalesce(u.description, '')) = 0 )
         or (u.motive_key = 'caiu' and m.top_key = 'caiu' and m.top_value <= u.motive_value - 10)
         or (u.motive_key = 'sem_venda' and m.top_key = 'sem_venda' and m.top_value >= u.motive_value + 7) )
  ),
  reopened as (
    update cs_tasks t set
        column_status = 'a_fazer', resolved_at = null, archived_at = null,
        moved_to_column_at = v_now, updated_at = v_now,
        reopen_count = t.reopen_count + 1,
        last_closed_reason = t.closed_reason, last_closed_at = t.resolved_at,
        closed_reason = null, next_at = null, out_of_rule_since = null,
        escalated_at = null, escalated_note = null,
        motive_key = c.top_key, motive_value = c.top_value, motive_evidence = c.evidencia,
        baseline_rev_day = c.baseline_rev_day, rev_month_before = c.rev_month_before,
        description = c.alarmes,
        assignee = coalesce(t.assignee, public.cs_default_assignee())
    from cand c
    where t.id = c.id
    returning t.id, t.franchise_id, t.motive_evidence
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', 'Reaberto: ' || motive_evidence, null from reopened;

  -- 4) CRIAR cartao auto para unidade com motivo, sem cartao aberto (manual ou auto), sem
  --    cartao estacionado, sem cartao auto fechado nos ultimos 60 dias (esse e reaberto no
  --    passo 3, ou esta na espera de 14 dias) e sem cartao manual fechado por pessoa nos
  --    ultimos 14 dias. Unidade de teste e nova na trilha ja estao fora da regua.
  with cand as (
    select m.*
    from _m m
    where m.top_key is not null
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.archived_at is null and t.column_status <> 'feito')
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.parked_until > v_now)
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.source = 'auto' and t.column_status = 'feito'
                        and t.resolved_at > v_now - interval '60 days')
      and not exists (select 1 from cs_tasks t where t.franchise_id = m.franchise_id
                        and t.source = 'manual' and t.column_status = 'feito'
                        and coalesce(t.closed_reason, '') <> 'resolveu_sozinho'
                        and t.resolved_at > v_now - interval '14 days')
  ),
  ins as (
    insert into cs_tasks (franchise_id, title, description, column_status, source, signal_key, priority,
                          created_by, motive_key, motive_evidence, motive_value, baseline_rev_day, rev_month_before)
    select c.franchise_id, 'Cuidar da ' || coalesce(c.franchise_name, c.franchise_id),
           c.alarmes, 'a_fazer', 'auto', 'auto:' || c.franchise_id, 'alta', null,
           c.top_key, c.evidencia, c.top_value, c.baseline_rev_day, c.rev_month_before
    from cand c
    on conflict (franchise_id) where source = 'auto' and archived_at is null and column_status <> 'feito'
    do nothing
    returning id, franchise_id, motive_evidence
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_open', motive_evidence, null from ins;

  -- 5) arquivar 'feito' com +14 dias se a unidade esta sem motivo (o Mural ainda mostra os
  --    resolvidos de 30 dias, arquivados ou nao). Estacionado nao arquiva.
  update cs_tasks t set archived_at = v_now
  where t.column_status = 'feito' and t.archived_at is null
    and coalesce(t.resolved_at, t.moved_to_column_at) < v_now - interval '14 days'
    and (t.parked_until is null or t.parked_until <= v_now)
    and not exists (select 1 from _m m where m.franchise_id = t.franchise_id and m.top_key is not null);
end $function$
;

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
    update public.cs_tasks set parked_until = null, parked_reason = null, updated_at = v_now,
        espera_valor = null, espera_sem_venda = null, espera_dias = null
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
  update public.cs_tasks set parked_until = v_ate_ts, parked_reason = v_motivo, updated_at = v_now,
        espera_valor = null, espera_sem_venda = null, espera_dias = null
   where id = v_task.id;
  insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  values (v_task.id, v_task.franchise_id, 'park',
          'Estacionado até ' || to_char(p_ate, 'DD/MM/YYYY') || ': ' || v_motivo, v_uid);
  return jsonb_build_object('task_id', v_task.id, 'parked_until', v_ate_ts);
end;
$function$
;

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
         moved_to_column_at = v_now, next_at = null, updated_at = v_now,
         parked_until = case when espera_sem_venda is not null then null else parked_until end,
         parked_reason = case when espera_sem_venda is not null then null else parked_reason end,
         espera_valor = null, espera_sem_venda = null, espera_dias = null
   where id = v_task.id;
  insert into public.cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  values (v_task.id, v_task.franchise_id, 'resolve', v_note, v_uid);
  return jsonb_build_object('task_id', v_task.id, 'lane', 'resolvidos', 'closed_reason', p_desfecho);
end;
$function$
;

commit;
