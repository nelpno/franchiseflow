# 04 — UX do FRANQUEADO

> Auditoria FranchiseFlow 2026-09-07 · frente 04 · persona: dona da unidade, no celular, com cliente esperando no WhatsApp.
> Tudo abaixo foi lido no código (`arquivo:linha`) ou medido (Clarity 3 dias em `00b-CLARITY-3DIAS.md`; SQL somente-leitura no Supabase em 07/09/2026). O que não confirmei está marcado `⚠️ NÃO VERIFICADO`. Nenhum arquivo de `src/` foi tocado.

## 0. Método e dois avisos sobre o dado

**Percorri o fluxo inteiro pelo código**: `Layout.jsx` (nav) → `FranchiseeDashboard.jsx` → `Vendas.jsx`/`TabLancar.jsx`/`SaleForm.jsx`/`SaleReceipt.jsx` → `Gestao.jsx`/`TabEstoque.jsx`/`TabReposicao.jsx`/`PurchaseOrderForm.jsx`/`PurchaseOrderHistory.jsx`/`TabResultado.jsx` → `Marketing.jsx`/`MarketingPaymentSection.jsx`/`FinancialObligationsCard.jsx`/`SubscriptionPaymentSheet.jsx` → `FranchiseSettings.jsx` + `components/vendedor/*` → `MyContacts.jsx` → `Onboarding.jsx`/`OnboardingWelcome.jsx`/`MyChecklist.jsx`/`Tutoriais.jsx`, mais libs (`smartActions`, `financialCalcs`, `franchiseUtils`, `formatters`, `stockSuggestion`, `shareUtils`) e hooks.

**Números medidos no banco (07/09/2026, SQL read-only, vendas `source='manual'` dos últimos 90 dias)** — usados ao longo do texto:

| medida | valor |
|---|---:|
| vendas manuais 90d / franquias vendendo | **8.076** / 63 |
| itens por venda (média) | **2,12** |
| entrega × retirada | 4.388 (54%) × 3.688 (46%) |
| entregas com frete R$ 0 | **622 (14% das entregas)** |
| entregas SEM endereço (nem na venda, nem no contato) | **2.848 (65% das entregas)** |
| vendas sem contato vinculado | 177 (2,2%) |
| vendas com valor R$ 0 / com linha de produto a R$ 0 | 38 / 67 |
| vendas com data ≠ dia do lançamento (lançadas depois) | 751 (9,3%) |
| vendas com observação | 845 (10%) |
| PIX | 5.982 (74%) |
| configs com regra de frete cadastrada no wizard | **60 de 67** |
| configs com franquia vendendo (30d) e robô SEM conversa há 7d | **10** |
| pedidos à fábrica 60d / franquias que pediram | 148 / 57 · **10 pedidos em aberto agora** |
| `daily_checklists` (tela `/MyChecklist`) | **0 linhas, nunca** |
| `marketing_files` (biblioteca da tela Marketing) | **7 arquivos no total**, 3 nos últimos 90d |
| franquias sem linha de `onboarding_checklists` | **57 de 67** |
| pagamentos de marketing do mês / sem comprovante | 54 / 4 |

**Aviso 1 — o `%sessões c/ métrica` do Clarity em `/Vendas` não fecha.** `/Vendas` PC: 253 dead clicks em **119 pageviews** de 245 sessões, mas "0,8% das sessões". Em `/Gestao` os três números batem (111 dead, 39 pageviews, 25,3% de 167 ≈ 42 sessões). Em `/Vendas` os pageviews-com-dead-click dizem "quase metade das sessões"; a porcentagem diz "duas sessões". A explicação mais provável está em `src/pages/Vendas.jsx:236-240`: ao abrir o form pelo FAB (`/Vendas?action=nova-venda`) a tela faz `setSearchParams({}, { replace: true })` **no mesmo segundo** — o Clarity registra dois pageviews da mesma rota, o que infla pageviews e quickback e bagunça o denominador. Tratei `/Vendas` como tela **de maior volume e com dead clicks espalhados** (pelos 119 pageviews), mas antes de investir horas em um elemento específico vale abrir 5 gravações filtradas por dead click em `/Vendas` no Clarity. `⚠️ NÃO VERIFICADO` qual elemento exato concentra os cliques — o que segue é o que o código permite.

**Aviso 2 — `/` e `/Dashboard` são a mesma tela.** `App.jsx:64-70` renderiza `MainPage` (= `Dashboard`, `pages.config.js:90`) na rota `/`; o login redireciona para `/` (`App.jsx:146`) e a bottom-nav manda para `/Dashboard` (`Layout.jsx:125`). Somando: **349 sessões mobile em 3 dias na tela inicial**, 2.811 s totais e **223 s ativos (8%)**. É a tela mais aberta e a menos lida do app.

---

## 1. Dead clicks com endereço

### 1.1 `/Vendas` — PC 253 dead / 3 rage · Mobile 21 · quickback 148 PC / 121 Mobile

**V1. A linha de resumo "3 pendentes (R$ 210,00) | 12 recebidas (R$ 1.234,00) | Total" parece filtro e não é**
- Evidência: `src/components/minha-loja/TabLancar.jsx:676-699` — três `<span>` sem `onClick`, renderizados **logo abaixo** dos chips de filtro reais (`617-637`, "Todas / Pendentes / Confirmadas") com o mesmo tamanho de fonte e os mesmos ícones (`schedule`, `check_circle`).
- Quem sofre: franqueado (todas as vendas passam por esta tela).
- Impacto: clique morto na tela de maior volume; a pessoa quer "ver só os pendentes" e clica no número.
- Correção: transformar "N pendentes" e "N recebidas" em botões que setam `confirmationFilter` (`pending`/`confirmed`) e deixar "Total" como texto; ou remover a duplicidade e mostrar o valor dentro do próprio chip ("Pendentes 3 · R$ 210").
- Esforço: P. Risco: nenhum (estado local).

**V2. A área expandida da venda não tem nada clicável — mas é onde o olho vai para editar**
- Evidência: `TabLancar.jsx:828-1070`. As linhas de produto (`883-896`), o telefone do cliente em fonte mono (`846-849`), o bloco financeiro (`918-949`) e o "Lucro da venda" (`952-996`) são texto puro. As únicas ações são 4 botões `size="sm"` no rodapé (`999-1068`), com o rótulo escondido no celular (`hidden sm:inline`).
- Quem sofre: franqueado.
- Impacto: "errei a quantidade" → clica no produto → nada; precisa achar o ícone de lápis sem texto.
- Correção: (a) `onClick` na lista de produtos abrindo `handleEditSale(sale)`; (b) no mobile, mostrar rótulo dos 4 botões (a linha comporta) e subir "Compartilhar" para dentro da linha principal quando a venda é de hoje; (c) o telefone vira `<a href={getWhatsAppLink}>` (já existe o botão "Zap" ao lado — pode absorver o telefone inteiro como alvo).
- Esforço: P. Risco: `stopPropagation` nos novos handlers para não colapsar a linha (padrão já usado em `864`).

**V3. No `SaleForm`, o bloco "Total a receber" é visualmente idêntico aos blocos editáveis "Data da venda" e "Observações"**
- Evidência: `src/components/minha-loja/SaleForm.jsx:1277` (data), `1289` (obs) e `1304` (resumo) usam **a mesma classe** `p-3/p-4 bg-[#fbf9fa] rounded-xl border border-[#291715]/5`. Dois são inputs; o terceiro é só leitura. É o padrão "dois elementos idênticos lado a lado" que já rendeu 49 dead clicks no subtotal por linha (fix de 28/05, `1085-1091`).
- Quem sofre: franqueado.
- Impacto: clique no total para "corrigir o valor" → nada.
- Correção: resumo sem caixa (só linha tracejada em cima, como no cupom `SaleReceipt.jsx:163`), fonte maior no total; inputs mantêm a caixa cinza.
- Esforço: P. Risco: zero.

