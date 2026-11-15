# Worklist por arquivo (auditoria 2026-05-29)

Findings vivos: 181 | em arquivos ja removidos (ignorar): 27

## src/components/shared/ExportButtons.jsx  (1)
- [critical/bug] 52-92 **Export Excel/PDF quebrado — API legada do jspdf-autotable v5**
    FIX: Migrar para a API funcional v5 (igual pickingSheetPdf.js:371 que ja esta correto): `const { default: autoTable } = await import("jspdf-autotable"); autoTable(doc, { startY: 38, head, body, ... });` e remover o bloco applyPlugin.

## src/pages/Franchises.jsx  (11)
- [high/convention] 319,379,494-500 **supabase.from() / supabase.rpc() direto em pagina (viola HOUSE RULE)**
    FIX: O insert deve usar `FranchiseInvite.create(...)` (ja importado e usado no handleCreateFranchise). Os `delete_user_complete` sao RPC sem entity-adapter equivalente — aceitavel, mas o `.from(...).insert` tem alternativa e deve migrar. Note que a HOUSE RULE existe justamente porque o entity adapter padroniza timeouts; o insert cru aqui nao tem `AbortSignal`.
- [medium/bug] 246-274 **handleSaveFiscal nao passa name/owner_name/status — edicao perde campos se backend exigir**
    FIX: Passar `franchiseData` direto para `saveFiscalData` (que ja filtra por FRANCHISE_FIELDS/CONFIG_FIELDS via `pick`) + `addressExtras`, em vez de re-listar manualmente. Elimina divergencia futura.
- [medium/bug] 488-533 **handleSendInvite — bloco try aninhado redundante e fluxo de erro com dupla atribuicao de isSendingInvite**
    FIX: Remover o try/catch interno; tratar `invErr` diretamente (checar duplicata, senao `throw`). Usar `FranchiseInvite.create` com try/catch unico, como em handleCreateFranchise.
- [medium/bug] 447-484 **handleSavePermissions faz N updates seriais (await em loop) — lento e parcialmente atomico**
    FIX: Coletar os updates em array e usar `Promise.allSettled` para paralelizar; reportar quantos falharam. Mover `setIsSavingPermissions(false)` para um `finally`.
- [medium/security] L357 **error.message cru no fallback de convite de equipe**
    FIX: Trocar o fallback por `toast.error(safeErrorMessage(error, "Erro ao adicionar membro à equipe."))`. Manter o ramo `includes("duplicate"/"already")` (inspeção de string, não exibição). `safeErrorMessage` já é importado neste arquivo.
- [low/bug] 99,113-116 **OnboardingChecklist.list("franchise_id", 200) — limit hardcoded 200 vira teto silencioso**
    FIX: Trocar por `OnboardingChecklist.list("franchise_id", { fetchAll: true })` (ou a assinatura aceita pelo adapter). Confirmar assinatura do adapter para list com options.
- [low/dead-code] 73-74 **Dois states de delete-staff (isDeletingStaff duplicado) — um e morto**
    FIX: Nenhuma acao — falso alarme retirado apos verificacao.
- [low/bug] 296 **franchiseeUsers calculado mas nunca usado (dead) e filtro `!u.role` inclui staff sem role**
    FIX: Remover a variavel `franchiseeUsers` (nao usada).
- [low/performance] 737-738,418-423 **getLinkedUsers recalcula por card a cada render (O(franquias × usuarios))**
    FIX: Memoizar um `linkedUsersByFranchise` via `useMemo([users])` (Map evolution_instance_id→users) e fazer lookup O(1) por card. Tambem evita re-filtro em cada keystroke dos dialogs.
- [low/ux] 731 **Botao "Tentar novamente" chama loadData sem silent — ok, mas passa o evento como arg**
    FIX: `onClick={() => loadData()}` para garantir `silent=undefined` → mostra skeleton e limpa erro no retry.
- [low/convention] 287,326-329 **toast com error.message cru no delete de franquia/staff (deveria usar safeErrorMessage)**
    FIX: Trocar por `toast.error(safeErrorMessage(error, "Erro ao excluir franquia."))`. Manter os checks de substring ('admin'/'si mesmo') antes, mas o fallback final deve ser sanitizado. Mesmo em handleUnlinkUser:405 e handleAddStaff:357.

## src/pages/PurchaseOrders.jsx  (9)
- [high/convention] 39-45 **formatBRL com Intl inline em vez do helper compartilhado**
    FIX: Remover a função local e `import { formatBRL } from "@/lib/formatBRL"` (como já faz PurchaseOrderHistory.jsx). Aplicar idêntico em PurchaseOrderForm.jsx:21-27.
- [high/bug] 190-193 **getFranchiseName referencia coluna owner_name possivelmente inexistente**
    FIX: Confirmar existência de `owner_name` em `franchises` (`information_schema.columns`). Se não existir, remover o termo. Preferir `franchise_name` (config) → `f.name`/`f.city`.
- [medium/bug] 1088-1093 **Comparação de delivered_at (TIMESTAMPTZ) com estimated_delivery (DATE) via string concat**
    FIX: Comparar só a parte de data: `parseDateOnly(estimated_delivery)` (fim do dia) vs `delivered_at` convertido para data BRT, ou usar `differenceInCalendarDays`. Evitar concat manual de string DATE→Date.
- [medium/convention] 347, 430, 499, 545; PurchaseOrderForm.jsx (n/a usa getErrorMessage); PurchaseOrderHistory.jsx:78 **error.message cru em toasts (deveria usar safeErrorMessage)**
    FIX: Trocar todos por `toast.error(safeErrorMessage(error, "Erro ao ..."))`. PurchaseOrderHistory.jsx precisa importar `safeErrorMessage`.
- [medium/convention] 624-632 **Loading usa spinner em vez de Skeleton**
    FIX: Substituir por layout de `<Skeleton>` (cards/linhas de tabela) shadcn, consistente com o restante do dashboard. (Spinners menores dentro de dialog/itens são aceitáveis, mas a tela principal deve usar Skeleton.)
- [medium/bug] 196-235 **getFranchiseName dentro de useMemo sem estar nas deps**
    FIX: Adicionar `franchiseMap, configMap` (ou `franchises, configs`) às deps de `filteredOrders`. Como tudo carrega no mesmo `loadData`, o impacto é baixo, mas a omissão é incorreta.
- [medium/bug] 519-525 **toggleSelectAll/checkbox "selecionar todos" seleciona itens não-deletáveis e ignora paginação visual**
    FIX: Manter seleção como está (bulk status também usa), mas considerar selecionar só actionable, ou exibir tooltip/contagem "X selecionados, Y deletáveis". Baixo risco — sinalizar.
- [low/maintainability] 373-389 **Lógica de save de itens/total duplicada entre handleSaveEdits e doStatusChange**
    FIX: Extrair helper `persistOrderEdits(order)` reutilizado por ambos.
- [low/bug] 196-208 **Filtro de mês usa new Date(ordered_at) — ordered_at é TIMESTAMPTZ (ok), mas borda de mês em BRT pode deslizar**
    FIX: Aceitável como está (TIMESTAMPTZ + Date local é o padrão). Apenas ciente de que a borda exata do mês é local-time. Sem ação obrigatória.

