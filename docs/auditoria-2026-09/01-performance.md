# 01 — Performance e carregamento

> Auditoria FranchiseFlow, 07/09/2026. Frente: por que o app demora a ficar útil e onde o tempo vai embora.
> Tudo o que está aqui foi medido nesta sessão (código lido, build com sourcemap, `pg_stat_statements`,
> `EXPLAIN ANALYZE`, PostgREST cronometrado daqui, Playwright no site live, `cat` dentro do container).
> O que não consegui verificar está marcado `⚠️ NÃO VERIFICADO`.

## 0. Resumo — os 5 achados que mais pagam

| # | Achado | Quem sofre | Hoje | Depois | Esforço |
|---|---|---|---|---|---|
| 1 | **Produção não comprime nem cacheia nada** — o container roda um nginx de 8 linhas escrito no `command:` da stack 39; o `Dockerfile`/`nginx.conf` do repo (gzip, cache 1 ano, security headers) **nunca rodou** | todos | 2,23 MB na rede a cada boot, 0% compressão, sem `Cache-Control` | ~0,65 MB (só ligando compressão) | **P** (2 labels Traefik ou 6 linhas na stack) |
| 2 | **`export` (jspdf+xlsx, 856 KB) e `recharts` (415 KB) são import ESTÁTICO do chunk de entrada** — o browser baixa e avalia 1,27 MB de PDF/Excel/gráfico antes de rodar a 1ª linha do app. Causa: `manualChunks` em forma de objeto; provado com build alternativo | todos | 2,19 MB de JS antes do spinner | 0,92 MB (261 KB gz) | **P** (só `vite.config.js`) |
| 3 | **RLS avaliada linha a linha**: policies chamam `is_admin_or_manager()`/`managed_franchise_ids()` sem `(select …)`; toda leitura sem filtro explícito de `franchise_id` vira Seq Scan com 2 chamadas de função por linha. Vendas: **1.090 ms** de média; Gestão `sale_items`: **795 ms**; contatos: **3.458 ms** | todos | 7 statements de tela entre 341 ms e 3,5 s | 5,7 ms / 6,5 ms medidos com a forma `(select fn())` | **M** (migração SQL nas ~28 policies) + **P** (filtro em 3 call-sites) |
| 4 | **Icon-font Material Symbols pesa 1.128.840 bytes** (variável, todos os ~3.800 ícones) e é carregada em paralelo com o boot; até chegar, cada ícone aparece como texto (`wb_sunny`, `point_of_sale`) | todos (celular pior) | 1,1 MB por cache frio | ≤ 30 KB (subset dos 141 ícones usados) | **M** |
| 5 | **Desperdício estrutural nas telas**: Gestão remonta a página inteira a cada poll de 5 min (perde edição em curso e refaz 37 requests); paginação especulativa dispara 7 requests para 1.001–1.999 linhas (5 voltam vazias); `DailyChecklist` é buscado e nunca lido (75.716 chamadas); `User.me()` refaz GoTrue+profiles em 6 páginas; `loadQuickStats` do admin busca 2 queries que ninguém renderiza | franqueado (Gestão, Vendas, Início) | até 444 req/h numa aba de Gestão | ~40 req/h | **P** cada |

Contradições com o `00-CONTEXTO.md`, com dado novo prevalecendo:
- "Custo de primeira pintura ≈ 253 KB gzip" → **não há gzip em produção**. O custo real medido no browser é **2.226.597 bytes na rede** (Playwright, `transferSize`, cache frio).
- "recharts: só via TabResultado" → `recharts-*.js` é **import estático** de `index-*.js` (`import{c as uo}from"./recharts-…"`), preloaded em todo boot. Idem `export-*.js`.
- "TabEstoque com centenas de itens" → máximo real é **56 itens** por franquia (`max(count) inventory_items`). Virtualização ali não é problema. Em `MyContacts` é: **2.887 cards** no Guarujá.

---

## 1. Como medi (para reproduzir)

| O quê | Como | Onde |
|---|---|---|
| Bytes por módulo dentro de cada chunk | `vite build --sourcemap --outDir <scratch>` + decodificador VLQ próprio (`attribute.cjs`) — nada em `src/` foi tocado | scratchpad `attribute.cjs` |
| Causa do import estático | grep de `from"./…"` no `index-*.js` + build alternativo com `manualChunks` em função (`vite.alt.config.mjs`, saída em `dist-alt`) | scratchpad |
| O que o browser baixa de verdade | Playwright em `https://app.maximassas.tech/login` (cache frio, Chromium desktop, fibra): `performance.getEntriesByType('resource')` com `transferSize`/`decodedBodySize` | seção 2.1 |
| O que o container roda | Portainer API (só leitura): `GET /stacks/39/file`, `GET …/services/2zb27…`, `exec cat /etc/nginx/conf.d/default.conf` e `grep gzip /etc/nginx/nginx.conf` | seção 2.1 |
| Custo real das queries | `pg_stat_statements` (acumulado desde 20/03/2026, 171 dias) + delta de 14 min em horário de pico (seg. 10:27–10:41 BRT) | seção 3, 6 |
| Custo da RLS | `EXPLAIN (ANALYZE, BUFFERS)` da forma exata da policy, com e sem `(select …)`, com e sem filtro de `franchise_id` | seção 3.1 |
| Latência e payload | Node `fetch` ao PostgREST com service_role (bypassa RLS — o tempo de RLS vem do `pg_stat`), medindo bytes JSON e gzip estimado; RTT medido 24–91 ms daqui (BR) para `sa-east-1` | seção 3 |
| Fontes | `HEAD` nos woff2 que o CSS do Google Fonts devolve para um UA Chrome mobile | seção 8.1 |

Limites: não fiz login como franqueado real (seria criar sessão em conta de produção). A cascata de boot é derivada do código + `pg_stat_statements` + latências medidas; os tempos "em 4G" são aritmética com premissas declaradas (10 Mbps efetivos, 150 ms RTT), não medição em aparelho.

---

## 2. Primeira pintura

### 2.1 Produção não comprime nem cacheia — o `nginx.conf` do repo nunca rodou

- **Evidência**
  - Playwright no live, cache frio: `totalWire = 2.226.597` bytes vs `totalDec = 2.238.039` → **0% de compressão**. Por arquivo: `index-CoLuR8op.js` wire 374.269 / dec 373.969; `export-B7rvBPu9.js` 856.439 / 856.139; `recharts-Dm7Fi8Ld.js` 415.292 / 414.992.
  - `curl -sD - -H "Accept-Encoding: gzip, deflate, br" https://app.maximassas.tech/assets/index-CoLuR8op.js` → headers completos: `Accept-Ranges, Content-Length: 373969, Content-Type, Date, Etag, Last-Modified, Server: nginx`. **Sem `Content-Encoding`, sem `Cache-Control`, sem `Expires`, sem nenhum dos 5 security headers** do [nginx.conf](../../nginx.conf).
  - Stack 39 (`GET /api/stacks/39/file`): imagem `node:20-alpine`, `entrypoint: /bin/sh`, e o `command` faz `apk add nginx`, `git clone --depth 1 …/franchiseflow.git`, `npm ci`, `npx vite build` e depois **escreve com `echo` um `/etc/nginx/http.d/default.conf` de 8 linhas** (só `listen`, `root`, `index`, `try_files`). `Type: 1`, `GitConfig: null` → a stack **não** usa o [Dockerfile](../../Dockerfile) nem o [docker-compose.yml](../../docker-compose.yml) do repo.
  - `exec cat /etc/nginx/conf.d/default.conf` no container `dfcafdd2db9b` → `No such file or directory`; `grep gzip /etc/nginx/nginx.conf` → linha 79: `#gzip on;` (comentado — padrão do pacote nginx do Alpine).
  - Consequência colateral: **cada restart do serviço refaz `npm ci` + `vite build` dentro do container** — é isso que produz os ~75 s de 502 documentados no `CLAUDE.md` a cada deploy.
