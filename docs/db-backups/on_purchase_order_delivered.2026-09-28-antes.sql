-- Backup do corpo VIVO antes da S15 (28/09/2026), tirado por pg_get_functiondef.
-- md5(prosrc) em produção = 90a21421731f883a34ee9316db7b819f
-- Reaplicar este arquivo = voltar a função ao estado de antes da S15.
CREATE OR REPLACE FUNCTION public.on_purchase_order_delivered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'entregue' and old.status != 'entregue' then
    update inventory_items ii
    set quantity = ii.quantity + poi.quantity
    from purchase_order_items poi
    where poi.order_id = new.id
      and poi.inventory_item_id = ii.id;

    -- Front já grava delivered_at no mesmo UPDATE (data escolhida na tela). Só usar "agora"
    -- quando NADA foi passado (coluna ausente do SET, ou igual ao valor já salvo).
    if new.delivered_at is not distinct from old.delivered_at then
      new.delivered_at = now();
    end if;
  end if;
  return new;
end;
$function$
;