## src/pages/Onboarding.jsx  (8)
- [high/bug] 84-147 **useCallback([]) captura allChecklists/searchParams stale**
    FIX: Adicionar `searchParams` às deps de `loadData` (ou ler via ref), e passar `allChecklists` como argumento explícito a `loadFranchiseChecklist` em vez de capturar via closure; ou converter para ref (`allChecklistsRef`).
- [medium/bug] 336-365 **status "approved" exige role admin mas franqueado pode marcar 9-4? Lógica frágil**
    FIX: Trocar por `user?.role === "admin" || user?.role === "manager"` (consistente com `isAdmin`), ou usar a flag `isAdmin` derivada. Igualmente no bloco `approved_at`/`approved_by` (linha 360).
- [medium/bug] 374-381 **Toast de erro expõe error.message cru (viola safeErrorMessage)**
    FIX: `import { safeErrorMessage } from "@/lib/safeErrorMessage"` e usar `toast.error(safeErrorMessage(error, "Erro ao salvar. Tente novamente."))`. Manter os branches específicos de JWT/timeout antes do fallback.
- [medium/bug] 316 **useEffect com dep [loadData] que muda referência só uma vez, mas cleanup faz flush sem mountedRef**
    FIX: Limpar `pendingSaveRef.current` e o `saveTimerRef` ao trocar de franquia (`handleSelectFranchise`/voltar à lista). Garantir flush antes de `setSelectedFranchise(null)`.
- [low/bug] 553-561,620-629 **Lista admin usa f.owner_name/f.city que podem não existir; nome cai em fallback silencioso**
    FIX: Usar helper `getFranchiseDisplayName(f, config)` para consistência com o resto do app.
- [low/bug] 392-394 **localStorage backup usa franchises[0] como fallback de evoId no toggle**
    FIX: Para admin, não gravar backup local (recurso é de recuperação do franqueado), ou exigir `selectedFranchise` e abortar o backup se ausente.
- [low/bug] 268-273 **handleDeleteOnboarding sem tratamento de erro (delete pode lançar)**
    FIX: Envolver em try/catch com `toast.error(safeErrorMessage(e, "Não foi possível excluir."))` e só resetar estado no sucesso.
- [low/dead-code] 441 **b18Complete recalculado no render mas também derivado em vários pontos**
    FIX: Consolidar derivações de `items` em um único `useMemo(() => ({...}), [items])`.

## src/pages/MyContacts.jsx  (8)
- [high/bug] 393 **Botao "Tentar novamente" chama funcao inexistente loadInstanceName e crasha**
    FIX: Remover a chamada: `onClick={() => loadContacts()}`.
- [high/bug] 589 **Export CSV usa coluna inexistente total_purchases — sempre exporta 0**
    FIX: Trocar para `c.purchase_count ?? 0` (campo já presente em `columns` e usado em filteredContacts/sort).
- [medium/bug] 208-215 **Filtro de busca referencia colunas que nao vem na query (contact_phone, customer_name)**
    FIX: Remover os fallbacks `contact_phone`/`customer_name` (a tabela `contacts` usa `telefone`/`nome`), ou adicioná-los ao `columns` se realmente existirem. Aplicar também em openEdit/getContactName/getContactPhone.
- [medium/convention] 578-608 **Export CSV manual em vez do helper centralizado salesExport/ExportButtons**
    FIX: Extrair para um helper único (estilo `buildSalesExportRows`) e garantir sanitizeCSVCell em todos os campos de texto. No mínimo, envolver telefone com sanitizeCSVCell por consistência.
- [medium/convention] 600 **Nome de arquivo usa .toISOString().split("T")[0] — proibido por house rule**
    FIX: `import { format } from "date-fns";` e usar `format(new Date(), "yyyy-MM-dd")` (como Reports.jsx já faz no nome do arquivo).
- [medium/convention] 91-96 **Intl.NumberFormat inline em vez de formatBRL**
    FIX: `import { formatBRL } from "@/lib/formatBRL";` e substituir os usos por `formatBRL(...)`.
- [medium/bug] 136-148 **getErrorMessage local pode retornar error.message cru (nao usa safeErrorMessage)**
    FIX: Substituir o helper local por `safeErrorMessage` de `@/lib/safeErrorMessage`, mantendo os fallbacks específicos (23505) se necessário via fallback string.
- [medium/bug] 127-134 **checkSession retorna false sem resetar isSaving — botao trava em "Salvando..."**
    FIX: Sem ação obrigatória — finally cobre. Opcional: mover checkSession para antes de setIsSaving(true) para evitar flicker de loading.

## src/components/minha-loja/TabResultado.jsx  (5)
- [high/bug] 663-679 **Sale/Expense/InventoryItem.filter sem fetchAll batem no teto silencioso de 1000 linhas**
    FIX: Passar `fetchAll: true` (Sale/Expense crescem) com janela de data: `Sale.filter({ franchise_id }, "-sale_date", null, { columns, fetchAll: true, gte: { sale_date: format(subMonths(new Date(), 7), "yyyy-MM-dd") } })`. A tela só usa 6 meses + mês anterior; 7m de janela cobre. Idem Expense com `gte: { expense_date }`. InventoryItem é pequena mas também deve usar `fetchAll: true`.
- [high/bug] 686-689 **SaleItem.filter com array de IDs sem fetchAll trunca em 1000 itens**
    FIX: Adicionar `{ ..., fetchAll: true }` e, idealmente, chunk de IDs em lotes de ~500 como em Financeiro.jsx (linhas 118-136) para evitar limite de URL com muitos sale_ids.
- [medium/convention] 854-861 **Loading usa spinner em vez de Skeleton (HOUSE RULE)**
    FIX: Substituir por blocos `<Skeleton>` (ou os `animate-pulse` rounded usados em Financeiro.jsx) reproduzindo a estrutura Hero + 3 cards.
- [low/maintainability] 47-54 **formatBRL/formatBRLCompact reimplementados inline em vez de usar lib**
    FIX: Importar `formatBRL`, `formatBRLCompact` de `@/lib/formatBRL`/`@/lib/formatters` e remover os helpers locais.
- [low/bug] 818-828 **Expense.delete não confirma efeito (mas adapter cobre) — sem guard de loading no botão de confirmar**
    FIX: Adicionar estado `isDeleting` e `disabled={isDeleting}` no botão Excluir, setando antes do await.

## src/components/dashboard/AlertsPanel.jsx  (4)
- [high/bug] L113-L155 **Alertas de estoque disparam para franquias só-estoque sem nenhuma venda**
    FIX: Condicionar os blocos de estoque a `hasSales` (igual já é feito em reposição/sem-vendas), ou definir explicitamente que estoque-só conta como operacional e documentar. Como mínimo, gate `if (hasSales) { ... checagens de estoque ... }` para alinhar com a lógica de reorder.
- [medium/bug] L143-L152 **Item com quantity string "0" é tratado como > 0 em zeroStock/lowStock**
    FIX: Usar `const qty = parseFloat(i.quantity) || 0;` e `const minStock = parseFloat(i.min_stock) || 3;` em todas as comparações (também L115 `hasActiveInventory` e healthScore consumidores).
- [low/bug] L120-L126 **lastSaleDate com init "" pode produzir daysSinceLastSale gigante se sale_date for null**
    FIX: Filtrar `franchiseSales.filter(s => s.sale_date)` antes do reduce, ou usar `Math.max` sobre datas parseadas. Defensivo; manter parseISO (correto para DATE, evita off-by-1 UTC).
