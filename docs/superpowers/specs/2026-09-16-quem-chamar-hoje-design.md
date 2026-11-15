# "Quem chamar hoje": CRM com lista diária para o franqueado (design aprovado 16/09/2026)

## Contexto

A tela **Meus Clientes** hoje é uma agenda: mostra quem é o cliente, mas não diz o que fazer. O Nelson pediu (16/09/2026) que ela vire um CRM prático: **todo dia**, dizer ao franqueado *quem chamar e o que falar*, a partir de quem comprou, quando e o quê. Sem complicação, operacional e fácil de ver, para um público leigo que usa muito o celular.

**O que está em jogo, medido no banco.** O problema da rede é a **recompra**, não a conversão:
- só **29%** de quem compra pela 1ª vez volta;
- a média é ~1,1 compra por cliente;
- a recompra mediana acontece em **20 dias** (p75: 42; p90: 71);
- quando um humano entra na conversa, a conversão **dobra**: 8,7% só com o robô, ~17% com humano.

**Decisões já tomadas**
- **Onde fica.** O Clarity decidiu: em 3 dias, a Início teve ~550 sessões (~90 pessoas) e Clientes, 83 (~35 pessoas).
  - A lista fica **na Início**, em versão curta, com a ação feita ali mesmo.
  - A tela Clientes abre na aba **"Hoje"** (lista completa), com a aba **"Todos"** ao lado.
- **Envio.** O botão abre o WhatsApp com a mensagem pronta e o franqueado envia. O sistema nunca envia sozinho.
- **Lembrete matinal por WhatsApp.** Fica para a fase 2.
- **Resultado.**
  - Para o franqueado: fase 1.
  - Para o Celso/CS: fase 2.
- **Não é o painel que foi removido.** Em 31/03 a lista "Ações sugeridas" saiu de Clientes porque poluía a tela (`c4fde1b`), e o `ActionPanel.jsx` está na lista "NÃO recriar". Aqui **a lista é a tela**, não um painel em cima da lista.

---

## Pontos cegos que o levantamento achou

1. **Não há como saber quem o franqueado já chamou.**
   - O robô grava `last_contact_at` a cada mensagem recebida, e o botão "Feito" grava no mesmo campo. Por isso o "Feito" atual some e volta por acaso.
   - **Correção:** um registro próprio, `contact_actions`.
2. **Os números do cadastro do cliente mentem.**
   - A trigger grava a "última compra" com a data da venda, **mesmo quando a venda é retroativa**: 344 clientes estão com a data mais velha do que a real.
   - 354 clientes têm a contagem de compras errada.
   - Quando uma venda é apagada, a data não volta.
   - **Correção:** refazer a trigger e o backfill. A lista passa a ser calculada **pelas vendas**.
3. **20% dos compradores não têm telefone** (2.604 de 13.306), porque a venda manual foi lançada sem número. Na unidade mediana, são 16 de 98 clientes ativos.
   - **Correção:** aviso "X clientes sem telefone" + filtro para completar.
4. **As abas "Negociando" e "Sumidos" mostram sempre 0.** Esses status não existem no banco, então 2 das 5 regras atuais nunca disparam. O filtro "Origem WhatsApp" também não acha ninguém.
5. **A Início quase não sugere reativar clientes.**
   - Ela carrega só 200 contatos, ordenados por quem acabou de falar.
   - A lista corta em 5 antes de tirar os já dispensados.
   - E fica **no fim da tela**.
6. **O melhor sinal do banco não é usado.** Na última semana:
   - **674 clientes antigos** falaram com o robô e não compraram;
   - **1.575 interessados** trocaram 6 ou mais mensagens sem comprar (mediana de 26 por unidade).
   É exatamente onde o toque humano dobra a conversão.
7. **Interromper uma conversa viva estraga a venda.** Quando o franqueado escreve, o robô pausa por 15 min.
   - **Correção:** só entra na lista a conversa **parada há 2h ou mais**, sem venda e sem ninguém da unidade já falando. As mensagens humanas são registradas: 15.438 em 7 dias.
