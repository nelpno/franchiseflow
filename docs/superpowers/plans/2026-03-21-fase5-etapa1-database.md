# FASE 5 Etapa 1 — Base de Dados (contacts + auto-vinculação)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar tabela `contacts` unificada, vincular vendas a contatos, auto-vincular users a franquias via invite, e migrar dados existentes das 45+ tabelas do clientes_franquias.

**Architecture:** SQL migrations executadas via Supabase Management API. Tabela `contacts` com RLS no FranchiseFlow Supabase. Trigger SQL atualiza contato automaticamente quando venda é criada. Trigger de auto-vinculação elimina passo manual de UserManagement. Migração de dados via n8n workflow (HTTP Request lendo do Supabase antigo → inserindo no novo). Entity adapter no frontend para acesso via `Contact.list()`.

**Tech Stack:** PostgreSQL (Supabase), SQL triggers, Supabase Management API, React (entity adapter)

**Spec:** `docs/superpowers/specs/2026-03-21-fase5-unificacao-design.md`

---

## Chunk 1: Tabela contacts + RLS

### Task 1: Criar tabela contacts no Supabase

**Files:**
- Create: `supabase/fase5-contacts.sql`

- [ ] **Step 1: Escrever migration SQL**

```sql
-- Tabela contacts unificada (substitui 45+ tabelas no clientes_franquias)
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

-- RLS
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

-- Índices
CREATE INDEX idx_contacts_franchise ON contacts(franchise_id);
CREATE INDEX idx_contacts_telefone ON contacts(telefone);
CREATE INDEX idx_contacts_status ON contacts(franchise_id, status);
CREATE INDEX idx_contacts_last_purchase ON contacts(franchise_id, last_purchase_at);
```

- [ ] **Step 2: Executar migration via Management API**

```bash
source .env
curl -s "https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL_AQUI>"}'
```

- [ ] **Step 3: Verificar tabela criada**

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contacts'
ORDER BY ordinal_position;
```

- [ ] **Step 4: Verificar RLS policies**

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'contacts';
```

Expected: 4 policies (select, insert, update, delete)

- [ ] **Step 5: Commit**

```bash
git add supabase/fase5-contacts.sql
git commit -m "feat: create contacts table with RLS for unified lead management"
```

---

### Task 2: Adicionar contact_id em sales + trigger

**Files:**
- Modify: `supabase/fase5-contacts.sql` (append)

- [ ] **Step 1: Escrever SQL para vincular sales a contacts**

```sql
-- Adicionar FK opcional em sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
CREATE INDEX IF NOT EXISTS idx_sales_contact ON sales(contact_id);

-- Trigger: atualizar contato quando venda é criada
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

CREATE TRIGGER on_sale_created
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION update_contact_on_sale();
```

- [ ] **Step 2: Executar via Management API**

- [ ] **Step 3: Verificar coluna adicionada**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'contact_id';
```

- [ ] **Step 4: Verificar trigger criado**

```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_sale_created';
```

- [ ] **Step 5: Testar trigger com dados**

```sql
-- Inserir contato de teste
INSERT INTO contacts (franchise_id, telefone, nome, status)
VALUES ('franquiasaojoao', '11999990000', 'Teste Trigger', 'novo_lead');

-- Pegar ID do contato
SELECT id FROM contacts WHERE telefone = '11999990000' AND franchise_id = 'franquiasaojoao';

-- Inserir venda vinculada (usar ID do contato)
INSERT INTO sales (franchise_id, contact_id, value, sale_date, contact_phone, customer_name, source)
VALUES ('franquiasaojoao', '<CONTACT_ID>', 85.00, '2026-03-21', '11999990000', 'Teste Trigger', 'whatsapp');

-- Verificar se contato foi atualizado
SELECT status, purchase_count, total_spent, last_purchase_at
FROM contacts WHERE telefone = '11999990000';
-- Expected: status='cliente', purchase_count=1, total_spent=85.00

-- Limpar dados de teste
DELETE FROM sales WHERE contact_phone = '11999990000' AND customer_name = 'Teste Trigger';
DELETE FROM contacts WHERE telefone = '11999990000' AND franchise_id = 'franquiasaojoao';
```

- [ ] **Step 6: Commit**

```bash
git add supabase/fase5-contacts.sql
git commit -m "feat: link sales to contacts with auto-update trigger"
```

---

## Chunk 2: Auto-vinculação + Entity adapter

### Task 3: Trigger de auto-vinculação user↔franchise via invite

**Files:**
- Modify: `supabase/fase5-contacts.sql` (append)

- [ ] **Step 1: Escrever trigger SQL**

```sql
-- Auto-vincular franchise quando user cria conta com invite pendente
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