- [low/convention] L259 **Ternário de pluralização com ambos os ramos idênticos ("atencao")**
    FIX: Remover o ternário (`{orangeCount} atenção`) e padronizar acentos: "crítico/críticos", "atenção", "informativo/informativos".

## src/components/franchises/FranchiseForm.jsx  (3)
- [high/bug] 103-110 **Validacao fiscal falha silenciosamente sem feedback ao usuario**
    FIX: Emitir `toast.error("Verifique o email")` / `toast.error("CPF/CNPJ deve ter 11 ou 14 digitos")` antes de cada `return`. O CPF/CNPJ sem feedback e o caso mais grave: nao ha validacao HTML de length por digitos (so o `slice(0,14)`), entao um CPF com 9 digitos faz o botao "nao funcionar" sem explicacao.
- [medium/bug] 65,88 **nameManuallyEdited inicia true em fiscal-only, mas autosuggest de nome nunca dispara (morto) e em create pode bloquear sugestao**
    FIX: Mover `nameManuallyEdited` para um `useRef` e ler `ref.current` dentro do callback; remover a dep do useCallback (`[]`). Evita recriacao por keystroke. Baixo impacto, mas limpa o padrao.
- [low/bug] 68-94 **handleCepChange — fetch ViaCEP sem AbortController nem mountedRef (setState pos-unmount / race entre CEPs)**
    FIX: Usar AbortController por chamada (abortar a anterior) + checar um `mountedRef` antes de setState. Garante que so o ultimo CEP vence e evita warn pos-unmount.

## src/hooks/useSubscriptionStatus.js  (2)
- [high/bug] 45,91-102 **staleTime como funcao recebe objeto Query, nao os dados — comparacao sempre erra**
    FIX: Garantir que `query.state.data` e sempre o shape esperado; ou simplificar para `staleTime` fixo + `refetchInterval` condicional. No minimo adicionar comentario e teste cobrindo PAID retornando 24h. Confirmar contra a versao instalada do @tanstack/react-query (v5 passa o objeto Query — atual codigo ja faz isso corretamente, risco e o fallback silencioso quando data ainda nao populou).
- [low/convention] 97-98 **new Date(dueDate) sobre coluna que pode ser DATE — risco de offset BRT**
    FIX: Se `current_payment_due_date` for DATE, usar `parseDateOnly(dueDate)` de `@/lib/dateOnly`. Se for TIMESTAMPTZ, esta ok (confirmar tipo no schema).

## src/lib/AuthContext.jsx  (2)
- [high/bug] 71-72 **setTimeout(800ms) no retry de perfil sem cleanup — pode setar state apos unmount**
    FIX: Adicionar um token de geracao (`const myGen = ++loadGenRef.current`) no inicio de `loadUserProfile` e so aplicar `setUser/...` se `loadGenRef.current === myGen`. Resolve tanto o delay de 800ms quanto a concorrencia geral.
- [low/dead-code] 260-277 **contextValue exporta varios campos hardcoded/no-op de compat legada**
    FIX: Auditar consumidores via grep; remover os nao usados do `useMemo` e do contexto.

## src/pages/MyChecklist.jsx  (2)
- [high/performance] 116-123 **DailyChecklist.filter sem janela temporal puxa todo histórico da franquia**
    FIX: Filtrar no servidor: `DailyChecklist.filter({ franchise_id }, "-date", null, { gte: { date: sevenDaysAgo } })` (date é DATE, aceita `YYYY-MM-DD`). Buscar hoje no mesmo conjunto.
- [medium/bug] 128-139 **Cria DailyChecklist automaticamente no load — efeito colateral em GET + sem mountedRef guard**
    FIX: Só criar o registro no primeiro toggle (lazy create), e guardar todas as escritas/`setState` pós-await com `if (!mountedRef.current) return;`. Garantir UNIQUE (franchise_id, date) no banco.

## src/lib/salesExport.js  (1)
- [high/bug] 6-9,67 **Coluna "Tipo" do export de vendas sempre sai "—" para retirada**
    FIX: Trocar a chave para `retirada`: `{ delivery: "Entrega", retirada: "Retirada", pickup: "Retirada" }` (manter `pickup` por compat com dados legados/bot).

## src/components/minha-loja/PurchaseOrderHistory.jsx  (1)
- [high/convention] 47-50 **supabase.from() direto em componente (viola entity adapter)**
    FIX: Como `.in()` não é suportado pelo adapter, manter o batch mas capturar e logar o erro: `const { data: allItems, error } = await ...; if (error) throw error;` (hoje o erro é silenciosamente descartado e `orderItems` fica vazio sem aviso).

## src/pages/Marketing.jsx  (9)
- [medium/convention] L34-L99 **Página acessa PostgREST direto (bypass de @/entities/all)**
    FIX: Criar `MarketingFile = createEntity('marketing_files')` em entities/all.js e usar `.list/.create/.delete`. O CLAUDE.md nota que `marketing_files` "trava" o supabase-js — se for o caso real, documentar a exceção explicitamente no topo do arquivo; mas o `directDelete` perde o `.select('id')` que detecta RLS silencioso.
- [medium/bug] L85-L99 **directDelete sem `.select('id')` — delete bloqueado por RLS retorna "sucesso" falso**
    FIX: Adicionar `Prefer: return=representation` + `select=id` e verificar `rows.length > 0`, lançando "Sem permissão" se vazio — ou migrar para `Entity.delete()`.
- [medium/bug] L1254-L1257 **Agrupamento de mês usa `new Date(groupKey + "-01")` — off-by-one BRT**
    FIX: Usar `parseDateOnly(groupKey + "-01")` de `@/lib/dateOnly` ou `new Date(`${groupKey}-01T12:00:00`)` para fixar o horário ao meio-dia local.
- [low/performance] L899,L941-L1008 **Recálculo pesado de filtro/agrupamento a cada render sem memo**
    FIX: Envolver `filteredFiles`/`grouped`/`sortedGroupKeys`/`availableCampaigns` em `useMemo` com deps adequadas; `monthOptions` em `useMemo(() => generateMonthOptions(), [])`.
- [low/bug] L334-L344 **Validação de tipo/tamanho dentro do loop usa `return` sem resetar `uploading`**
    FIX: A validação já está separada num primeiro loop antes do upload — confirmar que nenhum insert ocorre antes da validação completa (está correto hoje). Risco real é parcial entre uploads do segundo loop se um falhar no meio; considerar coletar erros e abortar antes de inserir, ou avisar quais foram enviados.
- [low/maintainability] L1057-L1067 **Tabs com `defaultValue` + estado externo `activeTab` divergem**
    FIX: Usar `<Tabs value={activeTab} onValueChange={setActiveTab>` (controlado) e envolver ambos os conteúdos em `<TabsContent value="...">`.
- [low/dead-code] L220-L222 **`getFilePublicUrl` é passthrough trivial**
    FIX: Remover o helper e usar `file.file_path || null` direto, ou manter apenas se houver intenção futura de transformar paths relativos.
- [low/convention] L1225-L1228 **Loading usa spinner em vez de Skeleton**
    FIX: Substituir por grade de `<Skeleton className="h-48 rounded-2xl" />` imitando os cards de material.
- [low/bug] L347 **Extensão de arquivo sem fallback pode gerar nome inválido**
    FIX: `const ext = (file.name.split(".").pop() || "bin").toLowerCase();` com fallback derivado de `file.type`.

