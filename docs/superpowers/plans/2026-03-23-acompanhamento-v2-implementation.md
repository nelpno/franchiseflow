# Acompanhamento v2 — Saúde das Franquias: Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the checklist-monitoring Acompanhamento page with an automated franchise health dashboard scoring 0-100 across 5 dimensions, with admin notes timeline.

**Architecture:** Reuse and adapt the existing `calculateHealthScore()` from `FranchiseHealthScore.jsx` into a shared utility. Create `franchise_notes` table + entity. Rewrite `Acompanhamento.jsx` with new components: summary cards, filterable/sortable franchise list, inline drill-down with diagnostics + notes.

**Tech Stack:** React 18, Tailwind CSS, shadcn/ui, Material Symbols, Supabase (RLS + RPC), date-fns, sonner

**Spec:** `docs/superpowers/specs/2026-03-23-acompanhamento-v2-saude-franquias.md`

---

## Chunk 1: Database + Entity

### Task 1: Create `franchise_notes` table

**Files:**
- Create: `supabase/franchise_notes.sql`

- [ ] **Step 1: Write SQL migration**

```sql
-- franchise_notes: admin/manager annotations per franchise
CREATE TABLE IF NOT EXISTS franchise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_franchise_notes_franchise_created
  ON franchise_notes(franchise_id, created_at DESC);

ALTER TABLE franchise_notes ENABLE ROW LEVEL SECURITY;

-- profiles has USING(true) for SELECT (rule 6 CLAUDE.md), so this JOIN is safe
CREATE POLICY "Admin and manager can read notes"
  ON franchise_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and manager can insert notes"
  ON franchise_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Author can delete own notes"
  ON franchise_notes FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Execute SQL via Supabase Management API**

Run the SQL against the production database using the Management API:
```
POST https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query
Authorization: Bearer {SUPABASE_MANAGEMENT_TOKEN}
```

- [ ] **Step 3: Verify table created**

Run verification query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'franchise_notes' ORDER BY ordinal_position;`

### Task 2: Add FranchiseNote entity

**Files:**
- Modify: `src/entities/all.js`

- [ ] **Step 1: Add entity export**

After the last `createEntity()` call, add:
```javascript
export const FranchiseNote = createEntity('franchise_notes');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/franchise_notes.sql src/entities/all.js
git commit -m "feat(acompanhamento): franchise_notes table + entity"
```

---

## Chunk 2: Health Score Utility

### Task 3: Extract health score into shared utility

**Files:**
- Create: `src/lib/healthScore.js`
- Reference: `src/components/dashboard/FranchiseHealthScore.jsx` (existing `calculateHealthScore`)

The existing `FranchiseHealthScore.jsx` already has a `calculateHealthScore()` function with similar dimensions. Extract and adapt it into a shared utility with the spec's updated weights and thresholds.

- [ ] **Step 1: Create `src/lib/healthScore.js`**

