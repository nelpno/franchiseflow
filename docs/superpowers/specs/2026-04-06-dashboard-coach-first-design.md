# Dashboard Coach-First — Spec de Redesign

## Contexto

O dashboard do franqueado tem 12 seções em scroll vertical com redundâncias (revenue 3x, period comparison duplicada, bot separado e oculto). Features novas (Health Score, Bot Intelligence, Bot Coach) existem no código mas são admin-only ou ocultas por threshold. O franqueado não recebe guidance acionável — apenas dados brutos.

**Objetivo:** transformar o dashboard de "data dump" para "coach ativo" que guia o franqueado com ações específicas, expõe o Health Score (já implementado), e funciona para todos os perfis (ativo, intermediário, iniciante).

## Decisões Aprovadas

| Decisão | Escolha |
|---------|---------|
| Abordagem geral | B — Full Health Score (média complexidade) |
| SaúdeDoNegócioCard | Score Ring Compacto (horizontal, 1 linha) |
| AçãoPrioritária | Inline Compacto (1 aviso por vez, 7 cenários) |
| SmartActions | "Outras Ações" max 4, mistura coach+contatos |
| Período seletor | Hoje / Semana / Mês (labels naturais) |
| Meta do Dia | Manter (funções diferentes do StatsCard) |

## Nova Ordem do Dashboard (10 seções, era 12)

| # | Componente | Status | Arquivo |
|---|-----------|--------|---------|
| 1 | Saudação | Mantém | FranchiseeGreeting (inline) |
| 2 | Seletor: Hoje / Semana / Mês | Altera labels | FranchiseeDashboard.jsx inline |
| 3 | Stats grid (3 cards) | Mantém | StatsCard.jsx |
| 4 | Meta do Dia | Mantém | DailyGoalProgress.jsx |
| 5 | **SaúdeDoNegócioCard** | **NOVO** | `src/components/dashboard/SaudeDoNegocioCard.jsx` |
| 6 | **AçãoPrioritária** | **NOVO** | `src/components/dashboard/PriorityAction.jsx` |
| 7 | Ranking + Streak | Promovido (era 8) | RankingStreak.jsx |
| 8 | Faturamento 7 dias | Demovido (era 6) | MiniRevenueChart.jsx |
| 9 | Marketing | Mantém | MarketingPaymentCard.jsx |
| 10 | Outras Ações (max 4) | Altera | SmartActions.jsx |

### Removidos

| Componente | Motivo |
|-----------|--------|
| BotPerformanceCard | Absorvido pelo SaúdeDoNegócioCard (drill-down abre BotCoachSheet) |
| QuickAccessCards | Dados absorvidos por SaúdeDoNegócioCard (estoque) + PriorityAction (contatos) |
| PeriodComparisonCard | Redundante com trend arrows dos StatsCards |
| Tab "7 dias" / "30 dias" | Substituídos por "Semana" (seg-dom) / "Mês" (calendário) |

## Componentes Novos

### 1. SaúdeDoNegócioCard (`~120 linhas`)

**Layout:** Score Ring Compacto — horizontal, 1 linha.

```
┌──────────────────────────────────────────────┐
│  (72)  Saúde do Negócio [Saudável]           │
│  de100  ⚠️ Foco: 3 produtos zerados          │
│         Ver diagnóstico completo →            │
└──────────────────────────────────────────────┘
```

**Props:**
```js
{
  healthResult,  // retorno de calculateFranchiseHealth()
  onDrillDown,   // abre DiagnosticoSheet
}
```

**Score Ring:** Reutiliza `ProgressRing.jsx` com nova prop `label` (string) para renderizar número no centro em vez de ícone. Cor do ring baseada em `STATUS_COLORS[healthResult.status]`.

**Badge status:** "Saudável" (verde), "Atenção" (amarelo), "Crítico" (vermelho), "Nova" (cinza). Mapeamento direto de `healthResult.status`.

