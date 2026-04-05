# Bot Intelligence — Design Spec

## Contexto

A Maxi Massas captura ~1.500 mensagens/dia via bot WhatsApp (V3 produção) na tabela `conversation_messages`, mas esses dados **nunca são visualizados no app**. Campos como `sub_agent_used`, `tokens_in`, `response_time_ms` existem no schema mas não são populados. A tabela `bot_conversations` (funil) não é alimentada pelo V3. Resultado: dados coletados sem gerar valor.

**Objetivo:** Transformar dados brutos de conversas em inteligência acionável — melhorar o bot, capacitar franqueados, aumentar conversão.

**Público:** Admin (análise profunda) + Franqueado (simples e acionável) + Relatório automático semanal.

## Arquitetura — 3 Camadas

```
CAMADA 1 — CAPTURA (n8n V3/V4 + Supabase)
  Enriquecer logs existentes + popular bot_conversations
  Regra: NADA no caminho crítico do bot

CAMADA 2 — PROCESSAMENTO (n8n cron + Gemini 2.5 Flash-Lite)
  Classificar conversas encerradas: intent, sentiment, quality, abandono
  ~R$ 2-5/mês

CAMADA 3 — VISUALIZAÇÃO (React frontend + n8n relatório)
  Admin: página /BotIntelligence (4 seções)
  Franqueado: widget "Seu Vendedor Digital" no dashboard
  Automático: relatório semanal WhatsApp
```

## Camada 1 — Captura

### Princípio: captura leve, processamento pesado

Todas alterações no V3/V4 são em nós PARALELOS ao fluxo principal, com `continueOnFail=true`. O caminho crítico (Webhook → GerenteGeral → Enviar Mensagem) permanece intocado.

### Ajustes no Log Outbound (V3)

| Campo | Atual | Novo |
|---|---|---|
| `model_used` | `"gemini-flash"` (hardcoded) | `"gemini-3-flash-preview"` |
| `whatsapp_message_id` | ausente | `$('Normaliza1').item.json.message.message_id` |
| `metadata.segment` | ausente | `$('Customer Context').item.json.customerIntel.segment` |
| `response_time_ms` | ausente | Calcular dentro do próprio nó Log Outbound: `Date.now() - $('Normaliza1').item.json.message.Timestamp * 1000` (timestamp WhatsApp como T0). Alternativa: gravar `_t0` via staticData no mesmo branch. **NÃO** referenciar nós de outro branch — branches incoming/outcoming são isolados no V3 |

### Ajustes no Log Inbound (V3)

| Campo | Atual | Novo |
|---|---|---|
| `message_type` | `"text"` (hardcoded) | `$('Normaliza1').item.json.message.content_type` |

### Popular `bot_conversations` (V3)

Adicionar chamadas `upsert_bot_conversation` em PARALELO (continueOnFail=true):

| Ponto | Status | Dados extras |
|---|---|---|
| Paralelo ao Log Inbound | `started` | franchise_id, contact_phone |
| Retorno do EnviarCatalogo1 | `catalog_sent` | — |
| EnviaPedidoFechado após Create Sale | `converted` | cart_value |

### Replicar no V4

Mesmos ajustes aplicados ao V4 (workflow `aRBzPABwrjhWCPvq`).

### O que NÃO alterar no V3/V4

- `sub_agent_used` → inferir na Camada 2 (LLM pós-conversa)
- `tokens_in/out` → estimar na Camada 2 por char count
- Nenhum nó novo no caminho crítico

## Camada 2 — Processamento LLM

### Trigger de encerramento

Conversa considerada encerrada quando última mensagem > 30 minutos atrás.

### Workflow "Bot Conversation Analyzer"

- **Trigger:** Cron a cada 30 minutos
- **Query:** bot_conversations com `processed_at IS NULL` e `updated_at < now() - interval '30 minutes'`
- **Limit:** 20 por ciclo (150 conversas/dia ÷ 48 ciclos = ~3 por ciclo)
- **Modelo:** Gemini 2.5 Flash-Lite ($0.10/$0.40 por 1M tokens)
- **Fallback:** JSON inválido → gravar `processing_model = 'error'`, seguir

### Campos de classificação

| Campo | Tipo | Valores |
|---|---|---|
| `summary` | TEXT | Resumo livre (max 500 chars) |
| `intent` | TEXT | `compra`, `duvida_produto`, `duvida_entrega`, `reclamacao`, `preparo_faq`, `preco`, `catalogo`, `saudacao`, `outro` |
| `sentiment` | TEXT | `positivo`, `neutro`, `negativo`, `frustrado` |
| `outcome` | TEXT | `converted`, `abandoned`, `escalated`, `informational`, `ongoing` |
| `quality_score` | SMALLINT | 1-10 |
| `quality_notes` | TEXT | Explicação do score |
| `tools_used` | TEXT[] | Sub-agentes inferidos do conteúdo |
| `llm_abandon_reason` | TEXT | `preco`, `frete`, `indisponivel`, `demora`, `confuso`, `sem_resposta`, `preferiu_humano`, `outro` |
| `topics` | TEXT[] | Produtos e assuntos mencionados |
| `improvement_hint` | TEXT | Sugestão acionável (só se quality_score < 8) |
| `processed_at` | TIMESTAMPTZ | Timestamp da classificação |
| `processing_model` | TEXT | `"gemini-2.5-flash-lite"` ou `"error"` |

