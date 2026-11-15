-- 2026-09-28 — S1.2 · Chave liga/desliga por unidade (botão de emergência do redesenho do franqueado)
--
-- Decisão 28/09: SEM piloto — o redesenho vai para a rede inteira de uma vez. A chave existe para
-- DESLIGAR rápido (a rede toda ou uma unidade) se algo der errado, sem deploy.
--
-- Regra de leitura (feature_flag_enabled): linha da UNIDADE ganha da linha GERAL (franchise_id nulo);
-- sem linha nenhuma = DESLIGADA = comportamento atual. O front também cai em "desligada" se a
-- consulta falhar (nunca liga por engano).
--
-- Só aditivo (tabela + 3 funções novas). ROLLBACK:
--   drop function if exists public.set_feature_flag(text, text, boolean, text);
--   drop function if exists public.get_feature_flags(text);
--   drop function if exists public.feature_flag_enabled(text, text);
--   drop table if exists public.feature_flags;
--
-- Uso (admin, pelo SQL do MCP como postgres ou pela RPC logado como admin):
--   ligar a rede:          select public.set_feature_flag('ui_v2', null, true, 'liga rede');
--   desligar a rede:       select public.set_feature_flag('ui_v2', null, false, 'emergencia: <motivo>');
--   desligar uma unidade:  select public.set_feature_flag('ui_v2', '<evolution_instance_id>', false, '<motivo>');
--   voltar a seguir a rede: delete from public.feature_flags where key='ui_v2' and franchise_id='<evo>';

create table if not exists public.feature_flags (
  id           uuid primary key default gen_random_uuid(),
  key          text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  franchise_id text,                 -- evolution_instance_id; NULL = regra geral da rede
  enabled      boolean not null,
  note         text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

create unique index if not exists feature_flags_key_unit_uq
  on public.feature_flags (key, coalesce(franchise_id, '*'));

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_admin_select on public.feature_flags;
create policy feature_flags_admin_select on public.feature_flags
  for select to authenticated using ((select public.is_admin_or_manager()));
-- sem policy de insert/update/delete: escrita só pela RPC set_feature_flag (SECURITY DEFINER)

revoke all on table public.feature_flags from anon;  -- o default do Supabase dá grant a anon em tabela nova
grant select, insert, update, delete on table public.feature_flags to authenticated, service_role;

-- Resolve uma chave para uma unidade (unidade > geral > desligada). Usável dentro de outras funções.
create or replace function public.feature_flag_enabled(p_key text, p_franchise_id text)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(
    (select enabled from feature_flags where key = p_key and franchise_id = p_franchise_id),
    (select enabled from feature_flags where key = p_key and franchise_id is null),
    false
  );
$$;

-- Todas as chaves resolvidas para a unidade: {"ui_v2": true, ...}. Só quem vê a unidade.
create or replace function public.get_feature_flags(p_franchise_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  if not coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role'
       or (select public.is_admin_or_manager())
       or (select public.is_cs_or_admin())
       or p_franchise_id = any((select public.managed_franchise_ids())::text[]),
       false) then
    return null;
  end if;

  return coalesce((
    select jsonb_object_agg(k.key, public.feature_flag_enabled(k.key, p_franchise_id))
    from (select distinct key from feature_flags) k
  ), '{}'::jsonb);
end;
$$;

-- Liga/desliga (só admin; postgres/service_role pelo SQL também passam).
create or replace function public.set_feature_flag(p_key text, p_franchise_id text, p_enabled boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  -- SQL direto (MCP/cron) = sem claims E sessão postgres; pela API só service_role ou admin
  if not coalesce(
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
       or (v_claims is not null and v_claims::jsonb ->> 'role' = 'service_role')
       or (select public.is_admin()),
       false) then
    raise exception 'Sem permissão para mudar a chave' using errcode = '42501';
  end if;
  if p_franchise_id is not null and not exists (select 1 from franchises where evolution_instance_id = p_franchise_id) then
    raise exception 'Unidade não encontrada: %', p_franchise_id using errcode = 'P0001';
  end if;

  insert into feature_flags (key, franchise_id, enabled, note, updated_at, updated_by)
  values (p_key, p_franchise_id, p_enabled, p_note, now(), auth.uid())
  on conflict (key, coalesce(franchise_id, '*'))
  do update set enabled = excluded.enabled, note = excluded.note, updated_at = now(), updated_by = excluded.updated_by;

  return jsonb_build_object('key', p_key, 'franchise_id', p_franchise_id, 'enabled', p_enabled);
end;
$$;

revoke execute on function public.feature_flag_enabled(text, text) from public, anon;
revoke execute on function public.get_feature_flags(text) from public, anon;
revoke execute on function public.set_feature_flag(text, text, boolean, text) from public, anon;
revoke execute on function public.feature_flag_enabled(text, text) from authenticated;  -- só por dentro de get_feature_flags (P3)
grant execute on function public.feature_flag_enabled(text, text) to service_role;
grant execute on function public.get_feature_flags(text) to authenticated, service_role;
grant execute on function public.set_feature_flag(text, text, boolean, text) to authenticated, service_role;

-- Chave do redesenho nasce DESLIGADA na rede (liga no dia da S9/S10).
insert into public.feature_flags (key, franchise_id, enabled, note)
values ('ui_v2', null, false, 'criada na S1.2; liga no lançamento')
on conflict do nothing;

notify pgrst, 'reload schema';
