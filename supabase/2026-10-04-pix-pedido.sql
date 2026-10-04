-- Pix do pedido à fábrica (P12, 04/10/2026). Substitui o L5 da análise
-- cs-celso/analises/2026-10-04-ciclo-semanal-pedido.md: o Pix se pede NA BAIXA "entregue", não depois.
--
-- Mesmo padrão do marketing_payments: a unidade anexa o comprovante em Pedidos, o Nelson confirma.
--   payment_status: null = pedido de antes disto (não conta) · pendente (nasce na baixa) ·
--                   enviado (a unidade anexou) · confirmado / recusado (admin)
--   payment_request_*: o WhatsApp do pedido de Pix (n8n aviso-entrega-pedidos, tipo 'pix'), igual ao
--                      delivery_notice_* do aviso de entrega.
-- O envio do WhatsApp é do front e só acontece com a chave pix_na_baixa ligada (sem linha = desligada).
-- A coluna nasce 'pendente' em toda baixa, com ou sem a chave: é a medição de quem pagou e quando.
--
-- ROLLBACK:
--   drop trigger if exists z_pix_pedido on public.purchase_orders;
--   drop function if exists public.pix_pedido_guard();
--   alter table public.purchase_orders drop column if exists payment_status, drop column if exists payment_proof_url,
--     drop column if exists paid_at, drop column if exists payment_confirmed_at, drop column if exists payment_confirmed_by,
--     drop column if exists payment_rejection_reason, drop column if exists payment_request_status,
--     drop column if exists payment_requested_at, drop column if exists payment_request_error;

alter table public.purchase_orders
  add column if not exists payment_status text,
  add column if not exists payment_proof_url text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid,
  add column if not exists payment_rejection_reason text,
  add column if not exists payment_request_status text,
  add column if not exists payment_requested_at timestamptz,
  add column if not exists payment_request_error text;

alter table public.purchase_orders drop constraint if exists purchase_orders_payment_status_check;
alter table public.purchase_orders add constraint purchase_orders_payment_status_check
  check (payment_status is null or payment_status in ('pendente', 'enviado', 'confirmado', 'recusado'));
alter table public.purchase_orders drop constraint if exists purchase_orders_payment_request_status_check;
alter table public.purchase_orders add constraint purchase_orders_payment_request_status_check
  check (payment_request_status is null or payment_request_status in ('fila', 'enviado', 'falhou'));

-- BEFORE UPDATE, depois dos outros (ordem alfabética: "z_"): o s15 pode desviar o "entregue" para
-- em_rota, e aí o Pix ainda não nasce.
create or replace function public.pix_pedido_guard()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_nasceu boolean := false;
begin
  -- 1. o Pix nasce na baixa (também quando quem fecha é a unidade, na conferência S15)
  if new.status = 'entregue' and old.status is distinct from 'entregue' and new.payment_status is null then
    new.payment_status := 'pendente';
    v_nasceu := true;
  end if;

  -- 2. trava: a franqueada (po_update deixa ela mudar a linha toda) só ANEXA o comprovante.
  --    service role / postgres (auth.uid() nulo, o n8n) e admin/gerente passam.
  if auth.uid() is not null and not (select public.is_admin_or_manager()) then
    if new.payment_confirmed_at is distinct from old.payment_confirmed_at
       or new.payment_confirmed_by is distinct from old.payment_confirmed_by
       or new.payment_rejection_reason is distinct from old.payment_rejection_reason
       or new.payment_request_status is distinct from old.payment_request_status
       or new.payment_requested_at is distinct from old.payment_requested_at
       or new.payment_request_error is distinct from old.payment_request_error then
      raise exception 'Sem permissão para alterar o pagamento do pedido' using errcode = '42501';
    end if;
    if new.payment_status is distinct from old.payment_status and not v_nasceu
       and not (old.payment_status in ('pendente', 'recusado') and new.payment_status = 'enviado') then
      raise exception 'Sem permissão para alterar o pagamento do pedido' using errcode = '42501';
    end if;
    if (new.payment_proof_url is distinct from old.payment_proof_url or new.paid_at is distinct from old.paid_at)
       and not (old.payment_status in ('pendente', 'recusado') and new.payment_status = 'enviado') then
      raise exception 'Sem permissão para alterar o pagamento do pedido' using errcode = '42501';
    end if;
    if new.payment_status = 'enviado' and old.payment_status is distinct from 'enviado' then
      if coalesce(new.payment_proof_url, '') = '' then
        raise exception 'Anexe o comprovante do Pix' using errcode = '23514';
      end if;
      new.paid_at := now();  -- relógio do servidor, não do aparelho
    end if;
  end if;

  -- 3. confirmar/recusar carimba quem e quando (admin)
  if new.payment_status in ('confirmado', 'recusado') and new.payment_status is distinct from old.payment_status then
    new.payment_confirmed_at := now();
    new.payment_confirmed_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function public.pix_pedido_guard() from public, anon;

drop trigger if exists z_pix_pedido on public.purchase_orders;
create trigger z_pix_pedido before update on public.purchase_orders
  for each row execute function public.pix_pedido_guard();

notify pgrst, 'reload schema';
