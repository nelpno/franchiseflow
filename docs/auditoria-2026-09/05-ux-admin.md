# 05 — UX do ADMIN / franqueadora (Nelson, manager, CS Celso)

> Auditoria de 07/09/2026. Método: leitura do código (`AdminDashboard`, `Financeiro` + `AsaasSetupPanel`/`MarketingPaymentsAdmin`/`FranchiseFinanceTable`, `Franchises`, `PurchaseOrders`, `CustomerSuccess` + `components/customer-success/*`, `Marketing`, `Onboarding`, `Layout`, `entities/all.js`), consultas ao Supabase pelo MCP (todas datadas de 07/09/2026) e o Clarity de 3 dias. **Não rodei o app** — onde uma afirmação dependeria de runtime está marcada `⚠️ NÃO VERIFICADO`.
> Persona: desktop, sessão longa, decisão sobre 66 franquias (67 linhas em `franchises`, 2 são de teste).

---

## 0. Dois fatos medidos que mudam a leitura do resto

### F0.1 — O cron que alimenta o ranking do Painel Geral falha calado; hoje o ranking "7 dias"/"30 dias" está sem as vendas de ontem

- **Evidência (banco):** `cron.job_run_details` do job `aggregate-daily-data` (jobid 1, `0 5 * * *`): `failed` em **26/07, 30/07 e 07/09/2026** com `ERROR: numeric field overflow — precision 5, scale 2`. `daily_summaries` não tem as datas **25/07, 29/07 e 06/09** (`generate_series` × `not exists`). Causa: `daily_summaries.conversion_rate` é `numeric(5,2)` (teto 999,99) e `aggregate_daily_data()` grava `ROUND(sales_count / unique_contacts * 100, 2)` — estoura quando uma franquia tem ≥10 vendas para 1 contato único no dia. A coluna `conversion_rate` tem **0 consumidores em `src/`** (grep).
- **Evidência (código):** [FranchiseRanking.jsx:56-65](../../src/components/dashboard/FranchiseRanking.jsx#L56) soma `summaries` para os períodos 7d/30d (só `todaySales` é live). Ontem (06/09) teve **194 vendas, R$ 16.757, em 41 franquias** — nenhuma delas está no ranking 7d/30d de hoje.
- **Quem sofre:** admin/manager.
- **Impacto:** o ranking e o "Precisam de Atenção" mostram posição errada em 3 dias dos últimos 45; ninguém é avisado (cron sem alerta; `daily_summaries_last = 2026-09-05` só aparece se alguém consultar o banco).
- **Correção:** (a) banco: `ALTER TABLE daily_summaries ALTER COLUMN conversion_rate TYPE numeric(7,2)` **ou** `LEAST(999.99, …)` na função; rerodar `select aggregate_daily_data('2026-09-06')`, `('2026-07-29')`, `('2026-07-25')`; (b) front: `FranchiseRanking` passa a receber `allSales` (já carregado com 90 dias e coluna `source` em [AdminDashboard.jsx:126](../../src/components/dashboard/AdminDashboard.jsx#L126)) e deixa de depender de `daily_summaries` — isso também corrige F2.2. `daily_summaries` fica só para a meta do dia e contatos.
- **Esforço:** P (banco) + P (front).
- **Risco de regressão:** ranking 30d passa a bater exatamente com a soma do `DailyRevenueChart` 30d (mesma fonte) — usar isso como teste; conferir que o ranking "Hoje" continua idêntico (já usa `todaySales`).

### F0.2 — A RPC de saúde que roda em produção não é a que está versionada no repositório

- **Evidência:** `pg_get_functiondef('get_franchise_health_signals')` LIVE tem 14.534 chars e contém `giro_baixo`, `marketing_late` (sev **high**), `po_limiar`/`po_med` (cadência de compra por unidade), `bot_era_canal`, `nflags_cs` e um `where not exists (select 1 from cs_agreements …)`. O `reconcile_cs_auto_tasks` LIVE tem "REABRIR … cooldown 30d … pula cartão PARQUEADO (parked_until) — 02/09/2026". Nada disso existe em `supabase/cs-cockpit/09-*.sql` nem em `07-*.sql`; `grep -rl "giro_baixo|marketing_late|cs_agreements"` no repo do dashboard = **0 arquivos**. A única menção está em `cs-celso/planos/2026-09-03-plano-cs-dashboard.md` (documento de plano, não SQL aplicável).
- **Quem sofre:** quem for mexer no radar — inclusive as correções deste relatório (F4.1, F4.3).
- **Impacto:** o `CLAUDE.md` manda provar paridade arquivo × live antes de `CREATE OR REPLACE`; hoje um deploy do arquivo versionado **regrediria** o radar (perde `giro_baixo`, `marketing_late`, acordos, reabertura com cooldown).
- **Correção:** exportar `pg_get_functiondef` das duas funções para `supabase/cs-cockpit/10-health-signals-live-2026-09.sql` e `11-reconcile-live-2026-09.sql`, rodar `_verifica-paridade-live.mjs`, e só então tocar nelas.
- **Esforço:** P. **Risco:** nenhum (documentação).

---

## 1. As perguntas de gestão — em quantos cliques o app responde hoje

| Pergunta | Onde / como | Cliques | Veredito |
|---|---|---|---|
| **Quem caiu vs mês passado** | Painel Geral: nenhum delta por franquia (KPIs de topo têm delta só da rede). Financeiro → Resultado: `prevPnl` é calculado para **todas** as 66 ([Financeiro.jsx:228-245](../../src/pages/Financeiro.jsx#L228)) mas só aparece dentro do drilldown de **uma** linha por vez ("% vs anterior", [FranchiseFinanceDrilldown.jsx:29-50](../../src/components/financeiro/FranchiseFinanceDrilldown.jsx#L29)). CS → Radar: flag "Faturamento −X%" só quando ≤ −10% **e** mês anterior ≥ R$ 2.000 (hoje 23 unidades; outras 23 com delta `NULL`). | 1 + 66 expansões | **Impossível na prática** |
| **Quem não vende há N dias** | Painel → expandir "Alertas" (colapsado + lazy) → expandir grupo "sem vendas há 7+ dias" ([AlertsPanel.jsx:119-133](../../src/components/dashboard/AlertsPanel.jsx#L119)). O lazy-load baixa ~31k contatos + 2.201 itens de estoque + 500 pedidos ([AdminDashboard.jsx:255-264](../../src/components/dashboard/AdminDashboard.jsx#L255)) sendo que esse alerta só precisa de `allSales`, já em memória. O ranking diz "N franquias sem vendas no período" **sem nomes** ([FranchiseRanking.jsx:243-247](../../src/components/dashboard/FranchiseRanking.jsx#L243)). | 3 + download pesado | Responde, caro |
| **Quem está com o robô parado** | Painel → Alertas → "bot inativo há 7+ dias" ([AlertsPanel.jsx:193-196](../../src/components/dashboard/AlertsPanel.jsx#L193)). CS → Radar: `bot_silent` (3 unidades hoje). Nenhum sinal ao vivo de conexão (`whatsapp_status` é `disconnected` em 18/18 — CLAUDE.md). | 3 | Responde, escondido |
| **Quem deve mensalidade** | Financeiro → Mensalidades → varrer **67 linhas** procurando badge ([AsaasSetupPanel.jsx:641-813](../../src/components/financeiro/AsaasSetupPanel.jsx#L641)). Sem filtro, sem contagem, sem vencimento, sem valor, sem dias de atraso. Hoje: **1 OVERDUE** (Uberlândia, vencida **05/08** — um mês), **23 PENDING** com vencimento 05/09 (2 dias), **1 franquia sem linha** em `system_subscriptions` (Uberaba, criada 04/09) — invisível ao cron de sync e à tela. | 2 + leitura de 67 linhas | Incompleto |
| **Quanto a rede faturou no mês** | Painel: card "Financeiro do Mês" — 0 cliques, mas espera as duas RPCs do bot sem precisar ([AdminDashboard.jsx:571-581](../../src/components/dashboard/AdminDashboard.jsx#L571)). Financeiro → Resultado: 1 clique, com seletor de mês. O toggle do header é Hoje/7d/30d — não tem "Mês" ([AdminHeader.jsx:3-7](../../src/components/dashboard/AdminHeader.jsx#L3)). | 0–1 | Responde |
| **Quais unidades dão prejuízo** | Financeiro → Resultado, ordenação padrão margem asc ([FranchiseFinanceTable.jsx:36-37, 87](../../src/components/financeiro/FranchiseFinanceTable.jsx#L36)) → linhas com lucro em vermelho. Falta "N no vermelho", total da rede e a tela baixa 13 meses de vendas + despesas + estoque inteiro antes de mostrar ([Financeiro.jsx:55-72](../../src/pages/Financeiro.jsx#L55)). | 1 | Responde, sem síntese |
| **Efeito do marketing por unidade** | Marketing → Investimento mostra quem pagou. CS drawer "raio-x": marketing 30d + faturamento, **1 unidade por vez** ([FranchiseDrawer.jsx:202-222](../../src/components/customer-success/FranchiseDrawer.jsx#L202)), sem cruzamento. O banco **tem** a resposta (ver F7.1: 33% da receita de 30d é atribuível a anúncio). | 3 por unidade | **Impossível** |
| **Quem está atrasado no onboarding** | Onboarding (admin): lista 10 checklists com % e status ([Onboarding.jsx:587-634](../../src/pages/Onboarding.jsx#L587)) — sem "última atividade", sem idade da franquia. Dado de hoje: Jaraguá 82% **parada há 21 dias**, Itapevi 18% parada há 15 dias, Guarulhos 75% há 12. `Franchises.jsx` mostra a barra no card ([804-817](../../src/pages/Franchises.jsx#L804)) sem data. | 1 | Responde "quanto", não "atrasado" |
| **Que pedido sai amanhã** | Pedidos: sem data de rota; `estimated_delivery` preenchido em **19%** dos pedidos; `em_rota` quase não usado (12 notificações vs 60 "entregue" em 30d). A roteirização acontece fora do app (skill `maxi-logistica-rotas`). Lote de hoje: 9 pendentes = R$ 23.786 / 874 kg — a tela não soma nem valor nem peso. | — | **Impossível** |

---

## 2. `AdminDashboard` — as 10 queries e a ordem dos blocos

Carga real: wave 1 = 6 queries (franquias, `daily_summaries` 90d fetchAll, contatos de hoje, `sales` 90d fetchAll, configs, RPC `get_bot_leads_daily`); wave 2 = 2 RPCs de bot; lazy = 3 (contatos fetchAll ~31k, estoque fetchAll, 500 pedidos); funil = 1 RPC lazy. Ordem na tela ([AdminDashboard.jsx:512-679](../../src/components/dashboard/AdminDashboard.jsx#L512)): 4 KPIs → Bot + Financeiro do mês → Ranking + Meta do dia → gráfico de barras → **Alertas (colapsado)** → **Conversão e Recompra (colapsado)** → **Última Reposição (colapsado)**.

### F2.1 — O KPI "CONVERSÃO" divide vendas manuais por leads do robô

- **Evidência:** [AdminDashboard.jsx:391-393](../../src/components/dashboard/AdminDashboard.jsx#L391) e [414-417](../../src/components/dashboard/AdminDashboard.jsx#L414): `conversion = salesCount / leads`, com `salesCount = todaySales.length` (todas as origens) e `leads = botLeadsForRange()` (conversas do bot concluídas). Nos últimos 30 dias **2.831 de 3.691 vendas são `source='manual'` (77%)**. Na mesma tela o `BotSummaryCard` mostra "Conversão" = `converted/concluded` só do bot ([BotSummaryCard.jsx:23-25](../../src/components/dashboard/BotSummaryCard.jsx#L23)) — dois números com o mesmo nome e semânticas diferentes.
- **Quem sofre:** admin. **Impacto:** KPI de topo sem significado; decide sobre o robô com número errado.
- **Correção:** ou filtrar `todaySales.filter(isBotSource)` no numerador (helper já existe na linha 55 e é usado na 395) e renomear para "Vendas por lead do robô", ou tirar o card e usar o slot para "Unidades sem vender há 7+ dias: N" (só precisa de `allSales`).
- **Esforço:** P. **Risco:** nenhum além de texto.

### F2.2 — No ranking 7d/30d a barra bot × manual só usa as vendas de HOJE

- **Evidência:** [FranchiseRanking.jsx:56-58](../../src/components/dashboard/FranchiseRanking.jsx#L56) (comentário admite) e [67-75](../../src/components/dashboard/FranchiseRanking.jsx#L67): receita do período vem de `summaries` (sem `source`), só `todaySales` alimenta `botRevenueByEvo`. Franquia com R$ 10 mil em 30 dias e R$ 200 hoje via bot mostra barra "2% bot".
- **Correção:** a mesma de F0.1 — `allSales` no lugar de `summaries`. **Esforço:** P.

### F2.3 — A ordem dos blocos é a inversa da ordem das perguntas; o acionável está colapsado no fim e custa 31k contatos para abrir

- **Evidência:** "sem vendas", "robô parado" e "sem repor há 45d" só aparecem dentro de "Alertas" ([596-626](../../src/components/dashboard/AdminDashboard.jsx#L596)), que dispara `loadCollapsedData` ([255-264](../../src/components/dashboard/AdminDashboard.jsx#L255)). Mas `noSalesCritical/Warning` usa `allSales` ([AlertsPanel.jsx:109-133](../../src/components/dashboard/AlertsPanel.jsx#L109)) e `botInactive` usa `botSummary` ([188-196](../../src/components/dashboard/AlertsPanel.jsx#L188)) — ambos já em memória nas waves 1/2. Só estoque, reposição e leads parados precisam do lazy.
- **Quem sofre:** admin (e o Supabase: ~31k linhas por expansão).
- **Impacto:** as três perguntas de ação ficam a 3 cliques + um download de ~2 MB, atrás de 4 KPIs (um quebrado) e um gráfico decorativo.
- **Correção:** dividir `AlertsPanel` em dois componentes: **"Precisa de atenção hoje"** (sem vendas 3+/7+ dias, robô parado) aberto por padrão logo abaixo dos KPIs, com contagem no título e nomes clicáveis para `/Financeiro?tab=porunidade&franchise=…`; e **"Estoque e reposição"** colapsado + lazy como hoje. "Última Reposição" e "Conversão e Recompra" continuam colapsados (são análise, não ação).
- **Esforço:** M. **Risco:** o empty-state "Todas as franquias operando normalmente" ([AlertsPanel.jsx:272-278](../../src/components/dashboard/AlertsPanel.jsx#L272)) usa `totalGroups`; ao separar, cada bloco precisa do seu próprio empty-state para não dizer "tudo ok" enquanto o pesado nem carregou.

### F2.4 — "Financeiro do Mês" espera as RPCs do bot

- **Evidência:** [AdminDashboard.jsx:571-581](../../src/components/dashboard/AdminDashboard.jsx#L571): os dois mini-cards ficam em skeleton enquanto `isLoadingWave2`; `FinanceiroSummaryCard` só depende de `allSales`/`configMap` (wave 1).
- **Correção:** renderizar `FinanceiroSummaryCard` fora do gate. **Esforço:** P.

### F2.5 — "N franquias sem vendas no período" sem nomes

- **Evidência:** [FranchiseRanking.jsx:243-247](../../src/components/dashboard/FranchiseRanking.jsx#L243). São justamente as unidades que mais importam e viram um número cinza.
- **Correção:** listar nomes (linha por linha, mesmo padrão do "Precisam de Atenção" das linhas 219-241), clicáveis. **Esforço:** P.

### F2.6 — Três janelas de tempo na mesma tela

- **Evidência:** header Hoje/7d/30d ([AdminHeader.jsx:3-7](../../src/components/dashboard/AdminHeader.jsx#L3)); `BotSummaryCard` e `FinanceiroSummaryCard` são "mês corrente" fixo; `LastPurchaseOrderCard` é "dias desde". Admin lê "30 dias" nos KPIs e "Set/26" no card ao lado.
- **Correção:** acrescentar "Mês" ao toggle (allSales 90d cobre) e fazer KPIs, ranking e gráfico obedecerem. **Esforço:** P.

### O que está colapsado e não deveria / vice-versa

- **Deveria abrir:** alertas leves (F2.3).
- **Pode continuar colapsado:** Conversão e Recompra (RPC ~230 ms, análise), Última Reposição (é redundante com o alerta "sem reposição há 45+ dias" — ou vira só o badge "N sem pedir há 30+ dias" no bloco leve).
- **Deveria colapsar:** a "Meta do Dia" (donut de 2/5 da largura para um número — F3.4).

---

## 3. Visualização de dados (66 linhas)

### F3.1 — `DailyRevenueChart` é decorativo

- **Evidência:** [DailyRevenueChart.jsx:39-59](../../src/components/dashboard/DailyRevenueChart.jsx#L39): barras CSS sem valor, sem tooltip, sem comparação; no modo 30d são 30 barras rotuladas por dia da semana ("Seg Ter Qua…" × 4) — ilegível. Só o total do período está escrito.
- **Correção:** 7d: valor em cima de cada barra + barra "fantasma" da semana anterior (`allSales` tem 90d). 30d: agrupar por semana (4–5 barras com o valor) ou somar por semana ISO. Não precisa de recharts (barra CSS + `<span>`).
- **Esforço:** P–M. **Risco:** nenhum.

### F3.2 — Financeiro: 66 cards sem total, sem contagem de negativos, sem delta — o dado do delta já está calculado

- **Evidência:** [FranchiseFinanceTable.jsx:143-236](../../src/components/financeiro/FranchiseFinanceTable.jsx#L143) renderiza Vendas/Faturamento/Custos/Lucro/Margem por linha; `prevPnl` vem em `franchiseData` ([Financeiro.jsx:244](../../src/pages/Financeiro.jsx#L244)) e só aparece no drilldown. `SORT_OPTIONS` ([23-28](../../src/components/financeiro/FranchiseFinanceTable.jsx#L23)) não tem "queda".
- **Correção:** coluna "vs mês ant." (Δ% faturamento, vermelho ≤ −10%) + ordenação "Maior queda" + rodapé com totais da rede e "N unidades no vermelho". Responde "quem caiu" em 1 clique.
- **Esforço:** P. **Risco:** `prevPnl.totalRecebido = 0` → Δ nulo (o drilldown já trata assim, linhas 29-32); mês corrente parcial × mês anterior inteiro — rotular "até dia X" ou comparar até o mesmo dia.

### F3.3 — Mensalidades: 67 linhas × 7 colunas e nenhuma agregação de dinheiro

- **Evidência:** os 4 stats de [AsaasSetupPanel.jsx:512-528](../../src/components/financeiro/AsaasSetupPanel.jsx#L512) contam cadastros (fiscal completo / no ASAAS / com assinatura), não pagamentos. A tabela ([627-817](../../src/components/financeiro/AsaasSetupPanel.jsx#L627)) não tem vencimento, valor, dias de atraso, filtro ou ordenação — e `SystemSubscription.list(null, null, { columns: "*" })` (linha 194) já traz `current_payment_due_date`, `current_payment_value`, `last_synced_at`.
- **Correção:** chips clicáveis que filtram — "Pago 40 · Pendente 23 · Vencido 1 · Sem cobrança 3 · Cancelada 2" (números de hoje) — + colunas Vencimento / Valor / Dias de atraso; ordenação padrão por dias de atraso desc.
- **Esforço:** P. **Risco:** nenhum.

### F3.4 — Gráfico onde deveria ser uma linha de texto: o donut "Meta do Dia"

- **Evidência:** [FranchiseRanking.jsx:251-311](../../src/components/dashboard/FranchiseRanking.jsx#L251) ocupa `lg:col-span-2` (40% da largura) para um número; a meta é sintética (média 30d + 10%, linhas 96-117); `sales_goals` tem **0 linhas**.
- **Correção:** uma linha no cabeçalho do ranking ("R$ X hoje · Y% da média dos últimos 30 dias") ou comparação real "hoje × mesmo dia da semana passada" (allSales). Devolver a largura ao ranking.
- **Esforço:** P.

### F3.5 — O que escala e o que vira sopa

- **Escala:** `NetworkFunnelPanel` (tabela densa, 3 ordenações, cor por faixa, unidades sem denominador separadas) é o melhor padrão do admin — replicar em Financeiro e Mensalidades. Radar CS (lista + chips + filtro por tier) escala. Ranking top 5 + "Ver todas" escala.
- **Não escala:** 66 cards com 5 números cada (Financeiro), 67 linhas sem filtro (Mensalidades), 66 cards de 3 colunas em `Franchises.jsx` (sem busca, sem ordenação — [741-886](../../src/pages/Franchises.jsx#L741)). Não introduzir gráfico por unidade (66 séries).

---

## 4. `CustomerSuccess` — mural + radar

**Estado medido (RPC live, 07/09):** 17 críticas, 37 atenção, 4 saudáveis, 8 destaque, 1 dormente. **10 críticas sem nenhum cartão aberto.** Último `auto_open/auto_resolve`: **03/09 19:16** — o reconcile só roda quando alguém abre a página ([CustomerSuccess.jsx:70](../../src/pages/CustomerSuccess.jsx#L70)); o polling de 5 min recarrega só os cartões ([linha 82](../../src/pages/CustomerSuccess.jsx#L82)). Mural: 12 autos + 6 manuais abertos. Celso em 30 dias: 53 "falei com a franquia", 20 resolvidos, 4 reuniões, 11 cartões manuais, atividade em 11 dias distintos.

### F4.1 — O cartão não diz com quem falar nem por onde

- **Evidência:** [CsCard.jsx:40-79](../../src/components/customer-success/CsCard.jsx#L40) mostra título, "franquia · cidade", flags e "parado há Xd". O drawer ([FranchiseDrawer.jsx:202-222](../../src/components/customer-success/FranchiseDrawer.jsx#L202)) tem 10 métricas e **nem nome do dono nem telefone**. A RPC `get_franchise_health_signals` não devolve `owner_name`, `phone_number` nem `personal_phone_for_summary` (RETURNS TABLE live confere com o do arquivo 09, linhas 44-58).
- **Quem sofre:** CS. **Impacto:** para cada ligação, sai do mural, vai a Franqueados (ou ao WhatsApp) e volta.
- **Correção:** RPC devolve `owner_name`, `phone_number`, `personal_phone_for_summary`; header do drawer ganha "Dono · telefone" com link `https://wa.me/55<num>`. Mudar RETURNS TABLE exige DROP + CREATE — **fazer a partir do LIVE (F0.2)**.
- **Esforço:** M (pela paridade). **Risco:** `CsRadarPanel`/`CsBoard` leem campos por nome; o reconcile faz `select * … into temp` → colunas extras não quebram. Guardar `pg_get_functiondef` antes.

### F4.2 — Cartões ordenados do mais novo para o mais velho: o que está parado há 27 dias fica no fundo

- **Evidência:** [entities/all.js:375](../../src/entities/all.js#L375) `order('moved_to_column_at', { ascending: false })`; `CsBoard` não reordena ([CsBoard.jsx:12-14](../../src/components/customer-success/CsBoard.jsx#L12)). Hoje: Rio Preto (auto, alta) 27d, Mogi 26d, Sorocaba 26d — no fim das colunas.
- **Correção:** ordenar por `priority = 'alta'` primeiro e `moved_to_column_at` asc (mais velho no topo). **Esforço:** P.

### F4.3 — "Atenção" cobre 37 de 67 unidades; o filtro padrão "Em risco" mostra 54/67 — não prioriza

- **Evidência:** distribuição de flags live: `key_stock_zero` med 21, `purchase_mix_shrink` low 21, `revenue_drop` med 14, `giro_baixo` med 8 + high 4, `purchase_freq_drop` low 10, `marketing_late` high 7. Regra de tier live: `has_med or has_giro or …` (⚠️ o final da expressão veio truncado na leitura — o `nflags_cs>=2` NÃO VERIFICADO). [CsRadarPanel.jsx:24](../../src/components/customer-success/CsRadarPanel.jsx#L24) abre em `"risco"`.
- **Impacto:** o Radar vira "quase todas".
- **Correção:** (front, P) abrir o Radar em "Crítico" e ordenar "Atenção" por quantidade de flags high/med; (RPC, M) `key_stock_zero` só promove a atenção com ≥ 2 outras flags — 21 unidades com "5+ itens-chave zerados" é mais estoque mal digitado do que churn.
- **Ruído a cortar:** `purchase_freq_drop` (10) com ciclo semanal de pedido (68% dos pedidos caem no domingo) — exigir `cntprev >= 3`.

### F4.4 — Sinais de robô e pagamento: úteis, mas falta o "pendente vencido"

- **Evidência:** live: `bot_silent` 3, `payment_unset` 3, `pix_missing` 1, `subscription_overdue` 1 — baixo ruído, bons. Porém a CTE `sub` só marca `current_payment_status='OVERDUE'`; as **23 PENDING vencidas em 05/09** não geram sinal. `marketing_late` (7, high) não abre cartão (correto: não é churn; `nflags_cs` já exclui) — mas o mural não mostra o valor.
- **Correção:** `subscription_overdue` = `OVERDUE or (PENDING and due_date < current_date - 3)`. **Esforço:** P (RPC, a partir do live).

### F4.5 — "Hoje no radar" envelhece enquanto a página fica aberta

- **Evidência:** [CsCard.jsx:42](../../src/components/customer-success/CsCard.jsx#L42) só mostra em cartão manual; a `description` do auto só é reescrita no reconcile; `reloadTasks` (polling) não recarrega `signals` nem reconcilia. Os 10 críticos sem cartão de hoje só aparecerão quando alguém abrir/recarregar a página.
- **Correção:** `pg_cron` chamando `reconcile_cs_auto_tasks()` 1×/hora com `set_config` de um perfil admin (a RPC exige `is_cs_or_admin()`; o CLAUDE.md documenta o contorno) **ou** o polling chamar `load()` em vez de `reloadTasks()` a cada 15 min. **Esforço:** P. **Risco:** custo da RPC de saúde por chamada ⚠️ NÃO MEDIDO nesta auditoria (o 09 mede só `botlast` = 1,7 ms).

### F4.6 — "Aguardando retorno" sem data de retorno

- **Evidência:** `cs_tasks.due_date` existe, **0 consumidores** em `src/`; o botão "Falei com a franquia" ([FranchiseDrawer.jsx:87-96](../../src/components/customer-success/FranchiseDrawer.jsx#L87)) move para aguardando sem perguntar "voltar quando?". 6 cartões estão em "Aguardando retorno" há 4–26 dias.
- **Correção:** campo "voltar em" (default +3 dias) ao registrar contato; coluna ordena por `due_date` e pinta vencido. **Esforço:** P.

### F4.7 — `cs_agreements` silencia sinais e ninguém vê isso na tela

- **Evidência:** 6 acordos ativos; a RPC live os usa (`where not exists (select 1 from cs_agreements …)`); **0 consumidores** em `src/`. O Celso não sabe que um sinal está silenciado, nem até quando (validade por `revenue_baseline × revenue_floor_pct`).
- **Correção:** no drawer, bloco "Sinais silenciados por acordo" (motivo, autor, piso de faturamento) + botão "revogar". **Esforço:** P (leitura) / M (escrita com RLS).

---

## 5. `Financeiro` — fechamento, ASAAS, marketing

### F5.1 — Fechar o mês exige 3 telas e nenhuma cruza

- **Evidência:** DRE por unidade em Financeiro → Resultado; verba de marketing em **Marketing → Investimento** (outra página, [Marketing.jsx:1063-1073](../../src/pages/Marketing.jsx#L1063)); mensalidade em Financeiro → Mensalidades. Nenhuma mostra "o que entrou na franqueadora este mês" (54 verbas confirmadas em set/26 + 40 mensalidades pagas) nem marketing × mensalidade × DRE na mesma linha. O `CLAUDE.md` descreve o fechamento como comparação de `count()` por SQL na mão.
- **Correção:** aba "Fechamento" em Financeiro: 1 linha por unidade com faturamento, Δ vs mês anterior, marketing (confirmado/pendente/não pagou + valor), mensalidade (pago/pendente/vencido + dias), vendas não confirmadas, lucro caixa; rodapé com totais da franqueadora. Todas as fontes já são carregadas por telas irmãs (`MarketingPayment.filter({reference_month})`, `SystemSubscription.list`, `franchiseData`).
- **Esforço:** M. **Risco:** `reference_month` (TEXT `YYYY-MM`) × `sale_date` — usar o mesmo mês selecionado; não recalcular dinheiro fora de `calculatePnL`.

### F5.2 — "X de 67 pagaram" conta pendente como pago e inclui franquias de teste

- **Evidência:** [MarketingPaymentsAdmin.jsx:138](../../src/components/marketing/MarketingPaymentsAdmin.jsx#L138) `paidCount = payments.filter(p => p.status !== "rejected")` inclui `pending`; denominador = `franchises.length` vindo de `Franchise.list("city")` ([Marketing.jsx:909](../../src/pages/Marketing.jsx#L909)), com "Maxi Teste 2" e "Teste Nelson".
- **Correção:** `status === "confirmed"` e excluir `name ilike '%teste%'` (a RPC `get_network_touch_ranking` já faz esse filtro). **Esforço:** P.

### F5.3 — "Quem não pagou a mensalidade" está incompleto de três jeitos

- **Evidência:** (1) badge "Pendente" igual para "vence dia 5" e "venceu há 30 dias" ([AsaasSetupPanel.jsx:122-129](../../src/components/financeiro/AsaasSetupPanel.jsx#L122)); (2) franquia **sem linha** em `system_subscriptions` (Uberaba hoje) cai em `StatusBadge` "Pendente" por ter CPF ([78-85](../../src/components/financeiro/AsaasSetupPanel.jsx#L78)) e `SubscriptionBadge` "—" — parece normal, mas o cron de sync nunca a verá; (3) o stat "Com assinatura 64/67" não nomeia os 3. Foi exatamente assim que a Americana ficou 4 meses sem cobrança (CLAUDE.md, 19/08).
- **Correção:** linha vermelha "SEM COBRANÇA" para `!sub || !sub.asaas_subscription_id` (exceto `subscription_status='CANCELLED'` de teste), nomeada e no topo; dias de atraso na coluna; e o mesmo nome no bloco leve do Painel Geral (F2.3). **Esforço:** P.

### F5.4 — O sync diário existe, mas a tela não mostra se rodou

- **Evidência:** cron `sync-asaas-subscriptions` (05:05 UTC) `succeeded` em 07/09; `last_synced_at` max = 07/09 11:05 UTC; **0 consumidores** de `last_synced_at` em `src/`. Se falhar, ninguém vê (o de `daily_summaries` falha calado — F0.1).
- **Correção:** "Sincronizado há Xh" no topo do painel, vermelho se > 26 h. **Esforço:** P.

### F5.5 — 249 vendas em 30 dias sem `payment_confirmed`, invisíveis ao admin

- **Evidência:** `sales_30d_unconfirmed = 249`; só o `TabResultado` da unidade (Por Unidade) as exibe. Venda não confirmada = CAPI não disparado (`fireCapiOnConfirm`) + DRE com dinheiro que talvez não entrou.
- **Correção:** coluna "não confirmadas" no Fechamento (F5.1). **Esforço:** P.

---

## 6. `PurchaseOrders` (1.664 linhas, 4 sessões em 3 dias)

**O que faz (código):** lista com filtro mês/status/franquia ([223-262](../../src/pages/PurchaseOrders.jsx#L223)) — pendentes/confirmados/em rota sempre visíveis; badge ATRASADO > 7d pendente ([270-274](../../src/pages/PurchaseOrders.jsx#L270)); detalhe com edição de quantidade, frete e previsão ([344-378](../../src/pages/PurchaseOrders.jsx#L344)); transições pendente → confirmado → em rota → entregue com notificação ao franqueado ([380-468](../../src/pages/PurchaseOrders.jsx#L380)); mudança de status em lote ([471-531](../../src/pages/PurchaseOrders.jsx#L471)); "Fichas de Separação" em lote (PDF, [591-617](../../src/pages/PurchaseOrders.jsx#L591)); excluir; e "Novo Produto Padrão" como **único CTA do header** ([709-716](../../src/pages/PurchaseOrders.jsx#L709)) — gestão de catálogo dentro da tela de pedidos.

**O que os dados dizem (90 dias):** 201 pedidos, 16,4/semana; **68% pedidos no domingo** (137/201); entregas concentradas em sexta (79), quarta (35) e sábado (33); **30% dos "entregue" marcados em lote** (59/197 no mesmo minuto); `em_rota` quase não usado (12 notificações "em rota" × 60 "entregue" em 30d); `confirmed_by` **nunca preenchido** (0/201); `estimated_delivery` em 19%; `notes` em 14; **frete zero em 64/201**; hoje 9 pendentes (todos de ontem, domingo) = R$ 23.786 / 874 kg.

**Veredito:** não é subutilizada — é uma tela de **ciclo semanal** (2 usuários PC + 1 mobile em 3 dias bate com "segunda confirma, sexta/sábado marca entregue"). O que acontece fora do app é o **planejamento**: roteirização (skill `maxi-logistica-rotas`, cap 1.500 kg/rota), mensagem ao motorista (Zuck) e a regra de frete (R$ 250–350, CLAUDE.md: "lançado à mão"). A tela é registro pós-fato + gerador de PDF; por isso não responde "que pedido sai amanhã".

### F6.1 — Sem "lote da semana"

- **Evidência:** stats do topo ([744-786](../../src/pages/PurchaseOrders.jsx#L744)) contam pedidos e somam R$ dos pendentes; não há peso (`total_weight_kg` preenchido em 42%, `product_weights` com 33 linhas, `getProductWeightMap` já importado na linha 2 e usado só na ficha).
- **Correção:** card "Lote pendente: 9 pedidos · R$ 23.786 · 874 kg (≈ 0,6 rota de 1.500 kg)" + coluna kg na tabela. **Esforço:** P.

### F6.2 — Frete não sugerido; 64 de 201 pedidos saíram com frete zero

- **Evidência:** `editedFreight` abre com o valor gravado ([304](../../src/pages/PurchaseOrders.jsx#L304)); nenhuma regra no front; regra oficial `min(350, max(250, 10% × total))`.
- **Correção:** default = regra quando `freight_cost` é `null` (não sobrescrever valor combinado), com o texto "regra: R$ X" ao lado do input. **Esforço:** P. **Risco:** `purchase_orders` não tem flag de retirada na fábrica (⚠️ não dá para distinguir entrega de retirada — manter editável e não forçar).

### F6.3 — "Novo Produto Padrão" no lugar errado

- Mover para Franqueados ou Configurações; o header de Pedidos fica para "Fichas do lote" / "Confirmar todos de domingo". **Esforço:** P.

### F6.4 — `em_rota` + `estimated_delivery` existem, mas o fluxo real pula

- **Evidência:** notificação "Pedido em rota" ([425-427](../../src/pages/PurchaseOrders.jsx#L425)) dispara 12× em 30d contra 60 "entregue". Se a skill de rotas (que já lê `purchase_orders`) gravasse `estimated_delivery` e marcasse `em_rota` ao montar a rota, "que pedido sai amanhã" viraria o filtro `status=em_rota & estimated_delivery=amanhã` — sem tela nova.
- **Esforço:** M (integração fora do dashboard). **Risco:** o `em_rota` notifica o franqueado — é o comportamento desejado.

---

## 7. O que o banco já tem e o painel não mostra (conferido no Supabase em 07/09)

### F7.1 — Atribuição anúncio → venda: 33% da receita, zero telas

- **Evidência:** `contacts.ctwa_clid` preenchido em **8.181 de 11.916** contatos criados em 30d (69%); `sales.contact_id` em 3.630/3.691 vendas. Cruzando: **1.265 vendas / R$ 115.927 de R$ 353.815 (33%)** nos últimos 30 dias vêm de quem chegou por anúncio. Por unidade em agosto (medido): Osasco pagou R$ 700 bruto → R$ 7.029 de vendas atribuídas (ROAS líq. 11,7); Guarujá 1.500 → 9.052 (7,0); Jd. Santa Maria 1.000 → 7.381 (8,6); **Santos 1.500 → 320 (0,2)**; Limeira 500 → 670 (1,6). `grep` de `ctwa_clid|meta_ad_id|campaign_name` em `src/` = **0**.
- **Quem sofre:** admin (decide verba no escuro) e franqueado (paga sem ver retorno).
- **Correção:** RPC `get_marketing_attribution(p_month text)` (SECURITY DEFINER, guard `is_admin_or_manager()`) devolvendo por franquia: verba bruta/líquida, vendas atribuídas, receita atribuída, ROAS; colunas "Vendas de anúncio" e "Retorno" em Marketing → Investimento (e no Fechamento, F5.1).
- **Esforço:** M. **Risco:** `campaign_name` está vazio (0/30d) — dá "veio de anúncio", não "de qual campanha"; dizer isso na UI. Atribuição é last-touch por contato (cliente antigo que voltou por anúncio conta) — rotular.

### F7.2 — `audit_logs`: 291 vendas apagadas e 1.779 editadas em 30 dias, sem nenhuma tela admin

- **Evidência:** `audit_30d_action_delete_sale = 291`, `update_sale = 1779`; `AuditLog` só é lido no `TabResultado` da unidade. Exclusão em massa muda ranking, DRE e CAPI (venda com `capi_sent=true` apagada = registro fantasma no Meta).
- **Correção:** "Exclusões de venda por unidade (30d)" no Fechamento, com link para a unidade. **Esforço:** P.

### F7.3 — `system_subscriptions.current_payment_due_date / current_payment_value / last_synced_at`

- Só o card do franqueado usa; o admin não (F3.3, F5.4). **0 consumidores** admin.

### F7.4 — `purchase_orders.total_weight_kg` + `product_weights`

- Só `PurchaseOrderForm` (franqueado) escreve/lê; a tela admin de pedidos ignora (F6.1).

### F7.5 — RPC `get_network_touch_ranking(p_start, p_end)` pronta e sem consumidor

- **Evidência:** existe no banco (pessoas × % com toque humano × R$/pessoa, ranking, `amostra_pequena`, exclui "teste"); **0 consumidores**. Complementa o `NetworkFunnelPanel` ("quem intervém demais e vende menos") — que hoje recalcula "intervenção excessiva" no cliente a partir de `humanMsgCounts` ([AlertsPanel.jsx:198-212](../../src/components/dashboard/AlertsPanel.jsx#L198)).
- **Correção:** quarta ordenação "Mais intervenção humana" no painel Conversão e Recompra. **Esforço:** P.

### F7.6 — `vw_bot_conversations_summary` (revenue_bot, converted_autonomous por franquia): 0 consumidores.

### F7.7 — Latência do robô está gravada e nunca aparece

- **Evidência:** `conversation_messages.response_time_ms` preenchido em **11.793 de 11.793** mensagens `out` dos últimos 7 dias; `tokens_*` = 0 (não chega). Nenhuma tela mostra p50/p95 por franquia.
- **Correção:** "Tempo de resposta do robô (p95)" no `BotSummaryCard` e no raio-x do CS — pega bot lento antes de virar `bot_silent`. **Esforço:** P (RPC de agregação + 1 métrica).

### F7.8 — `cs_tasks.due_date / parked_until / parked_reason`

- O reconcile live respeita `parked_until`; **nenhuma UI** escreve ou lê (só via SQL). Ver F4.6.

### F7.9 — `cs_agreements` (6 ativos): usados pela RPC, invisíveis na UI. Ver F4.7.

### F7.10 — `notifications`: 4.892 não lidas (todas de franqueado); "Estoque baixo" = 1.479 em 30 dias

- **Evidência:** trigger `on_inventory_low_stock` dispara por item; as notificações que importam ("Pedido confirmado/entregue", 60 + 60) afundam. O admin recebe só "Novo pedido de reposição" (77) e "Novo pagamento de marketing" (61) via `notify_admins`.
- **Correção:** agrupar estoque baixo em 1 notificação/dia/franquia (trigger). Fora da frente admin — registrado para a 06.

### F7.11 — Mortos (não são ponto cego, são lixo — passar para a frente 06)

`sales_goals` (0 linhas), `daily_checklists` (0 — entidade `DailyChecklist` ainda importada por `FranchiseeDashboard`/`MyChecklist`), `bot_reports` (0), `coach_actions` (2), `franchise_notes` (0), `bot_conversations.summary/intent/sentiment/abandon_reason/quality_score` (0 preenchidos em 30d — Analyzer desligado 08/06), `daily_summaries.conversion_rate` (0 consumidores **e** derruba o cron — F0.1), `purchase_orders.confirmed_by` (0/201), `franchise_configurations.whatsapp_status` (18/18 `disconnected`, CLAUDE.md).

---

## Fora do escopo desta frente, registrado

- `Financeiro.jsx` baixa 13 meses de vendas + despesas + **estoque inteiro** com `fetchAll` antes de mostrar qualquer coisa ([55-72](../../src/pages/Financeiro.jsx#L55)), e cada troca de mês refaz `SaleItem.filter` em lotes de 500 ids para 2 meses ([104-148](../../src/pages/Financeiro.jsx#L104)) — frente 01.
- `Franchises.jsx` (1.508 linhas): sem busca/ordenação em 66 cards; `getLinkedUsers` varre `users` por card a cada render ([454-459](../../src/pages/Franchises.jsx#L454)) — frente 02.
- `LastPurchaseOrderCard` usa `PurchaseOrder.list("-ordered_at", 500)` ([AdminDashboard.jsx:263](../../src/components/dashboard/AdminDashboard.jsx#L263)); 371 linhas hoje — teto silencioso em ~1 ano — frente 06.

---

## Prioridade — (impacto × alcance) / esforço

| # | Achado | Esforço | Por quê primeiro |
|---|---|---|---|
| 1 | **F0.1** cron `aggregate_daily_data` + ranking a partir de `allSales` (fecha F2.2 junto) | P + P | Número **errado** no Painel Geral hoje, sem aviso; corrige duas telas com uma mudança |
| 2 | **F3.2 + F3.3 + F5.3** Financeiro: coluna Δ vs mês anterior + chips de mensalidade + linha "SEM COBRANÇA" nomeada | P (×3) | "Quem caiu" e "quem deve" passam de impossível/67 linhas para 1 clique; é o mesmo bug que custou 4 meses da Americana |
| 3 | **F2.3** alertas leves (sem vendas, robô parado) abertos no topo do Painel, sem lazy-load de 31k contatos | M | 3 perguntas de ação em 0 cliques; menos banda |
| 4 | **F7.1** atribuição anúncio → venda por unidade | M | Pergunta hoje impossível; o dado cobre 33% da receita e decide onde subir/cortar verba |
| 5 | **F4.1 + F4.2 + F4.6** telefone/dono no cartão, ordenação por aging, "voltar em" | P–M | O Celso liga sem sair da tela e cobra na data certa; **pré-requisito: F0.2** (versionar o LIVE) |

Depois: F2.1 (KPI Conversão), F5.1 (aba Fechamento), F6.1/F6.2 (lote + frete), F4.5 (reconcile por cron), F7.5/F7.7 (RPCs prontas).
