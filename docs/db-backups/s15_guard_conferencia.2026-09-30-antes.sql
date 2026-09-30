CREATE OR REPLACE FUNCTION public.s15_guard_conferencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_via_rpc     boolean := coalesce(current_setting('s15.confirmando', true), '') = 'on';
  v_priv        boolean;
  v_equipe      boolean;
  v_fid         uuid;
begin
  if v_via_rpc then
    return new;  -- a RPC de conferência sabe o que está fazendo
  end if;
  v_priv := public.s15_privilegiado();

  if tg_op = 'INSERT' then
    if not v_priv then
      new.shipped_at := null; new.awaiting_since := null;
      new.received_confirmed_at := null; new.received_confirmed_by := null;
      new.received_mode := null; new.received_client_id := null;
      new.ordered_total_amount := null; new.expenses_generated_at := null;
      if new.status is distinct from 'pendente' and not coalesce(public.is_admin_or_manager(), false) then
        raise exception 'Pedido: pedido novo sai como pendente.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  -- ---------- UPDATE ----------
  if not v_priv then
    v_equipe := coalesce(public.is_admin_or_manager(), false);

    -- Colunas da conferência e o carimbo da despesa: ninguém de fora escreve.
    new.shipped_at            := old.shipped_at;
    new.awaiting_since        := old.awaiting_since;
    new.received_confirmed_at := old.received_confirmed_at;
    new.received_confirmed_by := old.received_confirmed_by;
    new.received_mode         := old.received_mode;
    new.received_client_id    := old.received_client_id;
    new.ordered_total_amount  := old.ordered_total_amount;
    new.expenses_generated_at := old.expenses_generated_at;

    -- Entregue é terminal (estoque e despesa já entraram; sair daqui abriria a porta de entrar de novo).
    if old.status = 'entregue' then
      if new.status is distinct from 'entregue' then
        raise exception 'Pedido: pedido entregue não muda mais de situação.'
          using errcode = 'P0001', detail = 'S15_ENTREGUE_TERMINAL';
      end if;
      -- Admin/gerente: mudar valor ou frete de pedido entregue é ERRO (P3 2ª passada, ponto 3):
      -- descartar calado fazia a tela mostrar "salvo". A franqueada (o app dela nunca manda
      -- esses campos) continua com o valor antigo devolvido em silêncio.
      if v_equipe and (new.total_amount is distinct from old.total_amount
                       or new.freight_cost is distinct from old.freight_cost) then
        raise exception 'Pedido: o pedido já foi entregue; recarregue a página.'
          using errcode = 'P0001', detail = 'S15_ENTREGUE_FINANCEIRO';
      end if;
      new.total_amount := old.total_amount;
      new.freight_cost := old.freight_cost;
      new.delivered_at := old.delivered_at;
    end if;

    -- Franqueada: valor e frete são da fábrica; status só pendente -> cancelado.
    if not v_equipe then
      new.total_amount := old.total_amount;
      new.freight_cost := old.freight_cost;
      if new.status is distinct from old.status
         and not (old.status = 'pendente' and new.status = 'cancelado') then
        raise exception 'Pedido: só é possível cancelar um pedido que ainda está pendente.'
          using errcode = 'P0001', detail = 'S15_STATUS_FRANQUEADA';
      end if;
    end if;
  end if;

  -- Conferência S15 em curso: só a RPC/cron leva a 'entregue' (estoque e despesa entram UMA vez).
  if old.status = 'em_rota' and old.awaiting_since is not null and new.status = 'entregue' then
    raise exception 'Pedido: este pedido espera a unidade conferir o que chegou. Use "Confirmar recebimento".'
      using errcode = 'P0001', detail = 'S15_AGUARDA_CONFERENCIA';
  end if;

  -- Fábrica marcou entregue numa unidade com o app novo: começa a conferência (a chave só decide INICIAR).
  if new.status = 'entregue' and old.status in ('pendente', 'confirmado')
     and public.feature_flag_enabled('ui_v2', new.franchise_id) then
    new.status := 'em_rota';
    new.shipped_at := case
      when new.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then new.delivered_at
      else now() end;
    new.awaiting_since := now();
    new.delivered_at := old.delivered_at;
    select f.id into v_fid from franchises f where f.evolution_instance_id = new.franchise_id;
    if v_fid is not null then
      perform public.notify_franchise_users(
        v_fid,
        'Seu pedido chegou',
        'Confira o que chegou e toque em "Recebi tudo certo" ou "Faltou algo". Sem resposta em 2 dias, o pedido conta como recebido completo.',
        'info', 'local_shipping', '/Gestao?tab=reposicao');
    end if;
  end if;

  -- Saiu da conferência sem concluir (admin voltou ou cancelou): zera a espera.
  if old.status = 'em_rota' and old.awaiting_since is not null
     and new.status in ('pendente', 'confirmado', 'cancelado') then
    new.shipped_at := null;
    new.awaiting_since := null;
  end if;

  return new;
end;
$function$
;

revoke all on function public.s15_guard_conferencia() from public, anon, authenticated;