### Prompt do classificador

```
Você é um analista de conversas de um bot vendedor de massas artesanais congeladas.

Analise a conversa abaixo e retorne APENAS um JSON com os campos especificados.

Regras:
- quality_score: 10 = resolveu tudo sem humano, 7-9 = resolveu com pequenos tropeços,
  4-6 = precisou de humano mas tinha capacidade, 1-3 = falhou completamente
- tools_used: inferir das ações (mencionou preço=Estoque1, calculou frete=CalculaFrete1,
  fechou pedido=Pedido_Checkout1, enviou catálogo=EnviarCatalogo1, FAQ=preparo_faq1)
- llm_abandon_reason: só preencher se outcome=abandoned
- improvement_hint: só preencher se quality_score < 8
- sentiment: baseado nas msgs do CLIENTE (não do bot)

Campos JSON: summary, intent, sentiment, outcome, quality_score, quality_notes,
tools_used (array), llm_abandon_reason, topics (array), improvement_hint

CONVERSA:
{histórico formatado com [CLIENTE], [BOT], [FRANQUEADO]}

Retorne APENAS o JSON, sem markdown.
```

## Camada 3 — Visualização

### 3A. Franqueado — Widget "Seu Vendedor Digital"

**Componente:** `src/components/dashboard/BotPerformanceCard.jsx`
**Local:** FranchiseeDashboard, após RankingStreak (antes do MarketingPaymentCard)

```
┌─────────────────────────────────────────┐
│  Seu Vendedor Digital — {mês}           │
│                                         │
│  Atendimentos     Vendas pelo Bot       │
│      47              12                 │
│                                         │
│  Precisaram da sua ajuda: 8             │
│  ─────────────────────────              │
│  Seus clientes mais perguntam sobre:    │
│  Lasanha · Frete · Horário de entrega   │
│                                         │
│  Dica: 3 clientes desistiram por frete  │
│  alto. Que tal revisar sua tabela?      │
└─────────────────────────────────────────┘
```

**Regras UX:**
- Sem gráficos, sem jargão técnico
- Ocultar se < 5 conversas no mês
- Dica traduz `abandon_reason` mais frequente em linguagem acionável

### 3B. Admin — Página `/BotIntelligence`

**Componente:** `src/pages/BotIntelligence.jsx`
**Acesso:** Menu admin, ícone `smart_toy`, label "Inteligência Bot"
**Filtros:** Mês (chevron) + Franquia (dropdown)

**Seção 1 — KPIs (grid-cols-3):**
- Taxa de Conversão: converted / total
- Resolução sem Humano: conversas sem direction='human' / total
- Score Médio do Bot: AVG(quality_score)

**Seção 2 — Funil de Conversas:**
- BarChart horizontal (Recharts): started → catalog_sent → checkout_started → converted/abandoned/escalated
- Cores brand red → gold

**Seção 3 — Insights Acionáveis:**
- Top motivos de abandono (bar chart horizontal)
- Top intents/buscas (bar chart)
- Top tópicos mencionados (lista numerada com contagem)

**Seção 4 — Ranking de Franquias:**
- Tabela: Franquia | Conversas | Conversão | Score Bot | Sem Humano | Principal Abandono
- Cores: score ≥8 verde, 5-7 amarelo, <5 vermelho
- Clique: drill-down com últimas 10 conversas (summary + score + outcome)

### 3C. Relatório Semanal (n8n → WhatsApp)

**Workflow:** "Weekly Bot Report", cron segunda-feira 8h (America/Sao_Paulo)

**Franqueado** (para `personal_phone_for_summary`):
```
📊 Resumo semanal do seu Vendedor Digital

Atendimentos: 12
Vendas fechadas: 4 (R$ 380)
Precisaram da sua ajuda: 3

💡 Dica da semana: [abandon_reason mais frequente traduzido]
```

**Admin:**
```
📊 Relatório Semanal Bot — Semana {período}

Total atendimentos: 156
Conversão geral: 24%
Score médio: 7.6

🏆 Melhor: {franquia} ({conversão}%, score {x})
⚠️ Atenção: {franquia} ({conversão}%, score {x})

Top abandono: {motivos}
🔧 Sugestão: {insight acionável}
```

## Schema — Migrations

### Migration `supabase/migration-bot-intelligence.sql`

