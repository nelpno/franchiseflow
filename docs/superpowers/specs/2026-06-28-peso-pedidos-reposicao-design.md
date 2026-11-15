# Peso dos produtos nos pedidos de reposição — Design

**Data:** 2026-06-28
**Projeto:** FranchiseFlow (apps/dashboard)
**Autor:** Nelson + Claude (brainstorming)
**Status:** Aprovado para virar plano de implementação

## Problema

Os pedidos de reposição à fábrica não expõem o **peso** dos produtos. A fábrica
precisa do peso total de cada pedido para **montar carga**, e um futuro sistema
de logística vai usar esse peso para **limitar rotas a ≤ 1500 kg**.

Hoje a gramatura existe apenas embutida no **nome** do produto (ex:
`"Rondelli 4 Queijos - 700g Rolo"`, `"Massa de Pastel - 1kg"`). Não há nenhuma
coluna/tabela de peso em `inventory_items`, `purchase_order_items`,
`purchase_orders` nem no catálogo padrão.

## Escopo

### Nesta entrega (v1)
1. Derivar o peso de cada produto a partir do nome (parser) e **persistir** numa
   tabela-mestra única (`product_weights`).
2. Mostrar **só o peso TOTAL** (sem peso por item, em lugar nenhum) no rodapé do
   formulário do pedido
   ([PurchaseOrderForm.jsx](../../../src/components/minha-loja/PurchaseOrderForm.jsx)).
3. Mostrar **só os totais** na ficha de separação PDF
   ([pickingSheetPdf.js](../../../src/lib/pickingSheetPdf.js)) — peso total do
   pedido (rodapé) e peso total do dia na página consolidada (bulk). **Sem coluna
   de peso por item** (decisão Nelson: o separador não precisa, só polui).
4. **Gravar o total** no pedido ao salvar (`purchase_orders.total_weight_kg`,
   apenas) para o futuro roteirizador consumir direto. **Sem coluna por item.**

### Fora de escopo (etapas futuras)
- **Tela de edição manual do peso (override admin).** A tabela é seedada e
  corrigível via SQL sob demanda. Edição inline no TabEstoque fica para depois.
- **Roteirizador / limite de 1500 kg.** Apenas habilitado pelo dado
  (`total_weight_kg` por pedido); não construído aqui.
- **Limpeza de nomes duplicados** no catálogo (ex: `"Rondelli frango X Requeijão
  700 gramas"` ≈ `"Rondelli Frango e Requeijão - 700g Rolo"`). Só sinalizado.

## Decisões (brainstorming)

| Decisão | Escolha | Razão |
|---|---|---|
| Escopo | Só peso nos pedidos agora; logística depois | Entrega valor já; mantém simples |
| Fonte do peso | Ler do nome **e guardar** (com override) | Zero digitação no seed, mas robusto a rename e a peso de carga |
| Onde mora | **Tabela-mestra** `product_weights` (não coluna em inventory_items) | DRY: override 1× vale pra rede toda, não duplica por franquia |
| Override admin v1 | Deixar pra depois (SQL sob demanda) | Mantém escopo enxuto |

## Dados reais (catálogo padrão, 33 nomes distintos)

Formatos de gramatura observados no `product_name`:
- `700g`, `500g`, `250g` → maioria (~29)
- `1kg` → 2 produtos (`Massa de Pastel - 1kg`, `Nhoque de Batata - 1kg`)
- `700 gramas` (palavra, com "X" no lugar de "e") → 1 produto fora do padrão

O parser precisa cobrir os três formatos. Com isso, **100% dos nomes atuais**
produzem um peso.

## Arquitetura

### 1. Parser de peso — `src/lib/productWeight.js` (novo)

```js
// Lê a gramatura do nome do produto e devolve em KG (number) ou null.
// Cobre: "700g", "500 g", "1kg", "1,5 kg", "700 gramas".
export function parseWeightKg(productName) { ... }
```

- Regex: `/(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|gramas?)\b/i`
- Conversão: `kg` → valor; `g`/`gr`/`gramas` → valor / 1000. Vírgula decimal → ponto.
- Pega a **primeira** ocorrência. Retorna `null` se nada casar (não 0 — `null`
  sinaliza "desconhecido" e dispara aviso dev-only, igual ao padrão de
  `stockSuggestion.js`).
- Helper de exibição `formatWeightKg(kg)` → `"23,1 kg"` (1 casa, vírgula ptBR;
  `"—"` quando null/0). Usado **só** nos totais (rodapé do form, rodapé/consolidado
  do PDF) — nunca por item.
- Helper central de resolução (uso **interno**, no cálculo do total):
  `getItemWeightKg(item, weightMap)` = `weightMap[item.product_name]` (override
  persistido) `?? parseWeightKg(item.product_name)` `?? null`.

### 2. Tabela-mestra — `product_weights`

```sql
create table public.product_weights (
  product_name text primary key,
  weight_kg    numeric(10,3) not null check (weight_kg >= 0),
  is_auto      boolean not null default true,   -- true = veio do parser; false = ajustado por admin
  updated_at   timestamptz not null default now()
);
```

