-- 2026-09-07 — RLS: chamar os helpers UMA VEZ por query, nao uma vez por LINHA
--
-- POR QUE
--   is_admin(), is_admin_or_manager(), is_cs_or_admin() e managed_franchise_ids() sao STABLE e
--   SECURITY DEFINER. Escritos crus dentro da policy, o Postgres os trata como filtro de linha e
--   os executa para CADA tupla examinada. Medido em 07/09/2026, como um franqueado real
--   (9894d0fa..., Vila Maria, 1.079 vendas), com EXPLAIN (ANALYZE) e mediana de 3 execucoes:
--     sales, janela de 6 meses ....... 554,3 ms
--     contacts, lista de clientes .... 745,6 ms
--     daily_summaries ................ 298,4 ms
--     sale_items ..................... 300,3 ms
--     purchase_orders + itens ........ 148,4 ms
--   Envolver a chamada em (select fn()) transforma o filtro num InitPlan: roda uma vez, o
--   resultado vira constante e o indice volta a ser usado. Mesmo resultado logico, sempre.
--
-- O CAST ::text[] E OBRIGATORIO
--   'x = ANY (subquery)' e outra construcao de 'x = ANY (array)'. Sem o cast o Postgres le a
--   subquery como conjunto de LINHAS e falha com
--   'operator does not exist: text = text[]'. Com o cast ele volta a ser array.
--
-- O QUE NAO MUDA
--   Nenhuma condicao logica foi reescrita: so a forma de chamar as funcoes. Roles, PERMISSIVE,
--   comando e a presenca/ausencia de WITH CHECK ficam identicos (por isso ALTER POLICY, nao
--   DROP + CREATE: nao existe janela em que a tabela fique sem policy).
--   As policies de bot_conversations/conversation_messages ja tinham sido reescritas na onda 0.
--   profiles_update e marketing_payments_update continuam SEM WITH CHECK proprio de proposito —
--   quem barra escalonamento ali sao os triggers trg_guard_profile_privilege_columns e
--   trg_guard_marketing_payment_approval.
--
-- ROLLBACK
--   O bloco comentado no fim do arquivo desfaz tudo (regex inversa). O texto original de cada
--   policy tambem fica salvo em public._backup_rls_policies_2026_09_07.
--
-- Policies alteradas: 91
begin;

create table if not exists public._backup_rls_policies_2026_09_07 as
select schemaname, tablename, policyname, permissive, roles::text as roles, cmd, qual, with_check, now() as salvo_em
from pg_policies where schemaname = 'public';

alter policy "Users can view own franchise logs" on public.audit_logs
  using (((franchise_id = ANY ((select managed_franchise_ids())::text[])) OR (select is_admin())));

alter policy "audit_logs_delete" on public.audit_logs
  using ((select is_admin()));

alter policy "bot_conv_delete" on public.bot_conversations
  using ((select is_admin()));

