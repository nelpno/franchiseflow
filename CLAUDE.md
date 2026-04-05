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
- **Analytics**: Microsoft Clarity (projeto `w6o3hwtbya`) — heatmaps, gravações, rage clicks
- **Email**: SMTP via `fabrica@maximassas.com.br` (Google Workspace) — templates PT-BR com logo

## Arquitetura

### Camada de API (src/entities/all.js)
Adapter pattern: cada entidade expõe `.list()/.filter()/.create()/.update()/.delete()`.
Importar sempre de `@/entities/all` — NÃO usar supabase.from() diretamente nas páginas.
- Timeouts: leitura 15s, escrita 30s via `withTimeout()` — NUNCA remover
- Antes de `Entity.update()`, remover campos read-only (`id`, `created_at`, `updated_at`, `franchise`, `whatsapp_status`)
- Entities principais: `Contact`, `Sale`, `SaleItem`, `Expense`, `InventoryItem`, `PurchaseOrder`, `PurchaseOrderItem`, `Notification`, `FranchiseConfiguration`, `MarketingPayment`, `MarketingMetaDeposit`
- **EXCEÇÃO `marketing_files`**: NÃO usa entity adapter — supabase-js trava em TODAS operações nesta tabela. Marketing.jsx usa `fetch()` direto à REST API (`directList`, `directInsert`, `directDelete`) com token do localStorage e `AbortSignal.timeout(15s)`
- Storage bucket: `marketing-assets` (público). NUNCA `marketing-files` (não existe)
- Storage bucket: `marketing-comprovantes` (público, 5MB max, JPG/PNG/PDF) — comprovantes de pagamento marketing

### Autenticação (src/lib/AuthContext.jsx)
Supabase Auth com roles: admin, franchisee, manager. Login via `/login` com Supabase signInWithPassword.
- AuthContext usa getSession() + onAuthStateChange(). Timeout de 5s como safety net
- `AuthContext.Provider` value memoizado com `useMemo` (20+ consumers)
- `logout()` limpa state ANTES do `await signOut()` — UI reage instantaneamente
- Login com Google REMOVIDO — apenas email/senha
- Rota `/set-password`: detecta `type=invite`/`type=recovery` no hash OU search params (PKCE). Redireciona para `/login` quando não autenticado
- Detecção de convite usa `user_metadata.password_set` (PKCE não passa `type=invite`). SetPassword marca `password_set: true` via `updateUser()`
- `password_setup_type` usa `sessionStorage` (NÃO localStorage)
- Login.jsx: NUNCA `window.location.href` após signIn — `onAuthStateChange('SIGNED_IN')` + App.jsx `Navigate` cuida do redirect (evita race condition reload vs sessão)
- Login.jsx tem "Primeiro acesso? Defina sua senha aqui" como rede de segurança
- Login.jsx e SetPassword.jsx compartilham template visual — manter consistência
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (NÃO seta `isAuthenticated=true` com dados vazios)
- supabaseClient.js: lock auth usa mutex async in-memory (promise chaining + timeout 5s). NUNCA reverter para bypass `fn()` direto — causa race condition logout→login
- `onAuthStateChange('SIGNED_IN')`: DEVE setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s via `loginSafetyTimerRef`
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s) ignora evento stale. NUNCA chamar `getSession()` dentro do handler (risco de event loop)
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso — NUNCA depender de unmount para resetar loading state
- `ProfileRetryScreen` em App.jsx: retry + "Voltar ao login" como escape. `retryProfile` busca sessão fresca via `getSession()`
- Safety timeout auth: 8s → mostra retry UI (NÃO redirect silencioso para login)
- `logout()` e `navigateToLogin()` são `useCallback` — sem isso, `useMemo` do contextValue é inútil (20+ consumers)

### Row Level Security
- Admin vê tudo; franqueado vê apenas suas franquias (managed_franchise_ids)
- Helpers SQL: `is_admin()`, `is_admin_or_manager()`, `managed_franchise_ids()`
- `is_admin_or_manager()`: usada em SELECT/INSERT/UPDATE onde manager deve ter acesso. DELETE mantém `is_admin()` (manager NÃO deleta)
- **WORKAROUND**: `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 RLS policies dependem disso)
- profiles SELECT usa `is_admin_or_manager() OR id = auth.uid()` — NUNCA chamar `is_admin()` sozinha no profiles (recursão infinita)
- Tabelas novas DEVEM ter DELETE policy com `is_admin()` — sem ela, `.delete()` retorna sucesso mas deleta 0 rows (silencioso)
- `sale_items` RLS usa subquery: `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
- `onboarding_checklists` RLS INSERT permite admin, manager E franqueado
- Alterações em RLS policies e funções SQL tomam efeito imediatamente (sem deploy frontend)

