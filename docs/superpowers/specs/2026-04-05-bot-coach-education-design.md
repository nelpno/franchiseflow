# Bot Coach Education — Spec de Design

## Contexto

O Bot Intelligence (classificação LLM de conversas, dashboard admin, widget franqueado) está ativo desde 04/04/2026. Dados acumulando — autonomia varia 0-83% entre franquias, 32% vendas via bot, abandono por frete/preço/estoque são padrões recorrentes.

**Problema**: franqueados não sabem O QUE FAZER com os dados. Guarapiranga intervém demais, Cajamar ignora o bot, ninguém sabe que perde R$ por estoque zerado. Os dados existem mas não educam.

**Solução**: Sistema "Coach de Negócio" que transforma dados reais de 9 dimensões em relatórios quinzenais personalizados via WhatsApp + evolui o dashboard existente com histórico e insights acionáveis.

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Canal primário | WhatsApp (WuzAPI) quinzenal |
| Canal secundário | BotPerformanceCard expandido (Sheet com detalhes) |
| Tom de comunicação | Coach direto — dados + ação concreta |
| Privacidade ranking | Nomes reais (franqueados se conhecem) |
| Geração de conteúdo | LLM automático (Gemini 2.5 Flash) |
| Metas | Progressivas por perfil (beginner/intermediate/advanced) |
| App UX | Evoluir card existente, sem nova rota |

---

## 1. Modelo de Dados

### Tabela `bot_reports`

```sql
CREATE TABLE bot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,  -- evolution_instance_id
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  profile_tier TEXT NOT NULL CHECK (profile_tier IN ('beginner', 'intermediate', 'advanced')),
  autonomy_rate NUMERIC,
  autonomy_target NUMERIC,
  ranking_position INT,
  ranking_total INT,
  metrics JSONB NOT NULL,      -- dados brutos por dimensão (ver estrutura abaixo)
  action_items JSONB,          -- [{priority, category, message, impact_estimate}]
  report_text TEXT,             -- texto WhatsApp gerado pelo LLM
  llm_model TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_bot_reports_franchise ON bot_reports(franchise_id, report_period_end DESC);
CREATE INDEX idx_bot_reports_period ON bot_reports(report_period_end);

-- RLS
ALTER TABLE bot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e manager veem todos" ON bot_reports
  FOR SELECT USING (is_admin_or_manager());

CREATE POLICY "Franqueado vê os seus" ON bot_reports
  FOR SELECT USING (franchise_id = ANY(managed_franchise_ids()));

-- INSERT/UPDATE apenas via service_role (n8n). Sem policy explícita = bloqueado para users normais.
-- service_role bypassa RLS automaticamente.

CREATE POLICY "Admin deleta" ON bot_reports
  FOR DELETE USING (is_admin());

-- NOTA: INSERT e UPDATE não têm policy para users autenticados.
-- n8n usa service_role key que bypassa RLS.
-- UPDATE necessário para SET sent_at após envio WhatsApp.
```

### Estrutura do `metrics` JSONB

