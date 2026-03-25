# FranchiseFlow — Dashboard Maxi Massas

## Sobre
Dashboard de gestão de franquias da Maxi Massas (massas artesanais congeladas).
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
- **Vendas** (`Vendas.jsx`): página dedicada de registro de vendas (TabLancar standalone, sem tab bar)
  - Deep-linking: `?action=nova-venda` auto-abre formulário, `&phone=` pré-seleciona contato
  - FAB mobile "Vender" aponta para `/Vendas?action=nova-venda`
- **Gestão** (`Gestao.jsx`): página com 3 abas (Resultado, Estoque, Reposição)
  - URL param: `?tab=resultado|estoque|reposicao` (default: resultado)
- `MinhaLoja.jsx`: redirect inteligente para backward-compat (gestão tabs → `/Gestao`, resto → `/Vendas`)
- Tabela `sale_items`: itens de cada venda (FK sale_id + inventory_item_id), triggers `stock_decrement`/`stock_revert`
- Tabela `expenses`: despesas avulsas do franqueado (sacolas, aluguel, etc.)
- `sales` novos campos: `payment_method`, `card_fee_percent`, `card_fee_amount`, `delivery_method`, `delivery_fee`, `net_value`
- `inventory_items` novos campos: `cost_price` (admin define padrão), `sale_price` (franqueado define)
- Entities: `SaleItem`, `Expense` em `src/entities/all.js`
- Edição de venda = deletar sale_items antigos + reinserir novos (triggers cuidam do estoque)
- Ações Inteligentes: `src/lib/smartActions.js` gera ações a partir de dados de contacts (responder, reativar, converter, fidelizar, remarketing)
- WhatsApp utils compartilhados: `src/lib/whatsappUtils.js` (formatPhone, getWhatsAppLink)

