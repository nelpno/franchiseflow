# FranchiseFlow — Dashboard Maxi Massas

> Stack, paleta, ícones, fontes, scripts e regras gerais de deploy/n8n/RLS estão no CLAUDE.md raiz. Aqui só o que é do dashboard, uma linha por regra.
> O porquê, os casos e as provas estão em `docs/claude/` (tabela "Onde está o detalhe"); o texto inteiro de antes da faxina de 27/11/2026 está em `docs/claude/claude-md-antes-faxina-2026-11-27.md` ("§ Faxina 27/11"). Detalhe novo vai para o shard, não para cá.

## Comandos
```bash
npm run dev     # Vite :5173 — no Windows/OneDrive NÃO imprime o banner, mas sobe
npm run build   # só imprime `> vite build`: confiar em EXIT=0 + timestamp de dist/index.html (~10-20 s)
npm run lint:undef   # antes de deployar: o `npm run lint` tem no-undef DESLIGADO (símbolo não importado = tela branca)
npm run icons:check  # ícone fora do subset aparece como PALAVRA na tela
node src/lib/financialCalcs.test.mjs   # dinheiro (DRE, taxa repassada × absorvida)
node src/lib/franchiseUtils.test.mjs   # multi-unidade
npm run test:unit   # para no 1º que falha. Todos um a um: for f in $(grep -o 'node [^ &"]*' package.json | awk '{print $2}'); do node "$f" >/dev/null 2>&1 || echo "FALHA $f"; done
node .tmp/deploy.mjs                   # force update do serviço no Portainer (depois do push)
npx supabase functions deploy <nome> --project-ref sulgicnqqopyhulglakd [--no-verify-jwt] --yes   # SUPABASE_ACCESS_TOKEN = SUPABASE_MANAGEMENT_TOKEN do .env; asaas-billing: conferir antes com npx deno check index.ts
```
- ⏳ `src/lib/mensagemFranqueado.test.mjs` falha no "aviso de entrega (L3)" desde o guard de voz de 23/10 e para ali (os testes seguintes não rodam).
- Deploy = push → `node .tmp/deploy.mjs` → conferir pelo **conteúdo** no live (~75 s de 502). Push: `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main` (`git push` puro TRAVA). Prova: `git ls-remote origin main` = `git rev-parse main`. Qual chunk grepar: `deploy-verificacao.md`.
- ASAAS sem o painel: `select public.cron_sync_asaas_subscriptions();` e ler `net._http_response` (a service role do `.env` dá 401 na edge).

## Voltar atrás (emergência). Ordem: 1) chave → 2) front → 3) SQL → 4) n8n
1. **Chave** (`feature_flags`), pelo MCP `execute_sql`: rede `select public.set_feature_flag('<chave>', null, false, 'emergência: <motivo>');` · uma unidade `set_feature_flag('<chave>', '<evo>', false, '<motivo>')` · voltar a seguir a rede: `delete from feature_flags where key='<chave>' and franchise_id='<evo>';`. Front: `useFeatureFlag(FEATURE_KEYS.X)` (cache 5 min; erro = desligada); chave nova = linha + nome em `src/lib/featureFlags.js`; no SQL `feature_flag_enabled('<chave>', '<evo>')`.
2. **Front:** `git revert <sha>` (nunca `reset` em main publicado) → push → deploy → conferir que o texto novo SUMIU do chunk (o build é do `main` no GitHub).
3. **SQL:** todo `.sql` novo traz o `ROLLBACK` no cabeçalho; função alterada = backup do corpo vivo em `docs/db-backups/<função>.<data>-antes.sql` antes; aplicar por `node supabase/cs-cockpit/_aplica-lf.mjs` e conferir em consulta separada (`md5(prosrc)`).
4. **n8n:** backup JSON em `automation/backups/` antes de PUT; voltar = PUT do backup e conferir `active`.

## Stack & Deploy
- React 18 + Vite 6 + Tailwind 3 + shadcn/ui + Supabase Cloud + react-query 5. Stack Portainer 39, service `2zb27nndn5sg8zweyie6wscpc`, GitHub `nelpno/franchiseflow` (PÚBLICO).
- Stack 39 = `node:24-alpine` por digest que clona + `npm ci` + `vite build` a cada start; teto 2 GB (1 GB dá OOM); o `Dockerfile` do repo não é usado; prod dropa `console.log`.
- `.tmp/` é gitignored e tem segredo (`deploy.mjs`): nunca `git add -A`.
- jspdf-autotable v5: `autoTable(doc, opts)` por import dinâmico.
- `npm install <pacote>` APAGA o `puppeteer-core` das provas: depois, `npm install --no-save puppeteer-core@25.12.0`.

