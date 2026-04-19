# Reports Tab — Redesign (visão cruzada por franquia)

**Data:** 2026-04-19
**Autor:** Nelson + Claude
**Status:** Spec aprovado, pronto para plano

## Contexto

O dashboard tem `src/pages/Reports.jsx` oculto da sidebar admin desde que a aba foi retirada (só acessível por URL). O conteúdo atual já inclui KPIs, SalesRevenueChart, PaymentMethodChart, FranchiseRankingChart, FranchiseComparisonTable e ExportButton — mas era construído para a ideia original do app, que mudou.

Gap hoje: admin precisa ocasionalmente bater o olho em dados cruzados entre franquias (ex: "quem está acima/abaixo da média em X") e acaba abrindo várias páginas. A ideia é voltar `Reports` à sidebar com **uma tela densa e acionável**, não um dashboard de análise profunda (essa função é do AdminDashboard + páginas dedicadas: Financeiro, Meus Clientes, Estoque, Marketing, Acompanhamento).

## Objetivo

Uma única página com tabela comparativa entre franquias, 8 colunas acionáveis, filtro de período, busca e export CSV. Serve como **ponto de entrada para investigação**: usuário identifica a franquia fora da curva e clica para abrir o detail sheet existente em `Franquias`.

## Não-objetivos

- Não recriar gráficos de série temporal (ficam no AdminDashboard)
- Não reproduzir dados já visíveis em páginas dedicadas (estoque baixo, clientes sumidos, marketing mensal)
- Não adicionar drill-down próprio (reaproveita `Franchises.jsx` detail sheet)
- Não tocar em RPC nova / schema / Edge Functions — tudo client-side com queries existentes

## Escopo

### Rota e acesso
- Rota: `/Reports` (já existe, manter)
- Visibilidade sidebar: admin + manager. Franqueado: não (continua sem acesso)
- Remover `Relatórios` de `adminSidebarHidden` em `src/Layout.jsx` / `pages.config.js`

### Layout
- Header: título "Relatórios", subtítulo curto
- Toolbar sticky no topo:
  - Filtro de período (7d / 30d default / mês atual / mês anterior / custom com 2 inputs de data)
  - Busca por nome de franquia (input com debounce)
  - Botão "Exportar CSV"
- Tabela: 1 linha por franquia ativa, ordenável por qualquer coluna (clique no header alterna asc/desc), zebrada, hover destacado
- Linha clicável → navega para `/Franchises?id={evolution_instance_id}&openSheet=1` (ajuste mínimo em Franquias para abrir o sheet via query param se ainda não estiver implementado)
- Mobile: scroll horizontal na tabela; coluna "Franquia" com `position: sticky; left: 0`
- Loading: `<Skeleton>` nas 5 primeiras linhas
- Empty state: "Sem vendas no período selecionado"
- Erro: reaproveita padrão ErrorBoundary + botão retry

### Colunas (8)

| # | Coluna | Cálculo |
|---|---|---|
| 1 | Franquia | `franchise_configurations.franchise_name` (fallback `franchises.name`) |
| 2 | Receita (período) | `Σ (value - discount_amount + delivery_fee)` em `sales` do período, com Δ% vs. período anterior de mesma duração (seta verde se ≥0, vermelha se <0) |
| 3 | Nº pedidos | `count(sales)` no período |
| 4 | Ticket médio | Receita / Nº pedidos (— se pedidos=0) |
| 5 | Margem % | `(receita_real − CMV) / receita_real` onde CMV = `Σ (sale_items.quantity × inventory_items.cost)` — usa `inventory_items.cost` da franquia. Mostra "—" quando nenhum item tem custo cadastrado |
| 6 | Conversão bot % | `count(bot_conversations where outcome='converted') / count(bot_conversations total)` no período. Mostra "—" quando 0 conversas (franquia sem bot) |
| 7 | Clientes novos | `count(contacts where created_at ∈ período AND franchise_id = evo_id)` |
| 8 | Assinatura | badge: Pago (verde) / Vencido (vermelho) / Aguardando (amarelo) / Cancelada (cinza) — vem de `system_subscriptions.current_payment_status` |