8. **Falso "voltou a falar".** Um cliente perguntando "cadê meu pedido de ontem" entraria na lista.
   - **Correção:** exigir que a última compra tenha sido pelo menos 3 dias antes da conversa.
9. **Risco de bloqueio do número.** O Zuck é API não oficial, e mensagem igual para muita gente derruba o número da unidade.
   - **Correção:**
     - no máximo **8 por dia** (e só 2 "sumidos");
     - 2 variações de texto por tipo;
     - sem link na mensagem;
     - sem "enviar para todos".
10. **Não há como o cliente pedir para não receber mais mensagens.**
    - **Correção:** criar "Não chamar mais", que tira a pessoa de todas as listas e pode ser desfeito na edição do cliente.
11. **A mensagem pronta não pode ferir regras da rede.**
    - Nada de "separar/reservar" (regra: sem reserva sem pagamento).
    - Sem promoção ou desconto inventado.
    - O produto favorito só aparece se estiver **em estoque e ativo**.
12. **A tela Clientes mostra até 3.037 cartões de uma vez.**
    - **Correção:** 50 por vez, com o botão "Mostrar mais".
13. **Tem que ser o WhatsApp da unidade.** Enviado do número pessoal, o cliente não reconhece o número e o robô não acompanha a conversa.
    - **Correção:** dica na primeira vez que o franqueado usar a lista.
14. **Achado de segurança, fora do escopo mas barato: `get_franchise_funnel_stats` não confere a unidade.** Qualquer usuário logado lê o funil (números agregados) de qualquer unidade.
    - **Correção:** colocar a mesma guarda de `get_marketing_attribution` no mesmo SQL.

---

## O que o franqueado vê

### Início: cartão "Quem chamar hoje"
- **Posição:** logo abaixo do `PriorityAction`. Substitui o "Outras ações" (`SmartActions`), que sai do fim da tela.
- **Conteúdo:**
  - título com o total do dia;
  - barra "3 de 8 feitos";
  - **as 3 primeiras pessoas**, cada uma com nome, motivo numa linha e o botão **Chamar**;
  - link "Ver lista completa", que abre Clientes na aba Hoje.
- **Sem pendências:** mostra "Tudo em dia por hoje 🎉" e a linha do resultado do mês.
- **Sem nenhum motivo** (por exemplo, unidade nova sem vendas): o cartão não aparece.

### Clientes: abas `[ Hoje (8) ]  [ Todos (812) ]`, abrindo em Hoje

**Aba Hoje**
- **Topo:**
  - progresso do dia;
  - resultado: *"Em setembro: 12 chamados · 4 compraram até 7 dias depois (R$ 480)"*. O texto é "compraram depois", não "sua mensagem trouxe", para não exagerar;
  - aviso "5 clientes sem telefone → completar".
- **Cartões** agrupados por motivo, cada um com:
  - nome + **marca do cliente**;
  - o motivo em palavras simples (ex.: "Falou com o robô ontem e não comprou");
  - "Comprou há 34 dias · gosta de Rondelli 4 Queijos";
  - prévia da mensagem em 2 linhas.
- **Botões do cartão:**
  - **Chamar no WhatsApp** (verde, 48 px): abre o `wa.me` com o texto e **já registra a ação sozinho**, sem segundo toque. O cartão fica marcado como feito e aparece a opção "Desfazer".
  - **Pular**: abre uma folha com duas opções, "Só hoje" ou "Não chamar mais".
- **Para o admin:** a aba Hoje só aparece quando há uma unidade escolhida. O admin continua com "Todos".

**Aba Todos** (a lista atual, melhorada)
- **Marca do cliente**, em duas leituras simples:
  - quem é: ⭐ **Fiel** (5+ compras) · 🔁 **Voltou** (2–4) · 🆕 **Novo** (1) · 💬 **Nunca comprou** (0);
  - como está: chip "comprou há X dias" em verde (até 30 dias), amarelo (31–60) ou vermelho (mais de 60).
