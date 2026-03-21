# FranchiseFlow — Dashboard Maxi Massas

## Sobre
Dashboard de gestão de franquias da Maxi Massas (massas artesanais congeladas).
Migrado de Base44 para Supabase Cloud. Frontend React hospedado via Docker/Portainer.

## Stack
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui (Radix) + Recharts
- **Backend**: Supabase Cloud (Auth + Postgres + RLS + Storage + Edge Functions)
- **Automação**: n8n (webhook.dynamicagents.tech) para WhatsApp, catálogo, marketing
- **Design**: Google Stitch MCP para UI/UX
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

### Integração Vendedor Genérico (n8n)
- Workflow ID: PALRV1RqD3opHMzk (teste.dynamicagents.tech)
- Lê configurações da tabela `franchise_configurations` (dadosunidade)
- Campos DEVEM manter compatibilidade com o vendedor

### Triggers Automáticos (banco)
- `on_auth_user_created`: cria profile automaticamente ao criar user
- `auto_generate_instance_id`: gera evolution_instance_id ao criar franquia (admin não precisa saber)
- `on_franchise_created`: cria franchise_configuration + popula estoque com 28 produtos do catálogo
- `aggregate_daily_data`: pg_cron diário às 05:00 UTC (02:00 BRT)

## Estrutura de Pastas
```
src/
├── api/           # supabaseClient.js (com custom lock bypass), functions.js (n8n webhooks)
├── entities/      # all.js (adapter Supabase com interface Base44-compatível)
├── components/    # Componentes por feature (dashboard/, checklist/, onboarding/, etc.)
├── hooks/         # Custom hooks
├── lib/           # AuthContext, utils
├── pages/         # Uma página por rota
└── assets/        # Imagens estáticas
```

## Convenções
- Idioma do código: inglês (nomes de variáveis, componentes)
- Idioma da UI: português brasileiro
- Componentes UI: sempre usar shadcn/ui (src/components/ui/)
- Formulários: react-hook-form + zod
- Gráficos: Recharts
- Ícones: Lucide React
- Datas: date-fns (NÃO moment.js)
- Notificações: sonner (toast)

## Variáveis de Ambiente
```
VITE_SUPABASE_URL=        # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=   # Anon key do Supabase
VITE_N8N_WEBHOOK_BASE=https://webhook.dynamicagents.tech/webhook
```

## Webhooks n8n
- WhatsApp connect/status: `{N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`
- Config optimization: `{N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`

## UX por Role
- **Franqueado**: menu com 6 itens (Minha Loja, Vendas, Estoque, Marketing, Checklist, Meu Vendedor)
- **Admin**: menu completo (12 itens, incluindo Relatórios, Acompanhamento, Franqueados, Usuários)
- Terminologia simplificada: "Estoque" (não "Inventário"), "Valor Médio" (não "Ticket Médio")
- Dashboard franqueado: motivacional (meta diária, ranking, streak, acesso rápido)
- Dashboard admin: monitoramento (alertas semáforo, ranking franquias, filtro de período)
- Rotas admin-only (Reports, Catalog, etc.) protegidas com redirect
- Análise UX completa em `docs/analise-ux-completa.md`
- Spec do dashboard por role em `docs/superpowers/specs/2026-03-20-dashboard-por-role-design.md`
- Análise vendedor genérico em `docs/analise-vinculacao-vendedor.md`

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
- **FASE 4**: Design com Stitch + deploy Docker (PRÓXIMO)
- **FASE 5**: Refactor arquitetural (padronizar FKs UUID) + migrar dados Base44 + conectar vendedor genérico n8n

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- Executar SQL: `POST https://api.supabase.com/v1/projects/{ref}/database/query` com header `Authorization: Bearer {sbp_token}`
- SQL scripts ficam em `supabase/*.sql`
