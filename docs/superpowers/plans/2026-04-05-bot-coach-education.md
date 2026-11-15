# Bot Coach Education — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a "Coach de Negócio" system that generates personalized biweekly WhatsApp reports for franchise owners using LLM analysis of 9 data dimensions, plus dashboard improvements (expanded BotPerformanceCard, Health Score bot dimension, coaching alerts, coaching admin tab, SmartActions from bot_reports).

**Architecture:** New `bot_reports` table + `BotReport` entity. n8n workflow "Bot Coach Report" adapts existing Weekly Bot Report. Frontend evolves BotPerformanceCard with Sheet details, adds bot dimension to Health Score, adds coaching alerts to AlertsPanel, adds Coaching tab to BotIntelligence, and feeds SmartActions from bot_reports.

**Tech Stack:** React 18, Tailwind CSS, shadcn/ui (Sheet, Tabs, Card), Material Symbols, Recharts, Supabase (RLS + service_role), n8n (HTTP Request + Code + Gemini 2.5 Flash + WuzAPI), date-fns

**Spec:** `docs/superpowers/specs/2026-04-05-bot-coach-education-design.md`

---

## Phase 1: Database + Entity

### Task 1.1: Create `bot_reports` table

**Files:**
- Create: `supabase/bot-reports.sql`

- [ ] **Step 1: Write SQL migration**

```sql
-- bot_reports: biweekly coach reports per franchise
CREATE TABLE bot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  profile_tier TEXT NOT NULL CHECK (profile_tier IN ('beginner', 'intermediate', 'advanced')),
  autonomy_rate NUMERIC,
  autonomy_target NUMERIC,
  ranking_position INT,
  ranking_total INT,
  metrics JSONB NOT NULL,
  action_items JSONB,
  report_text TEXT,
  llm_model TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bot_reports_franchise ON bot_reports(franchise_id, report_period_end DESC);
CREATE INDEX idx_bot_reports_period ON bot_reports(report_period_end);

ALTER TABLE bot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e manager veem todos" ON bot_reports
  FOR SELECT USING (is_admin_or_manager());

CREATE POLICY "Franqueado ve os seus" ON bot_reports
  FOR SELECT USING (franchise_id = ANY(managed_franchise_ids()));

CREATE POLICY "Admin deleta" ON bot_reports
  FOR DELETE USING (is_admin());
-- INSERT/UPDATE: apenas via service_role (n8n). Sem policy = bloqueado para users normais.
```

- [ ] **Step 2: Execute SQL via Supabase Management API**

```
POST https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query
Authorization: Bearer {SUPABASE_MANAGEMENT_TOKEN}
Body: { "query": "<SQL above>" }
```

- [ ] **Step 3: Verify table created**

