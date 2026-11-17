-- Assessor do CS (17/11/2026, fase 2): o log deixa de ser lido por toda a equipe.
-- - select: admin vê tudo; o próprio usuário vê só as linhas dele.
-- - teto diário: a Edge soma o dia (BRT) pela RPC `cs_assessor_gasto_hoje()`, SECURITY DEFINER, que devolve só o total.
--
-- ROLLBACK:
--   drop function public.cs_assessor_gasto_hoje();
--   drop policy cs_assessor_log_select on public.cs_assessor_log;
--   create policy cs_assessor_log_select on public.cs_assessor_log for select to authenticated using ((select public.is_cs_or_admin()));
drop policy if exists cs_assessor_log_select on public.cs_assessor_log;
create policy cs_assessor_log_select on public.cs_assessor_log
  for select to authenticated
  using ((select public.is_admin()) or user_id = (select auth.uid()));

create or replace function public.cs_assessor_gasto_hoje()
returns numeric
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Assessor: sem permissão' using errcode = '42501';
  end if;
  return coalesce((
    select sum(custo_usd) from public.cs_assessor_log
    where created_at >= (((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo')
  ), 0);
end;
$$;

revoke all on function public.cs_assessor_gasto_hoje() from public, anon;
grant execute on function public.cs_assessor_gasto_hoje() to authenticated, service_role;
