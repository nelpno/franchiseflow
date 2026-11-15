-- 2026-09-27 cs 06 — "Progresso do CS" e placar de impacto (so admin)
--
-- O QUE FAZ
--   get_cs_progresso(ini, fim) → atividade (conversas, unidades, reunioes feitas/gravadas,
--     dias com registro, combinados criados/vencidos, mediana de dias ate o 1o contato depois
--     que o cartao abre), por_semana (segunda a domingo), fila (falar hoje, parados ha mais de
--     2 dias, esquecidos 7 dias, unidades com motivo e sem cartao), desfechos do periodo e a
--     lista "com o Nelson".
--   get_cs_impacto(ini, fim) → o placar da secao 4.3 do estudo, rodando sozinho: episodios
--     de reuniao (reuniao sem outra nos 21 dias antes) e de mensagem solta (1o toque apos 21+
--     dias sem toque, sem reuniao por perto), 28 dias antes x 28 depois, contra a mediana das
--     unidades nao tocadas no mesmo periodo. Metodo detalhado no comentario acima da funcao.
--     DESVIO DO CONTRATO: o contrato diz "episodio = 1o contato/reuniao apos 21+ dias sem
--     contato"; para reuniao segui o estudo (a reuniao conta mesmo com mensagens antes — foi
--     assim que a 4.3 achou as 7). Reuniao antiga usa a data escrita na nota ("📅 26/08/2026").
--     LIMITE: o Mural so tem 4 das 7 reunioes da 4.3 (as outras estao so no Drive, estudo R8);
--     o placar automatico so bate com o estudo depois que as reunioes forem registradas como
--     "Reuniao feita" (ou se o Nelson autorizar lancar as do Drive, ver simulacao).
-- Guard: coalesce(is_admin(), false) — o Celso (manager) nao ve o placar dele mesmo.
-- SECURITY DEFINER, search_path public, datas SP, unidade de teste fora, sem EXECUTE para anon.
--
-- POR QUE: hoje o placar sai de revisao manual; o do mes (tocadas x nao tocadas) pune o CS por
-- escolher as doentes. O por episodio com controle e o unico honesto (estudo, 4.2 e 4.3).
--
-- IDEMPOTENTE (create or replace). LF. Depois do 01, 02 e 05.
--
-- COMO DESFAZER
--   drop function public.get_cs_progresso(date, date);
--   drop function public.get_cs_impacto(date, date);

begin;

