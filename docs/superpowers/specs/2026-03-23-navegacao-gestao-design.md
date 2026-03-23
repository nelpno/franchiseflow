# Reorganização da Navegação — Separação Vendas vs Gestão

**Data:** 2026-03-23
**Status:** Aprovado

## Contexto

Hoje o franqueado acessa tudo pela "Minha Loja" com 4 abas (Lançar, Resultado, Estoque, Reposição). A barra de abas fica apertada no mobile e mistura ação frequente (vender) com consultas periódicas (resultado, estoque, reposição).

## Decisão

Separar a navegação em dois conceitos:

- **Vendas** — ação frequente (registrar + ver vendas do dia). Acesso via FAB central no mobile e item no sidebar desktop.
- **Gestão** — consultas periódicas (resultado financeiro, estoque, reposição). Nova aba no menu.

## Modelo Mental do Franqueado

| Conceito | Frequência | Mentalidade | Onde |
|----------|-----------|-------------|------|
| Registrar + ver vendas | Várias vezes/dia | "Tô vendendo" | FAB / Vendas |
| Resultado financeiro | Semanal/mensal | "Como tô indo?" | Gestão |
| Estoque | Alguns dias | "Tenho o que preciso?" | Gestão |
| Reposição | Semanal | "Preciso pedir mais" | Gestão |

## Navegação Final

### Bottom Nav Mobile (5 slots)

```
[Início]  [Gestão]  [🔴 Vender]  [Clientes]  [Vendedor]
  home    bar_chart   add_circle   contacts   smart_toy
```

- FAB "Vender" continua como botão elevado vermelho central
- FAB abre página de vendas completa (lista + botão nova venda) — equivale ao TabLancar atual
- "Gestão" substitui "Minha Loja" no slot 2

### Sidebar Desktop (6 itens)

```
Início          → home          → /Dashboard
Vendas          → point_of_sale → /Vendas
Gestão          → bar_chart     → /Gestao
Meus Clientes   → contacts      → /MyContacts
Marketing       → campaign      → /Marketing
Meu Vendedor    → smart_toy     → /FranchiseSettings
```

- "Minha Loja" renomeado para "Vendas" com ícone `point_of_sale`
- "Gestão" é item novo

## Mudanças Técnicas

### Página `/Vendas` (nova rota, ou renomear MinhaLoja)
- Conteúdo: TabLancar atual (lista de vendas + formulário nova venda)
- Deep-link: `?action=nova-venda` auto-abre formulário (FAB mobile usa isso)
- Sem barra de abas — é página single-purpose

### Página `/Gestao` (nova)
- 3 abas: Resultado | Estoque | Reposição
- Reutiliza componentes: TabResultado, TabEstoque, TabReposicao
- URL param: `?tab=resultado|estoque|reposicao` (default: resultado)

### Layout.jsx
- Bottom nav: trocar "Minha Loja" por "Gestão", manter FAB "Vender"
- Sidebar: renomear "Minha Loja" → "Vendas" (ícone `point_of_sale`), adicionar "Gestão" (ícone `bar_chart`)
- FAB aponta para `/Vendas?action=nova-venda`

### MinhaLoja.jsx
- Pode ser renomeado para Vendas.jsx ou manter arquivo e mudar rota
- Remove abas Resultado/Estoque/Reposição — fica só com conteúdo de TabLancar

### O que NÃO muda
- TabResultado, TabEstoque, TabReposicao — componentes intactos, só mudam de página-pai
- TabLancar — intacto, só muda de contexto (sem tab bar)
- Clientes, Marketing, Vendedor — intactos
- Admin navigation — intacta (admin não usa esses menus, `franchiseeOnly: true`)
- Pasta `src/components/minha-loja/` — manter nome (renomear pasta é churn sem valor)

## Detalhes de Implementação

### Data Loading
MinhaLoja hoje carrega tudo num Promise.all() (sales, expenses, inventory, saleItems, contacts).
Cada página nova carrega APENAS o que precisa:

- **Vendas.jsx**: User.me(), Franchise.list(), Sale.list(), SaleItem.list(), Contact.list(), InventoryItem.list()
  - InventoryItem necessário pra SaleForm (dropdown de produtos)
  - Contact necessário pra auto-complete de cliente na venda
- **Gestao.jsx**: User.me(), Franchise.list(), + dados por aba ativa:
  - Resultado: Sale.list(), Expense.list(), SaleItem.list()
  - Estoque: InventoryItem.list()
  - Reposição: PurchaseOrder, PurchaseOrderItem, InventoryItem (já carrega dentro de TabReposicao)

Sem shared context — cada página faz fetch independente. Simplicidade > otimização prematura.

### Componentes
- **TabLancar**: continua como componente, Vendas.jsx renderiza ele diretamente sem wrapper de Tabs
- **TabResultado/TabEstoque/TabReposicao**: renderizados dentro de Gestao.jsx com Tabs do shadcn
- Componentes ficam em `src/components/minha-loja/` (sem renomear pasta)

### FAB e Deep-Links
- FAB mobile navega para `/Vendas?action=nova-venda` via React Router Link
- Vendas.jsx lê `searchParams.get("action")` e passa `autoOpenForm={true}` pro TabLancar
- Mesmo pattern de hoje, só muda a rota

### Rotas (App.jsx / pages.config.js)
- Adicionar rota `/Vendas` → Vendas.jsx (lazy)
- Adicionar rota `/Gestao` → Gestao.jsx (lazy)
- Manter rota `/MinhaLoja` como redirect → `/Vendas` (backward compat temporário)
- MinhaLoja.jsx pode ser deletado após redirect estar funcionando

### Admin
- Admin NÃO vê "Vendas" nem "Gestão" no sidebar (flags `franchiseeOnly: true`)
- Admin continua com menu próprio (Relatórios, Acompanhamento, Pedidos, Franqueados)
- Nenhuma mudança no admin
