<!-- Last Updated: 2026-08-12 -->
# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Este arquivo contém APENAS especificidades do dashboard.

## Comandos
```bash
npm run dev     # Vite :5173 — no Windows/OneDrive NÃO imprime o banner, mas sobe
npm run build   # pode terminar sem output: conferir timestamp de dist/index.html
npm run lint    # eslint --quiet — ⚠️ no-undef DESLIGADO (símbolo não-importado passa e vira tela branca)
node src/lib/financialCalcs.test.mjs   # 27 testes do dinheiro (DRE, taxa repassada × absorvida)
node src/lib/franchiseUtils.test.mjs   # multi-unidade (resolveActiveFranchise)
node .tmp/deploy.mjs                   # force update do serviço no Portainer (depois do push)
```
Deploy = `git push origin main` → `node .tmp/deploy.mjs` → verificar por **CONTEÚDO** no live (~75s de 502). ⚠️ `git push` puro TRAVA (GCM headless no Windows): `TOK=$(gh auth token); git -c credential.helper= push "https://x-access-token:$TOK@github.com/nelpno/franchiseflow.git" main` (mascarar o token na saída; `$LASTEXITCODE`/`PUSH_RC=0` é a prova, não a cor). ⚠️ **Push por URL com token NÃO atualiza `origin/main`** → `git status` segue dizendo *"ahead 1"* com o push já feito, e o sinal *"ahead = deploy nunca aconteceu"* do CLAUDE.md raiz passa a MENTIR. Provar com `git ls-remote origin main` (bate com `git rev-parse main`?) e rodar `git fetch origin` para ressincronizar.

## Voltar atrás (roteiro de emergência, 28/09/2026)
Ordem: **1) chave → 2) front → 3) SQL → 4) n8n.** A chave resolve em segundos sem deploy; o resto só se ela não cobrir.
1. **Chave liga/desliga** (`feature_flags`, SQL `supabase/2026-09-28-feature-flags.sql`): pelo MCP `execute_sql` (sem claims = passa) — rede: `select public.set_feature_flag('ui_v2', null, false, 'emergência: <motivo>');` · uma unidade: `select public.set_feature_flag('ui_v2', '<evo>', false, '<motivo>');` · voltar a seguir a rede: `delete from feature_flags where key='ui_v2' and franchise_id='<evo>';`. O front lê por `useFeatureFlag(FEATURE_KEYS.UI_V2)` (cache 5 min + foco da janela; erro = desligada). Chave nova = linha nova + nome em `src/lib/featureFlags.js`. Dentro de SQL: `feature_flag_enabled('<chave>', '<evo>')`.
2. **Front:** `git revert <sha>` (nunca `reset` em main publicado) → push por URL com token (ver Comandos) → `node .tmp/deploy.mjs` → conferir pelo conteúdo que o texto/símbolo novo SUMIU do chunk. O build é do `main` no GitHub: commit local não volta nada.
3. **SQL:** todo `.sql` novo traz no cabeçalho o `ROLLBACK` exato. Função alterada: backup do corpo vivo em `docs/db-backups/<função>.<data>-antes.sql` ANTES de aplicar (`pg_get_functiondef` pela Management API; reaplicar o arquivo = voltar). Aplicar sempre por `node supabase/cs-cockpit/_aplica-lf.mjs` e conferir em consulta separada (`md5(prosrc)`, sem `\r`).
4. **n8n:** backup JSON em `automation/backups/` antes de qualquer PUT (skill `workflow-deploy`); voltar = PUT do backup (só `name/nodes/connections/settings`) e conferir `active` (PUT pode desativar).

