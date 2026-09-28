// node src/lib/conferenciaEntrega.test.mjs
import assert from "node:assert/strict";
import {
  aguardaConferencia,
  prazoConferencia,
  limitarRecebido,
  montarItensRecebidos,
  resumoRecebido,
  rotuloConferencia,
  mensagemErroConferencia,
  confirmarRecebimento,
  RPC_CONFIRMAR_RECEBIMENTO,
} from "./conferenciaEntrega.js";

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };

const itens = [
  { id: "i1", product_name: "Lasanha Bolonhesa - 1kg", quantity: 10, unit_price: "20.10" },
  { id: "i2", product_name: "Nhoque de Batata - 500g", quantity: 5, unit_price: 10 },
  { id: "i3", product_name: "Molho de Tomate Mariolla - 250g", quantity: 4, unit_price: 7.5 },
];

await t("só em_rota espera conferência", () => {
  assert.equal(aguardaConferencia({ status: "em_rota", awaiting_since: "2026-09-28T12:00:00Z" }), true);
  assert.equal(aguardaConferencia({ status: "em_rota" }), false); // em_rota legado: fluxo antigo
  for (const s of ["pendente", "confirmado", "entregue", "cancelado", undefined]) assert.equal(aguardaConferencia({ status: s }), false);
  assert.equal(aguardaConferencia(null), false);
});

await t("prazo = awaiting_since + 48 h (sem awaiting_since = null)", () => {
  assert.equal(prazoConferencia({ awaiting_since: "2026-09-28T12:00:00Z" }).toISOString(), "2026-09-30T12:00:00.000Z");
  assert.equal(prazoConferencia({ shipped_at: "2026-09-28T12:00:00Z" }), null);
  assert.equal(prazoConferencia({}), null);
  assert.equal(prazoConferencia({ awaiting_since: "lixo" }), null);
});

await t("quantidade que chegou fica entre 0 e o pedido; vazio = 0", () => {
  assert.equal(limitarRecebido("7", 10), 7);
  assert.equal(limitarRecebido(12, 10), 10);
  assert.equal(limitarRecebido(-3, 10), 0);
  assert.equal(limitarRecebido("", 10), 0);
  assert.equal(limitarRecebido("abc", 10), 0);
  assert.equal(limitarRecebido("7.9", 10), 7);
});

await t("payload só leva o que mudou; tudo igual = lista vazia (Recebi tudo certo)", () => {
  assert.deepEqual(montarItensRecebidos(itens, {}), []);
  assert.deepEqual(montarItensRecebidos(itens, { i1: 10, i2: "5" }), []);
  assert.deepEqual(montarItensRecebidos(itens, { i1: 8, i2: 0, i3: 4 }), [
    { item_id: "i1", received_quantity: 8 },
    { item_id: "i2", received_quantity: 0 },
  ]);
  assert.deepEqual(montarItensRecebidos(itens, { i1: 99 }), []); // acima do pedido = pedido
  assert.deepEqual(montarItensRecebidos(itens, { x: 1 }), []);
});

await t("totais em centavos: pedido, recebido e o que faltou", () => {
  const r = resumoRecebido(itens, { i1: 8, i2: 0 });
  assert.equal(r.totalPedido, 281); // 201 + 50 + 30
  assert.equal(r.totalRecebido, 190.8); // 160,80 + 0 + 30
  assert.equal(r.diferenca, 90.2);
  assert.equal(r.temDiferenca, true);
  assert.deepEqual(r.linhas.map((l) => [l.id, l.pedido, l.chegou]), [["i1", 10, 8], ["i2", 5, 0]]);
  const igual = resumoRecebido(itens, {});
  assert.equal(igual.temDiferenca, false);
  assert.equal(igual.totalRecebido, igual.totalPedido);
});

await t("pedido já conferido: lê received_quantity (nulo = chegou tudo)", () => {
  const gravado = [
    { ...itens[0], received_quantity: 8 },
    { ...itens[1], received_quantity: null },
    { ...itens[2], received_quantity: 4 },
  ];
  const r = resumoRecebido(gravado);
  assert.equal(r.totalRecebido, 160.8 + 50 + 30);
  assert.deepEqual(r.linhas.map((l) => l.id), ["i1"]);
  assert.equal(resumoRecebido(itens).temDiferenca, false); // pedido antigo sem conferência
});

await t("rótulos do admin", () => {
  assert.equal(rotuloConferencia("divergente"), "Chegou com diferença");
  assert.equal(rotuloConferencia("automatico"), "Sem conferência da unidade");
  assert.equal(rotuloConferencia("ok"), "Unidade conferiu");
  assert.equal(rotuloConferencia(null), null);
});

await t("mensagem: regra do banco sem o prefixo; técnico vira texto seguro", () => {
  assert.equal(mensagemErroConferencia({ message: "Pedido: este pedido ainda não saiu da fábrica." }), "este pedido ainda não saiu da fábrica.");
  const m = mensagemErroConferencia({ message: 'duplicate key value violates unique constraint "x"' });
  assert.ok(!m.includes("duplicate"));
});

await t("RPC: manda os parâmetros certos e distingue mesmo envio × outra tela", async () => {
  const chamadas = [];
  const rpc = async (fn, p) => { chamadas.push([fn, p]); return { data: { id: "po1", ja_confirmado: false, mesmo_envio: true, modo: "divergente" }, error: null }; };
  const r = await confirmarRecebimento({ rpc, orderId: "po1", itens: [{ item_id: "i1", received_quantity: 8 }], clientId: "c1" });
  assert.equal(r.resultado, "confirmado");
  assert.deepEqual(chamadas, [[RPC_CONFIRMAR_RECEBIMENTO, { p_order_id: "po1", p_itens: [{ item_id: "i1", received_quantity: 8 }], p_client_id: "c1" }]]);
  const perdida = await confirmarRecebimento({ rpc: async () => ({ data: { ja_confirmado: true, mesmo_envio: true }, error: null }), orderId: "po1", itens: null, clientId: "c1" });
  assert.equal(perdida.resultado, "confirmado");
  const outra = await confirmarRecebimento({ rpc: async () => ({ data: { ja_confirmado: true, mesmo_envio: false }, error: null }), orderId: "po1", itens: [], clientId: "c2" });
  assert.equal(outra.resultado, "ja_conferido");
});

await t("RPC: erro e resposta vazia sobem (a tela mantém o que ela digitou)", async () => {
  await assert.rejects(confirmarRecebimento({ rpc: async () => ({ data: null, error: { message: "Pedido: x" } }), orderId: "a", itens: [], clientId: "c" }), (e) => e.message === "Pedido: x");
  await assert.rejects(confirmarRecebimento({ rpc: async () => ({ data: null, error: null }), orderId: "a", itens: [], clientId: "c" }), /vazia/);
  await assert.rejects(confirmarRecebimento({ rpc: () => new Promise(() => {}), orderId: "a", itens: [], clientId: "c", timeoutMs: 20 }), /Tempo limite/);
});

console.log(`\n${n} testes OK`);
