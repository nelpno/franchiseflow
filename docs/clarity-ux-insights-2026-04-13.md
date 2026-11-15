# Clarity UX Insights - FranchiseFlow Dashboard
> Dados: 10-13/abr/2026 (3 dias) | Projeto: w6o3hwtbya | 8 chamadas API utilizadas

## Resumo Executivo

**432 sessões** de **79 usuários** nos últimos 3 dias. Mobile lidera com 54% das sessões. Três problemas críticos identificados: **dead clicks altíssimos** (24-42%), **quickbacks preocupantes** (43-57%), e **Edge com rage clicks 8.7%**. Zero script errors e zero error clicks — código estável.

---

## 1. Tráfego por Device

| Device | Sessões | Usuários | Págs/Sessão | % Total |
|--------|---------|----------|-------------|---------|
| Mobile | 233 | 48 | 5.78 | **54%** |
| PC | 192 | 31 | 7.73 | **44%** |
| Tablet | 7 | 1 | 8.14 | 2% |

**Insight**: Mobile domina em sessões e usuários. PC tem mais páginas por sessão (7.73 vs 5.78) — admins navegam mais profundamente. Franqueados (mobile) fazem sessões mais curtas e objetivas.

## 2. Tráfego por Browser

| Browser | Sessões | Usuários |
|---------|---------|----------|
| Chrome Mobile | 158 | 24 |
| Chrome Desktop | 153 | 25 |
| Mobile Safari | 68 | 21 |
| Edge | 46 | 7 |
| Samsung Internet | 6 | 2 |
| Google App (webview) | 1 | 1 |

**Insight**: Chrome (mobile+desktop) = 72% do tráfego. Safari tem 21 usuários únicos em 68 sessões — base iOS significativa. Edge com 46 sessões de apenas 7 usuários = uso pesado (admin?).

## 3. Tráfego por OS

| OS | Sessões | Usuários |
|----|---------|----------|
| Windows | 192 | 31 |
| Android | 150 | 25 |
| iOS | 90 | 24 |

**Insight**: Android + iOS = 240 sessões (56%). iOS tem quase tantos usuários quanto Android (24 vs 25) mas menos sessões — franqueados iOS usam menos o app.

## 4. Engagement Time

| Device | Tempo Total | Tempo Ativo | % Ativo |
|--------|-------------|-------------|---------|
| Mobile | 344s (5.7min) | 166s | **48%** |
| PC | 1193s (19.9min) | 682s | **57%** |
| Tablet | 670s (11.2min) | 669s | **100%** |

| OS | Tempo Total | Tempo Ativo |
|----|-------------|-------------|
| Android | 336s | 201s (60%) |
| iOS | 383s | 146s (38%) |
| Windows | 1193s | 682s (57%) |

**Insight**: Mobile tem apenas 48% de tempo ativo — metade do tempo é idle/loading/esperando. iOS pior ainda: 38% ativo. Possíveis causas: loading lento, telas que não engajam, ou usuário abre e esquece.

## 5. Scroll Depth

| Device | Scroll Médio |
|--------|-------------|
| Mobile | 90.26% |
| Tablet | 89.05% |
| PC | 85.87% |

**Insight**: Excelente em todos os devices. Conteúdo está sendo visualizado quase integralmente. Zero excessive scroll — páginas não são longas demais.

---

## 6. Dead Clicks (ALERTA)

### Por Device
| Device | % Sessões | Total Clicks |
|--------|-----------|-------------|
| Mobile | **24.03%** | 206 |
| Tablet | **42.86%** | 23 |
| PC | **42.19%** | 734 |

### Por Browser
| Browser | % Sessões | Total Clicks |
|---------|-----------|-------------|
| Edge | **54.35%** | **445** |
| Chrome | 38.56% | 312 |
| Chrome Mobile | 25.32% | 142 |
| iOS Safari | 23.53% | 64 |
| Samsung Internet | 0% | 0 |

### Por OS
| OS | % Sessões | Total Clicks |
|----|-----------|-------------|
| Windows | **42.19%** | **734** |
| iOS | 25.56% | 75 |
| Android | 24.00% | 154 |

### Por Página (URL)
| Página | Sessões | Dead Click % |
|--------|---------|-------------|
| Dashboard | 123 | 0% |
| FranchiseSettings | 122 | 0% |
| Gestao | - | 0% |
| BotIntelligence | 5 | 0% |
| Marketing | 52 | 0% |