- **Quem sofre**: todos, em todo boot. Sem `Cache-Control`, o browser usa freshness heurística (10% da idade do `Last-Modified`) e revalida os 9 assets com `If-None-Match` a cada dia (304, mas 9 round-trips extras); no celular com cache evictado, baixa os 2,23 MB de novo.
- **Impacto**: em fibra o download dos 9 assets levou 42→183 ms (h2, paralelo). Em 4G de 10 Mbps efetivos, 2,23 MB ≈ **1,8 s de tela branca** antes de o React renderizar sequer o spinner; a 2 Mbps (sinal ruim, home-based em bairro), ≈ **9 s**. Isso soma-se à icon-font de 1,1 MB (seção 8.1) que disputa a mesma banda.
- **Correção** (duas opções, a 1ª é a menor):
  1. **Traefik comprime** — 2 labels na stack 39 (Stack PUT, payload padrão do `CLAUDE.md`):
     `traefik.http.middlewares.ff-compress.compress=true` e `traefik.http.routers.franchiseflow.middlewares=ff-compress`. Traefik entrega gzip/br. Cache continua faltando → adicionar ao `echo` do `command`: `location /assets { expires 1y; add_header Cache-Control "public, immutable" always; }` e no `location /` o `Cache-Control: no-store` para o `index.html` (o `versionCheck` já pede `no-store` no fetch, mas o HTML navegado não tem header nenhum).
  2. **Usar o Dockerfile do repo** — trocar a stack para build de imagem (Portainer "Repository" com Dockerfile) — aplica gzip nível 6, cache imutável e os security headers que já estão escritos em [nginx.conf](../../nginx.conf); elimina o `npm ci` no restart (deploy sem 502).
- **Esforço**: P (opção 1) / M (opção 2, exige mexer no fluxo de deploy `.tmp/deploy.mjs`).
- **Risco de regressão**: janela de rebuild (~75 s de 502, como hoje). Verificar com `curl -sD - -H "Accept-Encoding: gzip" …/assets/index-*.js | grep -iE "content-encoding|cache-control"` → precisa devolver `gzip` (ou `br`) e `public, immutable`. Cuidado com `Cache-Control` no `index.html`: tem de ser `no-store` (senão deploy novo não aparece) — o `.tmp/verify-deploy.mjs` continua válido.

### 2.2 `export` e `recharts` são dependência ESTÁTICA do chunk de entrada

- **Evidência**
  - [dist/assets/index-CoLuR8op.js](../../dist/assets/index-CoLuR8op.js) começa com `import{_ as rt}from"./export-B7rvBPu9.js"` e `import{c as uo}from"./recharts-Dm7Fi8Ld.js"`. `rt` é usado 15× como `rt(()=>import("./Gestao-…"))` — é o helper **`__vitePreload`**, que o Rollup alojou dentro do chunk `export`. `uo` aparece em `function ce(...t){return iu(uo(t))}` — é o **`clsx`** do `cn()` de `src/lib/utils`, alojado dentro do chunk `recharts`.
  - [dist/index.html](../../dist/index.html): `<link rel="modulepreload" href="/assets/export-B7rvBPu9.js">` e `…recharts-Dm7Fi8Ld.js` (o live tem os mesmos 6 preloads — conferido por fetch).
  - Nenhum arquivo de `src/` importa jspdf/xlsx/file-saver estaticamente (só `import()` em [ExportButtons.jsx:18-54](../../src/components/shared/ExportButtons.jsx), [pickingSheetPdf.js:465](../../src/lib/pickingSheetPdf.js), [shareUtils.js:8](../../src/lib/shareUtils.js)); `recharts` só em [TabResultado.jsx:37](../../src/components/minha-loja/TabResultado.jsx), que é lazy. O culpado é a forma **objeto** de `manualChunks` em [vite.config.js:22-29](../../vite.config.js): o Rollup atribui ao chunk manual também os módulos compartilhados que ele "toca primeiro".
  - **Prova do fix**: build alternativo em scratchpad (`vite.alt.config.mjs`, `manualChunks` em **função** que só agrupa vendor/supabase/dates/ui) → entry importa apenas `vendor, supabase, ui, dates`; `modulepreload` só esses 4; `xlsx-*.js` 428 KB/142 KB gz, `jspdf.es.min-*.js` 391/127, `TabResultado-*.js` (+recharts) 463/124 — todos lazy. Entry ficou 369 KB/105 KB gz.
- **Quem sofre**: todos. Um módulo ES só executa depois que TODAS as suas importações estáticas baixaram e avaliaram — 1,27 MB (856+415) que o franqueado nunca vai usar na maioria das sessões (só ao exportar ou abrir Gestão › Resultado).
- **Impacto**: no live, o entry só pôde rodar quando `export-*.js` terminou (t=183 ms em fibra, o último dos 9). Em 4G, ~1 s a mais de tela branca. Com compressão ligada (2.1) mas sem este fix, o caminho crítico fica em **~653 KB gz** (107+45+54+30+8+17 + 280 + 112); com o fix, **~261 KB gz**.
- **Correção**: `vite.config.js` → `manualChunks(id)` em função (o `vite.alt.config.mjs` do scratchpad é a versão pronta: vendor = react/react-dom/scheduler/react-router/@remix-run; supabase; date-fns; ui = os 3 radix). Não listar jspdf/xlsx/recharts — o `import()` já os separa.
- **Esforço**: P (1 arquivo, fora de `src/`).
- **Risco de regressão**: nenhum funcional; verificar no `dist/index.html` que `modulepreload` não cita `export`/`recharts` e `grep -o 'from"./[a-z-]*' dist/assets/index-*.js`. O `.tmp/verify-content.mjs` precisa saber que os chunks mudaram de nome (`xlsx-*`, `jspdf.es.min-*`).

### 2.3 O que mais viaja no chunk de entrada (374 KB bruto / 106,6 KB gz) — e o que vale tirar

Atribuição por sourcemap (bytes brutos; gz ≈ ×0,286):

| Bloco | bruto | ~gz | Observação |
|---|---:|---:|---|
| `src/components/dashboard/*` | 83,5 KB | 23,8 KB | Admin-only ≈ 42 KB (AdminDashboard 13,7 · AlertsPanel 6,8 · FranchiseRanking 6,4 · NetworkFunnelPanel 4,8 · LastPurchaseOrderCard 3,1 · FinanceiroSummaryCard 2,6 · BotSummaryCard 2,1 · DailyRevenueChart 1,4 · AdminHeader 1,1). Franqueado-only ≈ 41 KB (FranchiseeDashboard 11,9 · ConversionDetailSheet 5,3 · PriorityAction 4,4 · MiniRevenueChart 3,4 · SmartActions 3,4 · FinancialObligationsCard 3,3 · CustomDateRangeSheet 2,7 · RankingStreak 2,6 · ConversionCard 2,0 · DailyGoalProgress 1,2 · StatsCard 1,1) |
| `src/components/minha-loja/*` (por `Vendas` estático) | 56,4 KB | 16,1 KB | SaleForm 25,8 · TabLancar 23,4 · SaleReceipt 7,3; + Vendas.jsx 4,9, shareUtils 2,5, salesExport 2,2, ExportButtons 2,2 ≈ **68 KB / 19,5 KB gz** |
| `@tanstack/query-core` + `react-query` | 36,0 KB | 10,3 KB | 2 consumidores (seção 5) |
| `sonner` | 33,5 KB | 9,6 KB | toasts — fica |
| `tailwind-merge` | 24,7 KB | 7,1 KB | `cn()` do shadcn — fica |
| `src/components/ui/*` | 27,8 KB | 7,9 KB | sidebar.jsx sozinho 13,0 KB |
| Telas de auth estáticas em [App.jsx:10-12](../../src/App.jsx) | 24,0 KB | 6,9 KB | Login 5,4 · AuthHero 5,3 · SetPassword 5,2 · OnboardingWelcome 8,2 (2 sessões em 3 dias no Clarity) |
| `lucide-react` | 2,1 KB | 0,6 KB | 5 ícones em `ui/checkbox|dialog|select|sheet|sidebar` — viola a regra "só MaterialIcon", mas custa pouco |

