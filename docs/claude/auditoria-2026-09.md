# Auditoria set/2026 — ondas 0 a 6

> Texto original do CLAUDE.md do dashboard, sem edição — mudou de arquivo em 11/09/2026 para o CLAUDE.md caber no contexto. As regras de bolso continuam lá.

## Auditoria 07/09/2026 — o que mudou (ondas 0 a 3)

> Relatórios completos em [docs/auditoria-2026-09/](../../docs/auditoria-2026-09/) (6 frentes + consolidado).
> Aqui só os fatos que mudam decisão em sessões futuras.

### 🔴 A stack de produção NÃO usava o `nginx.conf` do repo — agora usa um equivalente
Até 07/09 a stack 39 escrevia um nginx de 8 linhas por `echo`: **sem gzip e sem
`Cache-Control`**. Medido no live: **2.226.597 bytes crus, 0% comprimido**. O compose agora
escreve a config por heredoc, com `gzip on` nível 6, `/assets` `immutable` 1 ano, `index.html`
`no-store` e 4 headers de segurança — mais `nginx -t` com **fallback** para a config mínima, para
que um erro de sintaxe não derrube o site. Caminho crítico: **2.226.597 → 248.411 bytes (−88,8%)**.
Conferir depois de qualquer mexida na stack:
`curl -sID -H 'Accept-Encoding: gzip' https://app.maximassas.tech/assets/index-*.js | grep -iE 'content-encoding|cache-control'`.
⚠️ O `Dockerfile` + `nginx.conf` do repo continuam **não sendo usados** pela stack (ela faz
`git clone` + `npm ci` + `vite build` no entrypoint — daí os ~75 s de 502 por deploy).

### `manualChunks` TEM de ser função, nunca objeto
Na forma objeto o Rollup aloja no chunk manual também os módulos compartilhados que ele "toca
primeiro": o `__vitePreload` caiu dentro de `export` (jspdf+xlsx, 856 KB) e o `clsx` do `cn()`
dentro de `recharts` (415 KB) — tornando **os dois import ESTÁTICO do chunk de entrada**. O
franqueado baixava 1,27 MB de PDF e gráficos para abrir a tela de vender. Verificação: o
`dist/index.html` só pode ter `modulepreload` de `vendor/supabase/dates/ui`.

### Guarda contra tela branca: `npm run lint:undef`
`no-undef` e `react/jsx-no-undef` estão apagados no `eslint.config.js` (o bloco `rules:`
sobrescreve o do `recommended`). `eslint.strict.config.js` liga só essas duas sobre `src/`
inteiro — inclusive `ui/`, `App.jsx` e `pages.config.js`, que o lint normal ignora.
`npm run verify:undef` prova a guarda com arquivo-canário (0 erros tanto pode ser código limpo
quanto regra desligada). **Ela já pegou um caso real no mesmo dia**: um `formatBRL` não importado
no `AsaasSetupPanel` que passava no build E no lint normal e deixaria o Financeiro em branco.

### RLS: helpers uma vez por query, e trava de escalonamento
- `conv_msg_select`, `bot_conv_select` e `bot_conv_update` passaram a usar `(select fn())`. As
  funções são STABLE e rodavam **uma vez por linha** em 213 mil linhas. ⚠️ `franchise_id = any
  ((select managed_franchise_ids())::text[])` — sem o cast o Postgres lê a subquery como conjunto
  de linhas e dá `operator does not exist: text = text[]`.
- 🔴 **`profiles_update` e `marketing_payments_update` tinham `WITH CHECK` nulo** — quando omitido,
  o Postgres reusa o `USING`, e "a minha linha" continua minha depois de eu virar admin. Provado
  executando como franqueada real: `role='admin'` passava, anexar unidade alheia dava acesso a 12
  vendas de outro dono, e `status='confirmed'` auto-aprovava a própria verba. **Policy não resolve**
  (WITH CHECK não vê OLD) e `REVOKE` por coluna quebraria o admin, que também é `authenticated`:
  a trava são os triggers `trg_guard_profile_privilege_columns` e
  `trg_guard_marketing_payment_approval`.
- **50 → 21 funções SECURITY DEFINER expostas a `anon`.** 🔴 NUNCA revogar de `anon` os helpers
  `is_admin`/`is_admin_or_manager`/`is_cs_or_admin`/`managed_franchise_ids`: as policies os chamam
  no contexto de quem lê, e sem `EXECUTE` o deslogado recebe **500 em vez de zero linhas**.

### `daily_summaries.conversion_rate` era `numeric(5,2)` e derrubava o cron inteiro
Teto 999,99. Uma unidade com 11 vendas e 1 contato dá 1100% → `numeric field overflow` mata a
execução de **todas** as franquias do dia. Falhou em 26/07, 30/07 e 07/09; a série ficou parada em
05/09 e o ranking de 7/30 dias do Painel perdeu os dias. Agora `numeric(8,2)` + `LEAST`. A coluna
tem **zero consumidores** no app. Reprocessar dia faltante: `select aggregate_daily_data('AAAA-MM-DD')`.