**V4. Botão "Registrar Venda" pode ficar desabilitado por até ~3 minutos sem dizer por quê — candidato aos 3 rage clicks**
- Evidência: `SaleForm.jsx:59-74` (`withRetry` 2 tentativas, 2 s/4 s) + `820-823` (timeout de **60 s por tentativa**) + `1363-1367` (`disabled={isSubmitting}`, texto "Salvando..."). Se o RPC trava, o botão fica cinza 60 s + 2 s + 60 s + 4 s + 60 s. O toast de "Falha ao salvar. Tentando novamente em 2s" (`68`) só aparece na falha, não no travamento.
- Quem sofre: franqueado com cliente esperando.
- Impacto: rage click; abandono; venda em rascunho que ela não sabe se salvou.
- Correção: timeout de 15 s (não 60) com mensagem "Está demorando… mantendo seu rascunho" e botão "Tentar de novo"; barra de progresso no botão. `⚠️ NÃO VERIFICADO` que os 3 rage clicks sejam aqui (as gravações dizem).
- Esforço: P. Risco: RPC `save_sale_with_items` dispara triggers em 28 itens — medir p95 real antes de baixar o timeout (CLAUDE.md fala em "60s matches previous timeout").

**V5. A busca de produto some com o nome do produto ao receber foco**
- Evidência: `SaleForm.jsx:117` `value={open ? query : selectedProduct?.product_name || ""}` + `122-125` `onFocus → setQuery("")`. Ao tocar no campo de um produto já escolhido, o nome desaparece e a lista abre inteira.
- Quem sofre: franqueado.
- Impacto: "sumiu meu produto?" → toca fora → volta; toque duplo por linha.
- Correção: manter o nome como placeholder enquanto `open`, ou abrir a lista já filtrada pelo nome atual.
- Esforço: P. Risco: zero.

**V6. Quickback de `/Vendas` (60% dos pageviews PC) tem uma causa de instrumentação e uma de fluxo**
- Evidência: instrumentação — `Vendas.jsx:236-240` (`replace` da URL ao abrir o form). Fluxo — o FAB `Layout.jsx:127` leva para `/Vendas?action=nova-venda`, o form abre por cima (`TabLancar.jsx:148,154-162`); cancelar/fechar deixa a pessoa numa lista que ela não pediu, e ela volta.
- Correção: não reescrever a URL (guardar o `action` em `location.state`), e depois remedir. Se o quickback continuar alto, o problema é o fluxo "FAB → lista de vendas", não o form.
- Esforço: P. Risco: `initialContactId`/`initialPhone` vindos de MyContacts (`MyContacts.jsx:401-407`) precisam continuar chegando — hoje já são copiados para estado (`TabLancar.jsx:150-151`).

### 1.2 `/Gestao` — PC 111 dead em 25,3% das sessões · Mobile 13 · quickback 22–33%

A aba padrão é **Resultado** (`Gestao.jsx:33`), então o grosso destes cliques é no `TabResultado`.

**G1. Três cards levantam sombra no hover e não são clicáveis**
- Evidência: `TabResultado.jsx:160` (Em Estoque), `230` (Caixa do mês), `326` (Mais vendidos) — todos com `hover:shadow-md transition-shadow`, nenhum com `onClick` no `Card`. Só sub-elementos são ações (botão "parados", "Lançar compra", "Ver todas as vendas").
- Quem sofre: franqueado (desktop, onde estão os 111 cliques).
- Impacto: o card "convida" e não responde — é o padrão validado no projeto (card com filho interativo).
- Correção: tirar `hover:shadow-md` dos três **ou** dar destino ao card inteiro (Em Estoque → `/Gestao?tab=estoque`; Caixa → rolar até "Onde foi o dinheiro"; Mais vendidos → `/Vendas`). Um `onClick` no `Card` com `if (e.target.closest('button,a')) return;` (padrão `MyContacts.jsx:692-695`).
- Esforço: P. Risco: zero.

**G2. "Entrou ▲ / Saiu ▼" no card Caixa parecem linhas expansíveis e há uma nota dizendo "detalhe abaixo"**
- Evidência: `TabResultado.jsx:249-286` — setas `arrow_upward`/`arrow_downward` ao lado de "Entrou"/"Saiu"; `283-285` nota em itálico *"detalhe abaixo em 'Onde foi o dinheiro'"*.
- Impacto: clica em "Saiu" esperando abrir o detalhe → nada.
- Correção: "Saiu" vira botão que faz `scrollIntoView` no `OndeFoiODinheiro` (ou expande inline as 3 maiores categorias). Trocar as setas por ícones de sentido (`south_east`?) ou remover.
- Esforço: P.

**G3. "Onde foi o dinheiro": linhas com barra de progresso e valor, sem drill-down**
- Evidência: `TabResultado.jsx:430-459`. Cada categoria tem ícone, nome, valor, barra e % — anatomia de item de lista navegável — e não faz nada. As despesas correspondentes estão **na mesma tela**, 2 cards abaixo (`1096-1138`).
- Correção: clicar na categoria filtra a lista "Despesas do mês" por aquela categoria (estado local `filterCategory`) e rola até ela.
- Esforço: P.

**G4. Gráfico "Evolução · últimos 6 meses" com dois eixos Y e três séries em tela de celular**
- Evidência: `TabResultado.jsx:576-630` — barra "Receita" no eixo esquerdo, linha "Lucro" e linha tracejada "Média 3m" no eixo **direito**, legenda com "(esq)"/"(dir)" (`634-647`). Barras aceitam hover (Tooltip) mas clique não faz nada.
- Impacto: dead click nas barras (desktop) e leitura impossível no celular — o eixo duplo é uma convenção de analista, não de quem "não sabe o que é DRE".
- Correção: um eixo só; barras de **Lucro** por mês (verde/vermelho), com a receita no tooltip; média móvel some. Ver §4.
- Esforço: P.

**G5. No Estoque (desktop), "Custo" e "Venda" ficam lado a lado e só um edita; e o badge "Comprar 12 un" parece botão**
- Evidência: `TabEstoque.jsx:1074-1076` (custo: texto) vs `1079-1119` (venda: `cursor-pointer` + hover dourado). Para o franqueado o custo é bloqueado (`341-343`, `562-565`) mas a célula não mostra isso — só o Dialog diz "(somente admin)" (`1373-1375`). Badge "Comprar N un" (`542-552`) é `Badge` sem ação.
- Impacto: dead click no custo; dead click na sugestão (a ação existe, mas em outra aba: Reposição → Novo Pedido → Usar sugestão).
- Correção: custo com `title="Definido pela fábrica"` e ícone de cadeado quando bloqueado; badge "Comprar N" vira botão que abre `PurchaseOrderForm` com `initialQuantities={{[item.id]: N}}` (a prop já existe: `TabReposicao.jsx:293-297`).
- Esforço: P (custo) / M (badge → pedido, precisa levantar o dialog de pedido a partir do Estoque).

**G6. Na Reposição, a "Sugestão de Reposição" lista o que comprar e não deixa comprar dali**
- Evidência: `TabReposicao.jsx:181-201` — 5 linhas "+12 un" sem `onClick`; o caminho real é "Novo Pedido" (`269-275`) → "Usar sugestão" (`PurchaseOrderForm.jsx:317-327`).
- Correção: o card inteiro abre o pedido já com `handleUseSuggestions` aplicado (1 toque em vez de 3).
- Esforço: P.

