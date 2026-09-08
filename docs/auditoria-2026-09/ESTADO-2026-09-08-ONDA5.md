# Estado da auditoria depois da Onda 5 — 08/09/2026

**Ondas 0 a 4: ver [ESTADO-2026-09-07-ONDA4.md](ESTADO-2026-09-07-ONDA4.md). Onda 5: 10 dos 11
itens feitos e em produção, verificados por conteúdo no live (21/21 provas). O item 8 está
com o Nelson, num canvas, esperando decisão — que é exatamente onde ele deve estar.**

Commits: `6e2aad4` (contraste do verde) · `0430159` (+100% inventado) · `f717039` (endereço na
entrega + erros silenciosos) · `fe25a92` (cron do reconcile do CS) · `9e76388` (alertas leves no
topo) · `5f228d1` (RPC do robô cortada em 1.000) · `793cc12` (lote em aberto) · `89fe468` (dinheiro
do DRE em 14px) · `066ef48` (cache no react-query) · `346bc6e` (3 testes que nunca rodavam).
Todos em `main`, empurrados e com o serviço atualizado no Portainer.

---

## O que mudou, com o número que provou

| # | Item | Antes → depois | Como foi medido |
|---|---|---|---|
| 1 | Endereço na venda de entrega | **4.362 de 6.539 entregas (66,7%)** dos últimos 90 dias sem endereço em lugar nenhum. O formulário nunca pediu um; agora pede, pré-preenche pelo contato e grava nos dois | SQL sobre `sales`+`contacts`; RPC provada em transação abortada, 6 comportamentos |
| 2 | Contraste do verde de TEXTO | **3,30:1** no branco e **2,96:1** no chip → **5,02:1** e **4,50:1**. 54 trocas de classe em 23 arquivos + 9 hex crus | fórmula WCAG 2.1 sobre o hex real, e o CSS gerado conferido |
| 3 | O "+100%" inventado | **828 dos 3.169 dias com venda (26,1%), em 65 das 67 unidades**, vinham de um dia zerado — e o card anunciava "+100%" de alta | série de 90 dias por franquia-dia |
| 4 | Erros silenciosos na venda | **39 vendas manuais a R$ 0** e **73 com linha a R$ 0** (126 linhas) em 90 dias; **183 vendas sem contato nenhum**. Todas com "Venda registrada!" e zero aviso | contagem em `sales`/`sale_items` |
| 5 | Reconcile do CS por cron | rodava só quando alguém abria a página — **4,4 dias parado**; criaria 6 cartões que não existiam. Job 6, 08:15 BRT | simulação em transação abortada, depois rodado de verdade (12 → 18 abertos) |
| 6 | Alertas leves no topo do Painel | **5 unidades pararam de vender** e **8 com o robô parado** — escondidas atrás de uma seção colapsada cuja abertura busca 31 mil contatos. A faixa nova não custa **uma requisição sequer** | SQL + a tela em produção |
| 6b | **RPC do robô cortada em 1.000 de 4.089** | o card "Performance Bot" saiu de **1.603 → 7.244 conversas** (era um quarto da rede) | `limit`/`offset` contra a produção: 4.090 linhas, 4.090 chaves únicas, zero duplicada |
| 7 | Lote em aberto nos Pedidos | `total_weight_kg` era gravado e nenhuma tela lia. **23 pedidos, R$ 64.483, 2.386 kg = 2 rotas** de 1.500 kg | soma em `purchase_orders` |
| 9 | Dinheiro do DRE ≥ 14 px | **17 números de dinheiro em 12 px** no Resultado, incluindo "Entrou" e "Saiu" em negrito | varredura de `getComputedStyle` em 430 px, tela por tela |
| 10 | Cache de franquias no react-query | 13 pontos de chamada intocados; **1 requisição** por carregamento, como na onda 4 | contagem de requisições na produção |
| 11 | Testes que nunca rodavam | **3 arquivos** verificavam de verdade e estavam fora do `test:unit`. Suíte: 7 → **10 arquivos** | canário: divisor 1000→1001 reprova com rc=1 |

---

## O item que ficou com o Nelson

**8 — defaults de `ui/`.** Canvas publicado com quatro artboards (a folha de decisão e os três
contextos reais: lista de vendas e card de estoque em 430 px, tabela do Fechamento em 1440):
https://claude.ai/code/artifact/78c7173a-4d8e-42e7-8c13-0900fb725157

Medido no código (varredura que entende tag multi-linha, por isso difere do relatório):

| | usos | o que já desfazem |
|---|---|---|
| `Card` | 70 (68 com className) | 55 trocam a sombra · 51 mexem na borda (23 apagam, 28 trocam) · 33 forçam `rounded-2xl` — **e mais 63 divs que são cartão à mão** |
| `Button` | 199 (125 com className) | **48 redeclaram o vermelho da marca** — o `primary` do shadcn é `#b81e1e`, a marca é `#b91c1c` · 53 redeclaram o canto |
| `Badge` | 26 (23 com className) | **16 descem o texto para 10 ou 11 px**, furando o piso de 12 px da onda 4 · 15 forçam pílula — e mais 27 badges à mão |

