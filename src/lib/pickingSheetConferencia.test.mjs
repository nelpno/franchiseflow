// node src/lib/pickingSheetConferencia.test.mjs
// S14.4 — pedido à fábrica impresso pela unidade (modo conferência do pickingSheetPdf).
// Gera o PDF de verdade (jsPDF em Node) e confere pelo TEXTO do arquivo: a versão
// "só quantidades" não pode ter nenhum "R$"; a "com valores" tem preço e total.
// O pickingSheetPdf.js importa sem extensão (padrão Vite), então o teste empacota com o
// esbuild do próprio Vite antes de importar (createRequire no banner: o jsPDF de Node usa require).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const alvo = process.env.PICKING_SHEET_SRC || path.join(aqui, "pickingSheetPdf.js");
const saida = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "s14-conf-")), "picking.mjs");

await build({
  entryPoints: [alvo],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: saida,
  logLevel: "silent",
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
const mod = await import(pathToFileURL(saida).href);
assert.equal(typeof mod.buildConferenceSheet, "function", "buildConferenceSheet não existe");

// Texto de um PDF do jsPDF (sem compressão): junta as strings dos operadores Tj.
function textoDoPdf(doc) {
  const raw = doc.output();
  const partes = [];
  for (const mm of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    partes.push(mm[1].replace(/\\([()\\])/g, "$1"));
  }
  return partes.join("\n");
}

const order = {
  id: "5a7c0f3e-0000-4000-8000-000000000000",
  ordered_at: "2026-09-22T13:00:00.000Z",
  estimated_delivery: "2026-09-25",
  freight_cost: 250,
  notes: "Entregar pela manha",
};
const items = [
  { id: "1", product_name: "Nhoque de Batata - 500g", quantity: 10, unit_price: 21 },
  { id: "2", product_name: "Rondelli 4 Queijos - 700g Rolo", quantity: 4, unit_price: 25 },
  { id: "3", product_name: "Molho de Tomate Mariolla - 250g", quantity: 6, unit_price: 6.2 },
  { id: "4", product_name: "Canelone de Frango - 700g", quantity: 0, unit_price: 20 }, // qtd 0 não sai
];
const now = new Date("2026-09-25T15:30:00.000Z");

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };

const soQtd = textoDoPdf(await mod.buildConferenceSheet({ order, items, franchiseName: "Maxi Massas Exemplo", comValores: false, weightMap: {}, now }));
const comVal = textoDoPdf(await mod.buildConferenceSheet({ order, items, franchiseName: "Maxi Massas Exemplo", comValores: true, weightMap: {}, now }));

await t("só quantidades: nenhum R$ no PDF", async () => {
  assert.ok(soQtd.length > 100, "PDF sem texto extraído");
  assert.ok(!soQtd.includes("R$"), "achou R$ na versão sem valores:\n" + soQtd);
  assert.ok(!soQtd.includes("UNIT"));
});

await t("só quantidades: cabeçalho, produtos, quantidades e coluna RECEBIDO", async () => {
  for (const s of ["PEDIDO A FABRICA - CONFERENCIA", "PED-5A7C0F3E", "Maxi Massas Exemplo", "RECEBIDO", "PEDIDO",
    "Nhoque de Batata - 500g", "Rondelli 4 Queijos - 700g Rolo", "Molho de Tomate Mariolla - 250g",
    "3 produtos", "20 un", "Conferido por:", "Sem valores", "25/09/2026 12:30"]) {
    assert.ok(soQtd.includes(s), `faltou "${s}"`);
  }
  assert.ok(!soQtd.includes("Canelone"), "item com quantidade 0 não pode sair");
});

await t("com valores: preço, total da linha, produtos e frete lançado", async () => {
  for (const s of ["UNIT", "TOTAL", "R$ 21,00", "R$ 210,00", "R$ 100,00", "R$ 37,20", "Produtos: R$ 347,20",
    "Frete: R$ 250,00", "Total: R$ 597,20", "Com valores"]) {
    assert.ok(comVal.includes(s), `faltou "${s}"`);
  }
});

await t("com valores sem frete lançado: não inventa frete", async () => {
  const semFrete = textoDoPdf(await mod.buildConferenceSheet({ order: { ...order, freight_cost: null }, items, comValores: true, weightMap: {}, now }));
  assert.ok(semFrete.includes("Frete: a confirmar pela fabrica"));
  assert.ok(!semFrete.includes("Total: R$"));
  assert.ok(semFrete.includes("Maxi Massas"), "sem nome da unidade cai em Maxi Massas");
});

console.log(`\npickingSheetConferencia: ${n} grupos ok`);