-- Trigger após criação de profile (que já é criado por on_auth_user_created)
DROP TRIGGER IF EXISTS auto_link_franchise ON profiles;
CREATE TRIGGER auto_link_franchise
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_franchise_on_signup();
```

- [ ] **Step 2: Executar via Management API**

- [ ] **Step 3: Verificar trigger criado**

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'profiles' AND trigger_name = 'auto_link_franchise';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/fase5-contacts.sql
git commit -m "feat: auto-link franchise to user on signup via invite"
```

---

### Task 4: Entity adapter para contacts no frontend

**Files:**
- Modify: `src/entities/all.js` (adicionar Contact entity)

- [ ] **Step 1: Adicionar entity Contact**

No arquivo `src/entities/all.js`, adicionar após a linha do `InventoryItem`:

```javascript
export const Contact = createEntity('contacts');
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: Build passa sem erros

- [ ] **Step 3: Commit**

```bash
git add src/entities/all.js
git commit -m "feat: add Contact entity adapter for contacts table"
```

---

## Chunk 3: Migração de dados existentes

### Task 5: Script de migração das 45+ tabelas → contacts

**Files:**
- Create: `supabase/fase5-migrate-contacts.js`

Nota: A migração usa um script Node.js que lê do Supabase antigo (clientes_franquias) e insere no FranchiseFlow Supabase, pois os dois projetos não têm dblink entre si.

- [ ] **Step 1: Mapear tabelas para franchise_id**

Criar mapeamento de nome de tabela → evolution_instance_id:

```javascript
// Mapeamento: tabela no clientes_franquias → franchise_id no FranchiseFlow
const TABLE_FRANCHISE_MAP = {
  'americana': 'franquiaamericana',
  'araraquara': 'franquiaararaquara',
  'araras': 'franquiaararas',
  'assis': 'franquiaassis',
  'barretos': 'franquiabarretos',
  'bauru': 'franquiabauru',
  'cajamar': 'franquiacajamar',
  'campinas': 'franquiacampinas',
  'campobelo': 'franquiacampobelo',
  'cataguases': 'franquiacataguases',
  'cordeiroiracemapolis': 'franquiacordeiroiracemapolis',
  'cotia': 'franquiacotia',
  'embu': 'franquiaembu',
  'guarapiranga': 'franquiaguarapiranga',
  'guaruja': 'franquiaguaruja',
  'hortolandia': 'franquiahortolandia',
  'indaiatuba': 'franquiaindaiatuba',
  'itapetininga': 'franquiaitapetininga',
  'itapolis': 'franquiaitapolis',
  'itatiba': 'franquiaitatiba',
  'jdmarajoara': 'franquiajdmarajoara',
  'limeira': 'franquialimeira',
  'maua': 'franquiamaua',
  'mogi': 'franquiamogi',
  'novaodessa': 'franquianovaodessa',
  'osasco': 'franquiaosasco',
  'paranapanema': 'franquiaparanapanema',
  'piratininga': 'franquiapiratininga',
  'praiagrande': 'franquiapraiagrande',
  'ribeiraopreto': 'franquiaribeiraopreto',
  'rioclaro': 'franquiarioclaro',
  'riopreto': 'franquiariopreto',
  'santanadeparnaiba': 'franquiasantanadeparnaiba',
  'santoandre': 'franquiasantoandre',
  'santos': 'franquiasantos',
  'saocarlos': 'franquiasaocarlos',
  'saomiguelpaulista': 'franquiasaomiguelpaulista',
  'sorocabamariaaprado': 'franquiasorocabamariaaprado',
  'sorocabavilajardini': 'franquiasorocabavilajardini',
  'suzano': 'franquiasuzano',
  'ubatuba': 'franquiaubatuba',
  'uberlandia': 'franquiauberlandia',
  'viladosremedios': 'franquiaviladosremedios',
  'vilamaria': 'franquiavilamaria',
  'vilasocorro': 'franquiavilasocorro',
};
```

Nota: Tabelas duplicadas (maua_x, piratininga_2, saocarlos_2) precisam validação manual com Nelson — pode ser mesma franquia ou franquia diferente.

- [ ] **Step 2: Escrever script de migração**

```javascript
// supabase/fase5-migrate-contacts.js
// Executar com: node supabase/fase5-migrate-contacts.js
//
// Lê de clientes_franquias (Supabase antigo) e insere em contacts (FranchiseFlow)
// Usa upsert para ser idempotente (pode rodar múltiplas vezes)

