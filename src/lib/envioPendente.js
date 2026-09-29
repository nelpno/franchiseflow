// S25 (P3, 2ª passada): tentativa de envio do pedido à fábrica que ainda não teve resposta.
// Puro, sem React (storage e rpc injetados, para testar sem navegador nem banco).
//
// Por que existe: a RPC create_purchase_order_with_items grava UMA vez por id do aparelho. Se a
// resposta se perde (rede caiu, fechou a tela), a proteção só vale se a PRÓXIMA tentativa usar o
// MESMO id com o MESMO conteúdo. Por isso a tentativa fica numa chave PRÓPRIA (separada do
// rascunho que ela edita), sem prazo de validade, até ser reconciliada: sucesso, pedido já
// existente, ou "mesmo id com outro conteúdo" (S14_ENVIO_DIFERENTE). Se não der para gravar essa
// chave, o envio NÃO acontece (quem chama avisa).
import { enviarPedidoFabrica, idDoEnvioValido, ehEnvioDiferente, rpcAusente } from "./enviarPedidoFabrica.js";

export const chaveEnvioPendente = (franchiseId) => `reposicao_envio_pendente_${franchiseId}`;

/** Grava a tentativa. true = gravou; false = storage indisponível (quem chama NÃO envia). */
export function gravarEnvioPendente(storage, franchiseId, { clientId, itens, notes = null, totalWeightKg = null }) {
  if (!franchiseId || !idDoEnvioValido(clientId) || !Array.isArray(itens) || itens.length === 0) return false;
  try {
    const dados = { clientId, itens, notes, totalWeightKg, savedAt: Date.now() };
    storage.setItem(chaveEnvioPendente(franchiseId), JSON.stringify(dados));
    // confere de fora: storage que "aceita" e descarta (cota cheia em alguns navegadores) = falha
    const volta = JSON.parse(storage.getItem(chaveEnvioPendente(franchiseId)) || "null");
    return !!volta && volta.clientId === clientId;
  } catch {
    return false;
  }
}

/** Lê a tentativa pendente (ou null). Sem prazo de validade. */
export function lerEnvioPendente(storage, franchiseId) {
  if (!franchiseId) return null;
  try {
    const d = JSON.parse(storage.getItem(chaveEnvioPendente(franchiseId)) || "null");
    if (!d || !idDoEnvioValido(d.clientId) || !Array.isArray(d.itens) || d.itens.length === 0) return null;
    return d;
  } catch {
    return null;
  }
}

export function apagarEnvioPendente(storage, franchiseId) {
  try { storage.removeItem(chaveEnvioPendente(franchiseId)); } catch { /* sem storage: nada a apagar */ }
}

/**
 * Reconcilia a tentativa pendente: reenvia o CONTEÚDO ORIGINAL guardado com o MESMO id.
 * @returns {Promise<{estado:"nenhum"|"ja_existia"|"enviado"|"diferente"|"erro", totalAmount?:number|null, erro?:any}>}
 *   "erro" mantém a tentativa guardada (a próxima abertura tenta de novo).
 */
export async function reconciliarEnvioPendente({ rpc, storage, franchiseId, timeoutMs }) {
  const p = lerEnvioPendente(storage, franchiseId);
  if (!p) return { estado: "nenhum" };
  try {
    const r = await enviarPedidoFabrica({
      rpc,
      clientId: p.clientId,
      franchiseId,
      itens: p.itens,
      notes: p.notes,
      totalWeightKg: p.totalWeightKg,
      ...(timeoutMs ? { timeoutMs } : {}),
    });
    apagarEnvioPendente(storage, franchiseId);
    return { estado: r.jaExistia ? "ja_existia" : "enviado", totalAmount: r.totalAmount ?? null };
  } catch (erro) {
    // Banco sem a RPC (volta atrás da S14): não há idempotência a reconciliar.
    if (ehEnvioDiferente(erro) || rpcAusente(erro)) {
      apagarEnvioPendente(storage, franchiseId);
      return { estado: "diferente" };
    }
    return { estado: "erro", erro };
  }
}

/** Margem para relógio do aparelho × servidor ao comparar ordered_at. */
export const MARGEM_PEDIDO_NOVO_MS = 2 * 60 * 1000;

/**
 * Pedidos (não cancelados) feitos DEPOIS que o formulário abriu — por outro aparelho ou aba.
 * O pedido desta própria tentativa (id = idProprio) não conta. Mais recente primeiro.
 */
export function pedidosNovosDesde(pedidos, desdeMs, idProprio = null) {
  const corte = desdeMs - MARGEM_PEDIDO_NOVO_MS;
  return (pedidos || [])
    .filter((p) => p && p.status !== "cancelado" && p.id !== idProprio && new Date(p.ordered_at).getTime() >= corte)
    .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());
}
