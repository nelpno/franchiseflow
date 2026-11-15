-- BACKUP AO VIVO de public.reconcile_cs_auto_tasks tirado em 2026-09-27 (antes da Onda 2 do Mural)
-- md5(prosrc)=6230ffb05ccbdc6db9fbc5461dcb43b7 length=5799
-- ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- Restaurar: rodar este arquivo inteiro (CREATE OR REPLACE preserva o ACL).

CREATE OR REPLACE FUNCTION public.reconcile_cs_auto_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_now timestamptz := now();
begin
  if not (select public.is_cs_or_admin()) then raise exception 'forbidden'; end if;

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

  -- 1a) REABRIR o mesmo cartão auto 'feito' de franquia que voltou a ser crítica,
  --     resolvido há +30 dias (cooldown) e sem outro cartão já aberto. NÃO cria clone.
  --     🆕 02/09/2026: pula cartão PARQUEADO (parked_until no futuro).
  with cand_reopen as (
    select t.id, t.franchise_id
    from cs_tasks t
    join _h h on h.franchise_id = t.franchise_id and h.tier = 'critical'
    where t.source='auto' and t.archived_at is null and t.column_status='feito'
      and t.resolved_at < v_now - interval '30 days'
      and (t.parked_until is null or t.parked_until <= v_now)
      and not exists (select 1 from cs_tasks o where o.franchise_id=t.franchise_id
                        and o.archived_at is null and o.column_status <> 'feito')
  ),
  reopened as (
    update cs_tasks t set column_status='a_fazer', resolved_at=null,
        moved_to_column_at=v_now, updated_at=v_now,
        assignee=coalesce(t.assignee, public.cs_default_assignee())
    where t.id in (select id from cand_reopen)
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_open', null from reopened;

  -- 1b) CRIAR cartão auto p/ franquia crítica SEM nenhum cartão aberto (manual ou auto)
  --     e SEM nenhum cartão auto ativo (o 'feito' seria reaberto em 1a), fora do cooldown 30d.
  --     🆕 02/09/2026: não criar cartão novo para franquia com cartão auto PARQUEADO — senão o
  --     parqueamento seria burlado por criação em vez de reabertura.
  with cand as (
    select h.franchise_id, h.franchise_name, h.flags
    from _h h
    where h.tier = 'critical'
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.archived_at is null and t.column_status <> 'feito')
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.archived_at is null)
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.archived_at is null and t.parked_until > v_now)
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.column_status='feito' and t.resolved_at > v_now - interval '30 days')
  ),
  ins as (
    insert into cs_tasks (franchise_id, title, description, column_status, source, signal_key, priority, created_by)
    select c.franchise_id, 'Cuidar da '||coalesce(c.franchise_name, c.franchise_id),
           public.cs_flags_summary(c.flags), 'a_fazer', 'auto', 'auto:'||c.franchise_id, 'alta', null
    from cand c
    on conflict (franchise_id) where source='auto' and archived_at is null and column_status <> 'feito'
    do nothing
    returning id, franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_open', null from ins;

  -- 2) auto-resolver cartão auto cuja franquia não é mais crítica (manual nunca)
  with res as (
    update cs_tasks t set column_status='feito', resolved_at=v_now, moved_to_column_at=v_now, updated_at=v_now
    where t.source='auto' and t.archived_at is null and t.column_status <> 'feito'
      and not exists (select 1 from _h h where h.franchise_id=t.franchise_id and h.tier='critical')
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_resolve', null from res;

  -- 3) atualizar descrição dos autos ainda abertos
  update cs_tasks t set description = public.cs_flags_summary(h.flags), updated_at=v_now
  from _h h
  where t.franchise_id=h.franchise_id and t.source='auto' and t.archived_at is null
    and t.column_status <> 'feito' and h.tier='critical';

  -- 4) arquivar 'feito' com +14 dias, SÓ se a franquia não é mais crítica
  --    (crítica NÃO arquiva -> fica pra ser reaberto pelo passo 1a, sem gerar duplicado).
  --    🆕 02/09/2026: cartão parqueado não arquiva — arquivar apagaria a marca e a franquia
  --    voltaria pelo 1b assim que o parqueamento vencesse, sem ninguém saber por quê.
  update cs_tasks t set archived_at=v_now
  where t.column_status='feito' and t.archived_at is null
    and coalesce(t.resolved_at, t.moved_to_column_at) < v_now - interval '14 days'
    and (t.parked_until is null or t.parked_until <= v_now)
    and not exists (select 1 from _h h where h.franchise_id=t.franchise_id and h.tier='critical');
end $function$
;