## Mapa do código (`src/`)
- `pages/` — 1 arquivo por rota (`createPageUrl("X")`→`/X`).
- `entities/all.js` — **camada de dados** (sempre importar daqui) · `entities/columns.js` — listas de colunas travadas.
- `lib/` — regras puras: `financialCalcs`, `formatters`, `dateOnly`, `stockSuggestion`, `salesExport`, `franchiseUtils`, `saveFiscalData`, `customerActions`, `safeErrorMessage`/`csvSanitize`/`safeHref`, `promocaoRegras`, `kitNaVenda`, `encomendas`, `creditoCliente`, `saidasEntrega`, `vales`, `networkOverview`, `telemetria`, `versaoVelha`.
- `components/minha-loja/` — telas do franqueado (TabResultado, TabLancar, TabEstoque, TabReposicao, SaleForm, PurchaseOrderForm, SaleReceipt, ExpenseForm) · `dashboard/` · `financeiro/` · `clientes/` (Quem chamar hoje) · `customer-success/` (Mural, Assessor) · `onboarding/` · `marketing/` · `vendedor/` (Meu Vendedor) · `cardapio/` · `ui/` (shadcn).
- `App.jsx` (rotas + `ADMIN_ONLY_PAGES`/`CsRoute`) · `Layout.jsx` · `lib/AuthContext.jsx` (auth, `selectedFranchise`).
- `supabase/` — migrations `.sql` + `functions/` (edges) · `docs/claude/` — shards deste arquivo.