**G7. A aba padrão de "Gestão" no celular é a mais pesada e a menos urgente**
- Evidência: bottom-nav "Gestão" → `/Gestao` (`Layout.jsx:126`) → `TAB_MAP` default `resultado` (`Gestao.jsx:33`) → `TabResultado.loadData` carrega **o histórico inteiro** de vendas + itens em chunks + despesas + estoque (`TabResultado.jsx:776-832`) e mostra spinner "Carregando..." (`1022-1028`). A pergunta de quem está atendendo é "tem nhoque?" (Estoque), não "quanto sobrou no mês".
- Impacto: quickback 25,7% mobile / 33% tablet; 64% de tempo ativo.
- Correção: bottom-nav aponta para `/Gestao?tab=estoque`; Resultado continua a um toque. (Perf do `TabResultado` é da frente 01.)
- Esforço: P. Risco: zero.

### 1.3 `/FranchiseSettings` (Meu Vendedor) — PC 37 dead em 26,3% · quickback 31–37%

**F1. Na etapa "Revisão", o botão "Salvar" fica desabilitado porque o "Próximo" já salvou — e a pessoa clica nele para terminar**
- Evidência: `FranchiseSettings.jsx:1253-1261` `disabled={isSubmitting || !isDirty}`; `521-529` `nextStep` faz `handleSubmit()` quando `isDirty` e zera `isDirty` (`407`). Ao chegar na Revisão sem mexer em nada, "Salvar" nasce cinza (`opacity-50`), sem texto explicando. O rodapé mostra "Salvo há N min" em `text-[10px]` itálico (`1234-1236`).
- Quem sofre: franqueado configurando o robô (é a única tela do fluxo com "Salvar" no fim).
- Impacto: é o candidato mais forte aos 26,3% — a pessoa termina o wizard e o botão final não responde; muitos voltam etapas procurando o que faltou (quickback 37%).
- Correção: na Revisão, botão "Concluir" sempre habilitado: se `!isDirty`, faz nada de banco e mostra toast "Tudo salvo — seu vendedor está configurado" + leva ao card de WhatsApp (`672-714`) se ainda não conectado; se `isDirty`, salva. Trocar "Salvo há N min" por uma pill visível "✓ Salvo".
- Esforço: P. Risco: zero.

**F2. A Revisão mostra os valores mas só o "Editar" minúsculo de cada seção é clicável**
- Evidência: `components/vendedor/ReviewSummary.jsx:17-23` (`text-xs`, "Editar") e `26-35` (linhas de campo sem `onClick`). Campos com aviso amarelo "Não preenchido" (`29-31`) também não levam à etapa.
- Correção: a linha inteira (e principalmente a com aviso) chama `onGoToStep(stepNum)`; "Editar" ganha `min-h-[40px]`.
- Esforço: P.

**F3. Chips de pagamento desabilitados sem explicação visível no celular**
- Evidência: `FranchiseSettings.jsx:814-820` + `WizardFields.jsx:72-89` — chips de maquininha/dinheiro/VR ficam `disabled` com `title="Motoboy terceirizado não leva máquina"` (tooltip só existe no desktop).
- Correção: em vez de desabilitar, mostrar o chip riscado com o motivo em texto abaixo (a linha amarela `805-810` já existe para o método — repetir a lógica nos chips).
- Esforço: P.

**F4. Bolinhas de etapa no rodapé (mobile) não são clicáveis; os passos do topo são**
- Evidência: `FranchiseSettings.jsx:1218-1233` (`div`s) vs `WizardStepper.jsx:59-98` (`button`).
- Correção: bolinhas viram `button` chamando `goToStep`. Esforço: P.

### 1.4 `/MyContacts` — PC 25 dead em 19,3% · quickback 44% mobile / 30% PC

**C1. Duas linguagens para o mesmo status na mesma tela**
- Evidência: `MyContacts.jsx:66-73` abas "Responder / Negociando / Clientes / Fiéis / Sumidos" vs `27-64` badges no card "Contato Novo / Interessado / Cliente / Cliente Fiel / Clientes Sumidos". A aba "Responder" (imperativo) e o badge "Contato Novo" (substantivo) são o mesmo `novo_lead`.
- Impacto: a pessoa clica no badge do card achando que filtra (é o mesmo estilo de chip das abas) → abre o Dialog de edição (clique do card, `690-697`) — não é dead click, é **clique errado**.
- Correção: um vocabulário só (o das abas), badge do card clicável → filtra pela aba.
- Esforço: P.

**C2. O cartão promete histórico ("3 compras · R$ 250 total · última há 2 meses") e o toque abre um formulário de edição sem histórico**
- Evidência: `MyContacts.jsx:726-751` (resumo de compras) → `openEdit` (`690-697`) → Dialog `820-942` com nome/telefone/endereço/bairro/notas. Não existe lista de vendas do contato em lugar nenhum do app do franqueado (`TabLancar` só busca por nome).
- Impacto: quickback 44% no celular é coerente com "abri, não era isso, voltei".
- Correção: no Dialog (ou num Sheet), aba "Compras" com `Sale.filter({contact_id})` (5 últimas: data, valor, itens) e botão "+ Venda" (já existe em `796-803`). É a pergunta "o que essa cliente costuma pedir?" respondida no momento do atendimento.
- Esforço: M. Risco: RLS de `sales` já filtra por franquia; 1 query por abertura.

**C3. Mobile: botões "Zap / Venda / Editar" com 30 px de altura e rótulo escondido**
- Evidência: `MyContacts.jsx:774-811` `px-2.5 py-1.5 text-xs` + `hidden sm:inline` — alvo < 48 px lado a lado.
- Correção: `min-h-[44px]` e rótulos sempre visíveis (a linha comporta 3 palavras curtas).
- Esforço: P.

### 1.5 `/Dashboard` (+ `/`) — 29 PC + 29 Mobile dead

**D1. Barras do gráfico têm `cursor-pointer` e só respondem a hover**
- Evidência: `components/dashboard/MiniRevenueChart.jsx:125-137` — `cursor-pointer` + Radix `Tooltip` (hover). No celular não há hover; no desktop o clique não faz nada.
- Correção: tirar `cursor-pointer`; no mobile, mostrar o valor sempre (já mostra quando ≤10 barras, `107-108`) ou tornar a barra um `Link` para `/Vendas` com o dia filtrado (`TabLancar` só filtra por hoje/semana/mês — teria que aceitar `?date=`).
- Esforço: P (tirar) / M (link com data).

**D2. "Meta do Dia", "3º de 40 hoje", "N dias batendo meta" e a faixa "Tudo em dia!" são cards sem destino**
- Evidência: `DailyGoalProgress.jsx:12-44`, `RankingStreak.jsx:43-118`, `PriorityAction.jsx:113-127`. Têm borda, sombra e número grande — a mesma anatomia dos 3 `StatsCard` que **são** links (`StatsCard.jsx:32-38`).
- Correção: ranking → `ConversionDetailSheet`-like com a posição e os 3 acima/abaixo (a RPC `get_franchise_ranking_monthly` já devolve `prev_rank_position`; a lista precisaria de RPC nova — `⚠️` escopo do admin/CS decide se pode expor nomes); meta → `/Vendas` filtrado em hoje; streak → texto simples sem card.
- Esforço: P (afordância) / M (destinos).

**D3. `PriorityAction`: o card inteiro não é clicável; só o botão de 30 px no canto**
- Evidência: `PriorityAction.jsx:133-154` — `div` sem `onClick`; CTA `px-3 py-1.5 text-xs`.
- Correção: card inteiro = ação; CTA `min-h-[44px]`. Esforço: P.

