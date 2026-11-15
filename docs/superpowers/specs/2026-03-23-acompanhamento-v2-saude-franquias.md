# Spec: Acompanhamento v2 — Saúde das Franquias

**Data**: 2026-03-23
**Status**: Draft
**Substitui**: Acompanhamento atual (monitoramento de checklists diários)

---

## Problema

A página Acompanhamento atual monitora exclusivamente checklists diários — auto-relato do franqueado ("marquei que fiz"). Com 46 franquias hoje (escalando para 100+), o admin precisa de indicadores baseados em **dados reais** (vendas, estoque, pedidos) para decidir rapidamente quem precisa de atenção.

## Solução

Substituir o monitoramento de checklists por um **painel de saúde automatizado** com score 0-100 por franquia, ordenado do pior pro melhor. O admin bate o olho e sabe pra quem ligar.

## Público

- **Admin** (role: admin)
- **Gerente** (role: manager)
- Franqueados **não** acessam esta página.

---

## Mapeamento de IDs por Franquia

**Crítico**: tabelas usam IDs diferentes para identificar franquias.

| Tabela | Campo FK | Tipo | Valor exemplo |
|--------|----------|------|---------------|
| `sales` | `franchise_id` | UUID | `a1b2c3d4-...` |
| `purchase_orders` | `franchise_id` | UUID | `a1b2c3d4-...` |
| `inventory_items` | `franchise_id` | text (evo_id) | `franquiasaojoao` |
| `daily_checklists` | `franchise_id` | text (evo_id) | `franquiasaojoao` |
| `onboarding_checklists` | `franchise_id` | text (evo_id) | `franquiasaojoao` |
| `franchise_configurations` | `franchise_evolution_instance_id` | text (evo_id) | `franquiasaojoao` |
| `franchise_notes` (nova) | `franchise_id` | UUID | `a1b2c3d4-...` |

O cálculo do score usa `franchise.id` (UUID) E `franchise.evolution_instance_id` (text) conforme a tabela consultada. A função `calculateHealthScore(franchise, data)` recebe o objeto franchise completo e usa o ID correto para cada lookup.

---

## Score de Saúde (0-100)

### Dimensões e Pesos

| Dimensão | Peso | Fonte de Dados |
|----------|------|----------------|
| Vendas | 30% | `sales` (franchise_id = UUID) |
| Estoque | 25% | `inventory_items` (franchise_id = evo_id) |
| Reposição | 20% | `purchase_orders` (franchise_id = UUID) |
| Setup | 15% | `onboarding_checklists` (franchise_id = evo_id) + `franchise_configurations` (evo_id) |
| Atividade | 10% | `daily_checklists` (franchise_id = evo_id) |

### Franquia Nova (< 30 dias desde criação)

Pesos ajustados para priorizar setup:

| Dimensão | Peso Normal | Peso Franquia Nova |
|----------|-------------|--------------------|
| Vendas | 30% | 20% |
| Estoque | 25% | 15% |
| Reposição | 20% | 15% |
| Setup | 15% | **40%** |
| Atividade | 10% | 10% |

### Cálculo por Dimensão

#### Vendas (0-100)
- **100**: Vendeu hoje
- **80**: Vendeu ontem
- **60**: Última venda há 2 dias
- **40**: Última venda há 3 dias
- **20**: Última venda há 4-5 dias
- **0**: 6+ dias sem venda

Fonte: `SELECT MAX(created_at) FROM sales WHERE franchise_id = ?`

#### Estoque (0-100)
- **100**: Todos itens acima do min_stock
- **80**: 1 item zerado
- **60**: 2-3 itens zerados
- **40**: 4-5 itens zerados
- **20**: 6-8 itens zerados
- **0**: 9+ itens zerados

Fonte: `SELECT COUNT(*) FROM inventory_items WHERE franchise_id = ? AND quantity = 0`

#### Reposição (0-100)
- **100**: Pedido nos últimos 7 dias
- **80**: Pedido há 8-14 dias
- **60**: Pedido há 15-21 dias
- **40**: Pedido há 22-30 dias
- **20**: Pedido há 31-45 dias
- **0**: 45+ dias sem pedido OU nunca pediu

Fonte: `SELECT MAX(ordered_at) FROM purchase_orders WHERE franchise_id = ?`

