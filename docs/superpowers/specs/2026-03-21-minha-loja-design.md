# Minha Loja — Design Spec

**Data**: 2026-03-21
**Status**: Aprovado
**Decisão de naming**: "Minha Loja" (neurociência: pertencimento, posse, identidade empreendedora)

## Visão

"Minha Loja" é o hub central de gestão do franqueado. Unifica vendas, resultado financeiro e estoque em uma única página com 3 abas. Combinado com ações inteligentes no Dashboard e pipeline completo em Meus Clientes, forma um sistema híbrido onde cada perfil de franqueado (da Dona Maria de 58 anos ao Lucas de 27) encontra valor sem fricção.

## Decisões de Design

### Abordagem Híbrida (Opção C)
- **Dashboard (Início)**: motivação + top 3-5 ações do dia com botão WhatsApp direto
- **Minha Loja**: gestão do negócio (Lançar · Resultado · Estoque)
- **Meus Clientes**: pipeline completo + ações detalhadas por categoria

Justificativa: testado com 4 personas (Dona Maria/perdida, Lucas/motivado, Roberto/desmotivado, Carla/top performer). É o único que funciona para TODOS — quem tem pressa age no Dashboard, quem quer profundidade vai em Meus Clientes.

### Menu do Franqueado — de 7 para 5 itens

| # | Antes | Depois |
|---|-------|--------|
| 1 | Minha Loja (dashboard) | **Início** (dashboard motivacional + ações do dia) |
| 2 | Meus Clientes | **Minha Loja** (3 abas: Lançar · Resultado · Estoque) |
| 3 | Vendas | **Meus Clientes** (pipeline + ações detalhadas) |
| 4 | Estoque | **Marketing** |
| 5 | Marketing | **Meu Vendedor** |
| 6 | Checklist | ~~removido~~ (substituído por ações inteligentes) |
| 7 | Meu Vendedor | |

### Checklist operacional removido
Substituído por ações inteligentes baseadas em dados de clientes. O checklist original existia porque franqueados ficavam perdidos sem saber o que fazer. Agora o sistema gera direcionamento automaticamente a partir de dados reais (compras, contatos, tempo sem atividade).

## Minha Loja — Estrutura

### Topo fixo (acima das abas)
4 cards resumo:
- **Vendas hoje** — quantidade + valor (ex: "5 vendas · R$ 680")
- **Faturamento do mês** — total bruto acumulado
- **Lucro estimado** — faturamento - custos - despesas
- **Estoque baixo** — quantidade de itens abaixo do mínimo (alerta)

### Aba 1: Lançar

**Criar/editar venda:**
- Auto-complete contato por nome ou telefone (já existe) → salva `contact_id` na venda
- Seleção de produtos do estoque com quantidade (ex: 2x Lasanha, 1x Molho)
- Forma de pagamento: PIX, Cartão, Dinheiro
- Se cartão → campo taxa (%) → valor descontado calculado automaticamente
- Entrega: Retirada ou Delivery
- Se delivery → campo frete (R$) que o franqueado pagou
- Valor total e valor líquido calculados automaticamente
- Botão salvar → baixa estoque automática via trigger

**Lista de vendas recentes:**
- Vendas do dia/semana com indicação de origem (manual ou bot)
- Franqueado pode editar qualquer venda (inclusive as do bot)
- Filtro por período

### Aba 2: Resultado (P&L mensal)

**Demonstrativo:**
```
Faturamento bruto           R$ 8.500
(-) Custo dos produtos      R$ 3.200  ← automático (qty × cost_price dos sale_items)
(-) Taxas cartão            R$   340  ← automático (soma card_fee_amount das vendas)
(-) Frete pago              R$   180  ← automático (soma delivery_fee das vendas)
(-) Outras despesas         R$   250  ← manual (tabela expenses)
─────────────────────────────────────
= LUCRO ESTIMADO            R$ 4.530
```

**Outras despesas:**
- Seção para adicionar gastos avulsos: descrição + valor + data
- Ex: "Sacolas R$80", "Embalagens R$120", "Aluguel R$500"

**Insights:**
- Top 5 produtos mais vendidos (ranking)
- Produtos parados (tem estoque, não vende)
- Comparação com mês anterior (↑ ou ↓)

### Aba 3: Estoque

**Mantém funcionalidade existente:**
- CRUD de itens, edição inline de quantidade, filtro por categoria, busca

**Adiciona:**
- `cost_price` — admin define pros 28 padrão, franqueado define pros itens próprios
- `sale_price` — franqueado define (usado no cálculo de valor da venda)
- **Giro de estoque** — cruza vendas × estoque:
  - "Lasanha: vende 8/semana, você tem 10 → ✅ certo"
  - "Canelone: vende 0.5/semana, tem 15 → ⚠️ comprando demais"
