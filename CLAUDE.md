<!-- Last Updated: 2026-04-29 -->
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
- Debug 403 em upload Supabase Storage: checar `pg_policies WHERE schemaname='storage' AND tablename='objects'` ANTES de investigar código React/auth (root cause é quase sempre policy faltando ou mudada)
- FKs novas: SEMPRE criar índice correspondente (`CREATE INDEX IF NOT EXISTS`)
- Extensões: usar schema `extensions` (NÃO `public`)

**Security helpers (usar em código novo):**
- Toast errors: NUNCA `error.message` ou `error.details` direto — usar `safeErrorMessage(error, "fallback")` de `@/lib/safeErrorMessage`
- CSV export: SEMPRE `sanitizeCSVCell()` em campos de texto — previne formula injection no Excel (`@/lib/csvSanitize`)
- href dinâmico: `safeHref(url)` rejeita `javascript:` e protocolos perigosos (`@/lib/safeHref`)

### Frontend Patterns
- `mountedRef` + cleanup obrigatório. `setIsLoading(false)` antes de early return
- Listas Supabase: SEMPRE sort explícito no frontend (ordem muda após updates)
- Inline edit mobile: `onClick={e => e.stopPropagation()}` + `inputMode="numeric"`. `active:` (NÃO `hover:`)
- Queries: tabelas que crescem (Sale, Expense, DailySummary, ConversationMessage) DEVEM usar `fetchAll: true` (pagina internamente de 1000 em 1000). Tabelas pequenas/fixas podem usar `limit` numérico
- AdminDashboard: 10 queries paralelas `Promise.allSettled` — maioria com `fetchAll: true`. Auto-retry na query de franquias
- AdminDashboard layout order: Stats → Mini-cards (Bot+Financeiro) → Ranking → Gráfico → Alertas (colapsado) → Health Score (colapsado). `CollapsibleSection` local usa Radix Collapsible
- BotSummaryCard: SEMPRE filtrar `startOfMonth` (mês atual). Dados do parent vêm com 90 dias — NÃO usar sem filtro
- Loading: `<Skeleton>` shadcn (NÃO spinner). PageFallback relativo (NUNCA `fixed inset-0`)
- NUNCA `new Date().toISOString().split("T")[0]` — usar `format(new Date(), "yyyy-MM-dd")`
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
- Microsoft Clarity: `CLARITY_DATA_EXPORT_TOKEN` em `.env`. Máx 3 dias/req, 10 req/dia. Projeto `w6o3hwtbya`. Análise quinzenal
- Mensagens de UI com horário: usar "às 02h" (preposição = ponto no tempo), NUNCA "após 02h" (interpretado como "a cada 2 horas")

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

### KPI Cards & Daily Goal (fixes 11/04/2026)
- KPI percentage: `percentageChange = null` quando `previousValue <= 0` — badge NÃO renderiza com null (evita +100% fake)
- Daily goal (admin FranchiseRanking): avg 30 dias por data única + 10%. Fallback 7000 se <7 dias. SVG cap `Math.min(goalPercent, 100)`, texto mostra % real
- Daily goal (franchisee): mesmo cálculo mas filtra por `evoId`. Retorna `null` se <7 dias — `DailyGoalProgress` esconde-se
- Meta batida: mensagem verde "Meta batida! +R$ X" quando `remaining <= 0`