## Stack & Deploy
> 📄 Verificação detalhada (qual chunk grepar, hash local × VPS, smoke Playwright, casos reais): [docs/claude/deploy-verificacao.md](docs/claude/deploy-verificacao.md). Movido do arquivo em 11/09/2026.
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud + react-query 5. Stack Portainer 39 | service `2zb27nndn5sg8zweyie6wscpc` | GitHub `nelpno/franchiseflow`.
- Deploy: `git push` → `node .tmp/deploy.mjs` (force update) → **verificar por CONTEÚDO** no live (~75 s de 502). Status 200 e hash do bundle não bastam.
- Achar o chunk: página lazy = `<Page>-*.js`; componente compartilhado ganha chunk próprio (`TabResultado-*.js`, `FranchiseForm-*.js`); entity layer, libs compartilhadas, telas de auth e `SaleForm` = entrada `index-*.js`. Conferir o TAMANHO do que baixou (3 dígitos de bytes = index.html). Troca de texto: nova presente E antiga ausente; constante: grepar a constante-fonte, não o valor derivado.
- **Build verde ≠ app funciona:** símbolo indefinido/não importado compila e dá tela BRANCA — `npm run lint:undef` antes de deployar.
- `.tmp/` é gitignored e tem segredo (`deploy.mjs` com a API key do Portainer) — nunca `git add -A`.
- jspdf-autotable v5: `autoTable(doc, opts)` por import dinâmico (o `doc.autoTable()` antigo só explode em runtime).
- Build no VPS com `NODE_OPTIONS=--max-old-space-size=4096`; prod dropa `console.log`/`debugger`.

## Mapa do código (`src/`)
- `pages/` — 1 arquivo por rota (`createPageUrl("X")`→`/X`): Dashboard, Vendas, Gestao, Financeiro, Franchises, Marketing, MyContacts, Onboarding, FranchiseSettings, CustomerSuccess…
- `entities/all.js` — **camada de dados** (entity adapter; SEMPRE importar daqui, nunca `supabase.from()` direto) · `entities/columns.js` — listas de colunas travadas (`SALE_PNL_COLUMNS` etc)
- `lib/` — regras puras: `financialCalcs` (DRE/`getSaleNetValue`), `formatters`, `dateOnly`, `stockSuggestion`, `salesExport`, `franchiseUtils` (`PAYMENT_METHODS`), `saveFiscalData`, `customerActions` (textos e regras de "Quem chamar hoje"), `safeErrorMessage`/`csvSanitize`/`safeHref` (segurança)
- `components/minha-loja/` — telas do franqueado (TabResultado, TabLancar, TabEstoque, TabReposicao, SaleForm, PurchaseOrderForm, SaleReceipt, ExpenseForm)
- `components/dashboard/` — FranchiseeDashboard + cards (FinancialObligationsCard, BotSummaryCard, FranchiseRanking) · `financeiro/` — AsaasSetupPanel, MarketingPaymentsAdmin · `clientes/` — "Quem chamar hoje" (DailyActionsList, ActionCards, CustomerBadges, ContactFilterChips) · `customer-success/` — Mural CS (CsBoard/CsCard/FranchiseDrawer/tierConfig) · `onboarding/` · `marketing/` · `vendedor/` — wizard "Meu Vendedor" · `ui/` — shadcn
- `App.jsx` (rotas + gates `ADMIN_ONLY_PAGES`/`CsRoute`) · `Layout.jsx` (nav + `FranchiseSelector`) · `lib/AuthContext.jsx` (auth, `selectedFranchise`)
- `supabase/` — migrations `.sql` versionadas + `functions/asaas-billing/` (edge) · `docs/claude/` — shards do CLAUDE.md

## Gotchas Críticos

- 🔴 **Endereço fiscal e ponto de retirada usam as MESMAS colunas** (medido 26/09/2026): `FranchiseForm` (Celso) e "Meu Vendedor" gravam `street_address`/`cep`/`city`/`neighborhood` em `franchise_configurations`; o número vai para `franchises.address_number`. O Asaas junta a rua do ponto com o número fiscal (Araras: "…126" + "86 B"). Não há razão social, IE nem IBGE. Plano da fase fiscal: memória `project_locator_supabase_2026-09-26`.

