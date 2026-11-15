# Análise Bot Intelligence — Maxi Massas
**Data**: 05/04/2026 | **Período analisado**: 26/03–05/04/2026 | **Versão**: v2

---

## Resumo Executivo

- **525 conversas** capturadas em 27 franquias (10 dias)
- **Apenas 49 processadas pelo LLM (9.3%)** — pipeline de classificação quebrado
- **256 vendas bot** (32% do total), R$ 23.051 faturamento, ticket médio R$ 90,04
- **ZERO conversões registradas** no funil — EnviaPedidoFechado não atualiza status
- **Taxa de autonomia média**: ~40% (varia de 0% a 83% entre franquias)
- **28% de dropoff na 1ª mensagem** — saudação do bot precisa gancho comercial
- **ROI estimado**: 878x (R$ 23K gerado / R$ 26 custo Gemini)

---

## 1. ANÁLISE OPERACIONAL

### 1.1 Estado do Pipeline de Classificação

| Métrica | Valor | Avaliação |
|---------|-------|-----------|
| Total conversas | 525 | 27 franquias ativas |
| Processadas (LLM) | 21 (4%) | gemini-2.5-flash |
| Heuristic-bootstrap | 7 (1.3%) | Classificação sem LLM |
| Erros de parse | 19 (3.6%) | JSON com markdown fences |
| Skipped | 2 (0.4%) | — |
| **Pendentes** | **476 (90.7%)** | **Backlog crítico** |

