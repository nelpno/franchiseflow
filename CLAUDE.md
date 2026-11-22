# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Este arquivo contém APENAS especificidades do dashboard.
> Núcleo enxuto (14/11/2026): aqui fica a regra de 1 linha; o porquê, os casos e as provas pendentes estão em `docs/claude/` (tabela "Onde está o detalhe"). Detalhe novo vai para o shard, não para cá.

## Comandos
```bash
npm run dev     # Vite :5173 — no Windows/OneDrive NÃO imprime o banner, mas sobe
npm run build   # não imprime nada além de `> vite build`: confiar em EXIT=0 + timestamp de dist/index.html (~10-20 s)
npm run lint    # eslint --quiet — ⚠️ no-undef DESLIGADO (símbolo não-importado passa e vira tela branca)
npm run icons:check   # ícone fora do subset aparece como PALAVRA na tela (01/10: "insights" virou texto gigante); rodar antes do build
node src/lib/financialCalcs.test.mjs   # 27 testes do dinheiro (DRE, taxa repassada × absorvida)
node src/lib/franchiseUtils.test.mjs   # multi-unidade (resolveActiveFranchise)
npm run test:unit   # ⏳ FALHA em cotaFrete.sync desde antes de 13/11 (cotaFrete.gen.js diverge do robô: `node scripts/sync-cota-frete.mjs`) e para ali; rode o teste do arquivo mexido direto
node src/lib/mensagemFranqueado.test.mjs   # ⏳ FALHA no "aviso de entrega (L3)" desde o guard de voz de 23/10 (já falhava antes de 3b441dc) e para ali: os testes seguintes não rodam
node .tmp/deploy.mjs                   # force update do serviço no Portainer (depois do push)
npx supabase functions deploy asaas-billing --no-verify-jwt --project-ref sulgicnqqopyhulglakd   # SUPABASE_ACCESS_TOKEN = SUPABASE_MANAGEMENT_TOKEN do .env; conferir tipos antes: npx deno check index.ts
# Testar o lote do ASAAS sem o painel: select public.cron_sync_asaas_subscriptions(); e ler net._http_response (a service role do .env dá 401 na edge)
```
Deploy = push → `node .tmp/deploy.mjs` → verificar por **CONTEÚDO** no live (~75s de 502). Push: `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main` (`git push` puro TRAVA). Prova: `git ls-remote origin main` = `git rev-parse main`. Por que e o jeito antigo: `deploy-verificacao.md`.

## Voltar atrás (roteiro de emergência, 28/09/2026)
Ordem: **1) chave → 2) front → 3) SQL → 4) n8n.** A chave resolve em segundos sem deploy; o resto só se ela não cobrir.
1. **Chave liga/desliga** (`feature_flags`, SQL `supabase/2026-09-28-feature-flags.sql`): pelo MCP `execute_sql` (sem claims = passa) — rede: `select public.set_feature_flag('ui_v2', null, false, 'emergência: <motivo>');` · uma unidade: `select public.set_feature_flag('ui_v2', '<evo>', false, '<motivo>');` · voltar a seguir a rede: `delete from feature_flags where key='ui_v2' and franchise_id='<evo>';`. O front lê por `useFeatureFlag(FEATURE_KEYS.UI_V2)` (cache 5 min + foco da janela; erro = desligada). Chave nova = linha nova + nome em `src/lib/featureFlags.js`. Dentro de SQL: `feature_flag_enabled('<chave>', '<evo>')`.
2. **Front:** `git revert <sha>` (nunca `reset` em main publicado) → push (ver Comandos) → `node .tmp/deploy.mjs` → conferir pelo conteúdo que o texto/símbolo novo SUMIU do chunk. O build é do `main` no GitHub: commit local não volta nada.
3. **SQL:** todo `.sql` novo traz no cabeçalho o `ROLLBACK` exato. Função alterada: backup do corpo vivo em `docs/db-backups/<função>.<data>-antes.sql` ANTES de aplicar (`pg_get_functiondef` pela Management API; reaplicar o arquivo = voltar). Aplicar sempre por `node supabase/cs-cockpit/_aplica-lf.mjs` e conferir em consulta separada (`md5(prosrc)`, sem `\r`).
4. **n8n:** backup JSON em `automation/backups/` antes de qualquer PUT (skill `workflow-deploy`); voltar = PUT do backup (só `name/nodes/connections/settings`) e conferir `active` (PUT pode desativar).

