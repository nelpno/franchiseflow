// node src/lib/enviarPedidoFabrica.test.mjs
import assert from "node:assert/strict";
import {
  enviarPedidoFabrica,
  rpcAusente,
  mensagemErroPedido,
  montarItensDoPedido,
  RPC_PEDIDO_FABRICA,
  novoIdDoEnvio,
  idDoEnvioValido,
  ehEnvioDiferente,
} from "./enviarPedidoFabrica.js";

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };

const base = { clientId: "c-1", franchiseId: "franquiateste", itens: [{ inventory_item_id: "a", quantity: 2 }], notes: "", totalWeightKg: 1.4 };

await t("chama a RPC com o client_id e devolve o pedido", async () => {
  const chamadas = [];
  const rpc = async (fn, p) => { chamadas.push([fn, p]); return { data: { id: "c-1", ja_existia: false }, error: null }; };
  const r = await enviarPedidoFabrica({ ...base, rpc, legado: () => { throw new Error("não devia"); } });
  assert.deepEqual(r, { id: "c-1", jaExistia: false, via: "rpc" });
  assert.equal(chamadas[0][0], RPC_PEDIDO_FABRICA);
  assert.equal(chamadas[0][1].p_client_id, "c-1");
  assert.equal(chamadas[0][1].p_notes, null);
  assert.equal(chamadas[0][1].p_total_weight_kg, 1.4);
});

await t("clique repetido: a 2ª chamada com o mesmo id volta 'já existia', sem 2º pedido", async () => {
  // banco fake idempotente pelo id, como o ON CONFLICT (id) DO NOTHING da função
  const banco = new Map();
  const rpc = async (_fn, p) => {
    const ja = banco.has(p.p_client_id);
    if (!ja) banco.set(p.p_client_id, p.p_items);
    return { data: { id: p.p_client_id, ja_existia: ja }, error: null };
  };
  const [a, b] = await Promise.all([enviarPedidoFabrica({ ...base, rpc }), enviarPedidoFabrica({ ...base, rpc })]);
  assert.equal(banco.size, 1);
  assert.equal(a.id, b.id);
  assert.deepEqual([a.jaExistia, b.jaExistia].sort(), [false, true]);
});

await t("banco velho (função não existe) cai no caminho antigo", async () => {
  for (const error of [
    { code: "PGRST202", message: "Could not find the function public.create_purchase_order_with_items" },
    { code: "42883", message: "function public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric) does not exist" },
  ]) {
    let usouLegado = 0;
    const r = await enviarPedidoFabrica({ ...base, rpc: async () => ({ data: null, error }), legado: async () => { usouLegado++; return { id: "velho" }; } });
    assert.equal(usouLegado, 1);
    assert.deepEqual(r, { id: "velho", jaExistia: false, via: "legado" });
  }
});

await t("erro de regra ou de rede NÃO cai no legado (poderia duplicar)", async () => {
  let usouLegado = 0;
  const legado = async () => { usouLegado++; return { id: "x" }; };
  await assert.rejects(
    enviarPedidoFabrica({ ...base, rpc: async () => ({ data: null, error: { code: "P0001", message: "Pedido: escolha pelo menos um produto." } }), legado }),
    (e) => /escolha/.test(e.message)
  );
  await assert.rejects(
    enviarPedidoFabrica({ ...base, rpc: async () => ({ data: null, error: { message: "Failed to fetch" } }), legado }),
    (e) => /Failed to fetch/.test(e.message)
  );
  await assert.rejects(
    enviarPedidoFabrica({ ...base, rpc: () => new Promise(() => {}), legado, timeoutMs: 20 }),
    /Tempo limite/
  );
  assert.equal(usouLegado, 0);
});

await t("peso zero/indefinido vai nulo", async () => {
  let p;
  const rpc = async (_f, params) => { p = params; return { data: { id: "c-1" }, error: null }; };
  await enviarPedidoFabrica({ ...base, totalWeightKg: 0, rpc });
  assert.equal(p.p_total_weight_kg, null);
  await enviarPedidoFabrica({ ...base, totalWeightKg: NaN, rpc });
  assert.equal(p.p_total_weight_kg, null);
});

await t("rpcAusente e mensagens", async () => {
  assert.equal(rpcAusente(null), false);
  assert.equal(rpcAusente({ code: "P0001", message: "x" }), false);
  assert.equal(mensagemErroPedido({ code: "P0001", message: "Pedido: o mesmo produto veio duas vezes." }), "o mesmo produto veio duas vezes.");
  assert.equal(mensagemErroPedido({ code: "42501", message: "new row violates row-level security policy for table \"purchase_orders\"" }), "Sem permissão para esta ação.");
  // mensagem técnica crua nunca chega à tela
  const m = mensagemErroPedido({ code: "XX000", message: "relation purchase_orders ..." });
  assert.ok(!/purchase_orders/.test(m));
});

await t("montarItensDoPedido: só inteiro > 0", async () => {
  const produtos = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(montarItensDoPedido(produtos, { a: 3, b: 0, c: "", d: "2" }), [
    { inventory_item_id: "a", quantity: 3 },
    { inventory_item_id: "d", quantity: 2 },
  ]);
});


{
  const a = novoIdDoEnvio(), b = novoIdDoEnvio();
  assert.ok(idDoEnvioValido(a) && idDoEnvioValido(b) && a !== b);
  assert.equal(idDoEnvioValido("x"), false);
  assert.equal(idDoEnvioValido(null), false);
  console.log("ok - id do envio (uuid v4)");
}

await t("P3 5: só a ausência DESTA função cai no legado", async () => {
  let usouLegado = 0;
  const legado = async () => { usouLegado++; return { id: "x" }; };
  for (const error of [
    { code: "42883", message: "function public.normalize_phone_br(text) does not exist" },
    { code: "42883", message: "operator does not exist: text = uuid" },
    { code: "PGRST203", message: "Could not choose the best candidate function" },
    { message: "Could not find the function public.create_purchase_order_with_items" }, // sem código
  ]) {
    await assert.rejects(enviarPedidoFabrica({ ...base, rpc: async () => ({ data: null, error }), legado }));
  }
  assert.equal(usouLegado, 0);
});

await t("P3 3: mesmo id com conteúdo diferente é reconhecido e não cai no legado", async () => {
  const error = { code: "P0001", details: "S14_ENVIO_DIFERENTE", message: "Pedido: um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo." };
  assert.equal(ehEnvioDiferente(error), true);
  assert.equal(ehEnvioDiferente({ code: "P0001", message: "Pedido: escolha pelo menos um produto." }), false);
  assert.equal(ehEnvioDiferente(null), false);
  let usouLegado = 0;
  await assert.rejects(
    enviarPedidoFabrica({ ...base, rpc: async () => ({ data: null, error }), legado: async () => { usouLegado++; return { id: "x" }; } }),
    (e) => ehEnvioDiferente(e)
  );
  assert.equal(usouLegado, 0);
  assert.equal(mensagemErroPedido(error), "um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo.");
});

console.log(`
enviarPedidoFabrica: ${n} grupos ok`);
