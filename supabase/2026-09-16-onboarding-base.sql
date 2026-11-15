-- Primeiros passos, Fase 1 (16/09/2026): base que funciona de verdade.
-- 1) checklist nasce com a franquia (antes so nascia no aceite do convite, e a policy
--    de INSERT nao deixa o franqueado criar: 9 de 18 unidades novas ficaram sem)
-- 2) guard: franqueado nao conclui, nao mexe na aprovacao nem nos itens da Maxi
--    (a policy de UPDATE deixava a franqueada gravar status/approved_* direto)
-- 3) set_onboarding_status: unica porta para concluir/reabrir (admin e gerente)
-- 4) aviso real para a equipe quando a franqueada termina (a tela dizia
--    "O CS foi notificado" e ninguem era avisado)
-- 5) pedido modelo: quantidades sugeridas do 1o pedido (planilha enviada a Uberaba, 225 un)

-- 1) checklist nasce com a franquia ------------------------------------------------
create or replace function public.criar_checklist_da_franquia()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.evolution_instance_id is not null and new.evolution_instance_id <> '' then
    insert into public.onboarding_checklists (franchise_id, status, items, completed_count, completion_percentage)
    values (new.evolution_instance_id, 'in_progress', '{}'::jsonb, 0, 0)
    on conflict (franchise_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_franchise_onboarding_checklist on public.franchises;
create trigger trg_franchise_onboarding_checklist
  after insert on public.franchises
  for each row execute function public.criar_checklist_da_franquia();

-- 2) guard -------------------------------------------------------------------------
create or replace function public.guard_onboarding_checklist()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_chave text;
  v_chaves_maxi constant text[] := array['4-4', '8-1', '9-2', '9-3', '9-4'];
begin
  -- service_role (auth.uid() nulo) e equipe Maxi passam direto
  if auth.uid() is null or public.is_admin_or_manager() then
    return new;
  end if;

  if new.status is distinct from old.status
     and (new.status = 'approved' or old.status = 'approved') then
    raise exception 'Somente a equipe Maxi conclui os primeiros passos' using errcode = '42501';
  end if;

  if new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.admin_notes is distinct from old.admin_notes then
    raise exception 'Somente a equipe Maxi altera a conclusao' using errcode = '42501';
  end if;

  for v_chave in
    select k
    from jsonb_object_keys(coalesce(old.items, '{}'::jsonb) || coalesce(new.items, '{}'::jsonb)) as k
    where k = any (v_chaves_maxi) or k like 'maxi\_%'
  loop
    if (old.items -> v_chave) is distinct from (new.items -> v_chave) then
      raise exception 'Somente a equipe Maxi marca os itens da Maxi' using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_guard_onboarding_checklist on public.onboarding_checklists;
create trigger trg_guard_onboarding_checklist
  before update on public.onboarding_checklists
  for each row execute function public.guard_onboarding_checklist();

-- 3) concluir / reabrir ------------------------------------------------------------
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

  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.set_onboarding_status(text, text) from public, anon;
grant execute on function public.set_onboarding_status(text, text) to authenticated;

-- 4) aviso para a equipe -----------------------------------------------------------
create or replace function public.notificar_onboarding_pronto()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_nome text;
  v_link text := '/Onboarding?franchise=' || new.franchise_id;
begin
  if new.status = 'pending_approval'
     and old.status is distinct from 'pending_approval'
     and not exists (
       select 1 from public.notifications n
       where n.link = v_link and n.created_at > now() - interval '1 day'
     ) then
    select coalesce(nullif(f.name, ''), nullif(f.owner_name, ''), f.city) into v_nome
    from public.franchises f
    where f.evolution_instance_id = new.franchise_id;

    perform public.notify_admins(
      'Primeiros passos prontos para conferir',
      coalesce(v_nome, new.franchise_id) || ' terminou as missões. Confira e conclua.',
      'info',
      'rocket_launch',
      v_link
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_onboarding_notifica on public.onboarding_checklists;
create trigger trg_onboarding_notifica
  after update of status on public.onboarding_checklists
  for each row execute function public.notificar_onboarding_pronto();

-- 5) pedido modelo -----------------------------------------------------------------
alter table public.catalog_products
  add column if not exists qtd_pedido_modelo integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.catalog_products'::regclass and conname = 'catalog_products_qtd_pedido_modelo_check'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_qtd_pedido_modelo_check check (qtd_pedido_modelo >= 0);
  end if;
end $$;

update public.catalog_products cp
set qtd_pedido_modelo = v.qtd
from (values
  ('Canelone 4 Queijos - 700g', 10),
  ('Canelone Brócolis e Mussarela - 700g', 5),
  ('Canelone Frango e Requeijão - 700g', 10),
  ('Canelone Presunto e Mussarela - 700g', 10),
  ('Conchiglione 4 Queijos - 700g', 10),
  ('Conchiglione Brócolis e Mussarela - 700g', 5),
  ('Conchiglione Frango e Requeijão - 700g', 10),
  ('Conchiglione Presunto e Mussarela - 700g', 10),
  ('Massa de Lasanha - 500g', 0),
  ('Massa de Pastel - 1kg', 0),
  ('Massa de Pastel - 500g', 0),
  ('Molho de Tomate Sugo - 250g', 10),
  ('Nhoque de Batata - 1kg', 10),
  ('Nhoque de Batata - 500g', 0),
  ('Nhoque Recheado com 4 Queijos - 700g', 15),
  ('Nhoque Recheado com Calabresa - 700g', 5),
  ('Nhoque Recheado com Mussarela - 700g', 15),
  ('Nhoque Recheado com Presunto e Mussarela - 700g', 10),
  ('Rondelli 4 Queijos - 500g Fatiado', 10),
  ('Rondelli 4 Queijos - 700g Rolo', 10),
  ('Rondelli Brócolis e Mussarela - 700g Rolo', 5),
  ('Rondelli Frango e Requeijão - 700g Rolo', 10),
  ('Rondelli Presunto e Mussarela - 500g Fatiado', 10),
  ('Rondelli Presunto e Mussarela - 700g Rolo', 10),
  ('Sofioli 4 Queijos - 700g', 10),
  ('Sofioli Brócolis e Mussarela - 700g', 5),
  ('Sofioli Frango e Requeijão - 700g', 10),
  ('Sofioli Presunto e Mussarela - 700g', 10)
) as v(nome, qtd)
where cp.name = v.nome;

create or replace function public.get_pedido_modelo()
returns table (product_name text, quantidade integer)
language sql
stable
security invoker
set search_path = 'public'
as $$
  select cp.name, cp.qtd_pedido_modelo
  from public.catalog_products cp
  where cp.active
    and cp.qtd_pedido_modelo > 0
    and auth.uid() is not null
  order by cp.sort_order nulls last, cp.name;
$$;

revoke execute on function public.get_pedido_modelo() from public, anon;
grant execute on function public.get_pedido_modelo() to authenticated;

notify pgrst, 'reload schema';
