# Analise Bot Intelligence — Maxi Massas
**Data**: 05/04/2026 | **Periodo**: 26/03 a 05/04/2026 (10 dias)

---

## 1. Panorama Geral

| Metrica | Valor |
|---------|-------|
| Conversas totais | 505 |
| Franquias ativas | 27 |
| Contatos unicos | 487 |
| Mensagens totais | 4.573 |
| Mensagens do cliente | 1.908 (42%) |
| Mensagens do bot | 1.234 (27%) |
| **Mensagens humanas** | **1.431 (31%)** |
| Vendas pelo bot | 53 de 167 totais (**32%**) |
| Contatos criados pelo bot | 404 de 453 (**89%**) |
| Conversas com sinal de checkout | 124 (25%) |

**Takeaway**: O bot gera 89% dos leads e 32% das vendas, mas humanos ainda enviam 31% de TODAS as mensagens — ou seja, franqueados estao intervindo muito.

---

## 2. Problema #1: Intervenção Humana Excessiva

### Os numeros

- **Mediana de tempo para humano intervir: 18 segundos** (0.3 min)
- Bot envia em media apenas **2.1 mensagens** antes do humano assumir
- Em 14 das 27 franquias, humano intervem em **mais de 50%** das conversas

### Ranking de Autonomia do Bot (franquias com 5+ conversas)

| Franquia | Bot-only | Humano interviu | Autonomia |
|----------|----------|-----------------|-----------|
| Itatiba | 6/7 | 1 | **86%** |
| Cataguases | 13/17 | 4 | **76%** |
| SP4 | 16/23 | 7 | **70%** |
| SP5 | 7/11 | 4 | 64% |
| Bauru | 6/11 | 5 | 55% |
| Suzano | 11/21 | 10 | 52% |
| ... | | | |
| SP2 | 4/23 | 19 | 17% |
| Embu das Artes | 2/12 | 10 | 17% |
| S.J. Rio Preto | 2/18 | 16 | 11% |
| SP6 | 2/24 | 22 | **8%** |
| **Cajamar** | **0/14** | **14** | **0%** |

### Por que humanos intervem?

Amostras reais das mensagens humanas mostram padroes claros:

1. **Franqueado "ansioso"** — assume antes do bot ter chance de responder (18 segundos!)
2. **Bot nao fecha venda** — bot informa mas nao empurra para checkout. Humano entra para fechar
3. **Perguntas que o bot deveria responder** — "entrega ou retirada?", horarios, formas de pagamento
4. **Negociacao/desconto** — bot nao tem autonomia para dar descontos

### Acao recomendada

- **Educar franqueados**: Mostrar no dashboard que "sua taxa de intervenção é X% — a media é Y%". Franqueados com 0-8% de autonomia provavelmente nao confiam no bot
- **Configurar delay**: Mostrar ao franqueado que o bot precisa de pelo menos 30-60s para responder antes de intervir
- **Melhorar prompt de checkout**: O bot precisa ser mais proativo em fechar pedidos, nao apenas informar

---

## 3. Problema #2: Dropoff na Primeira Mensagem

**123 de 505 conversas (24%)** tem apenas 1 mensagem — bot falou, cliente nunca respondeu.

### Piores taxas de dropoff

| Franquia | Dropoff | Total |
|----------|---------|-------|
| SP8 | 64% | 28 |
| Embu das Artes | 60% | 30 |
| Bauru | 52% | 23 |
| SP7 | 43% | 40 |
| Itatiba | 42% | 12 |

**Possiveis causas:**
- Mensagem inicial do bot muito longa ou generica
- Cliente veio de anuncio (click-to-WhatsApp) e nao era lead quente
- Bot envia catalogo automaticamente antes do cliente pedir (percebido como spam)

**Acao recomendada:**
- Analisar a primeira mensagem do bot por franquia — padronizar uma abertura mais curta e conversacional
- Correlacionar com Meta CAPI: leads de anuncio tem mais dropoff que organicos?

---

## 4. Horarios de Pico

```
08h: ██ 21
09h: █████ 48
10h: █████ 45
11h: ███████████ 109 ← PICO
12h: ███████ 69
13h: ███ 30
14h: ██ 20
15h: ██ 24
16h: ████ 35
17h: ███ 28
18h: █ 15
19h: █ 14
20h: ██ 23
```

**11h é o horario de pico absoluto** (21% de todas as conversas). Janela critica: 9h-12h concentra **60% do volume**.

**Implicacoes:**
- Se bot vai fora do ar ou fica lento nesse horario, impacto maximo
- Franqueados devem estar preparados para intervir nessa janela se necessario
- Campanhas Meta Ads devem focar 9h-12h para maximizar conversao

---

## 5. Duracao das Conversas

| Franquia | Duracao media | Insight |
|----------|---------------|---------|
| Sorocaba | 390 min (6.5h) | Conversas se arrastam — bot nao fecha |
| Assis | 274 min (4.5h) | Idem |
| Bauru | 270 min (4.5h) | Idem |
| Guaruja | 56 min | Saudavel |
| S.J. Rio Preto | 50 min | Saudavel |
| Suzano | 42 min | Rapida |
| Itapolis | 18 min | Excelente |

