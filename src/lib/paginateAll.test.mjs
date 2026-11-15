// Tests para paginateAll.js — a paginação do entity layer
// Roda direto: node src/lib/paginateAll.test.mjs
// Sem framework — usa node:assert
//
// O que estes testes travam: NENHUMA linha pode ser duplicada nem omitida em nenhum
// tamanho de resultado. Foi exatamente isso que quebrou em 20/05/2026 (63 vendas em duas
// páginas e outras 63 em nenhuma, R$ 2.785 sumindo do Financeiro de Vila Maria).

import assert from "node:assert/strict";
import { paginateAll } from "./paginateAll.js";

let pass = 0;
let fail = 0;
function test(name, fn) {
  return fn()
    .then(() => { console.log(`  ✅ ${name}`); pass++; })
    .catch((e) => { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; });
}

/** Fonte falsa com N linhas; conta quantas requisições foram feitas. */
function fonte(total, pageSize) {
  const chamadas = [];
  const buscar = async (from, to) => {
    chamadas.push([from, to]);
    const linhas = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) linhas.push({ id: i });
    return linhas;
  };
  return { buscar, chamadas, pageSize };
}

const rodar = async (total, pageSize = 1000, concurrency = 6) => {
  const f = fonte(total, pageSize);
  const linhas = await paginateAll(f.buscar, { pageSize, concurrency });
  return { linhas, requisicoes: f.chamadas.length };
};

await test("resultado menor que uma página: 1 requisição", async () => {
  const r = await rodar(37, 100);
  assert.equal(r.linhas.length, 37);
  assert.equal(r.requisicoes, 1);
});

await test("resultado vazio: 1 requisição, lista vazia", async () => {
  const r = await rodar(0, 100);
  assert.deepEqual(r.linhas, []);
  assert.equal(r.requisicoes, 1);
});

await test("1.079 linhas em páginas de 1.000: DUAS requisições (era 7)", async () => {
  const r = await rodar(1079, 1000);
  assert.equal(r.linhas.length, 1079);
  assert.equal(r.requisicoes, 2, `foram ${r.requisicoes}`);
});

await test("exatamente 1 página cheia: precisa da 2ª para saber que acabou", async () => {
  const r = await rodar(1000, 1000);
  assert.equal(r.linhas.length, 1000);
  assert.equal(r.requisicoes, 2);
});

await test("o lote cresce: 1 -> 2 -> 4 -> 6", async () => {
  // 10.000 linhas, páginas de 1.000 => páginas 0..9
  // 1 (pág 0) + 1 (pág 1) + 2 (2,3) + 4 (4..7) + 6 (8..13, as últimas vêm vazias)
  const r = await rodar(10000, 1000);
  assert.equal(r.linhas.length, 10000);
  assert.equal(r.requisicoes, 14, `foram ${r.requisicoes}`);
});

await test("nunca duplica nem omite — varredura de 0 a 350 linhas", async () => {
  for (let n = 0; n <= 350; n++) {
    const r = await rodar(n, 50, 6);
    const ids = r.linhas.map((l) => l.id);
    assert.equal(ids.length, n, `n=${n}: veio ${ids.length}`);
    assert.equal(new Set(ids).size, n, `n=${n}: tem id repetido`);
    for (let i = 0; i < n; i++) assert.equal(ids[i], i, `n=${n}: ordem/omissao no indice ${i}`);
  }
});

await test("caso real: 2.459 itens de venda em páginas de 1.000", async () => {
  const r = await rodar(2459, 1000);
  assert.equal(r.linhas.length, 2459);
  assert.equal(r.requisicoes, 4, `foram ${r.requisicoes}`);
});

await test("tela grande do admin (209 mil linhas) continua paralelizando", async () => {
  const r = await rodar(209248, 1000);
  assert.equal(r.linhas.length, 209248);
  // 210 páginas: 1 + 1 + 2 + 4 + 6*34 + resto — o que importa é ficar perto de 210,
  // ou seja, quase nenhuma requisição desperdiçada
  assert.ok(r.requisicoes <= 216, `foram ${r.requisicoes}, esperado <= 216`);
  assert.ok(r.requisicoes >= 210, `foram ${r.requisicoes}, esperado >= 210`);
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
