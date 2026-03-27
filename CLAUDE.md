# FranchiseFlow — Dashboard Maxi Massas

## Sobre
Dashboard de gestão de franquias da Maxi Massas (massas artesanais congeladas).
Franquias são **home-based** (NÃO loja física) — vocabulário bot: NUNCA "loja física"/"unidade física", usar "ponto de retirada" ou só endereço.
Migrado de Base44 para Supabase Cloud. Frontend React hospedado via Docker/Portainer.

## Stack
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui (Radix) + Material Symbols Outlined
- **Design System**: Atelier Gastronomique via [Stitch](https://stitch.withgoogle.com/projects/8287094972471703476) (vermelho #b91c1c, dourado #d4af37, Inter + Plus Jakarta Sans)
- **Backend**: Supabase Cloud (Auth + Postgres + RLS + Storage + Edge Functions)
- **Automação**: n8n (webhook.dynamicagents.tech) para WhatsApp, catálogo, marketing
- **WhatsApp**: ZuckZapGo (WuzAPI) em zuck.dynamicagents.tech
- **Deploy**: Docker Swarm (Nginx Alpine) via Portainer — domínio `app.maximassas.tech`
- **Infra**: Hostinger VPS (82.29.60.220), Traefik reverse proxy + Let's Encrypt SSL, rede `nelsonNet`
- **Email**: SMTP via `fabrica@maximassas.com.br` (Google Workspace) — templates PT-BR com logo

## Arquitetura

### Camada de API (src/entities/all.js)
Adapter pattern: cada entidade expõe `.list()/.filter()/.create()/.update()/.delete()`.
Importar sempre de `@/entities/all` — NÃO usar supabase.from() diretamente nas páginas.
- Timeouts: leitura 15s, escrita 30s via `withTimeout()` — NUNCA remover
- Antes de `Entity.update()`, remover campos read-only (`id`, `created_at`, `updated_at`, `franchise`, `whatsapp_status`)
- Entities principais: `Contact`, `Sale`, `SaleItem`, `Expense`, `InventoryItem`, `PurchaseOrder`, `PurchaseOrderItem`, `Notification`, `FranchiseConfiguration`

### Autenticação (src/lib/AuthContext.jsx)
Supabase Auth com roles: admin, franchisee, manager. Login via `/login` com Supabase signInWithPassword.
- AuthContext usa getSession() + onAuthStateChange(). Timeout de 5s como safety net
- `AuthContext.Provider` value memoizado com `useMemo` (20+ consumers)
- `logout()` limpa state ANTES do `await signOut()` — UI reage instantaneamente
- Login com Google REMOVIDO — apenas email/senha
- Rota `/set-password`: detecta `type=invite`/`type=recovery` no hash OU search params (PKCE). Redireciona para `/login` quando não autenticado
- Detecção de convite usa `user_metadata.password_set` (PKCE não passa `type=invite`). SetPassword marca `password_set: true` via `updateUser()`
- `password_setup_type` usa `sessionStorage` (NÃO localStorage)
- Login.jsx tem "Primeiro acesso? Defina sua senha aqui" como rede de segurança
- Login.jsx e SetPassword.jsx compartilham template visual — manter consistência

### Row Level Security
- Admin vê tudo; franqueado vê apenas suas franquias (managed_franchise_ids)
- Helpers SQL: `is_admin()`, `managed_franchise_ids()`
- **WORKAROUND**: `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 RLS policies dependem disso)
- NUNCA usar `is_admin()` dentro de RLS policy do `profiles` (recursão infinita) — usar `USING (true)` para SELECT
- Tabelas novas DEVEM ter DELETE policy para admin — sem ela, `.delete()` retorna sucesso mas deleta 0 rows (silencioso)
- `sale_items` RLS usa subquery: `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
- `onboarding_checklists` RLS INSERT permite admin E franqueado

### Filtro de Franquias (src/lib/franchiseUtils.js)
- `getAvailableFranchises(franchises, user)` — filtra por role, aceita UUID e evolution_instance_id
- `findFranchise(franchises, id)` — lookup por qualquer formato de ID
- Constantes: `PAYMENT_METHODS`, `DELIVERY_METHODS`, `BOT_PERSONALITIES`, `PIX_KEY_TYPES`, `WEEKDAYS`
- SEMPRE usar essas funções — NUNCA `managed_franchise_ids[0]` direto
- `DELIVERY_METHODS` é config do vendedor (own_fleet/third_party/both) — NÃO usar para entrega individual ('retirada'/'delivery')
- `PAYMENT_COLORS` em PaymentMethodChart.jsx DEVE espelhar `PAYMENT_METHODS` — atualizar ambos

### Contatos/Leads (contacts)
- Tabela `contacts` unificada (substitui 45+ tabelas do projeto antigo)
- `franchise_id` = `evolution_instance_id` da franquia
- `status` pipeline: novo_lead → em_negociacao → cliente → recorrente → remarketing → perdido
- `purchase_count`, `total_spent`, `last_purchase_at` atualizados por trigger `on_sale_created`
- `sales.contact_id` FK opcional (ON DELETE SET NULL — excluir contato preserva vendas)
- Bot n8n grava apenas: franchise_id, telefone, nome, last_contact_at — triggers cuidam do resto
- `contacts.telefone` nullable — unique constraint parcial. Enviar `null` (NÃO string vazia)
- Telefone normalizado: `normalizePhone()` em `whatsappUtils.js` — strip 55, salva 11 dígitos
- `contacts.source`: manual/bot/whatsapp (default 'manual')
- Nomes/endereços/bairros: `capitalize()` antes de salvar (respeita preposições)

### Vendas & Gestão
- **Vendas** (`Vendas.jsx`): registro de vendas (TabLancar standalone). Deep-linking: `?action=nova-venda&contact_id=UUID&phone=X`
- **Gestão** (`Gestao.jsx`): 3 abas (Resultado, Estoque, Reposição) — `?tab=resultado|estoque|reposicao`
- `MinhaLoja.jsx`: APENAS redirect backward-compat — NÃO adicionar lógica. NUNCA usar `/MinhaLoja?tab=` em código novo
- `sale_items`: FK sale_id + inventory_item_id, triggers `stock_decrement`/`stock_revert`
- `expenses`: despesas avulsas (sacolas, aluguel). Sacolas são DESPESAS, NÃO itens de estoque
- `card_fee_amount` calculado sobre `subtotal + effectiveDeliveryFee` — aplica para `card_machine` E `payment_link`. Label dinâmica
- `delivery_fee` é RECEITA do franqueado — NÃO deduzir no resultado
- Faturamento bruto = `value + delivery_fee` em TODOS os cálculos de revenue. TabResultado mostra linhas separadas
- Linhas financeiras com valor zero ficam ocultas
- Edição de venda = deletar sale_items antigos + reinserir novos (triggers cuidam do estoque)
- `SaleReceipt.jsx` gera comprovante PNG (html2canvas) — `shareUtils.js` com dynamic import
- `sale_items.cost_price` é snapshot do momento da venda. `sale_price` padrão = `cost_price * 2`
- `sale_date` é DATE only — usar `created_at` para timestamp completo

### Pedido de Compra / Reposição
- `purchase_orders` + `purchase_order_items` com trigger auto-incremento ao marcar "entregue"
- `purchase_order_items` FK é `order_id` (NÃO `purchase_order_id`)
- CHECK constraints usam português (`pendente`, `confirmado`, `em_rota`, `entregue`, `cancelado`)
- PL/pgSQL: `WHERE evolution_instance_id = NEW.franchise_id` (NÃO `WHERE id = NEW.franchise_id`)
- `notify_franchise_users(p_franchise_id UUID)` recebe UUID — resolver com subquery

### Auto-vinculação User↔Franchise
- Trigger `handle_new_user()` em auth.users (NÃO trigger separado em profiles)
- Checa franchise_invites pendentes → auto-adiciona UUID + evo_id em managed_franchise_ids
- Suporta múltiplos convites por franquia (dono + cônjuge)
- Auto-cria `onboarding_checklists` (itens 1-1 e 1-2 pré-marcados, `ON CONFLICT DO NOTHING`)
- Puxa `owner_name` da franquia para `full_name` (fallback: user_metadata, email)
- Fallback role: invites → `raw_user_meta_data->>'role'` → default `'franchisee'`

### Integração Vendedor Genérico (n8n)
- V2 (`w7loLOXUmRR3AzuO`): RabbitMQ trigger, queue `zuckzapgo.events`, 100% Supabase
- V1 (`PALRV1RqD3opHMzk`): DESATIVADO (Base44 legado)
- Sub-workflow EnviaPedidoFechado V2: `RnF1Jh6nDUj0IRHI` — 8 nós, dados via $fromAI(). V1 (`ORNRLkFLnMcIQ9Ke`) MORTO
- Credencial Supabase: `mIVPcJBNcDCx21LR`, key `supabaseApi` — DEVE ser service_role
- View `vw_dadosunidade`: mapeia franchise_configurations. SQL: `supabase/fix-vw-dadosunidade-v2-scale.sql`
  - SECURITY INVOKER (NUNCA DEFINER). Campos JSONB retornam nativo (cast `::text` quebra sub-campos)
  - Ao recriar: CONFERIR `zuck_instance_name`. Usar `DROP VIEW` + `CREATE VIEW` (replace não muda tipo)
- `whatsapp_instance_id` pode DIFERIR de `evolution_instance_id` em franquias legadas
- Telefones: SEMPRE prefixo 55 no WhatsApp. DB armazena 11 dígitos
- `blockedNumbers`: cache dinâmico via staticData, busca a cada 30min, formato 11 dígitos
- Prompts usam dados estruturados: `payment_delivery[]`, `delivery_fee_rules[]` JSONB — NÃO campos texto antigos
- `delivery_schedule_text`: campo computado na view, gera texto de horários/frete por dia para o bot (ex: "Seg-Sex: 06:00-23:00 | Sab: 08:00-14:00")
- `valor_total` do $fromAI() pode vir 0 — calcular sum(qty * price) + frete como fallback
- `inventory_items.product_name` (NÃO `name`). Match Items: best-score fuzzy (palavras >2 chars)
- n8n API PUT settings: apenas `executionOrder`, `callerPolicy` — outros causam 400
- n8n editor aberto SOBRESCREVE ao executar — fechar aba antes de testar
- **`R$` em expressões n8n `{{ }}`**: o `$` pode ser comido pelo parser de expressões. Usar `'R' + '$'` (concatenação) em IIFEs dentro de systemMessage. Expressões simples fora de IIFE toleram `R$` literal
- **Regex em systemMessage n8n**: NUNCA `[^.]*` — expressões `{{ }}` contêm pontos. Usar `.*?` (lazy)
- `Pedido_Checkout1`: sub-agente Finalizador de Pedidos. systemMessage com IIFE de frete — se corromper, causa "invalid syntax" + loop do agente
- n8n `neverError: true` retorna erros com HTTP 200 — checar `data.code >= 400`
- RPCs bot: `get_contact_by_phone()`, `upsert_bot_contact()`, `update_contact_address()`

### Integração WhatsApp (ZuckZapGo)
- Server: `https://zuck.dynamicagents.tech`
- Workflow: `brmZAsAykq6hSMpL` — `action_switch` separa `check_status` de `smart_connect`
- SEMPRE desconecta antes de reconectar. Todos caminhos têm Wait 3s (sem Wait = 500)
- `connectWhatsappRobot()` timeout 30s. Card: verde=conectado, cinza=desconectado (NUNCA vermelho)
- NÃO mostrar telefone no card — "Conecte pelo QR Code"
- `useWhatsAppConnection.js` bloqueia se campos obrigatórios do wizard não preenchidos

### Triggers Automáticos (banco)
- `handle_new_user`: cria profile + auto-vincula franchise + cria onboarding
- `auto_generate_instance_id`: `franquia{cidade}` sem acentos, sufixo numérico para mesma cidade
- `on_franchise_created`: cria config + popula 28 produtos (cost_price planilha, sale_price = cost*2)
- `aggregate_daily_data`: pg_cron 05:00 UTC. Usa `SUM(value + COALESCE(delivery_fee, 0))`
- `stock_decrement`/`stock_revert`: gerenciam estoque em sale_items
- `deduct_inventory()` RPC existe mas NÃO é usada por triggers

### Notificações (tabela `notifications`)
- RLS (user vê só as suas), entity `Notification`
- Helpers: `notify_admins(...)`, `notify_franchise_users(franchise_id UUID, ...)`
- `NotificationBell` (dropdown, badge não-lidas, polling 30s)

## Estrutura de Pastas
```
src/
├── api/              # supabaseClient.js (custom lock bypass), functions.js (n8n webhooks)
├── entities/         # all.js (adapter Supabase)
├── components/
│   ├── acompanhamento/ # InventorySheet (admin vê estoque franqueado)
│   ├── dashboard/    # AdminDashboard, FranchiseeDashboard, StatsCard, AlertsPanel
│   ├── minha-loja/   # TabLancar, TabResultado, TabEstoque, SaleForm, ExpenseForm
│   ├── my-contacts/  # ActionPanel (ações inteligentes)
│   ├── vendedor/     # Wizard "Meu Vendedor" (WizardStepper, WizardStep, ReviewSummary, DeliveryScheduleEditor)
│   ├── onboarding/   # ONBOARDING_BLOCKS, ProgressRing, OnboardingBlock
│   ├── whatsapp/     # WhatsAppConnectionModal
│   └── ui/           # shadcn/ui + MaterialIcon.jsx
├── hooks/            # useWhatsAppConnection, useVisibilityPolling
├── lib/              # AuthContext, franchiseUtils, smartActions, whatsappUtils, healthScore
├── pages/            # Vendas, Gestao, MinhaLoja (redirect), MyContacts, Acompanhamento
└── assets/           # logo-maxi-massas-optimized.png (16KB)
```

## Convenções
- Idioma do código: inglês | Idioma da UI: português brasileiro
- Componentes UI: sempre shadcn/ui. Ícones: `<MaterialIcon icon="name" />` (NUNCA Lucide em código nosso — lucide-react é dep interna do shadcn, NÃO remover)
- Fontes: Inter (body), Plus Jakarta Sans (headings)
- Paleta:
  - Texto: `#1b1c1d` (primário) | `#4a3d3d` (secundário) | `#7a6d6d` (terciário)
  - Brand: `#b91c1c` (primary) | `#a80012` (admin) | `#d4af37` / `#775a19` (gold)
  - Financeiro: `#16a34a` (positivo) | `#dc2626` (negativo, NUNCA #b91c1c)
  - Surface: `#fbf9fa` | Input: `#e9e8e9` | Emerald (#10b981): APENAS sucesso/completo
- NUNCA cores Tailwind genéricas (text-slate-*, text-amber-*) — sempre tokens
- Formulários: react-hook-form + zod. Datas: date-fns (NÃO moment.js)
- Toast: sonner (importar de `"sonner"`, NÃO shadcn legado). NUNCA alert()/window.confirm()
- Rotas: `createPageUrl("PageName")` → `"/PageName"` (capitalizado)
- Imagens: assets locais — NUNCA URLs externas. Logo: `logo-maxi-massas-optimized.png` (16KB)
- NUNCA `new Date().toISOString().split("T")[0]` (bug timezone) — usar `format(new Date(), "yyyy-MM-dd")`

## Variáveis de Ambiente
```
VITE_SUPABASE_URL=                  # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=             # Anon key (JWT eyJ..., NÃO sb_publishable_)
SUPABASE_SERVICE_ROLE_KEY=          # Service role key (bypasses RLS)
SUPABASE_MANAGEMENT_TOKEN=          # sbp_ token para Management API
VITE_N8N_WEBHOOK_BASE=https://webhook.dynamicagents.tech/webhook
N8N_API_KEY=                        # Pode não estar no shell — ler do .env
N8N_VENDEDOR_V2_WORKFLOW_ID=w7loLOXUmRR3AzuO
N8N_VENDEDOR_V2_TESTE_WORKFLOW_ID=XqWZyLl1AHlnJvdj
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af
ZUCKZAPGO_URL=                      # zuck.dynamicagents.tech
ZUCKZAPGO_ADMIN_TOKEN=              # Admin token
```

## Webhooks n8n
- WhatsApp: `{N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`
- Config optimization: `{N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`
- Franchise invite: `{N8N_WEBHOOK_BASE}/franchise-invite` (workflow nbLDyd1KoFIeeJEF)

## UX por Role
- **Franqueado**: sidebar 6 itens + bottom nav mobile 5 slots (FAB Vender no centro)
- **Admin**: itens admin (Relatórios, Acompanhamento, Pedidos, Franqueados)
- Terminologia: "Estoque" (não "Inventário"), "Valor Médio" (não "Ticket Médio"), NÃO usar "Líquido"
- AdminHeader fixo (`md:fixed md:left-[260px]`) — ajustar se mudar sidebar width
- Wizard: 6 passos visuais, Revisão NÃO conta (X/5). Upload catálogo JPG only
- Avatar header: apenas MOBILE. Botão "REGISTRAR VENDA": `hidden md:flex`

---

## Regras por Tema

### Banco de Dados & Schema

**FKs — franchise_id em tabelas operacionais = evolution_instance_id (TEXT), NÃO UUID:**
`inventory_items`, `sales`, `contacts`, `purchase_orders`, `daily_checklists`, `expenses`, `franchise_configurations` (usa `franchise_evolution_instance_id`), `franchise_invites`, `sales_goals`

**Nomes de colunas que diferem do esperado:**
- `inventory_items.quantity` (NÃO current_stock), `.product_name` (NÃO name)
- `franchise_invites.invited_at`/`accepted_at` (NÃO created_at)
- `notifications.read` (NÃO is_read)
- `franchise_configurations.franchise_name` (NÃO store_name), `.personal_phone_for_summary` (NÃO personal_phone)
- `franchises` NÃO tem owner_email (email fica em franchise_invites)
- `onboarding_checklists`: NÃO tem total_items, started_at, user_id
- `operating_hours` JSONB NÃO existe — wizard usa `opening_hours` (TEXT) + `working_days` (TEXT)
- `payment_delivery`/`payment_pickup` são `TEXT[]`, NÃO JSONB
- Campos entrega: `free_shipping` (bool), `delivery_start_time`/`order_cutoff_time` (text HH:MM), `charges_delivery_fee` (bool)
- `delivery_schedule` JSONB: horários de entrega por dia da semana. Array de `{days, delivery_start, delivery_end, charges_fee, fee_rules}`. Campos legados sincronizados da primeira faixa

**Constraints e índices:**
- `onboarding_checklists` UNIQUE INDEX em franchise_id
- `franchise_invites` partial UNIQUE `(franchise_id, email) WHERE status = 'pending'`
- `sales.source` CHECK: 'manual', 'bot' + originais
- Índices: `idx_contacts_franchise`, `idx_contacts_phone`, `idx_sale_items_sale`, `idx_purchase_orders_franchise`, `idx_notifications_user_read`, `idx_audit_logs_franchise`

**Delete cascade:** `Franchise.deleteCascade(id, evoId)` — usa evoId para TODAS as tabelas operacionais, UUID apenas para `franchises.delete()` no final. Também deleta franqueados órfãos via `delete_user_complete()` RPC.

### Frontend & React

**Data fetching:** `mountedRef` + cleanup obrigatório. `loadError` + retry. `Promise.allSettled` para múltiplas queries. `setIsLoading(false)` antes de early return. `subDays(new Date(), N-1)` para filtros de dias.
- Reports.jsx: limits altos (Sale/Contact 2000, DailyUnique/Summary 500) — 200 trunca dados em 90d com múltiplas franquias
- Campos numéricos do Supabase podem vir como string — SEMPRE `parseFloat(s.value) || 0` nos reduces, NUNCA `s.value || 0`
- AdminDashboard: 9 queries paralelas com `Promise.allSettled` — TODAS devem ter `limit` explícito. Query de franquias tem auto-retry (crítica)
- Queries sem limite em páginas com múltiplas chamadas simultâneas causam timeout — sempre definir limits razoáveis
- Inline edit mobile: inputs dentro de `<div onClick>` PRECISAM `onClick={e => e.stopPropagation()}` + `inputMode="numeric"/"decimal"` — sem isso, click borbulha e reseta valor
- Listas vindas do Supabase: SEMPRE sort explícito no frontend (ex: `localeCompare('pt-BR')`) — ordem do banco muda após updates

**Error handling:** Mostrar `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout. `setIsSubmitting` SEMPRE em `finally`. Toast separados sucesso/erro.

**Patterns:** NUNCA importar supabase direto. supabaseClient.js tem custom lock (Navigator Locks deadlock). AdminRoute checa `isLoading`. `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval. Draft localStorage max 24h.

### UI & Design
- Fonte mínima `text-xs` (12px). Opacity mínima texto `opacity-70`. Touch target `min-h-[40px]`
- Stats: SEMPRE `grid-cols-3`. Skeletons espelham grid real. Chart labels mobile abreviados
- Páginas no Layout: NÃO `min-h-screen`. Layout centraliza com `max-w-6xl mx-auto`
- DialogContent DEVE ter DialogTitle. Badge margem: `<span>` (NÃO Badge shadcn)
- Card venda: valor = `value + delivery_fee`. FranchiseForm: 4 campos, helper inline
- Inline edit mobile: `active:` (NÃO `hover:`). Excluir contato: confirmação inline
- Material Symbols async. Favicon SVG + PWA manifest

### Onboarding
- OBRIGATÓRIO para novos (existentes podem cancelar). Tutorial (7 steps) ≠ Checklist (27 missões)
- Accordion progressivo. ProgressRing + ícone temático. Keys: bloco N = N-x. Gate (9) admin-only
- Checkbox no checkbox (não na linha). `dependsOn` para bloqueio. Auto-detecção itens 1-1, 1-2, 5-1, 6-1, 6-3
- `detectAutoItems()` usa `cfg.pix_key_data` e `cfg.max_delivery_radius_km`. `franchiseeItems` DEVE incluir `role === "auto"`
- Labels sem jargão. 5 etiquetas WhatsApp. Celebration timers canceláveis. `dispatchEvent("onboarding-started")`

### Convites
- Webhook n8n com service role (NÃO supabase.auth.admin no frontend). Workflow envia `role: 'franchisee'`
- Convite usa APENAS `inviteFranchisee()` (webhook n8n) — NÃO chamar `resetPasswordForEmail()` junto (causa e-mail duplicado)
- `inviteFranchisee()` envia `redirectTo: origin + '/set-password?type=invite'`

### Health Score & Acompanhamento
- 4 dimensões: vendas 35, estoque 25, reposição 20, setup/WhatsApp 20 (atividade REMOVIDA)
- DOIS sistemas: `healthScore.js` + `FranchiseHealthScore.jsx` — atualizar AMBOS
- AlertsPanel: APENAS vermelhos (max 3). `InventorySheet.jsx` admin vê estoque via Sheet
- Acompanhamento mostra nome da franquia (NÃO só dono)

### Features Removidas (NÃO recriar)
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, Daily Checklist (inativa), ReviewSummary campos Personalidade/Boas-vindas

### Meta-regras
- NUNCA alterar `franchise_configurations` sem verificar compatibilidade com vendedor genérico
- NUNCA commitar credenciais. RLS SEMPRE em tabelas novas. Testar mobile. Empty states obrigatórios
- Agentes escrevem sem acentos — revisar. Auditorias: verificar achados antes de corrigir
- Management API SQL com `$$`: salvar em arquivo (delimitadores corrompidos em JSON)
- Ao alterar rotas, verificar PL/pgSQL com links hardcoded (grep não encontra no banco)

---

## Scripts
```bash
npm run dev       # Dev server
npm run build     # Build produção
npm run lint      # ESLint
```
- `npm run build` pode completar sem output visível no bash (Windows). Verificar sucesso pelo timestamp de `dist/index.html`
- `dist/` está no `.gitignore` — NÃO fazer `git add dist/`

## Performance
- `React.lazy()` + `<Suspense>` via `pages.config.js`
- Vite `manualChunks`: recharts, export, vendor, ui (Radix), supabase
- AdminDashboard: agrupar no frontend (NÃO N+1). FranchiseeDashboard: usar `ctxFranchise`
- Vendas: Sale.list() limitado a 500
- nginx: `gzip_vary on`, `gzip_comp_level 6`, `keepalive_timeout 65`

## Deploy (Portainer)
- **API**: `https://porto.dynamicagents.tech/api` — header `X-API-Key`
- **Stack**: franchiseflow (ID 39, Swarm). Endpoint ID `1`. NÃO git-based
- **GitHub**: `https://github.com/nelpno/franchiseflow.git`
- **Fluxo**: `git push` → force update service (increment ForceUpdate). SEMPRE nessa ordem
- **502 por ~1 min durante rebuild** — normal. Hard refresh (Ctrl+Shift+R) após deploy
- **ctx_execute com JavaScript** para HTTP ao Portainer (NÃO shell+jq, jq quebrado no Windows)
- **PORTAINER_API_KEY** em `.claude/settings.local.json`
- Nginx: `$uri` em try_files precisa escaping. Traefik: `nelsonNet` + `certresolver=letsencryptresolver`
- SMTP: `fabrica@maximassas.com.br` (Google Workspace). Vite build VPS: `NODE_OPTIONS=--max-old-space-size=4096`

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- SQL: `POST .../projects/{ref}/database/query` com `Authorization: Bearer {sbp_token}`
- Token `sbp_` pode expirar — fallback: service_role via PostgREST
- Credenciais em `memory/reference_supabase_credentials.md`

## Roadmap
- FASE 1-7: Completas ✅ (Cleanup → Dashboard → UX → Design → Contacts → Vendedor → Notificações → Onboarding → Health Score → Gráficos → Marketing → Performance)
- **FASE 8** (em andamento):
  - Redesign onboarding ✅ | Auditoria banco ✅ | Comprovante venda ✅ | Performance ✅
  - Estoque franqueado (admin) ✅ | Toggle frete grátis + janela entrega ✅
  - Swipe tutorial | Busca global admin | Calendário Marketing | Docs PDF
  - Convite equipe interna | Permissões dono vs funcionário

## Docs de Referência
- `docs/superpowers/specs/` — Specs de design (FASE 5, Minha Loja, Pedido Compra, Onboarding)
- `docs/vendedor-generico-workflow-v2.json` — Workflow n8n vendedor V2
- `docs/criar-usuario-zuckzapgo-workflow.json` — Workflow conexão WhatsApp
- `docs/stitch-html/` — HTMLs originais do Google Stitch