### Regras que quebram produção (1 linha cada; o porquê e os casos estão no shard)
- **Dados:** importar de `@/entities/all`, nunca `supabase.from()` (exceção: `.in()` em lote). Adapter IGNORA `filter:` (use `gte/lte`). `fetchAll` já ordena por `id`. Coluna nova em `columns` enxuto: conferir em `information_schema` e nos consumidores. → supabase-schema
- **Nomes que enganam:** `inventory_items.quantity/product_name`, `sale_items.unit_price`, `notifications.read`, `franchise_configurations.franchise_evolution_instance_id` (não `franchise_id`), `bot_conversations.started_at`, `sales.contact_phone`, `franchises.phone_number`. → supabase-schema
- **RLS/SECURITY DEFINER:** view `security_invoker=true`; definer confere usuário no corpo + `revoke ... from public, anon`; guard nunca por `current_user`; helper como `(select fn())`; GET com a chave anon tem de dar 401; tabela nova após 30/10/2026 precisa `grant`. → supabase-schema, historico-ondas
- **Rodar RPC com guard pelo MCP:** `with ctx as materialized (select set_config('request.jwt.claims', …)), h as materialized (…)` — os DOIS `materialized`, senão volta 0 linhas calado. → cs-admin
- **SQL:** `.sql` do Windows injeta `\r` (aplicar por `node supabase/cs-cockpit/_aplica-lf.mjs`); conferir UPDATE em consulta SEPARADA; `CURRENT_DATE` é UTC; `\b` no regex PG é backspace (use `\y`); `DROP TABLE` quebra plpgsql que cita a tabela. → supabase-schema, cs-admin
- **Dinheiro:** receita = `value − discount_amount + delivery_fee` via `getSaleNetValue`; taxa repassada ao cliente não é custo; "a receber" entra no Sobrou; `confirmed_at` é do servidor; `save_sale_with_items` ENUMERA colunas. → vendas-financeiro, `docs/claude/sobrou-no-mes.md`
- **Pedido à fábrica:** RPC idempotente `create_purchase_order_with_items`; preço = `preco_tabela_fabrica`; `entregue` é terminal; reposição só catálogo padrão (`created_by_franchisee !== true`); memória do envio = rascunho com `clientId`. → telas-franqueado, historico-ondas
- **Meu Vendedor/robô:** salvar só o que mudou (`configSave.js`); frete calculado só pela RPC `salvar_frete_estruturado`; forma de pagamento nova toca 3 pontos no bot. → supabase-schema, n8n-bot
- **Onboarding:** papel nunca do metadado; `approved` só pela RPC `set_onboarding_status`; item grava por `set_onboarding_item`. → telas-franqueado
- **Régua da rede:** tudo em `src/lib/networkOverview.js` (queda −20% com base R$ 3 mil, sem venda 7 dias, verba, nova < 30 dias desde 29/09). Mensagem à franqueada só por `mensagemFranqueado.js`. → cs-admin
- **Mural do CS:** colunas prontas de `get_cs_mural()`; registro só pelas RPCs `registrar_cs_conversa`/`concluir_cs_cartao`/`estacionar_cs_cartao`; cartão manual nunca é reescrito pelo reconcile. O banco ainda trata "nova" como < 60 dias. → cs-admin, `docs/claude/customer-success.md`
- **Multi-unidade:** toda tela resolve por `resolveActiveFranchise`, nunca `managed_franchise_ids[0]`. `managed_franchise_ids` guarda UUID E evo da mesma unidade.
- **Excluir franquia:** `delete_franchise_cascade` (com `p_dry_run`); `evolution_instance_id` é reutilizado pela cidade. → cs-admin, `docs/claude/excluir-franquia.md`
- **Cupom:** WhatsApp da unidade só de `franchises.whatsapp_publico`, nunca `personal_phone_for_summary`. → historico-ondas
- **Features removidas: NÃO recriar** (Acompanhamento/health score, Relatórios, BotIntelligence, SmartActions, onboarding de 9 blocos, shadcn órfãos…). Lista: historico-ondas.

