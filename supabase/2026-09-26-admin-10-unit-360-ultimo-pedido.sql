-- 2026-09-26 admin 10 — get_unit_360: "último pedido" ignora pedido cancelado
--
-- NAO APLICADO. Pode subir junto com o admin-08/09 (antes do deploy do front da Onda 1).
-- Partiu do pg_get_functiondef() ATUAL lido por SELECT via MCP em 26/09/2026
-- (md5 dc8f6401b0e888a4268cbc3f4be44be8, 10.919 chars = versão do admin-05).
--
-- O QUE MUDA: na Ficha, "Último pedido à fábrica" (RoutineGrid) e o "há N dias" saíam de
-- `pos.ultimos -> 0`, o pedido mais recente de QUALQUER status. Um pedido cancelado ontem
-- aparecia como "último pedido: ontem" e escondia que a unidade não compra há semanas.
-- Agora `purchase_orders.last` e `purchase_orders.days_since_last` vêm do mais recente com
-- status <> 'cancelado' (nulls last). `recent` (os 5 últimos, com status) continua igual:
-- é histórico e mostra o cancelado como cancelado. A overview (admin-08) recebeu a mesma
-- regra em days_since_last_po, para lista e Ficha não divergirem.
--
-- COMO: em vez de transcrever as ~270 linhas, o bloco lê o corpo ATUAL, confere o md5
-- (aborta se a função mudou desde 26/09), troca 2 trechos que aparecem 1 vez cada
-- (conferido por SELECT: 1 e 1) e recria. CREATE OR REPLACE mantém dono, SECURITY
-- DEFINER, search_path=public, guard fail-closed e os grants (postgres/authenticated/
-- service_role); revoke/grant repetidos no fim por garantia.
--
-- MEDIDO ANTES/DEPOIS (26/09, trecho novo rodado inline por SELECT para as 66 unidades):
--   'last' diferente: 0 de 66 (19 unidades têm algum cancelado, nenhuma com o cancelado por
--   último). Hoje não muda nada na tela; é guarda para o próximo cancelamento.

begin;

do $mig$
declare
  v text;
  a1 text := $a1$'[]'::jsonb) as ultimos
    from (
      select p.id, p.ordered_at, p.status, p.total_amount, p.delivered_at$a1$;
  b1 text := $b1$'[]'::jsonb) as ultimos,
           -- último pedido que valeu (cancelado não conta como "último pedido")
           (select jsonb_build_object(
                     'id', pu.id, 'ordered_at', pu.ordered_at, 'status', pu.status,
                     'total_amount', pu.total_amount, 'delivered_at', pu.delivered_at)
              from public.purchase_orders pu
             where pu.franchise_id = p_evo and pu.status <> 'cancelado'
             order by pu.ordered_at desc nulls last
             limit 1) as ultimo
    from (
      select p.id, p.ordered_at, p.status, p.total_amount, p.delivered_at$b1$;
  a2 text := $a2$      'last', pos.ultimos -> 0,
      'days_since_last', d.hoje - ((pos.ultimos -> 0 ->> 'ordered_at')::timestamptz at time zone 'America/Sao_Paulo')::date,$a2$;
  b2 text := $b2$      'last', pos.ultimo,
      'days_since_last', d.hoje - ((pos.ultimo ->> 'ordered_at')::timestamptz at time zone 'America/Sao_Paulo')::date,$b2$;
begin
  select pg_get_functiondef('public.get_unit_360(text)'::regprocedure) into v;
  if md5(v) <> 'dc8f6401b0e888a4268cbc3f4be44be8' then
    raise exception 'get_unit_360 mudou desde 26/09 (md5 %); refazer este arquivo a partir do corpo atual', md5(v);
  end if;
  if (length(v) - length(replace(v, a1, ''))) / length(a1) <> 1
     or (length(v) - length(replace(v, a2, ''))) / length(a2) <> 1 then
    raise exception 'trecho a trocar nao aparece exatamente 1 vez';
  end if;
  v := replace(replace(v, a1, b1), a2, b2);
  execute v;
end
$mig$;

revoke execute on function public.get_unit_360(text) from public, anon;
grant execute on function public.get_unit_360(text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- CONFERENCIA (rodar DEPOIS, em query separada; os dois `materialized` sao obrigatorios)
-- 1) o corpo novo tem a regra:
--    select position('pu.status <> ''cancelado''' in prosrc) > 0 from pg_proc where oid = 'public.get_unit_360(text)'::regprocedure;
-- 2) como admin, 'last' nunca é cancelado e bate com a overview (0 linhas esperadas):
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         o as materialized (select r.* from ctx, lateral public.get_admin_network_overview() r)
--    select o.franchise_id from o, ctx
--     where (public.get_unit_360(o.franchise_id) #>> '{purchase_orders,last,status}') = 'cancelado'
--        or ((public.get_unit_360(o.franchise_id) #>> '{purchase_orders,days_since_last}')::int is distinct from o.days_since_last_po);
-- 3) fail-closed: sem claims (execute_sql puro) -> null:
--    select public.get_unit_360('franquiasaopaulosp');
-- 4) grants: select grantee from information_schema.routine_privileges
--            where routine_name = 'get_unit_360';  -- postgres, authenticated, service_role

-- ROLLBACK (desfaz as 2 trocas; volta ao md5 dc8f6401b0e888a4268cbc3f4be44be8)
/*
begin;
do $rb$
declare
  v text;
  a1 text := $a1$'[]'::jsonb) as ultimos
    from (
      select p.id, p.ordered_at, p.status, p.total_amount, p.delivered_at$a1$;
  b1 text := $b1$'[]'::jsonb) as ultimos,
           -- último pedido que valeu (cancelado não conta como "último pedido")
           (select jsonb_build_object(
                     'id', pu.id, 'ordered_at', pu.ordered_at, 'status', pu.status,
                     'total_amount', pu.total_amount, 'delivered_at', pu.delivered_at)
              from public.purchase_orders pu
             where pu.franchise_id = p_evo and pu.status <> 'cancelado'
             order by pu.ordered_at desc nulls last
             limit 1) as ultimo
    from (
      select p.id, p.ordered_at, p.status, p.total_amount, p.delivered_at$b1$;
  a2 text := $a2$      'last', pos.ultimos -> 0,
      'days_since_last', d.hoje - ((pos.ultimos -> 0 ->> 'ordered_at')::timestamptz at time zone 'America/Sao_Paulo')::date,$a2$;
  b2 text := $b2$      'last', pos.ultimo,
      'days_since_last', d.hoje - ((pos.ultimo ->> 'ordered_at')::timestamptz at time zone 'America/Sao_Paulo')::date,$b2$;
begin
  select pg_get_functiondef('public.get_unit_360(text)'::regprocedure) into v;
  v := replace(replace(v, b1, a1), b2, a2);
  if md5(v) <> 'dc8f6401b0e888a4268cbc3f4be44be8' then
    raise exception 'rollback nao voltou ao corpo de 26/09 (md5 %)', md5(v);
  end if;
  execute v;
end
$rb$;
revoke execute on function public.get_unit_360(text) from public, anon;
grant execute on function public.get_unit_360(text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
*/