- **Seed** (migration): insere uma linha por `product_name` distinto de
  `inventory_items WHERE created_by_franchisee = false AND active IS DISTINCT FROM
  false`, com `weight_kg = parseWeightKg(name)` (parser portado para SQL **ou**
  seed gerado por script Node que lê os nomes e calcula em JS — preferir o script
  Node para reusar exatamente o mesmo parser e evitar divergência g/kg).
- RLS: leitura para `authenticated` (catálogo é cross-rede, não-sensível);
  escrita só `service_role`/`is_admin()`. Seguir padrão de linter
  (`SET search_path`, `(select auth.uid())` se houver policy com uid).
- **Cobertura do seed × set do form:** o seed filtra `created_by_franchisee =
  false AND active IS DISTINCT FROM false`, enquanto `PurchaseOrderForm.standardProducts`
  filtra `created_by_franchisee !== true AND cost_price > 0` (~L80–87) — conjuntos
  ligeiramente diferentes. Qualquer item do form sem linha em `product_weights`
  cai no parser em runtime (`getItemWeightKg`), então não fica sem peso. Produtos
  novos cadastrados depois do seed também só ganham linha em reseed — o parser
  runtime cobre o intervalo. Documentar; não tentar casar os filtros.
- **Não** referenciar por FK (nomes mudam); chave é o texto do nome, igual ao
  acoplamento já existente entre catálogo e `product_name`.

### 3. Catálogo / leitura no frontend

O formulário de reposição lê os **`inventory_items` da franquia** (não a RPC do
catálogo) — então o peso precisa chegar a esses objetos no front:

- Carregar o **mapa de pesos** uma vez: `product_weights` → `{ [product_name]:
  weight_kg }`. Fetch leve (~33 linhas) no `TabReposicao`/`PurchaseOrderForm`
  (ou via React Query, mesmo padrão das outras leituras).
- Resolver por item com `getItemWeightKg(item, weightMap)` (override → parser →
  null).
- Atualizar a RPC `get_standard_product_catalog`
  ([supabase/get-standard-product-catalog.sql](../../../supabase/get-standard-product-catalog.sql))
  para também devolver `weight_kg` (LEFT JOIN `product_weights`, fallback null) —
  assim o autocomplete do TabEstoque e qualquer consumidor do catálogo já trazem
  peso sem reparsear. O retorno ganha 1 coluna (additive); o consumidor
  (autocomplete via `createEntity`/`select('*')`) mapeia campos **por nome**, não
  por posição, então a coluna extra é tolerada. `DROP FUNCTION` antes do
  `CREATE` (muda o tipo de retorno) + `notify pgrst,'reload schema'`.
- **Ponto único de fetch do mapa:** carregar `product_weights` **uma vez** em
  `TabReposicao` e passar o `weightMap` por prop para `PurchaseOrderForm` e para a
  geração de PDF — evita fetch duplicado.

### 4. PurchaseOrderForm — exibição

- **Sem peso por linha.** Nada de coluna/texto de peso nos itens.
- **Rodapé (único lugar):** `Peso total: {formatWeightKg(somaTotal)}` ao lado
  de total de itens / total de unidades / valor. `somaTotal = Σ(quantity ×
  getItemWeightKg(item))`, **tratando peso null como 0 no total numérico** e
  exibindo um aviso visível ("N itens sem peso cadastrado") quando houver alguma
  linha null — pra não esconder carga.

### 5. Snapshot no save (pra logística consumir)

```sql
alter table public.purchase_orders add column total_weight_kg numeric(12,3); -- soma(peso_unit * quantity) no momento do pedido
```

- **Só o total no pedido.** Não há coluna de peso por item (`purchase_order_items`
  fica intacta).
- **Caminho de save real** (`PurchaseOrderForm.handleSubmit`, ~L209–228): NÃO há
  RPC. O fluxo é `PurchaseOrder.create(header)` **primeiro**, depois mapear os
  itens e `PurchaseOrderItem.createMany(items)`. O `total_weight_kg` é calculado
  **em memória**, a partir de `quantities` + `weightMap` + `standardProducts`,
  **antes** da chamada `PurchaseOrder.create` — e passado no objeto do header:
  `total_weight_kg = Σ(getItemWeightKg(item, weightMap) × quantity)` (peso null
  conta como 0).
- Snapshot = total **no momento do pedido**; correções futuras no
  `product_weights` não reescrevem pedidos antigos (consistente com o snapshot de
  `customer_name` em `sales`).
- `PurchaseOrder` é entidade do adapter — incluir `total_weight_kg` nos `columns`
  se houver `select` enxuto; conferir que o create não filtra o campo novo.

### 6. Ficha de separação PDF

[pickingSheetPdf.js](../../../src/lib/pickingSheetPdf.js). **Padrão do arquivo:**
`renderPickingPage` **recalcula** `totalValue` dos itens a cada render (não lê
`order.total_amount`). O peso segue o mesmo padrão — soma dos itens via
`weightMap`, **não** lê `order.total_weight_kg` (mantém consistência e funciona pra
pedidos antigos sem snapshot). **Sem coluna PESO por item — a tabela de itens não
muda.**
- A tabela por item fica **igual** (SEP / PRODUTO / QTD / CONF / UNIT). Nenhuma
  coluna de peso por linha.