A decisão: onde já sobrescreve, trocar o default **não muda um pixel** e a linha de `className`
some. Onde não sobrescreve, muda — 19 cartões, 151 botões, 10 badges. A única perda é densidade:
a linha do Fechamento fica ~3 px mais alta.

---

## Quatro diagnósticos do relatório que a medição derrubou

1. **"Quem escreve o endereço é só o robô"** (item 1). Não: o trigger
   `sales_fill_customer_snapshot` **já copia** `contacts.endereco` para a venda, e **1.393 das
   2.001** vendas com endereço são manuais, vindas dali. O buraco é antes — só 1.805 dos 5.526
   contatos com entrega têm endereço, porque o formulário nunca pediu. E ao ligar o campo apareceu
   o buraco que ninguém tinha visto: a RPC `save_sale_with_items` **enumera** as colunas que grava
   e não tinha as duas — mandar o endereço era no-op silencioso.
2. **"Subir valor e quantidade para 14 px mexe na densidade das tabelas"** (item 9). Não mexe:
   medido em 430 px, no Estoque **152 de 247** números já estão em 14 px e no Vendas **87 de 91**
   estão em 16 px. O que resta abaixo de 14 nas tabelas é **exclusivamente `<Badge>`**, que é a
   decisão do item 8. O único alvo real era o DRE — lista de linhas, não tabela.
3. **"`productWeight.test.mjs` tem ZERO asserts"** (item 11). Tem 16 verificações, com um `eq()`
   próprio no lugar do `node:assert`, e sai com código 1 quando falha — o grep do relatório
   procurou por `assert.` e não achou o helper. O problema real era maior e outro: **três**
   arquivos de teste que verificam de verdade estavam fora do `npm run test:unit`.
4. **"8 unidades sem vender há 7+ dias"** (meu próprio número, na primeira medição do item 6).
   São **5**. Os 8 saíram de uma consulta com `current_date`, que no Supabase é UTC: às 21h de
   Brasília o banco já virou o dia e três unidades no limite entraram indevidamente. A tela usa
   data local e está certa. É a armadilha que o `CLAUDE.md` já documentava, e eu caí nela.

---

## Armadilhas novas, para a próxima sessão

1. 🔴 **RPC também bate no teto de 1.000 linhas do PostgREST — e cala.** A onda 4 corrigiu isso em
   `get_human_message_counts` e a RPC irmã ficou. `get_bot_conversation_summary` devolve 4.089
   linhas e a tela recebia 1.000, sem erro nenhum: sem `limit`/`offset` a resposta só chega curta.
   **Toda RPC que devolve linha por franquia-dia é candidata.** Das 3 do painel, só essa passa de
   1.000 (as outras têm 62 e 92).
2. 🔴 **`Range:` como CABEÇALHO não pagina RPC.** Medido: 12 páginas voltaram as MESMAS 1.000
   linhas (12.000 lidas, 1.000 únicas). Quem pagina é `limit`/`offset` na URL — que é o que o
   `.range()` do postgrest-js escreve (conferido no fonte do pacote, não suposto).
3. 🔴 **Paginar RPC exige ORDER BY explícito.** `get_bot_conversation_summary` não ordena; sem
   `.order()` seria o bug 5333224 de novo. Com `(franchise_id, day)` — a chave do `group by`,
   única — as 5 páginas trouxeram 4.090 linhas e 4.090 chaves distintas, zero duplicada.
4. **O heredoc do shell come a barra invertida — de novo, duas vezes hoje.** `'\\u2014'` e
   `.replace('\\','/')` dentro de `cat <<'PY'` chegam sem a barra e o Python nem compila (ou pior,
   compila e a regex nunca casa). Gerar o script com `Write` quando ele tiver qualquer escape.
5. **A guarda de ícone reprova por CRASE em comentário.** `Usa \`orders\`` num comentário JSX fez
   `npm run icons:check` acusar `orders` como ícone fora do subset. A rede é larga de propósito
   (103 usos dinâmicos `icon={cfg.icon}`); reescrever o comentário é o conserto, não afrouxar a
   regra. Terceira reprovação legítima dela.
6. **`SaleForm` cai no chunk de ENTRADA** (`index-*.js`), não em `Vendas-*.js`. `TabResultado` e
   `AdminDashboard` têm chunk próprio. Verificar deploy por conteúdo no chunk certo.
7. **Franquia fantasma na medição de robô:** `bot_conversations` tem `helpcell`, que **não existe
   em `franchises`**. Contar direto na RPC dá 9 "robôs parados"; a tela cruza com a lista de
   unidades e mostra 8 — a tela é que está certa.

---

## Em aberto

- **Item 8** (defaults de `ui/`), no canvas, esperando o Nelson.
- **Assinatura da Uberaba** (do Nelson): ativa, com CPF, sem assinatura criada. A sentinela aponta
  todo dia e está certo.
- **O robô também não captura endereço**: das 2.112 entregas do bot em 90 dias, 608 têm endereço.
  O conserto desta onda é do lado do dashboard; o lado do n8n continua aberto.
- **`franchises.status` é `'active'`, não `'ativo'`** — duas consultas minhas voltaram vazias por
  isso hoje. Vale um olhar em quem mais compara essa coluna por string.
