# Padrão visual do admin (e, depois, do franqueado)

> Criado em 26/09/2026 a partir das revisões das telas Hoje, Unidades, Ficha, Pedidos, Financeiro e Marketing.
> Prints usados: `.tmp/fase1/shots/` (prévia com mocks e dados reais de 26/09, **anteriores à Onda 1**). A pasta
> `.tmp/validacao/shots/` não existe: a captura em produção não rodou. Pedidos, Financeiro, Marketing e Ficha foram
> julgados pelo código. Tokens conferidos em `tailwind.config.js` e `src/components/ui/*`.
>
> Regra de ouro: **o padrão é o que Unidades, Ficha e Financeiro já fazem**. Hoje, Marketing e Customer Success
> são as telas que fogem dele. O que não estiver aqui segue `src/components/ui/*` e o CLAUDE.md do dashboard.
>
> **Peças prontas (26/09, Onda 1):** use os componentes de `src/components/shared/` (seção 0) em vez de
> copiar classes. Cada arquivo traz a API num comentário no topo.

## 0. Componentes compartilhados

| Peça | Arquivo | Cobre |
|---|---|---|
| Classes do padrão (constantes) | `shared/adminUi.js` | `PAGINA`/`PAGINA_LARGA` (P1/P2), `H1`, `SUBTITULO`, `LINK_VOLTAR`, `CARTAO`/`CARTAO_CLICAVEL`/`H3_CARTAO` (K1/K2/K11), `TOM_MAXI`/`TOM_CHEGADA`/`TOM_ATENCAO` (K5), `ROTULO`/`NUMERO_GRANDE`/`COMPARACAO` (K6), `H2`, `BTN_PRIMARIO`/`BTN_SECUNDARIO`/`BTN_CONTORNO_MARCA`/`LINK_ACAO` (B1–B4), `LISTA`/`CABECALHO_LISTA` (T1/T3), `CHIP*` (F1–F3) |
| Cabeçalho da página | `shared/PageHeader.jsx` | C1–C10: `voltar` ("← Voltar para X"), `acima` (data da saudação), `titulo`, `subtitulo`, slot `mes`, `situacao` (C9), slot `acao`. Exporta também `BuscaCabecalho` (C5–C7) e `AcaoPrincipal` (B1 h-11; ícone de 44 px no celular) |
| Seletor de mês | `shared/MonthStepper.jsx` | C8 (extraído do Financeiro): `mes`, `min`, `max`, `onChange` em "yyyy-MM" |
| Mais ações | `shared/MaisAcoesMenu.jsx` | C11, C12, B7: 1 item vira botão secundário, 0 itens não renderiza, `perigo: true` em `text-err`. `pedidos/MaisAcoesMenu.jsx` virou reexport |
| Faixa "Você veio de X" | `shared/ArrivalBanner.jsx` | V1–V6. Default genérico (`origem`, `quantidade`, `oQueFazer`, `repare`, `saida`); `ArrivalBannerFiltro` é a versão da tela Unidades (o "Repare" já nomeia as unidades e o mês) e `unidades/ArrivalBanner.jsx` virou reexport dela |
| Título de seção | `shared/SectionTitle.jsx` | S1/S2 + link à direita no desktop (B6) |
| Seção sem pendência | `shared/NadaPendente.jsx` | E4 |
| Vazio / erro | `shared/EmptyState.jsx`, `shared/ErrorState.jsx` | E2/E3; prop `cartao` embrulha no K1. Botão de erro diz "Tentar de novo" |

Galeria (prévia sem login): `npx vite --config .tmp/harness-shared/vite.config.mjs` → `:5199`; prints em `.tmp/onda1/padrao/shared/`.

## 1. Página

| # | Regra | Classes |
|---|---|---|
| P1 | Toda página admin usa o mesmo invólucro | `mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8` |
| P2 | Exceção de largura só no quadro Kanban do Mural (colunas lado a lado) | mesmo padding, `max-w-none` |
| P3 | Espaço entre blocos da página = `space-y-6`. Dentro de um bloco = `space-y-3` (lista) ou `gap-3` (grade) | nunca `space-y-5`/`space-y-7` misturados |
| P4 | Fundo da página vem do Layout (`bg-surface`); a página não repinta o fundo | tirar `bg-surface` das páginas |
| P5 | No celular o conteúdo não fica atrás da barra de baixo | último bloco com `pb-24 md:pb-0` quando houver barra fixa própria (Ficha: `pb-36`) |