**Frase coaching:** `healthResult.problems[0]` — a primeira dimensão problemática em linguagem humana. Se `problems.length === 0`, mostra "Tudo em dia! Continue assim."

**"Ver diagnóstico completo →":** Abre `DiagnosticoSheet` (Sheet/slide-over) com:
- 4-5 barras de dimensão (vendas, estoque, reposição, setup, bot se disponível)
- Score por dimensão com cor
- Se bot `hasData=true`, seção "Vendedor Digital" com autonomia + "Ver detalhes" → abre `BotCoachSheet` (reutilizado as-is)
- Se bot `hasData=false`, seção "Vendedor Digital" com CTA "Ative seu vendedor" → `/FranchiseSettings`

**Sem bot data no score inicial:** `calculateFranchiseHealth` recebe arrays vazios para `botConversations`, `conversationMessages`, `botSales`. O bot dimension retorna `hasData=false` e é excluído dos pesos (renormalizados entre 4 dimensões). Isso mantém o load principal rápido.

**DiagnosticoSheet:** Estado do Sheet é INTERNO ao SaúdeDoNegócioCard (não precisa de `onDrillDown` prop). O card gerencia `isSheetOpen` internamente via useState.

**Props revisadas:**
```js
{
  healthResult,  // retorno de calculateFranchiseHealth()
  franchise,     // para city name no DiagnosticoSheet header
}
```

### 2. PriorityAction (`~100 linhas`)

**Layout:** Inline compacto — uma linha com ícone + título + métrica + botão CTA.

```
┌──────────────────────────────────────────────┐
│ 📦 Reponha 3 itens zerados      [Repor →]   │
│    8 pedidos perdidos esta semana             │
└──────────────────────────────────────────────┘
```

**Props:**
```js
{
  healthResult,      // do calculateFranchiseHealth
  smartActions,      // do generateSmartActions (array)
  coachActions,      // do generateBotCoachActions (array)
  marketingPayment,  // último MarketingPayment ou null
  franchise,         // para checks de configuração (whatsapp_status)
}
```

**Lógica de priorização (7 cenários, nesta ordem):**

| Prioridade | Cenário | Fonte | Cor | CTA | Navega para |
|---|---|---|---|---|---|
| 1 | Estoque zerado | `healthResult.dimensions.estoque.zeroCount > 0` | Vermelho | "Repor" | `/Gestao?tab=estoque` |
| 2 | Leads sem resposta ≥3 dias | `smartActions.filter(a => a.type === 'responder').length > 0` | Laranja | "Responder" | `/MyContacts` |
| 3 | Frete perdendo vendas | `coachActions.find(a => a.type === 'revisar_frete')` | Vermelho | "Revisar" | `/FranchiseSettings` |
| 4 | Sem reposição ≥30 dias | `healthResult.dimensions.reposicao.daysSince >= 30` | Amarelo | "Pedir" | `/Gestao?tab=reposicao` |
| 5 | Marketing pendente | `!marketingPayment \|\| marketingPayment.status === 'rejected'` | Azul | "Registrar" | `/Marketing` |
| 6 | Bot desconectado | `franchise.whatsapp_status !== 'connected'` | Cinza | "Configurar" | `/FranchiseSettings` |
| 7 | Tudo em dia | nenhum acima ativo | Verde | — (sem CTA) | — |

**Cenário 7 subtítulo:** "Seu negócio está rodando bem. Continue assim!"

**Cores por severidade:** Vermelho (`#fef2f2` bg, `#fecaca` border, `#b91c1c` botão), Laranja (`#fff7ed` bg, `#fed7aa` border, `#d97706` botão), Amarelo (`#fefce8` bg, `#fde68a` border, `#d97706` botão), Azul (`#f0f4ff` bg, `#c7d2fe` border, `#4f46e5` botão), Cinza (`#f8fafc` bg, `#cbd5e1` border, `#475569` botão), Verde (`#f0fdf4` bg, `#bbf7d0` border).

