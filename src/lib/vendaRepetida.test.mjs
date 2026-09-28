// node src/lib/vendaRepetida.test.mjs — aviso "o robô já lançou esta venda" (S12.3)
import assert from "node:assert/strict";
import { acharVendaDoRobo, janelaDeBusca, diasEntre, valoresParecidos } from "./vendaRepetida.js";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

const bot = (o) => ({ id: "b1", source: "bot", contact_id: "c1", contact_phone: "11987654321",
  sale_date: "2026-09-27", value: 100, discount_amount: 0, delivery_fee: 0, ...o });

test("mesmo cliente, mesmo dia, mesmo valor: avisa", () => {
  const v = bot();
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-27", value: 100, net: 100 }, [v]), v);
});

test("casa pelo telefone quando o contato é outro (com e sem 55 / máscara)", () => {
  const v = bot({ contact_id: "outro", contact_phone: "5511987654321" });
  assert.equal(acharVendaDoRobo({ contactId: "c9", telefone: "(11) 98765-4321", saleDate: "2026-09-27", value: 100 }, [v]), v);
});

test("venda manual existente não conta (só a do robô)", () => {
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-27", value: 100 }, [bot({ source: "manual" })]), null);
});

test("recompra no mesmo dia com valor bem diferente: NÃO avisa (falso positivo evitado)", () => {
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-27", value: 42.9 }, [bot({ value: 120.8 })]), null);
});

test("valor parecido (frete dentro × fora) avisa", () => {
  // robô: 90 + 10 de frete; manual: 100 de valor bruto sem frete
  const v = bot({ value: 90, delivery_fee: 10 });
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-27", value: 100, net: 100 }, [v]), v);
});

test("tolerância: até R$ 5 ou 15%", () => {
  assert.equal(valoresParecidos({ value: 104.9 }, bot({ value: 100 })), true);
  assert.equal(valoresParecidos({ value: 114 }, bot({ value: 100 })), true);
  assert.equal(valoresParecidos({ value: 116 }, bot({ value: 100 })), false);
  assert.equal(valoresParecidos({ value: 24 }, bot({ value: 20 })), true); // piso R$ 5
});

test("data: até 1 dia de distância; 2 dias não", () => {
  assert.ok(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-28", value: 100 }, [bot()]));
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-29", value: 100 }, [bot()]), null);
  assert.equal(diasEntre("2026-10-01", "2026-09-30"), 1);
  assert.deepEqual(janelaDeBusca("2026-10-01"), { de: "2026-09-30", ate: "2026-10-02" });
});

test("sem cliente nem telefone: não dá para dizer, não avisa", () => {
  assert.equal(acharVendaDoRobo({ contactId: null, telefone: "", saleDate: "2026-09-27", value: 100 }, [bot()]), null);
  assert.equal(acharVendaDoRobo({ contactId: null, telefone: "1234", saleDate: "2026-09-27", value: 100 }, [bot({ contact_phone: "1234" })]), null);
});

test("escolhe a mais parecida", () => {
  const a = bot({ id: "a", value: 108 });
  const b = bot({ id: "b", value: 101 });
  assert.equal(acharVendaDoRobo({ contactId: "c1", saleDate: "2026-09-27", value: 100 }, [a, b]).id, "b");
});

console.log(`\n${passed} testes ok`);
