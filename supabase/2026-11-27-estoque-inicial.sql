-- 27/11/2026: o pedido de ABERTURA (estoque inicial) é investimento, não gasto do mês.
-- Por quê: Verônica (Uberaba) viu setembro em -R$ 3.285,72; R$ 4.811,30 eram o estoque inicial
-- (produto + frete), pago com o dinheiro do investimento de abertura, não com o caixa do mês.
-- Sem o pedido de abertura, setembro dela fecha em +R$ 1.525,58. Toda unidade nova via o 1º mês no vermelho.
--
-- O que muda:
--   1. purchase_orders.estoque_inicial (boolean). No INSERT o banco decide: é o 1º pedido não cancelado
--      da unidade E a unidade tem menos de 20 vendas (unidade antiga sem pedido no app não cai nessa).
--      O valor que vier do app é ignorado no INSERT; no UPDATE só equipe/banco troca.
--   2. A despesa do pedido de abertura nasce com a categoria 'estoque_inicial' (produto E frete,
--      os dois fazem parte do investimento). O app tira essa categoria do Sobrou e mostra à parte.
--   3. Trocar a marca de um pedido já entregue recategoriza as despesas dele (gatilho AFTER).
--   4. Backfill: o 1º pedido das 31 unidades abertas depois que o app entrou (criadas >= 30/03/2026,
--      até 5 vendas antes da entrega). Fora: Americana, Mogi e Mauá (já vendiam antes: 42, 135 e 38 vendas).
--
-- ROLLBACK (nesta ordem):
--   update public.purchase_orders set estoque_inicial = false where estoque_inicial;   -- o gatilho devolve as categorias
--   drop trigger if exists a_po_estoque_inicial on public.purchase_orders;
--   drop trigger if exists po_estoque_inicial_despesas on public.purchase_orders;
--   drop function if exists public.po_estoque_inicial_marca();
--   drop function if exists public.po_estoque_inicial_despesas();
--   \i docs/db-backups/generate_expenses_from_purchase_order.2026-11-27-antes.sql
--   alter table public.purchase_orders drop column if exists estoque_inicial;
--   alter table public.expenses drop constraint expenses_category_check;
--   alter table public.expenses add constraint expenses_category_check check (category = any (array['compra_produto','compra_embalagem','compra_insumo','aluguel','pessoal','energia','internet_telefone','transporte','marketing','pacote_sistema','impostos','outros']));

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (category = any (array[
  'compra_produto','compra_embalagem','compra_insumo','aluguel','pessoal','energia','internet_telefone',
  'transporte','marketing','pacote_sistema','impostos','outros','estoque_inicial']));

alter table public.purchase_orders add column if not exists estoque_inicial boolean not null default false;
comment on column public.purchase_orders.estoque_inicial is
  'Pedido de abertura da unidade (investimento inicial). A despesa nasce como estoque_inicial e fica fora do Sobrou no mês. Regra: supabase/2026-11-27-estoque-inicial.sql';

-- 1. Marca no INSERT; trava a troca no UPDATE para quem não é equipe.
--    Nome com "a_po" para rodar ANTES de tr_po_generate_expenses (BEFORE roda em ordem alfabética).
create or replace function public.po_estoque_inicial_marca()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    new.estoque_inicial :=
      not exists (select 1 from public.purchase_orders p
                   where p.franchise_id = new.franchise_id and p.status is distinct from 'cancelado')
      and (select count(*) from public.sales s where s.franchise_id = new.franchise_id) < 20;
    return new;
  end if;
  if new.estoque_inicial is distinct from old.estoque_inicial
     and auth.uid() is not null
     and not coalesce(public.is_admin_or_manager(), false) then
    new.estoque_inicial := old.estoque_inicial;
  end if;
  return new;
end;
$$;
revoke execute on function public.po_estoque_inicial_marca() from public, anon;

drop trigger if exists a_po_estoque_inicial on public.purchase_orders;
create trigger a_po_estoque_inicial before insert or update on public.purchase_orders
  for each row execute function public.po_estoque_inicial_marca();

-- 2. Despesa do pedido entregue: categoria pelo estoque_inicial.
create or replace function public.generate_expenses_from_purchase_order()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_total_cost NUMERIC := 0;
  v_freight NUMERIC := 0;
  v_po_short TEXT;
  v_delivered_date DATE;
  v_inicial BOOLEAN := coalesce(NEW.estoque_inicial, false);
