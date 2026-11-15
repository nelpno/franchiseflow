// node src/lib/freteFabrica.test.mjs
import assert from "node:assert/strict";
import { estimarFreteFabrica } from "./freteFabrica.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

// Desde 22/10/2026: R$ 350 por pedido, igual à COF V3 / Contrato V4, qualquer que seja o total.
t("R$ 350 por pedido em qualquer total", () => {
  assert.equal(estimarFreteFabrica(100), 350);
  assert.equal(estimarFreteFabrica(2032.8), 350);
  assert.equal(estimarFreteFabrica(2702.3), 350);
  assert.equal(estimarFreteFabrica(50000), 350);
});

t("sem produto não tem frete (nada de R$ 350 num pedido vazio)", () => {
  assert.equal(estimarFreteFabrica(0), 0);
  assert.equal(estimarFreteFabrica(-5), 0);
  assert.equal(estimarFreteFabrica(null), 0);
  assert.equal(estimarFreteFabrica(undefined), 0);
  assert.equal(estimarFreteFabrica("abc"), 0);
});

t("aceita número em texto (numeric do Postgres chega string)", () => {
  assert.equal(estimarFreteFabrica("2702.30"), 350);
});

console.log(`\nfreteFabrica: ${n} grupos ok`);
