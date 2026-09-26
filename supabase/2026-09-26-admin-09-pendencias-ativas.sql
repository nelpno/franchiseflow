-- 2026-09-26 admin 09 — get_admin_pending_counts() conta só unidades ATIVAS e não-teste
--
-- NAO APLICADO. Pode subir junto com o admin-08 (antes do deploy do front da Onda 1).
-- Partiu do pg_get_functiondef() ATUAL lido por SELECT via MCP em 26/09/2026 (versão do
-- seg-05: guard coalesce(is_admin_or_manager(), false) com RAISE 42501, search_path=public,
-- EXECUTE só para postgres/authenticated/service_role).
--
-- O QUE MUDA (1 linha): o CTE `reais` passa a filtrar `f.status = 'active'` e
-- `not coalesce(f.is_test, false)` — o MESMO universo de get_admin_network_overview (a lista
-- de Hoje/Unidades/Marketing). Antes contava pedido, verba, trilha e mensalidade de unidade
-- encerrada, e o número do cartão de Pendências podia não bater com a lista que ele abre.
-- Resto do corpo idêntico, byte a byte.
--
-- MEDIDO ANTES/DEPOIS (26/09, corpo rodado inline por SELECT, sem gravar nada):
--   pedidos_para_confirmar 2 → 2 · pedidos_para_entregar 6 → 6 · marketing_a_confirmar 0 → 0
--   marketing_sem_campanha 1 → 1 · marketing_sem_comprovante 5 → 5
--   onboarding_aguardando_aprovacao 0 → 0 · mensalidades_vencidas 3 → 3
--   Hoje não muda nada: as 66 unidades não-teste estão todas 'active' (franchises.status só
--   tem 'active'). É guarda para a primeira unidade encerrada.

begin;

create or replace function public.get_admin_pending_counts()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes_atual text;
  v_mes_alvo text;
  v_out jsonb;
begin
  -- coalesce: sem perfil o helper nunca pode virar NULL e deixar passar (regra 17/09)
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  v_mes_atual := to_char(v_hoje, 'YYYY-MM');
  -- mesmo criterio de getMarketingTargetMonth (franchiseUtils.js): nos ultimos 5 dias do mes
  -- a verba mira o mes seguinte
  v_mes_alvo := to_char(
    case when extract(day from v_hoje)
              > extract(day from (date_trunc('month', v_hoje) + interval '1 month - 1 day')) - 5
         then date_trunc('month', v_hoje) + interval '1 month'
         else date_trunc('month', v_hoje) end,
    'YYYY-MM');

  with reais as (
    -- mesmo universo da get_admin_network_overview (lista de Hoje/Unidades/Marketing)
    select f.evolution_instance_id as evo, f.id::text as uid
    from franchises f
    where f.status = 'active' and not coalesce(f.is_test, false)
  ),
  ids as (
    select evo as fid from reais where evo is not null
    union
    select uid from reais
  )
  select jsonb_build_object(
    'mes_alvo_marketing', v_mes_alvo,
    -- Pedidos (decisao 3: "Em rota" sai da tela; se ainda houver algum, conta como "para entregar")
    'pedidos_para_confirmar', (select count(*) from purchase_orders po
                                 where po.status = 'pendente' and po.franchise_id in (select fid from ids)),
    'pedidos_para_entregar',  (select count(*) from purchase_orders po
                                 where po.status in ('confirmado', 'em_rota') and po.franchise_id in (select fid from ids)),
    -- Marketing (status = recebimento; "subiu a campanha" = campaign_raised_at)
    'marketing_a_confirmar',  (select count(*) from marketing_payments mp
                                 where mp.status = 'pending' and mp.franchise_id in (select fid from ids)),
    'marketing_sem_campanha', (select count(*) from marketing_payments mp
                                 where mp.status = 'confirmed' and mp.campaign_raised_at is null
                                   and mp.reference_month in (v_mes_atual, v_mes_alvo)
                                   and mp.franchise_id in (select fid from ids)),
    'marketing_sem_comprovante', (select count(*) from marketing_payments mp
                                 where mp.status <> 'rejected' and mp.proof_url is null
                                   and mp.reference_month in (v_mes_atual, v_mes_alvo)
                                   and mp.franchise_id in (select fid from ids)),
    -- Primeiros passos esperando o OK da Maxi
    'onboarding_aguardando_aprovacao', (select count(*) from onboarding_checklists oc
                                 where oc.status = 'pending_approval' and oc.franchise_id in (select fid from ids)),
    -- Mensalidade vencida (paywall so em OVERDUE)
    'mensalidades_vencidas',  (select count(*) from system_subscriptions ss
                                 where ss.current_payment_status = 'OVERDUE' and ss.franchise_id in (select fid from ids))
  )
  into v_out;

  return v_out;
end;
$function$;

revoke execute on function public.get_admin_pending_counts() from public, anon;
grant execute on function public.get_admin_pending_counts() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- CONFERENCIA (rodar DEPOIS, em query separada; os dois `materialized` sao obrigatorios)
-- 1) como admin — esperado (26/09): os mesmos números do cabeçalho:
--    with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--         r as materialized (select public.get_admin_pending_counts() j from ctx)
--    select j from r;
-- 2) o corpo novo tem o filtro:
--    select position('f.status = ''active''' in prosrc) > 0 from pg_proc where proname = 'get_admin_pending_counts';
-- 3) fail-closed: sem claims (execute_sql puro) -> ERROR 42501 Acesso negado.
-- 4) grants: select grantee from information_schema.routine_privileges
--            where routine_name = 'get_admin_pending_counts';  -- postgres, authenticated, service_role

-- ROLLBACK (volta EXATAMENTE a versão de 26/09 antes deste arquivo: troca só a linha do CTE)
/*
begin;
do $$
declare v text;
begin
  select pg_get_functiondef('public.get_admin_pending_counts()'::regprocedure) into v;
  if position('where f.status = ''active'' and not coalesce(f.is_test, false)' in v) = 0 then
    raise exception 'admin-09 nao esta aplicado; nada a desfazer';
  end if;
  v := replace(v, '    -- mesmo universo da get_admin_network_overview (lista de Hoje/Unidades/Marketing)' || chr(10), '');
  v := replace(v, 'where f.status = ''active'' and not coalesce(f.is_test, false)', 'where not f.is_test');
  execute v;
end $$;
revoke execute on function public.get_admin_pending_counts() from public, anon;
grant execute on function public.get_admin_pending_counts() to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
*/
