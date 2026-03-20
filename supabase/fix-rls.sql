-- Fix RLS policies (were not created properly)

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.managed_franchise_ids()
RETURNS TEXT[] AS $$
  SELECT COALESCE(managed_franchise_ids, '{}')
  FROM public.profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update_self ON profiles;
DROP POLICY IF EXISTS profiles_update_admin ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (is_admin() OR id = auth.uid());
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_update_admin ON profiles FOR UPDATE USING (is_admin());

-- FRANCHISES
DROP POLICY IF EXISTS franchises_select ON franchises;
DROP POLICY IF EXISTS franchises_insert ON franchises;
DROP POLICY IF EXISTS franchises_update ON franchises;
DROP POLICY IF EXISTS franchises_delete ON franchises;
CREATE POLICY franchises_select ON franchises FOR SELECT USING (is_admin() OR evolution_instance_id = ANY(managed_franchise_ids()));
CREATE POLICY franchises_insert ON franchises FOR INSERT WITH CHECK (is_admin());
CREATE POLICY franchises_update ON franchises FOR UPDATE USING (is_admin());
CREATE POLICY franchises_delete ON franchises FOR DELETE USING (is_admin());

-- SALES
DROP POLICY IF EXISTS sales_select ON sales;
DROP POLICY IF EXISTS sales_insert ON sales;
DROP POLICY IF EXISTS sales_update ON sales;
DROP POLICY IF EXISTS sales_delete ON sales;
CREATE POLICY sales_select ON sales FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY sales_insert ON sales FOR INSERT WITH CHECK (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY sales_update ON sales FOR UPDATE USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY sales_delete ON sales FOR DELETE USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));

-- DAILY_UNIQUE_CONTACTS
DROP POLICY IF EXISTS contacts_select ON daily_unique_contacts;
DROP POLICY IF EXISTS contacts_insert ON daily_unique_contacts;
CREATE POLICY contacts_select ON daily_unique_contacts FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY contacts_insert ON daily_unique_contacts FOR INSERT WITH CHECK (is_admin() OR franchise_id = ANY(managed_franchise_ids()));

-- DAILY_SUMMARIES
DROP POLICY IF EXISTS summaries_select ON daily_summaries;
DROP POLICY IF EXISTS summaries_insert ON daily_summaries;
DROP POLICY IF EXISTS summaries_update ON daily_summaries;
CREATE POLICY summaries_select ON daily_summaries FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY summaries_insert ON daily_summaries FOR INSERT WITH CHECK (is_admin());
CREATE POLICY summaries_update ON daily_summaries FOR UPDATE USING (is_admin());

-- FRANCHISE_CONFIGURATIONS
DROP POLICY IF EXISTS configs_select ON franchise_configurations;
DROP POLICY IF EXISTS configs_insert ON franchise_configurations;
DROP POLICY IF EXISTS configs_update ON franchise_configurations;
DROP POLICY IF EXISTS configs_delete ON franchise_configurations;
CREATE POLICY configs_select ON franchise_configurations FOR SELECT USING (is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids()));
CREATE POLICY configs_insert ON franchise_configurations FOR INSERT WITH CHECK (is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids()));
CREATE POLICY configs_update ON franchise_configurations FOR UPDATE USING (is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids()));
CREATE POLICY configs_delete ON franchise_configurations FOR DELETE USING (is_admin());

-- ONBOARDING
DROP POLICY IF EXISTS onboarding_select ON onboarding_checklists;
DROP POLICY IF EXISTS onboarding_insert ON onboarding_checklists;
DROP POLICY IF EXISTS onboarding_update ON onboarding_checklists;
DROP POLICY IF EXISTS onboarding_delete ON onboarding_checklists;
CREATE POLICY onboarding_select ON onboarding_checklists FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY onboarding_insert ON onboarding_checklists FOR INSERT WITH CHECK (is_admin());
CREATE POLICY onboarding_update ON onboarding_checklists FOR UPDATE USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY onboarding_delete ON onboarding_checklists FOR DELETE USING (is_admin());

