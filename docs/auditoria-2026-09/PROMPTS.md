# Prompts da auditoria — FranchiseFlow, 07/09/2026

Seis frentes, rodando em paralelo com **Fable 5.1** (`claude-fable-5-1`), cada uma com o mesmo
pacote de contexto (`00-CONTEXTO.md` + `00b-CLARITY-3DIAS.md`) e uma missão que não se sobrepõe às outras.

**Cabeçalho comum a todos** (colado no início de cada prompt):

> Você está auditando o FranchiseFlow, o dashboard de gestão da rede Maxi Massas.
> Diretório: `c:/Users/nelpn/OneDrive/Arquivos e Documentos/Agents/MaxiMassas/apps/dashboard`.
>
> **Leia PRIMEIRO, na ordem:** `docs/auditoria-2026-09/00-CONTEXTO.md` (fatos medidos, as 2 personas,
> as regras que você não pode violar e o formato obrigatório de cada achado),
> `docs/auditoria-2026-09/00b-CLARITY-3DIAS.md` (dados reais do Clarity) e o `CLAUDE.md` do dashboard
> (gotchas de produção — muita coisa que parece bug já foi decidida de propósito; a seção
> "Features Removidas" lista o que é proibido propor recriar).
>
> Regras de trabalho: leia o código de verdade antes de afirmar (o repo tem 35 mil linhas — vá nos
> arquivos, não deduza pelo nome); toda afirmação com `arquivo:linha`; nada de conselho genérico de
> blog; se não conseguiu verificar, escreva `⚠️ NÃO VERIFICADO`. **Não edite nenhum arquivo de
> `src/`** — esta rodada é diagnóstico. Seu único write é o seu relatório.
>
> Entregue em `docs/auditoria-2026-09/<NN>-<frente>.md` e devolva no chat um resumo de no máximo
> 25 linhas com os 5 achados de maior (impacto x alcance) / esforço.

---

## 01 — Performance e carregamento

Missão: por que o app demora a ficar útil, e onde o tempo vai embora.

Investigue e quantifique:

1. **Primeira pintura.** ~253 KB gzip antes de qualquer dado. O que dá pra tirar do caminho crítico?
   `Dashboard` é import estático e decide admin x franqueado em runtime — os dois painéis viajam no
   mesmo chunk. `Vendas` também é estático. Vale a pena? Meça o que cada um arrasta junto.
2. **A cascata de dados de cada tela.** Para as 5 telas de maior tráfego (Vendas, Gestao, Dashboard,
   MyContacts, FranchiseSettings): quantas requisições, em série ou paralelo, quantas linhas, e
   quanto tempo até a primeira informação útil aparecer. `fetchAll: true` pagina de 1000 em 1000 —
   diga onde isso hoje já custa segundos e onde vai custar quando a rede crescer.
3. **`TabResultado` carrega o histórico inteiro sem janela de data.** Meça o pior caso real
   (a franquia com mais vendas) e proponha o corte.
4. **react-query está montado e praticamente não é usado.** Avalie honestamente: adotar de verdade
   nas telas de maior tráfego (cache entre navegações, dedupe, `staleTime`) vale o refactor, ou é
   melhor remover a dependência? Recomende **um** caminho, com o custo dos dois.
5. **Polling.** `useVisibilityPolling` em 7 telas com throttle de 60 s. Some quantos requests isso dá
   por franqueado por dia e diga se algum é desperdício puro.
6. **Sinal do Clarity que é performance, não UX:** `/` no celular com 7% de tempo ativo e
   `/Dashboard` com 11% e 75% de QuickbackClick. Vá no código do boot (`main.jsx`, `App.jsx`,
   `AuthContext.jsx`, `Layout.jsx`) e explique **onde exatamente** o usuário fica esperando —
   quantos round-trips entre abrir o app e ver o primeiro número.
7. Custos escondidos: fontes do Google Fonts bloqueando, Clarity síncrono no `<head>`, imagens,
   `index.css` de 102 KB, ausência de `React.memo`/virtualização em listas longas
   (TabEstoque com centenas de itens, MyContacts, TabLancar).

