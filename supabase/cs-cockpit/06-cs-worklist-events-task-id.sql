-- 06 — eventos passam a ser por cartão (task_id); franchise_id opcional (cartão geral)
-- + novos tipos de evento: move (mudança de coluna), auto_open/auto_resolve (reconcile)

alter table public.cs_worklist_events
  add column if not exists task_id uuid references public.cs_tasks(id) on delete cascade;

alter table public.cs_worklist_events alter column franchise_id drop not null;

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_event_type_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_event_type_check
  check (event_type in ('contact','meeting','note','resolve','reopen','move','auto_open','auto_resolve'));

create index if not exists cs_worklist_events_task
  on public.cs_worklist_events (task_id, created_at desc);
