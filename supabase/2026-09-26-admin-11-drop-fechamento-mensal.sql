-- 2026-09-26 admin 11 — apaga get_fechamento_mensal(text) (substituída pela get_financeiro_rede)
--
-- NAO APLICADO. Rodar DEPOIS do deploy do front da Onda 1 e do admin-06 (o Financeiro novo
-- chama get_financeiro_rede; o componente antigo FechamentoMensal.jsx e o wrapper
-- getFechamentoMensal saíram do código na Onda 1).
--
-- CONFERIDO POR SELECT (26/09): existe 1 assinatura, get_fechamento_mensal(text), md5 do corpo
-- e3bcd3ce582614a8a1375cdf0787fa81; nenhuma outra função cita o nome em prosrc; 0 linhas em
-- pg_depend apontando para ela; `grep -rn get_fechamento_mensal src/` = nada.
--
-- Antes de apagar, o corpo vai para uma tabela de backup (RLS ligada, sem policy = ninguém lê
-- pela API), para o rollback recriar EXATAMENTE a mesma função com os mesmos grants.

begin;

create table if not exists public._backup_functions_2026_09_26 (
  name text primary key,
  def text not null,
  grants jsonb,
  saved_at timestamptz not null default now()
);
alter table public._backup_functions_2026_09_26 enable row level security;
revoke all on public._backup_functions_2026_09_26 from public, anon, authenticated;

do $mig$
declare
  v text;
begin
  if (select count(*) from pg_proc where proname = 'get_fechamento_mensal') <> 1 then
    raise exception 'esperava 1 assinatura de get_fechamento_mensal';
  end if;
  if exists (select 1 from pg_proc q where q.prokind = 'f' and q.proname <> 'get_fechamento_mensal'
             and q.prosrc ilike '%get_fechamento_mensal%') then
    raise exception 'outra funcao ainda chama get_fechamento_mensal';
  end if;
  select pg_get_functiondef('public.get_fechamento_mensal(text)'::regprocedure) into v;
  if md5(v) <> 'e3bcd3ce582614a8a1375cdf0787fa81' then
    raise exception 'get_fechamento_mensal mudou desde 26/09 (md5 %); conferir antes de apagar', md5(v);
  end if;
  insert into public._backup_functions_2026_09_26 (name, def, grants)
  values ('get_fechamento_mensal(text)', v,
          (select jsonb_agg(grantee) from information_schema.routine_privileges
            where routine_name = 'get_fechamento_mensal'))
  on conflict (name) do update set def = excluded.def, grants = excluded.grants, saved_at = now();
end
$mig$;

drop function public.get_fechamento_mensal(text);

notify pgrst, 'reload schema';

commit;

-- CONFERENCIA (query separada)
--   select count(*) from pg_proc where proname = 'get_fechamento_mensal';            -- 0
--   select name, md5(def), grants from public._backup_functions_2026_09_26;          -- e3bcd3ce…

-- ROLLBACK (recria a função a partir do backup e repõe os grants que ela tinha)
/*
begin;
do $rb$
declare v text;
begin
  select def into v from public._backup_functions_2026_09_26 where name = 'get_fechamento_mensal(text)';
  if v is null then raise exception 'backup nao encontrado'; end if;
  execute v;
end
$rb$;
revoke execute on function public.get_fechamento_mensal(text) from public, anon;
grant execute on function public.get_fechamento_mensal(text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
*/
