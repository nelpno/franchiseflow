-- Denormaliza o snapshot do cliente (nome + telefone) nas vendas a partir do contato vinculado.
--
-- PROBLEMA (escala): a tela de Vendas carrega só os ~1000 contatos mais recentes por
-- franquia (Contact.filter sem fetchAll). Vendas vinculadas a contatos mais antigos
-- perdem o nome na lista ("—") e no comprovante (sem linha "Cliente"). Atinge sobretudo
-- vendas MANUAIS, que nunca gravavam customer_name/contact_phone (só contact_id) — o bot já grava.
-- Snapshot da rede (16/06/2026): 4 franquias > 1000 contatos, +10 entre 700-1000;
-- 5.501 vendas manuais (+243 do bot) sem customer_name mas com contato vinculado.
--
-- SOLUÇÃO: gravar nome + telefone na própria venda. Custo O(1) por venda (lookup por PK),
-- independente do tamanho da base de contatos. Lista e export já leem customer_name como
-- fallback; o comprovante recebe o fallback em patch no front (SaleReceipt.jsx), e o export
-- passa a ler a coluna real contact_phone (era sale.customer_phone, inexistente).
--
-- Pre-flight de triggers em sales (16/06): audit_on_sale_delete (BEFORE DELETE),
-- on_sale_created (AFTER INSERT), revert_contact_on_sale_delete (BEFORE DELETE),
-- set_updated_at (BEFORE UPDATE), trg_sales_assign_number (BEFORE INSERT).
-- Nenhum mexe em customer_name/contact_phone → sem conflito.

-- 1) Trigger: copia o snapshot (nome + telefone) do contato quando o campo vier vazio.
--    Cobre todos os caminhos de escrita (RPC save_sale_with_items, bot, edição).
--    coalesce preserva o que a venda já trouxe (não sobrescreve o nome limpo do bot).
--    Guard => no-op (custo zero) quando ambos já estão preenchidos.
create or replace function public.sales_fill_customer_snapshot()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if NEW.contact_id is not null
     and (NEW.customer_name is null or NEW.contact_phone is null) then
    select coalesce(NEW.customer_name, nome),
           coalesce(NEW.contact_phone, telefone)
      into NEW.customer_name, NEW.contact_phone
    from public.contacts
    where id = NEW.contact_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sales_fill_customer_snapshot on public.sales;
create trigger trg_sales_fill_customer_snapshot
  before insert or update on public.sales
  for each row
  execute function public.sales_fill_customer_snapshot();

-- 2) Backfill (idempotente): vendas existentes sem snapshot mas com contato vinculado.
--    Cobre as ~5.744 vendas (manual + bot) de toda a rede de uma vez.
update public.sales s
set customer_name = coalesce(s.customer_name, c.nome),
    contact_phone = coalesce(s.contact_phone, c.telefone)
from public.contacts c
where s.contact_id = c.id
  and (s.customer_name is null or s.contact_phone is null)
  and (c.nome is not null or c.telefone is not null);

-- Conferência pós-backfill (esperado ~0; restam só vendas sem contato, fora do alcance):
-- select count(*) from sales where customer_name is null and contact_id is not null;