Entregue também um **orçamento de performance proposto** (KB gzip no caminho crítico, tempo até o
primeiro número na tela) e o que medir para provar que melhorou.

---

## 02 — Arquitetura e integridade do código

Missão: o que na estrutura de hoje já está cobrando juros — e o que vai quebrar calado.

1. **Camadas.** `entities/all.js` (455 linhas) é a única porta pro banco. Onde o contrato vaza
   (`fetch` direto, `supabase.from`, RPC chamada fora do adapter, `columns` enxuto sem pre-flight)?
2. **Arquivos de 1200-1600 linhas** (PurchaseOrders, TabEstoque, Franchises, SaleForm, Marketing,
   FranchiseSettings, TabResultado, TabLancar). Para cada um: qual é a costura natural de corte, e
   qual seria o ganho concreto — não corte por estética.
3. **Estado e efeitos.** `AuthContext` admite race conditions resolvidas com refs e timeouts de
   8 s/10 s e "não há mutex". Mapeie os caminhos onde ainda dá pra ficar preso em loading, deslogado
   por engano, ou com a franquia errada selecionada (`resolveActiveFranchise`, `selectedFranchise`,
   `localStorage`).
4. **A classe de falha mais cara deste projeto: tela branca.** `no-undef` desligado + Rollup tratando
   símbolo não-importado como global. Diga quantas ocorrências de risco existem hoje (varra `src/`)
   e proponha a guarda mais barata que fecha o buraco de vez (config do ESLint, script de CI,
   smoke test) — com o comando exato.
5. **Duplicação de regra de negócio.** Procure a mesma regra escrita em mais de um lugar
   (cálculo de dinheiro, label de pagamento, formatação de data, resolução de endereço, filtro de
   catálogo padrão). Cada duplicata é um bug futuro em que um lado muda e o outro não.
6. **Cobertura real.** Só existem 4 arquivos `*.test.mjs` (`financialCalcs`, `franchiseUtils`,
   `addressUtils`, `documentUtils`, `productWeight`). O que mais mexe com dinheiro, estoque ou
   permissão e **não** tem teste? Liste em ordem de risco.
7. **Segurança e permissão no cliente.** `ADMIN_ONLY_PAGES`/`CS_PAGES` são gates de rota; a RLS é a
   defesa real. Aponte onde o app confia no cliente para algo que a RLS não cobre.
8. **Dependências.** Diga o que está instalado e não é usado, e o que é usado de um jeito que custa
   caro (ex.: `html2canvas` + `jspdf` juntos para exportar).

---

## 03 — CSS, design system e consistência visual

Missão: o app parece uma coisa só? E o CSS está sustentando ou atrapalhando?

1. **Inventário de tokens.** Levante todo hex hardcoded em `src/` (`#b91c1c`, `#d4af37`, `#fbf9fa`,
   `#1b1c1d`, `#4a3d3d`, `#f5f3f0`, `#e9e8e9`...), conte ocorrências e diga quantos são variação
   acidental do mesmo tom. Proponha a lista mínima de tokens (CSS vars ou `tailwind.config`) e
   **como migrar sem big bang**.
2. **Escala tipográfica e de espaçamento.** Quantos tamanhos de fonte diferentes existem de fato?
   Quantos raios de borda, sombras, alturas de botão? Corte para uma escala defensável.
3. **`index.css` com 102 KB bruto.** É Tailwind não podado, CSS morto, ou legítimo? Prove.
4. **shadcn parcial.** Sobraram 21 componentes em `ui/` depois da limpeza de 02/07. Onde a tela
   reimplementa na mão algo que o componente já faz (e diverge no estilo)?
5. **Estados que todo componente de dado precisa ter**: loading (Skeleton, não spinner), vazio,
   erro, e "sem permissão". Faça a matriz tela x estado e aponte os buracos — empty state faltando é
   o que faz o franqueado achar que o app quebrou.
6. **Responsividade.** O app é ~50% celular. Ache o que estoura em 430 px, o que tem alvo de toque
   abaixo de 48 px, e onde tabela densa vira ilegível no telefone (o padrão do projeto é card no
   mobile — veja quem não seguiu).