## 2. Cabeçalho da página

```
[← Voltar para X]                                  (só quando veio de outra tela)
Título                                  [seletor de mês] [ação principal]
Subtítulo de uma frase
```

| # | Regra | Classes |
|---|---|---|
| C1 | Contêiner do cabeçalho | `flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between` |
| C2 | Título h1, **sem ícone** | `font-plus-jakarta text-2xl sm:text-3xl font-extrabold tracking-tight text-ink` |
| C3 | Subtítulo: uma frase que diz o trabalho da tela, sem dica de teclado | `mt-1 max-w-2xl text-sm text-ink-2` |
| C4 | Volta: texto completo "← Voltar para Hoje" (nunca só "← Hoje") | `text-sm font-semibold text-brand-dark hover:underline` |
| C5 | Controles do cabeçalho têm a mesma altura | `h-11 rounded-xl` (busca, ação, caixa do seletor de mês) |
| C6 | Busca ocupa a linha inteira no celular; a ação fica ao lado dela | busca `flex-1 sm:w-72`; ação "Nova X" como ícone `add` 44 px no celular |
| C7 | Placeholder da busca cabe em 390 px e em 1440 px | até ~24 caracteres ("Buscar unidade ou pessoa"); texto completo no `sr-only` |
| C8 | Seletor de mês = o do Financeiro | caixa `rounded-xl border border-surface-line bg-white p-1`; setas `h-10 w-10 rounded-lg text-ink-2 hover:bg-surface`, `aria-label="Mês anterior"/"Próximo mês"`; mês `min-w-[140px] text-sm font-semibold text-ink` |
| C9 | Tela que mostra situação atual (não do mês) põe no lugar do seletor | `text-sm text-ink-3`: "Situação de hoje, 26/09" |
| C10 | Hoje é a única com saudação: data acima (`text-sm text-ink-3`) e a saudação usa a mesma classe de C2 | nada de `md:text-[32px]` |
| C11 | Ações raras ou perigosas (excluir, reajustar valor de todos, cadastro em lote) ficam em "Mais ações", nunca soltas ao lado da ação principal | `components/shared/MaisAcoesMenu.jsx` |
| C12 | Menu "Mais ações" com um só item não existe: vira botão secundário | — |

## 3. Cartões

| # | Regra | Classes |
|---|---|---|
| K1 | Cartão padrão: plano, sem sombra | `rounded-2xl border border-surface-line bg-white p-4 sm:p-5` |
| K2 | Cartão clicável (a linha inteira é link) | K1 + `transition-colors hover:bg-surface` |
| K3 | Sombra só no que flutua (menu, diálogo, sheet) | `shadow-lg`; nunca `shadow`/`shadow-sm` em cartão da página |
| K4 | Borda só com `border-surface-line` | nunca `border-ink-shadow/5`, `/10`, `/20` nem hex |
| K5 | Cartão de tom (usar só estes 3) | Maxi/CS: `bg-brand-gold-soft border-brand-gold-line`; chegada: `bg-brand-soft` sem borda; atenção: `bg-warn-soft border-warn/40` |
| K6 | Número grande (indicador) | rótulo `text-xs font-bold uppercase tracking-wide text-ink-3` em **uma linha no celular**; valor `mt-2 font-plus-jakarta text-2xl sm:text-3xl font-extrabold tabular-nums text-ink`; linha de comparação `mt-1 text-sm text-ink-2` |
| K7 | Na comparação só o número ganha cor, o resto fica `text-ink-2` | `<span class="font-semibold text-err">−4,6%</span> contra 1 a 26 de agosto` |
| K8 | Comparação sempre diz o trecho: "contra 1 a 26 de agosto", igual em Hoje, Financeiro e Ficha | `trechoMesAnteriorLabel(mes)` |
| K9 | Grade de indicadores: 3 no desktop; no celular o principal ocupa as 2 colunas e os outros ficam lado a lado | `grid grid-cols-2 gap-3 md:grid-cols-3`, 1º cartão `col-span-2 md:col-span-1` |
| K10 | Ícone de linha (tile) | `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-{tom}-soft text-{tom}`; ícone 20 |
| K11 | Título dentro de cartão (h3) | `font-plus-jakarta text-base font-bold text-ink` |

## 4. Títulos de seção

