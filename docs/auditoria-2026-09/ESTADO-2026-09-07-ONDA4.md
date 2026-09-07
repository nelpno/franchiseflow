# Estado da auditoria depois da Onda 4 — 07/09/2026 (noite)

**Ondas 0 a 3: ver [ESTADO-2026-09-07.md](ESTADO-2026-09-07.md). Onda 4: 13 dos 14 itens
feitos, em produção e verificados por conteúdo no live (18/18 provas).**

Commits: `65ec8dc` (RLS) · `3f6715a` (ícones) · `028a544` (filtro de franquia) · `ed4d88b`
(dist fora do git) · `c814c40` (atribuição de marketing) · `7947231` (toque e tipografia) ·
`cd99406` (saleCalc) · `3875b92` (tokens de cor) · `fcb8f38` (sino) · `ce02612` (paginação) ·
`74f31d2` (limpeza) · `61176b7` (estados vazio/erro) · `8c8f766` (Fechamento) · `4611ca4`
(cache de franquias). Todos em `main`, empurrados e com o serviço atualizado no Portainer.

---

## O que mudou, com o número que provou

| # | Item | Antes → depois | Como foi medido |
|---|---|---|---|
| 1 | `(select fn())` em 91 policies | soma de 10 consultas de franqueado **2.324 ms → 91,5 ms** (−96,1%). Vendas 554 → 13 ms; contatos 746 → 33 ms | `EXPLAIN (ANALYZE)` como franqueado real, mediana de 3 |
| 2 | Subset da icon-font | boot **1.379.983 → 279.476 bytes** (−1,10 MB, −79,7%); woff2 de 1.130.004 → **28.748** | bytes crus na rede (`https.get`, sem descompressão) |
| 3 | Atribuição de marketing | **30,5% da receita** vem de anúncio e nenhuma tela lia. Agosto: R$ 122.677 atribuídos sobre R$ 24.983 líquidos = **4,9× na rede**; Osasco 11,7×, Vila Maria 4,1× | RPC nova + smoke que renderiza a tabela com dado real |
| 4 | `franchise_id` explícito | Vendas e Gestão pediam a tabela inteira e deixavam a RLS peneirar; franqueado com 2 unidades baixava as duas | leitura de fluxo + verificação no bundle |
| 5 | Alvos de toque e tipografia | bottom nav "Início" **31×50 → 84×58 px**; ações da venda 40×32 → 44×40; estoque no celular 28×28 → 40×40; **39 textos abaixo de 12 px → zero** | `getBoundingClientRect` em 430×932, live × local |
| 6 | `lib/saleCalc.js` | a conta do dinheiro saiu do JSX; **23 testes**; a lista de métodos com taxa deixou de estar escrita 4× no mesmo arquivo | `node src/lib/saleCalc.test.mjs` + conferência no browser |
| 7 | Tokens de cor | **2.342** hex crus viraram token e **148** variações acidentais sumiram; CSS 102.966 → 99.498 bytes | conjunto de DECLARAÇÕES do CSS antes/depois: só as 32 dos tons acidentais mudaram |
| 9 | `EmptyState` / `ErrorState` | home sem venda mostrava 4 zeros; Resultado tinha 3 toasts e nenhum estado de erro | screenshot em unidade sem venda |
| 10 | Aba **Fechamento** | o mês em uma linha por unidade. Setembro: 64 unidades, R$ 97.544 de faturamento, R$ 23.448 de lucro, 112 vendas sem baixa, 9 sem verba, 23 sem mensalidade | RPC + tela conferida contra o DRE do franqueado (R$ 7.350,87 nos dois) |
| 11 | Um sino só | **2 buscas idênticas → 1** por carregamento; 5.573 bytes no lugar de 6.553; 60 → **12 requisições/hora** por aba | contagem de requisições no browser, antes na produção |
| 12 | Paginação que cresce | Gestão > Resultado **42 → 21 requisições** (`sales` 7→2, `sale_items` 22→7), com os MESMOS números na tela | `performance.getEntriesByType` na produção, antes e depois |
| 13 | Apagar o morto | tela sem uso na vida + **41 MB de índice com 0–14 leituras em 7 meses** + 6 tabelas de backup | `pg_stat_user_indexes` desde 12/02/2026 |
| 14 | Cache de franquias | a lista de 67 unidades vinha **2× por carregamento**, 32.447 bytes cada | contagem de requisições em 4 telas |

Boot final medido no live: **279.476 bytes** (250.728 de assets + 28.748 da fonte).

---

## O item que NÃO foi feito