```json
{
  "bot": {
    "autonomy": 45.2,
    "prev_autonomy": 38.0,
    "conversations": 42,
    "escalated": 3,
    "dropoff_first_msg_pct": 12.5,
    "avg_quality_score": 7.8,
    "avg_intervention_delay_s": 45,
    "peak_hours": [{"hour": 19, "conversations": 8, "conversions": 3}, ...],
    "top_abandon_reasons": [{"reason": "frete", "count": 5, "fixable": true}, ...]
  },
  "commercial": {
    "bot_ticket_avg": 90.04,
    "manual_ticket_avg": 110.50,
    "bot_sales_count": 8,
    "bot_revenue": 720.32,
    "mix_diversity_count": 4,
    "network_mix_avg": 6,
    "top_products_bot": [{"product": "Nhoque Batata", "qty": 12, "revenue": 360, "margin_pct": 50}],
    "recurrence_rate": 0.35,
    "golden_hour_manual_count": 5
  },
  "operational": {
    "setup_pct": 75,
    "onboarding_pending": ["Foto catálogo", "Tabela de frete"],
    "stock_misses": [{"product": "Ravioli", "times_mentioned": 12, "times_empty": 4, "est_lost_revenue": 360}],
    "reorder_timing_days": 2,
    "inactive_day_msgs": [{"day": "domingo", "count": 15}],
    "whatsapp_connected": true
  },
  "pricing": {
    "above_network": [{"product": "Nhoque Batata", "price": 25, "network_avg": 20}],
    "below_network": [],
    "abandon_by_price_count": 4
  },
  "delivery": {
    "abandon_by_frete_count": 5,
    "radius_km": 5,
    "payment_methods_count": 2,
    "free_shipping": false,
    "avg_frete": 10.00
  },
  "financial": {
    "total_revenue": 3200.00,
    "prev_revenue": 2850.00,
    "revenue_growth_pct": 12.3,
    "expenses_total": 384.00,
    "expenses_pct": 12.0,
    "network_expenses_pct": 8.0,
    "margin_pct": 42.0,
    "network_margin_pct": 48.0,
    "streak_days": 8,
    "goal_hit_days": 8,
    "goal_total_days": 14
  },
  "health": {
    "score_total": 71,
    "prev_score": 62,
    "score_vendas": 25,
    "score_estoque": 18,
    "score_reposicao": 12,
    "score_setup": 10,
    "score_bot": 16
  },
  "pipeline": {
    "new_leads": 12,
    "converted_to_client": 7,
    "recurrent": 3,
    "stale_leads_7d": 8,
    "total_contacts": 92,
    "prev_total_contacts": 80,
    "contacts_growth_pct": 15.0
  },
  "supply": {
    "orders_count": 2,
    "avg_delivery_days": 4.5,
    "network_avg_delivery_days": 3.0,
    "ideal_order_frequency": 3,
    "actual_frequency": 2
  },
  "marketing": {
    "investment": 500,
    "leads_from_ads": 12,
    "conversions_from_ads": 4,
    "ad_revenue": 360,
    "cpa": 125
  }
}
```

### RPCs

#### `get_franchise_bot_stats(p_franchise_id TEXT, p_start DATE, p_end DATE)`
SECURITY DEFINER. Agrega dados de 9 dimensões para uma franquia/período.

Fontes por dimensão:
- **bot**: `bot_conversations` + `conversation_messages` (direction='human')
- **commercial**: `sales` + `sale_items` (source='bot' vs 'manual')
- **operational**: `onboarding_checklists` + `inventory_items` + `bot_conversations.topics[]`
- **pricing**: `sale_items.sale_price` vs rede
- **delivery**: `franchise_configurations` + `bot_conversations.llm_abandon_reason`
- **financial**: `sales` + `expenses` + `daily_summaries`
- **health**: chamada ao cálculo existente em `healthScore.js` (replicar lógica no SQL ou calcular no Code node n8n)
- **pipeline**: `contacts` com status pipeline
- **supply**: `purchase_orders` com timestamps de status
- **marketing**: `marketing_payments` + `contacts.meta_referral_at`

> **Nota**: Health Score atualmente é calculado no frontend (`healthScore.js`). Para o relatório, replicar a lógica essencial no Code node n8n (não duplicar no SQL — a fonte de verdade fica no JS).

> **Decisão C1 — Health Score Bot**: A nova dimensão Bot (20pts) é calculada no Code node n8n para o relatório E no frontend `healthScore.js` para o dashboard. Ambos usam a mesma fórmula (autonomia 10pts + quality 5pts + conversão 5pts). Arquivos a atualizar: `src/lib/healthScore.js`, `src/components/dashboard/FranchiseHealthScore.jsx`, `src/components/acompanhamento/` (se renderiza scores). Para franquias sem dados de bot (novas ou sem WhatsApp conectado), score_bot = 0 e o peso é redistribuído proporcionalmente entre as outras 4 dimensões.