### RPCs novas
`get_franchise_bot_pulse(franchise_id)` (última conversa + 7d, 0,6 ms — duas subqueries de
propósito; um agregado único sobre a unidade custa 297 ms) · `get_human_message_totals` (agrega por
franquia; a antiga `get_human_message_counts` devolvia 1 linha por conversa e o PostgREST **cortava
em 1.000**, truncando o alerta calado) · `get_cs_franchise_contacts` (dono + telefone do CS) ·
`sentinela_diaria` + `sentinela_marketing_duplicado`.
⚠️ `get_bot_conversation_summary` tinha um CTE varrendo as **938 mil** linhas de
`conversation_messages` sem filtro de data: 12,6 s. Com a janela + o índice
`idx_conv_msg_human_conv (created_at, conversation_id) where direction='human'` virou index-only e
caiu para ~66 ms. **EXISTS correlacionado foi testado e é PIOR (38 s, 115 mil loops).**

### `supabase.rpc()` resolve a promise mesmo com erro
O erro vem em `{ data, error }`. Sem desembrulhar, `Promise.allSettled` marca como *fulfilled*, o
código faz `?.data || []` e a tela mostra **card vazio em vez de erro** — foi assim que as 3 RPCs de
bot ficaram em HTTP 500 por 24 h sem ninguém ver. O `AdminDashboard` tem um helper `rpc()` que lança.

### Sentinela diária (`pg_cron` 08:10 BRT, jobid 5)
Cron que falhou · `daily_summaries` sem o dia anterior · franquia que vende todo dia e parou 2+ dias ·
marketing duplicado · unidade ativa sem cobrança · pedido da semana sem frete → `notify_admins()`.
Desligar: `select cron.unschedule('sentinela-diaria')`. Ver sem gravar: rodar dentro de um `DO` que
termina em `raise exception`.
⚠️ **Regra de alarme nasce errada com facilidade**: "2+ despesas de marketing no mês" parecia certo e
é LEGÍTIMO (verba do Meta + panfleto) — acusou 3 franquias corretas na 1ª execução. A assinatura de
duplicata real é **mesmo valor + um manual + um automático**. Alarme falso diário treina a pessoa a
ignorar a sentinela inteira.

### Franqueado: "robô ativo" agora significa que ele CONVERSOU
`botActive` era `!!(franchiseConfig && evoId)` — "existe linha de config", nunca ficava falso.
Medido em 07/09: **8 franquias vendendo com o robô sem uma conversa há 7+ dias** viam "Tudo em dia!".
Agora sai de `get_franchise_bot_pulse`, com cenário `bot_parado` no `PriorityAction` e guarda
`hasRecentSales` para não alarmar unidade em implantação.

### Outros fatos medidos que mudam decisão
- **`daily_checklists` nunca teve uma linha na vida** e a home do franqueado a consultava em todo
  load e todo poll (576 req/dia por nada). Query removida; a página `MyChecklist` é rota sem link.
- **Tour de boas-vindas**: "não tem linha de checklist" ≠ "precisa de onboarding". 57 das 67 ativas
  não têm linha, e **todas as 57 têm mais de 30 dias**. Como a decisão se apoiava só em
  `localStorage`, todo celular novo jogava franqueada veterana nas 7 telas. Agora exige unidade
  criada há menos de 30 dias.
- **`delivery_fee_rules` está preenchida em 61 das 67** e só o robô lia. 622 entregas em 90 dias
  saíram com frete R$ 0 (frete é receita no DRE). `lib/deliveryFeeRules.js` transforma em chips;
  **não adivinha valor** — a venda manual não sabe a distância, então só preenche com 1 opção.
- **`system_subscriptions`**: franquia SEM LINHA aparecia como travessão neutro (é o pior caso — o
  cron de sync nunca a vê). E "PENDING" era o mesmo badge de quem venceu há 30 dias. Fonte única:
  `lib/subscriptionStatus.js`.
- **Comparativo mês a mês**: no mês CORRENTE o mês anterior tem de ser cortado no mesmo dia, senão
  todo dia 2 a rede inteira aparece "em queda".
- **Telefone da franqueada**: `franchises.phone_number` está vazio em **67 de 67**;
  o número que presta é `franchise_configurations.personal_phone_for_summary` (62 de 67).
