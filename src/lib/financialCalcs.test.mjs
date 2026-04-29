// Tests para financialCalcs.js
// Roda direto: node src/lib/financialCalcs.test.mjs
// Sem framework — usa node:assert

import assert from "node:assert/strict";
import {
  calculatePnL,
  calcularEstoqueResumo,
  getEstadoFinanceiro,
  isInMonth,
  getTopProducts,
  getSaleNetValue,
} from "./financialCalcs.js";

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ❌ ${name}\n     ${e.message}`);
    fail++;
  }
}

// ─── Mocks ──────────────────────────────────────────────────────────────────
const sales = [
  { value: 1000, delivery_fee: 50, discount_amount: 0, card_fee_amount: 35 },
  { value: 2000, delivery_fee: 100, discount_amount: 50, card_fee_amount: 70 },
];
// totalRecebido = 1000 + 50 + 2000 + 100 - 50 = 3100
// taxasCartao = 105

const saleItems = [
  { quantity: 5, cost_price: 18, unit_price: 30, product_name: "Lasanha" },
  { quantity: 3, cost_price: 15, unit_price: 25, product_name: "Nhoque" },
];
// custoProdutos = 5*18 + 3*15 = 90 + 45 = 135

// Cenário 1: expenses sem categoria (legacy)
const expensesLegacy = [
  { amount: 200 },
  { amount: 150 },
];
// outrasDespesas = 350

// Cenário 2: expenses categorizadas (1A.1+)
const expensesCategorized = [
  { amount: 500, category: "compra_produto" },  // compra de fornecedor
  { amount: 200, category: "aluguel" },
  { amount: 100, category: "energia" },
  { amount: 150, category: "marketing" },
];
// outrasDespesas = 950
// gastosCompraProduto = 500
// gastosOperacionais = 450

// ─── calculatePnL: legacy mantido ───────────────────────────────────────────
console.log("\n📊 calculatePnL — legacy mantido (não-breaking)");

test("retorna todos os campos legacy", () => {
  const r = calculatePnL(sales, saleItems, expensesLegacy);
  assert.equal(r.vendas, 3000);
  assert.equal(r.freteCobrado, 150);
  assert.equal(r.totalDescontos, 50);
  assert.equal(r.totalRecebido, 3100);
  assert.equal(r.custoProdutos, 135);
  assert.equal(r.taxasCartao, 105);
  assert.equal(r.outrasDespesas, 350);
  assert.equal(r.lucro, 3100 - 135 - 105 - 350);  // 2510
  assert.equal(r.salesCount, 2);
  assert.equal(Math.round(r.margem * 10) / 10, 81);
});

test("expenses sem 'category' não quebra (default 0 para gastosCompraProduto)", () => {
  const r = calculatePnL(sales, saleItems, expensesLegacy);
  assert.equal(r.gastosCompraProduto, 0);
  assert.equal(r.gastosOperacionais, 350);
});

// ─── calculatePnL: campos novos categorizados ───────────────────────────────
console.log("\n📊 calculatePnL — campos novos (1A.2)");

test("gastosCompraProduto soma só category=compra_produto", () => {
  const r = calculatePnL(sales, saleItems, expensesCategorized);
  assert.equal(r.gastosCompraProduto, 500);
});

test("gastosOperacionais = todas - compra_produto", () => {
  const r = calculatePnL(sales, saleItems, expensesCategorized);
  assert.equal(r.gastosOperacionais, 450);
});

test("lucroCaixa = receita - taxas - todas as despesas (caixa puro)", () => {
  const r = calculatePnL(sales, saleItems, expensesCategorized);
  // 3100 - 105 - 950 = 2045
  assert.equal(r.lucroCaixa, 2045);
});

test("lucroCompetencia = receita - CMV - taxas - operacionais (sem dupla contagem)", () => {
  const r = calculatePnL(sales, saleItems, expensesCategorized);
  // 3100 - 135 - 105 - 450 = 2410
  assert.equal(r.lucroCompetencia, 2410);
});

test("relação matemática: lucroCaixa - lucroCompetencia = gastosCompraProduto - custoProdutos", () => {
  const r = calculatePnL(sales, saleItems, expensesCategorized);
  // 2045 - 2410 = -365
  // 500 - 135 = 365 → diferença oposta (caixa pagou compra mas competência só usou CMV vendido)
  assert.equal(r.lucroCaixa - r.lucroCompetencia, -(r.gastosCompraProduto - r.custoProdutos));
});

test("totalRecebido = 0 → margem = 0 (sem div/0)", () => {
  const r = calculatePnL([], [], []);
  assert.equal(r.totalRecebido, 0);
  assert.equal(r.margem, 0);
  assert.equal(r.margemCaixa, 0);
  assert.equal(r.margemCompetencia, 0);
});

// ─── calcularEstoqueResumo ──────────────────────────────────────────────────
console.log("\n📦 calcularEstoqueResumo");

test("estoque vazio → zeros", () => {
  const r = calcularEstoqueResumo([]);
  assert.equal(r.custoTotal, 0);
  assert.equal(r.vendaPotencial, 0);
  assert.equal(r.qtdProdutosAtivos, 0);
  assert.equal(r.markupMedioPct, 0);
});

test("calcula custo, venda e markup", () => {
  const items = [
    { quantity: 10, cost_price: 18, sale_price: 30, active: true },
    { quantity: 5, cost_price: 12, sale_price: 25, active: true },
  ];
  const r = calcularEstoqueResumo(items);
  assert.equal(r.custoTotal, 240);  // 10*18 + 5*12
  assert.equal(r.vendaPotencial, 425); // 10*30 + 5*25
  assert.equal(r.qtdProdutosAtivos, 2);
  assert.equal(r.markupMedioPct, 77.1); // (425-240)/240 = 0.7708 → 77.1%
});

test("ignora active=false", () => {
  const items = [
    { quantity: 10, cost_price: 18, sale_price: 30, active: true },
    { quantity: 5, cost_price: 12, sale_price: 25, active: false },
  ];
  const r = calcularEstoqueResumo(items);
  assert.equal(r.qtdProdutosAtivos, 1);
});

test("ignora quantity = 0", () => {
  const items = [
    { quantity: 10, cost_price: 18, sale_price: 30, active: true },
    { quantity: 0, cost_price: 12, sale_price: 25, active: true },
  ];
  const r = calcularEstoqueResumo(items);
  assert.equal(r.qtdProdutosAtivos, 1);
});

test("custo=0 → markup=0 (sem div/0)", () => {
  const items = [{ quantity: 5, cost_price: 0, sale_price: 30, active: true }];
  const r = calcularEstoqueResumo(items);
  assert.equal(r.markupMedioPct, 0);
});

// ─── getEstadoFinanceiro ────────────────────────────────────────────────────
console.log("\n🎨 getEstadoFinanceiro — 4 estados");

test("🟢 lucro+estoque alto → verde 'Mês excelente'", () => {
  const r = getEstadoFinanceiro({ lucroCaixa: 3000, valorEstoqueVenda: 6000, mediaMensalReceita: 8000 });
  assert.equal(r.estado, "verde");
  assert.match(r.titulo, /excelente/i);
});

test("🔵 lucro baixo + estoque alto → azul 'reposição'", () => {
  const r = getEstadoFinanceiro({ lucroCaixa: -500, valorEstoqueVenda: 8000, mediaMensalReceita: 6000 });
  assert.equal(r.estado, "azul");
  assert.match(r.titulo, /reposição/i);
});

test("🟡 lucro alto + estoque baixo → amarelo 'considere repor'", () => {
  const r = getEstadoFinanceiro({ lucroCaixa: 2000, valorEstoqueVenda: 1500, mediaMensalReceita: 6000 });
  assert.equal(r.estado, "amarelo");
  assert.match(r.titulo, /repor/i);
});

test("🔴 lucro baixo + estoque baixo → vermelho 'atenção'", () => {
  const r = getEstadoFinanceiro({ lucroCaixa: -100, valorEstoqueVenda: 800, mediaMensalReceita: 4000 });
  assert.equal(r.estado, "vermelho");
  assert.match(r.titulo, /atenção/i);
});

test("sem mediaMensalReceita usa fallback estático", () => {
  // Sem histórico, estoqueVenda > 1000 = alto
  const r = getEstadoFinanceiro({ lucroCaixa: 100, valorEstoqueVenda: 2000, mediaMensalReceita: 0 });
  assert.equal(r.estado, "verde"); // lucro + estoque > 1000
});

// ─── Funções existentes (regressão) ─────────────────────────────────────────
console.log("\n🔁 Regressão — funções existentes");

test("isInMonth retorna true pra data no mesmo mês", () => {
  // new Date(year, monthIndex, day) — local timezone (sem confusão UTC)
  assert.equal(isInMonth("2026-04-15", new Date(2026, 3, 1)), true);
});

test("isInMonth retorna false pra outro mês", () => {
  assert.equal(isInMonth("2026-03-15", new Date(2026, 3, 1)), false);
});

test("isInMonth retorna false pra null", () => {
  assert.equal(isInMonth(null, new Date()), false);
});

test("getTopProducts ordena por quantity desc", () => {
  const items = [
    { product_name: "A", quantity: 2, unit_price: 10 },
    { product_name: "B", quantity: 5, unit_price: 10 },
    { product_name: "C", quantity: 1, unit_price: 10 },
  ];
  const top = getTopProducts(items);
  assert.equal(top[0].name, "B");
  assert.equal(top[0].quantity, 5);
  assert.equal(top[0].revenue, 50);
});

// ─── getSaleNetValue ────────────────────────────────────────────────────────
console.log("\n💰 getSaleNetValue — valor recebido por venda");

test("calcula value - desconto + frete", () => {
  assert.equal(getSaleNetValue({ value: 100, discount_amount: 10, delivery_fee: 8 }), 98);
});

test("aceita campos como string (vindo do Supabase)", () => {
  assert.equal(getSaleNetValue({ value: "113.40", discount_amount: "0", delivery_fee: "8.00" }), 121.4);
});

test("campos ausentes/null viram 0 (sem NaN)", () => {
  assert.equal(getSaleNetValue({}), 0);
  assert.equal(getSaleNetValue({ value: null, discount_amount: undefined, delivery_fee: null }), 0);
});

test("sale null/undefined retorna 0", () => {
  assert.equal(getSaleNetValue(null), 0);
  assert.equal(getSaleNetValue(undefined), 0);
});

test("regressão: caso real do Ricardo (118,50 com frete 7)", () => {
  // Venda exibida no dashboard como R$ 118,50 saía 111,50 no export sem o frete
  assert.equal(getSaleNetValue({ value: 111.5, discount_amount: 0, delivery_fee: 7 }), 118.5);
});

// ─── Resultado ──────────────────────────────────────────────────────────────
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