**D4. Linha "Sua Equipe Digital — Setembro · Pago" não responde ao toque**
- Evidência: `FinancialObligationsCard.jsx:112-116` `cursor-pointer`/`onClick` só quando `!isPaidStatus`.
- Impacto: quem quer o comprovante/histórico da mensalidade paga toca e nada acontece — e não há lugar para isso no app (ver §7).
- Correção: quando pago, abrir o mesmo `SubscriptionPaymentSheet` em modo "recibo" (valor, data, link do boleto). Esforço: P.

---

## 2. `/Dashboard` no celular: 75% de quickback, 11% de tempo ativo

### 2.1 O que a tela mostra HOJE (ordem real de render, `FranchiseeDashboard.jsx:405-621`)

1. Cumprimento "Boa tarde, Maria!" + "Unidade Suzano" (`409-412`, `FranchiseeGreeting.jsx`)
2. **Filtro de período** Hoje / Semana / ◀ Set/2026 ▶ / Personalizado (`416-505`) — 5 controles antes do primeiro número
3. 4 cards 2×2: Vendas Hoje · Faturamento · Valor Médio · Conversão (`507-537`)
4. Meta do Dia (barra; só em "hoje"/"mês atual") (`539-541`)
5. Ação prioritária (1 faixa) (`543-549`)
6. Ranking "3º de 40 hoje" + Streak (`551-566`)
7. Gráfico "Faturamento 7 dias" (`568-576`)
8. Card "Sua Equipe Digital / Investimento Marketing" (`578`)
9. "Outras Ações" — até 4 cards de contato (`610`)
10. (desktop) botão fixo "Nova Venda" (`613-621`)

### 2.2 Por que ela entra e sai (cinco causas, todas no código)

**a) A home é passagem obrigatória para vender.** `mainPage: "Dashboard"` (`pages.config.js:90`); o login cai em `/` (`App.jsx:146`); o botão de vender está na bottom-nav (`Layout.jsx:127`), não na home. Abrir o app → home → FAB é, por definição do Clarity, um quickback. Com 8.076 vendas manuais em 90 dias (~90/dia na rede), boa parte dos 349 acessos mobile/3d à home é exatamente isso.

**b) A primeira pintura mostra zeros falsos, depois o skeleton, depois o dado.** `FranchiseeDashboard.jsx:71-77`: `franchiseId = ctxFranchise?.id`; no primeiro mount `ctxFranchise` é `null` (`AuthContext.jsx:11` inicia `null`; quem preenche é o `Layout` **depois** de `Franchise.list()`, `Layout.jsx:155-166`). `loadData` então faz `setIsLoading(false); return` **antes** de marcar `hasLoadedOnceRef` (`84`) → a tela renderiza com `allSales=[]`: "Vendas Hoje 0", "Faturamento R$ 0", "Registre sua primeira venda →" (`RankingStreak.jsx:95-100`), "Investimento de marketing pendente" (`PriorityAction.jsx:79`, porque `marketingPayment` ainda é `null`). Quando o `Layout` seta a franquia, `loadData` roda de novo, aí sim com skeleton (10 queries em `104-128`, uma delas `fetchAll` de 90 dias de vendas), e só depois o número real. `⚠️ NÃO VERIFICADO` a duração de cada fase (não rodei o app); a sequência é o que o código faz.

**c) Franquias antigas caem no tour de boas-vindas em qualquer aparelho novo.** `Layout.jsx:203-205`: se não há linha em `onboarding_checklists` **e** `localStorage` não tem `onboarding_welcome_seen`/`onboarding_skipped` → `<Navigate to="/OnboardingWelcome">` (`319-321`). **57 das 67 franquias não têm linha de onboarding** (medido). Ou seja: trocou de celular, limpou o navegador, abriu no PC do marido → tour de 7 telas (`OnboardingWelcome.jsx:9-104`) antes da home. O Clarity mostra `/OnboardingWelcome` PC com 370 s totais e **13 s ativos (4%)** — alguém preso ali.

**d) Quatro consultas da home são carregadas e nunca lidas.** `FranchiseeDashboard.jsx:114-115` (`DailyChecklist` — tabela com 0 linhas), `120-121` + `153` (`purchaseOrders`: setado, **nunca lido** — a variável só aparece em `52` e `153`), `122-123` + `154` (`onboardingChecklist`: idem, `53` e `154`), e `summaries` só serve para a meta. São restos do Health Score removido em 03/07. Custo sem retorno em toda abertura (a frente 01 cobra a perf; aqui o ponto é que o dado mais pedido — "meu pedido saiu?" — **está sendo baixado e jogado fora**).

**e) O filtro de período no topo é o controle errado para a tela errada.** Hoje/Semana/Mês/Personalizado (`416-505`) muda os 4 cards, a meta, o ranking e o gráfico ao mesmo tempo; "Personalizado" abre um Sheet com duas datas (`CustomDateRangeSheet.jsx`). Isso é ferramenta de análise (cabe em Resultado/Vendas), não de quem abre o app entre duas mensagens.

### 2.3 O que ela foi buscar

Pelas perguntas reais do WhatsApp (CLAUDE.md) e pelo que o banco mostra: (1) **vender** (FAB), (2) **"quanto vendi hoje / quanto tenho pendente de receber"** (96% das vendas são marcadas como recebidas — o hábito de conferir existe; a informação "N pendentes · R$ X" só aparece dentro de `/Vendas`, `TabLancar.jsx:676-699`), (3) **"meu pedido da fábrica saiu?"** (10 pedidos em aberto agora; 57 franquias pediram em 60 d; o status só está em Gestão → Reposição → Histórico, `PurchaseOrderHistory.jsx:16-22`), (4) **"o robô está funcionando?"** (10 franquias vendendo com robô mudo há 7 d — e a home diz "Tudo em dia!", ver E1), (5) **"estou devendo alguma coisa?"** (card 8), (6) **"quem eu preciso responder?"** (Outras Ações — no fim da página).

### 2.4 Home reprojetada (mobile), com o porquê de cada posição

| # | Bloco | Por quê aqui | Dado já existe? |
|---|---|---|---|
| 1 | **Faixa de estado** — "Robô atendendo · última conversa há 12 min" ou "Robô parado há 8 dias — reconectar" + "Pedido #123 confirmado, sai amanhã" | As duas coisas que ela pergunta no WhatsApp e que hoje o app esconde. Sem período, sem número grande. | Robô: `bot_conversations` por franquia (o CS já calcula `bot_silent`, `supabase/cs-cockpit/09-*.sql`) — falta RPC pequena para o franqueado. Pedido: **já carregado** em `loadData()[6]` e descartado. |
| 2 | **Hoje** — "R$ 480 em 6 vendas · 2 pendentes (R$ 130) ▸" | É o número que ela quer ao abrir; "pendentes" leva a `/Vendas?confirm=pending`. Comparação: "ontem foi R$ 410" em texto (não %, ver §4). | `allSales` de hoje (`197-200`) + `payment_confirmed`. |
| 3 | **Precisa de você** (máx. 3 linhas) — estoque zerado, marketing/mensalidade em aberto, 2 clientes para responder | Funde `PriorityAction` + `SmartActions` + `FinancialObligationsCard`, hoje em 3 lugares (posições 5, 8, 9). Cada linha é a ação. | tudo em `actions`/`marketingPayment`/`subscription`/`inventory`. |
| 4 | **Mês** — "Set: R$ 9.800 · 4º de 40 · era 6º em Ago" + link "Ver resultado" | Ranking e mês num só olhar; sai daqui para Resultado. | `stats` mensal + `monthlyRanking` (`292-309`). |
| 5 | **Últimos 7 dias** (gráfico simples, sem hover, valores sempre visíveis) — opcional, colapsado | Quem quer analisar vai a Resultado; fica como cauda. | `MiniRevenueChart` sem período. |
| — | Removidos da home: filtro de período (vai para Vendas/Resultado, onde já existe: `TabLancar.jsx:530-598`, `TabResultado.jsx:80-110`), "Personalizado", Meta do Dia como card (vira uma linha em "Hoje": "meta R$ 520"), Streak, cumprimento com 2 linhas (vira 1). | | |