**Ícones (MaterialIcon):** `inventory_2` (estoque), `chat` (leads), `local_shipping` (frete), `refresh` (reposição), `campaign` (marketing), `smart_toy` (bot), `check_circle` (tudo ok).

### 3. DiagnosticoSheet (`~150 linhas`)

**Trigger:** "Ver diagnóstico completo" no SaúdeDoNegócioCard.

**Conteúdo:**
- Header: "Diagnóstico — {franchise.city}" + score ring grande
- 4-5 barras horizontais de dimensão (reusa grid 1-col):
  ```
  Vendas      ████████░░ 85%
  Estoque     ████░░░░░░ 40%  ← vermelho
  Reposição   ██████░░░░ 70%
  Setup       █████████░ 95%
  Vendedor    ██████░░░░ 60%  (se hasData)
  ```
- Seção "Vendedor Digital" (condicional):
  - Se `healthResult.dimensions.bot.hasData`: Autonomia %, link "Ver detalhes" → abre BotCoachSheet
  - Se `!hasData`: "Ative seu vendedor — franquias com bot vendem 40% mais" + CTA → `/FranchiseSettings`
- Seção "Problemas identificados": lista `healthResult.problems` com ícones

## Alterações em Componentes Existentes

### FranchiseeDashboard.jsx

**Seletor de período:**
- Labels: "Hoje" / "Semana" / "Mês"
- "Semana" = segunda a domingo da semana atual (já existia como "Semana" anterior)
- "Mês" = 1º ao último dia do mês corrente (substituindo rolling 30d)
- Remover tabs "7 dias" e "30 dias"

**Seletor de período — valores de state:**
```js
const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },   // startOfWeek(now, {weekStartsOn:1}) a endOfWeek(now, {weekStartsOn:1})
  { key: "month", label: "Mês" },     // startOfMonth(now) a endOfMonth(now)
];
```
Importar `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth` de `date-fns`.

**loadData — adicionar 5 queries ao `Promise.allSettled`:**

```js
// Novas (índices [6] a [10]):
PurchaseOrder.filter({ franchise_id: evoId }, "-ordered_at", 50),
OnboardingChecklist.filter({ franchise_id: evoId }, null, 1),
FranchiseConfiguration.filter({ franchise_evolution_instance_id: evoId }, null, 1),
BotReport.filter({ franchise_id: evoId }, "-report_period_end", 1),
MarketingPayment.filter({ franchise_id: evoId }, "-reference_month", 1),
```

**Existente Sale query [0] — adicionar coluna `source`:**
```js
// C1 FIX: 4º argumento é objeto com chave `columns`, NÃO string
Sale.filter({ franchise_id: evoId }, "-sale_date", 1000, {
  columns: "id,value,delivery_fee,discount_amount,card_fee_amount,sale_date,contact_id,created_at,payment_method,source"
})
```

**Novos imports necessários:**
```js
import { PurchaseOrder, OnboardingChecklist, FranchiseConfiguration, BotReport, MarketingPayment } from "@/entities/all";
import { calculateFranchiseHealth } from "@/lib/healthScore";
import { generateBotCoachActions } from "@/lib/smartActions";
```

**Novos state vars:**
```js
const [purchaseOrders, setPurchaseOrders] = useState([]);
const [onboardingChecklist, setOnboardingChecklist] = useState(null);
const [franchiseConfig, setFranchiseConfig] = useState(null);
const [latestBotReport, setLatestBotReport] = useState(null);
const [marketingPayment, setMarketingPayment] = useState(null);
```

