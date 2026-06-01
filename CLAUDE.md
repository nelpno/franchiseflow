<!-- Last Updated: 2026-05-29 -->
# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Este arquivo contém APENAS especificidades do dashboard.

## Stack & Deploy
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud + @tanstack/react-query 5
- Stack Portainer ID 39 | Service ID `2zb27nndn5sg8zweyie6wscpc`
- GitHub: `nelpno/franchiseflow.git`
- Deploy: `git push` → force update serviço Docker (incrementar ForceUpdate no TaskTemplate). Stack update sozinho NÃO recria container
- **Verificação real de deploy live** (status 200 NÃO basta — container pode estar servindo bundle antigo durante rolling): comparar hash do bundle JS em `dist/index.html` local (`<script src="/assets/index-XXX.js">`) com `fetch('https://app.maximassas.tech/').text()`. Hashes iguais = deploy live. Script reusável em [.tmp/verify-deploy.mjs](.tmp/verify-deploy.mjs) (também valida `Spec.TaskTemplate.ForceUpdate` e tasks running no Portainer). Validado 28/05/2026 após deploy `2e5769b`. **Caveat (01/06/2026):** hash local×prod PODE divergir com código idêntico (build Windows ≠ build VPS — deploy `accc3a9` deu local `u_12l6td` vs prod `NJvDXGmC`). Se o hash de prod MUDOU vs o anterior mas não bate com o local, o deploy OCORREU — confirmar por **CONTEÚDO**: grep de strings únicas das mudanças nos chunks de prod ([.tmp/verify-content.mjs](.tmp/verify-content.mjs)). Lazy pages ficam em chunks próprios (`Franchises-*.js`, `Financeiro-*.js`), não no `index-*.js`
- 502 por ~2min durante rebuild é normal. ctx_execute com JS para HTTP Portainer (NÃO shell+jq)
- `npm run build` pode completar sem output visível (Windows). Verificar timestamp de `dist/index.html`
- **Build verde ≠ app funciona** (incidente 29/05/2026): referência a variável indefinida em object literal — ex: deixar `"X": X` no objeto `PAGES` depois de remover `const X = lazy(...)` — compila/bundle OK mas dá `ReferenceError: X is not defined` em runtime → **tela BRANCA**. Rollup trata como global ref, não erro de build. SÓ smoke test runtime pega. Ao remover uma página de `pages.config.js`: deletar AMBOS o `const X = lazy(...)` E a entrada `"X": X` do `PAGES`
- **Smoke test runtime (Playwright)**: `npm run dev` no Windows/OneDrive NÃO imprime o banner do Vite (stdout bufferizado em não-TTY) mas o server sobe na `:5173` — navegar Playwright direto, não esperar a URL no log. Login autofilla o admin. Admin NÃO acessa telas `franchiseeOnly` (Vendas/Gestão redirecionam pra `/Dashboard`) — para exercitar `TabResultado`/`ExportButtons`, ir em Financeiro → aba "Por Unidade" → selecionar franquia. Export PDF se confirma pelo evento de download do Playwright
- **Export PDF — jspdf-autotable v5**: `doc.autoTable()` foi REMOVIDO na v5; usar `const { default: autoTable } = await import("jspdf-autotable"); autoTable(doc, {...})` (padrão correto em `pickingSheetPdf.js` e `ExportButtons.jsx`). O uso antigo NÃO quebra o build — só explode em runtime
- **`.tmp/` NÃO é gitignored**: no commit usar `git add -u` + paths explícitos de `docs/`; nunca `git add -A` (commitaria scratch de `.tmp/` como deploy.mjs/worklist). Deploy validado 29/05: commit → `git push origin main` → `node .tmp/deploy.mjs` → poll do hash do bundle no live (~70s de 502 → 200 com hash == local)
- Vite build VPS: `NODE_OPTIONS=--max-old-space-size=4096`
- Vite prod: `console.log`/`debugger` stripados (`esbuild.drop`). Manual chunks: recharts, export (jspdf/xlsx), vendor, ui, supabase, dates. CSS via lightningcss
- Deps notáveis não-óbvias: `@hello-pangea/dnd` (drag-drop), `html2canvas` + `jspdf` (export PDF), `xlsx` (export Excel)

## Gotchas Críticos

### Auth (AuthContext.jsx)
- Race conditions: `lastAuthUserRef` + `lastSignedInTimeRef` + safety timeouts (8s init, 10s login). NÃO há mutex
- `onAuthStateChange('SIGNED_IN')`: setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s). NUNCA `getSession()` dentro do handler
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso
- Detecção convite: `user_metadata.password_set` (PKCE não passa `type=invite`)
- NUNCA `window.location.href` após signIn — `onAuthStateChange` cuida do redirect
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (8s timeout)

