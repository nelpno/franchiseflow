# Auditoria Completa — Dashboard FranchiseFlow

Data: 2026-05-29 - Metodo: 26 subagentes (15 revisores + verificacao adversarial), ~3.3M tokens, ~17min

## Resumo executivo

- Total de achados: **208** (206 acionaveis, 2 refutados na verificacao adversarial)
- Por severidade: critical=1, high=20, medium=76, low=111
- Por categoria: bug=84, dead-code=39, convention=36, maintainability=20, performance=12, security=11, ux=4, deprecated=2
- Critical/High acionaveis: **19**

## Critical & High (acionaveis)

### 1. [CRITICAL/bug] Export Excel/PDF quebrado — API legada do jspdf-autotable v5
- **Arquivo:** src/components/shared/ExportButtons.jsx:52-92
- **Area:** Varredura: dependencias e build
- **Problema:** jspdf-autotable foi bumpado para v5 (package.json L55) mas o codigo usa a API legada removida: `autoTableModule.default(jsPDF)` como applyPlugin e `doc.autoTable({...})` como metodo de prototype. Em v5 isso lanca TypeError, cai no catch e mostra so "Erro ao exportar PDF" — export PDF de Vendas e Gestao>Resultado nao funciona.
- **Correcao:** Migrar para a API funcional v5 (igual pickingSheetPdf.js:371 que ja esta correto): `const { default: autoTable } = await import("jspdf-autotable"); autoTable(doc, { startY: 38, head, body, ... });` e remover o bloco applyPlugin.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: critical)
- **Verificador:** package.json L55 fixa `jspdf-autotable ^5.0.7`. Em v5 o método de protótipo `doc.autoTable()` foi removido — ExportButtons.jsx:78 chama `doc.autoTable({...})`, que em v5 é `undefined` → `TypeError` → cai no catch (L94-97) e mostra só "Erro ao exportar PDF.". Além disso, L55 `autoTableModule.default(jsPDF)` trata o default export como applyPlugin (padrão v3), mas em v5 o default export é a própria 

### 2. [HIGH/bug] setTimeout(800ms) no retry de perfil sem cleanup — pode setar state apos unmount
- **Arquivo:** src/lib/AuthContext.jsx:71-72
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** No catch de `loadUserProfile`, ha um `await new Promise(setTimeout 800ms)` seguido de `setUser/setIsAuthenticated/setProfileLoadFailed`. Nao ha `mountedRef` nem cancelamento; se o provider desmontar (logout durante o delay) ou outro `loadUserProfile` correr em paralelo (login rapido apos falha), o state e sobrescrito por uma execucao stale. AuthProvider raramente desmonta, mas o problema real e a corrida entre duas chamadas concorrentes de `loadUserProfile`.
- **Correcao:** Adicionar um token de geracao (`const myGen = ++loadGenRef.current`) no inicio de `loadUserProfile` e so aplicar `setUser/...` se `loadGenRef.current === myGen`. Resolve tanto o delay de 800ms quanto a concorrencia geral.
- **Confianca:** medium - **Verificacao:** confirmed (sev ajustada: medium)
- **Verificador:** Confirmado no código: o `catch` de `loadUserProfile` faz `await new Promise(resolve => setTimeout(resolve, 800))` (linha 72) e depois `setUser`/`setIsAuthenticated`/`setProfileLoadFailed` sem nenhum token de geração nem mountedRef (o AuthProvider não tem mountedRef). A parte de "setState após unmount" é marginal (AuthProvider é raiz e raramente desmonta; e em React 18 setState pós-unmount é no-op 

### 3. [HIGH/bug] Sale/Expense/InventoryItem.filter sem fetchAll batem no teto silencioso de 1000 linhas
- **Arquivo:** src/components/minha-loja/TabResultado.jsx:663-679
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `loadData` busca TODO o histórico (sem janela de data) via `.filter()` sem `fetchAll: true`. O entity adapter, no caminho não-fetchAll, não chama `.range()`, então o PostgREST corta em 1000 linhas silenciosamente. Franquia com >1000 vendas/despesas históricas perde linhas → lucro, top produtos, evolução 6m e "parados há 28+ dias" ficam subnotificados sem erro. Atinge tanto a visão do franqueado quanto a aba "Por Unidade" do admin (uso principal).
- **Correcao:** Passar `fetchAll: true` (Sale/Expense crescem) com janela de data: `Sale.filter({ franchise_id }, "-sale_date", null, { columns, fetchAll: true, gte: { sale_date: format(subMonths(new Date(), 7), "yyyy-MM-dd") } })`. A tela só usa 6 meses + mês anterior; 7m de janela cobre. Idem Expense com `gte: { expense_date }`. InventoryItem é pequena mas também deve usar `fetchAll: true`.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** Em `loadData` (linhas 663-679) `Sale.filter({franchise_id}, null, null, {columns})`, `Expense.filter({franchise_id})` e `InventoryItem.filter(...)` não passam `fetchAll: true` nem janela de data (`gte`/`lte`). No entity adapter (`src/entities/all.js:103-111`) o caminho não-fetchAll NÃO chama `.range()` e só aplica `.limit()` se `limit` for passado (aqui é `null`) — logo cai no cap default do Postg

### 4. [HIGH/bug] SaleItem.filter com array de IDs sem fetchAll trunca em 1000 itens
- **Arquivo:** src/components/minha-loja/TabResultado.jsx:686-689
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `SaleItem.filter({ sale_id: saleIds }, ...)` sem `fetchAll` e sem chunk. Como cada venda tem vários itens, qualquer franquia com >1000 sale_items no período cortará linhas silenciosamente (PostgREST cap 1000), distorcendo top produtos, custo e markup. Diferente de Financeiro.jsx (página admin), que faz chunk de 500 IDs — aqui não há nem chunk nem fetchAll.
- **Correcao:** Adicionar `{ ..., fetchAll: true }` e, idealmente, chunk de IDs em lotes de ~500 como em Financeiro.jsx (linhas 118-136) para evitar limite de URL com muitos sale_ids.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** `SaleItem.filter({sale_id: saleIds}, null, null, {columns})` (linhas 686-689) não passa `fetchAll` nem faz chunk dos IDs. Como `saleIds` deriva de TODO o histórico de vendas (já potencialmente truncado pelo achado anterior) e cada venda tem múltiplos itens, qualquer franquia com >1000 sale_items resultantes terá linhas cortadas pelo cap default do PostgREST, distorcendo top produtos, custo e marku

### 5. [HIGH/dead-code] Componente morto que ainda usa CMV (viola fórmula canônica de lucro)
- **Arquivo:** src/components/minha-loja/ResultadoCharts.jsx:1-320
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `ResultadoCharts.jsx` não é importado em lugar nenhum (grep só encontra o próprio arquivo); foi substituído por `EvolucaoCard` dentro de TabResultado. Além de morto, calcula lucro com `costProducts` (CMV) — `totalExpenses = costProducts + cardFees + deliveryFees + otherExpenses` — contrariando a regra de caixa puro do projeto e somando `deliveryFees` como DESPESA (frete é receita). Risco de alguém reusar este cálculo errado.
- **Correcao:** Apagar o arquivo `src/components/minha-loja/ResultadoCharts.jsx`.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: low)
- **Verificador:** O componente NÃO é importado em código de produção — o grep encontrou apenas o próprio arquivo e `docs/qa-report-2026-03-28.md` (um doc, não import). Logo é código morto de fato (TabResultado usa `EvolucaoCard`, não este). O cálculo está realmente errado vs a fórmula canônica de caixa puro do projeto: linha 109 `const totalExpenses = costProducts + cardFees + deliveryFees + otherExpenses` soma CMV

### 6. [HIGH/bug] Coluna "Tipo" do export de vendas sempre sai "—" para retirada
- **Arquivo:** src/lib/salesExport.js:6-9,67
- **Area:** Vendas, Estoque, Gestao
- **Problema:** `delivery_method` salvo pelo SaleForm é `"retirada"` ou `"delivery"` (SaleForm.jsx:409/440/800), mas `DELIVERY_LABEL` só mapeia `delivery` e `pickup`. Vendas de retirada caem no fallback "—" no Excel/PDF de TabLancar e TabResultado.
- **Correcao:** Trocar a chave para `retirada`: `{ delivery: "Entrega", retirada: "Retirada", pickup: "Retirada" }` (manter `pickup` por compat com dados legados/bot).
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** `SaleForm.jsx` grava `delivery_method` apenas como `"retirada"` (default em :409, hidratação em :440/:511, click handler :1243) ou `"delivery"` (:1255, persistido em :800-801). O `DELIVERY_LABEL` em `salesExport.js:6-9` mapeia `{ delivery, pickup }` — não tem a chave `retirada`. Em `buildRow` (:67) `DELIVERY_LABEL[sale?.delivery_method] || "—"` então retorna "—" para toda venda de retirada, que é 

### 7. [HIGH/bug] Alertas de estoque disparam para franquias só-estoque sem nenhuma venda
- **Arquivo:** src/components/dashboard/AlertsPanel.jsx:L113-L155
- **Area:** Dashboard Admin
- **Problema:** A guarda só pula franquia se `!hasSales && !hasActiveInventory`. Uma franquia que tem itens cadastrados com qty>0 mas zero vendas (ainda em onboarding) passa pela guarda e gera alertas de "estoque zerado/baixo" no painel admin para franquias que sequer operam, poluindo o painel.
- **Correcao:** Condicionar os blocos de estoque a `hasSales` (igual já é feito em reposição/sem-vendas), ou definir explicitamente que estoque-só conta como operacional e documentar. Como mínimo, gate `if (hasSales) { ... checagens de estoque ... }` para alinhar com a lógica de reorder.
- **Confianca:** medium - **Verificacao:** confirmed (sev ajustada: medium)
- **Verificador:** A guarda em L116 (`if (!hasSales && !hasActiveInventory) continue;`) deixa passar franquia com `hasActiveInventory=true` mas `hasSales=false`. Os blocos sem-venda (L119) e reposição (L158) estão gated por `if (hasSales)`, mas os blocos de estoque (zeroStock L143-145 e lowStock L148-155) rodam INCONDICIONALMENTE após a guarda. Verifiquei o upstream: em AdminDashboard.jsx:112 `Franchise.list("city",

### 8. [HIGH/convention] Receita do bot ignora discount_amount e não usa getSaleNetValue
- **Arquivo:** src/components/dashboard/BotPerformanceCard.jsx:L96-L107
- **Area:** Dashboard Franqueado
- **Problema:** Cálculo de botRevenue/prevBotRevenue soma value + delivery_fee mas NUNCA subtrai discount_amount, violando a regra "Receita SEMPRE = value - discount_amount + delivery_fee" e a obrigação de usar getSaleNetValue. Vendas com desconto inflam o faturamento exibido ao franqueado.
- **Correcao:** Importar getSaleNetValue de @/lib/financialCalcs e usar `acc + getSaleNetValue(s)`; incluir `discount_amount` em `columns` do Sale.filter (linha 72). Aplicar igual em prevBotRevenue.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** O cálculo é real e viola a fórmula canônica. L97 e L106 fazem `parseFloat(s.value) + parseFloat(s.delivery_fee)` sem subtrair `discount_amount`. Pior, o `columns` do Sale.filter na L72 (`"id,value,delivery_fee,sale_date"`) NEM SEQUER traz `discount_amount` — então mesmo que se quisesse usar `getSaleNetValue(s)`, o campo viria undefined→0. A house rule do projeto e o helper `getSaleNetValue` (finan

### 9. [HIGH/performance] Tres fetchAll sem janela de data — varre 28k+ conversas a cada troca de mes
- **Arquivo:** src/pages/BotIntelligence.jsx:L214-L221
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `BotConversation.list`, `ConversationMessage.list` e `Sale.filter` usam `fetchAll:true` sem `gte/lte`, puxando o historico inteiro (paginacao serial 1000/1000) so para filtrar 1 mes no cliente. Conforme as House Rules, `bot_conversations` (~28k) sozinha leva ~20s; `conversation_messages` e ainda maior.
- **Correcao:** Passar janela do mes selecionado em cada query: `gte: { started_at: monthStartIso }, lte: { ... }` (e `sale_date` para Sale, `created_at` para messages). Idealmente trocar por RPC server-side agregado (padrao `get_bot_conversation_summary`). Remove a filtragem client-side `monthlyAll`.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** Codigo real (L215-220) confirma os tres `fetchAll: true` sem `gte/lte`: `BotConversation.list("-started_at", null, {columns:..., fetchAll:true})`, `ConversationMessage.list(...fetchAll:true)`, `Sale.filter({source:"bot"}, ..., fetchAll:true)`. A filtragem por mes acontece so depois em memoria (L257-262 `monthlyAll`, L249-250 para sales). Contagens reais do banco hoje: `conversation_messages` = **3

### 10. [HIGH/bug] Funil usa status que nao existem mais — barras sempre zeradas
- **Arquivo:** src/pages/BotIntelligence.jsx:L72-L79, L323-L328
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** O funil filtra por `status === 'catalog_sent' | 'checkout_started'`, mas as House Rules afirmam que esses valores NAO existem em `bot_conversations.status` (so existem `escalated, abandoned, converted, started, manual_sale, duplicate_stale`). Resultado: 2 das 6 barras do funil ("Catálogo Enviado", "Checkout") sao permanentemente 0, induzindo o admin a achar que ninguem chega no checkout.
- **Correcao:** Remover `catalog_sent`, `checkout_started`, `items_discussed` do funil e dos STATUS_LABELS, ou repensar o funil so com status reais (`started → converted/abandoned/escalated`). Dado fantasma e pior que ausencia de dado.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** `FUNNEL_STATUSES` (L72-79) inclui `"catalog_sent"` e `"checkout_started"`; `STATUS_LABELS` (L62-70) tambem inclui `"items_discussed"`. O funil conta `allConversations.filter((c) => c.status === s).length` (L327). Query SQL direta em `vw_bot_conversations` retorna apenas 4 valores reais de status: `escalated` (61.895), `abandoned` (13.559), `converted` (1.916), `started` (828). Nenhum `catalog_sent

