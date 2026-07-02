# Auditoria Completa do Dashboard FranchiseFlow — 2026-07-02

**Método:** painel de 6 especialistas (Fable 5) em paralelo, análise read-only do código-fonte (nenhum arquivo alterado, nenhum build/deploy). O agente de deps validou também o **bundle live** de app.maximassas.tech.
**Escopo:** Segurança · Performance/Escala · Código/Arquitetura · Correção de Dados/Regra de Negócio · UX/Acessibilidade · Dependências/Build.

Relatórios detalhados por domínio (backup de sessão): `scratchpad/analise-dashboard/01..06`.

---

## Placar geral

| Domínio | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| 🔒 Segurança | **2** | 2 | 3 | 6 | 13 |
| ⚡ Performance | 0 | 2 | 5 | 8 | 15 |
| 🏗️ Código/Arquitetura | 0 | 5 | 9 | 2 | 16 |
| 🧮 Dados/Negócio | 0 | 2 | 4 | 8 | 14 |
| 🎨 UX/A11y | 0 | 2 | 8 | 5 | 15 |
| 📦 Deps/Build | 0 | 4 | 5 | 8 | 17 |
| **Total** | **2** | **17** | **34** | **37** | **90** |

**Veredito:** base sólida (RLS operacional correto, núcleo financeiro consistente, fetchAll com tie-breaker, dateOnly respeitado, zero silent-failure de clique nos forms). Os problemas graves estão concentrados em **2 buracos de segurança server-side (P0)** + **higiene de deploy** + **dívida de duplicação** que já causou bug histórico. Nenhum P0 de perda de dinheiro na tela.

---

## Achados que se reforçam entre domínios (alta confiança)

Estes apareceram em ≥2 auditorias independentes — prioridade máxima dentro de cada faixa:

1. **Token CAPI no bundle público** — Segurança (P1) + Deps (P1, **confirmado literal no JS live**). Real.
2. **error.message cru em toasts** — UX (P1, 15 telas do franqueado) + Código (P2, 27 call-sites) + Segurança (P3). Os do franqueado são o pior caso.
3. **`window.confirm` no delete de venda** — UX (P1) + Código (P2).
4. **TabResultado sem chunking de SaleItem** — Performance (P1) + Dados (P2). Falha futura garantida em franquia grande.
5. **`PreviewResultado.jsx` obsoleto acessível a qualquer logado** — Código (P1) + UX (ponto cego).
6. **ESLint/typecheck cegos em `src/lib`+`entities`** — Código (P1×2) + Deps (P3). Justo a camada da matemática de dinheiro.
7. **Fórmula de receita duplicada em ≥11 arquivos** — Código (P1). *Dados confirma que HOJE todos batem* → é dívida/risco latente, não bug ativo (nuance importante).

---

## ⚠️ Precisa de verificação no banco/infra VIVO antes de corrigir

Os `.sql` são migrations versionadas; o estado real pode divergir. **10 min de queries calibram metade do plano:**

- **[P0-2]** `SELECT routine_name, grantee FROM information_schema.role_routine_grants WHERE grantee IN ('anon','public')` — confirmar se as RPCs de contato estão mesmo expostas a `anon`, e se o PostgREST expõe `rpc/*` a `anon` no gateway. Se `anon` estiver bloqueado, o P0-2 cai pra P2.
- **[Dados P2-1]** `pg_get_functiondef('aggregate_daily_data(date)'::regprocedure)` — qual das 2 versões divergentes (com/sem desconto) venceu no banco. Define se a meta diária está inflada.
- **[Perf]** `SELECT count(*)` em `sales`/`contacts`/`bot_conversations`/`conversation_messages` + `pg_stat_statements` top queries — calibra P1 vs P2 de performance (hoje estimado por docs).
- **Antes de mexer no deploy:** `GET /api/stacks/39/file` (stack atual, o backup é de 16/04) + `curl -I` no index e num asset (confirmar cache/gzip).
- **Antes de revogar grants:** conferir se algum nó n8n passou a depender do grant a `anon` (não deveria — as originais eram service_role).

---

## Plano priorizado por fases

