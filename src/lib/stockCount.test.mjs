// Testes puros (node:assert, sem framework) do modo "Contar estoque" (S16.1).
// Rodar: node src/lib/stockCount.test.mjs
//
// Cobre os casos do roteiro e da revisao P3 (28/09/2026): base imutavel por item
// tocado, item nunca tocado nunca entra no diff, conflito de update condicional
// (robo/outra aba mudou a quantidade no meio), clique repetido, rede caindo no
// meio, quantidade negativa/vazia/decimal, e +/- em cima de valor quebrado.
import assert from "node:assert";
import {
  validateCount,
  applyStep,
  canStepCount,
  computeCountDiff,
  splitSaveResults,
  reconcileDraftWithItems,
} from "./stockCount.js";

const ITEMS = [
  { id: "a", product_name: "Rondelli 4 Queijos - 700g", quantity: 10, unit: "un" },
  { id: "b", product_name: "Molho de Tomate - 250g", quantity: 5, unit: "un" },
  { id: "c", product_name: "Nhoque - 500g", quantity: 0, unit: "un" },
];

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

  assert.strictEqual(validateCount("3abc").valid, false, "numero com lixo junto tem que ser invalido");
}

// ── applyStep: nunca fica negativo ──
{
  assert.strictEqual(applyStep(0, -1), 0, "− em zero continua zero, nao vira negativo");
  assert.strictEqual(applyStep(2, -1), 1);
  assert.strictEqual(applyStep(5, 1), 6);
  assert.strictEqual(applyStep(undefined, 1), 1, "item sem quantidade parte de 0");
}

// ── canStepCount: +/- so em cima de inteiro (estoque legado pode ter numeric quebrado) ──
{
  assert.strictEqual(canStepCount(2), true);
  assert.strictEqual(canStepCount(0), true);
  assert.strictEqual(canStepCount(2.5), false, "2.5 nao pode receber +/- silencioso");
  assert.strictEqual(canStepCount("2.5"), false);
  assert.strictEqual(canStepCount(NaN), false);
  assert.strictEqual(canStepCount(undefined), false);
  // Controle positivo: se canStepCount so checasse "e numero" (Number.isFinite sem
  // Number.isInteger), 2.5 passaria e o bug do roteiro (2.5 -> 3.5) voltaria.
  assert.strictEqual(Number.isFinite(2.5), true, "2.5 e finito — só Number.isInteger pega o caso");
}

// ── computeCountDiff: só itens TOCADOS (presentes em `base`) entram, e só se mudaram ──
{
  // Nenhum item tocado -> base vazia -> diff vazio, mesmo que os items tenham
  // quantidades diferentes entre si (nao ha "antes" pra ninguem).
  assert.deepStrictEqual(computeCountDiff({}, {}, ITEMS), []);

  // "b" foi tocado (esta em base) e mudou; "a" e "c" nunca foram tocados —
  // mesmo que o array `items` (recarregado) mostre outros valores pra eles,
  // isso NUNCA pode entrar no diff (e o bug que a P3 pegou).
  const itemsRecarregados = ITEMS.map((i) => (i.id === "a" ? { ...i, quantity: 999 } : i));
  const base = { b: 5 };
  const counts = { b: 8 };
  const diff = computeCountDiff(base, counts, itemsRecarregados);
  assert.strictEqual(diff.length, 1, "só o item tocado pode aparecer, mesmo com outros items divergindo");
  assert.strictEqual(diff[0].id, "b");
  assert.strictEqual(diff[0].before, 5, "before vem da BASE, nunca do items recarregado");
  assert.strictEqual(diff[0].after, 8);
  assert.strictEqual(diff[0].delta, 3);
  assert.strictEqual(diff[0].product_name, "Molho de Tomate - 250g");

  // Tocou mas nao mudou (apertou + e depois -, voltou pro mesmo numero) -> some do diff.
  const semMudanca = computeCountDiff({ a: 10 }, { a: 10 }, ITEMS);
  assert.strictEqual(semMudanca.length, 0);
}

// ── Cenario do roteiro: 10 -> contou 11 -> o robo baixou pra 8 no meio ──
{
  const base = { a: 10 };
  const counts = { a: 11 };
  const diffAntes = computeCountDiff(base, counts, ITEMS);
  assert.strictEqual(diffAntes.length, 1);
  assert.strictEqual(diffAntes[0].before, 10);
  assert.strictEqual(diffAntes[0].after, 11);

  // O update condicional (.eq('quantity', 10)) nao acha a linha (o robo já
  // gravou 8) — a entidade devolve conflict:true com o valor atual.
  const settled = [{ status: "fulfilled", value: { conflict: true, currentQuantity: 8 } }];
  const { saved, conflicted, failed, missing } = splitSaveResults(diffAntes, settled);
  assert.strictEqual(missing.length, 0);
  assert.strictEqual(saved.length, 0, "conflito NAO e salvo (senao sobrescreveria a baixa do robo)");
  assert.strictEqual(failed.length, 0);
  assert.strictEqual(conflicted.length, 1);
  assert.strictEqual(conflicted[0].id, "a");
  assert.strictEqual(conflicted[0].currentQuantity, 8);

  // A tela atualiza a BASE pro valor atual (8) mas preserva o rascunho (11)
  // pra franqueada conferir e salvar de novo.
  const novaBase = { a: 8 };
  const diffDepois = computeCountDiff(novaBase, counts, ITEMS);
  assert.strictEqual(diffDepois.length, 1, "continua pendente — o retry tem o que reenviar");
  assert.strictEqual(diffDepois[0].before, 8);
  assert.strictEqual(diffDepois[0].after, 11, "o numero que a franqueada digitou nao se perdeu");
}