### Supabase & Schema
- API: importar de `@/entities/all` — NUNCA `supabase.from()` direto. Timeouts: leitura 15s, escrita 30s. Exceção: batch queries com `.in()` (entity adapter não suporta)
- `Entity.delete()` usa `.select('id')` — detecta RLS silencioso (0 rows = throw "Sem permissão"). Nunca remover o `.select('id')` do delete
- `bot_conversations` usa `started_at` (NÃO `created_at`). Filtros SQL por `created_at` retornam erro 42703 silencioso
- `FranchiseConfiguration` (createEntity em `entities/all.js`) usa `select('*')` por default — coluna nova em `franchise_configurations` aparece automaticamente sem mexer no entity. Bug histórico 29/04 era cenário com `select` enxuto explícito (não é o caso atual)
- `getStandardProductCatalog()` RPC (SECURITY DEFINER): retorna 28 produtos padrão cross-franchise para autocomplete no TabEstoque. Catálogo: grafia "Mussarela" (NÃO "Muçarela"), formato "Rondelli X - 700g Rolo"
- `marketing_files`: NÃO usa entity adapter (trava) — `fetch()` direto à REST API com `AbortSignal.timeout(15s)`
- Campos numéricos podem vir string — SEMPRE `parseFloat(s.value) || 0`, NUNCA `s.value || 0`
- `buildConfigMap()` retorna objetos — acessar `.franchise_name`, nunca renderizar direto
- Antes de `Entity.update()`, remover campos read-only (`id`, `created_at`, `updated_at`, `franchise`, `whatsapp_status`)
- Storage buckets: `marketing-assets` (público), `marketing-comprovantes` (público, 5MB, JPG/PNG/PDF), `catalog-images/produtos/` (público)
- **Pre-flight OBRIGATÓRIO antes de `columns` enxuto**: rodar `SELECT column_name FROM information_schema.columns WHERE table_name='X'` e validar TODA coluna listada. Hotfix 9e24482 (29/04/2026) teve 4 colunas inventadas (`contact_phone`, `customer_name`, `franchise_notes.content`, `inventory_items.hidden_at`) que retornaram 400 e quebraram telas (MyContacts/Acompanhamento/Gestao)
- **Validação de columns enxuto vai além de `information_schema.columns`**: listar consumidores transitivos (props passadas pra children que agrupam/agregam). Defesa runtime via `console.warn` dev-only no helper centralizado é o que de fato previne — ex: `weeklyTurnoverMap` em [src/lib/stockSuggestion.js](src/lib/stockSuggestion.js) detecta `inventory_item_id` faltando, preveniria a regressão `7955000` de 29/04
- **Entity adapter `Sale.list/Contact.list/etc` IGNORA chave `filter:`** — só honra `{columns, signal, fetchAll, gte, lte}`. String PostgREST (ex: `filter: "sale_date=gte.X"`) é silenciosamente descartada. Bug Reports.jsx corrigido em 5ad5166 (29/04). Padrão correto: `gte: { sale_date: cutoff }, lte: { sale_date: end }`
- **`fetchAll: true` SEM tie-breaker em coluna não-única DUPLICA/OMITE linhas silenciosamente** (fix 5333224, 20/05/2026): paginação `.range(0..999), .range(1000..1999)...` ordenando só por coluna não-única (ex: `sale_date` que é DATE) → Postgres não garante ordem entre tuplas com mesmo valor → algumas vendas aparecem em 2 páginas (duplicadas) e outras nunca aparecem (omitidas). Bug NÃO-DETERMINÍSTICO — refresh diferente, conjunto diferente capado. Em 18m com 5254 vendas: 63 duplicadas + 63 omitidas. Vila Maria perdia 25 vendas/R$2.785 no Financeiro enquanto Coach Diário batia. 18 franquias afetadas em graus variados. **Fix aplicado em [src/entities/all.js](src/entities/all.js)**: `query.order('id', { ascending: true })` DENTRO do bloco `if(fetchAll)` em `list()` E `filter()` como tie-breaker secundário (`id` é PK UUID — custo zero, indexada). Beneficia TODO `fetchAll: true` (Sale, Expense, SaleItem, InventoryItem, Contact, etc) sem precisar tocar nos call-sites. **Regra reusável**: nova chamada `fetchAll: true` em coluna não-única (date, status, franchise_id) já fica safe pelo fix global; mas se um dia migrar paginação pra cursor-based ou trocar tie-breaker, manter coluna ÚNICA garantida no ORDER BY. Padrão de detecção: simular reconstrução paginada em SQL (UNION ALL de N páginas → COUNT vs COUNT(DISTINCT id)) — qualquer delta = bug latente. Validação pós-fix: bundle minificado deve conter `.order("id",{ascending:!0})`
- **Pre-flight antes de adicionar trigger em tabela existente**: `SELECT trigger_name, event_manipulation, action_timing FROM information_schema.triggers WHERE event_object_table='X'` — `sales` por exemplo já tem `audit_on_sale_delete` (BEFORE DELETE), `on_sale_created` (AFTER INSERT, update_contact_on_sale), `revert_contact_on_sale_delete` (BEFORE DELETE), `set_updated_at` (BEFORE UPDATE). Confirma zero overlap antes do `CREATE TRIGGER` novo
- **`save_sale_with_items(p_sale_id, p_sale_data, p_items)` RPC** ([SaleForm.jsx:803](src/components/minha-loja/SaleForm.jsx#L803)): venda manual NÃO usa `Sale.create` — RPC atômica que faz `INSERT INTO sales` + `INSERT INTO sale_items` em transação única. RETURNS apenas `UUID` (id). Triggers BEFORE/AFTER em `sales` disparam normalmente. Para retornar campo populado por trigger ao client sem reload, precisa mudar assinatura pra `RETURNS TABLE(id UUID, <campo> ...)`. Cupom (`SaleReceipt`) lê de `shareData.sale` montado pós-reload — então adicionar coluna nova em `sales` só requer trigger + incluir em `SALES_COLUMNS` ([Vendas.jsx:13](src/pages/Vendas.jsx#L13))
- **Sequência humano-amigável por partição** (padrão `sale_number`, [supabase/sales-sale-number-migration.sql](supabase/sales-sale-number-migration.sql)): para gerar `#1`, `#2`, ... por franquia (ou outra chave) sem race condition: trigger BEFORE INSERT com `pg_advisory_xact_lock(hashtext('seq_name:' || NEW.partition_key))` + `SELECT COALESCE(MAX(n),0)+1 WHERE partition_key IS NOT DISTINCT FROM NEW.partition_key`. Lock libera no commit, serializa só inserts da mesma chave (~ms). UNIQUE INDEX `(partition_key, sequence_col)` valida. Backfill via `ROW_NUMBER() OVER (PARTITION BY key ORDER BY created_at, id)` dentro do mesmo `BEGIN; LOCK TABLE ... EXCLUSIVE; ... COMMIT` para evitar gap entre backfill e UNIQUE INDEX

**Nomes de colunas que diferem do esperado:**
- `inventory_items.quantity` (NÃO current_stock), `.product_name` (NÃO name)
- `sale_items.unit_price` (NÃO sale_price — `sale_price` existe em inventory_items)
- `notifications.read` (NÃO is_read)
- `franchise_configurations.franchise_name` (NÃO store_name)
- `franchise_configurations` chave de join = `franchise_evolution_instance_id` (NÃO `franchise_id` — coluna não existe). JOIN com `franchises.evolution_instance_id` / `expenses.franchise_id`. Tem também `whatsapp_instance_id`
- `personal_phone_for_summary`: 11 dígitos puros (view adiciona 55). Normalizar `.replace(/\D/g, '')`
- `purchase_order_items` FK: `order_id` (NÃO purchase_order_id)
- `contacts.telefone` nullable — unique parcial. Enviar `null` (NÃO string vazia)
- `operating_hours` JSONB NÃO existe — wizard usa `opening_hours` TEXT + `working_days` TEXT
- `payment_delivery`/`payment_pickup` são TEXT[], NÃO JSONB
- `unit_address` é computado no save (NÃO editar direto)
- `onboarding_checklists` NÃO tem total_items, started_at, user_id. TEM `approved_at` (timestamptz) e `approved_by` (text)
- `franchises.billing_email` (desde 17/04/2026): fonte primária de email para ASAAS + NFe. Fallback legacy: `franchise_invites.email` (edge function tenta se `billing_email IS NULL`). CHECK `billing_email_format` valida regex. NÃO há `owner_email`

**RLS específico:**
- `managed_franchise_ids` contém AMBOS UUID e evolution_instance_id (28 policies dependem)
- `franchises_update` policy (fix 17/04/2026): `is_admin_or_manager() OR evolution_instance_id = ANY (managed_franchise_ids())` — franqueado edita dados fiscais da própria franquia via gate onboarding. Antes era só admin/manager
- profiles SELECT: `is_admin_or_manager() OR id = (select auth.uid())` — NUNCA `is_admin()` sozinha (recursão infinita)
- Tabelas novas: DELETE policy com `is_admin()` obrigatória (sem ela, delete retorna sucesso mas 0 rows)
- `sale_items` RLS: subquery `sale_id IN (SELECT id FROM sales WHERE franchise_id = ANY(managed_franchise_ids()))`
- `activity_log` NÃO existe no banco (referenciada em schema.sql mas nunca criada)
- Policies `notifications` e `audit_logs`: criadas via Dashboard (NÃO estão em SQL files). Consultar `pg_policies` antes de alterar
- `get_unprocessed_conversations(integer)`: RPC existe no banco mas NÃO nos SQL files
- `get_franchise_ranking(date, franchise_id)` RPC: soma TEMPO REAL de `sales` (NÃO `daily_summaries`). `total_franchises` = só franquias com venda na data (não total ativas). Usada apenas por FranchiseeDashboard — admin tem ranking client-side próprio em `FranchiseRanking.jsx`. Fix 16/04: antes lia `daily_summaries` que é populado só pelo cron 02h
- `aggregate_daily_data()` cron: roda `0 5 * * *` UTC (02h BRT) com default `target_date = ontem`. **NUNCA** popula `daily_summaries.date = hoje`. Qualquer query/RPC que dependa de `daily_summaries` para o dia atual retorna vazio até 02h BRT do dia seguinte

**Normalização de telefone (fix 16/04/2026):**
- `contacts.telefone`, `bot_conversations.contact_phone`, `conversation_messages.contact_phone`: SEMPRE canônicos (só dígitos, sem DDI 55). Triggers `BEFORE INSERT OR UPDATE OF <coluna>` garantem. Invariante: `telefone = public.normalize_phone_br(telefone)` sempre
- Helper banco: `public.normalize_phone_br(text)` (IMMUTABLE, PARALLEL SAFE) — reusado por RPCs e triggers. Remove não-dígitos e tira DDI 55 quando `length >= 12`
- RPCs normalizadas: `upsert_bot_contact`, `get_customer_intelligence`, `get_contact_by_phone`, `log_conversation_message`, `get_abandoned_for_followup`
- Frontend canônico: [normalizePhone()](src/lib/whatsappUtils.js) — usar antes de qualquer `Contact.create`/`update`/`filter`/`search` que envolva telefone
- Auditoria: `supabase/queries/audit-contact-phone-duplicates.sql` — esperado 0 linhas
- Fix 16/04/2026: desduplicados 37 pares (164 com DDI 55 → 0), removido `idx_contacts_franchise_telefone` (redundante com UNIQUE partial) e coluna morta `contacts.tags`
- `MyContacts.jsx:168`: usa `fetchAll: true` em vez de limit hardcoded (clientes antigos ficavam fora da lista quando franquia passava de 200 contatos — fix 16/04)
- Merge de duplicados em tabela com UNIQUE: DELETE do row DROP **antes** do UPDATE do KEEP (senão UPDATE bate na UNIQUE com o DROP ainda existente). Ex: `supabase/scripts/dedup-contacts-by-phone.mjs`
- Scripts de manutenção em `supabase/scripts/*.mjs`: padrão `--dry-run` default (relatório + backup JSON em `backups/`) / `--apply` / flag extra para casos que exigem revisão humana. TX por item, não TX gigante — resiliência em falha parcial

**Database Linter Compliance (fix 15/04/2026):**
- Funções SECURITY DEFINER: SEMPRE incluir `SET search_path = 'public'`
- RLS policies com `auth.uid()`: SEMPRE usar `(select auth.uid())` (initplan perf)
- NUNCA criar policy `FOR ALL` + policies específicas na mesma tabela (overlap = multiple_permissive)
- NUNCA criar policy `USING(true)` para role padrão — service_role já bypassa RLS
- Storage buckets públicos: leitura via URL pública funciona sem SELECT policy, MAS `upsert: true` da Storage API REQUER SELECT em `storage.objects` para verificar existência (sem ela: 403 row-level security em substituição). Manter SELECT policy em buckets onde franqueado/admin faz upload (catalog-images, marketing-comprovantes). Fix 16/04/2026: linter sugeriu dropar; reaplicado
- Storage buckets onde admin precisa **apagar** arquivo (não só ler/escrever): policy `FOR DELETE USING (bucket_id='X' AND (SELECT public.is_admin_or_manager()))`. Sem ela, `supabase.storage.from(b).remove([])` falha silenciosamente — arquivo órfão. Aplicado em `marketing-comprovantes` (30/04/2026) quando admin ganhou cancelamento de pagamento
- Debug 403 em upload Supabase Storage: checar `pg_policies WHERE schemaname='storage' AND tablename='objects'` ANTES de investigar código React/auth (root cause é quase sempre policy faltando ou mudada)
- FKs novas: SEMPRE criar índice correspondente (`CREATE INDEX IF NOT EXISTS`)
- Extensões: usar schema `extensions` (NÃO `public`)
- **Trigger SQL que reage a estado vindo de edge function**: SEMPRE checar o estado **normalizado** que a edge persiste (após `mapXyzStatus()`), nunca o estado cru externo. Pre-flight obrigatório: ler a função de mapeamento da edge antes de escrever WHERE/IF do trigger. Bug em `tr_subscription_payment_expense` (01/05/2026): trigger checava status ASAAS crus (`RECEIVED/CONFIRMED/RECEIVED_IN_CASH`) enquanto edge `mapPaymentStatus()` normaliza tudo para `'PAID'` → trigger nunca disparou em produção (11 mensalidades sumiram do DRE até o fix)

**Security helpers (usar em código novo):**
- Toast errors: NUNCA `error.message` ou `error.details` direto — usar `safeErrorMessage(error, "fallback")` de `@/lib/safeErrorMessage`
- CSV export: SEMPRE `sanitizeCSVCell()` em campos de texto — previne formula injection no Excel (`@/lib/csvSanitize`)
- href dinâmico: `safeHref(url)` rejeita `javascript:` e protocolos perigosos (`@/lib/safeHref`)

### Frontend Patterns
- `mountedRef` + cleanup obrigatório. `setIsLoading(false)` antes de early return
- `ExportButtons` (shared/): retorna `null` se `data` vazio (sem disable manual). NÃO sanitiza — chamador deve pré-sanitizar com `sanitizeCSVCell`. Sem prop `summaryRow` — para linha de totais, append no array antes de passar
- `TabResultado` aceita prop `contacts` (default `[]`) para resolver nome do cliente no export. Gestao.jsx carrega via `Contact.filter({ franchise_id })` no mesmo padrão de Vendas.jsx
- Listas Supabase: SEMPRE sort explícito no frontend (ordem muda após updates)
- Inline edit mobile: `onClick={e => e.stopPropagation()}` + `inputMode="numeric"`. `active:` (NÃO `hover:`)
- Queries: tabelas que crescem (Sale, Expense, DailySummary, ConversationMessage) DEVEM usar `fetchAll: true` (pagina internamente de 1000 em 1000). Tabelas pequenas/fixas podem usar `limit` numérico
- AdminDashboard: 10 queries paralelas `Promise.allSettled` — maioria com `fetchAll: true`. Auto-retry na query de franquias
- AdminDashboard layout order: Stats → Mini-cards (Bot+Financeiro) → Ranking → Gráfico → Alertas (colapsado) → Health Score (colapsado). `CollapsibleSection` local usa Radix Collapsible
- BotSummaryCard: SEMPRE filtrar `startOfMonth` (mês atual). Após refactor d1828d3, consome `botSummary` aggregates (per-franchise per-day) do RPC `get_bot_conversation_summary` em vez do array bruto de conversas
- **`fetchAll: true` em tabela > 5k rows = pagination serial × 1000 × ~700ms**. `bot_conversations` (28k) = ~20s. Solução real: RPC server-side aggregate (commit d1828d3 — `get_bot_conversation_summary` cortou cold-load 22.7s → 8.5s)
- **TIMESTAMPTZ em filtro `gte`/`lte`** precisa formato `${cutoff}T00:00:00.000Z` (boundary issue ~3h offset BRT). Colunas DATE aceitam só `YYYY-MM-DD`
- **`limit N` em queries 1-row-por-franquia** vira teto silencioso quando rede crescer > N. Trocar por `fetchAll: true` para tabelas pequenas (Onboarding, FranchiseConfiguration etc)
- **Padrão lazy-load Wave 2** (commit 7983f77): `CollapsibleSection({onFirstExpand})` idempotente via `useRef(defaultOpen)` + `lazyAbortRef` (separado do `abortControllerRef`) + `lazyFetchingRef` síncrono + polling refresh `loadCollapsedDataRef.current?.({force: true})` se `hasFetchedCollapsedRef.current`. Implementado em `AdminDashboard.jsx`
- **Throttle 60s em `useVisibilityPolling`** (commit 5ad5166): previne burst ao voltar à aba. `lastRunRef = useRef(Date.now())` evita re-fire imediato após cold-load
- **`fetchAll: true` em tela com `useVisibilityPolling`**: cada refresh refaz a query inteira. Janela tight obrigatória (`gte: { col: subMonths(today, N) }` com N=3-6). Sem isso, polling 5min × 12 meses × franquia top → banda explode. Padrão Vendas.jsx (01/05): 6 meses + fetchAll, polling 5min compartilha mesma query
- Loading: `<Skeleton>` shadcn (NÃO spinner). PageFallback relativo (NUNCA `fixed inset-0`)
- **Wizard multi-step auto-save**: `handleSubmit` retorna `true`/`false`; `nextStep` faz `if (isDirty) { const ok = await handleSubmit(); if (!ok) return; }` antes de advance. Botão "Próximo" ganha `disabled={isSubmitting}` + spinner. Aplicado em [FranchiseSettings.jsx:439](src/pages/FranchiseSettings.jsx#L439) (commit `1952391` 28/05/2026) — franqueados deixavam de salvar achando que "Próximo" já salvava. Toast por etapa confirma. Se save falha (rede/RLS), NÃO avança
- **`maxLength` em campos já populados em produção é PERIGOSO**: HTML `maxLength` bloqueia digitação sem erro visual — usuário vê o texto existente mas teclado "não funciona" pra editar. Aconteceu em 1952391 (`promotions_combo maxLength=400`) — Limeira tinha 544 chars salvos e não conseguia editar. **SEMPRE** rodar SQL `MAX(LENGTH(col))` no banco ANTES de definir limite, e dar 25-30% de folga sobre o p100 atual. Validado em 28/05/2026 com `franchise_configurations.promotions_combo` (max 1061 → limite 1500). Fix: commit `609543b`
- **Campos texto livre destinados ao prompt do bot são MAGNETO de poluição** (auditoria 28/05/2026 em `promotions_combo` × 30 franquias): franqueados colocam cumprimento ("Olá, aqui é a Melissa"), restrição ("não trabalhamos com molhos"), cobertura ("entregamos em Nova Odessa, Americana..."), endereço completo, aviso de folga, "sendo elaborado", "não temos no momento". **`NULL` é melhor que "Não temos"** — texto vazio retórico gasta tokens pra dizer NADA pro LLM. Defesa em 3 camadas: hint explícito ("Use SÓ pra X ATIVOS. DEIXE VAZIO se não houver"), warning visual em palavras-chave de poluição ("não temos", "sendo elaborado", "em breve"), placeholder com exemplo real (não slogan). Aplicado em [FranchiseSettings.jsx:1004](src/pages/FranchiseSettings.jsx#L1004) (commit `8e025f0`)
- **Reescrita de texto para prompt LLM** (28/05/2026): cortar separadores decorativos `*****` `____`, markdown `**` excessivo, emojis duplicados em sequência, disclaimers triplos repetindo a mesma coisa. Manter info semântica intacta. Casos validados: São Miguel 1061→621 chars (-41%), Rio Claro 977→417 (-57%, cortado texto VIP que confundia bot vendedor comum), Mauá 746→563, Mogi 332→181 (cortado endereço hardcoded + instrução pra designer "número grande"). 4 reescritas economizaram ~460 tokens cumulativos
- **agent_name (nome do bot) sem "Maxi Massas" redundante**: bot já cita a franquia em outro campo. Manter só nome pessoal/curto. Padrão da rede: nome próprio feminino (Ana, Carol, Vera, Helena, Lara, Bia, Olívia) ou genérico institucional ("Maxi", "MaxiBot", "Central", "Assistente"). Caso 28/05/2026: "JU DA MAXI MASSAS VILA SOCORRO !" → "Ju", "Paulinha Maxi Massas - Cotia" → "Paulinha", "assistente virtual Maxi Massas Imirim" → "Bia". Sempre `TRIM()` no UPDATE — vários tinham trailing space invisível
- **`pix_holder_name` NÃO mexer sem confirmação do franqueado**: precisa bater EXATAMENTE com o nome registrado no banco da conta PIX. Divergência banco↔dashboard = cliente vê nome diferente no app PIX e desconfia ("não vou transferir, parece golpe"). Caso 28/05/2026: Osasco tinha "Eduardo Maxi Massas Osasco" no campo — tentação seria reduzir pra "Eduardo", mas se o titular da conta PJ no PagBank é "Maxi Massas Osasco LTDA", mudar quebraria a confiança
- NUNCA `new Date().toISOString().split("T")[0]` — usar `format(new Date(), "yyyy-MM-dd")`
- **`format(date, "MMM/yyyy", { locale: ptBR })`** retorna `"mai./2026"` (com ponto, minúsculo) — limpar com `.replace(".", "")` + capitalize primeira letra pra "Mai/2026". Helper `formatMonthLabel(offset)` em [TabLancar.jsx](src/components/minha-loja/TabLancar.jsx)
- **Postgres DATE (sem hora)**: SEMPRE usar `formatDateOnly(value)` ou `parseDateOnly(value)` de [src/lib/dateOnly.js](src/lib/dateOnly.js). `new Date("2026-04-30")` interpreta como UTC midnight → em BRT (UTC-3) volta 1 dia → mostra 29/04. Aplicado a `purchase_orders.estimated_delivery`, `sales.sale_date`, `expenses.expense_date`, `marketing_payments.reference_month`. Exceção: TIMESTAMPTZ (`ordered_at`, `delivered_at`, `created_at`) usa `new Date()` normal
- `useCallback` ordem importa (circular = tela branca). `useVisibilityPolling` substitui setInterval
- Error handling: `error.message` real (NUNCA genérico). `getErrorMessage()` detecta JWT/RLS/FK/timeout
- Rotas: `createPageUrl("PageName")` → `"/PageName"` (capitalizado)
- Navegação programática: `useNavigate()` + `useSearchParams()` de `react-router-dom`. Query params para pré-seleção (ex: `/Onboarding?franchise=evo_id`)
- Abrir detail sheet por URL: `/Franchises?id=<evolution_instance_id>&openSheet=1` → `useSearchParams` + `useEffect` em `Franchises.jsx` abre sheet da franquia match e limpa params com `setSearchParams({}, {replace:true})`. Padrão usado pela tabela de `Reports.jsx`
- Toast: sonner (importar de `"sonner"`, NÃO shadcn legado). NUNCA alert()/window.confirm()
- Clickable card pattern: `cursor-pointer hover:shadow-md active:scale-[0.98] transition-all` (QuickAccessCards.jsx)
- **Card-wide click pattern com filhos interativos**: `onClick={(e) => { if (e.target.closest('button, a')) return; openX(); }}` é mais limpo que espalhar `e.stopPropagation()` em todo botão filho. Aplicado em [MyContacts.jsx:637](src/pages/MyContacts.jsx#L637) (commit `2e5769b` 28/05/2026) após heatmap Clarity mostrar 51 dead clicks na linha do contato (modal Editar Contato funcionava, problema era a lista)
- **Dois elementos visualmente idênticos lado a lado (input editável + display calculado) = dead clicks garantidos**. Differenciar o display read-only com `bg-[#f5f3f0] rounded-md cursor-default select-none` + `title="..."`. Aplicado em [SaleForm.jsx:1093](src/components/minha-loja/SaleForm.jsx#L1093) (commit `2e5769b`) — subtotal por linha resolvia 49 dead clicks em `SPAN.text-sm[2]` (franqueado clicava no subtotal achando ser input)
- **Tap target mínimo 48px** (Apple/Google) em botões de seleção grupada (PIX/Crédito/etc): `p-3 min-h-[48px] border-2` + `font-bold` quando selecionado. Sem isso, heatmap mostra calor disperso ENTRE os botões. Aplicado em SaleForm Pagamento (commit `2e5769b`)
- Clickable text pattern: `cursor-pointer hover:underline hover:text-[#b91c1c] transition-colors`
- Cards navegáveis: usar `Link` condicional (não `onClick+navigate`) para a11y (Tab+Enter, right-click). Ex: StatsCard `href` prop
- TabEstoque inline edit: NUNCA onClick na `<TableRow>` (conflita com handleCellClick em quantity/min_stock/sale_price). Apenas `product_name` clicável
- TabEstoque card view (mobile): DEVE ter 3 botões (edit, ocultar, delete) — manter paridade com table view (desktop)
- TabEstoque adicionar produto: autocomplete mostra produtos padrão da rede (RPC `get_standard_product_catalog`). Seleção preenche campos e marca `created_by_franchisee: false`
- Dialog/Sheet Radix: dead clicks no overlay são comportamento normal (close on outside click). NÃO tentar "fixar"
- **DialogContent/AlertDialogContent (shadcn)** têm `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)] sm:max-w-lg overflow-x-hidden` aplicados em [src/components/ui/dialog.jsx](src/components/ui/dialog.jsx) + [alert-dialog.jsx](src/components/ui/alert-dialog.jsx) — **NÃO REMOVER**. Sem essas classes, `display:grid` + filho com `min-content > max-width` (button whitespace-nowrap, fonte custom mais larga) faz o grid track ignorar `max-width` e extrapolar viewport mobile (bug reproduzido em iPhone 14 Pro Max 430px, 29/04/2026)
- **Override de `max-w-*` em DialogContent shadcn**: `tailwind-merge` v3 NÃO trata `max-w-2xl` (sem prefixo) como conflito de `sm:max-w-lg` (com prefixo) — aplicam em breakpoints diferentes e o default vence em ≥sm. Para alargar dialog no desktop usar **`sm:max-w-2xl`** (com prefixo). Sintoma: dialog "parece" 672px no source mas renderiza 512px. Bug encontrado em TabLancar.jsx:922 e PurchaseOrders.jsx:1043 (fix 30/04/2026, commit 8a8d191)
- **`[&>*]:min-w-0` afeta apenas filhos DIRETOS** do DialogContent — não descendentes profundos. Colapso de input/dropdown dentro de forms aninhados (ex: ProductSearch dentro de SaleForm) vem do próprio `flex-1 min-w-0` interno do form, não do dialog. Diagnóstico para inputs colapsando: começar pelo `min-w-0` do container imediato antes de culpar o dialog
- Diagnóstico de overflow horizontal mobile (cole no DevTools console com elemento aberto): `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => ({tag:e.tagName, cls:(e.className||'').toString().slice(0,80), right:Math.round(e.getBoundingClientRect().right), width:Math.round(e.getBoundingClientRect().width), vw:window.innerWidth}))`
- Microsoft Clarity: `CLARITY_DATA_EXPORT_TOKEN` em `.env`. Máx 3 dias/req, 10 req/dia. Projeto `w6o3hwtbya`. Análise quinzenal
- **Clarity API dimension matrix** (validado 28/05/2026): `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1-3&dimension1=URL&dimension2=Device` retorna matriz URL × device pra todas as métricas (DeadClickCount, RageClickCount, QuickbackClick, EngagementTime, etc). `dimension1=Page` NÃO funciona (retorna agregado de 1 linha). Heatmap PIXEL data NÃO disponível via API — só via UI ou DevTools no browser logado
- **Decodificar seletor Clarity `TAG.classe[N]`** em 30s: cole `document.querySelectorAll('tag.classe')[N]?.outerHTML` no DevTools console da página em questão. Resolveu `SPAN.text-sm[2]` (49 dead clicks) → era o `<span>` do subtotal em SaleForm. Mais barato que abrir gravação Clarity
- **Priorizar fixes UX por VOLUME × RATE** (não só rate). Caso 28/05: quase pulei `/Vendas` (148 dead clicks PC, 25% rate) priorizando `/Gestao?tab=reposicao` (23 dead, 29% rate). Volume absoluto importa mais — Vendas ficou no top
- **Dead clicks nesta app são predominantemente DESKTOP** (validado 28/05/2026): `/Vendas` PC 148 vs Mobile 12, `/FranchiseSettings` PC 47 vs Mobile 4, `/Gestao` PC 43 vs Mobile 7. Mobile UX está saudável. NÃO auto-priorizar mobile sem dados — contra a intuição padrão
- Mensagens de UI com horário: usar "às 02h" (preposição = ponto no tempo), NUNCA "após 02h" (interpretado como "a cada 2 horas")
- `getFranchiseDisplayName(f)` SEM passar `config` (segundo arg) cai em fallback `f.city`. Para dropdown/seleção sem config carregado, usar diretamente `f.name + ' — ' + f.city + '/' + f.state_uf`
- `TabResultado.jsx:643` aceita prop `franchiseId` — fetcha sales/expenses/inventory/auditLogs da franquia. Reusável em admin (ex: /Financeiro tab "Por Unidade" passa franchiseId selecionado pra mostrar visão idêntica do franqueado, com poder de editar)

### Integração n8n / Bot
- **`min_order_value` é cutoff de entrega, NÃO trigger de upsell de retirada**: bot **recusa** entrega abaixo do valor (pede cliente aumentar pedido ou retirar). Hints em FieldHint devem descrever o comportamento REAL do bot — nada de "sugere/recomenda" se o nó n8n não tem essa lógica. Caso 25/05/2026: hint antigo "Abaixo desse valor, o bot sugere retirada no local" foi corrigido em [FranchiseSettings.jsx:938](src/pages/FranchiseSettings.jsx#L938) porque confundia franqueados (esperavam upsell ativo que não existe)
- V4 produção: `aRBzPABwrjhWCPvq` | V3 `XqWZyLl1AHlnJvdj` DESATIVADO
- EnviaPedidoFechado V2: `RnF1Jh6nDUj0IRHI`
- Bot Conversation Analyzer: `jh1ro9klxhbEvWgl` (cron 30min, Gemini 2.5 Flash `ezQN27UjYZVHyDEf`)
- Bot Coach Report: `gDTZPdrsVLhUk031` (cron dia 1/16 8h). Instância WuzAPI `admin_nelson`
- Franchise invite: `nbLDyd1KoFIeeJEF` | Staff invite: `jeGBs3eCHxc2EwfG`
- LogConversationMessage: `9XQ5Jkccus2vtkOE` (5 nós, todos continueOnFail)
- **Redis n8n**: NUNCA RPUSH+GET (WRONGTYPE). Usar GET→Append(Code)→SET com string JSON
- **Redis output**: `$json.propertyName` (NÃO `$json.value` — é undefined, fallback vira `[object Object]`)
- **DEDUP LID**: filtro `!info.Type` descarta placeholder sem Type (duplicatas WhatsApp)
- **Log Outbound**: `whatsapp_message_id` DEVE ser null para msgs `out` (unique index perde msg `in`)
- View `vw_dadosunidade`: SECURITY INVOKER. JSONB nativo (cast ::text quebra sub-campos). SQL: `supabase/fix-vw-dadosunidade-v2-scale.sql`
- **order_cutoff** (15/04/2026): campo opcional por faixa em `delivery_schedule` JSONB. Franquias com janela fixa (ex: 18-21h) configuram cutoff (ex: 17:00) — pedidos após esse horário vão pro próximo dia. UI: radio buttons no wizard passo 3. `delivery_schedule_text` inclui texto explícito. Customer Context V4: `hasCutoff` troca `tempo_entrega` de "40min" para "faixa de horário"
- `systemMessage` em `node.parameters.options.systemMessage`. Luxon: `setLocale('pt-BR')`
- Credencial Supabase: `mIVPcJBNcDCx21LR` (service_role) | OpenAI: `fIhzSXiiBXB3ad6Y`
- n8n API: `https://teste.dynamicagents.tech` + `/api/v1` (concatenar). PUT settings: filtrar campos extras
- SmartActions "reativar": checa `last_purchase_at >= 14d` AND `last_contact_at >= 7d`. Clicar "Feito" atualiza `last_contact_at` → suprime por 7 dias
- SmartActions: TODAS as regras em `smartActions.js` DEVEM ter guard `last_contact_at >= 7 dias` para "Feito" persistir entre reloads. Sem o guard, `dismissedIds` (state local) some no refresh
- **RPC `get_bot_conversation_summary(p_since timestamptz)`** (criada 29/04/2026, commit d1828d3): retorna agregados per-franchise per-day `{franchise_id, day, total, converted, abandoned, ongoing, autonomous, with_human_msgs}`. Substitui `BotConversation.list 90d fetchAll: true` (28k rows → 880 agregados, 100× mais rápido). `SECURITY DEFINER` + `is_admin_or_manager()` guard + `STABLE` + `REVOKE FROM PUBLIC` + `GRANT TO authenticated`. `FROM vw_bot_conversations` (auto-sync com filtros da view). Migration: [supabase/get-bot-conversation-summary.sql](supabase/get-bot-conversation-summary.sql). Consumers admin: BotSummaryCard, AlertsPanel, healthScore.js (FranchiseHealthScore/BotPerformanceCard/BotIntelligence foram deletados em 29/05/2026). **Out of scope (mantém query própria)**: Reports.jsx
- **RPC `get_franchise_ranking_monthly(p_year_month text, p_franchise_id text)`** (criada 06/05/2026): posição da franquia no mês entre franquias com vendas + `prev_rank_position` (mês anterior, pra delta ↑/↓). `SECURITY DEFINER` com filtro **obrigatório** por franchise_id (sem ele retorna 0 rows — não vaza dados cross-franquia). Receita = `value - discount + delivery_fee` (mesma fórmula `getSaleNetValue`). Wrapper `getFranchiseRankingMonthly(yearMonth, evoId)` em [src/entities/all.js](src/entities/all.js); usado em FranchiseeDashboard via `useEffect` separado do `useVisibilityPolling` (ranking não precisa polling — só refetch quando filtro muda). Migration: [supabase/get-franchise-ranking-monthly.sql](supabase/get-franchise-ranking-monthly.sql). Sintaxe importante: campo se chama `rank_position` (não `position` — palavra reservada PG)
- **`vw_bot_conversations` view** exclui `status IN ('manual_sale','duplicate_stale')` automaticamente — RPCs novos sobre bot conversations devem `FROM` a view (não a tabela) para auto-sync
- **`bot_conversations.outcome` valores reais (90d)**: `escalated` 21.4k, `ongoing` 5k, `abandoned` 998, `converted` 886, NULL 74, `informational` 16. **`informational` é distinto de `ongoing`** — BotSummaryCard NÃO conta como ongoing
- **`bot_conversations.status` valores reais**: `escalated`, `abandoned`, `converted`, `started`, `manual_sale`, `duplicate_stale`. **`catalog_sent`/`items_discussed`/`checkout_started` NÃO existem** — filter "ongoing por status" usa só `'started'`
- **`supabaseTool` n8n só faz equality filter** (`keyName=keyValue`, sem operadores). Para `gt`/`neq`/`is`, criar view dedicada (`vw_bot_*` com `WITH (security_invoker = true)`) e apontar `tableId` pra view — RLS herda, regra fica versionada em SQL e mudanças não exigem PUT no V4. Padrão atual: `vw_bot_inventory_items` (filtra `active != false`) consumida pelo `planilha_estoque1` no V4 (commit `0dc7283` 08/05/2026)
- **`inventory_items.active=false` (oculto via 👁️ no TabEstoque) ≠ `quantity=0` (zerado)**: "oculto" = franquia decidiu não vender esse SKU (bot NÃO deve mencionar — filtra na view) | "zerado" = franquia vende mas falta agora (bot DEVE saber pra avisar "no momento estamos sem"). Regra de não oferecer quando `quantity=0` vive no `systemMessage` do `Estoque1` agentTool, NÃO no SQL — manter as duas camadas distintas

### KPI Cards & Daily Goal (fixes 11/04/2026)
- KPI percentage: `percentageChange = null` quando `previousValue <= 0` — badge NÃO renderiza com null (evita +100% fake)
- Daily goal (admin FranchiseRanking): avg 30 dias por data única + 10%. Fallback 7000 se <7 dias. SVG cap `Math.min(goalPercent, 100)`, texto mostra % real
- Daily goal (franchisee): mesmo cálculo mas filtra por `evoId`. Retorna `null` se <7 dias — `DailyGoalProgress` esconde-se
- Meta batida: mensagem verde "Meta batida! +R$ X" quando `remaining <= 0`

### Vendas & Financeiro
- Faturamento = `value - discount_amount + delivery_fee` SEMPRE. `delivery_fee` é RECEITA (NÃO deduzir). `discount_amount` DEVE ser subtraído em TODOS os cálculos de receita
- Valor recebido por venda: SEMPRE `getSaleNetValue(sale)` de `lib/financialCalcs.js` (mesma fórmula). NUNCA `s.net_value || s.value` — `net_value` pode ser null em vendas antigas (bug Ricardo Tatuapé 28/04: R$ 118,50 saía 111,50 sem o frete)
- Export de vendas: `SALES_EXPORT_COLUMNS` + `buildSalesExportRows(sales, contactsMap, { includeTotalsRow })` em `lib/salesExport.js` — fonte única usada por TabLancar (tela Vendas) e TabResultado (Gestão > Resultado). Adicionar coluna nova = editar só esse arquivo
- Label de método de pagamento: `getPaymentMethodLabel(value)` de `franchiseUtils.js` (não fazer `PAYMENT_METHODS.find(...)` inline)
- `card_fee_amount` sobre `subtotal + effectiveDeliveryFee` — label dinâmica
- `cardFeePercent` default é `0` (NÃO 3.5). O useEffect seta o valor correto do `paymentFees` config ao carregar
- Exibição de taxa no summary: condição é `cardFeeAmount > 0` (qualquer método), label dinâmico por `paymentMethod`
- 6 métodos de pagamento: Dinheiro, Pix, Crédito, Débito, NFC, Outro. Taxas via tabela `payment_fees` por franquia
- `sales.observacoes` TEXT — campo livre para instruções de entrega/obs do franqueado. Aparece no comprovante (SaleReceipt)
- `payment_confirmed` + `confirmed_at` para conferência. Columns DEVE incluir ambos
- **Confirmar venda dispara CAPI** (29/04/2026): `payment_confirmed:false→true` em TabLancar dispara `fireCapiOnConfirm` (fire-and-forget, helpers no topo do arquivo). Edits nessa região DEVEM preservar a chamada — sem ela, atribuição Meta para vendas manuais quebra de novo. Bulk confirm usa `fireCapiBatch` (throttle 5x). Delete de venda `capi_sent=true` mostra confirm dialog
- `sale_date` é DATE only — `created_at` para timestamp. Edição = deletar items + reinserir
- MiniRevenueChart: SEMPRE usar `realtimeRevenue` de `allSales` (fetchAll: true). NUNCA fallback para `cronRevenue` de `daily_summaries` — cron não recalcula quando `sale_date` muda, causando vendas fantasma no gráfico
- Período "Semana" (StatsCards): `startOfWeek(now, { weekStartsOn: 1 })` — começa na **segunda-feira**, vai até hoje
- Markup estoque: `(sale - cost) / cost` (NÃO margem sobre receita)
- **Giro semanal e sugestão de reposição**: helper único [src/lib/stockSuggestion.js](src/lib/stockSuggestion.js) (`LOOKBACK_DAYS=28`, `WEEKS_OF_COVERAGE=2`, `min_stock` como piso). Consumido por TabEstoque, TabReposicao, PurchaseOrderForm via `weeklyTurnoverMap()` + `suggestionFor()`. Detector dev-only emite `console.warn` se `saleItems` chegar sem `inventory_item_id` — preveniu repetição da regressão silenciosa de columns enxuto
- `formatBRL` de `lib/formatBRL.js` — NUNCA `new Intl.NumberFormat` inline

### Módulo Financeiro v2 (1A · refactor 29/04/2026 · commits `3e2dec4`, `9ad09b3`, `22c3b3a`)

**Filosofia:** DRE = caixa puro para o franqueado (didático), com 4 fluxos automatizados que reduzem lançamento manual. Diagnóstico Fase 0: só 20/47 franquias lançavam despesa antes — automação resolveu.

**`expenses` schema novo** (migration: `supabase/expense-category-migration.sql` + `expense-category-add-pacote-sistema.sql`):
- `category TEXT NOT NULL DEFAULT 'outros'` (CHECK 12 valores: `compra_produto`, `compra_embalagem`, `compra_insumo`, `aluguel`, `pessoal`, `energia`, `internet_telefone`, `transporte`, `marketing`, `pacote_sistema`, `impostos`, `outros`)
- **Adicionar categoria nova = 3 pontos sincronizados**: array `EXPENSE_CATEGORIES` ([src/lib/expenseCategories.js](src/lib/expenseCategories.js)) + constraint `expenses_category_check` + SQL versionado `supabase/expense-category-add-*.sql`. Ordem: migração no banco PRIMEIRO (DROP+ADD do CHECK é backward-compatible), deploy do front DEPOIS — senão a UI oferece valor que o banco rejeita com CHECK violation. `internet_telefone` adicionada 01/06/2026 (pedido franquia Santos)
- `supplier TEXT NULL` — fornecedor texto livre
- `source TEXT NOT NULL DEFAULT 'manual'` (CHECK 5 valores: `manual`, `purchase_order`, `marketing_payment`, `external_purchase`, `asaas_subscription`) — auditoria. Migration `expense-source-add-asaas-subscription.sql` (01/05/2026) adicionou `asaas_subscription` + UNIQUE INDEX `uq_expenses_asaas_sub_payment` (source_id, expense_date) WHERE source='asaas_subscription'
- `source_id UUID NULL` — FK opcional pro registro origem
- Index: `(franchise_id, category)` + `(source, source_id) WHERE source <> 'manual'`

**Constantes/utils reutilizáveis** (sincronizar com CHECK ao adicionar categoria):
- `EXPENSE_CATEGORIES` em [src/lib/expenseCategories.js](src/lib/expenseCategories.js) — array com `{value, label PT-BR, icon Material, color, help}`. Use em ExpenseForm, "Onde foi o dinheiro", LancarCompraSheet
- `getCategoryMeta(value)` retorna meta da categoria com fallback `outros`

**`calculatePnL()` — só caixa puro** ([src/lib/financialCalcs.js](src/lib/financialCalcs.js), simplificado 29/04 commit `d2ec8bf`):
- Retorna apenas: `vendas`, `freteCobrado`, `totalDescontos`, `totalRecebido`, `taxasCartao`, `outrasDespesas`, `lucroCaixa`, `margemCaixa`, `salesCount`
- `lucroCaixa = totalRecebido - taxasCartao - outrasDespesas` — admin e franqueado VEEM O MESMO NÚMERO. NÃO existe mais `lucro`, `lucroCompetencia`, `custoProdutos`, `gastosCompraProduto`, `gastosOperacionais`
- Param `_saleItems` mantido por compat de assinatura (3 args nas chamadas), mas ignorado
- 24 testes em [src/lib/financialCalcs.test.mjs](src/lib/financialCalcs.test.mjs) — rodar com `node src/lib/financialCalcs.test.mjs`

**Utils novos no mesmo arquivo:**
- `calcularEstoqueResumo(inventoryItems)` → `{custoTotal, vendaPotencial, qtdProdutosAtivos, markupMedioPct}` — fallback client-side do RPC
- `getEstadoFinanceiro({lucroCaixa, valorEstoqueVenda, mediaMensalReceita})` → `{estado, cor, titulo, mensagem, icone}` para banner contextual (4 estados 🟢🔵🟡🔴)

**4 fluxos automatizados de despesa:**

| Fluxo | Trigger / RPC | Categoria gerada | Idempotência |
|---|---|---|---|
| Pedido Maxi entregue | `tr_po_generate_expenses` (BEFORE UPDATE OF status) | `compra_produto` + `transporte` | `purchase_orders.expenses_generated_at` |
| Marketing confirmado | `tr_mkt_generate_expense` (status=`confirmed`) | `marketing` | `marketing_payments.expense_generated_at` |
| Mensalidade ASAAS | `tr_subscription_payment_expense` (BEFORE UPDATE OF current_payment_id, current_payment_status; dispara quando `current_payment_status='PAID'` — edge function normaliza RECEIVED/CONFIRMED/RECEIVED_IN_CASH→PAID via `mapPaymentStatus()`) | `pacote_sistema` (R$ 150, `source='asaas_subscription'`) | `system_subscriptions.last_paid_payment_id` |
| Compra externa manual | RPC `record_external_purchase()` (sheet `LancarCompraSheet.jsx`) | `compra_produto`/`compra_embalagem`/`compra_insumo` | `source='external_purchase'` |

**Triggers SQL:** todos `BEFORE UPDATE` (permite setar flag de idempotência sem recursão), `SECURITY DEFINER` + `SET search_path='public'` (linter compliance). Arquivos: `supabase/po-expense-trigger.sql`, `marketing-expense-trigger.sql`, `asaas-subscription-expense-trigger.sql`. Não conflitam com triggers existentes (`on_purchase_order_delivered` continua subindo estoque).

**Cleanup ON DELETE (30/04/2026):** apagar uma `marketing_payments` row dispara `tr_mkt_cleanup_expense` (AFTER DELETE) que remove a expense espelho (`source='marketing_payment'`, `source_id=OLD.id`). Padrão a replicar se PO/ASAAS/external precisarem cancelamento — sempre trigger SQL, nunca cleanup em 2 chamadas JS (atomicidade). Pre-flight obrigatório antes de criar trigger novo: `SELECT conname FROM pg_constraint WHERE confrelid='public.expenses'::regclass AND contype='f'` deve retornar vazio. Arquivo: `supabase/marketing-cancel-trigger.sql`.

**Regra de `source` em expenses (01/05/2026):** cada origem distinta tem valor próprio (`marketing_payment`, `purchase_order`, `external_purchase`, `asaas_subscription`). NUNCA reusar source de outra origem só porque "o CHECK aceita" — cleanup triggers ON DELETE filtram por `source + source_id`, e source compartilhado entre tabelas distintas materializa risco de cascade-delete cruzado se UUIDs colidirem. Adicionar valor novo ao CHECK é trivial (`ALTER CONSTRAINT`) e sempre vale a pena. Bug pré-existente em `tr_subscription_payment_expense`: usava `'marketing_payment'` para subscription, conflito com cleanup de marketing.

**Idempotência ASAAS — ponto cego (26/05/2026):** trigger `tr_subscription_payment_expense` marca `NEW.last_paid_payment_id := NEW.current_payment_id` **mesmo quando INSERT cai em `ON CONFLICT DO NOTHING`** (ou se a expense for apagada manualmente depois). Se a guard `IS DISTINCT FROM` "queimar" para um payment_id sem expense persistida, o trigger não retenta naquele ciclo — só na próxima virada de `current_payment_id` (ciclo seguinte). Ocorreu em 11 franquias na migração 01-02/05/2026 (Vila Maria + 10) — corrigido por INSERT manual. Forward não há risco recorrente (cada ciclo ASAAS gera payment_id novo). **Diagnóstico canônico**: JOIN `system_subscriptions ss` × `expenses e` com `e.source='asaas_subscription' AND e.source_id=ss.id AND e.expense_date=ss.current_payment_due_date` — `expense_existe=false` em sub PAID = ponto cego.

**`source_id` em expenses auto-geradas** (referência rápida): ASAAS subscription → `system_subscriptions.id` (UUID da row, NÃO franchise_id). Marketing → `marketing_payments.id`. PO → `purchase_orders.id`. External → `expenses.id` (self, source='external_purchase'). Importante pra INSERT manual replicando trigger e pra cleanup ON DELETE futuro.

**Marketing — competência por `reference_month` (fix 30/04/2026):** trigger `tr_mkt_generate_expense` deriva `expense_date = (reference_month || '-01')::date` (fallback `updated_at`/`CURRENT_DATE` se reference_month NULL/inválido). Despesa cai no mês a que o marketing se refere, **não** na data em que o admin confirmou. Antes usava `updated_at::date` → pagamento ref maio confirmado em 30/04 caía no DRE de abril. Backfill realinhou 27 despesas (3 abril→maio, 24 normalizadas para dia 1 do próprio mês). Mesma regra replicada em `supabase/scripts/backfill-historical-expenses.sql` para re-runs.

**RPCs novas:**
- `get_inventory_value_summary(p_franchise_id)` — agregado de estoque (custo + venda potencial + markup) para card "Em Estoque"
- `record_external_purchase(franchise_id, type, unit_cost, qty, supplier?, expense_date?, inventory_item_id?, description?)` — atomic: cria expense + opcionalmente sobe estoque com **custo médio ponderado** (proteção div/0). `SECURITY DEFINER` valida `is_admin_or_manager() OR p_franchise_id = ANY(managed_franchise_ids())`. Tipos: `produto` (sobe estoque), `embalagem`/`insumo` (só expense)

**Backfill aplicado (29/04/2026):**
- Heurística regex em description (89/137 = 65%) — script [supabase/scripts/categorize-existing-expenses.mjs](supabase/scripts/categorize-existing-expenses.mjs) com `--dry-run` default e `--apply`. Importante: padrões mais específicos ANTES de mais genéricos (transporte/embalagem ANTES de compra_produto, senão "Sacolas Maxi" pega "maxi"). Use `normalize()` (NFD strip diacritics) antes de regex porque `\b` em JS não trata acentos
- Backfill retroativo de POs+Marketing (116 expenses, R$ 159k) — script [supabase/scripts/backfill-historical-expenses.sql](supabase/scripts/backfill-historical-expenses.sql) executado uma vez. Análise prévia confirmou ZERO match com despesas manuais existentes (ver `audit-prepull` no script). Idempotente futuro via `*_generated_at` flags

**TabResultado redesign** ([src/components/minha-loja/TabResultado.jsx](src/components/minha-loja/TabResultado.jsx)):
- Hero metric: `lucroCaixa` grande + delta `(curr - prev)/abs(prev) * 100` vs mês anterior
- Banner contextual: 4 estados via `getEstadoFinanceiro` (verde/azul/amarelo/vermelho com cores Tailwind via lookup `BANNER_COLORS`)
- 3 cards horizontais: `Em Estoque` (com link compacto "X parados há 28+ dias →" para /Gestao?tab=estoque) / `Caixa do mês` (Vendas + Frete + Descontos detalhados) / `Mais Vendidos` (top 3 com markup, "Ver todas" → /Vendas)
- "Onde foi o dinheiro" — agrupa expenses + taxasCartao por categoria com ícone+barra `style={backgroundColor: ${meta.color}15}`
- Evolução 6 meses (recharts `ComposedChart` com 2 eixos Y): Receita (barras cinza, esq) + Lucro (linha vermelha, dir) + Média móvel 3m (linha tracejada). Tooltip mostra margem %
- `mediaMensalReceita` (3-6 meses) usado como input de `getEstadoFinanceiro`. Sem histórico, banner cai em fallback `valorEstoqueVenda > 1000`
- Empty state com CTA "Lançar despesa"
- Despesas list mostra **badge "auto"** (`bg-[#d4af37]/15`) quando `source !== 'manual'`

**ExpenseForm** ([src/components/minha-loja/ExpenseForm.jsx](src/components/minha-loja/ExpenseForm.jsx)):
- Select de categoria PRIMEIRO campo (decisão visual antes da descrição), com texto de ajuda contextual
- Input supplier opcional (max 120 chars)
- **Aviso visual** quando editando despesa auto-gerada (`source !== 'manual'`): "Esta despesa foi gerada automaticamente... evite mudar a categoria"
- CREATE força `source='manual'`. UPDATE NÃO sobrescreve `source` (preserva auto-geradas)
- Audit log enriquecido com `category` e `supplier`

**LancarCompraSheet** ([src/components/minha-loja/LancarCompraSheet.jsx](src/components/minha-loja/LancarCompraSheet.jsx)):
- Sheet bottom (responsivo: rounded-t-2xl, sm:max-w-2xl sm:mx-auto)
- 3 tipos radio buttons (produto/embalagem/insumo) com ícone+cor
- Item autocomplete só aparece se tipo=produto
- Mostra "novo custo médio sugerido" calculado client-side antes de submit
- Submit chama RPC `record_external_purchase` via `@/api/supabaseClient` (atenção ao import path correto)
- Datalist `recentSuppliers` (top 10 últimos usados)

**Preview rota** [/PreviewResultado](src/pages/PreviewResultado.jsx) — mantido pra histórico/comparação visual com 4 cenários mockados (verde/azul/amarelo/vermelho). Acessível via URL direta (não tem link na sidebar).

**Insights de uso (Clarity 3 dias antes do redesign):**
- 62% mobile (267 sess) vs 37% PC (158) — confirmou mobile-first
- /Financeiro engagement 1057s — admin lê muito, NÃO pode quebrar (estratégia non-breaking pague)
- /FranchiseSettings tem 120 dead clicks + 7 rage — backlog de UX (fora de escopo deste ciclo)

### Impressão Térmica (Comprovantes) — refactor 21/04/2026 (commit `53751dd`)
- Arquivos: [SaleReceipt.jsx](src/components/minha-loja/SaleReceipt.jsx) (bloco `<style>` interno) + [shareUtils.js:158](src/lib/shareUtils.js#L158) (`@page`)
- **Auto-adapt 58/80mm** sem configuração: `@page { size: auto; margin: 0 }` + container com `width: "100%", maxWidth: 400`. Driver da impressora reporta largura; CSS adapta. NUNCA fixar width em px nem `size: 80mm` (quebra 58mm)
- **`margin: 0` no `@page`** — térmica tem margem física de 2-3mm por lado; margem CSS extra cortava lateral
- **Contraste obrigatório em `@media print`** (regras com `!important` no `.receipt *`):
  - `color: #000` em tudo (ZERO cinza — `#666`, `#444`, `#dc2626` somem em raster 1-bit 203dpi)
  - `font-family: 'Courier New'` monospace + `font-weight: 700` + `font-size: 11pt`
  - `-webkit-font-smoothing: none` (anti-aliasing vira dither)
  - `print-color-adjust: exact` + prefix `-webkit-`
  - `overflow-wrap: anywhere` + `word-break: break-word` para nomes longos
  - Logo `max-width: 40mm` (cabe em 58mm)
- Ao adicionar elementos ao SaleReceipt: NUNCA usar cor cinza, font-weight < 700, ou background colorido. O `!important` no `@media print` neutraliza inline styles — mas se vai imprimir, projetar pensando em "preto puro ou branco puro"
- **Uso prático (Nelson 21/04)**: franqueado imprime com **escala 80%** no dialog do browser e fica ótimo. Se reclamação de "ficou grande", orientar reduzir escala no print dialog — não é bug
- Se alguma franquia reclamar de impressão ainda apagada após este refactor, **não é CSS** — é densidade do driver (heating time) ou bobina velha. NÃO forçar config na franquia (Nelson: zero configuração)

### Meta CAPI
- Campos `contacts`: `meta_click_id`, `meta_fbclid`, `meta_ad_id`, `meta_adset_id`, `meta_campaign_id`
- `franchise_configurations`: `meta_pixel_id`, `meta_access_token`, `meta_dataset_id`, `whatsapp_business_account_id`
- Pixel produção: `5852647818195435`
- **CAPI em vendas manuais** (29/04/2026): TabLancar dispara `fireCapiOnConfirm(saleId)` (fire-and-forget) na flip `payment_confirmed: false→true` — single toggle e bulk confirm (throttle 5x). Webhook n8n `SendCapiOnSaleManual` (`xNBgSwQ6QduaS6jT`, URL `/webhook/send-capi-on-sale-manual`). Auth via `VITE_CAPI_MANUAL_TOKEN` (Bearer) ↔ `CAPI_MANUAL_WEBHOOK_TOKEN` no n8n env. Idempotente (skipa se `capi_sent=true`). Skipa também se `contact_id=null` ou franquia sem WABA. `event_id = purchase_manual_<sale_id>` distingue do bot. Delete de venda c/ `capi_sent=true` mostra confirm dialog avisando registro fantasma no Meta

### Convites
- Franqueado: `inviteFranchisee()` via webhook n8n (NÃO `resetPasswordForEmail` — email duplicado)
- Staff: `staffInvite(email, role)` → webhook `/staff-invite`. Se user existe → atualiza role; se não → convite
- Supabase 23505 (duplicate) = conta já existe em auth.users

### Health Score
- 5 dimensões: vendas, estoque, reposição, setup, bot. Pesos variam com `hasBotData`
- **UM sistema** (atualizado 29/05/2026): `healthScore.js` (`calculateFranchiseHealth()`), consumido por Acompanhamento via `FranchiseHealthDetail`. O componente `FranchiseHealthScore.jsx` foi DELETADO na auditoria de 29/05 (0 imports — era código morto). NÃO recriar.
- `healthScore.js` consome `botSummary` aggregates do RPC `get_bot_conversation_summary` (não array bruto de conversas)
- ~~BUG CATEGORY_CONFIG_WITH_BOT (barras > 100%)~~ — resolvido em 29/05/2026 deletando o componente FranchiseHealthScore.jsx (código morto)

### Marketing
- `marketing_payments`: 1 por franquia/mês. UNIQUE `(franchise_id, reference_month)`. CHECK `amount >= 200`
- Últimos 5 dias do mês → reference_month mira mês seguinte (lógica idêntica em Card + Admin)
- `MARKETING_TAX_RATE = 0.13` em `franchiseUtils.js`. Líquido = valor × 0.87

### UX
- Franqueado: sidebar 8 itens (Início, Vendas, Gestão, Meus Clientes, Marketing, Meu Vendedor, Tutoriais, Onboarding condicional) + bottom nav 5 slots (FAB Vender centro)
- Admin: 7 itens visíveis na sidebar + 3 ocultos (`adminSidebarHidden`: Financeiro, Acompanhamento, Inteligência Bot) acessíveis por URL
- Manager: mesma visão admin mas SEM delete. Checagens: `role === "admin" || role === "manager"` visão, `role === "admin"` delete
- Terminologia: "Estoque" (NÃO "Inventário"), "Valor Médio" (NÃO "Ticket Médio"), NÃO "Líquido"
- Onboarding: 9 blocos (8 numerados + gate de liberação). `TOTAL_ITEMS` computado dinamicamente. Acessível via sidebar, franchise cards e detail sheet
- Sidebar admin: remover `adminSidebarHidden` + definir `adminSection` = visível na sidebar
- Filtro de período com seletor de mês `[◀ Mai/2026 ▶]`: pattern oficial em [TabLancar.jsx](src/components/minha-loja/TabLancar.jsx) (Vendas), [TabResultado.jsx](src/components/minha-loja/TabResultado.jsx) (Gestão > Resultado) e [FranchiseeDashboard.jsx](src/components/dashboard/FranchiseeDashboard.jsx) (Início, c/ "Personalizado" extra). State `monthOffset` (0=atual, -N=passado), aria-labels "Mês anterior"/"Próximo mês", touch target ≥40px, setas `disabled` nos limites. Reusar visual em telas novas
- Filtro híbrido `[Hoje][Semana][◀ Mês ▶][Personalizado]` em mobile: container precisa de `overflow-x-auto sm:w-fit` (sem `sm:w-fit` estica 100% no desktop). Botão "Personalizado" comprime pra só ícone em ≤640px (`<span className="hidden sm:inline">Personalizado</span>`) — senão estoura iPhone 14 Pro Max (430px)
- **Sheet shadcn `side="bottom"` em desktop** estica full-width (≥sm). Pra centralizar tipo dialog, no `<SheetContent>`: `sm:max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-8 sm:rounded-2xl`. Padrão usado em [CustomDateRangeSheet.jsx](src/components/dashboard/CustomDateRangeSheet.jsx) (06/05/2026). Mobile mantém comportamento bottom-sheet padrão

### ASAAS Billing (Cobrança Recorrente)
- Edge Function: `supabase/functions/asaas-billing/index.ts` — actions: `register`, `register-batch`, `subscribe-batch` (accept `value` opcional), `cancel-subscription`, `update-subscription-value`, `check-payment`, `register-webhook`, `webhook`. Action `subscribe` (single) removida 18/04
- Tabela: `system_subscriptions` (franchise_id UNIQUE, asaas_customer_id, asaas_subscription_id, subscription_status, current_payment_*, pix_payload, pix_qr_code_url, last_synced_at)
- Colunas em `franchises`: `cpf_cnpj`, `state_uf`, `address_number`, `address_complement`, `neighborhood`, `billing_email`. `address_complement` é OPCIONAL (não bloqueia gate, fora de `missingFiscalFields`). Para alterar campos de endereço: tocar em FranchiseForm (state+input+submit), saveFiscalData (FRANCHISE_FIELDS), AsaasSetupPanel (columns enxuto + display), Franchises.jsx (handleSaveFiscal + initialData), FiscalDataGate (initialData + handleSubmit), asaas-billing edge (select + payload — ASAAS usa `complement`)
- ASAAS API: `https://api.asaas.com` + `/v3/...`, header `access_token` (secret no Supabase)
- `billingType: UNDEFINED` = franqueado escolhe boleto ou PIX
- Paywall: `SubscriptionPaywall.jsx` — bloqueia APENAS `current_payment_status === 'OVERDUE'`, admin/manager isentos
- Hook: `useSubscriptionStatus.js` — cache 24h (PAID) / 5min (OVERDUE), botão "Já paguei" via `supabase.functions.invoke`
- Admin: tab Mensalidades em `Financeiro.jsx` → `AsaasSetupPanel.jsx` (input Mensalidade R$ + edit inline CPF/email, badges, botão Atualizar valor de todos, botão Cancelar por linha, revisão assinaturas)
- FranchiseForm: CPF/CNPJ + endereço com auto-fill ViaCEP (cidade também — IBGE autocomplete removido 17/04). Prop `mode` = `"create"` (admin) ou `"fiscal-only"` (gate onboarding + edição). `onSubmit` recebe 3o arg `addressExtras` (cep, street_address). Passar `billing_email` em `franchiseData`
- Helper `@/lib/saveFiscalData.js`: grava fiscal fields em `franchises` + `franchise_configurations` atomicamente. `missingFiscalFields(franchise, config)` retorna array de campos faltantes para gate/badges
- Gate onboarding: `components/onboarding/FiscalDataGate.jsx` — bloqueia franqueado sem email+CPF+endereço completos antes das 8 missões. Sem gate se admin (não-isAdmin check). Completar → unblocks
- Editar dados fiscais existentes (admin): botão no detail sheet de `Franchises.jsx` → Dialog com `FranchiseForm mode="fiscal-only"` + aviso ASAAS não sincroniza automaticamente (precisa clicar "Criar" de novo em Mensalidades se customer já existe)
- ClickSign API: token como query param `?access_token=`, NÃO Bearer. Endpoint: `app.clicksign.com/api/v3/envelopes`
- **Webhook ASAAS** (15/04/2026): registrado via action `register-webhook`, ID `c6485ea9`. Detecta formato nativo ASAAS (sem `action`, com `event` + `payment`). Token via body `access_token`, header `asaas-access-token`, ou query `?asaas_token=`. 7 eventos: PAYMENT_CREATED/UPDATED/DELETED/REFUNDED/OVERDUE/RECEIVED/CONFIRMED
- **Edge Function auth**: `verify_jwt: false` (auth manual no código). Service role bypass via JWT `role` claim. Admin para billing actions, owner para check-payment. Webhook usa `ASAAS_WEBHOOK_TOKEN` (fail-closed)
- Edge Function deploy: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy asaas-billing --no-verify-jwt --project-ref sulgicnqqopyhulglakd`
- **`asaasRequest` fix 18/04/2026**: trata 204 No Content (DELETE retorna sem body) — antes causava SyntaxError em `res.json()` mesmo com sucesso no ASAAS. `if (res.status === 204) return {}` + `text()` + `JSON.parse(text)` tolera body vazio
- **Cancel + Update valor (18/04/2026)**:
  - `cancel-subscription`: DELETE `/v3/subscriptions/{id}` + DELETE payments PENDING da sub + update banco (limpa `asaas_subscription_id`, `current_payment_*`, `pix_*`; mantém `asaas_customer_id` para recriar fácil). Status → `subscription_status='CANCELLED'` + `current_payment_status='CANCELLED'`. 404 do ASAAS tolerado (sub já cancelada manual). NÃO desativa franquia (`franchises.status` intacto)
  - `update-subscription-value { franchise_ids | all_active, new_value, apply_to_current }`: valida 5 ≤ value ≤ 5000. POST `/v3/subscriptions/{id}` com `{value}` atualiza próximos ciclos. `apply_to_current: true` → POST `/v3/payments/{current_id}` com `{value}` + refetch PIX (QR novo). Retorna `{total, updated, results[]}`
  - `subscribe-batch` aceita `value` opcional (default 150). UI passa `monthlyValue` do input
  - `createSubscription(franchiseId, value=150)` aceita valor — crítico: sem isso, recriar sub após mudar valor voltaria a R$ 150 hardcoded
- **`SubscriptionBadge` states** (`AsaasSetupPanel`): "Aguardando criar" (amarelo, customer sem sub), "Pendente" (amarelo), "Pago" (verde), "Vencido" (vermelho), "Cancelada" (cinza block)
- **Email sync no register**: se customer já existe no ASAAS (match por cpfCnpj) e `billing_email` local divergir → POST `/v3/customers/{id}` atualiza email (NFe fica correto). Outros campos (endereço/CPF/nome) NÃO sincronizam automático — admin precisa clicar "Criar" novamente OU recriar customer se precisar ampliar
- **Estado assinaturas** (18/04/2026): 11 franquias com customer ASAAS (10 aguardando criar sub + 1 teste Araraquara ativa). 36 franquias sem CPF pendentes
- **Cobrança "Sua Equipe Digital"** (15/04/2026): `FinancialObligationsCard` substituiu `MarketingPaymentCard` na home — card unificado com linha subscription (ASAAS) + linha marketing. Nome UI: "Sua Equipe Digital" (NÃO "Mensalidade"). `SubscriptionPaymentSheet` (Sheet bottom): PIX QR + copiar código + boleto + "Já paguei"
- PriorityAction: cenário `equipe_digital` dispara APENAS para OVERDUE (PENDING tratado pelo card). Suporta `onPress` callback (além de `navigateTo`) via flag `data.onPress`
- ASAAS `createSubscription` 1º vencimento (fix 01/06/2026): dia 5 do **MÊS CORRENTE** se `now.getDate() <= 5`, senão mês seguinte — `new Date(y, getMonth() + (day<=5?0:1), 5)`. Antes era sempre mês seguinte (15/04). NUNCA `getDate() >= 5 ? +2 : +1` (0-indexed pulava 2 meses, bug histórico)
- RPCs `get_franchise_ranking` e `get_franchise_report_data`: guards `is_admin_or_manager() OR managed_franchise_ids()` — SECURITY DEFINER com ownership check

### ASAAS — roll-forward, troca de dono e exclusão (01/06/2026)
- **Card de mensalidade ("Sua Equipe Digital") congela no mês pago**: `system_subscriptions.current_payment_*` trava na última fatura paga porque (a) o webhook IGNORA `PAYMENT_CREATED`/PENDING com vencimento >7d (guard anti-clobber intencional, [index.ts](supabase/functions/asaas-billing/index.ts) ~L347) e (b) NÃO há cron de re-sync (zero `pg_cron` de subscription). Resultado: card mostra "Maio Pago" em junho. Marketing NÃO sofre (é calendar-driven via `getMarketingTargetMonth`); subscription é data-driven (webhook). **Fix**: `checkPayment` seleciona a fatura do PERÍODO ATUAL — prioridade `arrears` (vencida não-paga, mantém paywall visível) → `current` (mais recente com vencimento ≤ hoje+7d) → `paid`; e [FinancialObligationsCard.jsx](src/components/dashboard/FinancialObligationsCard.jsx) dispara `checkPaymentNow()` sozinho (1× por mount, guard `due.slice(0,7) < yyyy-MM atual`) quando detecta fatura PAGA de mês anterior (roll-forward, owner-authed — não precisa cron). Re-sync em massa pontual: edge `check-payment-batch` (admin)
- **`createSubscription` re-registra o cliente ASAAS ANTES de criar** (`registerCustomer`): troca de dono (CNPJ novo) → busca por `cpf_cnpj` atual, não acha, cria cliente NOVO → a sub cobra o dono certo. Sem isso usava o `asaas_customer_id` antigo (cobrava o dono anterior). `registerCustomer` quando o CPF JÁ existe só sincroniza EMAIL (não CPF/nome/endereço). Não-fatal (try/catch)
- **`subscribe-batch` aceita `franchise_ids`** (subconjunto): UI "Criar Assinaturas" ([AsaasSetupPanel.jsx](src/components/financeiro/AsaasSetupPanel.jsx)) tem ✕ por linha pra excluir testes antes de confirmar (estado `excludedSubIds`, manda só `selectedIds`)
- **Excluir franquia NÃO cancela ASAAS** (`delete_franchise_cascade` RPC é só banco): `handleDeleteFranchise` ([Franchises.jsx](src/pages/Franchises.jsx)) cancela a sub ASAAS (`cancel-subscription`) ANTES do `deleteCascade` (a row some no cascade) e **ABORTA** a exclusão se o cancel falhar — evita cobrança órfã (caso Indaiatuba: franquia excluída mas sub seguia cobrando 05/06)
- **`FranchiseForm` esconde Nome da Franquia + Nome do Franqueado em `mode="fiscal-only"`**; prop `allowNameEdit` reexibe SÓ na edição admin (Franchises → Editar dados), não no gate de onboarding do franqueado. `saveFiscalData` não persiste name/owner_name — `handleSaveFiscal` faz `Franchise.update` separado

## Features Removidas (NÃO recriar)
Base44, Catalog.jsx/CatalogProduct, Sales.jsx/Inventory.jsx (redirects), Login Google, WhatsAppHistory.jsx, Personalidade bot UI, catalog_distributions, Weekly Bot Report (`JSzGEHQBo6Jmxhi3`), EnviaPedidoFechado V1 (`ORNRLkFLnMcIQ9Ke`), Sparklines KPI cards admin, BotCoachSheet.jsx, ActionPanel.jsx (my-contacts), LeadAnalysisModal.jsx.

**Removidos 29/05/2026 (auditoria multi-agente — eram código morto, 0 imports):** `BotIntelligence.jsx` (página + rota + link "Ver detalhes" do BotSummaryCard — admin não usava; funil dependia de status inexistentes `catalog_sent`/`checkout_started`; varria 28k conversas sem janela), `FranchiseHealthScore.jsx`, `BotPerformanceCard.jsx`, `MessagesTrend.jsx`, `SaudeDoNegocioCard.jsx`, `DiagnosticoSheet.jsx`, `PeriodComparisonCard.jsx`, `ResultadoCharts.jsx`, `MarketingPaymentCard.jsx`, `QuickAccessCards.jsx`, `UserNotRegisteredError.jsx`, `lib/app-params.js`. **NÃO recriar.** Relatório: [docs/auditoria-dashboard-2026-05-29.md](docs/auditoria-dashboard-2026-05-29.md)

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

## Supabase Management API
- Project ref: `sulgicnqqopyhulglakd`
- SQL: `POST .../projects/{ref}/database/query` com `Authorization: Bearer {sbp_token}`
- Executar SQL via API com context-mode: `ctx_execute` com `fetch()` JavaScript (curl bloqueado pelo context-mode hook)
- **EXPLAIN de SQL function STABLE** mostra só `Function Scan` opaco (a função inlinea no plano externo mas não aparece). Para ver o plano real, copiar o body da função (`pg_get_functiondef`) e rodar `EXPLAIN ANALYZE` direto na query SQL inline
- **`pg_get_functiondef(p.oid)` falha com `42809: "X" is an aggregate function`** quando `p.prokind='a'`. Ao iterar `pg_proc` (catálogo de funções), filtrar `WHERE p.prokind='f'`. NÃO usar `proisagg` — coluna removida em PG 11+
