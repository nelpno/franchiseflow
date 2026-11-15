# Dashboard por Role — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar dashboards diferenciados por role (franqueado vs admin) com navegação condicional, elementos motivacionais e painel de alertas.

**Architecture:** `Dashboard.jsx` vira um router que renderiza `<FranchiseeDashboard />` ou `<AdminDashboard />` baseado em `useAuth().user.role`. Componentes compartilhados (StatsCard, gráficos) são reutilizados. Nova RPC Supabase `get_franchise_ranking` para ranking seguro do franqueado.

**Tech Stack:** React 18, Tailwind CSS, shadcn/ui (Card, Button, Progress, Skeleton, Badge), Recharts, Supabase (RPC), date-fns

**Spec:** `docs/superpowers/specs/2026-03-20-dashboard-por-role-design.md`

**Convenções importantes do projeto:**
- Rotas usam `createPageUrl("PageName")` que gera `"/PageName"` (capitalizado). NUNCA usar paths lowercase.
- `StatsCard` recebe `icon` como **componente React** (ex: `icon={Target}`), NUNCA string.
- `StatsCard` requer prop `trend` (`'up'`, `'down'`, ou `null`) para mostrar seta direcional.
- `DailyChecklist` usa `franchise_id` = `evolution_instance_id`, não o UUID da franquia.
- Entities: usar `InventoryItem` (não `Inventory`).

---

## Chunk 1: Infraestrutura (RPC + navegação)

### Task 1: Criar RPC Supabase `get_franchise_ranking`

**Files:**
- Create: `supabase/ranking-rpc.sql`

- [ ] **Step 1: Escrever SQL da RPC**

```sql
create or replace function get_franchise_ranking(p_date date, p_franchise_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'position', sub.position,
    'total_franchises', sub.total
  ) into result
  from (
    select
      ds.franchise_id,
      rank() over (order by coalesce(ds.sales_value, 0) desc) as position,
      count(*) over () as total
    from daily_summaries ds
    where ds.date = p_date
  ) sub
  where sub.franchise_id = p_franchise_id;

  if result is null then
    select json_build_object(
      'position', null,
      'total_franchises', (select count(*) from franchises where status = 'active')
    ) into result;
  end if;

  return result;
end;
$$;

grant execute on function get_franchise_ranking(date, uuid) to authenticated;
```

- [ ] **Step 2: Executar SQL no Supabase**

Run via Supabase Management API:
```bash
curl -X POST "https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL acima>"}'
```

- [ ] **Step 3: Commit**
```bash
git add supabase/ranking-rpc.sql
git commit -m "feat: add get_franchise_ranking RPC for secure ranking"
```

---

### Task 2: Atualizar navegação por role no Layout

**Files:**
- Modify: `src/Layout.jsx:37-101` (navigationItems array)
- Modify: `src/Layout.jsx:157-166` (filter logic)
- Modify: `src/Layout.jsx:222-237` (quick stats sidebar)

- [ ] **Step 1: Atualizar navigationItems com labels por role e flags**

Em `src/Layout.jsx`, substituir o array `navigationItems` (linhas 37-101).

Mudanças:
- Dashboard: adicionar `franchiseeLabel: "Minha Loja"`, `adminLabel: "Painel Geral"`
- Configurações: adicionar `franchiseeLabel: "Minha Unidade"`
- Relatórios: adicionar `adminOnly: true`
- Catálogo: adicionar `adminOnly: true`
- Marketing: manter sem flag (visível para todos)

**IMPORTANTE:** Manter `createPageUrl()` e os ícones existentes. NÃO trocar os ícones nem as URLs.

