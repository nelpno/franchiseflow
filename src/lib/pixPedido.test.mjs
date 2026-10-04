// node src/lib/pixPedido.test.mjs
import assert from "node:assert/strict";
import { montarAvisosPix } from "./pixPedido.js";

const contato = (f) => ({ a: { ownerName: "Ana Paula" }, b: { ownerName: "" } })[f];
const P = (id, f, total, frete, status = "entregue") => ({ id, franchise_id: f, total_amount: total, freight_cost: frete, ordered_at: "2026-09-27T22:00:00Z", status });

const av = montarAvisosPix([P("1", "a", 1000, 250), P("2", "a", 200, 0), P("3", "b", 500, null), P("4", "c", 900, 0, "em_rota"), undefined], contato);
assert.equal(av.length, 2, "uma mensagem por unidade; em_rota (conferência) e linha vazia fora");
assert.deepEqual(av[0].order_ids, ["1", "2"]);
assert.equal(av[0].tipo, "pix");
assert.ok(av[0].text.startsWith("Oi, Ana! Dei baixa nos seus 2 pedidos de 27/09"), av[0].text);
assert.ok(av[0].text.includes("Total do Pix: R$ 1.450,00"), av[0].text);
assert.ok(av[1].text.startsWith("Oi! Dei baixa no seu pedido"), av[1].text);
assert.equal(montarAvisosPix([], contato).length, 0);
console.log("pixPedido: ok");
