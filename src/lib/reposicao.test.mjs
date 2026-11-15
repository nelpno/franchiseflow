// node src/lib/reposicao.test.mjs
import assert from "node:assert/strict";
import { comPrecoDaTabela,
  quantidadesEmAberto,
  reposicaoDoItem,
  itensParaRepor,
  quantidadesParaRepor,
  unidadeDeMedida,
  ehProdutoDaFabrica,
  carregarPedidosAbertos,
  ultimoPedidoParaRepetir,
  sobeParaSugeridos,
} from "./reposicao.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

t("Novo pedido: item digitado agora não pula para cima; sugestão e quantidade que já veio sobem", () => {
  assert.equal(sobeParaSugeridos({ quantidade: 4, sugestao: null, digitadoAgora: true }), false);
  assert.equal(sobeParaSugeridos({ quantidade: 4, sugestao: null, digitadoAgora: false }), true);
  assert.equal(sobeParaSugeridos({ quantidade: 0, sugestao: 6, digitadoAgora: true }), true);
  assert.equal(sobeParaSugeridos({ quantidade: "", sugestao: 0, digitadoAgora: false }), false);
});

t("Repetir último pedido pula o cancelado", () => {
  const a = { id: "a", status: "cancelado" }, b = { id: "b", status: "entregue" }, c = { id: "c", status: "pendente" };
  assert.equal(ultimoPedidoParaRepetir([a, b, c]), b);   // o mais recente foi cancelado → o anterior
  assert.equal(ultimoPedidoParaRepetir([c, b]), c);      // pendente conta
  assert.equal(ultimoPedidoParaRepetir([a]), null);      // só cancelado → nada para repetir
  assert.equal(ultimoPedidoParaRepetir([]), null);
  assert.equal(ultimoPedidoParaRepetir(null), null);
});

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

await (async () => {
  // P3 ponto 4: só pedidos abertos, todos os itens, e erro não vira "nada a caminho"
  const chamadas = [];
  const PurchaseOrder = { filter: async (crit, _o, _l, opts) => { chamadas.push(["po", crit, opts]);
    return [{ id: "p1", status: "pendente" }, { id: "p2", status: "em_rota" }, { id: "p3", status: "entregue" }]; } };
  const PurchaseOrderItem = { filter: async (crit, _o, _l, opts) => { chamadas.push(["poi", crit, opts]);
    return crit.order_id.flatMap((id) => [{ order_id: id, inventory_item_id: "a", quantity: 2 }]); } };
  const r = await carregarPedidosAbertos({ PurchaseOrder, PurchaseOrderItem, franchiseId: "f", lote: 1 });
  assert.deepEqual(chamadas[0][1], { franchise_id: "f", status: ["pendente", "confirmado", "em_rota"] });
  assert.equal(chamadas[0][2].fetchAll, true);
  const lotes = chamadas.filter((c) => c[0] === "poi");
  assert.deepEqual(lotes.map((c) => c[1].order_id), [["p1"], ["p2"]]); // entregue fora, 1 lote por pedido
  assert.ok(lotes.every((c) => c[2].fetchAll === true));
  assert.deepEqual(r.emAberto, { a: 4 });
  const falha = { filter: async () => { throw new Error("rede"); } };
  await assert.rejects(carregarPedidosAbertos({ PurchaseOrder, PurchaseOrderItem: falha, franchiseId: "f" }), /rede/);
  await assert.rejects(carregarPedidosAbertos({ PurchaseOrder: falha, PurchaseOrderItem, franchiseId: "f" }), /rede/);
  n++; console.log("ok - P3 4: carrega só pedidos abertos, completos; erro rejeita");
})();

console.log(`\nreposicao: ${n} grupos ok`);

t("S14.7: comPrecoDaTabela mostra o preço que o pedido grava (tabela), não o custo da unidade", () => {
  const itens = [{ id: "a", cost_price: "1.00" }, { id: "b", cost_price: "6.20" }, { id: "c", cost_price: "9.00" }];
  const r = comPrecoDaTabela(itens, { a: 22.9, b: 6.2 });
  assert.equal(r[0].cost_price, 22.9);   // custo inventado/médio → tabela
  assert.equal(r[1], itens[1]);          // igual: mesmo objeto
  assert.equal(r[2], itens[2]);          // sem preço no mapa: custo da unidade
  assert.equal(comPrecoDaTabela(itens, null), itens); // mapa ainda não chegou
});
