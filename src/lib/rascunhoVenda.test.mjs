// node src/lib/rascunhoVenda.test.mjs — rascunho e edição da venda (S12.4)
import assert from "node:assert/strict";
import { dataDoRascunho, assinaturaEdicao } from "./rascunhoVenda.js";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

test("rascunho de ontem NÃO restaura a data velha", () => {
  assert.deepEqual(dataDoRascunho({ saleDate: "2026-09-27", salvoEm: "2026-09-27" }, "2026-09-28"), { data: "2026-09-28", trocou: true });
});
test("rascunho de hoje mantém a data (inclusive escolhida à mão)", () => {
  assert.deepEqual(dataDoRascunho({ saleDate: "2026-09-25", salvoEm: "2026-09-28" }, "2026-09-28"), { data: "2026-09-25", trocou: false });
});
test("rascunho antigo sem salvoEm: hoje", () => {
  assert.equal(dataDoRascunho({ saleDate: "2026-09-20" }, "2026-09-28").data, "2026-09-28");
  assert.deepEqual(dataDoRascunho({}, "2026-09-28"), { data: "2026-09-28", trocou: false });
});

const f = { items: [{ inventory_item_id: "i1", quantity: 2, unit_price: 54 }, { inventory_item_id: "", quantity: 1, unit_price: 0 }],
  contactId: "c1", paymentMethod: "pix", deliveryMethod: "delivery", deliveryFee: 10, customerAddress: "Rua A ",
  discountType: "fixed", discountInput: 0, saleDate: "2026-09-28", observacoes: "", cardFeePercent: 0 };

test("assinatura: igual quando nada mudou (linha vazia, espaço e taxa ignorados)", () => {
  assert.equal(assinaturaEdicao(f), assinaturaEdicao({ ...f, customerAddress: "Rua A", cardFeePercent: 3.5, items: f.items.slice(0, 1) }));
  assert.equal(assinaturaEdicao(f), assinaturaEdicao({ ...f, deliveryFee: "10", items: [{ ...f.items[0], unit_price: "54.00" }] }));
});
test("assinatura: muda com quantidade, preço, data, pagamento, observação", () => {
  const a = assinaturaEdicao(f);
  assert.notEqual(a, assinaturaEdicao({ ...f, items: [{ ...f.items[0], quantity: 3 }] }));
  assert.notEqual(a, assinaturaEdicao({ ...f, items: [{ ...f.items[0], unit_price: 50 }] }));
  assert.notEqual(a, assinaturaEdicao({ ...f, saleDate: "2026-09-27" }));
  assert.notEqual(a, assinaturaEdicao({ ...f, paymentMethod: "cash" }));
  assert.notEqual(a, assinaturaEdicao({ ...f, observacoes: "portaria" }));
});

console.log(`\n${passed} testes ok`);