- **Sugestão de compra** — baseado no giro, sugere quanto repor

## Ações Inteligentes

### No Dashboard (Início) — ações rápidas

Seção "Suas ações de hoje", máximo 3-5 cards prioritários:

| Tipo | Regra | Exemplo |
|------|-------|---------|
| Responder | `status = novo_lead` há mais de 24h | "Ana mandou mensagem ontem — responda!" |
| Reativar | `last_purchase_at` > 14 dias | "Maria não compra há 18 dias — mande um oi" |
| Converter | `em_negociacao` há mais de 7 dias | "João tá negociando há 10 dias — feche!" |
| Fidelizar | `recorrente` com 5+ compras | "Carla comprou 8x — agradeça!" |
| Remarketing | `perdido` há mais de 30 dias | "Pedro sumiu há 45 dias — tente novamente" |

Cada card: nome + contexto + botão WhatsApp + botão "feito".
Link "Ver todos →" leva pra Meus Clientes.

### Em Meus Clientes — ações completas

Topo da página com painel de ações por categoria:
- Abas: Responder (🔴) · Reativar (🟡) · Converter (🟠) · Fidelizar (🟢) · Remarketing (🟣)
- Contato mostra: nome, telefone, última compra, total gasto, dias sem contato
- Botão WhatsApp + botão anotar
- Abaixo: pipeline completo como já existe (todos os contatos com filtro por status)
- Ordenação por urgência (mais dias sem ação = mais acima)

### Lógica de geração
- Query SQL nos `contacts` cruzando `status`, `last_purchase_at`, `last_contact_at`, `purchase_count`
- Valores fixos por ora (reativar após 14 dias, etc.) — configurável pelo admin no futuro
- Executada no load da página, sem cron

## Banco de Dados

### Tabela `inventory_items` — novos campos
```sql
ALTER TABLE inventory_items ADD COLUMN cost_price NUMERIC(10,2);
ALTER TABLE inventory_items ADD COLUMN sale_price NUMERIC(10,2);
```

### Nova tabela `sale_items`
```sql
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_inventory ON sale_items(inventory_item_id);
```

### Tabela `sales` — novos/alterados campos
A coluna `source` JÁ EXISTE com CHECK constraint `('whatsapp', 'instagram', 'facebook', 'phone_call', 'in_person', 'website', 'other')`. Precisamos expandir o CHECK para incluir `'manual'` e `'bot'`.

```sql
-- Novos campos
ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'pix';
ALTER TABLE sales ADD COLUMN card_fee_percent NUMERIC(5,2);
ALTER TABLE sales ADD COLUMN card_fee_amount NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN delivery_method TEXT DEFAULT 'retirada';
ALTER TABLE sales ADD COLUMN delivery_fee NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN net_value NUMERIC(10,2);

-- Expandir CHECK constraint existente de source
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE sales ADD CONSTRAINT sales_source_check
  CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'phone_call', 'in_person', 'website', 'other', 'manual', 'bot'));
```

**Valores de `payment_method`**: usar constantes existentes de `PAYMENT_METHODS` em `franchiseUtils.js`: `'pix'`, `'payment_link'`, `'card_machine'`, `'cash'`.

**`contact_id`**: já existe na tabela `sales`. O auto-complete do contato DEVE popular `contact_id` ao salvar a venda (necessário para trigger `update_contact_on_sale` que já existe).

**`net_value`**: calculado no frontend antes de salvar: `net_value = value - card_fee_amount - delivery_fee`. Não é trigger — o franqueado vê o cálculo em tempo real enquanto preenche o formulário.

### Nova tabela `expenses`
```sql
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL REFERENCES franchises(evolution_instance_id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_franchise_date ON expenses(franchise_id, expense_date);
```

### Novas entities em `src/entities/all.js`
```js
export const SaleItem = createEntity('sale_items');
export const Expense = createEntity('expenses');
```

### Triggers de estoque

**ATENÇÃO**: Já existe trigger `on_sale_created` na tabela `sales` (em `supabase/fase5-contacts.sql`) que atualiza `contacts` (purchase_count, total_spent, status). Os triggers de estoque devem ter nomes distintos e coexistem (PostgreSQL executa em ordem alfabética).

**Trigger: `stock_decrement_on_sale_items_insert`** (AFTER INSERT ON `sale_items`):
```sql
CREATE OR REPLACE FUNCTION public.stock_decrement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER stock_decrement_on_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_decrement();
```

**Trigger: `stock_revert_on_sale_items_delete`** (BEFORE DELETE ON `sale_items`):
```sql
CREATE OR REPLACE FUNCTION public.stock_revert()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.inventory_item_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER stock_revert_on_delete
  BEFORE DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_revert();
```

