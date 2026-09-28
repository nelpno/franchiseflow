// Conferir a entrega do pedido à fábrica (S15.1, 28/09/2026).
//
// Unidade com a chave ui_v2: quando a fábrica marca "entregue", o banco deixa o pedido em
// 'em_rota' ("chegou, falta a unidade conferir") e nada entra no estoque nem nas despesas.
// A franqueada toca "Recebi tudo certo" ou "Faltou algo" (ajusta o que chegou) e a RPC
// `confirmar_recebimento_pedido` fecha o pedido numa transação: estoque e despesa de compra
// pelo que CHEGOU, frete o cobrado. Sem resposta em 48 h o banco fecha como recebido completo.
// SQL: supabase/2026-09-28-s15-conferir-entrega.sql.
//
// Idempotência: o id do envio (clientId) é gerado ANTES da 1ª tentativa e reaproveitado nas
// seguintes; a RPC devolve {ja_confirmado, mesmo_envio}. Mesmo envio = deu certo (resposta
// perdida); outro envio = alguém já conferiu (outra aba/aparelho) e a tela só recarrega.

import { safeErrorMessage } from "./safeErrorMessage.js";

export const RPC_CONFIRMAR_RECEBIMENTO = "confirmar_recebimento_pedido";
export const STATUS_AGUARDA_CONFERENCIA = "em_rota";
export const HORAS_PARA_CONFERIR = 48;
export const TIMEOUT_CONFERENCIA_MS = 30000;

// Conferência S15 = em_rota COM awaiting_since (o banco grava ao desviar o "entregue" da
// fábrica). em_rota sem awaiting_since é o fluxo antigo e não entra aqui.
export function aguardaConferencia(order) {
  return order?.status === STATUS_AGUARDA_CONFERENCIA && !!order?.awaiting_since;
}

/** Até quando ela pode conferir (awaiting_since + 48 h). null sem a data. */
export function prazoConferencia(order) {
  const base = order?.awaiting_since;
  if (!base) return null;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + HORAS_PARA_CONFERIR * 3600 * 1000);
}

const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

/**
 * Quantidade que chegou digitada na tela, presa entre 0 e o pedido. Texto vazio vale 0
 * (ela apagou o número = não chegou nada daquele produto).
 */
export function limitarRecebido(valor, pedido) {
  const max = Math.max(0, inteiro(pedido) || 0);
  if (valor === "" || valor === null || valor === undefined) return 0;
  const n = inteiro(valor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * Payload da RPC: só os itens em que o que chegou é DIFERENTE do pedido
 * ([{item_id, received_quantity}]); lista vazia = "Recebi tudo certo".
 */
export function montarItensRecebidos(items, recebidos) {
  const out = [];
  for (const it of items || []) {
    if (!it?.id) continue;
    const pedido = inteiro(it.quantity) || 0;
    if (!recebidos || !(it.id in recebidos)) continue;
    const chegou = limitarRecebido(recebidos[it.id], pedido);
    if (chegou !== pedido) out.push({ item_id: it.id, received_quantity: chegou });
  }
  return out;
}

const centavos = (v) => Math.round((Number(v) || 0) * 100);

/**
 * Totais ao vivo da tela "Faltou algo" (e do pedido já conferido, lendo received_quantity).
 * `recebidos` null = lê o que o banco gravou (received_quantity; nulo = chegou tudo).
 */
export function resumoRecebido(items, recebidos = null) {
  let pedidoC = 0;
  let recebidoC = 0;
  const linhas = [];
  for (const it of items || []) {
    const pedido = inteiro(it?.quantity) || 0;
    let chegou;
    if (recebidos) chegou = it?.id in recebidos ? limitarRecebido(recebidos[it.id], pedido) : pedido;
    else chegou = it?.received_quantity === null || it?.received_quantity === undefined ? pedido : inteiro(it.received_quantity);
    const preco = centavos(it?.unit_price);
    pedidoC += pedido * preco;
    recebidoC += chegou * preco;
    if (chegou !== pedido) linhas.push({ id: it.id, nome: it.product_name, pedido, chegou });
  }
  return {
    totalPedido: pedidoC / 100,
    totalRecebido: recebidoC / 100,
    diferenca: (pedidoC - recebidoC) / 100,
    linhas,
    temDiferenca: linhas.length > 0,
  };
}

/** Rótulo do resultado da conferência para o admin (received_mode). */
export function rotuloConferencia(mode) {
  if (mode === "divergente") return "Chegou com diferença";
  if (mode === "automatico") return "Sem conferência da unidade";
  if (mode === "ok") return "Unidade conferiu";
  return null;
}

/** Mensagem segura: as da RPC começam com "Pedido:" e foram escritas para ler. */
export function mensagemErroConferencia(error) {
  const raw = String(error?.message || "");
  if (raw.startsWith("Pedido:")) return raw.slice("Pedido:".length).trim();
  return safeErrorMessage(error, "Não foi possível confirmar. Confira sua internet e tente de novo.");
}

function comTimeout(promise, ms) {
  let id;
  const limite = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, limite]).finally(() => clearTimeout(id));
}

/**
 * Chama a RPC. Devolve {resultado: "confirmado"|"ja_conferido", dados}.
 *   confirmado    = gravou agora OU é a repetição do MESMO envio (resposta perdida);
 *   ja_conferido  = outra tela/aparelho conferiu antes (nada mudou agora).
 * Erro (rede, regra) sobe: a tela mantém o que ela digitou e o MESMO clientId.
 */
export async function confirmarRecebimento({ rpc, orderId, itens, clientId, timeoutMs = TIMEOUT_CONFERENCIA_MS }) {
  const { data, error } = await comTimeout(
    Promise.resolve(rpc(RPC_CONFIRMAR_RECEBIMENTO, {
      p_order_id: orderId,
      p_itens: Array.isArray(itens) ? itens : [],
      p_client_id: clientId,
    })),
    timeoutMs
  );
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("Resposta vazia da confirmação");
  if (data.ja_confirmado === true && data.mesmo_envio !== true) return { resultado: "ja_conferido", dados: data };
  return { resultado: "confirmado", dados: data };
}