- **Filtros em chips** (no lugar das abas mortas): Todos · Fiéis · Nunca compraram · Sumidos (30+ dias) · Sem telefone.
- **Limpeza:** sai a opção de origem "WhatsApp", que dá sempre 0.
- **Lista:** 50 por vez, com "Mostrar mais".
- **Edição:** o diálogo ganha a chave "Não chamar mais".

### Os 5 motivos (uma ação por pessoa; até 8 por dia; nesta ordem)

| # | Motivo na tela | Regra (pelas vendas e conversas) | Exemplo de mensagem (2 variações por tipo) |
|---|---|---|---|
| 1 | 🔥 **Voltou a falar e não comprou** | tem 1+ compra; conversa nas últimas 48h, parada há 2h+, sem venda depois; última compra 3+ dias antes da conversa | "Oi, Maria! Aqui é da Maxi Massas {cidade} 😊 Vi que você falou com a gente. Quer ajuda pra fechar seu pedido?" |
| 2 | 💬 **Quase comprou** | nunca comprou; mesmos filtros de conversa; 6+ mensagens | "Oi, {nome}! Ficou alguma dúvida sobre as massas? Posso te ajudar a escolher." |
| 3 | 🔁 **Hora de repetir** | 2+ compras; dias desde a última entre o *ritmo dele* (intervalo médio × 1,2, mínimo 10) e 60; fiéis (4+) primeiro | "Oi, {nome}! Já é hora de repor o {favorito}? Tem aqui pra você." |
| 4 | 🙏 **Primeira compra** | exatamente 1 compra, feita há 3–5 dias | "Oi, {nome}! O que achou do {produto}? Sua opinião ajuda muito a gente." |
| 5 | 😴 **Sumido** | 1+ compra, feita há 31–90 dias; quem gastou mais primeiro; **no máximo 2 por dia** | "Oi, {nome}! Faz um tempinho que você não pede. Quer ver as opções da semana?" |

**Regras gerais da lista**
- **Fica fora:** quem não tem telefone, quem está em "Não chamar mais" e quem já teve qualquer ação nos últimos 7 dias. No caso do "Sumido", a pausa depois de uma mensagem enviada é de 30 dias.
- **Durante o dia a lista não se reembaralha:** o que já foi feito hoje continua aparecendo, marcado.
- **Ajuste:** os limites ficam como constantes no topo do SQL, para calibrar depois de medir.

---

## Implementação

### Banco: `supabase/2026-09-17-crm-quem-chamar-hoje.sql` (salvar com LF; aplicar antes do front)

1. **`contacts.do_not_contact_at timestamptz`**, a marca de "Não chamar mais".

2. **Tabela `contact_actions`.**
   - **Colunas:** `id`, `franchise_id text`, `contact_id uuid` (FK com `on delete cascade`), `action_type` (check com os 5 tipos), `action_date date` (padrão: data de SP), `status` (check: `sent`/`skipped`), `created_by uuid`, `created_at`.
   - **Chaves e índices:**
     - `unique (contact_id, action_date)`, que também serve de índice da FK;
     - índice `(franchise_id, action_date)`.
   - **Acesso:**
     - RLS de SELECT: `(select is_admin_or_manager()) or franchise_id = any((select managed_franchise_ids())::text[])`;
     - **sem policy de INSERT/UPDATE**, porque a escrita só passa pela RPC;
     - DELETE só com `(select is_admin())`;
     - `GRANT` explícito para anon, authenticated e service_role (mudança da Data API em 30/10).

3. **`registrar_acao_cliente(p_contact_id, p_action_type, p_status)`**
   - `SECURITY DEFINER`, com `SET search_path='public'`.
   - Pega a unidade **pelo contato**, nunca pelo cliente, e confere o acesso.
   - Faz upsert em `(contact_id, action_date)`.
   - O "Desfazer" é a mesma RPC com `p_status = null`, que apaga a linha de hoje.

