/**
 * Regras puras do comprovante de venda (SaleReceipt) - S13.1, 28/09/2026.
 * Fica separado do componente para poder ser testado sem React nem DOM
 * (node src/lib/receiptUtils.test.mjs).
 */
import { formatPhone } from "./whatsappUtils.js";

/** string não-vazia após trim, ou null. Usado em TODA leitura de endereço (P3 item 7: campo
 * salvo só com espaço não pode contar como "tem endereço"). */
function nonEmptyTrim(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/**
 * Classifica a venda em "delivery" | "retirada" | "unknown". Valores reais em
 * `sales.delivery_method` (medido 28/09/2026, 90d): só "delivery"/"retirada", 0 nulos —
 * "pickup" cobre exportações antigas (salesExport.js já tratava os 3). Venda LEGADA sem
 * delivery_method nenhum (achado do P3, 28/09/2026) NÃO pode virar "retirada" por default —
 * isso inventava um dado que a venda não tem. Em vez disso, infere pelo sinal que ela TEM:
 * frete cobrado ou endereço de entrega preenchido → é entrega; sem nenhum dos dois, fica
 * "unknown" (nem entrega nem retirada — o cupom não mostra selo nenhum nesse caso).
 */
export function classifyDeliveryType(sale) {
  const dm = sale?.delivery_method;
  if (dm === "delivery") return "delivery";
  if (dm === "retirada" || dm === "pickup") return "retirada";

  const frete = parseFloat(sale?.delivery_fee) || 0;
  const enderecoDaVenda = nonEmptyTrim(sale?.customer_address);
  if (frete > 0 || enderecoDaVenda) return "delivery";
  return "unknown";
}

export function isDeliverySale(sale) {
  return classifyDeliveryType(sale) === "delivery";
}

/** "Entrega" ou "Retirada", explícito no cupom (nunca "loja"); null quando a venda é legada
 * demais pra saber (sem delivery_method, sem frete, sem endereço) — nesse caso não imprime
 * selo nenhum em vez de inventar um. */
export function resolveDeliveryLabel(sale) {
  const tipo = classifyDeliveryType(sale);
  if (tipo === "delivery") return "Entrega";
  if (tipo === "retirada") return "Retirada";
  return null;
}

/**
 * Endereco do cliente para o cupom: a VENDA primeiro (sales.customer_address/
 * customer_neighborhood, que o robo grava desde 28/09 - S4.2), depois o contato "vivo"
 * (contacts.endereco/bairro - cobre venda manual antiga sem o campo). Nunca mistura rua de
 * uma fonte com bairro de outra (evita "Rua X - bairro que nao e dela"). Ambas as fontes
 * passam por trim (P3 item 7): string só com espaço conta como vazia.
 * Retorna null quando a venda NÃO é entrega (retirada, ou legada sem sinal nenhum — o cliente
 * não precisa de endereço); quando É entrega sem endereço nenhum, sinaliza `missing`.
 */
export function resolveReceiptAddress({ sale, contact } = {}) {
  if (!isDeliverySale(sale)) return null;

  const enderecoDaVenda = nonEmptyTrim(sale?.customer_address);
  if (enderecoDaVenda) {
    return { address: enderecoDaVenda, neighborhood: nonEmptyTrim(sale?.customer_neighborhood), missing: false };
  }
  const enderecoDoContato = nonEmptyTrim(contact?.endereco);
  if (enderecoDoContato) {
    return { address: enderecoDoContato, neighborhood: nonEmptyTrim(contact?.bairro), missing: false };
  }
  return { address: null, neighborhood: null, missing: true };
}

/** Linha pronta pra exibir na coluna de endereco, ou o aviso de faltante. */
export const ENDERECO_NAO_INFORMADO = "ENDEREÇO NÃO INFORMADO";

export function formatReceiptAddressLine({ sale, contact } = {}) {
  const resolved = resolveReceiptAddress({ sale, contact });
  if (!resolved) return null; // retirada (ou legado sem sinal): sem linha de endereco
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
 * WhatsApp PÚBLICO da unidade pro rodapé do cupom: SÓ `franchises.whatsapp_publico`
 * (S13.2, 28/09/2026) = o número do robô da unidade no Zuck, o mesmo com que o cliente já
 * conversa. 53 de 66 unidades preenchidas (robô conectado); sem valor, a linha não aparece.
 * NUNCA `franchise_configurations.personal_phone_for_summary` (celular PESSOAL do dono, P3 da
 * S13) nem `franchises.phone_number` (é o número que o CS usa para chamar a franqueada;
 * se um dia for preenchido com o celular dela, vazaria no cupom).
 */
export function resolveUnitWhatsApp(franchise) {
  const raw = franchise?.whatsapp_publico || "";
  if (!raw) return null;
  const formatted = formatPhone(raw);
  return formatted || null;
}
