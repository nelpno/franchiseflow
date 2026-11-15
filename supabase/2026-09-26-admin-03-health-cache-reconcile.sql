-- 2026-09-26 admin 03 — cache da saude da rede (tier/flags) + reconcile grava nele
--
-- POR QUE
-- `get_franchise_health_signals()` leva ~3,6 s ao vivo (rede inteira, 60 dias, medianas).
-- As telas novas do admin (Hoje, Unidades, Ficha) precisam do tier/flags de TODAS as unidades
-- a cada abertura; chamar a funcao ao vivo em cada tela e o que deixa o admin lento hoje.
-- Solucao: tabela-cache, 1 linha por unidade, gravada por quem JA calcula o sinal:
-- `reconcile_cs_auto_tasks()` — chamado pelo cron `reconcile-cs-auto-tasks` (jobid 6,
-- 11:15 UTC = 08:15 BRT, via invólucro `cron_reconcile_cs_auto_tasks()`, que nao muda) e tambem
-- a cada abertura do Mural pelo front. O reconcile ja materializa o sinal em `_h`; gravar o
-- cache a partir de `_h` custa so o upsert de ~66 linhas + a contagem de recompra (~90 ms
-- quente, ~210 ms frio), sem recalcular o sinal.
-- As telas so LEEM a tabela (get_admin_network_overview / get_unit_360, arquivos 04 e 05).
--
-- O QUE A TABELA GUARDA
--   tier, flags, is_standout ...... a regua unica do plano (principio 3)
--   signals (jsonb) ............... a linha inteira do sinal (raio-x da Ficha: margem, compras,
--                                   variedade, itens zerados, conversao do robo...), sem
--                                   tier/flags/is_standout (que tem coluna propria)
--   buyers / repeat_buyers ........ clientes com 1+ e 2+ compras (contacts.purchase_count,
--                                   recalculado pelas vendas desde 17/09). No cache porque ao
--                                   vivo custa 90-210 ms para a rede (50 mil blocos de contacts)
--                                   e muda devagar.
--   computed_at ................... a tela mostra "atualizado as HH:MM" com isso.
--
-- MUDANCAS NO reconcile_cs_auto_tasks (partindo do corpo de PRODUCAO, nao do 07-*.sql)
-- O cs-cockpit/07-reconcile-cs-auto-tasks.sql esta DESATUALIZADO (nao tem parked_until). O
-- corpo abaixo foi transcrito do pg_get_functiondef de producao e conferido: md5 do corpo
-- original = 21623acad5a89af2db3cc875ce154bb2 (4702 chars) = md5(prosrc) do banco em
-- 26/09/2026, conferido linha a linha (85 linhas). Diferencas para producao, e SO elas:
--   (1) passo novo logo depois do `create temp table _h`: upsert no cache + apaga do cache quem
--       saiu do sinal (unidade de teste depois do admin-01, unidade excluida).
--   (2) passo 1a (REABRIR cartao auto): `assignee = coalesce(t.assignee, cs_default_assignee())`
--       — cartao auto reaberto sem responsavel volta com o Celso (decisao do Nelson; o cartao
--       NOVO ja pega pelo DEFAULT da coluna, arquivo admin-02). Cartao MANUAL continua nunca
--       tocado pelo reconcile.
-- Nenhum comentario novo dentro do corpo (os que ja existiam em producao foram mantidos).
--
-- ORDEM: depois do admin-01 (sinal sem unidade de teste) e do admin-02 (cs_default_assignee).
--
-- ANTES DE APLICAR: conferir que o reconcile de producao nao mudou:
--   select md5(prosrc), length(prosrc) from pg_proc where proname='reconcile_cs_auto_tasks';
--   -> tem de ser 21623acad5a89af2db3cc875ce154bb2 / 4702. Se mudou: parar e refazer a partir dele.
-- Aplicar pelo execute_sql (apply_migration descarta comentario de dentro do corpo).
-- O ACL do reconcile (hoje com anon=X) nao e mexido aqui: quem revoga anon e o
-- 2026-09-26-seg-02-revoke-anon.sql (CREATE OR REPLACE preserva o ACL, entao a ordem entre os
-- dois arquivos nao importa).
--
-- ROLLBACK: recriar reconcile_cs_auto_tasks com o corpo de producao (este corpo sem os 2
-- trechos acima) e `drop table public.franchise_health_cache` (so depois de tirar as RPCs
-- 04/05, que leem dela).