## src/pages/FranchiseSettings.jsx  (6)
- [medium/bug] 355-365 **Draft auto-save grava em chave inconsistente com a leitura (perda silenciosa)**
    FIX: Usar `formData.franchise_evolution_instance_id` como fonte da chave (consistente com `handleSubmit` linha 332 que já faz fallback para `formData.franchise_evolution_instance_id`), ou derivar a chave de `selectedConfigId`/`currentConfig` para garantir mesma chave em escrita e leitura.
- [medium/convention] 862-866 **payment_fees grava número via parseFloat mas re-render relê sem proteção de string**
    FIX: Guardar contra NaN: `const n = parseFloat(e.target.value); const val = e.target.value === "" || isNaN(n) ? null : n;`. Considerar normalizar vírgula→ponto antes.
- [medium/bug] 175-179 **useEffect de auto-check WhatsApp com deps incompletas e referência a currentConfig antes da declaração**
    FIX: Adicionar `displayConfigurations` (ou `currentConfig?.id`) às deps para o auto-check disparar quando o config correspondente for resolvido após carga assíncrona.
- [low/bug] 760-804 **Horário de retirada (pickup-only) não deriva delivery_schedule e pode deixar opening_hours dessincronizado**
    FIX: Derivar o resumo sempre que estiver no ramo pickup-only (o JSX já está nesse ramo por `!hasDelivery`), sem reler `formData.has_delivery` de uma closure potencialmente stale; ou agrupar as mutações em um único `setFormData(prev => ...)`.
- [low/dead-code] 21-65 **Campos do initialFormData não usados / shipping_rules_costs morto**
    FIX: Remover do initialFormData os campos sem input correspondente OU documentar explicitamente que são preservados read-through. No mínimo, parar de reescrever `accepted_payment_methods=''` em handleSubmit se a fonte de verdade agora é payment_delivery/pickup.
- [low/ux] 677-679 **Máscara de telefone com cadeia de .replace pode produzir formatação inconsistente**
    FIX: Extrair um helper `formatPhoneBR(digits)` puro com branches por length (já existe `normalizePhone` em whatsappUtils; adicionar formatador), memoizado, em vez de cadeia de replace no JSX.

## src/api/functions.js  (4)
- [medium/bug] 99-120 **getWhatsAppMessages faz fetch direto sem timeout nem auth e engole erro retornando []**
    FIX: Usar `fetchWithTimeout` com timeout (~10s). Manter o `[]` em erro e aceitavel para UX de historico, mas pelo menos garantir que nao trava. Verificar tambem se este caminho ainda e usado — WhatsAppHistory.jsx consta em "Features Removidas" no CLAUDE.md (ver achado dead-code abaixo).
- [low/dead-code] 96-120 **getWhatsAppMessages possivelmente morto (WhatsAppHistory removida)**
    FIX: Confirmar com grep de imports; se ninguem usa, remover a funcao e a const ZUCKZAPGO_URL.
- [low/dead-code] 122-130 **analyzeLead e generateSalesReportsAI sao stubs que so lancam erro**
    FIX: Remover se nao houver chamador, ou consolidar num unico helper de "feature indisponivel". Parametro `leadData`/`reportData` nunca usado.
- [low/convention] 31,42,54,67,88 **throw new Error com status cru em vez de mensagem amigavel PT-BR mapeada**
    FIX: Manter status apenas em `console`/telemetria; lancar Error com mensagem limpa, e garantir que os consumidores usem `safeErrorMessage`.

## src/components/minha-loja/TabLancar.jsx  (4)
- [medium/convention] 255-260 **window.confirm() em fluxo de exclusão de venda viola HOUSE RULE**
    FIX: Mover o aviso para dentro do `DialogDescription` do dialog de exclusão (condicional em `deletingSale?.capi_sent`), ou usar um AlertDialog dedicado. Remover o `window.confirm`.
- [medium/bug] 255,757 **capi_sent / net_value não estão em SALES_COLUMNS — features dependentes ficam inertes**
    FIX: Adicionar `capi_sent` a SALES_COLUMNS (Vendas.jsx) para o aviso funcionar. Para o display do card, usar `getSaleNetValue(sale)` (linha 757) em vez de recomputar — mantém fonte única.
- [low/bug] 851-857 **Label de taxa no detalhe expandido só distingue link/cartão (perde PIX/dinheiro)**
    FIX: Reusar a mesma lógica do summary do SaleForm (pix→"PIX", cash→"dinheiro", payment_link→"link", senão "cartão"), idealmente extraída para helper compartilhado.
- [low/maintainability] 180-218,446-461 **Lógica de filtro de período duplicada entre filteredSales e totalPendingCount**
    FIX: Extrair helper `matchesPeriod(sale, period, monthOffset)` reutilizado pelos dois useMemo.

## src/components/minha-loja/SaleForm.jsx  (4)
- [medium/bug] 438-439,553-558 **Race: config da franquia pode sobrescrever fee_passed do sale em edição**
    FIX: Quando `sale.fee_passed_to_customer == null` em edição, re-aplicar o default da config dentro do useEffect de config (ex.: guardar flag "saleHadExplicitFee" e só então usar `charges`). Confirmar se é cenário real antes de tocar.
- [low/dead-code] 394-395,950-963 **Estado isNewContact/newContactName praticamente morto**
    FIX: Remover `isNewContact`, `newContactName`, `setNewContactName` e o bloco JSX órfão; em `resolveContactId` o `newContactName.trim()` vira sempre "" — simplificar.
- [low/performance] 895-918 **MobileSection definido como componente dentro do render**
    FIX: Extrair `MobileSection` para componente de módulo (fora do SaleForm) recebendo `expanded`/`onToggle` como props, ou renderizar inline sem wrapper-component. Verificar se há perda de foco real antes.
- [low/convention] 594-597 **subtotal usa unit_price cru sem parseFloat consistente**
    FIX: `(Number(it.quantity)||0) * (parseFloat(it.unit_price)||0)` para blindar contra string vinda do banco.

## src/components/minha-loja/PurchaseOrderForm.jsx  (4)
- [medium/bug] 113-126 **Quantities inicializadas só uma vez — inventoryItems carregado depois fica fora**
    FIX: Adicionar `useEffect` que reconcilia `quantities` quando `standardProducts` muda (merge de draft/initial para IDs ainda não presentes), ou garantir no pai que o form só monta após `inventoryItems` carregado (key remount).
- [low/bug] 130, 182 **hasData/totalUnits tratam "" como valor numérico**
    FIX: Normalizar `""`→0 antes de salvar draft, ou `parseFloat(v) > 0`. Cosmético — confirma robustez.
- [low/convention] 29-44 **getErrorMessage local em vez de safeErrorMessage compartilhado**
    FIX: Usar `safeErrorMessage(error, fallback)` de `@/lib/safeErrorMessage` (ou o `getErrorMessage` central se existir), removendo a cópia local.
- [low/convention] 84-106 **Agrupamento por primeira palavra do product_name é frágil**
    FIX: Considerar agrupar por `item.category` quando disponível, mantendo first-word como fallback. Opcional.

## src/Layout.jsx  (3)
- [medium/bug] 249-261 **Contagem de vendas do dia usa Sale.list("-sale_date", 50) — teto silencioso**
    FIX: Usar `Sale.filter({}, null, null, { gte: { sale_date: today }, lte: { sale_date: today } })` (ou `Sale.filter` com criteria por data) e contar o resultado, em vez de pegar 50 e filtrar no cliente. So roda para admin/manager, custo baixo.
