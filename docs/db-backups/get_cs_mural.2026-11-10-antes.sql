-- Backup do corpo VIVO (pg_get_functiondef) antes de supabase/2026-11-10-cs-mural-consertos.sql. Reaplicar este arquivo = voltar.
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
  meses as (select array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                         'setembro','outubro','novembro','dezembro'] as nomes),
  cards as (
    select
      l.lane, l.lane_since, l.volta_vencida, l.motive_rank, t.created_at as t_created,
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
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'cards', coalesce((
        select jsonb_agg(c.card order by
          case c.lane when 'falar_hoje' then 1 when 'esperando' then 2 when 'com_nelson' then 3
                      when 'estacionado' then 4 else 5 end,
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
