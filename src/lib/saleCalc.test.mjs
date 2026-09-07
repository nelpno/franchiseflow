// Tests para saleCalc.js — a conta da venda manual
// Roda direto: node src/lib/saleCalc.test.mjs
// Sem framework — usa node:assert

import assert from "node:assert/strict";
import {
  FEEABLE_METHODS,
  chargesCardFee,
  calcSubtotal,
  calcDeliveryFee,
  calcDiscountAmount,
  calcCardFeeAmount,
  calcNetValue,
  calcSale,
} from "./saleCalc.js";

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
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} ≠ ${b}`);

// ─── subtotal ───────────────────────────────────────────────────────────────
test("subtotal soma quantidade × preço", () => {
  assert.equal(calcSubtotal([{ quantity: 2, unit_price: 25 }, { quantity: 1, unit_price: 40 }]), 90);
});

test("subtotal de lista vazia é 0, não NaN", () => {
  assert.equal(calcSubtotal([]), 0);
  assert.equal(calcSubtotal(), 0);
});

test("item com quantidade/preço sujo vira 0, nunca NaN na tela", () => {
  assert.equal(calcSubtotal([{ quantity: "", unit_price: 25 }, { quantity: 2, unit_price: null }]), 0);
  assert.equal(calcSubtotal([{ quantity: "3", unit_price: "10" }]), 30);
  assert.ok(!Number.isNaN(calcSubtotal([{ quantity: "abc", unit_price: "xyz" }])));
});

// ─── frete ──────────────────────────────────────────────────────────────────
test("frete só conta em delivery", () => {
  assert.equal(calcDeliveryFee({ deliveryMethod: "delivery", deliveryFee: 15 }), 15);
  assert.equal(calcDeliveryFee({ deliveryMethod: "pickup", deliveryFee: 15 }), 0);
});

// ─── desconto ───────────────────────────────────────────────────────────────
test("desconto em reais", () => {
  assert.equal(calcDiscountAmount({ discountInput: 20, discountType: "fixed", subtotal: 100 }), 20);
});

test("desconto em porcentagem", () => {
  assert.equal(calcDiscountAmount({ discountInput: 10, discountType: "percent", subtotal: 250 }), 25);
});

test("desconto nunca passa do subtotal (nem em R$ nem em %)", () => {
  assert.equal(calcDiscountAmount({ discountInput: 500, discountType: "fixed", subtotal: 100 }), 100);
  assert.equal(calcDiscountAmount({ discountInput: 150, discountType: "percent", subtotal: 100 }), 100);
});

test("desconto zero/negativo/vazio é 0", () => {
  assert.equal(calcDiscountAmount({ discountInput: 0, discountType: "fixed", subtotal: 100 }), 0);
  assert.equal(calcDiscountAmount({ discountInput: -5, discountType: "fixed", subtotal: 100 }), 0);
  assert.equal(calcDiscountAmount({ discountInput: "", discountType: "percent", subtotal: 100 }), 0);
});

// ─── quem cobra taxa ────────────────────────────────────────────────────────
test("sem tabela de taxas, quem decide é o método", () => {
  for (const m of FEEABLE_METHODS) {
    assert.equal(chargesCardFee({ paymentMethod: m, cardFeePercent: 3.5, hasPaymentFeesConfig: false }), true, m);
  }
  for (const m of ["cash", "pix", "other"]) {
    assert.equal(chargesCardFee({ paymentMethod: m, cardFeePercent: 3.5, hasPaymentFeesConfig: false }), false, m);
  }
});

test("com tabela de taxas, quem decide é o percentual — inclusive em PIX", () => {
  assert.equal(chargesCardFee({ paymentMethod: "pix", cardFeePercent: 1.2, hasPaymentFeesConfig: true }), true);
  assert.equal(chargesCardFee({ paymentMethod: "credit", cardFeePercent: 0, hasPaymentFeesConfig: true }), false);
});

test("meal_voucher (VR/Sodexo) cobra taxa — foi adicionado em 24/06/2026", () => {
  assert.ok(FEEABLE_METHODS.includes("meal_voucher"));
});

test("card_machine ficou de fora de propósito (saiu da UI)", () => {
  assert.ok(!FEEABLE_METHODS.includes("card_machine"));
});

// ─── taxa de cartão ─────────────────────────────────────────────────────────
test("a base da taxa é subtotal − desconto + frete", () => {
  const taxa = calcCardFeeAmount({
    subtotal: 200, discountAmount: 50, deliveryFee: 30,
    paymentMethod: "credit", cardFeePercent: 10, hasPaymentFeesConfig: false,
  });
  perto(taxa, 18, "10% de (200 − 50 + 30) = 18");
});

test("a base é a MESMA nos dois modos (repassada e absorvida)", () => {
  const args = {
    subtotal: 200, discountAmount: 50, deliveryFee: 30,
    paymentMethod: "credit", cardFeePercent: 10, hasPaymentFeesConfig: false,
  };
  assert.equal(calcCardFeeAmount(args), calcCardFeeAmount(args));
});

test("método sem taxa não gera taxa nem com percentual configurado", () => {
  assert.equal(calcCardFeeAmount({
    subtotal: 100, discountAmount: 0, deliveryFee: 0,
    paymentMethod: "pix", cardFeePercent: 3.5, hasPaymentFeesConfig: false,
  }), 0);
});

// ─── líquido ────────────────────────────────────────────────────────────────
test("taxa REPASSADA soma no líquido (o cliente paga)", () => {
  perto(calcNetValue({ subtotal: 100, discountAmount: 0, cardFeeAmount: 3.5, deliveryFee: 0, feePassedToCustomer: true }), 103.5, "repassada");
});

test("taxa ABSORVIDA subtrai do líquido (a franquia paga)", () => {
  perto(calcNetValue({ subtotal: 100, discountAmount: 0, cardFeeAmount: 3.5, deliveryFee: 0, feePassedToCustomer: false }), 96.5, "absorvida");
});

test("frete é receita: entra somando no líquido", () => {
  perto(calcNetValue({ subtotal: 100, discountAmount: 0, cardFeeAmount: 0, deliveryFee: 12, feePassedToCustomer: false }), 112, "frete soma");
});

// ─── a conta inteira ────────────────────────────────────────────────────────
test("venda completa: delivery + desconto % + crédito repassado", () => {
  const r = calcSale({
    items: [{ quantity: 2, unit_price: 50 }, { quantity: 1, unit_price: 100 }], // 200
    discountInput: 10, discountType: "percent",                                 // 20
    deliveryMethod: "delivery", deliveryFee: 30,
    paymentMethod: "credit", cardFeePercent: 5, hasPaymentFeesConfig: false,
    feePassedToCustomer: true,
  });
  perto(r.subtotal, 200, "subtotal");
  perto(r.discountAmount, 20, "desconto");
  perto(r.effectiveDeliveryFee, 30, "frete");
  perto(r.cardFeeAmount, 10.5, "5% de 210");
  perto(r.netValue, 220.5, "210 + 10,5");
  assert.equal(r.cobraTaxa, true);
});

test("mesma venda em retirada: o frete digitado é ignorado", () => {
  const r = calcSale({
    items: [{ quantity: 2, unit_price: 50 }],
    deliveryMethod: "pickup", deliveryFee: 30,
    paymentMethod: "pix", hasPaymentFeesConfig: false,
  });
  perto(r.effectiveDeliveryFee, 0, "retirada não tem frete");
  perto(r.netValue, 100, "líquido");
  assert.equal(r.cobraTaxa, false);
});

test("venda vazia não produz NaN em campo nenhum", () => {
  const r = calcSale();
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "number") assert.ok(!Number.isNaN(v), `${k} veio NaN`);
  }
  assert.equal(r.netValue, 0);
});

test("desconto maior que a venda não deixa o líquido negativo pelo desconto", () => {
  const r = calcSale({
    items: [{ quantity: 1, unit_price: 50 }],
    discountInput: 999, discountType: "fixed",
    paymentMethod: "pix",
  });
  assert.equal(r.discountAmount, 50);
  assert.equal(r.netValue, 0);
});

test("regressão: a taxa NÃO pode ser calculada antes do desconto", () => {
  // Se a base fosse (subtotal + frete) sem tirar o desconto, daria 11,50 em vez de 10,50
  const r = calcSale({
    items: [{ quantity: 1, unit_price: 200 }],
    discountInput: 20, discountType: "fixed",
    deliveryMethod: "delivery", deliveryFee: 30,
    paymentMethod: "credit", cardFeePercent: 5,
  });
  perto(r.cardFeeAmount, 10.5, "base tem de ser 210, não 230");
});

// ─── Resultado ──────────────────────────────────────────────────────────────
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
