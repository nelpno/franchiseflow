# Auditoria FranchiseFlow — relatório consolidado

**07/09/2026** · 6 frentes em paralelo (Fable 5.1) · ~2.500 linhas de relatório · tudo medido nesta
sessão contra código, banco de produção, bundle real e o live.

Relatórios de origem: [01 performance](01-performance.md) · [02 arquitetura](02-arquitetura.md) ·
[03 CSS/design](03-css-design.md) · [04 UX franqueado](04-ux-franqueado.md) ·
[05 UX admin](05-ux-admin.md) · [06 pontos cegos](06-pontos-cegos.md) ·
[contexto](00-CONTEXTO.md) · [Clarity 3 dias](00b-CLARITY-3DIAS.md) · [prompts](PROMPTS.md)

---

## A tese, em cinco linhas

O app não está quebrado — está **lento onde é grátis melhorar, calado onde deveria gritar, e cego
para dado que ele mesmo já tem**. O franqueado espera 8 segundos para ver um número que muitas
vezes está errado, e a home dele diz "Tudo em dia!" enquanto o robô está mudo há uma semana. O admin
tem 33% da receita atribuível a anúncio dentro do banco e nenhuma tela que mostre. E três defeitos
vivos hoje — compressão desligada em produção, RLS que deixa franqueado virar admin, e um cron
quebrado — não foram descobertos por reclamação porque **não existe nada vigiando**.

---

## 1. Quebrado AGORA (corrigir esta semana)

### 1.1 🔴 Produção serve 2,2 MB sem compressão e sem cache

**Frente 01 §2.1.** A stack 39 **não usa** o `Dockerfile`/`nginx.conf` que estão no repositório: ela
sobe `node:20-alpine`, roda `npm ci` + `vite build` no entrypoint (é daí que vêm os ~75 s de 502 a
cada deploy) e escreve um nginx de 8 linhas sem `gzip` e sem `Cache-Control`.

Medido no browser, cache frio: **2.226.597 bytes na rede, 0% comprimido**. Aquele "253 KB gzip" que
eu te passei no começo desta sessão **era ficção minha** — eu calculei sobre os arquivos locais
supondo que o servidor comprimia. Ele não comprime.

Some-se a isso que `export` (jspdf+xlsx, 856 KB) e `recharts` (415 KB) são **import estático do
chunk de entrada** — o `manualChunks` em objeto no `vite.config.js` puxa o `__vitePreload` e o
`clsx` de dentro deles. Ou seja: todo franqueado baixa a biblioteca de PDF e a de gráficos para
abrir a tela de vender.

**Correção:** duas labels `compress` no Traefik + `Cache-Control` na stack (P), e `manualChunks`
como função (P). O caminho crítico cai de ~653 KB para ~261 KB gzip — e o gzip passa a existir.
Isso é **a maior melhoria de performance do app, e é meia hora de trabalho**.

### 1.2 🔴 Um franqueado pode virar admin e ler a rede inteira

**Frente 02 §0.** `profiles_update` é `USING (is_admin() OR id = auth.uid())` **sem `WITH CHECK`** e
sem trava de coluna; `role` e `managed_franchise_ids` têm UPDATE concedido a `authenticated`.
Provado executando como um franqueado real, em transação revertida:

- `update profiles set role='admin' where id = <o próprio>` → **1 linha atualizada**
- anexar a unidade de outro dono ao próprio `managed_franchise_ids` → passou a ler **12 vendas de
  franquia alheia**

Mesma falha em `marketing_payments`: o franqueado pode fazer `status='confirmed'` na própria verba,
o que dispara o trigger de despesa e **auto-aprova o marketing dele**.

A tela nunca oferece isso. Mas a RLS é a defesa real, e hoje ela confia no cliente. Qualquer pessoa
com o `anon key` (que está no bundle, por design) e uma sessão de franqueado consegue.

**Correção:** `WITH CHECK` congelando essas colunas, ou `REVOKE` + RPC de admin. Esforço M.
Junto: **45 funções SECURITY DEFINER executáveis por `anon`, 28 sem guard nenhum** (frente 06 §6.13).

### 1.3 🔴 O painel do admin está com o robô cego, e o cron do ranking quebrou

Duas frentes acharam por caminhos diferentes:

- **As 3 RPCs de bot retornam HTTP 500 em 100% das chamadas das últimas 24 h** (frente 06 §5.1,
  frente 01 §3.2): estouram o `statement_timeout` de 8 s sobre 208 mil conversas e 938 mil
  mensagens. Como `supabase.rpc()` não rejeita a promise, o `AdminDashboard` **nunca mostra erro** —
  e ainda espera os 8 s antes de pintar.
- **O cron `aggregate_daily_data` falhou em 26/07, 30/07 e hoje** (frentes 05 e 06) com
  `numeric field overflow` em `daily_summaries.conversion_rate numeric(5,2)` — estoura quando uma
  unidade faz 11 vendas com 1 contato (1.100%). Coluna com **zero consumidores**. Resultado: 06/09
  está com zero linhas, e o ranking de 7 e 30 dias do Painel **não tem as 194 vendas / R$ 16.757 de
  41 franquias de ontem**.

**Correção:** teto na coluna + reprocessar 3 dias (P); checar `.error` nas RPCs e tirá-las da
primeira onda (P); ranking passar a somar `allSales`, que o painel já carrega (P) — isso conserta
junto a barra bot×manual, que hoje em 7d/30d só usa as vendas de hoje.

### 1.4 Regras que você anunciou e o app não aplica

- **Frete do pedido à fábrica** (regra de 30/08: `min(350, max(250, 10%))`): **14 dos 24 pedidos
  posteriores saíram com R$ 0**. O campo é digitado à mão e o app não sugere nada.
- **Frete da venda ao cliente**: **622 entregas em 90 dias com frete R$ 0**, embora **60 das 67
  configurações já tenham regra de frete** — que hoje só o robô lê. Frete é receita no DRE.
- **Marketing**: **3 despesas duplicadas no DRE** (Cajamar jul, Santana ago, Cotia abr — R$ 1.200
  lançados duas vezes) que a guarda de 19/08 não cobre.

---

## 2. Frente FRANQUEADO — o que muda a vida dela

Contexto de uso confirmado pelo Clarity: **349 sessões mobile em 3 dias na home**, 75% de
QuickbackClick, 8% de tempo ativo. Ela abre, não acha o que quer, e sai.

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| 1 | **Estado real do robô e do pedido na home** | Hoje `botActive` = "existe linha de config". **10 franquias vendendo têm zero conversa do robô há 7+ dias e veem a faixa verde "Tudo em dia!"**. E o `loadData` já baixa os pedidos em aberto e **joga fora** — "meu pedido saiu?" é a pergunta que chega no grupo (10 em aberto agora) | P + P |
| 2 | **Frete automático + Entrega/Retirada visível + cupom logo após salvar** | Venda típica hoje = **18 toques + 5 digitações**; com isso cai para ~11. O RPC já devolve o `saleId` e o `onSave()` ignora — por isso imprimir o cupom obriga a caçar a venda na lista, enquanto o tutorial promete que "o comprovante aparece na tela" | P + P + P |
| 3 | **"Salvar" desabilitado na Revisão do Meu Vendedor** | `disabled={!isDirty}`, porque o "Próximo" já salvou. Candidato mais forte aos **26,3% de sessões com dead click** nessa tela | P |
| 4 | **Home: zeros falsos, tour indevido e 3 queries mortas** | Mostra "R$ 0,00" antes do skeleton; **57 das 67 franquias não têm linha de onboarding** e o redirect ao tour decide por `localStorage` — celular novo cai em 7 telas de boas-vindas; e consulta `daily_checklists`, tabela que **nunca teve uma linha** | P + P + P |
| 5 | **Endereço na venda de entrega** | **65% das entregas manuais (2.848 de 4.388 em 90 dias) não têm endereço em lugar nenhum** — o cupom do motoboy sai sem, e ele liga. É o caso Itápolis do telefone, generalizado | M |
| 6 | **Reordenar a home** | Faixa de estado (robô + pedido) → Hoje → Precisa de você → Mês. O filtro de período sai da home. O botão de vender passa a morar lá — hoje todo acesso para vender é um quickback por construção | M |
| 7 | **Números que mentem ou não se leem** | "+100%" quando ontem foi zero (segunda contra domingo fechado, em todo card — e o CLAUDE.md documenta o contrário do que o código faz); centavos em agregado; "Markup", "p.p.", "Tendência 📈"; e o banner que promete "acionar o bot para ativar clientes inativos" — função que **não existe** | P |
| 8 | **Erros silenciosos na venda** | "Venda registrada!" com o cliente perdido no caminho; **38 vendas a R$ 0 e 67 com linha a R$ 0** em 90 dias passam sem aviso | P |