### Filtro de Franquias (src/lib/franchiseUtils.js)
- `getAvailableFranchises(franchises, user)` — admin/manager vê todas; franchisee filtra por managed_franchise_ids
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
- `upsert_bot_contact`: protege nome existente — só preenche se vazio (NUNCA sobrescreve)
- Telefone DB: SEMPRE 11 dígitos (DDD+número). Contatos com 55 prefix são bug de LID — normalizar

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
- `SaleReceipt.jsx` + `shareUtils.js` (dynamic import): `shareImage` (Web Share API mobile / print desktop), `printImage` (iframe → `window.print()`), `generateReceiptImage` (html2canvas → blob)
- `TabLancar.jsx`: `shareData`/`receiptRef` são shared state entre share e print — desabilitar ambos botões enquanto qualquer operação estiver em andamento
- Botões de ação vendas (Compartilhar/Imprimir/Editar/Excluir): `<span className="hidden sm:inline">` para labels, icon-only no mobile
- `sale_items.cost_price` é snapshot do momento da venda. `sale_price` padrão = `cost_price * 2`
- `sale_date` é DATE only — usar `created_at` para timestamp completo

### Pedido de Compra / Reposição
- `purchase_orders` + `purchase_order_items` com trigger auto-incremento ao marcar "entregue"
- `purchase_order_items` FK é `order_id` (NÃO `purchase_order_id`)
- CHECK constraints usam português (`pendente`, `confirmado`, `em_rota`, `entregue`, `cancelado`)
- PL/pgSQL: `WHERE evolution_instance_id = NEW.franchise_id` (NÃO `WHERE id = NEW.franchise_id`)
- `notify_franchise_users(p_franchise_id UUID)` recebe UUID — resolver com subquery

### Investimento Marketing
- `marketing_payments`: 1 registro por franquia/mês. `franchise_id` = evolution_instance_id, `reference_month` = "2026-04"
- **Mês-alvo**: últimos 5 dias do mês → `reference_month` mira no mês seguinte. Lógica DEVE ser idêntica em `MarketingPaymentCard` (franqueado) e `MarketingPaymentsAdmin` (admin default month)
- `marketing_meta_deposits`: N depósitos no Meta por mês. Apenas admin cria
- UNIQUE constraint: `(franchise_id, reference_month)` — um pagamento por franquia/mês
- CHECK: `amount >= 200` (mínimo obrigatório)
- `status`: 'pending' | 'confirmed' | 'rejected'. Franqueado só pode UPDATE se `status = 'rejected'`
- `MARKETING_TAX_RATE = 0.13` em `franchiseUtils.js`. Líquido campanha = valor × 0.87
- **Franqueado**: `MarketingPaymentCard` no FranchiseeDashboard (após RankingStreak). Upload comprovante para bucket `marketing-comprovantes`
- **Admin**: Aba "Investimento" em Marketing.jsx (via Tabs). `MarketingPaymentsAdmin` mostra resumo (arrecadado/líquido/depositado/saldo) + tabela todas franquias + lista depósitos Meta
- Marketing.jsx usa `activeTab` state controlado por `Tabs.onValueChange`. Conteúdo de materiais renderizado fora do `<Tabs>` via `{activeTab === "materiais" && (...)}`
- `MetaDepositDialog`: dialog simples para registrar depósito (valor, data, notas)
- Componentes: `src/components/dashboard/MarketingPaymentCard.jsx`, `src/components/marketing/MarketingPaymentsAdmin.jsx`, `src/components/marketing/MetaDepositDialog.jsx`

### Auto-vinculação User↔Franchise
- Trigger `handle_new_user()` em auth.users (NÃO trigger separado em profiles)
- Checa franchise_invites pendentes → auto-adiciona UUID + evo_id em managed_franchise_ids
- Suporta múltiplos convites por franquia (dono + cônjuge)
- Auto-cria `onboarding_checklists` (itens 1-1 e 1-2 pré-marcados, `ON CONFLICT DO NOTHING`)
- Puxa `owner_name` da franquia para `full_name` (fallback: user_metadata, email)
- Fallback role: invites → `raw_user_meta_data->>'role'` → default `'franchisee'`

### Conversation Messages (xLLM data capture)
- `conversation_messages`: log de TODAS as mensagens do bot WhatsApp (in/out/human)
- `direction`: 'in' (cliente→bot), 'out' (bot→cliente), 'human' (franqueado respondeu na mão)
- `franchise_id` = evolution_instance_id (TEXT). `contact_phone` = 11 dígitos (sem 55)
- FK `conversation_id` → `bot_conversations(id)` ON DELETE SET NULL (auto-vinculado pela RPC)
- RPC `log_conversation_message()`: SECURITY DEFINER, dedup LID via ON CONFLICT, trunca content 10K chars
- Sub-workflow n8n `LogConversationMessage` (`9XQ5Jkccus2vtkOE`): 5 nós (trigger + validate + IF + HTTP RPC + done), todos continueOnFail=true
- Pontos de logging no V3: Log Inbound (paralelo ao GerenteGeral1, após Customer Context), Log Outbound (paralelo ao Wait5, após Enviar Mensagem), Log Human (após Gera Timeout1 no branch outcoming)
- Entity: `ConversationMessage` em `src/entities/all.js` (sem UI nesta fase)
- Migration: `supabase/conversation-messages.sql`
- Volumetria: ~1.500 rows/dia, ~550K/ano (~300MB). Sem particionamento até 1M+

