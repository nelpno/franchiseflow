-- Primeiros passos, Fase 1, ajuste pós-revisão (16/09/2026).
-- v1 do guard dava ERRO quando a franqueada mandava itens da Maxi diferentes do banco.
-- Como a tela reenvia o mapa inteiro de itens, bastava o admin marcar "4-4" com a tela
-- dela aberta para TODO save seguinte dela falhar. v2 preserva em silêncio o que é da
-- Maxi (itens, aprovação, anotações) e só deixa sair/entrar em 'approved' pela RPC
-- set_onboarding_status — nem o admin por outro caminho (um save antigo em voo não
-- desfaz mais a conclusão).

create or replace function public.guard_onboarding_checklist()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_chaves_maxi constant text[] := array['4-4', '8-1', '9-2', '9-3', '9-4'];
  v_pela_rpc boolean := coalesce(current_setting('app.onboarding_rpc', true), '') = '1';
  v_equipe boolean := auth.uid() is null or public.is_admin_or_manager();
  v_maxi_antigo jsonb;
begin
  -- Conclusão só pela RPC (vale para todos, inclusive admin e service_role).
  if not v_pela_rpc then
    if old.status = 'approved' or new.status = 'approved' then
      new.status := old.status;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;

  if v_equipe then
    return new;
  end if;

  -- Franqueada: o que é da Maxi fica como estava no banco.
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  new.admin_notes := old.admin_notes;

  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_maxi_antigo
  from jsonb_each(coalesce(old.items, '{}'::jsonb)) as e(k, v)
  where k = any (v_chaves_maxi) or k like 'maxi\_%';

  new.items := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(new.items, '{}'::jsonb)) as e(k, v)
    where not (k = any (v_chaves_maxi) or k like 'maxi\_%')
  ) || v_maxi_antigo;

  return new;
end;
$$;

create or replace function public.set_onboarding_status(p_franchise_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_row public.onboarding_checklists;
  v_nome text;
begin
  if not public.is_admin_or_manager() then
    raise exception 'Somente a equipe Maxi conclui os primeiros passos' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'in_progress') then
    raise exception 'Status invalido' using errcode = '22023';
  end if;

  perform set_config('app.onboarding_rpc', '1', true);

  select coalesce(nullif(p.full_name, ''), p.email) into v_nome
  from public.profiles p
  where p.id = auth.uid();

  insert into public.onboarding_checklists as oc
    (franchise_id, status, items, completed_count, completion_percentage, approved_at, approved_by)
  values
    (p_franchise_id, p_status, '{}'::jsonb, 0, 0,
     case when p_status = 'approved' then now() end,
     case when p_status = 'approved' then v_nome end)
  on conflict (franchise_id) do update
    set status = excluded.status,
        approved_at = excluded.approved_at,
        approved_by = excluded.approved_by
  returning * into v_row;

  perform set_config('app.onboarding_rpc', '', true);
  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.set_onboarding_status(text, text) from public, anon;
grant execute on function public.set_onboarding_status(text, text) to authenticated;