Query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bot_reports' ORDER BY ordinal_position;`
Expect 14 columns.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/bot-reports.sql
git commit -m "feat: bot_reports table — biweekly coach reports per franchise"
```

### Task 1.2: Add BotReport entity

**Files:**
- Modify: `src/entities/all.js`

- [ ] **Step 1: Add entity export** after the `BotConversation` line (~line 192):

```javascript
export const BotReport = createEntity('bot_reports');
```

- [ ] **Step 2: Verify** — `npm run build`. No errors.

- [ ] **Step 3: Commit**

```bash
git add src/entities/all.js
git commit -m "feat: BotReport entity"
```

---

## Phase 2: n8n Workflow "Bot Coach Report"

> n8n workflows are configured via API/UI, not code files. This section describes node configuration.

### Task 2.1: Create workflow skeleton

- [ ] **Step 1: Create workflow via n8n API**

```
POST https://teste.dynamicagents.tech/api/v1/workflows
Name: "Bot Coach Report"
active: false
```

- [ ] **Step 2: Add Schedule Trigger node**

Cron: `0 8 1,15 * *` (1st and 15th, 8h). Timezone: `America/Sao_Paulo`.

### Task 2.2: Get All Franchises + Network Benchmarks

- [ ] **Step 1: Add "Get All Franchises" HTTP Request node**

URL: `{SUPABASE_URL}/rest/v1/franchise_configurations?select=evolution_instance_id,franchise_name,city,personal_phone_for_summary&evolution_instance_id=not.is.null`
Headers: `apikey` + `Authorization: Bearer {service_role_key}` (inline)
`continueOnFail: true`

- [ ] **Step 2: Add 5 HTTP Requests for network benchmarks** (parallelized):

1. Bot autonomy avg: `bot_conversations` count total vs count with human messages (period filter)
2. Ticket avg: `sales` with `source=bot`, avg of `value + delivery_fee`
3. Margin avg: `sale_items` avg `(sale_price - cost_price) / sale_price * 100`
4. Top 3 franchises by autonomy: derived from bot_conversations GROUP BY franchise_id
5. Revenue avg: `sales` sum by franchise

- [ ] **Step 3: Add "Aggregate Benchmarks" Code node**

Merge all 5 benchmark queries into a single `benchmarks` object. Output: `{ json: { benchmarks: {...} } }`
**CRITICAL**: explicit output, NEVER `...item.json`

### Task 2.3: SplitInBatches loop per franchise

- [ ] **Step 1: Add SplitInBatches node** after Aggregate Benchmarks

- [ ] **Step 2: Add 9 per-franchise dimension queries** (HTTP Request, each `continueOnFail: true`):

1. **Bot conversations**: `bot_conversations?franchise_id=eq.{evoId}&started_at=gte.{start}&started_at=lte.{end}&select=id,outcome,quality_score,started_at,llm_abandon_reason,topics`
2. **Human messages**: `conversation_messages?franchise_id=eq.{evoId}&direction=eq.human&created_at=gte.{start}&select=id,conversation_id`
3. **Bot sales**: `sales?franchise_id=eq.{evoId}&source=eq.bot&sale_date=gte.{start}&sale_date=lte.{end}&select=id,value,delivery_fee,sale_date,contact_id`
4. **Manual sales**: `sales?franchise_id=eq.{evoId}&source=neq.bot&sale_date=gte.{start}&sale_date=lte.{end}&select=id,value,delivery_fee`
5. **Inventory**: `inventory_items?franchise_id=eq.{evoId}&select=id,product_name,quantity,min_stock,cost_price,sale_price`
6. **Contacts pipeline**: `contacts?franchise_id=eq.{evoId}&select=id,status,created_at,updated_at,purchase_count,total_spent`
7. **Purchase orders**: `purchase_orders?franchise_id=eq.{evoId}&select=id,status,ordered_at,delivered_at,created_at`
8. **Expenses**: `expenses?franchise_id=eq.{evoId}&expense_date=gte.{start}&expense_date=lte.{end}&select=amount`
9. **Marketing**: `marketing_payments?franchise_id=eq.{evoId}&select=amount,reference_month`

**IMPORTANT**: Access franchise data via `$('SplitInBatches').item.json.evolution_instance_id` (NOT `$json` — overwritten by HTTP response).

- [ ] **Step 3: Add "Get Previous Report" HTTP Request** (`continueOnFail: true`)

URL: `bot_reports?franchise_id=eq.{evoId}&order=report_period_end.desc&limit=1`

### Task 2.4: Calculate Profile & Targets Code node

- [ ] **Step 1: Add Code node** (`continueOnFail: true`)

Logic (JavaScript):
```javascript
const convs = $('Get Bot Conversations').item.json || [];
const humanMsgs = $('Get Human Messages').item.json || [];
const botSales = $('Get Bot Sales').item.json || [];
const manualSales = $('Get Manual Sales').item.json || [];
const inventory = $('Get Inventory').item.json || [];
const contacts = $('Get Contacts Pipeline').item.json || [];
const orders = $('Get Purchase Orders').item.json || [];
const expenses = $('Get Expenses').item.json || [];
const marketing = $('Get Marketing').item.json || [];
const prev = $('Get Previous Report').item.json;
const franchise = $('SplitInBatches').item.json;
const benchmarks = $('Aggregate Benchmarks').item.json.benchmarks;