Leitura honesta: depois de 2.1 e 2.2 o entry é ~105 KB gz; os cortes abaixo são de 5–20 KB gz cada — valem, mas são a segunda onda.

**Achado 2.3.a — `Dashboard` embarca os dois painéis.** Evidência: [pages.config.js:53-54](../../src/pages.config.js) importa `Dashboard` estático; [Dashboard.jsx:2-9](../../src/pages/Dashboard.jsx) importa `AdminDashboard` e `FranchiseeDashboard` estáticos e escolhe em runtime. Impacto: o franqueado baixa ~12 KB gz de painel admin; o admin ~12 KB gz de painel de franqueado. Correção: em `Dashboard.jsx`, `const AdminDashboard = lazy(() => import("@/components/dashboard/AdminDashboard"))` (e simetricamente o franqueado) + `<Suspense fallback={<PageFallback/>}>`. O admin são ~3 pessoas em desktop — priorizar deixar o **franqueado** leve: lazy no `AdminDashboard` basta. Esforço P. Risco: `Suspense` sem fallback dá flash — usar o `PageFallback` já existente em [App.jsx:48-53](../../src/App.jsx).

**Achado 2.3.b — `Vendas` estático vale a pena para o franqueado, não para o admin.** Evidência: Vendas é a tela nº 1 (296 M + 245 PC sessões/3 dias); estático poupa um round-trip de chunk (~50–150 ms) no toque do FAB "Vender" ([Layout.jsx:127](../../src/Layout.jsx)). Custo: 19,5 KB gz para o admin, que é redirecionado ([Vendas.jsx:189-191](../../src/pages/Vendas.jsx)). Decisão recomendada: **manter estático**; se quiser os 19,5 KB de volta, trocar por `lazy` + `<link rel="modulepreload">` do chunk de Vendas injetado só para `role=franchisee` — não vale o esforço agora.

**Achado 2.3.c — Telas de auth e `OnboardingWelcome` estáticas.** [App.jsx:10-12](../../src/App.jsx). 6,9 KB gz em todo boot autenticado para telas que só aparecem deslogado/na 1ª entrada. Correção: `lazy()` nas três (elas já ficam dentro de `<Routes>`; envolver `AppRoutes` num `Suspense`). Esforço P. Risco: o `CLAUDE.md` avisa que a verificação de texto do Login no live muda de chunk (`Login-*.js` passa a existir) — atualizar o `.tmp/verify-content.mjs`.

---

## 3. Cascata de dados das 5 telas

### 3.1 O fato que governa tudo: a policy avalia função por linha

- **Evidência**
  - `pg_policies` de `sales`, `sale_items`, `inventory_items`, `contacts`, `expenses`, `franchises`: `qual = (is_admin_or_manager() OR (franchise_id = ANY (managed_franchise_ids())))`; em `sale_items`: `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY (managed_franchise_ids()))`. As funções são `STABLE SECURITY DEFINER` (SQL) — o planner **não inlina** SECURITY DEFINER e **não cacheia** função STABLE chamada direto no `WHERE`: chama por linha.
  - `EXPLAIN ANALYZE` da forma exata da policy (service_role, `auth.uid()` nulo — mede só o custo da avaliação):
    | consulta | plano | tempo |
    |---|---|---:|
    | `sales` sem filtro de franquia (forma da tela Vendas) | Seq Scan, 17.934 linhas filtradas, 2 chamadas de função por linha | **372 ms** |
    | idem com `(select is_admin_or_manager())` e `= any((select managed_franchise_ids())::text[])` | mesmo Seq Scan, 2 InitPlans avaliados 1× | **5,7 ms** |
    | `sale_items` 90d sem filtro (forma da Gestão) | Seq Scan 37.258 linhas | **757 ms** |
    | idem com InitPlan | | **6,5 ms** |
    | `sales` **com** `franchise_id = 'franquiasaopaulosp2'` (forma do Dashboard) | Bitmap Index Scan, 1.069 linhas | **24,5 ms** |
  - Em produção, com `auth.uid()` real, a função ainda faz um lookup em `profiles` por linha — por isso o `pg_stat_statements` dá números **maiores** que o EXPLAIN:

    | statement (tela) | filtro | chamadas | média | total |
    |---|---|---:|---:|---:|
    | `contacts` 15 col (MyContacts antes do fix de 05/08 + caminho admin) | só RLS | 18.507 | **3.458 ms** | 17,8 h |
    | `sales` SALES_COLUMNS **atual** (Vendas, desde 31/08 com `contact_phone`) | só RLS | 8.257 | **1.090 ms** | 2,5 h |
    | `sales` SALES_COLUMNS anterior (Vendas até 31/08) | só RLS | 53.021 | 608 ms | 8,9 h |
    | `sale_items` 8 col + `created_at` (Gestão) | só RLS | 39.909 | **795 ms** | 8,8 h |
    | `sales` 7 col 90d (Painel admin) | só RLS | 21.862 | 828 ms | 5,0 h |
    | `sales` PNL 13 meses (Financeiro admin) | só RLS | 6.354 | 1.000 ms | 1,8 h |
    | `daily_summaries` 90d (Painel admin) | só RLS | 12.906 | 542 ms | 1,9 h |
    | `inventory_items` 6 col (Vendas) | só RLS | 133.964 | 87 ms | 3,2 h |
    | `sales` 11 col (Início do franqueado) | `franchise_id =` | 52.517 | **27 ms** | 0,4 h |
    | `contacts` 7 col (Vendas) | `franchise_id =` | 127.723 | 42 ms | 1,5 h |
    | `sale_items` por `sale_id in()` (TabResultado) | `sale_id in` | 30.405 | 71 ms | 0,6 h |
    | `daily_summaries` 30 (Início) | `franchise_id =` | 73.499 | 9 ms | 0,2 h |

    Padrão sem exceção: **só-RLS = 87 ms a 3,5 s; com filtro explícito = 9 a 71 ms.**
- **Quem sofre**: todos — franqueado em Vendas (a tela mais usada), Gestão, Meus Clientes; admin no Painel e Financeiro. E o banco: essas 8 statements somam **~50 h de CPU** desde março.
- **Impacto**: em Vendas, a lista só aparece depois de 1,1 s de banco + rede, em cada abertura e a cada poll de 5 min. Em Gestão, +0,8 s. É a parcela "servidor" do QuickbackClick.
- **Correção** (as duas, nesta ordem):
  1. **Migração SQL**: reescrever as policies como `(select public.is_admin_or_manager()) OR franchise_id = ANY ((select public.managed_franchise_ids()))` (e a subquery de `sale_items` idem). É a recomendação oficial do Supabase ("wrap functions in select"). Aplicar com `DROP POLICY`/`CREATE POLICY` por tabela num único `apply_migration`, versionado em `supabase/`. Resultado esperado: 372→5,7 ms e 757→6,5 ms no filtro (medido).
  2. **Filtro explícito no cliente** onde falta: [Vendas.jsx:52 e :106](../../src/pages/Vendas.jsx) (`Sale.list` → `Sale.filter({ franchise_id: evoId }, …)`; o `evoId` vem de `selectedFranchise` do contexto, já disponível — a tela hoje filtra no cliente em [Vendas.jsx:139-142](../../src/pages/Vendas.jsx)); [Vendas.jsx:53/:107](../../src/pages/Vendas.jsx) (`InventoryItem`); [Gestao.jsx:92-96](../../src/pages/Gestao.jsx) (`InventoryItem`). Para `sale_items` da Gestão ([Gestao.jsx:97-102](../../src/pages/Gestao.jsx)), que não tem `franchise_id`: usar o embed `sales!inner(franchise_id)&sales.franchise_id=eq.X` do PostgREST (medi: 1.000 linhas em 175 ms com a service_role) — exige uma opção `embedFilter` no adapter, ou uma view `vw_sale_items_franchise` com `security_invoker`. Nota: com a policy corrigida (1), o ganho do (2) cai de ~40× para ~4× — o (1) é o que importa.
