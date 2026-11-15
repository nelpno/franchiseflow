# Review: Bot Coach Education Spec (2026-04-05)

**Reviewer**: Code Review Agent
**Spec**: `docs/superpowers/specs/2026-04-05-bot-coach-education-design.md`
**Verdict**: Spec bem estruturada, mas com 3 issues criticos e 5 importantes antes de implementar.

---

## CRITICAL (bloqueia implementacao)

### C1. Health Score: spec inventa 5a dimensao "Bot" mas pesos nao somam com sistema atual

**Problema**: O `healthScore.js` (linha 156) usa 4 dimensoes com pesos que somam 1.0 (`vendas: 0.35, estoque: 0.25, reposicao: 0.20, setup: 0.20`). A spec propoe redistribuir para 5 dimensoes (30+20+15+15+20=100), mas o CLAUDE.md documenta "4 dimensoes: vendas 35, estoque 25, reposicao 20, setup/WhatsApp 20" e alerta "DOIS sistemas: `healthScore.js` + `FranchiseHealthScore.jsx` -- atualizar AMBOS".

Adicionar uma 5a dimensao "Bot" requer:
- Novo parametro (`botConversations`) passado a `calculateHealthScore()` em TODOS os call sites
- Atualizar `FranchiseHealthScore.jsx` (componente visual)
- Atualizar `AlertsPanel.jsx` (que referencia dimensoes)
- Recalibrar pesos para franquias novas (`isNew` branch tambem precisa incluir bot)
- Nao quebrar o calculo para franquias SEM dados de bot (< 5 conversas)

**Acao**: A spec precisa detalhar: (a) branch `isNew` com bot, (b) fallback quando `bot_conversations` = 0 (score bot = 0 penaliza injustamente), (c) lista exaustiva de call sites a atualizar.

### C2. Metrics JSONB `health.score_bot` referencia dimensao que ainda nao existe

A estrutura JSONB (linha 130-136 da spec) inclui `score_bot: 16` -- mas essa dimensao so existira APOS implementar C1. A RPC `get_franchise_bot_stats` nao consegue retornar `score_bot` porque o calculo esta no frontend JS, nao no banco.

A spec nota "replicar logica no Code node n8n" mas nao detalha COMO calcular bot score server-side, especialmente os sub-criterios (autonomia >= 40%, quality_score >= 7, conversao >= 15%) que dependem de dados que a propria RPC estaria coletando. Dependencia circular.

**Acao**: Definir se o Code node n8n calcula health score completo (incluindo bot) OU se busca o score do frontend via API. Recomendo: Code node calcula apenas a dimensao bot, e o health total e recalculado no mesmo Code node usando os pesos documentados.

### C3. RPC `get_franchise_bot_stats` -- scope massivo sem definicao SQL

A spec lista 10 dimensoes com ~50 metricas agregadas de 10+ tabelas, mas fornece apenas uma descricao textual das fontes. Nao ha SQL skeleton. Algumas metricas sao problematicas:

- `stock_misses` requer cruzar `bot_conversations.topics[]` (JSONB array) com `inventory_items.quantity` -- query complexa com unnest + join
- `golden_hour_manual_count` requer definir "horario de pico" (nao especificado)
- `recurrence_rate` requer logica de contato recorrente vs novo (a tabela contacts tem `purchase_count` mas a spec nao diz se usa isso)
- `mix_diversity_count` nao define o que conta como "diverso"
- `marketing.leads_from_ads` requer contar `contacts.meta_referral_at` no periodo -- factivel
- `avg_intervention_delay_s` requer calcular tempo entre mensagem `direction='in'` e `direction='human'` -- factivel mas pesado

**Acao**: Fornecer SQL skeleton para as 3 queries mais complexas (stock_misses, golden_hour, intervention_delay) ou simplificar o escopo da Fase 1 para metricas diretamente disponíveis.

---

## IMPORTANT (deve corrigir antes de implementar)

### I1. RLS INSERT policy usa `WITH CHECK (true)` -- insegura

A policy "Service role insere" (`FOR INSERT WITH CHECK (true)`) permite que QUALQUER usuario autenticado insira em `bot_reports`. Service role ja bypassa RLS. Essa policy na pratica abre INSERT para todos.

**Acao**: Remover a policy INSERT (service role nao precisa dela) OU restringir com `WITH CHECK (is_admin())`.

### I2. Falta policy UPDATE

A spec define SELECT, INSERT e DELETE mas nao UPDATE. O workflow precisa fazer `UPDATE bot_reports SET sent_at = now()` apos enviar WhatsApp. Via service_role funciona, mas se algum frontend precisar atualizar (ex: marcar acao como "feita"), vai falhar silenciosamente.