```jsx
const navigationItems = [
  {
    title: "Dashboard",
    franchiseeLabel: "Minha Loja",
    adminLabel: "Painel Geral",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    title: "Vendas",
    url: createPageUrl("Sales"),
    icon: TrendingUp,
  },
  {
    title: "Estoque",
    url: createPageUrl("Inventory"),
    icon: Package,
  },
  {
    title: "Catálogo",
    url: createPageUrl("Catalog"),
    icon: ImageIcon,
    adminOnly: true,
  },
  {
    title: "Marketing",
    url: createPageUrl("Marketing"),
    icon: Megaphone,
  },
  {
    title: "Meu Checklist",
    url: createPageUrl("MyChecklist"),
    icon: ClipboardList,
  },
  {
    title: "Relatórios",
    url: createPageUrl("Reports"),
    icon: BarChart3,
    adminOnly: true,
  },
  {
    title: "Configurações",
    franchiseeLabel: "Minha Unidade",
    url: createPageUrl("FranchiseSettings"),
    icon: SlidersHorizontal,
  },
  {
    title: "Onboarding",
    url: createPageUrl("Onboarding"),
    icon: Rocket,
    showOnboarding: true,
  },
  {
    title: "Acompanhamento",
    url: createPageUrl("Acompanhamento"),
    icon: Activity,
    adminOnly: true,
  },
  {
    title: "Franqueados",
    url: createPageUrl("Franchises"),
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Usuários",
    url: createPageUrl("UserManagement"),
    icon: UserCheck,
    adminOnly: true,
  },
];
```

- [ ] **Step 2: Atualizar filter logic para usar labels dinâmicos**

Na lógica de `filteredNavigationItems` (~linhas 157-166), substituir por:

```jsx
const isAdmin = currentUser?.role === 'admin';

const filteredNavigationItems = navigationItems
  .filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.showOnboarding) {
      return isAdmin || !onboardingApproved;
    }
    return true;
  })
  .map((item) => ({
    ...item,
    title: isAdmin
      ? (item.adminLabel || item.title)
      : (item.franchiseeLabel || item.title),
  }));
```

- [ ] **Step 3: Condicionar quick stats do sidebar ao admin**

Na seção de quick stats (~linhas 222-237), envolver com condicional:

```jsx
{isAdmin && (
  <div className="px-4 py-3 border-t">
    {/* ... quick stats existentes ... */}
  </div>
)}
```

E condicionar `loadQuickStats()` no useEffect para só rodar se admin:
```jsx
useEffect(() => {
  if (currentUser?.role === 'admin') {
    loadQuickStats();
  }
}, [currentUser]);
```

- [ ] **Step 4: Commit**
```bash
git add src/Layout.jsx
git commit -m "feat: role-based navigation with dynamic labels"
```

---

### Task 3: Proteger rotas admin-only

**Files:**
- Modify: `src/App.jsx` (adicionar guard de rota)

- [ ] **Step 1: Adicionar redirect para rotas admin-only**

No `src/App.jsx`, criar um componente wrapper `AdminRoute` que redireciona franqueado para `/Dashboard`:

```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin') {
    return <Navigate to="/Dashboard" replace />;
  }
  return children;
}
```

Envolver as rotas admin-only com este wrapper: `Reports`, `Catalog`, `Acompanhamento`, `Franchises`, `UserManagement`.

- [ ] **Step 2: Commit**
```bash
git add src/App.jsx
git commit -m "feat: protect admin-only routes with redirect guard"
```

---

## Chunk 2: Dashboard do Franqueado

### Task 4: Criar componente FranchiseeGreeting

**Files:**
- Create: `src/components/dashboard/FranchiseeGreeting.jsx`

- [ ] **Step 1: Criar componente de saudação**

```jsx
import React from "react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function FranchiseeGreeting({ userName, franchiseName }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {getGreeting()}, {userName?.split(" ")[0] || "Franqueado"}!
      </h1>
      {franchiseName && (
        <p className="text-sm text-gray-500 mt-1">{franchiseName}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/FranchiseeGreeting.jsx
git commit -m "feat: add FranchiseeGreeting component"
```

---

### Task 5: Criar componente DailyGoalProgress

**Files:**
- Create: `src/components/dashboard/DailyGoalProgress.jsx`

- [ ] **Step 1: Criar componente de meta diária**

Recebe `dailyGoal` já calculado (NÃO recalcula internamente — cálculo centralizado no dashboard pai).

```jsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

export default function DailyGoalProgress({ todayRevenue, dailyGoal }) {
  if (dailyGoal === null || dailyGoal <= 0) return null;

  const revenue = todayRevenue || 0;
  const percentage = Math.min(Math.round((revenue / dailyGoal) * 100), 100);
  const remaining = dailyGoal - revenue;
  const exceeded = revenue >= dailyGoal;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-gray-700">Meta do Dia</span>
        </div>
        <Progress value={percentage} className="h-3 mb-2" />
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">
            R$ {revenue.toLocaleString("pt-BR")} / R$ {dailyGoal.toLocaleString("pt-BR")}
          </span>
          <span className={`text-sm font-medium ${exceeded ? "text-emerald-600" : "text-gray-500"}`}>
            {exceeded
              ? `Meta batida! +R$ ${(revenue - dailyGoal).toLocaleString("pt-BR")}`
              : `Faltam R$ ${remaining.toLocaleString("pt-BR")}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/DailyGoalProgress.jsx
git commit -m "feat: add DailyGoalProgress component"
```

---

### Task 6: Criar componente QuickAccessCards

**Files:**
- Create: `src/components/dashboard/QuickAccessCards.jsx`

- [ ] **Step 1: Criar componente de acesso rápido**

```jsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, CheckSquare, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickAccessCards({ lowStockCount, checklistDone, checklistTotal }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(createPageUrl("Inventory"))}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Estoque</span>
          </div>
          {lowStockCount > 0 ? (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {lowStockCount} {lowStockCount === 1 ? "item baixo" : "itens baixos"}
              </span>
            </div>
          ) : (
            <span className="text-sm text-emerald-600 font-medium">Tudo em dia</span>
          )}
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(createPageUrl("MyChecklist"))}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Checklist</span>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {checklistDone}/{checklistTotal} feito
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/QuickAccessCards.jsx
git commit -m "feat: add QuickAccessCards component"
```

---

### Task 7: Criar componente RankingStreak

**Files:**
- Create: `src/components/dashboard/RankingStreak.jsx`

- [ ] **Step 1: Criar componente de ranking e sequência**

```jsx
import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame } from "lucide-react";