```javascript
import { format, subDays, differenceInDays } from "date-fns";

/**
 * Calculates franchise health score (0-100) across 5 dimensions.
 *
 * Dimensions & weights (normal):
 *   Vendas 30%, Estoque 25%, Reposição 20%, Setup 15%, Atividade 10%
 *
 * New franchise (<30 days): Setup 40%, Vendas 20%, Estoque 15%, Reposição 15%, Atividade 10%
 */

// --- Individual dimension calculators ---

function calcSalesScore(franchise, salesData) {
  // Find most recent sale for this franchise (sales use UUID franchise_id)
  const franchiseSales = salesData.filter(
    (s) => s.franchise_id === franchise.id || s.franchise_id === franchise.evolution_instance_id
  );

  if (franchiseSales.length === 0) return { score: 0, detail: "Nenhuma venda registrada", daysSince: null };

  const mostRecentDate = franchiseSales.reduce((latest, s) => {
    const d = s.sale_date || s.created_at?.substring(0, 10) || "";
    return d > latest ? d : latest;
  }, "");

  const today = format(new Date(), "yyyy-MM-dd");
  const daysSince = differenceInDays(new Date(today), new Date(mostRecentDate));

  let score;
  if (daysSince === 0) score = 100;
  else if (daysSince === 1) score = 80;
  else if (daysSince === 2) score = 60;
  else if (daysSince === 3) score = 40;
  else if (daysSince <= 5) score = 20;
  else score = 0;

  const detail = daysSince === 0
    ? "Vendeu hoje"
    : `Última venda há ${daysSince} dia${daysSince > 1 ? "s" : ""}`;

  return { score, detail, daysSince };
}

function calcInventoryScore(franchise, inventoryData) {
  // inventory_items uses evolution_instance_id as franchise_id
  const items = inventoryData.filter(
    (i) => i.franchise_id === franchise.evolution_instance_id
  );

  if (items.length === 0) return { score: 100, detail: "Sem itens cadastrados", zeroCount: 0 };

  const zeroItems = items.filter((i) => (i.quantity || 0) === 0);
  const zeroCount = zeroItems.length;

  let score;
  if (zeroCount === 0) score = 100;
  else if (zeroCount === 1) score = 80;
  else if (zeroCount <= 3) score = 60;
  else if (zeroCount <= 5) score = 40;
  else if (zeroCount <= 8) score = 20;
  else score = 0;

  const detail = zeroCount === 0
    ? "Estoque OK"
    : `${zeroCount} ite${zeroCount > 1 ? "ns" : "m"} zerado${zeroCount > 1 ? "s" : ""}`;

  const zeroNames = zeroItems.slice(0, 4).map((i) => i.name).join(", ");

  return { score, detail, zeroCount, zeroNames };
}

function calcOrdersScore(franchise, ordersData) {
  // purchase_orders uses UUID franchise_id
  const orders = ordersData.filter(
    (po) => po.franchise_id === franchise.id || po.franchise_id === franchise.evolution_instance_id
  );

  if (orders.length === 0) return { score: 0, detail: "Nunca fez pedido", daysSince: null };

  const mostRecent = orders.reduce((latest, po) => {
    const d = po.ordered_at || po.created_at?.substring(0, 10) || "";
    return d > latest ? d : latest;
  }, "");

  const daysSince = differenceInDays(new Date(), new Date(mostRecent));

  let score;
  if (daysSince <= 7) score = 100;
  else if (daysSince <= 14) score = 80;
  else if (daysSince <= 21) score = 60;
  else if (daysSince <= 30) score = 40;
  else if (daysSince <= 45) score = 20;
  else score = 0;

  const detail = `Último pedido há ${daysSince} dia${daysSince > 1 ? "s" : ""}`;

  return { score, detail, daysSince, lastOrderDate: mostRecent };
}

function calcSetupScore(franchise, onboardingData, configData) {
  // onboarding_checklists uses evolution_instance_id
  const evoId = franchise.evolution_instance_id;
  const checklist = onboardingData.find((c) => c.franchise_id === evoId);
  const config = configData.find(
    (c) => c.franchise_evolution_instance_id === evoId
  );

  // Onboarding: 0-70 pts
  let onboardingPct = 0;
  if (checklist) {
    // Count completed items from the checklist data
    // completed_count or count true values in the checklist
    const completedCount = checklist.completed_count || 0;
    const totalItems = 27; // Fixed count from ONBOARDING_BLOCKS
    onboardingPct = Math.min(100, Math.round((completedCount / totalItems) * 100));
  }
  const onboardingPts = Math.round((onboardingPct / 100) * 70);

  // WhatsApp: +30 pts if instance exists and connected
  // Check if evolution_instance_id exists in config (means WhatsApp was set up)
  const hasWhatsApp = config && evoId;
  const whatsappPts = hasWhatsApp ? 30 : 0;

  const score = Math.min(100, onboardingPts + whatsappPts);
  const detail = `Onboarding ${onboardingPct}%${hasWhatsApp ? " · WhatsApp ✅" : " · WhatsApp ❌"}`;

  return { score, detail, onboardingPct, hasWhatsApp };
}

function calcActivityScore(franchise, checklistData) {
  // daily_checklists uses evolution_instance_id
  const checklists = checklistData.filter(
    (c) => c.franchise_id === franchise.evolution_instance_id
  );

  if (checklists.length === 0) return { score: 0, detail: "Nenhum checklist", daysSince: null };

  // Find most recent with completion >= 80%
  const completed = checklists
    .filter((c) => (c.completion_percentage || 0) >= 80)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (completed.length === 0) return { score: 0, detail: "Nunca completou checklist", daysSince: null };

  const daysSince = differenceInDays(new Date(), new Date(completed[0].date));

  let score;
  if (daysSince === 0) score = 100;
  else if (daysSince === 1) score = 70;
  else if (daysSince === 2) score = 40;
  else if (daysSince <= 4) score = 20;
  else score = 0;

  const detail = daysSince === 0
    ? "Checklist feito hoje"
    : `Último checklist há ${daysSince} dia${daysSince > 1 ? "s" : ""}`;

  return { score, detail, daysSince };
}

// --- Main score calculator ---

export function calculateFranchiseHealth(franchise, data) {
  const {
    sales = [],
    inventory = [],
    orders = [],
    onboarding = [],
    configs = [],
    checklists = [],
  } = data;

  const vendas = calcSalesScore(franchise, sales);
  const estoque = calcInventoryScore(franchise, inventory);
  const reposicao = calcOrdersScore(franchise, orders);
  const setup = calcSetupScore(franchise, onboarding, configs);
  const atividade = calcActivityScore(franchise, checklists);

  // Determine weights based on franchise age
  const isNew = franchise.created_at &&
    differenceInDays(new Date(), new Date(franchise.created_at)) < 30;

  const weights = isNew
    ? { vendas: 0.20, estoque: 0.15, reposicao: 0.15, setup: 0.40, atividade: 0.10 }
    : { vendas: 0.30, estoque: 0.25, reposicao: 0.20, setup: 0.15, atividade: 0.10 };

  let total = Math.round(
    vendas.score * weights.vendas +
    estoque.score * weights.estoque +
    reposicao.score * weights.reposicao +
    setup.score * weights.setup +
    atividade.score * weights.atividade
  );

  // Penalty: any dimension at 0 pulls total down by 10
  const dimensions = [vendas, estoque, reposicao, setup, atividade];
  const hasZero = dimensions.some((d) => d.score === 0);
  if (hasZero) total -= 10;

  total = Math.max(0, Math.min(100, total));

  // Semaphore
  let status;
  if (isNew) status = "nova";
  else if (total >= 70) status = "saudavel";
  else if (total >= 40) status = "atencao";
  else status = "critico";

  // Problem summary: dimensions with score < 50
  const problems = [];
  if (vendas.score < 50 && vendas.daysSince !== null) problems.push(vendas.detail);
  if (estoque.score < 50 && estoque.zeroCount > 0) problems.push(estoque.detail);
  if (reposicao.score < 50 && reposicao.daysSince !== null) problems.push(reposicao.detail);
  if (setup.score < 50) problems.push(setup.detail);
  if (atividade.score < 50 && atividade.daysSince !== null) problems.push(atividade.detail);

  return {
    total,
    status,
    isNew,
    dimensions: { vendas, estoque, reposicao, setup, atividade },
    weights,
    problems,
  };
}

// Status colors following design system
export const STATUS_COLORS = {
  critico: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  atencao: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  saudavel: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  nova: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
};

export const STATUS_LABELS = {
  critico: "Crítico",
  atencao: "Atenção",
  saudavel: "Saudável",
  nova: "Nova",
};
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npm run build` — should compile without errors (healthScore.js is pure JS, no JSX).