- [medium/bug] 161-240 **useEffect com dois caminhos de return de cleanup — branch admin retorna cedo, branch principal retorna no fim; ramo async nao tem return**
    FIX: Depender de campos primitivos estaveis: `[currentUser?.id, currentUser?.role, currentUser?.managed_franchise_ids?.join(',')]` em vez do objeto inteiro, evitando refetch redundante de franquias/onboarding.
- [low/bug] 296-300,312-315 **item.url.includes(currentPageName) gera matching ativo errado para nomes substring**
    FIX: Comparar igualdade exata: `item.url === createPageUrl(currentPageName)` ou normalizar antes. Para o caso FranchiseSettings (2 itens mesma URL), desambiguar por role (ja filtrado, ok) — mas a heuristica `includes` continua arriscada.

## src/components/dashboard/AdminDashboard.jsx  (3)
- [medium/performance] L234-L313 **loadCollapsedData recriado a cada mudança de collapsedData causa churn de ref e refetch instável**
    FIX: Trocar os fallbacks por leitura via functional updater (`setCollapsedData(prev => ...)`) em vez de capturar `collapsedData.*` no closure, e remover esses 3 campos das deps — deixando só `[hasFetchedCollapsed, franchises]`. Reduz recriações e elimina o risco de snapshot stale.
- [low/bug] L131-L148 **getValue([]) aplicado a resultados de RPC que retornam {data,error}, não array**
    FIX: Comentar/anotar que índices 5 (RPC) NÃO devem passar por getValue, ou criar helper `getRpcData(r)` separado para deixar a distinção explícita.
- [low/dead-code] L360-L384 **Variáveis prevContacts e contacts computadas mas nunca usadas**
    FIX: Remover `contacts`/`prevContacts` dos dois ramos (e a dep `todayContacts`/`contactsFromSummaries` se ficarem sem uso) — ou incluí-las num card se a intenção era exibir contatos.

## src/components/shared/SubscriptionPaymentSheet.jsx  (3)
- [medium/bug] 25 **format(new Date(current_payment_due_date)) em coluna DATE volta 1 dia em BRT**
    FIX: Usar `formatDateOnly(current_payment_due_date)` de `@/lib/dateOnly` (mesmo padrao aplicado a expenses.expense_date, sales.sale_date). Aplicar o mesmo em SubscriptionPaywall.jsx:27 (trocar `format(parseISO(...))` por `formatDateOnly`).
- [medium/bug] 31-38 **handleCopyPix sem guard de pix_payload — copia undefined silenciosamente**
    FIX: Adicionar `if (!pix_payload) return;` no inicio, igual ao Paywall.
- [low/convention] 65 **Badge "Pendente" com style inline conflitante (Tailwind + style sobrepostos)**
    FIX: Escolher um caminho — remover o `style` e usar so classes Tailwind da paleta, ou remover as classes conflitantes. Evita "estilo fantasma".

## src/components/marketing/MarketingPaymentsAdmin.jsx  (3)
- [medium/bug] L387 **Coluna `f.state` não existe — UF nunca aparece na linha da franquia**
    FIX: Trocar `f.state` por `f.state_uf` (duas ocorrências na expressão: condição e interpolação).
- [medium/security] L165,L184 **Toasts de confirmar/recusar expõem `err.message` cru**
    FIX: Usar `toast.error(safeErrorMessage(err, "Erro ao confirmar pagamento"))` e `...("Erro ao recusar pagamento")` respectivamente.
- [low/bug] L339; src/components/marketing/MarketingPaymentSection.jsx:L216 **`parseISO` em colunas DATE/TIMESTAMPTZ sem horário fixo**
    FIX: Para `deposit_date`: `formatDateOnly(d.deposit_date)` de `@/lib/dateOnly`. Manter `parseISO` só em `created_at` (timestamptz).

## src/pages/Reports.jsx  (3)
- [medium/security] 102-103 **error.message cru exposto na UI (loadError)**
    FIX: `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e `setLoadError(safeErrorMessage(err, "Erro ao carregar dados"));`.
- [low/performance] 55-61 **Sale.list fetchAll sem janela máxima — depende só do período do filtro**
    FIX: Limitar o range custom (ex: máx 6-12 meses) na toolbar, ou migrar para RPC server-side aggregate por franquia (padrão get_franchise_report_data / get_franchise_ranking_monthly).
- [low/maintainability] 128-200 **Status de assinatura no relatorio nao distingue PENDING de OVERDUE corretamente em casos null**
    FIX: Considerar mapear `subscription_status === "ACTIVE"` sem payment status para um badge distinto (ex: "Ativa"), ou documentar a intenção. Baixa prioridade.

## src/components/vendedor/CatalogUpload.jsx  (3)
- [medium/security] 130 **error.message cru exposto em toast (desvio da house rule safeErrorMessage)**
    FIX: `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e usar `toast.error(safeErrorMessage(error, "Erro ao enviar imagem. Tente novamente."));` mantendo os branches específicos (timeout/404/403) antes do fallback.
- [medium/bug] 104-108 **Retry de upload nunca dispara em timeout (Promise.race rejeita, não resolve com error)**
    FIX: Envolver a primeira tentativa em try/catch local e reexecutar `doUpload()` no catch antes de propagar, ou trocar o timeout para `resolve({ error: new Error("timeout") })` para que o branch de retry o capture.
- [medium/security] L130 **error.message cru no fallback de erro de upload**
    FIX: `toast.error(safeErrorMessage(error, "Erro ao enviar imagem. Tente novamente."))`. Os ramos específicos (timeout/404/403) já são amigáveis e podem ficar.

## package.json  (3)
- [medium/dead-code] 48,67,53,61,58 **5 dependencias mortas (so usadas por componentes shadcn nunca importados)**
    FIX: Remover as 5 deps do package.json e apagar os componentes ui orfaos (command.jsx, drawer.jsx, input-otp.jsx, resizable.jsx, calendar.jsx, carousel.jsx). carousel.jsx tambem e orfao (nao tem dep externa propria mas e codigo morto).
- [medium/deprecated] 56 + components.json:20 **lucide-react retido apenas como dependencia transitiva de boilerplate shadcn**
    FIX: Manter lucide-react enquanto houver componentes ui ativos que o usam (dialog/select/sheet/etc), mas remove-lo so seria seguro apos limpar todos os ui orfaos. Acao imediata de baixo risco: nada no bundle final muda (tree-shaken por icone). Documentar que e dep so-de-shadcn; alternativamente trocar `iconLibrary` para evitar drift futuro de novos componentes.
- [low/deprecated] 49,58,62 **Majors atrasados: date-fns 3 (atual 4), react-router-dom 6 (atual 7), react-day-picker 8 (atual 9)**
    FIX: Nao migrar agora. Se for migrar date-fns 4, re-rodar src/lib/financialCalcs.test.mjs e validar todos os helpers de dateOnly.js (regras BRT sao frageis a mudanca de tz). react-day-picker so importa se algum dia usar calendar.jsx (hoje morto).

## src/hooks/useWhatsAppConnection.js  (2)
- [medium/convention] 114,134-137,158-161 **Toasts expoem error.message cru — viola house rule safeErrorMessage**
    FIX: Importar `safeErrorMessage` de `@/lib/safeErrorMessage` e usar `toast.error(safeErrorMessage(error, "Falha ao conectar. Tente novamente."))`. Aplicar tambem nos handlers de check status (mas la o texto e fixo, ok).