| # | Regra | Classes |
|---|---|---|
| S1 | h2 fora de cartão, com ajuda na mesma linha | `flex flex-wrap items-baseline gap-x-3 gap-y-1`; h2 `font-plus-jakarta text-xl font-bold text-ink`; ajuda `text-sm text-ink-3` |
| S2 | Seções de fluxo numeradas quando há ordem ("1. Para confirmar") | mesmo h2 de S1 (nunca `text-lg`) |
| S3 | Sem h2 em caixa alta; caixa alta só em rótulo (K6) e cabeçalho de tabela (T3) | — |

## 5. Botões e links de ação

| # | Tipo | Classes |
|---|---|---|
| B1 | Primário (1 por bloco) | `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark` |
| B2 | Secundário | `inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink-2 hover:bg-surface` |
| B3 | Contorno da marca (só em faixa de tom) | B2 trocando para `border-brand-dark text-brand-dark` |
| B4 | Link de ação: **verbo + quantidade + " →"** ("Ver as 5 e o que fazer →", "Abrir ficha →", "Cobrar no WhatsApp →") | `inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline whitespace-nowrap` |
| B5 | Seta é texto "→"/"←", não ícone | — |
| B6 | Link de ação alinhado à direita da linha no desktop, embaixo no celular | linha `md:flex-row md:items-center`, link `md:ml-auto` |
| B7 | Perigo (excluir, cancelar assinatura) só dentro de "Mais ações" ou do diálogo de confirmação | `text-err`; no diálogo, `AlertDialog` |
| B8 | Área de toque mínima de 40 px em tudo que clica (inclui checkbox) | `min-h-10`; checkbox `h-5 w-5` dentro de `label -m-2 p-2` |
| B9 | Botão shadcn (`Button`) serve, mas com `className` de B1/B2: o `h-9 rounded-md` padrão dele fica fora do padrão | `h-7`/`h-8`/`size="sm"` proibidos no admin |
| B10 | Ação sem dado para agir não vira texto cinza morto: vira o caminho para resolver ("Cadastrar telefone →") | — |

## 6. Chips de filtro × abas

| # | Regra | Classes |
|---|---|---|
| F1 | Chip = filtro de uma lista. Rótulo "Nome · N" | `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm` |
| F2 | Chip ativo | `border-brand-dark bg-brand-dark font-semibold text-white` |
| F3 | Chip inativo | `border-surface-line bg-white font-medium text-ink-2 hover:bg-surface` |
| F4 | Fileira: rola no celular e quebra no desktop | `-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible` (componente `FiltroChips`) |
| F5 | Chip sem número útil fica sem contador ("Mais venderam", não "Mais venderam · 66") | — |
| F6 | Chip de mês nomeia o mês ("Sem verba de setembro") | `rotuloMesVerba` |
| F7 | Aba = seção da página (Financeiro). Sublinhado, nunca pílula | `role="tablist"`, `border-b border-surface-line`; aba `-mb-px min-h-11 border-b-2 px-3 text-sm`, ativa `border-brand text-ink font-semibold` |
| F8 | Filtro ativo fica na URL (`?filtro=`, `?situacao=`), para link de outra tela abrir já filtrado | nunca só `useState` |

## 7. Faixa "Você veio de X"

| # | Regra |
|---|---|
| V1 | Aparece sempre que a tela abre filtrada vindo de outra (Hoje → Unidades, Fechamento → Mensalidades, Hoje → Pedidos, Hoje → Marketing). Um componente só: `components/shared/ArrivalBanner.jsx` |
| V2 | Caixa `flex flex-col gap-3 rounded-2xl bg-brand-soft p-5 sm:flex-row sm:items-start sm:gap-5` |
| V3 | Linha 1 `text-xs font-bold uppercase tracking-wide text-brand-dark`: "Você veio de: {filtro} · N unidades" |
| V4 | Linha 2 `text-base leading-snug text-ink`: **O que fazer:** uma frase com verbo |
| V5 | "Repare" (opcional) `text-sm text-ink-2`: nomeia as unidades e o mês; nunca só "3 das 5" |
| V6 | Botão de saída B3: "Ver todas as N" |

## 8. Tabelas e listas

Desktop:

| # | Regra | Classes |
|---|---|---|
| T1 | Lista dentro de um cartão | `overflow-hidden rounded-2xl border border-surface-line bg-white` |
| T2 | Linhas em grade CSS (não `<table>` com rolagem lateral) | `md:grid md:grid-cols-[...] items-center gap-4 px-5 py-4 border-t border-surface-line hover:bg-surface` |
| T3 | Cabeçalho em **uma linha**; rótulo curto | `bg-surface-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-3 whitespace-nowrap` |
| T4 | Coluna 1: nome `font-semibold text-ink` + linha de apoio `text-sm text-ink-3` | nome sempre por `nomeCurto` (sem "Maxi Massas") |
| T5 | Número `tabular-nums`, alinhado à direita na coluna | `text-right tabular-nums` |
| T6 | Última coluna = um link de ação B4 em uma linha | "WhatsApp →" / "Abrir ficha →" |
| T7 | Valor em lista: `formatBRLInteger`; centavos só no detalhe (`formatBRL`) | — |
| T8 | Nenhuma coluna mostra o que a ordenação não usa: se a lista está ordenada por X, X aparece | — |

Celular (< md):

| # | Regra |
|---|---|
| T9 | Cada item vira cartão de **no máximo 3 linhas**: (1) nome + 1º sinal como chip colorido; (2) o número que importa para aquele filtro + a apoio `text-sm tabular-nums`; (3) link B4 à direita. Nada de grade rótulo/valor de 5 linhas |
| T10 | Nenhum valor é cortado por `truncate`: trunca o nome, nunca o número |
| T11 | Texto mínimo 12 px (`text-xs`). `text-[11px]` e `text-[10px]` proibidos |
| T12 | Tabela com `overflow-x-auto` no celular é proibida |

## 9. Estados

| # | Estado | Regra |
|---|---|---|
| E1 | Carregando | `Skeleton` com o formato do conteúdo (`h-32 rounded-2xl` indicador, `h-14 rounded-xl` linha, `h-10 max-w-md rounded-full` chips) + `motion-reduce:animate-none`. Nunca "Carregando..." em texto nem spinner |
| E2 | Erro | `ErrorState` (`components/shared/ErrorState.jsx`) dentro de um cartão K1: ícone `cloud_off`, "Não deu para carregar", botão "Tentar de novo". Nunca `error.message` cru |
| E3 | Vazio de página/lista | `EmptyState` com a próxima ação ("Limpar busca", "Escolher outro mês") |
| E4 | Seção sem pendência | uma linha em cartão K1: ícone `check_circle` `text-ok-ink` + "Nada para confirmar agora." A seção não some (a pessoa precisa ver que conferiu) |
| E5 | Dado ausente ≠ zero | "Ainda sem clientes com compra", "Robô ainda não conversou", "Primeira cobrança ainda não gerada". Nunca "0 de 0" nem "Em dia" sem cobrança |

## 10. Cor, fonte e ícone

| # | Regra |
|---|---|
| R1 | Só tokens: `ink`, `ink-2`, `ink-3`, `ink-4`, `surface`, `surface-2`, `surface-line`, `brand`, `brand-dark`, `brand-soft`, `brand-gold*`, `ok*`, `warn*`, `err*`. Proibido `text-gray-*`, `bg-red-*`, `text-green-*`, `#hex` e `style={{color}}` |
| R2 | Semântica: `text-err` = atraso, não pagou, queda, parado; `text-ok-ink` = texto positivo (`text-ok` só em ícone); `text-warn-ink` = atenção; `brand-dark` = link e item ativo; `brand-gold` só decoração, nunca texto |
| R3 | Contador no menu lateral: neutro (`bg-surface-2 text-ink-2 border border-surface-line`). Vermelho só quando é atraso |
| R4 | Pesos: h1 e número grande `font-extrabold`; h2/h3 `font-bold`; link e botão `font-semibold`; rótulo caixa alta `font-bold`; texto corrido normal |
| R5 | Fontes: `font-plus-jakarta` em h1, h2, h3 e número grande; o resto é Inter (padrão do body) |
| R6 | Ícone só `MaterialIcon` contornado (outlined); no menu lateral todos iguais (nada de preenchido em "Mais") |
| R7 | Tamanhos: 16 dentro de texto, 18 em botão e busca, 20 em tile K10, 36 a 48 em estado vazio/erro |
| R8 | Texto: título e link não usam `truncate`; lista de nomes usa `line-clamp-2` e termina em "e mais N" |
| R9 | Mês sempre pelo nome ("verba de setembro"), nunca "do mês" |

