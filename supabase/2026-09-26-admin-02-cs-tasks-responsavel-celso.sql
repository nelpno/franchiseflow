-- 2026-09-26 admin 02 — Mural do CS: responsavel padrao = Celso
--
-- POR QUE
-- Decisao do Nelson (26/09/2026, plano admin-redesign item 2): enquanto o CS for so o Celso,
-- todo cartao do mural nasce com ele de responsavel, e os cartoes abertos sem responsavel
-- passam para ele. O campo continua editavel ("Assumir" no FranchiseDrawer) para quando
-- entrar mais gente.
-- Hoje (26/09): 15 cartoes abertos sem responsavel = 14 de unidades reais (3 auto + 11 manuais,
-- todos em aguardando_retorno) + 1 auto da "Maxi Teste 2" (unidade de teste, que o arquivo
-- admin-01 tira do radar e o reconcile auto-resolve). O UPDATE abaixo pega SO os 14.
--
-- O QUE FAZ
-- 1. `cs_default_assignee()`: devolve o uuid do Celso (profiles 39209dc3-…, role manager)
--    SO se a conta ainda existir em auth.users e o papel ainda for de staff. Se o Celso sair,
--    devolve NULL e o cartao nasce sem responsavel (em vez de o INSERT quebrar na FK
--    cs_tasks_assignee_fkey -> auth.users). SECURITY DEFINER porque quem insere e o usuario
--    logado (authenticated nao le auth.users); guard nao precisa: so devolve um uuid fixo.
-- 2. `cs_tasks.assignee` ganha DEFAULT cs_default_assignee(). Vale para:
--    - cartao manual do "Novo cartao" (QuickAddCard/createCsTask NAO manda `assignee`, conferido
--      em src/entities/all.js:430 e QuickAddCard.jsx:26 — por isso o default pega);
--    - cartao auto do reconcile (o INSERT do passo 1b nao lista `assignee`).
--    O cartao auto REABERTO (passo 1a) nao passa por INSERT: o arquivo admin-03 cuida dele.
-- 3. Backup + UPDATE dos cartoes abertos sem responsavel de unidades reais. So a coluna
--    `assignee` muda — titulo, descricao, coluna e updated_at ficam como estao (cartao MANUAL
--    continua intocado no conteudo; isto e uma decisao do admin aplicada uma vez, nao o reconcile).
--
-- RISCO CONHECIDO
-- - FK cs_tasks.assignee -> auth.users e SEM on delete: com os cartoes no nome dele, apagar a
--   conta do Celso (delete_user_complete) vai FALHAR na FK. Se um dia precisar, antes:
--   update cs_tasks set assignee = null where assignee = '<uuid>'.
-- - Uuid fixo no corpo da funcao: trocar o responsavel padrao = CREATE OR REPLACE desta funcao.
--
-- ROLLBACK
--   alter table public.cs_tasks alter column assignee drop default;
--   update public.cs_tasks t set assignee = b.assignee from public._backup_cs_tasks_owner_2026_09_26 b where b.id = t.id;
--   drop function public.cs_default_assignee();   (so depois do DROP DEFAULT)

begin;

create or replace function public.cs_default_assignee()
returns uuid
language sql
stable
security definer
set search_path = 'public'
as $$
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = '39209dc3-0cc2-41a1-bdab-99b066d9d8be'::uuid
    and p.role in ('admin', 'manager', 'customer_success')
$$;

revoke execute on function public.cs_default_assignee() from public, anon;
grant execute on function public.cs_default_assignee() to authenticated, service_role;

alter table public.cs_tasks alter column assignee set default public.cs_default_assignee();

create table public._backup_cs_tasks_owner_2026_09_26 as
select t.id, t.franchise_id, t.source, t.column_status, t.assignee, t.updated_at, now() as backed_up_at
from public.cs_tasks t
left join public.franchises f on f.evolution_instance_id = t.franchise_id
where t.assignee is null
  and t.archived_at is null
  and t.column_status <> 'feito'
  and not coalesce(f.is_test, false);

alter table public._backup_cs_tasks_owner_2026_09_26 enable row level security;
revoke all on table public._backup_cs_tasks_owner_2026_09_26 from anon, authenticated;

update public.cs_tasks t
   set assignee = public.cs_default_assignee()
 where t.id in (select b.id from public._backup_cs_tasks_owner_2026_09_26 b)
   and t.assignee is null;

commit;

-- CONFERÊNCIA (rodar em query separada)
-- 1) default e funcao (esperado: uuid do Celso e o default na coluna):
--    select public.cs_default_assignee() as padrao,
--           (select column_default from information_schema.columns
--             where table_schema='public' and table_name='cs_tasks' and column_name='assignee') as default_coluna;
-- 2) backup e UPDATE (esperado em 26/09: backup 14; abertos sem responsavel de unidade real 0):
--    select (select count(*) from public._backup_cs_tasks_owner_2026_09_26) backup,
--           (select count(*) from public.cs_tasks t left join public.franchises f on f.evolution_instance_id=t.franchise_id
--             where t.assignee is null and t.archived_at is null and t.column_status<>'feito' and not coalesce(f.is_test,false)) abertos_sem_resp,
--           (select count(*) from public.cs_tasks t join public._backup_cs_tasks_owner_2026_09_26 b on b.id=t.id
--             where t.assignee='39209dc3-0cc2-41a1-bdab-99b066d9d8be') com_celso;
-- 3) anon nao le o backup (GET com a chave anon em /rest/v1/_backup_cs_tasks_owner_2026_09_26 tem de dar 401/permission denied)
