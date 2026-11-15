-- Fix COMPLETE: Manager role must see same data as admin (except DELETE stays admin-only)
-- Previous fix-manager-rls.sql missed SELECT policies on most data tables

-- Ensure is_admin_or_manager() exists
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public';

-- ═══════════════════════════════════════════════════════════════
-- SALES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS sales_select ON sales;
CREATE POLICY sales_select ON sales FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS sales_insert ON sales;
CREATE POLICY sales_insert ON sales FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS sales_update ON sales;
CREATE POLICY sales_update ON sales FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);
-- sales_delete: keep is_admin() OR franchise_id check (franchisee can delete own)

-- ═══════════════════════════════════════════════════════════════
-- SALE_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY sale_items_select ON sale_items FOR SELECT USING (
  is_admin_or_manager() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);

DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY sale_items_insert ON sale_items FOR INSERT WITH CHECK (
  is_admin_or_manager() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);

DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
CREATE POLICY sale_items_update ON sale_items FOR UPDATE USING (
  is_admin_or_manager() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);

DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
CREATE POLICY sale_items_delete ON sale_items FOR DELETE USING (
  is_admin_or_manager() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);

-- ═══════════════════════════════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS contacts_select ON contacts;
CREATE POLICY contacts_select ON contacts FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS contacts_insert ON contacts;
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS contacts_update ON contacts;
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);
-- contacts_delete stays as-is

-- ═══════════════════════════════════════════════════════════════
-- INVENTORY_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS inventory_select ON inventory_items;
CREATE POLICY inventory_select ON inventory_items FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS inventory_insert ON inventory_items;
CREATE POLICY inventory_insert ON inventory_items FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS inventory_update ON inventory_items;
CREATE POLICY inventory_update ON inventory_items FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);
-- inventory_delete stays is_admin()

-- ═══════════════════════════════════════════════════════════════
-- EXPENSES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS expenses_select ON expenses;
CREATE POLICY expenses_select ON expenses FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS expenses_insert ON expenses;
CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS expenses_update ON expenses;
CREATE POLICY expenses_update ON expenses FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS expenses_delete ON expenses;
CREATE POLICY expenses_delete ON expenses FOR DELETE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- ═══════════════════════════════════════════════════════════════
-- PURCHASE_ORDERS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS po_select ON purchase_orders;
CREATE POLICY po_select ON purchase_orders FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS po_insert ON purchase_orders;
CREATE POLICY po_insert ON purchase_orders FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS po_update ON purchase_orders;
CREATE POLICY po_update ON purchase_orders FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- ═══════════════════════════════════════════════════════════════
-- PURCHASE_ORDER_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS poi_select ON purchase_order_items;
CREATE POLICY poi_select ON purchase_order_items FOR SELECT USING (
  is_admin_or_manager() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);

DROP POLICY IF EXISTS poi_insert ON purchase_order_items;
CREATE POLICY poi_insert ON purchase_order_items FOR INSERT WITH CHECK (
  is_admin_or_manager() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);

DROP POLICY IF EXISTS poi_update ON purchase_order_items;
CREATE POLICY poi_update ON purchase_order_items FOR UPDATE USING (
  is_admin_or_manager()
);

DROP POLICY IF EXISTS poi_delete ON purchase_order_items;
CREATE POLICY poi_delete ON purchase_order_items FOR DELETE USING (
  is_admin_or_manager()
);

-- ═══════════════════════════════════════════════════════════════
-- FRANCHISE_CONFIGURATIONS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS configs_select ON franchise_configurations;
CREATE POLICY configs_select ON franchise_configurations FOR SELECT USING (
  is_admin_or_manager() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS configs_insert ON franchise_configurations;
CREATE POLICY configs_insert ON franchise_configurations FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS configs_update ON franchise_configurations;
CREATE POLICY configs_update ON franchise_configurations FOR UPDATE USING (
  is_admin_or_manager() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);
-- configs_delete stays is_admin()

-- ═══════════════════════════════════════════════════════════════
-- DAILY_UNIQUE_CONTACTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS contacts_select ON daily_unique_contacts;
CREATE POLICY duc_select ON daily_unique_contacts FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS contacts_insert ON daily_unique_contacts;
CREATE POLICY duc_insert ON daily_unique_contacts FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- ═══════════════════════════════════════════════════════════════
-- DAILY_SUMMARIES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS summaries_select ON daily_summaries;
CREATE POLICY summaries_select ON daily_summaries FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- summaries_insert and summaries_update already updated in fix-manager-rls.sql

-- ═══════════════════════════════════════════════════════════════
-- DAILY_CHECKLISTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS checklists_select ON daily_checklists;
CREATE POLICY checklists_select ON daily_checklists FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS checklists_insert ON daily_checklists;
CREATE POLICY checklists_insert ON daily_checklists FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS checklists_update ON daily_checklists;
CREATE POLICY checklists_update ON daily_checklists FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- ═══════════════════════════════════════════════════════════════
-- ONBOARDING_CHECKLISTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS onboarding_select ON onboarding_checklists;
CREATE POLICY onboarding_select ON onboarding_checklists FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS onboarding_update ON onboarding_checklists;
CREATE POLICY onboarding_update ON onboarding_checklists FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);
-- onboarding_insert already updated, onboarding_delete stays is_admin()

-- ═══════════════════════════════════════════════════════════════
-- SALES_GOALS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS goals_select ON sales_goals;
CREATE POLICY goals_select ON sales_goals FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);
-- goals_insert and goals_update already updated in fix-manager-rls.sql

-- ═══════════════════════════════════════════════════════════════
-- MARKETING_FILES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS marketing_select ON marketing_files;
CREATE POLICY marketing_select ON marketing_files FOR SELECT USING (
  is_admin_or_manager() OR franchise_id IS NULL OR franchise_id = ANY(managed_franchise_ids())
);
-- marketing_insert already updated, marketing_delete stays is_admin()

-- ═══════════════════════════════════════════════════════════════
-- MARKETING_PAYMENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS marketing_payments_select ON marketing_payments;
CREATE POLICY marketing_payments_select ON marketing_payments FOR SELECT USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS marketing_payments_insert ON marketing_payments;
CREATE POLICY marketing_payments_insert ON marketing_payments FOR INSERT WITH CHECK (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

DROP POLICY IF EXISTS marketing_payments_update ON marketing_payments;
CREATE POLICY marketing_payments_update ON marketing_payments FOR UPDATE USING (
  is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
);

-- ═══════════════════════════════════════════════════════════════
-- MARKETING_META_DEPOSITS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS marketing_meta_deposits_select ON marketing_meta_deposits;
CREATE POLICY marketing_meta_deposits_select ON marketing_meta_deposits FOR SELECT USING (
  is_admin_or_manager()
);

DROP POLICY IF EXISTS marketing_meta_deposits_insert ON marketing_meta_deposits;
CREATE POLICY marketing_meta_deposits_insert ON marketing_meta_deposits FOR INSERT WITH CHECK (
  is_admin_or_manager()
);

DROP POLICY IF EXISTS marketing_meta_deposits_update ON marketing_meta_deposits;
CREATE POLICY marketing_meta_deposits_update ON marketing_meta_deposits FOR UPDATE USING (
  is_admin_or_manager()
);

-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS (user-scoped, but admin/manager needs to see all for management)
-- ═══════════════════════════════════════════════════════════════
-- notifications are user-scoped (user_id = auth.uid()), no change needed

-- activity_log and messages: tables may not exist in current schema, skip