### FASE 0 — Segurança crítica (fazer primeiro, hotfix)

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 0.1 | **Edge ASAAS: bypass de auth por JWT `service_role` não verificado** — `atob()` do payload sem validar assinatura → forjar admin e cancelar/alterar mensalidade da rede inteira. Trocar por secret dedicado (`X-Internal-Token`) ou verificar assinatura. | `functions/asaas-billing/index.ts:638-654` | S |
| 0.2 | **RPCs de contato SECURITY DEFINER concedidas a `anon`/PUBLIC** — PII de clientes de qualquer franquia legível/gravável com a anon key do bundle. `REVOKE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role`. *(verificar grants vivos + dependência n8n antes)* | `fix-contact-phone-normalization-rpcs.sql:58,100,193,276,348` | S |
| 0.3 | **Repo GitHub `nelpno/franchiseflow` é PÚBLICO** — fonte + CLAUDE.md interno expostos. Tornar privado + deploy key no stack + scan de histórico (gitleaks). | repo remoto | S–M |
| 0.4 | **`VITE_CAPI_MANUAL_TOKEN` extraível do bundle** (confirmado live) — forjar Purchase no Meta CAPI. Mover disparo pra Edge Function JWT-authed + rotacionar token (considerar vazado). | `TabLancar.jsx:96-105` | M |
| 0.5 | **`add_default_product()` executável por PUBLIC** escreve em todas as franquias. `REVOKE` + guard `is_admin()` + `search_path`. | `admin-add-default-product.sql` | S |
| 0.6 | **DEFINER sem `SET search_path`** (inclui `managed_franchise_ids()`, base de ~28 policies) + CORS `*` na edge de cobrança. | vários `.sql` + edge | S |

### FASE 1 — Correção de dados / falhas já visíveis

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 1.1 | **TabResultado estoura URL do PostgREST** — todos os sale_ids num `.in()` sem chunking (Financeiro já chunca em 500). Copiar o padrão. *(Perf P1 + Dados P2)* | `TabResultado.jsx:791-795` | S |
| 1.2 | **DRE subtrai taxa de cartão repassada ao cliente** → lucroCaixa subestimado em toda venda com repasse. Somar `card_fee_amount` das vendas `fee_passed_to_customer=true` ao recebido. | `financialCalcs.js:38-41` + `TabLancar.jsx:889` | M |
| 1.3 | **SaleForm `normalizePhone` local adiciona DDI 55** (oposto do canônico) → venda pode gravar sem `contact_id` (sem nome no comprovante + CAPI pulado). Usar `@/lib/whatsappUtils`. | `SaleForm.jsx:194` | S/M |
| 1.4 | **`aggregate_daily_data` definida 2× com fórmulas divergentes** (uma ignora desconto) → meta diária possivelmente inflada. Verificar live + consolidar. | `fix-aggregate-daily-*.sql` | S |
| 1.5 | **FranchiseeDashboard: janela 90d < navegação -2 meses** → total mensal parcial e delta % errado na borda. `startOfMonth(subMonths(now,3))`. | `FranchiseeDashboard.jsx:26,94` | S |
| 1.6 | **Consolidar fórmula de receita** nos ≥11 arquivos que reimplementam inline → usar `getSaleNetValue`/`sumSalesNet`. Latente hoje, mas foi a causa do bug Ricardo Tatuapé. | 11 arquivos | M |

### FASE 2 — Performance / escala (quick wins)

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 2.1 | **AdminDashboard `Contact.list` fetchAll sem janela** re-baixado a cada poll 5min (~5-6MB → 66MB/h por aba). Janela `last_contact_at` ou RPC agregada; não recarregar contacts no `force:true`. | `AdminDashboard.jsx:253` | S/M |
| 2.2 | **Layout "vendas hoje" com teto silencioso de 50** + `select('*')` → congela quando rede passar de 50 vendas/dia. `Sale.filter({sale_date:today},{columns:'id'})`. | `Layout.jsx:253` | S |
| 2.3 | **PurchaseOrders delete em massa N+1** (~320 req p/ 20 pedidos). `.delete().in('order_id', ids)`. | `PurchaseOrders.jsx:537` | S |
| 2.4 | **Tetos `limit N` que a rede alcança** (MarketingPaymentsAdmin 200, Franchises/Onboarding 200, POs 500). Trocar por `fetchAll` ou janela. | vários | S |
| 2.5 | **MyContacts fetchAll `select('*')` + sem virtualização** → lag no mobile em franquia grande. `columns` enxuto + paginação de UI. | `MyContacts.jsx:167,627` | S/M |
| 2.6 | **React Query subutilizado** (só ASAAS usa) → cada navegação refaz tudo. Migração incremental começando por `Franchise.list` compartilhado (staleTime 5min). | `query-client.js` | M |

### FASE 3 — Deploy / Build / hardening

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 3.1 | **Deploy ignora Dockerfile/nginx.conf do repo** → live sem `Cache-Control` (causa-raiz do "vê versão antiga"), **sem gzip** (~900KB crus), sem security headers. Stack usa Dockerfile OU copia o nginx.conf. | stack 39 | M |
| 3.2 | **SPA fallback devolve index.html 200 pra asset inexistente** → chunk lazy antigo quebra pós-deploy até F5. `try_files $uri =404` em `/assets` + reload-once em ChunkLoadError. | nginx | S |
| 3.3 | **`drop:['console']` apaga `console.error/warn`** → prod cego a erro no browser do franqueado. Usar `pure:['console.log',...]`. | `vite.config.js:15` | S |
| 3.4 | **`.dockerignore` ausente** (armadilha: `COPY . .` traz `.env` + node_modules Windows) + **node:20-alpine EOL** (build+runtime) + `npm install -g npm@latest` unpinned. | Dockerfile | S |
| 3.5 | **`xlsx@0.18.5` abandonado com CVEs** (mitigado: só escreve). Trocar pro tarball oficial da CDN ou exceljs. | package.json | S |