// === AUTONOMY ===
const humanConvIds = new Set(humanMsgs.map(m => m.conversation_id));
const autonomous = convs.filter(c => !humanConvIds.has(c.id)).length;
const autonomyRate = convs.length ? Math.round((autonomous / convs.length) * 100) : 0;

// === PROFILE TIER + TARGET ===
let profileTier, autonomyTarget;
if (autonomyRate < 30) { profileTier = 'beginner'; autonomyTarget = Math.min(autonomyRate + 15, 95); }
else if (autonomyRate <= 60) { profileTier = 'intermediate'; autonomyTarget = Math.min(autonomyRate + 10, 95); }
else { profileTier = 'advanced'; autonomyTarget = Math.min(autonomyRate + 5, 95); }

// === SCORE BOT (20 pts) ===
const qualityScores = convs.filter(c => c.quality_score).map(c => c.quality_score);
const avgQuality = qualityScores.length ? qualityScores.reduce((a,b) => a+b, 0) / qualityScores.length : 0;
const conversionRate = convs.length ? (botSales.length / convs.length) * 100 : 0;
const scoreBot = Math.min(10, Math.round((autonomyRate / 40) * 10))
  + Math.min(5, Math.round((avgQuality / 7) * 5))
  + Math.min(5, Math.round((conversionRate / 15) * 5));

// === Build full metrics JSONB (9 dimensions) ===
// ... (each dimension computed from respective query results)
// === Build action_items sorted by R$ impact ===
// === Build prompt_data for LLM ===

return [{ json: {
  franchise_id: franchise.evolution_instance_id,
  franchise_name: franchise.franchise_name,
  city: franchise.city,
  personal_phone: franchise.personal_phone_for_summary,
  profile_tier: profileTier,
  autonomy_rate: autonomyRate,
  autonomy_target: autonomyTarget,
  score_bot: scoreBot,
  metrics: { bot: {...}, commercial: {...}, operational: {...}, pricing: {...},
             delivery: {...}, financial: {...}, health: {...}, pipeline: {...},
             supply: {...}, marketing: {...} },
  action_items: [...],
  previous_report_text: prev?.report_text || 'Primeiro relatório',
  benchmarks: benchmarks,
}}];
```

### Task 2.5: LLM Report Generation

- [ ] **Step 1: Add Gemini 2.5 Flash node** (`continueOnFail: true`)

Credential: `ezQN27UjYZVHyDEf`. Model: `gemini-2.5-flash`.
Prompt: full template from spec section 3 "Prompt LLM Coach" with `{{ }}` expressions.
Max output tokens: ~600 (~1500 chars).

### Task 2.6: Save + Send

- [ ] **Step 1: Add "INSERT bot_reports" HTTP Request** (`continueOnFail: true`)

POST to Supabase REST `bot_reports` with all fields.

- [ ] **Step 2: Add IF "Has Phone?"**

Condition: `$json.personal_phone` is not empty.

- [ ] **Step 3: TRUE → "WuzAPI Send" HTTP Request** (`continueOnFail: true`)

POST `https://zuck.dynamicagents.tech/api/sendText`
Body: `{ "phone": "55{{ $json.personal_phone }}", "message": "{{ $json.report_text }}" }`
After: UPDATE `bot_reports SET sent_at = now() WHERE id = {report_id}`

- [ ] **Step 4: FALSE → "No Phone" Set node** (empty output — n8n rule: all IF branches need output)

### Task 2.7: Admin Summary + Activate

- [ ] **Step 1: Add "Admin Summary" Code node** after loop — consolidates total sent, failures

- [ ] **Step 2: Add "Send Admin Summary" WuzAPI HTTP Request** to admin phone

- [ ] **Step 3: Test manually** — trigger for 1 franchise, verify bot_reports INSERT + WhatsApp msg ≤ 1500 chars