### Pedido de Compra / Reposição — FASE 5
- Tabela `purchase_orders` + `purchase_order_items` com trigger auto-incremento de estoque ao marcar "entregue"
- Franqueado: aba "Reposição" em Gestão (lista 28 produtos agrupados por tipo, sugestão de compra via giro)
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
- Workflow v1 (produção): PALRV1RqD3opHMzk — RabbitMQ trigger, Base44 (legado, NÃO mexer)
- Workflow v2 (Supabase): w7loLOXUmRR3AzuO — Webhook HTTP, 100% Supabase
- V2 usa: `vw_dadosunidade` (config), `inventory_items` (estoque), `contacts` (leads), `daily_unique_contacts`
- V2 nós migrados: `planilha_estoque1` (supabaseTool→inventory_items, filtro franchise_id=instance.Name), GET/CREATE/UPDATE contacts, DailyUniqueContact
- V2 prompts reescritos para dados estruturados do wizard: `delivery_fee_rules` JSONB, `payment_delivery`/`payment_pickup` TEXT[]
- Sub-workflow EnviaPedidoFechado V2: `RnF1Jh6nDUj0IRHI` — 8 nós, zero AI, dados estruturados via $fromAI(). V1 (`ORNRLkFLnMcIQ9Ke`) usa Base44 (morto, NÃO usar)
- EnviaPedidoFechado1 passa dados estruturados: itens_json, pagamento, modalidade, endereco, valor_frete, valor_total (via $fromAI) + inputs fixos (server_url, api, instance, telefones, nomecliente)
- Credencial Supabase no n8n: `mIVPcJBNcDCx21LR` (franchiseflow_supabase) — DEVE ser service_role
- View `vw_dadosunidade`: mapeia franchise_configurations. SQL referência: `supabase/fix-vw-dadosunidade-v2-scale.sql`
- View campos computed: `accepted_payment_methods` (de payment_delivery+payment_pickup), `shipping_rules_costs` (de delivery_fee_rules), `personal_phone_wa` (55+telefone), `zuck_instance_name` (de whatsapp_instance_id, fallback evo_id)
- `whatsapp_instance_id` em franchise_configurations pode DIFERIR de `evolution_instance_id` — franquias legadas têm nomes diferentes no ZuckZapGo. Nó dadosunidade filtra por `zuck_instance_name`
- Telefones WhatsApp: SEMPRE com prefixo 55. Usar `personal_phone_wa` da view. DB armazena 11 dígitos (sem 55)
- Workflow memória: `xJocFaDvztxeBHvQ` (memoria_lead) — sub-workflow chamado pelo agente
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
├── pages/            # Vendas.jsx, Gestao.jsx, MinhaLoja.jsx (redirect), MyContacts.jsx, etc.
└── assets/           # logo-maxi-massas.png, imagens estáticas
```

## Convenções
- Idioma do código: inglês (nomes de variáveis, componentes)
- Idioma da UI: português brasileiro
- Componentes UI: sempre usar shadcn/ui (src/components/ui/)
- Ícones: Material Symbols Outlined via `<MaterialIcon icon="name" />` — NÃO usar Lucide React
- Fontes: Inter (body), Plus Jakarta Sans (headings) — classes `.font-plus-jakarta`, `.font-mono-numbers`
- Paleta (tokens Stitch):
  - Texto primario (on-background): `#1b1c1d` | Texto em cards (on-surface): `#1d1b1b`
  - Texto secundario (on-surface-variant): `#4a3d3d` | Texto terciario (outline): `#7a6d6d`
  - Primary (marca): `#b91c1c` | Admin: `#a80012` | Gold: `#d4af37` | Gold text: `#775a19`
  - Financeiro positivo: `#16a34a` | Financeiro negativo: `#dc2626` (NUNCA usar #b91c1c para prejuizo)
  - Surface: `#fbf9fa` | Input-bg: `#e9e8e9` | Error-container: `#ffdad6`
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
- **Franqueado**: sidebar 6 itens (Início, Vendas, Gestão [3 abas], Meus Clientes, Marketing, Meu Vendedor) + bottom nav mobile 5 slots (Início, Gestão, FAB Vender, Clientes, Vendedor)
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
38. Tabela `contacts` tem colunas `source` (default 'manual', valores: manual/bot/whatsapp) e `campaign_name` (TEXT) — bot n8n deve setar source='bot' ao inserir
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
56. Deploy Portainer retorna 502 por ~1 min durante rebuild — é normal, aguardar
57. DialogContent (Radix) DEVE ter DialogTitle — sem ele gera warning de acessibilidade no console
58. Botão WhatsApp em contatos: desabilitar com "Sem telefone" quando `telefone` vazio — NÃO esconder (usuário precisa saber que existe)
59. StatsCard usa breakpoints responsivos (text-lg/sm:text-2xl, p-3/sm:p-5) — grid-cols-3 fixo no mobile
60. Onboarding é OBRIGATÓRIO para franqueados novos — NÃO adicionar botão "Pular". Só franqueados existentes (migração) podem cancelar
61. Agentes/subagents escrevem strings sem acentuação — SEMPRE revisar textos gerados por agentes
62. Fonte mínima em UI: `text-xs` (12px) — NUNCA usar `text-[10px]` exceto em badges decorativos
63. Opacity mínima em textos: `opacity-70` — NUNCA usar `opacity-40/50/60` em texto legível
64. Touch target mínimo mobile: `min-h-[40px] min-w-[40px]` em botões interativos
65. Deploy Portainer: stack NÃO é git-based — usar force update do service (GET spec → increment ForceUpdate → POST update)
66. Conteúdo centralizado: Layout.jsx tem `max-w-6xl mx-auto` no wrapper de children
67. OnboardingWelcome (tutorial) ≠ Onboarding (checklist operacional) — tutorial redireciona para checklist ao finalizar
68. Páginas dentro do Layout NÃO devem ter `min-h-screen` — Layout cuida da altura. Apenas Login, SetPassword e OnboardingWelcome (standalone) usam
69. Stats cards dashboard franqueado: sempre `grid-cols-3` (NUNCA grid-cols-2) — são 3 cards (Vendas, Faturamento, Valor Médio)
70. Chart labels mobile: usar abreviações (Seg, Ter, Qua) — labels longos não cabem em 375px
71. Botão "REGISTRAR VENDA" fixo: `hidden md:flex` — no mobile o FAB "Vender" no bottom nav aponta para `/Vendas?action=nova-venda`
72. Personalidade do bot REMOVIDA da UI do wizard — campo `bot_personality` mantém default no banco para n8n
73. ReviewSummary.jsx: não mostrar Personalidade nem Boas-vindas — campos removidos do wizard
74. `Franchise.list()` no Onboarding — NÃO usar `.filter({status:"active"})` que pode excluir franquias válidas
75. Avatar no header: apenas MOBILE (desktop removido — sidebar footer tem nome+logout). `showMobileMenu` state abre dropdown com perfil + logout
76. Marketing: botão "Copiar legenda" usa navigator.clipboard — description é a legenda do post
77. Cores financeiras: positivo/lucro = `#16a34a`, negativo/prejuizo = `#dc2626` — NUNCA usar brand red `#b91c1c` para dados financeiros negativos (confunde marca com alarme)
78. Categoria estoque auto-detectada: `getCategoryFromName()` em TabEstoque.jsx — prefixos Canelone/Conchiglione/Massa/Nhoque/Rondelli/Sofioli→Massas, Molho→Molhos, resto→Outros
79. AdminHeader usa `md:fixed md:left-[260px]` para alinhar com sidebar (w-[260px]) — ao mudar largura do sidebar, ajustar AdminHeader junto
80. Onboarding usa accordion progressivo — blocos colapsados, só o ativo expande, auto-scroll ao completar bloco. OnboardingBlock recebe `isExpanded` e `onToggleExpand` como props
81. Onboarding agrupa itens por role: franchisee/both primeiro, franchisor separado com seção "Aguardando franqueador" — não misturar na mesma lista
79. Avatar header desktop REMOVIDO (redundante com sidebar footer) — manter apenas no mobile (`showMobileMenu`)
80. Terminologia financeira: NÃO usar "Líquido" (jargao contabil) — franqueado nao entende. Resumo de vendas mostra apenas Total
81. Badge de margem na venda: `<span>` simples (NÃO `<Badge>` shadcn que parece clicavel) — 3 estados: verde (≥25%), amber (<25%), vermelho (negativo)
82. FranchiseForm (Nova Franquia): apenas 4 campos (nome, cidade, owner_name, email) — WhatsApp removido (configurado no wizard Meu Vendedor). NÃO usar Tooltip/FieldHelp (não funciona em mobile) — usar texto helper inline
83. Deploy Portainer: curl bloqueado pelo context-mode hook — usar `mcp ctx_execute` com shell para chamadas HTTP ao Portainer API
84. useCallback com dependências entre si: definir a função referenciada ANTES da que a usa (ordem importa) — referência circular causa tela branca sem erro no console
85. Cards de franquia (Franchises.jsx): telefone so aparece quando preenchido, "Contatos Hoje" removido (admin ve no dashboard). Campos opcionais devem ser condicionais — NÃO mostrar linhas vazias
86. Navegação franqueado separada em Vendas (ação frequente) e Gestão (consultas periódicas) — "Minha Loja" é redirect backward-compat. Sidebar: Vendas (`point_of_sale`), Gestão (`bar_chart`). Bottom nav: Gestão no slot 2, FAB Vender no centro
87. MinhaLoja.jsx é APENAS redirect — NÃO adicionar lógica nele. URLs antigas `/MinhaLoja?tab=estoque` redirecionam automaticamente para `/Gestao?tab=estoque`
88. Queries de leitura (`list`/`filter`/`me`) em `entities/all.js` têm timeout de 15s via `withTimeout()` — NUNCA remover
89. Páginas com data fetching DEVEM ter: (1) `mountedRef` + cleanup no useEffect, (2) `loadError` state, (3) botão "Tentar novamente" — pattern em MyContacts.jsx como referência
90. NUNCA usar `useEffect(() => { loadData(); }, [])` sem guard `mountedRef` — causa state updates em componente desmontado durante navegação rápida
91. Deep-links atualizados: `/Vendas?action=nova-venda&contact_id=UUID&phone=X` (vendas — contact_id prioritário, phone fallback), `/Gestao?tab=resultado|estoque|reposicao` (gestão) — NUNCA usar `/MinhaLoja?tab=` em código novo
92. MyContacts tem botão "Novo Cliente" — cria contato com source='manual', franchise_id=evolution_instance_id. Telefone é opcional
93. Rotas protegidas (AdminRoute) DEVEM checar `isLoading` antes de renderizar children — sem isso, conteúdo admin pisca durante carregamento do perfil
94. Upload Marketing: validação obrigatória de tipo (image/pdf/mp4) e tamanho (max 20MB) ANTES do upload — seguir pattern de CatalogUpload.jsx
95. PORTAINER_API_KEY configurada em `.claude/settings.local.json` (env) — disponível automaticamente no shell das sessões
96. Exceção regra 63: `text-[#4a3d3d]/40` é OK para texto `line-through` (riscado) e ícones decorativos — a regra /70 aplica apenas a texto legível
97. Loading skeletons DEVEM espelhar o grid do componente real — ex: stats grid-cols-3 = skeleton grid-cols-3 (evita layout shift)
98. Login.jsx e SetPassword.jsx compartilham template visual — ao alterar um, verificar consistência no outro (copyright, aria-labels, cores)
99. NUNCA usar cores Tailwind genéricas (text-slate-*, text-amber-*) — sempre tokens do design system (#1b1c1d, #4a3d3d, #775a19, etc.)
100. Toast misto sucesso/erro é UX ruim — separar em `toast.success()` + `toast.error()` independentes
101. `onboarding_checklists` tabela real NÃO tem `total_items` nem `started_at` — schema.sql pode estar desatualizado vs banco real. Sempre verificar colunas via SQL antes de INSERT
102. Supabase PKCE flow: `type=invite` pode vir no hash (implicit) OU search params (PKCE) — AuthContext detecta ambos + faz `exchangeCodeForSession()` quando `?code=` presente
103. CatalogUpload restrito a JPG only (n8n compat) — timeout 30s via `Promise.race()` para evitar loading infinito
104. PaymentMethodChart: mapa `PAYMENT_COLORS` deve incluir TODOS os values possíveis de `sales.payment_method` (card_machine, pix, dinheiro, etc.) — fallback mostra key bruta do banco
105. Entity `create()`, `update()` e `delete()` em `all.js` DEVEM usar `withTimeout(30000)` — sem timeout, operações de escrita travam indefinidamente
106. `setIsSubmitting`/`setIsUploading` SEMPRE em `finally` block — NUNCA após try/catch (se catch re-throws ou componente desmonta, loading trava eternamente)
107. Antes de `Entity.update()`, fazer destructuring para remover campos read-only/UI-only (`id`, `created_at`, `updated_at`, `franchise`, `whatsapp_status`) — Supabase rejeita colunas inexistentes
108. Storage bucket policies: `catalog-images` INSERT/UPDATE/DELETE = authenticated (NÃO admin-only), SELECT = público. Verificar RLS do storage ao criar novos buckets
109. `contacts.telefone` é nullable — unique constraint parcial `WHERE telefone IS NOT NULL AND telefone != ''`. Enviar `null` (NÃO string vazia) quando sem telefone
110. Draft localStorage: ao comparar `draft.savedAt` com `config.updated_at`, tratar `updated_at` null como `Date.now()` (NÃO como 0) — evita draft antigo sobrescrever dados reais. Max 24h de idade
111. WhatsAppHistory.jsx REMOVIDO (FASE 8) — franqueados consultam histórico no próprio WhatsApp. NÃO recriar
112. Onboarding redesenhado como "missões" (27 items) — NÃO voltar para "checklist" com 45+ items. Bloco 5 "Configure Seu Vendedor" é 1 item que cobre todo o wizard
113. Gate Block (bloco 9) visível APENAS para admin — franqueado vê celebração ao completar 8 missões, sem burocracia
114. OnboardingBlock checkbox: click no checkbox (não na linha toda) — `onClick` no div do checkbox, não no wrapper da row
115. Fornecedor uniformes: Rodrigo — D'Momentus Uniformes, WhatsApp (18) 99610-9903
116. Card conexão WhatsApp (Meu Vendedor): NÃO mostrar telefone — número vem do ZuckZapGo, não do cadastro. Mostrar "Conecte pelo QR Code"
117. Onboarding keys consistentes: bloco N usa keys N-x (ex: bloco 3 = keys 3-1, 3-2, 3-3). Gate usa 9-x. Key 9-4 é tráfego pago (era 9-5)
118. Telefone em contacts DEVE ser normalizado antes de salvar: `normalizePhone()` em `whatsappUtils.js` — strip 55, remove não-dígitos, salva 11 dígitos (DDD+número). RPCs `upsert_bot_contact` e `get_contact_by_phone` já normalizam no banco
119. `sales.contact_id` FK usa ON DELETE SET NULL — excluir contato preserva vendas (perde vínculo, não perde dado financeiro)
120. Operações de escrita (create/update/delete) DEVEM mostrar erro real do Supabase no toast — NUNCA mensagem genérica. Usar `getErrorMessage()` que detecta sessão expirada, duplicata e timeout
121. Nomes, endereços e bairros DEVEM usar `capitalize()` antes de salvar — respeita preposições (da, de, do, das, dos, e, a, o). Função em MyContacts.jsx
122. Excluir contato: confirmação inline no dialog de edição (NÃO window.confirm). Botão "Excluir" à esquerda, "Cancelar"/"Salvar" à direita
123. ProgressRing.jsx (`src/components/onboarding/`) — SVG circular reutilizável. Props: size, progress (0-100), color, isComplete, icon. Clamp automático, fallback icon para número
124. OnboardingBlock redesenhado: border-left cor da missão, ProgressRing 48/40px com ícone temático, subtítulo contextual ("Falta 1 item!", "Pronta para você", "Missão completa!"). Cada bloco tem field `icon` em ONBOARDING_BLOCKS
125. Cores emerald (#10b981, #059669, #ecfdf5) são exceção semântica à regra 99 — usadas APENAS para estados de sucesso/completo, NÃO são cores de marca
126. Celebration timers (auto-expand, glow, faixa) DEVEM ser canceláveis por clique do usuário — `celebrationTimerRef` limpo em `handleManualToggle`. UI nunca trava durante celebração
127. Deploy Portainer: usar `ctx_execute` (shell) para chamadas HTTP — Bash bloqueado pelo context-mode hook para curl com output grande
128. ITEM_DETAILS.jsx e textos de onboarding DEVEM referenciar categorias do sistema (Massas, Molhos, Outros), NÃO tipos individuais de produto (Canelone, Rondelli, etc.) — tipos já aparecem nas abas do estoque
129. Imagens/logos DEVEM usar assets locais (`src/assets/`) — NUNCA URLs externas (Google, CDN) que podem expirar. Login e SetPassword importam `logo-maxi-massas.png`
130. Inline edit mobile (TabEstoque cards): fundo `bg-[#e9e8e9]/50` + ícone edit 12px + `active:` (não `hover:`) — Input usa `bg-transparent border-none p-0 font-bold` para não causar salto de layout
131. Onboarding auto-detecção: itens 1-1, 1-2 (contrato/kick-off) sempre auto-marcados. Itens 5-1 (wizard), 6-1 (pedido), 6-3 (estoque) detectados via queries no load. Role `auto` = não clicável pelo franqueado
132. Labels onboarding SEM jargão: "pipeline" → "organização", "wizard" → "formulário". Preços 2-3 já vêm pré-configurados (cost*2) — franqueado só confere, NÃO "define com CS"
133. `detectAutoItems()` em Onboarding.jsx roda no load E no create — auto items são mergeados e salvos silenciosamente. Erros de detecção são non-fatal (catch sem rethrow)
134. Wizard "Meu Vendedor" tem 6 steps visuais mas Revisão (step 6) NÃO conta como etapa — contador mostra X/5, não X/6. Revisão é apenas visualização do resultado
135. Deploy Portainer: endpoint ID é `1` (name: "primary") — NÃO usar endpoint 2 (não existe). `ctx_execute` com JavaScript (não shell+jq — jq está quebrado no Windows)
136. Onboarding items com detalhes: texto do label E ícone "?" são ambos clicáveis para expandir/colapsar — cursor pointer no span quando `details` existe
137. `delivery_fee` é RECEITA do franqueado (cobrado do cliente) — NÃO deduzir no resultado. TabResultado: Vendas + Frete cobrado = Total recebido, depois deduções (custo, taxas, despesas)
138. Card de venda (TabLancar): valor principal = `value + delivery_fee` (total recebido). Abaixo: "R$X + R$Y frete". Detalhe expandido: frete em verde (+), taxa cartão em vermelho (-)
139. Linhas financeiras com valor zero ficam ocultas (taxas cartão, frete, outras despesas) — menos poluição visual pro franqueado
137. Auditorias com subagents paralelos: SEMPRE verificar achados manualmente antes de corrigir — agentes podem reportar falsos positivos (ex: "window.confirm existe" quando já usa confirmação inline)
138. Funções PL/pgSQL que referenciam `purchase_orders.franchise_id` DEVEM usar `WHERE evolution_instance_id = NEW.franchise_id` (NÃO `WHERE id = NEW.franchise_id`) — franchise_id é evo_id (text), não UUID
139. CHECK constraints de status em `purchase_orders` usam português (`pendente`, `confirmado`, `em_rota`, `entregue`, `cancelado`) — NUNCA usar inglês em CASE/WHEN de triggers
140. Ao alterar rotas no frontend (ex: `/MinhaLoja` → `/Gestao`), verificar TAMBÉM funções PL/pgSQL que hardcodam links de notificação — `grep` no código não encontra referências no banco
141. Tabelas dropadas na auditoria de 23/03: `franchise_orders` (duplicata de purchase_orders), `messages` (WhatsAppHistory removido), `activity_log` (substituído por audit_logs), `catalog_distributions` (nunca usada)
142. `deduct_inventory()` RPC existe mas NÃO é usada por triggers — estoque é gerenciado por `stock_decrement`/`stock_revert` em `sale_items` e `on_purchase_order_delivered` em `purchase_orders`
143. `notify_franchise_users(p_franchise_id UUID, ...)` recebe UUID da franquia (NÃO evolution_instance_id) — resolver com `SELECT id FROM franchises WHERE evolution_instance_id = NEW.franchise_id`
144. Auditoria de banco: 21 tabelas + 1 view (vw_dadosunidade) + 25 funções públicas. pg_cron ativo (aggregate_daily_data às 05:00 UTC). Última auditoria: 23/03/2026
145. `extractPhone()` no `Code in JavaScript` do workflow strip código país 55 — contatos UI salvam 11 dígitos (DDD+número), bot recebia 13 (55+DDD+número). SEMPRE normalizar antes de GET/INSERT em contacts
146. `blockedNumbers` no workflow DEVE usar formato sem 55 (11 dígitos) — compatível com `extractPhone()` normalizado
147. `vw_dadosunidade` campos JSONB (`social_media_links`, `delivery_fee_rules`, `operating_hours`) DEVEM retornar JSONB nativo — cast `::text` quebra acesso a sub-campos (`.instagram` retorna undefined)
148. `payment_delivery` e `payment_pickup` em `franchise_configurations` são `TEXT[]` (array), NÃO JSONB — COALESCE usa `'{}'::text[]`
149. `CREATE OR REPLACE VIEW` NÃO permite mudar tipo de coluna — usar `DROP VIEW IF EXISTS` + `CREATE VIEW`
150. `CREATE_USER1` no workflow V2 DEVE incluir `source: 'bot'` — nó original não tinha o campo
151. Prompts do agente (GerenteGeral1, Pedido_Checkout1) usam dados estruturados do wizard: `payment_delivery[]`, `delivery_fee_rules[]` (JSONB), `pix_holder_name`, `pix_bank`, `operating_hours[]` — NÃO usar campos texto antigos (`accepted_payment_methods`, `shipping_rules_costs`)
152. `PAYMENT_COLORS` em PaymentMethodChart.jsx DEVE espelhar exatamente os values de `PAYMENT_METHODS` em franchiseUtils.js — ao adicionar novo método de pagamento, atualizar ambos
153. `purchase_order_items` coluna FK é `order_id` (NÃO `purchase_order_id`) — referencia `purchase_orders(id)` com ON DELETE CASCADE
154. `getErrorMessage(error)` pattern (detecta JWT expired, RLS, FK, timeout) existe em MyContacts.jsx e PurchaseOrderForm.jsx — ao adicionar em novas páginas, copiar o pattern. TODO: extrair para utility compartilhada
155. Após deploy Portainer, orientar usuário a fazer hard refresh (Ctrl+Shift+R) — browser pode servir JS cacheado do bundle anterior durante ~1 min de rebuild
156. `deleteCascade(franchiseId, evoId)`: `sales` usa UUID (`franchiseId`), mas `purchase_orders`, `expenses`, `contacts`, `inventory_items`, `daily_checklists` usam `evoId` — NUNCA misturar
157. AlertsPanel (AdminDashboard) mostra APENAS alertas vermelhos (max 3) + contadores inline — alertas amarelos ficam exclusivamente no Acompanhamento. NÃO voltar para lista flat de todos os alertas
157. `SaleReceipt.jsx` gera comprovante visual (PNG via html2canvas) — `shareUtils.js` tem `generateReceiptImage()` + `shareImage()` (Web Share API mobile, download desktop)
158. `sale_date` é DATE only (sem horário) — usar `created_at` para timestamp completo. Ao exibir data+hora, combinar ambos campos
159. Componentes off-screen para html2canvas: `position: fixed; left: -9999px; zIndex: -1` — renderizar condicionalmente só quando necessário (state shareData)
160. `loadData` com guard `if (!dependency) return` DEVE chamar `setIsLoading(false)` antes do return — senão componente fica eternamente em skeleton quando dependência demora a inicializar (race condition com Layout)
161. Promise chains com `.then((result) => { if (!result) return; })` DEVEM setar flags de conclusão (ex: `setOnboardingLoaded(true)`) no branch falsy também — senão guards que dependem da flag nunca ativam
162. Filtros "últimos N dias" com `subDays()`: usar `subDays(new Date(), N - 1)` — hoje já conta como dia 1, senão filtra N+1 dias
163. `sales.franchise_id` FK aponta para `franchises.evolution_instance_id` (TEXT), NÃO para `franchises.id` (UUID) — inserir evo_id, NÃO UUID
164. `operating_hours` JSONB NÃO existe na tabela `franchise_configurations` — wizard salva em `opening_hours` (TEXT) e `working_days` (TEXT). NÃO referenciar `operating_hours`
165. Ao recriar `vw_dadosunidade` com DROP+CREATE: CONFERIR que `zuck_instance_name` está presente — nó dadosunidade filtra por esse campo. SQL referência: `supabase/fix-vw-dadosunidade-v2-scale.sql`
166. EnviaPedidoFechado V1 (`ORNRLkFLnMcIQ9Ke`) usa Base44 (morto) — NUNCA apontar para ele. Usar V2 (`RnF1Jh6nDUj0IRHI`)
167. `inventory_items` coluna é `product_name` (NÃO `name`) — Supabase node retorna nomes de coluna reais. Match Items DEVE usar `inv.product_name` e `match.product_name`
168. EnviaPedidoFechado V2 Match Items usa best-score fuzzy: palavras >2 chars, produto com MAIS matches vence — `>=2` sem ranking causa falsos positivos (700g bate em todos)
169. Atualizar workflow n8n via API com editor aberto: editor SOBRESCREVE ao executar. Orientar usuário a fechar aba e reabrir ANTES de testar
170. n8n API PUT `/workflows/{id}` settings aceita apenas campos conhecidos (`executionOrder`, `callerPolicy`) — `availableInMCP`, `binaryMode` causam 400. Não incluir `staticData` também
171. EnviaPedidoFechado V2 validado em produção (24/03): 8 nós OK, matching correto, sale_items com product_name, WhatsApp enviado
172. EnviaPedidoFechado V2 "Prepare Sale Data": `valor_total` do `$fromAI()` pode vir 0 — nó calcula `sum(qty * price) + frete` dos itens como fallback. NUNCA confiar apenas no total do agente
173. Deploy Portainer: SEMPRE seguir ordem `git push` → force update service. Sem push, container rebuilda código antigo do GitHub — NÃO adianta só fazer force update
174. `deleteFranchiseCascade` usa evoId para TODAS as tabelas (incluindo sales) — NUNCA usar UUID para deletar sales, contacts, expenses etc. Única exceção: `franchises.delete().eq('id', franchiseId)` no final
175. `deleteFranchiseCascade` também deleta franqueados vinculados (role=franchisee sem outras franquias) via RPC `delete_user_complete` — admins/gerentes nunca são deletados
176. Tabelas com RLS ativo DEVEM ter DELETE policy para admin — sem ela, `.delete()` retorna sucesso mas deleta 0 rows (silencioso). Verificar ao criar tabela nova
177. `delete_user_complete(p_user_id UUID)`: RPC SECURITY DEFINER que limpa notifications + audit_logs + auth.users (cascadeia profiles). Requer is_admin(). SQL: `supabase/delete-user-rpc.sql`
178. `sales_goals` tem FK para `franchises.evolution_instance_id` — incluída no cascade delete. DELETE policy criada em 24/03
179. Health score `calcSetupScore` (healthScore.js): "Onboarding X%" só aparece para franquias com onboarding em andamento — oculto quando completo (100%) ou sem registro. `problems` array também filtra por `onboardingComplete`
180. Nomes de colunas que diferem do esperado: `inventory_items.quantity` (NÃO `current_stock`/`stock_quantity`), `franchise_invites.invited_at`/`accepted_at` (NÃO `created_at`), `notifications.read` (NÃO `is_read`), `franchise_configurations.franchise_name` (NÃO `store_name`), `franchises` NÃO tem `owner_email` (email fica em `franchise_invites`), `onboarding_checklists` NÃO tem `user_id` (schema: id, franchise_id, status, items, completed_count, completion_percentage, admin_notes, created_at, updated_at)
180. `onboarding_checklists` RLS INSERT permite admin E franqueado (`managed_franchise_ids()`) — corrigido em 24/03, antes era admin-only
181. Onboarding.jsx dispara `window.dispatchEvent(new Event("onboarding-started"))` ao criar checklist — Layout.jsx ouve esse evento para mostrar "Onboarding" no sidebar instantaneamente
182. OnboardingWelcome tutorial tem 7 steps (Bem-vindo, Vendas, Gestão, Meus Clientes, Meu Vendedor, Marketing, Pronto) — Vendas e Gestão são steps separados
183. SetPassword.jsx usa `import logoMaxiMassas from "@/assets/logo-maxi-massas.png"` — consistente com Login.jsx (NUNCA URL externa)
184. `audit_on_sale_delete` trigger: loga em `audit_logs` quem deletou venda (user_id, value, source, contact_id). `revert_contact_on_sale_delete` trigger: reverte `purchase_count` e `total_spent` no contato. SQL: `supabase/audit-sale-delete.sql`
185. Management API SQL com `$$` (PL/pgSQL): delimitadores são corrompidos na serialização JSON — salvar SQL em arquivo e executar via `ctx_execute` com `fetch` lendo o arquivo
186. n8n Supabase node pode reportar "success" mesmo quando INSERT não persiste (RLS silencioso) — SEMPRE verificar dados no banco após execução de workflow crítico
187. Faturamento bruto = `value + delivery_fee` em TODOS os cálculos de revenue (dashboards, gráficos, rankings). TabResultado é exceção: mostra Vendas e Frete como linhas separadas no P&L
188. `aggregate_daily_data()` usa `SUM(value + COALESCE(delivery_fee, 0))` para sales_value — corrigido em 24/03. Ao adicionar novos campos financeiros em sales, verificar se aggregate precisa incluí-los
189. EnviaPedidoFechado V2 "Prepare Sale Data": `value` SEMPRE calculado dos itens (qty * price), NUNCA do `valor_total` do agente — agente pode incluir frete no total. `net_value = value` (sem dedução automática, franqueado edita taxa depois)
190. Health Score tem DOIS sistemas separados: `healthScore.js` (AlertsPanel, pesos dinâmicos novo/existente) e `FranchiseHealthScore.jsx` (drill-down UI, cálculo inline). Ao alterar lógica de score, atualizar AMBOS
191. Daily Checklist (`daily_checklists`) é feature INATIVA — não existe no menu do franqueado. Dimensão "Checklist/Atividade" do Health Score deve ser removida e peso redistribuído (Vendas 35, Estoque 25, Pedidos 20, WhatsApp 20)
192. `auto_generate_instance_id` trigger suporta múltiplas franquias na mesma cidade — gera sufixo numérico automático (`franquiasaopaulosp`, `franquiasaopaulosp1`, `franquiasaopaulosp2`). NUNCA assumir que evo_id é único por cidade sem sufixo
193. Toast de erro em operações CRUD DEVE mostrar `error.message` real do Supabase — mensagens genéricas ("Tente novamente") escondem a causa raiz. Pattern: `toast.error(\`Erro: ${error?.message || "Erro desconhecido"}\`)`
194. Management API token (`sbp_`) pode expirar sem aviso — se retornar "JWT could not be decoded", usar service_role key via PostgREST (`/rest/v1/`) como fallback para queries de diagnóstico
195. OnboardingBlock `franchiseeItems` filter DEVE incluir `role === "auto"` — sem isso, itens auto são contados no total mas não renderizados (bug: "1 de 3" mas só 1 item visível)
196. Supabase PKCE invite flow NÃO passa `type=invite` na URL de redirect — detecção de convite usa `user_metadata.password_set` (false/undefined = precisa definir senha). SetPassword marca `password_set: true` via `updateUser({ data: { password_set: true } })`
197. `password_setup_type` usa `sessionStorage` (NÃO localStorage) — consistente com `needs_password_setup` no AuthContext. SetPassword lê e limpa de `sessionStorage`
198. `functions.js inviteFranchisee()` envia `redirectTo: origin + '/set-password?type=invite'` — n8n workflow `franchise-invite` deve repassar esse param ao `inviteUserByEmail()` para belt-and-suspenders
199. Índices de escalabilidade criados em 24/03: `idx_contacts_franchise`, `idx_contacts_phone`, `idx_sale_items_sale`, `idx_purchase_orders_franchise`, `idx_notifications_user_read`, `idx_audit_logs_franchise` — SQL em `supabase/add-missing-indexes.sql`
200. Credenciais Supabase (Management API token, service_role key) ficam em `memory/reference_supabase_credentials.md` — NÃO depender de env vars da sessão
201. Todas operações de escrita (create/update/delete) usam timeout 30s — Supabase pode ser lento sob carga mesmo no plano Pro. `inviteFranchisee()` também usa 30s (SMTP lento)
202. `vw_dadosunidade` usa SECURITY INVOKER (NÃO DEFINER) — n8n acessa via service_role que já bypassa RLS. Ao recriar a view, NUNCA usar SECURITY DEFINER (gera alerta CRITICAL no Supabase Security Advisor)
203. `handle_new_user()` auto-cria `onboarding_checklists` para cada franquia vinculada — itens 1-1 e 1-2 pré-marcados, `ON CONFLICT (franchise_id) DO NOTHING`. SQL: `supabase/auto-create-onboarding.sql`
204. Management API token no `.mcp.json` expira frequentemente — SEMPRE tentar primeiro o token do `.env`/memory, fallback para service_role via REST API
203. Data fetching com múltiplas queries DEVE usar `Promise.allSettled` (NÃO `Promise.all`) — falha em uma query não deve bloquear a página inteira. Pattern: `getValue = (r) => r.status === "fulfilled" ? r.value : []`, log failedQueries com nomes, checar query crítica separadamente
204. FranchiseeDashboard tem `mountedRef` + `loadError` + retry UI — manter consistente com AdminDashboard. Polling 120s com cleanup no useEffect
205. `new Date().toISOString().split("T")[0]` é BUG de timezone — após 21h BRT retorna data de amanhã (UTC). Para data local usar `getFullYear()/getMonth()/getDate()` ou `format(new Date(), "yyyy-MM-dd")` do date-fns
206. V2 vendedor (`w7loLOXUmRR3AzuO`) migrado para RabbitMQ em 25/03 — trigger `rabbitmqTrigger`, queue `zuckzapgo.events`, cred `zuckzapgo` (id: `jXFF2vYatoDW2caz`). V1 (`PALRV1RqD3opHMzk`) DESATIVADO
207. `blockedNumbers` no V2 é cache dinâmico via `$getWorkflowStaticData('global')` — busca `franchise_configurations.personal_phone_for_summary` a cada 30min via Supabase REST. Normaliza telefone (strip 55, remove formatação) para 11 dígitos
208. Credencial Supabase nos nós n8n usa key `supabaseApi` (NÃO `supabase`) — ex: `credentials: { supabaseApi: { id: "mIVPcJBNcDCx21LR" } }`
209. `franchise_configurations` NÃO tem coluna `personal_phone` — o campo correto é `personal_phone_for_summary` (11 dígitos sem 55). View `vw_dadosunidade` computa `personal_phone_wa` = `'55' + personal_phone_for_summary`
210. Backup pre-RabbitMQ do V2: `docs/vendedor-generico-workflow-v2-pre-rabbitmq.json`. Rollback: reativar V1 via `POST /api/v1/workflows/PALRV1RqD3opHMzk/activate`
211. Workflow ZuckZapGo (`brmZAsAykq6hSMpL`): TODOS os caminhos connect→QR têm nó Wait 3s (`Aguarda QR Ready`, `Aguarda QR Ready1`, `Aguarda QR Ready2`) — ZuckZapGo precisa de tempo entre `/session/connect` e `/session/qr`, sem Wait retorna 500 "not connected"
212. `N8N_API_KEY` env var pode não estar disponível no shell da sessão — ler do `.env` na raiz do projeto como fallback
213. `logout()` limpa state ANTES do `await signOut()` — se Supabase travar (Navigator Locks, rede), UI reage instantaneamente. NUNCA colocar `setUser(null)` depois de `await`
214. `onboarding_checklists` tem UNIQUE INDEX em `franchise_id` — obrigatório para `ON CONFLICT (franchise_id) DO NOTHING` no trigger. Postgres REJEITA ON CONFLICT sem UNIQUE constraint
215. `franchise_invites` tem partial UNIQUE INDEX `(franchise_id, email) WHERE status = 'pending'` — impede convites pendentes duplicados para mesma franquia+email
216. `handle_new_user()` fallback de role: invites pendentes → `raw_user_meta_data->>'role'` → default `'franchisee'`. NUNCA deixar role vazio (CHECK constraint rejeita)
217. Supabase Auth `/invite` pode quebrar silenciosamente (HTTP 500 genérico) se trigger `handle_new_user` falha — debugar com `RAISE EXCEPTION` contextual, NÃO com INSERT em tabela de log (rollback apaga)
218. n8n `neverError: true` retorna erros como JSON com HTTP 200 — frontend DEVE checar `data.code >= 400` antes de considerar sucesso. Pattern em `inviteFranchisee()` de `functions.js`
219. Workflow `franchise-invite` (nbLDyd1KoFIeeJEF) envia `data: { role: 'franchisee' }` no payload do invite — SEM isso, users sem invite pendente ficam com role vazio
220. `connectWhatsappRobot()` usa timeout 30s (NÃO 15s) — workflow n8n tem Wait 3s nodes entre connect e QR, 15s estourava antes do QR voltar. Card de conexão WhatsApp: verde quando conectado, neutro (cinza) quando desconectado — NUNCA vermelho para "desconectado" (gera ansiedade desnecessária)
221. Invite PKCE do Supabase é instável (token expira, email client consome link, PKCE não passa params) — após `inviteFranchisee()`, SEMPRE chamar `resetPasswordForEmail()` que gera link confiável de definir senha
222. Login.jsx tem "Primeiro acesso? Defina sua senha aqui" como rede de segurança — ativa modo reset de senha. "Não possui acesso? Solicite ao administrador" é texto secundário (não clicável)
223. Rota `/set-password` redireciona para `/login` quando `isAuthenticated=false` — NÃO mostrar `PageFallback` (spinner infinito). Franqueado usa "Primeiro acesso" no login como fallback
224. `fetchWithTimeout()` abort gera `error.name === 'AbortError'` — usar para mostrar mensagem específica de timeout ao invés de erro genérico. Pattern em `useWhatsAppConnection.js` linha 112
225. Workflow ZuckZapGo (`brmZAsAykq6hSMpL`) refatorado em 25/03: `action_switch` separa `check_status` (retorna status leve) de `smart_connect` (executa conexão). Path unificado: SEMPRE desconecta antes de reconectar (elimina bug "already logged in" de sessão stale). `Desconecta Whatsapp` tem `onError=continueRegularOutput`. Backup pré-refactor: `docs/criar-usuario-zuckzapgo-pre-refactor-backup.json`
225. Onboarding items suportam `dependsOn: "key"` — item fica bloqueado (cadeado) até dependência ser marcada. Ex: `6-2` depende de `6-1` (conferir pedido só após fazer pedido). `canMark()` em OnboardingBlock.jsx checa dependência
226. `card_fee_amount` calculado sobre `subtotal + effectiveDeliveryFee` (valor total na maquininha) — franqueado passa cartão no valor cheio incluindo frete
227. Onboarding etiquetas WhatsApp: 5 etiquetas (NÃO 8) casando com cores nativas do WhatsApp Business e pipeline do app — 🟢Novo, 🔵Negociando, 🟡Cliente, 🟠VIP, 🔴Reativar

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
- **FASE 5 Etapa 3b**: Minha Loja hub → separado em Vendas + Gestão (3 abas) + Ações Inteligentes + Pedido de Compra ✅
- **FASE 5 Etapa 2**: Vendedor genérico migrado (10 nós Supabase, view, RPCs, prompt otimizado) ✅
- **FASE 5 Etapa 4**: Flag config vendedor + limpeza + deploy Docker (deploy ✅, config vendedor pendente)
- **FASE 5 Etapa 5**: Onboarding completo (tela senha ✅, trigger cost_price ✅, SPF/DKIM ✅, UX formulário ✅, auto-link ✅)
- **Deploy produção**: app.maximassas.tech via Docker Swarm + Traefik SSL ✅
- **FASE 6**: Notificações (sino funcional + triggers automáticos) ✅
- **FASE 7 — Roadmap 10/10** ✅:
  - 7a: Onboarding obrigatório (tutorial + checklist + wizard melhorado) ✅
  - 7b: Seletor franquia + contato inline + health score com drill-down ✅
  - 7c: Gráficos recharts + audit log + export PDF/Excel ✅
  - 7d: WhatsApp history + comparativo períodos + filtros avançados ✅
  - Reports redesenhados (KPIs, PieChart, ranking, tabela sortable) ✅
  - Marketing com Google Drive/YouTube + campanhas ✅
  - Performance: bundle -54%, lazy loading, N+1 eliminado ✅
  - Gaps: draft/retry SaleForm, pedidos atrasados, sugestão reposição, origem leads ✅
  - Auditoria: segurança, mobile, UX texts, cleanup (924 linhas dead code removidas) ✅
  - Terminologia simplificada: Lead→Contato Novo, Remarketing→Clientes Sumidos ✅
- **FASE 8** (em andamento):
  - Redesign visual onboarding (ProgressRing, cards missão, micro-celebrações) ✅
  - Auditoria completa do banco de dados (13 fixes, 4 tabelas mortas removidas, triggers corrigidos) ✅
  - Compartilhar comprovante de venda via WhatsApp (imagem PNG com html2canvas + Web Share API) ✅
  - Swipe touch no tutorial OnboardingWelcome
  - Busca global por franqueado (admin header)
  - Calendário de publicação (Marketing)
  - Docs PDF para franqueados (Guia Rápido, Fluxo com/sem robô, Primeiros Passos)
  - Convite equipe interna (admin/gerente/marketing com role)
  - Permissões dono vs funcionário (RLS diferenciado)

## FASE 7 — Componentes Novos
- **OnboardingWelcome.jsx**: Tutorial 6 steps (primeiro acesso) → redireciona para `/Onboarding` (checklist operacional)
- **FranchiseSelector.jsx**: Dropdown troca franquia (multi-franchise), persiste localStorage, state em AuthContext (`selectedFranchise`)
- **FranchiseHealthScore.jsx**: Score 0-100 (vendas 30, estoque 20, pedidos 20, checklist 15, whatsapp 15) com drill-down dialog
- **ResultadoCharts.jsx**: AreaChart faturamento + ComposedChart receita vs despesas (recharts)
- **ExportButtons.jsx**: Export Excel (xlsx) e PDF (jspdf+autotable), reutilizável via props
- **FilterBar.jsx**: Filtros genéricos reutilizáveis (busca, selects, ordenação, mobile colapsável)
- **WhatsAppHistory.jsx**: Modal chat com ZuckZapGo API, fallback gracioso
- **PeriodComparisonCard.jsx**: Comparativo semana/mês com delta %, aberto por padrão
- **AuditLog entity**: Tabela `audit_logs` registra quem fez cada venda/despesa, filtro por pessoa
- **Marketing**: Suporta links Google Drive/YouTube, campo `campaign`, badge NOVO, compartilhar WhatsApp

## Performance
- Páginas pesadas usam `React.lazy()` + `<Suspense>` (configurado em `pages.config.js`)
- Vite `manualChunks`: recharts, jspdf/xlsx/file-saver, vendor (react/react-dom)
- AdminDashboard: buscar InventoryItem.list() + DailyChecklist.filter({date}) e agrupar no frontend (NÃO fazer N+1 por franquia)
- FranchiseeDashboard: usar `ctxFranchise` do AuthContext (NÃO buscar Franchise.list())
- Polling: FranchiseeDashboard 120s, AdminDashboard 180s, NotificationBell 30s
- Vendas: Sale.list() limitado a 500. Gestao herda limites das tabs (TabResultado, TabEstoque, TabReposicao)
- SaleForm: auto-save draft em localStorage (debounce 1s) + retry com backoff exponencial

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
- `docs/superpowers/specs/2026-03-23-onboarding-visual-redesign.md` — Spec redesign visual onboarding (ProgressRing, cards missão, celebrações, neurociência)
