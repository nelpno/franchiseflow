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
- **Deploy**: Docker (Nginx Alpine) via Portainer

## Arquitetura

### Camada de API (src/entities/all.js)
Adapter pattern: cada entidade expõe `.list()/.filter()/.create()/.update()/.delete()`.
Importar sempre de `@/entities/all` — NÃO usar supabase.from() diretamente nas páginas.

### Autenticação (src/lib/AuthContext.jsx)
Supabase Auth com roles: admin, franchisee, manager. Login via `/login` com Supabase signInWithPassword.
AuthContext usa getSession() + onAuthStateChange(). Timeout de 5s como safety net.
Logout via supabase.auth.signOut() — React Router redireciona automaticamente (sem window.location).
Fluxo de convite: admin cria franquia + email → convite automático → franqueado vinculado.

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
- Página `MinhaLoja.jsx` com 3 abas: Lançar (vendas), Resultado (P&L), Estoque
- Tabela `sale_items`: itens de cada venda (FK sale_id + inventory_item_id), triggers `stock_decrement`/`stock_revert`
- Tabela `expenses`: despesas avulsas do franqueado (sacolas, aluguel, etc.)
- `sales` novos campos: `payment_method`, `card_fee_percent`, `card_fee_amount`, `delivery_method`, `delivery_fee`, `net_value`
- `inventory_items` novos campos: `cost_price` (admin define padrão), `sale_price` (franqueado define)
- Entities: `SaleItem`, `Expense` em `src/entities/all.js`
- Edição de venda = deletar sale_items antigos + reinserir novos (triggers cuidam do estoque)
- Deep-linking: `?tab=lancar|resultado|estoque` + `&action=nova-venda` auto-abre formulário
- Ações Inteligentes: `src/lib/smartActions.js` gera ações a partir de dados de contacts (responder, reativar, converter, fidelizar, remarketing)
- WhatsApp utils compartilhados: `src/lib/whatsappUtils.js` (formatPhone, getWhatsAppLink)

### Auto-vinculação User↔Franchise (FASE 5)
- Trigger `auto_link_franchise` em profiles: quando user cria conta, checa franchise_invites pendentes
- Se invite existe: auto-adiciona franchise UUID + evolution_instance_id em managed_franchise_ids
- Suporta múltiplos convites por franquia (dono + cônjuge, por exemplo)
- Elimina passo manual de vincular em UserManagement

### Integração Vendedor Genérico (n8n)
- Workflow ID: PALRV1RqD3opHMzk (teste.dynamicagents.tech)
- Lê configurações da tabela `franchise_configurations` (dadosunidade — AINDA via Base44, migrar para Supabase)
- Campos DEVEM manter compatibilidade com o vendedor
- JSON salvo em `docs/vendedor-generico-workflow.json` (91 nodes)

### Integração WhatsApp (ZuckZapGo)
- Server: `https://zuck.dynamicagents.tech`
- Workflow n8n: `brmZAsAykq6hSMpL` (CRIAR USUARIO ZUCK ZAP GO, 21 nodes)
- Webhook: `{N8N_WEBHOOK_BASE}/a9c45ef7-...` com `{ instanceName, action: "smart_connect"|"check_status" }`
- instanceName = `evolution_instance_id` da franquia (ex: `franquiasaojoao`)
- API headers: `Token: {user_token}` para endpoints de usuário, `Authorization: {admin_token}` para admin
- JSON salvo em `docs/criar-usuario-zuckzapgo-workflow.json`

### Triggers Automáticos (banco)
- `on_auth_user_created`: cria profile automaticamente ao criar user
- `auto_generate_instance_id`: gera evolution_instance_id no formato `franquia{cidade}` sem acentos (usa `unaccent()`)
- `on_franchise_created`: cria franchise_configuration + popula estoque com 28 produtos do catálogo
- `aggregate_daily_data`: pg_cron diário às 05:00 UTC (02:00 BRT)

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
N8N_VENDEDOR_WORKFLOW_ID=PALRV1RqD3opHMzk
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af

# ZuckZapGo (WhatsApp)
ZUCKZAPGO_URL=                      # URL do ZuckZapGo (zuck.dynamicagents.tech)
ZUCKZAPGO_ADMIN_TOKEN=              # Admin token para API
```

## Webhooks n8n
- WhatsApp connect/status: `{N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`
- Config optimization: `{N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`

## UX por Role
- **Franqueado**: menu com 5 itens (Início, Minha Loja, Meus Clientes, Marketing, Meu Vendedor)
- **Admin**: menu com itens admin (Relatórios, Acompanhamento, Franqueados)
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
31. Sales.jsx e Inventory.jsx são redirects para MinhaLoja — NÃO adicionar código nessas páginas
32. `sale_items` RLS usa subquery via sales (não tem franchise_id direto) — pattern: `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
33. `sales.source` tem CHECK constraint expandida — inclui 'manual' e 'bot' além dos originais

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
- **FASE 5 Etapa 3b**: Minha Loja hub (3 abas: Lançar/Resultado/Estoque) + Ações Inteligentes + menu 5 itens ✅
- **FASE 5 Etapa 2**: Adaptar vendedor genérico n8n (7 nós + dadosunidade Base44→Supabase) (PRÓXIMO)
- **FASE 5 Etapa 4**: Flag config vendedor + limpeza + deploy Docker

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