7. **Acessibilidade prática**: contraste do vermelho sobre fundos claros, foco visível, `aria-label`
   nos botões só-ícone, texto abaixo de 14 px em tela de operação.
8. **Impressão.** `SaleReceipt` (cupom térmico 58/80 mm) e `pickingSheetPdf` (ficha do motorista)
   têm regras próprias e frágeis — confira se o CSS de impressão continua íntegro e diga o que
   testar antes de mexer.

Entregue um **mini design system em uma página** (tokens, escala, componentes canônicos) que caiba
no que já existe — nada de propor rebrand.

---

## 04 — UX do FRANQUEADO

Missão: a pessoa está no celular, com cliente esperando. Cada segundo e cada toque contam.

Percorra o fluxo real lendo o código: entra -> `FranchiseeDashboard` -> lança venda (`SaleForm`) ->
imprime cupom -> confere estoque (`TabEstoque`) -> repõe (`TabReposicao`/`PurchaseOrderForm`) ->
olha resultado (`TabResultado`) -> paga marketing e mensalidade -> configura o robô
(`FranchiseSettings`) -> `MyContacts` -> `Onboarding`/`MyChecklist`.

1. **Ataque os dead clicks com endereço:** `/Vendas` PC 253 (é a tela de maior volume do app),
   `/Gestao` PC 111 a 25,3%, `/FranchiseSettings` PC 37 a 26,3%, `/MyContacts` PC 25 a 19,3%.
   Para cada um, ache no código o elemento que **parece** clicável e não é (ou é clicável e não
   parece) e proponha a correção. Padrões já validados aqui: display calculado colado em input
   editável, alvo <48 px, card com filho interativo, texto que parece link.
2. **`/Dashboard` no celular: 75% de QuickbackClick e 11% de tempo ativo.** A tela inicial do
   franqueado não está entregando. Diga o que ela mostra hoje, o que a pessoa foi buscar
   (venda de hoje? o que falta fazer? quanto sobrou?) e reprojete a ordem dos blocos.
3. **`SaleForm`** (1382 linhas) é o coração do app. Conte quantos toques leva uma venda típica
   (cliente conhecido, 3 itens, PIX, entrega) e onde dá pra cortar. Veja o que já vem preenchido e
   o que a pessoa redigita todo dia.
4. **Leitura de números.** O franqueado precisa entender "quanto entrou, quanto sobrou, o que fazer
   agora" sem saber o que é DRE. Avalie `TabResultado`, `ResumoAnoCard`, o card de Conversão e o
   ranking: o que está em jargão, o que está em precisão inútil (centavos), o que falta de
   comparação (contra o mês passado, contra a rede).
5. **Erro e silêncio.** Ache todo `return` de validação sem `toast` (clique que não faz nada é a
   falha mais cara do app), toda promessa que não confirma, todo estado de sucesso que mente.
6. **O que o franqueado tem e não usa.** Cruze as sessões do Clarity com as features: Marketing com
   18% de tempo ativo e scroll 63; Tutoriais com 7 sessões; PurchaseOrders com 4; MyChecklist.
   O que é feature morta, o que é feature escondida, o que é feature que ninguém entendeu?
7. **O que a franqueada pergunta no WhatsApp e o app não responde.** Olhe o `CLAUDE.md` (casos
   Suzano, Itápolis, Hortolândia, Americana, Araras) e diga que pergunta recorrente daria uma tela.

---

## 05 — UX do ADMIN / franqueadora

Missão: o painel responde as perguntas de gestão da rede sem exportar pro Excel?

Telas: `AdminDashboard`, `Financeiro` (+ `AsaasSetupPanel`, `MarketingPaymentsAdmin`,
`FranchiseFinanceTable`), `Franchises`, `PurchaseOrders`, `CustomerSuccess` (mural + radar),
`Marketing`, `Onboarding`.

1. **As perguntas de gestão.** Para cada uma, diga em quantos cliques o app responde hoje — ou que
   ela é impossível: quem caiu vs mês passado; quem não vende há N dias; quem está com o robô
   parado; quem deve mensalidade; quanto a rede faturou no mês; quais unidades dão prejuízo;
   qual o efeito do marketing por unidade; quem está atrasado no onboarding; que pedido sai amanhã.