### Onde está o detalhe (ler o shard ANTES de mexer no assunto)
Comentário no código citando "CLAUDE.md § X" (ex.: Primeiros passos, Features Removidas): a seção está num destes arquivos, com o mesmo título — `grep -rn "X" docs/claude`.
| Assunto | Arquivo em `docs/claude/` |
|---|---|
| Schema, RLS, colunas, triggers, Management API, SQL pelo MCP | `supabase-schema.md`, `supabase-detalhes.md` |
| n8n, robô V4/V5, EnviaPedidoFechado, Meta CAPI | `n8n-bot.md` |
| Vendas, DRE, KPI, conversão, ficha de separação, relatório do mês, ASAAS resumo | `vendas-financeiro.md`, `sobrou-no-mes.md`, `modulo-financeiro-v2.md`, `asaas.md`, `impressao-termica.md` |
| Primeiros passos, Quem chamar hoje, Estoque/Reposição/pedido, manual PDF, Marketing, UX, convites | `telas-franqueado.md`, `frontend-ux.md` |
| Mural do CS, Unidades, Ficha, redesenho admin, excluir franquia | `cs-admin.md`, `customer-success.md`, `padrao-visual-admin.md`, `excluir-franquia.md` |
| Auditoria set/2026, ondas 4 e 5, features removidas | `historico-ondas.md`, `auditoria-2026-09.md` |
| Deploy: qual chunk grepar, smoke, casos | `deploy-verificacao.md` |

### Prévias, fotos e o manual (29/09/2026)
- Prévia sem login = `.tmp/harness-*` (uma por vez, cache do Vite compartilhado; `--force` e apagar `.tmp/harness-*/.vite-cache` antes do `npm run lint`). Mock novo do Layout precisa de `getFeatureFlags` (senão tela branca no harness).
- Fotos da Ajuda: `node .tmp/harness-s242/s*.mjs` **da raiz do dashboard** (os roteiros gravam em `.tmp/prints-s242` relativo). Manual: `.tmp/onda7b-manual/gera.mjs` → copiar para `public/manual-maxi.pdf`; estrutura e regra `G("slug")` em telas-franqueado.
- Conferência no ar: lib compartilhada pode virar chunk PRÓPRIO (ex.: `networkOverview-*.js`) — baixar TODOS os chunks citados, não só o `index-*.js`, antes de concluir "não subiu".
- Drive da franquia (29/09): 4 pastas (1. Configurações · 2. Universidade Maxi Massas · 3. Marketing · 4. Manuais) + Arquivo. Onde cada link mora: comentário de `src/components/onboarding/materiais.js`.

### Auth (AuthContext.jsx)
- Race conditions: `lastAuthUserRef` + `lastSignedInTimeRef` + safety timeouts (8s init, 10s login). NÃO há mutex
- `onAuthStateChange('SIGNED_IN')`: setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s). NUNCA `getSession()` dentro do handler
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso
- Detecção convite: `user_metadata.password_set` (PKCE não passa `type=invite`)
- NUNCA `window.location.href` após signIn — `onAuthStateChange` cuida do redirect
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (8s timeout)
- **Franqueado com 2+ unidades: toda tela resolve a unidade por `resolveActiveFranchise(franchises, user, selectedFranchise)`** ([franchiseUtils.js](src/lib/franchiseUtils.js)) — com 2+ ele devolve `null` em vez de chutar a primeira, e a tela mostra `<FranchisePicker>`. NUNCA `managed_franchise_ids[0]` / `configs[0]` (é ordem do banco, não escolha do usuário). Listagem SEM filtro de franquia vaza igual: a RLS libera as DUAS unidades (caso do MyContacts). Testes: `node src/lib/franchiseUtils.test.mjs`. Bug Araras×Limeira 05/08/2026 (deploy `b95599b`)
- **`resetPasswordForEmail` devolve SUCESSO para e-mail que NÃO existe** (anti-enumeração do Supabase) → NUNCA exibir "email enviado"; mostrar o endereço digitado ("Se X estiver cadastrado..."). Custou 12min de franqueado achando que o e-mail sumiu (fix `6369d06`, 12/08/2026)
- **Diagnosticar "não chegou o e-mail" do Auth**: a prova está em `query_logs` source `auth_logs` — `POST /recover` em **~1ms SEM bloco `auth_event`** = e-mail não casa com nenhum usuário, **nada foi enviado**; **~3,5s COM `user_recovery_requested`** = saiu de verdade. ⚠️ `auth.audit_log_entries` está SEMPRE VAZIA (0 linhas) e `recovery_sent_at` é **zerado quando o link é usado** (mede recovery pendente, não envio) — os dois mentem, erram para o lado de "nunca enviou". O `referer` do log do GoTrue é o `redirect_to`, não a tela de origem. SMTP do Auth = `smtp.gmail.com`/`fabrica@maximassas.com.br`, 30/h (estouro dá 429, nunca 200). Detalhe: memória `project_diagnostico_email_auth_supabase`

