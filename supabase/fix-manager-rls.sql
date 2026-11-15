-- Fix: Manager role blocked by is_admin() — create is_admin_or_manager() and update policies
-- Manager = same view as admin, but NO delete on franchises/staff

-- Step 1: Create helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Update RLS policies
-- Note: DELETE policies intentionally keep is_admin() — manager cannot delete

-- FRANCHISES
DROP POLICY IF EXISTS franchises_select ON franchises;
CREATE POLICY franchises_select ON franchises FOR SELECT
  USING (is_admin_or_manager() OR evolution_instance_id = ANY(managed_franchise_ids()));

DROP POLICY IF EXISTS franchises_insert ON franchises;
CREATE POLICY franchises_insert ON franchises FOR INSERT
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS franchises_update ON franchises;
CREATE POLICY franchises_update ON franchises FOR UPDATE
  USING (is_admin_or_manager());
-- franchises_delete stays is_admin()

-- PROFILES (manager needs to see all users for team/franchisee listing)
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (is_admin_or_manager() OR id = auth.uid());

DROP POLICY IF EXISTS profiles_update_admin ON profiles;
CREATE POLICY profiles_update_admin ON profiles FOR UPDATE
  USING (is_admin_or_manager());

-- FRANCHISE_INVITES (manager can manage invites)
DROP POLICY IF EXISTS invites_select ON franchise_invites;
CREATE POLICY invites_select ON franchise_invites FOR SELECT
  USING (is_admin_or_manager());

DROP POLICY IF EXISTS invites_insert ON franchise_invites;
CREATE POLICY invites_insert ON franchise_invites FOR INSERT
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS invites_update ON franchise_invites;
CREATE POLICY invites_update ON franchise_invites FOR UPDATE
  USING (is_admin_or_manager());

-- ONBOARDING_CHECKLISTS (manager can create)
DROP POLICY IF EXISTS onboarding_insert ON onboarding_checklists;
CREATE POLICY onboarding_insert ON onboarding_checklists FOR INSERT
  WITH CHECK (is_admin_or_manager());

-- SALES_GOALS (manager can create/update)
DROP POLICY IF EXISTS goals_insert ON sales_goals;
CREATE POLICY goals_insert ON sales_goals FOR INSERT
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS goals_update ON sales_goals;
CREATE POLICY goals_update ON sales_goals FOR UPDATE
  USING (is_admin_or_manager());

-- DAILY_SUMMARIES (manager can insert/update)
DROP POLICY IF EXISTS summaries_insert ON daily_summaries;
CREATE POLICY summaries_insert ON daily_summaries FOR INSERT
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS summaries_update ON daily_summaries;
CREATE POLICY summaries_update ON daily_summaries FOR UPDATE
  USING (is_admin_or_manager());

-- CATALOG_PRODUCTS (manager can insert/update, not delete)
DROP POLICY IF EXISTS catalog_insert ON catalog_products;
CREATE POLICY catalog_insert ON catalog_products FOR INSERT
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS catalog_update ON catalog_products;
CREATE POLICY catalog_update ON catalog_products FOR UPDATE
  USING (is_admin_or_manager());

-- MARKETING_FILES (manager can insert)
DROP POLICY IF EXISTS marketing_insert ON marketing_files;
CREATE POLICY marketing_insert ON marketing_files FOR INSERT
  WITH CHECK (is_admin_or_manager());