Regras de implementação que protegem contra regressão: skeleton enquanto `ctxFranchise` for `null` (não zeros); remover as 3 queries mortas (`[3]`, `[7]` e `summaries` se a meta virar linha); manter `resolveActiveFranchise` como está. Esforço total: **M** (é reordenar e fundir componentes que existem; a única peça nova é a RPC de "última conversa do robô"). Risco: `PriorityAction`/`SmartActions` são `React.memo` com contratos próprios — fundir exige teste de cada cenário (`PriorityAction.jsx:4-105`).

---

## 3. `SaleForm`: quantos toques leva uma venda típica

Cenário do enunciado (cliente conhecido, 3 itens, PIX, entrega). Dados reais: 2,12 itens/venda, 54% entrega, 74% PIX — o cenário é um pouco acima da média, mas representativo. Contagem no celular, a partir de qualquer tela, "toque" = tap; "digita" = sessão de teclado.

| # | Ação | Onde | Toques |
|---|---|---|---:|
| 1 | FAB "Vender" | `Layout.jsx:127` → `/Vendas?action=nova-venda`; página carrega 3 queries + contatos (`Vendas.jsx:50-54,135-137`) e abre o Dialog (`TabLancar.jsx:154-162`) | 1 |
| 2 | Cliente: toca o campo, digita, escolhe | `SaleForm.jsx:934-942`; nada aparece antes de digitar 1 char (`280-287`); busca no servidor com 300 ms (`292`); toca o resultado (`325-339`) | 2 + digita |
| 3 | Produto 1: toca busca, digita, toca item (foco pula para qtd sozinho) | `1032-1037`, `ProductSearch` `114-161` | 2 + digita |
| 4 | Qtd = 1 (padrão) | `416-418` | 0 |
| 5 | "Adicionar produto" | `1114-1123` | 1 |
| 6 | Produto 2 | idem 3 | 2 + digita |
| 7 | "Adicionar produto" | | 1 |
| 8 | Produto 3 | idem 3 | 2 + digita |
| 9 | Desconto | colapsado, padrão nenhum (`883`, `1127`) | 0 |
| 10 | Pagamento | padrão `pix` (`395`), colapsado com resumo "PIX" | 0 |
| 11 | **Entrega**: abre a seção colapsada, toca "Delivery", toca "Frete", digita o valor | `888-905` (seção fechada por padrão), `1246-1257`, `1263-1271` | 3 + digita |
| 12 | Data | padrão hoje (`410`) | 0 |
| 13 | Observação (janela de entrega, portaria) — 10% das vendas | `1294-1300` | (2 + digita) |
| 14 | Rola até o fim, "Registrar Venda" | `1363-1378` (Dialog `max-h-[85dvh]`, `TabLancar.jsx:1083`) | 1 |
| 15 | Cupom: o Dialog fecha e a lista recarrega (`TabLancar.jsx:370-375`); acha a venda, toca a linha, toca "Compartilhar", escolhe o contato no WhatsApp | `736-738`, `1000-1021`, `shareUtils.js:26-41` | 3 |

**Total: 18 toques + 5 sessões de teclado para registrar; 21 toques com o cupom.** Sem observação: 16/19.

### O que já vem preenchido e o que ela redigita todo dia

Vem preenchido: data, PIX, retirada, qtd 1, preço unitário (`sale_price` do estoque, `640-644`), taxa de cartão da config (`536-558`), rascunho de 24 h (`467-514`). **Redigita todo dia**: o nome do cliente (sem lista de recentes no foco — `310-312` só reabre se já houve busca), os produtos (sempre por busca, mesmo com 28 SKUs e os 5 mais vendidos concentrando a venda — `getTopProducts` existe em `financialCalcs.js:66-77` e não é usado aqui), o **frete** (a config tem regra de frete em **60 de 67 unidades**, `delivery_fee_rules`/`delivery_schedule`, que o bot usa e o `SaleForm` ignora — só lê `payment_fees`, `536-551`) e o **tipo de entrega** (54% das vendas são entrega, o padrão é retirada, e a escolha está escondida numa seção colapsada).

### Cortes, em ordem de (toques poupados × vendas/dia) / esforço

**S1. Frete automático ao escolher "Delivery"** — preencher `deliveryFee` com a regra da config (primeira faixa/valor único; se `mode: "modality"`, a primeira regra) e manter editável; guardar também o último frete usado para o mesmo `contact_id`. Poupa 2 toques + 1 digitação em 54% das vendas. **622 entregas com frete R$ 0 em 90 dias** (14%) sugerem que hoje o campo é esquecido — e frete é receita no DRE (`financialCalcs.js:21`). Esforço: P. Risco: regra por km precisa de distância que a venda manual não tem — usar a menor faixa como sugestão e sinalizar "sugerido".

**S2. Entrega/Retirada sempre visível, como os botões de pagamento** — tirar do `MobileSection`. Poupa 1 toque em 54% das vendas e evita registrar entrega como retirada (o cupom do motoboy depende disso, `SaleReceipt.jsx:179-186`). Esforço: P.

**S3. Grade de produtos em vez de busca por linha** — chips com os 8 mais vendidos da franquia (`getTopProducts` sobre os `saleItems` dos últimos 28 d, que `Gestao.jsx` já carrega; em `Vendas.jsx` seria 1 query `SaleItem` com `gte`) + "todos" agrupados como no `PurchaseOrderForm.jsx:102-124`; toque adiciona linha com qtd 1, segundo toque incrementa. De 3 toques + digitação por produto para **1 toque**. Poupa ~6 toques e 3 digitações na venda típica. Esforço: M. Risco: manter `availableProducts` (não repetir SKU) e o alerta de estoque zerado (`1104-1109`).

**S4. Compartilhar o cupom logo depois de salvar** — o RPC devolve `saleId` (`823`), mas `onSave()` é chamado sem ele (`855`). Passar o id, e em `handleFormSave` expandir a venda e mostrar toast com ação "Enviar comprovante" (`sonner` action já é usado em `493-513`). Poupa 2 toques e a caça à venda na lista. Esforço: P. Bônus: o tutorial "Registrando uma Venda" promete exatamente isso (`Tutoriais.jsx:88`) e hoje mente.

**S5. Clientes recentes ao focar o campo** — `contacts` chega ordenado por `-created_at` (`Vendas.jsx:90-95`); mostrar os 5 últimos que compraram ao focar (sem digitar). Poupa 1 digitação. Esforço: P.

**S6. Endereço da entrega no próprio form** — quando "Delivery", mostrar "Entregar em: Rua X, 12 — Bairro" vindo do contato (`contact.endereco/bairro`, já nas colunas de `Vendas.jsx:94`) com "editar"; se vazio, campo de endereço que grava no contato (`Contact.update`) e no snapshot da venda (`customer_address`). **65% das entregas manuais não têm endereço em lugar nenhum** — o cupom sai sem "Endereço" e o motoboy liga. Não poupa toque; poupa a ligação. Esforço: M. Risco: `trg_sales_fill_customer_snapshot` copia do contato só quando vier `null` (CLAUDE.md) — gravar no contato antes do RPC resolve.

Com S1–S5 a venda típica cai para **~9 toques + 2 digitações** (cliente e, quando houver, observação).

---

## 4. Leitura de números: jargão, centavos e comparações que faltam