**Health Score useMemo:**
```js
const healthResult = useMemo(() => {
  if (!franchise) return null;
  const botSales = allSales.filter(s => s.source === 'bot');
  return calculateFranchiseHealth(franchise, {
    sales: allSales,
    inventory,
    orders: purchaseOrders,
    onboarding: onboardingChecklist ? [onboardingChecklist] : [],
    configs: franchiseConfig ? [franchiseConfig] : [],
    botConversations: [],  // não carregado no main load — lazy no drill-down
    conversationMessages: [],
    botSales,
  });
}, [franchise, allSales, inventory, purchaseOrders, onboardingChecklist, franchiseConfig]);
```

**Coach Actions useMemo:**
```js
const coachActions = useMemo(
  () => generateBotCoachActions(latestBotReport, 5),
  [latestBotReport]
);
```

**Remover do JSX:**
- `<QuickAccessCards />`
- `<BotPerformanceCard />`
- `<PeriodComparisonCard />`

**Adicionar ao JSX (após DailyGoalProgress):**
```jsx
{healthResult && <SaudeDoNegocioCard healthResult={healthResult} franchise={franchise} />}
<PriorityAction
  healthResult={healthResult}
  smartActions={actions}
  coachActions={coachActions}
  marketingPayment={marketingPayment}
  franchise={franchise}
/>
```

**PriorityAction comunica tipo ativo para SmartActions:** via `activePriorityType` state ou `useMemo`:
```js
const activePriorityType = useMemo(() => {
  if (!healthResult) return null;
  if (healthResult.dimensions.estoque.zeroCount > 0) return 'repor_estoque';
  if (actions.some(a => a.type === 'responder')) return 'responder';
  if (coachActions.some(a => a.type === 'revisar_frete')) return 'revisar_frete';
  // ... segue priorização
  return null;
}, [healthResult, actions, coachActions]);
```

**Reordenar:** RankingStreak após PriorityAction, MiniRevenueChart abaixo.

### SmartActions.jsx

- Renomear header de "Ações Sugeridas" para "Outras Ações"
- Aceitar nova prop `botReport` (vinda do parent) em vez de buscar internamente → elimina query duplicada interna
- Aceitar `excludeType` prop (string | null) — tipo da ação que já está na PriorityAction, para não repetir
- Cap de 5 → 4 items
- Manter lógica: coach actions (max 2) + contact actions (preenchendo até 4)
- Filtrar: `allActions.filter(a => a.type !== excludeType).slice(0, 4)`

**JSX no parent:**
```jsx
<SmartActions
  contacts={contacts}
  franchiseId={evoId}
  botReport={latestBotReport}
  excludeType={activePriorityType}
/>
```

### ProgressRing.jsx

- Adicionar prop `label?: string` — quando presente, renderiza `<text>` SVG centralizado em vez de `MaterialIcon`
- Font size relativo ao `size`: `fontSize = size * 0.28` (ex: size=90 → fontSize ~25px)
- Quando `label` E `isComplete` estão ambos presentes: `label` tem precedência (mostra número, não ícone), mas pulse animation ainda aplica
- Manter backward-compat: se `label` não informado, comportamento atual com `icon`

### BotCoachSheet.jsx

- **Arquivo está em:** `src/components/dashboard/BotCoachSheet.jsx` (arquivo independente, NÃO dentro de BotPerformanceCard)
- Reutilizar as-is — sem mudanças. Aberto via `DiagnosticoSheet` quando bot `hasData=true`

## Referência: Shapes do healthResult

Campos usados por `PriorityAction` e `DiagnosticoSheet`:

