// S17 (28/09/2026): modelo da tela nova do Resultado + PDF (montarResultadoMes). Rodar:
//   node src/lib/resultadoMes.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { montarResultadoMes, avaliarComprasFabrica, anuncioComBase, resumirMes } from "./monthlyReport.js";
import { calculatePnL } from "./financialCalcs.js";

const sales = [
  // agosto
  { id: "a1", sale_date: "2026-08-03", value: 100, discount_amount: 0, delivery_fee: 10, card_fee_amount: 4, fee_passed_to_customer: false, source: "manual", payment_method: "credit" },
  { id: "a2", sale_date: "2026-08-09", value: 200, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "bot", payment_method: "pix" },
  { id: "a3", sale_date: "2026-08-25", value: 300, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "manual", payment_method: "pix" },
  // setembro (mês corrente no teste: hoje = 11/09)
  { id: "s1", sale_date: "2026-09-02", value: 150, discount_amount: 10, delivery_fee: 15, card_fee_amount: 5, fee_passed_to_customer: false, source: "bot", payment_method: "card_machine" },
  { id: "s2", sale_date: "2026-09-10", value: 250, discount_amount: 0, delivery_fee: 0, card_fee_amount: 9, fee_passed_to_customer: true, source: "manual", payment_method: null },
  { id: "s3", sale_date: "2026-09-28", value: 80, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "manual", payment_method: "cash" }, // data futura: conta no mês
];
const saleItems = [
  { sale_id: "a1", product_name: "Nhoque", quantity: 5, unit_price: 20 },
  { sale_id: "a2", product_name: "Lasanha", quantity: 2, unit_price: 100 },
  { sale_id: "a3", product_name: "Nhoque", quantity: 10, unit_price: 30 },
  { sale_id: "s1", product_name: "Lasanha", quantity: 6, unit_price: 25 },
  { sale_id: "s2", product_name: "Nhoque", quantity: 1, unit_price: 250 },
  { sale_id: "s3", product_name: "Sofioli", quantity: 4, unit_price: 20 },
];
const expenses = [
  { id: "e1", expense_date: "2026-08-05", category: "compra_produto", amount: 120, source: "purchase_order", source_id: "po1" },
  { id: "e2", expense_date: "2026-08-05", category: "transporte", amount: 30, source: "purchase_order", source_id: "po1" },
  { id: "e3", expense_date: "2026-08-20", category: "outros", amount: 50, source: "manual" },
  { id: "e4", expense_date: "2026-09-01", category: "marketing", amount: 40, source: "marketing_payment", source_id: "mk1" },
  { id: "e5", expense_date: "2026-09-04", category: "compra_produto", amount: 90, source: "purchase_order", source_id: "po2" },
  { id: "e6", expense_date: "2026-09-04", category: "transporte", amount: 10, source: "purchase_order", source_id: "po2" },
  { id: "e7", expense_date: "2026-09-05", category: "compra_produto", amount: 60, source: "purchase_order", source_id: "po3" },
  { id: "e8", expense_date: "2026-09-20", category: "compra_embalagem", amount: 7, source: "manual" },
];
const HOJE = new Date(2026, 8, 11);
const setembro = montarResultadoMes({ sales, saleItems, expenses, mesSelecionado: HOJE, hoje: HOJE });

const soma = (l, k = "valor") => l.reduce((s, x) => s + x[k], 0);
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("Sobrou = calculatePnL e é o MESMO número do PDF (uma fonte só)", () => {
  const pnl = calculatePnL(sales.slice(3), [], expenses.slice(3));
  perto(setembro.sobrou, pnl.lucroCaixa);
  perto(setembro.entrou, pnl.totalRecebido);
  perto(setembro.entrou - setembro.saiu, setembro.sobrou);
  const ultimo = setembro.relatorio.meses[setembro.relatorio.meses.length - 1];
  assert.equal(ultimo.chave, "2026-09");
  perto(ultimo.lucroCaixa, setembro.sobrou);
  perto(ultimo.faturamento, setembro.entrou);
  assert.deepEqual(ultimo.maisVendidos, setembro.maisVendidos);
});

