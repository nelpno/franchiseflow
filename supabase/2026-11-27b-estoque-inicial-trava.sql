-- 27/11/2026 (b): ajustes da revisão do 2026-11-27-estoque-inicial.sql.
-- 1. Dois pedidos de abertura ao mesmo tempo (duas abas, reenvio) não podem sair os dois marcados:
--    trava por unidade (pg_advisory_xact_lock) antes de olhar se já há pedido.
-- 2. Pedido de abertura cancelado: a marca passa ao pedido seguinte não cancelado da unidade
--    (se nenhum outro já estiver marcado).
--
-- ROLLBACK: reaplicar as funções po_estoque_inicial_marca e po_estoque_inicial_despesas de
--   supabase/2026-11-27-estoque-inicial.sql (o resto não muda).

create or replace function public.po_estoque_inicial_marca()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('po_estoque_inicial:' || coalesce(new.franchise_id, '')));
    new.estoque_inicial :=
      not exists (select 1 from public.purchase_orders p
                   where p.franchise_id = new.franchise_id and p.status is distinct from 'cancelado')
      and (select count(*) from public.sales s where s.franchise_id = new.franchise_id) < 20;
    return new;
  end if;
  if new.estoque_inicial is distinct from old.estoque_inicial
     and coalesce(current_setting('po_estoque_inicial.sistema', true), '') <> 'on'
     and auth.uid() is not null
     and not coalesce(public.is_admin_or_manager(), false) then
    new.estoque_inicial := old.estoque_inicial;
  end if;
  return new;
end;
$$;
revoke execute on function public.po_estoque_inicial_marca() from public, anon;

create or replace function public.po_estoque_inicial_despesas()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_short text := substring(new.id::text from 1 for 8);
  v_proximo uuid;
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

  -- Pedido de abertura cancelado: a marca vai para o seguinte da unidade.
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' and new.estoque_inicial then
    -- a troca é do sistema (vale mesmo quando quem cancelou foi a franqueada)
    perform set_config('po_estoque_inicial.sistema', 'on', true);
    update public.purchase_orders set estoque_inicial = false where id = new.id;
    select p.id into v_proximo
      from public.purchase_orders p
     where p.franchise_id = new.franchise_id and p.id <> new.id
       and p.status is distinct from 'cancelado'
     order by p.created_at
     limit 1;
    if v_proximo is not null
       and not exists (select 1 from public.purchase_orders p
                        where p.franchise_id = new.franchise_id and p.estoque_inicial and p.id <> new.id) then
      update public.purchase_orders set estoque_inicial = true where id = v_proximo;
    end if;
    perform set_config('po_estoque_inicial.sistema', '', true);
  end if;
  return null;
end;
$$;
revoke execute on function public.po_estoque_inicial_despesas() from public, anon;

-- O gatilho AFTER passa a olhar também o status (cancelamento).
drop trigger if exists po_estoque_inicial_despesas on public.purchase_orders;
create trigger po_estoque_inicial_despesas after update of estoque_inicial, status on public.purchase_orders
  for each row execute function public.po_estoque_inicial_despesas();
