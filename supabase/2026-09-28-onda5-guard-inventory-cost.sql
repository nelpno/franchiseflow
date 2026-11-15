-- Onda 5 (28/09/2026) · pendência da S14 (P3 ponto 1): a franqueada podia alterar pela API
-- o custo dos itens PADRÃO da rede (`cost_price` com created_by_franchisee=false) e o próprio
-- `created_by_franchisee` — a policy inventory_update libera a linha inteira.
-- O app já não manda esses campos (TabEstoque apaga cost_price de item padrão; o update nunca
-- manda created_by_franchisee). Este guard fecha o caminho direto pela API.
--
-- Regra: em UPDATE feito DIRETO pela API (current_user = 'authenticated') por quem não é
-- admin/gerente, os dois campos ficam como estavam (preserva em silêncio, no padrão do
-- guard_onboarding_checklist: nunca derruba o resto do save).
-- NÃO afeta: funções SECURITY DEFINER (current_user = dono, ex.: record_external_purchase, que
-- recalcula o custo médio numa compra externa), service_role, SQL direto, admin/gerente.
-- Item próprio da franqueada (created_by_franchisee=true) continua com o custo editável.
--
-- ROLLBACK:
--   drop trigger if exists trg_guard_inventory_cost on public.inventory_items;
--   drop function if exists public.guard_inventory_cost();

create or replace function public.guard_inventory_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and not coalesce((select public.is_admin_or_manager()), false) then
    new.created_by_franchisee := old.created_by_franchisee;
    if coalesce(old.created_by_franchisee, false) = false then
      new.cost_price := old.cost_price;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_inventory_cost() from public, anon;

drop trigger if exists trg_guard_inventory_cost on public.inventory_items;
create trigger trg_guard_inventory_cost
  before update on public.inventory_items
  for each row execute function public.guard_inventory_cost();
