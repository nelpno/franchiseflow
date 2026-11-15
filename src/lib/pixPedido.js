// Parte pura do Pix na baixa (P12, 04/10/2026); o envio mora em components/pedidos/pixNaBaixa.js.
// Sem alias "@/": node src/lib/pixPedido.test.mjs
import { montarPedidoPix } from "./mensagemFranqueado.js";

/**
 * Puro. pedidos = linhas JÁ salvas como entregue ({ id, franchise_id, total_amount, freight_cost,
 * ordered_at, status }); contatoDe(franchise_id) -> { ownerName }. Devolve os avisos do n8n.
 */
export function montarAvisosPix(pedidos, contatoDe) {
  const porUnidade = new Map();
  for (const o of pedidos) {
    if (!o || o.status !== "entregue") continue; // desviado para a conferência (S15) ainda não
    if (!porUnidade.has(o.franchise_id)) porUnidade.set(o.franchise_id, []);
    porUnidade.get(o.franchise_id).push(o);
  }
  return [...porUnidade.entries()].map(([franchiseId, lista]) => ({
    franchise_id: franchiseId,
    order_ids: lista.map((o) => o.id),
    tipo: "pix",
    text: montarPedidoPix({
      nome: contatoDe(franchiseId)?.ownerName,
      pedidos: lista.map((o) => ({ total: o.total_amount, frete: o.freight_cost, data: o.ordered_at })),
    }),
  }));
}