## Stack & Deploy
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud + react-query 5. Stack Portainer 39 | service `2zb27nndn5sg8zweyie6wscpc` | GitHub `nelpno/franchiseflow`.
- **Verificar o deploy pelo CONTEÚDO do chunk:** página lazy = `<Page>-*.js`; entity layer e libs = `index-*.js`; componente compartilhado pode ser chunk FILHO (seguir os `.js` citados). Nova presente E antiga ausente. Receita: `deploy-verificacao.md`.
- **Build verde ≠ app funciona:** símbolo indefinido/não importado compila e dá tela BRANCA — `npm run lint:undef` antes de deployar.
- `.tmp/` é gitignored e tem segredo (`deploy.mjs` com a API key do Portainer) — nunca `git add -A`.
- jspdf-autotable v5: `autoTable(doc, opts)` por import dinâmico (o `doc.autoTable()` antigo só explode em runtime).
- Stack 39 = `node:24-alpine` por digest que clona + `npm ci` + `vite build` a cada start; teto 2 GB (**1 GB dá OOM**); o `Dockerfile` do repo (node 20) NÃO é usado; prod dropa `console.log`. Digest, rollback e proposta: `deploy-verificacao.md`.
- `npm install <pacote>` APAGA o `puppeteer-core` (fica fora do package.json e os prints/provas usam): depois de instalar, `npm install --no-save puppeteer-core@25.12.0`.

## Mapa do código (`src/`)
- `pages/` — 1 arquivo por rota (`createPageUrl("X")`→`/X`): Dashboard, Vendas, Gestao, Financeiro, Franchises, Marketing, MyContacts, Onboarding, FranchiseSettings, CustomerSuccess…
- `entities/all.js` — **camada de dados** (entity adapter; SEMPRE importar daqui, nunca `supabase.from()` direto) · `entities/columns.js` — listas de colunas travadas (`SALE_PNL_COLUMNS` etc)
- `lib/` — regras puras: `financialCalcs` (DRE/`getSaleNetValue`), `formatters`, `dateOnly`, `stockSuggestion`, `salesExport`, `franchiseUtils` (`PAYMENT_METHODS`), `saveFiscalData`, `customerActions` (textos e regras de "Quem chamar hoje"), `safeErrorMessage`/`csvSanitize`/`safeHref` (segurança)
- `components/minha-loja/` — telas do franqueado (TabResultado, TabLancar, TabEstoque, TabReposicao, SaleForm, PurchaseOrderForm, SaleReceipt, ExpenseForm)
- `components/dashboard/` — FranchiseeDashboard + cards (FinancialObligationsCard, BotSummaryCard, FranchiseRanking) · `financeiro/` — AsaasSetupPanel, MarketingPaymentsAdmin · `clientes/` — "Quem chamar hoje" (DailyActionsList, ActionCards, CustomerBadges, ContactFilterChips) · `customer-success/` — Mural CS (CsBoard/CsCard/FranchiseDrawer/tierConfig) · `onboarding/` · `marketing/` · `vendedor/` — wizard "Meu Vendedor" · `cardapio/` — Cardápio digital · `ui/` — shadcn
- `App.jsx` (rotas + gates `ADMIN_ONLY_PAGES`/`CsRoute`) · `Layout.jsx` (nav + `FranchiseSelector`) · `lib/AuthContext.jsx` (auth, `selectedFranchise`)
- `supabase/` — migrations `.sql` versionadas + `functions/asaas-billing/` (edge) · `docs/claude/` — shards do CLAUDE.md

