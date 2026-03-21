# Minha Loja Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Minha Loja" — the franchisee's central business hub with 3 tabs (Lançar, Resultado, Estoque), smart client actions on Dashboard, and enhanced Meus Clientes with action panel.

**Architecture:** New page `MinhaLoja.jsx` with tab-based layout absorbs Sales and Inventory functionality. Database gets `sale_items`, `expenses` tables and new columns on `sales`/`inventory_items`. Smart actions are query-driven (no cron). Layout menu reduced from 7 to 5 items.

**Tech Stack:** React 18, Tailwind CSS 3, shadcn/ui (Radix), Material Symbols, Supabase (Postgres + RLS), sonner toasts, date-fns

**Spec:** `docs/superpowers/specs/2026-03-21-minha-loja-design.md`

**Key conventions (from CLAUDE.md):**
- Icons: `<MaterialIcon icon="name" />` — NEVER Lucide
- Entities: import from `@/entities/all` — NEVER `supabase.from()` in pages
- Routes: `createPageUrl("PageName")` generates `"/PageName"` (capitalized)
- `franchise_id` in `inventory_items` = `evolution_instance_id` (text), NOT UUID
- Toasts: `sonner` — NEVER `alert()` or `window.confirm()`
- Dialogs: shadcn `Dialog` for confirmations — NEVER `window.confirm()`
- Paleta: primary `#b91c1c`, gold `#d4af37`, surface `#fbf9fa`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/pages/MinhaLoja.jsx` | Hub page: tabs container, summary cards, tab switching |
| `src/components/minha-loja/TabLancar.jsx` | Sales form + sales list (migrated from Sales.jsx) |
| `src/components/minha-loja/TabResultado.jsx` | P&L demonstrativo + expenses + insights |
| `src/components/minha-loja/TabEstoque.jsx` | Inventory management + turnover (migrated from Inventory.jsx) |
| `src/components/minha-loja/SaleForm.jsx` | Sale creation/edit form with product selection |
| `src/components/minha-loja/ExpenseForm.jsx` | Simple expense add/edit form |
| `src/components/dashboard/SmartActions.jsx` | "Suas ações de hoje" card list |
| `src/components/my-contacts/ActionPanel.jsx` | Action categories panel for Meus Clientes |
| `src/lib/smartActions.js` | Query logic for generating smart actions from contacts data |
| `supabase/minha-loja-migration.sql` | All DB changes in one migration file |

### Modified files
| File | Changes |
|------|---------|
| `src/entities/all.js` | Add `SaleItem`, `Expense` entities |
| `src/Layout.jsx` | Update menu to 5 items, update bottom nav, rename Dashboard label, remove Checklist |
| `src/pages.config.js` | Add MinhaLoja import + entry in PAGES |
| `src/pages/Sales.jsx` | Replace content with `<Navigate to="/MinhaLoja?tab=lancar" />` |
| `src/pages/Inventory.jsx` | Replace content with `<Navigate to="/MinhaLoja?tab=estoque" />` |
| `src/components/dashboard/FranchiseeDashboard.jsx` | Add SmartActions section |
| `src/pages/MyContacts.jsx` | Add ActionPanel at top |
| `src/lib/whatsappUtils.js` | Extract `getWhatsAppLink` + `formatPhone` shared utils |

### Constants note
- `PAYMENT_METHODS` em `franchiseUtils.js` (pix, payment_link, card_machine, cash) → usar diretamente no SaleForm
- Delivery na venda é DIFERENTE de `DELIVERY_METHODS` de franchiseUtils (que é config do vendedor genérico). Definir inline no SaleForm: `retirada` / `delivery`
- URL de "Meu Vendedor" é `createPageUrl("FranchiseSettings")` — NÃO criar rota nova

---

## Chunk 1: Database Foundation

### Task 1: Run database migration

**Files:**
- Create: `supabase/minha-loja-migration.sql`

- [ ] **Step 1: Write migration SQL file**

Create `supabase/minha-loja-migration.sql` with ALL database changes from the spec:

```sql
-- ============================================
-- MINHA LOJA MIGRATION
-- ============================================

