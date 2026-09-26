-- 2026-09-27 cs 03 — reconcile do Mural pela regua unica (motivos), sem pisca-pisca
--
-- O QUE MUDA em reconcile_cs_auto_tasks (partindo do corpo AO VIVO: backup
-- docs/db-backups/reconcile_cs_auto_tasks.2026-09-27-antes.sql, md5(prosrc)
-- 6230ffb05ccbdc6db9fbc5461dcb43b7 = supabase/2026-09-26-admin-03-health-cache-reconcile.sql;
-- o cs-cockpit/07-*.sql esta desatualizado, sem parked_until nem cache):
--   MANTIDO: guard is_cs_or_admin, cache franchise_health_cache (passo 0, identico), 1 cartao
--     automatico aberto por unidade (indice cs_tasks_one_open_auto + on conflict), responsavel
--     padrao Celso (default da coluna + coalesce na reabertura), estacionado respeitado, cartao
--     MANUAL nunca e tocado, unidade de teste fora (a regua ja exclui).
--   NOVO:
--   - Abre cartao pelos MOTIVOS de cs_unit_motives (sem_venda, caiu relativo a rede, nao_lanca,
--     robo_parado que vendia, sem_comprar se a venda nao subiu), nao mais pelo tier 'critical'.
--     Acordo ativo daquele motivo impede o cartao (o alarme continua no Mural).
--   - Congela na abertura: motive_key, motive_evidence ("Sem venda desde 27/08 (30 dias) ·
--     vendia R$ 923/mês"), motive_value, baseline_rev_day (R$/dia dos 28 dias antes),
--     rev_month_before (media mensal de 90 dias; em sem_venda, os 90 dias ate a ultima venda).
--   - Fecha sozinho so depois de 3 dias seguidos fora da regra (out_of_rule_since), com
--     closed_reason 'resolveu_sozinho'; cartao "com o Nelson" nao fecha sozinho.
--     "Fora da regra" = a unidade nao tem NENHUM motivo — motivo segurado por acordo nao conta
--     como resolvido (B2) — e cartao 'caiu' de unidade sem leitura de queda (base < R$ 3 mil)
--     fica como esta, sem armar o relogio (A1: virada do mes nao fecha nem pisca). Tambem
--     segura: cartao 'caiu' que ainda cai em alguma das duas medidas (mes ou 28 dias) e
--     qualquer cartao 'caiu' nos dias 1 a 9 do mes.
--   - Fim do cooldown fixo de 30 dias: fechado pelo SISTEMA volta no dia; fechado por PESSOA
--     volta em 14 dias, ou antes se piorou (queda 10 p.p. maior / +7 dias sem venda) ou se
--     apareceu motivo MAIS GRAVE que nao estava nos alarmes quando fechou (M3). Reabre o MESMO cartao (o mais recente dos ultimos 60 dias, mesmo arquivado),
--     reopen_count + 1, guardando last_closed_reason/at.
--   - Cartao manual fechado por pessoa nos ultimos 14 dias segura o automatico da unidade por
--     14 dias (era a "reabertura" que o Celso reclamava: fechava o manual e nascia um auto).
--   - Unidade nova na trilha: so entra por sem_venda com 30+ dias (regra da regua unica).
-- cron_reconcile_cs_auto_tasks NAO muda (conferido: backup docs/db-backups/cron_reconcile_cs_auto_tasks.2026-09-27-antes.sql,
-- md5 079c0f25f0b2495a1094f98b5cb7f660 = supabase/2026-09-08-cron-reconcile-cs.sql).
-- Tambem cria cs_money(numeric) ("R$ 1.234"), cs_motive_ord(text) e cs_motive_prefix(text).
-- A frase so leva "vendia R$ X/mes" quando X >= R$ 1 (B6: quem nunca vendeu nao ganha "R$ 0").
-- Relogio = cs_agora()/cs_hoje() (arquivo 02), para a simulacao poder virar o mes.
--
-- ANTES DE APLICAR: conferir que o reconcile de producao nao mudou desde o backup:
--   select md5(prosrc) from pg_proc where oid = 'public.reconcile_cs_auto_tasks()'::regprocedure;
--   -> 6230ffb05ccbdc6db9fbc5461dcb43b7. Se mudou: parar e refazer a partir dele.
-- AVISAR O CELSO ANTES: na 1a rodada aparecem cartoes novos (simulacao: .tmp/onda2/simulacao-mural.md).
--
-- IDEMPOTENTE (create or replace). LF. Depois do 01 e do 02.
--
-- COMO DESFAZER: rodar docs/db-backups/reconcile_cs_auto_tasks.2026-09-27-antes.sql inteiro
-- (os cartoes abertos pela regra nova ficam; o reconcile antigo os fecha no dia seguinte se a
-- unidade nao for 'critical'). drop function public.cs_money(numeric), public.cs_motive_ord(text),
-- public.cs_motive_prefix(text) so depois de desfazer 05.

begin;

create or replace function public.cs_money(p numeric)
returns text
language sql
immutable
set search_path = 'public'
as $$
  select 'R$ ' || replace(to_char(round(coalesce(p, 0)), 'FM999,999,990'), ',', '.')
$$;

revoke execute on function public.cs_money(numeric) from public, anon;
grant execute on function public.cs_money(numeric) to authenticated, service_role;

create or replace function public.cs_motive_ord(p text)
returns integer
language sql
immutable
set search_path = 'public'
as $$
  select case p when 'sem_venda' then 1 when 'caiu' then 2 when 'nao_lanca' then 3
                when 'robo_parado' then 4 when 'sem_comprar' then 5 when 'manual' then 6 else 7 end
$$;

-- comeco da frase de cada motivo em cs_unit_motives (para saber se o alarme ja estava no cartao)
create or replace function public.cs_motive_prefix(p text)
returns text
language sql
immutable
set search_path = 'public'
as $$
  select case p when 'sem_venda' then 'Sem venda desde' when 'caiu' then 'Venda '
                when 'nao_lanca' then 'Comprou R$' when 'robo_parado' then 'Robô sem conversa'
                when 'sem_comprar' then 'Sem comprar da fábrica' else '#' end
$$;

revoke execute on function public.cs_motive_ord(text) from public, anon;
revoke execute on function public.cs_motive_prefix(text) from public, anon;
grant execute on function public.cs_motive_ord(text) to authenticated, service_role;
grant execute on function public.cs_motive_prefix(text) to authenticated, service_role;

create or replace function public.reconcile_cs_auto_tasks()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- 2) fechar sozinho: so depois de 3 dias seguidos fora da regra (acaba o pisca-pisca de 1-2
  --    dias). Cartao que foi para o Nelson nao fecha sozinho. Nao arma espera nenhuma.
  with res as (
    update cs_tasks t set column_status = 'feito', closed_reason = 'resolveu_sozinho',
        resolved_at = v_now, moved_to_column_at = v_now, updated_at = v_now
    where t.source = 'auto' and t.archived_at is null and t.column_status <> 'feito'
      and t.escalated_at is null
      and t.out_of_rule_since is not null and t.out_of_rule_since <= v_hoje - 3
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, note, created_by)
  select id, franchise_id, 'auto_resolve', 'Fechado pelo sistema: 3 dias sem motivo para cartão', null from res;

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
end $function$;

commit;