- [low/security] L114 **error.message cru no toast de falha de conexão WhatsApp**
    FIX: `toast.error(safeErrorMessage(error, "Falha ao conectar. Tente novamente."))`. Os `new Error("...")` lançados acima já têm mensagens PT-BR amigáveis; `safeErrorMessage` deve preservá-las e sanear o resto.

## src/entities/all.js  (2)
- [medium/bug] 30,69 **fetchAll sempre adiciona order('id') mesmo quando orderBy ja e 'id' — duplica ORDER BY**
    FIX: `if (!order || order.column !== 'id') query = query.order('id', { ascending: true });`
- [low/maintainability] 114-138 **search() ordena fixo por created_at — quebra em tabelas sem essa coluna**
    FIX: Tornar a coluna de ordenacao parametrizavel (`orderColumn = 'created_at'`) no options de search.

## src/pages/Financeiro.jsx  (2)
- [medium/performance] 101-144 **SaleItems refetch a cada navegação de mês (recarrega rede inteira por mês)**
    FIX: Cachear sale_items por mês (Map keyed por yyyy-MM) ou ampliar a janela de IDs para cobrir os meses já carregados e filtrar client-side, evitando ida ao banco a cada troca de mês.
- [medium/security] L93 **error.message cru em setLoadError (tela admin Financeiro)**
    FIX: `setLoadError(safeErrorMessage(error, "Erro ao carregar dados"))`. Já existe `safeErrorMessage` importado neste arquivo (consta na lista de adotantes) — verificar se está sendo usado e aplicar aqui.

## src/components/dashboard/MiniRevenueChart.jsx  (2)
- [medium/bug] L9 (sumNet — uso indireto via summaries) / RankingStreak.jsx:L21 **new Date(s.date) sobre coluna DATE causa offset BRT -1 dia**
    FIX: Importar parseDateOnly de @/lib/dateOnly e trocar `new Date(s.date)` por `parseDateOnly(s.date)` no dailyGoal (FranchiseeDashboard) e no sort do streak (RankingStreak). Em FranchiseeDashboard comparar contra strings yyyy-MM-dd em vez de objetos Date.
- [low/convention] L95 **useMemo declara deps summaries/franchiseId mas não os usa no cálculo**
    FIX: Remover `summaries` e `franchiseId` das deps (e das props, se não usadas em nenhum lugar do componente).

## src/components/shared/SubscriptionPaywall.jsx  (2)
- [medium/bug] 27 **parseISO em coluna DATE — risco de offset de timezone no vencimento**
    FIX: `import { formatDateOnly } from "@/lib/dateOnly"` e `formatDateOnly(current_payment_due_date)`.
- [medium/bug] 25 / SubscriptionPaymentSheet.jsx:22 **current_payment_value pode vir string — `|| 150` / `?? 150` nao cobre "0"/"" e formatBRL recebe string**
    FIX: `const value = parseFloat(current_payment_value) || 150;` em ambos, e `formatBRL(value)`. Cobre string e null/undefined de forma consistente.

## src/components/onboarding/OnboardingBlock.jsx  (2)
- [medium/security] 16-27 ; GateBlock.jsx:17-28 **href de links externos/internos sem safeHref**
    FIX: Envolver com `href={safeHref(link.url)}` de `@/lib/safeHref` em ambos os componentes.
- [low/dead-code] 301-307 **<style> com seletor [data-block-id] sem elemento correspondente (no-op)**
    FIX: Remover o bloco `<style>` (ou aplicar `data-block-id` no Card se o tint for desejado).

## src/components/financeiro/FinanceiroKpiCards.jsx  (1)
- [medium/bug] 22-27 **"Margem Media" agregada pode renderizar NaN%**
    FIX: `const margem = Number(aggregated?.margem) || 0;` e usar `margem.toFixed(1)`. Idem para `aggregated.lucro`/`aggregated.totalRecebido` via `Number(...) || 0`.

## src/components/dashboard/FinancialObligationsCard.jsx  (1)
- [medium/bug] 53-54 **isPaidStatus checa status crus ASAAS contra valor já normalizado para PAID**
    FIX: Confiar no estado normalizado: `subStatus === "PAID"` apenas; ou, se realmente houver risco de cru, incluir também `"RECEIVED_IN_CASH"`. Padronizar com `isPaidStatus` usado em outros pontos.

## src/pages/Vendas.jsx  (1)
- [medium/convention] 150-157 **Loading usa spinner em vez de Skeleton (HOUSE RULE)**
    FIX: Substituir pelo bloco `<Skeleton>` no mesmo padrão de Gestao.jsx:183-194.

## src/components/marketing/MetaDepositDialog.jsx  (1)
- [medium/security] L48 **Toast expõe `err.message` cru**
    FIX: `import { safeErrorMessage } from "@/lib/safeErrorMessage";` e `toast.error(safeErrorMessage(err, "Não foi possível registrar o depósito."));`

## src/components/onboarding/FiscalDataGate.jsx  (1)
- [medium/security] 77 **Toast expõe err.message cru**
    FIX: Usar `safeErrorMessage(err, "Erro ao salvar. Tente novamente.")`.

## src/pages/Acompanhamento.jsx  (1)
- [medium/security] L135-L136 **error.message cru em setLoadError + toast (sem safeErrorMessage)**
    FIX: Importar `safeErrorMessage` de `@/lib/safeErrorMessage` e usar `safeErrorMessage(error, "Erro ao carregar dados de acompanhamento")` em ambos. Já é convenção adotada em 10 outros arquivos.

## src/lib/franchiseUtils.js  (4)
- [low/bug] 45-52,61-63 **PAYMENT_METHODS desalinhado dos 6 metodos canonicos do projeto (NFC/Outro/card_fee)**
    FIX: Confirmar contra os valores reais persistidos em `sales.payment_method`. Se o banco usa "other", adicionar `{ value: "other", label: "Outro" }` para o label nao vazar valor cru. (Verificar antes de mudar — pode ser intencional.)
- [low/dead-code] L78-L82 **BOT_PERSONALITIES export morto (feature "Personalidade bot UI" removida)**
    FIX: Remover a constante.
- [low/dead-code] L35-L40 **findFranchise export nunca usado**
    FIX: Remover a função (ou usá-la onde hoje se faz `.find(f => f.id === ... || f.evolution_instance_id === ...)` inline).
- [low/dead-code] L55 **LEGACY_PAYMENT_MAP export nunca usado**
    FIX: Remover se a migração de `card_machine` já foi concluída; senão ligar ao código que normaliza métodos legados.

## src/components/marketing/MarketingPaymentSection.jsx  (3)
- [low/bug] L153-L162 **Texto da notificação usa `monthLabel`/`editMode` stale após resets**
    FIX: Mover a montagem do payload de notificação para antes dos resets de estado, ou capturar `const wasEdit = editMode;` no topo do try para clareza.
- [low/bug] L307; src/components/marketing/MetaDepositDialog.jsx:L112 **Botão submit habilitado com `!amount` mas não valida `< MIN/<=0` no disabled**
    FIX: Opcional — refletir a regra no disabled (`parseFloat(amount) < MIN_AMOUNT`) para feedback imediato, mantendo o toast como guarda.
- [low/ux] L175 **`return null` enquanto loading esconde o card inteiro sem placeholder**
    FIX: Manter `return null` só para `!evoId`; durante `loading`, renderizar um `<Skeleton className="h-32 rounded-2xl mb-4" />`.

