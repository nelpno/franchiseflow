# Reports Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voltar aba Relatórios à sidebar admin como tabela comparativa cruzada (7 colunas) por franquia, com filtro de período, busca e export CSV.

**Architecture:** Refatorar `src/pages/Reports.jsx` existente (mantém shell de carregamento + filtros), substituir corpo por `FranchiseReportTable` + `FranchiseReportToolbar`. Todas as queries via entity adapter. Linha da tabela navega para `/Franchises?id=<evo>&openSheet=1`, que abre o detail sheet existente.

**Tech Stack:** React 18, Vite, `@/entities/all` (Supabase adapter), shadcn/ui, sonner, date-fns, Material Symbols.

**Spec:** [`docs/superpowers/specs/2026-04-19-reports-tab-redesign-design.md`](../specs/2026-04-19-reports-tab-redesign-design.md)

**Notas globais:**
- Projeto **não tem suite de testes**. Verificação = `npm run lint` + `npm run typecheck` + smoke test manual no browser (`npm run dev`).
- Seguir padrão `AdminDashboard.jsx`: `Promise.allSettled`, `mountedRef`, `abortController`, `fetchAll:true` em tabelas que crescem.
- Cada task termina com commit. Mensagens em português, Co-Authored-By no final.

---

## Chunk 1: Suporte a `openSheet` em Franchises.jsx

### Task 1.1: Adicionar abertura automática do detail sheet via query param

**Files:**
- Modify: `src/pages/Franchises.jsx` (adicionar useSearchParams + useEffect)

**Contexto:** Hoje o sheet abre via `setSelectedFranchise(franchise)` no clique do card (linha 725). Precisa também abrir quando chega na rota com `?id=<evolution_instance_id>&openSheet=1`. O estado `franchises` já é carregado no mount da página.

- [ ] **Step 1: Importar `useSearchParams` de react-router-dom**

No bloco de imports (perto do topo de `src/pages/Franchises.jsx`), adicionar ou mesclar com o import existente:
```jsx
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Ler query params no componente**

Logo após os outros `useState`/hooks iniciais do componente principal, adicionar:
```jsx
const [searchParams, setSearchParams] = useSearchParams();
```

- [ ] **Step 3: useEffect que abre o sheet quando a lista de franquias carrega**

Adicionar um `useEffect` que roda quando `franchises` muda e existe query param:
```jsx
useEffect(() => {
  const id = searchParams.get("id");
  const openSheet = searchParams.get("openSheet");
  if (!id || openSheet !== "1") return;
  if (!franchises || franchises.length === 0) return;
  const match = franchises.find(
    (f) => f.evolution_instance_id === id || f.id === id
  );
  if (match) {
    setSelectedFranchise(match);
    // Limpa query params para não reabrir em navegação posterior
    setSearchParams({}, { replace: true });
  }
}, [franchises, searchParams, setSearchParams]);
```

Colocar após o useEffect que carrega `franchises`, antes do return.

- [ ] **Step 4: Verificar lint e typecheck**

```bash
npm run lint
npm run typecheck
```
Esperado: nenhum erro novo introduzido.

- [ ] **Step 5: Smoke test manual**

```bash
npm run dev
```
Navegar para `http://localhost:5173/Franchises?id=<evolution_instance_id_existente>&openSheet=1`. Esperado: sheet abre na franquia correta; após fechar, URL está limpa (sem query params). Recarregar a página sem query param: não abre nenhum sheet.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Franchises.jsx
git commit -m "$(cat <<'EOF'
feat(franquias): abrir detail sheet via query param ?id=&openSheet=1

Suporte para navegação programática (ex: clique em linha da tabela
de Relatórios). Query params são limpos após abrir o sheet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Toolbar (filtro de período + busca + export)

### Task 2.1: Criar FranchiseReportToolbar.jsx

**Files:**
- Create: `src/components/reports/FranchiseReportToolbar.jsx`

- [ ] **Step 1: Criar o componente**