test("De onde veio soma o Entrou (vendas + frete − descontos)", () => {
  perto(soma(setembro.deOndeVeio), setembro.entrou);
  assert.deepEqual(setembro.deOndeVeio.map((l) => l.chave), ["vendas", "frete", "descontos"]);
  assert.equal(setembro.deOndeVeio[1].n, 1); // 1 entrega
  // robô × manual e formas de pagamento também somam o Entrou
  perto(setembro.mes.porOrigem.robo.valor + setembro.mes.porOrigem.manual.valor, setembro.entrou);
  assert.equal(setembro.mes.porOrigem.robo.n, 1);
  perto(soma(setembro.mes.porPagamento), setembro.entrou);
  assert.ok(setembro.mes.porPagamento.some((p) => p.rotulo === "Maquininha"));
  assert.ok(setembro.mes.porPagamento.some((p) => p.rotulo === "Não informado"));
});

test("Para onde foi soma o Saiu; pedido à fábrica (compra + frete) numa linha só", () => {
  perto(soma(setembro.paraOndeFoi), setembro.saiu);
  const fab = setembro.paraOndeFoi.find((l) => l.chave === "__fabrica__");
  assert.equal(fab.valor, 160);
  assert.equal(fab.pedidos, 2);
  const taxa = setembro.paraOndeFoi.find((l) => l.chave === "__taxas__");
  assert.equal(taxa.valor, 5); // a de s2 foi repassada ao cliente
  assert.equal(setembro.paraOndeFoi[0].chave, "__fabrica__"); // maior primeiro
});

test("mês em andamento compara com o MESMO trecho do mês anterior", () => {
  const c = setembro.comparacao;
  assert.equal(c.mesmoTrecho, true);
  assert.equal(c.mesAnterior, "agosto");
  // agosto até dia 11: a1 + a2 = 110 + 200 − taxa 4 − despesas (e1+e2) 150 = 156
  perto(c.antes, 156);
  // setembro até dia 11: s1 (155) + s2 (250) − taxa 5 − (40+90+10+60) = 200
  perto(c.agora, 200);
  perto(c.diff, 44);
  assert.equal(c.pct, 28);
});

test("mês fechado compara com o mês anterior inteiro", () => {
  const ago = montarResultadoMes({ sales, saleItems, expenses, mesSelecionado: new Date(2026, 7, 1), hoje: HOJE });
  assert.equal(ago.emAndamento, false);
  assert.equal(ago.comparacao, null); // julho sem nada: não compara com zero
  const set2 = montarResultadoMes({ sales, saleItems, expenses, mesSelecionado: HOJE, hoje: new Date(2026, 9, 3) });
  assert.equal(set2.comparacao.mesmoTrecho, false);
  perto(set2.comparacao.antes, ago.sobrou);
  perto(set2.comparacao.agora, set2.sobrou);
});

test("O que mudou: variação em unidades no mesmo trecho, maior primeiro, ignora ruído", () => {
  // até dia 11: agosto Nhoque 5, Lasanha 2 · setembro Lasanha 6, Nhoque 1 (Sofioli é dia 28)
  assert.deepEqual(setembro.oQueMudou, [
    { nome: "Lasanha", antes: 2, agora: 6 },
    { nome: "Nhoque", antes: 5, agora: 1 },
  ]);
});

test("Mais vendidos por QUANTIDADE (igual ao PDF)", () => {
  assert.deepEqual(setembro.maisVendidos.map((p) => p.name), ["Lasanha", "Sofioli", "Nhoque"]);
});

test("Quanto sobrou por mês: 6 meses até o selecionado, acumulado do ano", () => {
  assert.equal(setembro.porMes.length, 6);
  assert.deepEqual(setembro.porMes.map((m) => m.rotulo), ["abr", "mai", "jun", "jul", "ago", "set"]);
  assert.equal(setembro.porMes[5].atual, true);
  perto(setembro.porMes[4].sobrou, resumirMes(new Date(2026, 7, 1), { sales, saleItems, expenses }).lucroCaixa);
  assert.equal(setembro.porMes[0].temDado, false);
  perto(setembro.ano.total, setembro.porMes[4].sobrou + setembro.porMes[5].sobrou);
  assert.equal(setembro.ano.mesesComDado, 2);
});

