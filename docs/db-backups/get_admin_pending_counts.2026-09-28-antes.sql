-- Backup get_admin_pending_counts antes da S15 (28/09/2026). md5(prosrc)=ed20155fccf6185d73c1362d5e53a539. Reaplicar este arquivo = voltar.
CREATE OR REPLACE FUNCTION public.get_admin_pending_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