```jsx
// src/components/reports/FranchiseReportToolbar.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

const PERIOD_PRESETS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "current_month", label: "Mês atual" },
  { value: "previous_month", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
];

export function computeRange(preset, customStart, customEnd) {
  const today = new Date();
  switch (preset) {
    case "7d":
      return {
        start: format(subDays(today, 6), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "30d":
      return {
        start: format(subDays(today, 29), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "current_month":
      return {
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "previous_month": {
      const prev = subMonths(today, 1);
      return {
        start: format(startOfMonth(prev), "yyyy-MM-dd"),
        end: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    case "custom":
    default:
      return { start: customStart, end: customEnd };
  }
}

export default function FranchiseReportToolbar({
  periodPreset,
  onPeriodPresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchQuery,
  onSearchChange,
  onExport,
  isExportDisabled,
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3 flex-1">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-600">Período</label>
          <Select value={periodPreset} onValueChange={onPeriodPresetChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodPreset === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                max={endDate}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                min={startDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-9"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600">Buscar franquia</label>
          <Input
            placeholder="Digite o nome…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <Button
        onClick={onExport}
        disabled={isExportDisabled}
        variant="outline"
        className="gap-2 h-9 md:self-end"
      >
        <MaterialIcon icon="download" className="text-base" />
        Exportar CSV
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```
Esperado: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/FranchiseReportToolbar.jsx
git commit -m "$(cat <<'EOF'
feat(reports): toolbar com período, busca e export CSV

Componente isolado reutilizável pela nova tabela de Relatórios.
Inclui helper computeRange exportado para uso na página.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: Tabela comparativa

### Task 3.1: Criar FranchiseReportTable.jsx

**Files:**
- Create: `src/components/reports/FranchiseReportTable.jsx`

**Contexto:** Tabela ordenável de 7 colunas. Linha clicável navega para `/Franchises?id=<evo>&openSheet=1` via `useNavigate` de react-router-dom. Empty state quando `rows.length === 0`.

- [ ] **Step 1: Criar o componente**

```jsx
// src/components/reports/FranchiseReportTable.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";

const COLUMNS = [
  { key: "name", label: "Franquia", sortable: true, align: "left", sticky: true },
  { key: "revenue", label: "Receita", sortable: true, align: "right" },
  { key: "ordersCount", label: "Pedidos", sortable: true, align: "right" },
  { key: "avgTicket", label: "Ticket médio", sortable: true, align: "right" },
  { key: "botConversion", label: "Conversão bot", sortable: true, align: "right" },
  { key: "newCustomers", label: "Novos clientes", sortable: true, align: "right" },
  { key: "subscription", label: "Assinatura", sortable: false, align: "center" },
];

const SUB_STATUS_BADGE = {
  PAID: { label: "Pago", className: "bg-green-100 text-green-800" },
  RECEIVED: { label: "Pago", className: "bg-green-100 text-green-800" },
  CONFIRMED: { label: "Pago", className: "bg-green-100 text-green-800" },
  PENDING: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  OVERDUE: { label: "Vencido", className: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelada", className: "bg-gray-100 text-gray-700" },
};

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function SortIcon({ direction }) {
  if (!direction) return <MaterialIcon icon="unfold_more" className="text-sm opacity-40" />;
  return (
    <MaterialIcon
      icon={direction === "asc" ? "arrow_upward" : "arrow_downward"}
      className="text-sm"
    />
  );
}

export default function FranchiseReportTable({ rows, isLoading }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    if (!rows) return [];
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // nulls/undefined vão pro fim
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv, "pt-BR") : bv.localeCompare(av, "pt-BR");
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleRowClick = (row) => {
    if (!row.evolutionInstanceId) return;
    navigate(`/Franchises?id=${encodeURIComponent(row.evolutionInstanceId)}&openSheet=1`);
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <MaterialIcon icon="inbox" className="text-4xl text-gray-300" />
        <p className="text-sm text-gray-600 mt-2">Sem vendas no período selecionado</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={[
                  col.sortable ? "cursor-pointer select-none" : "",
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  col.sticky ? "sticky left-0 bg-white z-10" : "",
                  "whitespace-nowrap",
                ].filter(Boolean).join(" ")}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const subInfo = SUB_STATUS_BADGE[row.subscriptionStatus] || {
              label: "Aguardando",
              className: "bg-yellow-100 text-yellow-800",
            };
            return (
              <TableRow
                key={row.evolutionInstanceId || row.id}
                onClick={() => handleRowClick(row)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <TableCell className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">
                  {row.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(row.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.ordersCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ordersCount > 0 ? formatBRL(row.avgTicket) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.botConversion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.newCustomers}</TableCell>
                <TableCell className="text-center">
                  <Badge className={subInfo.className}>{subInfo.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```