#### Setup (0-100)
- Onboarding: 0-70 pts baseado em `onboarding_checklists.completed_count` / total de itens do bloco (contagem fixa de ONBOARDING_BLOCKS no frontend, NÃO coluna do banco — `total_items` não existe na tabela)
- WhatsApp: +30 pts se `franchise_configurations.evolution_instance_id` tem instância E status conectado (verificar via campo existente no banco, NÃO `whatsapp_connected` que não existe)
- Na implementação, verificar colunas reais de `franchise_configurations` e `onboarding_checklists` via SQL antes de codificar

Exemplos: onboarding 100% + WhatsApp on = 100; onboarding 50% + WhatsApp off = 35

#### Atividade (0-100)
- **100**: Checklist feito hoje (completion_percentage ≥ 80%)
- **70**: Checklist feito ontem
- **40**: Último checklist há 2 dias
- **20**: Último checklist há 3-4 dias
- **0**: 5+ dias sem checklist

Fonte: `SELECT MAX(date) FROM daily_checklists WHERE franchise_id = ? AND completion_percentage >= 80`

### Score Final

```
score_final = Σ (score_dimensão × peso_dimensão)

// Penalty: dimensão com score 0 puxa o total pra baixo
if (alguma_dimensão == 0) score_final -= 10
// Clamp 0-100
score_final = Math.max(0, Math.min(100, score_final))
```

### Faixas de Semáforo

| Faixa | Score | Cor | Label |
|-------|-------|-----|-------|
| 🟢 Saudável | 70-100 | `#16a34a` | Saudável |
| 🟡 Atenção | 40-69 | `#d97706` | Atenção |
| 🔴 Crítico | 0-39 | `#dc2626` | Crítico |
| 🔵 Nova | qualquer | `#2563eb` | Nova (< 30 dias) |

**Nota sobre cores**: `#d97706` (amber) e backgrounds `#fef2f2`, `#fffbeb`, `#f0fdf4` são exceções semânticas à regra 99 do CLAUDE.md (assim como emerald para sucesso, regra 125). Usadas APENAS para estados de saúde, NÃO como cores de marca.

---

## Layout da Página

### Nome da Página

- Título: **"Acompanhamento"** (mantém URL e menu)
- Subtítulo: **"Saúde das franquias · Atualizado às HH:MM"**

### Topo — 4 Cards Resumo

| Card | Ícone | Valor | Cor fundo |
|------|-------|-------|-----------|
| Críticos | `warning` | Contagem score < 40 | `#fef2f2` (red-50) |
| Atenção | `info` | Contagem score 40-69 | `#fffbeb` (amber-50) |
| Saudáveis | `check_circle` | Contagem score ≥ 70 | `#f0fdf4` (green-50) |
| Score Médio | `monitoring` | Média arredondada | `#fbf9fa` (surface) |

Grid: `grid-cols-4` desktop, `grid-cols-2` mobile (2 rows).

### Barra de Filtros

- **Busca**: input text "Buscar por nome ou cidade..." (filtra client-side)
- **Status**: select com opções Todos / 🔴 Críticos / 🟡 Atenção / 🟢 Saudáveis
- **Ordenação**: select com opções Score (pior primeiro) / Última venda / Último pedido / Nome A-Z

### Lista Principal

Cada franquia é uma row/card com:

```
[Score]  Nome do Franqueado · Cidade - UF
         ████░░ 60  ██░░░░ 20  ██████ 80  ████░░ 55  ███░░░ 40
         Vendas     Estoque    Reposição  Setup      Atividade
         ⚠️ 3 dias sem venda · 4 itens zerados
```

Elementos:
- **Score grande** (text-2xl, font-bold) com cor de fundo do semáforo
- **Nome + Cidade** (text-base, `#1b1c1d`)
- **Mini barras** das 5 dimensões (altura 6px, largura ~60px, cor conforme faixa do score individual)
- **Resumo de problemas**: apenas dimensões com score < 50, texto em `#4a3d3d`, ícone `warning` amber/red

**Ordenação padrão**: score ascendente (piores primeiro).

**Desktop**: tabela-like com colunas alinhadas.
**Mobile**: cards empilhados — score grande à esquerda, info à direita, mini barras abaixo do nome.

### Drill-down (Expande Inline)

Ao clicar numa franquia, expande um painel abaixo da linha com 3 blocos:

#### Bloco 1 — Diagnóstico Detalhado

Cada dimensão com dados concretos:

```
Vendas:     Última venda há 3 dias · R$ 520 nos últimos 7d (↓35% vs semana anterior)
Estoque:    4 de 28 itens zerados (Canelone 4Q, Rondelli Carne, Nhoque Tradicional, Molho Branco)
Reposição:  Último pedido há 22 dias (01/mar) · Status: entregue
Setup:      Onboarding 85% (17/20 itens) · WhatsApp ✅ conectado
Atividade:  Último checklist há 2 dias · Streak: 5 dias
```

Cada linha com ícone Material Symbol + cor do semáforo da dimensão.

#### Bloco 2 — Timeline de Anotações

Lista cronológica (mais recente primeiro):

```
23/03 14:30 — Nelson: Liguei, José disse que estava doente. Voltar em 7 dias.
16/03 10:15 — Celso: Mandei WhatsApp cobrando pedido. Sem resposta.
```

- Campo de texto (textarea, 2 rows) + botão "Anotar" (ícone `note_add`)
- Máximo 500 caracteres por nota
- Mostra últimas 10 notas; link "Ver todas" se houver mais
- Cada nota mostra: data + hora, nome do autor, texto

#### Bloco 3 — Ações Rápidas

Botões inline (variant outline):
- **WhatsApp** (`chat` icon): abre `getWhatsAppLink(owner_phone)` — usa telefone do owner da franquia
- **Anotar** (`edit_note` icon): foca no campo de texto do Bloco 2
- **Ver Gestão** (`bar_chart` icon): navega para `/Gestao?franchise={evo_id}` — requer implementar param de contexto na página Gestão para admin visualizar dados de outra franquia (escopo de implementação, não existe hoje)
- **Ver Onboarding** (`rocket_launch` icon): navega para `/Onboarding?franchise={evo_id}` — só aparece se setup < 100%

---

## Checklist Simplificado

O checklist diário do franqueado será **reduzido** de N itens para 3-4 itens que o sistema não consegue medir automaticamente:

1. **Limpeza e organização** — vitrine, espaço de trabalho
2. **Conferência de validade** — produtos próximos do vencimento
3. **Atendimento presencial** — atendeu clientes na loja (se aplicável)

Esses itens alimentam a dimensão "Atividade" (10% do score). A simplificação é uma mudança separada — pode ser feita antes ou depois do redesign da página.

**Nota**: a simplificação do checklist é uma decisão de negócio que pode ser iterada. O score de Atividade funciona com o checklist atual (completo) ou simplificado.

---

## Modelo de Dados

### Nova tabela: `franchise_notes`

```sql
CREATE TABLE franchise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por franquia (mais recentes primeiro)
CREATE INDEX idx_franchise_notes_franchise_id ON franchise_notes(franchise_id, created_at DESC);

-- RLS: apenas admin e manager podem ler/escrever
ALTER TABLE franchise_notes ENABLE ROW LEVEL SECURITY;

-- Nota: profiles tem USING(true) para SELECT (regra 6 CLAUDE.md), então este JOIN é seguro
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
```

### Nova entity: `FranchiseNote`

Adicionada em `src/entities/all.js` seguindo o adapter pattern existente.

---

## Componentes

### Novos

| Componente | Caminho | Responsabilidade |
|------------|---------|-----------------|
| `HealthScore` | `src/components/acompanhamento/HealthScore.jsx` | Cálculo do score + display (número + cor + barra circular) |
| `HealthScoreBar` | `src/components/acompanhamento/HealthScoreBar.jsx` | Mini barra horizontal de uma dimensão |
| `FranchiseHealthRow` | `src/components/acompanhamento/FranchiseHealthRow.jsx` | Linha/card de uma franquia na lista |
| `FranchiseHealthDetail` | `src/components/acompanhamento/FranchiseHealthDetail.jsx` | Painel drill-down (diagnóstico + notas + ações) |
| `FranchiseNotes` | `src/components/acompanhamento/FranchiseNotes.jsx` | Timeline de anotações + form de nova nota |

### Reutilizados

- `MaterialIcon` — ícones Material Symbols
- `FilterBar` — busca + selects (já existe em `src/components/dashboard/`)

### Removidos

- `FranchiseeDetailModal` — substituído por drill-down inline
- Lógica de semáforo/aderência/streak de checklists no `Acompanhamento.jsx` atual

---

## Data Fetching

### Estratégia: RPC Server-Side + Entity Layer

Com 100+ franquias, fetch client-side de todas as tabelas não escala (28 items × 100 = 2800 rows só de estoque). Solução em 2 camadas:

