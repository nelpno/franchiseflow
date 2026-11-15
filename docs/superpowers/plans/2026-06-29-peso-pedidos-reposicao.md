# Peso total nos pedidos de reposição — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar o peso TOTAL de cada pedido de reposição (no formulário e na ficha de separação PDF) e gravar `purchase_orders.total_weight_kg`, pra ter o dado pronto pro roteirizador (cap 1500 kg) consumir depois.

**Architecture:** O peso de cada produto vem do nome (parser `productWeight.js`) com override persistido numa tabela-mestra `product_weights`. O peso aparece **só como total** (rodapé do form, rodapé/consolidado do PDF) — nunca por item. Cada consumidor (form do franqueado, PDF do admin) busca o mapa de pesos via `getProductWeightMap()`. Ao salvar, grava só `purchase_orders.total_weight_kg`.

**Tech Stack:** React 18 + Vite, Supabase (Postgres + RPC), jsPDF/jspdf-autotable. Sem test runner no projeto → parser testado com script `node`; UI/PDF/DB validados por build + content-check + smoke manual.

**Spec:** [docs/superpowers/specs/2026-06-28-peso-pedidos-reposicao-design.md](../specs/2026-06-28-peso-pedidos-reposicao-design.md)

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/productWeight.js` | Parser do nome → kg, formatador, resolver `getItemWeightKg` | **Criar** |
| `src/lib/productWeight.test.mjs` | Asserts do parser (rodado com `node`) | **Criar** |
| `supabase/product-weights-table.sql` | Tabela `product_weights` + RLS | **Criar** |
| `supabase/scripts/seed-product-weights.mjs` | Seed/reseed: parser sobre nomes do catálogo → upsert | **Criar** |
| `supabase/purchase-orders-total-weight.sql` | `alter ... add total_weight_kg` | **Criar** |
| `src/entities/all.js` | `getProductWeightMap()` (fetch do mapa) | **Modificar** (~L275) |
| `src/components/minha-loja/PurchaseOrderForm.jsx` | Buscar mapa, total no rodapé, gravar `total_weight_kg` | **Modificar** |
| `src/lib/pickingSheetPdf.js` | `Peso total` no rodapé do pedido + total do dia | **Modificar** |
| `src/pages/PurchaseOrders.jsx` | Buscar mapa e passar aos geradores de PDF | **Modificar** |

**YAGNI / fora do plano (com razão):**
- **RPC `get_standard_product_catalog` NÃO muda** — nada consome peso do catálogo na versão enxuta. (Spec §3 mencionava; cortado.)
- **Sem coluna `purchase_order_items.weight_kg`** — só o total no header.
- **TabReposicao.jsx NÃO muda** — não exibe peso; o form busca o mapa sozinho.
- **Sem peso por item** em lugar nenhum (form, PDF).
- **Sem tela de edição de peso** (override via SQL sob demanda).

---

## Task 1: Parser de peso (`productWeight.js`)

**Files:**
- Create: `src/lib/productWeight.js`
- Test: `src/lib/productWeight.test.mjs`

> Módulo **puro** (só regex/JS) — sem `import.meta`/imports de browser — pra poder ser importado pelo script de seed em Node.

- [ ] **Step 1: Escrever o teste que falha** — `src/lib/productWeight.test.mjs`

```js
// Teste do parser de peso. Roda com: node src/lib/productWeight.test.mjs
import { parseWeightKg, formatWeightKg, getItemWeightKg } from "./productWeight.js";

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = actual === expected || (typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) < 1e-9);
  if (ok) { pass++; }
  else { fail++; console.error(`FAIL ${label}: esperado ${expected}, veio ${actual}`); }
}

// parseWeightKg
eq(parseWeightKg("Canelone 4 Queijos - 700g"), 0.7, "700g com numero antes");
eq(parseWeightKg("Massa de Lasanha - 500g"), 0.5, "500g");
eq(parseWeightKg("Molho de Tomate Sugo - 250g"), 0.25, "250g");
eq(parseWeightKg("Massa de Pastel - 1kg"), 1.0, "1kg");
eq(parseWeightKg("Rondelli frango X Requeijão 700 gramas"), 0.7, "700 gramas");
eq(parseWeightKg("Produto sem peso"), null, "sem peso -> null");
eq(parseWeightKg(""), null, "vazio -> null");
eq(parseWeightKg(null), null, "null -> null");
eq(parseWeightKg("Coisa 1,5 kg"), 1.5, "1,5 kg virgula");

