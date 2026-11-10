-- 2026-11-10 cs (c) — revisao de codigo dos consertos do Mural (465cacd, 3a2fce6)
--   cs_sem_resposta_seguidas: a contagem zera tambem no evento 'escalate' (antes, o cartao que voltava
--     do Nelson, escalated_at nulo, ia de novo ao Nelson no 5o "sem resposta").
--   get_cs_mural: hoje_motivo ignora motivo com acordo (blocked); sem_resposta_seguidas sai de um CTE
--     agrupado (mesma regra do helper; conferido igual em 69/69 cartoes) em vez de 2 varreduras por cartao.
-- COMO DESFAZER (ROLLBACK), por node supabase/cs-cockpit/_aplica-lf.mjs <arq>:
--   docs/db-backups/cs_sem_resposta_seguidas.2026-11-10c-antes.sql
--   docs/db-backups/get_cs_mural.2026-11-10c-antes.sql
-- LF. Aplicar por node supabase/cs-cockpit/_aplica-lf.mjs.

begin;

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
               or e2.event_type in ('resolve', 'auto_resolve', 'escalate') )
        ), '-infinity'::timestamptz)
$function$
;

CREATE OR REPLACE FUNCTION public.get_cs_mural()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoje date := public.cs_hoje();
  v_out  jsonb;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Mural: sem permissão' using errcode = '42501';
  end if;

  with
  ln as (select * from public.cs_card_lanes()),
  mm as (select * from public.cs_unit_motives()),
  nr as (
    select x.task_id,
           count(*) filter (where x.event_type in ('contact', 'meeting') and x.outcome = 'nao_respondeu'
                              and x.created_at > coalesce(x.corte, '-infinity'::timestamptz))::int as n
    from (select e.task_id, e.event_type, e.outcome, e.created_at,
                 max(e.created_at) filter (where (e.event_type in ('contact', 'meeting') and e.outcome is distinct from 'nao_respondeu')
                                              or e.event_type in ('resolve', 'auto_resolve', 'escalate'))
                   over (partition by e.task_id) as corte
          from public.cs_worklist_events e
          where e.task_id in (select l2.task_id from ln l2)) x
    group by x.task_id
  ),
  meses as (select array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                         'setembro','outubro','novembro','dezembro'] as nomes),
  cards as (
    select
      l.lane, l.lane_since, l.volta_vencida, l.motive_rank, t.created_at as t_created, r.risco_mes, t.out_of_rule_since as t_oor,
      jsonb_build_object(
        'id', t.id,
        'franchise_id', t.franchise_id,
        'franchise_name', f.name,
        'owner_name', f.owner_name,
        'phone', nullif(regexp_replace(coalesce(nullif(f.phone_number, ''), nullif(fc.personal_phone_for_summary, '')), '\D', '', 'g'), ''),
        'lane', l.lane,
        'lane_since', l.lane_since,
        'volta_vencida', l.volta_vencida,
        'source', t.source,
        'column_status', t.column_status,
        'motive_key', coalesce(t.motive_key, case when t.source = 'manual' then 'manual' end),
        'motive_evidence', t.motive_evidence,
        'title', t.title,
        'description', t.description,
        'rev_month_before', t.rev_month_before,
        'baseline_rev_day', t.baseline_rev_day,
        'rev_mtd', m.rev_mtd,
        'rev_delta_pct', m.rev_delta_pct,
        'rede_delta_pct', m.rede_delta_pct,
        'days_since_last_sale', m.days_since_last_sale,
        'next_at', t.next_at,
        'moved_to_column_at', t.moved_to_column_at,
        'created_at', t.created_at,
        'resolved_at', t.resolved_at,
        'closed_reason', t.closed_reason,
        'escalated_at', t.escalated_at,
        'escalated_note', t.escalated_note,
        'parked_until', t.parked_until,
        'parked_reason', t.parked_reason,
        'reopen_count', t.reopen_count,
        'last_closed_reason', t.last_closed_reason,
        'last_closed_at', t.last_closed_at,
        'assignee_name', pa.full_name,
        'agreement', m.agreement,
        'base_mes', r.base_mes,
        'rev_28d', m.rev_28d,
        'ritmo_mes', r.ritmo_mes,
        'risco_mes', r.risco_mes,
        'out_of_rule_since', t.out_of_rule_since,
        'top_motivo_key', m.top_key,
        'top_motivo_texto', m.top_text,
        'hoje_motivo', (select x->>'text' from jsonb_array_elements(coalesce(m.motives, '[]'::jsonb)) x
                         where x->>'key' = t.motive_key and not coalesce((x->>'blocked')::boolean, false) limit 1),
        'hoje_queda_pct', m.caiu_base_delta,
        'hoje_queda_metodo', m.caiu_base_metodo,
        'sem_resposta_seguidas', coalesce(nr.n, 0),
        'alarms', coalesce((
            select jsonb_agg(x.txt order by x.o)
            from (
              select (a.elem->>'text') || case when (a.elem->>'blocked')::boolean then ' (tem acordo)' else '' end as txt, a.ord as o
                from jsonb_array_elements(coalesce(m.motives, '[]'::jsonb)) with ordinality as a(elem, ord)
              union all
              select 'Verba de ' || (select nomes[extract(month from v_hoje)::int] from meses) || ' não paga', 100
               where m.franchise_id is not null and not m.mkt_paid and not m.nova_trilha
              union all
              select 'Mensalidade vencida', 101 where coalesce(m.sub_overdue, false)
            ) x), '[]'::jsonb),
        'last_event', (
            select jsonb_build_object('event_type', e.event_type, 'channel', e.channel, 'outcome', e.outcome,
                                      'note', e.note, 'commitment', e.commitment, 'next_at', e.next_at,
                                      'drive_url', e.drive_url, 'created_at', e.created_at,
                                      'author_name', coalesce(pe.full_name, case when e.created_by is null then 'Sistema' end))
            from public.cs_worklist_events e
            left join public.profiles pe on pe.id = e.created_by
            where e.task_id = t.id
            order by e.created_at desc
            limit 1)
      ) as card,
      t.rev_month_before
    from ln l
    join public.cs_tasks t on t.id = l.task_id
    left join public.franchises f on f.evolution_instance_id = t.franchise_id
    left join public.franchise_configurations fc on fc.franchise_evolution_instance_id = t.franchise_id
    left join mm m on m.franchise_id = t.franchise_id
    left join public.profiles pa on pa.id = t.assignee
    left join nr on nr.task_id = t.id
    left join lateral (
      select b.base_mes, b.ritmo_mes,
             case when b.base_mes > 0 and b.ritmo_mes is not null
                  then greatest(0, b.base_mes - b.ritmo_mes) end as risco_mes
      from (select round(coalesce(t.rev_month_before, m.rev_month_before)) as base_mes,
                   round(m.rev_28d * 30 / 28.0) as ritmo_mes) b
    ) r on true
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'cards', coalesce((
        select jsonb_agg(c.card order by
          case c.lane when 'falar_hoje' then 1 when 'esperando' then 2 when 'com_nelson' then 3
                      when 'estacionado' then 4 else 5 end,
          case when c.lane = 'falar_hoje' then (c.t_oor is not null)::int end,
          case when c.lane = 'falar_hoje' then c.risco_mes end desc nulls last,
          case when c.lane = 'falar_hoje' then (not c.volta_vencida)::int end,
          case when c.lane = 'falar_hoje' then c.motive_rank end,
          case when c.lane = 'falar_hoje' then c.rev_month_before end desc nulls last,
          case when c.lane = 'esperando' then c.lane_since end,
          case when c.lane = 'resolvidos' then c.lane_since end desc,
          c.t_created)
        from cards c), '[]'::jsonb),
    'counts', jsonb_build_object(
        'falar_hoje',       (select count(*) from cards where lane = 'falar_hoje'),
        'esperando',        (select count(*) from cards where lane = 'esperando'),
        'com_nelson',       (select count(*) from cards where lane = 'com_nelson'),
        'estacionado',      (select count(*) from cards where lane = 'estacionado'),
        'resolvidos',       (select count(*) from cards where lane = 'resolvidos'
                               and coalesce(card->>'closed_reason', '') <> 'resolveu_sozinho'),
        'resolveu_sozinho', (select count(*) from cards where lane = 'resolvidos'
                               and card->>'closed_reason' = 'resolveu_sozinho'))
  ) into v_out;

  return v_out;
end;
$function$
;

commit;