**Insight CRITICO**: Dead clicks são o problema #1. 42% das sessões PC e 24% mobile. Edge lidera com 54% e 445 dead clicks. Paradoxalmente, as páginas individuais mostram 0% — isso indica que os dead clicks estão em **elementos globais** (sidebar, navbar, modals, toasts, cards) e não em conteúdo específico de uma página. Precisa de análise de gravações no Clarity para identificar os elementos exatos.

---

## 7. Rage Clicks

### Por Device
| Device | % Sessões | Total |
|--------|-----------|-------|
| PC | **4.69%** | 21 |
| Mobile | 0.43% | 1 |
| Tablet | 0% | 0 |

### Por Browser
| Browser | % Sessões | Total |
|---------|-----------|-------|
| Edge | **8.70%** | **12** |
| Chrome | 3.27% | 9 |
| Chrome Mobile | 0.63% | 1 |
| Safari | 0% | 0 |

**Insight**: Rage clicks concentrados em PC, especialmente **Edge** (8.7%). Algum elemento no desktop não está respondendo ao click — pode ser botão com delay, link sem href, ou área clicável pequena demais. 21 rage clicks em 192 sessões PC é significativo.

---

## 8. Quickbacks (ALERTA)

| Device | % Sessões |
|--------|-----------|
| Tablet | **57.14%** |
| Mobile | **47.21%** |
| PC | **43.23%** |

**Insight CRITICO**: Quase metade das sessões tem quickback — usuários entram em uma página e voltam imediatamente. Causas prováveis:
1. Navegação para página errada (menu confuso)
2. Página demora a carregar e usuário desiste
3. Conteúdo não era o esperado
4. Links do bot/WhatsApp levando para páginas que requerem contexto

---

## 9. Analise Visual: Dead Clicks por Elemento (Heatmap Clarity)

> Dados extraidos via Playwright navegando nos heatmaps do Clarity filtrados por "toques/cliques sem efeito"

### Mobile (7 elementos com dead clicks)

| # | Elemento | Descricao | Cliques | % | Acao Recomendada |
|---|----------|-----------|---------|---|------------------|
| 1 | **Sidebar item ativo** | Item de menu ja selecionado | 1 | 2.63% | Adicionar feedback visual (highlight) ao clicar no item ativo |
| 2 | **Card KPI Faturamento** | Card com icone payments + valor R$ 6.221 | 1 | 2.63% | Tornar card clicavel -> navegar para /Vendas ou /Gestao?tab=resultado |
| 3 | **Barra grafico [7]** | 7a barra do grafico de faturamento semanal | 1 | 2.63% | Adicionar tooltip on click com valor do dia |
| 4 | **"R$ 6.221"** (H3) | Valor numerico do faturamento | 1 | 2.63% | Tornar clicavel junto com o card pai |
| 5 | **Barra grafico [6]** | 6a barra do grafico de faturamento semanal | 1 | 2.63% | Adicionar tooltip on click com valor do dia |
| 6 | **Container secao** | Area vazia entre cards (DIV grid) | 1 | 2.63% | Nenhuma - clique acidental em area vazia |
| 7 | **Container geral** | DIV.mx-auto (area vazia) | 1 | 2.63% | Nenhuma - clique acidental |

### PC (9 elementos com dead clicks - SECTION Faturamento e Sidebar)

| # | Elemento | Descricao | Cliques | % | Acao Recomendada |
|---|----------|-----------|---------|---|------------------|
| 1 | **Barra grafico faturamento [6]** | Barra de dia da semana | 2 | 14.29% | Adicionar onClick com tooltip/drill-down |
| 2 | **Barra grafico faturamento [7]** | Barra de dia da semana | 2 | 14.29% | Adicionar onClick com tooltip/drill-down |
| 3 | **"Total: R$ 782,00"** | Label total no rodape do grafico | 2 | 14.29% | Tornar clicavel -> navegar para detalhes vendas |
| 4 | **Section Faturamento inteira** | Card completo com grafico semanal | 1 | 7.14% | Tornar card clicavel |
| 5 | **"Inicio" (sidebar)** | Item de menu Inicio ja ativo | 1 | 7.14% | Feedback visual no item ativo |
| 6 | **"wb_sunny Inicio"** (icone+texto) | Icone + label do menu Inicio | 1 | 7.14% | Mesmo - ja esta na pagina |
| 7 | **"Ranking aparece apos primeira venda"** | Texto placeholder do ranking | 1 | 7.14% | Remover cursor pointer ou adicionar CTA util |
| 8 | **"Media: R$ 112,00 / Total: R$ 782,00"** | Rodape do grafico faturamento | 1 | 7.14% | Tornar area clicavel |
| 9 | **"Sab"** (label dia semana) | Label eixo X do grafico | 1 | 7.14% | Adicionar tooltip no hover/click |

