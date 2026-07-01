-- 05-cs-tasks.sql — Mural CS v2: tarefas (N cartões por franquia, +cartões sem franquia)
-- Substitui o modelo "1 status por franquia" (cs_worklist). Aditivo; cs_worklist fica intacta.

create table if not exists public.cs_tasks (
  id                 uuid primary key default gen_random_uuid(),
  franchise_id       text,                    -- evolution_instance_id; null = tarefa geral da rede
  title              text not null,
  description        text,
  column_status      text not null default 'a_fazer'
     check (column_status in ('a_fazer','em_andamento','aguardando_retorno','feito')),
  source             text not null default 'manual' check (source in ('auto','manual')),
  signal_key         text,
  assignee           uuid references auth.users(id),
  priority           text check (priority in ('alta','normal')),
  due_date           date,
  meeting_at         timestamptz,
  moved_to_column_at timestamptz not null default now(),
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  archived_at        timestamptz
);

-- 1 cartão AUTO aberto por franquia (idempotência do reconcile)
create unique index if not exists cs_tasks_one_open_auto
  on public.cs_tasks (franchise_id)
  where source='auto' and archived_at is null and column_status <> 'feito';
create index if not exists cs_tasks_board
  on public.cs_tasks (column_status, moved_to_column_at desc) where archived_at is null;
create index if not exists cs_tasks_franchise
  on public.cs_tasks (franchise_id) where archived_at is null;

alter table public.cs_tasks enable row level security;
drop policy if exists cs_tasks_select on public.cs_tasks;
create policy cs_tasks_select on public.cs_tasks for select using ((select public.is_cs_or_admin()));
drop policy if exists cs_tasks_insert on public.cs_tasks;
create policy cs_tasks_insert on public.cs_tasks for insert with check ((select public.is_cs_or_admin()));
drop policy if exists cs_tasks_update on public.cs_tasks;
create policy cs_tasks_update on public.cs_tasks for update using ((select public.is_cs_or_admin()));
drop policy if exists cs_tasks_delete on public.cs_tasks;
create policy cs_tasks_delete on public.cs_tasks for delete using ((select public.is_admin()));

-- resumo textual dos flags (jsonb array de {key,sev,label}) -> "Faturamento caindo · Parou de comprar"
create or replace function public.cs_flags_summary(p_flags jsonb)
returns text language sql immutable as $$
  select string_agg(f->>'label', ' · ')
  from jsonb_array_elements(coalesce(p_flags, '[]'::jsonb)) f;
$$;