### Integração Vendedor Genérico (n8n)
- V3 (`XqWZyLl1AHlnJvdj`): PRODUÇÃO ATUAL. RabbitMQ trigger, queue `zuckzapgo.events`, 100% Supabase
- V2 (`w7loLOXUmRR3AzuO`): ARQUIVADO (substituído pelo V3)
- V1 (`PALRV1RqD3opHMzk`): DESATIVADO (Base44 legado)
- Bot respeita `has_pickup`/`has_delivery` — regras condicionais no GerenteGeral1 e Pedido_Checkout1
- systemMessage fica em `node.parameters.options.systemMessage` (GerenteGeral1 e sub-agentes)
- Campo "Hoje" no systemMessage: `$now.setZone('America/Sao_Paulo').setLocale('pt-BR').toFormat(...)` — DEVE usar `setLocale('pt-BR')` para dia da semana em português (sem locale, Luxon retorna inglês e o LLM confunde com schedule em português)
- `bot_personality` removido do prompt (hardcoded "profissional") — UI de personalidade foi removida
- Regras fortes no prompt usam prefixo `>>>` (ex: `>>> IMPORTANTE: Esta unidade NAO aceita retirada`)
- Sub-workflow EnviaPedidoFechado V2: `RnF1Jh6nDUj0IRHI` — 12 nós (8 originais + 4 CAPI Purchase). V1 (`ORNRLkFLnMcIQ9Ke`) MORTO
- Credencial Supabase: `mIVPcJBNcDCx21LR`, key `supabaseApi` — DEVE ser service_role
- Credencial Google Gemini: `ezQN27UjYZVHyDEf` | Credencial OpenAI: `fIhzSXiiBXB3ad6Y`
- View `vw_dadosunidade`: mapeia franchise_configurations. SQL: `supabase/fix-vw-dadosunidade-v2-scale.sql`
  - SECURITY INVOKER (NUNCA DEFINER). Campos JSONB retornam nativo (cast `::text` quebra sub-campos)
  - Ao recriar: CONFERIR `zuck_instance_name`. Usar `DROP VIEW` + `CREATE VIEW` (replace não muda tipo)
