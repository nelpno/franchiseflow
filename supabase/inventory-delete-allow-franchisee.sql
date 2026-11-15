-- 2026-05-08: permitir franqueado/manager apagarem itens da própria franquia
-- (antes: somente is_admin()). FKs sale_items e purchase_order_items são
-- ON DELETE NO ACTION, portanto histórico de vendas/pedidos continua protegido.
ALTER POLICY inventory_delete ON public.inventory_items
  USING (is_admin_or_manager() OR franchise_id = ANY (managed_franchise_ids()));