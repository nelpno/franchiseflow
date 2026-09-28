/**
 * Regras puras do comprovante de venda (SaleReceipt) - S13.1, 28/09/2026.
 * Fica separado do componente para poder ser testado sem React nem DOM
 * (node src/lib/receiptUtils.test.mjs).
 */
import { formatPhone } from "./whatsappUtils.js";

/** Valores reais em `sales.delivery_method` (medido 28/09/2026, 90d): so "delivery"/"retirada",
 * 0 nulos. "pickup" cobre exportacoes antigas (salesExport.js ja tratava os 3). Qualquer outra
 * coisa cai em "retirada" - e o default do proprio formulario (SaleForm.jsx). */
export function isDeliverySale(deliveryMethod) {
  return deliveryMethod === "delivery";
}

/** "Entrega" ou "Retirada", explicito no cupom (nunca "loja"). */
export function resolveDeliveryLabel(deliveryMethod) {
  return isDeliverySale(deliveryMethod) ? "Entrega" : "Retirada";
}

/**
 * Endereco do cliente para o cupom: a VENDA primeiro (sales.customer_address/
 * customer_neighborhood, que o robo grava desde 28/09 - S4.2), depois o contato "vivo"
 * (contacts.endereco/bairro - cobre venda manual antiga sem o campo). Nunca mistura rua de
 * uma fonte com bairro de outra (evita "Rua X - bairro que nao e dela").
 * Retorna null quando a venda e RETIRADA (o cliente nao precisa de endereco nenhum); para
 * ENTREGA sem endereco nenhum, sinaliza `missing`.
 */
export function resolveReceiptAddress({ sale, contact } = {}) {
  const deliveryMethod = sale?.delivery_method;
  if (!isDeliverySale(deliveryMethod)) return null;

  if (sale?.customer_address) {
    return { address: sale.customer_address, neighborhood: sale.customer_neighborhood || null, missing: false };
  }
  if (contact?.endereco) {
    return { address: contact.endereco, neighborhood: contact.bairro || null, missing: false };
  }
  return { address: null, neighborhood: null, missing: true };
}

/** Linha pronta pra exibir na coluna de endereco, ou o aviso de faltante. */
export const ENDERECO_NAO_INFORMADO = "ENDEREÇO NÃO INFORMADO";

export function formatReceiptAddressLine({ sale, contact } = {}) {
  const resolved = resolveReceiptAddress({ sale, contact });
  if (!resolved) return null; // retirada: sem linha de endereco
  if (resolved.missing) return ENDERECO_NAO_INFORMADO;
  return [resolved.address, resolved.neighborhood].filter(Boolean).join(" — ");
}

/**
 * Percentual em pt-BR sem casa decimal inutil: 3.5 -> "3,5%", 5 -> "5%", 3.567 -> "3,57%".
 * NUNCA usar `.toFixed(0)` aqui - arredondava 3,5% para "4%" no cupom (achado da S13).
 */
export function formatCardFeePercent(percent) {
  const n = Number(percent) || 0;
  const corpo = n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${corpo}%`;
}

/**
 * Data + hora do cupom, hora SEMPRE em America/Sao_Paulo (nunca o fuso do aparelho - uma
 * venda lancada as 23:30 BRT tem created_at ja no dia seguinte em UTC). `saleDate` e DATE puro
 * (sem hora, sem fuso: extrai so os 10 primeiros caracteres pra nao escorregar de dia).
 */
export function formatReceiptDateTime(saleDate, createdAt) {
  const datePart = formatDatePart(saleDate);
  const timePart = formatTimePart(createdAt);
  if (datePart && timePart) return `${datePart} às ${timePart}`;
  return datePart || "—";
}

function formatDatePart(saleDate) {
  if (!saleDate) return null;
  const raw = String(saleDate).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function formatTimePart(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * WhatsApp da unidade pro rodape do cupom: mesmo numero que o robo usa
 * (franchises.phone_number quase sempre NULL na base - CLAUDE.md - entao o fallback real e
 * franchise_configurations.personal_phone_for_summary, o mesmo padrao do AsaasSetupPanel/
 * PurchaseOrders). Retorna ja formatado ("(14) 99663-7977") ou null.
 */
export function resolveUnitWhatsApp(franchise, config) {
  const raw = franchise?.phone_number || config?.personal_phone_for_summary || "";
  if (!raw) return null;
  const formatted = formatPhone(raw);
  return formatted || null;
}
