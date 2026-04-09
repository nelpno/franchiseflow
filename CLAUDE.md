<!-- Last Updated: 2026-04-08 -->
# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Este arquivo contém APENAS especificidades do dashboard.

## Stack & Deploy
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud
- Stack Portainer ID 39 | Service ID `2zb27nndn5sg8zweyie6wscpc`
- GitHub: `nelpno/franchiseflow.git`
- Deploy: `git push` → force update serviço Docker (incrementar ForceUpdate no TaskTemplate). Stack update sozinho NÃO recria container
- 502 por ~2min durante rebuild é normal. ctx_execute com JS para HTTP Portainer (NÃO shell+jq)
- `npm run build` pode completar sem output visível (Windows). Verificar timestamp de `dist/index.html`
- Vite build VPS: `NODE_OPTIONS=--max-old-space-size=4096`

## Gotchas Críticos

### Auth (AuthContext.jsx)
- supabaseClient.js: mutex async in-memory (NUNCA bypass `fn()` direto — race condition)
- `onAuthStateChange('SIGNED_IN')`: setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s). NUNCA `getSession()` dentro do handler
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso
- Detecção convite: `user_metadata.password_set` (PKCE não passa `type=invite`)
- NUNCA `window.location.href` após signIn — `onAuthStateChange` cuida do redirect
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (8s timeout)

### Supabase & Schema
- API: importar de `@/entities/all` — NUNCA `supabase.from()` direto. Timeouts: leitura 15s, escrita 30s
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
- `onboarding_checklists` NÃO tem total_items, started_at, user_id
- `franchises` NÃO tem owner_email (email fica em franchise_invites)

**RLS específico:**
- `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 policies dependem)
- profiles SELECT: `is_admin_or_manager() OR id = auth.uid()` — NUNCA `is_admin()` sozinha (recursão infinita)
- Tabelas novas: DELETE policy com `is_admin()` obrigatória (sem ela, delete retorna sucesso mas 0 rows)
- `sale_items` RLS: subquery `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`

### Frontend Patterns
- `mountedRef` + cleanup obrigatório. `setIsLoading(false)` antes de early return
- Listas Supabase: SEMPRE sort explícito no frontend (ordem muda após updates)
- Inline edit mobile: `onClick={e => e.stopPropagation()}` + `inputMode="numeric"`. `active:` (NÃO `hover:`)
- Queries: SEMPRE `limit` explícito (sem limite = timeout). Reports: limits altos (Sale/Contact 2000)
- AdminDashboard: 9 queries paralelas `Promise.allSettled` — TODAS com `limit`. Auto-retry na query de franquias
- Loading: `<Skeleton>` shadcn (NÃO spinner). PageFallback relativo (NUNCA `fixed inset-0`)
- NUNCA `new Date().toISOString().split("T")[0]` — usar `format(new Date(), "yyyy-MM-dd")`
- `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval
- Error handling: `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout
- Rotas: `createPageUrl("PageName")` → `"/PageName"` (capitalizado)
- Toast: sonner (importar de `"sonner"`, NÃO shadcn legado). NUNCA alert()/window.confirm()

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

### Vendas & Financeiro
- Faturamento bruto = `value + delivery_fee` SEMPRE. `delivery_fee` é RECEITA (NÃO deduzir)
- `card_fee_amount` sobre `subtotal + effectiveDeliveryFee` — label dinâmica
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
- 4 dimensões: vendas 35, estoque 25, reposição 20, setup/WhatsApp 20
- DOIS sistemas: `healthScore.js` + `FranchiseHealthScore.jsx` — atualizar AMBOS

### Marketing
- `marketing_payments`: 1 por franquia/mês. UNIQUE `(franchise_id, reference_month)`. CHECK `amount >= 200`
- Últimos 5 dias do mês → reference_month mira mês seguinte (lógica idêntica em Card + Admin)
- `MARKETING_TAX_RATE = 0.13` em `franchiseUtils.js`. Líquido = valor × 0.87

### UX
- Franqueado: sidebar 6 itens + bottom nav 5 slots (FAB Vender centro)
- Manager: mesma visão admin mas SEM delete. Checagens: `role === "admin" || role === "manager"` visão, `role === "admin"` delete
- Terminologia: "Estoque" (NÃO "Inventário"), "Valor Médio" (NÃO "Ticket Médio"), NÃO "Líquido"
- Wizard: 6 passos visuais, Revisão NÃO conta (X/5). Upload catálogo JPG only
- Sidebar admin: 5 itens visíveis. Páginas ocultas via `adminSidebarHidden` acessíveis por URL

## Features Removidas (NÃO recriar)
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, Daily Checklist, ReviewSummary campos Personalidade/Boas-vindas, catalog_distributions, BotPerformanceCard/QuickAccessCards/PeriodComparisonCard, Weekly Bot Report (`JSzGEHQBo6Jmxhi3`), EnviaPedidoFechado V1 (`ORNRLkFLnMcIQ9Ke`), Sparklines KPI cards admin

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