#### Camada 1 — RPC Supabase `get_franchise_health_data()`

Função SQL que retorna dados agregados por franquia em uma única query:

```sql
-- Retorna: franchise_id (UUID), evo_id, last_sale_at, sales_7d_total,
--          zero_stock_count, last_order_at, onboarding_completed_count,
--          last_checklist_at
-- Faz JOINs e agregações server-side, retorna ~100 rows (1 por franquia)
```

Esta RPC será criada durante a implementação após verificar colunas reais do banco.

#### Camada 2 — Entity Layer (dados leves)

```javascript
const [franchises, healthData, notes] = await Promise.all([
  Franchise.list(),                              // NÃO filtrar por status (regra 74)
  supabase.rpc('get_franchise_health_data'),     // Agregação server-side
  FranchiseNote.list('-created_at', 500),         // Notas (leve, ~500 rows max)
]);
```

**Nota**: `Franchise.list()` sem filtro de status (regra 74 CLAUDE.md). Franquias inativas podem ser filtradas no frontend após o fetch.

### Cálculo do score

Feito **client-side** a partir dos dados agregados da RPC (1 row por franquia):
1. Para cada franquia, calcula score de cada dimensão usando os campos agregados
2. Aplica pesos (normal ou franquia nova, baseado em `created_at`)
3. Aplica penalty se alguma dimensão = 0
4. Clamp 0-100

### Edge Cases

- **Franquia sem dados** (recém-criada, 0 vendas, 0 pedidos): score calculado normalmente — Vendas=0, Estoque=100 (populado por trigger), Reposição=0, Setup=baixo, Atividade=0. Label especial "Nova" no card
- **Franquia sendo criada durante fetch**: ignorada (não aparece no list). Próximo polling captura
- **Dados parciais** (ex: tem vendas mas não tem checklist): cada dimensão calcula independente com os dados disponíveis

### Polling

Refresh automático a cada **120 segundos** (admin precisa de dados mais frescos que dashboard).
Botão "Atualizar" manual no header.

---

## O que sai do sistema

| Item removido | Motivo |
|--------------|--------|
| Calendário 30 dias de checklist | Substituído por score automatizado |
| Heatmap de aderência semanal | Substituído por mini barras de dimensão |
| Botão "Contactado" nos alertas | Substituído por timeline de anotações |
| `FranchiseeDetailModal` | Substituído por drill-down inline |
| Cálculo de streak de checklist | Simplificado — streak pode ser mantido como métrica secundária |

---

## Relação com AlertsPanel

O `AlertsPanel` no AdminDashboard **continua existindo** — ele mostra alertas urgentes (sem venda 2d, estoque zero) como notificação rápida. A página Acompanhamento é o **deep-dive** — visão completa de todas as franquias com score, histórico e ações.

Não há duplicação: AlertsPanel é "apaga fogo", Acompanhamento é "gestão proativa".

---

## Mobile

- Cards resumo: `grid-cols-2` (2 rows)
- Lista: cards empilhados (score à esquerda, info à direita)
- Drill-down: accordion que empurra cards abaixo
- Notas: textarea full-width
- Ações: botões stacked verticalmente
- Touch targets: `min-h-[44px]` em todos botões

---

## Fora de Escopo

- Integração com Google Calendar (reuniões)
- Notificações push para admin quando score cai
- Export da lista de saúde (PDF/Excel)
- Score histórico (evolução ao longo do tempo)
- Comparativo entre franquias (ranking formal)
- Admin visualizar página Gestão de outra franquia (param `?franchise=`) — necessário para "Ver Gestão" funcionar completamente

Esses podem ser adicionados em iterações futuras.

---

## Decisões de Review

Correções aplicadas após spec review:

1. **Mapeamento de IDs documentado** — tabelas usam UUID ou evo_id, função de score recebe franchise completo
2. **Setup reformulado** — `total_items` e `whatsapp_connected` não existem no banco; usar contagem frontend + verificar colunas reais na implementação
3. **Data fetching via RPC** — `get_franchise_health_data()` agrega server-side em vez de puxar 2800+ rows
4. **`Franchise.list()` sem filtro** — regra 74 CLAUDE.md, filtrar status no frontend
5. **Cores semânticas documentadas** — exceção à regra 99 para amber/red/green backgrounds
6. **"Ver Gestão" marcado como escopo futuro** — admin não consegue ver Gestão de outra franquia hoje
7. **Edge cases documentados** — franquia nova, sem dados, dados parciais