- [ ] **Step 3: Commit**

```bash
git add src/lib/healthScore.js
git commit -m "feat(acompanhamento): health score calculation utility"
```

---

## Chunk 3: UI Components

### Task 4: HealthScoreBar component

**Files:**
- Create: `src/components/acompanhamento/HealthScoreBar.jsx`

Small horizontal bar showing score for one dimension.

- [ ] **Step 1: Create component**

```jsx
import React from "react";
import { STATUS_COLORS } from "@/lib/healthScore";

/**
 * Mini horizontal bar for a single health dimension.
 * Props: label (string), score (0-100), maxWidth (px, default 60)
 */
export default function HealthScoreBar({ label, score, maxWidth = 60 }) {
  const color = score >= 70 ? STATUS_COLORS.saudavel.text
    : score >= 40 ? STATUS_COLORS.atencao.text
    : STATUS_COLORS.critico.text;

  const fillWidth = Math.round((score / 100) * maxWidth);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="rounded-full overflow-hidden"
        style={{ width: maxWidth, height: 6, backgroundColor: "#e9e8e9" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: fillWidth, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px]" style={{ color: "#7a6d6d" }}>{label}</span>
    </div>
  );
}
```

### Task 5: FranchiseNotes component

**Files:**
- Create: `src/components/acompanhamento/FranchiseNotes.jsx`