4. **`get_daily_customer_actions(p_franchise_id text, p_limit int default 8) returns jsonb`**
   - **Guarda:** a mesma de `get_marketing_attribution`, com `revoke execute … from public, anon`.
   - **Retorno:** `{ itens[], feitos_hoje, sem_telefone_90d, resumo_mes{enviadas, compraram, valor} }`. É uma chamada só e não esbarra no teto de 1.000 linhas.
   - **Etapas (CTEs):**
     - `compras` por contato: `count(distinct sale_date)`, `sale_date <= hoje`, valor líquido = `value − discount_amount + delivery_fee`, intervalo médio = `(última − primeira)/(n−1)`;
     - `conversas`: `vw_bot_conversations` com `started_at >= now()-4d` e `updated_at` entre `now()-48h` e `now()-2h`, sem `converted`, e sem mensagem `direction='human'`;
     - `recentes`: ações já registradas;
     - `candidatos`: `DISTINCT ON contact`, pela prioridade;
     - produto favorito: `LATERAL` só nas linhas finais (mais pedido em 90 dias, com `inventory_items.active` diferente de false e `quantity > 0`).
   - **Telefone:** a igualdade simples `contacts.telefone = contact_phone` usa o índice único (medido: os dois lados estão normalizados).
   - **Datas:** tudo por `(now() at time zone 'America/Sao_Paulo')::date`.

5. **Trigger de compras correta.**
   - Nova `recompute_contact_purchase_stats(uuid)`: recalcula contagem, total e última compra a partir de `sales`.
   - Dispara em AFTER INSERT, AFTER DELETE e AFTER UPDATE OF `contact_id`, `sale_date`, `value`, para o contato antigo e para o novo.
   - Substitui as partes de contato de `update_contact_on_sale` e `revert_contact_on_sale_delete`. A inserção em `daily_unique_contacts` continua.
   - Antes de mexer:
     - conferir `information_schema.triggers`;
     - fazer backup em `_backup_contacts_stats_2026_09_17`.
   - Depois: backfill, conferido **em query separada**.
   - Efeito colateral bom: o `get_customer_intelligence` do robô passa a ler números certos.

6. **Guarda de unidade em `get_franchise_funnel_stats`** (ponto cego 14).

### Front

**Arquivos novos**
- `src/lib/customerActions.js`, só funções puras:
  - `ACTION_TYPES`: rótulo, ícone, cor e motivo de cada tipo;
  - `primeiroNome()`: descarta emoji, nome que é telefone e "Cliente";
  - `nomeCurtoProduto()`: o texto antes de " - ";
  - `escolherVariante(contactId)`: sorteio estável;
  - `montarMensagem(item, {cidade})`;
  - `marcaDoCliente(compras)` e `tomDaRecencia(dias)`.
- `src/lib/customerActions.test.mjs`, no padrão `node:assert` do `financialCalcs.test.mjs`.
- `src/components/clientes/DailyActionsList.jsx`:
  - dois formatos, `variant="compact" | "full"`, com o cartão interno;
  - atualização na hora, antes da resposta do banco;
  - folha de "Pular";
  - Skeleton no carregamento;
  - estado "Tudo em dia";
  - aviso de "sem telefone";
  - dica "use o WhatsApp da unidade" na primeira vez (salva em `localStorage`, com try/catch).

**Arquivos alterados**
- `src/lib/whatsappUtils.js`: `getWhatsAppLink(phone, text?)` passa a aceitar texto, com `encodeURIComponent`. Ganha testes.
- `src/entities/all.js`: wrappers `getDailyCustomerActions` e `registrarAcaoCliente`, com `withTimeout` e lançando erro quando vier `{error}`.
- `src/components/dashboard/FranchiseeDashboard.jsx`:
  - a lista curta entra logo depois do `<PriorityAction>` (~L625), num `useEffect` próprio, **fora** do polling de 5 min;
  - sai o `<SmartActions>` (~L695);
  - saem `generateSmartActions` e a consulta dos 200 contatos. ⚠️ Ela está dentro de `Promise.allSettled`: ajustar os índices e o `queryNames`, ou deixar um `Promise.resolve([])` no lugar.
