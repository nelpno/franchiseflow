-- Corpo vivo em 29/09/2026 antes de 2026-09-29-nomes-padrao-estoque.sql (reaplicar = voltar).
CREATE OR REPLACE FUNCTION public.guard_inventory_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;