### Padroes Identificados

1. **Grafico de Faturamento Semanal**: maior concentrador de dead clicks no PC (barras, labels, totais). Usuarios QUEREM interagir com o grafico - esperam tooltip, drill-down ou navegacao.

2. **Cards KPI**: usuarios clicam nos cards esperando ir para detalhes. O card de Faturamento e o principal alvo.

3. **Sidebar item ativo**: tanto mobile quanto PC - usuarios clicam no item de menu da pagina atual. Precisa de feedback visual melhor (ripple, highlight, ou simplesmente nao reagir visualmente como botao).

4. **Textos informativos**: "Total: R$ 782", "Ranking aparece apos primeira venda" - textos que parecem links ou botoes mas nao sao.

---

### /Vendas — Pagina mais visitada (500 views)

**Mobile** (6 elementos, 170 views, 10 dead clicks):
- Ícone Material Symbol sem handler (1 click)
- Formulário de venda: cliques fora dos inputs (4 clicks)
- Bottom nav e containers vazios (5 clicks)

**PC** (31 elementos, 322 views, **~280 dead clicks** — PIOR PAGINA):
| # | Elemento | Cliques | Descrição |
|---|----------|---------|-----------|
| 1 | **Área do form de venda** (DIV[2]) | **72** | Cliques no espaço vazio do formulário |
| 2 | **Form inteiro** | **67** | Mesma causa |
| 3 | **Campo input com borda** | **31** | Input visual sem foco correto ao clicar |
| 4 | **Header "Vendas Santo André"** | **23** | Texto informativo clicado |
| 5 | **Toolbar/header pagina** | **22** | Area do header |
| 6 | **Campo input [6]** | **21** | Outro campo com borda |
| 7 | **Labels desabilitados** | **9** | `LABEL.peer-disabled` — usuário tenta clicar |
| 8 | **Filtros status** | **6** | Barra "Todas/Pendentes/Confirmadas" |
| 9 | **Summary pendente/recebidas** | **5** | Texto de status financeiro |

**Rage clicks PC** (4 elementos, 15 rage clicks):
- Form DIV[2]: 5 rage clicks — frustração no formulário
- Form inteiro: 3 rage clicks
- **LABEL disabled: 2 rage clicks** — tentando interagir com campo desabilitado
- Campo input border: 1 rage click

### /Gestao — 2a mais visitada (375 views)

**Mobile** (15 elementos, 178 views, 46 dead clicks):
- Tab "Reposição" (3 clicks) — dead click na tab ativa
- Cards de dados informativos (6 clicks) — sem onClick
- Ícones Material Symbol (2 clicks) — sem handler
- Imagem de produto (1 click) — sem link

**PC** (7 elementos, 181 views, **148 dead clicks — 81.7%!!**):
| # | Elemento | Cliques | % |
|---|----------|---------|---|
| 1 | **Tabela de estoque inteira** | **36** | 24.32% |
| 2 | **HTML page (com modal editar)** | 5 | 3.38% |
| 3 | **Container overflow-auto** | 3 | 2.03% |
| 4-7 | MAIN, sidebar, outros | 2-1 cada | ~1-2% |

**Achado critico**: linhas da tabela de estoque NÃO são clicáveis — 36 dead clicks (24%) de usuários tentando abrir produto para editar.

### /FranchiseSettings (156 views)
- **Mobile**: 1 dead click em 62 views — praticamente limpo
- **PC**: sem dados significativos — página OK

### /MyContacts (182 views)

**Mobile** (12 elementos, 81 views, 17 dead clicks):
- Info do contato ("1 compra · R$ 38,90"): 3 clicks — quer expandir detalhes
- Card do contato inteiro: 2 clicks — quer abrir contato
- Título "Clientes": 2 clicks

