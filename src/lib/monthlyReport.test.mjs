import assert from "node:assert/strict";
import { test } from "node:test";
import { montarRelatorioMensal, montarBlocoAnuncio } from "./monthlyReport.js";
import { calculatePnL } from "./financialCalcs.js";

const sales = [
  // julho
  { id: "s1", sale_date: "2026-07-03", value: 100, discount_amount: 0, delivery_fee: 10, card_fee_amount: 4, fee_passed_to_customer: false, contact_id: "c1" },
  { id: "s2", sale_date: "2026-07-20", value: 50, discount_amount: 5, delivery_fee: 0, card_fee_amount: 2, fee_passed_to_customer: true, contact_id: "c1" },
  // agosto
  { id: "s3", sale_date: "2026-08-05", value: 80, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, contact_id: "c2" },
  { id: "s4", sale_date: "2026-08-25", value: 70, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, contact_id: null },
  // setembro (mês corrente no teste)
  { id: "s5", sale_date: "2026-09-02", value: 60, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, contact_id: "c3" },
];
const saleItems = [
  { sale_id: "s1", product_name: "Nhoque", quantity: 2, unit_price: 50 },
  { sale_id: "s2", product_name: "Rondelli", quantity: 1, unit_price: 50 },
  { sale_id: "s3", product_name: "Nhoque", quantity: 1, unit_price: 40 },
  { sale_id: "s3", product_name: "Sofioli", quantity: 3, unit_price: 13.33 },
  { sale_id: "s5", product_name: "Canelone", quantity: 1, unit_price: 60 },
];
const expenses = [
  { expense_date: "2026-07-10", category: "compra_produto", amount: 30 },
  { expense_date: "2026-07-12", category: "marketing", amount: 20 },
  { expense_date: "2026-08-10", category: "compra_produto", amount: 100 },
  { expense_date: "2026-09-01", category: "pacote_sistema", amount: 150 },
];

const HOJE = new Date(2026, 8, 11); // 11/09/2026
const rel = montarRelatorioMensal({ sales, saleItems, expenses, mesSelecionado: HOJE, hoje: HOJE });

test("3 meses, do mais antigo para o selecionado", () => {
  assert.deepEqual(rel.meses.map((m) => m.chave), ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(rel.meses.map((m) => m.rotulo), ["Jul/2026", "Ago/2026", "Set/2026"]);
});

test("faturamento e lucro saem do calculatePnL (o PDF não discorda da tela)", () => {
  const jul = rel.meses[0];
  const pnl = calculatePnL(sales.slice(0, 2), [], expenses.slice(0, 2));
  assert.equal(jul.faturamento, 155); // 110 + 45
  assert.equal(jul.lucroCaixa, pnl.lucroCaixa);
  assert.equal(jul.taxasCartao, 4); // a taxa repassada ao cliente não é custo
  assert.equal(jul.lucroCaixa, 155 - 4 - 50);
});

test("clientes diferentes ignora venda sem contato e conta o mesmo cliente uma vez", () => {
  assert.equal(rel.meses[0].clientes, 1); // c1 comprou 2x
  assert.equal(rel.meses[1].clientes, 1); // s4 sem contato
});

test("despesa agrupada pelo rótulo da categoria, categorias da maior para a menor", () => {
  assert.equal(rel.meses[0].despesasPorCategoria["Compra de produto"], 30);
  assert.equal(rel.meses[0].despesasPorCategoria["Marketing"], 20);
  assert.deepEqual(rel.categorias, ["Pacote Tecnologia", "Compra de produto", "Marketing"]);
});

test("mais vendidos por quantidade, no mês certo", () => {
  assert.equal(rel.meses[1].maisVendidos[0].name, "Sofioli");
  assert.equal(rel.meses[1].maisVendidos[0].quantity, 3);
  assert.deepEqual(rel.meses[2].maisVendidos.map((p) => p.name), ["Canelone"]);
});

test("mês em andamento: comparação justa corta os anteriores no mesmo dia", () => {
  assert.equal(rel.emAndamento, true);
  assert.equal(rel.diaCorte, 11);
  assert.equal(rel.meses[0].faturamentoAteDia, 110); // só s1 (dia 3); s2 é dia 20
  assert.equal(rel.meses[1].faturamentoAteDia, 80); // só s3 (dia 5)
  assert.equal(rel.meses[2].faturamentoAteDia, 60);
});

test("mês fechado: sem linha de comparação justa", () => {
  const ago = montarRelatorioMensal({ sales, saleItems, expenses, mesSelecionado: new Date(2026, 7, 15), hoje: HOJE });
  assert.equal(ago.emAndamento, false);
  assert.equal(ago.diaCorte, null);
  assert.ok(ago.meses.every((m) => m.faturamentoAteDia === null));
  assert.deepEqual(ago.meses.map((m) => m.chave), ["2026-06", "2026-07", "2026-08"]);
});

test("bloco do anúncio: some quando não há nada, lê strings e linha ausente", () => {
  assert.equal(montarBlocoAnuncio([null, null, null]), null);
  assert.equal(montarBlocoAnuncio([{ verba_bruta: 0, vendas_anuncio: 0 }]), null);
  const b = montarBlocoAnuncio([
    { verba_bruta: "450", clientes_novos_anuncio: 67, vendas_anuncio: 20, receita_anuncio: "1308.90" },
    null,
  ]);
  assert.deepEqual(b[0], { verba: 450, clientesNovos: 67, vendas: 20, receita: 1308.9 });
  assert.deepEqual(b[1], { verba: 0, clientesNovos: 0, vendas: 0, receita: 0 });
});