- ⚠️ **RESOLVIDO em 08/09/2026 para a `get_franchise_health_signals`** (o aviso abaixo valia até
  então e CONTINUA valendo para o `reconcile_cs_auto_tasks`): o fonte que roda em produção agora
  está versionado em `supabase/cs-cockpit/10-health-signals-PRODUCAO-2026-09-08.sql` — é o
  `pg_get_functiondef` da função viva, byte a byte, com paridade provada. Alterar o radar deixou
  de ser proibido: parta do `10-*.sql`, não do `09-*.sql`. O aviso original: o `09-*.sql` do repo
  é mais velho e um `CREATE OR REPLACE` com ele **regride o radar do Celso** (perde `giro_baixo`,
  `marketing_late`, `cs_agreements`, cooldown, `parked_until`). O `reconcile_cs_auto_tasks`
  segue sem fonte versionado — por isso o cron dele é um invólucro, não um replace.
- ~~**`productWeight.test.mjs` tem ZERO asserts**~~ — **falso, medido na onda 5**: ele tem 16
  verificações com um `eq()` próprio no lugar do `node:assert`, e sai com código 1 quando falha.
  O problema real era outro: três arquivos de teste que verificam de verdade estavam fora do
  `npm run test:unit`. Hoje a suíte roda 10 arquivos.

## Onda 4 da auditoria — 07/09/2026 (noite): o que mudou de fato

> Detalhe e numeros em [docs/auditoria-2026-09/ESTADO-2026-09-07-ONDA4.md](../../docs/auditoria-2026-09/ESTADO-2026-09-07-ONDA4.md).
> Aqui so o que muda decisao numa sessao futura.

### RLS: helper de policy SEMPRE dentro de (select fn())
As 91 policies que faltavam foram reescritas. `is_admin()`, `is_admin_or_manager()`,
`is_cs_or_admin()` e `managed_franchise_ids()` escritos crus rodam UMA VEZ POR LINHA.
Medido como franqueado real: a soma de 10 consultas caiu de **2.324 ms para 91,5 ms**
(Vendas 554 -> 13 ms, contatos 746 -> 33 ms). Policy nova nasce com o wrap, e
`franchise_id = any((select managed_franchise_ids())::text[])` — **sem o cast `::text[]`**
o Postgres le a subquery como conjunto de linhas e da `operator does not exist: text = text[]`.

### A fonte de icones e um SUBSET self-hosted — nao mexa sem rodar a guarda
O Google servia a familia inteira: **1.130.004 bytes em todo boot** para 219 nomes usados.
Agora sao **28.748** (`src/assets/material-symbols-subset.woff2`, so o eixo FILL variavel,
`font-display: block`). Icone que nao estiver no subset NAO some — aparece como a PALAVRA.
`npm run icons:check` entra no pre-deploy (ja reprovou 2x no mesmo dia); `npm run icons:build`
regera fonte e lista. A rede de deteccao e larga de proposito (qualquer string do src que
seja nome valido do catalogo) porque ha **103 usos dinamicos** `icon={cfg.icon}`.

### 30,5% da receita vem de anuncio — e agora tem tela
`contacts.ctwa_clid`/`meta_ad_id` em 38.612 dos 57.096 contatos. Marketing > Investimento
mostra o retorno por unidade (`get_marketing_attribution`, 65 ms). Agosto: R$ 122.677
atribuidos sobre R$ 24.983 liquidos = **4,9x na rede**; Osasco 11,7x, Vila Maria 4,1x.
⚠️ A RPC devolve so o BRUTO: a taxa do Meta vive em `MARKETING_TAX_RATE` no front e nao
pode passar a existir em dois lugares. E `campaign_name` esta vazio em 100% dos contatos —
da para dizer "veio de anuncio", nunca "de qual campanha".

### Aba Fechamento no Financeiro
`get_fechamento_mensal(p_month)` devolve, por unidade: faturamento, delta vs mes anterior,
lucro em caixa, vendas sem baixa, verba e mensalidade. **O lucro e copia fiel de
`calculatePnL`** — inclusive taxa repassada nao ser custo. Se divergir, a conversa de
fechamento vira discussao sobre qual numero esta certo. No mes corrente o anterior e
cortado no mesmo dia, e unidade com "teste" no nome fica de fora.

### Paginacao do entity layer agora CRESCE (1, 2, 4, 6)
`paginateAll` saiu para `src/lib/paginateAll.js` (8 testes, incluindo varredura de 0 a 350
linhas provando que nada duplica nem some). Disparava 6 paginas de uma vez: 1.079 vendas
custavam SETE requisicoes. Gestao > Resultado caiu de **42 para 21 requisicoes** com os
mesmos numeros na tela.

### Um sino so, e cache de franquias
O Layout monta DOIS `NotificationBell` (topo desktop + mobile) e o AdminDashboard um
terceiro: eram 2 buscas identicas por carregamento, de 2 em 2 minutos. Agora ha um store
(`src/lib/notificationsStore.js`), colunas enxutas e 5 min — 60 -> 12 requisicoes/hora por
aba. Mesma historia com a lista de franquias: vinha 2x por carregamento, 32.447 bytes cada
(`src/lib/franchisesCache.js`, TTL 60 s). **Mutacao em Franqueados invalida o cache** —
sem isso a franquia recem-criada nao apareceria por ate um minuto.