- `whatsapp_instance_id` pode DIFERIR de `evolution_instance_id` em franquias legadas
- Telefones: SEMPRE prefixo 55 no WhatsApp. DB armazena 11 dígitos
- `blockedNumbers`: cache dinâmico via staticData, busca a cada 30min, formato 11 dígitos
- **DEDUP LID**: WhatsApp com LID envia 2 eventos por mensagem (placeholder sem Type + evento completo). Filtro `!info.Type` no `Code in JavaScript` descarta o placeholder. Se cliente reportar msgs duplicadas, verificar se filtro ainda está ativo
- Prompts usam dados estruturados: `payment_delivery[]`, `delivery_fee_rules[]` JSONB — NÃO campos texto antigos
- **Prompt do GerenteGeral1 organizado em seções**: `=== DADOS DA UNIDADE ===` (endereço, horários, frete), `=== PAGAMENTO ===`, `=== EXTRAS ===`. Header usa campos computados da view
- `delivery_schedule_text`: campo computado na view, gera texto de horários/frete por dia para o bot. Inclui frete por km OU por modalidade, e "(frete gratis)" quando `charges_fee=false`. Usado no prompt como `>>> HORARIOS E FRETE DE ENTREGA`
- `pickup_hours_text`: campo computado na view, gera texto de horários de retirada. Quando `has_custom_pickup_hours=true`, usa `pickup_schedule` JSONB; senão, fallback para `opening_hours`. Usado no prompt como `>>> HORARIOS DE RETIRADA`
- **Prompt NÃO usa mais**: `delivery_fee_rules` inline (frete está dentro de `delivery_schedule_text`), `order_cutoff_time` legado, `delivery_start_time` legado, `city`/`neighborhood` separados (já dentro de `unit_address`)
- **Pedido_Checkout1** também recebe `delivery_schedule_text` e `pickup_hours_text` para validar horários no checkout
- `valor_total` do $fromAI() pode vir 0 — calcular sum(qty * price) + frete como fallback
- `inventory_items.product_name` (NÃO `name`). Match Items: best-score fuzzy (palavras >2 chars)
- n8n API URL: `https://teste.dynamicagents.tech/api/v1` (env `N8N_API_URL`) — NÃO confundir com webhook base
- **ATENÇÃO**: `N8N_API_URL` no `.env` é apenas `https://teste.dynamicagents.tech` (sem `/api/v1`) — ao usar via fetch, concatenar `/api/v1` manualmente
- n8n API PUT settings: apenas `executionOrder`, `callerPolicy` — outros (`availableInMCP`, `binaryMode`, etc) causam 400 `must NOT have additional properties`
- **NUNCA `...item.json` em Code nodes n8n** — copia payload inteiro (13+ MB com WhatsApp). Output explícito: `{ json: { _processado: {...} } }`. Downstream acessa trigger via `$('NomeTrigger').item.json`
- **n8n sizing (2026-04-01)**: Editor 1×1core/2GB, Webhook 2×1.5core/3GB, Worker 3×1.5core/3GB (concurrency=5). Binary data em filesystem, auto-prune 7 dias
- **N8N_MIGRATE_FS_STORAGE_PATH=true** causa EBUSY crash com volume montado — NÃO usar enquanto serviços rodam
- **redis:7-alpine** crasha no Swarm — manter `redis:latest` com `--appendonly yes --maxmemory 512mb --maxmemory-policy volatile-lru`
- n8n API PUT body DEVE incluir `name` do workflow — sem ele retorna 400 `must have required property 'name'`
- n8n editor aberto SOBRESCREVE ao executar — fechar aba antes de testar
- **`R$` em expressões n8n `{{ }}`**: `R$` literal funciona APENAS dentro de IIFEs `(() => { ... })()`. Em ternários simples, o `$` é comido pelo parser
- **NUNCA usar `String.replace()` com `$` no replacement string** — `$'` é padrão especial JS que duplica conteúdo. Usar `split(old).join(new)` para substituições seguras em systemMessages
- **Regex em systemMessage n8n**: NUNCA `[^.]*` — expressões `{{ }}` contêm pontos. Usar `.*?` (lazy)
- n8n `neverError: true` retorna erros com HTTP 200 — checar `data.code >= 400`
- RPCs bot: `get_contact_by_phone()`, `upsert_bot_contact()`, `update_contact_address()`
- **V3 NÃO usa `upsert_bot_contact` RPC** — fluxo: GET_USER1 (lookup) → IF_USER1 → CREATE_USER1 (PushName) ou Edit Fields3. `upsert_bot_contact` existe mas só é chamada externamente
- **Normalização telefone LID**: `numero_real` node DEVE strip 55 (como `extractPhone()`). `Normaliza1.chat_id_whatsapp` re-adiciona 55 para envio WhatsApp
- **`AtualizaNome`**: Supabase Update direto (NÃO usa RPC). `$fromAI()` decide o nome — pode sobrescrever nomes editados manualmente. Prompt DEVE restringir a "SOMENTE quando cliente explicitamente reclamou"
- **REGRA CRÍTICA `AtualizaNome`**: Filtro DEVE ser por `id` (UUID via `Edit Fields3.contact_id`), NUNCA por `franchise_id + telefone`. Filtro por telefone vazio causa mass update em TODOS os contatos da franquia (incidente 02/04/2026 — 98 contatos corrompidos em Ribeirão Preto)
- **REGRA GERAL n8n Supabase UPDATE**: SEMPRE filtrar por `id` (UUID) em nós que fazem UPDATE. NUNCA filtrar apenas por `franchise_id + telefone` — se telefone vier vazio/undefined, n8n omite o filtro e o UPDATE atinge todas as rows
- **`memoriaLead` sub-workflow** (`xJocFaDvztxeBHvQ`): APENAS Redis (NÃO toca Supabase). Merge de memória via gpt-4o-mini. Chave: `chat_id + "_memfranq"`
- **`Customer Intelligence`**: RPC `get_customer_intelligence(p_phone, p_franchise_id)` → `Customer Context` code gera contexto por segmento (novo/lead/vip/cliente)
- **EnviaPedidoFechado `Prepare Sale Data`**: já strip 55 de `telefonelead` para `telefone_db`. `Lookup Contact` busca por 11 dígitos