```js
healthResult = {
  total: number,        // 0-100
  status: "nova" | "saudavel" | "atencao" | "critico",  // chave sem acento
  isNew: boolean,       // franchise < 14 dias
  dimensions: {
    vendas: {
      score: number,    // 0-100
      detail: string,   // ex: "Vendeu nos últimos 2 dias"
      daysSince: number // dias desde última venda
    },
    estoque: {
      score: number,
      detail: string,
      zeroCount: number,   // qtd itens com quantity=0
      zeroNames: string[]  // nomes dos itens zerados
    },
    reposicao: {
      score: number,
      detail: string,
      daysSince: number,      // dias desde último pedido
      lastOrderDate: Date|null
    },
    setup: {
      score: number,
      detail: string,
      onboardingPct: number,  // % onboarding completo
      hasWhatsApp: boolean,
      onboardingComplete: boolean
    },
    bot: {
      score: number,
      detail: string,
      hasData: boolean,       // false quando arrays vazios
      autonomyRate: number    // % conversas sem intervenção humana
    },
  },
  weights: { vendas, estoque, reposicao, setup, bot }, // pesos usados (soma 1.0)
  problems: string[],  // frases humanas: "3 itens com estoque zerado", etc.
}
```

**STATUS_COLORS lookup:** usa `healthResult.status` (sem acento: `saudavel`, `atencao`, `critico`, `nova`).

## Data Flow — Antes vs Depois

### Antes (12 componentes, 10 queries)

```
FranchiseeDashboard loadData:  6 queries (allSettled)
  ├─ BotPerformanceCard:       4 queries independentes (waterfall)
  ├─ SmartActions:             1 query (BotReport — duplicada)
  └─ PeriodComparisonCard:     2 queries (lazy on expand)
Total: 13 queries potenciais
```

### Depois (10 componentes, 10 queries)

```
FranchiseeDashboard loadData:  10 queries (allSettled, paralelo)
  ├─ SaúdeDoNegócioCard:       0 queries (usa healthResult do parent)
  ├─ PriorityAction:           0 queries (usa dados do parent)
  ├─ SmartActions:             0 queries (recebe botReport do parent)
  └─ DiagnosticoSheet:         0 queries (usa healthResult do parent)
Total: 10 queries, TODAS em paralelo
```

**Performance:**
- Elimina waterfall do BotPerformanceCard (4 queries sequenciais após mount)
- Elimina query duplicada do SmartActions
- Adiciona 4 queries leves (total ~53 rows) ao batch paralelo
- Net: **menos latência total**, apesar de mais queries no allSettled — todas resolvem em paralelo
- Bot conversations pesadas (~2500 rows) NÃO são carregadas — lazy no drill-down

## Mapa de Duplicidades — Resolução

| Dado | Dashboard | Vendas | Gestão | MyContacts | Marketing |
|------|-----------|--------|--------|------------|-----------|
| Revenue/Faturamento | StatsCard (overview) | Summary bar (detail) | P&L (analysis) | — | — |
| Low-stock count | ~~QuickAccess~~ → Health Score | — | Estoque tab (CRUD) | — | — |
| Pending actions | ~~QuickAccess~~ → PriorityAction | — | — | Tab counts (CRUD) | — |
| Bot metrics | ~~BotPerfCard~~ → Health Score drill-down | — | — | — | — |
| Period comparison | ~~PeriodComparison~~ → Stats trends | — | Month diff | — | — |
| Marketing status | MarketingCard (reminder) | — | — | — | Full section (CRUD) |
| BotReport | ~~BotPerfCard + SmartActions (2x)~~ → 1 query | — | — | — | — |

**Princípio:** Dashboard = overview + coach. Outras páginas = detalhe + CRUD. Sem duplicação de propósito.

## Cenários por Perfil de Franqueado

### Iniciante (< 14 dias, sem vendas, sem bot)

- Health Score: pesos ajustados (Setup 40%, isNew=true)
- Score Ring: baixo (~30-40), status "Atenção" ou "Nova"
- Frase: "Complete a configuração do seu vendedor"
- AçãoPrioritária: "Ative seu Vendedor Digital" (cenário 6)
- Outras Ações: vazio ou "reativar" contatos do onboarding
- MiniRevenueChart: oculto (sem dados)
- RankingStreak: placeholder "Ranking aparece após sua primeira venda"

### Intermediário (vendas irregulares, bot pode estar ativo)

