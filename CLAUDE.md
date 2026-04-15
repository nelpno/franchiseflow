<!-- Last Updated: 2026-04-14 -->
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
- `franchises` NÃO tem owner_email (email fica em franchise_invites)

**RLS específico:**
- `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 policies dependem)
- profiles SELECT: `is_admin_or_manager() OR id = auth.uid()` — NUNCA `is_admin()` sozinha (recursão infinita)
- Tabelas novas: DELETE policy com `is_admin()` obrigatória (sem ela, delete retorna sucesso mas 0 rows)
- `sale_items` RLS: subquery `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
- `activity_log` NÃO existe no banco (referenciada em schema.sql mas nunca criada)

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
- Loading: `<Skeleton>` shadcn (NÃO spinner). PageFallback relativo (NUNCA `fixed inset-0`)
- NUNCA `new Date().toISOString().split("T")[0]` — usar `format(new Date(), "yyyy-MM-dd")`
- `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval
- Error handling: `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout
- Rotas: `createPageUrl("PageName")` → `"/PageName"` (capitalizado)
- Navegação programática: `useNavigate()` + `useSearchParams()` de `react-router-dom`. Query params para pré-seleção (ex: `/Onboarding?franchise=evo_id`)
- Toast: sonner (importar de `"sonner"`, NÃO shadcn legado). NUNCA alert()/window.confirm()
- Clickable card pattern: `cursor-pointer hover:shadow-md active:scale-[0.98] transition-all` (QuickAccessCards.jsx)
- Clickable text pattern: `cursor-pointer hover:underline hover:text-[#b91c1c] transition-colors`
- Cards navegáveis: usar `Link` condicional (não `onClick+navigate`) para a11y (Tab+Enter, right-click). Ex: StatsCard `href` prop
- TabEstoque inline edit: NUNCA onClick na `<TableRow>` (conflita com handleCellClick em quantity/min_stock/sale_price). Apenas `product_name` clicável
- TabEstoque card view (mobile): DEVE ter 3 botões (edit, ocultar, delete) — manter paridade com table view (desktop)
- TabEstoque adicionar produto: autocomplete mostra produtos padrão da rede (RPC `get_standard_product_catalog`). Seleção preenche campos e marca `created_by_franchisee: false`
- Dialog/Sheet Radix: dead clicks no overlay são comportamento normal (close on outside click). NÃO tentar "fixar"
- Microsoft Clarity: `CLARITY_DATA_EXPORT_TOKEN` em `.env`. Máx 3 dias/req, 10 req/dia. Projeto `w6o3hwtbya`. Análise quinzenal

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
- `systemMessage` em `node.parameters.options.systemMessage`. Luxon: `setLocale('pt-BR')`
- Credencial Supabase: `mIVPcJBNcDCx21LR` (service_role) | OpenAI: `fIhzSXiiBXB3ad6Y`
- n8n API: `https://teste.dynamicagents.tech` + `/api/v1` (concatenar). PUT settings: filtrar campos extras
- SmartActions "reativar": checa `last_purchase_at >= 14d` AND `last_contact_at >= 7d`. Clicar "Feito" atualiza `last_contact_at` → suprime por 7 dias

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
- Markup estoque: `(sale - cost) / cost` (NÃO margem sobre receita)
- `formatBRL` de `lib/formatBRL.js` — NUNCA `new Intl.NumberFormat` inline
- P&L: `calculatePnL()` em `financialCalcs.js` (shared TabResultado + Financeiro)

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
- Admin: 6 itens visíveis na sidebar + 4 ocultos (`adminSidebarHidden`: Relatórios, Financeiro, Acompanhamento, Inteligência Bot) acessíveis por URL
- Manager: mesma visão admin mas SEM delete. Checagens: `role === "admin" || role === "manager"` visão, `role === "admin"` delete
- Terminologia: "Estoque" (NÃO "Inventário"), "Valor Médio" (NÃO "Ticket Médio"), NÃO "Líquido"
- Onboarding: 9 blocos (8 numerados + gate de liberação). `TOTAL_ITEMS` computado dinamicamente. Acessível via sidebar, franchise cards e detail sheet
- Sidebar admin: remover `adminSidebarHidden` + definir `adminSection` = visível na sidebar

### ASAAS Billing (Cobrança Recorrente)
- Edge Function: `supabase/functions/asaas-billing/index.ts` — actions: register, register-batch, subscribe, subscribe-batch, check-payment, register-webhook, webhook
- Tabela: `system_subscriptions` (franchise_id UNIQUE, asaas_customer_id, asaas_subscription_id, current_payment_status, pix_payload, etc.)
- Colunas em `franchises`: `cpf_cnpj`, `state_uf`, `address_number`, `neighborhood`
- ASAAS API: `https://api.asaas.com` + `/v3/...`, header `access_token` (secret no Supabase)
- `billingType: UNDEFINED` = franqueado escolhe boleto ou PIX
- Paywall: `SubscriptionPaywall.jsx` — bloqueia APENAS `current_payment_status === 'OVERDUE'`, admin/manager isentos
- Hook: `useSubscriptionStatus.js` — cache 24h (PAID) / 5min (OVERDUE), botão "Já paguei" via `supabase.functions.invoke`
- Admin: tab Mensalidades em `Financeiro.jsx` → `AsaasSetupPanel.jsx` (edição CPF inline, badges, revisão assinaturas)
- FranchiseForm: CPF/CNPJ + endereço com auto-fill ViaCEP. `onSubmit` recebe 3o arg `addressExtras` (cep, street_address)
- ClickSign API: token como query param `?access_token=`, NÃO Bearer. Endpoint: `app.clicksign.com/api/v3/envelopes`
- **Webhook ASAAS** (15/04/2026): registrado via action `register-webhook`, ID `c6485ea9`. Detecta formato nativo ASAAS (sem `action`, com `event` + `payment`). Token via body `access_token`, header `asaas-access-token`, ou query `?asaas_token=`. 7 eventos: PAYMENT_CREATED/UPDATED/DELETED/REFUNDED/OVERDUE/RECEIVED/CONFIRMED
- **Edge Function auth**: `verify_jwt: false` (auth manual no código). Service role bypass via JWT `role` claim. Admin para billing actions, owner para check-payment. Webhook usa `ASAAS_WEBHOOK_TOKEN` (fail-closed)
- Edge Function deploy: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy asaas-billing --no-verify-jwt --project-ref sulgicnqqopyhulglakd`
- **Estado assinaturas** (15/04/2026): 11 franquias registradas no ASAAS (10 com CPF original + 1 teste Araraquara). 1 assinatura ativa (Araraquara teste). 37 franquias sem CPF pendentes
- **Franqueado não tem UI de mensalidade** — só vê paywall quando OVERDUE. Falta card na home para pagar proativamente (PIX/boleto antes de vencer)
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
