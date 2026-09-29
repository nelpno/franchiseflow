// node src/lib/envioPendente.test.mjs — S25 P3 (2ª passada): tentativa pendente do pedido à fábrica.
// Controle positivo: no main este arquivo falha (o módulo não existe); os casos abaixo reproduzem
// os achados da P3 (tentativa que some, conteúdo reconstruído, dois aparelhos).
import assert from "node:assert/strict";
import {
  chaveEnvioPendente, gravarEnvioPendente, lerEnvioPendente, apagarEnvioPendente,
  reconciliarEnvioPendente, pedidosNovosDesde, MARGEM_PEDIDO_NOVO_MS,
} from "./envioPendente.js";
import { DETALHE_ENVIO_DIFERENTE } from "./enviarPedidoFabrica.js";

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const ID = "11111111-2222-4333-8444-555555555555";
const ITENS = [{ inventory_item_id: "a", quantity: 2 }, { inventory_item_id: "b", quantity: 4 }];

await t("grava numa chave própria, sem prazo, e lê de volta", () => {
  const st = memoria();
  assert.equal(gravarEnvioPendente(st, "u", { clientId: ID, itens: ITENS, notes: "x" }), true);
  assert.equal(st.m.has(chaveEnvioPendente("u")), true);
  assert.equal(st.m.has("reposicao_draft_u"), false, "não mexe no rascunho editável");
  const salvo = JSON.parse(st.getItem(chaveEnvioPendente("u")));
  salvo.savedAt = Date.now() - 30 * 86400000; // 30 dias depois continua valendo
  st.setItem(chaveEnvioPendente("u"), JSON.stringify(salvo));
  assert.deepEqual(lerEnvioPendente(st, "u").itens, ITENS);
});

await t("storage que falha ou descarta = não grava (quem chama não envia)", () => {
  const quebrado = { setItem: () => { throw new Error("cota"); }, getItem: () => null };
  assert.equal(gravarEnvioPendente(quebrado, "u", { clientId: ID, itens: ITENS }), false);
  const descarta = { setItem: () => {}, getItem: () => null };
  assert.equal(gravarEnvioPendente(descarta, "u", { clientId: ID, itens: ITENS }), false);
  assert.equal(gravarEnvioPendente(memoria(), "u", { clientId: "x", itens: ITENS }), false);
  assert.equal(gravarEnvioPendente(memoria(), "u", { clientId: ID, itens: [] }), false);
});

await t("reconciliar reenvia o CONTEÚDO ORIGINAL com o MESMO id (mesmo que o catálogo mude depois)", async () => {
  const st = memoria();
  gravarEnvioPendente(st, "u", { clientId: ID, itens: ITENS, notes: "obs", totalWeightKg: 3 });
  let chamada;
  const rpc = async (fn, p) => { chamada = p; return { data: { id: p.p_client_id, ja_existia: true, total_amount: 99.5 }, error: null }; };
  const r = await reconciliarEnvioPendente({ rpc, storage: st, franchiseId: "u" });
  assert.equal(r.estado, "ja_existia");
  assert.equal(r.totalAmount, 99.5);
  assert.equal(chamada.p_client_id, ID);
  assert.deepEqual(chamada.p_items, ITENS);
  assert.equal(chamada.p_notes, "obs");
  assert.equal(lerEnvioPendente(st, "u"), null, "reconciliado: some");
});

await t("reconciliar: pedido não tinha chegado -> envia agora; erro de rede mantém; conteúdo diferente apaga", async () => {
  const st = memoria();
  gravarEnvioPendente(st, "u", { clientId: ID, itens: ITENS });
  const r1 = await reconciliarEnvioPendente({ rpc: async (f, p) => ({ data: { id: p.p_client_id, ja_existia: false, total_amount: 10 }, error: null }), storage: st, franchiseId: "u" });
  assert.equal(r1.estado, "enviado");
  gravarEnvioPendente(st, "u", { clientId: ID, itens: ITENS });
  const r2 = await reconciliarEnvioPendente({ rpc: async () => { throw new Error("rede"); }, storage: st, franchiseId: "u" });
  assert.equal(r2.estado, "erro");
  assert.ok(lerEnvioPendente(st, "u"), "erro de rede NÃO apaga");
  const r3 = await reconciliarEnvioPendente({ rpc: async () => ({ data: null, error: { code: "P0001", details: DETALHE_ENVIO_DIFERENTE, message: "x" } }), storage: st, franchiseId: "u" });
  assert.equal(r3.estado, "diferente");
  assert.equal(lerEnvioPendente(st, "u"), null);
  assert.equal((await reconciliarEnvioPendente({ rpc: async () => { throw new Error("não chama"); }, storage: st, franchiseId: "u" })).estado, "nenhum");
});

await t("dois aparelhos: pedido feito depois que o formulário abriu é pego; o próprio e o cancelado não", () => {
  const aberto = Date.parse("2026-09-29T12:00:00Z");
  const pedidos = [
    { id: "velho", status: "entregue", ordered_at: "2026-09-20T10:00:00Z", total_amount: 1 },
    { id: "outro", status: "pendente", ordered_at: "2026-09-29T12:05:00Z", total_amount: 500 },
    { id: "cancelado", status: "cancelado", ordered_at: "2026-09-29T12:06:00Z", total_amount: 7 },
    { id: ID, status: "pendente", ordered_at: "2026-09-29T12:07:00Z", total_amount: 9 },
    { id: "relogio", status: "pendente", ordered_at: new Date(aberto - MARGEM_PEDIDO_NOVO_MS + 1000).toISOString(), total_amount: 3 },
  ];
  assert.deepEqual(pedidosNovosDesde(pedidos, aberto, ID).map((p) => p.id), ["outro", "relogio"]);
  assert.deepEqual(pedidosNovosDesde([], aberto, ID), []);
});

await t("apagar é seguro sem storage", () => {
  apagarEnvioPendente({ removeItem: () => { throw new Error("x"); } }, "u");
});

console.log(`\nenvioPendente: ${n} testes ok`);