-- 1. inventory_items: add price columns
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

-- 2. sales: add new columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS card_fee_percent NUMERIC(5,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS card_fee_amount NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'retirada';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_value NUMERIC(10,2);

-- 3. sales: expand source CHECK constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE sales ADD CONSTRAINT sales_source_check
  CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'phone_call', 'in_person', 'website', 'other', 'manual', 'bot'));

-- 4. sale_items table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_inventory ON sale_items(inventory_item_id);

-- 5. expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL REFERENCES franchises(evolution_instance_id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_franchise_date ON expenses(franchise_id, expense_date);

-- 5b. Ensure update_updated_at function exists (may already exist from initial migration)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers: stock management on sale_items
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

DROP TRIGGER IF EXISTS stock_decrement_on_insert ON sale_items;
CREATE TRIGGER stock_decrement_on_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_decrement();

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

DROP TRIGGER IF EXISTS stock_revert_on_delete ON sale_items;
CREATE TRIGGER stock_revert_on_delete
  BEFORE DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION stock_revert();

-- 7. updated_at trigger for expenses
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. RLS: sale_items
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

-- 9. RLS: expenses
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

- [ ] **Step 2: Execute migration via Supabase Management API**

Run the SQL via the Management API. The project ref is `sulgicnqqopyhulglakd`. Use the `SUPABASE_MANAGEMENT_TOKEN` from `.env`:

```bash
# Read .env for token, then POST to Management API
source .env 2>/dev/null
curl -s -X POST "https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat supabase/minha-loja-migration.sql | sed 's/"/\\"/g' | tr '\n' ' ')\"}"
```

Verify: response should NOT contain `"error"`. If it does, fix the SQL and re-run.

- [ ] **Step 3: Verify migration succeeded**

Run a quick verification query:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'sale_items' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('payment_method', 'card_fee_percent', 'delivery_method', 'net_value');
SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name IN ('cost_price', 'sale_price');
```

Expected: all columns exist.

- [ ] **Step 4: Add entities to all.js**

Modify `src/entities/all.js` — add after the existing entity exports (around line 89):

```js
export const SaleItem = createEntity('sale_items');
export const Expense = createEntity('expenses');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/minha-loja-migration.sql src/entities/all.js
git commit -m "feat: database migration for Minha Loja (sale_items, expenses, stock triggers)"
```

---

## Chunk 2: Minha Loja Page Shell + Tab Estoque

### Task 2: Create MinhaLoja page shell with tabs

**Files:**
- Create: `src/pages/MinhaLoja.jsx`

- [ ] **Step 1: Create the MinhaLoja page shell**

Create `src/pages/MinhaLoja.jsx` with:
- **Admin guard**: if `currentUser.role === 'admin'`, render `<Navigate to="/Dashboard" />` (admin não usa esta página)
- Tab state management (Lançar, Resultado, Estoque) — default to "Lançar"
- URL param `?tab=lancar|resultado|estoque` for deep linking (FAB will link to `?tab=lancar`)
- 4 summary cards at top (data loaded from Sales, Expenses, InventoryItem entities)
- Tab content renders the appropriate component
- Mobile-responsive: cards 2×2 on mobile, 4 in line on desktop
- Import pattern: `User, Franchise, Sale, InventoryItem, SaleItem, Expense, Contact` from `@/entities/all`
- Use `getAvailableFranchises` from `@/lib/franchiseUtils` for franchise filtering
- Summary card data: vendas hoje (count + value), faturamento do mês, lucro estimado, estoque baixo count
- Empty state if no franchise linked

Tabs should use shadcn `Tabs` component (`@/components/ui/tabs`). Surface color `#fbf9fa` for page background.

- [ ] **Step 2: Verify it renders (empty tabs for now)**

Add route temporarily in `src/App.jsx` or pages config. Navigate to `/MinhaLoja`. Should show 4 skeleton cards + 3 tab buttons.

- [ ] **Step 3: Commit**

```bash
git add src/pages/MinhaLoja.jsx
git commit -m "feat: MinhaLoja page shell with tabs and summary cards"
```

### Task 3: Migrate Inventory to TabEstoque

**Files:**
- Create: `src/components/minha-loja/TabEstoque.jsx`
- Reference: `src/pages/Inventory.jsx` (lines 57-844 — copy and adapt)

- [ ] **Step 1: Create TabEstoque component**

Create `src/components/minha-loja/TabEstoque.jsx`:
- Receive props: `franchiseId` (evolution_instance_id), `currentUser`, `inventoryItems`, `onRefresh`
- Migrate ALL functionality from `Inventory.jsx`: CRUD, inline edit, search, category filter, CSV export
- ADD new columns: `cost_price` and `sale_price` — editable fields in the add/edit form and inline edit
  - `cost_price`: editable by admin always, editable by franchisee only for items THEY created (not the 28 standard ones)
  - `sale_price`: always editable by franchisee
- ADD "Giro de estoque" indicator per item:
  - Query: `SaleItem.filter({inventory_item_id: item.id})` filtered to last 28 days, sum quantities, divide by 4
  - Display: "X un/semana" badge next to each item
  - Color: green (adequate), amber (buying too much: stock >= giro*2), red (will run out: stock <= giro*0.5)
- ADD "Sugestão de compra" per item:
  - Based on turnover: if giro > 0, suggest `Math.ceil(giro * 2) - quantity` units to buy
  - Display: "Comprar X un" badge when stock is below 2 weeks of turnover
  - Only show when suggestion is positive (need to buy)
- Keep existing constants: `UNIT_OPTIONS`, `CATEGORY_OPTIONS` from Inventory.jsx
- Mobile: card layout instead of table (use existing pattern from Inventory.jsx)

- [ ] **Step 2: Wire TabEstoque into MinhaLoja**

In `src/pages/MinhaLoja.jsx`, import and render `TabEstoque` inside the Estoque tab content. Pass `franchiseId`, `currentUser`, `inventoryItems`, and `onRefresh` as props.

- [ ] **Step 3: Test manually**

Navigate to `/MinhaLoja?tab=estoque`. Verify:
- Items load correctly for the franchise
- Add/edit/delete works
- cost_price and sale_price fields appear
- Giro indicator shows (will be 0 initially — no sale_items yet)

- [ ] **Step 4: Commit**

```bash
git add src/components/minha-loja/TabEstoque.jsx src/pages/MinhaLoja.jsx
git commit -m "feat: TabEstoque with price fields and stock turnover"
```

---

## Chunk 3: Tab Lançar (Sales)

### Task 4: Create SaleForm component

**Files:**
- Create: `src/components/minha-loja/SaleForm.jsx`
- Reference: `src/pages/Sales.jsx` (lines 45-134 ContactAutocomplete, lines 540-563 saleItems, lines 950-1155 full form dialog)

- [ ] **Step 1: Create SaleForm**

Create `src/components/minha-loja/SaleForm.jsx`:
- Receive props: `sale` (null for new, object for edit), `franchiseId`, `contacts`, `inventoryItems`, `onSave`, `onCancel`
- Reuse `ContactAutocomplete` from Sales.jsx (lines 45-134) — either import or copy
- Product selection: multi-select from `inventoryItems` with quantity per item
  - Each row: dropdown to select product, quantity input, unit_price auto-filled from `sale_price`, line total
  - "Adicionar produto" button to add more rows
  - Remove row button
- Payment method: select from `PAYMENT_METHODS` imported from `franchiseUtils.js` (`pix`, `payment_link`, `card_machine`, `cash`)
  - If `card_machine` selected → show `card_fee_percent` input (default 3.5%)
  - `card_fee_amount` auto-calculated: `total * card_fee_percent / 100`
- Delivery method: radio with inline options `[{value:'retirada', label:'Retirada'}, {value:'delivery', label:'Delivery'}]`
  - **ATENÇÃO**: NÃO usar `DELIVERY_METHODS` de `franchiseUtils.js` (aquela é config do vendedor genérico: own_fleet/third_party/both). Aqui são valores da VENDA individual.
  - If `delivery` → show `delivery_fee` input
- Calculated fields (displayed live, not editable):
  - `Subtotal`: sum of (quantity × unit_price) per item
  - `Taxa cartão`: card_fee_amount (if applicable)
  - `Frete`: delivery_fee (if applicable)
  - `Valor líquido`: subtotal - card_fee_amount - delivery_fee
- On save:
  1. Create/update `Sale` with: `value` (subtotal), `contact_id`, `franchise_id`, `source: 'manual'`, `payment_method`, `card_fee_percent`, `card_fee_amount`, `delivery_method`, `delivery_fee`, `net_value`, `sale_date`
  2. If editing: delete old `SaleItem` records (triggers stock revert)
  3. Insert `SaleItem` records with `product_name`, `quantity`, `unit_price`, `cost_price` (snapshot from inventory)
  4. Call `onSave()` to refresh parent

- [ ] **Step 2: Test SaleForm renders**

Render in isolation or inside MinhaLoja temporarily. Verify product selection, payment method toggling, and live calculation.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-loja/SaleForm.jsx
git commit -m "feat: SaleForm with product selection, payment, and delivery"
```

### Task 5: Create TabLancar component

**Files:**
- Create: `src/components/minha-loja/TabLancar.jsx`
- Reference: `src/pages/Sales.jsx` (lines 580-1159 — render sections)

- [ ] **Step 1: Create TabLancar**

Create `src/components/minha-loja/TabLancar.jsx`:
- Receive props: `franchiseId`, `currentUser`, `sales`, `contacts`, `inventoryItems`, `onRefresh`
- "Nova Venda" button → opens SaleForm in a Dialog
- Sales list: cards on mobile, table on desktop
  - Each sale shows: date, contact name, value, net_value, payment method, source badge (manual/bot/whatsapp)
  - Click to edit → opens SaleForm in Dialog with sale data pre-filled
  - Delete button with shadcn Dialog confirmation
- Filter by period: today / this week / this month (default: this month)
- Search by contact name
- Load `sale_items` for each sale to show product breakdown in expanded view
- Empty state: "Nenhuma venda registrada. Comece lançando sua primeira venda!"

- [ ] **Step 2: Wire TabLancar into MinhaLoja**

Import and render inside Lançar tab. Pass required props.

- [ ] **Step 3: Test creating a sale**

Navigate to `/MinhaLoja?tab=lancar`. Create a sale with:
- Select contact via autocomplete
- Add 2 products
- Set payment to card_machine with 3.5% fee
- Set delivery with R$10 fee
- Save → verify sale appears in list, stock decremented, net_value calculated

- [ ] **Step 4: Test editing a sale**

Click the sale just created. Change a product quantity. Save. Verify stock updated correctly (old reverted, new applied).

- [ ] **Step 5: Commit**

```bash
git add src/components/minha-loja/TabLancar.jsx src/pages/MinhaLoja.jsx
git commit -m "feat: TabLancar with sale creation, editing, and stock integration"
```

---

## Chunk 4: Tab Resultado (P&L)

### Task 6: Create ExpenseForm and TabResultado

**Files:**
- Create: `src/components/minha-loja/ExpenseForm.jsx`
- Create: `src/components/minha-loja/TabResultado.jsx`

- [ ] **Step 1: Create ExpenseForm**

Simple form component: `description` (text input), `amount` (currency input), `expense_date` (date picker, default today). Receive props: `expense` (null for new), `franchiseId`, `onSave`, `onCancel`. On save: `Expense.create()` or `Expense.update()`.

- [ ] **Step 2: Create TabResultado**

Create `src/components/minha-loja/TabResultado.jsx`:
- Receive props: `franchiseId`, `currentUser`
- Month selector at top (default: current month)
- Load data for selected month:
  - `Sale.filter({franchise_id: franchiseId})` filtered by month → sum `value`, `card_fee_amount`, `delivery_fee`
  - `SaleItem.filter({sale_id: [sale_ids]})` → sum `quantity * cost_price` for COGS
  - `Expense.filter({franchise_id: franchiseId})` filtered by month → sum `amount`
- P&L demonstrativo card:
  - Faturamento bruto (green)
  - (-) Custo dos produtos (red)
  - (-) Taxas cartão (red)
  - (-) Frete pago (red)
  - (-) Outras despesas (red)
  - = LUCRO ESTIMADO (bold, green if positive, red if negative)
- Expenses list below: table/cards with description, amount, date. Add/edit/delete buttons.
  - "Adicionar despesa" → opens ExpenseForm in Dialog
- Insights section:
  - "Mais vendidos": top 5 products by quantity from sale_items this month
  - "Produtos parados": inventory items with 0 sale_items in last 28 days but quantity > 0
  - "vs. mês anterior": compare current month faturamento with previous month (arrow up/down + percentage)
- Empty state: "Sem dados para este mês. Lance vendas para ver seu resultado."
- Mobile: all sections stacked vertically. Desktop: P&L left, insights right.

- [ ] **Step 3: Wire TabResultado into MinhaLoja**

Import and render inside Resultado tab.

- [ ] **Step 4: Test P&L calculation**

With sales from Task 5, navigate to Resultado tab. Verify:
- Faturamento matches sum of sales
- COGS calculated from sale_items cost_price
- Card fees and delivery fees summed correctly
- Add an expense → shows in list and deducts from lucro

- [ ] **Step 5: Commit**

```bash
git add src/components/minha-loja/ExpenseForm.jsx src/components/minha-loja/TabResultado.jsx src/pages/MinhaLoja.jsx
git commit -m "feat: TabResultado P&L with expenses, insights, and month comparison"
```

---

## Chunk 5: Smart Actions

### Task 7a: Extract shared WhatsApp utils

**Files:**
- Create: `src/lib/whatsappUtils.js`
- Modify: `src/pages/MyContacts.jsx` (lines 86-108 — replace local functions with imports)

- [ ] **Step 1: Create whatsappUtils.js**

Extract `formatPhone()` (MyContacts lines 86-101) and `getWhatsAppLink()` (lines 103-108) to `src/lib/whatsappUtils.js`. These are used by MyContacts, SmartActions, and ActionPanel.

```js
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  return phone;
}