**8 — defaults de `ui/`** (`<Card>` com a borda sobrescrita em 44 de 58 usos; 62 cards à mão
contra 58 `<Card>`; trocar o default de Button/Badge/Card e depois migrar os usos).

Não foi feito de propósito: é o item de maior raio de alcance visual e menor retorno para
quem usa o app. Mudar o default de `Button`, `Badge` e `Card` altera a aparência de TODA
tela de uma vez, e a verificação possível aqui é screenshot de meia dúzia de telas — não das
~30 que seriam afetadas. Os outros itens ou tinham número medido do outro lado, ou eram
mudança localizada. Fica para uma rodada com o Nelson olhando junto.

---

## Três diagnósticos do relatório que a medição derrubou

1. **"Janela de data no TabResultado"** (item 12): não existe histórico antigo para cortar.
   A venda mais antiga da REDE é de 31/01/2026 e Vila Maria tem as 1.079 dentro do ano
   corrente. O que custava era a paginação especulativa, não o volume.
2. **"Tokenizar economiza 15–18 KB"** (item 7): economizou 3,5 KB. A estimativa supunha
   colapsar as variantes de opacidade, e o Tailwind gera uma regra por token+opacidade de
   qualquer jeito. O ganho do item é ter um lugar só onde o vermelho da marca é definido.
3. **"6 RPCs sem consumidor"** (item 13): "sem consumidor" no relatório significa sem
   consumidor NO DASHBOARD. Os workflows do n8n também chamam RPC — `deduct_inventory` tem
   exatamente a cara do que o fluxo de venda do robô chamaria. Não foram apagadas.

---

## Armadilhas novas, para a próxima sessão

1. 🔴 **A Management API do Supabase devolve o último resultset NÃO-VAZIO, não o do último
   statement.** Com `set local role` + `set_config` + a consulta, se a consulta voltar vazia
   você recebe a linha do `set_config` e acha que veio dado. Contorno: fechar a consulta em
   `select coalesce(json_agg(t),'[]'::json) from (…) t`, que nunca volta vazia.
2. 🔴 **Heredoc de shell come a barra invertida.** `"\\b"` escrito num `cat <<'EOF'` chega ao
   arquivo como `"\b"`, que em JS é BACKSPACE, e a regex passa a nunca casar — silenciosamente
   (a canonização de cor "rodou" com 0 substituições e parecia estar tudo certo). Escrever
   regex sem escape (lookahead `(?![0-9a-fA-F])` no lugar de `\b`) ou gerar o arquivo por
   Python/Write.
3. **Comparar cor no CSS gerado exige normalizar.** Token vira `rgb(r g b/var(--tw-*))` e
   valor arbitrário vira `#hex`; e o hex aparece também no NOME do seletor
   (`.border-\[\#291715\]\/10`). Comparar o conjunto de DECLARAÇÕES (direita do `:`), não a
   ocorrência do hex no arquivo.
4. **`TabResultado` tem chunk próprio** (`TabResultado-*.js`), não vive no chunk de `Gestao`.
   Verificar deploy por conteúdo no chunk certo — a mesma pegadinha do `FranchiseForm`.
5. **Usuário de teste de franqueado**: as telas franchiseeOnly não dão para verificar sem um.
   O que funcionou: criar pela Auth Admin API, escrever `profiles` com `role` e
   `managed_franchise_ids`, e apagar no fim (`scripts` em `.tmp/audit-2026-09/qa-user.mjs`).
   Para ver tela de admin, promover e reverter — o `guard_profile_privilege_columns` deixa
   passar quando `auth.uid()` é nulo (service_role). **Um reload completo é obrigatório
   depois de trocar o papel**: a navegação SPA continua com o perfil antigo em memória.
6. **`npm run icons:check` faz parte do pré-deploy agora.** Ela reprovou duas vezes hoje
   (`query_stats` e `inbox`) — ícone fora do subset não some, vira a palavra na tela.

---

## Em aberto

- **Assinatura da Uberaba** (do Nelson): ativa, com CPF, sem nenhuma assinatura criada. A
  sentinela aponta todo dia e está certo.
- **Item 8** (defaults de `ui/`), acima.
- **Contraste do verde de texto**: `#16a34a` dá 3,30:1 e reprova AA. O token `ok.ink`
  (`#15803d`, 5,02:1) já existe no `tailwind.config.js` mas não foi aplicado — é mudança
  visual e merece rodada própria.
- **Dado em tela de operação ≥ 14 px**: o piso de 12 px foi aplicado; subir valor e
  quantidade para 14 px mexe na densidade das tabelas.
- **Migrar o cache de franquias para react-query**: agora que existe um ponto de entrada só
  (`lib/franchisesCache.js`), a migração fica mecânica.
