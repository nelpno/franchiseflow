<!-- Last Updated: 2026-04-30 -->
# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Este arquivo contém APENAS especificidades do dashboard.

## Stack & Deploy
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud + @tanstack/react-query 5
- Stack Portainer ID 39 | Service ID `2zb27nndn5sg8zweyie6wscpc`
- GitHub: `nelpno/franchiseflow.git`
- Deploy: `git push` → force update serviço Docker (incrementar ForceUpdate no TaskTemplate). Stack update sozinho NÃO recria container
- 502 por ~2min durante rebuild é normal. ctx_execute com JS para HTTP Portainer (NÃO shell+jq)
- `npm run build` pode completar sem output visível (Windows). Verificar timestamp de `dist/index.html`
- Vite build VPS: `NODE_OPTIONS=--max-old-space-size=4096`
- Vite prod: `console.log`/`debugger` stripados (`esbuild.drop`). Manual chunks: recharts, export (jspdf/xlsx), vendor, ui, supabase, dates. CSS via lightningcss
- Deps notáveis não-óbvias: `@hello-pangea/dnd` (drag-drop), `html2canvas` + `jspdf` (export PDF), `xlsx` (export Excel)

## Gotchas Críticos

### Auth (AuthContext.jsx)
- Race conditions: `lastAuthUserRef` + `lastSignedInTimeRef` + safety timeouts (8s init, 10s login). NÃO há mutex
- `onAuthStateChange('SIGNED_IN')`: setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s). NUNCA `getSession()` dentro do handler
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso
- Detecção convite: `user_metadata.password_set` (PKCE não passa `type=invite`)
- NUNCA `window.location.href` após signIn — `onAuthStateChange` cuida do redirect
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (8s timeout)

### Supabase & Schema
- API: importar de `@/entities/all` — NUNCA `supabase.from()` direto. Timeouts: leitura 15s, escrita 30s. Exceção: batch queries com `.in()` (entity adapter não suporta)
- `Entity.delete()` usa `.select('id')` — detecta RLS silencioso (0 rows = throw "Sem permissão"). Nunca remover o `.select('id')` do delete
- `getStandardProductCatalog()` RPC (SECURITY DEFINER): retorna 28 produtos padrão cross-franchise para autocomplete no TabEstoque. Catálogo: grafia "Mussarela" (NÃO "Muçarela"), formato "Rondelli X - 700g Rolo"
- `marketing_files`: NÃO usa entity adapter (trava) — `fetch()` direto à REST API com `AbortSignal.timeout(15s)`
- Campos numéricos podem vir string — SEMPRE `parseFloat(s.value) || 0`, NUNCA `s.value || 0`
- `buildConfigMap()` retorna objetos — acessar `.franchise_name`, nunca renderizar direto
- Antes de `Entity.update()`, remover campos read-only (`id`, `created_at`, `updated_at`, `franchise`, `whatsapp_status`)
- Storage buckets: `marketing-assets` (público), `marketing-comprovantes` (público, 5MB, JPG/PNG/PDF), `catalog-images/produtos/` (público)
- **Pre-flight OBRIGATÓRIO antes de `columns` enxuto**: rodar `SELECT column_name FROM information_schema.columns WHERE table_name='X'` e validar TODA coluna listada. Hotfix 9e24482 (29/04/2026) teve 4 colunas inventadas (`contact_phone`, `customer_name`, `franchise_notes.content`, `inventory_items.hidden_at`) que retornaram 400 e quebraram telas (MyContacts/Acompanhamento/Gestao)
- **Validação de columns enxuto vai além de `information_schema.columns`**: listar consumidores transitivos (props passadas pra children que agrupam/agregam). Defesa runtime via `console.warn` dev-only no helper centralizado é o que de fato previne — ex: `weeklyTurnoverMap` em [src/lib/stockSuggestion.js](src/lib/stockSuggestion.js) detecta `inventory_item_id` faltando, preveniria a regressão `7955000` de 29/04
- **Entity adapter `Sale.list/Contact.list/etc` IGNORA chave `filter:`** — só honra `{columns, signal, fetchAll, gte, lte}`. String PostgREST (ex: `filter: "sale_date=gte.X"`) é silenciosamente descartada. Bug Reports.jsx corrigido em 5ad5166 (29/04). Padrão correto: `gte: { sale_date: cutoff }, lte: { sale_date: end }`

**Nomes de colunas que diferem do esperado:**
- `inventory_items.quantity` (NÃO current_stock), `.product_name` (NÃO name)
- `sale_items.unit_price` (NÃO sale_price — `sale_price` existe em inventory_items)
- `notifications.read` (NÃO is_read)
- `franchise_configurations.franchise_name` (NÃO store_name)
- `personal_phone_for_summary`: 11 dígitos puros (view adiciona 55). Normalizar `.replace(/\D/g, '')`
- `purchase_order_items` FK: `order_id` (NÃO purchase_order_id)
- `contacts.telefone` nullable — unique parcial. Enviar `null` (NÃO string vazia)
- `operating_hours` JSONB NÃO existe — wizard usa `opening_hours` TEXT + `working_days` TEXT
- `payment_delivery`/`payment_pickup` são TEXT[], NÃO JSONB
- `unit_address` é computado no save (NÃO editar direto)
- `onboarding_checklists` NÃO tem total_items, started_at, user_id. TEM `approved_at` (timestamptz) e `approved_by` (text)
- `franchises.billing_email` (desde 17/04/2026): fonte primária de email para ASAAS + NFe. Fallback legacy: `franchise_invites.email` (edge function tenta se `billing_email IS NULL`). CHECK `billing_email_format` valida regex. NÃO há `owner_email`

**RLS específico:**
- `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 policies dependem)
- `franchises_update` policy (fix 17/04/2026): `is_admin_or_manager() OR evolution_instance_id = ANY (managed_franchise_ids())` — franqueado edita dados fiscais da própria franquia via gate onboarding. Antes era só admin/manager
- profiles SELECT: `is_admin_or_manager() OR id = (select auth.uid())` — NUNCA `is_admin()` sozinha (recursão infinita)
- Tabelas novas: DELETE policy com `is_admin()` obrigatória (sem ela, delete retorna sucesso mas 0 rows)
- `sale_items` RLS: subquery `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
- `activity_log` NÃO existe no banco (referenciada em schema.sql mas nunca criada)
- Policies `notifications` e `audit_logs`: criadas via Dashboard (NÃO estão em SQL files). Consultar `pg_policies` antes de alterar
- `get_unprocessed_conversations(integer)`: RPC existe no banco mas NÃO nos SQL files
- `get_franchise_ranking(date, franchise_id)` RPC: soma TEMPO REAL de `sales` (NÃO `daily_summaries`). `total_franchises` = só franquias com venda na data (não total ativas). Usada apenas por FranchiseeDashboard — admin tem ranking client-side próprio em `FranchiseRanking.jsx`. Fix 16/04: antes lia `daily_summaries` que é populado só pelo cron 02h
- `aggregate_daily_data()` cron: roda `0 5 * * *` UTC (02h BRT) com default `target_date = ontem`. **NUNCA** popula `daily_summaries.date = hoje`. Qualquer query/RPC que dependa de `daily_summaries` para o dia atual retorna vazio até 02h BRT do dia seguinte