export function getWhatsAppLink(phone) {
  if (!phone) return '#';
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}
```

- [ ] **Step 2: Update MyContacts to import from shared util**

Replace local `formatPhone` and `getWhatsAppLink` in MyContacts.jsx with imports from `@/lib/whatsappUtils`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsappUtils.js src/pages/MyContacts.jsx
git commit -m "refactor: extract WhatsApp utils to shared module"
```

### Task 7b: Create smart actions logic

**Files:**
- Create: `src/lib/smartActions.js`

- [ ] **Step 1: Write smartActions.js**

Create `src/lib/smartActions.js`:

```js
import { differenceInDays } from 'date-fns';

const ACTION_RULES = [
  {
    type: 'responder',
    label: 'Responder',
    icon: 'chat_bubble',
    color: '#b91c1c',       // red
    bgColor: '#fef2f2',
    test: (contact) => contact.status === 'novo_lead' &&
      contact.created_at &&
      differenceInDays(new Date(), new Date(contact.created_at)) >= 1,
    message: (contact) => {
      const days = differenceInDays(new Date(), new Date(contact.created_at));
      return `${contact.name || contact.phone} entrou em contato há ${days} dia${days > 1 ? 's' : ''} — responda!`;
    },
    priority: 1,
  },
  {
    type: 'reativar',
    label: 'Reativar',
    icon: 'refresh',
    color: '#d97706',       // amber
    bgColor: '#fffbeb',
    test: (contact) => ['cliente', 'recorrente'].includes(contact.status) &&
      contact.last_purchase_at &&
      differenceInDays(new Date(), new Date(contact.last_purchase_at)) >= 14,
    message: (contact) => {
      const days = differenceInDays(new Date(), new Date(contact.last_purchase_at));
      return `${contact.name || contact.phone} não compra há ${days} dias — mande um oi!`;
    },
    priority: 2,
  },
  {
    type: 'converter',
    label: 'Converter',
    icon: 'handshake',
    color: '#ea580c',       // orange
    bgColor: '#fff7ed',
    test: (contact) => contact.status === 'em_negociacao' &&
      contact.updated_at &&
      differenceInDays(new Date(), new Date(contact.updated_at)) >= 7,
    message: (contact) => {
      const days = differenceInDays(new Date(), new Date(contact.updated_at));
      return `${contact.name || contact.phone} tá negociando há ${days} dias — feche!`;
    },
    priority: 3,
  },
  {
    type: 'fidelizar',
    label: 'Fidelizar',
    icon: 'favorite',
    color: '#16a34a',       // green
    bgColor: '#f0fdf4',
    test: (contact) => (contact.purchase_count || 0) >= 5 &&
      ['cliente', 'recorrente'].includes(contact.status),
    message: (contact) => `${contact.name || contact.phone} já comprou ${contact.purchase_count}x — agradeça!`,
    priority: 4,
  },
  {
    type: 'remarketing',
    label: 'Remarketing',
    icon: 'campaign',
    color: '#7c3aed',       // purple
    bgColor: '#f5f3ff',
    test: (contact) => contact.status === 'perdido' &&
      contact.updated_at &&
      differenceInDays(new Date(), new Date(contact.updated_at)) >= 30,
    message: (contact) => {
      const days = differenceInDays(new Date(), new Date(contact.updated_at));
      return `${contact.name || contact.phone} sumiu há ${days} dias — tente novamente!`;
    },
    priority: 5,
  },
];

export function generateSmartActions(contacts, limit = 5) {
  const actions = [];
  for (const contact of contacts) {
    for (const rule of ACTION_RULES) {
      if (rule.test(contact)) {
        actions.push({
          ...rule,
          contact,
          message: rule.message(contact),
        });
        break; // one action per contact
      }
    }
  }
  // sort by priority, then by urgency (days since last activity)
  actions.sort((a, b) => a.priority - b.priority);
  return limit ? actions.slice(0, limit) : actions;
}

export { ACTION_RULES };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/smartActions.js
git commit -m "feat: smart actions logic for contact-based daily tasks"
```