#### Meta CAPI (Conversions API) — implementado 2026-04-02, fix 2026-04-03
- **Objetivo**: fechar loop atribuição Meta Ads → WhatsApp bot → compra
- **Pixel**: `5852647818195435` (Pixel de FRANQUIAS) — fallback quando franquia não tem `meta_dataset_id`
- **WABA dataset_id**: preferido sobre pixel. Cada franquia pode ter `meta_dataset_id` + `whatsapp_business_account_id` em `franchise_configurations`
- **Env vars n8n** (stack Portainer ID 4): `META_PIXEL_ID` (fallback), `META_CAPI_ACCESS_TOKEN`
- **3 eventos**: `LeadSubmitted` (novo contato com referral), `ViewContent` (catálogo enviado), `Purchase` (checkout fechado)
- **Path real ctwaClid**: `contextInfo.externalAdReply.ctwaClid` (fallback: `contextInfo.ctwaClid`). Extração no "Code in JavaScript" do V3
- **externalAdReply** em: `...contextInfo.externalAdReply` — campos: `sourceID` (ad_id), `sourceURL`, `sourceType`, `sourceApp`, `mediaURL`
- **First-touch**: ctwa salvo na criação (CREATE_USER1) E atualizado em contatos existentes (Update CTWA Existente)
- **has_meta_referral**: baseado APENAS em `!!ctwa_clid_val` — NUNCA `extAdReply` (objeto truthy causa falso positivo)
- **REGRA: NUNCA `require('crypto')` em Code nodes n8n** — sandbox Task Runner bloqueia módulos Node.js. Usar apenas `ctwa_clid` para atribuição (identificador primário Meta para CTWA)
- **REGRA: NUNCA usar Code node para Prepare CAPI no V3** — Code nodes usam task runner com pool limitado. Lead CAPI usa expressão inline no HTTP Request
- **user_data CAPI**: `ctwa_clid` + `page_id` (condicional) + `whatsapp_business_account_id` (condicional). `ph` (phone hash) removido — `require('crypto')` bloqueado pelo sandbox
- **CAPI URL**: `https://graph.facebook.com/v21.0/{dataset_id}/events` — usa `meta_dataset_id` da franchise_configurations com fallback `$env.META_PIXEL_ID`
- **continueOnFail=true** OBRIGATÓRIO em TODOS os nodes CAPI (Code + HTTP + Supabase) — nunca bloqueia checkout/bot
- **Workflows modificados**:
  - V3 (`XqWZyLl1AHlnJvdj`): Code JS extrai ctwa → CREATE_USER1 salva 9 campos → IF Has Referral → Lead CAPI (HTTP inline com dataset_id da dadosunidade, SEM Code node Prepare)
  - EnviaPedidoFechado (`RnF1Jh6nDUj0IRHI`): após Create Sale → IF Has CTWA → Prepare CAPI Data (Code, busca meta_dataset_id+waba_id, continueOnFail) → Meta CAPI Purchase (URL com dataset_id || pixel fallback) → Mark CAPI Sent
  - EnviarCatalogo1 (`3Q53jOqD6cS5yWt4`): após Send Catalog Image → [paralelo] Lookup Contact CAPI → IF Has CTWA Catalog → TRUE: Prepare ViewContent → ViewContent CAPI | FALSE: No CAPI Response (Set node). Branch CAPI é paralelo ao Set Catalog Flag → Success Response. TODOS os caminhos DEVEM terminar com nó que produz output (fix 04/04 — sem isso, `executeWorkflowTrigger` retorna "did not return a response")
- **Colunas** `contacts`: `ctwa_clid`, `meta_ad_id`, `meta_referral_source_url/type/body/at`, `meta_source_app`, `meta_media_url`, `meta_conversion_delay_seconds`
- **Colunas** `sales`: `capi_sent` (bool), `capi_event_id` (text)
- **Migrations**: `supabase/migration-meta-capi-tracking.sql`, `supabase/migration-meta-capi-extra-fields.sql`
- **INCIDENTE 03/04**: Code node "Prepare Lead CAPI" sem continueOnFail travava execuções por 300s (task runner timeout). Fix: eliminado Code node, payload inline no HTTP Request
- **INCIDENTE 04/04**: EnviarCatalogo1 retornava "did not return a response" — branch FALSE do IF Has CTWA Catalog não tinha nó conectado. Fix: adicionado "No CAPI Response" Set node
- **REGRA sub-workflows**: TODOS os caminhos de execução em sub-workflows chamados via `executeWorkflowTrigger` DEVEM terminar com nó que produz output. Branches paralelos com IF sem nó na saída FALSE causam "did not return a response"

#### Sub-agentes do Vendedor V3
- **GerenteGeral1**: orquestrador principal. LLMs: Gemini Flash (primary) + GPT-5.2 (fallback)
- **CalculaFrete1**: calcula frete via GetDistance1 + tabela de regras. Isolado do GerenteGeral para evitar que o LLM invente valores de frete
- **Pedido_Checkout1**: fecha pedido, calcula total, dispara checkout. Taxa de frete deve vir calculada pelo CalculaFrete1 antes
- **Estoque1**: consulta produtos/preços/disponibilidade no Supabase
- **Memoria_Lead1**: salva dados do cliente no CRM (nome, endereço, preferências)
- **preparo_faq1**: FAQ de modo de preparo, ingredientes, porções
- Padrão LLM sub-agentes: Gemini Flash (primary, mais barato) + gpt-4o-mini (fallback)
- Tools do GerenteGeral1: CalculaFrete1, Estoque1, Memoria_Lead1, preparo_faq1, Pedido_Checkout1, EnviarCatalogo1, avisa_franqueado
- GetDistance1 está DENTRO de CalculaFrete1 (NÃO no GerenteGeral1) — sub-workflow `q4ACGWuR3WFQjBfg` (DistanceService)
- Frete no prompt vem de `delivery_schedule_text` (por grupo de dias) — NÃO mais de `delivery_fee_rules` ou `shipping_rules_costs` inline