**Normalização de telefone (fix 16/04/2026):**
- `contacts.telefone`, `bot_conversations.contact_phone`, `conversation_messages.contact_phone`: SEMPRE canônicos (só dígitos, sem DDI 55). Triggers `BEFORE INSERT OR UPDATE OF <coluna>` garantem. Invariante: `telefone = public.normalize_phone_br(telefone)` sempre
- Helper banco: `public.normalize_phone_br(text)` (IMMUTABLE, PARALLEL SAFE) — reusado por RPCs e triggers. Remove não-dígitos e tira DDI 55 quando `length >= 12`
- RPCs normalizadas: `upsert_bot_contact`, `get_customer_intelligence`, `get_contact_by_phone`, `log_conversation_message`, `get_abandoned_for_followup`
- Frontend canônico: [normalizePhone()](src/lib/whatsappUtils.js) — usar antes de qualquer `Contact.create`/`update`/`filter`/`search` que envolva telefone
- Auditoria: `supabase/queries/audit-contact-phone-duplicates.sql` — esperado 0 linhas
- Fix 16/04/2026: desduplicados 37 pares (164 com DDI 55 → 0), removido `idx_contacts_franchise_telefone` (redundante com UNIQUE partial) e coluna morta `contacts.tags`
- `MyContacts.jsx:168`: usa `fetchAll: true` em vez de limit hardcoded (clientes antigos ficavam fora da lista quando franquia passava de 200 contatos — fix 16/04)
- Merge de duplicados em tabela com UNIQUE: DELETE do row DROP **antes** do UPDATE do KEEP (senão UPDATE bate na UNIQUE com o DROP ainda existente). Ex: `supabase/scripts/dedup-contacts-by-phone.mjs`
- Scripts de manutenção em `supabase/scripts/*.mjs`: padrão `--dry-run` default (relatório + backup JSON em `backups/`) / `--apply` / flag extra para casos que exigem revisão humana. TX por item, não TX gigante — resiliência em falha parcial

**Database Linter Compliance (fix 15/04/2026):**
- Funções SECURITY DEFINER: SEMPRE incluir `SET search_path = 'public'`
- RLS policies com `auth.uid()`: SEMPRE usar `(select auth.uid())` (initplan perf)
- NUNCA criar policy `FOR ALL` + policies específicas na mesma tabela (overlap = multiple_permissive)
- NUNCA criar policy `USING(true)` para role padrão — service_role já bypassa RLS
- Storage buckets públicos: leitura via URL pública funciona sem SELECT policy, MAS `upsert: true` da Storage API REQUER SELECT em `storage.objects` para verificar existência (sem ela: 403 row-level security em substituição). Manter SELECT policy em buckets onde franqueado/admin faz upload (catalog-images, marketing-comprovantes). Fix 16/04/2026: linter sugeriu dropar; reaplicado
- Storage buckets onde admin precisa **apagar** arquivo (não só ler/escrever): policy `FOR DELETE USING (bucket_id='X' AND (SELECT public.is_admin_or_manager()))`. Sem ela, `supabase.storage.from(b).remove([])` falha silenciosamente — arquivo órfão. Aplicado em `marketing-comprovantes` (30/04/2026) quando admin ganhou cancelamento de pagamento
- Debug 403 em upload Supabase Storage: checar `pg_policies WHERE schemaname='storage' AND tablename='objects'` ANTES de investigar código React/auth (root cause é quase sempre policy faltando ou mudada)
- FKs novas: SEMPRE criar índice correspondente (`CREATE INDEX IF NOT EXISTS`)
- Extensões: usar schema `extensions` (NÃO `public`)

**Security helpers (usar em código novo):**
- Toast errors: NUNCA `error.message` ou `error.details` direto — usar `safeErrorMessage(error, "fallback")` de `@/lib/safeErrorMessage`
- CSV export: SEMPRE `sanitizeCSVCell()` em campos de texto — previne formula injection no Excel (`@/lib/csvSanitize`)
- href dinâmico: `safeHref(url)` rejeita `javascript:` e protocolos perigosos (`@/lib/safeHref`)