- **Esforço**: M (SQL + prova de paridade) + P (3 arquivos).
- **Risco de regressão**: semântica das policies é idêntica; provar como o `CLAUDE.md` manda — clonar a policy antiga sob outro nome não dá, então: `set_config('request.jwt.claims', …)` com o `sub` de 3 perfis (admin, franqueado de 1 unidade, franqueado de 2 — Araras×Limeira) e comparar `count(*)` de `sales`/`sale_items`/`contacts` antes e depois no mesmo statement (`with ctx as materialized …`, os dois `materialized` são obrigatórios). Depois, `pg_stat_statements` deve mostrar as médias caindo em 24 h.

### 3.2 Tabela por tela (franqueado, unidade Vila Maria = maior histórico; RTT 25–45 ms)

| Tela | Rounds seriais (após JS) | Requests | Linhas | JSON / ~gz | Gate do 1º dado útil | Onde dói |
|---|---|---:|---:|---:|---|---|
| **Início** (`/` e `/Dashboard`) | 3: `profiles` → `franchises` → lote de 10 + 2 RPCs | 17 | 713 vendas + 200 contatos + … | 330 KB / 63 KB | o lote inteiro (`isLoading` cobre os 10) — ~27 ms de banco + RTT | `sales` 100 dias × 11 col só para somar hoje/ontem/semana/mês (238 KB); `DailyChecklist` nunca lido |
| **Vendas** | 2: lote de 3 → `contacts` | 1 + (1+6) + 1 + 1 = 10 | 1.067 vendas, 56 itens, 1.000 contatos (teto) | 935 KB / 140 KB | `Sale.list` **1,09 s** de banco | RLS por linha; 25 colunas × 1.000 linhas = 698 KB; 5 páginas especulativas vazias |
| **Gestão › Resultado** | 6: (`getUser`→`profiles`) ‖ `franchises` → `inventory` ‖ `sale_items` 90d → `contacts` ‖ TabResultado (4) → `sale_items in(500)` ×3 chunks **em série** | 2+1+2+1+ (7+1+1+1) + 21 = **37** | 1.069 vendas, ~2.434 itens ×2 (Gestão e TabResultado buscam os mesmos itens) | ~1,5 MB / 280 KB | `sale_items` 90d **795 ms** e depois os chunks | 4 estágios seriais; itens duplicados; `User.me()`; remonta tudo no poll (seção 6) |
| **Meus Clientes** (Guarujá, 2.887) | 2: `franchises` → `contacts` fetchAll | 1 + (1+6) = 8 | 2.887 | 1,23 MB / 220 KB | 187 ms de banco + 3 páginas | renderiza **2.887 cards** sem janela; 4 páginas vazias |
| **Meu Vendedor** | 1 lote (configs `select *`, franchises `select *`, `User.me()` = 2 RTs) → status WhatsApp via n8n | 4 + 1 webhook | 1–2 configs (admin: 67 = 214 KB) | ~40 KB | o lote | `User.me()` desnecessário; webhook n8n com timeout 15 s ([functions.js:35-45](../../src/api/functions.js)) ⚠️ latência NÃO VERIFICADA |
| **Painel Geral** (admin) | 2 waves | 1+7+1+13+1+1 + 2 = 26 | 10.554 vendas, 5.179 resumos | ~2,0 MB / 350 KB | wave 1: `sales` 90d **828 ms/página** × 13 páginas | wave 2: 2 RPCs de bot a **2,4–3,6 s** de média, máx 7,99 s = `statement_timeout` (8 s do role `authenticated`) — falha e some no toast; `get_human_message_counts` devolve exatamente 1.000 linhas (teto do PostgREST, truncado em silêncio) |

Linhas de código: Início [FranchiseeDashboard.jsx:104-128, 294-341](../../src/components/dashboard/FranchiseeDashboard.jsx); Vendas [Vendas.jsx:50-54, 87-101](../../src/pages/Vendas.jsx); Gestão [Gestao.jsx:71-103, 163-180](../../src/pages/Gestao.jsx) + [TabResultado.jsx:776-834](../../src/components/minha-loja/TabResultado.jsx); Meus Clientes [MyContacts.jsx:171-223, 682](../../src/pages/MyContacts.jsx); Meu Vendedor [FranchiseSettings.jsx:145-176, 221-225](../../src/pages/FranchiseSettings.jsx); Painel [AdminDashboard.jsx:122-129, 178-181](../../src/components/dashboard/AdminDashboard.jsx).

### 3.3 Paginação especulativa custa 5 requests vazios exatamente no caso mais comum

- **Evidência**: [entities/all.js:36-61](../../src/entities/all.js) — `PAGE_CONCURRENCY = 6`: se a 1ª página vem cheia, dispara **6 páginas em paralelo**. Toda coleção entre 1.001 e 1.999 linhas (Vendas de Vila Maria = 1.067; TabResultado = 1.069; cada chunk de 500 vendas ≈ 1.140 itens; Guarujá 2.887 contatos) paga 7 requests onde 2–3 bastariam. Medido: página vazia de `sale_items in(500 ids)` levou **583 ms** (o `IN` de 500 UUIDs é reavaliado mesmo sem resultado; URL de 18.616 caracteres).
- **Quem sofre**: franqueado em Vendas, Gestão, Meus Clientes; admin no Painel (11 páginas → 13 requests, ok) e Financeiro.
- **Impacto**: TabResultado de Vila Maria = 31 requests, dos quais **15 voltam `[]`**.
- **Correção**: em `paginateAll`, buscar a página 1 sozinha depois da 0; só entrar no lote de 6 se a página 1 também vier cheia (custa 1 round-trip a mais só para coleções ≥ 2.000). Alternativa: pedir `Prefer: count=planned` na 1ª página e ler `Content-Range` para saber quantas páginas faltam (o adapter já monta a query; `.select(cols, { count: 'planned' })`).
- **Esforço**: P. **Risco**: nenhum de dado (tie-breaker por `id` continua); testar com uma coleção de 1.500 e uma de 7.000 linhas contando requests no DevTools.

### 3.4 `User.me()` refaz autenticação em 6 páginas

- **Evidência**: [entities/all.js:442-455](../../src/entities/all.js) — `supabase.auth.getUser()` é chamada de rede ao GoTrue (`/auth/v1/user`) + `profiles select *`. Chamado em [Gestao.jsx:72](../../src/pages/Gestao.jsx) (no lote crítico), [FranchiseSettings.jsx:151](../../src/pages/FranchiseSettings.jsx), [Financeiro.jsx:45](../../src/pages/Financeiro.jsx), [Franchises.jsx:98](../../src/pages/Franchises.jsx), [Onboarding.jsx:93](../../src/pages/Onboarding.jsx), [MyChecklist.jsx:100](../../src/pages/MyChecklist.jsx). O `AuthContext` já tem `id, email, full_name, role, managed_franchise_ids` ([AuthContext.jsx:55-61](../../src/lib/AuthContext.jsx)). `pg_stat`: `profiles.*` por id = 60.824 chamadas.
- **Impacto**: 2 round-trips seriais (~100–300 ms no celular) por abertura de Gestão, antes de qualquer dado.
- **Correção**: usar `user` do `useAuth()` nas 6 páginas; `User.me()` fica só para o `PageNotFound`. Esforço P. Risco: Gestão usa `userData.role` para o redirect de admin ([Gestao.jsx:214](../../src/pages/Gestao.jsx)) — o `user.role` do contexto é o mesmo campo.

---

## 4. `TabResultado` carrega o histórico inteiro