Esperado: sem erros novos. Se lint reclamar de `tabular-nums` (utility Tailwind), confirmar que já está disponível no `tailwind.config.js` — é utility padrão, está.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/FranchiseReportTable.jsx
git commit -m "$(cat <<'EOF'
feat(reports): tabela comparativa por franquia (7 colunas ordenáveis)

Linha clicável navega para detail sheet da franquia em /Franchises.
Coluna Franquia com position:sticky para scroll horizontal mobile.
Empty state e skeleton loading.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Refatorar Reports.jsx

### Task 4.1: Atualizar queries (6 fontes, entity adapter)

**Files:**
- Modify: `src/pages/Reports.jsx` (linhas 1–123: imports + loadAllData)

**Contexto:** Manter estrutura de `mountedRef`, `abortControllerRef`, `loadAllData` com `Promise.allSettled`. Trocar queries: remover DailyUniqueContact, DailySummary, User; adicionar BotConversation, SystemSubscription. Guardar raw por fonte.

- [ ] **Step 1: Substituir imports no topo do arquivo**

Substituir o import das entities na linha 2:
```jsx
import {
  Franchise,
  Sale,
  Contact,
  FranchiseConfiguration,
  BotConversation,
  SystemSubscription,
} from "@/entities/all";
```

Remover imports de componentes antigos (linhas 10-16):
- `import KpiCards`
- `import SalesRevenueChart`
- `import PaymentMethodChart`
- `import FranchiseRankingChart`
- `import FranchiseComparisonTable`
- `import ExportButton`

Adicionar imports novos:
```jsx
import FranchiseReportTable from "../components/reports/FranchiseReportTable";
import FranchiseReportToolbar, { computeRange } from "../components/reports/FranchiseReportToolbar";
import { sanitizeCSVCell } from "@/lib/csvSanitize";
import { toast } from "sonner";
import { buildConfigMap } from "@/lib/franchiseUtils";
```
(remover duplicatas se `toast`/`buildConfigMap` já existirem).

- [ ] **Step 2: Enxugar useState (remover os que não são mais usados)**

No componente `ReportsContent`, manter apenas:
```jsx
const [franchises, setFranchises] = useState([]);
const [configMap, setConfigMap] = useState({});
const [rawSales, setRawSales] = useState([]);
const [rawContacts, setRawContacts] = useState([]);
const [rawBotConversations, setRawBotConversations] = useState([]);
const [rawSubscriptions, setRawSubscriptions] = useState([]);
const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState(null);
const [searchQuery, setSearchQuery] = useState("");
const [periodPreset, setPeriodPreset] = useState("30d");
const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
const mountedRef = useRef(true);
const abortControllerRef = useRef(null);
```

Remover `selectedFranchise`, `dailyContacts`, `summaries`, `rawDailyContacts`, `rawSummaries`, `currentUser`, `contacts`, `sales`.

- [ ] **Step 3: Substituir loadAllData pela versão enxuta**