### n8n Loops & Sub-workflows
- Expressão `={{}}` (objeto vazio) é INVÁLIDA — causa "invalid syntax". Usar `={{ JSON.stringify({}) }}`
- Dentro de `splitInBatches` loop, `$json` após HTTP Request vira a resposta da API (NÃO o item do loop). Referenciar dados PRÉ-request via `$('NodeAnterior')`
- Nós de logging/side-effects devem ficar FORA do loop (conectar em paralelo no nó que alimenta o loop)
- Branch `outcoming` do Origem1 NÃO acessa nós do branch `incoming` via `$('NodeName')` — usar `$json` direto
- Sub-workflows precisam ser ATIVADOS (POST `/activate`) antes de serem referenciados. `executeWorkflowTrigger` v1.1 exige `workflowInputs` definidos
- HTTP Request chamando Supabase RPC: usar Response Format = "Text" (RPC retorna UUID como texto, não JSON)
- Credentials via API: n8n API não vincula credentials existentes. Usar headers inline (apikey + Authorization Bearer)

### Integração WhatsApp (ZuckZapGo)
- Server: `https://zuck.dynamicagents.tech`
- Workflow: `brmZAsAykq6hSMpL` — `action_switch` separa `check_status` de `smart_connect`
- SEMPRE desconecta antes de reconectar. Todos caminhos têm Wait 3s (sem Wait = 500)
- `connectWhatsappRobot()` timeout 30s. Card: verde=conectado, cinza=desconectado (NUNCA vermelho)
- NÃO mostrar telefone no card — "Conecte pelo QR Code"
- `useWhatsAppConnection.js` bloqueia se campos obrigatórios do wizard não preenchidos
- ZuckZapGo NÃO tem config de deduplicação de eventos — API spec (`/api/spec.yml`) confirma. Dedup deve ser feito no workflow n8n
- Eventos via FB Ads (click-to-WhatsApp) são especialmente propensos a LID duplicates

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
│   ├── financeiro/   # FinanceiroKpiCards, FranchiseFinanceTable, FranchiseFinanceDrilldown
│   ├── dashboard/    # AdminDashboard, FranchiseeDashboard, StatsCard, AlertsPanel
│   ├── minha-loja/   # TabLancar, TabResultado, TabEstoque, SaleForm, ExpenseForm
│   ├── my-contacts/  # ActionPanel (ações inteligentes)
│   ├── vendedor/     # Wizard "Meu Vendedor" (WizardStepper, WizardStep, ReviewSummary, DeliveryScheduleEditor)
│   ├── onboarding/   # ONBOARDING_BLOCKS, ProgressRing, OnboardingBlock
│   ├── whatsapp/     # WhatsAppConnectionModal
│   ├── ErrorBoundary.jsx    # Fallback raiz (auto-reload chunk errors)
│   ├── PageErrorBoundary.jsx # Boundary por rota (retry local)
│   └── ui/           # shadcn/ui + MaterialIcon.jsx
├── hooks/            # useWhatsAppConnection, useVisibilityPolling
├── lib/              # AuthContext, franchiseUtils, smartActions, whatsappUtils, healthScore, financialCalcs, marginHelpers, formatBRL
├── pages/            # Vendas, Gestao, Financeiro, MinhaLoja (redirect), MyContacts, Acompanhamento
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
N8N_VENDEDOR_V2_WORKFLOW_ID=w7loLOXUmRR3AzuO  # ARQUIVADO
N8N_VENDEDOR_V3_WORKFLOW_ID=XqWZyLl1AHlnJvdj  # PRODUÇÃO ATUAL
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
- **Admin**: itens admin (Relatórios, Financeiro, Acompanhamento, Pedidos, Franqueados)
- **Manager (Gerente)**: mesma visão do admin (AdminDashboard, nav admin, todas as franquias) mas SEM botões de excluir franquia/staff. Checagens: `role === "admin" || role === "manager"` para visão, `role === "admin"` para delete
- Terminologia: "Estoque" (não "Inventário"), "Valor Médio" (não "Ticket Médio"), NÃO usar "Líquido"
- AdminHeader fixo (`md:fixed md:left-[260px]`) — ajustar se mudar sidebar width
- Wizard: 6 passos visuais, Revisão NÃO conta (X/5). Upload catálogo JPG only
- Avatar header: apenas MOBILE. Botão "REGISTRAR VENDA": `hidden md:flex`

---

## Regras por Tema

### Banco de Dados & Schema