alter policy "bot_conv_insert" on public.bot_conversations
  with check (((select is_admin_or_manager()) OR (franchise_id IN ( SELECT unnest(profiles.managed_franchise_ids) AS unnest
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

alter policy "Admin deleta" on public.bot_reports
  using ((select is_admin()));

alter policy "bot_reports_select" on public.bot_reports
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "catalog_delete" on public.catalog_products
  using ((select is_admin()));

alter policy "catalog_insert" on public.catalog_products
  with check ((select is_admin_or_manager()));

alter policy "catalog_update" on public.catalog_products
  using ((select is_admin_or_manager()));

alter policy "coach_actions_admin_delete" on public.coach_actions
  using ((select is_admin()));

alter policy "coach_actions_admin_update" on public.coach_actions
  using ((select is_admin()));

alter policy "coach_actions_select" on public.coach_actions
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "contacts_delete" on public.contacts
  using (((select is_admin()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "contacts_insert" on public.contacts
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "contacts_select" on public.contacts
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "contacts_update" on public.contacts
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "conv_msg_delete" on public.conversation_messages
  using ((select is_admin()));

alter policy "checklists_insert" on public.daily_checklists
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "checklists_select" on public.daily_checklists
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "checklists_update" on public.daily_checklists
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "daily_checklists_delete" on public.daily_checklists
  using ((select is_admin()));

alter policy "daily_summaries_delete" on public.daily_summaries
  using ((select is_admin()));

alter policy "summaries_insert" on public.daily_summaries
  with check ((select is_admin_or_manager()));

alter policy "summaries_select" on public.daily_summaries
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "summaries_update" on public.daily_summaries
  using ((select is_admin_or_manager()));

alter policy "duc_insert" on public.daily_unique_contacts
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "duc_select" on public.daily_unique_contacts
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "expenses_delete" on public.expenses
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "expenses_insert" on public.expenses
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "expenses_select" on public.expenses
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "expenses_update" on public.expenses
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "configs_delete" on public.franchise_configurations
  using ((select is_admin()));

alter policy "configs_insert" on public.franchise_configurations
  with check (((select is_admin_or_manager()) OR (franchise_evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "configs_select" on public.franchise_configurations
  using (((select is_admin_or_manager()) OR (franchise_evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "configs_update" on public.franchise_configurations
  using (((select is_admin_or_manager()) OR (franchise_evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "invites_delete" on public.franchise_invites
  using ((select is_admin()));

alter policy "invites_insert" on public.franchise_invites
  with check ((select is_admin_or_manager()));

alter policy "invites_select" on public.franchise_invites
  using ((select is_admin_or_manager()));

alter policy "invites_update" on public.franchise_invites
  using ((select is_admin_or_manager()));

alter policy "franchises_delete" on public.franchises
  using ((select is_admin()));

alter policy "franchises_insert" on public.franchises
  with check ((select is_admin_or_manager()));

alter policy "franchises_select" on public.franchises
  using (((select is_admin_or_manager()) OR (evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "franchises_update" on public.franchises
  using (((select is_admin_or_manager()) OR (evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))))
  with check (((select is_admin_or_manager()) OR (evolution_instance_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "inventory_delete" on public.inventory_items
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "inventory_insert" on public.inventory_items
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "inventory_select" on public.inventory_items
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "inventory_update" on public.inventory_items
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "marketing_delete" on public.marketing_files
  using ((select is_admin()));

alter policy "marketing_insert" on public.marketing_files
  with check ((select is_admin_or_manager()));

alter policy "marketing_select" on public.marketing_files
  using (((select is_admin_or_manager()) OR (franchise_id IS NULL) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "marketing_update" on public.marketing_files
  using ((select is_admin()));

alter policy "admin_delete_deposits" on public.marketing_meta_deposits
  using ((select is_admin()));

alter policy "marketing_meta_deposits_insert" on public.marketing_meta_deposits
  with check ((select is_admin_or_manager()));

alter policy "marketing_meta_deposits_select" on public.marketing_meta_deposits
  using ((select is_admin_or_manager()));

alter policy "marketing_meta_deposits_update" on public.marketing_meta_deposits
  using ((select is_admin_or_manager()));

alter policy "marketing_payments_insert" on public.marketing_payments
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "marketing_payments_select" on public.marketing_payments
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "marketing_payments_update" on public.marketing_payments
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "onboarding_delete" on public.onboarding_checklists
  using ((select is_admin()));

alter policy "onboarding_insert" on public.onboarding_checklists
  with check ((select is_admin_or_manager()));

alter policy "onboarding_select" on public.onboarding_checklists
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "onboarding_update" on public.onboarding_checklists
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "photos_admin_delete" on public.product_photos
  using ((select is_admin()));

alter policy "photos_admin_insert" on public.product_photos
  with check ((select is_admin()));

alter policy "photos_admin_update" on public.product_photos
  using ((select is_admin()));

alter policy "profiles_select" on public.profiles
  using (((select is_admin()) OR (id = ( SELECT auth.uid() AS uid))));

alter policy "profiles_update" on public.profiles
  using (((select is_admin()) OR (id = ( SELECT auth.uid() AS uid))));

alter policy "poi_delete" on public.purchase_order_items
  using ((select is_admin_or_manager()));

alter policy "poi_insert" on public.purchase_order_items
  with check (((select is_admin_or_manager()) OR (order_id IN ( SELECT purchase_orders.id
   FROM purchase_orders
  WHERE (purchase_orders.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "poi_select" on public.purchase_order_items
  using (((select is_admin_or_manager()) OR (order_id IN ( SELECT purchase_orders.id
   FROM purchase_orders
  WHERE (purchase_orders.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "poi_update" on public.purchase_order_items
  using ((select is_admin_or_manager()));

alter policy "po_insert" on public.purchase_orders
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "po_select" on public.purchase_orders
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "po_update" on public.purchase_orders
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "purchase_orders_delete" on public.purchase_orders
  using ((select is_admin()));

alter policy "sale_items_delete" on public.sale_items
  using (((select is_admin_or_manager()) OR (sale_id IN ( SELECT sales.id
   FROM sales
  WHERE (sales.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "sale_items_insert" on public.sale_items
  with check (((select is_admin_or_manager()) OR (sale_id IN ( SELECT sales.id
   FROM sales
  WHERE (sales.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "sale_items_select" on public.sale_items
  using (((select is_admin_or_manager()) OR (sale_id IN ( SELECT sales.id
   FROM sales
  WHERE (sales.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "sale_items_update" on public.sale_items
  using (((select is_admin_or_manager()) OR (sale_id IN ( SELECT sales.id
   FROM sales
  WHERE (sales.franchise_id = ANY ((select managed_franchise_ids())::text[]))))));

alter policy "sales_delete" on public.sales
  using (((select is_admin()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "sales_insert" on public.sales
  with check (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "sales_select" on public.sales
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "sales_update" on public.sales
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "goals_insert" on public.sales_goals
  with check ((select is_admin_or_manager()));

alter policy "goals_select" on public.sales_goals
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

alter policy "goals_update" on public.sales_goals
  using ((select is_admin_or_manager()));

alter policy "sales_goals_delete" on public.sales_goals
  using ((select is_admin()));

alter policy "admin_delete" on public.system_subscriptions
  using ((select is_admin()));

alter policy "admin_insert" on public.system_subscriptions
  with check ((select is_admin()));

alter policy "admin_update" on public.system_subscriptions
  using ((select is_admin()));

alter policy "franchisee_select_own" on public.system_subscriptions
  using (((select is_admin_or_manager()) OR (franchise_id = ANY ((select managed_franchise_ids())::text[]))));

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (rodar inteiro; desfaz o wrap em todas as policies do schema public)
-- ---------------------------------------------------------------------------
-- do \$
-- declare r record; q text; w text;
-- begin
--   for r in select tablename, policyname, qual, with_check from pg_policies where schemaname='public' loop
--     q := regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(r.qual,''),
--            '(s*SELECT managed_franchise_ids() AS managed_franchise_idss*)::text[]','managed_franchise_ids()','gi'),
--            '(s*SELECT is_admin_or_manager() AS is_admin_or_managers*)','is_admin_or_manager()','gi'),
--            '(s*SELECT is_cs_or_admin() AS is_cs_or_admins*)','is_cs_or_admin()','gi'),
--            '(s*SELECT is_admin() AS is_admins*)','is_admin()','gi');
--     w := regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(r.with_check,''),
--            '(s*SELECT managed_franchise_ids() AS managed_franchise_idss*)::text[]','managed_franchise_ids()','gi'),
--            '(s*SELECT is_admin_or_manager() AS is_admin_or_managers*)','is_admin_or_manager()','gi'),
--            '(s*SELECT is_cs_or_admin() AS is_cs_or_admins*)','is_cs_or_admin()','gi'),
--            '(s*SELECT is_admin() AS is_admins*)','is_admin()','gi');
--     if q is distinct from coalesce(r.qual,'') or w is distinct from coalesce(r.with_check,'') then
--       execute format('alter policy %I on public.%I %s %s', r.policyname, r.tablename,
--         case when coalesce(r.qual,'')<>'' then 'using ('||q||')' else '' end,
--         case when coalesce(r.with_check,'')<>'' then 'with check ('||w||')' else '' end);
--     end if;
--   end loop;
-- end
-- \$;