**Tela morta a apagar:** `MyChecklist` — zero linhas na vida, sem item de menu, e ainda consultada
em todo load e todo poll da home (576 requisições/dia por nada).

**Biblioteca de Marketing tem 7 arquivos** — é a explicação do scroll médio 63 e dos 18% de tempo
ativo. Não é problema de UI: é falta de conteúdo.

---

## 3. Frente ADMIN — perguntas de gestão que o app não responde

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| 1 | **Coluna Δ vs mês anterior + ordenar por "maior queda"** | O `prevPnl` **já é calculado para as 66** e só aparece expandindo uma linha por vez. "Quem caiu?" é a pergunta nº 1 e hoje custa 66 cliques | P |
| 2 | **Mensalidades: chips, vencimento e dias de atraso** | 1 vencida há um mês (Uberlândia), 23 pendentes vencidas em 05/09, e **1 franquia sem linha nenhuma em `system_subscriptions` (Uberaba)** aparecendo como "Pendente" normal — foi exatamente assim que a Americana ficou 4 meses sem cobrança | P |
| 3 | **Alertas leves abertos no topo do Painel** | "Sem vendas" e "robô parado" só precisam de dado já em memória, mas estão colapsados no fim e abrir custa **31 mil contatos**. E o KPI "Conversão" divide vendas **manuais** (77% do total) por leads do **robô** | M |
| 4 | **Atribuição de marketing por unidade** | `contacts.ctwa_clid` preenchido em **69% dos contatos de 30 dias**; cruzado com vendas: **33% da receita (R$ 115.927) vem de anúncio**. Agosto: Osasco ROAS líquido **11,7**, Guarujá 7,0, **Santos 0,2**. Zero telas consomem isso | M |
| 5 | **Aba "Fechamento" no Financeiro** | Fechar o mês exige **3 telas que não se cruzam** (DRE, Marketing→Investimento, Mensalidades) e o CLAUDE.md descreve o fechamento como `count()` no SQL à mão. Todas as fontes já são carregadas por telas irmãs | M |
| 6 | **Mural do CS: dono, telefone e data de retorno** | Nem o card nem o drawer mostram **com quem falar**; ordena do mais novo para o mais velho (Rio Preto, parado há 27 dias, no fundo); `due_date` e `cs_agreements` existem com **zero consumidores** — o Celso não sabe que um sinal está silenciado | P |
| 7 | **Reconcile do CS por cron** | Roda só quando alguém abre a página: **17 críticas, 10 sem cartão** neste momento | P |

**"X de 67 pagaram" no marketing conta pendente como pago** e inclui as franquias de teste no
denominador. Correção de uma linha.

**`PurchaseOrders` não é subutilizada** (só 4 sessões em 3 dias porque é **ciclo semanal** — 68% dos
pedidos caem no domingo). O que está fora do app é o **planejamento**: rota, peso e frete.
`total_weight_kg` é gravado e ignorado.

---

## 4. Estrutural — o que sustenta os próximos 12 meses

**Performance de banco (frente 01 §3.1).** As policies chamam `is_admin_or_manager()` e
`managed_franchise_ids()` **sem `(select …)`**, então a função roda **por linha**. Médias reais do
`pg_stat_statements`: Vendas `sales` **1.090 ms**, Gestão `sale_items` **795 ms**, contatos
**3.458 ms** — com filtro explícito de `franchise_id`, as mesmas tabelas respondem em 9–71 ms. O
`EXPLAIN` mostra 372 ms → **5,7 ms** só reescrevendo a policy. Isso são ~100 policies e vale para o
app inteiro.

**Icon-font de 1.128.840 bytes.** Material Symbols variável, com todos os ícones do Google, baixado
em paralelo ao boot — e até chegar, cada ícone aparece como a palavra `wb_sunny`/`point_of_sale` em
texto. O app usa **141 nomes**. Subset ≤ 30 KB.

