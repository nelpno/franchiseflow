// node src/lib/freteFabrica.test.mjs
import assert from "node:assert/strict";
import { estimarFreteFabrica } from "./freteFabrica.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

// 5 pedidos REAIS de 20/09/2026 (purchase_orders: total_amount -> freight_cost lançado pela
// fábrica), consulta só de valores, sem unidade nem pessoa. Cobrem os 3 trechos da regra.
const REAIS = [
  { total: 2032.8, lancado: 250 }, // 10% = 203,28 -> piso 250
  { total: 1962.5, lancado: 250 }, // 196,25 -> piso 250
  { total: 2702.3, lancado: 270 }, // 270,23 -> 270 (fábrica lança em reais inteiros)
  { total: 3001.3, lancado: 300 }, // 300,13 -> 300
  { total: 9802.2, lancado: 350 }, // 980,22 -> teto 350
];

t("bate com o frete lançado em 5 pedidos reais", () => {
  for (const p of REAIS) assert.equal(estimarFreteFabrica(p.total), p.lancado, `total ${p.total}`);
});

t("piso de 250 abaixo de R$ 2.500", () => {
  assert.equal(estimarFreteFabrica(100), 250);
  assert.equal(estimarFreteFabrica(2499.99), 250);
});

t("teto de 350 acima de R$ 3.500", () => {
  assert.equal(estimarFreteFabrica(3500), 350);
  assert.equal(estimarFreteFabrica(50000), 350);
});

t("faixa do meio = 10% arredondado", () => {
  assert.equal(estimarFreteFabrica(2500), 250);
  assert.equal(estimarFreteFabrica(3104.9), 310);
  assert.equal(estimarFreteFabrica(3105), 311); // 310,5 arredonda para cima
});

t("sem produto não tem frete (nada de R$ 250 num pedido vazio)", () => {
  assert.equal(estimarFreteFabrica(0), 0);
  assert.equal(estimarFreteFabrica(-5), 0);
  assert.equal(estimarFreteFabrica(null), 0);
  assert.equal(estimarFreteFabrica(undefined), 0);
  assert.equal(estimarFreteFabrica("abc"), 0);
});

t("aceita número em texto (numeric do Postgres chega string)", () => {
  assert.equal(estimarFreteFabrica("2702.30"), 270);
});

console.log(`\nfreteFabrica: ${n} grupos ok`);
