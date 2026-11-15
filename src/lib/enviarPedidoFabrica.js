// Envio do pedido à fábrica numa chamada só (S14.3, 28/09/2026).
//
// A RPC `create_purchase_order_with_items` (supabase/2026-09-28-s14-purchase-order-atomica.sql)
// grava cabeçalho + itens na mesma transação e é idempotente pelo id gerado no aparelho
// (clientId): clique repetido, resposta perdida ou nova tentativa devolvem o MESMO pedido.
//
// Convive com o banco velho: se a função ainda não existe (PGRST202/42883), cai no caminho
// antigo (`legado`, as 2 chamadas de sempre). Só nesse caso — timeout ou erro de rede NÃO
// caem no legado, porque o pedido pode ter sido gravado e o legado duplicaria.
// DROP da função no banco = volta ao caminho antigo sem deploy.

import { safeErrorMessage } from "./safeErrorMessage.js";

export const RPC_PEDIDO_FABRICA = "create_purchase_order_with_items";
export const TIMEOUT_PEDIDO_MS = 30000;

// Só a AUSÊNCIA desta função específica libera o caminho antigo (P3 da S14, ponto 5):
// PGRST202 (PostgREST não achou a função chamada) ou 42883 cuja mensagem cita este nome.
// Qualquer outro erro — inclusive 42883 de outra função chamada lá dentro — interrompe.
export function rpcAusente(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  if (error.code === "PGRST202") return true;
  if (error.code === "42883") return msg.includes(RPC_PEDIDO_FABRICA);
  return false;
}

// Mesmo client_id com conteúdo diferente do que já foi gravado (outra aba, tela mudada depois
// de uma resposta perdida): a RPC recusa com detail S14_ENVIO_DIFERENTE. A tela mantém o
// rascunho e só gera um envio novo (id novo) se ela confirmar.
export const DETALHE_ENVIO_DIFERENTE = "S14_ENVIO_DIFERENTE";
export function ehEnvioDiferente(error) {
  if (!error) return false;
  return error.details === DETALHE_ENVIO_DIFERENTE ||
    String(error.message || "").startsWith("Pedido: um pedido anterior deste formulário");
}

/** Mensagem segura: as da RPC começam com "Pedido:" e foram escritas para a franqueada ler. */
export function mensagemErroPedido(error) {
  const raw = String(error?.message || "");
  if (raw.startsWith("Pedido:")) return raw.slice("Pedido:".length).trim();
  return safeErrorMessage(error, "Não foi possível enviar o pedido. Tente de novo.");
}

/** [{inventory_item_id, quantity}] — só quantidade inteira > 0. */
export function montarItensDoPedido(produtos, quantidades) {
  const out = [];
  for (const p of produtos || []) {
    const q = parseInt(quantidades?.[p?.id], 10);
    if (p?.id && Number.isFinite(q) && q > 0) out.push({ inventory_item_id: p.id, quantity: q });
  }
  return out;
}

function comTimeout(promise, ms) {
  let id;
  const limite = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, limite]).finally(() => clearTimeout(id));
}

/**
 * @param {object} args
 * @param {(fn:string, params:object) => Promise<{data:any, error:any}>} args.rpc  ex.: (f,p) => supabase.rpc(f,p)
 * @param {string} args.clientId   uuid gerado ANTES da 1ª tentativa e mantido nas seguintes
 * @param {() => Promise<{id:string}>} args.legado  caminho antigo (só se a RPC não existir)
 * @returns {Promise<{id:string, jaExistia:boolean, via:"rpc"|"legado"}>}
 */
export async function enviarPedidoFabrica({ rpc, clientId, franchiseId, itens, notes, totalWeightKg, legado, timeoutMs = TIMEOUT_PEDIDO_MS }) {
  const { data, error } = await comTimeout(
    Promise.resolve(
      rpc(RPC_PEDIDO_FABRICA, {
        p_client_id: clientId,
        p_franchise_id: franchiseId,
        p_items: itens,
        p_notes: notes || null,
        p_total_weight_kg: Number.isFinite(totalWeightKg) && totalWeightKg > 0 ? totalWeightKg : null,
      })
    ),
    timeoutMs
  );
  if (error) {
    if (rpcAusente(error) && typeof legado === "function") {
      const order = await legado();
      return { id: order?.id, jaExistia: false, via: "legado" };
    }
    throw error;
  }
  if (!data?.id) throw new Error("Resposta sem o número do pedido");
  const total = data.total_amount == null ? NaN : Number(data.total_amount);
  // S25: a RPC devolve o status do pedido que já existia (ex.: "cancelado" pela Maxi).
  return { id: data.id, jaExistia: data.ja_existia === true, via: "rpc", totalAmount: Number.isFinite(total) ? total : null, ...(data.status ? { status: data.status } : {}) };
}

/** uuid v4 do envio (gerado ANTES da 1ª tentativa). crypto.randomUUID quando existe. */
export function novoIdDoEnvio() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function idDoEnvioValido(id) {
  return typeof id === "string" && UUID_RE.test(id);
}