> **Decisão C2 — Onde calcular score_bot**: NÃO no SQL (evitar dependência circular). O Code node n8n calcula `score_bot` a partir de dados brutos de `bot_conversations` + `conversation_messages` + `sales`. O frontend calcula independentemente com os mesmos dados que já carrega. Nenhuma RPC retorna score_bot — ele é sempre computado pelo consumidor.

> **Decisão C3 — RPCs como Code nodes**: As RPCs `get_franchise_bot_stats` e `get_network_benchmarks` serão implementadas como **queries SQL simples chamadas via HTTP Request** no n8n, NÃO como funções PL/pgSQL monolíticas. Cada dimensão é uma query separada (bot, commercial, operational, etc). O Code node "Calculate Profile & Targets" agrega os resultados. Isso é mais manutenível e debugável que uma RPC de 200 linhas.

#### `get_network_benchmarks(p_start DATE, p_end DATE)`
SECURITY DEFINER. Calcula médias da rede para cada dimensão:
- Autonomia média, ticket médio, mix médio, margem média, etc.
- Top 3 franquias por autonomia (para menção no ranking)
- Top 3 por margem, por crescimento, por recorrência

### Metas Progressivas

Calculadas no Code node n8n (não no banco):

| Perfil | Autonomia atual | Meta | Fórmula |
|--------|----------------|------|---------|
| beginner | < 30% | atual + 15pp | Salto grande, motivar início |
| intermediate | 30-60% | atual + 10pp | Crescimento consistente |
| advanced | > 60% | min(atual + 5pp, 95%) | Refinamento, teto realista |

Meta financeira: meta diária atual × 1.05 (5% acima, mais conservador que os 10% do DailyGoalProgress)

---

## 2. Melhorias no Dashboard Existente

### 2.1 BotPerformanceCard → "Meu Desempenho" expandido

**Arquivo**: `src/components/dashboard/BotPerformanceCard.jsx`

**Mudanças no card atual**:
- Adicionar seta ↑↓ comparando métricas com período anterior (como PeriodComparisonCard)
- Trocar "dica inteligente" estática por insight dinâmico das 9 dimensões
- Adicionar botão "Ver detalhes"

**Sheet de detalhes** (novo componente `BotCoachSheet.jsx`):
- Histórico de relatórios quinzenais (lista com resumo)
- Gráfico de evolução da autonomia (últimos 3 meses, Recharts)
- Progresso da meta progressiva (barra visual)
- Últimas 3 ações recomendadas + status (feito/pendente)
- Entity: `BotReport` em `src/entities/all.js`

### 2.2 Health Score — nova dimensão Bot

**Arquivos**: `src/lib/healthScore.js` + `src/components/dashboard/FranchiseHealthScore.jsx`

**Redistribuição de pesos**:
| Dimensão | Antes | Depois |
|----------|-------|--------|
| Vendas | 35 | 30 |
| Estoque | 25 | 20 |
| Reposição | 20 | 15 |
| Setup/WhatsApp | 20 | 15 |
| **Bot** | — | **20** |

**Cálculo dimensão Bot** (20 pontos):
- Autonomia ≥ 40%: +10pts (proporcional abaixo)
- quality_score médio ≥ 7: +5pts (proporcional)
- Taxa conversão bot ≥ 15%: +5pts (proporcional)

### 2.3 AlertsPanel — alertas de coaching (admin)

**Arquivo**: `src/components/dashboard/AlertsPanel.jsx`

Novos tipos de alerta (além de estoque baixo):
- **Intervenção excessiva**: franquia com avg_human_msgs > 3/conversa
- **Bot inativo**: 0 conversas em 7 dias
- **Leads parados**: > 5 leads em `em_negociacao` há > 7 dias
- **Stock miss alto**: > 3 stock misses na semana
- **Setup incompleto com impacto**: setup < 50% E autonomia < 20%