- **Evidência**: [TabResultado.jsx:781-796](../../src/components/minha-loja/TabResultado.jsx) — `Sale.filter({franchise_id}, null, null, {fetchAll:true})` e `Expense.filter` sem `gte`; [:804-816](../../src/components/minha-loja/TabResultado.jsx) `SaleItem.filter({sale_id: chunk})` em `for … await` (série).
- **Pior caso real** (SQL no projeto): Vila Maria `franquiasaopaulosp2` — **1.069 vendas** (1ª em 31/01/2026; 1.067 nos últimos 6 meses; 652 nos últimos 90 d), **2.434 sale_items**, 37 despesas, 56 itens de estoque, 2.383 contatos. Depois: Santos 969/2.263, Guarujá 951/1.900, Guarapiranga 727/1.627.
- **O que "inteiro" significa hoje**: o histórico da rede tem ~7 meses, então "tudo" ≈ "6 meses". O corte quase não muda o custo **hoje** — muda a **derivada**: Vila Maria cresce ~150 vendas/mês; em set/2027 serão ~2.900 vendas + ~6.600 itens = 3 + 7 páginas + 6 chunks de 500 ids × 7 requests = **~55 requests e ~3 MB por abertura de Gestão**, sem contar o poll (seção 6).
- **Custo medido agora** (Vila Maria): sales p0 419 KB (96 ms) + p1 29 KB + 5 vazias; expenses 15 KB; inventory 10 KB; audit 5 KB; sale_items chunk 1: p0 261 KB (197 ms) + p1 35 KB (91 ms) + vazia 583 ms; ×3 chunks. Total ≈ **31 requests, ~1,05 MB JSON (~190 KB gz), 4 estágios seriais** → 2–3 s em fibra, mais no celular.
- **O que a tela usa de fato**: `selectedMonth` (mês navegado) e mês anterior para o DRE ([:844-853](../../src/components/minha-loja/TabResultado.jsx)); 6 meses para a "Evolução" ([:867-875](../../src/components/minha-loja/TabResultado.jsx)); jan→mês do ano para o `ResumoAnoCard` ([:939-940](../../src/components/minha-loja/TabResultado.jsx)); `saleItems` só para ranking de produtos do mês/mês anterior e "recentes" ([:846, 853, 897, 910, 946](../../src/components/minha-loja/TabResultado.jsx)).
- **Corte proposto**:
  1. `sales`/`expenses`: `gte: { sale_date: '<1º de jan do ano de selectedMonth>' }` e `lte` no fim do mês navegado, com **refetch quando o ano mudar** (o `ResumoAnoCard` já "segue o ano do mês navegado"). Cobre DRE, Evolução (6 meses — atenção em jan/fev: puxar `min(1º jan, mês−6)`), acumulado do ano. Payload de Vila Maria hoje: igual (7 meses); em 2027: 12 meses em vez de 20.
  2. `sale_items`: buscar por **mês** (só as vendas do mês navegado e do anterior), não por chunk de 500 ids do histórico — via `sales!inner(franchise_id, sale_date)` com `sales.sale_date=gte.…` (1 request de ~200 linhas), ou uma RPC `get_franchise_product_ranking(p_franchise_id, p_month)` que devolve o ranking já agregado (~30 linhas). A RPC é o caminho "certo" porque some com o `IN(500 uuids)` de 18 KB de URL.
  3. Não duplicar com a Gestão: `TabEstoque`/`TabReposicao` usam `saleItems` de 90 d para giro ([stockSuggestion.js](../../src/lib/stockSuggestion.js), `LOOKBACK_DAYS=28`); se a Gestão passar a buscar 90 d com o filtro de franquia (3.1), o TabResultado pode receber esses mesmos itens por prop para o mês corrente e só buscar o resto sob demanda ao navegar para trás.
- **Esforço**: M. **Risco de regressão**: DRE do mês (dinheiro) — rodar `node src/lib/financialCalcs.test.mjs` não cobre a janela; comparar `lucroCaixa` de 3 meses (atual, −1, −6) e o `ResumoAnoCard` antes/depois para Vila Maria e para uma unidade nova (< 2 meses de dado, que hoje esconde o card).

---

## 5. react-query: adotar ou remover?

**Estado**: [App.jsx:188](../../src/App.jsx) monta o `QueryClientProvider`; [query-client.js:4-11](../../src/lib/query-client.js) define `refetchOnWindowFocus:false, retry:1` e **nenhum `staleTime`** (default 0 = refaz no mount, igual ao `useEffect`). Consumidores: [useSubscriptionStatus.js:33-47](../../src/hooks/useSubscriptionStatus.js) (montado 3× — `SubscriptionPaywall`, `FinancialObligationsCard`, `FranchiseeDashboard` — e aí a dedupe por `queryKey` **já entrega valor**: 1 request em vez de 3; `pg_stat`: 56.087 chamadas a `system_subscriptions`) e [PageNotFound.jsx:11-20](../../src/lib/PageNotFound.jsx). Custo no bundle: 36 KB bruto / **10,3 KB gz** no entry.

**Custo de remover** (P, ~1 h): reescrever `useSubscriptionStatus` com cache em módulo (`Map` por `franchiseId` + `staleTime` manual) para manter a dedupe tripla; `PageNotFound` volta a `useEffect`. Ganho: −10,3 KB gz (≈ 4% do caminho crítico pós-fix). Perde-se a infraestrutura para o que vem a seguir.

**Custo de adotar de verdade** (fase A = M, fase B = G):
- Fase A (meio dia): `useFranchises()` = `useQuery(['franchises'], Franchise.list, { staleTime: 10 min })` e `useFranchiseConfigs()`; trocar em [Layout.jsx:155](../../src/Layout.jsx), [Vendas.jsx:51](../../src/pages/Vendas.jsx), [Gestao.jsx:73](../../src/pages/Gestao.jsx), [MyContacts.jsx:211](../../src/pages/MyContacts.jsx), [FranchiseSettings.jsx:149-150](../../src/pages/FranchiseSettings.jsx). Hoje `franchises.*` é chamada **77 k vezes** (+35 k da variante de 5 colunas) porque cada tela busca de novo; com cache, 1 por sessão. O primeiro round da Vendas/Gestão/Meus Clientes passa a ser instantâneo.
- Fase B (2–3 dias): Vendas, Gestão, Início, Meus Clientes em `useQuery` com `queryKey` por `[tela, evoId, janela]`, `staleTime: 2 min`, `refetchInterval: 5 min` + `refetchIntervalInBackground: false` (substitui `useVisibilityPolling` — mesma semântica de "só com a aba visível"), `placeholderData: keepPreviousData` (mata o remount da Gestão, seção 6.2) e `select` para o filtro por unidade. Some o boilerplate `mountedRef`/`AbortController`/`loading`/`retryCount` de ~60 linhas por tela.
- Ganhos que só o RQ dá: Início → Vender → Início (o loop do franqueado, ~9 trocas de tela por usuário/dia pelo volume do Clarity) sem refazer 10 + 10 requests; dedupe de `franchises`/`config`/`notifications` entre Layout e página.
- O que o RQ **não** resolve: tamanho de payload, RLS por linha, chunks estáticos — que são 80% do problema. E só rende com `staleTime > 0`.

**Recomendação: um caminho — ADOTAR, incrementalmente, depois da onda 1.** Ordem: seções 2.1, 2.2, 3.1, 3.3, 6 (todas P/M, sem RQ) → Fase A do RQ (P/M) → Fase B só em Vendas e Início (G), medindo requests/sessão antes e depois. Não remover: economizar 10 KB gz e reescrever cache à mão é trocar uma dependência já paga por código próprio com os mesmos bugs (o `mountedRef` de hoje é exatamente isso).
**Guarda contra tela branca** (regra 7 do contexto): cada tela migrada passa pela varredura `\bSimb\s*\(|<Simb` × `import … Simb` do `CLAUDE.md` + ligar `no-undef` no `eslint.config.js` para `src/pages` e `src/components` (a frente 02 detalha) + smoke Playwright do fluxo Início→Vender→Gestão.

---

## 6. Polling

Hook: [useVisibilityPolling.js](../../src/hooks/useVisibilityPolling.js) — `setInterval` só com aba visível (`stopPolling` em `document.hidden`, :49-57), throttle de 60 s ao voltar (:11, :53-54). Consumidores e o que cada disparo custa (unidade Vila Maria):