### Vendas & Financeiro
- Faturamento = `value - discount_amount + delivery_fee` SEMPRE. `delivery_fee` é RECEITA (NÃO deduzir). `discount_amount` DEVE ser subtraído em TODOS os cálculos de receita
- `card_fee_amount` sobre `subtotal + effectiveDeliveryFee` — label dinâmica
- `cardFeePercent` default é `0` (NÃO 3.5). O useEffect seta o valor correto do `paymentFees` config ao carregar
- Exibição de taxa no summary: condição é `cardFeeAmount > 0` (qualquer método), label dinâmico por `paymentMethod`
- 6 métodos de pagamento: Dinheiro, Pix, Crédito, Débito, NFC, Outro. Taxas via tabela `payment_fees` por franquia
- `sales.observacoes` TEXT — campo livre para instruções de entrega/obs do franqueado. Aparece no comprovante (SaleReceipt)
- `payment_confirmed` + `confirmed_at` para conferência. Columns DEVE incluir ambos
- `sale_date` é DATE only — `created_at` para timestamp. Edição = deletar items + reinserir
- MiniRevenueChart: SEMPRE usar `realtimeRevenue` de `allSales` (fetchAll: true). NUNCA fallback para `cronRevenue` de `daily_summaries` — cron não recalcula quando `sale_date` muda, causando vendas fantasma no gráfico
- Período "Semana" (StatsCards): `startOfWeek(now, { weekStartsOn: 1 })` — começa na **segunda-feira**, vai até hoje
- Markup estoque: `(sale - cost) / cost` (NÃO margem sobre receita)
- `formatBRL` de `lib/formatBRL.js` — NUNCA `new Intl.NumberFormat` inline

### Módulo Financeiro v2 (1A · refactor 29/04/2026 · commits `3e2dec4`, `9ad09b3`, `22c3b3a`)

**Filosofia:** DRE = caixa puro para o franqueado (didático), com 4 fluxos automatizados que reduzem lançamento manual. Diagnóstico Fase 0: só 20/47 franquias lançavam despesa antes — automação resolveu.

**`expenses` schema novo** (migration: `supabase/expense-category-migration.sql` + `expense-category-add-pacote-sistema.sql`):
- `category TEXT NOT NULL DEFAULT 'outros'` (CHECK 11 valores: `compra_produto`, `compra_embalagem`, `compra_insumo`, `aluguel`, `pessoal`, `energia`, `transporte`, `marketing`, `pacote_sistema`, `impostos`, `outros`)
- `supplier TEXT NULL` — fornecedor texto livre
- `source TEXT NOT NULL DEFAULT 'manual'` (CHECK 4 valores: `manual`, `purchase_order`, `marketing_payment`, `external_purchase`) — auditoria
- `source_id UUID NULL` — FK opcional pro registro origem
- Index: `(franchise_id, category)` + `(source, source_id) WHERE source <> 'manual'`

**Constantes/utils reutilizáveis** (sincronizar com CHECK ao adicionar categoria):
- `EXPENSE_CATEGORIES` em [src/lib/expenseCategories.js](src/lib/expenseCategories.js) — array com `{value, label PT-BR, icon Material, color, help}`. Use em ExpenseForm, "Onde foi o dinheiro", LancarCompraSheet
- `getCategoryMeta(value)` retorna meta da categoria com fallback `outros`

**`calculatePnL()` refactor non-breaking** ([src/lib/financialCalcs.js](src/lib/financialCalcs.js)):
- **Legacy intacto** (admin Financeiro/Reports/FranchiseFinanceTable etc continuam usando): `lucro`, `custoProdutos`, `outrasDespesas`, `margem`
- **Campos novos** (TabResultado novo usa): `lucroCaixa`, `lucroCompetencia`, `gastosCompraProduto`, `gastosOperacionais`, `margemCaixa`, `margemCompetencia`
- `lucroCaixa = totalRecebido - taxasCartao - outrasDespesas` (caixa puro, INCLUI compra_produto)
- `lucroCompetencia = totalRecebido - custoProdutos - taxasCartao - gastosOperacionais` (sem dupla contagem)
- 22 testes em [src/lib/financialCalcs.test.mjs](src/lib/financialCalcs.test.mjs) — rodar com `node src/lib/financialCalcs.test.mjs`