**Edição de venda (sale_items update)**: o frontend deleta os sale_items antigos (trigger reverte estoque) e insere os novos (trigger decrementa). Usa `ON DELETE CASCADE` do sale_id, então editar = deletar items + reinserir. Simples e evita trigger complexo de UPDATE.

**Estoque negativo**: permitido (não adicionar CHECK >= 0). Franqueado pode vender mais do que tem registrado — o sistema mostra alerta visual mas não bloqueia.

### RLS para novas tabelas

**sale_items** (não tem `franchise_id` direto — usa subquery via `sales`):
```sql
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_select" ON sale_items FOR SELECT USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT WITH CHECK (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE USING (
  is_admin() OR sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))
);
```

**expenses**:
```sql
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
```

## UX Responsivo

Mobile-first. Cada tela funciona no celular com polegar.

| Componente | Mobile | Desktop |
|-----------|--------|---------|
| Minha Loja abas | Tabs horizontais com swipe | Tabs normais |
| Cards resumo (topo) | 2×2 grid compacto | 4 em linha |
| Lançar venda | Formulário full-screen, campos grandes | Formulário em card |
| Lista de vendas | Cards empilhados, swipe pra editar | Tabela |
| P&L Resultado | Blocos empilhados verticalmente | Layout 2 colunas |
| Estoque | Cards com edição inline | Tabela com colunas |
| Ações do dia (Dashboard) | Cards empilhados, botão WhatsApp grande | Grid 2-3 colunas |
| Meus Clientes ações | Abas scrolláveis + lista | Sidebar filtros + lista |
| Bottom nav | 5 itens + FAB "Vender" | Sidebar menu |

Tamanhos mínimos touch: botões 44px, inputs 48px altura, espaçamento 12px entre clicáveis.

## Bottom Nav Mobile
5 itens: Início · Minha Loja · [FAB +] · Clientes · Vendedor
FAB central "+" abre direto na aba Lançar de Minha Loja — atalho mais usado.

## Páginas afetadas
- **Nova**: `src/pages/MinhaLoja.jsx` (substitui Sales.jsx, absorve Inventory.jsx)
- **Modifica**: `src/pages/MyContacts.jsx` (adiciona painel de ações inteligentes no topo)
- **Modifica**: `src/components/dashboard/FranchiseeDashboard.jsx` (adiciona seção "Suas ações de hoje")
- **Modifica**: `src/components/Layout.jsx` (novo menu 5 itens + bottom nav atualizado)
- **Remove do menu**: Sales.jsx e Inventory.jsx como rotas diretas (conteúdo migra pra MinhaLoja)
- **Remove**: Checklist do menu franqueado

## Detalhes Técnicos Adicionais

### Snapshot de preços nos sale_items
Ao criar uma venda, o frontend copia `cost_price` e `sale_price` do `inventory_items` para os campos `cost_price` e `unit_price` do `sale_item`. Isso garante que o P&L calcula com o preço vigente na data da venda, mesmo que o admin atualize a tabela depois.

### Giro de estoque
Cálculo: `SUM(sale_items.quantity) / 4` das últimas 4 semanas (28 dias) por `inventory_item_id`. Query live no load da aba Estoque — sem materialização.

Exibe como: "X un/semana" ao lado de cada item. Compara com estoque atual:
- `estoque >= giro * 2` → ⚠️ comprando demais
- `estoque <= giro * 0.5` → 🔴 vai faltar
- senão → ✅ adequado

### Empty states
- **Lançar**: "Nenhuma venda registrada. Comece lançando sua primeira venda!"
- **Resultado**: "Sem dados para este mês. Lance vendas para ver seu resultado."
- **Estoque**: mantém empty state existente
- **Ações do dia (Dashboard)**: "Tudo em dia! Nenhuma ação pendente." (estado positivo, motivacional)
- **Meus Clientes ações**: "Todos os clientes estão em dia!" com link para adicionar contatos

### Acesso do admin
MinhaLoja.jsx é usada APENAS pelo franqueado. Admin acessa dados financeiros de cada franquia via Acompanhamento (existente). A página não renderiza para role=admin — admin é redirecionado para o Painel Geral.

### Checklist — migração
A tabela `daily_checklists` e entity `DailyChecklist` são MANTIDAS (dados históricos). Apenas removemos o item "Checklist" do menu do franqueado. Admin ainda pode ver histórico de checklists no Acompanhamento. Nenhuma exclusão de dados.

### Mobile: edição de vendas
Na lista de vendas mobile, usar Dialog para editar (padrão do projeto) — NÃO swipe gestures. Manter consistência com o resto do app.
