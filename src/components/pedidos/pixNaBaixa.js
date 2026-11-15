// Pix na baixa (P12, 04/10/2026): quando o admin dá o pedido como ENTREGUE, sai pelo WhatsApp do
// Nelson (admin_nelson, n8n aviso-entrega-pedidos com tipo 'pix') o pedido de Pix com valor + frete.
// Só com a chave pix_na_baixa ligada para a unidade (sem linha = desligada = nada sai). A coluna
// payment_status nasce 'pendente' no banco em toda baixa, com ou sem a chave (é a medição).
// Uma mensagem por unidade; nunca repete sozinho (cobrança automática à franqueada fica fora).
import { getFeatureFlags, PurchaseOrder } from "@/entities/all";
import { avisarEntregaPedidos } from "@/api/functions";
import { isFeatureOn, FEATURE_KEYS } from "@/lib/featureFlags";
import { montarAvisosPix } from "@/lib/pixPedido";

export { montarAvisosPix };

/**
 * Manda o pedido de Pix das unidades com a chave ligada. Nunca lança: a baixa já aconteceu e
 * não pode parecer que falhou por causa do WhatsApp. Devolve { enviados, falhou }.
 */
export async function pedirPixDaBaixa(pedidos, contatoDe) {
  const avisos = montarAvisosPix(pedidos, contatoDe);
  if (avisos.length === 0) return { enviados: 0, falhou: 0 };
  const ligados = [];
  for (const a of avisos) {
    try {
      if (isFeatureOn(await getFeatureFlags(a.franchise_id), FEATURE_KEYS.PIX_NA_BAIXA)) ligados.push(a);
    } catch {
      // chave ilegível = desligada (regra de featureFlags.js)
    }
  }
  if (ligados.length === 0) return { enviados: 0, falhou: 0 };
  const ids = ligados.flatMap((a) => a.order_ids);
  await Promise.allSettled(ids.map((id) => PurchaseOrder.update(id, { payment_request_status: "fila", payment_request_error: null })));
  try {
    await avisarEntregaPedidos(ligados);
    return { enviados: ligados.length, falhou: 0 };
  } catch (err) {
    console.error("Erro ao pedir o Pix:", err);
    await Promise.allSettled(ids.map((id) => PurchaseOrder.update(id, { payment_request_status: "falhou", payment_request_error: "Não foi possível falar com o WhatsApp" })));
    return { enviados: 0, falhou: ligados.length };
  }
}