**Utils novos no mesmo arquivo:**
- `calcularEstoqueResumo(inventoryItems)` → `{custoTotal, vendaPotencial, qtdProdutosAtivos, markupMedioPct}` — fallback client-side do RPC
- `getEstadoFinanceiro({lucroCaixa, valorEstoqueVenda, mediaMensalReceita})` → `{estado, cor, titulo, mensagem, icone}` para banner contextual (4 estados 🟢🔵🟡🔴)

**4 fluxos automatizados de despesa:**

| Fluxo | Trigger / RPC | Categoria gerada | Idempotência |
|---|---|---|---|
| Pedido Maxi entregue | `tr_po_generate_expenses` (BEFORE UPDATE OF status) | `compra_produto` + `transporte` | `purchase_orders.expenses_generated_at` |
| Marketing confirmado | `tr_mkt_generate_expense` (status=`confirmed`) | `marketing` | `marketing_payments.expense_generated_at` |
| Mensalidade ASAAS | `tr_subscription_payment_expense` (current_payment_status=`RECEIVED`/`CONFIRMED`/`RECEIVED_IN_CASH`) | `pacote_sistema` (R$ 150) | `system_subscriptions.last_paid_payment_id` |
| Compra externa manual | RPC `record_external_purchase()` (sheet `LancarCompraSheet.jsx`) | `compra_produto`/`compra_embalagem`/`compra_insumo` | `source='external_purchase'` |

**Triggers SQL:** todos `BEFORE UPDATE` (permite setar flag de idempotência sem recursão), `SECURITY DEFINER` + `SET search_path='public'` (linter compliance). Arquivos: `supabase/po-expense-trigger.sql`, `marketing-expense-trigger.sql`, `asaas-subscription-expense-trigger.sql`. Não conflitam com triggers existentes (`on_purchase_order_delivered` continua subindo estoque).

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

### Convites
- Franqueado: `inviteFranchisee()` via webhook n8n (NÃO `resetPasswordForEmail` — email duplicado)
- Staff: `staffInvite(email, role)` → webhook `/staff-invite`. Se user existe → atualiza role; se não → convite
- Supabase 23505 (duplicate) = conta já existe em auth.users

### Health Score
- 5 dimensões: vendas, estoque, reposição, setup, bot. Pesos variam com `hasBotData`
- DOIS sistemas: `healthScore.js` (`calculateFranchiseHealth()`) + `FranchiseHealthScore.jsx` — atualizar AMBOS

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

### ASAAS Billing (Cobrança Recorrente)
- Edge Function: `supabase/functions/asaas-billing/index.ts` — actions: `register`, `register-batch`, `subscribe-batch` (accept `value` opcional), `cancel-subscription`, `update-subscription-value`, `check-payment`, `register-webhook`, `webhook`. Action `subscribe` (single) removida 18/04
- Tabela: `system_subscriptions` (franchise_id UNIQUE, asaas_customer_id, asaas_subscription_id, subscription_status, current_payment_*, pix_payload, pix_qr_code_url, last_synced_at)
- Colunas em `franchises`: `cpf_cnpj`, `state_uf`, `address_number`, `neighborhood`, `billing_email`
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
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, catalog_distributions, Weekly Bot Report (`JSzGEHQBo6Jmxhi3`), EnviaPedidoFechado V1 (`ORNRLkFLnMcIQ9Ke`), Sparklines KPI cards admin, BotCoachSheet.jsx, ActionPanel.jsx (my-contacts), LeadAnalysisModal.jsx

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
N8N_API_KEY / N8N_VENDEDOR_V4_WORKFLOW_ID=aRBzPABwrjhWCPvq
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af
ZUCKZAPGO_URL / ZUCKZAPGO_ADMIN_TOKEN
```

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- SQL: `POST .../projects/{ref}/database/query` com `Authorization: Bearer {sbp_token}`
- Executar SQL via API com context-mode: `ctx_execute` com `fetch()` JavaScript (curl bloqueado pelo context-mode hook)