Timeline of admin notes + add note form.

- [ ] **Step 1: Create component**

```jsx
import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { FranchiseNote } from "@/entities/all";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Timeline of admin notes for a franchise + form to add new note.
 * Props:
 *   franchiseId (UUID),
 *   notes (array, pre-filtered for this franchise),
 *   currentUserId (UUID),
 *   currentUserName (string),
 *   onNoteAdded (callback to refresh)
 */
export default function FranchiseNotes({
  franchiseId, notes = [], currentUserId, currentUserName, onNoteAdded
}) {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const displayNotes = showAll ? notes : notes.slice(0, 10);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      await FranchiseNote.create({
        franchise_id: franchiseId,
        user_id: currentUserId,
        note: newNote.trim(),
      });
      setNewNote("");
      toast.success("Anotação salva");
      onNoteAdded?.();
    } catch (err) {
      toast.error(err.message || "Erro ao salvar anotação");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1b1c1d" }}>
        <MaterialIcon icon="sticky_note_2" className="text-base" />
        Anotações
      </h4>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value.slice(0, 500))}
          placeholder="Ex: Liguei, José disse que estava viajando..."
          rows={2}
          className="flex-1 text-sm rounded-md border px-3 py-2 resize-none"
          style={{ borderColor: "#e9e8e9", backgroundColor: "#fbf9fa" }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !newNote.trim()}
          className="self-end"
        >
          <MaterialIcon icon="note_add" className="text-base mr-1" />
          Anotar
        </Button>
      </form>

      {/* Notes timeline */}
      {displayNotes.length === 0 ? (
        <p className="text-sm" style={{ color: "#7a6d6d" }}>Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2">
          {displayNotes.map((note) => (
            <div key={note.id} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium" style={{ color: "#4a3d3d" }}>
                {format(new Date(note.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              <span style={{ color: "#7a6d6d" }}>—</span>
              <span style={{ color: "#1b1c1d" }}>{note.note}</span>
            </div>
          ))}
          {!showAll && notes.length > 10 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-medium"
              style={{ color: "#b91c1c" }}
            >
              Ver todas ({notes.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### Task 6: FranchiseHealthDetail component (drill-down)

**Files:**
- Create: `src/components/acompanhamento/FranchiseHealthDetail.jsx`

Inline expandable panel with diagnostics + notes + actions.

- [ ] **Step 1: Create component**

```jsx
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import { STATUS_COLORS } from "@/lib/healthScore";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import FranchiseNotes from "./FranchiseNotes";

/**
 * Inline drill-down panel for a franchise in the health list.
 * Props:
 *   franchise (object), healthData (from calculateFranchiseHealth),
 *   notes (array), currentUserId, currentUserName, onNoteAdded
 */