### FASE 4 — UX / Acessibilidade (polish, franquia-facing)

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 4.1 | **15 toasts com `error.message` cru** nas telas do franqueado → `safeErrorMessage`. *(UX P1 + Código P2, 27 no total)* | vários | S/M |
| 4.2 | **`window.confirm` no delete de venda** → AlertDialog com microcopy simples. *(UX P1 + Código P2)* | `TabLancar.jsx:256` | S |
| 4.3 | **Spinner full-page em vez de `<Skeleton>`** em 8 telas do franqueado. | Vendas/Marketing/TabResultado/... | M |
| 4.4 | **12 botões-ícone sem `aria-label`** (Estoque editar/ocultar/excluir, chevrons de mês). | TabEstoque/TabResultado/Financeiro | S |
| 4.5 | **Dourado `#d4af37` pequeno reprova WCAG AA** (~2,2:1) — usar `#775a19` pra texto. | Marketing/AsaasSetupPanel | S |
| 4.6 | **SubscriptionPaymentSheet estica full-width no desktop** + `sheet.jsx` sem proteção de overflow do `dialog.jsx`. | sheet base + 1 tela | S |

### FASE 5 — Saúde de código / dívida técnica

| # | Achado | Arquivo | Esforço |
|---|---|---|---|
| 5.1 | **Deletar `PreviewResultado.jsx`** (mock obsoleto, acessível, categorias divergentes) — remover `lazy()` E entrada em PAGES (gotcha tela-branca). | `PreviewResultado.jsx` + `pages.config.js` | S |
| 5.2 | **Unificar formatação BRL** (2 libs concorrentes com semântica diferente + 10 formatters locais) numa fonte só. | `formatBRL.js`/`formatters.js` | M |
| 5.3 | **ESLint `exhaustive-deps` + incluir `src/lib`/`entities`/`hooks`** no lint e no typecheck (`jsconfig include` casa 1 arquivo hoje). | `eslint.config.js`, `jsconfig.json` | S+triagem |
| 5.4 | **Limpeza de código morto**: ~26 componentes shadcn/ui órfãos + ~20 deps não importadas (`zod`, `react-hook-form`, `sharp`...) + `@radix-ui/react-dropdown-menu` forçado no chunk `ui` + 4 exports CS v1 + `chart.jsx`. | ui/, package.json, vite.config | M |
| 5.5 | **Guard de unmount/abort** em TabResultado/TabLancar/PurchaseOrderHistory (corrida real na troca de franquia no Financeiro admin). | 3 componentes | M |
| 5.6 | **Constantes de `columns:` compartilhadas** (`src/entities/columns.js`) — hoje repetidas, risco de 400 silencioso. + catches vazios no NotificationBell. | vários | M |
| 5.7 | **Zero testes automatizados** — vitest só pra `src/lib`+`entities` (funções puras) pegaria regressões históricas de dinheiro. | novo | M |
| 5.8 | **God components** (9 arquivos >900 linhas): extração incremental de dialogs/hooks. Priorizar SaleForm + Franchises. | vários | L |

---

## Riscos de processo (não são bugs, são gaps de método)

- **Telas `franchiseeOnly` não são smoke-testáveis** com login admin (redirect) e não há franqueado de teste → achados de UX/runtime nessas telas só aparecem quando alguém reclama. **Recomendação: criar franquia-sandbox + usuário franqueado de teste** (excluído do cohort de análises).
- **`.env` com service_role/management token/ZZG admin/Gemini vive no OneDrive** (fora do git ✓, mas sincronizado pra nuvem pessoal). Mover pro cofre `~/.secrets/`.
- **Sem métrica de front em produção** (só Clarity de UX) → o gatilho pra migrar pras RPCs agregadas é subjetivo. Beacon simples de tempo-de-load nas 3 páginas pesadas.

## O que está saudável (não mexer)

RLS operacional (filtro por `managed_franchise_ids()`), fórmula de receita consistente entre admin×franqueado hoje, `getSaleNetValue` com parseFloat, tie-breaker `id` no fetchAll, `Entity.delete().select('id')`, marketing por `reference_month`, `sale_number` com advisory lock, `jspdf-autotable` v5 no padrão novo, lockfile em sync, libs pesadas lazy, dateOnly/MaterialIcon 100% conformes.
