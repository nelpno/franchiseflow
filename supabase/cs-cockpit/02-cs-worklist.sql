-- CS Cockpit · tabelas de worklist (estado + log). Chave TEXT = evolution_instance_id.
create table if not exists public.cs_worklist (
  franchise_id text primary key,
  status text not null default 'a_contatar'
    check (status in ('a_contatar','contatado','reuniao_marcada','resolvido')),
  last_contact_at timestamptz,
  meeting_at timestamptz,
  resolved_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.cs_worklist_events (
  id uuid primary key default gen_random_uuid(),
  franchise_id text not null,
  event_type text not null check (event_type in ('contact','meeting','note','resolve','reopen')),
  note text check (char_length(note) <= 1000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_cs_worklist_events_franchise on public.cs_worklist_events(franchise_id, created_at desc);

alter table public.cs_worklist enable row level security;
alter table public.cs_worklist_events enable row level security;

create policy cs_worklist_sel on public.cs_worklist for select using ((select public.is_cs_or_admin()));
create policy cs_worklist_ins on public.cs_worklist for insert with check ((select public.is_cs_or_admin()));
create policy cs_worklist_upd on public.cs_worklist for update using ((select public.is_cs_or_admin()));
create policy cs_worklist_del on public.cs_worklist for delete using ((select public.is_admin()));

create policy cs_wevents_sel on public.cs_worklist_events for select using ((select public.is_cs_or_admin()));
create policy cs_wevents_ins on public.cs_worklist_events for insert with check ((select public.is_cs_or_admin()));
-- DELETE/UPDATE: autor apaga/edita o próprio registro errado; admin qualquer um (2026-06-24).
create policy cs_wevents_del on public.cs_worklist_events for delete
  using ((select public.is_admin()) or created_by = (select auth.uid()));
create policy cs_wevents_upd on public.cs_worklist_events for update
  using ((select public.is_admin()) or created_by = (select auth.uid()))
  with check ((select public.is_admin()) or created_by = (select auth.uid()));
