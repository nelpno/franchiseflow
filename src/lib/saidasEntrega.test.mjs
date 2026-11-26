// node src/lib/saidasEntrega.test.mjs
import assert from "node:assert/strict";
import { parseSaidas, formatSaidas } from "./saidasEntrega.js";

const casos = [
  ["11:00, 15:00, 18:00", ["11:00", "15:00", "18:00"], []],
  ["18h 11h 15h", ["11:00", "15:00", "18:00"], []],
  ["11h, 15h e 18h", ["11:00", "15:00", "18:00"], []],
  ["10h30; 15.30 / 9", ["09:00", "10:30", "15:30"], []],
  ["11, 11:00", ["11:00"], []],
  ["", [], []],
  ["11h, meio-dia, 25:00", ["11:00"], ["meio-dia", "25:00"]],
];
for (const [t, s, inv] of casos) {
  const r = parseSaidas(t);
  assert.deepEqual(r.saidas, s, `saidas de "${t}"`);
  assert.deepEqual(r.invalidos, inv, `invalidos de "${t}"`);
}
assert.equal(formatSaidas(["11:00", "15:30", "18:00"]), "11h, 15h30 e 18h");
assert.equal(formatSaidas(["11:00"]), "11h");
assert.equal(formatSaidas([]), "");
console.log("saidasEntrega: ok");