## Regras que quebram produção (o shard tem o porquê)
- **Dados:** importar de `@/entities/all`, nunca `supabase.from()` (exceção: `.in()` em lote). Adapter IGNORA `filter:` (use `gte/lte`). Coluna nova em `columns` enxuto: conferir em `information_schema` e nos consumidores. → supabase-schema
- **Nomes que enganam:** `inventory_items.quantity/product_name`, `sale_items.unit_price`, `notifications.read`, `franchise_configurations.franchise_evolution_instance_id`, `bot_conversations.started_at`, `sales.contact_phone`, `franchises.phone_number`. → supabase-schema
- 🔴 **Endereço fiscal e ponto de retirada usam as MESMAS colunas** (`franchise_configurations.street_address/cep/city/neighborhood` + `franchises.address_number`). ⏳ Cadastro fiscal separado (Nelson, 26/09). → supabase-schema
- **RLS/SECURITY DEFINER:** view `security_invoker=true`; definer confere usuário no corpo + `revoke ... from public, anon`; helper como `(select fn())`; GET anon = 401; tabela nova após 30/10/2026 precisa `grant`. → supabase-schema
- **RPC com guard pelo MCP:** `with ctx as materialized (select set_config('request.jwt.claims', …)), h as materialized (…)`: os DOIS `materialized`, senão volta 0 linhas calado. Sem guard: `set_config('request.jwt.claims','{"role":"service_role"}',true)` na mesma chamada. → cs-admin
- **SQL:** `.sql` do Windows injeta `\r` (aplicar por `_aplica-lf.mjs`); `CURRENT_DATE` é UTC; `\b` no regex PG é backspace (use `\y`); `DROP TABLE` quebra plpgsql que cita a tabela; Management API com `$$`: SQL em arquivo. → supabase-schema
- **Dinheiro:** receita = `value − discount_amount + delivery_fee` via `getSaleNetValue`; taxa repassada ao cliente não é custo; "a receber" entra no Sobrou; `save_sale_with_items` ENUMERA colunas. 1º pedido da unidade (`purchase_orders.estoque_inicial`, marcado no INSERT) vira despesa `estoque_inicial`, fora do Sobrou. ⏳ Prova: 1º pedido real de sp23/guarulhossp1/sertaozinhosp com a marca e a despesa na entrega. → vendas-financeiro, sobrou-no-mes
- **Venda à mão nasce RECEBIDA** (`nasceRecebida`; Nelson 03/10, mantida contra pedido da Luzia; não reverter sem ordem dele); a do robô nasce a receber. Venda guarda CÓPIA de nome/telefone/endereço; "sumiu/nome trocado" = `audit_logs` (`entity_id`). → vendas-financeiro
- **Pedido à fábrica:** RPC idempotente `create_purchase_order_with_items`; preço = `preco_tabela_fabrica`; `entregue` é terminal e o "entregue" do admin fecha estoque e despesa na hora. Reposição = só catálogo padrão (`created_by_franchisee` falso) do `inventory_items` da própria unidade: produto novo da fábrica = linha em TODAS (`insert` com `created_by_franchisee=false` copiando de outra unidade; `add_default_product` está quebrada). Franqueada só OCULTA item da fábrica (`trg_guard_inventory_delete`) e não cria/renomeia produto próprio com nome da fábrica (`trg_guard_inventory_nome`). Item da fábrica renomeado vira "produto da fábrica" para a rede. → telas-franqueado, § Faxina 27/11
- **Lista em grade:** colunas `minmax(0,Nfr)` e a de ação em `rem` fixo (medir antes; Mensalidades = 21.5rem), nunca `auto`/`fr` puro.
- **Meu Vendedor/robô:** salvar só o que mudou (`configSave.js`); frete só pela RPC `salvar_frete_estruturado`; forma de pagamento nova toca 3 pontos no bot; NUNCA alterar `franchise_configurations` sem conferir o vendedor genérico. Pagamento: a matriz usa os mesmos termos que o robô lê (`__pagamentoFatos`); vales em `lib/vales.js`. ⏳ ~03/12: `vale_bandeiras` não nulo nas 10 que tinham só vale-refeição e 1ª venda `payment_method='food_voucher'`. → meu-robo-pagamento, n8n-bot
- **Entrega (cartão Entrega):** "Saídas fixas" (`promessa:"saidas"`), bairro com "Só em:" (`zonas[].dias`) e "Horário:" (`zonas[].inicio/fim`); parse em `lib/saidasEntrega.js`, ida e volta em `freteModelo.js` (unidade sem nada disso sai igual). Prévia: `.tmp/harness-s242/s-saidas.mjs`. ⏳ ~03/12: o robô não oferece a rota das 18h na quarta em Uberaba. → § Faxina 27/11
- **Onboarding:** papel nunca do metadado; `approved` só por `set_onboarding_status`; item por `set_onboarding_item`.
- **Marketing:** verba mínima R$ 200 fixa para todas, inclusive unidade nova (Nelson 24 e 27/11; rever em 2027). `marketing_payments.kind` = `mensal` (1/mês, o que a tela "pagou o mês?" lê) ou `complemento`. Nos últimos 5 dias do mês o mês-alvo já é o seguinte (`mesAlvoMarketing`): texto que cobra verba diz o mês. ⏳ Bug: editar verba PENDENTE com outro valor dá "Sem permissão". → marketing-verba
- **Régua da rede:** tudo em `src/lib/networkOverview.js`; mensagem à franqueada só por `mensagemFranqueado.js`. Sentinela avisa só os admins (`notify_admins`). → cs-admin
- **Quem chamar hoje:** regra só na RPC `get_daily_customer_actions`; a ordem dos motivos mora em dois lugares (`ordem_tipo` na RPC e `ACTION_ORDER` em `customerActions.js`, o teste trava); anti-disparo no front (textos variam, 3 min entre "Chamar"). ⏳ Prova: `contact_actions` `sent` da mesma unidade com ≥ 3 min entre si. → telas-franqueado
- **Chamar Uber** (`chamar_uber`): Edge `uber-link`, conta e preço da franqueada; no PC "chame pelo celular".
- **Multi-unidade:** toda tela resolve por `resolveActiveFranchise(franchises, user, selectedFranchise)` (2+ unidades = `null` + `<FranchisePicker>`), nunca `managed_franchise_ids[0]`/`configs[0]`; listagem sem filtro de franquia vaza. Unidade na tela = `nomeDaUnidade()`, nunca `city`.
- **Excluir franquia:** `delete_franchise_cascade` (com `p_dry_run`); `evolution_instance_id` é reutilizado pela cidade. → excluir-franquia
- **Features removidas: NÃO recriar** (Acompanhamento/health score, Relatórios, BotIntelligence, SmartActions, onboarding de 9 blocos, shadcn órfãos). → historico-ondas
- **Telemetria:** evento novo = `registrarEvento("nome")` de `lib/telemetria.js` (Clarity + `app_eventos`), nunca `window.clarity`.