**Conversas longas NAO sao boas** — significam que o bot nao consegue resolver rapidamente. Conversas acima de 2h geralmente indicam que o bot ficou em loop ou cliente voltou horas depois.

---

## 6. O que o Bot Intelligence DEVE mostrar

### Para o Franqueado (BotPerformanceCard)

O franqueado nao quer dados tecnicos. Ele quer saber:

1. **"Quantos clientes meu bot atendeu?"** — total de conversas
2. **"Quantas vendas o bot fez sozinho?"** — conversoes sem humano
3. **"Preciso intervir menos ou mais?"** — taxa de autonomia com benchmark
4. **"Qual produto mais perguntam?"** — topics para planejar estoque
5. **"Dica da semana"** — abandon_reason mais frequente traduzido em acao

### Para o Admin (BotIntelligence page)

O admin quer evoluir o bot. Precisa ver:

1. **Funil real** — started → catalogo → discussao → checkout → venda (agora o LLM classifica isso)
2. **Taxa de intervencao humana** — por franquia, com trend. ESTE E O KPI MAIS IMPORTANTE
3. **Motivos de abandono** — com o novo prompt, vai ter diversidade (preco, frete, sem_resposta)
4. **Score do bot** — media por franquia, trend ao longo do tempo
5. **Ranking de franquias** — ordenar por autonomia, nao por volume
6. **Conversas problematicas** — filtrar score < 6 para review manual
7. **Tempo de resposta** — (pendente: response_time_ms nao esta sendo capturado)

---

## 7. Dados que FALTAM (proximas implantacoes)

### 7a. response_time_ms (Prioridade ALTA)
O campo existe no schema mas nao esta sendo populado. Precisamos saber quanto tempo o bot leva para responder. Se > 30s, cliente desiste.

**Implantacao**: No V3, calcular tempo entre msg IN do cliente e msg OUT do bot. Salvar no `log_conversation_message`.

### 7b. Correlacao com Meta CAPI
Cruzar `contacts.ctwa_clid` com conversas: leads de anuncio convertem mais ou menos que organicos? Isso informa o ROI real do investimento em Meta Ads.

### 7c. Segmentacao por tipo de cliente
Cruzar com `contacts.purchase_count`: clientes recorrentes vs novos se comportam diferente com o bot? O bot deveria ter abordagem diferente para cada.

### 7d. A/B testing de prompts
Quando melhorarmos o prompt do GerenteGeral1, registrar qual versao foi usada (`processing_model` no msg) para comparar conversao antes/depois.

### 7e. Alertas automaticos
- Bot com score < 5 → notificar admin
- Franquia com autonomia < 20% → sugerir treinamento
- Pico de abandonos num dia → investigar

---

## 8. Melhorias no Bot (prompt do GerenteGeral1)

Baseado nos dados:

1. **Ser mais proativo no checkout** — "Quer que eu monte seu pedido?" apos mostrar catalogo. Hoje o bot informa mas espera o cliente tomar iniciativa
2. **Responder perguntas multiplas** — 235 msgs com multiplas perguntas. Bot precisa responder TODAS, nao so a primeira
3. **Mensagem inicial mais curta** — Testar versao com 2 linhas vs o texto longo atual. 24% de dropoff no primeiro contato
4. **Horario de entrega proativo** — Quando cliente pergunta sobre entrega, ja informar horario e frete sem esperar pergunta separada
5. **Reducao de loop** — Conversas de 4-6h indicam que o bot repete informacao. Detectar e escalar para humano apos 3 repeticoes

---

## 9. Metricas de Sucesso (metas sugeridas)

| Metrica | Atual | Meta 30 dias | Meta 90 dias |
|---------|-------|--------------|--------------|
| Autonomia media | ~40% | 55% | 70% |
| Dropoff 1a msg | 24% | 18% | 12% |
| Conversao bot | 32% vendas | 40% | 50% |
| Score medio | ~7.5 | 8.0 | 8.5 |
| Duracao media | ~130 min | 60 min | 30 min |
| Intervencao < 30s | 50% | 30% | 15% |

---

## 10. Conclusao

O Bot Intelligence esta coletando dados uteis, mas os insights mais valiosos NAO vem da classificacao LLM — vem dos **dados brutos de mensagens**:

- **Quem intervem e quando** (taxa de autonomia por franquia)
- **Onde o cliente desiste** (funil + dropoff)
- **Quanto tempo leva** (duracao e response time)

A classificacao LLM (intent, sentiment, quality) complementa mas NAO substitui esses dados operacionais. O dashboard admin deveria priorizar os KPIs operacionais (autonomia, dropoff, duracao) sobre os KPIs de classificacao (intent distribution, sentiment).

**Proximos passos prioritarios:**
1. Capturar `response_time_ms` no V3
2. Adicionar KPI "Taxa de Autonomia" no dashboard admin e widget franqueado
3. Melhorar prompt do GerenteGeral1 (proatividade checkout + msg inicial curta)
4. Criar alertas para franquias com autonomia < 20%
