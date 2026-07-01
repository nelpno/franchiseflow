-- 07 — reconcile_cs_auto_tasks(): gera/fecha cartões AUTO a partir do tier 'critical'
-- do RPC de saúde. Idempotente. Chamada 1x ao carregar o board (auth do CS/admin).

create or replace function public.reconcile_cs_auto_tasks()
returns void language plpgsql security definer set search_path='public' as $$
declare v_now timestamptz := now();
begin
  if not (select public.is_cs_or_admin()) then raise exception 'forbidden'; end if;

  -- snapshot único do RPC de saúde (evita chamá-lo várias vezes)
  drop table if exists _h;   -- guarda contra 2ª chamada na MESMA transação (senão 42P07)
  create temp table _h on commit drop as select * from public.get_franchise_health_signals();

  -- 1) abrir cartão auto p/ franquia crítica sem auto aberto e fora da supressão 7d
  with cand as (
    select h.franchise_id, h.franchise_name, h.flags
    from _h h
    where h.tier = 'critical'
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.archived_at is null and t.column_status <> 'feito')
      -- supressão v1 = janela simples de 7d. PENDÊNCIA (spec §2.2): "reabrir se piorar" fica p/ v2.
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.column_status='feito' and t.resolved_at > v_now - interval '7 days')
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

  -- 4) arquivar feito com +14 dias
  update cs_tasks set archived_at=v_now
  where column_status='feito' and archived_at is null
    and coalesce(resolved_at, moved_to_column_at) < v_now - interval '14 days';
end $$;

revoke execute on function public.reconcile_cs_auto_tasks() from public;
grant execute on function public.reconcile_cs_auto_tasks() to authenticated;
