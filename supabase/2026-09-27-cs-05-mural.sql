-- 2026-09-27 cs 05 — get_cs_mural(): as raias do Mural calculadas no banco
--
-- O QUE FAZ
--   cs_card_lanes() (interna): raia de cada cartao aberto + resolvidos dos ultimos 30 dias
--   (unidade de teste fora) + estacionados (abertos ou fechados), na precedencia:
--     estacionado = parked_until no futuro (lane_since = dia em que volta). Vem ANTES de
--                   resolvidos: cartao fechado e estacionado (ex.: Uberlandia ate 01/11) e
--                   "nao mexer ate", nao vitoria.
--     resolvidos  = 'feito' com resolved_at nos ultimos 30 dias (arquivado ou nao)
--     com_nelson  = escalated_at preenchido e aberto
--     esperando   = aguardando_retorno com volta (next_at, ou movido + 7 dias) depois de hoje SP
--     falar_hoje  = o resto (a_fazer, em_andamento, aguardando com volta vencida)
--   get_cs_mural() → { hoje, cards: [...], counts: {...} } no formato do CONTRATO (secao 1),
--   com campos extras (lane_since, volta_vencida, column_status, baseline_rev_day,
--   rede_delta_pct, agreement.signal_key, last_event.next_at/drive_url).
--   Ordem em falar_hoje: volta vencida primeiro, depois motivo (sem_venda, caiu, nao_lanca,
--   robo_parado, sem_comprar, manual, antigo sem motivo), depois R$ em risco (rev_month_before).
--   alarms = motivos VIVOS da unidade (os que tem acordo vem com "(tem acordo)": acordo nunca
--   cala alarme) + "Verba de <mes> nao paga" + "Mensalidade vencida".
--   counts.resolvidos NAO inclui 'resolveu_sozinho' (contado a parte, nunca como vitoria).
--   Cartao manual sem motive_key conta como 'manual' (B1). Relogio = cs_agora()/cs_hoje().
--
-- POR QUE: a tela so desenha; a regra da fila fica em um lugar so (estudo 26/09, secao 5a/5b).
--
-- IDEMPOTENTE (create or replace). LF. Depois do 01 e do 02.
--
-- COMO DESFAZER
--   drop function public.get_cs_mural();
--   drop function public.cs_card_lanes();   -- so depois de desfazer 06

begin;

-- ---------- raias (interna, fonte unica: Mural e Progresso leem daqui) ----------
create or replace function public.cs_card_lanes()
returns table(task_id uuid, lane text, lane_since date, volta_vencida boolean, motive_rank integer)
language sql
stable
set search_path = 'public'
as $$
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
$$;

revoke execute on function public.cs_card_lanes() from public, anon, authenticated;
grant execute on function public.cs_card_lanes() to service_role;

-- ---------- get_cs_mural ----------
create or replace function public.get_cs_mural()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
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
$$;

revoke execute on function public.get_cs_mural() from public, anon;
grant execute on function public.get_cs_mural() to authenticated, service_role;

commit;
