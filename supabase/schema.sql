-- ==============================================
-- FranchiseFlow - Schema Supabase
-- Executar no SQL Editor do Supabase Dashboard
-- ==============================================

-- ============================================
-- TABELA: franchises
-- ============================================
CREATE TABLE public.franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name TEXT NOT NULL,
  name TEXT,
  city TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  evolution_instance_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: profiles (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'franchisee' CHECK (role IN ('admin', 'franchisee', 'manager')),
  managed_franchise_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para criar profile automaticamente ao criar user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TABELA: sales
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  contact_phone TEXT,
  customer_name TEXT,
  value NUMERIC(10,2) DEFAULT 0,
  sale_date DATE NOT NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('bot', 'manual')),
  lead_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: daily_unique_contacts
-- ============================================
CREATE TABLE public.daily_unique_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  date DATE NOT NULL,
  contact_phone TEXT,
  contact_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, date, contact_phone)
);

-- ============================================
-- TABELA: daily_summaries
-- ============================================
CREATE TABLE public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  date DATE NOT NULL,
  unique_contacts INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  sales_value NUMERIC(10,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, date)
);

-- ============================================
-- TABELA: franchise_configurations (= dadosunidade do vendedor)
-- ============================================
CREATE TABLE public.franchise_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_evolution_instance_id TEXT UNIQUE REFERENCES franchises(evolution_instance_id),
  franchise_name TEXT,
  accepted_payment_methods TEXT,
  opening_hours TEXT,
  price_table_url TEXT,
  agent_name TEXT,
  promotions_combo TEXT,
  shipping_rules_costs TEXT,
  unit_address TEXT,
  address_reference TEXT,
  pix_key_data TEXT,
  personal_phone_for_summary TEXT,
  payment_link TEXT,
  social_media_links JSONB DEFAULT '{}',
  whatsapp_status TEXT DEFAULT 'disconnected' CHECK (whatsapp_status IN ('connected', 'pending_qr', 'disconnected')),
  whatsapp_instance_id TEXT,
  whatsapp_qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: onboarding_checklists
-- ============================================
CREATE TABLE public.onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'pending_approval', 'approved')),
  items JSONB DEFAULT '{}',
  completed_count INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: daily_checklists
-- ============================================
CREATE TABLE public.daily_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  date DATE NOT NULL,
  items JSONB DEFAULT '{}',
  completed_count INTEGER DEFAULT 0,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, date)
);

-- ============================================
-- TABELA: messages
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  sender_phone TEXT,
  content TEXT,
  is_incoming BOOLEAN DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NOVAS TABELAS: Features
-- ============================================

-- Inventário integrado
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  product_name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'un',
  min_stock NUMERIC(10,2) DEFAULT 0,
  last_updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catálogo de produtos
CREATE TABLE public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(10,2),
  image_path TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Distribuição de catálogo
CREATE TABLE public.catalog_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  distributed_at TIMESTAMPTZ DEFAULT now(),
  distributed_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed'))
);

-- Convites para franqueados
CREATE TABLE public.franchise_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Metas de vendas
CREATE TABLE public.sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  month DATE NOT NULL,
  target_value NUMERIC(10,2) DEFAULT 0,
  target_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, month)
);

-- Log de atividades
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  franchise_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Repositório de marketing
CREATE TABLE public.marketing_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('posts', 'stories', 'catalogo', 'materiais_impressos', 'outros')),
  file_path TEXT NOT NULL,
  month TEXT,
  franchise_id TEXT REFERENCES franchises(evolution_instance_id),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_sales_franchise_date ON sales(franchise_id, sale_date);
CREATE INDEX idx_daily_contacts_franchise_date ON daily_unique_contacts(franchise_id, date);
CREATE INDEX idx_daily_summaries_franchise_date ON daily_summaries(franchise_id, date);
CREATE INDEX idx_daily_checklists_franchise_date ON daily_checklists(franchise_id, date);
CREATE INDEX idx_franchise_config_instance ON franchise_configurations(franchise_evolution_instance_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_franchise ON activity_log(franchise_id, created_at DESC);
CREATE INDEX idx_inventory_franchise ON inventory_items(franchise_id);
CREATE INDEX idx_marketing_month ON marketing_files(month, franchise_id);

-- ============================================
-- HELPER FUNCTIONS (RLS)
-- ============================================

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

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- FRANCHISES
CREATE POLICY "franchises_select" ON franchises FOR SELECT USING (
  is_admin() OR evolution_instance_id = ANY(managed_franchise_ids())
);
CREATE POLICY "franchises_insert" ON franchises FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "franchises_update" ON franchises FOR UPDATE USING (is_admin());
CREATE POLICY "franchises_delete" ON franchises FOR DELETE USING (is_admin());

-- PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  is_admin() OR id = auth.uid()
);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (is_admin());