### Cores em token
`tailwind.config.js` tem `brand`, `ink`, `surface`, `ok`, `warn`, `err` com os hex que ja
dominavam. 2.342 hex crus viraram token e 148 variacoes acidentais sumiram (4 vermelhos de
marca, 2 pretos de texto, 3 cinzas). Codigo novo usa `text-ink-2`, `bg-brand/10`. ⚠️ O
verde de texto `#16a34a` reprova AA (3,30:1) — o token `ok.ink` (#15803d) existe e ainda
NAO foi aplicado.

### Apagados: nao recriar
`MyChecklist` + `components/checklist/` + tabela `daily_checklists` (ZERO linhas na vida) ·
`optimizeConfig`, `getWhatsAppMessages`, `analyzeLead`, `generateSalesReportsAI` ·
4 indices com 0-14 leituras em 7 meses (41 MB) · 6 tabelas de backup (exportadas em
`docs/db-backups/*.json`) · `dist/` saiu do versionamento.
⚠️ As 6 RPCs "sem consumidor" do relatorio **continuam vivas de proposito**: sem consumidor
ali quer dizer sem consumidor no DASHBOARD, e o n8n tambem chama RPC.

### Tres armadilhas de ferramenta que custaram tempo hoje
- 🔴 **A Management API do Supabase devolve o ultimo resultset NAO-VAZIO**, nao o do ultimo
  statement: com `set local role` + `set_config` + consulta vazia, voce recebe a linha do
  `set_config` e acha que veio dado. Fechar em `select coalesce(json_agg(t),'[]'::json)`.
- 🔴 **Heredoc de shell come a barra**: `"\b"` num `cat <<'EOF'` chega como `""`, que em
  JS e BACKSPACE — a regex nunca casa, calada. Usar lookahead sem escape, ou gerar o
  arquivo por Python/Write.
- **`TabResultado` tem chunk proprio** (`TabResultado-*.js`), nao vive no chunk de `Gestao`:
  verificar deploy por conteudo no chunk certo.

### Telas franchiseeOnly: da para testar, com usuario de teste
Criar pela Auth Admin API + escrever `profiles` (`role`, `managed_franchise_ids`), e apagar
no fim. Para ver tela de admin, promover e reverter — `guard_profile_privilege_columns`
deixa passar quando `auth.uid()` e nulo (service_role). **Reload completo obrigatorio depois
de trocar o papel**: a navegacao SPA fica com o perfil antigo em memoria.

## Onda 5 da auditoria — 08/09/2026: o que mudou de fato

> Detalhe e numeros em [docs/auditoria-2026-09/ESTADO-2026-09-08-ONDA5.md](../../docs/auditoria-2026-09/ESTADO-2026-09-08-ONDA5.md).
> Aqui so o que muda decisao numa sessao futura. 10 dos 11 itens em producao (21/21 provas
> no live); o item 8 (defaults de `ui/`) esta num canvas com o Nelson, esperando decisao.

### 🔴 RPC tambem bate no teto de 1.000 linhas do PostgREST — e cala
`get_bot_conversation_summary` devolve **4.089 linhas** (63 franquias x ~65 dias) e a tela
recebia **1.000**. Sem `limit`/`offset` a resposta so chega curta, sem erro nenhum: o card
"Performance Bot" somava um quarto da rede (1.603 conversas; o certo sao 7.244) e o alerta de
robo parado acusava 13 quando eram 8. **Toda RPC que devolve linha por franquia-dia e
candidata** — das 3 do painel so essa passa de 1.000 (`get_human_message_totals` tem 62,
`get_bot_leads_daily` 92). E a mesma armadilha que a onda 4 corrigiu na RPC irma
`get_human_message_counts`; esta ficou.
Ao paginar RPC, dois fatos medidos contra a producao:
- **`Range:` como CABECALHO nao pagina RPC** — 12 paginas voltaram as MESMAS 1.000 linhas.
  Quem pagina e `limit`/`offset` na URL, que e o que o `.range()` do postgrest-js escreve.
- **ORDER BY explicito e obrigatorio**: a funcao nao ordena, e sem `.order()` seria o bug
  5333224 de novo. Com `(franchise_id, day)` — a chave do `group by` — 4.090 linhas e 4.090
  chaves distintas, zero duplicada.

### O endereco da entrega: quem escreve, e o no-op que engolia
Medido: **4.362 de 6.539 entregas (66,7%)** dos ultimos 90 dias sem endereco em lugar nenhum.
O relatorio dizia que "quem escreve e so o robo" e **isso e falso**: o trigger
`sales_fill_customer_snapshot` JA copia `contacts.endereco/bairro` para a venda, e 1.393 das
2.001 vendas com endereco sao manuais, vindas dai. O buraco e antes — so 1.805 dos 5.526
contatos com entrega tem endereco, porque o `SaleForm` nunca pediu um. Agora pede em entrega,
pre-preenche pelo contato e grava **na venda e no contato**.
🔴 **`save_sale_with_items` ENUMERA as colunas que grava**: `customer_address` e
`customer_neighborhood` nao estavam la, entao mandar os campos era **no-op silencioso** — a
venda salvava "com sucesso" e o endereco sumia. Vale para qualquer coluna nova em `sales`:
adicionar na tabela nao basta, tem de entrar na RPC. Versionado em
`supabase/2026-09-08-save-sale-with-items-endereco.sql`, com os 6 comportamentos provados em
transacao abortada. A chave so e considerada quando VEM no `p_sale_data`, entao venda de
retirada nao apaga endereco ja gravado.

### Verde de TEXTO: `text-ok` e so para icone
`#16a34a` da **3,30:1** no branco e **2,96:1** dentro do proprio chip `bg-ok/10` — reprova AA
(4,5:1) nos dois. O token `ok.ink` (`#15803d`) da 5,02:1 e 4,50:1. Trocado em 54 classes +
9 hex crus. **`text-ok` continua valendo para `<MaterialIcon>`**: objeto grafico mede contra
3:1 (WCAG 1.4.11) e 3,30 passa. Codigo novo com verde de TEXTO usa `text-ok-ink`.

### Alertas leves no topo do Painel, e a regra unica
"Parou de vender" e "robo parado" saem de `allSales` e `botSummary`, que ja estao em memoria —
custam **zero requisicao**. Antes so existiam dentro da secao "Alertas", colapsada no fim, cuja
abertura busca os 31 mil contatos. A regra vive em `lib/alertasLeves.js` (9 testes) e o
`AlertsPanel` chama a MESMA funcao — nao ha copia. As duas decisoes que sao faceis de errar
depois estao travadas por teste: quem NUNCA vendeu nao entra em "parou de vender" (implantacao
nao e queda) e quem NUNCA teve conversa nao entra em "robo parado".
⚠️ `bot_conversations` tem `franchise_id` **fantasma** (`helpcell`) que nao existe em
`franchises`: contar direto na RPC da 9 robos parados, a tela cruza com a lista e mostra 8.

### O reconcile do CS agora tem cron (job 6, 08:15 BRT)
`reconcile_cs_auto_tasks()` so rodava quando alguem abria a pagina — estava **4,4 dias**
parada e devia 6 cartoes. 🔴 A funcao de producao **nao foi tocada** (md5 do `prosrc` conferido
antes e depois): o que entra e o involucro `cron_reconcile_cs_auto_tasks()`, que planta
`request.jwt.claims` com um admin real antes de chamar — sem isso o guard `is_cs_or_admin()`
barra em SILENCIO, devolvendo zero linha em vez de erro. Rollback:
`cron.unschedule('reconcile-cs-auto-tasks')` + drop do involucro.

### Erros silenciosos no registro de venda
Em 90 dias: **39 vendas manuais a R$ 0**, **73 com pelo menos uma linha a R$ 0** (126 linhas) e
**183 sem contato nenhum** — todas com "Venda registrada!" e nenhum aviso. Agora o valor zerado
abre lembrete nomeando o produto sem preco (**nao bloqueia** — existe cortesia), e quando
`resolveContactId` devolve null com nome digitado a franqueada e avisada de que o cliente nao
foi vinculado.

### Peso do lote nos Pedidos
`purchase_orders.total_weight_kg` era gravado desde 01/07 e **nenhuma tela lia** — so a ficha de
separacao. Card "Lote em aberto" + coluna Peso: 23 pedidos, R$ 64.483, 2.386 kg = 2 rotas de
1.500 kg. Le a lista INTEIRA, nao a filtrada. ⚠️ O `CLAUDE.md` da logistica ainda diz
"total_weight_kg hoje 0/215" — **esta velho**: os 22 pendentes tem peso, historico 170/385.

### Tipografia: o problema nao estava nas tabelas
Varredura de `getComputedStyle` em 430 px, tela por tela: no Estoque **152 de 247** numeros ja
estao em 14 px e no Vendas **87 de 91** em 16 px — nao ha densidade de tabela em risco, ao
contrario do que o relatorio dizia. O que resta abaixo de 14 nas tabelas e **exclusivamente
`<Badge>`** (11 px), que e a decisao do item 8. O unico alvo real era o **DRE do franqueado**:
17 numeros de dinheiro em 12 px, incluindo "Entrou" e "Saiu" em negrito. Subiram para 14 px o
que RESUME o resultado; as sub-linhas (`└ Vendas`, `└ Frete`) e os % de participacao ficam em
12 px de proposito, para nao achatar a hierarquia.

### Cache de franquias virou react-query
`listarFranquias()` mantem a assinatura (promessa de array, 13 call-sites intocados) mas quem
guarda e o `queryClientInstance.fetchQuery` — o cliente e singleton de modulo, entao roda fora
de React. A chave `["franquias"]` passa a existir: componente novo faz
`useQuery({queryKey: ["franquias"]})` e reaproveita. **A copia do array na saida FICA** e agora
importa mais — a referencia devolvida e a que vive DENTRO do cache, e varias telas ordenam no
lugar.

### `npm run test:unit` tem 10 arquivos, e reprova de verdade
`deliveryFeeRules`, `productWeight` e `subscriptionStatus` verificavam e **nunca rodavam**.
(O relatorio dizia que `productWeight.test.mjs` tem zero asserts — tem 16 verificacoes com um
`eq()` proprio; o grep procurou `assert.` e nao achou o helper.) Provado com canario: divisor
1000→1001 em `productWeight.js` reprova com rc=1; restaurado, rc=0.

### Tres armadilhas de ferramenta desta rodada
- **`franchises.status` e `'active'`, nao `'ativo'`** — duas consultas voltaram VAZIAS por isso,
  sem erro. Confirmar valor de coluna de status antes de filtrar por string.
- 🔴 **`current_date` e UTC no Supabase** (o `CLAUDE.md` ja dizia, e mordeu assim mesmo): as 21h
  de Brasilia o banco ja virou o dia, e "8 unidades sem vender" viraram 5 quando medido em data
  local. Em qualquer contagem de "dias desde", usar
  `(now() at time zone 'America/Sao_Paulo')::date`.
- **`npm run icons:check` reprova por CRASE em comentario**: `Usa \`orders\`` num comentario JSX
  acusou `orders` como icone fora do subset. A rede e larga de proposito (103 usos dinamicos
  `icon={cfg.icon}`) — reescrever o comentario e o conserto, nao afrouxar a regra.
- **`SaleForm` cai no chunk de ENTRADA** (`index-*.js`), nao em `Vendas-*.js`. Verificar deploy
  por conteudo no chunk certo.

## Onda 6 — 08/09/2026: os números que mentiam sem estar errados

> Veio de duas perguntas do Nelson sobre o mural do CS e o comparativo do Financeiro.
> Detalhe em [docs/auditoria-2026-09/ESTADO-2026-09-08-ONDA6.md](../../docs/auditoria-2026-09/ESTADO-2026-09-08-ONDA6.md).

### 🔴 Limiar de alarme colado na mediana faz metade da rede piscar
O sinal "Faturamento −X%" do Radar tinha gatilho **fixo em −10%**. A mediana da rede, medida no
mesmo dia, era **−10,3%**: por construção, metade das unidades cruzava o limiar — não por estarem
mal, por serem a metade de baixo. Resultado: 23 das 46 comparáveis com bandeira e **55 das 67
(82%) da rede em crítica ou atenção**. Agora o gatilho é `least(-10, mediana − 15)` e o rótulo
carrega a referência: *"Faturamento −62.0% (rede −10.3%)"*. Críticas 18 → 14.
**A lição vale para todo alarme novo**: antes de fixar um limiar, medir onde está a mediana da
população — se o limiar cair perto dela, o alarme não distingue nada.

### O comparativo "vs mês ant." do Financeiro está CERTO — o que suja é o dado
Conferido contra o banco: quando o mês é corrente, o anterior É cortado no mesmo dia (onda 4). A
prova barata está na própria tela — se comparasse 7 dias contra 31, a rede inteira estaria
vermelha; havia 6 subindo e 3 caindo. **O que distorce são 3 vendas de Vila Maria datadas
30/09/2026** (digitadas em 25/06, 07/08 e 19/08 — erro de mês): inflam setembro em R$ 1.279,80 e
fazem a tela mostrar **▼18% onde o real é ▼30%** — escondendo uma queda pior, não inventando uma.
São as únicas da rede; o trigger `sales_bloqueia_data_futura` foi criado depois delas. Lista para
a franqueada e SQL de correção em `docs/auditoria-2026-09/vila-maria-3-vendas-data-errada.md`.
**Ao investigar comparativo suspeito, cheque `max(sale_date)` antes de acusar o cálculo.**

### Percentual precisa de piso no denominador
"Menor Margem −5657,8%" eram **R$ 80 de venda contra R$ 4.606 de despesa** — unidade que comprou e
ainda não vendeu, num mês de 7 dias. Não é margem, é denominador. O card agora exige **R$ 2.000**
de faturamento no período (`PISO_MARGEM_COMPARAVEL` em `Financeiro.jsx`), o **mesmo piso** que a
`get_franchise_health_signals` já usa para calcular delta — um piso só no ecossistema. Com ele o
card aponta Santos (−106,8%), que é caso real. O subtítulo passa a mostrar o faturamento ao lado
do percentual, para o número nunca aparecer sem a base.

### 🔴 Trava de validação nasce larga demais — meça quantos LEGÍTIMOS ela pega
O trigger `sales_bloqueia_data_futura` foi criado em 07/09/2026 para pegar 3 vendas datadas
30/09 (erro de mês) e recusava **qualquer** data futura. Medido no dia seguinte, em 180 dias:
**663 vendas de 30 franquias** cairiam nele — 628 até 7 dias à frente, **455 exatamente
"amanhã"**. Não era engano: metade da rede lança a venda com a data da ENTREGA para o pedido
ficar no topo da lista do dia certo. A cauda de erro real só começa em ~14 dias (16 casos: 31,
37, 42, 54, 66, 97 dias). Hoje é **janela de 14 dias**
(`supabase/2026-09-08-sales-data-futura-janela-14-dias.sql`). **A conta antes de subir qualquer
validação nova é essa: quantas linhas históricas ela reprovaria, e quantas delas são o uso
normal?** Apareceu por 3 áudios da franqueada do Guarujá, não pelo log — que já registrava o
mesmo em Cajamar dois dias antes.

### A mensagem do trigger só chega na tela se o errcode estiver mapeado
`23514` não estava no `CODE_MAP` do [safeErrorMessage.js](../../src/lib/safeErrorMessage.js): o
trigger explicava em português claro e a franqueada via *"Erro inesperado. Tente novamente."*
Agora há `PREFIXOS_SEGUROS` — whitelist de prefixo, porque devolver a mensagem crua de um
`23514` qualquer vazaria `violates check constraint "sales_value_check"`. **Trigger novo cuja
mensagem é para o usuário ler precisa do prefixo cadastrado lá**, senão o texto morre no
fallback genérico.

### `ehErroDeRegra()`: o que NÃO se retenta
Erro de regra (23xxx, 42501, P0001) não muda em 2 s nem em 4 min. O `withRetry` do `SaleForm`
retentava mesmo assim — foi assim que **8 cliques da franqueada de Cajamar viraram 24 POSTs**,
com dois toasts "Tentando novamente em 2s…" por rodada. Todo retry de escrita consulta
`ehErroDeRegra` antes de repetir, e o `catch` mostra o MOTIVO em vez de "não foi possível
salvar" — mensagem que manda a pessoa repetir o que nunca vai passar.

### 🔴 Aplicar `.sql` do Windows injeta `\r` DENTRO da função
Medido: aplicar o arquivo com CRLF fez o Postgres guardar **246 caracteres CR no `prosrc`**,
inchando a função em 246 bytes e quebrando a verificação de paridade dali em diante (o
`_verifica-paridade-live.mjs` normaliza o ARQUIVO, mas o banco já estava sujo). Funciona, e é
justamente por isso que passa despercebido. Usar `.tmp/audit-2026-09/q-lf.mjs`, que normaliza
CRLF→LF antes de mandar. Conferir: `length(prosrc) - length(replace(prosrc, chr(13), ''))`.

### Como alterar função de banco sem versão versionada
A receita que funcionou, e que deixou o radar alterável: (1) extrair o `pg_get_functiondef` e
versionar como o "antes", com md5 e tamanho no cabeçalho; (2) gerar a versão nova **a partir
desse arquivo**, por script, para o diff ser só o que se quis mudar (aqui: 11 linhas de CTE e 1
linha trocada); (3) clonar a de produção com outro nome, aplicar a nova e comparar as duas na
MESMA query — pelo **conjunto** de flags, nunca pela sequência do `jsonb_agg`; (4) dropar a cópia.
O pino provou: 67/67 unidades, o conjunto mudou em 9 e nas 9 a única diferença foi a flag esperada
ter saído, **nenhum sinal novo apareceu**.
⚠️ O `_verifica-paridade-live.mjs` procura o delimitador `$func$`; o `pg_get_functiondef` gera
`$function$`. Trocar os dois delimitadores não altera o corpo (o `prosrc` não os inclui).

### Marketing: "pagou" e "subi a campanha" sao DUAS perguntas, e havia um campo so
A skill `subir-orcamento-meta-mensal` documenta `marketing_payments.status` como
`pending` = ainda nao subiu no Meta / `confirmed` = ja subiu. A tela do dashboard usa o MESMO
campo com outro sentido: `confirmed` = recebi o pagamento. Enquanto as duas coisas andavam
juntas ninguem via o conflito.

Medido em 08/09/2026, contando confirmacoes que caem no MESMO minuto que outra (assinatura de
confirmacao em lote — subir campanha no Meta nao leva segundos): **julho 21/48, agosto 31/54,
setembro 39/55**. Setembro fechou com 55 confirmados e ZERO pendentes: pela leitura da skill
tudo ja teria subido, e nao era o caso.

Agora quem responde "ja subi?" e **`marketing_payments.campaign_raised_at`** (+
`campaign_raised_by`). `status` volta a significar so o recebimento. Na tela: selo
"Falta subir"/"Subida" AO LADO do status (nao no lugar), botao "Subi"/"Desfazer", filtro
"Pagos — falta subir", e o card "Liquido Campanha" mostrando quantas faltam e quanto esperam.
⚠️ O `guard_marketing_payment_approval` so protegia `status`, `amount`, `franchise_id` e
`reference_month` — **coluna nova passa direto**. As duas entraram no guard; ao adicionar
qualquer coluna sensivel nessa tabela, lembrar de acrescentar la.

### `TAXA * 100` em ponto flutuante imprime 14.000000000000002
Estava na tela em dois lugares do marketing ("ja sem os 14.000000000000002% do Meta"). A taxa
de EXIBICAO virou `MARKETING_TAX_PCT` em `franchiseUtils.js`, arredondada uma vez onde a taxa e
definida; a de CALCULO continua `MARKETING_TAX_RATE = 0.14`.

### O `textContent` de um botao inclui o NOME do icone
`<Button><MaterialIcon icon="campaign"/> Subi</Button>` tem `textContent === "campaignSubi"`.
Morde em teste de navegador (`textContent.trim() === "Subi"` nao acha o botao) e e a mesma
propriedade que faz o icone virar palavra quando o CSS quebra a ligadura. Em teste, usar
`.endsWith(rotulo)`.

### 🔴 Ícone que vira PALAVRA: são DOIS modos de falha, e a guarda só pega um
O nome do ícone é o **conteúdo** do `<span>` — a fonte Material Symbols desenha por
**ligadura** do texto `payments`. Qualquer propriedade de texto herdada do container mexe nesse
texto e a ligadura deixa de casar; aí o navegador desenha a palavra.

- **Modo 1 — ícone fora do subset.** `npm run icons:check` pega. Já reprovou 3×.
- **Modo 2 — `text-transform: uppercase` no container.** A guarda **passa** (o ícone ESTÁ no
  subset) e a tela quebra igual. Foi o que aconteceu no raio-x do mural do CS em 08/09/2026: 11
  ícones viraram palavra (`PAYMENTS`, `LOCAL_SHIPPING`, `EXPAND_LESS`…).
- **Modo 3 — o nome do ícone vem do BANCO.** `NotificationBell` faz `icon={n.icon}` e o valor
  está em `notifications.icon`, gravado por `notify_admins(...)` dentro de função SQL. A guarda
  varria só `src/`, então esse nome nunca existiu para ela e o subset nasceu sem ele: em
  08/09/2026 o sino mostrou `HEALTH_AND_SAFETY` por inteiro. Dos 9 ícones gravados na tabela, 8
  estavam no subset **por coincidência** — são os mesmos nomes que aparecem no código. A guarda
  passou a varrer `supabase/**.sql`, mas **só dentro das chamadas a `notify_admins` e sem os
  comentários**: em SQL a rede larga do JSX dá falso positivo em `key`, `mode`, `public`,
  `source`, `segment`. Ao criar notificação por SQL, use ícone que já exista no código.

**Diagnóstico em um comando** — a largura denuncia, porque ícone é quadrado e palavra é comprida:
`[...document.querySelectorAll('span.material-symbols-outlined')].filter(s => s.getBoundingClientRect().width > 30)`.
Prova que fecha o caso: `campaign` media **20px no menu e 76px dentro do diálogo** — mesmo ícone,
mesma fonte, só muda o `text-transform`.

Corrigido no `MaterialIcon` com `textTransform: "none"` + `letterSpacing: "normal"` **inline**, o
que blinda os 15 pontos com `uppercase` sobre ícone (10 arquivos — não era só o mural: Início do
franqueado, ranking do admin, Resultado 3×, Vendas, cadastro de franquia, login) e os futuros.
Vai inline de propósito: `.uppercase` do Tailwind tem a mesma especificidade de
`.material-symbols-outlined` e venceria por vir depois na folha. **Os `uppercase` continuam onde
estavam** — eles são do rótulo, que deve mesmo ser maiúsculo; quem tinha de se proteger era o ícone.

### Console do Windows mente sobre acento — conferir os bytes
`'Sem vender h� '` no `print` do Python parecia arquivo corrompido; os bytes eram `\xc3\xa1`, ou
seja **á em UTF-8 correto**. É o cp1252 do console. Antes de "consertar" encoding, ler os bytes
(`open(...,'rb')`) — e, no caso de função de banco, a paridade md5 já responde sozinha.