// formatWeightKg
eq(formatWeightKg(0.7), "0,7 kg", "format 0,7");
eq(formatWeightKg(58.8), "58,8 kg", "format 58,8");
eq(formatWeightKg(null), "—", "format null -> traco");
eq(formatWeightKg(0), "—", "format 0 -> traco");

// getItemWeightKg (override > parser > null)
eq(getItemWeightKg({ product_name: "Massa de Pastel - 1kg" }, { "Massa de Pastel - 1kg": 1.2 }), 1.2, "override vence");
eq(getItemWeightKg({ product_name: "Canelone 4 Queijos - 700g" }, {}), 0.7, "fallback parser");
eq(getItemWeightKg({ product_name: "Sem peso" }, {}), null, "sem nada -> null");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node src/lib/productWeight.test.mjs`
Expected: erro de import (módulo/funcs não existem) — falha.

- [ ] **Step 3: Implementar** — `src/lib/productWeight.js`

```js
// Peso de produto a partir do nome. Módulo PURO (sem import.meta) — usado no
// front (form/PDF) E no script de seed em Node.

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|gramas?)\b/i;

// Lê a gramatura do nome e devolve em KG (number) ou null se nada casar.
// "700g"->0.7, "1kg"->1, "700 gramas"->0.7, "1,5 kg"->1.5.
export function parseWeightKg(productName) {
  if (!productName || typeof productName !== "string") return null;
  const m = productName.match(WEIGHT_RE);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  if (isNaN(value)) return null;
  const unit = m[2].toLowerCase();
  const kg = unit.startsWith("kg") ? value : value / 1000;
  return kg;
}

