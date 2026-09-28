-- DDL das tabelas sem uso (0 linhas), antes do DROP da S20.2. Reaplicar = recriar vazias.

-- sales_goals: 0 linhas em 2026-09-28
create table public.sales_goals (
  id uuid not null default gen_random_uuid(),
  franchise_id text,
  month date not null,
  target_value numeric(10,2) default 0,
  target_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
alter table public.sales_goals add constraint sales_goals_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES franchises(evolution_instance_id);
alter table public.sales_goals add constraint sales_goals_franchise_id_month_key UNIQUE (franchise_id, month);
alter table public.sales_goals add constraint sales_goals_pkey PRIMARY KEY (id);

alter table public.sales_goals enable row level security;
create policy goals_insert on public.sales_goals as PERMISSIVE for INSERT to public with check (( SELECT is_admin_or_manager() AS is_admin_or_manager));
create policy goals_select on public.sales_goals as PERMISSIVE for SELECT to public using ((( SELECT is_admin_or_manager() AS is_admin_or_manager) OR (franchise_id = ANY (( SELECT managed_franchise_ids() AS managed_franchise_ids)::text[]))));
create policy goals_update on public.sales_goals as PERMISSIVE for UPDATE to public using (( SELECT is_admin_or_manager() AS is_admin_or_manager));
create policy sales_goals_delete on public.sales_goals as PERMISSIVE for DELETE to public using (( SELECT is_admin() AS is_admin));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sales_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
grant INSERT on public.sales_goals to postgres;
grant SELECT on public.sales_goals to postgres;
grant UPDATE on public.sales_goals to postgres;
grant DELETE on public.sales_goals to postgres;
grant TRUNCATE on public.sales_goals to postgres;
grant REFERENCES on public.sales_goals to postgres;
grant TRIGGER on public.sales_goals to postgres;
grant INSERT on public.sales_goals to anon;
grant SELECT on public.sales_goals to anon;
grant UPDATE on public.sales_goals to anon;
grant DELETE on public.sales_goals to anon;
grant TRUNCATE on public.sales_goals to anon;
grant REFERENCES on public.sales_goals to anon;
grant TRIGGER on public.sales_goals to anon;
grant INSERT on public.sales_goals to authenticated;
grant SELECT on public.sales_goals to authenticated;
grant UPDATE on public.sales_goals to authenticated;
grant DELETE on public.sales_goals to authenticated;
grant TRUNCATE on public.sales_goals to authenticated;
grant REFERENCES on public.sales_goals to authenticated;
grant TRIGGER on public.sales_goals to authenticated;
grant INSERT on public.sales_goals to service_role;
grant SELECT on public.sales_goals to service_role;
grant UPDATE on public.sales_goals to service_role;
grant DELETE on public.sales_goals to service_role;
grant TRUNCATE on public.sales_goals to service_role;
grant REFERENCES on public.sales_goals to service_role;
grant TRIGGER on public.sales_goals to service_role;

-- franchise_notes: 0 linhas em 2026-09-28
create table public.franchise_notes (
  id uuid not null default gen_random_uuid(),
  franchise_id uuid not null,
  user_id uuid not null,
  note text not null,
  created_at timestamp with time zone not null default now()
);
alter table public.franchise_notes add constraint franchise_notes_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE CASCADE;
alter table public.franchise_notes add constraint franchise_notes_note_check CHECK ((char_length(note) <= 500));
alter table public.franchise_notes add constraint franchise_notes_pkey PRIMARY KEY (id);
alter table public.franchise_notes add constraint franchise_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
CREATE INDEX idx_franchise_notes_franchise_created ON public.franchise_notes USING btree (franchise_id, created_at DESC);
CREATE INDEX idx_franchise_notes_user_id ON public.franchise_notes USING btree (user_id);
alter table public.franchise_notes enable row level security;
create policy "Admin and manager can read notes" on public.franchise_notes as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Admin and manager can insert notes" on public.franchise_notes as PERMISSIVE for INSERT to public with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])))))));
create policy "Author can delete own notes" on public.franchise_notes as PERMISSIVE for DELETE to public using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Author can update own notes" on public.franchise_notes as PERMISSIVE for UPDATE to public using ((( SELECT auth.uid() AS uid) = user_id));

grant INSERT on public.franchise_notes to postgres;
grant SELECT on public.franchise_notes to postgres;
grant UPDATE on public.franchise_notes to postgres;
grant DELETE on public.franchise_notes to postgres;
grant TRUNCATE on public.franchise_notes to postgres;
grant REFERENCES on public.franchise_notes to postgres;
grant TRIGGER on public.franchise_notes to postgres;
grant INSERT on public.franchise_notes to anon;
grant SELECT on public.franchise_notes to anon;
grant UPDATE on public.franchise_notes to anon;
grant DELETE on public.franchise_notes to anon;
grant TRUNCATE on public.franchise_notes to anon;
grant REFERENCES on public.franchise_notes to anon;
grant TRIGGER on public.franchise_notes to anon;
grant INSERT on public.franchise_notes to authenticated;
grant SELECT on public.franchise_notes to authenticated;
grant UPDATE on public.franchise_notes to authenticated;
grant DELETE on public.franchise_notes to authenticated;
grant TRUNCATE on public.franchise_notes to authenticated;
grant REFERENCES on public.franchise_notes to authenticated;
grant TRIGGER on public.franchise_notes to authenticated;
grant INSERT on public.franchise_notes to service_role;
grant SELECT on public.franchise_notes to service_role;
grant UPDATE on public.franchise_notes to service_role;
grant DELETE on public.franchise_notes to service_role;
grant TRUNCATE on public.franchise_notes to service_role;
grant REFERENCES on public.franchise_notes to service_role;
grant TRIGGER on public.franchise_notes to service_role;