-- ---------- get_cs_progresso (so admin) ----------
create or replace function public.get_cs_progresso(p_ini date, p_fim date)
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
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Mural: só o administrador vê o progresso do CS' using errcode = '42501';
  end if;
  if p_ini is null or p_fim is null or p_ini > p_fim then
    raise exception 'Mural: período inválido' using errcode = '22023';
  end if;
  if p_fim - p_ini > 366 then
    raise exception 'Mural: período maior que 1 ano' using errcode = '22023';
  end if;

  with
  teste as (select evolution_instance_id as fid from public.franchises where coalesce(is_test, false)),
  ev_all as (
    select e.*, (e.created_at at time zone 'America/Sao_Paulo')::date as dia,
           (e.event_type in ('contact', 'meeting')) as conversa,
           (e.channel = 'reuniao' or (e.channel is null and e.event_type = 'meeting')) as reuniao
    from public.cs_worklist_events e
    where not exists (select 1 from teste x where x.fid = e.franchise_id)
  ),
  ev as (select * from ev_all where created_by is not null and dia between p_ini and p_fim),
  primeiro as (
    select o.task_id, o.dia as dia_abriu,
           (select min(h.dia) from ev_all h
             where h.task_id = o.task_id and h.created_by is not null and h.conversa
               and h.created_at >= o.created_at) as dia_contato
    from ev_all o
    where o.event_type = 'auto_open' and o.created_by is null and o.dia between p_ini and p_fim
  ),
  semanas as (
    select gs::date as ini
    from generate_series(date_trunc('week', p_ini::timestamp), p_fim::timestamp, interval '7 days') gs
  ),
  ln as (select * from public.cs_card_lanes()),
  abertos as (
    select t.*, l.lane, l.lane_since
    from public.cs_tasks t join ln l on l.task_id = t.id
    where l.lane <> 'resolvidos'
  ),
  mm as (select * from public.cs_unit_motives())
  select jsonb_build_object(
    'periodo', jsonb_build_object('ini', p_ini, 'fim', p_fim, 'hoje', v_hoje),
    'atividade', jsonb_build_object(
      'conversas',           (select count(*) from ev where conversa),
      'unidades_faladas',    (select count(distinct franchise_id) from ev where conversa),
      'reunioes_feitas',     (select count(*) from ev where reuniao),
      'reunioes_gravadas',   (select count(*) from ev where drive_url is not null),
      'dias_com_registro',   (select count(distinct dia) from ev),
      'combinados_criados',  (select count(*) from ev where commitment is not null),
      'combinados_vencidos', (select count(*) from ev c
                               where c.commitment is not null and c.next_at < v_hoje
                                 and not exists (select 1 from ev_all h
                                                  where h.franchise_id = c.franchise_id and h.created_by is not null
                                                    and h.conversa and h.created_at > c.created_at)),
      'mediana_dias_ate_1o_contato', (select round((percentile_cont(0.5) within group (order by (dia_contato - dia_abriu)))::numeric, 1)
                                        from primeiro where dia_contato is not null),
      'aberturas_sem_contato', (select count(*) from primeiro where dia_contato is null)
    ),
    'por_semana', coalesce((
      select jsonb_agg(jsonb_build_object(
               'semana_ini', s.ini,
               'conversas', (select count(*) from ev where conversa and dia >= s.ini and dia < s.ini + 7),
               'unidades',  (select count(distinct franchise_id) from ev where conversa and dia >= s.ini and dia < s.ini + 7),
               'reunioes',  (select count(*) from ev where reuniao and dia >= s.ini and dia < s.ini + 7))
             order by s.ini)
      from semanas s), '[]'::jsonb),
    'fila', jsonb_build_object(
      'falar_hoje',             (select count(*) from abertos where lane = 'falar_hoje'),
      'falar_hoje_mais_2_dias', (select count(*) from abertos where lane = 'falar_hoje' and v_hoje - lane_since > 2),
      'esquecidos_7d',          (select count(*) from abertos a
                                  where a.lane in ('falar_hoje', 'esperando')
                                    and a.created_at < public.cs_agora() - interval '7 days'
                                    and not exists (select 1 from ev_all h
                                                     where h.task_id = a.id and h.created_by is not null
                                                       and h.created_at > public.cs_agora() - interval '7 days')),
      'quedas_sem_cartao', coalesce((
          select jsonb_agg(jsonb_build_object('franchise_id', m.franchise_id, 'franchise_name', m.franchise_name,
                                              'motivo', m.top_text, 'motive_key', m.top_key,
                                              'rev_month_before', m.rev_month_before)
                           order by m.rev_month_before desc)
          from mm m
          where m.top_key is not null
            and not exists (select 1 from public.cs_tasks t where t.franchise_id = m.franchise_id
                              and t.archived_at is null and t.column_status <> 'feito')
            and not exists (select 1 from public.cs_tasks t where t.franchise_id = m.franchise_id
                              and t.parked_until > public.cs_agora())), '[]'::jsonb)
    ),
    'desfechos', (
      select jsonb_build_object(
        'resolvido',        count(*) filter (where t.closed_reason = 'resolvido'),
        'combinado_feito',  count(*) filter (where t.closed_reason = 'combinado_feito'),
        'recusou',          count(*) filter (where t.closed_reason = 'recusou'),
        'nao_responde',     count(*) filter (where t.closed_reason = 'nao_responde'),
        'resolveu_sozinho', count(*) filter (where t.closed_reason = 'resolveu_sozinho'),
        'sem_desfecho',     count(*) filter (where t.closed_reason is null),
        'vai_para_nelson',  (select count(*) from ev where event_type = 'escalate'))
      from public.cs_tasks t
      where t.column_status = 'feito'
        and (t.resolved_at at time zone 'America/Sao_Paulo')::date between p_ini and p_fim
        and not exists (select 1 from teste x where x.fid = t.franchise_id)
    ),
    'com_nelson', coalesce((
      select jsonb_agg(jsonb_build_object('task_id', a.id, 'franchise_id', a.franchise_id, 'franchise_name', f.name,
                                          'motive_evidence', a.motive_evidence, 'escalated_note', a.escalated_note,
                                          'escalated_at', a.escalated_at)
                       order by a.escalated_at)
      from abertos a left join public.franchises f on f.evolution_instance_id = a.franchise_id
      where a.lane = 'com_nelson'), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

-- ---------- get_cs_impacto (so admin) ----------
-- Metodo = estudo 26/09, secao 4.3:
--   toque = contato/reuniao registrado por pessoa (unidade de teste fora); dias com toque por unidade.
--   episodio 'reuniao' = dia de reuniao sem outra reuniao nos 21 dias antes (como no estudo: a reuniao
--     conta mesmo com mensagens antes). Reuniao antiga (event_type 'meeting' sem channel) usa a data
--     escrita no inicio da nota ("📅 26/08/2026"), que e o dia marcado; sem data, o dia do registro.
--   episodio 'mensagem' = 1o toque depois de 21+ dias sem toque e sem reuniao de 28 dias antes a 27
--     depois ("mensagem solta", sem reuniao por perto).
--   antes = venda de [data-28, data-1]; depois = [data, data+27]; tendencia = antes x [data-56, data-29].
--   So episodio com os 28 dias depois completos (data <= hoje-28), unidade com 1a venda ate data-56
--   e venda antes > 0.
--   controle do episodio = mediana de (depois/antes - 1) das unidades SEM toque em [data-28, data+27],
--   com 1a venda ate data-56 e venda antes > 0.
--   vs_controle = (depois/antes) / (1 + controle) - 1. Grupo: soma = soma(depois) / soma(antes x (1+controle)) - 1.
--   Reuniao = event_type 'meeting' (as antigas foram registradas no dia de MARCAR) ou channel 'reuniao'.
create or replace function public.get_cs_impacto(p_ini date, p_fim date)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_hoje  date := public.cs_hoje();
  v_limite date;
  v_out   jsonb;
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Mural: só o administrador vê o impacto do CS' using errcode = '42501';
  end if;
  if p_ini is null or p_fim is null or p_ini > p_fim then
    raise exception 'Mural: período inválido' using errcode = '22023';
  end if;
  if p_fim - p_ini > 366 then
    raise exception 'Mural: período maior que 1 ano' using errcode = '22023';
  end if;
  v_limite := v_hoje - 28;

  drop table if exists _imp_dense;
  create temp table _imp_dense on commit drop as
  with
  un as (
    select f.evolution_instance_id as fid,
           (select min(s.sale_date) from public.sales s where s.franchise_id = f.evolution_instance_id) as primeira
    from public.franchises f
    where not coalesce(f.is_test, false) and f.evolution_instance_id is not null
  ),
  cal as (select gs::date as dia from generate_series((p_ini - 57)::timestamp, (least(p_fim, v_limite) + 28)::timestamp, interval '1 day') gs),
  dv as (
    select s.franchise_id as fid, s.sale_date as dia,
           sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)) as rev
    from public.sales s
    where s.sale_date between p_ini - 57 and least(p_fim, v_limite) + 28
    group by 1, 2
  )
  select un.fid, un.primeira, cal.dia,
         sum(coalesce(dv.rev, 0)) over (partition by un.fid order by cal.dia) as cum
  from un cross join cal
  left join dv on dv.fid = un.fid and dv.dia = cal.dia
  where un.primeira is not null;
  create unique index on _imp_dense (fid, dia);

  with
  ev0 as (
    select e.franchise_id as fid,
           (e.event_type = 'meeting' or e.channel = 'reuniao') as reuniao,
           (e.created_at at time zone 'America/Sao_Paulo')::date as dia_reg,
           case when e.event_type = 'meeting' and e.channel is null
                then public.cs_try_date(substring(e.note from '^[^0-9]{0,6}([0-9]{2}/[0-9]{2}/[0-9]{4})')) end as dia_nota
    from public.cs_worklist_events e
    join public.franchises f on f.evolution_instance_id = e.franchise_id and not coalesce(f.is_test, false)
    where e.created_by is not null and e.event_type in ('contact', 'meeting')
  ),
  toques as (
    select fid,
           case when dia_nota between dia_reg - 60 and least(dia_reg + 30, v_hoje) then dia_nota else dia_reg end as dia,
           bool_or(reuniao) as reuniao
    from ev0
    group by 1, 2
  ),
  ep as (
    -- reuniao: cada dia de reuniao sem outra reuniao nos 21 dias antes
    select t.fid, t.dia as data, 'reuniao'::text as tipo
    from toques t
    where t.reuniao
      and not exists (select 1 from toques p where p.fid = t.fid and p.reuniao and p.dia >= t.dia - 21 and p.dia < t.dia)
      and t.dia between p_ini and least(p_fim, v_limite)
    union all
    -- mensagem: 1o toque depois de 21+ dias sem toque, sem reuniao na janela antes/depois
    select t.fid, t.dia, 'mensagem'
    from toques t
    where not exists (select 1 from toques p where p.fid = t.fid and p.dia >= t.dia - 21 and p.dia < t.dia)
      and not exists (select 1 from toques r where r.fid = t.fid and r.reuniao and r.dia between t.dia - 28 and t.dia + 27)
      and t.dia between p_ini and least(p_fim, v_limite)
  ),
  epv as (
    select ep.*, d0.primeira,
      (d1.cum - d0.cum) as antes,            -- [data-28, data-1]
      (d2.cum - d1.cum) as depois,           -- [data, data+27]
      (d0.cum - dm.cum) as antes2            -- [data-56, data-29]
    from ep
    join _imp_dense d0 on d0.fid = ep.fid and d0.dia = ep.data - 29
    join _imp_dense d1 on d1.fid = ep.fid and d1.dia = ep.data - 1
    join _imp_dense d2 on d2.fid = ep.fid and d2.dia = ep.data + 27
    join _imp_dense dm on dm.fid = ep.fid and dm.dia = ep.data - 57
    where d0.primeira <= ep.data - 56
  ),
  epc as (
    select v.*,
      (select percentile_cont(0.5) within group (order by (c2.cum - c1.cum) / (c1.cum - c0.cum) - 1)
         from _imp_dense c0
         join _imp_dense c1 on c1.fid = c0.fid and c1.dia = v.data - 1
         join _imp_dense c2 on c2.fid = c0.fid and c2.dia = v.data + 27
        where c0.dia = v.data - 29
          and c0.primeira <= v.data - 56
          and c1.cum - c0.cum > 0
          and not exists (select 1 from toques t where t.fid = c0.fid and t.dia between v.data - 28 and v.data + 27)
      ) as controle
    from epv v
    where v.antes > 0
  ),
  epf as (
    select c.*,
      (c.depois / c.antes) / nullif(1 + c.controle, 0) - 1 as vs,
      case when c.antes2 > 0 then c.antes / c.antes2 - 1 end as tend
    from epc c
    where c.controle is not null
  )
  select jsonb_build_object(
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', g.tipo, 'n', g.n, 'acima_do_controle', g.acima,
               'mediana_vs_controle_pct', g.mediana, 'soma_vs_controle_pct', g.soma,
               'rev_dia_depois', g.depois_dia, 'rev_dia_esperado', g.esperado_dia)
             order by case g.tipo when 'reuniao' then 1 else 2 end)
      from (
        select tipo, count(*)::int as n,
               count(*) filter (where vs > 0)::int as acima,
               round((100 * percentile_cont(0.5) within group (order by vs))::numeric, 1) as mediana,
               round((100 * (sum(depois) / nullif(sum(antes * (1 + controle)), 0) - 1))::numeric, 1) as soma,
               round(sum(depois) / 28.0) as depois_dia,
               round(sum(antes * (1 + controle)) / 28.0) as esperado_dia
        from epf group by tipo
      ) g), '[]'::jsonb),
    'episodios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'franchise_id', e.fid, 'franchise_name', f.name, 'data', e.data, 'tipo', e.tipo,
               'rev_dia_antes', round(e.antes / 28.0), 'rev_dia_depois', round(e.depois / 28.0),
               'controle_pct', round((100 * e.controle)::numeric, 1),
               'vs_controle_pct', round((100 * e.vs)::numeric, 1),
               'tendencia_antes_pct', round((100 * e.tend)::numeric, 1))
             order by e.data, f.name)
      from epf e left join public.franchises f on f.evolution_instance_id = e.fid), '[]'::jsonb),
    'ressalvas', jsonb_build_array(
      'Amostra pequena: com poucos episódios por tipo, o número muda muito de um mês para o outro.',
      'Quem aceita reunião costuma ser a unidade mais engajada: parte do efeito pode ser do dono, não da reunião.',
      'Unidade que vinha caindo tende a voltar sozinha (regressão à média): olhe a tendência antes do contato.',
      'O controle são as unidades sem registro no Mural no período; conversa fora do Mural não aparece.',
      'Reuniões registradas antes de 27/09/2026 contam no dia em que foram marcadas, não no dia em que aconteceram.',
      'Isto compara unidades acompanhadas com parecidas não acompanhadas; não é "R$ gerados pelo CS".'),
    'janela', jsonb_build_object('ini', p_ini, 'fim', p_fim, 'ultimo_episodio_medivel', v_limite)
  ) into v_out;

  return v_out;
end;
$$;

revoke execute on function public.get_cs_progresso(date, date) from public, anon;
revoke execute on function public.get_cs_impacto(date, date) from public, anon;
grant execute on function public.get_cs_progresso(date, date) to authenticated, service_role;
grant execute on function public.get_cs_impacto(date, date) to authenticated, service_role;

commit;