```jsx
const loadAllData = async () => {
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;
  const { signal } = controller;

  setIsLoading(true);
  setLoadError(null);

  try {
    const results = await Promise.allSettled([
      Franchise.list(null, null, { signal }),
      FranchiseConfiguration.list(null, null, {
        columns: "franchise_evolution_instance_id, franchise_name",
        signal,
      }),
      Sale.list("-sale_date", null, {
        fetchAll: true,
        filter: `sale_date=gte.${startDate}&sale_date=lte.${endDate}`,
        signal,
      }),
      Contact.list("-created_at", null, {
        fetchAll: true,
        filter: `created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59.999`,
        signal,
      }),
      BotConversation.list("-started_at", null, {
        fetchAll: true,
        columns: "franchise_id, outcome, started_at",
        filter: `started_at=gte.${startDate}T00:00:00&started_at=lte.${endDate}T23:59:59.999`,
        signal,
      }),
      SystemSubscription.list(null, null, {
        columns: "franchise_id, current_payment_status, subscription_status",
        signal,
      }),
    ]);

    if (!mountedRef.current || signal.aborted) return;

    const getValue = (r, fallback = []) =>
      r.status === "fulfilled" && r.value ? r.value : fallback;

    const franchisesData = getValue(results[0]);
    const configsData = getValue(results[1]);
    const salesData = getValue(results[2]);
    const contactsData = getValue(results[3]);
    const botData = getValue(results[4]);
    const subsData = getValue(results[5]);

    setFranchises(franchisesData);
    setConfigMap(buildConfigMap(configsData));
    setRawSales(salesData);
    setRawContacts(contactsData);
    setRawBotConversations(botData);
    setRawSubscriptions(subsData);
  } catch (err) {
    if (!signal.aborted && mountedRef.current) {
      setLoadError(err?.message || "Erro ao carregar dados");
      toast.error("Não foi possível carregar os relatórios");
    }
  } finally {
    if (mountedRef.current && !signal.aborted) setIsLoading(false);
  }
};
```

- [ ] **Step 4: Recarregar quando período muda**

Substituir o useEffect de mount para incluir `startDate` e `endDate`:
```jsx
useEffect(() => {
  mountedRef.current = true;
  loadAllData();
  return () => {
    mountedRef.current = false;
    abortControllerRef.current?.abort();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [startDate, endDate]);
```

- [ ] **Step 5: Sincronizar preset → datas**

Adicionar handler para preset:
```jsx
const handlePresetChange = (preset) => {
  setPeriodPreset(preset);
  if (preset === "custom") return;
  const { start, end } = computeRange(preset, startDate, endDate);
  setStartDate(start);
  setEndDate(end);
};
```

- [ ] **Step 6: Lint + typecheck (ainda vai haver erro no render — ok, próxima task resolve)**

```bash
npm run lint
```
Nesta etapa, JSX pode estar quebrado porque os componentes antigos ainda estão sendo renderizados. Tolerável — resolve na Task 4.2. Mas rode pra garantir que o JS puro antes do return está OK.

### Task 4.2: Construir rows + substituir JSX do return

- [ ] **Step 1: Adicionar useMemo de rows**

Antes do return:
```jsx
const rows = useMemo(() => {
  if (!franchises.length) return [];

  // Agrupar por franchise_id (evolution_instance_id)
  const byFranchise = new Map();
  for (const f of franchises) {
    const evo = f.evolution_instance_id;
    if (!evo) continue;
    byFranchise.set(evo, {
      id: f.id,
      evolutionInstanceId: evo,
      name: configMap[evo]?.franchise_name || f.name || "—",
      revenue: 0,
      ordersCount: 0,
      avgTicket: 0,
      botTotal: 0,
      botConverted: 0,
      botConversion: null,
      newCustomers: 0,
      subscriptionStatus: null,
    });
  }

  for (const s of rawSales) {
    const row = byFranchise.get(s.franchise_id);
    if (!row) continue;
    const value = Number(s.value || 0);
    const discount = Number(s.discount_amount || 0);
    const delivery = Number(s.delivery_fee || 0);
    row.revenue += value - discount + delivery;
    row.ordersCount += 1;
  }

  for (const c of rawContacts) {
    const row = byFranchise.get(c.franchise_id);
    if (!row) continue;
    row.newCustomers += 1;
  }

  for (const b of rawBotConversations) {
    const row = byFranchise.get(b.franchise_id);
    if (!row) continue;
    row.botTotal += 1;
    if (b.outcome === "converted") row.botConverted += 1;
  }

  for (const sub of rawSubscriptions) {
    const row = byFranchise.get(sub.franchise_id);
    if (!row) continue;
    row.subscriptionStatus =
      sub.subscription_status === "CANCELLED"
        ? "CANCELLED"
        : sub.current_payment_status || null;
  }

  const out = [];
  for (const row of byFranchise.values()) {
    row.avgTicket = row.ordersCount > 0 ? row.revenue / row.ordersCount : 0;
    row.botConversion = row.botTotal > 0 ? row.botConverted / row.botTotal : null;
    out.push(row);
  }

  // Filtro de busca
  const q = searchQuery.trim().toLowerCase();
  if (!q) return out;
  return out.filter((r) => r.name.toLowerCase().includes(q));
}, [franchises, configMap, rawSales, rawContacts, rawBotConversations, rawSubscriptions, searchQuery]);
```