**PC** (14 elementos, 99 views, 36 dead clicks — 36%):
- Distribuídos em containers e cards de contato
- Padrão: **usuários clicam no card esperando abrir detalhes do contato**

### /Marketing (34 views)
- **Mobile**: 8 views, 2 dead clicks — amostra insuficiente
- Sem problemas significativos pelo volume

### Resumo Dead Clicks por Pagina (PC)

| Página | Views | Dead Clicks | Taxa | Gravidade |
|--------|-------|-------------|------|-----------|
| /Gestao | 181 | 148 | **81.7%** | CRITICO |
| /MyContacts | 99 | 36 | **36.4%** | ALTO |
| /Vendas | 322 | ~280 | **~87%** | CRITICO |
| /Dashboard | 14 | 14 | - | MEDIO |
| /FranchiseSettings | - | ~0 | - | OK |

---

## 10. Score Geral de Saúde UX

| Métrica | Score | Status |
|---------|-------|--------|
| Script Errors | 0% | OK |
| Error Clicks | 0% | OK |
| Excessive Scroll | 0% | OK |
| Scroll Depth | 85-90% | OK |
| Rage Clicks | 0.4-4.7% | Atenção (PC) |
| Dead Clicks | 24-42% | CRITICO |
| Quickbacks | 43-57% | CRITICO |
| Engagement Ativo | 38-57% | Atenção |

---

## 11. Categorização por Severidade

### P0 - Critico (resolver esta semana)

| # | Finding | Impacto | Acao |
|---|---------|---------|------|
| 1 | **Dead clicks 42% no PC** (734 total, Edge 54%) | Quase metade das sessões desktop. Elementos clicáveis que não fazem nada | Assistir 10 gravações Clarity de sessões PC/Edge com dead clicks. Identificar elementos (sidebar? cards? modals?) |
| 2 | **Dead clicks 24% no Mobile** (206 total) | 1 em cada 4 sessões mobile tem cliques perdidos | Assistir gravações mobile. Verificar touch targets e elementos sem onClick handler |
| 3 | **Quickbacks 47% mobile** | Quase metade dos franqueados entra em página e volta | Heatmap de navegação para identificar quais páginas geram quickback. Revisar deep links do bot |

### P1 - Alto (resolver em 2 semanas)

| # | Finding | Impacto | Acao |
|---|---------|---------|------|
| 4 | **Rage clicks Edge 8.7%** (12 total) | Frustração real em 7 usuários Edge (provavelmente admins) | Testar fluxos admin no Edge. Verificar compatibilidade de componentes shadcn/ui |
| 5 | **iOS engagement 38% ativo** | Franqueados iOS passam 62% do tempo idle | Verificar performance no Safari iOS. Profile Lighthouse mobile |
| 6 | **OTP expired links no tráfego** | URLs com `error=access_denied&error_code=otp_expired` aparecem em sessões | Verificar fluxo de convite/login por email. Redirect para página de erro amigável |

### P2 - Medio (backlog priorizado)

| # | Finding | Impacto | Acao |
|---|---------|---------|------|
| 7 | **Mobile 5.78 págs/sessão vs PC 7.73** | Franqueados navegam menos — pode indicar que não encontram o que precisam | Otimizar quick actions no dashboard mobile |
| 8 | **Mobile engagement 48% ativo** | Metade do tempo é idle | Audit de loading times. Verificar lazy loading e skeleton states |

### P3 - Baixo (nice to have)

| # | Finding | Impacto | Acao |
|---|---------|---------|------|
| 9 | **PC scroll depth 85.87%** (vs 90% mobile) | Desktop rola menos — conteúdo importante pode ficar hidden | Verificar se CTAs estão above the fold no desktop |
| 10 | **Samsung Internet 0 dead clicks** | Boa referência mas amostra pequena (6 sessões) | Monitorar |

---

## 12. Plano de Acao Priorizado

### Sprint 1: Tabela de Estoque clicavel + Form Vendas (CRITICO — esta semana)

**Objetivo**: Corrigir os 2 maiores concentradores de dead clicks identificados via heatmap Playwright.