test("Compra da fábrica ainda não lançada: a caminho (só no mês corrente) e entregue sem gasto", () => {
  const pedidos = [
    { id: "po2", status: "entregue", total_amount: 90, freight_cost: 10, delivered_at: "2026-09-04T13:00:00+00:00" },
    { id: "po4", status: "confirmado", total_amount: 500, freight_cost: 50, delivered_at: null },
    { id: "po5", status: "cancelado", total_amount: 999, freight_cost: 0, delivered_at: null },
    { id: "po6", status: "entregue", total_amount: 70, freight_cost: 0, delivered_at: "2026-09-08T01:30:00+00:00" },
    { id: "po7", status: "entregue", total_amount: 40, freight_cost: 0, delivered_at: "2026-08-30T12:00:00+00:00" },
  ];
  const a = avaliarComprasFabrica({ purchaseOrders: pedidos, expenses, mesSelecionado: HOJE, hoje: HOJE });
  assert.deepEqual(a.aCaminho, { n: 1, valor: 550 });
  assert.deepEqual(a.semGasto, { n: 1, valor: 70 });
  // mês passado: "a caminho" não vale (vai cair no mês da entrega); po7 entregue em agosto sem gasto
  const ago = avaliarComprasFabrica({ purchaseOrders: pedidos, expenses, mesSelecionado: new Date(2026, 7, 1), hoje: HOJE });
  assert.deepEqual(ago.aCaminho, { n: 0, valor: 0 });
  assert.deepEqual(ago.semGasto, { n: 1, valor: 40 });
  // nada pendente → null; não carregou → null (não afirma nada)
  assert.equal(avaliarComprasFabrica({ purchaseOrders: [pedidos[0]], expenses, mesSelecionado: HOJE, hoje: HOJE }), null);
  assert.equal(avaliarComprasFabrica({ purchaseOrders: null, expenses, mesSelecionado: HOJE, hoje: HOJE }), null);
  // e o modelo carrega o aviso
  const m = montarResultadoMes({ sales, saleItems, expenses, purchaseOrders: pedidos, mesSelecionado: HOJE, hoje: HOJE });
  assert.equal(m.avisoFabrica.aCaminho.valor, 550);
});

test("Anúncio no PDF só com o robô com base (has_bot_data)", () => {
  const bloco = [{ verba: 400, clientesNovos: 10, vendas: 3, receita: 300 }];
  assert.equal(anuncioComBase(bloco, { has_bot_data: true }), bloco);
  assert.equal(anuncioComBase(bloco, { has_bot_data: false }), null);
  assert.equal(anuncioComBase(bloco, null), null);
  assert.equal(anuncioComBase(bloco, undefined), undefined); // funil não carregou: avisa
  assert.equal(anuncioComBase(undefined, { has_bot_data: true }), undefined);
  assert.equal(anuncioComBase(null, { has_bot_data: true }), null);
});

test("Vendas por produto (Bragança): todos os produtos do mês, por quantidade, valor = qtd × preço", async () => {
  const { buildProductsExportRows, productsExportColumns } = await import("./productsExport.js");
  // setembro inteiro: Lasanha 6 × 25, Sofioli 4 × 20, Nhoque 1 × 250
  assert.deepEqual(setembro.produtos.map((p) => [p.name, p.quantity, p.revenue]), [
    ["Lasanha", 6, 150], ["Sofioli", 4, 80], ["Nhoque", 1, 250],
  ]);
  // o card mostra os 5 primeiros da MESMA lista
  assert.deepEqual(setembro.maisVendidos, setembro.produtos.slice(0, 5));
  const rows = buildProductsExportRows(setembro.produtos, { includeTotalsRow: true });
  assert.deepEqual(rows[0], { produto: "Lasanha", quantidade: 6, valor: 150, pct: 31.25 });
  assert.deepEqual(rows[rows.length - 1], { produto: "TOTAL", quantidade: 11, valor: 480, pct: 100 });
  perto(rows.slice(0, -1).reduce((s, r) => s + r.pct, 0), 100);
  const cols = productsExportColumns(setembro.produtos);
  assert.deepEqual(cols.map((c) => c.header), ["Produto", "Quantidade", "Valor vendido (R$)", "% do total"]);
  assert.equal(cols[1].type, "int");
  assert.equal(productsExportColumns([{ quantity: 1.5 }])[1].type, "brl");
  // nome que começa com "=" não vira fórmula
  assert.ok(!buildProductsExportRows([{ name: "=HYPERLINK()", quantity: 1, revenue: 1 }])[0].produto.startsWith("="));
});

test("Planilha de produtos abre com número de verdade (xlsx)", async () => {
  const XLSX = await import("xlsx");
  const { buildExportWorksheet } = await import("./exportSheet.js");
  const { buildProductsExportRows, productsExportColumns } = await import("./productsExport.js");
  const ws = buildExportWorksheet(XLSX, buildProductsExportRows(setembro.produtos), productsExportColumns(setembro.produtos));
  assert.equal(ws.B2.t, "n");
  assert.equal(ws.B2.v, 6);
  assert.equal(ws.C2.v, 150);
  assert.equal(ws.D2.v, 31.25);
});