-- SALES
CREATE POLICY "sales_select" ON sales FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "sales_delete" ON sales FOR DELETE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- DAILY_UNIQUE_CONTACTS
CREATE POLICY "contacts_select" ON daily_unique_contacts FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "contacts_insert" ON daily_unique_contacts FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- DAILY_SUMMARIES
CREATE POLICY "summaries_select" ON daily_summaries FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "summaries_insert" ON daily_summaries FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "summaries_update" ON daily_summaries FOR UPDATE USING (is_admin());

-- FRANCHISE_CONFIGURATIONS
CREATE POLICY "configs_select" ON franchise_configurations FOR SELECT USING (
  is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);
CREATE POLICY "configs_insert" ON franchise_configurations FOR INSERT WITH CHECK (
  is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);
CREATE POLICY "configs_update" ON franchise_configurations FOR UPDATE USING (
  is_admin() OR franchise_evolution_instance_id = ANY(managed_franchise_ids())
);
CREATE POLICY "configs_delete" ON franchise_configurations FOR DELETE USING (is_admin());

-- ONBOARDING_CHECKLISTS
CREATE POLICY "onboarding_select" ON onboarding_checklists FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "onboarding_insert" ON onboarding_checklists FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "onboarding_update" ON onboarding_checklists FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "onboarding_delete" ON onboarding_checklists FOR DELETE USING (is_admin());

-- DAILY_CHECKLISTS
CREATE POLICY "checklists_select" ON daily_checklists FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "checklists_insert" ON daily_checklists FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "checklists_update" ON daily_checklists FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- MESSAGES
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- INVENTORY_ITEMS
CREATE POLICY "inventory_select" ON inventory_items FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "inventory_insert" ON inventory_items FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "inventory_update" ON inventory_items FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "inventory_delete" ON inventory_items FOR DELETE USING (is_admin());

-- CATALOG_PRODUCTS (todos leem, admin gerencia)
CREATE POLICY "catalog_select" ON catalog_products FOR SELECT USING (true);
CREATE POLICY "catalog_insert" ON catalog_products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "catalog_update" ON catalog_products FOR UPDATE USING (is_admin());
CREATE POLICY "catalog_delete" ON catalog_products FOR DELETE USING (is_admin());

-- CATALOG_DISTRIBUTIONS
CREATE POLICY "distributions_select" ON catalog_distributions FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "distributions_insert" ON catalog_distributions FOR INSERT WITH CHECK (is_admin());

-- FRANCHISE_INVITES
CREATE POLICY "invites_select" ON franchise_invites FOR SELECT USING (is_admin());
CREATE POLICY "invites_insert" ON franchise_invites FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "invites_update" ON franchise_invites FOR UPDATE USING (is_admin());

-- SALES_GOALS
CREATE POLICY "goals_select" ON sales_goals FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "goals_insert" ON sales_goals FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "goals_update" ON sales_goals FOR UPDATE USING (is_admin());

-- ACTIVITY_LOG
CREATE POLICY "activity_select" ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY "activity_insert" ON activity_log FOR INSERT WITH CHECK (true);

-- MARKETING_FILES
CREATE POLICY "marketing_select" ON marketing_files FOR SELECT USING (
  is_admin() OR franchise_id IS NULL OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "marketing_insert" ON marketing_files FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "marketing_delete" ON marketing_files FOR DELETE USING (is_admin());

-- ============================================
-- AGGREGATE DAILY DATA (pg_cron replacement)
-- ============================================
CREATE OR REPLACE FUNCTION public.aggregate_daily_data(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
  INSERT INTO daily_summaries (franchise_id, date, unique_contacts, sales_count, sales_value, conversion_rate)
  SELECT
    f.evolution_instance_id,
    target_date,
    COALESCE(c.cnt, 0),
    COALESCE(s.cnt, 0),
    COALESCE(s.total, 0),
    CASE WHEN COALESCE(c.cnt, 0) > 0
      THEN ROUND((COALESCE(s.cnt, 0)::NUMERIC / c.cnt) * 100, 2)
      ELSE 0
    END
  FROM franchises f
  LEFT JOIN (
    SELECT franchise_id, COUNT(DISTINCT contact_phone) as cnt
    FROM daily_unique_contacts WHERE date = target_date GROUP BY franchise_id
  ) c ON c.franchise_id = f.evolution_instance_id
  LEFT JOIN (
    SELECT franchise_id, COUNT(*) as cnt, SUM(value - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0)) as total
    FROM sales WHERE sale_date = target_date GROUP BY franchise_id
  ) s ON s.franchise_id = f.evolution_instance_id
  WHERE f.status = 'active'
  ON CONFLICT (franchise_id, date) DO UPDATE SET
    unique_contacts = EXCLUDED.unique_contacts,
    sales_count = EXCLUDED.sales_count,
    sales_value = EXCLUDED.sales_value,
    conversion_rate = EXCLUDED.conversion_rate,
    updated_at = now();
$$ LANGUAGE sql;

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON franchises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON franchise_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON onboarding_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON catalog_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