## src/lib/utils.js  (2)
- [low/performance] 9 **isIframe avaliado no top-level do modulo — pode lancar em sandbox cross-origin**
    FIX: Envolver em try/catch ou transformar em funcao lazy: `export const isIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();`
- [low/dead-code] L9 **isIframe export nunca usado**
    FIX: Remover a constante.

## src/lib/shareUtils.js  (2)
- [low/dead-code] 81-109 **printImage() exportada mas não consumida**
    FIX: Remover `printImage` (e o comentário que a referencia em printReceipt:137) se confirmado sem uso, ou documentar por que mantida.
- [low/dead-code] L81 **printImage() export nunca usado (substituído por print de texto crisp)**
    FIX: Remover `printImage`.

## src/components/minha-loja/TabEstoque.jsx  (2)
- [low/dead-code] 70-77,1-2 **Props/imports não consumidos em TabEstoque**
    FIX: Remover `franchises` da assinatura (e do call-site em Gestao.jsx:276) e remover `suggestionsRef` se não houver uso planejado.
- [low/bug] 435-488 **Export CSV de estoque não usa formatBRL e mistura padrões**
    FIX: Formatar valores monetários com `.toFixed(2).replace(".", ",")` (como salesExport.formatMoney) para consistência e leitura correta no Excel pt-BR.

## src/components/dashboard/FranchiseeDashboard.jsx  (2)
- [low/performance] L260 **todayRevenue recalculado a cada render (fora de useMemo)**
    FIX: `const todayRevenue = useMemo(() => calcRevenue(todaySales), [todaySales, calcRevenue]);`
- [low/maintainability] L61-L62,L91-L92 **getToday/getYesterday definidos e chamados mas resultados não usados**
    FIX: Remover as duas atribuições e os helpers getToday/getYesterday (a query [3] checklist usa `today` em L106 — verificar: sim, usa `today`). Manter `today` para o checklist; remover apenas `yesterday` e getYesterday se de fato não usado.

## src/components/acompanhamento/FranchiseNotes.jsx  (2)
- [low/bug] L19, L76-L79 **Notas exibidas sem sort explicito + Date() em created_at presumido string**
    FIX: `const sorted = [...notes].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); const displayNotes = showAll ? sorted : sorted.slice(0,10);`
- [low/convention] L35 **Toast com err.message cru**
    FIX: `import { safeErrorMessage } from "@/lib/safeErrorMessage"; toast.error(safeErrorMessage(err, "Erro ao salvar anotação"));` Mesmo padrao aplica a Acompanhamento.jsx:L107/L136 e BotIntelligence.jsx:L280 (loadError = e.message).

## src/components/whatsapp/WhatsAppConnectionModal.jsx  (2)
- [low/convention] 101 **console.error esquecido em handler de erro de QR**
    FIX: Remover o console.error ou logar so a mensagem sem o `qrCode`. Baixa prioridade (stripado em prod).
- [low/dead-code] 46-49 **handleCloseAndCheck e wrapper morto que so chama onClose**
    FIX: Usar `onClick={onClose}` direto no botao Fechar e remover o wrapper.

## src/hooks/useVisibilityPolling.js  (1)
- [low/bug] 27-32 **startPolling captura intervalMs no setInterval mas mudanca de intervalMs nao reinicia o timer existente**
    FIX: Em startPolling, fazer `stopPolling()` antes de criar o novo interval em vez do early-return, garantindo que mudancas de intervalMs sempre tomem efeito.

## src/lib/query-client.js  (1)
- [low/performance] 4-11 **QueryClient sem staleTime/gcTime padrao — defaults agressivos de refetch**
    FIX: Adicionar `staleTime: 30_000` (ou valor adequado) como default; telas que precisam de tempo real continuam usando `useVisibilityPolling`/staleTime proprio.

## src/components/dashboard/FinanceiroSummaryCard.jsx  (1)
- [low/convention] 13 **Filtro de mês por string startsWith em sale_date (frágil, mas DATE ok)**
    FIX: Usar `isInMonth(s.sale_date, new Date())` de `@/lib/financialCalcs` para uniformidade (já trata null e substring).

## src/lib/financialCalcs.js  (1)
- [low/maintainability] 32-33 **calculatePnL recalcula vendas/frete/desconto inline em vez de getSaleNetValue**
    FIX: Manter os subtotais (necessários para o breakdown), mas adicionar teste/asserção de que `totalRecebido === sum(getSaleNetValue(s))` em financialCalcs.test.mjs para travar a invariante.

## src/components/dashboard/LastPurchaseOrderCard.jsx  (1)
- [low/convention] L33-L67 **ordered_at (TIMESTAMPTZ) usa new Date() — OK, mas comparação string em loop é por ordenação lexical**
    FIX: Comparar por `new Date(po.ordered_at) > new Date(lastOrder.ordered_at)` para robustez contra formatos de offset variáveis. Baixo risco se o backend padroniza UTC.

## src/lib/healthScore.js  (1)
- [low/bug] L27-L83 **calcSalesScore/calcOrdersScore constroem Date de string yyyy-mm-dd (off-by-1 BRT)**
    FIX: Usar `parseDateOnly(mostRecentDate)` de lib/dateOnly.js para sale_date e para o `today`. Consumido por Acompanhamento.jsx, então o erro é live (não morto como FranchiseHealthScore).

## src/components/dashboard/PriorityAction.jsx  (1)
- [low/dead-code] L107 / src/components/dashboard/RankingStreak.jsx:L52 **Props recebidas mas não passadas / cenários inalcançáveis**
    FIX: Ou alimentar healthResult/coachActions, ou remover os cenários estoque/frete/reposicao de SCENARIOS para evitar lógica morta confusa. Confirmar o shape de getFranchiseRanking (.position vs rank_position) — RankingStreak:31 lê `ranking?.position`.

## src/components/dashboard/SmartActions.jsx  (1)
- [low/bug] L29 **Contact.update sem remover campos read-only e payload incompleto vs guard de 7d**
    FIX: Confirmar com produto se "responder" deve suprimir 7d como as demais; se sim, alinhar o guard para >=7. Caso o 1d seja intencional (bot/lead novo), documentar a exceção no CLAUDE.md para não parecer regressão.

## src/components/dashboard/DailyRevenueChart.jsx  (1)
- [low/ux] L1-L63 **DailyRevenueChart aparenta ser código morto (não importado pelo dashboard)**
    FIX: Grep por "DailyRevenueChart"; se órfão, remover. Se usado em admin, ok manter.

## src/components/dashboard/FranchiseeGreeting.jsx  (1)
- [low/maintainability] L10-L12 **initials computado mas nunca renderizado**
    FIX: Remover a variável `initials` ou usá-la num avatar.

## src/components/acompanhamento/InventorySheet.jsx  (1)
- [low/convention] L21-L23, L28-L31 **`item.quantity || 0` e formatCurrency inline em vez dos helpers**
    FIX: `parseFloat(item.quantity) || 0`, `parseFloat(item.min_stock) || 0`; trocar formatCurrency por `formatBRL` de `@/lib/formatBRL`.

## src/lib/saveFiscalData.js  (1)
- [low/maintainability] 45-52 **configPatch silenciosamente descartado se config nao existir**
    FIX: Se `!configs[0]`, logar warn/lancar (ou retry) em vez de silenciar — pelo menos `console.warn`. Idealmente o caller (create) deve aguardar config existir antes de gravar cep/rua, ou usar upsert.