- Rodapé do pedido: linha **`Peso total: XXX kg`** junto de total de
  itens/unidades/valor. `XXX = Σ(qtd × getItemWeightKg(item, weightMap))`.
  Impressa de forma **parseável** perto do cabeçalho `PED-XXXX`, porque a skill
  `maxi-logistica-rotas` extrai os pedidos lendo este PDF (ver §7). O `weightMap`
  é passado à função de geração (mesmo ponto único de fetch).
- Página consolidada (`generateBulkPickingSheet` → `renderSummaryPage`): agrupa
  por `product_name` e reconstrói itens sintéticos. Resolver o peso de cada
  produto agregado via `weightMap` e imprimir só o **peso total do dia** (soma de
  todos os pedidos) — é o número que a fábrica usa pra montar carga.

### 7. Consumidor: skill `maxi-logistica-rotas` (gancho — não construído aqui)

O "sistema de logística" já existe: a skill **`maxi-logistica-rotas`** (código e
dados em `MaxiMassas/logistica/`) divide os **pedidos confirmados** em rotas-dia
saindo da fábrica de Araraquara. **Hoje o corte é por tempo de dia (trânsito +
descarga), NÃO por peso.** Ela ingere os pedidos por:
1. **PDF de fichas de separação** (lê os cabeçalhos `MAXI MASSAS <NOME> PED-XXXX`),
2. ou lista de franquias colada.

Esta entrega habilita o teto de **≤ 1500 kg/rota** por duas vias:
- **Via PDF (imediata):** a ficha passa a imprimir `Peso total` por pedido de
  forma parseável (§6) — a skill já lê esse PDF.
- **Via banco (mais limpa):** `purchase_orders.total_weight_kg` por pedido fica
  disponível pra leitura direta.

A lógica do cap de 1500 kg (bin-packing por peso, combinado com o corte por tempo
já existente) é adicionada **dentro da skill/`logistica/`**, numa etapa futura.
Nada de roteirização nesta entrega.

## Migrations (ordem)

1. `create table product_weights` + RLS + seed (script Node reusando `parseWeightKg`).
2. `alter table purchase_orders add total_weight_kg`.
3. `create or replace function get_standard_product_catalog` devolvendo `weight_kg`
   (`DROP FUNCTION` antes se mudar o tipo de retorno) + `notify pgrst,'reload schema'`.

SQL versionado em `supabase/` (padrão do projeto). `notify pgrst,'reload schema'`
após criar/alterar função/coluna exposta.

## Testes / verificação

- **Parser**: tabela de casos cobrindo `700g`, `500 g`, `1kg`, `1,5 kg`,
  `700 gramas`, nome sem peso (→ null), e **nome com dois números** —
  `"Rondelli 4 Queijos - 700g"` deve retornar 0.700 (pegar `700g`, ignorar o `4`
  que não vem seguido de unidade) e `"Massa de Pastel - 1kg"` deve retornar 1.000.
- **Seed**: contar `product_weights` == nº de nomes distintos do catálogo;
  conferir os 3 casos especiais (2× `1kg` → 1.000; `"700 gramas"` → 0.700).
- **Form**: total do rodapé bate com `Σ(qtd × peso)`; sem peso por item; aviso
  aparece quando há item sem peso cadastrado.
- **Save**: ler o pedido salvo e conferir `total_weight_kg` == soma esperada
  (não há coluna de peso por item).
- **PDF**: gerar ficha individual + bulk e conferir o `Peso total` por pedido e o
  peso total do dia; a tabela de itens permanece sem coluna de peso.
- **Smoke runtime**: telas `franchiseeOnly` (Gestão > Reposição) não são
  testáveis como admin — validar por build + content-check no live
  ([.tmp/verify-content.mjs](../../../.tmp/verify-content.mjs)); componentes de
  `minha-loja` caem no chunk `Gestao-*.js`.

## Riscos / notas

- **Peso líquido ≠ peso de carga.** O nome dá o peso do produto, não o peso com
  embalagem/caixa coletiva. A tabela permite corrigir por SQL quando o peso real
  de carga for conhecido (override = `is_auto=false`). O roteirizador futuro deve
  assumir margem ou usar pesos de carga ajustados.
- **Acoplamento por `product_name`.** Rename de produto cria nova chave no
  `product_weights` (peso "desconhecido" até reseed/parse) — mesmo acoplamento já
  existente no catálogo; o fallback de parser em runtime cobre o intervalo.
- **Pedidos antigos** não têm `total_weight_kg`; o PDF recalcula via `weightMap`
  (não depende do snapshot), então a ficha sempre mostra o `Peso total`.
- **Inconsistência tolerada:** se um peso for corrigido em `product_weights` depois
  do pedido, o `total_weight_kg` gravado (snapshot) pode divergir do total
  recalculado no PDF. É aceitável: a rota lê o snapshot; a ficha é operacional.
  Correções de peso são raras e via SQL.