**Root cause**: Gemini 2.5 Flash retorna JSON wrappado em \`\`\`json\`\`\` fences. O parser do Analyzer não faz strip desses delimitadores, causando `Parse falhou:` em 38.8% das tentativas.

**Fix**: Strip markdown fences antes de `JSON.parse()` no Code node do Analyzer.

### 1.2 Taxa de Autonomia por Franquia

Autonomia = conversas sem NENHUMA mensagem `direction='human'` / total conversas.

#### Top 10 (melhor autonomia)

| # | Franquia | Conv | Sem Humano | Autonomia |
|---|----------|------|------------|-----------|
| 1 | Ribeirão Preto | 3 | 3 | 100.0%* |
| 2 | Itatiba | 12 | 10 | 83.3% |
| 3 | Cataguases | 17 | 13 | 76.5% |
| 4 | Bauru | 24 | 17 | 70.8% |
| 5 | São Miguel Paulista | 29 | 18 | 62.1% |
| 6 | Vila Socorro SP | 14 | 8 | 57.1% |
| 7 | Sorocaba Sta Rosália | 11 | 6 | 54.5% |
| 8 | Suzano | 22 | 12 | 54.5% |
| 9 | Assis | 19 | 9 | 47.4% |
| 10 | Hortolândia | 17 | 8 | 47.1% |

*Volume baixo, dado não conclusivo.

#### Bottom 5 (franqueado intervém demais)

| # | Franquia | Conv | Sem Humano | Autonomia |
|---|----------|------|------------|-----------|
| 1 | Cajamar | 18 | ~0 | ~0% |
| 2 | Embu das Artes | 30 | 2 | 6.7% |
| 3 | Guarapiranga | 40 | 3 | 7.5% |
| 4 | Osasco | 20 | 3 | 15.0% |
| 5 | S. José do Rio Preto | 20 | 4 | 20.0% |

**Insight**: Guarapiranga tem 40 conversas, 177 msgs humanas, mas apenas **1 venda bot** (R$ 82,80). O franqueado intercepta o bot mas não converte. Contraste com Guarujá: 260 msgs humanas, mas 27 vendas bot (R$ 2.381). **Intervenção estratégica funciona; intervenção ansiosa prejudica.**

### 1.3 Motivos de Intervenção Humana

Total mensagens humanas: **1.499** (31.6% de todas as msgs).

Categorização por amostragem (30 últimas):

| Categoria | % estimado | Exemplos |
|-----------|-----------|----------|
| Venda ativa (franqueado assume) | ~40% | "3 Sofiolis de presunto e muçarela", "Temos Molhos caseiros também" |
| Pós-venda/logística | ~25% | "O item está a caminho! Acompanhe: [link Uber]", "Segue comprovante" |
| Correção de erro | ~15% | "Dei desconto de R$1 porque SOFIOLLI foi cobrado R$38,90 e o valor é R$37,90" |
| Cortesia/relacionamento | ~15% | "Muito obrigado", "Obrigada pela compra", "Desculpa o transtorno" |
| Endereço/confirmação | ~5% | "Esse endereço correto?", "Rua professor Napoleão Dorea, 622" |

**Ranking de msgs humanas por franquia:**

| Franquia | Msgs Humanas | Conversas | Média/conv |
|----------|-------------|-----------|-----------|
| Guarujá | 260 | 42 | 6.2 |
| Guarapiranga | 177 | 40 | 4.4 |
| Campo Belo | 108 | 23 | 4.7 |
| Suzano | 100 | 22 | 4.5 |
| Santo André | 92 | 45 | 2.0 |
| Cajamar | 90 | 18 | 5.0 |
| S. José Rio Preto | 86 | 20 | 4.3 |
| Hortolândia | 82 | 17 | 4.8 |

### 1.4 Funil de Status

| Status | Total | % | Observação |
|--------|-------|---|------------|
| abandoned | 324 | 61.7% | Maioria |
| started | 192 | 36.6% | Nunca progrediram |
| escalated | 5 | 1.0% | — |
| items_discussed | 2 | 0.4% | — |
| catalog_sent | 2 | 0.4% | — |
| **converted** | **0** | **0%** | **BUG: EnviaPedidoFechado não atualiza** |

**PROBLEMA GRAVE**: O workflow EnviaPedidoFechado V2 (`RnF1Jh6nDUj0IRHI`) nunca chama `upsert_bot_conversation` com `p_status='converted'` após criar a venda. O funil fica permanentemente quebrado.

### 1.5 Qualidade do Bot (quality_score)

| Score | Conversas | % | Interpretação |
|-------|-----------|---|--------------|
| 1-3 | 4 | 8.2% | Bot não participou / franqueado assumiu direto |
| 4 | 2 | 4.1% | Bot apresentou mas não engajou |
| **5** | **27** | **55.1%** | **Bot funcional mas sem fechamento** |
| 6-7 | 5 | 10.2% | Atendimento ok |
| 8-9 | 11 | 22.4% | Bom atendimento |
| 10 | 0 | 0% | Nenhuma conversa perfeita |

**Padrão dominante (score 5)**: Bot saudou, mostrou catálogo, respondeu perguntas, mas **não puxou para o fechamento**. Falta "killer instinct" de vendedor.

**Exemplos de scores baixos:**
- **Score 1**: "Franqueado enviou msg promocional (siga nosso Instagram) sem bot participar"
- **Score 2**: "Franqueado respondeu 'Ele chegou' fora de contexto"
- **Score 3**: "Cliente pediu 3 canelones para próxima semana, bot ficou mudo"

### 1.6 Dropoff Primeira Mensagem

Conversas com ≤1 mensagem (cliente mandou e desistiu ou bot não respondeu):

| Franquia | Total | Dropoff | % |
|----------|-------|---------|---|
| Jd. Santa Maria | 28 | 19 | **67.9%** |
| Embu das Artes | 30 | 18 | **60.0%** |
| Bauru | 24 | 14 | **58.3%** |
| Itatiba | 12 | 6 | 50.0% |
| Jd. Marajoara | 44 | 20 | 45.5% |
| Guarapiranga | 40 | 15 | 37.5% |
| ... | ... | ... | ... |
| Vila Maria | 26 | 2 | 7.7% |
| Cataguases | 17 | 0 | **0%** |
| Osasco | 20 | 0 | **0%** |

**Média da rede**: ~28%. Franquias com >50% precisam revisão urgente da saudação do bot.

### 1.7 Distribuição de Msgs por Conversa

| Faixa | Conversas | % |
|-------|-----------|---|
| 0 msgs | 7 | 1.3% |
| 1 msg | 141 | 26.9% |
| 2-5 msgs | 150 | 28.6% |
| 6-10 msgs | 71 | 13.5% |
| 11-20 msgs | 79 | 15.0% |
| 20+ msgs | 78 | 14.9% |

28% morrem com 1 msg. 15% têm 20+ msgs (negociações longas ou bot preso em loop).

### 1.8 Tempo de Resposta

**`response_time_ms` = 0 valores populados**. O V3 não envia esse campo no `log_conversation_message`. Gap crítico de instrumentação — sem isso, não sabemos se o bot demora demais para responder (possível causa de dropoff).

### 1.9 Tools Usadas pelo Bot

| Tool | Usos | % |
|------|------|---|
| catalogo | 13 | 43% |
| memoria | 9 | 30% |
| frete | 4 | 13% |
| estoque | 2 | 7% |
| EnviarCatalogo1 | 1 | 3% |
| preco | 1 | 3% |

**Ausência notável**: Pedido_Checkout1 não aparece — reforça que o checkout não está sendo acionado pelo bot ou não está sendo logado.

---

## 2. ANÁLISE COMERCIAL

### 2.1 Vendas Bot vs Manual

| Source | Vendas | Faturamento | Ticket Médio |
|--------|--------|-------------|-------------|
| Manual | 542 (68%) | R$ 51.091 | R$ 94,27 |
| Bot | 256 (32%) | R$ 23.051 | R$ 90,04 |
| **Total** | **798** | **R$ 74.142** | R$ 92,91 |

Diferença de ticket médio: R$ 4,23 (-4.5%). Bot vende um pouco menos por venda.

### 2.2 Vendas Bot por Franquia (top 10)

| Franquia | Vendas Bot | Fat Bot | Vendas Total | % Bot |
|----------|-----------|---------|-------------|-------|
| Campo Belo | 35 | R$ 3.974 | 35 | 100% |
| Guarujá | 27 | R$ 2.381 | 62 | 43.5% |
| Santo André | 25 | R$ 2.187 | 46 | 54.3% |
| São Miguel | 21 | R$ 1.701 | 47 | 44.7% |
| Itatiba | 20 | R$ 1.882 | 27 | 74.1% |
| Suzano | 15 | R$ 1.155 | 35 | 42.9% |
| Sorocaba Sta Rosália | 13 | R$ 1.318 | 17 | 76.5% |
| Vila Socorro | 12 | R$ 1.094 | 24 | 50.0% |
| Vila Maria | 10 | R$ 768 | 52 | 19.2% |
| Bauru | 10 | R$ 875 | 24 | 41.7% |

**Destaques**:
- Campo Belo: 100% das vendas via bot — franqueado depende totalmente do bot
- Guarapiranga: 40 conversas → apenas 1 venda bot (R$ 82) — pior conversão da rede
- Jd. Marajoara: 44 conversas → 7 vendas bot (16%) — algo impede conversão

### 2.3 Correlação Conversas → Vendas

| Franquia | Conversas | Vendas Bot | Taxa Conv→Venda |
|----------|-----------|-----------|-----------------|
| São Miguel | 29 | 21 | **72%** |
| Guarujá | 42 | 27 | **64%** |
| Santo André | 45 | 25 | **56%** |
| Suzano | 22 | 15 | **68%** |
| Jd. Marajoara | 44 | 7 | 16% |
| Guarapiranga | 40 | 1 | **2.5%** |

Franquias com >50% são as que deixam o bot trabalhar. As com <20% têm franqueado intervindo em excesso.

### 2.4 Horários de Pico

| Hora | Conversas | % Total |
|------|-----------|---------|
| **11h** | **109** | **20.8%** |
| 12h | 80 | 15.2% |
| 9h | 48 | 9.1% |
| 10h | 45 | 8.6% |
| 13h | 40 | 7.6% |
| 16h | 35 | 6.7% |
| 17h | 28 | 5.3% |

**60% do volume entre 9h-13h**. Pico absoluto 11h. Quase zero após 22h.

Não é possível cruzar horário × conversão até o fix do status=converted.

### 2.5 Produtos Mais Vendidos vs Topics Discutidos

**Top 5 produtos (sale_items):**
1. Nhoque de Batata 1kg — 132 vendas
2. Sofioli 4 Queijos 700g — 127
3. Nhoque Recheado Mussarela 700g — 126
4. Nhoque Recheado 4 Queijos 700g — 92
5. Sofioli Brócolis e Mussarela 700g — 72

**Topics do LLM (49 classificadas apenas):**
1. cardápio (10), entrega (5), canelones (2), horário (2), Nhoque Batata R$30.90 (2)

**Gap**: Topics são genéricos ("cardápio", "entrega") — deveriam capturar produtos específicos. Nhoques dominam vendas mas quase não aparecem em topics.

### 2.6 Tendência Diária

| Dia | Conversas |
|-----|-----------|
| 26/03 | 7 (início da captura) |
| 04/04 | 315 |
| 05/04 | 204 (dia parcial) |

Volume estável: ~50 conversas/dia extrapolado (315 + 204 em 1.5 dias úteis).

### 2.7 ROI do Bot

| Item | Valor |
|------|-------|
| Faturamento vendas bot | R$ 23.051 |
| Custo Gemini (~R$0,05/conversa × 525) | ~R$ 26 |
| **ROI** | **~878x** |

Mesmo considerando apenas 10% de atribuição direta: ROI = 87x.

### 2.8 Qualidade dos Dados LLM

| Campo | Problema | Impacto |
|-------|----------|---------|
| intent | 59.2% "outro" | Inútil para análise |
| sentiment | 95.9% "neutro" | Sem nuance |
| outcome | 46.9% "ongoing", 0% "converted" | Funil falso |
| llm_abandon_reason | 72% "sem_resposta" (18 total) | Amostra ínfima |
| topics | "cardápio", "entrega" genéricos | Não identifica produtos |

**Causa**: Prompt do Analyzer genérico + amostra pequena (49 conversas).

---

## 3. ANÁLISE POR FRANQUIA (para Widget)

### 3.1 Scorecard Consolidado

| Franquia | Conv | Vendas Bot | Fat Bot | Autonomia | Dropoff | Human Msgs | Ação |
|----------|------|-----------|---------|-----------|---------|------------|------|
| Santo André | 45 | 25 | R$ 2.187 | 46.7% | 22.2% | 92 | Boa conversão, reduzir intervenção |
| Jd. Marajoara | 44 | 7 | R$ 672 | 20.5% | 45.5% | 65 | Alto dropoff, confiar mais no bot |
| Guarujá | 42 | 27 | R$ 2.381 | 45.2% | 14.3% | 260 | Franqueado engajado, converte bem |
| Guarapiranga | 40 | 1 | R$ 82 | 7.5% | 37.5% | 177 | **CRÍTICO**: franqueado atropela bot |
| Embu Artes | 30 | 5 | R$ 465 | 6.7% | 60.0% | 53 | Dropoff alto, autonomia baixíssima |
| São Miguel | 29 | 21 | R$ 1.701 | 62.1% | 20.7% | 46 | **Modelo ideal** |
| Jd. Santa Maria | 28 | 3 | R$ 161 | 35.7% | 67.9% | 19 | Dropoff crítico (68%) |
| Vila Maria | 26 | 10 | R$ 768 | 26.9% | 7.7% | 73 | Bom engajamento, melhorar autonomia |
| Bauru | 24 | 10 | R$ 875 | 70.8% | 58.3% | 21 | Paradoxo: alta autonomia, alto dropoff |
| Campo Belo | 23 | 35 | R$ 3.974 | 30.4% | 17.4% | 108 | Campeão de vendas bot |

### 3.2 Benchmarks da Rede

| Métrica | Média | Melhor | Pior |
|---------|-------|--------|------|
| Autonomia | ~40% | Itatiba 83% | Cajamar ~0% |
| Dropoff 1ª msg | ~28% | Cataguases 0% | Jd. Sta Maria 68% |
| Msgs humanas/conv | ~2.9 | Rio Claro 0.05 | Guarujá 6.2 |
| % vendas bot | ~32% | Campo Belo 100% | Guarapiranga 2.5% |

### 3.3 Dicas Acionáveis por Perfil

| Perfil | Franquias | Dica |
|--------|-----------|------|
| Alta autonomia + boas vendas | São Miguel, Itatiba, Sorocaba | "Seu bot está mandando bem! Continue deixando ele atender primeiro." |
| Alta intervenção + boas vendas | Guarujá, Campo Belo | "Você complementa o bot com sucesso. Tente responder menos e ver se as vendas se mantêm." |
| Alta intervenção + poucas vendas | Guarapiranga, Embu, Cajamar | "Deixe o bot atender antes de responder. Franquias que confiam no bot vendem 3x mais." |
| Alto dropoff | Jd. Sta Maria, Bauru | "Muitos clientes mandam 1 msg e param. Verifique se seu horário de atendimento está atualizado." |

---

## 4. RECOMENDAÇÕES

### 4.1 Melhorias no Prompt do GerenteGeral1 (V3)

**1. Proatividade no fechamento:**
```
>>> IMPORTANTE: Após o cliente demonstrar interesse (perguntar preço, sabor, quantidade), SEMPRE pergunte "Posso montar seu pedido?" ou "Quantas unidades gostaria?". NÃO espere o cliente pedir explicitamente.
```

**2. Saudação com gancho comercial:**
```
Substituir: "Olá! Sou a [nome], assistente da Maxi Massas. Como posso ajudar?"
Por: "Olá! Sou a [nome] da Maxi Massas [cidade]! Temos massas artesanais congeladas fresquinhas. Quer ver nosso cardápio? O Nhoque de Batata está fazendo sucesso!"
```

**3. Regra anti-loop / anti-ghosting:**
```
>>> REGRA: Se o cliente não responder após 2 mensagens suas seguidas, envie UMA última: "Fico por aqui! Quando quiser pedir, é só me chamar." NÃO envie mais mensagens.
```

### 4.2 KPIs do Dashboard Admin

**Adicionar (prioridade alta):**
- Taxa de Autonomia (mais confiável que qualquer dado LLM)
- Dropoff 1ª mensagem (qualidade da saudação)
- % Vendas Bot / Total (correlação direta com receita)
- Volume mensagens humanas por franquia

**Deprioritizar até fix do Analyzer:**
- Score Médio do Bot (67% = score 5, sem variação)
- Intents (59% "outro")
- Sentimento (96% "neutro")

**Manter:**
- Funil de status (após fix do converted)
- Abandon reasons (após dados suficientes)

### 4.3 Widget Franqueado (BotPerformanceCard)

**Problemas atuais:**
- Conversões = 0 sempre (bug status)
- Topics genéricos demais
- Dica baseada em dados insuficientes

**Mudanças propostas:**
1. Trocar "Conversões" por "Vendas via Bot" (dado real: `sales WHERE source='bot'`)
2. Adicionar "Taxa de Autonomia" com benchmark vs média da rede
3. Dica acionável baseada no perfil da franquia (ver 3.3)
4. Se dropoff > 40%: alerta específico sobre horário/saudação

### 4.4 Próximas Features de Dados

| Prior. | Feature | Impacto |
|--------|---------|---------|
| **P0** | Fix JSON parse Analyzer (strip markdown) | Destrava 90% dos dados |
| **P0** | Marcar status=converted no EnviaPedidoFechado | Métrica #1 do funil |
| **P1** | Capturar response_time_ms no V3 | Detectar bot lento |
| **P1** | Enriquecer prompt Analyzer com lista de produtos | Topics específicos |
| P2 | Correlação Meta CAPI → conversa → venda | Atribuição ads |
| P2 | Segmentação novo vs recorrente (purchase_count) | Comportamento |
| P3 | A/B testing de prompts (tag versão) | Medir impacto |

---

## Anexo: Dados Brutos

- **Período**: 26/03/2026 – 05/04/2026
- **Total conversas**: 525
- **Total mensagens**: 4.741 (1.969 in, 1.273 out, 1.499 human)
- **Franquias ativas**: 27
- **Conversas por dia**: ~50 (extrapolado)
- **Modelo processamento**: gemini-2.5-flash (21 ok), heuristic (7), error (19), skipped (2)
