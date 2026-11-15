// Testes puros (node:assert, sem framework) — casamento do pedido modelo com o catálogo real.
// Rodar: node src/lib/pedidoModelo.test.mjs
import assert from "node:assert";
import { normalizarNomeProduto, quantidadesDoModelo } from "./pedidoModelo.js";

// ── normalizarNomeProduto: acento, espaço duplo, caixa, trim ──
assert.equal(normalizarNomeProduto("Rondelli 4 Queijos - 700g Rolo"), "rondelli 4 queijos - 700g rolo");
assert.equal(normalizarNomeProduto("Molho de Tomate  Sugo - 250g"), "molho de tomate sugo - 250g");
assert.equal(normalizarNomeProduto("Molho de Tomate Sugo - 250g"), "molho de tomate sugo - 250g");
assert.equal(normalizarNomeProduto("Conchiglione à Bolonhesa - 600g"), "conchiglione a bolonhesa - 600g");
assert.equal(normalizarNomeProduto("Conchiglione a Bolonhesa - 600g"), "conchiglione a bolonhesa - 600g");
assert.equal(normalizarNomeProduto("  Nhoque  de   Batata - 500g  "), "nhoque de batata - 500g");
assert.equal(normalizarNomeProduto(""), "");
assert.equal(normalizarNomeProduto(null), "");
assert.equal(normalizarNomeProduto(undefined), "");

// ── quantidadesDoModelo: casamento por nome normalizado (acento/espaço duplo casam) ──
const itensPadrao = [
  { id: "item-1", product_name: "Rondelli 4 Queijos - 700g Rolo" },
  { id: "item-2", product_name: "Molho de Tomate Sugo - 250g" },
  { id: "item-3", product_name: "Conchiglione à Bolonhesa - 600g" },
  { id: "item-4", product_name: "Nhoque de Batata - 500g" }, // fora do modelo
];

const modelo = [
  { product_name: "Rondelli 4 Queijos - 700g Rolo", quantidade: 20 },
  { product_name: "Molho de Tomate  Sugo - 250g", quantidade: 15 }, // espaço duplo no modelo
  { product_name: "Conchiglione a Bolonhesa - 600g", quantidade: 10 }, // sem acento no modelo
  { product_name: "Rondelli de Carne - 700g Rolo", quantidade: 8 }, // não existe no catálogo da unidade
  { product_name: "Molho de Tomate Sugo - 250g", quantidade: 0 }, // quantidade 0 não deve sobrescrever
];

const { quantidades, naoCasados } = quantidadesDoModelo(itensPadrao, modelo);

// Casaram por nome normalizado (acento/espaço duplo tolerados)
assert.deepEqual(quantidades, { "item-1": 20, "item-2": 15, "item-3": 10 });

// Item fora do modelo (Nhoque) fica fora — nunca ganha quantidade
assert.ok(!("item-4" in quantidades), "item fora do modelo não deve entrar em quantidades");

// Nome do modelo sem item correspondente vai para naoCasados
assert.deepEqual(naoCasados, ["Rondelli de Carne - 700g Rolo"]);

// Quantidade 0 não entra (e não sobrescreve um casamento anterior válido)
assert.equal(quantidades["item-2"], 15);

// ── Casos vazios/defensivos ──
assert.deepEqual(quantidadesDoModelo([], modelo).quantidades, {});
assert.deepEqual(quantidadesDoModelo(itensPadrao, []), { quantidades: {}, naoCasados: [] });
assert.deepEqual(quantidadesDoModelo(null, null), { quantidades: {}, naoCasados: [] });
assert.deepEqual(quantidadesDoModelo(itensPadrao, [{ product_name: "Rondelli 4 Queijos - 700g Rolo" }]).quantidades, {}); // sem quantidade

console.log("pedidoModelo: ok");
