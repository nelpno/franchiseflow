# FASE 5 — Unificação Franqueados + Contatos + Vendedor Genérico

## Resumo

Consolidar dados de franquias, usuários, contatos/leads e configuração do vendedor em uma arquitetura unificada. Eliminar o segundo Supabase (clientes_franquias), automatizar onboarding, e criar pipeline de vendas vinculado a clientes.

## Problemas Atuais

### Onboarding manual (6 passos em 4 lugares)
1. Admin cria franquia em Franchises.jsx
2. Admin convida usuário por email
3. Franqueado cria conta
4. Admin vai em UserManagement e vincula manualmente (managed_franchise_ids)
5. Admin cria tabela no Supabase clientes_franquias (para o bot salvar leads)
6. Franqueado configura vendedor no wizard

### Dados fragmentados
- **FranchiseFlow Supabase**: franchises, profiles, sales, inventory, checklists, franchise_configurations
- **clientes_franquias Supabase**: 45+ tabelas idênticas (uma por cidade) com {telefone, nome, pedido, created_at}
- **Base44 API**: dadosunidade (franchise_configurations) — ainda lido pelo bot n8n

### Vendas sem vínculo com clientes
- Sales tem valor e data, mas não sabe QUEM comprou
- Impossível calcular recorrência, ticket médio por cliente, ou fazer remarketing

## Solução

### 1. Tabela `contacts` no FranchiseFlow Supabase

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,  -- evolution_instance_id
  telefone TEXT NOT NULL,
  nome TEXT,
  status TEXT DEFAULT 'novo_lead',
    -- novo_lead, em_negociacao, cliente, recorrente, remarketing, perdido
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
```

### 2. Vincular vendas a contatos

```sql
ALTER TABLE sales ADD COLUMN contact_id UUID REFERENCES contacts(id);
CREATE INDEX idx_sales_contact ON sales(contact_id);

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
    total_spent = total_spent + NEW.value,
    last_purchase_at = NEW.sale_date,
    updated_at = now()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sale_created
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION update_contact_on_sale();
```

### 3. Auto-vinculação via invite

```sql
-- Trigger: quando user cria conta, vincular automaticamente se tem invite pendente
CREATE OR REPLACE FUNCTION auto_link_franchise_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  invite RECORD;
  franchise RECORD;
  current_ids TEXT[];
BEGIN
  -- Buscar invite pendente para este email
  SELECT fi.*, f.id as franchise_uuid, f.evolution_instance_id
  INTO invite
  FROM franchise_invites fi
  JOIN franchises f ON f.evolution_instance_id = fi.franchise_id
  WHERE fi.email = NEW.email
    AND fi.status = 'pending'
  LIMIT 1;

  IF invite IS NOT NULL THEN
    -- Pegar managed_franchise_ids atual
    SELECT managed_franchise_ids INTO current_ids FROM profiles WHERE id = NEW.id;
    current_ids := COALESCE(current_ids, '{}');

    -- Adicionar UUID e evolution_instance_id
    IF NOT (invite.franchise_uuid::TEXT = ANY(current_ids)) THEN
      current_ids := array_append(current_ids, invite.franchise_uuid::TEXT);
    END IF;
    IF NOT (invite.evolution_instance_id = ANY(current_ids)) THEN
      current_ids := array_append(current_ids, invite.evolution_instance_id);
    END IF;

    -- Atualizar profile
    UPDATE profiles SET
      managed_franchise_ids = current_ids,
      role = 'franchisee'
    WHERE id = NEW.id;

    -- Marcar invite como aceito
    UPDATE franchise_invites SET status = 'accepted' WHERE id = invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar após o trigger on_auth_user_created existente
CREATE TRIGGER auto_link_franchise
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_franchise_on_signup();
```

### 4. Migração do vendedor genérico n8n (7 nós)

| Nó | Hoje | Depois |
|----|------|--------|
| `dadosunidade` | HTTP GET Base44 API | Supabase SELECT `franchise_configurations` WHERE franchise_id=X |
| `GET_USER1` | SELECT `[cidade]` (tabela dinâmica) | SELECT `contacts` WHERE franchise_id=X AND telefone=Y |
| `CREATE_USER1` | INSERT `[cidade]` (telefone, nome) | INSERT `contacts` (franchise_id, telefone, nome, status='novo_lead') |
| `Supabase` (update) | UPDATE `[cidade]` SET created_at | UPDATE `contacts` SET last_contact_at=now() |
| `AtualizaNome` | UPDATE `[cidade]` SET nome | UPDATE `contacts` SET nome WHERE id=X |
| `consulta_nome` | SELECT `[cidade]` | SELECT `contacts` WHERE id=X |
| `deleta_lead1` | DELETE `[cidade]` | DELETE `contacts` WHERE id=X |

**Credencial**: Nova credencial Supabase apontando para FranchiseFlow (substituir `vendedor_bauru`).

**Estratégia de migração**: Dual-write (bot grava nos dois Supabase) até validar, depois remove o antigo.

### 5. Migração dos 45+ tabelas existentes

```sql
-- Script de migração (executar uma vez)
-- Para cada tabela cidade no clientes_franquias, inserir em contacts no FranchiseFlow