| Consumidor | Intervalo | Requests por disparo | KB JSON | Por hora de aba visível |
|---|---|---:|---:|---:|
| `NotificationBell` [:45](../../src/components/ui/NotificationBell.jsx) (em toda página) | 2 min | 1 (`select *`, 20 linhas) | 6,6 | 30 req / 0,2 MB |
| `FranchiseeDashboard` [:187](../../src/components/dashboard/FranchiseeDashboard.jsx) | 5 min | 10 (não refaz ranking/funil) | ~330 | 120 req / 4 MB |
| `Vendas` [:120](../../src/pages/Vendas.jsx) | 5 min | 1+6 (`sales` 6 m) + 1 + 1 | ~935 | 108 req / **11 MB** |
| `Gestao` [:58](../../src/pages/Gestao.jsx) | 5 min | remonta a página: 6 + TabResultado 31 | ~1.500 | **444 req / 18 MB** |
| `AdminDashboard` [:232](../../src/components/dashboard/AdminDashboard.jsx) | 5 min | 26 (+3 lazy se expandido) | ~2.000 | 312 req / 24 MB |
| `Financeiro` [:154](../../src/pages/Financeiro.jsx), `CustomerSuccess` [:82](../../src/pages/CustomerSuccess.jsx) | 5 min | admin/CS | — | — |
| `versionCheck` [:43-49](../../src/lib/versionCheck.js) | 5 min + foco | 1 (`index.html`, 3 KB) | 3 | 12 req |
| `useSubscriptionStatus` (react-query, `refetchOnWindowFocus: true`) | foco, se stale (5 min/24 h) | 1 | 0,6 | ~0–12 |

**Medido no agregado** (`pg_stat_statements`): `notifications` = **644.049 chamadas** desde 20/03 (2ª query mais chamada do banco inteiro, atrás só do log de mensagens do bot) = 3.766/dia na média; no delta de 14 min de segunda 10:30 BRT: 108 (7,7/min → ~15 abas abertas ao mesmo tempo). No mesmo delta: 27 aberturas/polls de Vendas, 20 de Início, 6 de Gestão.

**Por franqueado/dia** (premissa: 4 h de aba visível, metade em Vendas, metade em Início; 5 boots): Bell 120 + Vendas 216 + Início 240 + boots 85 ≈ **660 requests e ~35 MB de JSON** para uma unidade do tamanho de Vila Maria; para a mediana (≈ 300 vendas/6 m) ≈ 660 requests e ~12 MB. Quem passa a tarde em Gestão › Estoque paga 444 req/h.

**Desperdício puro (por ordem de volume)**:
1. **Gestão remonta a página no poll** — [Gestao.jsx:55-58](../../src/pages/Gestao.jsx) chama `loadData()`, que faz `setLoading(true)` ([:67](../../src/pages/Gestao.jsx)) → `if (loading) return <Skeleton>` ([:187-199](../../src/pages/Gestao.jsx)) **desmonta** `TabEstoque`/`TabResultado`/`TabReposicao`; ao voltar, `TabResultado` refaz seus 31 requests ([:834](../../src/components/minha-loja/TabResultado.jsx)) e `selectedMonth` volta ao mês atual; edição inline de estoque em curso é perdida. Correção: `if (!hasLoadedOnceRef.current) setLoading(true)` (padrão que `AdminDashboard.jsx:104` e `FranchiseeDashboard.jsx:84` já usam) — P. Risco: nenhum; verificar deixando a aba Gestão aberta 6 min com um campo de quantidade em edição.
2. **Vendas rebaixa 745 KB de vendas a cada 5 min** mesmo sem venda nova. Correção barata: no refresh, buscar só `sale_date >= hoje−1` e mesclar por `id` (ou `updated_at >= último refresh`, se a coluna existir em `sales` — `set_updated_at` é trigger BEFORE UPDATE, então existe) — P/M.
3. **`DailyChecklist` buscado e nunca lido** — [FranchiseeDashboard.jsx:114-115](../../src/components/dashboard/FranchiseeDashboard.jsx); nenhum `getValue(3)` em [:132-161](../../src/components/dashboard/FranchiseeDashboard.jsx). `pg_stat`: **75.716 chamadas**. Correção: apagar a linha. P.
4. **`Layout.loadQuickStats` (admin)** — [Layout.jsx:233-249](../../src/Layout.jsx) busca `daily_unique_contacts` e `sales` de hoje; `todaySales`/`todayContacts` só existem em [:135-136](../../src/Layout.jsx), nunca no JSX. P.
5. **`User.me()` ×6** (seção 3.4).
6. **5 páginas especulativas vazias** (seção 3.3).
7. **`Franchise.list()` `select *` 5×/sessão** (seção 5, fase A).
8. `NotificationBell` com `select *` e 2 min: trocar por `select id, read, title, link, created_at` e 5 min (ou só `read=eq.false` para o badge) — P. Hoje é a query mais chamada do app: 30/h por aba × ~15 abas.

Adiar a discussão de "Realtime em vez de polling": com Realtime do Supabase o `realtime-js` (35 KB bruto) já está no bundle, mas 66 canais abertos e RLS por linha nos filtros trariam outro custo — só depois de 3.1.

---

## 7. O sinal do Clarity que é performance: onde o usuário espera em `/`

`/` é o `start_url` do PWA ([manifest.json](../../public/manifest.json)) e o destino do login ([App.jsx:146](../../src/App.jsx)). `/` e `/Dashboard` renderizam o **mesmo** componente ([App.jsx:64-70](../../src/App.jsx) vs `Pages.Dashboard`), mas o Clarity os conta como páginas diferentes — a barra inferior "Início" leva a `/Dashboard` ([Layout.jsx:125](../../src/Layout.jsx)), e `PageErrorBoundary key={location.pathname}` ([App.jsx:66, 74](../../src/App.jsx)) **remonta** a página na troca `/`→`/Dashboard`, refazendo os 12 requests do Início. (Se o `Layout` também remonta nessa troca: ⚠️ NÃO VERIFICADO em runtime; pelo código, o elemento de rota é o mesmo tipo na mesma posição, então não deveria.)

Clarity, 3 dias, `/` Mobile: 211 sessões, 2.270 s totais, 165 s ativos = **10,8 s por sessão, 0,8 s de interação**. `/Dashboard` Mobile: 3,9 s por sessão, 0,4 s ativo, 75% QuickbackClick. Ou seja: em `/` a pessoa fica ~11 s e interage menos de 1 s — o tempo de espera do boot está dentro desses 11 s (o tag do Clarity é injetado no `<head>` antes do app, então grava desde a tela branca).

**Round-trips entre abrir o app e ver o primeiro número** (franqueado, PWA, sessão salva):

| # | Etapa | Código | Custo medido |
|---|---|---|---|
| 0 | `GET /` (HTML 3 KB, sem `Cache-Control`) | nginx | TTFB 38 ms em fibra |
| 1 | 9 assets em paralelo (h2) — **2,23 MB sem compressão**; o entry só executa quando `export-*.js` (856 KB) e `recharts-*.js` (415 KB) terminam; em paralelo o CSS do Google Fonts (render-blocking, 0,9 KB, 151 ms) e a icon-font de **1,1 MB** | [index.html:24-27, 42](../../index.html), [vite.config.js:22-29](../../vite.config.js) | fibra: pronto em 183 ms; 4G 10 Mbps: ~1,8 s (+0,9 s da icon-font disputando banda) |
| 2 | React monta → `AppRoutes` mostra **spinner de tela cheia** ([App.jsx:130-136](../../src/App.jsx)) enquanto `initAuth` roda: `getSession()` (local; **+1 round-trip** ao GoTrue se o JWT de 1 h venceu — PWA reaberto de manhã) | [AuthContext.jsx:155-160](../../src/lib/AuthContext.jsx) | 0 ou ~150 ms |
| 3 | `profiles` (5 colunas, 151 B) — **round-trip serial 1** | [AuthContext.jsx:47-51](../../src/lib/AuthContext.jsx) | 0,4 ms banco + RTT |
| 4 | `isLoading=false` → `Layout` monta → `Franchise.list()` `select *` (67 linhas/32 KB para admin; 1–2 para franqueado) ‖ `Notification.list(20)` — **round-trip serial 2** | [Layout.jsx:155, 462/481](../../src/Layout.jsx) | 3,6 ms + RTT |
| 5 | `setSelectedFranchise` ([Layout.jsx:165](../../src/Layout.jsx)) → `FranchiseeDashboard.loadData` (10 em paralelo; `sales` 100 d = 713 linhas/238 KB) ‖ `OnboardingChecklist` ‖ `system_subscriptions` ‖ RPCs ranking (9,8 ms) e funil (75 ms) — **round-trip serial 3**; o primeiro número aparece quando os 10 terminam (`isLoading` único) | [FranchiseeDashboard.jsx:104-128](../../src/components/dashboard/FranchiseeDashboard.jsx) | 27 ms banco + RTT + 238 KB (46 KB gz) |