## 11. Como conferir (antes de deploy)

```bash
# cor crua nas telas do admin (deve voltar vazio)
grep -rnE "text-gray-|bg-red-|text-red-|text-green-|#[0-9a-fA-F]{6}|style=\{\{ ?color" src/pages/{Unidades,Unidade,PurchaseOrders,Financeiro,Marketing,CustomerSuccess}.jsx src/components/{dashboard/hoje,unidade,unidades,pedidos,financeiro,marketing/admin}
# sombra em cartão, borda fora do token, texto menor que 12 px, botão pequeno
grep -rnE "shadow-sm|border-ink-shadow/|text-\[1[01]px\]|h-7 |h-8 |size=\"sm\"" <mesmos caminhos>
# "Carregando..." em texto
grep -rn "Carregando\.\.\." <mesmos caminhos>
```
Em 26/09 o grep de cor crua acusa: `pages/Marketing.jsx` (46), `financeiro/AsaasSetupPanel.jsx` (25), `pedidos/OrderDetailDialog.jsx` (18), `marketing/MarketingPaymentsAdmin.jsx` (4).

## 12. Onde cada tela foge (resumo)

| Tela | Desvio | Correção |
|---|---|---|
| Hoje (`AdminHoje.jsx`) | invólucro `max-w-[1400px] p-4 md:p-8 space-y-7 bg-surface`; saudação `md:text-[32px]` | P1, P3, C10 |
| Hoje (`ResumoRedeCards.jsx`) | `shadow-sm border-ink-shadow/5`; rótulo quebra em 2 linhas; comparação toda colorida; 3 cartões empilhados (~460 px) no celular | K1, K6, K7, K9 |
| Hoje (`QuemPrecisaDeVoce.jsx`) | `border-ink-shadow/10`; link fica colado ao texto no meio da linha (linhas 2 e 3 do print); linhas pequenas cortadas com "..." | K4, B6, R8 |
| Hoje (`PendenciasGrid.jsx`) | `rounded-xl border-ink-shadow/10` | K1 |
| Unidades | "← Hoje"; busca não ocupa a linha no celular e "Nova unidade" desce para outra linha; cabeçalho da tabela em 2 linhas; "Chamar no WhatsApp →" em 2 linhas; cartão de 6 linhas no celular com rótulo 11 px | C4, C6, C7, T3, T6, T9, T11 |
| Ficha | 3 links de navegação antes do diagnóstico no celular; "Assumir" é link de ~20 px; métricas em 1 coluna no celular; "Sem telefone" como texto morto | B8, B10, K9 (`grid-cols-2 lg:grid-cols-4`) |
| Pedidos | "Excluir" solto entre as ações do lote; "Mais ações" com 1 item; h2 `text-lg`; Entregues com "Carregando...", botões sem `min-h-10`, checkbox `h-4`; detalhe com hex e `bg-red-100`; subtítulo fala de Enter | C11, C12, S2, E1, B8, R1, C3 |
| Financeiro · Mensalidades | tabela de 8 colunas com rolagem lateral; `h-7`/`h-8`; `text-gray-*` e `#d4af37` inline; cadastro e "Atualizar valor de todos" no topo; filtro só em `useState` | T2, T9, T12, B9, R1, C11, F8 |
| Financeiro · Fechamento | nome e valor no mesmo `truncate` no celular; "Mais venderam · 66"; seletor de mês some nas outras abas | T10, F5, C9 |
| Marketing | página `p-6 bg-surface`; subtítulo `text-gray-500`; título `font-bold`; `Card border-0 shadow-sm`; links sem 40 px | P1, C2, C3, K1, B8, R1 |
| Customer Success | título com ícone e `font-bold`; `size="sm"`; invólucro sem `max-w` | C2, B1, P2 |
| Menu lateral (`Layout.jsx`) | contador vermelho em Pedidos (não é atraso); ícones preenchidos no grupo "Mais" | R3, R6 |

## 13. Lado do franqueado (depois)

Vale o mesmo padrão, com três diferenças: (1) o cabeçalho pode ter o seletor híbrido `[Hoje][Semana][◀ Mês ▶][Personalizado]` (já documentado no CLAUDE.md); (2) a ação principal da tela pode ser o FAB "Vender" no celular; (3) linguagem de segunda pessoa ("seus clientes"). O resto (cartão, botão, chip, estados, cores) não muda.
