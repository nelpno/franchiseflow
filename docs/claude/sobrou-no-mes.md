# "Sobrou no mês" e o recebimento da venda — contrato do dinheiro (S6, 28/09/2026)

> Fonte do número: `calculatePnL()` em `src/lib/financialCalcs.js` (testes: `node src/lib/financialCalcs.test.mjs`).
> Quem mostra: Gestão › Resultado (`TabResultado`), o admin em Financeiro › Por unidade (renderiza o MESMO `TabResultado`) e o relatório do mês em PDF (`montarRelatorioMensal`).

## A fórmula

```
Sobrou = Recebido − Taxas de cartão absorvidas − Despesas
Recebido = Σ (value − discount_amount + delivery_fee)      das vendas do mês
Taxas    = Σ card_fee_amount   das vendas do mês com fee_passed_to_customer ≠ true
Despesas = Σ expenses.amount   do mês (todas as categorias)
```

É **caixa puro**: não há custo de mercadoria (CMV). Compra à fábrica entra como despesa no mês em que vira despesa. Admin e franqueada veem o mesmo número.

## Qual mês

| Item | Data que decide o mês | Observação |
|---|---|---|
| Venda | `sale_date` (DATE, dia da venda) | Nunca `created_at`: venda lançada no dia 1 com data 31 é do mês anterior. `created_at` só entra se `sale_date` faltar (legado). |
| Despesa | `expense_date` | Marketing: a despesa nasce com a competência do `reference_month` (trigger do pagamento). Pedido à fábrica: quando vira "entregue" (`compra_produto` + `transporte`). Mensalidade ASAAS: quando a fatura é paga (`pacote_sistema`). |
| Recebimento | `confirmed_at` | Não muda o mês da venda (ver abaixo). |

Venda com data FUTURA dentro do mês conta no Resultado. O Financeiro da rede (`get_financeiro_rede`) no mês corrente corta em HOJE e mostra as futuras à parte (`future_count`): no mês corrente os dois números podem diferir por isso; em mês fechado batem.

## Vendas "a receber"

- **Entram no Sobrou.** O mês é da venda, não do dinheiro na mão. "A receber" é um alerta separado (Financeiro da rede: `unconfirmed_count/value`, e `unconfirmed_old_count` = há mais de 7 dias), não um desconto do resultado.
- **Recebimento** (`payment_confirmed` + `confirmed_at`), contrato S6.2 (`src/lib/recebimento.js`):
  - chave `ui_v2` DESLIGADA (hoje, rede toda): venda nova nasce "a receber"; a franqueada toca "Recebido" na lista. Nada mudou.
  - chave LIGADA: venda nova nasce **recebida**, a não ser que ela marque "Ainda vou receber" no formulário. É um `Sale.update` depois da RPC `save_sale_with_items` (que não grava recebimento); se falhar, a venda fica "a receber" e aparece aviso.
  - editar a venda nunca mexe no recebimento.
  - `confirmed_at` = relógio do SERVIDOR (trigger `trg_sales_confirmed_at_servidor`, `supabase/2026-09-28-s6-sales-confirmed-at-servidor.sql`): vira recebida → `now()`; desmarcada → NULL; continua recebida → mantém. Antes era o relógio do celular (530 vendas em 90 dias com recebimento ANTES da criação).
- **Evento do anúncio (CAPI):** sai quando a venda vira recebida — botão "Recebido", "Confirmar todas" ou venda que nasce recebida (`src/lib/capiManual.js` → n8n `SendCapiOnSaleManual`). Uma vez só: o workflow pula se `capi_sent=true` e o `event_id` é `purchase_manual_<id>` (o Meta descarta repetido). Sem cliente (`contact_id`) não sai.

## Cancelamento e estorno

- **Não existe status "cancelada".** Cancelar = excluir a venda: sai do Sobrou do mês dela, o estoque volta (trigger de delete) e o contato é recalculado. Se o evento do anúncio já saiu (`capi_sent`), a tela avisa antes: o Meta fica com uma compra que não existe mais.
- **Estorno** (o dinheiro voltou / marcou errado) = desmarcar "Recebido": a venda volta para "a receber", `confirmed_at` vira NULL, o Sobrou NÃO muda (a venda continua no mês). O evento do anúncio não é desfeito e, se remarcar, não sai de novo.
- Clique repetido no "Recebido": travado por venda (ref + botão desligado); o patch é idempotente.

## Conferência com 3 unidades reais (agosto/2026, 28/09)

Três caminhos independentes: (A) `calculatePnL` sobre as linhas cruas, (B) soma em SQL, (C) `get_financeiro_rede` como admin. Script: `.tmp/s6-confere.mjs` (fora do git; roda da pasta do dashboard, imprime só totais).

| Unidade | Vendas | Recebido (A = B = C) | Taxas | Despesas | Sobrou (A = B) |
|---|---|---|---|---|---|
| Itápolis | 67 | 4.369,36 | 29,38 | 2.303,30 | 2.036,68 |
| Santos | 216 | 25.262,36 | 195,85 | 23.769,92 | 1.296,59 |
| Vila Maria | 276 | 32.565,81 | 466,88 | 16.368,96 | 15.729,97 |

Nenhuma das 3 tinha venda "a receber" em agosto.

## A planilha (S6.3)

`src/lib/salesExport.js` (colunas com `type`) + `src/lib/exportSheet.js` (célula de número/data/hora no .xlsx). Colunas: Data, Hora do lançamento (Brasília), Nº Pedido, Cliente, Telefone (texto), Pagamento, Valor Bruto, Desconto, Frete, Valor Recebido, Status (Recebido / A receber), Tipo, Observações + linha TOTAL. A consulta do Resultado traz `SALES_EXPORT_QUERY_COLUMNS` (sem elas o Nº saía vazio e o Cliente "—" no admin). Testes: `node src/lib/salesExport.test.mjs` (lê o .xlsx de volta).

## Medição (S6.4)

Eventos do Clarity: `relatorio_mes_baixado`, `relatorio_mes_erro`, `planilha_resultado_excel|pdf`, `planilha_vendas_excel|pdf`. O Clarity já marca o papel (`role`), então dá para separar admin de franqueada.

## Voltar atrás

- Recebimento na criação: chave `ui_v2` desligada (já é o padrão).
- Trigger: `drop trigger if exists trg_sales_confirmed_at_servidor on public.sales; drop function if exists public.sales_confirmed_at_servidor();`
- Front: `git revert` dos commits S6.
