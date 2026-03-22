# FranchiseFlow — Dashboard Maxi Massas

## Sobre
Dashboard de gestão de franquias da Maxi Massas (massas artesanais congeladas).
Migrado de Base44 para Supabase Cloud. Frontend React hospedado via Docker/Portainer.

## Stack
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui (Radix) + Material Symbols Outlined
- **Design System**: Atelier Gastronomique (vermelho #b91c1c, dourado #d4af37, Inter + Plus Jakarta Sans)
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

### Autenticação (src/lib/AuthContext.jsx)
Supabase Auth com roles: admin, franchisee, manager. Login via `/login` com Supabase signInWithPassword.
AuthContext usa getSession() + onAuthStateChange(). Timeout de 5s como safety net.
Logout via supabase.auth.signOut() — React Router redireciona automaticamente (sem window.location).
Fluxo de convite: admin cria franquia + email → convite automático → franqueado vinculado.
Rota `/set-password`: detecta `type=invite` ou `type=recovery` no hash da URL, persiste flag em localStorage. AuthContext expõe `needsPasswordSetup` + `clearPasswordSetup`. Login `resetPasswordForEmail` redireciona para `/set-password`.

### Row Level Security
- Admin vê tudo
- Franqueado vê apenas suas franquias (managed_franchise_ids)
- Helpers SQL: is_admin(), managed_franchise_ids()
- **WORKAROUND**: `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 RLS policies dependem disso)

### Filtro de Franquias (src/lib/franchiseUtils.js)
- `getAvailableFranchises(franchises, user)` — filtra por role, aceita UUID e evolution_instance_id
- `findFranchise(franchises, id)` — lookup por qualquer formato de ID
- Constantes: `PAYMENT_METHODS`, `DELIVERY_METHODS`, `BOT_PERSONALITIES`, `PIX_KEY_TYPES`, `WEEKDAYS`
- SEMPRE usar essas funções em vez de filtrar manualmente por managed_franchise_ids

### Contatos/Leads (contacts) — FASE 5
- Tabela `contacts` unificada substitui 45+ tabelas do projeto clientes_franquias (Supabase kypcxjlinqdonfljefxu)
- `franchise_id` = evolution_instance_id da franquia
- `status` pipeline: novo_lead → em_negociacao → cliente → recorrente → remarketing → perdido
- `purchase_count`, `total_spent`, `last_purchase_at` atualizados por trigger `on_sale_created`
- `sales.contact_id` FK opcional vincula venda a contato
- Bot n8n faz INSERT (franchise_id, telefone, nome) e UPDATE (last_contact_at) — campos simples
- UI e triggers cuidam dos campos de inteligência (status, purchase_count, etc.)
- Entity: `Contact` em `src/entities/all.js`

### Minha Loja (hub central franqueado) — FASE 5
- Página `MinhaLoja.jsx` com 4 abas: Lançar (vendas), Resultado (P&L), Estoque, Reposição (pedidos fábrica)
- Tabela `sale_items`: itens de cada venda (FK sale_id + inventory_item_id), triggers `stock_decrement`/`stock_revert`
- Tabela `expenses`: despesas avulsas do franqueado (sacolas, aluguel, etc.)
- `sales` novos campos: `payment_method`, `card_fee_percent`, `card_fee_amount`, `delivery_method`, `delivery_fee`, `net_value`
- `inventory_items` novos campos: `cost_price` (admin define padrão), `sale_price` (franqueado define)
- Entities: `SaleItem`, `Expense` em `src/entities/all.js`
- Edição de venda = deletar sale_items antigos + reinserir novos (triggers cuidam do estoque)
- Deep-linking: `?tab=lancar|resultado|estoque|reposicao` + `&action=nova-venda` auto-abre formulário
- Ações Inteligentes: `src/lib/smartActions.js` gera ações a partir de dados de contacts (responder, reativar, converter, fidelizar, remarketing)
- WhatsApp utils compartilhados: `src/lib/whatsappUtils.js` (formatPhone, getWhatsAppLink)

### Pedido de Compra / Reposição — FASE 5
- Tabela `purchase_orders` + `purchase_order_items` com trigger auto-incremento de estoque ao marcar "entregue"
- Franqueado: aba "Reposição" em Minha Loja (lista 28 produtos agrupados por tipo, sugestão de compra via giro)
- Admin: página "Pedidos" (`PurchaseOrders.jsx`) com gestão de status (pendente→confirmado→em_rota→entregue)
- Admin define frete e previsão de entrega; franqueado vê status + previsão
- Entities: `PurchaseOrder`, `PurchaseOrderItem` em `src/entities/all.js`
- Alerta admin: franqueado sem pedido há 30+ dias

### Auto-vinculação User↔Franchise (FASE 5)
- Trigger `auto_link_franchise` em profiles: quando user cria conta, checa franchise_invites pendentes
- Se invite existe: auto-adiciona franchise UUID + evolution_instance_id em managed_franchise_ids
- Suporta múltiplos convites por franquia (dono + cônjuge, por exemplo)
- Elimina passo manual de vincular em UserManagement

### Integração Vendedor Genérico (n8n)
- Workflow v1 (produção): PALRV1RqD3opHMzk — RabbitMQ trigger, Base44 (legado)
- Workflow v2 (Supabase): w7loLOXUmRR3AzuO — Webhook HTTP, tabela contacts, view vw_dadosunidade
- View `vw_dadosunidade`: mapeia franchise_configurations com nomes em inglês (backward compat)
- RPCs bot: `get_contact_by_phone()`, `upsert_bot_contact()`, `update_contact_address()`
- Tabela `daily_unique_contacts`: rastreia contatos únicos/dia (substitui Base44)
- JSON: `docs/vendedor-generico-workflow.json` (v1), `docs/vendedor-generico-workflow-v2.json` (v2)

### Integração WhatsApp (ZuckZapGo)
- Server: `https://zuck.dynamicagents.tech`
- Workflow n8n: `brmZAsAykq6hSMpL` (CRIAR USUARIO ZUCK ZAP GO, 21 nodes)
- Webhook: `{N8N_WEBHOOK_BASE}/a9c45ef7-...` com `{ instanceName, action: "smart_connect"|"check_status" }`
- instanceName = `evolution_instance_id` da franquia (ex: `franquiasaojoao`)
- API headers: `Token: {user_token}` para endpoints de usuário, `Authorization: {admin_token}` para admin
- JSON salvo em `docs/criar-usuario-zuckzapgo-workflow.json`

### Triggers Automáticos (banco)
- `on_auth_user_created`: cria profile + auto-vincula franchise (checa franchise_invites pendentes, popula managed_franchise_ids, marca invite como accepted)
- `auto_generate_instance_id`: gera evolution_instance_id no formato `franquia{cidade}` sem acentos (usa `unaccent()`)
- `on_franchise_created`: cria franchise_configuration + popula estoque com 28 produtos do catálogo
- `aggregate_daily_data`: pg_cron diário às 05:00 UTC (02:00 BRT)
- `on_purchase_order_status_change`: notifica franqueado quando pedido muda status (confirmado/em rota/entregue)
- `on_new_purchase_order`: notifica admins quando franqueado faz pedido de reposição
- `on_inventory_low_stock`: notifica franqueado quando estoque atinge mínimo

### Notificações (tabela `notifications`)
- Tabela com RLS (user vê só as suas), entity `Notification` em all.js
- Helpers SQL: `notify_admins(title, msg, type, icon, link)`, `notify_franchise_users(franchise_id, title, msg, type, icon, link)`
- Componente `NotificationBell` (dropdown, badge não-lidas, polling 30s)
- Ícones por tipo: info=blue, success=green, warning=amber, alert=red

## Estrutura de Pastas
```
src/
├── api/              # supabaseClient.js (com custom lock bypass), functions.js (n8n webhooks)
├── entities/         # all.js (adapter Supabase com interface Base44-compatível)
├── components/
│   ├── dashboard/    # AdminDashboard, FranchiseeDashboard, SmartActions, StatsCard, AlertsPanel
│   ├── minha-loja/   # TabLancar, TabResultado, TabEstoque, SaleForm, ExpenseForm
│   ├── my-contacts/  # ActionPanel (ações inteligentes por categoria)
│   ├── vendedor/     # Wizard "Meu Vendedor" (WizardStepper, WizardStep, etc.)
│   ├── checklist/    # ChecklistProgress, ChecklistHistory, ChecklistItem
│   ├── onboarding/   # ONBOARDING_BLOCKS
│   ├── whatsapp/     # WhatsAppConnectionModal
│   └── ui/           # shadcn/ui + MaterialIcon.jsx
├── hooks/            # useWhatsAppConnection.js, custom hooks
├── lib/              # AuthContext, franchiseUtils.js, smartActions.js, whatsappUtils.js
├── pages/            # MinhaLoja.jsx (hub), MyContacts.jsx, Franchises.jsx, etc.
└── assets/           # logo-maxi-massas.png, imagens estáticas
```

## Convenções
- Idioma do código: inglês (nomes de variáveis, componentes)
- Idioma da UI: português brasileiro
- Componentes UI: sempre usar shadcn/ui (src/components/ui/)
- Ícones: Material Symbols Outlined via `<MaterialIcon icon="name" />` — NÃO usar Lucide React
- Fontes: Inter (body), Plus Jakarta Sans (headings) — classes `.font-plus-jakarta`, `.font-mono-numbers`
- Paleta: primary `#b91c1c`, admin `#a80012`, gold `#d4af37`, surface `#fbf9fa`, input-bg `#e9e8e9`
- Formulários: react-hook-form + zod
- Datas: date-fns (NÃO moment.js)
- Notificações: sonner (toast)

## Variáveis de Ambiente
```
# Supabase
VITE_SUPABASE_URL=                  # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=             # Anon key (JWT eyJ...)
SUPABASE_SERVICE_ROLE_KEY=          # Service role key (bypasses RLS)
SUPABASE_MANAGEMENT_TOKEN=          # sbp_ token para Management API (SQL direto)

# n8n
VITE_N8N_WEBHOOK_BASE=https://webhook.dynamicagents.tech/webhook
N8N_API_URL=                        # URL do n8n (teste.dynamicagents.tech)
N8N_API_KEY=                        # API key do n8n
N8N_VENDEDOR_WORKFLOW_ID=PALRV1RqD3opHMzk  # v1 (Base44, produção)
N8N_VENDEDOR_V2_WORKFLOW_ID=w7loLOXUmRR3AzuO  # v2 (Supabase, teste)
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af

# ZuckZapGo (WhatsApp)
ZUCKZAPGO_URL=                      # URL do ZuckZapGo (zuck.dynamicagents.tech)
ZUCKZAPGO_ADMIN_TOKEN=              # Admin token para API
```

## Webhooks n8n
- WhatsApp connect/status: `{N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`
- Config optimization: `{N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`
- Franchise invite: `{N8N_WEBHOOK_BASE}/franchise-invite` (workflow nbLDyd1KoFIeeJEF)

## UX por Role
- **Franqueado**: menu com 5 itens (Início, Minha Loja [4 abas], Meus Clientes, Marketing, Meu Vendedor)
- **Admin**: menu com itens admin (Relatórios, Acompanhamento, Pedidos, Franqueados)
- Terminologia simplificada: "Estoque" (não "Inventário"), "Valor Médio" (não "Ticket Médio")
- Dashboard franqueado: motivacional (meta diária, ranking, streak, acesso rápido)
- Dashboard admin: monitoramento (alertas semáforo, ranking franquias, filtro de período) — AdminHeader fixo no topo (substitui Layout top bar)
- "Meu Vendedor": wizard de 6 passos (Sua Unidade, Horários, Operação, Entrega, Vendedor, Revisão)
- Upload de catálogo JPG no wizard → Supabase Storage bucket `catalog-images` (público)

## Regras Críticas
1. NUNCA alterar campos de `franchise_configurations` sem verificar compatibilidade com vendedor genérico
2. NUNCA commitar credenciais (.env, API keys)
3. RLS SEMPRE habilitado em tabelas novas
4. Testar mobile em todas as páginas novas
5. Empty states obrigatórios em todas as listagens
6. NUNCA usar is_admin() dentro de RLS policy do `profiles` (recursão infinita) — usar `USING (true)` para SELECT
7. Supabase anon key DEVE ser formato JWT (eyJ...), NÃO o novo formato sb_publishable_
8. NUNCA usar alert() — sempre sonner toast
9. NUNCA importar supabase direto nas páginas — usar entities/all.js ou AuthContext
10. Toaster DEVE ser importado de `"sonner"` no App.jsx — NÃO de `"@/components/ui/toaster"` (shadcn legado)
11. supabaseClient.js DEVE ter custom lock function para evitar deadlock do Navigator Locks API (extensões browser com SES/lockdown travam o SDK)
12. Rotas usam `createPageUrl("PageName")` que gera `"/PageName"` (capitalizado) — NUNCA usar paths lowercase
13. Base44 foi COMPLETAMENTE removido — NÃO existe mais `base44Client.js`, `@base44/sdk`, nem `lib/entities.js`
14. DailyChecklist usa `franchise_id` = `evolution_instance_id` da franquia, NÃO o UUID
15. Entity de estoque é `InventoryItem` (NÃO `Inventory`)
16. `inventory_items.franchise_id` e `daily_checklists.franchise_id` armazenam `evolution_instance_id` (text), NÃO UUID — usar `franchise.evolution_instance_id` ao filtrar essas tabelas
17. NUNCA usar `window.confirm()` — usar Dialog do shadcn/ui ou estado de confirmação
18. Ao criar franquia de teste via SQL, chamar trigger manualmente ou popular estoque/config separadamente
19. Ícones DEVEM ser Material Symbols via `<MaterialIcon>` — NUNCA Lucide (migrado na FASE 4)
20. `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id — filtrar com `getAvailableFranchises()` de `src/lib/franchiseUtils.js`
21. `evolution_instance_id` formato: `franquia{cidade}` sem acentos (ex: `franquiasaojoao`) — trigger usa `unaccent()`
22. AdminDashboard tem header fixo próprio (AdminHeader) — Layout top bar é ESCONDIDA quando admin está no Dashboard
23. "Meu Vendedor" é wizard de 6 passos — componentes em `src/components/vendedor/`
24. Upload de catálogo vai para Supabase Storage bucket `catalog-images` (público)
25. Entity de contatos é `Contact` (tabela `contacts`) — usar `franchise_id` = `evolution_instance_id`
26. Bot n8n grava apenas: franchise_id, telefone, nome, last_contact_at — NÃO gravar status, purchase_count etc (triggers cuidam)
27. Trigger `auto_link_franchise` vincula user a franchise automaticamente via invite — suporta múltiplos emails por franquia
28. Catálogo foi removido (FASE 4) — NÃO existe mais Catalog.jsx nem CatalogProduct entity
29. `DELIVERY_METHODS` em franchiseUtils é config do vendedor genérico (own_fleet/third_party/both) — NÃO usar para entrega de venda individual (que é 'retirada'/'delivery')
30. Ao remover página do menu, verificar TODOS os links internos (botões, QuickAccess, FAB, navigate calls) — usar `grep createPageUrl("OldPage")` e `grep "/OldPage"`
31. Sales.jsx e Inventory.jsx foram DELETADOS (eram redirects) — NÃO recriar
32. `sale_items` RLS usa subquery via sales (não tem franchise_id direto) — pattern: `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
33. `sales.source` tem CHECK constraint expandida — inclui 'manual' e 'bot' além dos originais
34. Produtos agrupados por tipo (primeira palavra do nome): Canelone, Conchiglione, Massa, Nhoque, Rondelli, Sofioli, Molho, Outros — manter ordem fixa nos formulários e estoque
35. Sacolas/embalagens são DESPESAS (aba Resultado), NÃO itens de estoque — simplificar pro franqueado
36. `sale_items.cost_price` é snapshot do momento da venda — se popular cost_price depois, atualizar retroativamente com UPDATE JOIN
37. `franchise_configurations` usa FK `franchise_evolution_instance_id` (text), NÃO `franchise_id`
38. Tabela `contacts` NÃO tem coluna `source` — não usar em INSERTs
39. NUNCA usar `managed_franchise_ids[0]` direto para filtrar dados — resolver `evolution_instance_id` via franchise lookup (bug corrigido em FranchiseeDashboard + Layout)
40. `sale_price` padrão = `cost_price * 2` (100% markup) — margem mínima recomendada 80% (cost_price * 1.8)
41. Admin pode adicionar produto padrão via RPC `add_default_product()` — popula em todas franquias
42. Validação WhatsApp: `useWhatsAppConnection.js` bloqueia conexão se campos obrigatórios do wizard não preenchidos
43. Login com Google REMOVIDO — apenas email/senha via Supabase Auth
44. `franchise_invites.franchise_id` FK aponta para `franchises.evolution_instance_id` (NÃO UUID) — usar evoId ao criar invites
45. Deploy é Docker Swarm (NÃO compose standalone) — rede `nelsonNet`, Traefik certresolver = `letsencryptresolver`
46. Redeploy: push pro GitHub + force update do service via Portainer API (ForceUpdate increment)
47. Invite de franqueado usa webhook n8n (`franchise-invite`) com service role — NÃO usar supabase.auth.admin no frontend (anon key não tem permissão)
48. Trigger `on_franchise_created` popula 28 produtos com cost_price da planilha + sale_price = cost_price * 2 (via `auto_populate_inventory`)
49. Rota `/set-password` implementada — detecta invite/recovery tokens, força definição de senha antes de acessar dashboard
50. Auto-link franchise: lógica DEVE estar dentro de `handle_new_user()` (trigger em auth.users), NÃO como trigger separado em profiles — contexto Supabase Auth não executa triggers BEFORE INSERT em profiles corretamente
51. `catalog_products.price` é preço de CUSTO (franqueado paga à fábrica) — referência: `PLANILHA PEDIDO 082025.xlsx` na raiz — sale_price = cost * 2
52. Delete franquia requer cascade: usar `Franchise.deleteCascade(id, evoId)` — limpa sale_items, sales, purchase_orders, contacts, inventory, config, invites ANTES de deletar
53. Categorias de estoque: apenas Massas, Molhos, Outros — Recheios/Embalagens/Insumos NÃO são estoque (embalagens são despesas na aba Resultado)
54. Vite build no Windows produz output silencioso — verificar sucesso com `ls dist/index.html`
55. `handle_new_user` puxa `owner_name` da franquia para `full_name` do profile — fallback: user_metadata, depois email

## Scripts
```bash
npm run dev       # Dev server (Vite)
npm run build     # Build produção
npm run lint      # ESLint
npm run typecheck # TypeScript check
```

## Roadmap
- Sprint 1: Cleanup técnico + terminologia ✅
- Sprint 2: Dashboard por role (admin vs franqueado) ✅
- Sprint 3: UX improvements (3 ondas — bugs, labels, features) ✅
- FASE 4: Design Stitch + Material Symbols + padronização Atelier ✅
- **FASE 5 Etapa 1**: Tabela contacts + auto-vinculação + triggers ✅
- **FASE 5 Etapa 3a**: Franqueados unificado (absorveu Usuários) + Meus Clientes (pipeline) + Vendas com auto-complete ✅
- **FASE 5 Etapa 3b**: Minha Loja hub (4 abas: Lançar/Resultado/Estoque/Reposição) + Ações Inteligentes + Pedido de Compra + menu 5 itens ✅
- **FASE 5 Etapa 2**: Vendedor genérico migrado (10 nós Supabase, view, RPCs, prompt otimizado) ✅
- **FASE 5 Etapa 4**: Flag config vendedor + limpeza + deploy Docker (deploy ✅, config vendedor pendente)
- **FASE 5 Etapa 5**: Onboarding completo (tela senha ✅, trigger cost_price ✅, SPF/DKIM ✅, UX formulário ✅, auto-link ✅)
- **Deploy produção**: app.maximassas.tech via Docker Swarm + Traefik SSL ✅
- **FASE 6**: Notificações (sino funcional + triggers automáticos) ✅
- **FASE 7 — Roadmap 10/10** (próxima):
  - 7a: Onboarding obrigatório (tutorial primeiro acesso, melhorar wizard Meu Vendedor) — OBRIGATÓRIO para novos, só existentes podem cancelar
  - 7b: Dropdown seletor franquia + criar contato inline + health score admin
  - 7c: Gráficos históricos + log auditoria + exportar PDF/Excel
  - 7d: Histórico WhatsApp + dashboard comparativo + filtros avançados

## Deploy (Portainer)
- **Portainer API**: `https://porto.dynamicagents.tech/api` — header `X-API-Key`
- **Stack**: `franchiseflow` (ID 39, Type=Swarm)
- **Rede**: `nelsonNet` (overlay, compartilhada com Traefik)
- **Domínio**: `app.maximassas.tech` → A record → `82.29.60.220` (DNS only, sem proxy Cloudflare)
- **GitHub**: `https://github.com/nelpno/franchiseflow.git` (público)
- **Fluxo de deploy**: push GitHub → force update service Portainer → container re-clona, builda e serve via nginx
- **SMTP**: `fabrica@maximassas.com.br` via Google Workspace (smtp.gmail.com:587) — configurado no Supabase Auth
- **Nginx gotcha**: `$uri` em `try_files` dentro de docker-compose precisa de escaping especial — usar `echo` line-by-line (NÃO printf, NÃO `$$uri`)
- **Traefik labels obrigatórias**: `traefik.docker.network=nelsonNet` + `traefik.http.routers.*.rule=Host(...)` + `traefik.http.routers.*.tls.certresolver=letsencryptresolver`
- **Vite build no VPS**: pode travar sem `NODE_OPTIONS=--max-old-space-size=4096` — adicionar no Dockerfile/entrypoint

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- Executar SQL: `POST https://api.supabase.com/v1/projects/{ref}/database/query` com header `Authorization: Bearer {sbp_token}`
- SQL scripts ficam em `supabase/*.sql`

## Docs de Referência
- `docs/superpowers/specs/2026-03-21-fase5-unificacao-design.md` — Spec FASE 5 (unificação + contacts + vendedor)
- `docs/superpowers/plans/2026-03-21-fase5-etapa1-database.md` — Plano implementação Etapa 1
- `docs/vendedor-generico-migracao-n8n.md` — Plano migração 7 nós do vendedor genérico
- `docs/vendedor-generico-workflow.json` — Workflow n8n vendedor (91 nodes)
- `docs/criar-usuario-zuckzapgo-workflow.json` — Workflow conexão WhatsApp (21 nodes)
- `docs/stitch-html/` — 5 HTMLs originais do Google Stitch (referência visual)
- `docs/analise-ux-completa.md` — Análise UX por persona
- `docs/analise-vinculacao-vendedor.md` — Campos do vendedor genérico
- `docs/superpowers/specs/2026-03-20-dashboard-por-role-design.md` — Spec dashboard por role
- `docs/superpowers/specs/2026-03-21-minha-loja-design.md` — Spec Minha Loja (hub franqueado, 4 personas, abordagem híbrida)
- `docs/superpowers/plans/2026-03-21-minha-loja-implementation.md` — Plano implementação Minha Loja (12 tasks, 6 chunks)
- `docs/superpowers/specs/2026-03-21-pedido-compra-design.md` — Spec Pedido de Compra (franqueado → admin → estoque)
- `docs/superpowers/plans/2026-03-21-fase5-etapa2-vendedor-n8n.md` — Plano migração vendedor (7→10 nós)