### Task 8: Add SmartActions to Dashboard

**Files:**
- Create: `src/components/dashboard/SmartActions.jsx`
- Modify: `src/components/dashboard/FranchiseeDashboard.jsx` (line 128-176)

- [ ] **Step 1: Create SmartActions component**

Create `src/components/dashboard/SmartActions.jsx`:
- Receive props: `contacts` (array), `franchiseId`
- Call `generateSmartActions(contacts, 5)` to get top 5 actions
- Render card list:
  - Each card: MaterialIcon (rule.icon) + message text + WhatsApp button + "Feito" button
  - WhatsApp button: `window.open(getWhatsAppLink(contact.phone))` — reuse `getWhatsAppLink` from MyContacts.jsx (or extract to shared util)
  - "Feito" button: update contact `last_contact_at` to now via `Contact.update()`
  - Card background: `rule.bgColor`, icon color: `rule.color`
- Link at bottom: "Ver todos →" navigates to `/MyContacts`
- Empty state: "Tudo em dia! Nenhuma ação pendente." with a checkmark icon
- Mobile: cards stacked. Desktop: 2-column grid

- [ ] **Step 2: Add SmartActions to FranchiseeDashboard**

In `src/components/dashboard/FranchiseeDashboard.jsx`:
- Import `SmartActions` and `Contact`
- In `loadData()` (around line 34-83): add `Contact.filter({franchise_id: franchiseId})` to the Promise.all
- Add `contacts` state variable
- Render `<SmartActions contacts={contacts} franchiseId={franchiseId} />` after the DailyGoalProgress section (around line 150)