**Design system existe e está morto (frente 03).** As variáveis `--primary`/`--foreground`/etc. são
byte-iguais aos hex e têm **zero usos** fora de `ui/`; 45% dos `className` carregam hex cru; 114 hex
distintos, dos quais ~45 são variação acidental do mesmo tom. E os defaults de `ui/` são o contrário
do que o app usa — `<Card>` tem a borda sobrescrita em 44 de 58 usos, o que produziu **62 cards
feitos à mão contra 58 `<Card>`**. Migração é codemod com diff provando zero mudança visual.

**Tipografia é de desktop nos dois tamanhos de tela**: `text-xs` (12 px) é o tamanho mais usado do
app (464×), mais 123 textos abaixo disso; o DRE do franqueado imprime as linhas em 11 px. Só 31
variantes responsivas de fonte no app inteiro. E alvos de toque abaixo de 48 px no caminho diário:
bottom nav ~40 px, ações da venda 32 px, botões do estoque mobile **28 px**.

**Tela branca: a guarda está pronta.** `no-undef` está apagado pelo bloco `rules:` do
`eslint.config.js`. Boa notícia: **zero ocorrências hoje** — é risco latente. A frente 02 montou um
`eslint.strict.config.js` que herda a base e liga só as duas regras, e provou com arquivo-canário
(exit 0 no `src/`, exit 1 no canário). É colar e pôr no pre-push.

**react-query:** recomendação das frentes 01 e 02 é **adotar incrementalmente depois da onda 1**,
não remover. Começar por `useFranchises` (chamado em quase toda tela) e depois Vendas e Início.

**Teste onde o dinheiro está:** o cálculo do `SaleForm` (subtotal, desconto, taxa repassada×absorvida,
`netValue`) vive solto no JSX, sem teste. E atenção: **`productWeight.test.mjs` tem zero asserts**, e
3 dos 5 arquivos de teste não usam `test()` — a cobertura no papel é maior que a real.

---

## 5. Desligar, apagar, automatizar

Em ordem de tempo economizado por semana (frente 06):

1. **Sentinela diária** — cron falhou, RPC em 500, buraco no `daily_summaries`, franquia que parou de
   vender, despesa duplicada, pedido sem frete, pagante sem WABA → `notify_admins` + Zuck. **~2 h/semana**:
   cada incidente descoberto por reclamação (QR em 01/09, assinatura em 19/08, ficha em 26/08) custou
   uma sessão inteira — e havia **3 problemas ativos hoje que ninguém sabia**.
2. **Subir orçamento do Meta automático** a partir de `marketing_payments` confirmado — 54 confirmações/mês.
3. **Fechamento ASAAS como tela/cron** + baixa `receiveInCash` na edge.
4. **Frete automático** nos dois lugares (pedido à fábrica e venda ao cliente).
5. **Consertar as 3 RPCs de bot + o cron** (§1.3).
6. **Guarda contra despesa de marketing duplicada** no `ExpenseForm`.
7. **Clarity quinzenal automático** — foram 4 pulls em 5 meses, não quinzenal. Mais
   `clarity('set','franchise',…)` para saber **qual** franqueada está sofrendo.
8. **Detectar sessão morta** — houve **12 h de 401 em Assis** e 9 vendas tentadas nesse estado.
9. **Apagar o morto**: `MyChecklist` + `daily_checklists`, 5 componentes, 4 funções de
   `api/functions.js` apontando para workflow inativo, 3 entities, 6 RPCs, 7 tabelas de backup,
   índice de 17 MB nunca lido.
10. **Notificações: um sino só** — hoje o Layout monta **dois** `NotificationBell` com poll de 2 min,
    o que faz `notifications` ser **23% de todo o tráfego do dashboard** (6.021 requisições/dia).
    82% delas são "Estoque baixo" e 59% nunca foram lidas.

---

## 6. Pontos cegos que ninguém tinha visto

- **19 das 54 franquias que pagaram anúncio em setembro não têm WABA** — o CAPI é no-op para elas, e
  isso é invisível no admin. Elas pagam por atribuição que não acontece.