- [ ] **Step 2: Export CSV handler**

```jsx
const handleExport = () => {
  if (!rows.length) return;
  const headers = [
    "Franquia",
    "Receita",
    "Pedidos",
    "Ticket médio",
    "Conversão bot",
    "Novos clientes",
    "Assinatura",
  ];
  const body = rows.map((r) => [
    sanitizeCSVCell(r.name),
    r.revenue.toFixed(2).replace(".", ","),
    r.ordersCount,
    r.ordersCount > 0 ? r.avgTicket.toFixed(2).replace(".", ",") : "",
    r.botConversion == null ? "" : (r.botConversion * 100).toFixed(1).replace(".", ",") + "%",
    r.newCustomers,
    sanitizeCSVCell(r.subscriptionStatus || "Aguardando"),
  ]);
  const csv =
    "\uFEFF" + [headers, ...body].map((line) => line.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorios-franquias-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 3: Substituir JSX do return**

Trocar todo o return por:
```jsx
return (
  <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 space-y-4">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d]">
        Relatórios
      </h1>
      <p className="text-sm text-gray-600">
        Visão cruzada por franquia — clique em uma linha para abrir os detalhes.
      </p>
    </div>

    <FranchiseReportToolbar
      periodPreset={periodPreset}
      onPeriodPresetChange={handlePresetChange}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onExport={handleExport}
      isExportDisabled={isLoading || rows.length === 0}
    />

    {loadError && !isLoading && (
      <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 flex items-center justify-between">
        <span>Erro: {loadError}</span>
        <button
          onClick={loadAllData}
          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    )}

    <FranchiseReportTable rows={rows} isLoading={isLoading} />
  </div>
);
```

- [ ] **Step 4: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```
Esperado: sem erros novos. Se der erro "X is defined but never used" nos estados removidos, confirme que foram apagados.

- [ ] **Step 5: Smoke test manual**

```bash
npm run dev
```
Ir para `/Reports` (ainda oculto na sidebar — mas rota funciona via URL): verificar que página renderiza, filtros funcionam (30d default, mudar pra 7d deve recarregar), busca filtra linhas, export baixa CSV válido, clicar em uma linha abre detail sheet em `/Franchises`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Reports.jsx
git commit -m "$(cat <<'EOF'
feat(reports): refatorar página para tabela comparativa

Queries 8 → 6 via entity adapter (Franchise, FranchiseConfiguration,
Sale, Contact, BotConversation, SystemSubscription). Remove KpiCards,
gráficos e FranchiseComparisonTable. Constrói rows por franchise_id,
filtro de período recarrega dados, busca e export CSV client-side.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 5: Sidebar + cleanup

### Task 5.1: Mover Relatórios para sidebar visível

**Files:**
- Modify: `src/Layout.jsx:80-85` (remover `adminSidebarHidden`)

- [ ] **Step 1: Editar o item Relatórios**

Na definição do item de sidebar (por volta da linha 80), remover `adminSidebarHidden: true`. Conferir que o ícone já está definido (se não, adicionar `icon: "assessment"`).

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```
Logar como admin: "Relatórios" aparece na sidebar. Logar como franqueado (outro perfil): "Relatórios" NÃO aparece. Logar como manager: aparece.

- [ ] **Step 4: Commit**

```bash
git add src/Layout.jsx
git commit -m "$(cat <<'EOF'
feat(sidebar): voltar Relatórios à sidebar admin/manager