-- Exemplo para uma cidade (repetir para todas):
INSERT INTO contacts (franchise_id, telefone, nome, status, created_at)
SELECT
  'franquiacampinas',
  telefone,
  nome,
  CASE WHEN pedido IS NOT NULL AND pedido != '' THEN 'cliente' ELSE 'novo_lead' END,
  created_at
FROM dblink('clientes_franquias_connection', 'SELECT telefone, nome, pedido, created_at FROM campinas')
  AS t(telefone TEXT, nome TEXT, pedido TEXT, created_at TIMESTAMPTZ)
ON CONFLICT (franchise_id, telefone) DO NOTHING;
```

Nota: A migração pode ser feita via script n8n (HTTP Request lendo do Supabase antigo e inserindo no novo) para evitar dblink.

### 6. UI — Página "Franqueados" unificada (Abordagem C: drawer)

**View principal**: Lista de unidades franqueadas (cards)
- Cada card mostra: cidade, dono, status, contatos, WhatsApp
- Click abre drawer lateral com:
  - Dados da unidade
  - Usuário(s) vinculado(s)
  - Status do onboarding
  - Config do vendedor (resumo)
  - Status WhatsApp

**Seção "Equipe"**: Tabela simples no topo ou aba separada
- Mostra todos: admins, managers, franqueados
- Role, email, franquias vinculadas

**UserManagement.jsx**: Removido (absorvido)

### 7. UI — "Meus Clientes" (pipeline do franqueado)

Nova página com pipeline visual:
- Filtros por status (novo_lead, em_negociacao, cliente, recorrente, remarketing)
- Cards de contato com: nome, telefone, última compra, total gasto
- Ação rápida: registrar venda vinculada ao contato
- Busca por telefone/nome

### 8. Venda vinculada a contato

Ao registrar venda (Sales.jsx):
- Campo telefone com auto-complete de contatos existentes
- Se contato encontrado: preenche nome, vincula contact_id
- Se contato novo: cria automaticamente em contacts
- Trigger SQL atualiza purchase_count e total_spent

### 9. Dashboard franqueado turbinado

Adicionar ao FranchiseeDashboard:
- Leads novos hoje (count)
- Taxa de conversão (leads → vendas)
- Clientes sem compra há 15+ dias (alerta remarketing)

### 10. Sidebar colapsável (futuro)

Prioridade menor. Sub-menus agrupados:
- Minha Loja > Clientes, Vendas, Estoque
- Admin > Franquias, Equipe, Relatórios

## Ordem de Implementação

### Etapa 1 — Base de dados (sem tocar UI)
1. Criar tabela `contacts` com RLS
2. Adicionar `contact_id` em `sales`
3. Trigger `update_contact_on_sale`
4. Trigger `auto_link_franchise_on_signup`
5. Migrar dados dos 45+ tabelas para `contacts`

### Etapa 2 — Adaptar vendedor genérico n8n
1. Criar credencial Supabase FranchiseFlow no n8n
2. Alterar 7 nós para usar tabela `contacts`
3. Alterar `dadosunidade` para SELECT franchise_configurations
4. Dual-write: manter escrita antiga como fallback
5. Testar com 1 franquia piloto
6. Validar e remover dual-write

### Etapa 3 — UI unificada
1. "Meus Clientes" — pipeline de leads/contatos
2. Sales.jsx — auto-complete de contato por telefone
3. "Franqueados" — drawer com detalhes + usuários
4. Remover UserManagement.jsx
5. Dashboard — leads e conversão

### Etapa 4 — Limpeza
1. Remover referência Base44 de todos os workflows
2. Pausar projeto clientes_franquias no Supabase (manter como arquivo)
3. Atualizar CLAUDE.md com nova arquitetura

## Dados do projeto clientes_franquias (referência)
- **Project name**: clientes_franquias
- **Project ref**: kypcxjlinqdonfljefxu
- **URL**: https://kypcxjlinqdonfljefxu.supabase.co
- **Tabelas**: 45+ tabelas de cidades + documentssecretaria (RAG)
- **Schema por tabela**: id (bigint), telefone (text NOT NULL), nome (text), pedido (text), created_at (timestamptz)

## Decisões Arquiteturais

1. **Uma tabela `contacts` vs tabela por franquia**: Uma tabela com franchise_id é mais escalável, permite RLS, e elimina setup manual
2. **contacts no FranchiseFlow vs projeto separado**: Mesmo Supabase para simplificar credenciais e permitir JOINs com sales/franchises
3. **Dual-write na migração**: Segurança — se novo falhar, antigo continua
4. **purchase_count/total_spent cached vs computed**: Cached na tabela (trigger atualiza) para performance do pipeline view
5. **Drawer vs página separada para detalhes**: Drawer mantém contexto da lista, menos navegação