- [ ] **Step 4: Activate workflow** — `POST .../workflows/{id}/activate`

---

## Phase 3: BotPerformanceCard Expansion + BotCoachSheet

### Task 3.1: Add trend arrows to BotPerformanceCard

**Files:**
- Modify: `src/components/dashboard/BotPerformanceCard.jsx`

- [ ] **Step 1: Fetch previous period data**

In the load callback (~line 43), add query for previous month's bot_conversations + sales. Calculate `prevAutonomyRate`, `prevBotSalesCount`, `prevBotRevenue`.

- [ ] **Step 2: Add TrendArrow helper component**

```jsx
function TrendArrow({ current, previous }) {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const icon = diff > 0 ? "trending_up" : "trending_down";
  const color = diff > 0 ? "#16a34a" : "#dc2626";
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium" style={{ color }}>
      <MaterialIcon icon={icon} size={12} />
      {Math.abs(Math.round(diff))}{typeof current === 'number' && current <= 100 ? 'pp' : ''}
    </span>
  );
}
```

- [ ] **Step 3: Render trend arrows** next to each stat value (Atendimentos, Vendas Bot, Autonomia)

- [ ] **Step 4: Replace static tip with dynamic insight**

Fetch latest `BotReport.filter({ franchise_id: evoId }, '-report_period_end', 1)`. If exists, use `action_items[0].message` as tip.

- [ ] **Step 5: Add "Ver detalhes" button** — sets `sheetOpen` state to `true`