### Frontend Patterns
> 📄 Detalhe e casos (Clarity e dead clicks, Dialog/Sheet shadcn, overflow mobile, texto livre que vai pro prompt do bot, lazy-load, filtros de mês): [docs/claude/frontend-ux.md](docs/claude/frontend-ux.md). Movido do arquivo em 11/09/2026.
- `mountedRef` + cleanup; `setIsLoading(false)` antes de early return. Loading = `<Skeleton>` (nunca spinner, nunca `fixed inset-0`).
- Lista do Supabase: sort explícito no front. Tabela que cresce: `fetchAll: true`, com janela (`gte`) quando houver polling; `limit N` vira teto calado.
- Datas: NUNCA `toISOString().split("T")[0]` (use `format(d, "yyyy-MM-dd")`); coluna DATE → `formatDateOnly`/`parseDateOnly` (`lib/dateOnly.js`); filtro TIMESTAMPTZ com `T00:00:00.000Z`.
- `useCallback` circular = tela branca; `useVisibilityPolling` no lugar de `setInterval`.
- Toast = `sonner`, nunca `alert()`/`window.confirm()`; `return` de validação sempre com `toast.error`.
- Rotas por `createPageUrl("X")`; deep-link admin `/Financeiro?tab=porunidade&franchise=<evolution_instance_id>`.
- `maxLength` em campo já populado: medir `MAX(LENGTH(col))` antes (+25–30%). Texto livre que vai pro prompt do bot: NULL > "Não temos".
- `pix_holder_name` NÃO mexer sem o franqueado (tem de bater com o titular da conta PIX).
- Dialog shadcn: NÃO remover `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)]`; alargar com `sm:max-w-*` (com prefixo).

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
VITE_CAPI_MANUAL_TOKEN (uuid v4, par com CAPI_MANUAL_WEBHOOK_TOKEN no n8n stack 4)
N8N_API_KEY / N8N_VENDEDOR_V4_WORKFLOW_ID=aRBzPABwrjhWCPvq
N8N_WHATSAPP_WEBHOOK=a9c45ef7-36f7-4a64-ad9e-edadb69a31af
ZUCKZAPGO_URL / ZUCKZAPGO_ADMIN_TOKEN
```

## Convenções de UI e build (movido do CLAUDE.md do projeto-pai em 25/09/2026)
<!-- movido do CLAUDE.md pai 25/09/2026 -->
- Componentes: shadcn/ui + Material Symbols Outlined. Ícone = `<MaterialIcon icon="name" />`, NUNCA Lucide direto.
- Fontes: Inter (body) + Plus Jakarta Sans (headings). Paleta: `#b91c1c` (primary), `#d4af37` (gold).
- Edge Functions: SEMPRE validar JWT (`supabase.auth.getUser(token)`) + role check. Webhook externo: HMAC/token secreto (fail-closed).
- **`npm run build` suprime o output do Vite** (18/05): mostra só `> vite build` e termina. Confiar em `EXIT=0` + timestamp de `dist/index.html` (build real ~10-20 s).
- **TS LSP em `.jsx`** emite `implicit any` (TS7006) em parâmetro JS — pré-existente do strict do tsserver, NÃO causado pelo Edit. Ignorar se já existia antes da mudança.
