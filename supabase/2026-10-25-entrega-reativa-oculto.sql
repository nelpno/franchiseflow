-- 25/10/2026: o pedido à fábrica passou a aceitar produto OCULTO (Embu escondeu o nhoque de P&M e
-- não achava para pedir). Produto que chega pela entrega volta a ficar visível (active = true):
-- se ela pediu, é porque vai vender, e oculto o robô não oferece.
-- Voltar: rodar de novo a versão anterior (sem a linha "active = true").
CREATE OR REPLACE FUNCTION public.on_purchase_order_delivered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'entregue' and old.status != 'entregue' then
    -- S15: soma o que CHEGOU (received_quantity); sem conferência, a quantidade pedida.
    update inventory_items ii
    set quantity = ii.quantity + coalesce(poi.received_quantity, poi.quantity),
        active = case when coalesce(poi.received_quantity, poi.quantity) > 0 then true else ii.active end
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
$function$;