// ── Rede caindo no meio: separa quem salvou de quem falhou de quem teve conflito ──
{
  const diffItems = [
    { id: "a", product_name: "A", before: 1, after: 2 },
    { id: "b", product_name: "B", before: 3, after: 4 },
    { id: "c", product_name: "C", before: 5, after: 6 },
  ];
  const settled = [
    { status: "fulfilled", value: { conflict: false, quantity: 2 } },
    { status: "rejected", reason: new Error("rede caiu") },
    { status: "fulfilled", value: { conflict: true, currentQuantity: 9 } },
  ];
  const { saved, conflicted, failed, missing } = splitSaveResults(diffItems, settled);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].id, "a");
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].id, "b");
  assert.ok(failed[0].error, "o item que falhou carrega o motivo, para o retry");
  assert.strictEqual(conflicted.length, 1);
  assert.strictEqual(conflicted[0].id, "c");
  assert.strictEqual(conflicted[0].currentQuantity, 9);
  assert.strictEqual(missing.length, 0);
}

// ── Produto excluído enquanto a contagem ficou pendente: NÃO é conflito, sai da
//    fila sozinho — nunca fica preso esperando um "valor atual" que não existe.
{
  const diffItems = [
    { id: "a", product_name: "Rondelli", before: 10, after: 11 },
    { id: "b", product_name: "Molho", before: 5, after: 8 },
  ];
  const settled = [
    { status: "fulfilled", value: { missing: true } }, // "a" foi excluído no meio
    { status: "fulfilled", value: { conflict: false, quantity: 8 } },
  ];
  const { saved, conflicted, missing, failed } = splitSaveResults(diffItems, settled);
  assert.strictEqual(missing.length, 1);
  assert.strictEqual(missing[0].id, "a");
  assert.strictEqual(conflicted.length, 0, "excluído NUNCA vira conflito (não tem valor atual pra comparar)");
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].id, "b");
  assert.strictEqual(failed.length, 0);
  // Controle positivo: se o código antigo (que tratava "não achei a linha" sempre
  // como conflito) ainda estivesse ativo, "a" apareceria em `conflicted` com
  // `currentQuantity: null` — e ficaria preso pra sempre (null nunca bate com
  // nenhuma base futura). O teste acima falharia nesse cenário.
}

// ── reconcileDraftWithItems: retomar rascunho remove quem foi excluído no meio ──
{
  const draftBase = { a: 10, b: 5, c: 0 };
  const draftCounts = { a: 11, b: 8, c: 2 };
  const draftNames = { a: "Rondelli 4 Queijos - 700g", b: "Molho de Tomate - 250g", c: "Nhoque - 500g" };
  // "b" foi excluído entre a contagem e a retomada (não está mais em `items`).
  const itemsAtuais = ITEMS.filter((i) => i.id !== "b");

  const { base, counts, names, removedNames } = reconcileDraftWithItems(
    draftBase,
    draftCounts,
    draftNames,
    itemsAtuais
  );
  assert.deepStrictEqual(base, { a: 10, c: 0 }, "só quem ainda existe fica na base");
  assert.deepStrictEqual(counts, { a: 11, c: 2 });
  assert.deepStrictEqual(names, { a: "Rondelli 4 Queijos - 700g", c: "Nhoque - 500g" });
  assert.deepStrictEqual(removedNames, ["Molho de Tomate - 250g"], "nome do excluído pro aviso");

  // Nada foi excluído -> reconcilia igual, sem remover ninguém.
  const semExclusao = reconcileDraftWithItems(draftBase, draftCounts, draftNames, ITEMS);
  assert.deepStrictEqual(semExclusao.base, draftBase);
  assert.strictEqual(semExclusao.removedNames.length, 0);

  // Rascunho sem nome salvo (drafts antigos, antes do campo `names` existir) ainda
  // funciona — cai no fallback "Um produto" em vez de quebrar.
  const semNomes = reconcileDraftWithItems({ b: 5 }, { b: 8 }, undefined, itemsAtuais);
  assert.deepStrictEqual(semNomes.removedNames, ["Um produto"]);
}

// ── Clique repetido no Salvar: depois de salvar, o item sai da BASE (nao só
//    fica com before===after) — um segundo clique nao tem mais o id no diff.
{
  const baseDepoisDeSalvar = {}; // "b" removido da base pelo componente ao salvar
  const countsDepoisDeSalvar = {};
  const diff = computeCountDiff(baseDepoisDeSalvar, countsDepoisDeSalvar, ITEMS);
  assert.strictEqual(diff.length, 0, "clique repetido nao reenvia nada — nem o id sobra");
}

console.log("stockCount.test.mjs: OK");
