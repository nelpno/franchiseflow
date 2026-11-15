# Spec: Dashboard por Role — FranchiseFlow

**Data:** 2026-03-20
**Status:** Aprovado
**Escopo:** Sprint 2 — Dashboard diferenciado por role + navegação + elementos motivacionais

---

## Contexto

A análise UX (`docs/analise-ux-completa.md`) identificou que 70% da interface é ruído para o franqueado. O dashboard atual mostra o mesmo conteúdo para admin e franqueado: 4 stats cards genéricos, filtro de franquias e gráficos de 7 dias.

**Personas:**
- **Dona Maria (55+):** "Taxa de conversão" não entende, 27 itens no checklist assusta, quer simplicidade
- **Lucas (28):** quer ranking, gamificação, comparação, ações rápidas

**Decisão:** uma página `Dashboard.jsx` que renderiza `<AdminDashboard />` ou `<FranchiseeDashboard />` baseado no role do usuário.

**Mudança vs análise UX original:** a análise propôs 5 itens no menu do franqueado. Esta spec adiciona Marketing como 6o item porque o franqueado precisa baixar artes para postar no Meta Business Suite. CLAUDE.md será atualizado para refletir 6 itens.

---

## 1. Dashboard do Franqueado

### Objetivo
Tela focada em **ação e motivação**. O franqueado abre e vê sua loja, não um painel genérico.

### Layout (mobile-first, 1 coluna celular / 2 desktop)

```
┌─────────────────────────────────────────┐
│  Bom dia, Maria! - Unidade São João     │
│                                          │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Vendas Hoje  │  │ Faturamento │       │
│  │     5        │  │  R$ 285     │       │
│  │  +25% ontem  │  │  +12%       │       │
│  └─────────────┘  └─────────────┘       │
│                                          │
│  META DO DIA                             │
│  ████████████░░░░░░░  R$ 285 / R$ 440   │
│  "Faltam R$ 155 pra bater a meta!"      │
│                                          │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Estoque     │  │ Checklist   │       │
│  │ 2 baixos    │  │   8/10 feito│       │
│  │  [VER]      │  │   [ABRIR]   │       │
│  └─────────────┘  └─────────────┘       │
│                                          │
│  Ranking: 3o de 12 franquias            │
│  Sequencia: 7 dias batendo meta         │
│                                          │
│  [ + REGISTRAR VENDA ]  (botao grande)  │
└─────────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade | Novo/Existente |
|-----------|-----------------|----------------|
| `FranchiseeGreeting` | Saudação por horário + nome da unidade | Novo |
| `StatsCard` | Cards de vendas e faturamento (só 2) | Existente |
| `DailyGoalProgress` | Barra de progresso com meta automática | Novo |
| `QuickAccessCards` | Estoque (com alerta) + Checklist (com progresso), clicáveis (navegam para a página respectiva) | Novo |
| `RankingStreak` | Posição entre franquias + sequência de dias | Novo |
| `QuickSaleButton` | Botão fixo "Registrar Venda" — navega para `/sales` com foco no formulário de nova venda | Novo |

### Meta automática
- Cálculo: média de faturamento dos últimos 30 dias × 1.10
- Fonte: `DailySummary` filtrado pela franquia do usuário
- Se não há dados suficientes (< 7 dias), não mostra a barra de meta
- Para 7-30 dias de histórico, calcula sobre os dias disponíveis
- Mensagem dinâmica: "Faltam R$ X" ou "Meta batida! +R$ X acima"
- **Nota:** esta meta diária é independente da `SalesGoal` mensal que já existe na página de Vendas. Futuramente, pode-se derivar a meta diária da meta mensal (meta_mensal / dias_úteis_do_mês) quando ela existir.

### Ranking
- Obtido via RPC Supabase `get_franchise_ranking(date)` que retorna apenas a posição e o total de franquias, sem expor faturamento de outras unidades
- RPC usa `rank() over (order by total_revenue desc)` internamente
- Mostra apenas a posição do franqueado: "3o de 12 franquias"
- Se não há dados do dia, mostra "Sem dados hoje"

### Streak (sequência)
- Conta dias consecutivos em que o faturamento >= meta
- Fonte: `DailySummary` dos últimos 30 dias
- "7 dias batendo meta" ou "Comece hoje!" se streak = 0
- Se meta não é exibida (< 7 dias de histórico), streak também não é exibido

### O que NÃO aparece
- Filtro de franquias (franqueado tem só uma)
- Gráficos de 7 dias (complexidade desnecessária)
- Taxa de conversão (persona Dona Maria não entende)
- Lista de top franquias (só vê sua posição)

---

## 2. Dashboard do Admin

### Objetivo
**Visão geral + alertas.** Responder: "quem precisa de atenção?" e "como está o negócio?"

### Layout (3 colunas desktop, empilha no mobile)

```
┌──────────────────────────────────────────────────┐
│  Painel Geral — Maxi Massas          [Hoje v]   │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│  │ Vendas   │ │Faturamento│ │Contatos  │ │Conver││
│  │   32     │ │ R$ 4.850  │ │   89     │ │ 36%  ││
│  │ +18%     │ │ +22%      │ │ -5%      │ │ +3%  ││
│  └──────────┘ └──────────┘ └──────────┘ └──────┘│
│                                                   │
│  ATENCAO (3)                                      │
│  ┌──────────────────────────────────────────────┐│
│  │ Vermelho: São João — sem vendas há 2 dias    ││
│  │ Amarelo:  Centro — 4 itens estoque critico   ││
│  │ Amarelo:  Moema — checklist não feito hoje   ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  RANKING DO DIA                                   │
│  ┌──────────────────────────────────────────────┐│
│  │ 1o Moema        R$ 890  ████████████████     ││
│  │ 2o Pinheiros    R$ 720  ████████████         ││
│  │ 3o Centro       R$ 650  ██████████           ││
│  │ 4o São João     R$ 340  ██████               ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  ┌───────────────────┐ ┌───────────────────────┐│
│  │ Faturamento 7 dias│ │ Contatos 7 dias       ││
│  │  (grafico barras) │ │  (grafico barras)     ││
│  └───────────────────┘ └───────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade | Novo/Existente |
|-----------|-----------------|----------------|
| `AdminHeader` | Título + filtro de período (hoje/7d/30d) | Novo |
| `StatsCard` | 4 cards com totais de todas as franquias | Existente |
| `AlertsPanel` | Semáforo de situações que precisam atenção | Novo |
| `FranchiseRanking` | Ranking com barra visual de faturamento | Novo |
| `DailyRevenueChart` | Gráfico faturamento 7 dias (precisa aceitar filtro de período) | Existente (adaptar) |
| `MessagesTrend` | Gráfico contatos 7 dias (precisa aceitar filtro de período) | Existente (adaptar) |