BEGIN
  -- Só dispara quando muda PARA 'entregue' E ainda não gerou (idempotente)
  IF NEW.status = 'entregue'
     AND (OLD.status IS NULL OR OLD.status <> 'entregue')
     AND NEW.expenses_generated_at IS NULL THEN

    -- S15: compra = o que CHEGOU (received_quantity); sem conferência, a quantidade pedida.
    SELECT COALESCE(SUM(unit_price * COALESCE(received_quantity, quantity)), 0)
      INTO v_total_cost
      FROM public.purchase_order_items
     WHERE order_id = NEW.id;

    v_freight := COALESCE(NEW.freight_cost, 0);
    v_po_short := substring(NEW.id::text from 1 for 8);
    v_delivered_date := COALESCE(NEW.delivered_at::date, CURRENT_DATE);

    -- Produto (pedido de abertura = estoque_inicial, fora do Sobrou no mês)
    IF v_total_cost > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id,
        CASE WHEN v_inicial THEN 'estoque_inicial' ELSE 'compra_produto' END,
        'Maxi Massas',
        CASE WHEN v_inicial THEN 'Estoque inicial - Pedido #' || v_po_short
             ELSE 'Pedido #' || v_po_short || ' - Maxi Massas' END,
        v_total_cost, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    -- Frete
    IF v_freight > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id,
        CASE WHEN v_inicial THEN 'estoque_inicial' ELSE 'transporte' END,
        'Maxi Massas',
        CASE WHEN v_inicial THEN 'Frete do estoque inicial #' || v_po_short
             ELSE 'Frete pedido #' || v_po_short END,
        v_freight, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    NEW.expenses_generated_at := NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Trocou a marca de um pedido (já entregue): acompanha nas despesas dele.
create or replace function public.po_estoque_inicial_despesas()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_short text := substring(new.id::text from 1 for 8);
begin
  if new.estoque_inicial is distinct from old.estoque_inicial then
    if new.estoque_inicial then
      update public.expenses e
         set category = 'estoque_inicial',
             description = case when e.category = 'transporte' then 'Frete do estoque inicial #' || v_short
                                else 'Estoque inicial - Pedido #' || v_short end
       where e.source = 'purchase_order' and e.source_id = new.id
         and e.category in ('compra_produto', 'transporte');
    else
      update public.expenses e
         set category = case when e.description ilike 'frete%' then 'transporte' else 'compra_produto' end,
             description = case when e.description ilike 'frete%' then 'Frete pedido #' || v_short
                                else 'Pedido #' || v_short || ' - Maxi Massas' end
       where e.source = 'purchase_order' and e.source_id = new.id
         and e.category = 'estoque_inicial';
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.po_estoque_inicial_despesas() from public, anon;

drop trigger if exists po_estoque_inicial_despesas on public.purchase_orders;
create trigger po_estoque_inicial_despesas after update of estoque_inicial on public.purchase_orders
  for each row execute function public.po_estoque_inicial_despesas();

-- 4. Backfill: 1º pedido (não cancelado, por data de criação) das unidades abertas com o app no ar.
with alvo as (
  select distinct on (po.franchise_id) po.id
    from public.purchase_orders po
   where po.status is distinct from 'cancelado'
     and po.franchise_id in (
       'franquiasaopaulosp10','franquiapiratiningasp','franquiasantoandresp1','franquiasaopaulosp11',
       'franquiasaopaulosp12','franquiajundiaisp','franquiasaopaulosp13','franquiasaopaulosp14',
       'franquiasaopaulosp15','franquiabragancapaulistasp','franquiacampinassp','franquiaitusp',
       'franquiacampolimpopaulistasp','franquiasorocabasp2','franquiasaopaulosp16','franquiasaopaulosp17',
       'franquiasaopaulosp18','franquiasaopaulosp19','franquiaguarulhossp','franquiacampinassp1',
       'franquiasantanadeparnaibasp1','franquialemesp','franquiaitapevisp','franquiauberabamg',
       'franquiasantaisabelsp','franquiasaopaulosp20','franquiaengenheirocoelhosp',
       'franquiavargemgrandedosulsp','franquiasaopaulosp21','franquiasaopaulosp22','franquiaindaiatubasp')
   order by po.franchise_id, po.created_at
)
update public.purchase_orders p set estoque_inicial = true from alvo where p.id = alvo.id;
