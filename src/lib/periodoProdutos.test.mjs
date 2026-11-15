// node src/lib/periodoProdutos.test.mjs
import assert from "node:assert/strict";
import { limitesDoMes, validarPeriodo, rotuloPeriodo } from "./periodoProdutos.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; };

t("limites do mês: 30, 31 e fevereiro bissexto", () => {
  assert.deepEqual(limitesDoMes("2026-09"), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(limitesDoMes("2026-12"), { de: "2026-12-01", ate: "2026-12-31" });
  assert.deepEqual(limitesDoMes("2028-02"), { de: "2028-02-01", ate: "2028-02-29" });
  assert.deepEqual(limitesDoMes("setembro"), { de: "", ate: "" });
});

t("período válido passa; um dia só também", () => {
  assert.equal(validarPeriodo("2026-09-01", "2026-09-15"), null);
  assert.equal(validarPeriodo("2026-09-15", "2026-09-15"), null);
  assert.equal(validarPeriodo("2025-10-01", "2026-09-30"), null);
});

t("período errado tem mensagem", () => {
  assert.match(validarPeriodo("", "2026-09-15"), /duas datas/);
  assert.match(validarPeriodo("2026-09-16", "2026-09-15"), /antes da final/);
  assert.match(validarPeriodo("2025-01-01", "2026-09-15"), /até 1 ano/);
  assert.match(validarPeriodo("15/09/2026", "2026-09-15"), /duas datas/);
});

t("rótulo do período", () => {
  assert.equal(rotuloPeriodo("2026-09-01", "2026-09-15"), "01/09/2026 a 15/09/2026");
  assert.equal(rotuloPeriodo("2026-09-15", "2026-09-15"), "15/09/2026");
  assert.equal(rotuloPeriodo("", ""), "");
});

console.log(`periodoProdutos: ${n} testes ok`);