- **36,8 mil contatos com `ctwa_clid`** e nenhuma tela lendo.
- **291 vendas apagadas em 30 dias** sem nenhuma tela de admin que mostre.
- **A latência do robô é gravada em 100% das saídas e nunca exibida.**
- **A RPC de saúde do CS e o reconcile que rodam em produção não existem em `.sql` nenhum** do
  ecossistema — só num documento de plano. Aplicar o `09-*.sql` versionado **regrediria o radar do
  Celso** (perderia `giro_baixo`, `marketing_late`, `cs_agreements`, cooldown, `parked_until`).
  🔴 Isto é bloqueante para qualquer mexida no Mural.
- **Os smoke tests do cupom e da ficha estão em `.tmp/`, que é gitignored** — existem só na sua
  máquina. Se o PC morrer, some a única verificação automatizada dos dois documentos impressos.
- **O `<style>` de impressão do cupom só funciona porque vive dentro do componente** (o `cloneNode`
  o leva ao iframe). Mover para o `index.css` quebra calado.
- **Três coisas no CLAUDE.md estão erradas**: o Bot Coach Report está **inativo desde 06/04** (o doc
  diz ativo); `vw_dadosunidade` é **SECURITY DEFINER** no banco (o doc diz INVOKER); e o `StatsCard`
  faz o **oposto** do que o doc descreve sobre o "+100%".

---

## 7. O que NÃO fazer (economiza tempo)

- **Não virtualizar** TabEstoque nem TabLancar — máximo de 56 itens por franquia. (MyContacts sim:
  2.887 cards numa unidade.)
- **Não mexer no `index.css`** — os 102 KB são Tailwind legítimo e podado, 17 KB gzip, zero dead code.
- **Não remover react-query** — adotar aos poucos sai mais barato que o refactor de saída.
- **Não recriar** Health Score, Acompanhamento, Relatórios, BotIntelligence.
- **Não trocar o Clarity de lugar** — não é ele que está segurando o boot.

---

## 8. Ordem sugerida

| Onda | O quê | Ganho | Esforço |
|---|---|---|---|
| **0 — esta semana** | gzip + cache no Traefik · `manualChunks` função · teto no `conversion_rate` + reprocessar · `.error` nas RPCs de bot · `WITH CHECK` na RLS de `profiles`/`marketing_payments` · guarda ESLint no pre-push | app 2,5× mais leve, ranking correto, buraco de segurança fechado | ~1 dia |
| **1 — franqueado** | robô e pedido na home · frete automático · entrega visível · cupom após salvar · Salvar do Meu Vendedor · zeros falsos e tour indevido · apagar MyChecklist | −5 toques por venda, home que responde | ~3 dias |
| **2 — admin** | Δ mês anterior · mensalidades com atraso e "sem cobrança" · alertas leves no topo · CS com dono/telefone/retorno · reconcile por cron | perguntas de gestão em 1 clique | ~3 dias |
| **3 — vigilância** | sentinela diária · Clarity automático com identificação de franquia · sessão morta · notificações em 1 sino | pára de descobrir por reclamação | ~2 dias |
| **4 — estrutural** | `(select fn())` nas policies · subset da icon-font · tokens por codemod · tap targets e tipografia ≥14 px · `saleCalc` testado · atribuição de marketing · aba Fechamento | base para os próximos 12 meses | ~1 semana |

---

## 9. Como provar que melhorou

| Métrica | Hoje | Alvo | Como medir |
|---|---|---|---|
| Bytes na rede, cache frio | 2.226.597 | < 700.000 | Playwright no live, `transferSize` |
| Caminho crítico (gzip) | ~653 KB | ~261 KB | build + `gzip -c` por chunk |
| Tempo até o primeiro número | ~8 s (espera das RPCs) | < 2 s | marca de performance no primeiro card |
| `sales` na tela de Vendas | 1.090 ms médios | < 80 ms | `pg_stat_statements` |
| QuickbackClick `/Dashboard` mobile | 75,2% | < 30% | Clarity, mesma consulta desta auditoria |
| Tempo ativo `/` mobile | 7% | > 40% | Clarity |
| Dead clicks `/Vendas` PC | 253 / 3 dias | < 80 | Clarity |
| Requisições/dia de `notifications` | 6.021 | < 700 | `pg_stat_statements` |
| Entregas sem endereço | 65% | < 15% | SQL em `sales`/`contacts` |
| Pedidos com frete R$ 0 | 14 de 24 | 0 | SQL em `purchase_orders` |

Os comandos para cada uma estão na seção 9 do [relatório de performance](01-performance.md).