Remove adminSidebarHidden do item Relatórios. Franqueado continua
sem acesso (já filtrado pela regra de role da sidebar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5.2: Remover componentes obsoletos

**Files:**
- Delete: `src/components/reports/KpiCards.jsx`
- Delete: `src/components/reports/SalesRevenueChart.jsx`
- Delete: `src/components/reports/PaymentMethodChart.jsx`
- Delete: `src/components/reports/FranchiseRankingChart.jsx`
- Delete: `src/components/reports/FranchiseComparisonTable.jsx`
- Delete: `src/components/reports/ExportButton.jsx`

- [ ] **Step 1: Grep antes de deletar — confirmar 0 usos fora de Reports.jsx**

Use Grep do Claude (ou `grep -rn`) para cada componente. Para cada um, esperado: 0 matches fora de `src/pages/Reports.jsx` (que já não os importa após Task 4.1). Se aparecer algum import em outro lugar, PARAR e investigar — não deletar.

```
Grep: "KpiCards" em src/
Grep: "SalesRevenueChart" em src/
Grep: "PaymentMethodChart" em src/
Grep: "FranchiseRankingChart" em src/
Grep: "FranchiseComparisonTable" em src/
Grep: "ExportButton" em src/components/reports
```

- [ ] **Step 2: Deletar os arquivos**

```bash
rm src/components/reports/KpiCards.jsx
rm src/components/reports/SalesRevenueChart.jsx
rm src/components/reports/PaymentMethodChart.jsx
rm src/components/reports/FranchiseRankingChart.jsx
rm src/components/reports/FranchiseComparisonTable.jsx
rm src/components/reports/ExportButton.jsx
```

- [ ] **Step 3: Build pra verificar que nada quebrou**

```bash
npm run build
```
Esperado: build completa sem erros. Se houver "Could not resolve X", algum import remanescente — reverter delete, investigar, voltar ao Step 1.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/reports/
git commit -m "$(cat <<'EOF'
chore(reports): remover componentes obsoletos

KpiCards, SalesRevenueChart, PaymentMethodChart, FranchiseRankingChart,
FranchiseComparisonTable, ExportButton — todos substituídos pela
nova tabela comparativa em Reports.jsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 6: Smoke test final + critérios de aceite

### Task 6.1: Verificação end-to-end

- [ ] **Step 1: Dev server + roteiro de teste manual**

```bash
npm run dev
```

Executar cada item dos critérios de aceite do spec:
1. [ ] Admin vê "Relatórios" na sidebar
2. [ ] Manager vê "Relatórios" na sidebar (se você tem conta manager para testar)
3. [ ] Franqueado NÃO vê Relatórios (testar logando como franqueado)
4. [ ] Filtro de período atualiza toda a tabela (trocar 30d → 7d → Mês anterior → Custom)
5. [ ] Ordenação por cada coluna funciona (clique asc/desc)
6. [ ] Clique em linha abre detail sheet na página Franquias com a franquia correta
7. [ ] Export CSV abre no Excel com acentos corretos (ç, ã) e valores numéricos
8. [ ] 7 colunas exibem ou mostram "—" quando apropriado (franquia sem bot → conversão "—")
9. [ ] Loading mostra skeleton (F5 na página); vazio mostra mensagem; erro (desconectar wifi e F5) mostra retry
10. [ ] AdminDashboard continua funcionando (regressão check — abrir `/AdminDashboard`, conferir que carrega)

- [ ] **Step 2: Build final**

```bash
npm run build
```
Confirmar build limpo, sem warnings novos.

- [ ] **Step 3: Se algo falhou**

Voltar à task correspondente e corrigir. Só fechar o chunk quando todos os critérios passarem.

- [ ] **Step 4: Commit de fechamento (se houve fixes)**

Apenas se houve correções no Step 3. Caso contrário, pular.

---

## Execution Handoff

Plano pronto. Execução recomendada:
- **Com subagents:** `superpowers:subagent-driven-development` (1 subagente por task, fresh context)
- **Sem subagents:** `superpowers:executing-plans` na sessão atual

Qualquer chunk pode ser executado isoladamente desde que os anteriores estejam commitados. Ordem obrigatória: 1 → 2 → 3 → 4 → 5 → 6.