### Frontend Patterns
- `mountedRef` + cleanup obrigatório. `setIsLoading(false)` antes de early return
- `ExportButtons` (shared/): retorna `null` se `data` vazio (sem disable manual). NÃO sanitiza — chamador deve pré-sanitizar com `sanitizeCSVCell`. Sem prop `summaryRow` — para linha de totais, append no array antes de passar
- `TabResultado` aceita prop `contacts` (default `[]`) para resolver nome do cliente no export. Gestao.jsx carrega via `Contact.filter({ franchise_id })` no mesmo padrão de Vendas.jsx
- Listas Supabase: SEMPRE sort explícito no frontend (ordem muda após updates)
- Inline edit mobile: `onClick={e => e.stopPropagation()}` + `inputMode="numeric"`. `active:` (NÃO `hover:`)
- Queries: tabelas que crescem (Sale, Expense, DailySummary, ConversationMessage) DEVEM usar `fetchAll: true` (pagina internamente de 1000 em 1000). Tabelas pequenas/fixas podem usar `limit` numérico
- AdminDashboard: 10 queries paralelas `Promise.allSettled` — maioria com `fetchAll: true`. Auto-retry na query de franquias
- AdminDashboard layout order: Stats → Mini-cards (Bot+Financeiro) → Ranking → Gráfico → Alertas (colapsado) → Health Score (colapsado). `CollapsibleSection` local usa Radix Collapsible
- BotSummaryCard: SEMPRE filtrar `startOfMonth` (mês atual). Após refactor d1828d3, consome `botSummary` aggregates (per-franchise per-day) do RPC `get_bot_conversation_summary` em vez do array bruto de conversas
- **`fetchAll: true` em tabela > 5k rows = pagination serial × 1000 × ~700ms**. `bot_conversations` (28k) = ~20s. Solução real: RPC server-side aggregate (commit d1828d3 — `get_bot_conversation_summary` cortou cold-load 22.7s → 8.5s)
- **TIMESTAMPTZ em filtro `gte`/`lte`** precisa formato `${cutoff}T00:00:00.000Z` (boundary issue ~3h offset BRT). Colunas DATE aceitam só `YYYY-MM-DD`
- **`limit N` em queries 1-row-por-franquia** vira teto silencioso quando rede crescer > N. Trocar por `fetchAll: true` para tabelas pequenas (Onboarding, FranchiseConfiguration etc)
- **Padrão lazy-load Wave 2** (commit 7983f77): `CollapsibleSection({onFirstExpand})` idempotente via `useRef(defaultOpen)` + `lazyAbortRef` (separado do `abortControllerRef`) + `lazyFetchingRef` síncrono + polling refresh `loadCollapsedDataRef.current?.({force: true})` se `hasFetchedCollapsedRef.current`. Implementado em `AdminDashboard.jsx`
- **Throttle 60s em `useVisibilityPolling`** (commit 5ad5166): previne burst ao voltar à aba. `lastRunRef = useRef(Date.now())` evita re-fire imediato após cold-load
- **`fetchAll: true` em tela com `useVisibilityPolling`**: cada refresh refaz a query inteira. Janela tight obrigatória (`gte: { col: subMonths(today, N) }` com N=3-6). Sem isso, polling 5min × 12 meses × franquia top → banda explode. Padrão Vendas.jsx (01/05): 6 meses + fetchAll, polling 5min compartilha mesma query
- Loading: `<Skeleton>` shadcn (NÃO spinner). PageFallback relativo (NUNCA `fixed inset-0`)
- NUNCA `new Date().toISOString().split("T")[0]` — usar `format(new Date(), "yyyy-MM-dd")`
- **`format(date, "MMM/yyyy", { locale: ptBR })`** retorna `"mai./2026"` (com ponto, minúsculo) — limpar com `.replace(".", "")` + capitalize primeira letra pra "Mai/2026". Helper `formatMonthLabel(offset)` em [TabLancar.jsx](src/components/minha-loja/TabLancar.jsx)
- **Postgres DATE (sem hora)**: SEMPRE usar `formatDateOnly(value)` ou `parseDateOnly(value)` de [src/lib/dateOnly.js](src/lib/dateOnly.js). `new Date("2026-04-30")` interpreta como UTC midnight → em BRT (UTC-3) volta 1 dia → mostra 29/04. Aplicado a `purchase_orders.estimated_delivery`, `sales.sale_date`, `expenses.expense_date`, `marketing_payments.reference_month`. Exceção: TIMESTAMPTZ (`ordered_at`, `delivered_at`, `created_at`) usa `new Date()` normal
- `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval
- Error handling: `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout
- Rotas: `createPageUrl("PageName")` → `"/PageName"` (capitalizado)
- Navegação programática: `useNavigate()` + `useSearchParams()` de `react-router-dom`. Query params para pré-seleção (ex: `/Onboarding?franchise=evo_id`)
- Abrir detail sheet por URL: `/Franchises?id=<evolution_instance_id>&openSheet=1` → `useSearchParams` + `useEffect` em `Franchises.jsx` abre sheet da franquia match e limpa params com `setSearchParams({}, {replace:true})`. Padrão usado pela tabela de `Reports.jsx`
- Toast: sonner (importar de `"sonner"`, NÃO shadcn legado). NUNCA alert()/window.confirm()
- Clickable card pattern: `cursor-pointer hover:shadow-md active:scale-[0.98] transition-all` (QuickAccessCards.jsx)
- Clickable text pattern: `cursor-pointer hover:underline hover:text-[#b91c1c] transition-colors`
- Cards navegáveis: usar `Link` condicional (não `onClick+navigate`) para a11y (Tab+Enter, right-click). Ex: StatsCard `href` prop
- TabEstoque inline edit: NUNCA onClick na `<TableRow>` (conflita com handleCellClick em quantity/min_stock/sale_price). Apenas `product_name` clicável
- TabEstoque card view (mobile): DEVE ter 3 botões (edit, ocultar, delete) — manter paridade com table view (desktop)
- TabEstoque adicionar produto: autocomplete mostra produtos padrão da rede (RPC `get_standard_product_catalog`). Seleção preenche campos e marca `created_by_franchisee: false`
- Dialog/Sheet Radix: dead clicks no overlay são comportamento normal (close on outside click). NÃO tentar "fixar"
- **DialogContent/AlertDialogContent (shadcn)** têm `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)] sm:max-w-lg overflow-x-hidden` aplicados em [src/components/ui/dialog.jsx](src/components/ui/dialog.jsx) + [alert-dialog.jsx](src/components/ui/alert-dialog.jsx) — **NÃO REMOVER**. Sem essas classes, `display:grid` + filho com `min-content > max-width` (button whitespace-nowrap, fonte custom mais larga) faz o grid track ignorar `max-width` e extrapolar viewport mobile (bug reproduzido em iPhone 14 Pro Max 430px, 29/04/2026)
- **Override de `max-w-*` em DialogContent shadcn**: `tailwind-merge` v3 NÃO trata `max-w-2xl` (sem prefixo) como conflito de `sm:max-w-lg` (com prefixo) — aplicam em breakpoints diferentes e o default vence em ≥sm. Para alargar dialog no desktop usar **`sm:max-w-2xl`** (com prefixo). Sintoma: dialog "parece" 672px no source mas renderiza 512px. Bug encontrado em TabLancar.jsx:922 e PurchaseOrders.jsx:1043 (fix 30/04/2026, commit 8a8d191)
- **`[&>*]:min-w-0` afeta apenas filhos DIRETOS** do DialogContent — não descendentes profundos. Colapso de input/dropdown dentro de forms aninhados (ex: ProductSearch dentro de SaleForm) vem do próprio `flex-1 min-w-0` interno do form, não do dialog. Diagnóstico para inputs colapsando: começar pelo `min-w-0` do container imediato antes de culpar o dialog
- Diagnóstico de overflow horizontal mobile (cole no DevTools console com elemento aberto): `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => ({tag:e.tagName, cls:(e.className||'').toString().slice(0,80), right:Math.round(e.getBoundingClientRect().right), width:Math.round(e.getBoundingClientRect().width), vw:window.innerWidth}))`
- Microsoft Clarity: `CLARITY_DATA_EXPORT_TOKEN` em `.env`. Máx 3 dias/req, 10 req/dia. Projeto `w6o3hwtbya`. Análise quinzenal
- Mensagens de UI com horário: usar "às 02h" (preposição = ponto no tempo), NUNCA "após 02h" (interpretado como "a cada 2 horas")
- `getFranchiseDisplayName(f)` SEM passar `config` (segundo arg) cai em fallback `f.city`. Para dropdown/seleção sem config carregado, usar diretamente `f.name + ' — ' + f.city + '/' + f.state_uf`
- `TabResultado.jsx:643` aceita prop `franchiseId` — fetcha sales/expenses/inventory/auditLogs da franquia. Reusável em admin (ex: /Financeiro tab "Por Unidade" passa franchiseId selecionado pra mostrar visão idêntica do franqueado, com poder de editar)

