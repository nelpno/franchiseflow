# Pacote de contexto — Auditoria FranchiseFlow 2026-09-07

> Fatos MEDIDOS nesta sessão. Use como âncora; não regastar tempo remedindo o que já está aqui.
> Se o que você medir contradisser este arquivo, prevalece o SEU dado novo — e diga que contradisse.

## Produto e as 2 personas

**FranchiseFlow** = dashboard de gestão da rede Maxi Massas (massas artesanais congeladas,
~66 franquias, majoritariamente **home-based**: a "loja" é a casa da pessoa).

| Persona | Quem é | O que faz no app | Contexto de uso |
|---|---|---|---|
| **Franqueado** | dona/dono de 1 unidade (às vezes 2), não-técnico, opera sozinho ou com 1 ajudante | lança venda, imprime cupom, confere estoque, pede à fábrica, paga marketing/mensalidade, vê resultado do mês | **celular, no meio do atendimento**, às vezes com o cliente esperando no WhatsApp |
| **Admin / franqueadora** (Nelson + manager + CS Celso) | gestão da rede | vê ranking e saúde das 66, fecha financeiro, cadastra franquia, cobra mensalidade, monta pedido/logística, mural de CS | desktop, sessão longa, decisão |

Objetivo do Nelson nesta auditoria, textual:
> "facilitar leitura, ajudar franqueado e melhorar visualizações de dados... ver pontos cegos
> e coisas que temos e não usamos ou que não usamos e perdemos tempo."

## Stack e deploy

- React 18 + Vite 6 + Tailwind 3 + shadcn/ui (parcial) + Supabase Cloud + react-router 6
- Deploy: `git push` -> force update do serviço no Portainer (stack 39) -> `app.maximassas.tech`
- `npm run build` / `npm run lint` (eslint --quiet, **`no-undef` DESLIGADO**) / testes: `node src/lib/*.test.mjs`
- Camada de dados: **entity adapter** `src/entities/all.js` — proíbe `supabase.from()` direto nas telas
- Analytics: Microsoft Clarity (projeto `w6o3hwtbya`), script síncrono no `<head>`

## Rotas e code-splitting (medido em `src/pages.config.js`)

Estáticas (entram no chunk de entrada): `Dashboard`, `Vendas`, `Layout`, `Login`, `SetPassword`,
`OnboardingWelcome`, `PageNotFound`, `ErrorBoundary`.
Lazy: CustomerSuccess, Financeiro, FranchiseSettings, Franchises, Gestao, Marketing, MinhaLoja,
MyChecklist, MyContacts, Onboarding, PurchaseOrders, Tutoriais.

Gates: `ADMIN_ONLY_PAGES = {Franchises, PurchaseOrders, Financeiro}`; `CS_PAGES = {CustomerSuccess}`;
`Dashboard` decide franqueado x admin em runtime (`AdminDashboard` vs `FranchiseeDashboard`), então
**os dois dashboards estão no mesmo chunk de entrada** — o franqueado baixa o painel do admin e vice-versa.

## Bundle real (build de 01/09/2026, `dist/assets`, bruto / gzip)

| chunk | bruto | gzip | quando carrega |
|---|---:|---:|---|
| export (jspdf+xlsx+autotable+file-saver) | 856 KB | 280 KB | dinâmico (ExportButtons) |
| recharts | 415 KB | 112 KB | só via TabResultado |
| **index (entrada)** | **374 KB** | **107 KB** | sempre |
| html2canvas | 202 KB | 47 KB | dinâmico (shareUtils) |
| supabase | 171 KB | 45 KB | sempre |
| vendor (react/dom/router) | 164 KB | 54 KB | sempre |
| index.es (plugin html do jspdf) | 159 KB | 53 KB | com export |
| CustomerSuccess (inclui @hello-pangea/dnd) | 127 KB | 40 KB | lazy |
| index.css | 102 KB | 17 KB | sempre |
| ui (radix) | 86 KB | 30 KB | sempre |
| FranchiseSettings | 72 KB | 20 KB | lazy |
| Gestao | 60 KB | 15 KB | lazy |
| TabResultado | 48 KB | 12 KB | lazy |
| Marketing | 48 KB | 13 KB | lazy |

**Custo de primeira pintura ~= 107+45+54+30+17 = ~253 KB gzip** antes de qualquer dado aparecer.

## Padrões de dados medidos

- `fetchAll: true` (pagina de 1000 em 1000): TabResultado 4x, AdminDashboard 4x, Gestao 3x,
  Financeiro 3x, Vendas 2x, MyContacts 2x, FranchiseeDashboard 1x
- `useVisibilityPolling` (refetch ao voltar pra aba, throttle 60s): AdminDashboard, FranchiseeDashboard,
  NotificationBell, CustomerSuccess, Financeiro, Gestao, Vendas
- **`@tanstack/react-query` está instalado e o `QueryClientProvider` envolve o app inteiro, mas
  só 2 consumidores usam de fato** (`useSubscriptionStatus`, `PageNotFound`). Todo o resto é
  `useState` + `useEffect` + `AbortController` na mão, com cache zero entre telas: sair de Vendas e
  voltar refaz a query inteira.
