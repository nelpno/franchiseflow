// Testes puros (node:assert, sem framework) do modo "Contar estoque" (S16.1).
// Rodar: node src/lib/stockCount.test.mjs
//
// Cobre os casos do roteiro: clique repetido no Salvar (nao duplica), rede caindo
// no meio (o que salvou e o que nao salvou fica claro), quantidade negativa/vazia/
// decimal, e o "so os itens alterados" do resumo antes de salvar.
import assert from "node:assert";
import {
  initCounts,
  validateCount,
  applyStep,
  computeCountDiff,
  splitSaveResults,
} from "./stockCount.js";

const ITEMS = [
  { id: "a", product_name: "Rondelli 4 Queijos - 700g", quantity: 10, unit: "un" },
  { id: "b", product_name: "Molho de Tomate - 250g", quantity: 5, unit: "un" },
  { id: "c", product_name: "Nhoque - 500g", quantity: 0, unit: "un" },
];

// ── initCounts: parte da quantidade atual, item sem numero vira 0 ──
{
  const counts = initCounts(ITEMS);
  assert.deepStrictEqual(counts, { a: 10, b: 5, c: 0 });

  const comLixo = initCounts([{ id: "x", quantity: null }, { id: "y", quantity: "abc" }]);
  assert.deepStrictEqual(comLixo, { x: 0, y: 0 });
}

// ── validateCount: os 4 casos do roteiro ──
{
  assert.strictEqual(validateCount("").valid, false, "vazio tem que ser invalido");
  assert.strictEqual(validateCount("   ").valid, false, "só espaco tem que ser invalido");
  assert.strictEqual(validateCount("-3").valid, false, "negativo tem que ser invalido");
  assert.strictEqual(validateCount("3,5").valid, false, "decimal com virgula tem que ser invalido");
  assert.strictEqual(validateCount("3.5").valid, false, "decimal com ponto tem que ser invalido");
  assert.strictEqual(validateCount("abc").valid, false, "texto tem que ser invalido");

  const ok = validateCount("12");
  assert.strictEqual(ok.valid, true);
  assert.strictEqual(ok.value, 12);

  const zero = validateCount("0");
  assert.strictEqual(zero.valid, true, "zero e uma contagem legitima (zerou o produto)");
  assert.strictEqual(zero.value, 0);

  // Controle positivo: se a funcao so checasse isNaN (sem regex de inteiro),
  // "3,5" teria virado NaN pelo parseInt e o teste acima pegaria — mas "3" +
  // lixo (ex.: "3abc") tambem tem que cair fora, o que só o regex garante.
  assert.strictEqual(validateCount("3abc").valid, false, "numero com lixo junto tem que ser invalido");
}

// ── applyStep: nunca fica negativo ──
{
  assert.strictEqual(applyStep(0, -1), 0, "− em zero continua zero, nao vira negativo");
  assert.strictEqual(applyStep(2, -1), 1);
  assert.strictEqual(applyStep(5, 1), 6);
  assert.strictEqual(applyStep(undefined, 1), 1, "item sem quantidade parte de 0");
}

// ── computeCountDiff: só os itens que MUDARAM entram no resumo ──
{
  const counts = { a: 10, b: 8, c: 0 }; // só o "b" mudou (5 -> 8)
  const diff = computeCountDiff(ITEMS, counts);
  assert.strictEqual(diff.length, 1, "so 1 item mudou — o Salvar nao pode mandar os outros 2");
  assert.strictEqual(diff[0].id, "b");
  assert.strictEqual(diff[0].before, 5);
  assert.strictEqual(diff[0].after, 8);
  assert.strictEqual(diff[0].delta, 3);

  const semMudanca = computeCountDiff(ITEMS, initCounts(ITEMS));
  assert.strictEqual(semMudanca.length, 0, "contagem igual a atual = nada para salvar");
}

// ── splitSaveResults: rede caindo no meio — separa quem salvou de quem falhou ──
{
  const diffItems = [
    { id: "a", product_name: "A", before: 1, after: 2 },
    { id: "b", product_name: "B", before: 3, after: 4 },
    { id: "c", product_name: "C", before: 5, after: 6 },
  ];
  const settled = [
    { status: "fulfilled", value: {} },
    { status: "rejected", reason: new Error("rede caiu") },
    { status: "fulfilled", value: {} },
  ];
  const { saved, failed } = splitSaveResults(diffItems, settled);
  assert.strictEqual(saved.length, 2);
  assert.deepStrictEqual(saved.map((s) => s.id), ["a", "c"]);
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].id, "b");
  assert.ok(failed[0].error, "o item que falhou carrega o motivo, para o retry");
}

// ── Clique repetido no Salvar: depois de salvar, a contagem local reflete o
//    banco, entao computeCountDiff([...], counts) do segundo clique dá 0
//    diferencas — nada é reenviado (a idempotencia vem de fora, mas a peça
//    pura que garante isso é o diff ficar vazio quando before === after).
{
  const itemsAtualizados = ITEMS.map((i) => (i.id === "b" ? { ...i, quantity: 8 } : i));
  const counts = { a: 10, b: 8, c: 0 };
  const diffDepoisDeSalvar = computeCountDiff(itemsAtualizados, counts);
  assert.strictEqual(diffDepoisDeSalvar.length, 0, "clique repetido nao reenvia nada");
}

console.log("stockCount.test.mjs: OK");