1. **Tabela Estoque /Gestao — linhas clicaveis** (~1 dia) — 81.7% dead clicks
   - 36 dead clicks (24%) nas linhas da tabela de estoque (PC)
   - Usuários clicam na linha esperando abrir o produto para editar
   - **Fix**: adicionar onClick na row -> abrir modal de edição do produto
   - Adicionar `cursor-pointer` + hover state nas rows (`hover:bg-muted/50`)
   - Mobile: tap na row abre o mesmo modal

2. **Formulário Vendas /Vendas — campos e labels** (~1 dia) — ~87% dead clicks
   - 72+67 dead clicks no form (área vazia entre inputs)
   - 9 dead clicks em LABELS desabilitados + 2 RAGE clicks em labels
   - 31+21 dead clicks em campos de input com borda (cursor não foca)
   - **Fix**: garantir que click no label foca o input associado (`htmlFor`)
   - **Fix**: labels desabilitados devem ter `cursor-not-allowed` visual claro
   - **Fix**: click em qualquer área do campo (borda inclusa) deve focar o input
   - Reduzir espaço vazio entre campos do form

3. **Cards KPI Dashboard — tornar clicaveis** (~0.5 dia)
   - Card Faturamento: onClick -> `/Gestao?tab=resultado`
   - Card Conversão: onClick -> `/Vendas`
   - Adicionar `cursor-pointer` + hover state sutil

4. **Gráfico Faturamento Semanal — interativo** (~0.5 dia)
   - Barras, labels e totais clicáveis com tooltip
   - "Total: R$ X" clicável -> `/Gestao?tab=resultado`

### Sprint 2: Cards de Contato + Dashboard minor fixes (semana que vem)

5. **Cards MyContacts — tornar clicaveis** (~0.5 dia) — 36% dead clicks PC
   - Usuários clicam no card inteiro esperando abrir detalhes
   - **Fix**: click no card abre sheet/modal com detalhes do contato
   - Info "1 compra · R$ 38,90" deve ser clicável

6. **Sidebar item ativo** (~2h)
   - Remover `cursor-pointer` do item ativo, usar `cursor-default`
   - Ou mostrar ripple/flash sutil ao clicar

7. **Texto placeholder ranking** (~1h)
   - "Ranking aparece após primeira venda" -> CTA "Registre sua primeira venda"

### Sprint 3: Quickbacks + OTP + Edge (~em 2 semanas)

8. **Investigar Quickbacks 47%** (~1 dia)
   - Verificar deep links do bot levam para pagina certa
   - Verificar tempo de loading (quickback pode ser impaciencia)
   - Medir first contentful paint por página

9. **OTP Expired Fix** (~0.5 dia)
   - Criar pagina de erro amigável para links expirados
   - Redirecionar `#error=access_denied` para login com mensagem

10. **Teste Edge** (~0.5 dia)
    - Testar fluxos admin no Edge (8.7% rage clicks)
    - Verificar componentes shadcn/ui

### Sprint 3: Performance Mobile + Edge (em 2 semanas)

7. **Teste Edge** (~1 dia)
   - Testar todos os fluxos admin no Edge
   - Verificar rage clicks: botões que não respondem, delays

8. **Performance iOS** (~1 dia)
   - Lighthouse audit mobile
   - Verificar lazy loading de rotas
   - Otimizar first contentful paint

### Metricas de Sucesso (re-medir em 2 semanas)

| Métrica | Atual | Meta | Página Alvo |
|---------|-------|------|-------------|
| Dead Clicks /Vendas PC | ~87% | < 20% | Form labels + inputs |
| Dead Clicks /Gestao PC | 81.7% | < 15% | Tabela estoque clicável |
| Dead Clicks /MyContacts PC | 36.4% | < 10% | Cards de contato |
| Dead Clicks Geral PC | 42.19% | < 15% | Todas |
| Dead Clicks Geral Mobile | 24.03% | < 10% | Todas |
| Rage Clicks Vendas PC | 15 total | < 3 | Form + labels |
| Rage Clicks Edge | 8.70% | < 2% | Teste compatibilidade |
| Quickbacks Mobile | 47.21% | < 25% | Deep links + loading |

---

## Proxima Coleta

- **Data sugerida**: 27/04/2026 (2 semanas)
- **Chamadas API restantes hoje**: 2/10
- **Foco**: re-medir dead clicks e quickbacks após fixes do Sprint 1-2
- **Dimensao extra**: `Source` + `Medium` para entender de onde vêm os usuários
