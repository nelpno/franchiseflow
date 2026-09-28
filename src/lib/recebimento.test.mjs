// node src/lib/recebimento.test.mjs — contrato do recebimento (S6.2)
import assert from "node:assert/strict";
import { nasceRecebida, patchRecebimento } from "./recebimento.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("chave desligada: nada muda, venda nasce a receber", () => {
  assert.equal(nasceRecebida({ uiV2: false, isEditing: false, aindaVouReceber: false }), false);
  assert.equal(nasceRecebida({ uiV2: false, isEditing: false, aindaVouReceber: true }), false);
});

test("chave ligada: venda nova nasce recebida", () => {
  assert.equal(nasceRecebida({ uiV2: true, isEditing: false, aindaVouReceber: false }), true);
});

test("'ainda vou receber' segura a venda como a receber", () => {
  assert.equal(nasceRecebida({ uiV2: true, isEditing: false, aindaVouReceber: true }), false);
});

test("editar nunca mexe no recebimento", () => {
  assert.equal(nasceRecebida({ uiV2: true, isEditing: true, aindaVouReceber: false }), false);
  assert.equal(nasceRecebida({ uiV2: true, isEditing: true, aindaVouReceber: true }), false);
});

test("patch de recebido e de estorno", () => {
  const agora = new Date("2026-09-28T15:00:00Z");
  assert.deepEqual(patchRecebimento(true, agora), {
    payment_confirmed: true,
    confirmed_at: "2026-09-28T15:00:00.000Z",
  });
  assert.deepEqual(patchRecebimento(false, agora), { payment_confirmed: false, confirmed_at: null });
});

console.log(`\n${passed} testes ok`);