## src/components/checklist/CHECKLIST_DETAILS.jsx  (1)
- [low/maintainability] 57,65,91 (e outros) **Etiquetas no CHECKLIST_DETAILS divergem das 5 etiquetas oficiais do onboarding**
    FIX: Padronizar o vocabulário de etiquetas em um único lugar e referenciar nas duas fontes de texto.

## src/components/checklist/ChecklistHistory.jsx  (1)
- [low/bug] 14-21 **Cálculo de streak limitado a 7 dias mas exibe badges 30 dias (impossível atingir)**
    FIX: Ou remover o badge de 30 dias, ou calcular streak real no servidor (RPC contando dias consecutivos com 100%).

## src/components/checklist/ChecklistItem.jsx  (1)
- [low/convention] 14-17 **navigator.clipboard.writeText sem tratamento de rejeição/fallback**
    FIX: `navigator.clipboard.writeText(details.script).then(() => setCopied(true)).catch(() => toast.error("Não foi possível copiar."))`.

## src/pages/OnboardingWelcome.jsx  (1)
- [low/maintainability] 146-158 **handleComplete usa try/catch desnecessário e isCompleting fica true após navigate**
    FIX: Simplificar: marcar localStorage e navegar sem try/catch artificial; remover `setIsCompleting(false)` pós-navigate ou colocá-lo antes do navigate.

## src/lib/formatBRL.js  (1)
- [low/dead-code] 14-19 / src/lib/formatters.js:36-40 **formatBRL/formatBRLCompact duplicados em dois arquivos com comportamento divergente**
    FIX: Consolidar em um único módulo (`lib/formatters.js`) e re-exportar de `formatBRL.js`, ou migrar imports. Garantir `Number(value)||0` em ambos.

## src/lib/whatsappUtils.js  (1)
- [low/bug] 18-22 **normalizePhone retorna digitos nao-padrao em vez de canonico — pode gravar lixo**
    FIX: Retornar `null` quando `local.length` não for 10 nem 11 (ou validar antes de persistir em MyContacts handleCreate/handleSave).

## src/components/shared/FranchiseSelector.jsx  (1)
- [low/convention] 38-49 **<select>/<option> nativo em vez de shadcn Select (desvio de padrao UI)**
    FIX: Migrar para o `Select` de `@/components/ui/select` para consistência visual/a11y (baixa prioridade).

## src/components/vendedor/WizardFields.jsx  (1)
- [low/bug] 30 **RadioCards recebe prop disabledValues mas declara disabled — third_party não desabilita método**
    FIX: Remover a prop `disabled` não usada de RadioCards, ou padronizar para `disabledValues` igual a PaymentChipsMulti.

## src/components/vendedor/DeliveryScheduleEditor.jsx  (1)
- [low/bug] 51-53 **Default range só aparece visualmente mas não é persistido (campo pode salvar vazio)**
    FIX: Em FranchiseSettings, ao entrar no Step 3 com `delivery_schedule` vazio, inicializar com o default e disparar o mesmo onChange de derivação; ou no editor, `useEffect` para emitir o default uma vez quando `value` chega vazio.

## src/components/vendedor/OperatingHoursEditor.jsx  (1)
- [low/bug] 52-55 **.sort() muta range.days em place (efeito colateral no estado)**
    FIX: Clonar antes de ordenar: `[...r.days].sort(...)`.

## src/components/vendedor/ReviewSummary.jsx  (1)
- [low/maintainability] 165 + src/pages/FranchiseSettings.jsx:1043 **ReviewSummary exibe opening_hours como "Funcionamento" mas pode estar dessincronizado**
    FIX: Derivar o texto de funcionamento on-the-fly a partir de `formData.delivery_schedule` no ReviewSummary (reusar `generateLabel`+formatação), em vez de depender do campo espelho `opening_hours`.

## src/pages/Tutoriais.jsx  (1)
- [low/performance] 176,288 **localStorage lido no render de cada VideoCard e no body do componente**
    FIX: Ler o conjunto de "watched" uma vez em `useState`/`useEffect` no pai e passar como prop; atualizar via setState em `handleVideoClick` para refletir o check verde sem reload.

## src/components/dashboard/MarketingPaymentCard.jsx  (1)
- [low/dead-code] L1-L110 **MarketingPaymentCard sem nenhum import (substituído por FinancialObligationsCard)**
    FIX: Remover o arquivo.

## src/components/dashboard/QuickAccessCards.jsx  (1)
- [low/dead-code] L1-L68 **QuickAccessCards sem nenhum import**
    FIX: Remover o arquivo (manter o padrão CSS documentado se útil).

## src/components/UserNotRegisteredError.jsx  (1)
- [low/dead-code] L1-L30 **UserNotRegisteredError sem nenhum import**
    FIX: Remover o arquivo, ou ligá-lo ao AuthContext se a UI de "usuário não registrado" ainda for desejada.

## src/entities/all.js.pre-pagination-fix-2026-05-20.bak  (1)
- [low/dead-code]  **Arquivo de backup versionado dentro de src/**
    FIX: Apagar o `.bak` (o histórico do git já preserva a versão anterior). Se quiser guardar, mover para fora de `src/`.

## src/lib/app-params.js  (1)
- [low/dead-code] L1-L7 **Módulo app-params.js inteiro morto (appParams nunca importado)**
    FIX: Remover o arquivo `app-params.js`.

## src/lib/smartActions.js  (1)
- [low/maintainability] L124 **export desnecessário de ACTION_RULES (uso só interno)**
    FIX: Remover o `export` (manter a const interna). Baixíssima prioridade.

## src/lib/stockSuggestion.js  (1)
- [low/maintainability] L3-L4 **LOOKBACK_DAYS / WEEKS_OF_COVERAGE exportados mas só usados internamente**
    FIX: Manter como estão (são tuning conhecido) ou remover `export`. Não-bloqueante.

## src/lib/expenseCategories.js  (1)
- [low/maintainability] L18 **CATEGORY_BY_VALUE exportado mas só usado internamente**
    FIX: Remover o `export` (opcional, baixa prioridade).

## eslint.config.js  (1)
- [low/maintainability] 9-14 **Lint ignora src/lib e src/api — pontos cegos onde vivem bugs reais**
    FIX: Adicionar um segundo bloco de config (ou estender `files`) cobrindo `src/lib/**` e `src/api/**` com pelo menos `unused-imports/no-unused-imports` + `no-unused-vars` (sem regras react/jsx que nao se aplicam). UI pode permanecer ignorado por ser boilerplate.

## vite.config.js  (1)
- [low/maintainability] 23-31 **manualChunks lista deps mortas no chunk 'export'**
    FIX: Opcional — remover o chunk 'export' manual e deixar o Rollup fatiar pelos dynamic imports (ExportButtons / pickingSheetPdf / shareUtils ja sao lazy). Mantem-se o ganho de nao baixar jspdf/xlsx ate o usuario clicar exportar.

## src/components/onboarding/GateBlock.jsx  (1)
- [low/convention] L19 / src/components/onboarding/OnboardingBlock.jsx:L18 **href={link.url} sem safeHref em links de onboarding**
    FIX: Envolver com `safeHref(link.url)` em ambos os componentes, alinhando ao padrão de `MarketingPaymentSection`/`SubscriptionPaywall`. `rel="noopener noreferrer"` já está presente (bom).

