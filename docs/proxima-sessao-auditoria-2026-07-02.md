# Prompt — Continuação da auditoria do dashboard FranchiseFlow

> Cole isto numa nova sessão do Claude Code no diretório `apps/dashboard`.

---

Continuação da auditoria do dashboard FranchiseFlow. A sessão anterior (02/07/2026) fez uma auditoria completa (6 especialistas) e já executou + deployou as correções críticas. **Leia primeiro `docs/auditoria-dashboard-2026-07-02.md`** (relatório mestre com os 90 achados priorizados).

## JÁ FEITO e EM PRODUÇÃO — não refazer

- **Fase 0 (segurança):** edge ASAAS rejeita `service_role` forjado (compara com a chave real, não confia no claim); RPCs de PII (`get_customer_intelligence`/`get_contact_by_phone`/`upsert_bot_contact`/`log_conversation_message`) revogadas de anon→service_role; `add_default_product` com guard `is_admin()`; `search_path` em 3 funções. Migração: `supabase/security-hardening-fase0-2026-07-02.sql`.
- **Fase 1 (dados/dinheiro):** DRE não subtrai taxa de cartão repassada (`fee_passed_to_customer`); `aggregate_daily_data` canônica + backfill de 925 linhas; telefone canônico no SaleForm; janela do FranchiseeDashboard; chunk de SaleItem no TabResultado. Migração: `supabase/fix-aggregate-daily-discount-2026-07-02.sql`. Teste: `node src/lib/financialCalcs.test.mjs`.
- **Fase 2 (perf):** AdminDashboard não re-baixa 31k contatos no poll; Layout conta vendas do dia sem teto de 50; PurchaseOrders delete em lote.
- **Fase 4 (UX):** toasts→`safeErrorMessage`, `window.confirm`→AlertDialog, skeletons, aria-labels, contraste do dourado (#775a19), sheet centralizado; `PreviewResultado.jsx` removido.
- Commit `7937547`, push, rebuild e deploy verificados (bundle novo live, smoke 0 erros).

## FALTA — 3 blocos

### Bloco A — Fase 5 (dívida técnica; front; precisa deploy) — comece por aqui
1. **Unificar formatação BRL**: `src/lib/formatBRL.js` (12 imports) × `src/lib/formatters.js` (7 imports) têm `formatBRLCompact` com semântica DIFERENTE ("R$ 1.235" × "R$ 1,2k") + ~10 `Intl.NumberFormat` locais. Eleger `formatters.js`, migrar, deletar `formatBRL.js`, trocar os locais. ⚠️ MUDA número exibido — comparar visual antes/depois. Atualizar o bullet do CLAUDE.md que aponta pra `formatBRL.js`.
2. **Consolidar fórmula de receita**: ≥11 arquivos reimplementam `value-discount+delivery` inline em vez de `getSaleNetValue` (AdminDashboard, FranchiseeDashboard, MiniRevenueChart, Reports, TabResultado, FinanceiroSummaryCard, DailyRevenueChart, FranchiseRanking, TabLancar). Trocar por `getSaleNetValue`; comparar totais numa franquia antes/depois.
3. **ESLint/typecheck**: adicionar `react-hooks/exhaustive-deps: "warn"`, incluir `src/lib`/`entities`/`hooks` no `files` do `eslint.config.js`; corrigir `jsconfig.json` `include` (hoje casa ~1 arquivo). Triar o backlog de warnings.
4. **Código morto + deps**: deletar ~26 componentes `src/components/ui/*` órfãos (toaster/toast/form/chart/calendar/carousel/menubar/etc — confirmar 0 imports) + `npm uninstall` das deps só-usadas-por-eles (zod, @hookform/resolvers, react-hook-form, react-day-picker, input-otp, vaul, cmdk, react-resizable-panels, ~13 @radix-ui, sharp, eslint-plugin-react-refresh); tirar `@radix-ui/react-dropdown-menu` do array `ui` em `vite.config.js` (dead code forçado no chunk). 4 exports mortos de `cs_worklist` v1 em `entities/all.js`. ⚠️ Toca lockfile → build + smoke antes de deployar.
5. **Constantes de `columns`**: promover as listas repetidas a `src/entities/columns.js`.
6. **God components** (opcional, grande): extrair dialogs/hooks de SaleForm, Franchises, PurchaseOrders.

### Bloco B — Fase 3 (infra de deploy; PRODUÇÃO; confirmar antes)
O deploy real IGNORA o `Dockerfile`/`nginx.conf` do repo (stack 39 builda inline + escreve nginx mínimo via `echo`). Corrigir via **Stack PUT** no Portainer (puxar o atual antes: `GET /api/stacks/39/file`; backup é de 16/04):
1. **nginx**: `Cache-Control: no-store` no `index.html` (causa-raiz do "vê versão antiga"); gzip/brotli; `immutable`+`expires 1y` nos assets hasheados; security headers; `location ^~ /assets { try_files $uri =404 }` (hoje o fallback SPA devolve index como JS → quebra chunk lazy pós-deploy).
2. **vite.config.js**: `drop:['console']` → `pure:['console.log','console.debug','console.info']` (manter `console.error` em prod).
3. **`.dockerignore`** (node_modules, dist, .env*, .git, .tmp, docs); **node:20-alpine → node:22-alpine**; remover `npm install -g npm@latest`.
4. **xlsx@0.18.5** (abandonado no npm, CVEs) → tarball oficial da CDN SheetJS ou exceljs (app só escreve → baixo risco hoje).

### Bloco C — Ops de segurança (ação do Nelson, coordenar)
1. **Repo `nelpno/franchiseflow` → privado**: ⚠️ o stack clona anônimo → adicionar deploy key/PAT ao clone do stack PRIMEIRO, depois tornar privado. Rodar gitleaks no histórico.
2. **Rotacionar `VITE_CAPI_MANUAL_TOKEN`** (extraível do bundle): mover o disparo do CAPI manual (`TabLancar.jsx`) pra Edge Function JWT-authed + rebuild + ajustar webhook n8n; considerar o token vazado.
3. **CORS da edge `asaas-billing`**: restringir `Access-Control-Allow-Origin` de `*` pro domínio do app.
4. **2 views SECURITY DEFINER** (`vw_bot_inventory_items_lite`, `vw_bot_conversations_summary` — ERROR do advisor): avaliar `security_invoker=true` COM CUIDADO (pode mudar o que o bot lê via RLS; testar o bot antes).

### Deferido (baixa urgência)
Tetos `limit 200` em queries 1-row-por-franquia (rede tem 55); paginação do MyContacts; migração pro React Query (só ASAAS usa hoje).

## Regras de trabalho (aprendidas na sessão anterior)
- **Antes de QUALQUER deploy:** `npm run build` (EXIT 0 + timestamp do `dist/index.html`) + `npm run lint` + `node src/lib/financialCalcs.test.mjs` + **varredura de imports usados-sem-import** (símbolo usado sem `import` compila e passa no lint mas vira tela-branca no render — Rollup = global ref) + smoke Playwright do boot (0 erros de console). Telas `franchiseeOnly` não smoke-testam como admin (sem creds de dev no `.env`).
- **Deploy:** commit (múltiplos `-m`; `.env`/`.tmp`/scratch FORA; scan de segredo `eyJ|EAA|sk-|AIza|sbp_` no staged) → `git push origin main` → force-update `node .tmp/deploy.mjs` → verificar bundle novo live por MUDANÇA de hash (Windows×VPS podem divergir; hash muda quando o código mudou).
- **Migração de banco:** Supabase MCP `apply_migration` (project ref `sulgicnqqopyhulglakd`), verificar no vivo depois (grants via `role_routine_grants`; advisor de segurança).
- **CONFIRMAR antes de:** deploy do front, push a main, Stack PUT no Portainer, e os itens do Bloco C (Nelson precisa coordenar). Não usar credencial de usuário real.

Comece lendo `docs/auditoria-dashboard-2026-07-02.md`, depois ataque o **Bloco A**. Confirme antes de cada deploy.