Total: **~36 requests** (1 HTML + 9 JS/CSS + 2 CSS de fonte + 3 woff2 + 2 Clarity + 1 manifest + ~17 Supabase) e **3 round-trips seriais de dados** (4 com refresh de token) depois do JS. Estimativa até o primeiro número: fibra ≈ 0,9–1,2 s; 4G (10 Mbps/150 ms RTT) ≈ **4–5 s** (1,8 s JS + ~0,9 s de disputa com a icon-font + 3 × ~250 ms + parse de 2,2 MB de JS num celular médio ≈ 0,5–1 s); sinal ruim (2 Mbps) ≈ 12–15 s. Com as seções 2.1 + 2.2 + 8.1: 4G ≈ **1,3–1,6 s**.

O que é UX e não performance nesses 75% de QuickbackClick (fica para a frente 04): a pessoa que abre o app para vender toca o FAB no 1º segundo — o Início é um corredor. Mas a parte de performance é objetiva: a tela branca antes do spinner não existe por causa de dados, existe por causa de 1,27 MB de PDF/Excel/gráfico e 1,1 MB de ícones que ninguém pediu.

Correções específicas do boot, além das seções 2/8:
- **Colapsar rounds 4 e 5**: `FranchiseeDashboard` não precisa esperar `Franchise.list()` — para franqueado de 1 unidade, `managed_franchise_ids` já está no `profiles` (round 3); o `evolution_instance_id` é o próprio id "texto" do array (o `CLAUDE.md` diz que o array guarda UUID **e** evo_id). Disparar o lote do dashboard assim que `user` existe, e só cair no `Franchise.list` quando houver 2+ ids (regra 8 do contexto: `resolveActiveFranchise`). Esforço M; risco: multi-unidade (testar Araras×Limeira).
- **Mostrar a casca antes do perfil**: o spinner de tela cheia ([App.jsx:130-136](../../src/App.jsx)) some se o `Layout` renderizar com o `user` mínimo salvo em `localStorage` (id/role/nome) e o `profiles` confirmar depois. Esforço M; risco: papel errado por 1 round-trip (só nav — RLS protege os dados). Fica atrás dos anteriores em prioridade.

---

## 8. Custos escondidos

### 8.1 Icon-font de 1,1 MB e "ícones em texto"
- **Evidência**: CSS do Google para `Material+Symbols+Outlined:wght,FILL@100..700,0..1` devolve **1 woff2 de 1.128.840 bytes** (HEAD com UA Chrome mobile). Carregada com `media="print" onload` ([index.html:26](../../index.html)) — assíncrona, mas começa em t≈45 ms e compete com os 2,23 MB de JS. [MaterialIcon.jsx:16-25](../../src/components/ui/MaterialIcon.jsx) renderiza `<span class="material-symbols-outlined">{icon}</span>` → até a fonte chegar, a UI mostra `wb_sunny`, `point_of_sale`, `bar_chart`, `people` como texto (o `font-display: swap` do CSS do Google garante isso). 141 nomes literais em `src` + mapas dinâmicos (`icon={card.icon}` etc.). Texto: Inter variável latin 48 KB + Plus Jakarta latin 27 KB = 76 KB (ok; `latin-ext` não é baixado para pt-BR).
- **Quem sofre**: todos, mais no celular; cache do Google Fonts é particionado por site, então a 1ª visita de cada aparelho é fria.
- **Impacto**: ~0,9 s a 10 Mbps, ~4,5 s a 2 Mbps de ícones ilegíveis; e banda roubada do boot.
- **Correção**: gerar subset em build (`pyftsubset` com `--text` dos nomes ou o parâmetro `&icon_names=` do Google Fonts, que exige a lista) e servir de `/assets` com `font-display: block` (ícone some por 100 ms em vez de virar texto). Estimativa ≤ 30 KB para ~180 ícones. A lista sai de `grep -rhoE 'icon="[a-z_0-9]+"' src` + os mapas (`EVENT_ICON`, `STATUS_CONFIG`, `tierConfig`, `categoryMeta`) — um script de build que falha se encontrar nome fora do subset é o guard.
- **Esforço**: M. **Risco**: ícone fora do subset vira quadrado — o guard de build + smoke visual de 5 telas.

### 8.2 Clarity
- Bootstrap inline síncrono no `<head>` ([index.html:32-38](../../index.html)) é pequeno e injeta `clarity.ms/tag/…` com `async=1` — **não bloqueia** (Playwright: o tag começa em 195 ms, após `domInteractive`; `clarity.js 0.8.69` em 245 ms; 1º `collect` em 419 ms). Tamanho opaco (sem `Timing-Allow-Origin`) ⚠️ NÃO VERIFICADO; custo de CPU do gravador em listas de 2.887 cards ⚠️ NÃO VERIFICADO. Não é prioridade de performance.

### 8.3 Imagens
- Logo servido: `logo-maxi-massas-optimized.png` 16,8 KB (Layout, Login, AuthHero, SaleReceipt, OnboardingWelcome). O `src/assets/logo-maxi-massas.png` de **1,44 MB** não é importado por ninguém → não vai para o bundle, só ocupa o repo (apagar). `logo-maxi-massas-optimized.webp` (23 KB) não é usado. Ícones PWA 8–36 KB. Nada a fazer além da limpeza.

### 8.4 `index.css` (102 KB bruto / 16,9 KB gz)
- Tailwind podado de verdade (`content` correto em [tailwind.config.js](../../tailwind.config.js)): 1.414 regras, 583 classes distintas, 77 hex distintos, 5 `@keyframes`, 9 `@media`, preflight 6 KB. O bloco `.dark` (~1 KB) é morto (não há toggle). Sem `@font-face` interno. **Não é alvo**: 17 KB gz; o que pesa é a icon-font externa. (A frente 03 cuida da higiene dos 77 hex.)

### 8.5 `React.memo` / virtualização
- Existem 6 `React.memo` ([ConversionCard, DailyRevenueChart, FranchiseRanking, MiniRevenueChart, SmartActions, StatsCard](../../src/components/dashboard)). Nas listas:
  - **TabEstoque**: máximo real **56 itens/franquia** — sem problema; não virtualizar.
  - **TabLancar**: `filteredSales` é o mês navegado ([TabLancar.jsx:193-207](../../src/components/minha-loja/TabLancar.jsx)) — ≤ ~250 linhas na maior unidade; ok.
  - **MyContacts**: `filteredContacts.map` ([MyContacts.jsx:682](../../src/pages/MyContacts.jsx)) renderiza **todos** — Guarujá 2.887 cards, Vila Maria 2.383, Guarapiranga 2.194 (10 unidades acima de 1.600). Cada card tem botões e `notas.slice(0,80)`. Correção: paginação simples de 50 com "Carregar mais" (`useState(visible)`, `.slice(0, visible)`) — o filtro/busca continuam sobre a lista inteira em memória. Esforço P. Risco: o export CSV ([:637-656](../../src/pages/MyContacts.jsx)) deve continuar usando `filteredContacts` completo. Sem virtualização de biblioteca: o app não tem `react-window` e 50 cards por página resolve.

---

## 9. Orçamento de performance proposto e como provar