**FKs — franchise_id em tabelas operacionais = evolution_instance_id (TEXT), NÃO UUID:**
`inventory_items`, `sales`, `contacts`, `purchase_orders`, `daily_checklists`, `expenses`, `franchise_configurations` (usa `franchise_evolution_instance_id`), `franchise_invites`, `sales_goals`, `conversation_messages`, `bot_conversations`

**Nomes de colunas que diferem do esperado:**
- `inventory_items.quantity` (NÃO current_stock), `.product_name` (NÃO name)
- `franchise_invites.invited_at`/`accepted_at` (NÃO created_at)
- `notifications.read` (NÃO is_read)
- `franchise_configurations.franchise_name` (NÃO store_name), `.personal_phone_for_summary` (NÃO personal_phone)
- `personal_phone_for_summary`: DEVE ser salvo como 11 dígitos puros (sem 55, sem máscara). A view `vw_dadosunidade` adiciona prefixo 55 em `personal_phone_wa`. Normalizar com `.replace(/\D/g, '')` antes de salvar — WuzAPI rejeita qualquer formatação
- `contacts.meta_*`: campos Meta CAPI — ver seção "Meta CAPI" para detalhes
- `franchise_configurations.meta_dataset_id` / `.whatsapp_business_account_id`: IDs Meta para CAPI (ver seção Meta CAPI)
- `franchises` NÃO tem owner_email (email fica em franchise_invites)
- `onboarding_checklists`: NÃO tem total_items, started_at, user_id
- `operating_hours` JSONB NÃO existe — wizard usa `opening_hours` (TEXT) + `working_days` (TEXT)
- **Endereço estruturado**: `street_address` (rua+número), `neighborhood` (bairro), `city` (cidade), `cep` — wizard monta `unit_address` automaticamente no save: `"${street}, ${bairro}, ${cidade} - ${cep}"`
- `unit_address` é campo COMPUTADO no save (NÃO editar diretamente). Distance Service (CalculaFrete1) lê `unit_address` da view
- Prompt do bot usa `unit_address` SEM `| city/neighborhood` (removido — já está dentro do unit_address)
- **Horário de retirada**: `pickup_schedule` JSONB + `has_custom_pickup_hours` BOOLEAN. Formato: `[{days, open, close}]` (mesmo do OperatingHoursEditor). Quando `has_custom_pickup_hours=false`, retirada segue horário de entrega
- `pickup_hours_text`: campo computado na view `vw_dadosunidade` — texto legível de horários de retirada para o bot
- Horário de retirada fica no Step 2 (Operação) do wizard, NÃO no Step 3. Step 3 = apenas entrega
- `payment_delivery`/`payment_pickup` são `TEXT[]`, NÃO JSONB
- Campos entrega: `free_shipping` (bool), `delivery_start_time`/`order_cutoff_time` (LEGADOS, cobertos por `delivery_schedule`), `charges_delivery_fee` (bool)
- `delivery_schedule` JSONB: ver detalhes na seção "Integração Vendedor Genérico" (campos computados `delivery_schedule_text` e `pickup_hours_text` na view)

**Constraints e índices:**
- `onboarding_checklists` UNIQUE INDEX em franchise_id
- `franchise_invites` partial UNIQUE `(franchise_id, email) WHERE status = 'pending'`
- `sales.source` CHECK: 'manual', 'bot' + originais
- Índices: `idx_contacts_franchise`, `idx_contacts_phone`, `idx_sale_items_sale`, `idx_purchase_orders_franchise`, `idx_notifications_user_read`, `idx_audit_logs_franchise`

**Delete cascade:** `Franchise.deleteCascade(id, evoId)` — usa evoId para TODAS as tabelas operacionais, UUID apenas para `franchises.delete()` no final. Também deleta franqueados órfãos via `delete_user_complete()` RPC.

### Frontend & React

**Error Boundaries:** `ErrorBoundary.jsx` (raiz, fallback final + auto-reload em chunk errors) + `PageErrorBoundary.jsx` (por rota, key={location.pathname}, retry local sem F5). Toda página é envolvida em `<PageErrorBoundary>` no App.jsx

**Data fetching:** `mountedRef` + cleanup obrigatório. `loadError` + retry. `Promise.allSettled` para múltiplas queries. `setIsLoading(false)` antes de early return. `subDays(new Date(), N-1)` para filtros de dias.
- Reports.jsx: limits altos (Sale/Contact 2000, DailyUnique/Summary 500) — 200 trunca dados em 90d com múltiplas franquias
- Campos numéricos do Supabase podem vir como string — SEMPRE `parseFloat(s.value) || 0` nos reduces, NUNCA `s.value || 0`
- AdminDashboard: 9 queries paralelas com `Promise.allSettled` — TODAS devem ter `limit` explícito. Query de franquias tem auto-retry (crítica)
- Queries sem limite em páginas com múltiplas chamadas simultâneas causam timeout — sempre definir limits razoáveis
- Inline edit mobile: inputs dentro de `<div onClick>` PRECISAM `onClick={e => e.stopPropagation()}` + `inputMode="numeric"/"decimal"` — sem isso, click borbulha e reseta valor
- Listas vindas do Supabase: SEMPRE sort explícito no frontend (ex: `localeCompare('pt-BR')`) — ordem do banco muda após updates