const OLD_SUPABASE_URL = 'https://kypcxjlinqdonfljefxu.supabase.co';
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY;
const NEW_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLE_FRANCHISE_MAP = { /* mapeamento acima */ };

async function migrateTable(tableName, franchiseId) {
  // 1. Ler todos os contatos da tabela antiga
  const response = await fetch(
    `${OLD_SUPABASE_URL}/rest/v1/${tableName}?select=*`,
    {
      headers: {
        'apikey': OLD_SUPABASE_KEY,
        'Authorization': `Bearer ${OLD_SUPABASE_KEY}`,
      }
    }
  );
  const contacts = await response.json();
  if (!Array.isArray(contacts) || contacts.length === 0) {
    console.log(`  ${tableName}: 0 contatos (skip)`);
    return 0;
  }

  // 2. Preparar dados para upsert
  const rows = contacts.map(c => ({
    franchise_id: franchiseId,
    telefone: c.telefone,
    nome: c.nome || null,
    status: (c.pedido && c.pedido.trim()) ? 'cliente' : 'novo_lead',
    created_at: c.created_at || new Date().toISOString(),
  }));

  // 3. Inserir no FranchiseFlow (upsert por franchise_id+telefone)
  const upsertResponse = await fetch(
    `${NEW_SUPABASE_URL}/rest/v1/contacts`,
    {
      method: 'POST',
      headers: {
        'apikey': NEW_SUPABASE_KEY,
        'Authorization': `Bearer ${NEW_SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    }
  );

  if (!upsertResponse.ok) {
    console.error(`  ${tableName}: ERRO - ${await upsertResponse.text()}`);
    return 0;
  }

  console.log(`  ${tableName}: ${rows.length} contatos migrados → ${franchiseId}`);
  return rows.length;
}

async function main() {
  console.log('=== Migração clientes_franquias → contacts ===\n');
  let total = 0;

  for (const [table, franchiseId] of Object.entries(TABLE_FRANCHISE_MAP)) {
    const count = await migrateTable(table, franchiseId);
    total += count;
  }

  console.log(`\n=== Total: ${total} contatos migrados ===`);
}

main().catch(console.error);
```

- [ ] **Step 3: Adicionar OLD_SUPABASE_SERVICE_KEY ao .env**

```
# clientes_franquias (Supabase antigo - migração)
OLD_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...  # service_role key do clientes_franquias
```

- [ ] **Step 4: Executar migração**

```bash
source .env && node supabase/fase5-migrate-contacts.js
```

Expected: Lista de tabelas com contagem de contatos migrados

- [ ] **Step 5: Verificar dados migrados**

```sql
SELECT franchise_id, COUNT(*) as total,
  COUNT(CASE WHEN status = 'cliente' THEN 1 END) as clientes,
  COUNT(CASE WHEN status = 'novo_lead' THEN 1 END) as leads
FROM contacts
GROUP BY franchise_id
ORDER BY total DESC;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/fase5-migrate-contacts.js
git commit -m "feat: migration script for 45+ legacy contact tables to unified contacts"
```

---

### Task 6: Atualizar spec e CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Adicionar documentação da tabela contacts no CLAUDE.md**

Na seção "Arquitetura", adicionar após "Row Level Security":

```markdown
### Contatos/Leads (contacts)
- Tabela unificada substitui 45+ tabelas do projeto clientes_franquias
- `franchise_id` = evolution_instance_id da franquia
- `status`: novo_lead → em_negociacao → cliente → recorrente → remarketing → perdido
- `purchase_count`, `total_spent`, `last_purchase_at` atualizados por trigger quando venda é criada
- `sales.contact_id` FK opcional vincula venda a contato
- Bot n8n faz INSERT (franchise_id, telefone, nome) e UPDATE (last_contact_at) — campos simples
- UI e triggers cuidam dos campos de inteligência
```

Na seção "Regras Críticas", adicionar:

```markdown
25. Entity de contatos é `Contact` (tabela `contacts`) — usar `franchise_id` = `evolution_instance_id`
26. Bot n8n grava apenas: franchise_id, telefone, nome, last_contact_at — NÃO gravar status, purchase_count etc (triggers cuidam)
```

- [ ] **Step 2: Commit tudo**

```bash
git add CLAUDE.md supabase/fase5-contacts.sql
git commit -m "docs: update CLAUDE.md with contacts architecture and rules"
```

- [ ] **Step 3: Push**

```bash
git push
```