-- DAILY_CHECKLISTS
DROP POLICY IF EXISTS checklists_select ON daily_checklists;
DROP POLICY IF EXISTS checklists_insert ON daily_checklists;
DROP POLICY IF EXISTS checklists_update ON daily_checklists;
CREATE POLICY checklists_select ON daily_checklists FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY checklists_insert ON daily_checklists FOR INSERT WITH CHECK (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY checklists_update ON daily_checklists FOR UPDATE USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));

-- MESSAGES
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));

-- INVENTORY
DROP POLICY IF EXISTS inventory_select ON inventory_items;
DROP POLICY IF EXISTS inventory_insert ON inventory_items;
DROP POLICY IF EXISTS inventory_update ON inventory_items;
DROP POLICY IF EXISTS inventory_delete ON inventory_items;
CREATE POLICY inventory_select ON inventory_items FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY inventory_insert ON inventory_items FOR INSERT WITH CHECK (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY inventory_update ON inventory_items FOR UPDATE USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY inventory_delete ON inventory_items FOR DELETE USING (is_admin());

-- CATALOG (todos leem, admin gerencia)
DROP POLICY IF EXISTS catalog_select ON catalog_products;
DROP POLICY IF EXISTS catalog_insert ON catalog_products;
DROP POLICY IF EXISTS catalog_update ON catalog_products;
DROP POLICY IF EXISTS catalog_delete ON catalog_products;
CREATE POLICY catalog_select ON catalog_products FOR SELECT USING (true);
CREATE POLICY catalog_insert ON catalog_products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY catalog_update ON catalog_products FOR UPDATE USING (is_admin());
CREATE POLICY catalog_delete ON catalog_products FOR DELETE USING (is_admin());

-- DISTRIBUTIONS
DROP POLICY IF EXISTS distributions_select ON catalog_distributions;
DROP POLICY IF EXISTS distributions_insert ON catalog_distributions;
CREATE POLICY distributions_select ON catalog_distributions FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY distributions_insert ON catalog_distributions FOR INSERT WITH CHECK (is_admin());

-- INVITES
DROP POLICY IF EXISTS invites_select ON franchise_invites;
DROP POLICY IF EXISTS invites_insert ON franchise_invites;
DROP POLICY IF EXISTS invites_update ON franchise_invites;
CREATE POLICY invites_select ON franchise_invites FOR SELECT USING (is_admin());
CREATE POLICY invites_insert ON franchise_invites FOR INSERT WITH CHECK (is_admin());
CREATE POLICY invites_update ON franchise_invites FOR UPDATE USING (is_admin());

-- SALES_GOALS
DROP POLICY IF EXISTS goals_select ON sales_goals;
DROP POLICY IF EXISTS goals_insert ON sales_goals;
DROP POLICY IF EXISTS goals_update ON sales_goals;
CREATE POLICY goals_select ON sales_goals FOR SELECT USING (is_admin() OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY goals_insert ON sales_goals FOR INSERT WITH CHECK (is_admin());
CREATE POLICY goals_update ON sales_goals FOR UPDATE USING (is_admin());

-- ACTIVITY_LOG
DROP POLICY IF EXISTS activity_select ON activity_log;
DROP POLICY IF EXISTS activity_insert ON activity_log;
CREATE POLICY activity_select ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY activity_insert ON activity_log FOR INSERT WITH CHECK (true);

-- MARKETING_FILES
DROP POLICY IF EXISTS marketing_select ON marketing_files;
DROP POLICY IF EXISTS marketing_insert ON marketing_files;
DROP POLICY IF EXISTS marketing_delete ON marketing_files;
CREATE POLICY marketing_select ON marketing_files FOR SELECT USING (is_admin() OR franchise_id IS NULL OR franchise_id = ANY(managed_franchise_ids()));
CREATE POLICY marketing_insert ON marketing_files FOR INSERT WITH CHECK (is_admin());
CREATE POLICY marketing_delete ON marketing_files FOR DELETE USING (is_admin());