Priorização: vermelho (ação urgente) = stock miss + bot inativo. Amarelo = intervenção + leads.

### 2.4 BotIntelligence — aba Coaching (admin)

**Arquivo**: `src/pages/BotIntelligence.jsx`

Nova aba "Coaching" ao lado de "Visão Geral":
- Lista de últimos relatórios por franquia (data, profile_tier, autonomia, enviado?)
- "Insights da Rede" — padrões cross-franquia ("40% das franquias perdem vendas por stock-out de Nhoque")
- Botão "Gerar relatório avulso" (dispara webhook n8n para uma franquia específica)

### 2.5 SmartActions — insights do Coach

**Arquivo**: `src/lib/smartActions.js`

Alimentar SmartActions com dados do último `bot_reports`:
- Stock misses → "Repor [produto] (mencionado X vezes pelo bot, estoque zerado)"
- Leads parados → "Follow-up em X leads parados há Y dias"
- Frete abandono → "Revisar tabela de frete (X abandonos)"

---

## 3. Workflow n8n — "Bot Coach Report"

### Adaptação do Weekly Bot Report (`JSzGEHQBo6Jmxhi3`)

**Cron**: `0 8 1,15 * *` (1º e 15º do mês, 8h São Paulo)

### Fluxo de nós

**REGRAS n8n aplicáveis**: Todos os nós dentro do loop DEVEM ter `continueOnFail: true` — falha em uma franquia NÃO pode matar o loop. Referência a dados PRÉ-loop dentro do SplitInBatches via `$('NodeAnterior')` (NÃO `$json` que é sobrescrito). Output explícito em Code nodes (NUNCA `...item.json`).

```
Schedule Trigger (1º e 15º, 8h)
  ↓
Get All Franchises (HTTP Request → Supabase REST)
  - Query: franchise_configurations com personal_phone_for_summary
  ↓
Get Network Benchmarks (HTTP Request → Supabase REST)
  - ~5 queries agregadas (autonomia avg, ticket avg, margem avg, top 3 por métrica)
  - Resultado salvo para uso no loop via $('Get Network Benchmarks')
  ↓
SplitInBatches (loop por franquia)
  ↓
  Get Franchise Stats (HTTP Request → Supabase REST, continueOnFail: true)
    - 9 queries por dimensão (bot, commercial, operational, etc.)
    - Franchise ID do item atual do batch
  ↓
  Get Previous Report (HTTP Request → Supabase REST, continueOnFail: true)
    - Query: último bot_reports desta franquia ORDER BY report_period_end DESC LIMIT 1
  ↓
  Code Node: Calculate Profile & Targets (continueOnFail: true)
    - Determina profile_tier (beginner/intermediate/advanced) baseado em autonomy
    - Calcula meta progressiva (beginner +15pp, intermediate +10pp, advanced +5pp)
    - Calcula score_bot (autonomia 10pts + quality 5pts + conversão 5pts)
    - Prioriza action_items por impacto estimado em R$
    - Monta JSON completo para o LLM
    - Output: { json: { franchise_id, metrics, benchmarks, previous, prompt_data } }
  ↓
  Gemini 2.5 Flash: Generate Report Text (continueOnFail: true)
    - Prompt com 6 seções (ver abaixo)
    - Max 1500 chars (limite WhatsApp legível)
    - Formato: texto corrido com emojis moderados
  ↓
  Supabase: INSERT bot_reports (continueOnFail: true)
    - Salva metrics, action_items, report_text, llm_model
  ↓
  IF personal_phone_for_summary exists
    ├── TRUE: WuzAPI Send WhatsApp (continueOnFail: true)
    │   - Para: 55 + personal_phone_for_summary (11 dígitos → prefixo 55)
    │   - Texto: report_text
    │   - Após envio: UPDATE bot_reports SET sent_at = now()
    └── FALSE: No Phone (Set node com output — REGRA: todos caminhos IF devem ter nó)
  ↓
[Fim loop]
  ↓
Code Node: Admin Summary
  - Consolida: total enviados, falhas, insights da rede
  ↓
WuzAPI: Envia resumo para Nelson (admin)
```