### Integração n8n / Bot
- V4 produção: `aRBzPABwrjhWCPvq` | V3 `XqWZyLl1AHlnJvdj` DESATIVADO
- EnviaPedidoFechado V2: `RnF1Jh6nDUj0IRHI`
- Bot Conversation Analyzer: `jh1ro9klxhbEvWgl` (cron 30min, Gemini 2.5 Flash `ezQN27UjYZVHyDEf`)
- Bot Coach Report: `gDTZPdrsVLhUk031` (cron dia 1/16 8h). Instância WuzAPI `admin_nelson`
- Franchise invite: `nbLDyd1KoFIeeJEF` | Staff invite: `jeGBs3eCHxc2EwfG`
- LogConversationMessage: `9XQ5Jkccus2vtkOE` (5 nós, todos continueOnFail)
- **Redis n8n**: NUNCA RPUSH+GET (WRONGTYPE). Usar GET→Append(Code)→SET com string JSON
- **Redis output**: `$json.propertyName` (NÃO `$json.value` — é undefined, fallback vira `[object Object]`)
- **DEDUP LID**: filtro `!info.Type` descarta placeholder sem Type (duplicatas WhatsApp)
- **Log Outbound**: `whatsapp_message_id` DEVE ser null para msgs `out` (unique index perde msg `in`)
- View `vw_dadosunidade`: SECURITY INVOKER. JSONB nativo (cast ::text quebra sub-campos). SQL: `supabase/fix-vw-dadosunidade-v2-scale.sql`
- **order_cutoff** (15/04/2026): campo opcional por faixa em `delivery_schedule` JSONB. Franquias com janela fixa (ex: 18-21h) configuram cutoff (ex: 17:00) — pedidos após esse horário vão pro próximo dia. UI: radio buttons no wizard passo 3. `delivery_schedule_text` inclui texto explícito. Customer Context V4: `hasCutoff` troca `tempo_entrega` de "40min" para "faixa de horário"
- `systemMessage` em `node.parameters.options.systemMessage`. Luxon: `setLocale('pt-BR')`
- Credencial Supabase: `mIVPcJBNcDCx21LR` (service_role) | OpenAI: `fIhzSXiiBXB3ad6Y`
- n8n API: `https://teste.dynamicagents.tech` + `/api/v1` (concatenar). PUT settings: filtrar campos extras
- SmartActions "reativar": checa `last_purchase_at >= 14d` AND `last_contact_at >= 7d`. Clicar "Feito" atualiza `last_contact_at` → suprime por 7 dias
- SmartActions: TODAS as regras em `smartActions.js` DEVEM ter guard `last_contact_at >= 7 dias` para "Feito" persistir entre reloads. Sem o guard, `dismissedIds` (state local) some no refresh
- **RPC `get_bot_conversation_summary(p_since timestamptz)`** (criada 29/04/2026, commit d1828d3): retorna agregados per-franchise per-day `{franchise_id, day, total, converted, abandoned, ongoing, autonomous, with_human_msgs}`. Substitui `BotConversation.list 90d fetchAll: true` (28k rows → 880 agregados, 100× mais rápido). `SECURITY DEFINER` + `is_admin_or_manager()` guard + `STABLE` + `REVOKE FROM PUBLIC` + `GRANT TO authenticated`. `FROM vw_bot_conversations` (auto-sync com filtros da view). Migration: [supabase/get-bot-conversation-summary.sql](supabase/get-bot-conversation-summary.sql). Consumers admin: BotSummaryCard, AlertsPanel, FranchiseHealthScore, healthScore.js. **Out of scope (mantém query própria)**: Reports.jsx, BotIntelligence.jsx (drill-down de conversa individual), BotPerformanceCard.jsx (franchisee)
- **`vw_bot_conversations` view** exclui `status IN ('manual_sale','duplicate_stale')` automaticamente — RPCs novos sobre bot conversations devem `FROM` a view (não a tabela) para auto-sync
- **`bot_conversations.outcome` valores reais (90d)**: `escalated` 21.4k, `ongoing` 5k, `abandoned` 998, `converted` 886, NULL 74, `informational` 16. **`informational` é distinto de `ongoing`** — BotSummaryCard NÃO conta como ongoing
- **`bot_conversations.status` valores reais**: `escalated`, `abandoned`, `converted`, `started`, `manual_sale`, `duplicate_stale`. **`catalog_sent`/`items_discussed`/`checkout_started` NÃO existem** — filter "ongoing por status" usa só `'started'`

### KPI Cards & Daily Goal (fixes 11/04/2026)
- KPI percentage: `percentageChange = null` quando `previousValue <= 0` — badge NÃO renderiza com null (evita +100% fake)
- Daily goal (admin FranchiseRanking): avg 30 dias por data única + 10%. Fallback 7000 se <7 dias. SVG cap `Math.min(goalPercent, 100)`, texto mostra % real
- Daily goal (franchisee): mesmo cálculo mas filtra por `evoId`. Retorna `null` se <7 dias — `DailyGoalProgress` esconde-se
- Meta batida: mensagem verde "Meta batida! +R$ X" quando `remaining <= 0`

### Vendas & Financeiro
- Faturamento = `value - discount_amount + delivery_fee` SEMPRE. `delivery_fee` é RECEITA (NÃO deduzir). `discount_amount` DEVE ser subtraído em TODOS os cálculos de receita
- Valor recebido por venda: SEMPRE `getSaleNetValue(sale)` de `lib/financialCalcs.js` (mesma fórmula). NUNCA `s.net_value || s.value` — `net_value` pode ser null em vendas antigas (bug Ricardo Tatuapé 28/04: R$ 118,50 saía 111,50 sem o frete)
- Export de vendas: `SALES_EXPORT_COLUMNS` + `buildSalesExportRows(sales, contactsMap, { includeTotalsRow })` em `lib/salesExport.js` — fonte única usada por TabLancar (tela Vendas) e TabResultado (Gestão > Resultado). Adicionar coluna nova = editar só esse arquivo
- Label de método de pagamento: `getPaymentMethodLabel(value)` de `franchiseUtils.js` (não fazer `PAYMENT_METHODS.find(...)` inline)
- `card_fee_amount` sobre `subtotal + effectiveDeliveryFee` — label dinâmica
- `cardFeePercent` default é `0` (NÃO 3.5). O useEffect seta o valor correto do `paymentFees` config ao carregar
- Exibição de taxa no summary: condição é `cardFeeAmount > 0` (qualquer método), label dinâmico por `paymentMethod`
- 6 métodos de pagamento: Dinheiro, Pix, Crédito, Débito, NFC, Outro. Taxas via tabela `payment_fees` por franquia
- `sales.observacoes` TEXT — campo livre para instruções de entrega/obs do franqueado. Aparece no comprovante (SaleReceipt)
- `payment_confirmed` + `confirmed_at` para conferência. Columns DEVE incluir ambos
- **Confirmar venda dispara CAPI** (29/04/2026): `payment_confirmed:false→true` em TabLancar dispara `fireCapiOnConfirm` (fire-and-forget, helpers no topo do arquivo). Edits nessa região DEVEM preservar a chamada — sem ela, atribuição Meta para vendas manuais quebra de novo. Bulk confirm usa `fireCapiBatch` (throttle 5x). Delete de venda `capi_sent=true` mostra confirm dialog
- `sale_date` é DATE only — `created_at` para timestamp. Edição = deletar items + reinserir
- MiniRevenueChart: SEMPRE usar `realtimeRevenue` de `allSales` (fetchAll: true). NUNCA fallback para `cronRevenue` de `daily_summaries` — cron não recalcula quando `sale_date` muda, causando vendas fantasma no gráfico
- Período "Semana" (StatsCards): `startOfWeek(now, { weekStartsOn: 1 })` — começa na **segunda-feira**, vai até hoje
- Markup estoque: `(sale - cost) / cost` (NÃO margem sobre receita)
- **Giro semanal e sugestão de reposição**: helper único [src/lib/stockSuggestion.js](src/lib/stockSuggestion.js) (`LOOKBACK_DAYS=28`, `WEEKS_OF_COVERAGE=2`, `min_stock` como piso). Consumido por TabEstoque, TabReposicao, PurchaseOrderForm via `weeklyTurnoverMap()` + `suggestionFor()`. Detector dev-only emite `console.warn` se `saleItems` chegar sem `inventory_item_id` — preveniu repetição da regressão silenciosa de columns enxuto
- `formatBRL` de `lib/formatBRL.js` — NUNCA `new Intl.NumberFormat` inline