## Regras que quebram produção (1 linha cada; o porquê e os casos estão no shard)
- **Dados:** importar de `@/entities/all`, nunca `supabase.from()` (exceção: `.in()` em lote). Adapter IGNORA `filter:` (use `gte/lte`). `fetchAll` já ordena por `id`. Coluna nova em `columns` enxuto: conferir em `information_schema` e nos consumidores. → supabase-schema
- **Nomes que enganam:** `inventory_items.quantity/product_name`, `sale_items.unit_price`, `notifications.read`, `franchise_configurations.franchise_evolution_instance_id` (não `franchise_id`), `bot_conversations.started_at`, `sales.contact_phone`, `franchises.phone_number`. → supabase-schema
- 🔴 **Endereço fiscal e ponto de retirada usam as MESMAS colunas** (`franchise_configurations.street_address/cep/city/neighborhood` + `franchises.address_number`); não há razão social, IE nem IBGE. ⏳ Cadastro fiscal separado (Nelson, 26/09). → supabase-schema
- **RLS/SECURITY DEFINER:** view `security_invoker=true`; definer confere usuário no corpo + `revoke ... from public, anon`; guard nunca por `current_user`; helper como `(select fn())`; GET com a chave anon tem de dar 401; tabela nova após 30/10/2026 precisa `grant`. → supabase-schema, historico-ondas
- **Rodar RPC com guard pelo MCP:** `with ctx as materialized (select set_config('request.jwt.claims', …)), h as materialized (…)` — os DOIS `materialized`, senão volta 0 linhas calado. → cs-admin
- **SQL:** `.sql` do Windows injeta `\r` (aplicar por `node supabase/cs-cockpit/_aplica-lf.mjs`); conferir UPDATE em consulta SEPARADA; `CURRENT_DATE` é UTC; `\b` no regex PG é backspace (use `\y`); `DROP TABLE` quebra plpgsql que cita a tabela. Management API com `$$`: SQL em arquivo, não no JSON. → supabase-schema, cs-admin
- **Dinheiro:** receita = `value − discount_amount + delivery_fee` via `getSaleNetValue`; taxa repassada ao cliente não é custo; "a receber" entra no Sobrou; `confirmed_at` é do servidor; `save_sale_with_items` ENUMERA colunas. → vendas-financeiro, `docs/claude/sobrou-no-mes.md`
- **Venda à mão nasce RECEBIDA** (Nelson 03/10/2026, mantida contra pedido da Luzia): não reverter `nasceRecebida` sem ordem dele; a do robô nasce a receber. → vendas-financeiro
- **Venda guarda CÓPIA** de nome, telefone e endereço (`sales.customer_name/contact_phone/customer_address/customer_neighborhood`): a lista mostra o cadastro, a busca usa a cópia; "venda sumiu/nome trocado" = `audit_logs` (`entity_id`). Venda com data futura só aparece em "A receber". → vendas-financeiro
- **Pedido à fábrica:** RPC idempotente `create_purchase_order_with_items`; preço = `preco_tabela_fabrica`; `entregue` é terminal; reposição só catálogo padrão (`created_by_franchisee !== true`) **do `inventory_items` da própria unidade**: produto novo da fábrica precisa de uma linha em TODAS. Desde 22/11/2026 a franqueada não apaga item da fábrica, só oculta (trigger `trg_guard_inventory_delete` + `pedirExclusao` no `TabEstoque`; ocultar mantém no pedido). Item faltando de antes disso: `insert` com `created_by_franchisee=false` copiando a linha de outra unidade (em 22/11 a rede ficou completa; o que a unidade tinha apagado voltou OCULTO). O catálogo padrão (`get_standard_product_catalog`) sai do próprio `inventory_items`: item da fábrica renomeado vira "produto da fábrica" para as outras (Molho Sugo "500ML" da sp16, desfeito em 22/11); memória do envio = rascunho com `clientId`. → telas-franqueado, historico-ondas
- **Entrega do pedido:** "entregue" do admin fecha na hora (estoque e despesa). A conferência pela unidade (S15.1) saiu em 04/11/2026, nunca ligada (tela, cron e desvio do gatilho: `supabase/2026-11-04-s15-sem-conferencia.sql`); a chave `conferir_entrega` não faz mais nada.
- **Sentinela avisa só os admins** (`notify_admins`): duplicata manual × robô (verificação 7/7b) e marketing duplicado. → cs-admin
- **Quem chamar hoje:** regra só na RPC `get_daily_customer_actions` (constantes no topo); a ordem dos motivos vive em DOIS lugares (`ordem_tipo` na RPC e `ACTION_ORDER` em `customerActions.js`, o teste trava). → telas-franqueado
- **Chamar Uber** (chave `chamar_uber`, rede desde 13/10/2026): Edge `uber-link`, conta e preço da franqueada; no PC mostra "chame pelo celular". → telas-franqueado
- **Lista em grade (cabeçalho e linhas são grades separadas):** colunas em `minmax(0,Nfr)` e a de ação em `rem` fixo, nunca `auto` nem `fr` puro (cada linha calcula sozinha e desalinha). Medir a largura real da ação antes (Mensalidades precisa de 21.5rem).
- **Meu Vendedor/robô:** salvar só o que mudou (`configSave.js`); frete calculado só pela RPC `salvar_frete_estruturado`; forma de pagamento nova toca 3 pontos no bot. NUNCA alterar `franchise_configurations` sem conferir o vendedor genérico. → supabase-schema, n8n-bot
- **Pagamento (Meu robô):** a matriz e a simulação usam os MESMOS termos que o robô lê (`__pagamentoFatos`); `pix_on_delivery` (só Uberaba) e `pix_no_cardapio` (no ar desde 12/11; desde 15/11 também para quem recebe na hora, `e2da419`). → `meu-robo-pagamento.md`
- **Onboarding:** papel nunca do metadado; `approved` só pela RPC `set_onboarding_status`; item grava por `set_onboarding_item`. → telas-franqueado
- **Marketing:** retorno por mês = Mais › Marketing › "Resumo de <mês>"; `marketing_payments.kind` = `mensal` (1 por mês) ou `complemento`, e a tela "pagou o mês?" lê só `mensal`. ⏳ Bug: editar verba PENDENTE com outro valor dá "Sem permissão". → `marketing-verba.md`
- **Régua da rede:** tudo em `src/lib/networkOverview.js` (queda −20% com base R$ 3 mil, sem venda 7 dias, verba, nova < 30 dias desde 29/09). Mensagem à franqueada só por `mensagemFranqueado.js`. → cs-admin
- **Canais de venda (10/11/2026, admin/gerente/CS):** bloco no Hoje + `/CanaisVenda` (robô × cardápio × à mão, 7 dias · Este mês · Mês anterior; RPC `get_admin_canais_venda`, cópia local 24 h). Atribuição e detalhe: [docs/claude/cardapio-e-canais.md](docs/claude/cardapio-e-canais.md).
- **Assessor do CS** (17/11/2026): Edge `supabase/functions/cs-assessor` (chama as RPCs com o JWT de quem pergunta, sem service role; propostas só gravam pelo Confirmar da tela) + `components/customer-success/AssessorChat.jsx`; log/feedback em `cs_assessor_log`. Deploy: `npx supabase functions deploy cs-assessor --project-ref sulgicnqqopyhulglakd --yes`. Afinação e modelo: `cs-celso/assessor/afinacao.md`. Relatório completo (22/11): RPC `get_cs_relatorio_unidade` lê a tabela `cs_rede_mes` (só backend; cron `cs-rede-mes` 07:40 UTC refaz o mês anterior e o atual, ~14 s cada; refazer um mês: `select cs_rede_mes_atualizar('AAAA-MM')`). `MarkdownSimples` desenha tabela `| a | b |`.
- **Encomendas (17/11/2026, rede toda):** tabela `encomendas` (RLS como `sales`; `supabase/2026-11-17-encomendas.sql`) + aba em Vendas (`TabEncomendas`, `?aba=encomendas`), bloco "somar ao pedido" no `PurchaseOrderForm` (`EncomendasNoPedido`; ao enviar, as somadas viram `pedida` com `purchase_order_id`) e cartão na Início (`EncomendasDaSemana`). NÃO mexe em estoque nem faturamento: só "Virou venda" (`SaleForm` com `prefill`) baixa estoque, pelo trigger de `sale_items`. Regras em `lib/encomendas.js` (`node src/lib/encomendas.test.mjs`). ⏳ Prévia/tela real só vista por harness com mocks (sem login de franqueada). Rede avisada no grupo das franquias e Renato (pediu) em 17/11 ~21h (ids em `bots/vendedor/mensagens/2026-11-17-grupo-encomendas.ids.json`). ⏳ 1º uso real: `select count(*) from encomendas`. No ar desde 17/11 ~21h10 (`0857d16`; grupo avisado pela sessão do CS). ⏳ Prova: 1ª encomenda real (`select status,count(*) from encomendas group by 1`), o "Virou venda" baixando estoque e a encomenda virando `pedida` no envio do pedido; nada disso foi visto com login de franqueada (só harness).
- **Mural do CS:** colunas prontas de `get_cs_mural()`; registro só pelas RPCs `registrar_cs_conversa`/`concluir_cs_cartao`/`estacionar_cs_cartao`; reconcile e "Causa conhecida" no shard. Tela = um cartão por unidade (`juntarPorUnidade` em `lib/csMural.js`, 18/11/2026): 2+ abertos da mesma unidade viram o principal (raia mais urgente, depois o automático) com os outros em `extras`; o banco segue com cartões separados. → cs-admin, `docs/claude/customer-success.md`
- **Multi-unidade:** toda tela resolve por `resolveActiveFranchise(franchises, user, selectedFranchise)` (com 2+ unidades devolve `null` e a tela mostra `<FranchisePicker>`), nunca `managed_franchise_ids[0]`/`configs[0]`. Listagem SEM filtro de franquia vaza igual (a RLS libera as duas). `managed_franchise_ids` guarda UUID E evo da mesma unidade. Teste: `node src/lib/franchiseUtils.test.mjs`.
- **Excluir franquia:** `delete_franchise_cascade` (com `p_dry_run`); `evolution_instance_id` é reutilizado pela cidade. → cs-admin, `docs/claude/excluir-franquia.md`
- **Cupom:** WhatsApp da unidade só de `franchises.whatsapp_publico`, nunca `personal_phone_for_summary`. Cupom só grava pela `cardapio_configurar` e a regra mora no banco (`beneficio_validar`); `sales.desconto_origem` = cupom|promocao|fidelidade|cashback|manual. → historico-ondas, cardapio-e-canais
- **Cardápio digital (rede em autoatendimento desde 10/11/2026):** `/CardapioDigital` (`src/components/cardapio/`, `lib/cardapioDigital.js`); checklist, slug, adesão e emergência vêm do banco (`site/CLAUDE.md` § Cardápio digital). Até 3 promoções: banco, robô, cardápio e app vão SEMPRE juntos (`bots/vendedor/CHANGELOG.md` 12/11). Meu robô = como a unidade funciona; Cardápio = vender pelo link hoje. → [docs/claude/cardapio-e-canais.md](docs/claude/cardapio-e-canais.md)
- **Kit da promoção (19/11/2026):** preço só ABAIXO da soma dos itens; item extra (bolsa térmica, vinho, embalagem) vira produto do Estoque e entra no kit; item à escolha `{escolha, rotulo, opcoes, qtd}` conta pela opção mais cara. Regra no banco (`promocao_regra_erro`, `promocao_aplicar`) espelhada em `lib/promocaoRegras.js` (o teste compara). Cardápio: chave `cardapio_kit` ligada na rede, 2+ kits = carrossel. → [docs/claude/cardapio-e-canais.md](docs/claude/cardapio-e-canais.md)
- **Uso e erros da tela:** tela quebrada grava `erro_tela`/`erro_app` em `app_eventos` (desde 19/11/2026; `select detalhe,count(*) from app_eventos where evento in ('erro_tela','erro_app') group by 1`). `clique_sem_resposta` (coluna `alvo` = seletor CSS) mostra o que parece clicável e não é; dá falso positivo em `window.open` (cartão do Marketing) e em toque no vazio entre linhas do formulário de venda.
- **Categoria do Estoque = automática pelo nome e pela origem** (16/11/2026, `8fd2dd0`; mesma regra do cardápio digital): massa criada pela unidade fica em Outros; Pão de queijo/Queijo ralado só na TELA. 🔴 No banco grava só `Massas|Molhos|Outros` (`categoriaParaGravar`): o robô lê `category` e marca "Outros" como "sem descrição"; não normalizar a coluna sem eval do robô. ⏳ O campo "Categoria" automático do formulário não foi visto na tela (sem prévia sem login): abrir Estoque › Adicionar produto. ⏳ RPC `add_default_product` ("Novo produto padrão" do admin) insere na coluna `name`, que não existe em `inventory_items`: deve falhar ao chamar (não testado); produto novo da fábrica hoje vai por `insert` com `created_by_franchisee=false`.
- **Gerar cardápio** (Meu robô › Vendedor › Imagem do catálogo): regra em `lib/cardapioArte.js`, desenho em `lib/cardapioArteDesenho.js`; QR impresso desenhado módulo a módulo (14/11, Nova Odessa). ⏳ Provas da Giuliana e de Jaraguá em `app_eventos`. → cardapio-e-canais
- **Telemetria:** evento novo = `registrarEvento("nome")` de `src/lib/telemetria.js` (Clarity + `app_eventos`), nunca `window.clarity` direto. → frontend-ux
- **Features removidas: NÃO recriar** (Acompanhamento/health score, Relatórios, BotIntelligence, SmartActions, onboarding de 9 blocos, shadcn órfãos…). Lista: historico-ondas.