**N1. "Vendas Hoje +100%" quando ontem foi zero.** `StatsCard.jsx:14-19`: com `previousValue === 0` e valor atual > 0, `percentageChange = 100` e a badge renderiza (`trend` vem de `salesCount > prevSalesCount`, `FranchiseeDashboard.jsx:513`). Segunda-feira contra domingo fechado = "+100%" em todo card. O CLAUDE.md descreve o contrário ("null quando `previousValue <= 0`") — o código diverge da nota. Correção: não renderizar badge quando `previousValue <= 0` (ou mostrar "ontem: R$ 0"). E "hoje vs ontem" é a comparação errada para comida congelada: comparar com **o mesmo dia da semana passada**. Esforço: P.

**N2. Centavos onde não decidem nada.** A home usa `formatBRLInteger` (`FranchiseeDashboard.jsx:518,526`), mas `TabLancar` (`48-51`), `TabResultado` (`51-52`), `DailyGoalProgress` (`31-34`, "R$ 1.234,56 de R$ 987,65"), `SaleForm` e `MyContacts` (`93-98`) usam formato próprio com 2 casas. O número de "Lucro do mês" em `text-4xl`/`5xl` com ",67" no fim (`TabResultado.jsx:116-120`) é o caso mais visível. Regra: total de venda e cupom com centavos (é dinheiro que se cobra); agregados (dia, mês, meta, ano, estoque a vender, ranking) sem. Esforço: P (trocar import por `formatBRLInteger` de `lib/formatters.js`, e apagar os 4 `formatCurrency` locais — a frente 02 vai cobrar essa duplicata).

**N3. Jargão no `TabResultado`.** "Markup médio +85%" (`183-186`), "Frete cobrado", "(-) Descontos" (`257-271`), "Média 3m", "Crescimento %" (`560-570`, mostra "—" quando o primeiro mês foi negativo e um % sem sentido quando foi pequeno), "Tendência 📈" (`484`, emoji como dado), "Receita (esq) / Lucro (dir)" (`637-641`), "Acumulado". Para quem "não sabe o que é DRE": **Entrou / Saiu / Sobrou** já está no card Caixa (`249-286`) — é a linguagem certa; o resto da tela não a segue. Correção: HeroMetric "Sobrou em setembro: R$ 3.200 · em agosto sobrou R$ 2.900"; Em Estoque "Dá para vender R$ 4.100 (custou R$ 2.050)"; Evolução com um eixo e barras de "quanto sobrou" por mês. Esforço: P–M.

**N4. O banner de estado promete uma ação que o app não tem.** `financialCalcs.js:174-181` (estado vermelho): *"Que tal acionar o bot para ativar clientes inativos?"* — não existe função de reativação automática; o que existe é a sugestão manual "Reativar" em `SmartActions` (WhatsApp na mão). Corrigir o texto para o que existe: "Veja em Início → Precisa de você quem não compra há 14+ dias". Esforço: P.

**N5. Conversão em "p.p."** — `ConversionCard.jsx:60` e `ConversionDetailSheet.jsx:114` mostram "▼ 1,5 p.p.". Trocar por "era 17% em agosto". O restante do detalhe é o melhor texto do app ("92 das 589 pessoas que falaram com você compraram", "Média da rede 9,2%") — é o modelo a copiar. Esforço: P.

**N6. Meta do Dia parece meta da franqueada, mas é média × 1,1 calculada pelo app.** `FranchiseeDashboard.jsx:271-290` (média dos últimos 30 dias de `daily_summaries` + 10%). O card diz "Meta do Dia · 63% concluída · Faltam R$ 187,35!" (`DailyGoalProgress.jsx:15-41`) sem dizer de onde veio. Correção: rótulo "Sua média + 10%: R$ 520" ou deixar a franqueada definir a meta mensal (o checklist mensal `me5` manda ela "definir meta" e não há onde). Esforço: P (rótulo) / M (meta editável).

**N7. Comparações que faltam**: na home não há "mês passado" em texto (só a badge %); no Resultado há "vs mês anterior" só no lucro; **média da rede** existe apenas na conversão (`get_network_funnel_benchmark`) — o dado de faturamento da rede está disponível ao admin (`FranchiseRanking`) e daria uma linha "unidades como a sua vendem em média R$ X" (`⚠️` decisão de negócio: expor média da rede ao franqueado). Ranking mensal já traz `prev_rank_position` — usar "era 6º" em vez de "↑ subiu 2 posições".

---

## 5. Erro e silêncio

Varredura de `if (...) return;` em `pages/` + `components/` do franqueado (57 ocorrências): a grande maioria é guarda técnica (abort, mounted, sem franquia). As que **engolem um clique** ou **mentem no sucesso**:

**E1. "Tudo em dia! Seu negócio está rodando bem" com o robô parado.** `FranchiseeDashboard.jsx:352` `botActive = !!(franchiseConfig && evoId)` — "ativo" = existe linha de config. `PriorityAction.jsx:93-104` só alerta quando `!botActive`. Resultado: **10 franquias vendendo nos últimos 30 dias e sem nenhuma conversa do robô há 7 dias** veem a faixa verde. É a mesma cegueira que o CS corrigiu para si em 17/08 (`bot_silent`); o franqueado continua sem o sinal. Correção: `botActive` = última `bot_conversations.started_at` ≤ 7 d (RPC de 1 linha; `bot_conversations_lookup_idx` já serve) e cenário "Robô sem conversas há N dias — reconectar" no `PriorityAction`. Esforço: P. Risco: unidade nova sem venda entra como "parado" — repetir a guarda `d_sale is not null` do SQL do CS.

**E2. "Venda registrada!" com o cliente perdido no caminho.** `SaleForm.jsx:744-758` `resolveContactId` — se `Contact.create` falha (rede, duplicado por outro nome, RLS), faz `console.warn` e devolve `null`; a venda é salva sem `contact_id` e o toast é de sucesso. Cupom sai sem nome/telefone (caso Itápolis). Correção: toast amarelo "Venda salva, mas o cliente não ficou vinculado — toque para corrigir" com ação que abre a edição. Esforço: P.

**E3. Venda de R$ 0 e linha de produto a R$ 0 passam sem aviso.** `SaleForm.jsx:765-768` só valida "pelo menos um produto"; `640-644` põe `unit_price = sale_price || 0`. Medido: **38 vendas a R$ 0 e 67 com linha a R$ 0** em 90 dias — produto sem preço de venda (o banner "N produtos sem preço" só aparece em Estoque, `TabEstoque.jsx:694-702`). Correção: bloquear `unit_price <= 0` com toast "Nhoque Mussarela está sem preço — defina no Estoque ou digite o valor" e focar o campo. Esforço: P.

**E4. Botões desabilitados sem explicação (o clique não faz nada e ninguém diz por quê).** `PurchaseOrderForm.jsx:555-559` "Enviar Pedido" (`!hasAnyQty`); `TabReposicao.jsx:250-266` "Repetir último" (tooltip só no hover); `MyContacts.jsx:538-544` "Criar Contato" (sem nome); `FranchiseSettings.jsx:1253-1261` "Salvar" (§F1); `MarketingPaymentSection.jsx:431-444` "Anexar comprovante" (sem arquivo). Padrão para todos: botão habilitado que, ao clicar sem pré-condição, mostra o toast dizendo o que falta — é o mesmo princípio do fix do CPF de 22/06. Esforço: P cada.