### Módulo Financeiro v2 (1A · refactor 29/04/2026 · commits `3e2dec4`, `9ad09b3`, `22c3b3a`)

**Filosofia:** DRE = caixa puro para o franqueado (didático), com 4 fluxos automatizados que reduzem lançamento manual. Diagnóstico Fase 0: só 20/47 franquias lançavam despesa antes — automação resolveu.

**`expenses` schema novo** (migration: `supabase/expense-category-migration.sql` + `expense-category-add-pacote-sistema.sql`):
- `category TEXT NOT NULL DEFAULT 'outros'` (CHECK 11 valores: `compra_produto`, `compra_embalagem`, `compra_insumo`, `aluguel`, `pessoal`, `energia`, `transporte`, `marketing`, `pacote_sistema`, `impostos`, `outros`)
- `supplier TEXT NULL` — fornecedor texto livre
- `source TEXT NOT NULL DEFAULT 'manual'` (CHECK 5 valores: `manual`, `purchase_order`, `marketing_payment`, `external_purchase`, `asaas_subscription`) — auditoria. Migration `expense-source-add-asaas-subscription.sql` (01/05/2026) adicionou `asaas_subscription` + UNIQUE INDEX `uq_expenses_asaas_sub_payment` (source_id, expense_date) WHERE source='asaas_subscription'
- `source_id UUID NULL` — FK opcional pro registro origem
- Index: `(franchise_id, category)` + `(source, source_id) WHERE source <> 'manual'`

**Constantes/utils reutilizáveis** (sincronizar com CHECK ao adicionar categoria):
- `EXPENSE_CATEGORIES` em [src/lib/expenseCategories.js](src/lib/expenseCategories.js) — array com `{value, label PT-BR, icon Material, color, help}`. Use em ExpenseForm, "Onde foi o dinheiro", LancarCompraSheet
- `getCategoryMeta(value)` retorna meta da categoria com fallback `outros`

**`calculatePnL()` — só caixa puro** ([src/lib/financialCalcs.js](src/lib/financialCalcs.js), simplificado 29/04 commit `d2ec8bf`):
- Retorna apenas: `vendas`, `freteCobrado`, `totalDescontos`, `totalRecebido`, `taxasCartao`, `outrasDespesas`, `lucroCaixa`, `margemCaixa`, `salesCount`
- `lucroCaixa = totalRecebido - taxasCartao - outrasDespesas` — admin e franqueado VEEM O MESMO NÚMERO. NÃO existe mais `lucro`, `lucroCompetencia`, `custoProdutos`, `gastosCompraProduto`, `gastosOperacionais`
- Param `_saleItems` mantido por compat de assinatura (3 args nas chamadas), mas ignorado
- 24 testes em [src/lib/financialCalcs.test.mjs](src/lib/financialCalcs.test.mjs) — rodar com `node src/lib/financialCalcs.test.mjs`

**Utils novos no mesmo arquivo:**
- `calcularEstoqueResumo(inventoryItems)` → `{custoTotal, vendaPotencial, qtdProdutosAtivos, markupMedioPct}` — fallback client-side do RPC
- `getEstadoFinanceiro({lucroCaixa, valorEstoqueVenda, mediaMensalReceita})` → `{estado, cor, titulo, mensagem, icone}` para banner contextual (4 estados 🟢🔵🟡🔴)

**4 fluxos automatizados de despesa:**

| Fluxo | Trigger / RPC | Categoria gerada | Idempotência |
|---|---|---|---|
| Pedido Maxi entregue | `tr_po_generate_expenses` (BEFORE UPDATE OF status) | `compra_produto` + `transporte` | `purchase_orders.expenses_generated_at` |
| Marketing confirmado | `tr_mkt_generate_expense` (status=`confirmed`) | `marketing` | `marketing_payments.expense_generated_at` |
| Mensalidade ASAAS | `tr_subscription_payment_expense` (BEFORE UPDATE OF current_payment_id, current_payment_status; dispara quando `current_payment_status='PAID'` — edge function normaliza RECEIVED/CONFIRMED/RECEIVED_IN_CASH→PAID via `mapPaymentStatus()`) | `pacote_sistema` (R$ 150, `source='asaas_subscription'`) | `system_subscriptions.last_paid_payment_id` |
| Compra externa manual | RPC `record_external_purchase()` (sheet `LancarCompraSheet.jsx`) | `compra_produto`/`compra_embalagem`/`compra_insumo` | `source='external_purchase'` |

**Triggers SQL:** todos `BEFORE UPDATE` (permite setar flag de idempotência sem recursão), `SECURITY DEFINER` + `SET search_path='public'` (linter compliance). Arquivos: `supabase/po-expense-trigger.sql`, `marketing-expense-trigger.sql`, `asaas-subscription-expense-trigger.sql`. Não conflitam com triggers existentes (`on_purchase_order_delivered` continua subindo estoque).

**Cleanup ON DELETE (30/04/2026):** apagar uma `marketing_payments` row dispara `tr_mkt_cleanup_expense` (AFTER DELETE) que remove a expense espelho (`source='marketing_payment'`, `source_id=OLD.id`). Padrão a replicar se PO/ASAAS/external precisarem cancelamento — sempre trigger SQL, nunca cleanup em 2 chamadas JS (atomicidade). Pre-flight obrigatório antes de criar trigger novo: `SELECT conname FROM pg_constraint WHERE confrelid='public.expenses'::regclass AND contype='f'` deve retornar vazio. Arquivo: `supabase/marketing-cancel-trigger.sql`.