**Acao**: Adicionar `FOR UPDATE USING (is_admin_or_manager())` ou documentar que UPDATE e exclusivamente via service_role.

### I3. Workflow SplitInBatches -- risco de `$json` override documentado no CLAUDE.md

CLAUDE.md alerta: "Dentro de `splitInBatches` loop, `$json` apos HTTP Request vira a resposta da API (NAO o item do loop). Referenciar dados PRE-request via `$('NodeAnterior')`."

O fluxo mostra `Get Franchise Stats` (HTTP/RPC) dentro do loop seguido de `Code Node: Calculate Profile`. O Code node precisara acessar dados da franquia (do Get All Franchises) E da RPC -- mas `$json` sera o resultado da RPC. A spec nao menciona como referenciar dados do loop item.

**Acao**: Documentar que o Code node deve acessar franquia via `$('SplitInBatches').item.json` e benchmarks via `$('Get Network Benchmarks').item.json`.

### I4. `continueOnFail` nao mencionado em nenhum no

CLAUDE.md e enfatico: "continueOnFail=true OBRIGATORIO em TODOS os nodes CAPI" e o padrao se aplica a qualquer side-effect (envio WhatsApp, INSERT). Se o envio WuzAPI falhar para uma franquia, o loop inteiro morre.

**Acao**: Especificar `continueOnFail=true` em: WuzAPI Send, Supabase INSERT, e UPDATE sent_at. O Code node Admin Summary deve contabilizar falhas.

### I5. Prompt LLM pede "mencione outras franquias pelo NOME" -- risco de privacidade

A spec diz "Mencione outras franquias pelo NOME quando comparar" e a decisao de design confirma "Nomes reais (franqueados se conhecem)". Mas o relatório vai via WhatsApp (texto plano) -- se um franqueado compartilhar a mensagem, dados financeiros de outros ficam expostos.

**Acao**: Considerar usar apenas cidade/posicao ("o 1o lugar em Itatiba") em vez de dados financeiros de outros. Ou limitar comparacao a metricas nao-financeiras (autonomia, mix).

---

## MINOR (sugestoes)

### M1. `metrics` JSONB tem 10 dimensoes mas spec diz "9 dimensoes"

O titulo e contexto mencionam "9 dimensoes", mas o JSONB tem: bot, commercial, operational, pricing, delivery, financial, health, pipeline, supply, marketing = **10**. Inconsistencia cosmética mas confusa.

### M2. Tabela nao tem campo `updated_at`

Todas as entities do projeto tem `updated_at` (gerenciado por trigger). `bot_reports` nao inclui -- nao e critico (reports sao imutaveis) mas quebra o padrao.

### M3. Meta financeira referencia `DailyGoalProgress` sem detalhar

A spec diz "meta diaria atual x 1.05 (5% acima, mais conservador que os 10% do DailyGoalProgress)" -- mas nao explica de onde vem a meta diaria atual. Se vem de `sales_goals` tabela, precisa confirmar que a entity existe (nao esta no `all.js` atual, apenas mencionada como tabela).

### M4. Sem rate limiting no botao "Gerar relatorio avulso"

A aba Coaching do admin tera "Gerar relatorio avulso" que dispara webhook n8n. Sem throttle, um admin pode gerar dezenas de relatorios e estourar cota Gemini.

### M5. Sheet com Recharts -- verificar lazy loading

O `BotCoachSheet.jsx` usa Recharts para grafico de evolucao. Recharts ja esta no chunk `manualChunks` do Vite config, mas o Sheet e carregado dentro do FranchiseeDashboard (que NAO e lazy-loaded por estar no dashboard principal). Confirmar que nao impacta TTI.

### M6. Spec nao define formato de `action_items` JSONB

A tabela define `action_items JSONB` com comentario `[{priority, category, message, impact_estimate}]` mas nao detalha: priority e numero ou string? category e enum? impact_estimate e em R$?

---

## O que esta BEM

- **franchise_id como TEXT (evolution_instance_id)** -- correto, alinhado com CLAUDE.md
- **DELETE policy com `is_admin()`** -- correto, segue padrao
- **Entity pattern `createEntity('bot_reports')`** -- correto
- **Telefone com prefixo 55 para envio** -- correto, alinhado com `personal_phone_wa` da view
- **Reuso do Weekly Bot Report workflow** -- pragmatico, evita proliferacao
- **Metas progressivas calculadas no Code node** -- correto, evita logica no banco
- **Fases de entrega bem sequenciadas** -- dependencias claras
- **Prompt com regras anti-alucinacao** -- "NUNCA invente dados", "NUNCA loja fisica"
- **Custo estimado realista** -- R$ 0.15/mes e conservador para Flash