begin;

create table if not exists public.franchise_health_cache (
  franchise_id  text primary key,
  tier          text not null,
  flags         jsonb not null default '[]'::jsonb,
  is_standout   boolean not null default false,
  signals       jsonb not null default '{}'::jsonb,
  buyers        integer,
  repeat_buyers integer,
  computed_at   timestamptz not null default now()
);

comment on table public.franchise_health_cache is
  'Cache de get_franchise_health_signals (tier/flags/raio-x) + recompra. Gravado so por reconcile_cs_auto_tasks(). Telas so leem.';

alter table public.franchise_health_cache enable row level security;

drop policy if exists franchise_health_cache_select on public.franchise_health_cache;
create policy franchise_health_cache_select on public.franchise_health_cache
  for select to authenticated
  using ((select public.is_cs_or_admin()));

grant select, insert, update, delete on table public.franchise_health_cache to anon, authenticated, service_role;

create or replace function public.reconcile_cs_auto_tasks()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_now timestamptz := now();
begin
  if not (select public.is_cs_or_admin()) then raise exception 'forbidden'; end if;

  drop table if exists _h;
  create temp table _h on commit drop as select * from public.get_franchise_health_signals();

  insert into public.franchise_health_cache
    (franchise_id, tier, flags, is_standout, signals, buyers, repeat_buyers, computed_at)
  select h.franchise_id, h.tier, coalesce(h.flags, '[]'::jsonb), coalesce(h.is_standout, false),
         to_jsonb(h) - 'flags' - 'tier' - 'is_standout',
         ct.buyers, ct.repeat_buyers, v_now
  from _h h
  left join lateral (
    select count(*)::int as buyers,
           count(*) filter (where c.purchase_count >= 2)::int as repeat_buyers
    from public.contacts c
    where c.franchise_id = h.franchise_id and c.purchase_count >= 1
  ) ct on true
  where h.franchise_id is not null
  on conflict (franchise_id) do update
    set tier = excluded.tier, flags = excluded.flags, is_standout = excluded.is_standout,
        signals = excluded.signals, buyers = excluded.buyers,
        repeat_buyers = excluded.repeat_buyers, computed_at = excluded.computed_at;

  delete from public.franchise_health_cache c
  where not exists (select 1 from _h h where h.franchise_id = c.franchise_id);

  -- 1a) REABRIR o mesmo cartão auto 'feito' de franquia que voltou a ser crítica,
  --     resolvido há +30 dias (cooldown) e sem outro cartão já aberto. NÃO cria clone.
  --     🆕 02/09/2026: pula cartão PARQUEADO (parked_until no futuro).
  with cand_reopen as (
    select t.id, t.franchise_id
    from cs_tasks t
    join _h h on h.franchise_id = t.franchise_id and h.tier = 'critical'
    where t.source='auto' and t.archived_at is null and t.column_status='feito'
      and t.resolved_at < v_now - interval '30 days'
      and (t.parked_until is null or t.parked_until <= v_now)
      and not exists (select 1 from cs_tasks o where o.franchise_id=t.franchise_id
                        and o.archived_at is null and o.column_status <> 'feito')
  ),
  reopened as (
    update cs_tasks t set column_status='a_fazer', resolved_at=null,
        moved_to_column_at=v_now, updated_at=v_now,
        assignee=coalesce(t.assignee, public.cs_default_assignee())
    where t.id in (select id from cand_reopen)
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_open', null from reopened;

  -- 1b) CRIAR cartão auto p/ franquia crítica SEM nenhum cartão aberto (manual ou auto)
  --     e SEM nenhum cartão auto ativo (o 'feito' seria reaberto em 1a), fora do cooldown 30d.
  --     🆕 02/09/2026: não criar cartão novo para franquia com cartão auto PARQUEADO — senão o
  --     parqueamento seria burlado por criação em vez de reabertura.
  with cand as (
    select h.franchise_id, h.franchise_name, h.flags
    from _h h
    where h.tier = 'critical'
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.archived_at is null and t.column_status <> 'feito')
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.archived_at is null)
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.archived_at is null and t.parked_until > v_now)
      and not exists (select 1 from cs_tasks t where t.franchise_id=h.franchise_id
                        and t.source='auto' and t.column_status='feito' and t.resolved_at > v_now - interval '30 days')
  ),
  ins as (
    insert into cs_tasks (franchise_id, title, description, column_status, source, signal_key, priority, created_by)
    select c.franchise_id, 'Cuidar da '||coalesce(c.franchise_name, c.franchise_id),
           public.cs_flags_summary(c.flags), 'a_fazer', 'auto', 'auto:'||c.franchise_id, 'alta', null
    from cand c
    on conflict (franchise_id) where source='auto' and archived_at is null and column_status <> 'feito'
    do nothing
    returning id, franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_open', null from ins;

  -- 2) auto-resolver cartão auto cuja franquia não é mais crítica (manual nunca)
  with res as (
    update cs_tasks t set column_status='feito', resolved_at=v_now, moved_to_column_at=v_now, updated_at=v_now
    where t.source='auto' and t.archived_at is null and t.column_status <> 'feito'
      and not exists (select 1 from _h h where h.franchise_id=t.franchise_id and h.tier='critical')
    returning t.id, t.franchise_id
  )
  insert into cs_worklist_events (task_id, franchise_id, event_type, created_by)
  select id, franchise_id, 'auto_resolve', null from res;

  -- 3) atualizar descrição dos autos ainda abertos
  update cs_tasks t set description = public.cs_flags_summary(h.flags), updated_at=v_now
  from _h h
  where t.franchise_id=h.franchise_id and t.source='auto' and t.archived_at is null
    and t.column_status <> 'feito' and h.tier='critical';

  -- 4) arquivar 'feito' com +14 dias, SÓ se a franquia não é mais crítica
  --    (crítica NÃO arquiva -> fica pra ser reaberto pelo passo 1a, sem gerar duplicado).
  --    🆕 02/09/2026: cartão parqueado não arquiva — arquivar apagaria a marca e a franquia
  --    voltaria pelo 1b assim que o parqueamento vencesse, sem ninguém saber por quê.
  update cs_tasks t set archived_at=v_now
  where t.column_status='feito' and t.archived_at is null
    and coalesce(t.resolved_at, t.moved_to_column_at) < v_now - interval '14 days'
    and (t.parked_until is null or t.parked_until <= v_now)
    and not exists (select 1 from _h h where h.franchise_id=t.franchise_id and h.tier='critical');