### 11. [HIGH/bug] Filtro por franquia compara campo errado — provavelmente nunca casa
- **Arquivo:** src/pages/BotIntelligence.jsx:L206-L211, L264-L268
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `selectedFranchiseId` vem de `availableFranchises` cujo `.id` e o UUID da franquia (confirmado em `getAvailableFranchises`). O codigo procura config por `c.franchise_id === selectedFranchiseId` (config.franchise_id e UUID — ok) OU `c.franchise_evolution_instance_id === selectedFranchiseId` (evo id != UUID), e depois filtra conversas por `franchise_id === cfg.franchise_evolution_instance_id`. Se nenhum config casar (`cfg` undefined), `filterParams.franchise_id` fica vazio e o filtro silenciosamente cai para "todas" — selecionar uma franquia nao filtra nada.
- **Correcao:** Resolver explicitamente o evolution_instance_id via `franchises.find(f => f.id === selectedFranchiseId)?.evolution_instance_id` e validar; se nao resolver, mostrar erro/empty em vez de silenciosamente listar tudo.
- **Confianca:** medium - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** O relatorio marcou CONF:medium e hedge ("provavelmente"); a verificacao prova que e CERTEZA, nao probabilidade. `franchise_configurations` NAO possui coluna `franchise_id` (information_schema retorna apenas `franchise_evolution_instance_id`, `franchise_name`, `id`). Logo `c.franchise_id` no L208 e SEMPRE `undefined`. O segundo ramo compara `c.franchise_evolution_instance_id` (TEXT slug, ex `evo_im

### 12. [HIGH/convention] supabase.from() / supabase.rpc() direto em pagina (viola HOUSE RULE)
- **Arquivo:** src/pages/Franchises.jsx:319,379,494-500
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** HOUSE RULE exige importar de @/entities/all — NUNCA `supabase.from()` direto em paginas/componentes. Ha `supabase.from('franchise_invites').insert(...)` e dois `supabase.rpc('delete_user_complete', ...)`.
- **Correcao:** O insert deve usar `FranchiseInvite.create(...)` (ja importado e usado no handleCreateFranchise). Os `delete_user_complete` sao RPC sem entity-adapter equivalente — aceitavel, mas o `.from(...).insert` tem alternativa e deve migrar. Note que a HOUSE RULE existe justamente porque o entity adapter padroniza timeouts; o insert cru aqui nao tem `AbortSignal`.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: low)
- **Verificador:** Codigo real confirma — `supabase` importado em Franchises.jsx:4; `supabase.rpc('delete_user_complete', ...)` em 319 e 379, e `supabase.from('franchise_invites').insert({...})` em 494-500. A HOUSE RULE ("importar de @/entities/all — NUNCA supabase.from() direto") existe no CLAUDE.md. Porem: (1) os dois `delete_user_complete` sao RPC sem entity-adapter — o proprio relatorio admite "aceitavel"; nao h

### 13. [HIGH/bug] Validacao fiscal falha silenciosamente sem feedback ao usuario
- **Arquivo:** src/components/franchises/FranchiseForm.jsx:103-110
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Em `handleSubmit`, se email ou CPF/CNPJ sao invalidos, a funcao faz `return;` puro — nenhum toast, nenhum foco no campo. O comentario diz "browser ja mostra mensagem via required", mas a validacao JS de email usa regex propria mais estrita que `type=email`/`required`; um email que passa no browser mas falha na regex resulta em submit que nao faz nada e nao mostra erro.
- **Correcao:** Emitir `toast.error("Verifique o email")` / `toast.error("CPF/CNPJ deve ter 11 ou 14 digitos")` antes de cada `return`. O CPF/CNPJ sem feedback e o caso mais grave: nao ha validacao HTML de length por digitos (so o `slice(0,14)`), entao um CPF com 9 digitos faz o botao "nao funcionar" sem explicacao.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: medium)
- **Verificador:** Codigo real confirma os `return;` puros sem toast em 105 (email) e 109 (CPF/CNPJ). Verifiquei a UI: o input de email tem `type="email"` + `required={fiscalRequired}` (linhas 219, 223), entao para email vazio/malformado o browser bloqueia o submit com tooltip nativo ANTES de `handleSubmit` rodar — o caminho da linha 104-106 e majoritariamente redundante (so divergiria em emails que o regex `[^@\s]+

### 14. [HIGH/bug] useCallback([]) captura allChecklists/searchParams stale
- **Arquivo:** src/pages/Onboarding.jsx:84-147
- **Area:** Onboarding e Checklist
- **Problema:** `loadData` é `useCallback` com deps `[]`, mas internamente usa `searchParams` e chama `loadFranchiseChecklist`, que por sua vez lê `allChecklists` (o cache admin). Como a closure é congelada no 1º render, `cachedForAdmin` sempre vê `allChecklists=[]`, anulando a otimização de cache e podendo reconsultar o DB sempre, e `searchParams` fica preso ao valor inicial.
- **Correcao:** Adicionar `searchParams` às deps de `loadData` (ou ler via ref), e passar `allChecklists` como argumento explícito a `loadFranchiseChecklist` em vez de capturar via closure; ou converter para ref (`allChecklistsRef`).
- **Confianca:** high - **Verificacao:** needs-context (sev ajustada: medium)
- **Verificador:** Confirmado que `loadData` é `useCallback(..., [])` (linha 147) usando `searchParams.get("franchise")` (linha 121) e chamando `loadFranchiseChecklist` (linhas 126/138), que lê `allChecklists` da closure (linha 183). A closure É congelada no 1º render. PORÉM o relatório exagera o impacto: (1) o caminho de URL-param dentro de `loadData` roda UMA vez no mount, quando `allChecklists` está legitimamente

### 15. [HIGH/performance] DailyChecklist.filter sem janela temporal puxa todo histórico da franquia
- **Arquivo:** src/pages/MyChecklist.jsx:116-123
- **Area:** Onboarding e Checklist
- **Problema:** Carrega TODOS os checklists diários da franquia (uma linha por dia, cresce indefinidamente) só para extrair os últimos 7 dias e o registro de hoje. Sem `gte`/`lte` nem `fetchAll` tie-breaker, e sem `limit`, vira teto/banda silenciosos com o tempo.
- **Correcao:** Filtrar no servidor: `DailyChecklist.filter({ franchise_id }, "-date", null, { gte: { date: sevenDaysAgo } })` (date é DATE, aceita `YYYY-MM-DD`). Buscar hoje no mesmo conjunto.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: medium)
- **Verificador:** Confirmado linha 116-118: `DailyChecklist.filter({ franchise_id: myFranchise.evolution_instance_id })` sem `gte`/`lte`/`limit`/`fetchAll`. O entity adapter (all.js linha 69-111) suporta `gte`/`lte`, mas a chamada não passa nenhum — query roda sem `.limit()`, retornando até o `max_rows` (1000) do PostgREST silenciosamente, e só usa os últimos 7 dias (linha 120) + hoje (linha 123) do resultado. `dai

### 16. [HIGH/convention] formatBRL com Intl inline em vez do helper compartilhado
- **Arquivo:** src/pages/PurchaseOrders.jsx:39-45
- **Area:** Pedidos (Purchase Orders)
- **Problema:** HOUSE RULE manda usar `formatBRL` de `lib/formatBRL.js` — aqui (e no Form) há reimplementação local com `new Intl.NumberFormat`, divergindo do comportamento padrão (ex: parsing de string).
- **Correcao:** Remover a função local e `import { formatBRL } from "@/lib/formatBRL"` (como já faz PurchaseOrderHistory.jsx). Aplicar idêntico em PurchaseOrderForm.jsx:21-27.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: low)
- **Verificador:** Real — `PurchaseOrders.jsx:39-45` e `PurchaseOrderForm.jsx:21-27` reimplementam `formatBRL` com `new Intl.NumberFormat` inline, enquanto `PurchaseOrderHistory.jsx:8` importa corretamente de `@/lib/formatBRL`. A HOUSE RULE ("`formatBRL` de `lib/formatBRL.js` — NUNCA `new Intl.NumberFormat` inline") é violada. PORÉM: o relatório errou ao classificar como SEV high e ao alegar "divergindo do comportam

### 17. [HIGH/convention] supabase.from() direto em componente (viola entity adapter)
- **Arquivo:** src/components/minha-loja/PurchaseOrderHistory.jsx:47-50
- **Area:** Pedidos (Purchase Orders)
- **Problema:** HOUSE RULE proíbe `supabase.from()` direto em páginas/componentes — deve passar por `@/entities/all`. Aqui faz `.from('purchase_order_items').select('*').in('order_id', ...)`. (O CLAUDE.md abre exceção para `.in()` batch, mas o ideal é encapsular ou ao menos tratar o erro — aqui `error` do destructuring é ignorado.)
- **Correcao:** Como `.in()` não é suportado pelo adapter, manter o batch mas capturar e logar o erro: `const { data: allItems, error } = await ...; if (error) throw error;` (hoje o erro é silenciosamente descartado e `orderItems` fica vazio sem aviso).
- **Confianca:** medium - **Verificacao:** needs-context (sev ajustada: low)
- **Verificador:** A parte "viola entity adapter" é FALSO-POSITIVO: o próprio CLAUDE.md abre exceção explícita — "Exceção: batch queries com `.in()` (entity adapter não suporta)". O código usa exatamente `.in('order_id', orderIds)`, que é o caso permitido. O relatório reconhece isso entre parênteses mas mantém SEV high mesmo assim — incoerente. A parte REAL e verificável é menor: linha 47 faz `const { data: allItems

### 18. [HIGH/bug] Botao "Tentar novamente" chama funcao inexistente loadInstanceName e crasha
- **Arquivo:** src/pages/MyContacts.jsx:393
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O onClick do retry no estado de erro invoca `loadInstanceName()`, função que não existe neste componente (nunca foi definida nem importada). Clicar dispara ReferenceError e o botão de recuperação fica inutilizável.
- **Correcao:** Remover a chamada: `onClick={() => loadContacts()}`.
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** A linha 393 é literalmente `onClick={() => { loadContacts(); loadInstanceName(); }}`. Grep no arquivo inteiro retorna `loadInstanceName` em UMA única ocorrência (a própria L393) — não há `const loadInstanceName`, `function loadInstanceName`, nem import. `loadContacts` está definido (L167). Como `loadContacts()` executa primeiro e dispara um `setState` async, a ordem de execução leva ao ReferenceEr

### 19. [HIGH/bug] Export CSV usa coluna inexistente total_purchases — sempre exporta 0
- **Arquivo:** src/pages/MyContacts.jsx:589
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** A coluna "Total Compras" no CSV lê `c.total_purchases`, mas o campo real (e o usado no card e no sort) é `purchase_count`. Além disso `total_purchases` não está no `columns` da query. Resultado: a coluna sai sempre `0`.
- **Correcao:** Trocar para `c.purchase_count ?? 0` (campo já presente em `columns` e usado em filteredContacts/sort).
- **Confianca:** high - **Verificacao:** confirmed (sev ajustada: high)
- **Verificador:** L589 do array de export usa `c.total_purchases ?? 0` sob o header "Total Compras" (L579). O `columns` da query (L169) traz `purchase_count` e NÃO traz `total_purchases`. O campo real é confirmado pelo uso consistente em outras partes: sort (L245 `b.purchase_count`), gate de exibição (L634 `contact.purchase_count`) e render do card (L679-680 `contact.purchase_count`). Como `total_purchases` nunca v

## Medium

### 20. [MEDIUM/convention] Toasts expoem error.message cru — viola house rule safeErrorMessage
- **Arquivo:** src/hooks/useWhatsAppConnection.js:114,134-137,158-161
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** A house rule manda usar `safeErrorMessage(error, fallback)` em toasts e nunca `error.message` cru. Aqui `toast.error(\`Falha ao conectar: ${error.message...}\`)` injeta a mensagem bruta do erro (que pode vir do n8n/fetch/Supabase) direto na UI. `safeErrorMessage.js` existe no projeto e nao e usado.
- **Correcao:** Importar `safeErrorMessage` de `@/lib/safeErrorMessage` e usar `toast.error(safeErrorMessage(error, "Falha ao conectar. Tente novamente."))`. Aplicar tambem nos handlers de check status (mas la o texto e fixo, ok).
- **Confianca:** high

### 21. [MEDIUM/bug] Contagem de vendas do dia usa Sale.list("-sale_date", 50) — teto silencioso
- **Arquivo:** src/Layout.jsx:249-261
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `loadQuickStats` busca apenas 50 vendas mais recentes e filtra `s.sale_date === today` em JS. Em franquias/admin com >50 vendas em dias recentes (admin ve a rede inteira), as 50 ultimas por `sale_date` podem nao cobrir todas as de hoje, ou ate excluir hoje se houver muitas com data futura/empate — a contagem "vendas hoje" fica subestimada. Limite hardcoded vira teto silencioso (anti-pattern citado nas house rules).
- **Correcao:** Usar `Sale.filter({}, null, null, { gte: { sale_date: today }, lte: { sale_date: today } })` (ou `Sale.filter` com criteria por data) e contar o resultado, em vez de pegar 50 e filtrar no cliente. So roda para admin/manager, custo baixo.
- **Confianca:** high

### 22. [MEDIUM/bug] useEffect com dois caminhos de return de cleanup — branch admin retorna cedo, branch principal retorna no fim; ramo async nao tem return
- **Arquivo:** src/Layout.jsx:161-240
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** O effect tem `return () => {mountedRef.current=false}` em dois pontos (linha 168 no ramo admin e 239 no fim), mas o ramo `managed_franchise_ids?.length > 0` (Franchise.list().then) e o ramo else tambem caem no return final — OK. Porem o `mountedRef.current = true` so e setado no topo do effect; o effect depende de `[currentUser]`, e o cleanup so roda na proxima troca de currentUser. Se `currentUser` mudar de objeto identidade a cada render do AuthContext (o `user` e recriado em setUser), o effect re-dispara e refaz `Franchise.list()` desnecessariamente.
- **Correcao:** Depender de campos primitivos estaveis: `[currentUser?.id, currentUser?.role, currentUser?.managed_franchise_ids?.join(',')]` em vez do objeto inteiro, evitando refetch redundante de franquias/onboarding.
- **Confianca:** medium

### 23. [MEDIUM/bug] fetchAll sempre adiciona order('id') mesmo quando orderBy ja e 'id' — duplica ORDER BY
- **Arquivo:** src/entities/all.js:30,69
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** Em `list`/`filter` com `fetchAll`, sempre se aplica `query.order('id', {ascending:true})` apos o `orderBy` do chamador. Se o chamador ja passar `orderBy: 'id'` ou `'-id'`, o PostgREST recebe `order=id.asc,id.asc` (ou `id.desc,id.asc`) — no melhor caso redundante, no caso `-id` cria ordenacao contraditoria parcial. Nao quebra dados (segundo termo e ignorado por igualdade de coluna), mas e ruido e pode confundir paginacao se um dia o tie-breaker mudar.
- **Correcao:** `if (!order || order.column !== 'id') query = query.order('id', { ascending: true });`
- **Confianca:** medium

### 24. [MEDIUM/bug] getWhatsAppMessages faz fetch direto sem timeout nem auth e engole erro retornando []
- **Arquivo:** src/api/functions.js:99-120
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** Diferente das outras funcoes deste arquivo (que usam `fetchWithTimeout` + auth headers), `getWhatsAppMessages` usa `fetch` puro: sem AbortController/timeout (pode pendurar a UI indefinidamente se ZuckZapGo nao responder) e sem token. O catch retorna `[]` mascarando falhas reais (silent failure).
- **Correcao:** Usar `fetchWithTimeout` com timeout (~10s). Manter o `[]` em erro e aceitavel para UX de historico, mas pelo menos garantir que nao trava. Verificar tambem se este caminho ainda e usado — WhatsAppHistory.jsx consta em "Features Removidas" no CLAUDE.md (ver achado dead-code abaixo).
- **Confianca:** medium

### 25. [MEDIUM/convention] Loading usa spinner em vez de Skeleton (HOUSE RULE)
- **Arquivo:** src/components/minha-loja/TabResultado.jsx:854-861
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** O estado de loading do TabResultado renderiza um ícone giratório ("progress_activity" animate-spin), mas a regra do projeto é "Loading: Skeleton shadcn (NÃO spinner)". A página admin Financeiro.jsx (mesma área) já usa skeletons corretamente.
- **Correcao:** Substituir por blocos `<Skeleton>` (ou os `animate-pulse` rounded usados em Financeiro.jsx) reproduzindo a estrutura Hero + 3 cards.
- **Confianca:** high

### 26. [MEDIUM/bug] "Margem Media" agregada pode renderizar NaN%
- **Arquivo:** src/components/financeiro/FinanceiroKpiCards.jsx:22-27
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `aggregated.margem.toFixed(1)` assume number sempre definido. Em Financeiro.jsx a agregação calcula `margem` com guard (`totalRecebidoAll > 0 ? ... : 0`), então hoje é seguro, mas o componente não tem defesa própria: se `aggregated` vier sem `margem` (estado inicial/erro futuro) quebra em runtime. Defensivo barato dado que é a área de rigor máximo.
- **Correcao:** `const margem = Number(aggregated?.margem) || 0;` e usar `margem.toFixed(1)`. Idem para `aggregated.lucro`/`aggregated.totalRecebido` via `Number(...) || 0`.
- **Confianca:** medium

### 27. [MEDIUM/bug] isPaidStatus checa status crus ASAAS contra valor já normalizado para PAID
- **Arquivo:** src/components/dashboard/FinancialObligationsCard.jsx:53-54
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** A edge function normaliza RECEIVED/CONFIRMED/RECEIVED_IN_CASH → 'PAID' (regra documentada em `mapPaymentStatus()`). Checar `=== "RECEIVED" || === "CONFIRMED"` aqui é código defensivo redundante/inconsistente: se algum dia o backend persistir só 'PAID', tudo bem; mas a presença desses ramos sugere que o estado pode chegar cru — e se chegar 'RECEIVED_IN_CASH' (não coberto) o card mostraria "vence/pagar" mesmo pago. Fonte da verdade deve ser uma só.
- **Correcao:** Confiar no estado normalizado: `subStatus === "PAID"` apenas; ou, se realmente houver risco de cru, incluir também `"RECEIVED_IN_CASH"`. Padronizar com `isPaidStatus` usado em outros pontos.
- **Confianca:** medium

### 28. [MEDIUM/performance] SaleItems refetch a cada navegação de mês (recarrega rede inteira por mês)
- **Arquivo:** src/pages/Financeiro.jsx:101-144
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** O `useEffect` de SaleItems depende de `selectedMonth`; cada clique em ◀/▶ refaz o fetch em chunks de 500 IDs de TODAS as franquias para o mês selecionado + anterior. Para a rede inteira isso é caro e repetido a cada navegação, sem cache por mês.
- **Correcao:** Cachear sale_items por mês (Map keyed por yyyy-MM) ou ampliar a janela de IDs para cobrir os meses já carregados e filtrar client-side, evitando ida ao banco a cada troca de mês.
- **Confianca:** medium

### 29. [MEDIUM/convention] window.confirm() em fluxo de exclusão de venda viola HOUSE RULE
- **Arquivo:** src/components/minha-loja/TabLancar.jsx:255-260
- **Area:** Vendas, Estoque, Gestao
- **Problema:** A regra "NUNCA alert()/confirm()" é violada: ao deletar venda com `capi_sent`, o código usa `window.confirm`. Bloqueia a thread, não segue o padrão sonner/AlertDialog do resto do app e é inconsistente com o `Dialog` de delete que já existe logo abaixo.
- **Correcao:** Mover o aviso para dentro do `DialogDescription` do dialog de exclusão (condicional em `deletingSale?.capi_sent`), ou usar um AlertDialog dedicado. Remover o `window.confirm`.
- **Confianca:** high

### 30. [MEDIUM/bug] capi_sent / net_value não estão em SALES_COLUMNS — features dependentes ficam inertes
- **Arquivo:** src/components/minha-loja/TabLancar.jsx:255,757
- **Area:** Vendas, Estoque, Gestao
- **Problema:** `SALES_COLUMNS` (Vendas.jsx:13) não inclui `capi_sent`, então `deletingSale.capi_sent` é sempre undefined e o aviso de "Purchase fantasma no Meta" NUNCA dispara. O card também recalcula o líquido manualmente (linha 757) em vez de usar `getSaleNetValue`, divergindo da fórmula canônica se `net_value` existir.
- **Correcao:** Adicionar `capi_sent` a SALES_COLUMNS (Vendas.jsx) para o aviso funcionar. Para o display do card, usar `getSaleNetValue(sale)` (linha 757) em vez de recomputar — mantém fonte única.
- **Confianca:** high

### 31. [MEDIUM/convention] Loading usa spinner em vez de Skeleton (HOUSE RULE)
- **Arquivo:** src/pages/Vendas.jsx:150-157
- **Area:** Vendas, Estoque, Gestao
- **Problema:** A regra "Skeleton (não spinner)" é violada no estado de carregamento da página Vendas (ícone `progress_activity` animate-spin). Gestao.jsx (irmão direto) já usa `<Skeleton>` corretamente — inconsistência interna.
- **Correcao:** Substituir pelo bloco `<Skeleton>` no mesmo padrão de Gestao.jsx:183-194.
- **Confianca:** high

### 32. [MEDIUM/bug] Race: config da franquia pode sobrescrever fee_passed do sale em edição
- **Arquivo:** src/components/minha-loja/SaleForm.jsx:438-439,553-558
- **Area:** Vendas, Estoque, Gestao
- **Problema:** Em edição, o useEffect de hydrate (dep `[sale, contacts]`) seta `feePassedToCustomer` a partir de `sale.fee_passed_to_customer`. O useEffect de config (dep `[franchiseId, isEditing]`) só pula o set quando `!isEditing`. A ordem é estável aqui, mas `franchiseChargesFee` ainda é `false` quando o hydrate roda (config carrega depois), então `sale.fee_passed_to_customer ?? franchiseChargesFee ?? false` pode resolver errado se `sale.fee_passed_to_customer` for null/undefined em venda antiga (cai em `false` em vez do default real da franquia).
- **Correcao:** Quando `sale.fee_passed_to_customer == null` em edição, re-aplicar o default da config dentro do useEffect de config (ex.: guardar flag "saleHadExplicitFee" e só então usar `charges`). Confirmar se é cenário real antes de tocar.
- **Confianca:** low

### 33. [MEDIUM/bug] Item com quantity string "0" é tratado como > 0 em zeroStock/lowStock
- **Arquivo:** src/components/dashboard/AlertsPanel.jsx:L143-L152
- **Area:** Dashboard Admin
- **Problema:** `i.quantity || 0 === 0` usa `|| 0` em vez de `parseFloat`. Se `quantity` vier como string (HOUSE RULE alerta que campos numéricos podem vir string), `"0" || 0` resulta em `"0"` (truthy), e `"0" === 0` é false — item zerado não entra em zeroStock; e `"5" < minStock` faz comparação string vs number imprevisível.
- **Correcao:** Usar `const qty = parseFloat(i.quantity) || 0;` e `const minStock = parseFloat(i.min_stock) || 3;` em todas as comparações (também L115 `hasActiveInventory` e healthScore consumidores).
- **Confianca:** medium

### 34. [MEDIUM/dead-code] Componente FranchiseHealthScore inteiro é código morto
- **Arquivo:** src/components/dashboard/FranchiseHealthScore.jsx:L1-L451
- **Area:** Dashboard Admin
- **Problema:** Nenhum arquivo importa `FranchiseHealthScore` (grep confirma só a própria definição). Por isso o bug max conhecido (L232-238: `30/20/15/15` somam 80, não 100, gerando barras >100%) nunca é exercido em produção. Mantê-lo no bundle desperdia código e perpetua o bug fantasma.
- **Correcao:** Remover o arquivo (e o prop `botSales` que nunca é passado por ninguém). Se houver intenção de reativar, primeiro corrigir os `max` de CATEGORY_CONFIG_WITH_BOT para bater com os scores reais (35/25/20/15/... ) — mas a CLAUDE.md já marca como dead-ish; deletar é o caminho.
- **Confianca:** high

### 35. [MEDIUM/dead-code] Componente MessagesTrend nunca é importado
- **Arquivo:** src/components/dashboard/MessagesTrend.jsx:L1-L63
- **Area:** Dashboard Admin
- **Problema:** Grep confirma zero importadores. Componente de gráfico de contatos não consumido pelo AdminDashboard (que usa DailyRevenueChart) nem em outro lugar.
- **Correcao:** Remover o arquivo. Bonus: a prop `isLoading` é declarada mas nunca usada dentro do componente (não há skeleton/guard).
- **Confianca:** high

### 36. [MEDIUM/dead-code] SaudeDoNegocioCard (e DiagnosticoSheet transitivo) é código morto
- **Arquivo:** src/components/dashboard/SaudeDoNegocioCard.jsx:L1-L69
- **Area:** Dashboard Admin
- **Problema:** Grep confirma que `SaudeDoNegocioCard` não é importado por nenhum consumidor. Ele importa `DiagnosticoSheet`, que por isso também fica órfão (DiagnosticoSheet só é referenciado aqui). Ambos saem do escopo de uso.
- **Correcao:** Remover SaudeDoNegocioCard.jsx e DiagnosticoSheet.jsx se confirmado sem uso (DiagnosticoSheet não declara `botReport` na assinatura — prop ignorada, sinal extra de abandono). Confirmar que `calculateFranchiseHealth` ainda é usado por Acompanhamento.jsx (é) antes de mexer em healthScore.js.
- **Confianca:** high

### 37. [MEDIUM/performance] loadCollapsedData recriado a cada mudança de collapsedData causa churn de ref e refetch instável
- **Arquivo:** src/components/dashboard/AdminDashboard.jsx:L234-L313
- **Area:** Dashboard Admin
- **Problema:** `loadCollapsedData` lista `collapsedData.contacts/inventoryByFranchise/purchaseOrders` e `franchises` como deps. Cada cold-load muda esses estados → recria o callback → dispara o useEffect L318 que reescreve `loadCollapsedDataRef`. Em force-refresh, o callback usa snapshots stale de `collapsedData.*` capturados no closure (fallbacks `force ? collapsedData.contacts : []`), que podem estar desatualizados se um refetch ocorrer entre renders.
- **Correcao:** Trocar os fallbacks por leitura via functional updater (`setCollapsedData(prev => ...)`) em vez de capturar `collapsedData.*` no closure, e remover esses 3 campos das deps — deixando só `[hasFetchedCollapsed, franchises]`. Reduz recriações e elimina o risco de snapshot stale.
- **Confianca:** medium

### 38. [MEDIUM/bug] new Date(s.date) sobre coluna DATE causa offset BRT -1 dia
- **Arquivo:** src/components/dashboard/MiniRevenueChart.jsx:L9 (sumNet — uso indireto via summaries) / RankingStreak.jsx:L21
- **Area:** Dashboard Franqueado
- **Problema:** `summaries[].date` e o `dailyGoal`/streak usam `new Date(s.date)` (DATE puro). Em BRT (UTC-3), `new Date("2026-05-29")` vira 28/05 21h local — quebra comparações de fronteira (`d >= thirtyDaysAgo && d < now` em FranchiseeDashboard:268-269 e o sort em RankingStreak:21). House rule proíbe construir Date a partir de string yyyy-MM-dd; usar parseDateOnly.
- **Correcao:** Importar parseDateOnly de @/lib/dateOnly e trocar `new Date(s.date)` por `parseDateOnly(s.date)` no dailyGoal (FranchiseeDashboard) e no sort do streak (RankingStreak). Em FranchiseeDashboard comparar contra strings yyyy-MM-dd em vez de objetos Date.
- **Confianca:** medium

### 39. [MEDIUM/dead-code] PeriodComparisonCard aparenta não ser usado pelo Dashboard Franqueado
- **Arquivo:** src/components/dashboard/PeriodComparisonCard.jsx:L73-L270
- **Area:** Dashboard Franqueado
- **Problema:** O componente não é importado em FranchiseeDashboard.jsx (que monta a área). Se for órfão, todos os problemas abaixo são de código morto; se for usado em outra tela, valem como bugs reais. Convém confirmar consumidores antes de manter.
- **Correcao:** Rodar grep por "PeriodComparisonCard" no projeto; se sem importadores, remover o arquivo. Se usado, corrigir os itens seguintes.
- **Confianca:** medium

### 40. [MEDIUM/bug] Sale.filter com limit 500 hardcoded vira teto silencioso
- **Arquivo:** src/components/dashboard/PeriodComparisonCard.jsx:L90-L94
- **Area:** Dashboard Franqueado
- **Problema:** Busca vendas com `limit 500` sem fetchAll nem janela gte/lte. Franquias com mais de 500 vendas no histórico recente perdem linhas silenciosamente, distorcendo a comparação de períodos. House rule proíbe limit hardcoded que vira teto.
- **Correcao:** Usar `fetchAll: true` com janela apertada `gte: { sale_date: <início do período1> }` (e Contact idem), eliminando o limit numérico.
- **Confianca:** high

### 41. [MEDIUM/bug] Drill-down le `c.summary` mas a coluna nunca e buscada
- **Arquivo:** src/pages/BotIntelligence.jsx:L216, L760-L801
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** O `columns` da query nao inclui `summary`, mas o Sheet renderiza `c.summary` condicionalmente. O bloco "Summary" da conversa nunca aparece (sempre undefined), tornando o drill-down quase vazio (so data + badge).
- **Correcao:** Adicionar `summary` ao `columns` se o drill-down deve mostra-lo; caso contrario remover o bloco morto. (cart_value/converted_at/messages_count tambem sao buscados e nunca usados — ver achado dead-code.)
- **Confianca:** high

### 42. [MEDIUM/bug] Duas definicoes conflitantes de "Taxa de Conversao"
- **Arquivo:** src/pages/BotIntelligence.jsx:L321, L536-L539
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `analytics.conversionRate` (L321) e calculado como `converted/total` (status), mas o KPI card (L538) ignora esse valor e recalcula `totalBotSales/totalAll`. Sao numeros diferentes para o mesmo rotulo: a tabela/ranking usa vendas-bot/conversas, o `conversionRate` computado fica orfao. Confunde manutencao e o admin (KPI != logica interna).
- **Correcao:** Escolher UMA definicao. Usar `analytics.conversionRate` no card ou remover o campo computado nao usado. Recomendo vendas-bot/conversas (mais acionavel) e eliminar o `converted/total` orfao.
- **Confianca:** high

### 43. [MEDIUM/dead-code] Card "Coach" placeholder permanente (feature nunca implementada)
- **Arquivo:** src/pages/BotIntelligence.jsx:L729-L738
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** Card estatico que so diz "os insights aparecerão aqui". Nunca recebe dados — e ruido visual que reduz a confianca do admin na tela ("metade esta vazia"). O Coach real e o Bot Coach Report (n8n via WhatsApp), nao esta tela.
- **Correcao:** Remover o card. (Tambem reforca a decisao de remover/simplificar a pagina.)
- **Confianca:** high

### 44. [MEDIUM/dead-code] State/maps computados e nunca consumidos (humanMsgMap, escalated, cart_value etc.)
- **Arquivo:** src/pages/BotIntelligence.jsx:L148-L149, L228-L235, L274, L309-L316
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `humanMsgMap`/`setHumanMsgMap` e construido (loop L228-235) e setado, mas nunca lido em lugar nenhum. `franchiseMap[fid].escalated` e contado mas nunca exibido. Colunas `cart_value`, `converted_at`, `messages_count` sao buscadas e ignoradas. `scopeIds` (L309) e uma variavel de logica confusa (`null` vs `undefined`) usada so para um branch — `totalBotSales` acaba somando so franquias que tem conversa no mes, divergindo do KPI.
- **Correcao:** Remover `humanMsgMap`, `escalated`, colunas nao usadas e simplificar a logica de escopo de `totalBotSales`.
- **Confianca:** high

### 45. [MEDIUM/convention] Receita de venda sem `getSaleNetValue` — ignora `discount_amount`
- **Arquivo:** src/pages/BotIntelligence.jsx:L253, L538
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** A receita de vendas-bot soma `value + delivery_fee` sem subtrair `discount_amount`, violando a House Rule "Receita SEMPRE = value - discount_amount + delivery_fee / usar getSaleNetValue". Vendas com desconto ficam superestimadas no KPI e no ranking (`botRevenue`).
- **Correcao:** Importar `getSaleNetValue` de `lib/financialCalcs` e usar `revenue += getSaleNetValue(s)`. Incluir `discount_amount` no `columns` da query de Sale.
- **Confianca:** high

### 46. [MEDIUM/bug] Construcao de Date a partir de string para comparar datas BRT
- **Arquivo:** src/pages/BotIntelligence.jsx:L201-L202, L257-L262, L770
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `startOfMonth(selectedMonth).toISOString()` e depois `new Date(c.started_at) >= new Date(start)`. `started_at` e TIMESTAMPTZ (Date() ok), mas o boundary via `.toISOString()` em horario local pode deslocar ~3h no limite do mes (BRT UTC-3), incluindo/excluindo conversas das primeiras/ultimas horas. O ranking/funil ficam levemente off no comeco e fim de mes.
- **Correcao:** Comparar com janela explicita em UTC ou, melhor, passar `gte/lte` na query (resolve junto o achado de performance) e remover o filtro client-side.
- **Confianca:** medium

### 47. [MEDIUM/maintainability] BotIntelligence.jsx — avaliacao de utilidade: SIMPLIFICAR (preferencialmente para um card) ou REMOVER
- **Arquivo:** src/pages/BotIntelligence.jsx:L1-L824
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** (a) CUSTO DE MANUTENCAO ALTO: 824 linhas, 11 useState, analytics memo de ~120 linhas, 2 graficos recharts, tabela, sheet drill-down, mapas humanMsgMap/msgCountMap/botSalesMap — 3 fetchAll sem janela (varredura de dezenas de milhares de linhas a cada interacao). (b) CONFIABILIDADE/ACIONABILIDADE BAIXA: o funil depende de status inexistentes (2 barras sempre 0), o filtro por franquia provavelmente nao casa, conversao tem duas definicoes divergentes, receita ignora desconto, drill-down mostra `summary` que nem e buscado, e ha um card "Coach" placeholder permanente. (c) REDUNDANCIA: as 2 metricas confiaveis (conversao % e abandono %) ja existem no `BotSummaryCard` (RPC agregado, 100x mais barato) no AdminDashboard, e o "Coach" real e o Bot Coach Report via WhatsApp. Para um admin que "quase nao usa", o custo de corrigir todos os bugs acima supera o valor.
- **Correcao:** RECOMENDACAO — REMOVER a pagina e o link "Ver detalhes" do BotSummaryCard; manter o BotSummaryCard (ja cobre conversao/abandono confiaveis) como unica visao de bot no dashboard. Se houver desejo de manter drill-down por franquia, SIMPLIFICAR para uma unica RPC agregada (`get_bot_conversation_summary` + vendas-bot por franquia com getSaleNetValue) renderizando so o ranking — descartando funil, abandon-reasons LLM, humanMsgMap e Coach placeholder. Manter-oculto (rota sem link) e o pior cenario: continua custando manutencao e exibindo dados errados a quem acessa por URL.
- **Confianca:** medium

### 48. [MEDIUM/bug] handleSaveFiscal nao passa name/owner_name/status — edicao perde campos se backend exigir
- **Arquivo:** src/pages/Franchises.jsx:246-274
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** O dialog "Editar dados fiscais" usa `mode="fiscal-only"`, que oculta name/owner_name/status, mas `initialData` os carrega e o form os espalha em `franchiseData` via `...rest`. Porem `handleSaveFiscal` so repassa um subset fixo (billing_email, cpf_cnpj, endereco) para `saveFiscalData`, e `saveFiscalData` so persiste FRANCHISE_FIELDS. `city` esta no subset, mas `name`/`owner_name`/`status` nao — coerente com o objetivo, mas o form ainda envia `state_uf` derivado de addressData no franchiseData enquanto handleSaveFiscal pega `franchiseData.state_uf` (ok). O risco real: `franchiseData.address_complement` e enviado mesmo quando o usuario limpou — vira `""`→`null` em saveFiscalData (ok). Sem bug de perda, mas o duplo-caminho (form monta franchiseData completo, handler re-seleciona campos) e fragil: adicionar campo novo ao form nao o persiste sem editar handleSaveFiscal tambem.
- **Correcao:** Passar `franchiseData` direto para `saveFiscalData` (que ja filtra por FRANCHISE_FIELDS/CONFIG_FIELDS via `pick`) + `addressExtras`, em vez de re-listar manualmente. Elimina divergencia futura.
- **Confianca:** medium

### 49. [MEDIUM/bug] nameManuallyEdited inicia true em fiscal-only, mas autosuggest de nome nunca dispara (morto) e em create pode bloquear sugestao
- **Arquivo:** src/components/franchises/FranchiseForm.jsx:65,88
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `nameManuallyEdited` inicializa `!!initialData?.name`. Em fiscal-only o campo nome esta oculto (nao editavel), entao a flag e irrelevante ali. Em create, `initialData` e null → flag false (ok). Porem a condicao de autosuggest `(!nameManuallyEdited && !prev.name)` so sugere se nome vazio E nunca editado — correto. O ponto fragil: `handleCepChange` depende de `nameManuallyEdited` no `useCallback` deps, recriando a funcao a cada digitacao de nome, e o closure de `setFormData(prev=>...)` usa `nameManuallyEdited` do escopo (pode estar stale entre re-criacoes). Funcionalmente ok por causa do setState funcional, mas a dep so existe para isso.
- **Correcao:** Mover `nameManuallyEdited` para um `useRef` e ler `ref.current` dentro do callback; remover a dep do useCallback (`[]`). Evita recriacao por keystroke. Baixo impacto, mas limpa o padrao.
- **Confianca:** medium

### 50. [MEDIUM/bug] handleSendInvite — bloco try aninhado redundante e fluxo de erro com dupla atribuicao de isSendingInvite
- **Arquivo:** src/pages/Franchises.jsx:488-533
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** O insert tem try/catch interno que re-checa duplicata e o externo repete a mesma checagem. No caminho de sucesso, `setIsSendingInvite(false)` ocorre dentro do try e ha `return` antes do `setIsSendingInvite(false)` final. No caminho de erro do insert nao-duplicado, o throw sobe pro catch externo que faz toast + cai no `setIsSendingInvite(false)` final — ok. Mas o duplo tratamento de duplicata e morto: o try interno ja absorve o erro (nao lanca quando duplicado), entao o catch interno nunca recebe a duplicata via throw a menos que `if (!isDuplicate) throw invErr` dispare — caso em que o catch externo tambem trataria. Redundancia confusa.
- **Correcao:** Remover o try/catch interno; tratar `invErr` diretamente (checar duplicata, senao `throw`). Usar `FranchiseInvite.create` com try/catch unico, como em handleCreateFranchise.
- **Confianca:** medium

### 51. [MEDIUM/bug] handleSavePermissions faz N updates seriais (await em loop) — lento e parcialmente atomico
- **Arquivo:** src/pages/Franchises.jsx:447-484
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Loop `for (const user of users)` com `await User.update` dentro. Se houver muitos usuarios alterados, sao requests seriais; se um falhar no meio, alguns ja foram persistidos e outros nao, com toast de erro generico sem indicar quais. Sem `setIsSavingPermissions(false)` em finally (esta apos catch, fora de try/finally) — ok no fluxo, mas se um throw ocorrer o `setIsSavingPermissions(false)` na linha 483 nunca executa (esta depois do catch, mas o catch nao re-lanca, entao executa). Confirmado ok, porem o problema de atomicidade parcial permanece.
- **Correcao:** Coletar os updates em array e usar `Promise.allSettled` para paralelizar; reportar quantos falharam. Mover `setIsSavingPermissions(false)` para um `finally`.
- **Confianca:** medium

### 52. [MEDIUM/bug] format(new Date(current_payment_due_date)) em coluna DATE volta 1 dia em BRT
- **Arquivo:** src/components/shared/SubscriptionPaymentSheet.jsx:25
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `current_payment_due_date` e DATE (vencimento ASAAS, formato yyyy-mm-dd). `new Date("2026-05-30")` interpreta como UTC midnight → em BRT (UTC-3) mostra 29/05. HOUSE RULE proibe construir Date a partir de string yyyy-mm-dd. O SubscriptionPaywall.jsx (irmao) usa `parseISO` (tambem problematico, mas menos) — inconsistencia entre os dois.
- **Correcao:** Usar `formatDateOnly(current_payment_due_date)` de `@/lib/dateOnly` (mesmo padrao aplicado a expenses.expense_date, sales.sale_date). Aplicar o mesmo em SubscriptionPaywall.jsx:27 (trocar `format(parseISO(...))` por `formatDateOnly`).
- **Confianca:** high

### 53. [MEDIUM/bug] parseISO em coluna DATE — risco de offset de timezone no vencimento
- **Arquivo:** src/components/shared/SubscriptionPaywall.jsx:27
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `format(parseISO(current_payment_due_date), "dd/MM/yyyy")`. `parseISO("2026-05-30")` produz Date a meia-noite LOCAL (date-fns parseISO trata date-only como local), entao geralmente OK no BRT — porem a HOUSE RULE manda usar formatDateOnly/parseDateOnly para colunas DATE para garantir consistencia, e o componente irmao usa caminho diferente (new Date). Padronizar evita o tipo de bug "vencimento aparece 1 dia antes".
- **Correcao:** `import { formatDateOnly } from "@/lib/dateOnly"` e `formatDateOnly(current_payment_due_date)`.
- **Confianca:** medium

### 54. [MEDIUM/bug] current_payment_value pode vir string — `|| 150` / `?? 150` nao cobre "0"/"" e formatBRL recebe string
- **Arquivo:** src/components/shared/SubscriptionPaywall.jsx:25 / SubscriptionPaymentSheet.jsx:22
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Campos numericos podem vir string (HOUSE RULE: SEMPRE parseFloat). `formatBRL(current_payment_value || 150)` e `current_payment_value ?? 150` passam string direto para formatBRL. Se `current_payment_value` vier "150.00" (string), `|| 150` mantem a string e formatBRL pode formatar errado; se vier `0` numerico (raro), `|| 150` substitui indevidamente (cai na regra "NUNCA x || 0/x||default").
- **Correcao:** `const value = parseFloat(current_payment_value) || 150;` em ambos, e `formatBRL(value)`. Cobre string e null/undefined de forma consistente.
- **Confianca:** medium

### 55. [MEDIUM/bug] handleCopyPix sem guard de pix_payload — copia undefined silenciosamente
- **Arquivo:** src/components/shared/SubscriptionPaymentSheet.jsx:31-38
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `navigator.clipboard.writeText(pix_payload)` sem checar se `pix_payload` existe. O botao so renderiza com `pix_payload &&`, entao na pratica nao dispara vazio, mas o SubscriptionPaywall.jsx:31 tem o guard `if (!pix_payload) return;` — inconsistencia defensiva entre os dois. Se o botao for reutilizado/refatorado, copia "undefined".
- **Correcao:** Adicionar `if (!pix_payload) return;` no inicio, igual ao Paywall.
- **Confianca:** low

### 56. [MEDIUM/bug] Coluna `f.state` não existe — UF nunca aparece na linha da franquia
- **Arquivo:** src/components/marketing/MarketingPaymentsAdmin.jsx:L387
- **Area:** Marketing
- **Problema:** O objeto Franchise usa `state_uf` (confirmado em FranchiseForm/AsaasSetupPanel), mas aqui lê `f.state`, que é sempre undefined; o sufixo da UF some silenciosamente.
- **Correcao:** Trocar `f.state` por `f.state_uf` (duas ocorrências na expressão: condição e interpolação).
- **Confianca:** high

### 57. [MEDIUM/convention] Página acessa PostgREST direto (bypass de @/entities/all)
- **Arquivo:** src/pages/Marketing.jsx:L34-L99
- **Area:** Marketing
- **Problema:** House rule exige importar de @/entities/all e nunca `supabase.from()` direto em páginas. Marketing.jsx monta headers/token manualmente e faz fetch cru a `marketing_files` (directList/Insert/Delete), reimplementando o adapter e o tratamento de token de sessão.
- **Correcao:** Criar `MarketingFile = createEntity('marketing_files')` em entities/all.js e usar `.list/.create/.delete`. O CLAUDE.md nota que `marketing_files` "trava" o supabase-js — se for o caso real, documentar a exceção explicitamente no topo do arquivo; mas o `directDelete` perde o `.select('id')` que detecta RLS silencioso.
- **Confianca:** medium

### 58. [MEDIUM/bug] directDelete sem `.select('id')` — delete bloqueado por RLS retorna "sucesso" falso
- **Arquivo:** src/pages/Marketing.jsx:L85-L99
- **Area:** Marketing
- **Problema:** O DELETE manual considera qualquer status 2xx como sucesso. Se a RLS bloquear (0 linhas afetadas), o PostgREST retorna 200/204 sem erro e o card some da UI no reload sem nada ter sido apagado — exatamente o silent-failure que `Entity.delete()` previne com `.select('id')`.
- **Correcao:** Adicionar `Prefer: return=representation` + `select=id` e verificar `rows.length > 0`, lançando "Sem permissão" se vazio — ou migrar para `Entity.delete()`.
- **Confianca:** medium

### 59. [MEDIUM/security] Toast expõe `err.message` cru
- **Arquivo:** src/components/marketing/MetaDepositDialog.jsx:L48
- **Area:** Marketing
- **Problema:** House rule: toasts de erro nunca usam `error.message` direto — devem usar `safeErrorMessage(error, fallback)`. Aqui interpola mensagem crua do Supabase/PostgREST.
- **Correcao:** `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e `toast.error(safeErrorMessage(err, "Não foi possível registrar o depósito."));`
- **Confianca:** high

### 60. [MEDIUM/security] Toasts de confirmar/recusar expõem `err.message` cru
- **Arquivo:** src/components/marketing/MarketingPaymentsAdmin.jsx:L165,L184
- **Area:** Marketing
- **Problema:** `handleConfirm` e `handleReject` interpolam `err.message` direto, contrariando a house rule (o mesmo arquivo já importa e usa `safeErrorMessage` em `handleCancel`).
- **Correcao:** Usar `toast.error(safeErrorMessage(err, "Erro ao confirmar pagamento"))` e `...("Erro ao recusar pagamento")` respectivamente.
- **Confianca:** high

### 61. [MEDIUM/bug] Agrupamento de mês usa `new Date(groupKey + "-01")` — off-by-one BRT
- **Arquivo:** src/pages/Marketing.jsx:L1254-L1257
- **Area:** Marketing
- **Problema:** O label do grupo de mês constrói Date a partir de string `"yyyy-MM-01"`, que o JS interpreta como UTC midnight; em BRT (UTC-3) volta 1 dia e o rótulo do mês pode regredir para o mês anterior (ex.: "2026-05-01" vira 30/04, exibindo "abril"). House rule proíbe `new Date(yyyy-mm-dd)`.
- **Correcao:** Usar `parseDateOnly(groupKey + "-01")` de `@/lib/dateOnly` ou `new Date(`${groupKey}-01T12:00:00`)` para fixar o horário ao meio-dia local.
- **Confianca:** medium

### 62. [MEDIUM/bug] Cria DailyChecklist automaticamente no load — efeito colateral em GET + sem mountedRef guard
- **Arquivo:** src/pages/MyChecklist.jsx:128-139
- **Area:** Onboarding e Checklist
- **Problema:** Se não existe checklist de hoje, `loadData` faz um `create()` (escrita) durante o carregamento da tela. Em StrictMode/double-mount ou troca rápida de franquia isso pode criar linhas duplicadas (não há UNIQUE garantido visível) e o `setChecklist` ocorre sem checar `mountedRef`, podendo setar estado após unmount.
- **Correcao:** Só criar o registro no primeiro toggle (lazy create), e guardar todas as escritas/`setState` pós-await com `if (!mountedRef.current) return;`. Garantir UNIQUE (franchise_id, date) no banco.
- **Confianca:** medium

### 63. [MEDIUM/bug] status "approved" exige role admin mas franqueado pode marcar 9-4? Lógica frágil
- **Arquivo:** src/pages/Onboarding.jsx:336-365
- **Area:** Onboarding e Checklist
- **Problema:** `saveItems` só seta `status="approved"` se `finalItems["9-4"] && user?.role === "admin"`. Mas o GateBlock só renderiza para admin, e o item 9-4 é `franchisor`. Se um manager (não-admin) aprovar, `9-4` fica `true` no DB porém status nunca vira `approved` — fica travado em `pending_approval` para sempre, sem feedback. House rule de visão admin inclui manager.
- **Correcao:** Trocar por `user?.role === "admin" || user?.role === "manager"` (consistente com `isAdmin`), ou usar a flag `isAdmin` derivada. Igualmente no bloco `approved_at`/`approved_by` (linha 360).
- **Confianca:** medium

### 64. [MEDIUM/bug] Toast de erro expõe error.message cru (viola safeErrorMessage)
- **Arquivo:** src/pages/Onboarding.jsx:374-381
- **Area:** Onboarding e Checklist
- **Problema:** O fallback do catch interpola `error.message` direto no toast, expondo detalhes internos (RLS/Postgres) ao usuário. House rule proíbe `error.message` cru; deve usar `safeErrorMessage`.
- **Correcao:** `import { safeErrorMessage } from "@/lib/safeErrorMessage"` e usar `toast.error(safeErrorMessage(error, "Erro ao salvar. Tente novamente."))`. Manter os branches específicos de JWT/timeout antes do fallback.
- **Confianca:** high

### 65. [MEDIUM/security] Toast expõe err.message cru
- **Arquivo:** src/components/onboarding/FiscalDataGate.jsx:77
- **Area:** Onboarding e Checklist
- **Problema:** `toast.error("Erro ao salvar: " + (err?.message || "tente novamente"))` injeta a mensagem bruta da exceção. Viola a house rule de `safeErrorMessage`.
- **Correcao:** Usar `safeErrorMessage(err, "Erro ao salvar. Tente novamente.")`.
- **Confianca:** high

### 66. [MEDIUM/security] href de links externos/internos sem safeHref
- **Arquivo:** src/components/onboarding/OnboardingBlock.jsx:16-27 ; GateBlock.jsx:17-28
- **Area:** Onboarding e Checklist
- **Problema:** `ItemDetails` renderiza `<a href={link.url}>` direto. Hoje as URLs em ITEM_DETAILS são estáticas e confiáveis, mas a house rule exige `safeHref()` em href; se algum dia um link vier de dados (config/franqueado), abre vetor `javascript:`. Achado de convenção/defesa em profundidade.
- **Correcao:** Envolver com `href={safeHref(link.url)}` de `@/lib/safeHref` em ambos os componentes.
- **Confianca:** medium

### 67. [MEDIUM/bug] useEffect com dep [loadData] que muda referência só uma vez, mas cleanup faz flush sem mountedRef
- **Arquivo:** src/pages/Onboarding.jsx:316
- **Area:** Onboarding e Checklist
- **Problema:** O cleanup do effect faz `OnboardingChecklist.update(...)` no unmount usando `pendingSaveRef`. Está ok como flush, mas combinado com o `useCallback([])` stale, `pendingSaveRef.current.checklist` pode estar desatualizado (apontando para checklist antigo após troca de franquia sem flush prévio), gravando items de uma franquia no checklist de outra.
- **Correcao:** Limpar `pendingSaveRef.current` e o `saveTimerRef` ao trocar de franquia (`handleSelectFranchise`/voltar à lista). Garantir flush antes de `setSelectedFranchise(null)`.
- **Confianca:** medium

### 68. [MEDIUM/bug] Comparação de delivered_at (TIMESTAMPTZ) com estimated_delivery (DATE) via string concat
- **Arquivo:** src/pages/PurchaseOrders.jsx:1088-1093
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `wasLate` faz `new Date(estimated_delivery + 'T23:59:59')` — `estimated_delivery` é DATE (yyyy-mm-dd) e concatenar 'T23:59:59' sem timezone é interpretado como horário LOCAL, enquanto `delivered_at` é TIMESTAMPTZ. Em BRT o limite vira 23:59:59 local vs UTC do delivered — pode marcar "atrasado" incorretamente perto da meia-noite.
- **Correcao:** Comparar só a parte de data: `parseDateOnly(estimated_delivery)` (fim do dia) vs `delivered_at` convertido para data BRT, ou usar `differenceInCalendarDays`. Evitar concat manual de string DATE→Date.
- **Confianca:** medium

### 69. [MEDIUM/convention] error.message cru em toasts (deveria usar safeErrorMessage)
- **Arquivo:** src/pages/PurchaseOrders.jsx:347, 430, 499, 545; PurchaseOrderForm.jsx (n/a usa getErrorMessage); PurchaseOrderHistory.jsx:78
- **Area:** Pedidos (Purchase Orders)
- **Problema:** Vários toasts expõem `error?.message` diretamente, violando a regra de mapear para mensagem PT-BR amigável via `safeErrorMessage`. O arquivo já importa `safeErrorMessage` (usado só na geração de ficha, L1250) mas não nos demais.
- **Correcao:** Trocar todos por `toast.error(safeErrorMessage(error, "Erro ao ..."))`. PurchaseOrderHistory.jsx precisa importar `safeErrorMessage`.
- **Confianca:** high

### 70. [MEDIUM/convention] Loading usa spinner em vez de Skeleton
- **Arquivo:** src/pages/PurchaseOrders.jsx:624-632
- **Area:** Pedidos (Purchase Orders)
- **Problema:** HOUSE RULE: "Loading: `<Skeleton>` shadcn (NÃO spinner)". A tela inteira de loading usa `progress_activity` animate-spin.
- **Correcao:** Substituir por layout de `<Skeleton>` (cards/linhas de tabela) shadcn, consistente com o restante do dashboard. (Spinners menores dentro de dialog/itens são aceitáveis, mas a tela principal deve usar Skeleton.)
- **Confianca:** medium

### 71. [MEDIUM/bug] Quantities inicializadas só uma vez — inventoryItems carregado depois fica fora
- **Arquivo:** src/components/minha-loja/PurchaseOrderForm.jsx:113-126
- **Area:** Pedidos (Purchase Orders)
- **Problema:** O `useState(() => ...)` lê `standardProducts` no primeiro render. Se `inventoryItems` (prop) chegar vazio inicialmente e for populado depois (carregamento assíncrono no pai), o map de quantidades não inclui os novos itens — eles renderizam via `quantities[item.id] || 0` (ok visualmente), mas o draft/initialQuantities desses itens nunca é aplicado.
- **Correcao:** Adicionar `useEffect` que reconcilia `quantities` quando `standardProducts` muda (merge de draft/initial para IDs ainda não presentes), ou garantir no pai que o form só monta após `inventoryItems` carregado (key remount).
- **Confianca:** medium

### 72. [MEDIUM/bug] getFranchiseName dentro de useMemo sem estar nas deps
- **Arquivo:** src/pages/PurchaseOrders.jsx:196-235
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `filteredOrders` usa `getFranchiseName` (que depende de `franchiseMap`/`configMap`) no filtro de busca, mas as deps do `useMemo` não incluem esses maps. Se franchises/configs carregarem após orders, a busca por nome usa nomes stale ("Franquia") até outro trigger.
- **Correcao:** Adicionar `franchiseMap, configMap` (ou `franchises, configs`) às deps de `filteredOrders`. Como tudo carrega no mesmo `loadData`, o impacto é baixo, mas a omissão é incorreta.
- **Confianca:** medium

### 73. [MEDIUM/bug] toggleSelectAll/checkbox "selecionar todos" seleciona itens não-deletáveis e ignora paginação visual
- **Arquivo:** src/pages/PurchaseOrders.jsx:519-525
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `toggleSelectAll` seleciona TODOS os `filteredOrders`, incluindo entregues/cancelados. O botão "Excluir Selecionados" some quando algum não é deletável (L848), então after-select-all o usuário não consegue excluir nem ver por quê. Pequena armadilha de UX/lógica.
- **Correcao:** Manter seleção como está (bulk status também usa), mas considerar selecionar só actionable, ou exibir tooltip/contagem "X selecionados, Y deletáveis". Baixo risco — sinalizar.
- **Confianca:** low

### 74. [MEDIUM/bug] Filtro de busca referencia colunas que nao vem na query (contact_phone, customer_name)
- **Arquivo:** src/pages/MyContacts.jsx:208-215
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O filtro de busca e os helpers `getContactName/getContactPhone` usam `c.contact_phone` e `c.customer_name`, mas o `columns` da query (L169) só traz `nome` e `telefone`. Esses campos são sempre `undefined` aqui, então os fallbacks nunca disparam (código morto) e a busca por eles nunca casa.
- **Correcao:** Remover os fallbacks `contact_phone`/`customer_name` (a tabela `contacts` usa `telefone`/`nome`), ou adicioná-los ao `columns` se realmente existirem. Aplicar também em openEdit/getContactName/getContactPhone.
- **Confianca:** high

### 75. [MEDIUM/convention] Export CSV manual em vez do helper centralizado salesExport/ExportButtons
- **Arquivo:** src/pages/MyContacts.jsx:578-608
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O export reimplementa escaping de CSV e geração de blob inline em vez de usar o padrão da casa (helper de export / ExportButtons). Duplica lógica de `escape` e `sanitizeCSVCell` (note que `escape` é aplicado por cima de `sanitizeCSVCell`, mas o telefone L586 e a data L591 NÃO passam por sanitizeCSVCell — inconsistente).
- **Correcao:** Extrair para um helper único (estilo `buildSalesExportRows`) e garantir sanitizeCSVCell em todos os campos de texto. No mínimo, envolver telefone com sanitizeCSVCell por consistência.
- **Confianca:** medium

### 76. [MEDIUM/convention] Nome de arquivo usa .toISOString().split("T")[0] — proibido por house rule
- **Arquivo:** src/pages/MyContacts.jsx:600
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** House rule veta `new Date().toISOString().split("T")[0]` (offset UTC pode dar dia errado em BRT). Deve usar `format(new Date(), "yyyy-MM-dd")`.
- **Correcao:** `import { format } from "date-fns";` e usar `format(new Date(), "yyyy-MM-dd")` (como Reports.jsx já faz no nome do arquivo).
- **Confianca:** high

### 77. [MEDIUM/convention] Intl.NumberFormat inline em vez de formatBRL
- **Arquivo:** src/pages/MyContacts.jsx:91-96
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** `formatCurrency` recria um `Intl.NumberFormat` local. House rule manda usar `formatBRL` de `lib/formatBRL.js` (ou `lib/formatters.js`), nunca Intl inline.
- **Correcao:** `import { formatBRL } from "@/lib/formatBRL";` e substituir os usos por `formatBRL(...)`.
- **Confianca:** high

### 78. [MEDIUM/security] error.message cru exposto na UI (loadError)
- **Arquivo:** src/pages/Reports.jsx:102-103
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O catch grava `err?.message` direto em `loadError`, que é renderizado na tela (L263 "Erro: {loadError}"). House rule proíbe expor `error.message`/`details` cru — pode vazar detalhe interno PostgREST.
- **Correcao:** `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e `setLoadError(safeErrorMessage(err, "Erro ao carregar dados"));`.
- **Confianca:** high

### 79. [MEDIUM/bug] getErrorMessage local pode retornar error.message cru (nao usa safeErrorMessage)
- **Arquivo:** src/pages/MyContacts.jsx:136-148
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O `getErrorMessage` local cai em `return msg || "Erro desconhecido"` no default, expondo a mensagem crua do erro no toast. House rule manda `safeErrorMessage(error, fallback)`.
- **Correcao:** Substituir o helper local por `safeErrorMessage` de `@/lib/safeErrorMessage`, mantendo os fallbacks específicos (23505) se necessário via fallback string.
- **Confianca:** high

### 80. [MEDIUM/bug] checkSession retorna false sem resetar isSaving — botao trava em "Salvando..."
- **Arquivo:** src/pages/MyContacts.jsx:127-134
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** Em handleCreate/handleSave/handleDelete, quando `checkSession()` falha o código faz `return` cedo. Como o `setIsSaving(false)`/`setDeletingContactId(null)` está no `finally`, ele de fato reseta — OK para isSaving. Porém em handleCreate há um segundo early return (L281 "Franquia não encontrada") também coberto pelo finally. Confirmado coberto; o risco real é `setIsSaving(true)` chamado ANTES do checkSession sem catch caso checkSession lance (getSession reject). getSession pode rejeitar e o erro não é tratado em handleDelete/handleSave (sem try em volta do checkSession — está dentro do try, então cai no catch → getErrorMessage). OK.
- **Correcao:** Sem ação obrigatória — finally cobre. Opcional: mover checkSession para antes de setIsSaving(true) para evitar flicker de loading.
- **Confianca:** low

### 81. [MEDIUM/bug] Draft auto-save grava em chave inconsistente com a leitura (perda silenciosa)
- **Arquivo:** src/pages/FranchiseSettings.jsx:355-365
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O auto-save usa `editingConfig?.franchise_evolution_instance_id || 'new'`, mas em `handleInputChange` o `editingConfig` é o estado React que pode estar momentaneamente `null`/desatualizado durante a seleção de config; já a restauração (loadConfigIntoForm) lê pela chave do `config` passado. Em troca rápida de franquia ou primeira digitação antes do `setEditingConfig` propagar, o draft vai para `wizard_draft_new` e nunca é restaurado/limpo.
- **Correcao:** Usar `formData.franchise_evolution_instance_id` como fonte da chave (consistente com `handleSubmit` linha 332 que já faz fallback para `formData.franchise_evolution_instance_id`), ou derivar a chave de `selectedConfigId`/`currentConfig` para garantir mesma chave em escrita e leitura.
- **Confianca:** medium

### 82. [MEDIUM/convention] payment_fees grava número via parseFloat mas re-render relê sem proteção de string
- **Arquivo:** src/pages/FranchiseSettings.jsx:862-866
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O input de taxa faz `parseFloat(e.target.value)` ao gravar (ok), mas o valor exibido `formData.payment_fees?.[pm.value] ?? ""` assume número. Drafts restaurados do localStorage e valores legados podem vir como string; sem `parseFloat` no consumo (cálculo de venda em outras telas lê `payment_fees`), e a house rule exige `parseFloat(x) || 0` em campos numéricos que podem vir string. Aqui o risco real é gravar `NaN` quando `parseFloat` falha (ex: vírgula "3,5"): `parseFloat("3,5")` = 3 silenciosamente, e entradas inválidas viram `NaN` persistido no JSONB.
- **Correcao:** Guardar contra NaN: `const n = parseFloat(e.target.value); const val = e.target.value === "" || isNaN(n) ? null : n;`. Considerar normalizar vírgula→ponto antes.
- **Confianca:** medium

### 83. [MEDIUM/bug] useEffect de auto-check WhatsApp com deps incompletas e referência a currentConfig antes da declaração
- **Arquivo:** src/pages/FranchiseSettings.jsx:175-179
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O effect referencia `currentConfig` (definido só na linha 385, depois do effect) e `checkingStatusFor`/`handleCheckStatusFromBadge`, mas declara apenas `[selectedConfigId]` com eslint-disable. Como `currentConfig` é recalculado a cada render, no momento em que `selectedConfigId` muda mas `displayConfigurations` ainda não contém o item, `currentConfig` é `undefined` e o auto-check não roda; quando os dados chegam, o effect não re-dispara (dep não inclui `displayConfigurations`/`currentConfig`).
- **Correcao:** Adicionar `displayConfigurations` (ou `currentConfig?.id`) às deps para o auto-check disparar quando o config correspondente for resolvido após carga assíncrona.
- **Confianca:** medium

### 84. [MEDIUM/security] error.message cru exposto em toast (desvio da house rule safeErrorMessage)
- **Arquivo:** src/components/vendedor/CatalogUpload.jsx:130
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O fallback de erro de upload interpola `error.message` direto no toast, contrariando a regra "NUNCA error.message/details cru — usar safeErrorMessage". Pode vazar detalhes internos do Supabase Storage ao franqueado.
- **Correcao:** `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e usar `toast.error(safeErrorMessage(error, "Erro ao enviar imagem. Tente novamente."));` mantendo os branches específicos (timeout/404/403) antes do fallback.
- **Confianca:** high

### 85. [MEDIUM/bug] Retry de upload nunca dispara em timeout (Promise.race rejeita, não resolve com error)
- **Arquivo:** src/components/vendedor/CatalogUpload.jsx:104-108
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `doUpload` usa `Promise.race` onde o timeout faz `reject(new Error("timeout"))`. Logo, em timeout a primeira tentativa lança e cai direto no `catch` externo — o bloco de retry (`if (result?.error || result instanceof Error)`) nunca é alcançado. O retry só funciona para erro retornado pelo Supabase (`result.error`), nunca para timeout/rede, justamente o caso para o qual foi escrito.
- **Correcao:** Envolver a primeira tentativa em try/catch local e reexecutar `doUpload()` no catch antes de propagar, ou trocar o timeout para `resolve({ error: new Error("timeout") })` para que o branch de retry o capture.
- **Confianca:** high

### 86. [MEDIUM/dead-code] FranchiseHealthScore (451 linhas) sem nenhum import no projeto
- **Arquivo:** src/components/dashboard/FranchiseHealthScore.jsx:L1-L451
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Componente não é importado em lugar nenhum (nem por alias `@/`, lazy ou require). CLAUDE.md afirma estar "mantido em Acompanhamento/BotIntelligence/FranchiseHealthDetail", mas `FranchiseHealthDetail.jsx` importa apenas FranchiseNotes/InventorySheet — docs estão stale.
- **Correcao:** Remover o arquivo. Atualizar CLAUDE.md (seção Health Score / Features Removidas) que ainda o cita como vivo.
- **Confianca:** high

### 87. [MEDIUM/dead-code] BotPerformanceCard (299 linhas) sem nenhum import
- **Arquivo:** src/components/dashboard/BotPerformanceCard.jsx:L1-L299
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Definido e nunca importado. CLAUDE.md lista como consumer "franchisee" do RPC bot summary, mas não há call-site — só a definição e um `console.warn` interno.
- **Correcao:** Remover o arquivo e ajustar a menção em CLAUDE.md.
- **Confianca:** high

### 88. [MEDIUM/dead-code] ResultadoCharts (321 linhas) sem nenhum import
- **Arquivo:** src/components/minha-loja/ResultadoCharts.jsx:L1-L321
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Componente de gráficos do Resultado nunca importado — provavelmente substituído pelo ComposedChart inline em TabResultado.jsx após o redesign de 29/04.
- **Correcao:** Remover o arquivo.
- **Confianca:** high

### 89. [MEDIUM/dead-code] PeriodComparisonCard (271 linhas) sem nenhum import
- **Arquivo:** src/components/dashboard/PeriodComparisonCard.jsx:L1-L271
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Definido, nunca importado/renderizado.
- **Correcao:** Remover o arquivo.
- **Confianca:** high

### 90. [MEDIUM/dead-code] 5 dependencias mortas (so usadas por componentes shadcn nunca importados)
- **Arquivo:** package.json:48,67,53,61,58
- **Area:** Varredura: dependencias e build
- **Problema:** cmdk (command.jsx), vaul (drawer.jsx), input-otp (input-otp.jsx), react-resizable-panels (resizable.jsx) e react-day-picker (calendar.jsx) so aparecem dentro de src/components/ui/, e esses 6 arquivos UI nao sao importados em NENHUM lugar fora de ui/ (grep `@/components/ui/(command|drawer|input-otp|resizable|carousel|calendar)` = zero matches). Sao boilerplate shadcn morto + deps que so incham node_modules.
- **Correcao:** Remover as 5 deps do package.json e apagar os componentes ui orfaos (command.jsx, drawer.jsx, input-otp.jsx, resizable.jsx, calendar.jsx, carousel.jsx). carousel.jsx tambem e orfao (nao tem dep externa propria mas e codigo morto).
- **Confianca:** high

### 91. [MEDIUM/deprecated] lucide-react retido apenas como dependencia transitiva de boilerplate shadcn
- **Arquivo:** package.json:56 + components.json:20
- **Area:** Varredura: dependencias e build
- **Problema:** HOUSE RULE manda usar `<MaterialIcon>` (nunca lucide direto). Confirmado: lucide-react NAO e importado em nenhum arquivo de pages/components de app — so dentro de src/components/ui/** (21 ocorrencias, todas em shadcn boilerplate, varias delas componentes mortos). components.json ainda declara `"iconLibrary": "lucide"`, o que faz o CLI shadcn gerar novos componentes com lucide, contra a convencao.
- **Correcao:** Manter lucide-react enquanto houver componentes ui ativos que o usam (dialog/select/sheet/etc), mas remove-lo so seria seguro apos limpar todos os ui orfaos. Acao imediata de baixo risco: nada no bundle final muda (tree-shaken por icone). Documentar que e dep so-de-shadcn; alternativamente trocar `iconLibrary` para evitar drift futuro de novos componentes.
- **Confianca:** high

### 92. [MEDIUM/security] error.message cru em setLoadError + toast (sem safeErrorMessage)
- **Arquivo:** src/pages/Acompanhamento.jsx:L135-L136
- **Area:** Varredura: seguranca transversal
- **Problema:** Mensagem de erro bruta exibida na UI e em toast; pode vazar detalhes de Supabase/RLS/SQL (nomes de tabela, coluna, policy) ao franqueado.
- **Correcao:** Importar `safeErrorMessage` de `@/lib/safeErrorMessage` e usar `safeErrorMessage(error, "Erro ao carregar dados de acompanhamento")` em ambos. Já é convenção adotada em 10 outros arquivos.
- **Confianca:** high

### 93. [MEDIUM/security] error.message cru em setLoadError (tela admin Financeiro)
- **Arquivo:** src/pages/Financeiro.jsx:L93
- **Area:** Varredura: seguranca transversal
- **Problema:** `setLoadError(error.message || ...)` renderiza erro bruto na UI. O toast logo abaixo já usa string genérica, mas o `loadError` exibido na tela continua cru.
- **Correcao:** `setLoadError(safeErrorMessage(error, "Erro ao carregar dados"))`. Já existe `safeErrorMessage` importado neste arquivo (consta na lista de adotantes) — verificar se está sendo usado e aplicar aqui.
- **Confianca:** high

### 94. [MEDIUM/security] error.message cru no fallback de convite de equipe
- **Arquivo:** src/pages/Franchises.jsx:L357
- **Area:** Varredura: seguranca transversal
- **Problema:** Fallback do catch de `staffInvite` joga `error.message` direto no toast. Erros de Supabase Auth/RLS podem expor estrutura interna.
- **Correcao:** Trocar o fallback por `toast.error(safeErrorMessage(error, "Erro ao adicionar membro à equipe."))`. Manter o ramo `includes("duplicate"/"already")` (inspeção de string, não exibição). `safeErrorMessage` já é importado neste arquivo.
- **Confianca:** high

### 95. [MEDIUM/security] error.message cru no fallback de erro de upload
- **Arquivo:** src/components/vendedor/CatalogUpload.jsx:L130
- **Area:** Varredura: seguranca transversal
- **Problema:** Ramo final do catch interpola `error.message` no toast exibido ao franqueado, podendo vazar mensagens internas do Storage/PostgREST.
- **Correcao:** `toast.error(safeErrorMessage(error, "Erro ao enviar imagem. Tente novamente."))`. Os ramos específicos (timeout/404/403) já são amigáveis e podem ficar.
- **Confianca:** high

## Low

### 96. [LOW/dead-code] getWhatsAppMessages possivelmente morto (WhatsAppHistory removida)
- **Arquivo:** src/api/functions.js:96-120
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** CLAUDE.md lista `WhatsAppHistory.jsx` em "Features Removidas (NAO recriar)". `getWhatsAppMessages` parece ser o unico consumidor dessa feature; se nenhum componente ativo importa, e codigo morto carregando `VITE_ZUCKZAPGO_URL`.
- **Correcao:** Confirmar com grep de imports; se ninguem usa, remover a funcao e a const ZUCKZAPGO_URL.
- **Confianca:** low

### 97. [LOW/dead-code] analyzeLead e generateSalesReportsAI sao stubs que so lancam erro
- **Arquivo:** src/api/functions.js:122-130
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** Ambas as funcoes apenas `throw new Error('... em migracao')`. CLAUDE.md lista `LeadAnalysisModal.jsx` e relatorios IA em features removidas/migracao. Stubs vivos confundem e mantem superficie de API falsa.
- **Correcao:** Remover se nao houver chamador, ou consolidar num unico helper de "feature indisponivel". Parametro `leadData`/`reportData` nunca usado.
- **Confianca:** low

### 98. [LOW/dead-code] contextValue exporta varios campos hardcoded/no-op de compat legada
- **Arquivo:** src/lib/AuthContext.jsx:260-277
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `isLoadingPublicSettings: false`, `authError: null`, `appPublicSettings: null`, `checkAppState: () => {}` sao valores fixos (heranca Base44). Se nada os consome de forma significativa, sao ruido na superficie do contexto; se consomem, mascaram estados que nunca atualizam.
- **Correcao:** Auditar consumidores via grep; remover os nao usados do `useMemo` e do contexto.
- **Confianca:** low

### 99. [LOW/performance] isIframe avaliado no top-level do modulo — pode lancar em sandbox cross-origin
- **Arquivo:** src/lib/utils.js:9
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `window.self !== window.top` no escopo do modulo executa no import. Em iframe cross-origin, acessar `window.top` pode lancar SecurityError em alguns browsers, derrubando o import do modulo `cn` (que e usado em todo lugar). Acesso a `window.top` e geralmente permitido para comparacao de referencia, mas e fragil avaliar no top-level.
- **Correcao:** Envolver em try/catch ou transformar em funcao lazy: `export const isIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();`
- **Confianca:** low

### 100. [LOW/bug] startPolling captura intervalMs no setInterval mas mudanca de intervalMs nao reinicia o timer existente
- **Arquivo:** src/hooks/useVisibilityPolling.js:27-32
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `startPolling` e memoizado em `[intervalMs, runCallback]` e o effect depende dele, entao trocar `intervalMs` recria startPolling e re-roda o effect (que faz stop+start) — OK. Porem o guard `if (intervalRef.current) return;` no inicio de startPolling significa que se o effect chamar startPolling sem antes stopPolling (nao e o caso atual), o novo intervalo seria ignorado. Funciona hoje, mas e fragil: depende da ordem cleanup→start do React.
- **Correcao:** Em startPolling, fazer `stopPolling()` antes de criar o novo interval em vez do early-return, garantindo que mudancas de intervalMs sempre tomem efeito.
- **Confianca:** low

### 101. [LOW/bug] item.url.includes(currentPageName) gera matching ativo errado para nomes substring
- **Arquivo:** src/Layout.jsx:296-300,312-315
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** A deteccao de pagina ativa usa `item.url.includes(currentPageName)`. `currentPageName` curto pode ser substring de outra URL (ex: pagina "Gestao" vs URL "/Gestao", ok; mas "Vendas" como substring acidental, ou paginas com prefixo comum). Dois itens usam o mesmo icone "bar_chart" (Gestao e Relatorios) e duas rotas apontam para "FranchiseSettings" (Meu Vendedor e Configuracoes) — o `find` pode marcar o item errado como ativo.
- **Correcao:** Comparar igualdade exata: `item.url === createPageUrl(currentPageName)` ou normalizar antes. Para o caso FranchiseSettings (2 itens mesma URL), desambiguar por role (ja filtrado, ok) — mas a heuristica `includes` continua arriscada.
- **Confianca:** medium

### 102. [LOW/convention] throw new Error com status cru em vez de mensagem amigavel PT-BR mapeada
- **Arquivo:** src/api/functions.js:31,42,54,67,88
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** Erros lancados concatenam `response.status` numerico. Quando esses erros chegam a um toast sem `safeErrorMessage`, o usuario ve "Erro ao conectar WhatsApp: 502". House rule pede mensagem PT-BR amigavel, sem detalhes crus.
- **Correcao:** Manter status apenas em `console`/telemetria; lancar Error com mensagem limpa, e garantir que os consumidores usem `safeErrorMessage`.
- **Confianca:** low

### 103. [LOW/maintainability] search() ordena fixo por created_at — quebra em tabelas sem essa coluna
- **Arquivo:** src/entities/all.js:114-138
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `search` sempre faz `query.order('created_at', {ascending:false})`. Entidades como `inventory_items` (usa product_name), `vw_bot_conversations` (started_at, nao created_at) ou views podem nao ter `created_at`, resultando em erro 42703 se `search` for chamado nelas. Hoje provavelmente so e usado em Contact, mas e uma armadilha latente.
- **Correcao:** Tornar a coluna de ordenacao parametrizavel (`orderColumn = 'created_at'`) no options de search.
- **Confianca:** low

### 104. [LOW/convention] new Date(dueDate) sobre coluna que pode ser DATE — risco de offset BRT
- **Arquivo:** src/hooks/useSubscriptionStatus.js:97-98
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** `current_payment_due_date` no ASAAS normalmente vem como DATE (YYYY-MM-DD). `new Date("2026-05-10")` interpreta como UTC midnight; em BRT vira dia anterior. A comparacao `due > now` pode classificar uma assinatura como vencida (cache 5min) no ultimo dia, ou vice-versa, por ~3h. House rule proibe construir Date de string DATE.
- **Correcao:** Se `current_payment_due_date` for DATE, usar `parseDateOnly(dueDate)` de `@/lib/dateOnly`. Se for TIMESTAMPTZ, esta ok (confirmar tipo no schema).
- **Confianca:** medium

### 105. [LOW/performance] QueryClient sem staleTime/gcTime padrao — defaults agressivos de refetch
- **Arquivo:** src/lib/query-client.js:4-11
- **Area:** Infra central (entities, api, auth, hooks, Layout)
- **Problema:** So configura `refetchOnWindowFocus:false` e `retry:1`. Sem `staleTime` default (0), toda montagem de componente que usa useQuery refetcha imediatamente. Para um dashboard com muitas telas, um `staleTime` global de ~30-60s reduziria carga sem prejudicar frescor (telas criticas ja sobrescrevem).
- **Correcao:** Adicionar `staleTime: 30_000` (ou valor adequado) como default; telas que precisam de tempo real continuam usando `useVisibilityPolling`/staleTime proprio.
- **Confianca:** low

### 106. [LOW/maintainability] formatBRL/formatBRLCompact reimplementados inline em vez de usar lib
- **Arquivo:** src/components/minha-loja/TabResultado.jsx:47-54
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** O arquivo define `formatBRL` com `new Intl.NumberFormat` inline e `formatBRLCompact` próprio, enquanto a regra do projeto manda usar `formatBRL` de `lib/formatBRL.js`/`lib/formatters.js` (nunca Intl inline). Duplicação diverge da fonte única e da regra "NUNCA new Intl.NumberFormat inline".
- **Correcao:** Importar `formatBRL`, `formatBRLCompact` de `@/lib/formatBRL`/`@/lib/formatters` e remover os helpers locais.
- **Confianca:** high

### 107. [LOW/bug] Expense.delete não confirma efeito (mas adapter cobre) — sem guard de loading no botão de confirmar
- **Arquivo:** src/components/minha-loja/TabResultado.jsx:818-828
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `handleDeleteExpense` está OK quanto a `.select('id')` (no adapter), mas o botão "Excluir" no dialog não desabilita durante a operação — duplo-clique pode disparar dois deletes/refetches. Menor, mas é a área de rigor.
- **Correcao:** Adicionar estado `isDeleting` e `disabled={isDeleting}` no botão Excluir, setando antes do await.
- **Confianca:** medium

### 108. [LOW/convention] Filtro de mês por string startsWith em sale_date (frágil, mas DATE ok)
- **Arquivo:** src/components/dashboard/FinanceiroSummaryCard.jsx:13
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `s.sale_date?.startsWith(currentMonth)` com `currentMonth = format(new Date(), "yyyy-MM")`. Funciona para coluna DATE (string `yyyy-mm-dd`), mas é frágil se algum sale_date vier null/timestamp; o restante do projeto usa `isInMonth`/`parseDateOnly`. Consistência ajudaria.
- **Correcao:** Usar `isInMonth(s.sale_date, new Date())` de `@/lib/financialCalcs` para uniformidade (já trata null e substring).
- **Confianca:** low

### 109. [LOW/maintainability] calculatePnL recalcula vendas/frete/desconto inline em vez de getSaleNetValue
- **Arquivo:** src/lib/financialCalcs.js:32-33
- **Area:** Financeiro (PRIORIDADE — uso principal)
- **Problema:** `calculatePnL` soma `value`, `delivery_fee`, `discount_amount` separadamente (correto numericamente: totalRecebido = value+frete-desconto), mas duplica a lógica que `getSaleNetValue` centraliza. Está certo hoje; o risco é divergir se a fórmula canônica mudar (ex.: net_value). Para a área de rigor, vale alinhar.
- **Correcao:** Manter os subtotais (necessários para o breakdown), mas adicionar teste/asserção de que `totalRecebido === sum(getSaleNetValue(s))` em financialCalcs.test.mjs para travar a invariante.
- **Confianca:** low

### 110. [LOW/dead-code] printImage() exportada mas não consumida
- **Arquivo:** src/lib/shareUtils.js:81-109
- **Area:** Vendas, Estoque, Gestao
- **Problema:** `printImage` não é importada em nenhum lugar (TabLancar usa `printReceipt`; share usa `shareImage`). Código morto que mantém lógica de iframe/print duplicada.
- **Correcao:** Remover `printImage` (e o comentário que a referencia em printReceipt:137) se confirmado sem uso, ou documentar por que mantida.
- **Confianca:** medium

### 111. [LOW/dead-code] Estado isNewContact/newContactName praticamente morto
- **Arquivo:** src/components/minha-loja/SaleForm.jsx:394-395,950-963
- **Area:** Vendas, Estoque, Gestao
- **Problema:** O bloco condicional `isNewContact && !showInlineCreate` nunca renderiza porque `handleContactSearchChange` sempre faz `setIsNewContact(false)` (comentário admite "detection now simplified"). `newContactName` só é lido em `resolveContactId` mas o input que o alimenta está nesse bloco inalcançável.
- **Correcao:** Remover `isNewContact`, `newContactName`, `setNewContactName` e o bloco JSX órfão; em `resolveContactId` o `newContactName.trim()` vira sempre "" — simplificar.
- **Confianca:** medium

### 112. [LOW/dead-code] Props/imports não consumidos em TabEstoque
- **Arquivo:** src/components/minha-loja/TabEstoque.jsx:70-77,1-2
- **Area:** Vendas, Estoque, Gestao
- **Problema:** A prop `franchises` é desestruturada mas nunca usada. `suggestionsRef` é criado e atribuído a um `<div>` mas nunca lido. Pequeno ruído.
- **Correcao:** Remover `franchises` da assinatura (e do call-site em Gestao.jsx:276) e remover `suggestionsRef` se não houver uso planejado.
- **Confianca:** medium

### 113. [LOW/bug] Export CSV de estoque não usa formatBRL e mistura padrões
- **Arquivo:** src/components/minha-loja/TabEstoque.jsx:435-488
- **Area:** Vendas, Estoque, Gestao
- **Problema:** `handleExportCSV` monta CSV manual (já sanitiza texto com sanitizeCSVCell — ok), mas emite `cost_price`/`sale_price` crus (ponto decimal) em vez do padrão pt-BR usado no resto do export (`salesExport` usa vírgula). Inconsistência de formato numérico no Excel pt-BR (pode interpretar errado).
- **Correcao:** Formatar valores monetários com `.toFixed(2).replace(".", ",")` (como salesExport.formatMoney) para consistência e leitura correta no Excel pt-BR.
- **Confianca:** medium

### 114. [LOW/performance] MobileSection definido como componente dentro do render
- **Arquivo:** src/components/minha-loja/SaleForm.jsx:895-918
- **Area:** Vendas, Estoque, Gestao
- **Problema:** `MobileSection` é um componente recriado via `useCallback` mas ainda definido dentro do corpo do SaleForm. Como muda quando `expandedSections` muda, todo o subtree (Desconto/Pagamento/Entrega) remonta a cada toggle de seção, podendo perder foco/estado de inputs internos durante digitação.
- **Correcao:** Extrair `MobileSection` para componente de módulo (fora do SaleForm) recebendo `expanded`/`onToggle` como props, ou renderizar inline sem wrapper-component. Verificar se há perda de foco real antes.
- **Confianca:** low

### 115. [LOW/bug] Label de taxa no detalhe expandido só distingue link/cartão (perde PIX/dinheiro)
- **Arquivo:** src/components/minha-loja/TabLancar.jsx:851-857
- **Area:** Vendas, Estoque, Gestao
- **Problema:** No breakdown expandido, a taxa é rotulada `"Taxa link"` ou `"Taxa cartão"`. Com `payment_fees` por franquia, PIX pode ter taxa (`cardFeeAmount > 0`), mas será exibido como "cartão". O SaleForm já trata isso (linha 1333 distingue PIX/dinheiro); o detalhe da lista não.
- **Correcao:** Reusar a mesma lógica do summary do SaleForm (pix→"PIX", cash→"dinheiro", payment_link→"link", senão "cartão"), idealmente extraída para helper compartilhado.
- **Confianca:** medium

### 116. [LOW/convention] subtotal usa unit_price cru sem parseFloat consistente
- **Arquivo:** src/components/minha-loja/SaleForm.jsx:594-597
- **Area:** Vendas, Estoque, Gestao
- **Problema:** HOUSE RULE pede `parseFloat(x) || 0` para numéricos que podem vir string. `subtotal` faz `(Number(it.quantity)||0) * it.unit_price` — `unit_price` não é coagido. Como vem de `parseFloat(e.target.value)||0` no onChange (sempre number) o risco é baixo, mas em edição os itens vêm de `si.unit_price || 0` (pode ser string do Supabase em `SaleItem.filter`).
- **Correcao:** `(Number(it.quantity)||0) * (parseFloat(it.unit_price)||0)` para blindar contra string vinda do banco.
- **Confianca:** low

### 117. [LOW/maintainability] Lógica de filtro de período duplicada entre filteredSales e totalPendingCount
- **Arquivo:** src/components/minha-loja/TabLancar.jsx:180-218,446-461
- **Area:** Vendas, Estoque, Gestao
- **Problema:** O cálculo de `todayStr/weekStart/monthStart/monthEnd` + filtro de período está duplicado em `filteredSales` e `totalPendingCount`, fáceis de divergir num ajuste futuro (já houve regressões de período no projeto).
- **Correcao:** Extrair helper `matchesPeriod(sale, period, monthOffset)` reutilizado pelos dois useMemo.
- **Confianca:** medium

### 118. [LOW/bug] getValue([]) aplicado a resultados de RPC que retornam {data,error}, não array
- **Arquivo:** src/components/dashboard/AdminDashboard.jsx:L131-L148
- **Area:** Dashboard Admin
- **Problema:** `getValue` retorna `[]` em rejeição, usado tanto para entidades (arrays) quanto não. Para `get_bot_leads_daily` (wave1[5]) o código corretamente lê `.value` separado, mas o padrão é frágil: se alguém reordenar e passar um RPC por `getValue`, `[].data` vira undefined silencioso. Não é bug ativo, mas é armadilha latente já que RPCs e entities convivem no mesmo allSettled.
- **Correcao:** Comentar/anotar que índices 5 (RPC) NÃO devem passar por getValue, ou criar helper `getRpcData(r)` separado para deixar a distinção explícita.
- **Confianca:** low

### 119. [LOW/dead-code] Variáveis prevContacts e contacts computadas mas nunca usadas
- **Arquivo:** src/components/dashboard/AdminDashboard.jsx:L360-L384
- **Area:** Dashboard Admin
- **Problema:** `contacts`/`prevContacts` são calculadas em ambos ramos de `stats` (today e período) mas não entram no objeto retornado nem em nenhum statsCard. Cálculo desperdiçado (inclui chamadas a `contactsFromSummaries`).
- **Correcao:** Remover `contacts`/`prevContacts` dos dois ramos (e a dep `todayContacts`/`contactsFromSummaries` se ficarem sem uso) — ou incluí-las num card se a intenção era exibir contatos.
- **Confianca:** high

### 120. [LOW/bug] lastSaleDate com init "" pode produzir daysSinceLastSale gigante se sale_date for null
- **Arquivo:** src/components/dashboard/AlertsPanel.jsx:L120-L126
- **Area:** Dashboard Admin
- **Problema:** O reduce inicia em `""` e compara `s.sale_date > latest`. Se algum `sale_date` for null/undefined, `null > "..."` é false, então fica `""`; mas se TODAS as datas forem falsy o resultado é `""` truthy-check passa (`lastSaleDate ? ...`) — `""` é falsy, então cai em `null`, ok. O risco real: `parseISO("")` nunca roda (curto-circuito), mas datas mistas válidas/inválidas podem subestimar a última venda. Baixo impacto pois sale_date é NOT NULL no schema.
- **Correcao:** Filtrar `franchiseSales.filter(s => s.sale_date)` antes do reduce, ou usar `Math.max` sobre datas parseadas. Defensivo; manter parseISO (correto para DATE, evita off-by-1 UTC).
- **Confianca:** low

### 121. [LOW/convention] ordered_at (TIMESTAMPTZ) usa new Date() — OK, mas comparação string em loop é por ordenação lexical
- **Arquivo:** src/components/dashboard/LastPurchaseOrderCard.jsx:L33-L67
- **Area:** Dashboard Admin
- **Problema:** O loop seleciona `lastOrder` via `po.ordered_at > lastOrder.ordered_at` comparando strings TIMESTAMPTZ. Funciona para ISO-8601 com mesmo offset, mas se houver mistura de offsets (ex: `+00:00` vs `Z`) a comparação lexical pode errar a ordem. `differenceInDays(today, new Date(ordered_at))` está correto (TIMESTAMPTZ → Date normal, conforme HOUSE RULE).
- **Correcao:** Comparar por `new Date(po.ordered_at) > new Date(lastOrder.ordered_at)` para robustez contra formatos de offset variáveis. Baixo risco se o backend padroniza UTC.
- **Confianca:** low

### 122. [LOW/bug] calcSalesScore/calcOrdersScore constroem Date de string yyyy-mm-dd (off-by-1 BRT)
- **Arquivo:** src/lib/healthScore.js:L27-L83
- **Area:** Dashboard Admin
- **Problema:** `new Date(mostRecentDate)` e `new Date(today)` para `differenceInDays` interpretam `yyyy-MM-dd` como UTC midnight — em BRT (UTC-3) volta 1 dia, podendo inflar `daysSince` em 1. HOUSE RULE proíbe construir Date a partir de string DATE; deve usar parseDateOnly. Em calcOrdersScore, `ordered_at` é TIMESTAMPTZ (ok com Date), mas `created_at?.substring(0,10)` vira DATE-string e cai na mesma armadilha.
- **Correcao:** Usar `parseDateOnly(mostRecentDate)` de lib/dateOnly.js para sale_date e para o `today`. Consumido por Acompanhamento.jsx, então o erro é live (não morto como FranchiseHealthScore).
- **Confianca:** medium

### 123. [LOW/maintainability] Dois sistemas de health score divergentes coexistem (pesos e máximos diferentes)
- **Arquivo:** src/lib/healthScore.js:L196-L264 e src/components/dashboard/FranchiseHealthScore.jsx:L25-L218
- **Area:** Dashboard Admin
- **Problema:** `healthScore.js` (5 dims: vendas/estoque/reposição/setup/bot, pesos %) e o `calculateHealthScore` inline em FranchiseHealthScore.jsx (5 dims: sales/inventory/orders/contacts/bot, pontos absolutos) calculam "saúde" de formas incompatíveis. A CLAUDE.md pede atualizar AMBOS ao refatorar — risco perene de drift. Com FranchiseHealthScore morto, dá pra eliminar metade da dívida.
- **Correcao:** Deletar o calculador inline junto com o componente morto, deixando `healthScore.js` como fonte única. Atualizar a nota da CLAUDE.md ("DOIS sistemas") após a remoção.
- **Confianca:** high

### 124. [LOW/convention] Ternário de pluralização com ambos os ramos idênticos ("atencao")
- **Arquivo:** src/components/dashboard/AlertsPanel.jsx:L259
- **Area:** Dashboard Admin
- **Problema:** `{orangeCount === 1 ? "atencao" : "atencao"}` — os dois ramos são iguais, ternário inútil (provável erro de cópia; deveria ser "atenções" ou similar). Também há ausência de acentuação ("critico", "atencao", "informativo") inconsistente com o resto da UI pt-BR acentuada.
- **Correcao:** Remover o ternário (`{orangeCount} atenção`) e padronizar acentos: "crítico/críticos", "atenção", "informativo/informativos".
- **Confianca:** high

### 125. [LOW/convention] formatBRL via Intl.NumberFormat inline + spinner em vez de Skeleton
- **Arquivo:** src/components/dashboard/PeriodComparisonCard.jsx:L50-L55
- **Area:** Dashboard Franqueado
- **Problema:** Define `formatBRL` local com `new Intl.NumberFormat` (house rule manda usar formatBRL de lib/formatBRL). Também usa spinner animado (L224-227) em vez de Skeleton shadcn.
- **Correcao:** Importar formatBRL de @/lib/formatBRL e remover a função local; trocar o spinner por <Skeleton>.
- **Confianca:** high

### 126. [LOW/bug] DeltaBadge: previous=0 sempre marca +100% e ícone divergente
- **Arquivo:** src/components/dashboard/PeriodComparisonCard.jsx:L57-L63
- **Area:** Dashboard Franqueado
- **Problema:** Quando previous===0 e current>0, delta é forçado a 100 (não reflete crescimento real, igual ao padrão evitado em StatsCard que usa null). Pior: o `icon` é derivado de `delta`, então com previous=0 o badge sempre mostra trending_up mesmo que isInverted; e quando current<previous a cor pode contradizer a seta.
- **Correcao:** Espelhar StatsCard — se previous<=0 e current>0, exibir badge "novo"/"+" sem porcentagem fixa; derivar ícone do sinal real de (current-previous), não do delta percentual.
- **Confianca:** medium

### 127. [LOW/dead-code] Props recebidas mas não passadas / cenários inalcançáveis
- **Arquivo:** src/components/dashboard/PriorityAction.jsx:L107 / src/components/dashboard/RankingStreak.jsx:L52
- **Area:** Dashboard Franqueado
- **Problema:** FranchiseeDashboard passa para PriorityAction apenas smartActions, marketingPayment, botActive, subscription, onOpenPaymentSheet — mas `healthResult` e `coachActions` são undefined, tornando os cenários "estoque", "frete" e "reposicao" do SCENARIOS sempre inativos (estoque zerado é tratado só via activePriorityType, não pelo banner). Em RankingStreak, o cenário com `position` depende de getFranchiseRanking retornar `.position`/`.total_franchises` (RPC não tem essas chaves no entities/all — confirmar a forma real do retorno).
- **Correcao:** Ou alimentar healthResult/coachActions, ou remover os cenários estoque/frete/reposicao de SCENARIOS para evitar lógica morta confusa. Confirmar o shape de getFranchiseRanking (.position vs rank_position) — RankingStreak:31 lê `ranking?.position`.
- **Confianca:** medium

### 128. [LOW/bug] Contact.update sem remover campos read-only e payload incompleto vs guard de 7d
- **Arquivo:** src/components/dashboard/SmartActions.jsx:L29
- **Area:** Dashboard Franqueado
- **Problema:** `Contact.update` envia só `last_contact_at` (ok para não tocar read-only), mas usa `new Date().toISOString()` — `last_contact_at` é timestamptz, então ok. O risco real: o guard "Feito persiste 7 dias" depende de last_contact_at>=7d nas regras; as regras reativar/converter/fidelizar/remarketing têm o guard (>=7), mas "responder" usa >=1 dia (smartActions.js:14-16). Logo, marcar "Feito" em um lead "responder" só suprime por 1 dia, não 7 — divergente da house rule "TODAS as regras DEVEM ter guard >=7d".
- **Correcao:** Confirmar com produto se "responder" deve suprimir 7d como as demais; se sim, alinhar o guard para >=7. Caso o 1d seja intencional (bot/lead novo), documentar a exceção no CLAUDE.md para não parecer regressão.
- **Confianca:** medium

### 129. [LOW/performance] todayRevenue recalculado a cada render (fora de useMemo)
- **Arquivo:** src/components/dashboard/FranchiseeDashboard.jsx:L260
- **Area:** Dashboard Franqueado
- **Problema:** `calcRevenue(todaySales)` roda em todo render. `todaySales` é memoizado mas o cálculo não — barato hoje, mas inconsistente com o resto do arquivo que memoiza stats. Em re-renders por polling/estado de sheets soma trabalho redundante.
- **Correcao:** `const todayRevenue = useMemo(() => calcRevenue(todaySales), [todaySales, calcRevenue]);`
- **Confianca:** high

### 130. [LOW/maintainability] getToday/getYesterday definidos e chamados mas resultados não usados
- **Arquivo:** src/components/dashboard/FranchiseeDashboard.jsx:L61-L62,L91-L92
- **Area:** Dashboard Franqueado
- **Problema:** `today`/`yesterday` são computados em loadData (L91-92) mas não usados depois (as queries usam cutoff90d; stats deriva datas próprias por useMemo). Helpers `getToday`/`getYesterday` (L61-62) só servem a essas linhas mortas.
- **Correcao:** Remover as duas atribuições e os helpers getToday/getYesterday (a query [3] checklist usa `today` em L106 — verificar: sim, usa `today`). Manter `today` para o checklist; remover apenas `yesterday` e getYesterday se de fato não usado.
- **Confianca:** medium

### 131. [LOW/ux] DailyRevenueChart aparenta ser código morto (não importado pelo dashboard)
- **Arquivo:** src/components/dashboard/DailyRevenueChart.jsx:L1-L63
- **Area:** Dashboard Franqueado
- **Problema:** FranchiseeDashboard usa MiniRevenueChart, não DailyRevenueChart. Se nenhum outro consumidor existe, é duplicação morta (lógica de receita correta, mas redundante com MiniRevenueChart).
- **Correcao:** Grep por "DailyRevenueChart"; se órfão, remover. Se usado em admin, ok manter.
- **Confianca:** low

### 132. [LOW/maintainability] initials computado mas nunca renderizado
- **Arquivo:** src/components/dashboard/FranchiseeGreeting.jsx:L10-L12
- **Area:** Dashboard Franqueado
- **Problema:** `initials` é calculado mas não aparece no JSX (não há avatar). Cálculo morto.
- **Correcao:** Remover a variável `initials` ou usá-la num avatar.
- **Confianca:** high

### 133. [LOW/convention] useMemo declara deps summaries/franchiseId mas não os usa no cálculo
- **Arquivo:** src/components/dashboard/MiniRevenueChart.jsx:L95
- **Area:** Dashboard Franqueado
- **Problema:** O memo de chartData depende de `summaries` e `franchiseId` mas o corpo só lê allSales/period/monthOffset/customRange. Deps supérfluas causam recomputo a cada refresh de summaries sem necessidade (e mascaram que summaries é prop inútil aqui).
- **Correcao:** Remover `summaries` e `franchiseId` das deps (e das props, se não usadas em nenhum lugar do componente).
- **Confianca:** medium

### 134. [LOW/bug] Notas exibidas sem sort explicito + Date() em created_at presumido string
- **Arquivo:** src/components/acompanhamento/FranchiseNotes.jsx:L19, L76-L79
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `notes.slice(0, 10)` confia que a ordem vem do banco; House Rule manda "Listas Supabase: SEMPRE sort explicito no frontend (ordem muda apos updates)". Apos `onNoteAdded` (reload), a ordem pode variar. `new Date(note.created_at)` e TIMESTAMPTZ (ok), mas sem sort o "ultimas 10" pode pegar as erradas.
- **Correcao:** `const sorted = [...notes].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); const displayNotes = showAll ? sorted : sorted.slice(0,10);`
- **Confianca:** medium

### 135. [LOW/convention] Toast com err.message cru
- **Arquivo:** src/components/acompanhamento/FranchiseNotes.jsx:L35
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** `toast.error(err.message || ...)` expoe a mensagem bruta do Supabase/RLS, contra a House Rule "NUNCA error.message — usar safeErrorMessage(error, fallback)".
- **Correcao:** `import { safeErrorMessage } from "@/lib/safeErrorMessage"; toast.error(safeErrorMessage(err, "Erro ao salvar anotação"));` Mesmo padrao aplica a Acompanhamento.jsx:L107/L136 e BotIntelligence.jsx:L280 (loadError = e.message).
- **Confianca:** high

### 136. [LOW/convention] `item.quantity || 0` e formatCurrency inline em vez dos helpers
- **Arquivo:** src/components/acompanhamento/InventorySheet.jsx:L21-L23, L28-L31
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** Campos numericos via `|| 0` (House Rule pede `parseFloat(x) || 0` pois podem vir string) e moeda formatada com `Number(value).toFixed(2)` manual em vez de `formatBRL`. Se `quantity`/`min_stock` vierem string, `qty < min` faz comparacao lexicografica errada no status de estoque.
- **Correcao:** `parseFloat(item.quantity) || 0`, `parseFloat(item.min_stock) || 0`; trocar formatCurrency por `formatBRL` de `@/lib/formatBRL`.
- **Confianca:** medium

### 137. [LOW/convention] Skeleton local em vez do `<Skeleton>` shadcn
- **Arquivo:** src/pages/BotIntelligence.jsx:L91-L96
- **Area:** Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
- **Problema:** Define um `Skeleton` proprio (`animate-pulse bg-[#e9e8e9]`) duplicando o componente shadcn que as House Rules mandam usar ("Skeleton shadcn, nao spinner"). Divergencia visual e codigo duplicado.
- **Correcao:** `import { Skeleton } from "@/components/ui/skeleton"` e remover a definicao local.
- **Confianca:** medium

### 138. [LOW/bug] OnboardingChecklist.list("franchise_id", 200) — limit hardcoded 200 vira teto silencioso
- **Arquivo:** src/pages/Franchises.jsx:99,113-116
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** HOUSE RULE: tabelas 1-row-por-franquia com `limit N` viram teto silencioso quando a rede crescer > N (caso documentado em FranchiseConfiguration/Onboarding). Hoje sao ~28 franquias, mas o padrao recomendado para Onboarding e `fetchAll: true`. Com >200 checklists, franquias somem do onboardingMap → barra de progresso some.
- **Correcao:** Trocar por `OnboardingChecklist.list("franchise_id", { fetchAll: true })` (ou a assinatura aceita pelo adapter). Confirmar assinatura do adapter para list com options.
- **Confianca:** medium

### 139. [LOW/dead-code] Dois states de delete-staff (isDeletingStaff duplicado) — um e morto
- **Arquivo:** src/pages/Franchises.jsx:73-74
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Ha `deletingStaff`/`isDeletingStaff` declarados, e na linha 74 ha um segundo `isDeletingStaff` redeclarado via `useState`. Linha 73 declara `isDeletingFranchise`; linha 74 `isDeletingStaff`. Conferindo: 73 = `[isDeletingFranchise, setIsDeletingFranchise]`, 74 = `[isDeletingStaff, setIsDeletingStaff]`. Sao distintos — sem duplicacao real. (Revisao: nao ha bug; ignorar.) Porem `editingPermissions`/`openPermissionsDialog` so e acessado via botao "Editar Permissoes" no sheet — confirmado em uso. Sem achado.
- **Correcao:** Nenhuma acao — falso alarme retirado apos verificacao.
- **Confianca:** high

### 140. [LOW/convention] console.error esquecido em handler de erro de QR
- **Arquivo:** src/components/whatsapp/WhatsAppConnectionModal.jsx:101
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `console.error('Erro ao carregar QR Code:', qrCode)` no onError da img. Em prod o Vite stripa console.* via esbuild.drop, entao nao vaza — mas logar o conteudo do QR (base64) e ruido e potencialmente sensivel se o drop falhar. Convencao: nao logar payloads.
- **Correcao:** Remover o console.error ou logar so a mensagem sem o `qrCode`. Baixa prioridade (stripado em prod).
- **Confianca:** low

### 141. [LOW/dead-code] handleCloseAndCheck e wrapper morto que so chama onClose
- **Arquivo:** src/components/whatsapp/WhatsAppConnectionModal.jsx:46-49
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `handleCloseAndCheck` apenas chama `onClose()` com um comentario explicando que a logica "agora e tratada pelo pai". E indireção sem valor.
- **Correcao:** Usar `onClick={onClose}` direto no botao Fechar e remover o wrapper.
- **Confianca:** high

### 142. [LOW/bug] handleCepChange — fetch ViaCEP sem AbortController nem mountedRef (setState pos-unmount / race entre CEPs)
- **Arquivo:** src/components/franchises/FranchiseForm.jsx:68-94
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** O fetch ViaCEP nao tem cleanup. Se o usuario fecha o dialog durante o fetch, `setAddressData`/`setCepLoading` rodam apos unmount (React warn). Pior: digitar dois CEPs rapidamente dispara dois fetches concorrentes; o que retornar por ultimo "ganha" — pode sobrescrever com o CEP antigo (race). Falha de rede e engolida silenciosamente (catch vazio), aceitavel para autofill, mas sem AbortController ha leak.
- **Correcao:** Usar AbortController por chamada (abortar a anterior) + checar um `mountedRef` antes de setState. Garante que so o ultimo CEP vence e evita warn pos-unmount.
- **Confianca:** medium

### 143. [LOW/bug] franchiseeUsers calculado mas nunca usado (dead) e filtro `!u.role` inclui staff sem role
- **Arquivo:** src/pages/Franchises.jsx:296
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `franchiseeUsers` e derivado mas nao e referenciado em nenhum lugar do JSX/handlers (busquei usos — so a declaracao). Codigo morto. O filtro tambem trata `!u.role` como franqueado, o que mistura usuarios sem role definido.
- **Correcao:** Remover a variavel `franchiseeUsers` (nao usada).
- **Confianca:** high

### 144. [LOW/performance] getLinkedUsers recalcula por card a cada render (O(franquias × usuarios))
- **Arquivo:** src/pages/Franchises.jsx:737-738,418-423
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Dentro do `.map` de franquias, `getLinkedUsers(franchise)` faz `users.filter(...)` por card. Com N franquias e M usuarios e O(N×M) a cada render do componente (que re-renderiza em qualquer mudanca de state — abrir dialog, digitar email de convite). Hoje pequeno, mas todo keystroke em qualquer Input do componente re-roda isso.
- **Correcao:** Memoizar um `linkedUsersByFranchise` via `useMemo([users])` (Map evolution_instance_id→users) e fazer lookup O(1) por card. Tambem evita re-filtro em cada keystroke dos dialogs.
- **Confianca:** medium

### 145. [LOW/maintainability] configPatch silenciosamente descartado se config nao existir
- **Arquivo:** src/lib/saveFiscalData.js:45-52
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Se `FranchiseConfiguration.filter` retorna vazio (config ainda nao criada/trigger atrasado), `configs[0]` e undefined e o cep/street_address sao silenciosamente perdidos sem erro nem aviso. No fluxo de criacao (handleCreateFranchise), o trigger pode nao ter populado config ainda quando saveFiscalData roda logo apos Franchise.create — cep/rua se perdem.
- **Correcao:** Se `!configs[0]`, logar warn/lancar (ou retry) em vez de silenciar — pelo menos `console.warn`. Idealmente o caller (create) deve aguardar config existir antes de gravar cep/rua, ou usar upsert.
- **Confianca:** medium

### 146. [LOW/bug] PAYMENT_METHODS desalinhado dos 6 metodos canonicos do projeto (NFC/Outro/card_fee)
- **Arquivo:** src/lib/franchiseUtils.js:45-52,61-63
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** A HOUSE RULE (Vendas) lista 6 metodos: Dinheiro, Pix, Credito, Debito, NFC, Outro. Aqui PAYMENT_METHODS tem `payment_link` ("Link de Pagamento") em vez de "Outro", e nao ha valor "other". `getPaymentMethodLabel` cai no fallback `|| value` para "other" → mostra a string crua "other" ao usuario em vez de "Outro".
- **Correcao:** Confirmar contra os valores reais persistidos em `sales.payment_method`. Se o banco usa "other", adicionar `{ value: "other", label: "Outro" }` para o label nao vazar valor cru. (Verificar antes de mudar — pode ser intencional.)
- **Confianca:** low

### 147. [LOW/ux] Botao "Tentar novamente" chama loadData sem silent — ok, mas passa o evento como arg
- **Arquivo:** src/pages/Franchises.jsx:731
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** `onClick={loadData}` passa o evento de clique como primeiro argumento de `loadData(silent)`. O React SyntheticEvent vira `silent` truthy → `setIsLoading(true)`/`setLoadError(null)` sao pulados (porque `if (!silent)`), entao o skeleton e o reset de erro NAO aparecem no retry. O usuario clica e nada muda visualmente ate a query terminar.
- **Correcao:** `onClick={() => loadData()}` para garantir `silent=undefined` → mostra skeleton e limpa erro no retry.
- **Confianca:** high

### 148. [LOW/convention] Badge "Pendente" com style inline conflitante (Tailwind + style sobrepostos)
- **Arquivo:** src/components/shared/SubscriptionPaymentSheet.jsx:65
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** Classes `bg-yellow-100 text-yellow-700` coexistem com `style={{ color:"#d4af37", backgroundColor:"#fefce8", borderColor:"#d4af37" }}`. O inline vence, tornando as classes Tailwind mortas e o codigo confuso. Cores hardcoded em vez de paleta via classe.
- **Correcao:** Escolher um caminho — remover o `style` e usar so classes Tailwind da paleta, ou remover as classes conflitantes. Evita "estilo fantasma".
- **Confianca:** medium

### 149. [LOW/convention] toast com error.message cru no delete de franquia/staff (deveria usar safeErrorMessage)
- **Arquivo:** src/pages/Franchises.jsx:287,326-329
- **Area:** Franqueados, Fiscal, Assinatura/Paywall
- **Problema:** HOUSE RULE: toasts de erro NUNCA expoem `error.message` cru. `handleDeleteFranchise` faz `toast.error(error?.message || ...)` e `handleDeleteStaff` faz `toast.error(msg)` com `msg = error?.message`. Outros handlers no mesmo arquivo ja usam `safeErrorMessage` — inconsistente e expoe mensagens de RLS/Postgres cruas.
- **Correcao:** Trocar por `toast.error(safeErrorMessage(error, "Erro ao excluir franquia."))`. Manter os checks de substring ('admin'/'si mesmo') antes, mas o fallback final deve ser sanitizado. Mesmo em handleUnlinkUser:405 e handleAddStaff:357.
- **Confianca:** high

### 150. [LOW/bug] `parseISO` em colunas DATE/TIMESTAMPTZ sem horário fixo
- **Arquivo:** src/components/marketing/MarketingPaymentsAdmin.jsx:L339; src/components/marketing/MarketingPaymentSection.jsx:L216
- **Area:** Marketing
- **Problema:** `deposit_date` é coluna DATE (gravada como "yyyy-MM-dd" em MetaDepositDialog) e `parseISO("2026-05-01")` resolve em UTC midnight → exibe 30/04 em BRT. `currentPayment.created_at` é TIMESTAMPTZ (ok para parseISO), mas `deposit_date` deveria usar `formatDateOnly`/`parseDateOnly`.
- **Correcao:** Para `deposit_date`: `formatDateOnly(d.deposit_date)` de `@/lib/dateOnly`. Manter `parseISO` só em `created_at` (timestamptz).
- **Confianca:** medium

### 151. [LOW/performance] Recálculo pesado de filtro/agrupamento a cada render sem memo
- **Arquivo:** src/pages/Marketing.jsx:L899,L941-L1008
- **Area:** Marketing
- **Problema:** `generateMonthOptions()`, `availableCampaigns`, `filteredFiles`, `grouped` e `sortedGroupKeys` são recomputados em todo render (inclusive ao digitar na busca, que dispara setState). Sem `useMemo`, com muitos arquivos isso re-filtra/re-agrupa O(n) por keystroke.
- **Correcao:** Envolver `filteredFiles`/`grouped`/`sortedGroupKeys`/`availableCampaigns` em `useMemo` com deps adequadas; `monthOptions` em `useMemo(() => generateMonthOptions(), [])`.
- **Confianca:** medium

### 152. [LOW/bug] Texto da notificação usa `monthLabel`/`editMode` stale após resets
- **Arquivo:** src/components/marketing/MarketingPaymentSection.jsx:L153-L162
- **Area:** Marketing
- **Problema:** O bloco de notificação executa após `setEditMode(false)` e `setAmount("")` já terem sido chamados; `editMode` lido aqui é o valor do closure (correto), mas a lógica é frágil — e se a notificação fosse movida depende do snapshot. Mais relevante: `notify_admins` é chamado mesmo quando o submit foi um UPDATE de reenvio, sempre rotulado por `editMode` capturado no início. Funciona hoje, mas o `monthLabel` derivado de `selectedMonth` está correto; risco baixo. Verificar se `notify_admins` cru via `supabase.rpc` é aceitável (chamada RPC direta é permitida; não é `supabase.from`).
- **Correcao:** Mover a montagem do payload de notificação para antes dos resets de estado, ou capturar `const wasEdit = editMode;` no topo do try para clareza.
- **Confianca:** low

### 153. [LOW/bug] Botão submit habilitado com `!amount` mas não valida `< MIN/<=0` no disabled
- **Arquivo:** src/components/marketing/MarketingPaymentSection.jsx:L307; src/components/marketing/MetaDepositDialog.jsx:L112
- **Area:** Marketing
- **Problema:** `disabled={submitting || !amount}` permite clicar com valor abaixo do mínimo (ex.: "50"); a validação só ocorre no handler com toast. É aceitável, mas em Section o `MIN_AMOUNT=200` não bloqueia o botão — UX inconsistente com o aviso "Mínimo R$200". Não é bug crítico.
- **Correcao:** Opcional — refletir a regra no disabled (`parseFloat(amount) < MIN_AMOUNT`) para feedback imediato, mantendo o toast como guarda.
- **Confianca:** low

### 154. [LOW/bug] Validação de tipo/tamanho dentro do loop usa `return` sem resetar `uploading`
- **Arquivo:** src/pages/Marketing.jsx:L334-L344
- **Area:** Marketing
- **Problema:** No upload de múltiplos arquivos, se um arquivo falhar a validação (tipo/tamanho), faz `return` direto de dentro do try. O `finally` reseta `setUploading(false)` (ok), mas arquivos já enviados antes desse ponto ficam órfãos no storage/insertados parcialmente — não há rollback. Para 1 arquivo válido + 1 inválido, o primeiro pode já ter sido inserido.
- **Correcao:** A validação já está separada num primeiro loop antes do upload — confirmar que nenhum insert ocorre antes da validação completa (está correto hoje). Risco real é parcial entre uploads do segundo loop se um falhar no meio; considerar coletar erros e abortar antes de inserir, ou avisar quais foram enviados.
- **Confianca:** low

### 155. [LOW/maintainability] Tabs com `defaultValue` + estado externo `activeTab` divergem
- **Arquivo:** src/pages/Marketing.jsx:L1057-L1067
- **Area:** Marketing
- **Problema:** `<Tabs defaultValue="materiais" onValueChange={setActiveTab}>` controla conteúdo via `activeTab` state, mas o conteúdo "investimento" é renderizado dentro de `<Tabs>` enquanto "materiais" é renderizado fora dela. O `<TabsContent>` do shadcn não é usado; a sincronização depende só do `onValueChange`. Funciona, mas mistura padrão controlado/não-controlado e o `TabsContent` ausente quebra a semântica de a11y do Radix.
- **Correcao:** Usar `<Tabs value={activeTab} onValueChange={setActiveTab>` (controlado) e envolver ambos os conteúdos em `<TabsContent value="...">`.
- **Confianca:** medium

### 156. [LOW/dead-code] `getFilePublicUrl` é passthrough trivial
- **Arquivo:** src/pages/Marketing.jsx:L220-L222
- **Area:** Marketing
- **Problema:** `getFilePublicUrl(filePath)` apenas retorna `filePath || null` — não agrega valor (file_path já é a URL pública completa). Indireção desnecessária.
- **Correcao:** Remover o helper e usar `file.file_path || null` direto, ou manter apenas se houver intenção futura de transformar paths relativos.
- **Confianca:** low

### 157. [LOW/convention] Loading usa spinner em vez de Skeleton
- **Arquivo:** src/pages/Marketing.jsx:L1225-L1228
- **Area:** Marketing
- **Problema:** House rule pede `<Skeleton>` shadcn para loading, não spinner. A página usa um ícone girando (`progress_activity animate-spin`) como estado de carregamento principal de conteúdo. (MarketingPaymentsAdmin já usa Skeleton corretamente.)
- **Correcao:** Substituir por grade de `<Skeleton className="h-48 rounded-2xl" />` imitando os cards de material.
- **Confianca:** medium

### 158. [LOW/ux] `return null` enquanto loading esconde o card inteiro sem placeholder
- **Arquivo:** src/components/marketing/MarketingPaymentSection.jsx:L175
- **Area:** Marketing
- **Problema:** `if (loading || !evoId) return null;` faz o card de investimento sumir até carregar, causando layout shift no dashboard do franqueado. Para `!evoId` é correto, mas durante `loading` deveria mostrar Skeleton (consistente com a house rule de Skeleton e com FranchiseeDashboard).
- **Correcao:** Manter `return null` só para `!evoId`; durante `loading`, renderizar um `<Skeleton className="h-32 rounded-2xl mb-4" />`.
- **Confianca:** low

### 159. [LOW/bug] Extensão de arquivo sem fallback pode gerar nome inválido
- **Arquivo:** src/pages/Marketing.jsx:L347
- **Area:** Marketing
- **Problema:** `file.name.split(".").pop()` retorna o nome inteiro se o arquivo não tiver extensão, produzindo `fileName` estranho mas funcional; mais relevante, `file.name` sem ponto cria `${rand}.${nomeInteiro}`. Edge raro pós-validação (só passa image/* e pdf), risco baixo.
- **Correcao:** `const ext = (file.name.split(".").pop() || "bin").toLowerCase();` com fallback derivado de `file.type`.
- **Confianca:** low

### 160. [LOW/bug] Lista admin usa f.owner_name/f.city que podem não existir; nome cai em fallback silencioso
- **Arquivo:** src/pages/Onboarding.jsx:553-561,620-629
- **Area:** Onboarding e Checklist
- **Problema:** Renderiza `f.franchise_name || f.owner_name` e `f.city`. `franchise_name` vem de config; se a config não tiver `franchise_name`, usa `owner_name`. House rule lembra que `getFranchiseDisplayName` é o padrão. Não quebra, mas pode exibir vazio se ambos faltarem.
- **Correcao:** Usar helper `getFranchiseDisplayName(f, config)` para consistência com o resto do app.
- **Confianca:** low

### 161. [LOW/maintainability] Etiquetas no CHECKLIST_DETAILS divergem das 5 etiquetas oficiais do onboarding
- **Arquivo:** src/components/checklist/CHECKLIST_DETAILS.jsx:57,65,91 (e outros)
- **Area:** Onboarding e Checklist
- **Problema:** O onboarding (ITEM_DETAILS 4-3) define 5 etiquetas: Novo/Negociando/Cliente/VIP/Reativar. Já o CHECKLIST_DETAILS usa um conjunto diferente e maior: 🟣 Clientes Sumidos, ⚪ Não Fechou, 🟢 Cliente Fiel, 🟠 Indicação, 🔵 Pedido Confirmado etc. Franqueado recebe instruções contraditórias entre as duas telas.
- **Correcao:** Padronizar o vocabulário de etiquetas em um único lugar e referenciar nas duas fontes de texto.
- **Confianca:** medium

### 162. [LOW/dead-code] <style> com seletor [data-block-id] sem elemento correspondente (no-op)
- **Arquivo:** src/components/onboarding/OnboardingBlock.jsx:301-307
- **Area:** Onboarding e Checklist
- **Problema:** Injeta CSS `[data-block-id="${block.id}"] { background-color: ... }` mas nenhum elemento no componente recebe o atributo `data-block-id`. Regra nunca casa — código morto.
- **Correcao:** Remover o bloco `<style>` (ou aplicar `data-block-id` no Card se o tint for desejado).
- **Confianca:** high

### 163. [LOW/bug] localStorage backup usa franchises[0] como fallback de evoId no toggle
- **Arquivo:** src/pages/Onboarding.jsx:392-394
- **Area:** Onboarding e Checklist
- **Problema:** No `handleToggle`, `evoId = selectedFranchise?.evolution_instance_id || franchises[0]?.evolution_instance_id`. Para admin, `selectedFranchise` deveria sempre existir ao togglar, mas o fallback para `franchises[0]` pode gravar o backup local sob a franquia errada se o estado estiver transitório, e na recuperação (loadFranchiseChecklist) é lido por `franchise.evolution_instance_id` — possível cruzamento de progresso entre franquias no admin.
- **Correcao:** Para admin, não gravar backup local (recurso é de recuperação do franqueado), ou exigir `selectedFranchise` e abortar o backup se ausente.
- **Confianca:** low

### 164. [LOW/bug] Cálculo de streak limitado a 7 dias mas exibe badges 30 dias (impossível atingir)
- **Arquivo:** src/components/checklist/ChecklistHistory.jsx:14-21
- **Area:** Onboarding e Checklist
- **Problema:** O streak só itera nos 7 dias carregados (`for i=6..0`), então `streak` máximo é 7. As badges "🏆 Franqueado Destaque!" (>=30) e a lógica `>=7 && <30` nunca disparam o caminho de 30. Comentário admite a limitação. Funcionalidade morta/enganosa.
- **Correcao:** Ou remover o badge de 30 dias, ou calcular streak real no servidor (RPC contando dias consecutivos com 100%).
- **Confianca:** high

### 165. [LOW/convention] navigator.clipboard.writeText sem tratamento de rejeição/fallback
- **Arquivo:** src/components/checklist/ChecklistItem.jsx:14-17
- **Area:** Onboarding e Checklist
- **Problema:** `handleCopy` chama `navigator.clipboard.writeText(...)` sem `await`/catch. Em contextos sem permissão/HTTPS antigo a Promise rejeita silenciosamente mas a UI mostra "Copiado!" assim mesmo (falha silenciosa de UX).
- **Correcao:** `navigator.clipboard.writeText(details.script).then(() => setCopied(true)).catch(() => toast.error("Não foi possível copiar."))`.
- **Confianca:** medium

### 166. [LOW/maintainability] handleComplete usa try/catch desnecessário e isCompleting fica true após navigate
- **Arquivo:** src/pages/OnboardingWelcome.jsx:146-158
- **Area:** Onboarding e Checklist
- **Problema:** `handleComplete` envolve apenas `localStorage.setItem` + `navigate` em try/catch (operações que não lançam realisticamente) e o `setIsCompleting(false)` está fora do finally — após `navigate(replace)` o componente desmonta, então o reset nunca importa, mas o padrão pode logar warning de setState pós-unmount.
- **Correcao:** Simplificar: marcar localStorage e navegar sem try/catch artificial; remover `setIsCompleting(false)` pós-navigate ou colocá-lo antes do navigate.
- **Confianca:** low

### 167. [LOW/bug] handleDeleteOnboarding sem tratamento de erro (delete pode lançar)
- **Arquivo:** src/pages/Onboarding.jsx:268-273
- **Area:** Onboarding e Checklist
- **Problema:** `OnboardingChecklist.delete` lança "Sem permissão..." quando RLS retorna 0 rows, mas a função não tem try/catch — exceção sobe sem toast e o estado já não é resetado se o delete falhar (o reset vem depois do await). Usuário vê tela sem feedback.
- **Correcao:** Envolver em try/catch com `toast.error(safeErrorMessage(e, "Não foi possível excluir."))` e só resetar estado no sucesso.
- **Confianca:** medium

### 168. [LOW/dead-code] b18Complete recalculado no render mas também derivado em vários pontos
- **Arquivo:** src/pages/Onboarding.jsx:441
- **Area:** Onboarding e Checklist
- **Problema:** `b18Complete` (linha 441) é recalculado a cada render via `blocks1to8Complete(items)` e usado em vários lugares; não memoizado. Custo baixo (loop sobre ~24 itens) mas chamado junto com `liveCounts`, `completedBlockCount`, `nextActiveBlockId` no mesmo render — múltiplas varreduras de BLOCKS por render. Oportunidade de consolidar em um único `useMemo`.
- **Correcao:** Consolidar derivações de `items` em um único `useMemo(() => ({...}), [items])`.
- **Confianca:** low

### 169. [LOW/bug] hasData/totalUnits tratam "" como valor numérico
- **Arquivo:** src/components/minha-loja/PurchaseOrderForm.jsx:130, 182
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `setQty` permite armazenar `""` (string vazia) para campo limpo. Em `saveDraft`, `Object.values(qtys).some(v => v > 0)` com `"" > 0` é `false` (ok), mas `totalUnits` faz `sum + (qty || 0)` — `"" || 0` = 0 (ok). Porém `grandTotal`/`getLineTotal` usam `quantities[item.id] || 0` que com `""` → 0 (ok). O risco real: ao persistir draft com `""`, no reload `qty || 0` exibe 0, mas o input usa `value={qty || ""}` consistente. Inconsistência menor mas funcional.
- **Correcao:** Normalizar `""`→0 antes de salvar draft, ou `parseFloat(v) > 0`. Cosmético — confirma robustez.
- **Confianca:** low

### 170. [LOW/maintainability] Lógica de save de itens/total duplicada entre handleSaveEdits e doStatusChange
- **Arquivo:** src/pages/PurchaseOrders.jsx:373-389
- **Area:** Pedidos (Purchase Orders)
- **Problema:** O bloco "filtrar changedItems + Promise.all update + recalculateTotal" é copiado em `handleSaveEdits` (L322-340) e `doStatusChange` (L374-388). Divergência futura entre os dois caminhos é provável.
- **Correcao:** Extrair helper `persistOrderEdits(order)` reutilizado por ambos.
- **Confianca:** high

### 171. [LOW/convention] getErrorMessage local em vez de safeErrorMessage compartilhado
- **Arquivo:** src/components/minha-loja/PurchaseOrderForm.jsx:29-44
- **Area:** Pedidos (Purchase Orders)
- **Problema:** Reimplementa mapeamento de erro localmente (JWT/RLS/FK/timeout) quando o projeto tem helper centralizado `safeErrorMessage`/`getErrorMessage`. Duplicação de regra de negócio de mensagens de erro.
- **Correcao:** Usar `safeErrorMessage(error, fallback)` de `@/lib/safeErrorMessage` (ou o `getErrorMessage` central se existir), removendo a cópia local.
- **Confianca:** medium

### 172. [LOW/bug] Filtro de mês usa new Date(ordered_at) — ordered_at é TIMESTAMPTZ (ok), mas borda de mês em BRT pode deslizar
- **Arquivo:** src/pages/PurchaseOrders.jsx:196-208
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `ordered_at` é TIMESTAMPTZ (CLAUDE.md confirma uso de `new Date()` normal — correto). Porém `isWithinInterval` com `startOfMonth/endOfMonth` em horário local pode incluir/excluir pedidos da virada de mês (ex: pedido 31/05 23h UTC = 01/06 ou 31/05 dependendo do offset). Risco baixo dado que actionable orders sempre aparecem.
- **Correcao:** Aceitável como está (TIMESTAMPTZ + Date local é o padrão). Apenas ciente de que a borda exata do mês é local-time. Sem ação obrigatória.
- **Confianca:** low

### 173. [LOW/convention] Agrupamento por primeira palavra do product_name é frágil
- **Arquivo:** src/components/minha-loja/PurchaseOrderForm.jsx:84-106
- **Area:** Pedidos (Purchase Orders)
- **Problema:** `productGroups` agrupa por `item.product_name.split(" ")[0]` e ordena por array hardcoded ORDER. Produtos novos (Novo Produto Padrão) com nome fora da lista caem no fim com label = primeira palavra crua. Não é bug, mas manutenção: categoria real (`category`) existe e seria mais robusta.
- **Correcao:** Considerar agrupar por `item.category` quando disponível, mantendo first-word como fallback. Opcional.
- **Confianca:** medium

### 174. [LOW/dead-code] formatBRL/formatBRLCompact duplicados em dois arquivos com comportamento divergente
- **Arquivo:** src/lib/formatBRL.js:14-19 / src/lib/formatters.js:36-40
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** Existem duas implementações de `formatBRL` e `formatBRLCompact` (lib/formatBRL.js e lib/formatters.js). FranchiseReportTable importa de `formatBRL.js`; o de `formatters.js` é mais robusto (`Number(value)||0`, trata `81.6`). `formatBRL.js` faz `value||0` sem coerção de string — viola a house rule de parseFloat para campos que podem vir string.
- **Correcao:** Consolidar em um único módulo (`lib/formatters.js`) e re-exportar de `formatBRL.js`, ou migrar imports. Garantir `Number(value)||0` em ambos.
- **Confianca:** medium

### 175. [LOW/bug] normalizePhone retorna digitos nao-padrao em vez de canonico — pode gravar lixo
- **Arquivo:** src/lib/whatsappUtils.js:18-22
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** Para comprimentos != 10/11, a função retorna os dígitos como estão (L22) em vez de `null`. Em Contact.create/update isso pode gravar telefone inválido (ex: 3 dígitos) que quebra o unique parcial/normalização do banco. A house rule espera canônico ou null.
- **Correcao:** Retornar `null` quando `local.length` não for 10 nem 11 (ou validar antes de persistir em MyContacts handleCreate/handleSave).
- **Confianca:** medium

### 176. [LOW/convention] <select>/<option> nativo em vez de shadcn Select (desvio de padrao UI)
- **Arquivo:** src/components/shared/FranchiseSelector.jsx:38-49
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** O dropdown usa `<select>`/`<option>` nativos, enquanto o resto do app padroniza shadcn `Select`. Não é bug, mas foge da convenção de componentes UI (shadcn/ui).
- **Correcao:** Migrar para o `Select` de `@/components/ui/select` para consistência visual/a11y (baixa prioridade).
- **Confianca:** low

### 177. [LOW/performance] Sale.list fetchAll sem janela máxima — depende só do período do filtro
- **Arquivo:** src/pages/Reports.jsx:55-61
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** `Sale.list` usa `fetchAll: true` com gte/lte do período. Para preset "Mês atual"/"30d" tudo bem, mas o range custom não tem teto: um admin pode pedir 2 anos × rede inteira e puxar dezenas de milhares de linhas página a página. A house rule recomenda janela tight em fetchAll.
- **Correcao:** Limitar o range custom (ex: máx 6-12 meses) na toolbar, ou migrar para RPC server-side aggregate por franquia (padrão get_franchise_report_data / get_franchise_ranking_monthly).
- **Confianca:** medium

### 178. [LOW/maintainability] Status de assinatura no relatorio nao distingue PENDING de OVERDUE corretamente em casos null
- **Arquivo:** src/pages/Reports.jsx:128-200
- **Area:** Clientes, Relatorios, Export, libs util
- **Problema:** `subscriptionStatus = current_payment_status || null`. Se `current_payment_status` é null mas a sub existe e está ativa, a tabela mostra "Aguardando" (fallback do badge), o que pode confundir com franquia sem customer. Não é crash, mas a semântica do relatório fica ambígua.
- **Correcao:** Considerar mapear `subscription_status === "ACTIVE"` sem payment status para um badge distinto (ex: "Ativa"), ou documentar a intenção. Baixa prioridade.
- **Confianca:** low

### 179. [LOW/bug] Horário de retirada (pickup-only) não deriva delivery_schedule e pode deixar opening_hours dessincronizado
- **Arquivo:** src/pages/FranchiseSettings.jsx:760-804
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** No ramo pickup-only (`!has_delivery`), o OperatingHoursEditor escreve `pickup_schedule`/`operating_hours` e só atualiza `opening_hours`/`working_days` se `!formData.has_delivery`. Mas o branch externo já garante `has_pickup` e o interno em 796 relê `formData.has_delivery` (closure pode estar stale dentro do mesmo onChange que disparou múltiplos `handleInputChange`). Em transição de "tinha delivery" para "só pickup", `opening_hours` pode persistir o resumo antigo de entrega, e o ReviewSummary (linha 125) mostra `opening_hours` como horário de retirada — exibindo dado errado ao bot.
- **Correcao:** Derivar o resumo sempre que estiver no ramo pickup-only (o JSX já está nesse ramo por `!hasDelivery`), sem reler `formData.has_delivery` de uma closure potencialmente stale; ou agrupar as mutações em um único `setFormData(prev => ...)`.
- **Confianca:** low

### 180. [LOW/dead-code] Campos do initialFormData não usados / shipping_rules_costs morto
- **Arquivo:** src/pages/FranchiseSettings.jsx:21-65
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `initialFormData` declara `shipping_rules_costs`, `welcome_message`, `social_media_links.instagram`, `bot_personality`, `price_table_url` e `accepted_payment_methods` que não têm input no wizard atual (5 passos). `accepted_payment_methods` é montado em `handleSubmit` mas nunca editado na UI (substituído por payment_delivery/payment_pickup), virando string vazia persistida. `welcome_message`/`price_table_url`/`social_media_links` também não têm campo. Isso polui o payload e confunde manutenção.
- **Correcao:** Remover do initialFormData os campos sem input correspondente OU documentar explicitamente que são preservados read-through. No mínimo, parar de reescrever `accepted_payment_methods=''` em handleSubmit se a fonte de verdade agora é payment_delivery/pickup.
- **Confianca:** medium

### 181. [LOW/bug] RadioCards recebe prop disabledValues mas declara disabled — third_party não desabilita método
- **Arquivo:** src/components/vendedor/WizardFields.jsx:30
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `RadioCards` desestrutura `disabled = []`, mas em FranchiseSettings nenhum `disabled` é passado para `DELIVERY_METHODS` (linhas 701-705). Não há bug ativo aqui, porém a prop `disabled` de RadioCards é código morto (nunca usada pelo único call-site), enquanto PaymentChipsMulti usa `disabledValues`. Inconsistência de naming entre componentes irmãos aumenta risco de passar a prop errada futuramente.
- **Correcao:** Remover a prop `disabled` não usada de RadioCards, ou padronizar para `disabledValues` igual a PaymentChipsMulti.
- **Confianca:** medium

### 182. [LOW/bug] Default range só aparece visualmente mas não é persistido (campo pode salvar vazio)
- **Arquivo:** src/components/vendedor/DeliveryScheduleEditor.jsx:51-53
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `ranges` usa um default `[{ days:[...todos], 06:00-23:00, ... }]` quando `value` está vazio, mas esse default só existe no render — `onChange` nunca é chamado, então se o franqueado não tocar no editor, `formData.delivery_schedule` permanece `[]` e `opening_hours`/`working_days` não são derivados (a derivação na FranchiseSettings:977-986 só roda no onChange). Resultado: a tela mostra "Entregamos todos os dias 06:00-23:00" mas salva schedule vazio.
- **Correcao:** Em FranchiseSettings, ao entrar no Step 3 com `delivery_schedule` vazio, inicializar com o default e disparar o mesmo onChange de derivação; ou no editor, `useEffect` para emitir o default uma vez quando `value` chega vazio.
- **Confianca:** low

### 183. [LOW/ux] Máscara de telefone com cadeia de .replace pode produzir formatação inconsistente
- **Arquivo:** src/pages/FranchiseSettings.jsx:677-679
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O `value` do telefone aplica 4 `.replace` encadeados sobre o mesmo dígito-stream. Para entradas parciais (ex: 6 dígitos) a ordem das regex pode não casar nenhuma e exibir crú, ou casar a regex de fallback `(\d{1,2})` mesmo com 6 dígitos já presentes (porque a primeira regex completa não casou). É frágil e re-deriva no render a cada tecla.
- **Correcao:** Extrair um helper `formatPhoneBR(digits)` puro com branches por length (já existe `normalizePhone` em whatsappUtils; adicionar formatador), memoizado, em vez de cadeia de replace no JSX.
- **Confianca:** low

### 184. [LOW/bug] .sort() muta range.days em place (efeito colateral no estado)
- **Arquivo:** src/components/vendedor/OperatingHoursEditor.jsx:52-55
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `formatSummary` faz `r.days.sort(...)` diretamente sobre o array do estado, mutando-o. Como esse array vem de `formData`, mutar in-place durante render pode causar reorder inesperado das chips e diferenças sutis entre o que é exibido e o que está no estado. DeliveryScheduleEditor/ReviewSummary corretamente usam `[...days].sort(...)`.
- **Correcao:** Clonar antes de ordenar: `[...r.days].sort(...)`.
- **Confianca:** high

### 185. [LOW/maintainability] ReviewSummary exibe opening_hours como "Funcionamento" mas pode estar dessincronizado
- **Arquivo:** src/components/vendedor/ReviewSummary.jsx:165 + src/pages/FranchiseSettings.jsx:1043
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** O resumo de Entrega mostra `formData.opening_hours` (texto derivado no onChange do DeliveryScheduleEditor). Se o usuário editar `delivery_schedule` por caminhos que não passam pela derivação (ex: draft restaurado parcial), `opening_hours` fica defasado em relação a `delivery_schedule`, mostrando horário antigo na revisão final — exatamente a tela de conferência pré-save.
- **Correcao:** Derivar o texto de funcionamento on-the-fly a partir de `formData.delivery_schedule` no ReviewSummary (reusar `generateLabel`+formatação), em vez de depender do campo espelho `opening_hours`.
- **Confianca:** low

### 186. [LOW/performance] localStorage lido no render de cada VideoCard e no body do componente
- **Arquivo:** src/pages/Tutoriais.jsx:176,288
- **Area:** Meu Vendedor (FranchiseSettings) + wizard
- **Problema:** `VideoCard` chama `localStorage.getItem` no corpo do render (8 cards) e `Tutoriais` recalcula `watchedCount` lendo localStorage a cada render. Leituras de localStorage são síncronas e bloqueantes; além disso o estado "assistido" não atualiza reativamente após abrir um vídeo (precisa remount). Baixo impacto, mas é recompute no render + estado não reativo.
- **Correcao:** Ler o conjunto de "watched" uma vez em `useState`/`useEffect` no pai e passar como prop; atualizar via setState em `handleVideoClick` para refletir o check verde sem reload.
- **Confianca:** medium

### 187. [LOW/dead-code] MarketingPaymentCard sem nenhum import (substituído por FinancialObligationsCard)
- **Arquivo:** src/components/dashboard/MarketingPaymentCard.jsx:L1-L110
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** CLAUDE.md confirma "FinancialObligationsCard substituiu MarketingPaymentCard na home (15/04)". O arquivo ficou órfão e nunca foi removido.
- **Correcao:** Remover o arquivo.
- **Confianca:** high

### 188. [LOW/dead-code] SaudeDoNegocioCard sem nenhum import
- **Arquivo:** src/components/dashboard/SaudeDoNegocioCard.jsx:L1-L70
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Definido, nunca consumido.
- **Correcao:** Remover o arquivo.
- **Confianca:** high

### 189. [LOW/dead-code] QuickAccessCards sem nenhum import
- **Arquivo:** src/components/dashboard/QuickAccessCards.jsx:L1-L68
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Definido, nunca importado. (CLAUDE.md cita o arquivo apenas como exemplo de padrão CSS "clickable card", não como componente em uso.)
- **Correcao:** Remover o arquivo (manter o padrão CSS documentado se útil).
- **Confianca:** high

### 190. [LOW/dead-code] MessagesTrend sem nenhum import
- **Arquivo:** src/components/dashboard/MessagesTrend.jsx:L1-L64
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Definido, nunca consumido.
- **Correcao:** Remover o arquivo.
- **Confianca:** high

### 191. [LOW/dead-code] UserNotRegisteredError sem nenhum import
- **Arquivo:** src/components/UserNotRegisteredError.jsx:L1-L30
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Componente de erro nunca referenciado (provável vestígio de fluxo de auth antigo).
- **Correcao:** Remover o arquivo, ou ligá-lo ao AuthContext se a UI de "usuário não registrado" ainda for desejada.
- **Confianca:** high

### 192. [LOW/dead-code] Arquivo de backup versionado dentro de src/
- **Arquivo:** src/entities/all.js.pre-pagination-fix-2026-05-20.bak
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Backup do fix de paginação de 20/05 deixado em `src/entities/`. Polui a árvore, aparece em buscas e pode ser editado por engano. Já consta em `git status` como untracked.
- **Correcao:** Apagar o `.bak` (o histórico do git já preserva a versão anterior). Se quiser guardar, mover para fora de `src/`.
- **Confianca:** high

### 193. [LOW/dead-code] Módulo app-params.js inteiro morto (appParams nunca importado)
- **Arquivo:** src/lib/app-params.js:L1-L7
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** `appParams` não é usado em nenhum arquivo. As mesmas env vars são consumidas diretamente em `supabaseClient.js`/outros, tornando este módulo redundante.
- **Correcao:** Remover o arquivo `app-params.js`.
- **Confianca:** high

### 194. [LOW/dead-code] BOT_PERSONALITIES export morto (feature "Personalidade bot UI" removida)
- **Arquivo:** src/lib/franchiseUtils.js:L78-L82
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Constante exportada nunca consumida; corresponde à "Personalidade bot UI" listada em Features Removidas. Remanescente da feature deletada.
- **Correcao:** Remover a constante.
- **Confianca:** high

### 195. [LOW/dead-code] findFranchise export nunca usado
- **Arquivo:** src/lib/franchiseUtils.js:L35-L40
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Função exportada sem nenhum consumidor no projeto.
- **Correcao:** Remover a função (ou usá-la onde hoje se faz `.find(f => f.id === ... || f.evolution_instance_id === ...)` inline).
- **Confianca:** high

### 196. [LOW/dead-code] LEGACY_PAYMENT_MAP export nunca usado
- **Arquivo:** src/lib/franchiseUtils.js:L55
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Mapa de compat legado exportado e não consumido em lugar nenhum.
- **Correcao:** Remover se a migração de `card_machine` já foi concluída; senão ligar ao código que normaliza métodos legados.
- **Confianca:** medium

### 197. [LOW/dead-code] printImage() export nunca usado (substituído por print de texto crisp)
- **Arquivo:** src/lib/shareUtils.js:L81
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** A própria JSDoc de outra função diz "Unlike printImage(), this preserves crisp text instead of rasterizing" — `printImage` foi substituída e ficou órfã.
- **Correcao:** Remover `printImage`.
- **Confianca:** high

### 198. [LOW/dead-code] isIframe export nunca usado
- **Arquivo:** src/lib/utils.js:L9
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** `export const isIframe = window.self !== window.top` não é consumido. Além de morto, avalia `window` no import (custo trivial, mas inútil).
- **Correcao:** Remover a constante.
- **Confianca:** high

### 199. [LOW/maintainability] export desnecessário de ACTION_RULES (uso só interno)
- **Arquivo:** src/lib/smartActions.js:L124
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** `ACTION_RULES` é usado apenas dentro do próprio arquivo (linha 107), mas exportado via `export { ACTION_RULES }` sem nenhum consumidor externo.
- **Correcao:** Remover o `export` (manter a const interna). Baixíssima prioridade.
- **Confianca:** high

### 200. [LOW/maintainability] LOOKBACK_DAYS / WEEKS_OF_COVERAGE exportados mas só usados internamente
- **Arquivo:** src/lib/stockSuggestion.js:L3-L4
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Ambas constantes são consumidas só dentro do arquivo; o `export` não tem consumidor externo (documentadas no CLAUDE.md como tuning interno).
- **Correcao:** Manter como estão (são tuning conhecido) ou remover `export`. Não-bloqueante.
- **Confianca:** medium

### 201. [LOW/maintainability] CATEGORY_BY_VALUE exportado mas só usado internamente
- **Arquivo:** src/lib/expenseCategories.js:L18
- **Area:** Varredura: codigo morto/deprecado
- **Problema:** Map usado apenas por `getCategoryMeta` no mesmo arquivo; `export` sem consumidor externo.
- **Correcao:** Remover o `export` (opcional, baixa prioridade).
- **Confianca:** medium

### 202. [LOW/maintainability] Lint ignora src/lib e src/api — pontos cegos onde vivem bugs reais
- **Arquivo:** eslint.config.js:9-14
- **Area:** Varredura: dependencias e build
- **Problema:** O flat config so cobre `src/components/**`, `src/pages/**` e `Layout.jsx`, e explicitamente ignora `src/lib/**` e `src/components/ui/**`. src/lib concentra logica critica (financialCalcs, salesExport, dateOnly, stockSuggestion, shareUtils, pickingSheetPdf) e src/api (entities/all.js) nunca passam por unused-imports/react-hooks. O bug do ExportButtons nao seria pego por lint, mas variaveis mortas e hooks em lib passariam batido.
- **Correcao:** Adicionar um segundo bloco de config (ou estender `files`) cobrindo `src/lib/**` e `src/api/**` com pelo menos `unused-imports/no-unused-imports` + `no-unused-vars` (sem regras react/jsx que nao se aplicam). UI pode permanecer ignorado por ser boilerplate.
- **Confianca:** medium

### 203. [LOW/maintainability] manualChunks lista deps mortas no chunk 'export'
- **Arquivo:** vite.config.js:23-31
- **Area:** Varredura: dependencias e build
- **Problema:** O manualChunk 'export' inclui jspdf-autotable e file-saver. file-saver/jspdf sao usados (ExportButtons lazy import), mas como esses imports sao dinamicos (`await import`), o Rollup ja os separa automaticamente; defini-los em manualChunks pode forcar o chunk a ser referenciado de forma inesperada. Menor: se as deps mortas (cmdk etc) fossem para manualChunks causariam warning, mas nao estao — ok. Risco real e baixo, mas a entrada 'export' agrupa libs so usadas sob demanda num unico chunk, anulando parte do beneficio do lazy import por consumidor.
- **Correcao:** Opcional — remover o chunk 'export' manual e deixar o Rollup fatiar pelos dynamic imports (ExportButtons / pickingSheetPdf / shareUtils ja sao lazy). Mantem-se o ganho de nao baixar jspdf/xlsx ate o usuario clicar exportar.
- **Confianca:** medium

### 204. [LOW/deprecated] Majors atrasados: date-fns 3 (atual 4), react-router-dom 6 (atual 7), react-day-picker 8 (atual 9)
- **Arquivo:** package.json:49,58,62
- **Area:** Varredura: dependencias e build
- **Problema:** date-fns ^3.6.0 (v4 disponivel, muda tz handling), react-router-dom ^6.26 (v7 disponivel, mudancas de API/data router), react-day-picker ^8 (v9 incompativel com calendar.jsx shadcn antigo). Nenhum e urgente; date-fns 3→4 e o mais sensivel pelo uso intenso de format/parse com regras BRT das HOUSE RULES. React 18 (nao 19) e escolha consciente e ok.
- **Correcao:** Nao migrar agora. Se for migrar date-fns 4, re-rodar src/lib/financialCalcs.test.mjs e validar todos os helpers de dateOnly.js (regras BRT sao frageis a mudanca de tz). react-day-picker so importa se algum dia usar calendar.jsx (hoje morto).
- **Confianca:** medium

### 205. [LOW/security] error.message cru no toast de falha de conexão WhatsApp
- **Arquivo:** src/hooks/useWhatsAppConnection.js:L114
- **Area:** Varredura: seguranca transversal
- **Problema:** Fallback interpola `error.message` no toast. Risco menor (erros aqui são em parte `new Error()` controlados), mas o ramo genérico pode propagar mensagem de rede/axios crua.
- **Correcao:** `toast.error(safeErrorMessage(error, "Falha ao conectar. Tente novamente."))`. Os `new Error("...")` lançados acima já têm mensagens PT-BR amigáveis; `safeErrorMessage` deve preservá-las e sanear o resto.
- **Confianca:** medium

### 206. [LOW/convention] href={link.url} sem safeHref em links de onboarding
- **Arquivo:** src/components/onboarding/GateBlock.jsx:L19 / src/components/onboarding/OnboardingBlock.jsx:L18
- **Area:** Varredura: seguranca transversal
- **Problema:** `<a href={link.url} target="_blank" rel="noopener noreferrer">` não passa por `safeHref`. `link.url` vem do constante estático `ITEM_DETAILS` (hardcoded), então XSS é improvável hoje, mas viola a House Rule "href dinâmico: safeHref()" e abre risco se a fonte virar dado de banco.
- **Correcao:** Envolver com `safeHref(link.url)` em ambos os componentes, alinhando ao padrão de `MarketingPaymentSection`/`SubscriptionPaywall`. `rel="noopener noreferrer"` já está presente (bom).
- **Confianca:** medium

## Refutados na verificacao (falsos-positivos)

- [high] staleTime como funcao recebe objeto Query, nao os dados — comparacao sempre erra (src/hooks/useSubscriptionStatus.js:45,91-102) - Infra central (entities, api, auth, hooks, Layout) - _Confirmei no type def da lib instalada (@tanstack/query-core 5.89, `hydration-iULCH7y8.d.ts:549-550`): `type StaleTimeFunction = StaleTime | ((query: Query) => StaleTime)`. A função recebe o objeto `Query`, e o código (`staleTime: (query) => getStaleTime(query.state.data)`) extrai corretamente `query.state.data` — que é o `TData` retornado pelo `queryFn`, ou seja, a row `subscription` (ou `null`)._
- [high] getFranchiseName referencia coluna owner_name possivelmente inexistente (src/pages/PurchaseOrders.jsx:190-193) - Pedidos (Purchase Orders) - _`owner_name` EXISTE em `franchises` — verificado por grep com ~30 usos no codebase. Provas decisivas: (1) o helper canônico `src/lib/franchiseUtils.js:125` usa a MESMA cadeia de fallback `config?.franchise_name || franchise?.city || franchise?.owner_name || "Franquia"` — `PurchaseOrders.jsx:193` é cópia fiel desse padrão oficial; (2) `owner_name` é listado explicitamente em `columns` de vários `Fr_

## Resumos por area

### Infra central (entities, api, auth, hooks, Layout)
A fundacao esta solida e madura — o adapter de entidades tem tie-breaker `id` no `fetchAll` (fix 5333224 confirmado), timeouts com cleanup, mutex de auth in-memory e guards de race condition no AuthContext bem pensados. Os achados de maior impacto sao: o adapter NAO aplica tie-breaker quando ha `orderBy` em coluna unica que ja seria suficiente (custo zero, ok), mas SIM um risco real de `getStaleTime` quebrar em react-query v5 (assinatura errada) e um leak de `setTimeout(800ms)` no retry de perfil sem cancelamento. Varios pontos menores de codigo morto, toasts com `error.message` cru (violando house rule) e `Sale.list("-sale_date", 50)` que pode subdimensionar a contagem de vendas do dia.

### Financeiro (PRIORIDADE — uso principal)
A área Financeiro está em bom estado de convenção (usa getSaleNetValue/parseFloat corretamente na maioria dos pontos, formatBRL, MaterialIcon, sonner), mas tem dois bugs silenciosos sérios de truncamento de dados em telas de alto uso: as queries de `TabResultado` (Por Unidade e visão franqueado) e `Expense` não usam `fetchAll`/janela e batem no teto invisível de 1000 linhas do PostgREST, podendo subnotificar vendas/despesas e portanto o LUCRO de franquias grandes. Há ainda um arquivo morto (`ResultadoCharts.jsx`) que viola a fórmula canônica de custo, um spinner em vez de Skeleton, e detalhes menores de KPI/cleanup.

### Vendas, Estoque, Gestao
A área está madura e segue a maioria das HOUSE RULES (getSaleNetValue, parseFloat, sanitizeCSVCell, MaterialIcon, RPC atômica save_sale_with_items, fetchAll com janela). Encontrei um bug real de mapeamento de rótulo de entrega no export, uso de `window.confirm` em produção (viola regra anti-confirm), dois loaders com spinner em vez de Skeleton, código morto (`printImage`, props/state não consumidos) e algumas inconsistências de cálculo de taxa/CAPI. Nada crítico de segurança; severidades concentram-se em medium/low.

### Dashboard Admin
O AdminDashboard tem arquitetura sólida (waves, lazy-load, abort, refs estáveis) e segue a maioria das HOUSE RULES (receita via formula correta, parseFloat, format() para datas). Porém há um bug de classificação de alerta em produção (estoque/leads parados de franquias inativas) e código morto significativo: 3 dos 11 componentes auditados (FranchiseHealthScore, MessagesTrend, SaudeDoNegocioCard → DiagnosticoSheet) não são importados em lugar nenhum. O bug max conhecido em FranchiseHealthScore L232-238 é real mas inofensivo na prática porque o componente está morto.

### Dashboard Franqueado
A área do Dashboard Franqueado está em boa forma geral — receita calculada corretamente (value - discount + delivery_fee com parseFloat), datas via format/yyyy-MM-dd consistentes, cleanup com mountedRef/AbortController, e SmartActions com guard last_contact_at>=7d correto. Os achados mais relevantes são: (1) BotPerformanceCard calcula receita SEM subtrair desconto e sem getSaleNetValue (viola house rule de faturamento), (2) MiniRevenueChart e RankingStreak constroem `new Date(s.date)` a partir de coluna DATE (bug BRT -1 dia em comparações de fronteira), (3) PeriodComparisonCard usa limit hardcoded 500 (teto silencioso) + spinner + Intl.NumberFormat inline + Sale.filter sem fetchAll, e parece

### Bot Intelligence + Acompanhamento (AVALIAR UTILIDADE)
A area Acompanhamento esta tecnicamente solida — janelas de 90d, fetchAll com tie-breaker global, useVisibilityPolling, mountedRef/cleanup e estados de erro/skeleton corretos; ha apenas refinamentos menores (notas sem janela, sort de notas implicito, key reservada). O BotIntelligence.jsx (824 linhas) e o oposto: carrega TRES tabelas inteiras (`bot_conversations` ~28k, `conversation_messages` e `Sale source=bot` todas com `fetchAll:true` SEM janela de data) so para depois filtrar 1 mes em memoria, depende de colunas de status/funil que NAO existem mais no banco (`catalog_sent`, `checkout_started`, `items_discussed`), renderiza um placeholder de "Coach" morto, e mistura duas definicoes incoere

### Franqueados, Fiscal, Assinatura/Paywall
A area de Franqueados/Fiscal/Assinatura esta majoritariamente solida (uso correto de safeErrorMessage, safeHref, MaterialIcon, sonner, mountedRef). Os achados principais sao: validacao de email com regex inconsistente entre browser e JS (silenciosa), dois usos de `supabase.from()` direto em componente de pagina (viola HOUSE RULE), violacao de receita-pattern ausente (nao aplicavel aqui), e varias falhas silenciosas/UX em handlers de convite e CEP. Performance e baixo risco nesta area (datasets pequenos), mas ha re-renders evitaveis e um early-return sem `setIsLoading(false)` que nao se aplica (loadData trata).

### Marketing
A área de Marketing está em estado razoável — house rules de toasts (safeErrorMessage), href (safeHref), parseFloat, MaterialIcon e MARKETING_TAX_RATE/marketingLiquid são respeitadas na maioria dos pontos. Há porém um bug silencioso confirmado (coluna `f.state` inexistente — é `state_uf`), o anti-padrão de `supabase.from()`/REST direto em página (Marketing.jsx faz fetch manual ao PostgREST), e vários toasts crus com `err.message` nas três telas mais novas. Datas DATE construídas via `new Date(string)` e `parseISO` aparecem em pontos que arriscam o off-by-one BRT.

### Onboarding e Checklist
A área tem duas implementações separadas — Onboarding (missões de iniciação, 8 blocos + gate) e MyChecklist (checklist diário/semanal/mensal) — que NÃO são duplicação real: têm propósitos distintos e tabelas distintas (`onboarding_checklists` vs `daily_checklists`). O Onboarding.jsx é complexo e tem várias falhas silenciosas relevantes: closures stale em `useCallback([])`, lógica de aprovação que só aplica `status=approved` quando quem mexe é admin (franqueado marcar 9-4 nunca poderia, mas a verificação está frágil), e `MyChecklist` faz `DailyChecklist.filter` sem janela temporal puxando todo o histórico da franquia. Há também um `CHECKLIST_DETAILS` referenciando etiquetas que divergem das d

### Pedidos (Purchase Orders)
A área de Pedidos é robusta no geral — guards de race condition (currentLoadRef), cleanup orphan order no form, e idempotência de drafts estão bem implementados. Porém há violações concretas das HOUSE RULES: uso de `formatBRL` com `Intl` inline (duplicado em 2 arquivos), `supabase.from()` direto em página/componente (2 ocorrências), `error.message` cru em vários toasts, e um spinner em vez de Skeleton no loading principal. Há também bugs sutis: filtro de mês esconde itens do form, `delivered_at` (TIMESTAMPTZ) sendo comparado contra `estimated_delivery` (DATE) e `getFranchiseName` referenciando coluna `owner_name` possivelmente inexistente.

### Clientes, Relatorios, Export, libs util
Os helpers de lib (csvSanitize, safeErrorMessage, safeHref, dateOnly, formatBRL, formatters, whatsappUtils, marginHelpers) estao corretos e bem implementados. Reports.jsx segue bem as house rules (gte/lte, getValue, fórmula de receita inline correta, sanitizeCSVCell). Os problemas de maior peso estão em MyContacts.jsx: uma referência a função inexistente (`loadInstanceName`) que crasha o botão de retry, uso da coluna errada `total_purchases` no export (sempre 0), e desvios de convenção (export CSV manual sem o helper centralizado, `Intl` inline, `.toISOString().split("T")[0]`, `error.message` cru no Reports). Há também duplicação morta (`formatBRL` em dois arquivos) e filtros que referenciam

### Meu Vendedor (FranchiseSettings) + wizard
A área está madura e em geral bem-construída — auto-save por etapa, draft em localStorage, safeErrorMessage, sonner, MaterialIcon e colunas reais todas conferem (verifiquei no banco). Os achados relevantes concentram-se em (1) uma falha silenciosa de auto-save de draft que persiste com a chave errada quando há config selecionada vs `editingConfig`, (2) `parseFloat` ausente em campos numéricos que vêm string (`payment_fees`, fees do DeliveryFeeEditor), (3) o auto-check de WhatsApp dispara antes de `currentConfig` existir e tem dependências incompletas, e (4) erro cru de upload no CatalogUpload. O resto é UX menor e código morto.

### Varredura: codigo morto/deprecado
A área de código morto está em bom estado nas convenções de risco (zero lucide-react fora de `components/ui/`, zero `console.log/info/debug`, features removidas — Catalog/WhatsAppHistory/BotCoachSheet/ActionPanel/LeadAnalysisModal/Sparklines — limpas sem remanescentes). Porém há acúmulo real: 9 componentes `.jsx` (~1.684 linhas) sem nenhum import em todo o projeto, um arquivo de backup versionado, um módulo lib inteiro morto, e vários exports nomeados nunca consumidos. O `CLAUDE.md` lista `FranchiseHealthScore` e `BotPerformanceCard` como "mantidos/em uso", mas o código mostra zero imports — documentação desatualizada.

### Varredura: dependencias e build
O dashboard tem deps bem organizadas com code-splitting decente, mas a varredura revelou um bug critico de runtime: `ExportButtons.jsx` (usado em Vendas e Gestao>Resultado) usa a API legada `doc.autoTable()` + `autoTableModule.default(jsPDF)` que foi REMOVIDA no jspdf-autotable v5 — o export Excel/PDF quebra silenciosamente (cai no catch, toast generico). Alem disso, ~5 dependencias sao mortas (so consumidas por componentes shadcn nunca importados: cmdk, vaul, input-otp, react-resizable-panels, react-day-picker), inflando node_modules sem entrar no bundle. Config Vite e eslint estao saudaveis, mas o lint ignora `src/lib` e `src/api` inteiramente — pontos cegos relevantes.

### Varredura: seguranca transversal
A segurança transversal do dashboard está em bom estado geral: zero `dangerouslySetInnerHTML` em código do app (só o componente shadcn `chart.jsx`, fora de escopo), zero segredos hardcoded, zero `supabase.from()` fora do entity adapter, e todos os `target="_blank"`/`href`/`window.open` apontam para URLs controladas (Supabase Storage, `wa.me`, YouTube hardcoded, ou já passam por `safeHref`). O único desvio recorrente de House Rule é exposição de `error.message` cru em toasts/UI em 5 arquivos que ainda não adotaram `safeErrorMessage` — risco de vazar detalhes internos (Postgres/RLS/nomes de tabela). Dois `<a target="_blank">` em links estáticos do onboarding omitem `safeHref` (XSS baixo, pois 