export default function RankingStreak({ ranking, summaries, franchiseId, dailyGoal }) {
  const streak = useMemo(() => {
    if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;

    const franchiseDays = summaries
      .filter((s) => s.franchise_id === franchiseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let count = 0;
    for (const day of franchiseDays) {
      if ((day.sales_value || 0) >= dailyGoal) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [summaries, franchiseId, dailyGoal]);

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-amber-500" />
          {ranking?.position ? (
            <span className="text-sm text-gray-700">
              <span className="font-bold text-gray-900">{ranking.position}º</span> de {ranking.total_franchises} franquias
            </span>
          ) : (
            <span className="text-sm text-gray-400">Sem dados hoje</span>
          )}
        </div>

        {dailyGoal && (
          <div className="flex items-center gap-3">
            <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-500" : "text-gray-300"}`} />
            <span className="text-sm text-gray-700">
              {streak > 0
                ? <><span className="font-bold text-gray-900">{streak}</span> {streak === 1 ? "dia" : "dias"} batendo meta</>
                : "Comece hoje!"
              }
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/RankingStreak.jsx
git commit -m "feat: add RankingStreak component"
```

---

### Task 8: Criar FranchiseeDashboard

**Files:**
- Create: `src/components/dashboard/FranchiseeDashboard.jsx`

- [ ] **Step 1: Criar o dashboard completo do franqueado**

**NOTAS IMPORTANTES:**
- `today`/`yesterday` são calculados via `useMemo` para evitar re-renders infinitos
- StatsCard recebe `icon` como componente React e `trend` calculado
- Cálculo da meta diária é centralizado aqui (passado para DailyGoalProgress e RankingStreak)
- Usa `franchise.city` para o nome da unidade (não `owner_name`)
- Navegação para vendas usa `createPageUrl("Sales")`

```jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, Franchise, DailyChecklist, InventoryItem } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, DollarSign } from "lucide-react";
import { createPageUrl } from "@/utils";
import StatsCard from "./StatsCard";
import FranchiseeGreeting from "./FranchiseeGreeting";
import DailyGoalProgress from "./DailyGoalProgress";
import QuickAccessCards from "./QuickAccessCards";
import RankingStreak from "./RankingStreak";

export default function FranchiseeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [franchise, setFranchise] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [checklistProgress, setChecklistProgress] = useState({ done: 0, total: 0 });

  // Memoizar datas para evitar re-renders infinitos no useCallback
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterday = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);

  const franchiseId = user?.managed_franchise_ids?.[0];

  const loadData = useCallback(async () => {
    if (!franchiseId) return;
    setIsLoading(true);
    try {
      const franchises = await Franchise.list();
      const myFranchise = franchises.find((f) => f.id === franchiseId);
      setFranchise(myFranchise);

      const [
        todaySalesData,
        yesterdaySalesData,
        summariesData,
        inventoryData,
        checklistData,
      ] = await Promise.all([
        Sale.filter({ sale_date: today, franchise_id: franchiseId }),
        Sale.filter({ sale_date: yesterday, franchise_id: franchiseId }),
        DailySummary.list("-date", 365),
        InventoryItem.filter({ franchise_id: franchiseId }),
        myFranchise?.evolution_instance_id
          ? DailyChecklist.filter({ franchise_id: myFranchise.evolution_instance_id, date: today })
          : Promise.resolve([]),
      ]);

      setTodaySales(todaySalesData);
      setYesterdaySales(yesterdaySalesData);
      setSummaries(summariesData);

      // Estoque baixo (< 5 unidades)
      setLowStockCount(inventoryData.filter((i) => (i.quantity || 0) < 5).length);

      // Checklist progress
      if (checklistData.length > 0) {
        const tasks = checklistData[0].tasks || [];
        setChecklistProgress({
          done: tasks.filter((t) => t.completed).length,
          total: tasks.length,
        });
      }

      // Ranking via RPC
      try {
        const { data: rankData } = await supabase.rpc("get_franchise_ranking", {
          p_date: today,
          p_franchise_id: franchiseId,
        });
        setRanking(rankData);
      } catch {
        setRanking(null);
      }
    } catch (err) {
      console.error("Error loading franchisee dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [franchiseId, today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Cálculos
  const todaySalesCount = todaySales.length;
  const yesterdaySalesCount = yesterdaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);

  // Meta diária centralizada (média 30d * 1.10)
  const dailyGoal = useMemo(() => {
    if (!summaries.length || !franchiseId) return null;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const recentDays = summaries.filter((s) => {
      if (s.franchise_id !== franchiseId) return false;
      const d = new Date(s.date);
      return d >= thirtyDaysAgo && d < now;
    });
    if (recentDays.length < 7) return null;
    const totalRevenue = recentDays.reduce((sum, s) => sum + (s.sales_value || 0), 0);
    return Math.round((totalRevenue / recentDays.length) * 1.10);
  }, [summaries, franchiseId]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <FranchiseeGreeting
        userName={user?.full_name}
        franchiseName={franchise ? `Unidade ${franchise.city}` : null}
      />

      {/* Stats: Vendas + Faturamento */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatsCard
          title="Vendas Hoje"
          value={todaySalesCount}
          previousValue={yesterdaySalesCount}
          icon={Target}
          trend={todaySalesCount > yesterdaySalesCount ? 'up' : todaySalesCount < yesterdaySalesCount ? 'down' : null}
          color="emerald"
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${todayRevenue.toFixed(2)}`}
          previousValue={yesterdayRevenue}
          icon={DollarSign}
          trend={todayRevenue > yesterdayRevenue ? 'up' : todayRevenue < yesterdayRevenue ? 'down' : null}
          color="green"
          isValue
        />
      </div>

      {/* Meta do Dia */}
      <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />

      {/* Acesso Rápido: Estoque + Checklist */}
      <QuickAccessCards
        lowStockCount={lowStockCount}
        checklistDone={checklistProgress.done}
        checklistTotal={checklistProgress.total}
      />

      {/* Ranking + Streak */}
      <RankingStreak
        ranking={ranking}
        summaries={summaries}
        franchiseId={franchiseId}
        dailyGoal={dailyGoal}
      />

      {/* Botão Registrar Venda */}
      <Button
        onClick={() => navigate(createPageUrl("Sales"))}
        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-medium"
      >
        <Plus className="h-5 w-5 mr-2" />
        Registrar Venda
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/FranchiseeDashboard.jsx
git commit -m "feat: add FranchiseeDashboard with goal, ranking, streak"
```

---

## Chunk 3: Dashboard do Admin

### Task 9: Criar componente AlertsPanel

**Files:**
- Create: `src/components/dashboard/AlertsPanel.jsx`

- [ ] **Step 1: Criar componente de alertas**

```jsx
import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { subDays } from "date-fns";

const LEVEL_ORDER = { red: 0, yellow: 1 };

export default function AlertsPanel({ franchises, summaries, inventoryByFranchise, checklistByFranchise }) {
  const alerts = useMemo(() => {
    const result = [];
    const twoDaysAgo = subDays(new Date(), 2);

    for (const franchise of franchises) {
      const fName = franchise.city || franchise.owner_name || "Franquia";

      // Sem vendas há 2+ dias
      const franchiseSummaries = summaries
        .filter((s) => s.franchise_id === franchise.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const lastSaleDay = franchiseSummaries.find((s) => (s.sales_count || 0) > 0);
      if (!lastSaleDay || new Date(lastSaleDay.date) < twoDaysAgo) {
        const days = lastSaleDay
          ? Math.floor((new Date() - new Date(lastSaleDay.date)) / 86400000)
          : "?";
        result.push({ level: "red", message: `${fName} — sem vendas há ${days} dias` });
      }

      // Estoque
      const inventory = inventoryByFranchise?.[franchise.id] || [];
      const zeroStock = inventory.filter((i) => (i.quantity || 0) === 0);
      const lowStock = inventory.filter((i) => (i.quantity || 0) > 0 && (i.quantity || 0) < 5);

      if (zeroStock.length > 0) {
        result.push({ level: "red", message: `${fName} — ${zeroStock.length} item(ns) zerado(s) no estoque` });
      }
      if (lowStock.length > 0) {
        result.push({ level: "yellow", message: `${fName} — ${lowStock.length} item(ns) com estoque baixo` });
      }

      // Checklist não feito
      if (!checklistByFranchise?.[franchise.id]) {
        result.push({ level: "yellow", message: `${fName} — checklist não feito hoje` });
      }
    }

    return result.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [franchises, summaries, inventoryByFranchise, checklistByFranchise]);

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className={`h-4 w-4 ${alerts.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
          <span className="text-sm font-medium text-gray-700">
            {alerts.length > 0 ? `Atenção (${alerts.length})` : "Tudo em dia"}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Todas as franquias operando normalmente</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                  alert.level === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  alert.level === "red" ? "bg-red-500" : "bg-amber-500"
                }`} />
                {alert.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/AlertsPanel.jsx
git commit -m "feat: add AlertsPanel with red/yellow severity levels"
```

---

### Task 10: Criar componente FranchiseRanking

**Files:**
- Create: `src/components/dashboard/FranchiseRanking.jsx`

- [ ] **Step 1: Criar componente de ranking visual**

```jsx
import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { format } from "date-fns";

const MEDAL_COLORS = ["text-amber-500", "text-gray-400", "text-amber-700"];
const BAR_COLORS = ["bg-amber-500", "bg-gray-400", "bg-amber-700"];

export default function FranchiseRanking({ franchises, summaries, isLoading }) {
  const rankedFranchises = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todaySummaries = summaries.filter((s) => s.date === today);

    const ranked = franchises.map((f) => {
      const summary = todaySummaries.find((s) => s.franchise_id === f.id);
      return {
        id: f.id,
        name: f.city || f.owner_name || "Franquia",
        revenue: summary?.sales_value || 0,
      };
    });

    return ranked.sort((a, b) => b.revenue - a.revenue);
  }, [franchises, summaries]);

  const maxRevenue = rankedFranchises[0]?.revenue || 1;

  if (isLoading || rankedFranchises.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Ranking do Dia</span>
        </div>

        <div className="space-y-3">
          {rankedFranchises.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3">
              <span className={`text-sm font-bold w-6 ${i < 3 ? MEDAL_COLORS[i] : "text-gray-400"}`}>
                {i + 1}º
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 truncate">{f.name}</span>
                  <span className="text-sm font-bold text-gray-900 ml-2">
                    R$ {f.revenue.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${i < 3 ? BAR_COLORS[i] : "bg-blue-400"}`}
                    style={{ width: `${Math.max((f.revenue / maxRevenue) * 100, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/FranchiseRanking.jsx
git commit -m "feat: add FranchiseRanking with visual progress bars"
```

---

### Task 11: Criar componente AdminHeader

**Files:**
- Create: `src/components/dashboard/AdminHeader.jsx`

- [ ] **Step 1: Criar header com filtro de período**

```jsx
import React from "react";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export default function AdminHeader({ period, onPeriodChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
          <LayoutDashboard className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Geral</h1>
          <p className="text-sm text-gray-500">Maxi Massas — Todas as Franquias</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onPeriodChange(p.value)}
            className={period === p.value ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/AdminHeader.jsx
git commit -m "feat: add AdminHeader with period filter toggle"
```

---

### Task 12: Adaptar gráficos existentes para aceitar filtro de período

**Files:**
- Modify: `src/components/dashboard/DailyRevenueChart.jsx`
- Modify: `src/components/dashboard/MessagesTrend.jsx`

- [ ] **Step 1: Adicionar prop `days` ao DailyRevenueChart**

Adicionar prop `days` (default 7) para controlar quantos dias o gráfico mostra. Alterar a lógica de filtragem de `last7Days` para `lastNDays` baseado na prop.

Na função que filtra os últimos 7 dias, trocar o hardcoded `7` por `days`:

```jsx
// Antes:
const last7Days = ...
// Depois:
export default function DailyRevenueChart({ summaries, isLoading, days = 7 }) {
  // usar `days` em vez de 7 na filtragem
```

- [ ] **Step 2: Fazer o mesmo no MessagesTrend**

Mesma mudança: adicionar prop `days` com default 7.

- [ ] **Step 3: Commit**
```bash
git add src/components/dashboard/DailyRevenueChart.jsx src/components/dashboard/MessagesTrend.jsx
git commit -m "feat: add days prop to charts for period filtering"
```

---

### Task 13: Criar AdminDashboard

**Files:**
- Create: `src/components/dashboard/AdminDashboard.jsx`

- [ ] **Step 1: Criar o dashboard completo do admin**

**NOTAS IMPORTANTES:**
- `today`/`yesterday` via `useMemo` (sem re-render infinito)
- StatsCard recebe ícone como componente + trend calculado
- Gráficos recebem `days` baseado no período
- Checklist busca por `evolution_instance_id`, mas indexa por `franchise.id`

```jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Franchise, DailySummary, Sale, DailyUniqueContact, InventoryItem, DailyChecklist } from "@/entities/all";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, TrendingUp, Users, Target } from "lucide-react";
import StatsCard from "./StatsCard";
import AdminHeader from "./AdminHeader";
import AlertsPanel from "./AlertsPanel";
import FranchiseRanking from "./FranchiseRanking";
import DailyRevenueChart from "./DailyRevenueChart";
import MessagesTrend from "./MessagesTrend";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [todayContacts, setTodayContacts] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [yesterdayContacts, setYesterdayContacts] = useState([]);
  const [inventoryByFranchise, setInventoryByFranchise] = useState({});
  const [checklistByFranchise, setChecklistByFranchise] = useState({});

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterday = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        franchiseData,
        summaryData,
        todayContactData,
        yesterdayContactData,
        todaySaleData,
        yesterdaySaleData,
      ] = await Promise.all([
        Franchise.list("city"),
        DailySummary.list("-date", 365),
        DailyUniqueContact.filter({ date: today }),
        DailyUniqueContact.filter({ date: yesterday }),
        Sale.filter({ sale_date: today }),
        Sale.filter({ sale_date: yesterday }),
      ]);

      setFranchises(franchiseData);
      setSummaries(summaryData);
      setTodayContacts(todayContactData);
      setYesterdayContacts(yesterdayContactData);
      setTodaySales(todaySaleData);
      setYesterdaySales(yesterdaySaleData);

      // Estoque e checklist por franquia (para alertas)
      const inventoryMap = {};
      const checklistMap = {};
      await Promise.all(
        franchiseData.map(async (f) => {
          const [inv, cl] = await Promise.all([
            InventoryItem.filter({ franchise_id: f.id }),
            f.evolution_instance_id
              ? DailyChecklist.filter({ franchise_id: f.evolution_instance_id, date: today })
              : Promise.resolve([]),
          ]);
          inventoryMap[f.id] = inv;
          if (cl.length > 0) checklistMap[f.id] = cl[0];
        })
      );
      setInventoryByFranchise(inventoryMap);
      setChecklistByFranchise(checklistMap);
    } catch (err) {
      console.error("Error loading admin dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Stats baseados no período selecionado
  const stats = useMemo(() => {
    if (period === "today") {
      const salesCount = todaySales.length;
      const prevSalesCount = yesterdaySales.length;
      const revenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const prevRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const contacts = todayContacts.length;
      const prevContacts = yesterdayContacts.length;
      const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
      const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
    }

    const days = period === "7d" ? 7 : 30;
    const cutoff = format(subDays(new Date(), days), "yyyy-MM-dd");
    const prevCutoff = format(subDays(new Date(), days * 2), "yyyy-MM-dd");

    const currentPeriod = summaries.filter((s) => s.date >= cutoff);
    const prevPeriod = summaries.filter((s) => s.date >= prevCutoff && s.date < cutoff);

    const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0);

    const salesCount = sum(currentPeriod, "sales_count");
    const prevSalesCount = sum(prevPeriod, "sales_count");
    const revenue = sum(currentPeriod, "sales_value");
    const prevRevenue = sum(prevPeriod, "sales_value");
    const contacts = sum(currentPeriod, "unique_contacts");
    const prevContacts = sum(prevPeriod, "unique_contacts");
    const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
    const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
  }, [period, todaySales, yesterdaySales, todayContacts, yesterdayContacts, summaries]);

  // Número de dias para gráficos
  const chartDays = period === "30d" ? 30 : 7;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" /> <Skeleton className="h-28" />
          <Skeleton className="h-28" /> <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  const trendFor = (current, previous) =>
    current > previous ? 'up' : current < previous ? 'down' : null;

  return (
    <div className="p-6">
      <AdminHeader period={period} onPeriodChange={setPeriod} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Vendas"
          value={stats.salesCount}
          previousValue={stats.prevSalesCount}
          icon={Target}
          trend={trendFor(stats.salesCount, stats.prevSalesCount)}
          color="emerald"
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${stats.revenue.toFixed(2)}`}
          previousValue={stats.prevRevenue}
          icon={TrendingUp}
          trend={trendFor(stats.revenue, stats.prevRevenue)}
          color="green"
          isValue
        />
        <StatsCard
          title="Contatos"
          value={stats.contacts}
          previousValue={stats.prevContacts}
          icon={MessageSquare}
          trend={trendFor(stats.contacts, stats.prevContacts)}
          color="teal"
        />
        <StatsCard
          title="Conversão"
          value={`${stats.conversion}%`}
          previousValue={stats.prevConversion}
          icon={Users}
          trend={trendFor(stats.conversion, stats.prevConversion)}
          color="cyan"
        />
      </div>

      {/* Alertas */}
      <AlertsPanel
        franchises={franchises}
        summaries={summaries}
        inventoryByFranchise={inventoryByFranchise}
        checklistByFranchise={checklistByFranchise}
      />

      {/* Ranking */}
      <FranchiseRanking
        franchises={franchises}
        summaries={summaries}
        isLoading={isLoading}
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyRevenueChart summaries={summaries} isLoading={isLoading} days={chartDays} />
        <MessagesTrend summaries={summaries} isLoading={isLoading} days={chartDays} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/dashboard/AdminDashboard.jsx
git commit -m "feat: add AdminDashboard with alerts, ranking, period filter"
```

---

## Chunk 4: Integração + Finalização

### Task 14: Refatorar Dashboard.jsx como router de role

**Files:**
- Modify: `src/pages/Dashboard.jsx` (reescrever completo)

- [ ] **Step 1: Substituir conteúdo de Dashboard.jsx**

```jsx
import React from "react";
import { useAuth } from "@/lib/AuthContext";
import FranchiseeDashboard from "@/components/dashboard/FranchiseeDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return isAdmin ? <AdminDashboard /> : <FranchiseeDashboard />;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/Dashboard.jsx
git commit -m "refactor: Dashboard.jsx routes to role-specific dashboards"
```

---

### Task 15: Atualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Atualizar seção de UX por Role**

```markdown
## UX por Role
- **Franqueado**: menu com 6 itens (Minha Loja, Vendas, Estoque, Marketing, Checklist, Minha Unidade)
- **Admin**: menu completo (12 itens, incluindo Relatórios, Acompanhamento, Franqueados, Usuários)
- Terminologia simplificada: "Estoque" (não "Inventário"), "Valor Médio" (não "Ticket Médio")
- Dashboard franqueado: motivacional (meta diária, ranking, streak, acesso rápido)
- Dashboard admin: monitoramento (alertas semáforo, ranking franquias, filtro de período)
- Análise UX completa em `docs/analise-ux-completa.md`
- Spec do dashboard por role em `docs/superpowers/specs/2026-03-20-dashboard-por-role-design.md`
- Análise vendedor genérico em `docs/analise-vinculacao-vendedor.md`
```

- [ ] **Step 2: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Sprint 2 role-based UX info"
```

---

### Task 16: Teste integrado no browser

- [ ] **Step 1: Rodar dev server**
```bash
npm run dev
```

- [ ] **Step 2: Testar como admin**
- Login com conta admin
- Menu mostra "Painel Geral" e 12 itens
- Dashboard: 4 stats, alertas, ranking de franquias, gráficos
- Filtro de período (Hoje/7d/30d) altera stats e gráficos
- Sidebar NÃO mostra quick stats

- [ ] **Step 3: Testar como franqueado**
- Login com conta franqueado
- Menu mostra "Minha Loja" e 6 itens (sem Relatórios, Catálogo)
- Dashboard: saudação, 2 stats, meta, estoque+checklist, ranking+streak, botão venda
- Quick stats do sidebar NÃO aparece
- Botão "Registrar Venda" navega para /Sales
- Cards de estoque e checklist navegam para suas páginas
- Tentar acessar `/Reports` diretamente → redireciona para `/Dashboard`

- [ ] **Step 4: Testar mobile**
- Redimensionar para mobile
- Cards empilham em 1 coluna
- Sidebar funciona normalmente

- [ ] **Step 5: Commit final**
```bash
git add -A
git commit -m "Sprint 2: Role-based dashboards (franchisee + admin)"
```

---

### Task 17: Design com Google Stitch (pós-funcional)

- [ ] **Step 1: Gerar design visual com Stitch**

Usar Stitch MCP para gerar layouts polidos para:
- Dashboard do franqueado (mobile-first)
- Dashboard do admin (desktop + mobile)
- Cores: emerald/teal (padrão Maxi Massas)

- [ ] **Step 2: Aplicar estilos gerados pelo Stitch nos componentes**

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "style: apply Stitch design to role-based dashboards"
```