- `src/components/dashboard/PriorityAction.jsx`: sai o cenário "leads" e a prop `smartActions`.
- **Apagar** `src/components/dashboard/SmartActions.jsx` e `src/lib/smartActions.js`, depois de conferir que ninguém mais importa.
- `src/pages/MyContacts.jsx`:
  - abas controladas por `?aba=hoje|todos`, com Hoje como padrão;
  - chips no lugar das abas mortas;
  - marca do cliente calculada pelas compras;
  - "Mostrar mais";
  - chave "Não chamar mais";
  - `CONTACT_COLUMNS` passa a incluir `do_not_contact_at`;
  - a aba Todos pode ir para `src/components/clientes/ContactsAllTab.jsx`, já que o arquivo tem ~950 linhas.
- **Ícones novos:** `npm run icons:build`, depois `npm run icons:check`.
- **CLAUDE.md do dashboard:**
  - tirar as linhas sobre SmartActions (~L151–152);
  - pôr os 2 arquivos em "Features Removidas";
  - criar uma seção curta "Quem chamar hoje".

**Direção visual** (a skill `frontend-design` entra na implementação)
- Usar os tokens que já existem: `brand`, `ink`, `surface`, `ok`, `warn`. Verde de texto sempre em `text-ok-ink`.
- **Uma ação principal por cartão:** o botão grande do WhatsApp.
- **Cor só para urgência:**
  - motivos 1 e 2 em vermelho `brand`;
  - "Sumido" em dourado `warn`;
  - o resto neutro, sem arco-íris.
- **Linguagem:** motivo em português simples; "lead", "churn" e "segmento" não aparecem.
- **Tamanho de tela:**
  - pensado primeiro para 390 px, com toque de 48 px ou mais;
  - no desktop, grade de 2 colunas.
- **"Tudo em dia"** é uma comemoração leve, sem virar jogo.

### Fase 2 (depois de 2–3 semanas medindo o uso)
- Lembrete matinal por WhatsApp (n8n lê a RPC por unidade): "Bom dia! Hoje tem 8 clientes pra você chamar", com link.
- **Visão do CS:**
  - sinal no Radar "unidade não usa a lista há 7 dias";
  - R$ que veio depois dos contatos, por unidade, no Mural do Celso.
- **Ficha do cliente** (bottom sheet): últimas compras com itens, favoritos, histórico de contatos.
- Confirmar o "enviado" pelas mensagens `direction='human'`, não só pelo clique.
- Número no ícone "Clientes" da barra de navegação.
- Busca e paginação no servidor na aba Todos.
- Aba Hoje para o admin, com seletor de unidade.
- Textos editáveis pela franqueadora e teste A/B das variações.

### Tutorial e anúncio para a rede (entra depois do deploy da fase 1)

É **um conteúdo só, aberto de 3 lugares**. Não se cria página de ajuda nova.

1. **Guia ilustrado em Tutoriais.** O item `clientes` de [Tutoriais.jsx](src/pages/Tutoriais.jsx) (~L134) está **desatualizado**: cita "Responder", "Negociando" e "Sumidos".
   - O item é reescrito como **"Quem chamar hoje"**, com passos novos:
     - abrir a lista;
     - ler o motivo;
     - Chamar;
     - Pular / Não chamar mais;
     - aba Todos e marcas;
     - usar o WhatsApp da unidade;
     - quem chama, responde.
   - O `StepGuide` passa a aceitar **imagem por passo** (`steps: [{ text, image }]`, sem quebrar os itens que só têm texto).
   - O `youtubeId` antigo sai. O vídeo novo entra quando for gravado; até lá, fica só o guia ilustrado.