### Regras do AlertsPanel

| Nível | Condição |
|-------|----------|
| Vermelho | Franquia sem vendas há 2+ dias (verificar ausência de registro em `daily_summaries` — o `pg_cron` pode não gerar registro para dias sem atividade) |
| Vermelho | Estoque zerado em algum item |
| Amarelo | Checklist não feito hoje |
| Amarelo | Estoque abaixo de 5 unidades |
| Verde | Mensagem positiva quando não há alertas |

### Filtro de período
- Altera os stats cards e gráficos
- Opções: Hoje, 7 dias, 30 dias
- Para "Hoje": contatos vêm de `DailyUniqueContact.filter({date: hoje})`
- Para 7d/30d: contatos vêm de `DailySummary` (que já tem `unique_contacts` agregado)
- Não altera alertas (sempre tempo real)

---

## 3. Navegação por Role

### Franqueado (6 itens)

**Nota:** a análise UX original propôs 5 itens. Marketing foi adicionado porque o franqueado precisa baixar artes para postar no Meta Business Suite.

| Item | Rota | Antes |
|------|------|-------|
| Minha Loja | `/dashboard` | Era "Dashboard" |
| Vendas | `/sales` | Igual |
| Estoque | `/inventory` | Igual |
| Marketing | `/marketing` | Antes visível a todos (mantido — franqueado baixa artes para postar no Meta Business Suite) |
| Checklist | `/my-checklist` | Igual |
| Minha Unidade | `/franchise-settings` | Era "Configurações" |