- [ ] **Step 3: Test**

Login as franchisee. Dashboard should show "Suas ações de hoje" section with action cards (if contacts exist with matching conditions). Click WhatsApp button → should open WhatsApp link.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/SmartActions.jsx src/components/dashboard/FranchiseeDashboard.jsx
git commit -m "feat: smart actions on franchisee dashboard"
```

### Task 9: Add ActionPanel to MyContacts

**Files:**
- Create: `src/components/my-contacts/ActionPanel.jsx`
- Modify: `src/pages/MyContacts.jsx`

- [ ] **Step 1: Create ActionPanel**

Create `src/components/my-contacts/ActionPanel.jsx`:
- Receive props: `contacts`
- Call `generateSmartActions(contacts, 0)` (no limit — show all)
- Group by `action.type` using `ACTION_RULES`
- Render tab filters: Responder (count) · Reativar (count) · Converter · Fidelizar · Remarketing
- Each tab shows filtered contacts with: name, phone, last purchase info, days since contact, total_spent
- WhatsApp button + "Anotar" button (opens edit dialog from MyContacts)
- Ordered by urgency (most days since last activity first)

- [ ] **Step 2: Integrate into MyContacts**

In `src/pages/MyContacts.jsx`:
- Import `ActionPanel`
- Render `<ActionPanel contacts={contacts} />` at the top of the page (above the existing filter tabs, around line 278)
- Add a toggle or visual separator: "Ações" section above, "Todos os contatos" section below with existing pipeline

- [ ] **Step 3: Test**

Navigate to Meus Clientes. Verify:
- Action panel shows at top with category tabs
- Counts are correct
- Clicking WhatsApp opens correct link
- Below the action panel, the existing pipeline still works

- [ ] **Step 4: Commit**

```bash
git add src/components/my-contacts/ActionPanel.jsx src/pages/MyContacts.jsx
git commit -m "feat: action panel with smart categories on Meus Clientes"
```

---

## Chunk 6: Navigation + Routing + Cleanup

### Task 10: Update Layout menu and bottom nav

**Files:**
- Modify: `src/Layout.jsx` (lines 25-109)

- [ ] **Step 1: Update navigationItems array**

In `src/Layout.jsx`, replace the `navigationItems` array (lines 25-100) with the new 5-item menu for franchisee:

New menu structure:
1. **Início** — url: `createPageUrl("Dashboard")`, icon: `wb_sunny`, franchiseeLabel: "Início", adminLabel: "Painel Geral"
2. **Minha Loja** — url: `createPageUrl("MinhaLoja")`, icon: `storefront`, franchiseeLabel: "Minha Loja" (franchisee only)
3. **Meus Clientes** — url: `createPageUrl("MyContacts")`, icon: `people`, franchiseeLabel: "Meus Clientes" (franchisee only)
4. **Marketing** — url: `createPageUrl("Marketing")`, icon: `campaign` (keep existing)
5. **Meu Vendedor** — url: `createPageUrl("FranchiseSettings")`, icon: `smart_toy`, franchiseeLabel: "Meu Vendedor" (franchisee only) — **NOTA**: usa rota existente FranchiseSettings, NÃO criar rota nova

Admin items remain: Relatórios, Acompanhamento, Franqueados (in Administração section).

Remove from franchisee menu: Vendas, Estoque, MyChecklist (Checklist). Remove explicitly — não basta listar os novos 5, precisa remover os antigos que não estão mais.

- [ ] **Step 2: Update mobileBottomNav array**

Replace `mobileBottomNav` (lines 103-109) with:
1. Início — icon: `wb_sunny`, url: `createPageUrl("Dashboard")`
2. Minha Loja — icon: `storefront`, url: `createPageUrl("MinhaLoja")`
3. FAB (+) — icon: `add`, url: `/MinhaLoja?tab=lancar`, isFab: true
4. Clientes — icon: `people`, url: `createPageUrl("MyContacts")`
5. Vendedor — icon: `smart_toy`, url: `createPageUrl("FranchiseSettings")`

- [ ] **Step 3: Test navigation**

- Desktop: sidebar shows 5 items for franchisee
- Mobile: bottom nav shows 5 items with FAB
- FAB click navigates to MinhaLoja with Lançar tab active
- Admin still sees admin-specific items

- [ ] **Step 4: Commit**

```bash
git add src/Layout.jsx
git commit -m "refactor: update navigation menu from 7 to 5 items"
```

### Task 11: Update routing

**Files:**
- Modify: `src/pages.config.js` (lines 50-78)
- Modify: `src/pages/Sales.jsx`
- Modify: `src/pages/Inventory.jsx`

- [ ] **Step 1: Add MinhaLoja to pages.config.js**

In `src/pages.config.js`:
- Add import: `import MinhaLoja from './pages/MinhaLoja';`
- Add to PAGES object: `"MinhaLoja": MinhaLoja,`

- [ ] **Step 2: Create redirect wrappers for old routes**

Replace content of `src/pages/Sales.jsx` with:
```jsx
import { Navigate, useLocation } from "react-router-dom";
export default function Sales() {
  const location = useLocation();
  return <Navigate to={`/MinhaLoja?tab=lancar${location.search ? '&' + location.search.slice(1) : ''}`} replace />;
}
```

Replace content of `src/pages/Inventory.jsx` with:
```jsx
import { Navigate } from "react-router-dom";
export default function Inventory() {
  return <Navigate to="/MinhaLoja?tab=estoque" replace />;
}
```

This keeps the routes in `pages.config.js` (preventing 404s) while redirecting to MinhaLoja.

- [ ] **Step 3: Extract shared utils before redirect**

Before replacing Sales.jsx, extract `ContactAutocomplete` (lines 45-134) and shared helpers (`formatCurrency`, `normalizePhone`, `formatPhone` — lines 18-42) to reusable files if not already extracted into SaleForm/TabLancar. Ensure no code is lost.

- [ ] **Step 4: Test all routes**

- `/MinhaLoja` → renders page with 3 tabs
- `/MinhaLoja?tab=lancar` → Lançar tab active
- `/MinhaLoja?tab=resultado` → Resultado tab active
- `/MinhaLoja?tab=estoque` → Estoque tab active
- `/Sales` → redirects to MinhaLoja Lançar tab
- `/Inventory` → redirects to MinhaLoja Estoque tab

- [ ] **Step 5: Commit**

```bash
git add src/pages.config.js src/pages/Sales.jsx src/pages/Inventory.jsx
git commit -m "feat: MinhaLoja routing with redirects from old Sales/Inventory"
```

### Task 12: Final cleanup and verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Fix any build errors (unused imports, missing dependencies).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint warnings in new/modified files.

- [ ] **Step 3: Manual QA checklist**

Test as franchisee:
- [ ] Dashboard shows smart actions with WhatsApp buttons
- [ ] Minha Loja: summary cards show correct data
- [ ] Minha Loja > Lançar: create sale with products, payment, delivery
- [ ] Minha Loja > Lançar: edit existing sale
- [ ] Minha Loja > Lançar: delete sale (stock reverts)
- [ ] Minha Loja > Resultado: P&L calculates correctly
- [ ] Minha Loja > Resultado: add/edit/delete expense
- [ ] Minha Loja > Estoque: CRUD works, prices show, giro displays
- [ ] Meus Clientes: action panel shows at top
- [ ] Mobile: bottom nav works, FAB opens Lançar tab
- [ ] Mobile: all tabs render correctly on small screen

Test as admin:
- [ ] Admin menu still shows admin items
- [ ] Admin doesn't see MinhaLoja in menu
- [ ] Acompanhamento still works

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Minha Loja complete — hub central do franqueado (FASE 5 Etapa 3b)"
```