## Funções recentes (uma linha; casos, prévias e provas no shard)
- **Encomendas** (`encomendas`, aba em Vendas, bloco no `PurchaseOrderForm`, cartão na Início): não mexem em estoque nem faturamento; só "Virou venda" baixa estoque. Regras `lib/encomendas.js`. ⏳ Prova: 1ª encomenda real, "Virou venda" baixando estoque e a encomenda virando `pedida` no envio (só vista por harness). → § Faxina 27/11
- **Crédito do cliente** (`credito_cliente`): `cliente_creditos` guarda só entradas; uso = `sales.credito_usado` DENTRO do `discount_amount`; saldo = view `cliente_credito_saldos`; trava `sales_credito_trava`; apagar entrada só por `cliente_credito_apagar`. Robô e cardápio não sabem (de propósito). SQL `supabase/2026-11-23-credito-cliente.sql`. ⏳ Prova: 1ª entrada real e o "Usar" com login de franqueada. → § Faxina 27/11
- **Kit da promoção:** preço só ABAIXO da soma; item extra vira produto do Estoque; item à escolha conta pela opção mais cara e no cardápio tem uma caixinha por unidade (27/11, `e92177d` na prévia). Regra no banco (`promocao_regra_erro`, `promocao_aplicar`) espelhada em `lib/promocaoRegras.js` (o teste compara). Brinde e "Leve N" até 30 produtos; kit até 6 itens. Prévia sem login: `.tmp/harness-s242/s-brinde.mjs`. → cardapio-e-canais
- **Kit na venda do app** (`KitNaVendaDialog`, regra `lib/kitNaVenda.js`): uma escolha por unidade, produtos como linhas comuns, desconto = soma − preço no Desconto com motivo `promocao`. ⏳ Prova: `app_eventos` `venda_kit` e a 1ª venda `desconto_origem=promocao` à mão. → § Faxina 27/11
- **Nova venda, busca de produto:** mostra a quantidade em estoque entre parênteses (27/11, Suzano) e "(sem estoque)" com zero.
- **Cupom:** WhatsApp da unidade só de `franchises.whatsapp_publico`; cupom grava só por `cardapio_configurar`, regra no banco (`beneficio_validar`); `sales.desconto_origem` = cupom|promocao|fidelidade|cashback|manual. ⏳ Prova: `app_eventos` `cardapio_cupom_copiado`.
- **Cardápio digital** (`/CardapioDigital`, `lib/cardapioDigital.js`): até 3 promoções; banco, robô, cardápio e app vão SEMPRE juntos. Meu robô = como a unidade funciona; Cardápio = vender pelo link. ⏳ Prova: `clique_sem_resposta` com alvo `span.inline-flex.min-h-11` sumir. → cardapio-e-canais
- **Canais de venda** (admin/CS; RPC `get_admin_canais_venda`): visita = 1 por aparelho por dia (sem id persistente no navegador, decisão do Nelson). ⏳ ~28/11: cron `cardapio-visitas-guardar` rodou e `cardapio_visitas` tem ontem. → cardapio-e-canais
- **Assessor do CS** (Edge `cs-assessor` com o JWT de quem pergunta, sem service role; propostas só pelo Confirmar): deploy `npx supabase functions deploy cs-assessor --project-ref sulgicnqqopyhulglakd --yes`. Relatório = `get_cs_relatorio_unidade` sobre `cs_rede_mes` (cron 07:40 UTC; refazer: `select cs_rede_mes_atualizar('AAAA-MM')`). Afinação: `cs-celso/assessor/afinacao.md`.
- **Mural do CS:** colunas de `get_cs_mural()`; registro só por `registrar_cs_conversa`/`concluir_cs_cartao`/`estacionar_cs_cartao`; a tela junta cartões da mesma unidade (`juntarPorUnidade`), o banco não. → customer-success
- **Categoria do Estoque** automática pelo nome e pela origem; 🔴 o banco grava só `Massas|Molhos|Outros` (`categoriaParaGravar`): o robô lê `category`; não normalizar sem eval do robô. ⏳ Campo "Categoria" automático não visto na tela.
- **Gerar cardápio** (Meu robô › Vendedor): regra `lib/cardapioArte.js`, desenho `lib/cardapioArteDesenho.js`. → cardapio-e-canais
- **Uso e erros:** tela quebrada grava `erro_tela`/`erro_app` em `app_eventos`; aba velha depois de deploy recarrega sozinha (`lib/versaoVelha.js`, grava `versao_velha`). `clique_sem_resposta` mede desde o `pointerdown` desde 24/11 (número de antes não se compara; falso positivo em `window.open`). ⏳ Prova: `erro_tela` com "default"/"dynamically imported" zerar depois do próximo deploy. ⏳ ~01/12: medir de novo o clique sem resposta. Jornada com dado real: `.tmp/ux-2026-11-24/`. → frontend-ux
- **Prévias sem login e fotos da Ajuda:** `.tmp/harness-s242/` (`s-*.mjs`, `?cenario=`); print com dado real não vai a grupo nem à Ajuda. → previas-e-manual

