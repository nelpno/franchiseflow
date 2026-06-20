-- CS Cockpit · helper RLS dedicado (não tocar is_admin_or_manager — abriria ~28 policies)
create or replace function public.is_cs_or_admin()
returns boolean language sql stable security definer set search_path='public' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin','manager','customer_success')
  );
$$;
revoke all on function public.is_cs_or_admin() from public;
grant execute on function public.is_cs_or_admin() to authenticated;