- [ ] **Step 6: Verify** — `npm run build`. Browser: arrows visible, button appears.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/BotPerformanceCard.jsx
git commit -m "feat: BotPerformanceCard — trend arrows + dynamic tip + Ver detalhes"
```

### Task 3.2: Create BotCoachSheet

**Files:**
- Create: `src/components/dashboard/BotCoachSheet.jsx`

- [ ] **Step 1: Create Sheet component**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { BotReport } from "@/entities/all";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIER_LABELS = { beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado" };
const TIER_COLORS = { beginner: "#d97706", intermediate: "#2563eb", advanced: "#16a34a" };

export default function BotCoachSheet({ franchiseId, isOpen, onClose }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!franchiseId) return;
    try {
      const data = await BotReport.filter({ franchise_id: franchiseId }, "-report_period_end", 6);
      setReports(data || []);
    } catch (err) { console.warn("BotCoachSheet load:", err); }
    finally { setLoading(false); }
  }, [franchiseId]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const latest = reports[0];
  const chartData = [...reports].reverse().map(r => ({
    period: format(new Date(r.report_period_end), "dd/MM", { locale: ptBR }),
    autonomy: Number(r.autonomy_rate) || 0,
  }));

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-plus-jakarta flex items-center gap-2">
            <MaterialIcon icon="school" size={20} className="text-[#b91c1c]" />
            Seu Coach Quinzenal
            {latest && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: `${TIER_COLORS[latest.profile_tier]}15`,
                         color: TIER_COLORS[latest.profile_tier] }}>
                {TIER_LABELS[latest.profile_tier]}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        {/* Section 1: Evolution chart (LineChart autonomy over time) */}
        {/* Section 2: Latest report_text (whitespace-pre-line) */}
        {/* Section 3: Target progress bar (autonomy_rate vs autonomy_target) */}
        {/* Section 4: History list (last 6 reports — date + tier badge + autonomy) */}
        {/* Section 5: Action items from latest report */}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Implement all 5 sections** inside SheetContent (chart, report text, progress bar, history, actions)

- [ ] **Step 3: Import and render in BotPerformanceCard**

```jsx
import BotCoachSheet from "./BotCoachSheet";
// state:
const [sheetOpen, setSheetOpen] = useState(false);
// render after Card:
<BotCoachSheet franchiseId={evoId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
```

- [ ] **Step 4: Verify** — `npm run build`. Browser: Sheet opens with chart + history.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/BotCoachSheet.jsx src/components/dashboard/BotPerformanceCard.jsx
git commit -m "feat: BotCoachSheet — histórico, evolução, metas, ações"
```

---

## Phase 4: Health Score Bot Dimension + AlertsPanel Coaching

### Task 4.1: Add bot dimension to healthScore.js

**Files:**
- Modify: `src/lib/healthScore.js`

- [ ] **Step 1: Add `calcBotScore` function**

```javascript
function calcBotScore(franchise, botConversations, conversationMessages, botSales) {
  const evoId = franchise.evolution_instance_id;
  const convs = botConversations.filter(c => c.franchise_id === evoId);
  if (convs.length === 0) return { score: 0, detail: "Sem dados do bot", hasData: false };

  const humanConvIds = new Set();
  for (const m of conversationMessages) {
    if (m.direction === 'human' && m.conversation_id) humanConvIds.add(m.conversation_id);
  }
  const autonomous = convs.filter(c => !humanConvIds.has(c.id)).length;
  const autonomyRate = (autonomous / convs.length) * 100;
  const autonomyPts = Math.min(10, Math.round((autonomyRate / 40) * 10));

  const qualityScores = convs.filter(c => c.quality_score).map(c => c.quality_score);
  const avgQuality = qualityScores.length ? qualityScores.reduce((a,b) => a+b, 0) / qualityScores.length : 0;
  const qualityPts = Math.min(5, Math.round((avgQuality / 7) * 5));

  const franchiseBotSales = botSales.filter(s => s.franchise_id === evoId);
  const conversionRate = (franchiseBotSales.length / convs.length) * 100;
  const conversionPts = Math.min(5, Math.round((conversionRate / 15) * 5));

  const score = Math.round(((autonomyPts + qualityPts + conversionPts) / 20) * 100);
  return { score, detail: `Autonomia ${Math.round(autonomyRate)}% · Score ${avgQuality.toFixed(1)}`, hasData: true };
}
```

- [ ] **Step 2: Update weights in calculateFranchiseHealth**

Add `botConversations = [], conversationMessages = [], botSales = []` to data param.

```javascript
const bot = calcBotScore(franchise, botConversations, conversationMessages, botSales);
const hasBotData = bot.hasData;
const weights = isNew
  ? { vendas: 0.25, estoque: 0.15, reposicao: 0.20, setup: 0.40, bot: 0 }
  : hasBotData
    ? { vendas: 0.30, estoque: 0.20, reposicao: 0.15, setup: 0.15, bot: 0.20 }
    : { vendas: 0.375, estoque: 0.25, reposicao: 0.1875, setup: 0.1875, bot: 0 };
```

Add `bot` to dimensions and problems.

- [ ] **Step 3: Verify** — `npm run build`. No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/healthScore.js
git commit -m "feat: Health Score — dimensão Bot (20pts: autonomia + qualidade + conversão)"
```

### Task 4.2: Update FranchiseHealthScore component

**Files:**
- Modify: `src/components/dashboard/FranchiseHealthScore.jsx`

- [ ] **Step 1: Add bot data props** — accept `botConversations`, `conversationMessages`, `botSales`

- [ ] **Step 2: Add bot category to CATEGORY_CONFIG**

```javascript
{ key: "bot", label: "Bot", max: 20, icon: "smart_toy", color: "bg-[#b91c1c]",
  tip: "Autonomia + qualidade + conversão do bot." }
```
Update existing max values: Sales 30, Inventory 20, Orders 15, WhatsApp 15.

- [ ] **Step 3: Update scoring logic** — handle `hasBotData = false` with proportional weight redistribution

- [ ] **Step 4: Update AdminDashboard** to fetch and pass bot data to FranchiseHealthScore

- [ ] **Step 5: Verify** — `npm run build`. Browser: Health Score shows 5 dimensions.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/FranchiseHealthScore.jsx src/components/dashboard/AdminDashboard.jsx
git commit -m "feat: FranchiseHealthScore — 5ª dimensão Bot + AdminDashboard data"
```

### Task 4.3: Coaching alerts in AlertsPanel

**Files:**
- Modify: `src/components/dashboard/AlertsPanel.jsx`

- [ ] **Step 1: Add new props** — `botConversations`, `conversationMessages`, `contacts`

- [ ] **Step 2: Add alert type calculations** in useMemo:

New alerts per franchise:
- **Bot inativo** (red): 0 conversations in 7 days → icon `smart_toy`
- **Intervenção excessiva** (yellow): avg human msgs > 3/conversa → icon `support_agent`
- **Leads parados** (yellow): > 5 leads `em_negociacao` > 7 days → icon `person_search`
- **Stock miss** (red): > 3 products mentioned in topics but qty=0 → icon `production_quantity_limits`
- **Setup + impacto** (orange): setup < 50% AND autonomy < 20% → icon `settings_suggest`

- [ ] **Step 3: Render new alert groups** (max 3 total, priorizar vermelhos)

- [ ] **Step 4: Update AdminDashboard** to pass bot/contacts data to AlertsPanel

- [ ] **Step 5: Verify** — `npm run build`. Browser: coaching alerts appear for applicable franchises.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/AlertsPanel.jsx src/components/dashboard/AdminDashboard.jsx
git commit -m "feat: AlertsPanel — alertas de coaching (bot inativo, intervenção, leads, stock)"
```

---

## Phase 5: BotIntelligence Coaching Tab + SmartActions

### Task 5.1: Add Coaching tab to BotIntelligence

**Files:**
- Modify: `src/pages/BotIntelligence.jsx`

- [ ] **Step 1: Import Tabs + BotReport**

```javascript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BotReport } from "@/entities/all";
```

- [ ] **Step 2: Add tab state** — `const [activeTab, setActiveTab] = useState("visao-geral");`

- [ ] **Step 3: Wrap existing content in Tabs**

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="grid grid-cols-2 mb-6">
    <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
    <TabsTrigger value="coaching">Coaching</TabsTrigger>
  </TabsList>
  <TabsContent value="visao-geral">{/* existing content */}</TabsContent>
  <TabsContent value="coaching">{/* BotCoachingPanel */}</TabsContent>
</Tabs>
```