## Onde está o detalhe (ler o shard ANTES de mexer no assunto)
Comentário no código citando "CLAUDE.md § X": a seção está num destes arquivos, com o mesmo título (`grep -rn "X" docs/claude`).
| Assunto | Arquivo em `docs/claude/` |
|---|---|
| Schema, RLS, colunas, triggers, Management API, SQL pelo MCP, endereço fiscal | `supabase-schema.md`, `supabase-detalhes.md` |
| n8n, robô V4/V5, EnviaPedidoFechado, Meta CAPI | `n8n-bot.md` |
| Meu robô › Pagamento | `meu-robo-pagamento.md` |
| Vendas, DRE, KPI, Resultado, cópias na venda, NFC-e, relatório do mês, ASAAS | `vendas-financeiro.md`, `sobrou-no-mes.md`, `modulo-financeiro-v2.md`, `asaas.md`, `impressao-termica.md` |
| Primeiros passos, Quem chamar hoje, Chamar Uber, Estoque/Reposição/pedido, UX, convites | `telas-franqueado.md`, `frontend-ux.md` |
| Marketing: resumo do mês, verba | `marketing-verba.md` |
| Cardápio digital, cupom, promoções, kit, Gerar cardápio, Canais de venda | `cardapio-e-canais.md` |
| Mural do CS, Unidades, Ficha, Sentinela, admin, excluir franquia | `cs-admin.md`, `customer-success.md`, `padrao-visual-admin.md`, `excluir-franquia.md` |
| Prévias sem login, prints a 390 px, fotos da Ajuda, manual PDF | `previas-e-manual.md` |
| Auth: race conditions, convite, "não chegou o e-mail" | `auth.md` |
| Auditoria set/2026, ondas 4 e 5, features removidas | `historico-ondas.md`, `auditoria-2026-09.md` |
| Deploy: qual chunk grepar, smoke, stack 39 | `deploy-verificacao.md` |
| Texto inteiro de antes da faxina (encomendas, crédito, kit na venda, saídas fixas, pedido à fábrica, uso e erros: commits, casos, avisos à rede) | `claude-md-antes-faxina-2026-11-27.md` |
| NFC-e da unidade (só desenho) | `docs/plans/2026-10-06-nfce-unidades.md` |

## Auth (AuthContext.jsx)
- Ler `docs/claude/auth.md` antes de mexer em login/convite/senha. O mínimo: nunca `getSession()` dentro do `onAuthStateChange`; nunca `window.location.href` após signIn; `setIsLoading(false)` obrigatório no sucesso; convite = `user_metadata.password_set`; `resetPasswordForEmail` diz sucesso para e-mail inexistente.

## Frontend Patterns
- `mountedRef` + cleanup; `setIsLoading(false)` antes de early return. Loading = `<Skeleton>` (nunca spinner, nunca `fixed inset-0`).
- Lista do Supabase: sort explícito no front; tabela que cresce = `fetchAll: true` (sem ele o Supabase corta em 1.000 calado), com janela (`gte`) quando houver polling.
- Datas: nunca `toISOString().split("T")[0]` (use `format(d, "yyyy-MM-dd")`); coluna DATE → `formatDateOnly`/`parseDateOnly`; filtro TIMESTAMPTZ com `T00:00:00.000Z`.
- `useCallback` circular = tela branca; `useVisibilityPolling` no lugar de `setInterval`.
- Toast = `sonner`, nunca `alert()`/`window.confirm()`; `return` de validação sempre com `toast.error`.
- Rotas por `createPageUrl("X")`; deep-link admin `/Financeiro?tab=porunidade&franchise=<evolution_instance_id>`.
- `maxLength` em campo já populado: medir `MAX(LENGTH(col))` antes (+25–30%). Texto livre que vai pro prompt do bot: NULL > "Não temos".
- `pix_holder_name` não mexer sem o franqueado.
- Dialog shadcn: NÃO remover `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)]`; alargar com `sm:max-w-*`.
- Ícone = `<MaterialIcon icon="name" />`, nunca Lucide. Fontes Inter + Plus Jakarta Sans. Paleta `#b91c1c` / `#d4af37`. Empty states obrigatórios; testar mobile.
- TS LSP em `.jsx` emite `implicit any` (TS7006): pré-existente, ignorar.
- ⏳ **Jan/2027:** guia `pagamentos` (`guiasAjuda.js`) e manual dizem mensalidade R$ 150; trocar quando subir (confirmar valor com o Nelson) e regerar o manual (`previas-e-manual.md`).

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
- 🔴 `VITE_*` nova no código = acrescentar no compose da stack 39 ANTES do deploy (o build roda no container; o `.env` local não chega lá).