**E5. Promessas em texto que o código não cumpre.**
- `Tutoriais.jsx:88` "O comprovante aparece na tela" após registrar — não aparece (`TabLancar.jsx:370-375` só fecha o Dialog). Vira verdade com S4.
- `Tutoriais.jsx:62-68` descreve um wizard de 5 passos "Informações / Horário / Delivery / Pagamento / Catálogo" — o wizard real é "Sua Unidade / Operação e Pagamentos / Entrega / Vendedor / Revisão" (`WizardStepper.jsx:4-10`). `ITEM_DETAILS.jsx:64` diz "6 passos". Quem segue o tutorial não acha o passo "Horário".
- `Tutoriais.jsx:103` "filtro de período por dia, semana ou mês" no Resultado — o Resultado só navega por mês (`TabResultado.jsx:80-110`).
- `CHECKLIST_DETAILS.jsx` `me2` manda "Acesse Relatórios no Dashboard" (removido em 03/07) e `n5`/`s6` mandam usar "a Planilha de Pedido oficial" (contradiz a Reposição do app).
- `PriorityAction.jsx:99` "Franquias com bot vendem em média 40% mais" — `⚠️ NÃO VERIFICADO`, sem fonte no repositório.
- `Onboarding.jsx:849-854` "O CS foi notificado e vai validar" — o código só muda `status` para `pending_approval` (`381-382`); não há `notify_admins` nesse fluxo (`⚠️` pode existir trigger no banco).
- `SubscriptionPaymentSheet.jsx:156-158` "liberação automática em minutos" — depende do webhook ASAAS; verdade quando ele está de pé (documentado como ativo).
Correção: 1 h de revisão de texto (P). É barato e é a diferença entre "app que ensina" e "app que engana".

**E6. Rascunho de venda restaurado sem contexto.** `SaleForm.jsx:467-514` — abriu o form ontem, fechou; hoje a "Nova Venda" já vem com o cliente e os produtos de ontem e um toast de 6 s "Rascunho recuperado [Descartar]". Passou o toast, a venda de hoje sai com produto de ontem. Correção: rascunho com mais de 2 h pede confirmação inline ("Continuar a venda de ontem para Maria?") em vez de aplicar; ou mostrar uma faixa fixa no topo do form enquanto o rascunho estiver ativo (como `PurchaseOrderForm.jsx:292-310` faz). Esforço: P.

**E7. Tour de boas-vindas guardado só no aparelho** (`OnboardingWelcome.jsx:141,150`; `Layout.jsx:180-181,188-189`) — ver §2.2c. Correção: gravar `welcome_seen_at` no `profiles` (1 coluna) e só redirecionar quando a franquia **tem** checklist aberto. Esforço: P. Risco: `Layout` roda em toda tela — testar franqueado novo (com checklist) e antigo (sem).

---

## 6. O que o franqueado tem e não usa

**U1. `/MyChecklist` — feature morta, invisível e ainda custando.** Não há link em `Layout.jsx` (nem sidebar `29-121` nem bottom-nav `124-130`); só existe em `pages.config.js:65,81`. A tabela `daily_checklists` tem **0 linhas** — ninguém nunca abriu (a página cria a linha do dia ao abrir, `MyChecklist.jsx:145-152`). Mesmo assim a home consulta `DailyChecklist` em toda abertura (`FranchiseeDashboard.jsx:114-115`) e o chunk é buildado. O conteúdo (`CHECKLIST_DETAILS.jsx`, 220 linhas de scripts de WhatsApp) é bom — está no lugar errado. Correção: remover a rota, a query da home e a entidade; mover os 6 scripts de mensagem (`m2, md1, md2, md3, t5, t7`) para dentro de `SmartActions` como "copiar mensagem" ao lado de "WhatsApp" (`SmartActions.jsx:117-130`) — é onde a ação acontece. Esforço: P (remover) + P (scripts nos cards). Risco: `no-undef` desligado — ao apagar `DailyChecklist` do `entities/all.js`, `grep -rn "DailyChecklist" src/` antes do build.

**U2. `/Marketing` para o franqueado é um formulário de PIX com uma biblioteca quase vazia embaixo.** Ordem da página (`Marketing.jsx:1076-1296`): `MarketingPaymentSection` → card de busca com 5 chips de tipo + 2–3 selects (`1084-1220`) → grade. A biblioteca tem **7 arquivos no total, 3 nos últimos 90 dias**. Explica 18% de tempo ativo e scroll 63: a pessoa paga e sai; abaixo há filtros para 7 itens. Correção: (a) o pagamento sai da tela Marketing e vira o que já é na home ("Precisa de você" → Sheet de pagamento, como a mensalidade tem `SubscriptionPaymentSheet`); (b) a tela Marketing vira "Artes do mês": sem filtros até haver > 20 arquivos, mostrando o mês atual aberto e "meses anteriores" colapsados; (c) o admin decide se a biblioteca vive (o `ITEM_DETAILS.jsx:101` manda o franqueado "todo mês abrir o Marketing e baixar as artes novas" — com 3 artes em 90 dias, a instrução não tem o que entregar). Esforço: M. Risco: `marketing_files` usa `fetch` direto por causa do trava do supabase-js (`36-101`) — não tocar nisso.

**U3. `/Tutoriais` — 7 sessões (PC), 0 no celular, e o conteúdo está desatualizado.** Só na sidebar (`Layout.jsx:72-78`), fora da bottom-nav; os vídeos abrem o YouTube em outra aba (`Tutoriais.jsx:280-285`) e marcam "assistido" no clique, não na visualização (`280`). Texto descreve telas que mudaram (§E5). Correção: ajuda contextual — um "?" no cabeçalho de cada tela abrindo o `StepGuide` daquela tela (`232-269`, já é um componente); reescrever os 8 passos-a-passo contra as telas atuais; tirar do menu. Esforço: P (texto) / M (contextual).

**U4. `/PurchaseOrders` com 4 sessões não é subuso do franqueado.** É `ADMIN_ONLY_PAGES` (`App.jsx:22-24`). O lado do franqueado vive em `/Gestao?tab=reposicao` e **é usado**: 148 pedidos em 60 dias por 57 franquias. O Clarity agrega tudo em `/Gestao`. Nada a fazer aqui; a leitura "PurchaseOrders subutilizada" é do admin (frente 05).

**U5. Onboarding: 10 checklists abertos, 0 aprovados, 57 franquias sem checklist.** `Onboarding.jsx` + `Layout.jsx:319-321`. Para 57 unidades a única presença do onboarding é o redirect indevido do tour (§2.2c). Para as 10 abertas, o item de menu só aparece com `hasActiveOnboarding` (`Layout.jsx:272-274`). `⚠️` se os 0 aprovados são "ninguém aprova" ou "o gate não é usado" é pergunta para o CS.

**U6. Exportar Excel/PDF em Vendas e Resultado no celular.** `ExportButtons` puxa o chunk `export` (856 KB bruto) ao clicar (`ExportButtons.jsx:16-98`); `doc.save()`/`saveAs` no navegador do celular vira um download que ela não acha. `⚠️ NÃO VERIFICADO` uso real (Clarity não mede clique por elemento na API). Hipótese: uso é do admin/PC. Correção mínima: esconder no mobile (`hidden sm:flex`) e deixar "Compartilhar cupom" como o caminho móvel. Esforço: P.

**U7. "Período personalizado" na home** (`CustomDateRangeSheet.jsx`, 130 linhas, máx. 90 dias): análise numa tela de passagem. Vai junto com o filtro (§2.4).

**U8. Sino de notificações.** 1.755 notificações em 30 dias — quase todas `notify_admins` (pedido novo, comprovante). Para o franqueado o sino quase sempre está vazio (`NotificationBell.jsx:115-119` "Nenhuma notificação") e ocupa 40 px do topo em toda tela. `⚠️` não medi quantas são de franqueado. Se forem ~0, o sino sai do mobile.

---

## 7. O que a franqueada pergunta no WhatsApp e o app não responde