**Error handling:** Mostrar `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout. `setIsSubmitting` SEMPRE em `finally`. Toast separados sucesso/erro.

**Patterns:** NUNCA importar supabase direto. supabaseClient.js tem custom lock (Navigator Locks deadlock). AdminRoute aceita admin E manager (checa `isLoading`). `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval. Draft localStorage max 24h.

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
- **Staff invite**: `staffInvite(email, role)` → webhook `/staff-invite` (workflow `jeGBs3eCHxc2EwfG`). Role dinâmico (admin/manager) via `$json.body.role`
- `handleAddStaff`: se usuário existe em profiles → atualiza role; se não → envia convite. Supabase 23505 (duplicate) = conta já existe em auth.users

### Financeiro (admin)
- Pagina `/Financeiro` (admin-only) — visao financeira comparativa de todas franquias
- `loadBaseData` carrega dados base UMA vez (sem dep de mes). SaleItems recarrega ao trocar mes
- SaleItem IDs em chunks de 500 para evitar limite URL Supabase
- P&L usa `calculatePnL()` de `financialCalcs.js` (shared com TabResultado)
- Markup estoque usa `getMarginTierCounts()` de `marginHelpers.jsx` — formula: `(sale - cost) / cost` (markup, NAO margem sobre receita)
- `formatBRL` centralizado em `lib/formatBRL.js` com instancia cached — NUNCA `new Intl.NumberFormat` inline
- Drill-down por franquia: P&L completo + top 5 produtos + markup estoque
- KPI cards: Faturamento Total, Lucro Estimado, Margem Media (sobre receita), Menor Margem (alerta)

### Health Score & Acompanhamento
- 4 dimensões: vendas 35, estoque 25, reposição 20, setup/WhatsApp 20 (atividade REMOVIDA)
- DOIS sistemas: `healthScore.js` + `FranchiseHealthScore.jsx` — atualizar AMBOS
- AlertsPanel: APENAS vermelhos (max 3). `InventorySheet.jsx` admin vê estoque via Sheet
- Acompanhamento mostra nome da franquia (NÃO só dono)

### Analytics (Microsoft Clarity)
- Projeto: `w6o3hwtbya` — https://clarity.microsoft.com
- Script no `index.html`, identify por user ID + role no `AuthContext.jsx`
- Segmentação: role (admin/franchisee/manager) via `clarity("set", "role", ...)`
- Dados: heatmaps, gravações de sessão, rage clicks, dead clicks, scroll depth
- Revisão quinzenal dos dados para priorizar melhorias de UX

### Features Removidas (NÃO recriar)
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, Daily Checklist (inativa), ReviewSummary campos Personalidade/Boas-vindas, `catalog_distributions` tabela removida

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
- **Stacks Portainer**: FranchiseFlow (ID 39), n8n (ID 4), Redis (ID 2), Postgres (ID 1). Endpoint ID `1`
- **Stack**: franchiseflow (ID 39, Swarm). NÃO git-based
- **GitHub**: `https://github.com/nelpno/franchiseflow.git`
- **Service ID**: `2zb27nndn5sg8zweyie6wscpc` (franchiseflow_app)
- **Fluxo deploy (2 passos OBRIGATÓRIOS)**:
  1. `git push origin main`
  2. Force update do **serviço Docker** (NÃO apenas stack update):
     ```
     GET /endpoints/1/docker/services/{SERVICE_ID} → pegar Version.Index
     POST /endpoints/1/docker/services/{SERVICE_ID}/update?version={idx}
       body: spec com TaskTemplate.ForceUpdate incrementado
     ```
- **NUNCA usar apenas stack update** (`PUT /stacks/39`) — isso NÃO recria o container quando a imagem não muda. O Swarm só recria se ForceUpdate do serviço Docker for incrementado
- **502 por ~1-2 min durante rebuild** — normal. Hard refresh (Ctrl+Shift+R) após deploy
- **Verificação pós-deploy**: usar Playwright para buscar o chunk JS e conferir se contém código novo
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
  - Meta CAPI ✅ | Conversation logging ✅ | Microsoft Clarity analytics ✅
  - Swipe tutorial | Busca global admin | Calendário Marketing | Docs PDF
  - Convite equipe interna | Permissões dono vs funcionário

## Docs de Referência
- `docs/superpowers/specs/` — Specs de design (FASE 5, Minha Loja, Pedido Compra, Onboarding)
- `docs/vendedor-generico-workflow-v2.json` — Workflow n8n vendedor V2
- `docs/criar-usuario-zuckzapgo-workflow.json` — Workflow conexão WhatsApp
- `docs/stitch-html/` — HTMLs originais do Google Stitch