**Marketing — competência por `reference_month` (fix 30/04/2026):** trigger `tr_mkt_generate_expense` deriva `expense_date = (reference_month || '-01')::date` (fallback `updated_at`/`CURRENT_DATE` se reference_month NULL/inválido). Despesa cai no mês a que o marketing se refere, **não** na data em que o admin confirmou. Antes usava `updated_at::date` → pagamento ref maio confirmado em 30/04 caía no DRE de abril. Backfill realinhou 27 despesas (3 abril→maio, 24 normalizadas para dia 1 do próprio mês). Mesma regra replicada em `supabase/scripts/backfill-historical-expenses.sql` para re-runs.

**RPCs novas:**
- `get_inventory_value_summary(p_franchise_id)` — agregado de estoque (custo + venda potencial + markup) para card "Em Estoque"
- `record_external_purchase(franchise_id, type, unit_cost, qty, supplier?, expense_date?, inventory_item_id?, description?)` — atomic: cria expense + opcionalmente sobe estoque com **custo médio ponderado** (proteção div/0). `SECURITY DEFINER` valida `is_admin_or_manager() OR p_franchise_id = ANY(managed_franchise_ids())`. Tipos: `produto` (sobe estoque), `embalagem`/`insumo` (só expense)

**Backfill aplicado (29/04/2026):**
- Heurística regex em description (89/137 = 65%) — script [supabase/scripts/categorize-existing-expenses.mjs](supabase/scripts/categorize-existing-expenses.mjs) com `--dry-run` default e `--apply`. Importante: padrões mais específicos ANTES de mais genéricos (transporte/embalagem ANTES de compra_produto, senão "Sacolas Maxi" pega "maxi"). Use `normalize()` (NFD strip diacritics) antes de regex porque `\b` em JS não trata acentos
- Backfill retroativo de POs+Marketing (116 expenses, R$ 159k) — script [supabase/scripts/backfill-historical-expenses.sql](supabase/scripts/backfill-historical-expenses.sql) executado uma vez. Análise prévia confirmou ZERO match com despesas manuais existentes (ver `audit-prepull` no script). Idempotente futuro via `*_generated_at` flags

**TabResultado redesign** ([src/components/minha-loja/TabResultado.jsx](src/components/minha-loja/TabResultado.jsx)):
- Hero metric: `lucroCaixa` grande + delta `(curr - prev)/abs(prev) * 100` vs mês anterior
- Banner contextual: 4 estados via `getEstadoFinanceiro` (verde/azul/amarelo/vermelho com cores Tailwind via lookup `BANNER_COLORS`)
- 3 cards horizontais: `Em Estoque` (com link compacto "X parados há 28+ dias →" para /Gestao?tab=estoque) / `Caixa do mês` (Vendas + Frete + Descontos detalhados) / `Mais Vendidos` (top 3 com markup, "Ver todas" → /Vendas)
- "Onde foi o dinheiro" — agrupa expenses + taxasCartao por categoria com ícone+barra `style={backgroundColor: ${meta.color}15}`
- Evolução 6 meses (recharts `ComposedChart` com 2 eixos Y): Receita (barras cinza, esq) + Lucro (linha vermelha, dir) + Média móvel 3m (linha tracejada). Tooltip mostra margem %
- `mediaMensalReceita` (3-6 meses) usado como input de `getEstadoFinanceiro`. Sem histórico, banner cai em fallback `valorEstoqueVenda > 1000`
- Empty state com CTA "Lançar despesa"
- Despesas list mostra **badge "auto"** (`bg-[#d4af37]/15`) quando `source !== 'manual'`

**ExpenseForm** ([src/components/minha-loja/ExpenseForm.jsx](src/components/minha-loja/ExpenseForm.jsx)):
- Select de categoria PRIMEIRO campo (decisão visual antes da descrição), com texto de ajuda contextual
- Input supplier opcional (max 120 chars)
- **Aviso visual** quando editando despesa auto-gerada (`source !== 'manual'`): "Esta despesa foi gerada automaticamente... evite mudar a categoria"
- CREATE força `source='manual'`. UPDATE NÃO sobrescreve `source` (preserva auto-geradas)
- Audit log enriquecido com `category` e `supplier`

**LancarCompraSheet** ([src/components/minha-loja/LancarCompraSheet.jsx](src/components/minha-loja/LancarCompraSheet.jsx)):
- Sheet bottom (responsivo: rounded-t-2xl, sm:max-w-2xl sm:mx-auto)
- 3 tipos radio buttons (produto/embalagem/insumo) com ícone+cor
- Item autocomplete só aparece se tipo=produto
- Mostra "novo custo médio sugerido" calculado client-side antes de submit
- Submit chama RPC `record_external_purchase` via `@/api/supabaseClient` (atenção ao import path correto)
- Datalist `recentSuppliers` (top 10 últimos usados)

**Preview rota** [/PreviewResultado](src/pages/PreviewResultado.jsx) — mantido pra histórico/comparação visual com 4 cenários mockados (verde/azul/amarelo/vermelho). Acessível via URL direta (não tem link na sidebar).

**Insights de uso (Clarity 3 dias antes do redesign):**
- 62% mobile (267 sess) vs 37% PC (158) — confirmou mobile-first
- /Financeiro engagement 1057s — admin lê muito, NÃO pode quebrar (estratégia non-breaking pague)
- /FranchiseSettings tem 120 dead clicks + 7 rage — backlog de UX (fora de escopo deste ciclo)

