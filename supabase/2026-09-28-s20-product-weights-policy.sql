-- S20.2 (Onda 6, 28/09/2026): advisor "multiple_permissive_policies" em product_weights.
-- product_weights_write era FOR ALL (inclui SELECT) e somava com product_weights_select (SELECT true):
-- toda leitura avaliava as duas. Troca por 3 policies só de escrita — mesmo acesso de antes
-- (leitura: todo authenticated; escrita: admin/gerente).
-- ROLLBACK:
--   drop policy if exists product_weights_insert on public.product_weights;
--   drop policy if exists product_weights_update on public.product_weights;
--   drop policy if exists product_weights_delete on public.product_weights;
--   create policy product_weights_write on public.product_weights as permissive for all to authenticated
--     using ((select is_admin_or_manager())) with check ((select is_admin_or_manager()));
begin;
drop policy if exists product_weights_write on public.product_weights;
create policy product_weights_insert on public.product_weights as permissive for insert to authenticated
  with check ((select is_admin_or_manager()));
create policy product_weights_update on public.product_weights as permissive for update to authenticated
  using ((select is_admin_or_manager())) with check ((select is_admin_or_manager()));
create policy product_weights_delete on public.product_weights as permissive for delete to authenticated
  using ((select is_admin_or_manager()));
commit;