2. **Ajuda no ponto de uso.**
   - Um link **"Como funciona?"** no topo da aba Hoje, e na dica de primeiro uso do cartão da Início.
   - O link abre `/Tutoriais?abrir=clientes`, que já mostra o guia aberto (Tutoriais passa a ler esse parâmetro).
3. **Imagens feitas com `/design`** (skill `frontend-design`).
   - **Base:** prints do harness `.tmp/harness` com uma **unidade fictícia** (nomes e números inventados), a 390 px.
   - **Formato:** montados como cartões de passo, com seta, destaque e 1 frase curta, na paleta da marca.
   - **Arquivos:** `public/tutoriais/quem-chamar-hoje-{1..5}.webp`.
   - **Checagem antes de gerar:** guard de acentuação no HTML fonte ("Não", "você", "Início"...), porque o guard de texto não enxerga o que virou pixel.
   - **Mesmas imagens, dois usos:** no guia e no **anúncio do grupo "Franquia Maxi Massas"**, enviado por `bots/vendedor/scripts/enviar-grupo-franquias.mjs`. Nenhum número de unidade real aparece.

**Verificação:**
- o harness abre `/Tutoriais?abrir=clientes` com o guia visível;
- as imagens carregam a 390 px;
- o texto das imagens passa no guard;
- o anúncio só sai **depois** da aprovação do Nelson.

---

## Verificação

1. **SQL, antes do front.** Rodar via MCP com `set_config('request.jwt.claims')` e os dois CTEs `materialized`. Conferir:
   - usuário de outra unidade e `anon` → nada; `get_franchise_funnel_stats` de outra unidade → nada;
   - nenhum contato repetido na lista;
   - ninguém sem telefone ou em "Não chamar mais";
   - nenhuma conversa ativa nas últimas 2h;
   - ninguém com venda depois da conversa;
   - `registrar_acao_cliente` chamado 2× → 1 linha; com contato de outra unidade → erro;
   - distribuição por motivo em todas as unidades ativas (mínimo, mediana e máximo): nenhuma unidade com clientes fica com a lista vazia;
   - checagem manual em Suzano (robô e volume), Itaquera (recompra alta) e Santos (sem robô): 5 casos por motivo, batendo com as vendas;
   - `EXPLAIN ANALYZE` do corpo copiado da função, na maior unidade (3.037 contatos): **menos de 150 ms**.
2. **Trigger.** Testar dentro de `do $$ … raise exception $$`, que desfaz tudo:
   - venda antiga **não** move a última compra;
   - apagar a venda mais recente **volta** a data;
   - backfill → 0 divergências entre `contacts` e `sales` (conferir em query separada).
3. **Testes puros:**
   - `node src/lib/customerActions.test.mjs`: sem favorito, nome vazio ou que é telefone, emoji e acento no `encodeURIComponent`, sem palavra proibida ("separar", "reservar", "desconto");
   - `node src/lib/whatsappUtils.test.mjs`: telefone estrangeiro com texto;
   - os que já existem: `financialCalcs`, `franchiseUtils`.
4. **Build:** `npm run lint`, `npm run lint:undef`, `npm run icons:check`, `npm run build`.
5. **Tela sem login.** Harness com mocks das 2 wrappers novas + Edge a 390 px, cobrindo:
   - Início com a lista, Hoje, Todos com chips e o estado vazio;
   - nome longo (`getBoundingClientRect`);
   - o fluxo Chamar → feito → Desfazer → Pular → Não chamar mais.
6. **Deploy** (processo do CLAUDE.md): migração primeiro, depois push + `deploy.mjs`. Conferir **por conteúdo**:
   - `index-*.js` tem "Quem chamar hoje" e não tem mais "Outras Ações";
   - `MyContacts-*.js` não tem "Negociando".
7. **Uma semana depois:** medir adesão (`contact_actions` por unidade) e compras em até 7 dias. Calibrar os limites e decidir a fase 2.