// Formata kg pra UI: "58,8 kg". null/0/NaN -> "—".
export function formatWeightKg(kg) {
  if (kg == null || isNaN(kg) || kg === 0) return "—";
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

// Resolve o peso unitário de um item: override persistido > parser do nome > null.
export function getItemWeightKg(item, weightMap) {
  if (!item) return null;
  const name = item.product_name;
  const override = weightMap && name != null ? weightMap[name] : undefined;
  if (override != null) return Number(override);
  return parseWeightKg(name);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node src/lib/productWeight.test.mjs`
Expected: `16 passaram, 0 falharam` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/lib/productWeight.js src/lib/productWeight.test.mjs
git commit -m "feat(reposicao): parser de peso de produto (nome -> kg) + teste node"
```

---

## Task 2: Fetch do mapa de pesos (`getProductWeightMap`)

**Files:**
- Modify: `src/entities/all.js` (logo após `getStandardProductCatalog`, ~L275)

- [ ] **Step 1: Adicionar o helper** após a função `getStandardProductCatalog` (linha ~275):

```js
// Mapa { [product_name]: weight_kg } da tabela-mestra de pesos.
// Leve (~33 linhas). Usado pelo form de reposição e pela geração de fichas PDF.
export async function getProductWeightMap({ signal } = {}) {
  let query = supabase.from("product_weights").select("product_name, weight_kg");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.product_name] = Number(row.weight_kg); });
  return map;
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add src/entities/all.js
git commit -m "feat(reposicao): getProductWeightMap (fetch da tabela-mestra de pesos)"
```

> Nota: a tabela ainda não existe — o helper só é chamado em runtime nas tasks 6/8, que rodam depois das migrations (tasks 3-5). Lint/commit aqui é seguro.

---

## Task 3: Tabela-mestra `product_weights`

**Files:**
- Create: `supabase/product-weights-table.sql`

- [ ] **Step 1: Escrever o SQL** — `supabase/product-weights-table.sql`

```sql
-- Tabela-mestra de peso por produto (catálogo padrão da rede).
-- weight_kg seedado pelo parser (productWeight.js); is_auto vira false quando
-- ajustado manualmente por admin (override via SQL). Cross-rede, não-sensível.

create table if not exists public.product_weights (
  product_name text primary key,
  weight_kg    numeric(10,3) not null check (weight_kg >= 0),
  is_auto      boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.product_weights enable row level security;

-- Leitura: qualquer usuário autenticado (catálogo cross-rede, não-sensível).
drop policy if exists product_weights_select on public.product_weights;
create policy product_weights_select on public.product_weights
  for select to authenticated using (true);

-- Escrita: só admin/manager (override). service_role bypassa RLS (seed).
drop policy if exists product_weights_write on public.product_weights;
create policy product_weights_write on public.product_weights
  for all to authenticated
  using ((select public.is_admin_or_manager()))
  with check ((select public.is_admin_or_manager()));

grant select, insert, update, delete on table public.product_weights to authenticated, service_role;
```

- [ ] **Step 2: Aplicar** via Supabase MCP `apply_migration` (project `sulgicnqqopyhulglakd`, name `product_weights_table`) com o conteúdo do arquivo.

- [ ] **Step 3: Verificar** via `execute_sql`:

```sql
select count(*) from public.product_weights;            -- 0 (ainda sem seed)
select relrowsecurity from pg_class where relname = 'product_weights'; -- true
```

- [ ] **Step 4: Commit**

```bash
git add supabase/product-weights-table.sql
git commit -m "feat(reposicao): tabela-mestra product_weights + RLS"
```

---

## Task 4: Seed do peso (script reusável)

**Files:**
- Create: `supabase/scripts/seed-product-weights.mjs`

> Lê os nomes distintos do catálogo padrão de `inventory_items`, calcula o peso com o MESMO parser do front, e faz upsert em `product_weights`. Idempotente (reseed seguro). **Não sobrescreve** linhas com `is_auto=false` (overrides manuais preservados).

- [ ] **Step 1: Escrever o script** — `supabase/scripts/seed-product-weights.mjs`

```js
// Seed/reseed de product_weights a partir do nome dos produtos do catálogo padrão.
// Uso: node supabase/scripts/seed-product-weights.mjs            (dry-run, só relatório)
//      node supabase/scripts/seed-product-weights.mjs --apply    (grava)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseWeightKg } from "../../src/lib/productWeight.js";

// .env do dashboard (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
const env = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env"); process.exit(1); }

const apply = process.argv.includes("--apply");
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: items, error } = await sb
  .from("inventory_items")
  .select("product_name")
  .eq("created_by_franchisee", false)
  .neq("active", false);
if (error) { console.error("Erro lendo inventory_items:", error.message); process.exit(1); }

const names = [...new Set((items || []).map((i) => i.product_name).filter(Boolean))];
const rows = [];
const missing = [];
for (const name of names) {
  const kg = parseWeightKg(name);
  if (kg == null) { missing.push(name); continue; }
  rows.push({ product_name: name, weight_kg: kg });
}

console.log(`Nomes distintos: ${names.length} | com peso: ${rows.length} | sem peso: ${missing.length}`);
if (missing.length) console.log("SEM PESO (revisar):", missing);

if (!apply) { console.log("\nDry-run. Rode com --apply pra gravar."); process.exit(0); }

// Preserva overrides manuais: só upsert onde ainda é is_auto=true OU não existe.
const { data: existing } = await sb.from("product_weights").select("product_name, is_auto");
const manual = new Set((existing || []).filter((r) => r.is_auto === false).map((r) => r.product_name));
const toUpsert = rows.filter((r) => !manual.has(r.product_name)).map((r) => ({ ...r, is_auto: true, updated_at: new Date().toISOString() }));

const { error: upErr } = await sb.from("product_weights").upsert(toUpsert, { onConflict: "product_name" });
if (upErr) { console.error("Erro no upsert:", upErr.message); process.exit(1); }
console.log(`Gravadas ${toUpsert.length} linhas (preservados ${manual.size} overrides manuais).`);
```

- [ ] **Step 2: Dry-run**

Run: `node supabase/scripts/seed-product-weights.mjs`
Expected: `Nomes distintos: 33 | com peso: 33 | sem peso: 0` (lista de SEM PESO vazia).

- [ ] **Step 3: Aplicar**

Run: `node supabase/scripts/seed-product-weights.mjs --apply`
Expected: `Gravadas 33 linhas (preservados 0 overrides manuais).`

- [ ] **Step 4: Verificar** via Supabase MCP `execute_sql`:

```sql
select count(*) total,
       count(*) filter (where weight_kg = 1.0)  as kg1,
       count(*) filter (where weight_kg = 0.5)  as g500,
       count(*) filter (where weight_kg = 0.25) as g250,
       count(*) filter (where weight_kg = 0.7)  as g700
from public.product_weights;
-- Esperado: total=33, kg1=2, g500=8, g250=2, g700=21 → 2+8+2+21=33.
-- (g700 INCLUI o "Rondelli frango X Requeijão 700 gramas" — "700 gramas" e "700g"
--  ambos viram 0.7. Não é uma 22ª linha; já está dentro dos 21.)
select product_name from public.product_weights where weight_kg = 0.7 and product_name ilike '%gramas%';
-- deve retornar "Rondelli frango X Requeijão 700 gramas"
```

- [ ] **Step 5: Commit**

```bash
git add supabase/scripts/seed-product-weights.mjs
git commit -m "feat(reposicao): script de seed/reseed de product_weights"
```

---

## Task 5: Coluna `total_weight_kg` no pedido

**Files:**
- Create: `supabase/purchase-orders-total-weight.sql`

- [ ] **Step 1: Escrever o SQL** — `supabase/purchase-orders-total-weight.sql`

```sql
-- Peso total do pedido (snapshot no momento do pedido). Lido pelo roteirizador.
alter table public.purchase_orders
  add column if not exists total_weight_kg numeric(12,3);

comment on column public.purchase_orders.total_weight_kg is
  'Soma(peso_unit * quantity) no momento do pedido. Snapshot p/ roteirização (cap 1500kg). Pedidos antigos = null.';
```

- [ ] **Step 2: Aplicar** via Supabase MCP `apply_migration` (name `purchase_orders_total_weight`).

- [ ] **Step 3: Verificar**

```sql
select column_name, data_type from information_schema.columns
where table_name = 'purchase_orders' and column_name = 'total_weight_kg';
-- 1 linha: total_weight_kg | numeric
```

- [ ] **Step 4: Commit**

```bash
git add supabase/purchase-orders-total-weight.sql
git commit -m "feat(reposicao): coluna purchase_orders.total_weight_kg"
```

---

## Task 6: Form — total no rodapé + grava snapshot

**Files:**
- Modify: `src/components/minha-loja/PurchaseOrderForm.jsx`

- [ ] **Step 1: Import** — adicionar após a linha 19 (`import { weeklyTurnoverMap, suggestionFor } ...`):

```js
import { getItemWeightKg, formatWeightKg } from "@/lib/productWeight";
import { getProductWeightMap } from "@/entities/all";
```

- [ ] **Step 2: Buscar o mapa ao montar** — dentro do componente, após `const submittingRef = useRef(false);` (linha ~74):

```js
  const [weightMap, setWeightMap] = useState({});
  useEffect(() => {
    let alive = true;
    getProductWeightMap()
      .then((m) => { if (alive) setWeightMap(m); })
      .catch(() => { /* sem mapa, cai no parser do nome via getItemWeightKg */ });
    return () => { alive = false; };
  }, []);
```

- [ ] **Step 3: Calcular peso total + itens sem peso** — após o `useMemo` de `grandTotal` (linha ~181):

```js
  // Peso total = Σ(qtd × peso unit). Item sem peso conta 0 e é sinalizado.
  const { grandWeight, missingWeightCount } = useMemo(() => {
    let total = 0, missing = 0;
    standardProducts.forEach((item) => {
      const qty = quantities[item.id] || 0;
      if (qty <= 0) return;
      const w = getItemWeightKg(item, weightMap);
      if (w == null) { missing++; return; }
      total += qty * w;
    });
    return { grandWeight: total, missingWeightCount: missing };
  }, [standardProducts, quantities, weightMap]);
```

- [ ] **Step 4: Gravar no save** — no `PurchaseOrder.create({...})` (linhas ~209-215), adicionar `total_weight_kg`:

```js
      order = await PurchaseOrder.create({
        franchise_id: franchiseId,
        status: "pendente",
        total_amount: grandTotal,
        total_weight_kg: grandWeight,
        notes: notes.trim() || null,
        ordered_at: new Date().toISOString(),
      });
```

- [ ] **Step 5: Mostrar no rodapé** — no bloco do total (linhas ~503-507), logo após o `</span>` do `{totalItems} ... {totalUnits} un.`:

```jsx
          {totalItems > 0 && (
            <span className="text-xs text-[#4a3d3d]">
              {totalItems} {totalItems === 1 ? "produto" : "produtos"} · {totalUnits} un.
            </span>
          )}
          {grandWeight > 0 && (
            <p className="text-sm font-bold text-[#1b1c1d] mt-1">
              Peso total: {formatWeightKg(grandWeight)}
            </p>
          )}
          {missingWeightCount > 0 && (
            <span className="text-xs text-[#b91c1c]">
              {missingWeightCount} {missingWeightCount === 1 ? "item sem peso cadastrado" : "itens sem peso cadastrado"}
            </span>
          )}
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros; `dist/index.html` gerado.

- [ ] **Step 7: Commit**

```bash
git add src/components/minha-loja/PurchaseOrderForm.jsx
git commit -m "feat(reposicao): peso total no rodapé do pedido + grava total_weight_kg"
```

---

## Task 7: PDF — `Peso total` por pedido + total do dia

**Files:**
- Modify: `src/lib/pickingSheetPdf.js`

- [ ] **Step 1: Import** — adicionar no topo (após a linha 3):

```js
import { getItemWeightKg, formatWeightKg } from "./productWeight";
```

- [ ] **Step 2: `renderPickingPage` — receber `weightMap` e somar peso.** Mudar a assinatura (linha 69):

```js
function renderPickingPage(doc, autoTable, { order, items, franchiseName, editedQuantities, weightMap }) {
```

Adicionar acumulador junto aos outros totais (após `let totalValue = 0;`, linha 115):

```js
  let totalWeight = 0;
```

Dentro do loop de itens, após `totalValue += item.finalQty * Number(item.unit_price || 0);` (linha 125):

```js
      const w = getItemWeightKg(item, weightMap);
      if (w != null) totalWeight += item.finalQty * w;
```

No rodapé, na montagem do `summary` (linha 192), incluir o peso:

```js
  let summary = `${totalItems} itens  |  ${totalUnits} un  |  ${fmtBRL(totalValue)}`;
  if (totalWeight > 0) summary += `  |  Peso total: ${formatWeightKg(totalWeight)}`;
```

- [ ] **Step 3: `renderSummaryPage` — receber `weightMap` e somar o peso do dia.** Mudar a assinatura (linha 229):

```js
function renderSummaryPage(doc, autoTable, ordersWithItems, weightMap) {
```

Adicionar acumulador junto aos grand totals (após `let grandTotalValue = 0;`, linha 290):

```js
  let grandTotalWeight = 0;
```

Dentro do loop de itens agregados, após `grandTotalValue += lineValue;` (linha 301):

```js
      const w = getItemWeightKg(item, weightMap);
      if (w != null) grandTotalWeight += item.finalQty * w;
```

Imprimir na linha de TOTAL (após a linha 353, `doc.text(\`TOTAL: ...\`)`):

```js
  if (grandTotalWeight > 0) {
    fy += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(185, 28, 28);
    doc.text(`PESO TOTAL DA CARGA: ${formatWeightKg(grandTotalWeight)}`, m, fy);
    doc.setTextColor(30, 30, 30);
  }
```

- [ ] **Step 4: Threading nos exports.** `generatePickingSheet` (linha 378):

```js
export async function generatePickingSheet({ order, items, franchiseName, editedQuantities, weightMap }) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  renderPickingPage(doc, autoTable, { order, items, franchiseName, editedQuantities, weightMap });
  // ... resto inalterado
```

`generateBulkPickingSheet` (linha 392):

```js
export async function generateBulkPickingSheet(ordersWithItems, weightMap) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  ordersWithItems.forEach((data, idx) => {
    if (idx > 0) doc.addPage();
    renderPickingPage(doc, autoTable, { order: data.order, items: data.items, franchiseName: data.franchiseName, weightMap });
  });
  doc.addPage();
  renderSummaryPage(doc, autoTable, ordersWithItems, weightMap);
  // ... resto inalterado
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pickingSheetPdf.js
git commit -m "feat(reposicao): Peso total na ficha de separação e no consolidado do dia"
```

---

## Task 8: Admin — passar `weightMap` aos geradores de PDF

**Files:**
- Modify: `src/pages/PurchaseOrders.jsx`

- [ ] **Step 1: Import** — adicionar `getProductWeightMap` ao import de `@/entities/all` (conferir o import existente no topo; é de onde vêm `PurchaseOrder`, `PurchaseOrderItem` etc).

```js
// no import existente de "@/entities/all", incluir:
import { /* ...existentes..., */ getProductWeightMap } from "@/entities/all";
```

- [ ] **Step 2: Estado + load on mount** — junto aos outros `useState` do componente:

```js
  const [weightMap, setWeightMap] = useState({});
  useEffect(() => {
    let alive = true;
    getProductWeightMap()
      .then((m) => { if (alive) setWeightMap(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
```

- [ ] **Step 3: Passar no bulk** (linha ~581):

```js
      await generateBulkPickingSheet(ordersWithItems, weightMap);
```

- [ ] **Step 4: Passar no single** (linhas ~1241-1246):

```js
                        await generatePickingSheet({
                          order: selectedOrder,
                          items: orderItems,
                          franchiseName: getFranchiseName(selectedOrder.franchise_id),
                          editedQuantities,
                          weightMap,
                        });
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PurchaseOrders.jsx
git commit -m "feat(reposicao): admin passa weightMap pras fichas de separação"
```

---

## Verificação final & deploy

- [ ] **Build verde**

Run: `npm run build`
Expected: EXIT 0, `dist/index.html` com timestamp recente.

- [ ] **Smoke do parser** (re-run do teste)

Run: `node src/lib/productWeight.test.mjs`
Expected: `16 passaram, 0 falharam`.

- [ ] **Smoke runtime** — telas `franchiseeOnly` (Gestão > Reposição) não rodam como admin. Validar:
  - Form: por **content-check** no bundle (`Peso total` presente no chunk `Gestao-*.js`) via [.tmp/verify-content.mjs](../../../.tmp/verify-content.mjs) após deploy; e pedir a uma franqueada pra abrir um pedido e conferir o "Peso total" no rodapé.
  - PDF: gerar uma ficha real em `/PurchaseOrders` (admin acessa) e conferir a linha `Peso total` no rodapé do pedido + `PESO TOTAL DA CARGA` no consolidado (bulk).
  - DB: após salvar um pedido novo, `select total_weight_kg from purchase_orders order by ordered_at desc limit 1;` deve bater com o total mostrado.

- [ ] **Deploy** (só com OK do Nelson — push a `main` é deploy):
  - `git push origin main`
  - Force update do serviço Docker (stack 39, service `2zb27nndn5sg8zweyie6wscpc`) via Portainer API (incrementar `ForceUpdate` no `TaskTemplate`).
  - Verificar live por **conteúdo** (não só hash): grep de `Peso total` no chunk `Gestao-*.js` servido em produção ([.tmp/verify-content.mjs](../../../.tmp/verify-content.mjs)).

---

## Ordem de execução

Migrations primeiro (tasks 3→4→5 no banco), depois o front (6→7→8). Tasks 1 e 2 podem vir antes de tudo (não dependem do banco). O seed (task 4) exige a tabela (task 3). O front (tasks 6/8) só funciona em runtime após o banco pronto, mas compila/commita antes sem problema.

## Notas de risco (da spec)
- **Peso líquido ≠ peso de carga** — corrigir por SQL (`update product_weights set weight_kg=..., is_auto=false where product_name=...`) quando o peso real com embalagem for conhecido; o seed preserva `is_auto=false`.
- **Pedidos antigos** sem `total_weight_kg` — o PDF recalcula via `weightMap`, então a ficha sempre mostra o peso; só o snapshot no banco fica null pra esses.
- **Acoplamento por `product_name`** — rename cria chave nova (peso desconhecido até reseed); o parser em runtime cobre o intervalo.