| Pergunta recorrente (caso real) | Onde o app responde hoje | O que faltaria |
|---|---|---|
| **"Recebi X contatos, quantos compraram?"** (Suzano) | Respondida desde 28/07: `ConversionCard` + `ConversionDetailSheet`. | Nada — é o modelo de resposta. |
| **"O entregador precisa do telefone/endereço"** (Itápolis) | Telefone entrou no cupom em 31/08 (`SaleReceipt.jsx:62-64`). Endereço: cascata `contact.endereco || sale.customer_address` (`58-61`) — **vazia em 65% das entregas manuais**. | S6 (endereço na venda de entrega) + **"Entregas de hoje"**: filtro em `/Vendas` (`delivery_method='delivery' AND sale_date=hoje`) com botão "Enviar lista ao motoboy" (texto: nome · telefone · endereço · obs · valor a receber). O checklist morto tinha isso como item manual (`m5`, `t2`, `t3`). Esforço: M. |
| **"Por que o molho sumiu do pedido à fábrica?"** (Hortolândia) | `PurchaseOrderForm.jsx:92-99` esconde `created_by_franchisee=true` sem dizer nada; no Estoque não há marca de "próprio × fábrica". | Rodapé no pedido: "3 produtos do seu estoque são seus (não da fábrica) e não aparecem aqui: Molho 500g…"; badge "Próprio" no `TabEstoque`; e no Estoque, ao ocultar/apagar um item **padrão**, avisar "esse produto vai sumir do pedido à fábrica". Esforço: P. |
| **"Estou em dia com a mensalidade? Quanto devo?"** (Americana, 4 meses sem cobrança) | `FinancialObligationsCard` mostra só a fatura corrente; **some quando não há `system_subscriptions`** (`50-54`; `useSubscriptionStatus.js:74-77` trata "sem linha" como ok) — foi exatamente a Americana. Hoje só 1 franquia está sem linha. | "Minhas mensalidades": 12 meses com pago/pendente/vencido, valor e link do boleto; e quando não há assinatura ativa numa franquia ativa: "Sem cobrança configurada — fale com a fábrica" em vez de silêncio. Esforço: M (lista) / P (aviso). |
| **"Onde troco e-mail, CPF, PIX, telefone do resumo?"** (Araras, troca de dono) | Espalhado: fiscal só no gate do onboarding (`FiscalDataGate.jsx`, que 57 franquias nunca veem) ou pelo admin; PIX no passo 2 do wizard (`FranchiseSettings.jsx:1014-1063`); telefone do resumo no passo 1 (`774-779`). | Tela "Meus dados" (e-mail de cobrança, CPF/CNPJ, endereço fiscal, PIX, telefone do resumo) com `saveFiscalData` + `FranchiseConfiguration.update`. Esforço: M. Risco: `pix_holder_name` só com confirmação do dono (CLAUDE.md). |
| **"Meu pedido já saiu?"** (10 pedidos em aberto agora; a fábrica recebe isso no grupo) | Só em Gestão → Reposição → Histórico (`PurchaseOrderHistory.jsx:16-22`, 3 toques e um scroll). A home **carrega** os pedidos e descarta (§2.2d). | Linha na faixa de estado da home (§2.4, bloco 1): "Pedido de 03/09 · Confirmado · previsão 09/09". Esforço: P. |
| **"O robô está respondendo?"** (Araras/Limeira 38 e 28 dias parados sem ninguém ver) | Pill "Conectado/Não conectado" só dentro de Meu Vendedor (`650-667`), baseada em `whatsapp_status` (que o CLAUDE.md diz estar `disconnected` em 18/18). | E1 + bloco 1 da home: "última conversa há N min/dias". Esforço: P. |
| **"Quanto tenho a receber (pendente)?"** | Só dentro de `/Vendas` (`TabLancar.jsx:676-699`). | Bloco "Hoje" da home. Esforço: P. |
| **"O que essa cliente costuma pedir?"** | Não existe (C2). | Compras do contato no card/Sheet. Esforço: M. |

---

## 8. Priorização — (impacto × alcance) / esforço

Alcance: home ≈ 349 sessões mobile/3d (100% dos franqueados); Vendas ≈ 8k vendas/90d em 63 unidades; Gestão ≈ 358 sessões/3d; Meu Vendedor ≈ 96 sessões/3d.

| # | Achado | Alcance | Impacto | Esforço | Ordem |
|---|---|---|---|---|---|
| 1 | **E1 + §2.4 bloco 1** — estado real do robô e do pedido na home (hoje "Tudo em dia!" com 10 robôs mudos; pedidos carregados e jogados fora) | todos | decisão que não é tomada (robô parado por semanas) | P (sinal) + P (pedido) | **1** |
| 2 | **S1 + S2 + S4** — frete automático (60/67 têm regra), entrega visível, cupom logo após salvar | 8k vendas/90d | −5 toques e −1 digitação por venda; 622 entregas/90d com frete zero | P + P + P | **2** |
| 3 | **F1** — "Salvar" desabilitado na Revisão do Meu Vendedor | 96 sessões/3d, 26% com dead click | término do wizard não confirma | P | **3** |
| 4 | **§2.2b + §2.2c + §2.2d** — zeros falsos antes do skeleton, tour em aparelho novo para 57 franquias, 3 queries mortas na home | todos (349 sessões) | quickback 75%, 8% de tempo ativo | P + P + P | **4** |
| 5 | **S6 + "Entregas de hoje"** — endereço na venda de entrega (65% sem) e lista para o motoboy | 4.4k entregas/90d | mata a ligação "qual o endereço?" (caso Itápolis generalizado) | M | **5** |
| 6 | §2.4 — reordenar a home (Hoje · Precisa de você · Mês) e tirar o filtro de período | todos | leitura em 3 s | M | 6 |
| 7 | G1 + G2 + G3 + G7 — cards com hover morto, "Saiu" sem destino, categorias sem drill-down, aba padrão Estoque no mobile | 358 sessões/3d | 111 dead clicks, quickback 26–33% | P | 7 |
| 8 | S3 — grade de produtos no SaleForm | 8k vendas | −6 toques/−3 digitações | M | 8 |
| 9 | N1 + N2 + N3 + N4 + N5 — "+100%", centavos, jargão, promessa do bot, "p.p." | todos | número que mente / não se lê | P | 9 |
| 10 | E2 + E3 + E4 + E6 — sucesso com cliente perdido, venda a R$ 0, botões mudos, rascunho de ontem | 8k vendas | erros silenciosos por venda | P | 10 |
| 11 | U1 + U3 + E5 — apagar MyChecklist (0 linhas), reescrever tutoriais e textos que mentem, scripts nos SmartActions | todos | menos código morto, menos promessa falsa | P | 11 |
| 12 | V1 + V2 + V3 + V6 — resumo clicável, área expandida com ação, resumo do form distinto, URL sem `replace` | 541 sessões/3d | 253 dead clicks; medição do Clarity volta a fazer sentido | P | 12 |
| 13 | C1 + C2 — vocabulário único de status, compras do contato | 109 sessões/3d | quickback 44% | P + M | 13 |
| 14 | §7 — "Minhas mensalidades", "Meus dados" | todos, baixa frequência | pergunta recorrente ao suporte | M | 14 |
| 15 | U2 — Marketing vira "Artes do mês", pagamento vai para a home | 35 sessões/3d | 18% ativo, biblioteca com 7 arquivos | M | 15 |

Regras que todos os itens respeitam: dados só por `@/entities/all` (o único `supabase.from` novo seria evitado usando `Sale.filter({contact_id})`); dinheiro só por `getSaleNetValue`/`calculatePnL`; nenhum item recria Health Score, Acompanhamento, Relatórios ou BotIntelligence; toda remoção de símbolo (`DailyChecklist`, `CustomDateRangeSheet`) passa por `grep -rn "<Simbolo>" src/` antes do build por causa do `no-undef` desligado.
