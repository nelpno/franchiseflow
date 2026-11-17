-- Assessor do CS (17/11/2026): log de cada pergunta feita ao chat do dashboard.
-- A Edge Function `cs-assessor` grava com o JWT de quem perguntou (sem service role) e lê a soma do
-- dia para o teto de US$ 2. Só equipe de CS/admin: insert só da própria linha, select de todos.
-- Tabela criada depois de 30/10/2026 precisa de grant explícito (senão some da Data API).
--
-- ROLLBACK: drop table public.cs_assessor_log;
create table if not exists public.cs_assessor_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  franchise_evo text,
  pergunta text not null,
  ferramentas jsonb not null default '[]'::jsonb,
  tokens_in integer not null default 0,
  tokens_cached integer not null default 0,
  tokens_out integer not null default 0,
  custo_usd numeric(10,6) not null default 0,
  ms integer,
  erro text
);

create index if not exists cs_assessor_log_created_at_idx on public.cs_assessor_log (created_at desc);

alter table public.cs_assessor_log enable row level security;

drop policy if exists cs_assessor_log_select on public.cs_assessor_log;
create policy cs_assessor_log_select on public.cs_assessor_log
  for select to authenticated
  using ((select public.is_cs_or_admin()));

drop policy if exists cs_assessor_log_insert on public.cs_assessor_log;
create policy cs_assessor_log_insert on public.cs_assessor_log
  for insert to authenticated
  with check ((select public.is_cs_or_admin()) and user_id = (select auth.uid()));

revoke all on table public.cs_assessor_log from anon, authenticated;
grant select, insert on table public.cs_assessor_log to authenticated;
grant select, insert, update, delete on table public.cs_assessor_log to service_role;
