-- Conferir entrega (S15.1) sai de vez (04/11/2026, docs/revisao-uso-2026-11-04.md, item 1).
-- A chave `conferir_entrega` nunca foi criada: 0 pedidos passaram pela conferência. A tela saiu
-- do app; aqui sai o desvio "entregue -> em_rota" do gatilho, para ninguém religar a chave e
-- deixar pedido preso sem tela (o cron `s15-entregas-sem-resposta` já foi desagendado).
-- Ficam: "entregue" é terminal, franqueada só cancela pendente, colunas da conferência travadas.
-- A RPC `confirmar_recebimento_pedido` e `concluir_entregas_sem_resposta` ficam no banco, sem uso.
--
-- ROLLBACK: supabase/2026-09-28-s15-conferir-entrega.sql (versão com o desvio).

create or replace function public.s15_guard_conferencia()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_via_rpc     boolean := coalesce(current_setting('s15.confirmando', true), '') = 'on';
  v_priv        boolean;
  v_equipe      boolean;
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

  return new;
end;
$function$;