- Health Score: ~50-70, status "Atenção"
- Frase: "Seu estoque está com 3 itens zerados" ou "Responda 2 leads pendentes"
- AçãoPrioritária: varia conforme a situação mais urgente
- Outras Ações: mix de coach + contatos
- MiniRevenueChart: mostra tendência irregular

### Ativo (vendas regulares, bot ativo, estoque mantido)

- Health Score: ~75-95, status "Saudável"
- Frase: "Tudo em dia! Continue assim." ou dica de otimização do BotReport
- AçãoPrioritária: "Tudo em dia!" (cenário 7) ou fidelização
- Outras Ações: reativar clientes antigos, fidelizar
- MiniRevenueChart: tendência positiva

## Arquivos a Modificar/Criar

### Criar
- `src/components/dashboard/SaudeDoNegocioCard.jsx` (~120 linhas)
- `src/components/dashboard/PriorityAction.jsx` (~100 linhas)
- `src/components/dashboard/DiagnosticoSheet.jsx` (~150 linhas)

### Modificar
- `src/components/dashboard/FranchiseeDashboard.jsx` — +4 queries, +4 state, +1 useMemo, reorder JSX, remove 3 componentes
- `src/components/dashboard/SmartActions.jsx` — renomear header, aceitar `botReport` prop, `excludeTypes` prop, cap 4
- `src/components/onboarding/ProgressRing.jsx` — adicionar prop `label`

### Não tocar
- `src/lib/healthScore.js` — reutilizar as-is
- `src/lib/smartActions.js` — reutilizar as-is
- `src/components/dashboard/BotCoachSheet.jsx` — reutilizar as-is
- `src/components/dashboard/StatsCard.jsx` — sem mudança
- `src/components/dashboard/DailyGoalProgress.jsx` — sem mudança
- `src/components/dashboard/RankingStreak.jsx` — sem mudança
- `src/components/dashboard/MiniRevenueChart.jsx` — sem mudança
- `src/components/dashboard/MarketingPaymentCard.jsx` — sem mudança

### Considerar remoção (após confirmar zero imports)
- `src/components/dashboard/QuickAccessCards.jsx`
- `src/components/dashboard/PeriodComparisonCard.jsx`
- `src/components/dashboard/BotPerformanceCard.jsx` (manter arquivo por ora — pode ser útil para referência)

## Verificação Pós-Implementação

1. **Build:** `npm run build` sem erros
2. **Funcional (login como franqueado Renato — Ribeirão Preto):**
   - Dashboard carrega sem erros no console
   - Score Ring aparece com valor numérico e badge de status
   - "Ver diagnóstico completo" abre sheet com barras de dimensão
   - Ação Prioritária mostra cenário correto (provavelmente estoque zerado)
   - "Outras Ações" mostra max 4 cards, sem repetir a ação prioritária
   - Tabs "Hoje / Semana / Mês" funcionam e filtram stats corretamente
   - Ranking e Faturamento 7d aparecem nas posições corretas
3. **Funcional (login como admin):**
   - AdminDashboard não afetado (usa componentes diferentes)
   - Acompanhamento/BotIntelligence não afetados
4. **Mobile:**
   - Dashboard scroll é mais curto (12→10 seções)
   - Score Ring legível em tela pequena (min 70px ring)
   - PriorityAction CTA touch-friendly (min-h 40px)
5. **Performance:**
   - Network tab: 10 queries paralelas (não waterfall)
   - Sem BotPerformanceCard queries (4 eliminadas)
   - Sem SmartActions BotReport query (1 eliminada)
   - Total rows carregadas: ~1253 (antes ~3553 com BotPerfCard)
6. **Edge cases:**
   - Franquia sem vendas: Score mostra "Nova" ou "Crítico", ação "Ative vendedor"
   - Franquia sem bot: Bot dimension excluída, 4 dimensões
   - BotReport inexistente: coach actions vazios, tips fallback para health problems
   - Todas as ações resolvidas: "Tudo em dia!" verde
