// node src/lib/reposicao.test.mjs
import assert from "node:assert/strict";
import {
  quantidadesEmAberto,
  reposicaoDoItem,
  itensParaRepor,
  quantidadesParaRepor,
  unidadeDeMedida,
  ehProdutoDaFabrica,
} from "./reposicao.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

const item = (over) => ({
  id: "a", product_name: "Nhoque de Batata - 500g", quantity: 0, min_stock: 0,
  cost_price: 12, created_by_franchisee: false, active: true, unit: "un", ...over,
});

t("pedidos abertos somam por produto; entregue/cancelado não contam", () => {
  const pedidos = [
    { id: "p1", status: "pendente" },
    { id: "p2", status: "confirmado" },
    { id: "p3", status: "em_rota" },
    { id: "p4", status: "entregue" },
    { id: "p5", status: "cancelado" },
  ];
  const itens = {
    p1: [{ inventory_item_id: "a", quantity: 4 }, { inventory_item_id: "b", quantity: "2" }],
    p2: [{ inventory_item_id: "a", quantity: 1 }],
    p3: [{ inventory_item_id: "a", quantity: 2 }, { inventory_item_id: null, quantity: 9 }],
    p4: [{ inventory_item_id: "a", quantity: 50 }],
    p5: [{ inventory_item_id: "a", quantity: 50 }],
  };
  assert.deepEqual(quantidadesEmAberto(pedidos, itens), { a: 7, b: 2 });
  assert.deepEqual(quantidadesEmAberto(null, null), {});
});

t("o que está a caminho desconta da reposição", () => {
  // mínimo 10, estoque 2 -> sem pedido aberto pede 8
  assert.equal(reposicaoDoItem(item({ quantity: 2, min_stock: 10 }), {}, {}).repor, 8);
  // com 5 a caminho pede só 3
  assert.equal(reposicaoDoItem(item({ quantity: 2, min_stock: 10 }), {}, { a: 5 }).repor, 3);
  // a caminho cobre tudo -> 0, mas continua no alerta (estoque na geladeira ainda é 2)
  const r = reposicaoDoItem(item({ quantity: 2, min_stock: 10 }), {}, { a: 20 });
  assert.equal(r.repor, 0);
  assert.equal(r.aCaminho, 20);
  assert.equal(r.abaixoDoMinimo, true);
});

t("giro de 2 semanas com mínimo como piso (mesma regra do suggestionFor)", () => {
  // giro 5/sem -> 10 para 2 semanas, estoque 3 -> 7 (mínimo 4 não pesa)
  assert.equal(reposicaoDoItem(item({ quantity: 3, min_stock: 4 }), { a: 5 }, {}).repor, 7);
  // giro baixo, mínimo alto -> mínimo manda
  assert.equal(reposicaoDoItem(item({ quantity: 0, min_stock: 12 }), { a: 1 }, {}).repor, 12);
});

t("unidade de medida: pedido é em unidades inteiras (arredonda para cima)", () => {
  // giro 2,6/sem -> ceil(5,2)=6, estoque legado 0,5 -> 5,5 -> pede 6
  assert.equal(reposicaoDoItem(item({ quantity: 0.5 }), { a: 2.6 }, {}).repor, 6);
  assert.equal(unidadeDeMedida(item({ unit: "un" })), "un");
  assert.equal(unidadeDeMedida(item({ unit: " kg " })), "kg");
  assert.equal(unidadeDeMedida(item({ unit: null })), "un");
  assert.equal(unidadeDeMedida({}), "un");
});

t("zerado entra SEMPRE no alerta, mesmo sem mínimo e sem giro", () => {
  const linhas = itensParaRepor([item({ id: "z", quantity: 0, min_stock: 0 })], {}, {});
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].zerado, true);
  assert.equal(linhas[0].semBase, true);
  assert.equal(linhas[0].repor, 0);
  // estoque negativo (venda antes de dar entrada) também é zerado
  assert.equal(itensParaRepor([item({ id: "n", quantity: -2 })], {}, {}).length, 1);
});

t("só catálogo padrão, visível e com custo", () => {
  const lista = [
    item({ id: "extra", created_by_franchisee: true }),
    item({ id: "oculto", active: false }),
    item({ id: "semcusto", cost_price: 0 }),
    item({ id: "legado", created_by_franchisee: null }), // nulo = padrão (regra !== true)
  ];
  assert.deepEqual(itensParaRepor(lista, {}, {}).map((l) => l.item.id), ["legado"]);
  assert.equal(ehProdutoDaFabrica(item({ cost_price: "6.20" })), true);
  assert.equal(ehProdutoDaFabrica(null), false);
});

t("acima do mínimo e com estoque não entra; ordem = zerados, depois menor estoque", () => {
  const lista = [
    item({ id: "ok", quantity: 20, min_stock: 5 }),
    item({ id: "baixo3", product_name: "B", quantity: 3, min_stock: 5 }),
    item({ id: "baixo1", product_name: "C", quantity: 1, min_stock: 5 }),
    item({ id: "zero", product_name: "D", quantity: 0, min_stock: 5 }),
  ];
  assert.deepEqual(itensParaRepor(lista, {}, {}).map((l) => l.item.id), ["zero", "baixo1", "baixo3"]);
});

t("quantidadesParaRepor só leva o que tem algo a pedir", () => {
  const linhas = itensParaRepor(
    [
      item({ id: "x", quantity: 0, min_stock: 6 }),
      item({ id: "y", quantity: 0, min_stock: 0 }), // sem base -> fica de fora
      item({ id: "w", quantity: 1, min_stock: 4 }),
    ],
    {},
    { w: 10 } // já a caminho
  );
  assert.deepEqual(quantidadesParaRepor(linhas), { x: 6 });
  assert.deepEqual(quantidadesParaRepor(null), {});
});

console.log(`\nreposicao: ${n} grupos ok`);