### Impressão Térmica (Comprovantes) — refactor 21/04/2026 (commit `53751dd`)
- Arquivos: [SaleReceipt.jsx](src/components/minha-loja/SaleReceipt.jsx) (bloco `<style>` interno) + [shareUtils.js:158](src/lib/shareUtils.js#L158) (`@page`)
- **Auto-adapt 58/80mm** sem configuração: `@page { size: auto; margin: 0 }` + container com `width: "100%", maxWidth: 400`. Driver da impressora reporta largura; CSS adapta. NUNCA fixar width em px nem `size: 80mm` (quebra 58mm)
- **`margin: 0` no `@page`** — térmica tem margem física de 2-3mm por lado; margem CSS extra cortava lateral
- **Contraste obrigatório em `@media print`** (regras com `!important` no `.receipt *`):
  - `color: #000` em tudo (ZERO cinza — `#666`, `#444`, `#dc2626` somem em raster 1-bit 203dpi)
  - `font-family: 'Courier New'` monospace + `font-weight: 700` + `font-size: 11pt`
  - `-webkit-font-smoothing: none` (anti-aliasing vira dither)
  - `print-color-adjust: exact` + prefix `-webkit-`
  - `overflow-wrap: anywhere` + `word-break: break-word` para nomes longos
  - Logo `max-width: 40mm` (cabe em 58mm)
- Ao adicionar elementos ao SaleReceipt: NUNCA usar cor cinza, font-weight < 700, ou background colorido. O `!important` no `@media print` neutraliza inline styles — mas se vai imprimir, projetar pensando em "preto puro ou branco puro"
- **Uso prático (Nelson 21/04)**: franqueado imprime com **escala 80%** no dialog do browser e fica ótimo. Se reclamação de "ficou grande", orientar reduzir escala no print dialog — não é bug
- Se alguma franquia reclamar de impressão ainda apagada após este refactor, **não é CSS** — é densidade do driver (heating time) ou bobina velha. NÃO forçar config na franquia (Nelson: zero configuração)

### Meta CAPI
- Campos `contacts`: `meta_click_id`, `meta_fbclid`, `meta_ad_id`, `meta_adset_id`, `meta_campaign_id`
- `franchise_configurations`: `meta_pixel_id`, `meta_access_token`, `meta_dataset_id`, `whatsapp_business_account_id`
- Pixel produção: `5852647818195435`
- **CAPI em vendas manuais** (29/04/2026): TabLancar dispara `fireCapiOnConfirm(saleId)` (fire-and-forget) na flip `payment_confirmed: false→true` — single toggle e bulk confirm (throttle 5x). Webhook n8n `SendCapiOnSaleManual` (`xNBgSwQ6QduaS6jT`, URL `/webhook/send-capi-on-sale-manual`). Auth via `VITE_CAPI_MANUAL_TOKEN` (Bearer) ↔ `CAPI_MANUAL_WEBHOOK_TOKEN` no n8n env. Idempotente (skipa se `capi_sent=true`). Skipa também se `contact_id=null` ou franquia sem WABA. `event_id = purchase_manual_<sale_id>` distingue do bot. Delete de venda c/ `capi_sent=true` mostra confirm dialog avisando registro fantasma no Meta

### Convites
- Franqueado: `inviteFranchisee()` via webhook n8n (NÃO `resetPasswordForEmail` — email duplicado)
- Staff: `staffInvite(email, role)` → webhook `/staff-invite`. Se user existe → atualiza role; se não → convite
- Supabase 23505 (duplicate) = conta já existe em auth.users

### Health Score
- 5 dimensões: vendas, estoque, reposição, setup, bot. Pesos variam com `hasBotData`
- DOIS sistemas: `healthScore.js` (`calculateFranchiseHealth()`) + `FranchiseHealthScore.jsx` (calculateHealthScore LOCAL inline). `healthScore.js` é dead-ish (não importado em produção hoje, mantido por consistência). Atualizar AMBOS quando refatorar
- Após refactor d1828d3 (29/04/2026), ambos consomem `botSummary` aggregates do RPC `get_bot_conversation_summary` (não mais array bruto de conversas)
- **BUG conhecido (backlog)**: `CATEGORY_CONFIG_WITH_BOT` em [FranchiseHealthScore.jsx:232-238](src/components/dashboard/FranchiseHealthScore.jsx#L232-L238) tem `max` divergentes dos scores reais (`30/20/15/15` vs `35/25/20/15`) — barras > 100% para franquias com bot ativo. Identificado no code review do d1828d3, fix trivial pendente

### Marketing
- `marketing_payments`: 1 por franquia/mês. UNIQUE `(franchise_id, reference_month)`. CHECK `amount >= 200`
- Últimos 5 dias do mês → reference_month mira mês seguinte (lógica idêntica em Card + Admin)
- `MARKETING_TAX_RATE = 0.13` em `franchiseUtils.js`. Líquido = valor × 0.87

### UX
- Franqueado: sidebar 8 itens (Início, Vendas, Gestão, Meus Clientes, Marketing, Meu Vendedor, Tutoriais, Onboarding condicional) + bottom nav 5 slots (FAB Vender centro)
- Admin: 7 itens visíveis na sidebar + 3 ocultos (`adminSidebarHidden`: Financeiro, Acompanhamento, Inteligência Bot) acessíveis por URL
- Manager: mesma visão admin mas SEM delete. Checagens: `role === "admin" || role === "manager"` visão, `role === "admin"` delete
- Terminologia: "Estoque" (NÃO "Inventário"), "Valor Médio" (NÃO "Ticket Médio"), NÃO "Líquido"
- Onboarding: 9 blocos (8 numerados + gate de liberação). `TOTAL_ITEMS` computado dinamicamente. Acessível via sidebar, franchise cards e detail sheet
- Sidebar admin: remover `adminSidebarHidden` + definir `adminSection` = visível na sidebar
- Filtro de período com seletor de mês `[◀ Mai/2026 ▶]`: pattern oficial em [TabLancar.jsx](src/components/minha-loja/TabLancar.jsx) (Vendas) e [TabResultado.jsx](src/components/minha-loja/TabResultado.jsx) (Gestão > Resultado). State `monthOffset` (0=atual, -N=passado), aria-labels "Mês anterior"/"Próximo mês", touch target ≥40px, setas `disabled` nos limites. Reusar visual em telas novas

### ASAAS Billing (Cobrança Recorrente)
- Edge Function: `supabase/functions/asaas-billing/index.ts` — actions: `register`, `register-batch`, `subscribe-batch` (accept `value` opcional), `cancel-subscription`, `update-subscription-value`, `check-payment`, `register-webhook`, `webhook`. Action `subscribe` (single) removida 18/04
- Tabela: `system_subscriptions` (franchise_id UNIQUE, asaas_customer_id, asaas_subscription_id, subscription_status, current_payment_*, pix_payload, pix_qr_code_url, last_synced_at)
- Colunas em `franchises`: `cpf_cnpj`, `state_uf`, `address_number`, `address_complement`, `neighborhood`, `billing_email`. `address_complement` é OPCIONAL (não bloqueia gate, fora de `missingFiscalFields`). Para alterar campos de endereço: tocar em FranchiseForm (state+input+submit), saveFiscalData (FRANCHISE_FIELDS), AsaasSetupPanel (columns enxuto + display), Franchises.jsx (handleSaveFiscal + initialData), FiscalDataGate (initialData + handleSubmit), asaas-billing edge (select + payload — ASAAS usa `complement`)
- ASAAS API: `https://api.asaas.com` + `/v3/...`, header `access_token` (secret no Supabase)
- `billingType: UNDEFINED` = franqueado escolhe boleto ou PIX
- Paywall: `SubscriptionPaywall.jsx` — bloqueia APENAS `current_payment_status === 'OVERDUE'`, admin/manager isentos
- Hook: `useSubscriptionStatus.js` — cache 24h (PAID) / 5min (OVERDUE), botão "Já paguei" via `supabase.functions.invoke`
- Admin: tab Mensalidades em `Financeiro.jsx` → `AsaasSetupPanel.jsx` (input Mensalidade R$ + edit inline CPF/email, badges, botão Atualizar valor de todos, botão Cancelar por linha, revisão assinaturas)
- FranchiseForm: CPF/CNPJ + endereço com auto-fill ViaCEP (cidade também — IBGE autocomplete removido 17/04). Prop `mode` = `"create"` (admin) ou `"fiscal-only"` (gate onboarding + edição). `onSubmit` recebe 3o arg `addressExtras` (cep, street_address). Passar `billing_email` em `franchiseData`
- Helper `@/lib/saveFiscalData.js`: grava fiscal fields em `franchises` + `franchise_configurations` atomicamente. `missingFiscalFields(franchise, config)` retorna array de campos faltantes para gate/badges
- Gate onboarding: `components/onboarding/FiscalDataGate.jsx` — bloqueia franqueado sem email+CPF+endereço completos antes das 8 missões. Sem gate se admin (não-isAdmin check). Completar → unblocks
- Editar dados fiscais existentes (admin): botão no detail sheet de `Franchises.jsx` → Dialog com `FranchiseForm mode="fiscal-only"` + aviso ASAAS não sincroniza automaticamente (precisa clicar "Criar" de novo em Mensalidades se customer já existe)
- ClickSign API: token como query param `?access_token=`, NÃO Bearer. Endpoint: `app.clicksign.com/api/v3/envelopes`
- **Webhook ASAAS** (15/04/2026): registrado via action `register-webhook`, ID `c6485ea9`. Detecta formato nativo ASAAS (sem `action`, com `event` + `payment`). Token via body `access_token`, header `asaas-access-token`, ou query `?asaas_token=`. 7 eventos: PAYMENT_CREATED/UPDATED/DELETED/REFUNDED/OVERDUE/RECEIVED/CONFIRMED
- **Edge Function auth**: `verify_jwt: false` (auth manual no código). Service role bypass via JWT `role` claim. Admin para billing actions, owner para check-payment. Webhook usa `ASAAS_WEBHOOK_TOKEN` (fail-closed)
- Edge Function deploy: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy asaas-billing --no-verify-jwt --project-ref sulgicnqqopyhulglakd`
- **`asaasRequest` fix 18/04/2026**: trata 204 No Content (DELETE retorna sem body) — antes causava SyntaxError em `res.json()` mesmo com sucesso no ASAAS. `if (res.status === 204) return {}` + `text()` + `JSON.parse(text)` tolera body vazio
- **Cancel + Update valor (18/04/2026)**:
  - `cancel-subscription`: DELETE `/v3/subscriptions/{id}` + DELETE payments PENDING da sub + update banco (limpa `asaas_subscription_id`, `current_payment_*`, `pix_*`; mantém `asaas_customer_id` para recriar fácil). Status → `subscription_status='CANCELLED'` + `current_payment_status='CANCELLED'`. 404 do ASAAS tolerado (sub já cancelada manual). NÃO desativa franquia (`franchises.status` intacto)
  - `update-subscription-value { franchise_ids | all_active, new_value, apply_to_current }`: valida 5 ≤ value ≤ 5000. POST `/v3/subscriptions/{id}` com `{value}` atualiza próximos ciclos. `apply_to_current: true` → POST `/v3/payments/{current_id}` com `{value}` + refetch PIX (QR novo). Retorna `{total, updated, results[]}`
  - `subscribe-batch` aceita `value` opcional (default 150). UI passa `monthlyValue` do input
  - `createSubscription(franchiseId, value=150)` aceita valor — crítico: sem isso, recriar sub após mudar valor voltaria a R$ 150 hardcoded
- **`SubscriptionBadge` states** (`AsaasSetupPanel`): "Aguardando criar" (amarelo, customer sem sub), "Pendente" (amarelo), "Pago" (verde), "Vencido" (vermelho), "Cancelada" (cinza block)
- **Email sync no register**: se customer já existe no ASAAS (match por cpfCnpj) e `billing_email` local divergir → POST `/v3/customers/{id}` atualiza email (NFe fica correto). Outros campos (endereço/CPF/nome) NÃO sincronizam automático — admin precisa clicar "Criar" novamente OU recriar customer se precisar ampliar
- **Estado assinaturas** (18/04/2026): 11 franquias com customer ASAAS (10 aguardando criar sub + 1 teste Araraquara ativa). 36 franquias sem CPF pendentes
- **Cobrança "Sua Equipe Digital"** (15/04/2026): `FinancialObligationsCard` substituiu `MarketingPaymentCard` na home — card unificado com linha subscription (ASAAS) + linha marketing. Nome UI: "Sua Equipe Digital" (NÃO "Mensalidade"). `SubscriptionPaymentSheet` (Sheet bottom): PIX QR + copiar código + boleto + "Já paguei"
- PriorityAction: cenário `equipe_digital` dispara APENAS para OVERDUE (PENDING tratado pelo card). Suporta `onPress` callback (além de `navigateTo`) via flag `data.onPress`
- ASAAS subscribe `nextDueDate`: SEMPRE `getMonth() + 1` (mês seguinte). NUNCA condicional `getDate() >= 5 ? +2 : +1` (0-indexed pulava 2 meses). Fix 15/04/2026
- RPCs `get_franchise_ranking` e `get_franchise_report_data`: guards `is_admin_or_manager() OR managed_franchise_ids()` — SECURITY DEFINER com ownership check

## Features Removidas (NÃO recriar)
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, catalog_distributions, Weekly Bot Report (`JSzGEHQBo6Jmxhi3`), EnviaPedidoFechado V1 (`ORNRLkFLnMcIQ9Ke`), Sparklines KPI cards admin, BotCoachSheet.jsx, ActionPanel.jsx (my-contacts), LeadAnalysisModal.jsx, FranchiseHealthScore (do AdminDashboard apenas — substituído por LastPurchaseOrderCard 29/04; componente mantido em Acompanhamento/BotIntelligence/FranchiseHealthDetail)

## Meta-regras
- NUNCA alterar `franchise_configurations` sem verificar compatibilidade com vendedor genérico
- NUNCA commitar credenciais. Testar mobile. Empty states obrigatórios
- Management API SQL com `$$`: salvar em arquivo (delimitadores corrompidos em JSON)
- PUT API n8n pode desativar workflows — verificar `active` e reativar após updates

## Variáveis de Ambiente
```
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
SUPABASE_MANAGEMENT_TOKEN (sbp_, pode expirar — fallback service_role via PostgREST)
VITE_N8N_WEBHOOK_BASE=https://webhook.dynamicagents.tech/webhook
VITE_CAPI_MANUAL_TOKEN (uuid v4, par com CAPI_MANUAL_WEBHOOK_TOKEN no n8n stack 4)
N8N_API_KEY / N8N_VENDEDOR_V4_WORKFLOW_ID=aRBzPABwrjhWCPvq
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af
ZUCKZAPGO_URL / ZUCKZAPGO_ADMIN_TOKEN
```

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- SQL: `POST .../projects/{ref}/database/query` com `Authorization: Bearer {sbp_token}`
- Executar SQL via API com context-mode: `ctx_execute` com `fetch()` JavaScript (curl bloqueado pelo context-mode hook)
- **EXPLAIN de SQL function STABLE** mostra só `Function Scan` opaco (a função inlinea no plano externo mas não aparece). Para ver o plano real, copiar o body da função (`pg_get_functiondef`) e rodar `EXPLAIN ANALYZE` direto na query SQL inline