export default function FranchiseHealthDetail({
  franchise, healthData, notes, currentUserId, currentUserName, onNoteAdded
}) {
  const navigate = useNavigate();
  const { dimensions } = healthData;

  const dimensionRows = [
    { key: "vendas", label: "Vendas", icon: "point_of_sale", data: dimensions.vendas },
    { key: "estoque", label: "Estoque", icon: "inventory_2", data: dimensions.estoque },
    { key: "reposicao", label: "Reposição", icon: "local_shipping", data: dimensions.reposicao },
    { key: "setup", label: "Setup", icon: "rocket_launch", data: dimensions.setup },
    { key: "atividade", label: "Atividade", icon: "task_alt", data: dimensions.atividade },
  ];

  function getScoreColor(score) {
    if (score >= 70) return STATUS_COLORS.saudavel.text;
    if (score >= 40) return STATUS_COLORS.atencao.text;
    return STATUS_COLORS.critico.text;
  }

  const ownerPhone = franchise.owner_phone || franchise.phone;

  return (
    <div className="px-4 py-4 space-y-4 border-t" style={{ borderColor: "#e9e8e9", backgroundColor: "#fbf9fa" }}>
      {/* Block 1: Diagnostics */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1b1c1d" }}>
          <MaterialIcon icon="vital_signs" className="text-base" />
          Diagnóstico
        </h4>
        <div className="grid gap-2">
          {dimensionRows.map(({ key, label, icon, data }) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <MaterialIcon icon={icon} className="text-base" style={{ color: getScoreColor(data.score) }} />
              <span className="w-20 font-medium" style={{ color: "#1b1c1d" }}>{label}</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#e9e8e9" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${data.score}%`, backgroundColor: getScoreColor(data.score) }}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: getScoreColor(data.score) }}>{data.score}</span>
              </div>
              <span className="text-sm" style={{ color: "#4a3d3d" }}>{data.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Block 2: Notes */}
      <FranchiseNotes
        franchiseId={franchise.id}
        notes={notes}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onNoteAdded={onNoteAdded}
      />

      {/* Block 3: Quick Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "#e9e8e9" }}>
        {ownerPhone && (
          <Button variant="outline" size="sm" asChild>
            <a href={getWhatsAppLink(ownerPhone)} target="_blank" rel="noopener noreferrer">
              <MaterialIcon icon="chat" className="text-base mr-1" />
              WhatsApp
            </a>
          </Button>
        )}
        <Button
          variant="outline" size="sm"
          onClick={() => document.querySelector(`#notes-input-${franchise.id}`)?.focus()}
        >
          <MaterialIcon icon="edit_note" className="text-base mr-1" />
          Anotar
        </Button>
        {healthData.dimensions.setup.score < 100 && (
          <Button variant="outline" size="sm" onClick={() => navigate("/Onboarding")}>
            <MaterialIcon icon="rocket_launch" className="text-base mr-1" />
            Ver Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit new components**

```bash
git add src/components/acompanhamento/HealthScoreBar.jsx \
        src/components/acompanhamento/FranchiseNotes.jsx \
        src/components/acompanhamento/FranchiseHealthDetail.jsx
git commit -m "feat(acompanhamento): health score bar, notes, and detail components"
```

---

## Chunk 4: Rewrite Acompanhamento Page

### Task 7: Rewrite `Acompanhamento.jsx`

**Files:**
- Modify: `src/pages/Acompanhamento.jsx` (full rewrite)
- Reference: existing page structure (imports, AdminRoute pattern, Layout)

This is the main task. The page is completely rewritten but keeps the same route and menu entry.

- [ ] **Step 1: Rewrite the page**

The new page should:
1. Fetch data: `Franchise.list()`, `Sale.list()`, `InventoryItem.list()`, `PurchaseOrder.list()`, `OnboardingChecklist.list()`, `DailyChecklist.list()`, `FranchiseNote.list()`, `FranchiseConfiguration.list()` — all via `Promise.all` with `withTimeout`
2. Calculate health scores using `calculateFranchiseHealth()` for each franchise
3. Render: 4 summary cards, filter bar, sortable franchise list, inline drill-down
4. Support: search by name/city, filter by status, sort by score/last sale/last order
5. Polling every 120s with mountedRef guard
6. Error state with "Tentar novamente" button (pattern from MyContacts.jsx)

Key implementation details:
- Use `mountedRef` + cleanup in useEffect (rule 89-90)
- `Franchise.list()` without status filter (rule 74)
- Filter inactive franchises in frontend after fetch
- Icons via `MaterialIcon` (rule 19)
- Colors from design system tokens (rule 99), semantic exceptions for health status colors
- Mobile: `grid-cols-2` for summary cards, stacked cards for franchise list
- Expanded franchise state: `expandedId` (one at a time, accordion behavior)
- Loading skeleton matching grid layout (rule 97)

The full page structure:
```
Header: "Acompanhamento" + subtitle + "Atualizar" button
Summary Cards: grid-cols-4 (desktop) / grid-cols-2 (mobile)
Filter Bar: search + status select + sort select
Franchise List: sorted/filtered, each row expandable
  └─ FranchiseHealthDetail (inline when expanded)
```

For each franchise row (collapsed):
- Left: score badge (big number + color bg)
- Center: name + city, mini bars (5 dimensions via HealthScoreBar), problem summary
- Right: chevron expand indicator
- Mobile: stack vertically, score left, info right, bars below

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build` — check for compilation errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Acompanhamento.jsx
git commit -m "feat(acompanhamento): health dashboard with score, filters, notes"
```

---

## Chunk 5: Cleanup + Polish

### Task 8: Update FranchiseConfiguration entity (if needed)

**Files:**
- Check: `src/entities/all.js`

- [ ] **Step 1: Verify FranchiseConfiguration entity exists**

Check if `FranchiseConfiguration` is already exported from `all.js`. If not, add:
```javascript
export const FranchiseConfiguration = createEntity('franchise_configurations');
```

### Task 9: Cleanup old modal

**Files:**
- Remove: `src/components/acompanhamento/FranchiseeDetailModal.jsx` (no longer imported)

- [ ] **Step 1: Verify modal is not imported anywhere else**

Search for `FranchiseeDetailModal` in the entire codebase. If only referenced from old Acompanhamento code (now rewritten), delete the file.

- [ ] **Step 2: Delete if unused**

```bash
rm src/components/acompanhamento/FranchiseeDetailModal.jsx
```

### Task 10: Test manually + final commit

- [ ] **Step 1: Run dev server and test**

```bash
npm run dev
```

Manual verification checklist:
1. Navigate to `/Acompanhamento` — page loads without errors
2. Summary cards show correct counts (critical/attention/healthy/average)
3. Franchise list shows all active franchises sorted by score (worst first)
4. Search by name filters correctly
5. Status filter works (Todos/Crítico/Atenção/Saudável)
6. Click franchise → drill-down expands inline
7. Diagnostics show 5 dimensions with scores and details
8. Add a note → appears in timeline
9. WhatsApp button opens correct link
10. Mobile view: cards stack properly, no horizontal overflow

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Verify: `ls dist/index.html` exists (rule 54).

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git commit -m "feat(acompanhamento): complete health dashboard v2 with cleanup"
git push origin main
```

- [ ] **Step 4: Deploy via Portainer**

Use `ctx_execute` (shell) to force-update the service via Portainer API (rule 127).

---

## Implementation Notes for Executing Agent

### ID Mapping (Critical)
- `sales.franchise_id` = UUID → match with `franchise.id`
- `purchase_orders.franchise_id` = UUID → match with `franchise.id`
- `inventory_items.franchise_id` = text (evo_id) → match with `franchise.evolution_instance_id`
- `daily_checklists.franchise_id` = text (evo_id) → match with `franchise.evolution_instance_id`
- `onboarding_checklists.franchise_id` = text (evo_id) → match with `franchise.evolution_instance_id`
- `franchise_configurations.franchise_evolution_instance_id` = text (evo_id)

### Entity Pattern
All entities use `createEntity(tableName)` from `src/entities/all.js`. Methods: `.list(orderBy, limit)`, `.filter(criteria, orderBy, limit)`, `.create(data)`, `.update(id, data)`, `.delete(id)`.

### Key Rules to Follow
- Rule 19: Icons via `<MaterialIcon icon="name" />` — NEVER Lucide
- Rule 74: `Franchise.list()` without status filter
- Rule 89-90: `mountedRef` + cleanup in useEffect for data fetching
- Rule 97: Loading skeleton must match real grid layout
- Rule 99: Use design system color tokens, not Tailwind generics (semantic exceptions for health status)
- Rule 125: Emerald colors OK for success states
- Rule 127: Deploy via `ctx_execute` for Portainer API calls