### Admin (12 itens)

| Item | Rota | Antes |
|------|------|-------|
| Painel Geral | `/dashboard` | Era "Dashboard" |
| Vendas | `/sales` | Igual |
| Estoque | `/inventory` | Igual |
| Catálogo | `/catalog` | Antes visível a todos |
| Checklist | `/my-checklist` | Igual |
| Relatórios | `/reports` | Antes visível a todos |
| Marketing | `/marketing` | Antes visível a todos |
| Configurações | `/franchise-settings` | Igual |
| Onboarding | `/onboarding` | Igual (condicional) |
| Acompanhamento | `/acompanhamento` | Igual (admin only) |
| Franqueados | `/franchises` | Igual (admin only) |
| Usuários | `/user-management` | Igual (admin only) |

### Mudanças no sidebar
- Renomear "Dashboard" -> "Minha Loja" (franqueado) / "Painel Geral" (admin)
- Marcar Relatórios e Catálogo como `adminOnly` (Marketing continua visível ao franqueado)
- Resumo "Vendas/Contatos" no sidebar: remover do franqueado (já vê no dashboard) — condicionar `loadQuickStats()` ao role admin para economizar requests
- Proteger rotas admin-only: se franqueado tentar acessar `/reports` ou `/catalog` diretamente, redirecionar para `/dashboard`

---

## 4. Fontes de Dados

Todos os dados já existem nas entities:

| Dado | Entity | Método | Notas |
|------|--------|--------|-------|
| Vendas do dia | `Sale` | `.filter({sale_date: hoje})` | |
| Faturamento/contatos histórico | `DailySummary` | `.list()` (últimos 30-365 dias) | |
| Contatos de hoje | `DailyUniqueContact` | `.filter({date: hoje})` | Só para filtro "Hoje" no admin |
| Lista de franquias | `Franchise` | `.list()` | |
| Estoque | `InventoryItem` | `.filter({franchise_id})` | Entity real é `InventoryItem`, não `Inventory` |
| Checklist (admin) | `DailyChecklist` | `.filter({date: hoje})` | Traz todos |
| Checklist (franqueado) | `DailyChecklist` | `.filter({franchise_id: evolution_instance_id, date: hoje})` | `franchise_id` na tabela armazena `evolution_instance_id`, não UUID |
| Ranking (franqueado) | RPC Supabase | `get_franchise_ranking(date)` | **Nova RPC** — retorna posição + total, sem expor dados alheios |

**Nova RPC necessária:** `get_franchise_ranking(p_date date)` — retorna `{position, total_franchises}` para o franchise_id do usuário autenticado. Usa `rank() over (order by total_revenue desc)` sobre `daily_summaries`. Respeita RLS automaticamente.

---

## 5. Decisões Técnicas

| Aspecto | Decisão |
|---------|---------|
| Estrutura | `Dashboard.jsx` renderiza `<AdminDashboard />` ou `<FranchiseeDashboard />` via `useAuth()` |
| Design visual | Google Stitch para gerar layouts finais |
| Meta diária | Média 30 dias x 1.10, calculada client-side. Independente de `SalesGoal` mensal |
| Ranking franqueado | RPC Supabase (sem vazamento de dados via RLS) |
| Ranking admin | Client-side a partir de DailySummary (admin tem acesso a todos) |
| Alertas | Client-side cruzando vendas, estoque e checklist |
| Refresh | Manter intervalo de 60s existente |
| Loading states | Skeleton cards durante carregamento. Erro: toast + dados em cache se disponíveis |
| CLAUDE.md | Atualizar menu franqueado (6 itens) e terminologia |

---

## 6. Fora do Escopo (sprints futuros)

- Notificações push (requer service worker + infra)
- Card compartilhável para Instagram
- Drag-and-drop de widgets
- Previsão de quando acaba estoque
- Badges/medalhas visuais
- Vincular Marketing a pasta do Google Drive (facilitar acesso às artes)
- Melhorar dados de contatos/conversão a partir do vendedor genérico (revisar o que o agente salva no Supabase e enriquecer)
- Unificar/complementar dados do vendedor genérico com dados do dashboard
- Derivar meta diária da meta mensal (`SalesGoal`) quando existir