end $function$;

commit;

-- CONFERÊNCIA (rodar em query separada)
-- 1) o cache nasce vazio e so enche no 1o reconcile. Para nao esperar o cron das 08:15, rodar
--    o mesmo que o cron roda (GRAVA de verdade — mesmo efeito do cron, so com o OK de quem aplica):
--      select public.cron_reconcile_cs_auto_tasks();
-- 2) conteudo (esperado: 66 linhas, 0 de teste, computed_at de agora):
--      select count(*) linhas, max(computed_at) atualizado,
--             count(*) filter (where franchise_id in (select evolution_instance_id from franchises where is_test)) de_teste,
--             count(*) filter (where tier='critical') criticas, count(*) filter (where tier='attention') atencao,
--             count(*) filter (where tier='healthy') saudaveis, count(*) filter (where tier='dormant') dormentes,
--             sum(buyers) compradores, sum(repeat_buyers) recompra,
--             pg_size_pretty(sum(pg_column_size(t.*))::bigint) tamanho
--      from public.franchise_health_cache t;
-- 3) cache x ao vivo (esperado: 0 e 0 logo depois do reconcile):
--      with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--           h as materialized (select s.* from ctx, lateral public.get_franchise_health_signals() s)
--      select count(*) filter (where c.franchise_id is null) faltam_no_cache,
--             count(*) filter (where c.tier is distinct from h.tier) tier_diferente
--      from h left join public.franchise_health_cache c on c.franchise_id = h.franchise_id;
-- 4) cartao da unidade de teste resolvido (o auto "Cuidar da Maxi Teste 2" tem de estar em 'feito';
--    arquiva sozinho em 14 dias):
--      select t.id, f.name, t.source, t.column_status, t.archived_at from cs_tasks t
--        join franchises f on f.evolution_instance_id=t.franchise_id where f.is_test and t.archived_at is null;
-- 5) RLS: GET /rest/v1/franchise_health_cache com a chave anon -> [] (policy so para authenticated
--    com is_cs_or_admin). Franqueado logado -> [] tambem.
-- 6) paridade do reconcile novo (anotar no proximo arquivo que mexer nele):
--      select md5(prosrc), length(prosrc) from pg_proc where proname='reconcile_cs_auto_tasks';