| Métrica | Hoje (medido/estimado) | Orçamento | Como medir |
|---|---|---|---|
| Bytes na rede até o app executar (JS+CSS) | **2.226 KB** (0% gzip; entry espera export+recharts) | **≤ 300 KB** (gz+br; ≈ 261 KB com 2.1+2.2) | Playwright em `/login`, cache frio: `sum(transferSize)` dos `/assets/*` — script `perf-boot.mjs` (o do scratchpad desta auditoria; recriar em `.tmp/`) |
| Chunks preloaded no boot | 6 (com `export`, `recharts`) | 4 (vendor, supabase, ui, dates) | `grep modulepreload dist/index.html` |
| Icon-font | 1.129 KB | ≤ 40 KB | `HEAD` do woff2 servido |
| Round-trips seriais de dados até o 1º número | 3 (4 com refresh) | 2 | DevTools waterfall após login; ou `performance.mark('first-number')` no `FranchiseeDashboard` quando `allSales` chega, enviado ao Clarity com `clarity('set','ttfn', bucket)` |
| Tempo até o 1º número, 4G (10 Mbps/150 ms) | ~4–5 s (estimado) | ≤ 2,0 s | idem, agrupado por `role` e `device` no Clarity |
| Statement de tela com média > 100 ms | 7 (341 ms–3,5 s) | 0 | `select calls, mean_exec_time from pg_stat_statements where query like 'WITH pgrst_source%' and calls > 1000 order by mean_exec_time desc` (as 8 statements da seção 3.1 devem cair para < 60 ms em 24 h) |
| Payload de dados por abertura de tela (gz) | Vendas 140 KB · Resultado 190 KB · Clientes 220 KB | ≤ 100 KB | Node `rest-measure.mjs` (scratchpad) ou DevTools |
| Requests por hora de aba visível | Gestão 444 · Início 120 · Vendas 108 | ≤ 60 | DevTools 10 min × 6; e `notifications` no `pg_stat` (hoje 7,7/min na rede) |
| `notifications` chamadas/dia (rede) | 3.766 média, ~11 k em pico | ≤ 1.500 | `pg_stat_statements` delta diário |
| 502 em deploy | ~75 s | 0 (imagem pré-buildada) | `curl` em loop durante o `deploy.mjs` |
| Clarity `/` Mobile tempo ativo/total · `/Dashboard` Mobile QuickbackClick | 7% · 75% | > 20% · < 50% | `00b` re-puxado 2 semanas após a onda 1 (mesmo endpoint da API, `numOfDays=3`) |

---

## 10. Lista priorizada — (impacto × alcance) / esforço

| Ordem | Achado | Seção | Esforço | Alcance |
|---|---|---|---|---|
| 1 | Compressão + `Cache-Control` no live (Traefik compress ou nginx da stack; opcional: imagem pelo Dockerfile do repo) | 2.1 | P | todos |
| 2 | `manualChunks` em função — tira `export` e `recharts` do caminho crítico | 2.2 | P | todos |
| 3 | Policies RLS com `(select fn())` + filtro `franchise_id` em Vendas/Gestão | 3.1 | M + P | todos |
| 4 | Subset da icon-font (1,1 MB → ≤ 30 KB) | 8.1 | M | todos |
| 5 | Gestão não remontar no poll; `DailyChecklist`; `loadQuickStats`; `User.me()`; paginação especulativa | 6, 3.3, 3.4 | P cada | franqueado |
| 6 | Painel admin: 2 RPCs de bot a 2,4–3,6 s batendo no `statement_timeout` de 8 s e 1.000 linhas truncadas → mover para seção colapsada/lazy (como Contact/Inventory já são) ou agregado diário via `pg_cron` em tabela | 3.2 | M | admin (3 pessoas, todo dia) |
| 7 | TabResultado com janela (ano navegado) e `sale_items` por mês/RPC | 4 | M | franqueado (cresce com o tempo) |
| 8 | MyContacts com "Carregar mais" (50) | 8.5 | P | franqueado de unidade grande |
| 9 | react-query fase A (`useFranchises`) e depois fase B (Vendas, Início) | 5 | M / G | franqueado |
| 10 | `AdminDashboard` lazy dentro de `Dashboard.jsx`; auth pages lazy | 2.3 | P | −12 KB / −7 KB gz |
| 11 | `NotificationBell`: colunas enxutas e 5 min | 6 | P | banco |
| 12 | Início: substituir `sales` 100 d × 11 col (238 KB) por RPC de totais diários (~6 KB) — respeitando o gotcha "MiniRevenueChart nunca lê `daily_summaries`": a RPC soma de `sales` ao vivo | 3.2 | M | franqueado |

O que **não** vale fazer agora: virtualizar TabEstoque/TabLancar (não há volume), mexer no `index.css` (17 KB gz), trocar Clarity de lugar, remover react-query.

---

## Apêndice — números brutos usados

- Bundle (build 01/09, `dist/assets`, bruto/gz): export 856.139/279.756 · recharts 414.992/111.699 · index 373.969/106.667 · html2canvas 201.860/47.103 · supabase 170.669/44.854 · vendor 163.759/53.570 · index.es 159.398/53.203 · CustomerSuccess 127.319/39.799 · index.css 102.120/16.882 · ui 86.239/29.695 · FranchiseSettings 72.107/19.942 · Gestao 59.500/14.804 · TabResultado 48.105/12.377.
- Build alternativo (manualChunks função): index 369.170/105.059 · TabResultado(+recharts) 462.633/124.247 · xlsx 428.335/141.619 · jspdf 390.651/127.133 · index.es 159.516/53.277 · vendor 164.887/53.802 · supabase igual · ui 85.265/29.201.
- Live (Playwright, fibra, cache frio, `/login`): TTFB 38 ms · domInteractive 198 · FCP 540 · todos os 9 assets iniciam em t=42–43 ms, o último (`export`) termina em 183 ms · `totalWire` 2.226.597 B · protocolo h2.
- Supabase: projeto `sa-east-1`, PG 17.6; RTT daqui 24–91 ms (5 amostras); `authenticated.statement_timeout = 8s`, `anon = 3s`.
- Tabelas (`n_live_tup`): conversation_messages 938.438 (642 MB) · bot_conversations 208.599 · contacts 56.845 · sale_items 37.245 · audit_logs 23.551 · sales 17.928 · daily_unique_contacts 13.993 · daily_summaries 9.859 · notifications 8.298 (4.892 não lidas; máx 722/usuário) · inventory_items 2.201 (máx 56/franquia) · expenses 2.039. 67 franquias, 68 perfis de franqueado. Vendas 90 d: 10.554; 6 m: 17.926.
- PostgREST medido (service_role, bytes JSON / gz~): Vendas sales p0 697.707/97.466 (130 ms) · p1 46.785 · inventory 10.600 · contacts (teto 1.000) 178.813/35.238 · Início sales 238.087/46.121 (67 ms) · contacts 200 65.599 · TabResultado sales p0 419.369/72.893 · sale_items in(500) p0 260.526/50.545 (197 ms), p1 35.312, vazia 2 B em **583 ms** · MyContacts Guarujá 423.190 + 425.625 + 382.648 · Admin sales 90 d p0 185.470 · daily_summaries p0 162.357 · contacts rede p0 342.559 (×57 páginas) · configs `select *` 214.480 · `get_human_message_counts` 1.000 linhas em 7.309 ms · `get_bot_leads_daily` 495 ms.
- `pg_stat_statements` (desde 20/03/2026): ver tabela da seção 3.1; RPCs de bot com `p_since`: 2.589 chamadas a 3.573 ms (máx 7.996), 1.613 a 3.061 ms (máx 7.992), 1.386 a 2.386 ms (máx 7.994); `get_franchise_health_signals` 372–412 ms; `reconcile_cs_auto_tasks` 1.590 ms.
- Delta 13:27:40→13:41:43 UTC (14 min, seg. manhã): notifications +108 · inventory (Vendas) +27 · contacts (Vendas) +27 · onboarding_checklists +25 · daily_checklists +20 · ranking RPC +20 · dashboard sales +20 · franchises `select *` +18 · system_subscriptions +16 · sale_items (Gestão) +6 · Vendas sales atual +2.