2. **`AdminDashboard`**: 10 queries em `Promise.allSettled`, várias com `fetchAll`. A ordem dos
   blocos (Stats -> mini-cards -> Ranking -> Gráfico -> Alertas colapsado) corresponde à ordem das
   perguntas? O que está colapsado e deveria estar aberto (e vice-versa)?
3. **Visualização de dados.** Onde uma tabela deveria ser gráfico, onde um gráfico deveria ser
   tabela, e onde falta comparação (período anterior, média da rede, meta). Considere que a rede tem
   66 linhas: o que escala e o que vira sopa de números. Regra: nada de gráfico decorativo.
4. **`CustomerSuccess`** (mural Kanban + radar). O Celso trabalha aqui todo dia. O board mostra o
   que ele precisa para ligar para a franqueada com o assunto certo? Veja o bloco "Hoje no radar"
   e os sinais de robô/pagamento; aponte o que falta e o que é ruído.
5. **`Financeiro`**: fechamento de mês, mensalidade ASAAS, marketing. Onde o admin precisa cruzar
   duas telas na mão? Onde a informação de "quem pagou / quem não pagou" está incompleta?
6. **`PurchaseOrders`** (1664 linhas, mas só 4 sessões no Clarity em 3 dias): é a tela de montar
   pedido e ficha de separação. Ou está subutilizada, ou o trabalho está acontecendo fora do app —
   descubra pelo código o que ela faz e o que ela deveria fazer, e diga qual dos dois é o caso.
7. **O que o banco já tem e o painel não mostra.** Você tem acesso ao Supabase (MCP,
   projeto `sulgicnqqopyhulglakd`). Levante tabelas/colunas/RPCs com dado útil e vivo que **nenhuma
   tela consome** — esse é o ponto cego mais caro. Não invente coluna: confira antes de citar.

---

## 06 — Pontos cegos, desperdício e o que existe sem ser usado

Missão: a frente que ninguém pede e que costuma achar o dinheiro no chão.

1. **Código órfão.** Componentes, hooks, libs, entities e rotas com zero consumidor
   (por alcançabilidade a partir de `App.jsx`/`pages.config.js`, não por grep ingênuo).
   Já houve duas limpezas (29/05 e 02/07) — o que voltou a acumular desde então?
2. **Banco sem consumidor e consumidor sem banco.** Tabelas, views, RPCs, triggers e colunas que
   existem e nenhuma tela lê; e o inverso — tela que calcula no cliente algo que já existe pronto
   no banco (ou que deveria virar RPC). Use o MCP do Supabase; cite nomes conferidos.
3. **Integrações pagas/montadas e subaproveitadas**: Clarity (10 requisições/dia de API, revisão
   quinzenal que provavelmente não roda), Meta CAPI em venda manual, ASAAS, n8n, Zuck, notificações.
   Para cada uma: está ligada? alguém olha? qual o próximo uso óbvio de graça?
4. **Trabalho manual recorrente que o app poderia matar.** Vasculhe `CLAUDE.md`, `docs/`,
   `supabase/scripts/`, `.tmp/`: script que roda na mão todo mês, conferência manual, planilha,
   cobrança no WhatsApp, backfill. Cada um é candidato a tela ou cron.
5. **Vigilância que não existe.** 0 erro de script no Clarity é bom, mas ninguém sabe se uma tela
   quebrou pra um franqueado específico. O que dá pra montar barato (error boundary reportando,
   sentinela de falha silenciosa, alerta de venda não lançada)?
6. **Dívida documentada e nunca cobrada.** O `CLAUDE.md` do dashboard tem ~10 gotchas do tipo
   "vai quebrar quando X crescer" (limite de 1000 linhas, `limit N` virando teto silencioso,
   janelas de data ausentes). Liste todos com o gatilho real e diga quais já estouraram sem ninguém ver.
7. **Custo de operação.** Onde o app gasta banda/CPU do Supabase à toa (polling, `fetchAll`,
   queries repetidas por navegação). Estime em requests/dia por usuário.

Termine com **"as 10 coisas que eu desligaria, apagaria ou automatizaria amanhã"**, ordenadas por
tempo economizado por semana.