### Prompt LLM Coach

```
Você é o Coach de Negócios da rede Maxi Massas. Gere um relatório
quinzenal PERSONALIZADO para a franquia {franchise_name} ({city}).

TOM: Coach direto e motivador. Use dados concretos. Diga O QUE FAZER,
não só o que está errado. Mencione outras franquias pelo NOME quando
comparar. Máximo 1500 caracteres.

PERFIL: {profile_tier}
- beginner: foque em educação básica, celebre pequenas vitórias
- intermediate: foque em otimização, compare com top performers
- advanced: foque em refinamento, desafie a manter liderança

DADOS DESTA FRANQUIA:
{metrics JSON}

BENCHMARKS DA REDE:
{benchmarks JSON}

RELATÓRIO ANTERIOR:
{previous_report_text ou "Primeiro relatório"}

REGRAS:
- NUNCA invente dados. Use APENAS os números fornecidos.
- NUNCA mencione "loja física" — franquias são home-based.
- Valores em R$ sempre formatados (R$ 1.234,56).
- Abandono "fixável" (frete, preço, estoque) = ação do franqueado.
- Abandono "não-fixável" (confuso, demora) = ação do admin (não mencionar).
- Se autonomia < 30%: enfatize que intervir MENOS = vender MAIS.
- Se stock_misses > 0: calcule receita perdida estimada.
- Se golden_hour_manual_count > 3: "Essas vendas manuais no horário de pico
  poderiam ter sido feitas pelo bot."

GERE exatamente 6 seções:

📊 RESUMO
3 frases: health score + principal evolução + tom geral da quinzena.

🏆 VITÓRIAS
2-3 conquistas concretas com números. Reforço positivo.

⚡ AÇÃO IMEDIATA
TOP 2 ações priorizadas por impacto em R$. Seja específico:
"Reponha Ravioli (12 menções, 4 stock-outs, ~R$360 perdidos)"

🏅 RANKING
Posição X de Y. Quem é o benchmark e por quê (nome real).
Se subiu posições, celebrar. Se caiu, dizer por quê.

👥 PIPELINE
Estado dos leads. Follow-up necessário. Base crescendo?

🎯 META
Meta de autonomia: {target}% (atual {current}%).
Meta financeira: streak de {goal_hit} dias, manter/melhorar.
```

### Credenciais e configs

| Item | Valor |
|------|-------|
| Gemini credential | `ezQN27UjYZVHyDEf` (já usada no Analyzer) |
| Supabase credential | `mIVPcJBNcDCx21LR` (service_role) |
| WuzAPI | `zuck.dynamicagents.tech` + admin token |
| Telefone admin | **PENDENTE** — configurar |

### Custo estimado
- Gemini 2.5 Flash: ~R$ 0.15/mês (12 franquias × 2 relatórios)
- WuzAPI: já incluso na infra existente
- Total adicional: **~R$ 0.15/mês**

---

## 4. Entity e Frontend

### Entity `BotReport`

```javascript
// Em src/entities/all.js
export const BotReport = createEntity('bot_reports');
```

### Componente `BotCoachSheet.jsx`

**Localização**: `src/components/dashboard/BotCoachSheet.jsx`

**Props**: `franchiseId`, `isOpen`, `onClose`