```sql
-- Campos de classificação LLM em bot_conversations
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS intent TEXT
  CHECK (intent IN ('compra','duvida_produto','duvida_entrega','reclamacao',
                    'preparo_faq','preco','catalogo','saudacao','outro'));
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IN ('positivo','neutro','negativo','frustrado'));
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS quality_score SMALLINT
  CHECK (quality_score BETWEEN 1 AND 10);
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS quality_notes TEXT;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS tools_used TEXT[];
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS llm_abandon_reason TEXT
  CHECK (llm_abandon_reason IN ('preco','frete','indisponivel','demora',
                                 'confuso','sem_resposta','preferiu_humano','outro'));
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS outcome TEXT
  CHECK (outcome IN ('converted','abandoned','escalated','informational','ongoing'));
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS improvement_hint TEXT;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS processing_model TEXT;

-- NOTA: `abandon_reason` (sem prefixo) já existe na tabela mas nunca é populado pelo bot.
-- O campo LLM usa `llm_abandon_reason` para evitar ambiguidade.
-- O campo original `abandon_reason` pode ser populado futuramente pelo bot no momento da escalação.

-- Índices para queries do dashboard
CREATE INDEX IF NOT EXISTS idx_bc_franchise_status ON bot_conversations(franchise_id, status);
CREATE INDEX IF NOT EXISTS idx_bc_processed ON bot_conversations(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bc_intent ON bot_conversations(intent);
CREATE INDEX IF NOT EXISTS idx_bc_quality ON bot_conversations(quality_score);

-- RLS: corrigir policies existentes para incluir manager (padrão do projeto)
-- A policy atual usa role='admin' — DEVE usar is_admin_or_manager()
-- SELECT: is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
-- INSERT/UPDATE: is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())
-- DELETE: is_admin() (manager NÃO deleta, padrão do projeto)
```

### Entity em `src/entities/all.js`

```js
export const BotConversation = createEntity('bot_conversations');
```

## Arquivos

### Novos
| Arquivo | Fase |
|---|---|
| `supabase/migration-bot-intelligence.sql` | 1 |
| `src/components/dashboard/BotPerformanceCard.jsx` | 3 |
| `src/pages/BotIntelligence.jsx` | 3 |

### Modificados
| Arquivo | Alteração | Fase |
|---|---|---|
| `src/entities/all.js` | Adicionar BotConversation | 1 |
| V3 workflow (n8n) | Log Outbound/Inbound + upsert_bot_conversation | 1 |
| V4 workflow (n8n) | Mesmos ajustes | 1 |
| `src/components/dashboard/FranchiseeDashboard.jsx` | Adicionar BotPerformanceCard | 3 |
| `src/pages/pages.config.js` | Lazy load BotIntelligence | 3 |
| `src/App.jsx` | Rota + AdminRoute | 3 |
| Sidebar/nav admin | Item menu | 3 |

### Workflows n8n novos
| Workflow | Fase |
|---|---|
| Bot Conversation Analyzer (cron 30min) | 2 |
| Weekly Bot Report (cron segunda 8h) | 4 |

## Faseamento

| Fase | Escopo | Dependência |
|---|---|---|
| **1 — Captura** | Migrations + ajustes V3/V4 logs + popular bot_conversations | Nenhuma |
| **2 — Processamento** | Workflow classificador LLM (cron 30min) | Fase 1 (precisa de bot_conversations populado) |
| **3 — Visualização** | Widget franqueado + página admin | Fase 2 (precisa de dados classificados) |
| **4 — Relatório** | Workflow semanal WhatsApp | Fase 2 (precisa de dados classificados) |

Fases 3 e 4 são independentes entre si — podem rodar em paralelo.

## Custo mensal

**Premissa de volume:** ~1.500 msgs/dia ÷ ~10 msgs/conversa = ~150 conversas/dia = ~4.500/mês.
Validar contra dados reais de `conversation_messages` após Fase 1 (pode ser 100-300/dia dependendo das franquias ativas).

| Item | Custo (150 conv/dia) | Custo (300 conv/dia) |
|---|---|---|
| Gemini 2.5 Flash-Lite (classificação) | ~R$ 2-5 | ~R$ 5-10 |
| Supabase (incremental) | R$ 0 | R$ 0 |
| n8n (executions) | R$ 0 | R$ 0 |
| **Total** | **~R$ 5/mês** | **~R$ 10/mês** |

## Verificação

### Fase 1
- Rodar 5-10 conversas de teste no V3
- Conferir `bot_conversations` tem rows com status correto
- Conferir `conversation_messages` tem `conversation_id` preenchido
- Conferir `response_time_ms` e `metadata.segment` no Log Outbound

### Fase 2
- Disparar workflow manualmente
- Conferir 10 conversas classificadas
- Validar quality_score, intent e abandon_reason manualmente
- Testar fallback com JSON inválido

### Fase 3
- Widget franqueado: dados corretos, mobile responsivo, empty state
- Página admin: filtros funcionando, gráficos renderizando, drill-down
- Testar com franquia sem dados (empty state)

### Fase 4
- Disparar workflow manualmente
- Conferir formatação no WhatsApp (franqueado e admin)
- Testar com franquia sem conversas na semana
