// node src/lib/vales.test.mjs — vales (26/11/2026): refeição × alimentação, bandeiras e o NULL de "não revisado"
import assert from "node:assert/strict";
import { test } from "node:test";
import { valesMarcados, mexeuEmVale, normalizarBandeiras, alternarBandeira } from "./vales.js";
import { simulacaoVale } from "./simulacoesRobo.js";
import { PAYMENT_METHODS, VALE_BANDEIRAS } from "./franchiseUtils.js";
import { FEEABLE_METHODS } from "./saleCalc.js";

test("vale-alimentação existe no painel e cobra taxa como o refeição", () => {
  assert.ok(PAYMENT_METHODS.some((m) => m.value === "food_voucher" && m.label === "Vale-alimentação"));
  assert.equal(PAYMENT_METHODS.find((m) => m.value === "meal_voucher").label, "Vale-refeição");
  assert.ok(FEEABLE_METHODS.includes("food_voucher"));
});

test("valesMarcados: só modalidades ligadas; retirada sem lista = a da entrega", () => {
  assert.deepEqual(valesMarcados({ payment_delivery: ["food_voucher"], payment_pickup: [] }, { hasDelivery: true, hasPickup: true }), { vr: false, va: true });
  assert.deepEqual(valesMarcados({ payment_delivery: ["food_voucher"], payment_pickup: ["pix"] }, { hasDelivery: false, hasPickup: true }), { vr: false, va: false });
  assert.deepEqual(valesMarcados({ payment_delivery: [], payment_pickup: ["meal_voucher"] }, { hasDelivery: true, hasPickup: true }), { vr: true, va: false });
});

test("mexeuEmVale: só troca de vale conta", () => {
  assert.equal(mexeuEmVale(["pix"], ["pix", "cash"]), false);
  assert.equal(mexeuEmVale(["meal_voucher"], ["meal_voucher", "pix"]), false);
  assert.equal(mexeuEmVale(["meal_voucher"], ["food_voucher"]), true);
  assert.equal(mexeuEmVale([], ["food_voucher"]), true);
});

test("normalizarBandeiras: null fica null; lista na ordem do painel, sem lixo nem repetição", () => {
  assert.equal(normalizarBandeiras(null), null);
  assert.equal(normalizarBandeiras(undefined), null);
  assert.deepEqual(normalizarBandeiras([]), []);
  assert.deepEqual(normalizarBandeiras(["Ticket", "xx", "Alelo", "Ticket", " VR "]), ["Alelo", "Ticket", "VR"]);
  assert.deepEqual(alternarBandeira(null, "Caju"), ["Caju"]);
  assert.deepEqual(alternarBandeira(["Caju"], "Caju"), []);
  assert.ok(VALE_BANDEIRAS.includes("Pluxee (Sodexo)"));
});

test("simulação 'Aceita vale?' segue a regra do robô", () => {
  const base = { has_delivery: true, has_pickup: false };
  assert.equal(simulacaoVale({ ...base, payment_delivery: ["pix"] }), null);
  // Bárbara: só alimentação, com bandeiras
  let r = simulacaoVale({ ...base, payment_delivery: ["food_voucher"], vale_bandeiras: ["Alelo", "Ticket", "VR", "Pluxee (Sodexo)"] });
  assert.match(r.resposta, /^Aceitamos vale-alimentação, nas bandeiras Alelo, Ticket, VR e Pluxee \(Sodexo\)\. Vale-refeição não\.$/);
  assert.equal(r.tag, undefined);
  // só refeição, nunca revisado: não afirma nem nega o alimentação
  r = simulacaoVale({ ...base, payment_delivery: ["meal_voucher"], vale_bandeiras: null });
  assert.match(r.resposta, /O vale-alimentação, a unidade confirma/);
  assert.match(r.tag, /Revise os vales/);
  // só refeição, revisado, sem bandeira
  r = simulacaoVale({ ...base, payment_delivery: ["meal_voucher"], vale_bandeiras: [] });
  assert.match(r.resposta, /Vale-alimentação não\./);
  assert.match(r.resposta, /a unidade confirma para você\.$/);
  assert.match(r.tag, /Marque as bandeiras/);
});
