-- 22/11/2026: franqueada não apaga item da fábrica do Estoque (created_by_franchisee = false).
-- Por quê: item apagado some do pedido à fábrica (Noemi/Santo André e Grajaú apagaram o pão de queijo).
-- Ocultar (active=false) continua livre e mantém o item no pedido. Admin/gerente, service_role e
-- postgres (delete_franchise_cascade, scripts) passam; o guard só pega o papel `authenticated` comum,
-- no mesmo molde do guard_inventory_cost.
--
-- ROLLBACK:
--   drop trigger if exists trg_guard_inventory_delete on public.inventory_items;
--   drop function if exists public.guard_inventory_delete();

create or replace function public.guard_inventory_delete()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user = 'authenticated'
     and coalesce(old.created_by_franchisee, false) = false
     and not coalesce((select public.is_admin_or_manager()), false) then
    raise exception 'Produto da fábrica não pode ser excluído. Use Ocultar.'
      using errcode = 'P0001', hint = 'item_fabrica';
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_guard_inventory_delete on public.inventory_items;
create trigger trg_guard_inventory_delete
  before delete on public.inventory_items
  for each row execute function public.guard_inventory_delete();