## Onde está o detalhe (ler o shard ANTES de mexer no assunto)
Comentário no código citando "CLAUDE.md § X" (ex.: Primeiros passos, Features Removidas): a seção está num destes arquivos, com o mesmo título — `grep -rn "X" docs/claude`.
| Assunto | Arquivo em `docs/claude/` |
|---|---|
| Schema, RLS, colunas, triggers, Management API, SQL pelo MCP, endereço fiscal | `supabase-schema.md`, `supabase-detalhes.md` |
| n8n, robô V4/V5, EnviaPedidoFechado, Meta CAPI | `n8n-bot.md` |
| Meu robô › Pagamento (matriz, Pix na entrega, Pix no cardápio) | `meu-robo-pagamento.md` |
| Vendas, DRE, KPI, Resultado por período, cópias na venda, NFC-e, ficha de separação, relatório do mês, ASAAS | `vendas-financeiro.md`, `sobrou-no-mes.md`, `modulo-financeiro-v2.md`, `asaas.md`, `impressao-termica.md` |
| Primeiros passos, Quem chamar hoje, Chamar Uber, Estoque/Reposição/pedido, UX, convites | `telas-franqueado.md`, `frontend-ux.md` |
| Marketing: resumo do mês, verba mensal × complemento | `marketing-verba.md` |
| Cardápio digital, cupom, promoções, Gerar cardápio, Canais de venda | `cardapio-e-canais.md` |
| Mural do CS, Unidades, Ficha, Sentinela, redesenho admin, excluir franquia | `cs-admin.md`, `customer-success.md`, `padrao-visual-admin.md`, `excluir-franquia.md` |
| Prévias sem login, prints a 390 px, fotos da Ajuda, manual PDF, guias | `previas-e-manual.md` |
| Telemetria, revisão de uso (Clarity), estoque baixo | `frontend-ux.md` |
| Auth: race conditions, convite, "não chegou o e-mail" | `auth.md` |
| Auditoria set/2026, ondas 4 e 5, features removidas | `historico-ondas.md`, `auditoria-2026-09.md` |
| Deploy: qual chunk grepar, smoke, casos, stack 39 | `deploy-verificacao.md` |
| NFC-e da unidade (só desenho, aguardando o Rafael) | `docs/plans/2026-10-06-nfce-unidades.md` |

