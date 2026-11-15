-- 2026-09-26 — Redesenho do admin, Fase 0 (B5) — pedido/pagamento saem do sino e viram "Pendências"
-- Decisao 4 do Nelson (26/09): notificacoes de pedido/pagamento saem do sino e viram contador
-- em "Pendências" na home admin.
--
-- ONDE NASCEM (achado 26/09): NAO sao triggers. Os triggers on_new_purchase_order e
-- on_purchase_order_status_change estao VAZIOS desde que a notificacao foi para o front
-- ("RETURN NEW" com comentario). Quem grava e o PROPRIO APP DO FRANQUEADO chamando
-- supabase.rpc('notify_admins', ...), fire-and-forget (o `{ error }` do rpc e ignorado):
--   src/components/minha-loja/PurchaseOrderForm.jsx:308     'Novo pedido de reposição'
--   src/components/marketing/MarketingPaymentSection.jsx:237 'Novo pagamento de marketing' / 'Comprovante marketing reenviado'
--   src/components/marketing/MarketingPaymentSection.jsx:168 'Comprovante de marketing anexado'
--
-- MEDIDO (notifications, 26/09):
--   mes      pedido  pagto_mkt  comprovante_reenviado
--   2026-06    74      47          4
--   2026-07    69      55          4
--   2026-08    86      52          5
--   2026-09    62      48          5   (ate 26/09)
--   => ~125-140/mes. Destinatario: 1 usuario so (notify_admins manda para role='admin'; hoje ha
--   1 admin). CS/gerente NAO recebem (notify_admins nao inclui). Lidas: 100% (o admin abre e
--   limpa tudo) — ou seja, e ruido que ele zera na mao, nao informacao que ele guarda.
--
-- O QUE ESTE ARQUIVO FAZ
--   (a) notify_admins passa a IGNORAR esses 4 titulos (sem erro: o front ja nao olha o retorno).
--       Feito no banco, e nao so no .jsx, porque bundle antigo em cache no celular da franqueada
--       continuaria chamando por dias. A remocao das 3 chamadas no .jsx fica para a Fase 1
--       (subagente A) — este arquivo nao toca .jsx.
--       'Comprovante ...' (4-5/mes) entra junto por ser do mesmo fluxo (o contador
--       marketing_sem_comprovante cobre); tirar da lista se o Nelson quiser manter no sino.
--   (b) get_admin_pending_counts(): 1 linha jsonb com os contadores. 3,5 ms (EXPLAIN ANALYZE
--       do corpo em 26/09). is_test fora.
--   NAO apaga notificacao antiga. Sentinela e onboarding (notificar_onboarding_pronto) seguem
--   usando notify_admins normalmente.
--
-- Valores de 26/09 (para conferir depois): pedidos_para_confirmar 2, pedidos_para_entregar 7,
-- marketing_a_confirmar 0, marketing_sem_campanha 1, marketing_sem_comprovante 5,
-- onboarding_aguardando_aprovacao 0, mensalidades_vencidas 3, mes_alvo_marketing '2026-10'.
--
-- PARIDADE notify_admins: corpo de producao md5(prosrc) = 6da359a4aa4ded42e73e0ace378ad468
-- (26/09). A versao abaixo e a de producao + o bloco "if p_title in (...)".
-- ACL de hoje: postgres, authenticated, service_role (anon nao) — mantida.

begin;

create or replace function public.notify_admins(
  p_title text,
  p_message text,
  p_type text default 'info'::text,
  p_icon text default 'notifications'::text,
  p_link text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  -- 26/09/2026 (decisao 4): pedido/pagamento de marketing viraram contador em "Pendências"
  -- (get_admin_pending_counts). Chamadas antigas do app caem aqui e nao gravam nada.
  IF p_title IN (
    'Novo pedido de reposição',
    'Novo pagamento de marketing',
    'Comprovante marketing reenviado',
    'Comprovante de marketing anexado'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, icon, link)
  SELECT id, p_title, p_message, p_type, p_icon, p_link
  FROM profiles WHERE role = 'admin';
END;
$function$;

create or replace function public.get_admin_pending_counts()
returns jsonb
language plpgsql
stable
security definer
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
    select f.evolution_instance_id as evo, f.id::text as uid
    from franchises f
    where not f.is_test
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

revoke all on function public.get_admin_pending_counts() from public, anon;
grant execute on function public.get_admin_pending_counts() to authenticated, service_role;

commit;


-- CONFERÊNCIA (rodar em query separada)
-- a) ACL e corpo:
--    select p.proname, p.proacl::text, p.proconfig, has_function_privilege('anon', p.oid, 'execute') as anon_exec
--    from pg_proc p where p.proname in ('get_admin_pending_counts', 'notify_admins');
--    Esperado: anon_exec = false nas duas; proconfig {search_path=public}.
-- b) contadores como admin (os DOIS materialized sao obrigatorios):
--    with ctx as materialized (select set_config('request.jwt.claims',
--        json_build_object('sub', (select id from profiles where role = 'admin' limit 1), 'role', 'authenticated')::text, true)),
--      r as materialized (select public.get_admin_pending_counts() as j from ctx)
--    select j from r;
-- c) como franqueada tem de dar 42501 (trocar o sub por um profile role='franchisee').
-- d) filtro do sino (roda e desfaz; conta o que entrou dentro do mesmo bloco):
--    do $$ declare a int; b int; begin
--      perform public.notify_admins('Novo pedido de reposição', 'teste', 'info', 'local_shipping', '/PurchaseOrders');
--      select count(*) into a from notifications where title = 'Novo pedido de reposição' and message = 'teste';
--      perform public.notify_admins('Teste Fase 0', 'teste', 'info', 'notifications', null);
--      select count(*) into b from notifications where title = 'Teste Fase 0';
--      raise exception 'ENSAIO: pedido gravou % (esperado 0) | outro titulo gravou % (esperado = nº de admins)', a, b;
--    end $$;
-- e) uma semana depois: select title, count(*) from notifications where created_at > now() - interval '7 days'
--      and title in ('Novo pedido de reposição','Novo pagamento de marketing') group by 1;  -- esperado 0 linhas
-- f) node .tmp/fase0/anon-check.mjs  -> get_admin_pending_counts BLOQUEADO

-- ROLLBACK
-- begin;
-- drop function if exists public.get_admin_pending_counts();
-- create or replace function public.notify_admins(p_title text, p_message text, p_type text default 'info'::text,
--   p_icon text default 'notifications'::text, p_link text default null::text)
--  returns void language plpgsql security definer set search_path to 'public'
-- as $function$
-- BEGIN
--   INSERT INTO notifications (user_id, title, message, type, icon, link)
--   SELECT id, p_title, p_message, p_type, p_icon, p_link
--   FROM profiles WHERE role = 'admin';
-- END;
-- $function$;
-- commit;
