-- ============================================================================
-- Fix Supabase Database Linter: Security + Performance warnings
-- Data: 2026-04-15 | Executado via Management API
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 1: function_search_path_mutable (9 funções)                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER FUNCTION public.get_standard_product_catalog() SET search_path = 'public';
ALTER FUNCTION public.update_system_subscriptions_updated_at() SET search_path = 'public';
ALTER FUNCTION public.aggregate_daily_data(date) SET search_path = 'public';
ALTER FUNCTION public.delete_franchise_cascade(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.save_sale_with_items(uuid, jsonb, jsonb) SET search_path = 'public';
ALTER FUNCTION public.get_franchise_ranking(date, text) SET search_path = 'public';
ALTER FUNCTION public.is_admin_or_manager() SET search_path = 'public';
ALTER FUNCTION public.get_franchise_report_data(text, date, date) SET search_path = 'public';
ALTER FUNCTION public.get_unprocessed_conversations(integer) SET search_path = 'public';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 2: auth_rls_initplan — (select auth.uid()) em todas as policies  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 2a. profiles (merge update_self + update_admin em 1)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  is_admin() OR id = (select auth.uid())
);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  is_admin() OR id = (select auth.uid())
);

-- 2b. franchise_notes
DROP POLICY IF EXISTS "Admin and manager can read notes" ON franchise_notes;
CREATE POLICY "Admin and manager can read notes" ON franchise_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Admin and manager can insert notes" ON franchise_notes;
CREATE POLICY "Admin and manager can insert notes" ON franchise_notes FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Author can delete own notes" ON franchise_notes;
CREATE POLICY "Author can delete own notes" ON franchise_notes FOR DELETE USING (
  (select auth.uid()) = user_id
);

DROP POLICY IF EXISTS "Author can update own notes" ON franchise_notes;
CREATE POLICY "Author can update own notes" ON franchise_notes FOR UPDATE USING (
  (select auth.uid()) = user_id
);

-- 2c. bot_conversations (select, insert, update)
DROP POLICY IF EXISTS "bot_conv_select" ON bot_conversations;
CREATE POLICY "bot_conv_select" ON bot_conversations FOR SELECT USING (
  is_admin_or_manager() OR franchise_id IN (
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "bot_conv_insert" ON bot_conversations;
CREATE POLICY "bot_conv_insert" ON bot_conversations FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id IN (
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "bot_conv_update" ON bot_conversations;
CREATE POLICY "bot_conv_update" ON bot_conversations FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id IN (
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = (select auth.uid())
  )
);

-- 2d. notifications
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
CREATE POLICY "users_select_own_notifications" ON notifications FOR SELECT USING (
  user_id = (select auth.uid())
);

DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications FOR UPDATE USING (
  user_id = (select auth.uid())
);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (
  user_id = (select auth.uid())
);

-- 2e. audit_logs
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert logs" ON audit_logs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- 2f. marketing_payments (auth.uid() direto nas policies legadas)
DROP POLICY IF EXISTS "admin_delete" ON marketing_payments;
CREATE POLICY "admin_delete" ON marketing_payments FOR DELETE USING (
  (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = 'admin'
);

-- 2g. marketing_meta_deposits
-- manager_select recriada com (select auth.uid()), depois dropada na Fase 4


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 3: rls_policy_always_true — drop policies redundantes            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Service role full access" ON daily_unique_contacts;
DROP POLICY IF EXISTS "service_insert_notifications" ON notifications;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 4: multiple_permissive_policies — merge/drop duplicatas          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- bot_reports: merge 2 SELECT em 1
DROP POLICY IF EXISTS "Admin e manager veem todos" ON bot_reports;
DROP POLICY IF EXISTS "Franqueado ve os seus" ON bot_reports;
CREATE POLICY "bot_reports_select" ON bot_reports FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- coach_actions: merge 2 SELECT em 1
DROP POLICY IF EXISTS "coach_actions_admin_select" ON coach_actions;
DROP POLICY IF EXISTS "coach_actions_franchisee_select" ON coach_actions;
CREATE POLICY "coach_actions_select" ON coach_actions FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- marketing_meta_deposits: drop admin_all (FOR ALL redundante) e manager_select (coberto por _select)
DROP POLICY IF EXISTS "admin_all" ON marketing_meta_deposits;
DROP POLICY IF EXISTS "manager_select" ON marketing_meta_deposits;

-- marketing_payments: drop admin_manager_all (FOR ALL redundante) e franchisee_* (cobertos por marketing_payments_*)
DROP POLICY IF EXISTS "admin_manager_all" ON marketing_payments;
DROP POLICY IF EXISTS "franchisee_select" ON marketing_payments;
DROP POLICY IF EXISTS "franchisee_insert" ON marketing_payments;
DROP POLICY IF EXISTS "franchisee_update" ON marketing_payments;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 5: extension_in_public (unaccent → extensions schema)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = 'extensions'
AS $$ SELECT extensions.unaccent($1); $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 6: public_bucket_allows_listing — drop SELECT policies           ║
-- ║ URLs públicas funcionam sem SELECT policy em storage.objects           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "catalog_images_select" ON storage.objects;
DROP POLICY IF EXISTS "public_read_comprovantes" ON storage.objects;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 7: duplicate_index — drop índices duplicados                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP INDEX IF EXISTS idx_contacts_status;
DROP INDEX IF EXISTS idx_contacts_phone;
DROP INDEX IF EXISTS idx_duc_franchise_date;
DROP INDEX IF EXISTS idx_franchise_config_instance;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 8: unindexed_foreign_keys — criar índices em FKs sem cobertura   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_franchise_notes_user_id ON franchise_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_last_updated_by ON inventory_items(last_updated_by);
CREATE INDEX IF NOT EXISTS idx_marketing_files_franchise_id ON marketing_files(franchise_id);
CREATE INDEX IF NOT EXISTS idx_marketing_files_uploaded_by ON marketing_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_marketing_meta_deposits_created_by ON marketing_meta_deposits(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_payments_created_by ON marketing_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_inventory_item_id ON purchase_order_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_confirmed_by ON purchase_orders(confirmed_by);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ INFO: itens não resolvidos (decisão consciente)                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- unused_index (9): índices de features recentes (coach_actions, product_photos,
--   bot_conversations intent). Manter — podem ser úteis com crescimento de dados.
-- auth_db_connections: mudar para percentual no Dashboard (Auth > Connection Pooling)
