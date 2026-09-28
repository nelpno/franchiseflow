-- 2026-09-28 · S6.2 · "Recebido em" com o relógio do SERVIDOR
--
-- Por quê: `sales.confirmed_at` era gravado com `new Date()` do APARELHO (TabLancar).
-- Em 90 dias, 530 vendas recebidas tinham confirmed_at ANTES do created_at (quase todas
-- ~3.570 s = relógio do celular 1 h atrasado). O dado "data do recebimento" (S6.2/S12.1)
-- não pode depender do relógio do celular.
--
-- Regra (BEFORE INSERT/UPDATE em sales, só mexe em confirmed_at):
--   - vira recebida (INSERT recebida, ou UPDATE false/null -> true): confirmed_at = now()
--   - não recebida: confirmed_at = NULL
--   - continua recebida: mantém o confirmed_at que já estava (ignora o que o cliente mandar)
-- O front continua mandando confirmed_at (convive com o banco sem o trigger); aqui ele é
-- sobrescrito. Não mexe em nenhuma outra coluna e não altera dado antigo.
--
-- Pré-voo (28/09): triggers de sales = audit_on_sale_delete, on_sale_created,
-- revert_contact_on_sale_delete, set_updated_at, tr_sales_data_futura,
-- trg_sales_assign_number, trg_sales_contact_stats_upd, trg_sales_fill_customer_snapshot.
-- Nenhum escreve confirmed_at. Única função que lê payment_confirmed: get_financeiro_rede.
--
-- ROLLBACK (exato):
--   drop trigger if exists trg_sales_confirmed_at_servidor on public.sales;
--   drop function if exists public.sales_confirmed_at_servidor();

create or replace function public.sales_confirmed_at_servidor()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if new.payment_confirmed is true then
    if tg_op = 'INSERT' or old.payment_confirmed is distinct from true then
      new.confirmed_at := now();
    else
      new.confirmed_at := old.confirmed_at;
    end if;
  else
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.sales_confirmed_at_servidor() from public, anon;

drop trigger if exists trg_sales_confirmed_at_servidor on public.sales;
create trigger trg_sales_confirmed_at_servidor
  before insert or update of payment_confirmed, confirmed_at on public.sales
  for each row execute function public.sales_confirmed_at_servidor();