- [ ] **Step 4: Create BotCoachingPanel** (inline or `src/components/bot-intelligence/BotCoachingPanel.jsx`)

Content:
1. **Reports table**: last report per franchise (date, profile_tier, autonomy, sent_at)
2. **Network Insights**: aggregated patterns from bot_reports
3. **Button "Gerar relatório avulso"**: POST to n8n webhook for specific franchise

- [ ] **Step 5: Verify** — `npm run build`. Browser: two tabs visible, Coaching shows reports.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BotIntelligence.jsx
git commit -m "feat: BotIntelligence — aba Coaching (relatórios, insights rede, trigger avulso)"
```

### Task 5.2: Feed SmartActions from bot_reports

**Files:**
- Modify: `src/lib/smartActions.js`
- Modify: `src/components/dashboard/SmartActions.jsx`

- [ ] **Step 1: Add `generateBotCoachActions` to smartActions.js**

```javascript
export function generateBotCoachActions(botReport, limit = 3) {
  if (!botReport?.metrics) return [];
  const actions = [];
  const m = botReport.metrics;

  if (m.operational?.stock_misses?.length > 0) {
    for (const miss of m.operational.stock_misses.slice(0, 2)) {
      actions.push({
        type: "repor_estoque", label: "Repor Estoque", icon: "inventory",
        color: "#dc2626", bgColor: "#fef2f2", priority: 1,
        message: `Repor ${miss.product} (${miss.times_mentioned} menções, ${miss.times_empty} stock-outs, ~R$ ${miss.est_lost_revenue} perdidos)`,
      });
    }
  }
  if (m.pipeline?.stale_leads_7d > 5) {
    actions.push({
      type: "follow_up_leads", label: "Follow-up Leads", icon: "person_search",
      color: "#d97706", bgColor: "#fffbeb", priority: 2,
      message: `Follow-up em ${m.pipeline.stale_leads_7d} leads parados há mais de 7 dias`,
    });
  }
  if (m.delivery?.abandon_by_frete_count > 2) {
    actions.push({
      type: "revisar_frete", label: "Revisar Frete", icon: "local_shipping",
      color: "#ea580c", bgColor: "#fff7ed", priority: 3,
      message: `Revisar tabela de frete (${m.delivery.abandon_by_frete_count} abandonos por frete)`,
    });
  }
  return actions.sort((a, b) => a.priority - b.priority).slice(0, limit);
}
```

- [ ] **Step 2: Update SmartActions component** — fetch latest bot_report, merge coach actions with existing

```javascript
const [botReport, setBotReport] = useState(null);
useEffect(() => {
  if (franchiseId) {
    BotReport.filter({ franchise_id: franchiseId }, "-report_period_end", 1)
      .then(data => setBotReport(data?.[0] || null)).catch(() => {});
  }
}, [franchiseId]);