## Auth (AuthContext.jsx)
- Ler `docs/claude/auth.md` ANTES de mexer em login/convite/senha. O mínimo: NUNCA `getSession()` dentro do `onAuthStateChange`; NUNCA `window.location.href` após signIn; `setIsLoading(false)` obrigatório no sucesso; convite = `user_metadata.password_set`; `resetPasswordForEmail` diz sucesso para e-mail inexistente.

## Frontend Patterns
- `mountedRef` + cleanup; `setIsLoading(false)` antes de early return. Loading = `<Skeleton>` (nunca spinner, nunca `fixed inset-0`).
- Lista do Supabase: sort explícito no front. Tabela que cresce: `fetchAll: true`, com janela (`gte`) quando houver polling; `limit N` vira teto calado. Sem `fetchAll` o Supabase corta em **1.000** calado: `contacts` em Vendas/Gestão cortava até 06/10/2026 (27 unidades acima; venda de cliente antigo saía com o nome do WhatsApp). Venda que "sumiu": `audit_logs` (`entity_id`, `action='delete'`, `user_name`).
- Datas: NUNCA `toISOString().split("T")[0]` (use `format(d, "yyyy-MM-dd")`); coluna DATE → `formatDateOnly`/`parseDateOnly` (`lib/dateOnly.js`); filtro TIMESTAMPTZ com `T00:00:00.000Z`.
- `useCallback` circular = tela branca; `useVisibilityPolling` no lugar de `setInterval`.
- Toast = `sonner`, nunca `alert()`/`window.confirm()`; `return` de validação sempre com `toast.error`.
- Rotas por `createPageUrl("X")`; deep-link admin `/Financeiro?tab=porunidade&franchise=<evolution_instance_id>`.
- `maxLength` em campo já populado: medir `MAX(LENGTH(col))` antes (+25–30%). Texto livre que vai pro prompt do bot: NULL > "Não temos".
- `pix_holder_name` NÃO mexer sem o franqueado (tem de bater com o titular da conta PIX).
- Dialog shadcn: NÃO remover `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)]`; alargar com `sm:max-w-*` (com prefixo).
- Componentes: shadcn/ui + Material Symbols Outlined. Ícone = `<MaterialIcon icon="name" />`, NUNCA Lucide direto. Fontes: Inter (body) + Plus Jakarta Sans (headings). Paleta: `#b91c1c` (primary), `#d4af37` (gold).
- NUNCA commitar credenciais. Testar mobile. Empty states obrigatórios.
- **TS LSP em `.jsx`** emite `implicit any` (TS7006) em parâmetro JS — pré-existente do strict do tsserver, NÃO causado pelo Edit. Ignorar se já existia antes da mudança.
- ⏳ **Jan/2027:** guia `pagamentos` (`guiasAjuda.js`) e manual dizem mensalidade R$ 150; trocar quando subir (220 ou 250, confirmar com o Nelson) e regerar o manual (`previas-e-manual.md`).

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
- 🔴 `VITE_*` nova no código = acrescentar no compose da stack 39 ANTES do deploy (o build roda dentro do container; o `.env` local não chega lá). Em 05/2026 a falta do `VITE_CAPI_MANUAL_TOKEN` silenciou 100% do CAPI manual.
