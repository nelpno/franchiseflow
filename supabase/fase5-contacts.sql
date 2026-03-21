-- ============================================================
-- FASE 5: Tabela contacts unificada + triggers
-- Substitui 45+ tabelas do projeto clientes_franquias
-- ============================================================

-- 1. TABELA CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  nome TEXT,
  status TEXT DEFAULT 'novo_lead',
  endereco TEXT,
  bairro TEXT,
  notas TEXT,
  tags TEXT[],
  last_contact_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  purchase_count INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, telefone)
);

-- 2. RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON contacts FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "contacts_update" ON contacts FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "contacts_delete" ON contacts FOR DELETE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

-- 3. ÍNDICES
CREATE INDEX idx_contacts_franchise ON contacts(franchise_id);
CREATE INDEX idx_contacts_telefone ON contacts(telefone);
CREATE INDEX idx_contacts_status ON contacts(franchise_id, status);
CREATE INDEX idx_contacts_last_purchase ON contacts(franchise_id, last_purchase_at);

-- 4. FK SALES → CONTACTS
ALTER TABLE sales ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
CREATE INDEX IF NOT EXISTS idx_sales_contact ON sales(contact_id);

-- 5. TRIGGER: atualizar contato quando venda é criada
CREATE OR REPLACE FUNCTION update_contact_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts SET
    status = CASE
      WHEN purchase_count >= 2 THEN 'recorrente'
      ELSE 'cliente'
    END,
    purchase_count = purchase_count + 1,
    total_spent = total_spent + COALESCE(NEW.value, 0),
    last_purchase_at = COALESCE(NEW.sale_date::TIMESTAMPTZ, now()),
    updated_at = now()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_created ON sales;
CREATE TRIGGER on_sale_created
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION update_contact_on_sale();

-- 6. TRIGGER: auto-vincular franchise quando user cria conta com invite pendente
CREATE OR REPLACE FUNCTION auto_link_franchise_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  invite RECORD;
  current_ids TEXT[];
BEGIN
  FOR invite IN
    SELECT fi.id as invite_id, fi.franchise_id as evo_id, f.id as franchise_uuid
    FROM franchise_invites fi
    JOIN franchises f ON f.evolution_instance_id = fi.franchise_id
    WHERE fi.email = NEW.email AND fi.status = 'pending'
  LOOP
    current_ids := COALESCE(NEW.managed_franchise_ids, '{}');

    IF NOT (invite.franchise_uuid::TEXT = ANY(current_ids)) THEN
      current_ids := array_append(current_ids, invite.franchise_uuid::TEXT);
    END IF;
    IF NOT (invite.evo_id = ANY(current_ids)) THEN
      current_ids := array_append(current_ids, invite.evo_id);
    END IF;

    UPDATE profiles SET
      managed_franchise_ids = current_ids,
      role = COALESCE(NULLIF(role, ''), 'franchisee')
    WHERE id = NEW.id;

    UPDATE franchise_invites SET status = 'accepted' WHERE id = invite.invite_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_link_franchise ON profiles;
CREATE TRIGGER auto_link_franchise
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_franchise_on_signup();