**Conteúdo do Sheet**:
1. **Header**: "Seu Coach Quinzenal" + profile_tier badge
2. **Evolução**: gráfico Recharts (autonomia + health score últimos 3 meses)
3. **Último relatório**: texto completo do último report_text
4. **Meta atual**: barra de progresso autonomia_target
5. **Histórico**: lista compacta dos últimos 6 relatórios (data + resumo 1 linha)
6. **Ações pendentes**: action_items do último relatório

---

## 5. Verificação

### Testes end-to-end

1. **Queries**: Executar as 9 queries por dimensão via HTTP Request para uma franquia com dados (ex: Itatiba) e verificar que o Code node agrega todas as dimensões corretamente
2. **Workflow**: Disparar manualmente o workflow para 1 franquia, verificar que:
   - `bot_reports` recebe INSERT com metrics + report_text
   - WhatsApp recebe mensagem legível e acionável
   - Texto tem ≤ 1500 chars
3. **Dashboard**:
   - BotPerformanceCard mostra setas de tendência
   - "Ver detalhes" abre Sheet com dados reais
   - Health Score inclui dimensão Bot
   - AlertsPanel mostra alertas de coaching
4. **BotIntelligence**: aba Coaching lista relatórios gerados
5. **SmartActions**: novas ações aparecem baseadas em bot_reports

### Critérios de sucesso

- Franqueado lê o relatório WhatsApp e sabe exatamente 2 coisas para mudar
- Admin vê panorama de coaching de toda a rede em uma tela
- Metas progressivas são realistas (franquia iniciante não recebe meta de 80%)
- Nenhum relatório menciona "loja física" ou dados inventados
- Custo total < R$ 1/mês

---

## 6. Edge Cases

| Cenário | Comportamento |
|---------|--------------|
| Franquia nova (0 conversas) | Pular no loop. Não gerar relatório. profile_tier = 'beginner' quando houver dados |
| Franquia sem personal_phone | Gerar e salvar bot_reports (para o app), mas NÃO enviar WhatsApp. sent_at fica NULL |
| Franquia sem WhatsApp conectado | Gerar relatório com alerta "WhatsApp desconectado — bot inativo" como ação imediata |
| < 5 conversas no período | Gerar relatório simplificado: "Dados insuficientes para análise completa. Foco: conectar WhatsApp e deixar o bot atuar." |
| LLM falha na geração | continueOnFail salva bot_reports com report_text = NULL. Admin summary reporta falha. Retry manual via botão avulso |
| WuzAPI falha no envio | bot_reports salvo com sent_at = NULL. Admin summary reporta falha. Retry manual |
| Primeiro relatório (sem anterior) | Prompt recebe "Primeiro relatório" em vez de texto anterior. Seção RANKING sem comparação de evolução |
| Franquia sem expenses cadastradas | margin_pct calculada apenas com cost_price dos sale_items. expenses_pct = 0, nota no relatório |
| Franquia sem inventory_items | stock_misses = []. Seção não mencionada no relatório |
| Health Score com score_bot = 0 | Peso redistribuído proporcionalmente dos novos pesos (30:20:15:15): vendas 37.5, estoque 25, reposição 18.75, setup 18.75 (arredondar para 38+25+19+18=100) |

---

## Dependências

- Dados de bot_conversations acumulando desde 04/04 (mínimo 1 semana antes de primeiro relatório)
- `personal_phone_for_summary` preenchido nas franchise_configurations
- WuzAPI token e telefone admin configurados
- Health Score atual em `healthScore.js` (lógica será referenciada, não duplicada)

## Fases de Entrega

| Fase | Escopo | Dependência |
|------|--------|-------------|
| 1 | Tabela + RPCs + Entity | Nenhuma |
| 2 | Workflow n8n (query + LLM + envio) | Fase 1 + WuzAPI config |
| 3 | BotPerformanceCard expandido + BotCoachSheet | Fase 1 |
| 4 | Health Score bot + AlertsPanel coaching | Fase 1 |
| 5 | BotIntelligence aba Coaching + SmartActions | Fases 1-3 |
