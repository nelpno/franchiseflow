// node src/components/pedidos/edicaoPedido.test.mjs
import assert from "node:assert/strict";
import { salvarEdicaoPedido, rpcEdicaoAusente, pedidoMudou, freteGravado, mensagemErroPedido, MSG_PEDIDO_OCUPADO, MSG_PEDIDO_MUDOU, RPC_EDICAO_PEDIDO } from "./edicaoPedido.js";

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };

await t("RPC: manda itens e patch; devolve a linha do banco", async () => {
  const chamadas = [];
  const rpc = async (fn, p) => { chamadas.push([fn, p]); return { data: { id: "po", total_amount: 190 }, error: null }; };
  const r = await salvarEdicaoPedido({ rpc, orderId: "po", itens: [{ id: "i1", quantity: 7 }], patch: { freight_cost: 300 }, legado: async () => { throw new Error("não devia"); } });
  assert.deepEqual(r, { via: "rpc", linha: { id: "po", total_amount: 190 } });
  assert.deepEqual(chamadas, [[RPC_EDICAO_PEDIDO, { p_order_id: "po", p_itens: [{ id: "i1", quantity: 7 }], p_patch: { freight_cost: 300 }, p_remover: [] }]]);
  await salvarEdicaoPedido({ rpc, orderId: "po", itens: [], patch: {}, remover: ["i9"] });
  assert.deepEqual(chamadas[1][1].p_remover, ["i9"]);
});

await t("função ausente -> caminho antigo; outros erros sobem (sem legado)", async () => {
  let legado = 0;
  const r = await salvarEdicaoPedido({ rpc: async () => ({ data: null, error: { code: "PGRST202" } }), orderId: "po", itens: [], patch: {}, legado: async () => { legado++; } });
  assert.equal(r.via, "legado"); assert.equal(legado, 1);
  await assert.rejects(
    salvarEdicaoPedido({ rpc: async () => ({ data: null, error: { code: "P0001", details: "S15_PEDIDO_MUDOU" } }), orderId: "po", itens: [], patch: {}, legado: async () => { legado++; } }),
    (e) => pedidoMudou(e)
  );
  assert.equal(legado, 1);
  assert.equal(rpcEdicaoAusente({ code: "42883", message: "function outra() does not exist" }), false);
  assert.equal(rpcEdicaoAusente({ code: "42883", message: "function salvar_edicao_pedido(uuid) does not exist" }), true);
});

await t("pedido mudou: códigos do banco", () => {
  for (const d of ["S15_PEDIDO_MUDOU", "S15_ENTREGUE_FINANCEIRO", "S15_ENTREGUE_TERMINAL", "S15_ITENS_TRAVADOS"]) assert.equal(pedidoMudou({ details: d }), true);
  assert.equal(pedidoMudou({ details: "outro" }), false);
  assert.equal(pedidoMudou(null), false);
});

await t("mensagem: ocupado × mudou × técnico", () => {
  assert.equal(mensagemErroPedido({ details: "S15_PEDIDO_OCUPADO" }, "x"), MSG_PEDIDO_OCUPADO);
  assert.equal(mensagemErroPedido({ details: "S15_PEDIDO_MUDOU" }, "x"), MSG_PEDIDO_MUDOU);
  assert.equal(mensagemErroPedido({ details: "S15_ITENS_TRAVADOS" }, "x"), MSG_PEDIDO_MUDOU);
  assert.equal(mensagemErroPedido({ message: "boom" }, "x"), "x");
});

await t("frete: só 'salvo' quando a linha devolvida tem o valor", () => {
  assert.equal(freteGravado({ freight_cost: "250" }, 250), true);
  assert.equal(freteGravado({ freight_cost: 0 }, 0), true);
  assert.equal(freteGravado({ freight_cost: 300 }, 250), false);
  assert.equal(freteGravado(null, 250), false);
});

console.log(`\n${n} testes OK`);