const actions = useMemo(() => {
  const contactActions = generateSmartActions(contacts, 3);
  const coachActions = generateBotCoachActions(botReport, 2);
  return [...coachActions, ...contactActions].slice(0, 5);
}, [contacts, botReport]);
```

- [ ] **Step 3: Verify** — `npm run build`. Browser: SmartActions shows coach actions when bot_reports exist.

- [ ] **Step 4: Commit**

```bash
git add src/lib/smartActions.js src/components/dashboard/SmartActions.jsx
git commit -m "feat: SmartActions — ações do Coach (stock misses, leads, frete)"
```

---

## Phase 5b: Edge Cases + Final Verification

### Task 5.3: Handle edge cases

- [ ] **Step 1: BotPerformanceCard** — already returns null for < 5 conversations. No change needed.

- [ ] **Step 2: Health Score** — `hasBotData = false` redistributes weights. Verify renders correctly.

- [ ] **Step 3: n8n workflow** — Add IF after "Get Bot Conversations": skip franchise if 0 conversations. For < 5, simplified report prompt.

- [ ] **Step 4: Final build** — `npm run build`. Verify no errors.

### Task 5.4: Full end-to-end verification

- [ ] **Step 1**: Trigger n8n workflow manually for 1 franchise
- [ ] **Step 2**: Check `bot_reports` table has INSERT with metrics + report_text
- [ ] **Step 3**: Check WhatsApp msg received and ≤ 1500 chars
- [ ] **Step 4**: Browser check: BotPerformanceCard trend arrows
- [ ] **Step 5**: Browser check: "Ver detalhes" → Sheet with chart + history
- [ ] **Step 6**: Browser check: Health Score shows 5 dimensions
- [ ] **Step 7**: Browser check: AlertsPanel shows coaching alerts
- [ ] **Step 8**: Browser check: BotIntelligence Coaching tab lists reports
- [ ] **Step 9**: Browser check: SmartActions shows coach actions

---

## Summary of Files

| Action | File Path |
|--------|-----------|
| Create | `supabase/bot-reports.sql` |
| Create | `src/components/dashboard/BotCoachSheet.jsx` |
| Modify | `src/entities/all.js` (add BotReport) |
| Modify | `src/components/dashboard/BotPerformanceCard.jsx` (trends + sheet) |
| Modify | `src/lib/healthScore.js` (calcBotScore + weights) |
| Modify | `src/components/dashboard/FranchiseHealthScore.jsx` (5th dim) |
| Modify | `src/components/dashboard/AlertsPanel.jsx` (coaching alerts) |
| Modify | `src/components/dashboard/AdminDashboard.jsx` (pass bot data) |
| Modify | `src/pages/BotIntelligence.jsx` (Coaching tab) |
| Modify | `src/lib/smartActions.js` (generateBotCoachActions) |
| Modify | `src/components/dashboard/SmartActions.jsx` (merge coach) |
| n8n | New workflow "Bot Coach Report" (configured via API/UI) |