Regras:
- Receita usa cálculo realtime de `sales` (NUNCA `daily_summaries` — cron só roda 02h BRT). Padrão já estabelecido no MiniRevenueChart.
- `formatBRL` para valores monetários, `Intl.NumberFormat('pt-BR', {style:'percent'})` para %.
- Sort default: Receita desc.

### Dados

Queries paralelas em `Promise.allSettled` seguindo padrão `AdminDashboard.jsx`:

1. `Franchise.list()` — franquias ativas
2. `FranchiseConfiguration.list()` — para nome amigável
3. `Sale.list()` com `fetchAll: true` filtrado por `sale_date ∈ [startDate, endDate]` — range dobrado para calcular Δ% (inclui período anterior de mesma duração)
4. `SaleItem.list()` com `fetchAll: true` para CMV (filtrar por sale_id dos sales do período)
5. `Contact.list()` com `fetchAll: true` filtrado por `created_at ∈ período`
6. `InventoryItem.list()` — cost por produto (toda a rede; agregação client-side)
7. `bot_conversations` — query direta Supabase, filtrada por `started_at ∈ período`, campos mínimos (`franchise_id`, `outcome`)
8. `system_subscriptions` — snapshot atual (não filtra por período)

Cálculos client-side (30 franquias × ~30 dias = volume baixo, sem precisão crítica para otimização server-side).

### Export CSV
- Usa `sanitizeCSVCell()` de `@/lib/csvSanitize` em todos campos de texto (previne formula injection)
- Nome: `relatorios-franquias-{YYYY-MM-DD}.csv`
- Cabeçalhos e ordem idênticos à tabela na tela
- Charset UTF-8 com BOM para abrir correto no Excel

## Componentes a criar / modificar

**Novo:**
- `src/pages/Reports.jsx` — reescrever (substitui o antigo; move os componentes obsoletos para remoção)
- `src/components/reports/FranchiseReportTable.jsx` — tabela ordenável
- `src/components/reports/FranchiseReportToolbar.jsx` — período + busca + export

**Modificar:**
- `src/Layout.jsx` — remover `Reports` de `adminSidebarHidden`, adicionar na seção visível (ícone `assessment`)
- `src/pages.config.js` — idem se aplicável
- `src/pages/Franchises.jsx` — se não suporta, adicionar abertura do detail sheet via `?id=...&openSheet=1` (gatilho mínimo)

**Remover (obsoletos do Reports antigo):**
- `src/components/reports/KpiCards.jsx`
- `src/components/reports/SalesRevenueChart.jsx`
- `src/components/reports/PaymentMethodChart.jsx`
- `src/components/reports/FranchiseRankingChart.jsx`
- `src/components/reports/FranchiseComparisonTable.jsx`
- `src/components/reports/ExportButton.jsx`

Remoções só após confirmar que não são importados em nenhum outro lugar (grep antes de apagar).

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Query pesada em franquias com muitas vendas | `fetchAll:true` já pagina 1000-em-1000; testes mostraram <2s em AdminDashboard (mesmo volume) |
| `bot_conversations` sem índice eficiente | Usar RPC existente ou criar `get_bot_conversion_by_franchise(start, end)` se queries diretas forem lentas (decisão adiada para fase de implementação) |
| Δ% distorcido com período custom curto | Sempre comparar com janela de mesma duração anterior; se período anterior = 0 pedidos, esconder seta |
| Mobile: tabela larga difícil de ler | Coluna Franquia sticky + scroll horizontal suave; evitar card view (perde densidade) |

## Critérios de aceite

1. Admin/manager veem "Relatórios" na sidebar
2. Franqueado NÃO vê Relatórios
3. Filtro de período atualiza toda a tabela
4. Ordenação por coluna funciona em desktop e mobile
5. Clique em linha abre detail sheet da franquia em Franquias
6. Export CSV abre no Excel com acentos corretos
7. Todas as 8 colunas calculam e exibem corretamente ou mostram "—" quando apropriado
8. Loading mostra skeleton; erro mostra retry; vazio mostra mensagem
9. Sem regressão em AdminDashboard (queries independentes)
10. Código novo passa no lint

## Fora do escopo (follow-ups possíveis)

- Drill-down próprio dentro de Reports
- Gráficos por franquia (série temporal)
- Filtros por categoria de produto
- Persistir filtros do usuário entre sessões
- Exportar PDF
- Comparação período personalizado (vs. ano anterior etc.)
