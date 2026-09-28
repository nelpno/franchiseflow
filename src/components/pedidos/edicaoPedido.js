// Edição do pedido pelo admin numa transação só (S15, P3 2ª passada, ponto 1).
//
// A RPC `salvar_edicao_pedido` (supabase/2026-09-28-s15-conferir-entrega.sql) trava o pedido,
// recusa se ele já não está pendente/confirmado (detail S15_PEDIDO_MUDOU), grava os itens e
// recalcula o total no servidor. Antes eram chamadas separadas: se outro admin entregasse no
// meio, ficava total diferente dos itens e da despesa.
//
// Convive com o banco velho (mesmo padrão da S14): só a AUSÊNCIA desta função libera o caminho
// antigo; timeout ou erro de rede não caem no legado.

export const RPC_EDICAO_PEDIDO = "salvar_edicao_pedido";

export function rpcEdicaoAusente(error) {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  if (error.code === "42883") return String(error.message || "").includes(RPC_EDICAO_PEDIDO);
  return false;
}

// Recusas do banco que querem dizer "o pedido mudou enquanto a tela estava aberta".
export const DETALHES_PEDIDO_MUDOU = Object.freeze([
  "S15_PEDIDO_MUDOU",
  "S15_ENTREGUE_FINANCEIRO",
  "S15_ENTREGUE_TERMINAL",
  "S15_ITENS_TRAVADOS",
  "S15_AGUARDA_CONFERENCIA",
]);
export function pedidoMudou(error) {
  return !!error && DETALHES_PEDIDO_MUDOU.includes(error.details);
}
export const MSG_PEDIDO_MUDOU = "O pedido mudou (já foi entregue ou cancelado). Recarregue a página.";

/**
 * @param {object} a
 * @param {(fn:string, params:object) => Promise<{data:any, error:any}>} a.rpc
 * @param {Array<{id:string, quantity:number}>} a.itens  só os itens que mudaram
 * @param {object} a.patch  {freight_cost?, estimated_delivery?} — chave ausente = não mexe
 * @param {() => Promise<void>} a.legado  caminho antigo (só se a função não existir)
 * @returns {Promise<{via:"rpc"|"legado", linha:object|null}>}
 */
export async function salvarEdicaoPedido({ rpc, orderId, itens, patch, legado }) {
  const { data, error } = await rpc(RPC_EDICAO_PEDIDO, {
    p_order_id: orderId,
    p_itens: Array.isArray(itens) ? itens : [],
    p_patch: patch && typeof patch === "object" ? patch : {},
  });
  if (error) {
    if (rpcEdicaoAusente(error) && typeof legado === "function") {
      await legado();
      return { via: "legado", linha: null };
    }
    throw error;
  }
  return { via: "rpc", linha: data || null };
}

/** Frete salvo pela lista: confere pela linha que o banco DEVOLVEU (nunca "salvo" à toa). */
export function freteGravado(linha, valor) {
  if (!linha) return false;
  const gravado = linha.freight_cost === null || linha.freight_cost === undefined ? null : Number(linha.freight_cost);
  return gravado === valor;
}