- `TabResultado` carrega **o histórico inteiro** (sales/expenses/saleItems/inventory sem janela de data)

## Tamanho dos arquivos (LOC) — top

PurchaseOrders 1664 · TabEstoque 1509 · Franchises 1508 · SaleForm 1382 · Marketing 1311 ·
FranchiseSettings 1304 · TabResultado 1256 · TabLancar 1210 · AsaasSetupPanel 980 · MyContacts 945 ·
Onboarding 883 · AdminDashboard 681 · FranchiseeDashboard 624 · Layout 565. Total `src/` ~= 35,4k LOC.

## Clarity — 3 dias (pull de 07/09/2026 via API)

Tabela completa em `00b-CLARITY-3DIAS.md`. Sinais mais fortes:

| sinal | número | leitura |
|---|---|---|
| `/` Mobile | 211 sessões, 2270 s totais, **165 s ativos (7%)** | gente parada numa tela que não é usável |
| `/Dashboard` Mobile | **QuickbackClick em 75,2% das sessões**, 11% de tempo ativo | entra e volta na hora |
| `/` Mobile | QuickbackClick 30,9% | idem na raiz |
| `/Vendas` PC | **253 dead clicks** (245 sessões), 3 rage clicks | maior volume absoluto do app |
| `/Gestao` PC | 111 dead clicks, **25,3% das sessões** | maior taxa com volume relevante |
| `/FranchiseSettings` PC | 37 dead clicks, 26,3% das sessões | wizard do "Meu Vendedor" |
| `/MyContacts` PC | 25 dead clicks, 19,3% das sessões | |
| `/Marketing` PC | 18% de tempo ativo, scroll médio 63 | ninguém chega ao fim da página |
| `/OnboardingWelcome` PC | 370 s totais, **13 s ativos (4%)** | |
| erros de script / error clicks | **0 em 3 dias** | não há exceção JS estourando hoje |

Volume por tela (sessões, 3 dias): Vendas 296M/245PC · Gestao 191M/167PC · Dashboard 138M/135PC ·
`/` 211M/74PC · FranchiseSettings 58M/38PC · MyContacts 52M/57PC · Marketing 13M/22PC ·
Financeiro 9M/2PC · PurchaseOrders 4M/4PC.
**O app é usado metade no celular, metade no PC** — e os dead clicks são majoritariamente PC.

`QuickbackClick` = a pessoa clica, chega na página e volta em segundos. Taxa alta no Dashboard
significa que a tela inicial não entrega o que ela foi buscar (ou não entrega a tempo).

## Regras do projeto que a auditoria NÃO pode violar

1. **Não propor recriar o que foi removido de propósito**: Health Score, página Acompanhamento,
   Relatórios (`Reports.jsx`), BotIntelligence, 30 componentes shadcn órfãos, `lib/formatBRL.js`.
   Lista completa no `CLAUDE.md` do dashboard, seção "Features Removidas".
2. Camada de dados só por `@/entities/all` — nunca `supabase.from()` na tela.
3. Dinheiro só por `getSaleNetValue` / `calculatePnL` (`src/lib/financialCalcs.js`).
   Faturamento = `value - discount_amount + delivery_fee`. Testes: `financialCalcs.test.mjs`.
4. Ícone só `<MaterialIcon icon="..."/>`; toast só `sonner`; nunca `alert()`/`window.confirm()`.
5. Paleta: `#b91c1c` (primary) / `#d4af37` (gold). Fontes Inter + Plus Jakarta Sans.
6. UI em pt-BR; código em inglês. "Estoque" (não Inventário), "Valor Médio" (não Ticket Médio).
7. `no-undef` desligado no ESLint -> símbolo usado-mas-não-importado compila e dá **tela branca**.
   Qualquer proposta de refactor tem que dizer como se protege disso.
8. Franqueado com 2+ unidades: toda tela resolve por `resolveActiveFranchise()`; nunca `[0]`.

## Formato exigido de CADA achado

Nada de conselho genérico ("melhore a performance", "use memo"). Cada item:

- **Título** curto e específico
- **Evidência**: arquivo:linha, número do bundle, ou linha da tabela do Clarity — sempre verificável
- **Quem sofre**: franqueado / admin / CS / os dois
- **Impacto**: o que custa hoje (segundos, cliques, erro, decisão que não é tomada)
- **Correção**: concreta, com os arquivos a tocar
- **Esforço**: P (<=1h) / M (meio dia) / G (>=1 dia)
- **Risco de regressão**: o que pode quebrar e como verificar

Prioridade por **(impacto x alcance) / esforço**. Volume absoluto conta mais que taxa — gotcha já
validado neste projeto: `/Vendas` com 148 dead clicks a 25% ganha de tela pequena a 29%.

Marque `⚠️ NÃO VERIFICADO` em qualquer coisa que você não confirmou lendo código ou dado.
Zero suposição apresentada como fato. Se um achado seu depende de rodar o app e você não rodou, diga.
