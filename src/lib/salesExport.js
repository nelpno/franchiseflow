import { getSaleNetValue } from "./financialCalcs.js";
import { getPaymentMethodLabel } from "./franchiseUtils.js";
import { sanitizeCSVCell } from "./csvSanitize.js";

const DELIVERY_LABEL = {
  delivery: "Entrega",
  retirada: "Retirada",
  pickup: "Retirada",
};

// As linhas do export guardam o valor CRU (número, data, fração do dia) e cada coluna diz
// o seu `type`: o Excel recebe célula de número/data de verdade (soma, filtra e ordena sem
// "converter texto em número") e o PDF usa o `format` da coluna. Antes tudo saía como
// texto "12,50" e "05/09/2026" (S6.3, 28/09/2026).

// sale_date é DATE puro: vira meia-noite LOCAL, nunca `new Date("2026-09-05")` (UTC, que
// no Brasil cai no dia anterior).
function parseDateOnlyLocal(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Hora em que a venda foi lançada (created_at é TIMESTAMPTZ em UTC), fixada em
// America/Sao_Paulo para não depender do fuso do aparelho. Devolve a fração do dia
// (o formato de hora do Excel): 14:30 = 0,604166…
function timeFractionBR(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const min = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return (h * 60 + min) / 1440;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, "0");

export function formatExportDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatExportTime(fraction) {
  if (typeof fraction !== "number" || !Number.isFinite(fraction)) return "";
  const total = Math.round(fraction * 1440);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

export function formatExportMoney(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const formatText = (v) => (v == null ? "" : String(v));
const formatInt = (v) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/**
 * Definição única das colunas exportadas para vendas.
 * Importada por TabLancar (tela Vendas) e TabResultado (Gestão > Resultado, que o admin
 * também abre em Financeiro › Por unidade). Adicionar/renomear coluna aqui propaga para os
 * exports automaticamente. `type` ∈ date | time | int | brl | text.
 */
export const SALES_EXPORT_COLUMNS = [
  { key: "sale_date", header: "Data", type: "date", format: formatExportDate },
  { key: "hora", header: "Hora do lançamento", type: "time", format: formatExportTime },
  { key: "sale_number", header: "Nº Pedido", type: "int", format: formatInt },
  { key: "customer", header: "Cliente", type: "text", format: formatText },
  { key: "phone", header: "Telefone", type: "text", format: formatText },
  { key: "payment_method", header: "Pagamento", type: "text", format: formatText },
  { key: "value", header: "Valor Bruto (R$)", type: "brl", format: formatExportMoney },
  { key: "discount_amount", header: "Desconto (R$)", type: "brl", format: formatExportMoney },
  { key: "delivery_fee", header: "Frete (R$)", type: "brl", format: formatExportMoney },
  { key: "net_value", header: "Valor Recebido (R$)", type: "brl", format: formatExportMoney },
  { key: "status", header: "Status", type: "text", format: formatText },
  { key: "delivery_method", header: "Tipo", type: "text", format: formatText },
  { key: "observacoes", header: "Observações", type: "text", format: formatText },
];

/**
 * Colunas que a CONSULTA de vendas precisa trazer para o export sair completo. Sem
 * nº do pedido, nome e telefone do cliente no select o PostgREST omite o campo e a
 * planilha sai com Nº vazio e Cliente "—" em silêncio (era o caso do Resultado e do admin).
 */
export const SALES_EXPORT_QUERY_COLUMNS =
  "sale_number, customer_name, contact_phone, created_at, payment_confirmed, payment_method, delivery_method, observacoes";

function resolveCustomerName(sale, contactsMap) {
  const contact = sale?.contact_id ? contactsMap?.[sale.contact_id] : null;
  const raw = contact?.nome || sale?.customer_name || "—";
  return sanitizeCSVCell(raw);
}

function resolveCustomerPhone(sale, contactsMap) {
  const contact = sale?.contact_id ? contactsMap?.[sale.contact_id] : null;
  const raw = contact?.telefone || sale?.contact_phone || "";
  return sanitizeCSVCell(raw);
}

function buildRow(sale, contactsMap) {
  const saleNumber = Number(sale?.sale_number);
  return {
    sale_date: parseDateOnlyLocal(sale?.sale_date || sale?.created_at),
    hora: timeFractionBR(sale?.created_at),
    sale_number: sale?.sale_number != null && Number.isFinite(saleNumber) ? saleNumber : null,
    customer: resolveCustomerName(sale, contactsMap),
    phone: resolveCustomerPhone(sale, contactsMap),
    payment_method: getPaymentMethodLabel(sale?.payment_method),
    value: round2(parseFloat(sale?.value)),
    discount_amount: round2(parseFloat(sale?.discount_amount)),
    delivery_fee: round2(parseFloat(sale?.delivery_fee)),
    net_value: round2(getSaleNetValue(sale)),
    status: sale?.payment_confirmed ? "Recebido" : "A receber",
    delivery_method: DELIVERY_LABEL[sale?.delivery_method] || "—",
    observacoes: sanitizeCSVCell(sale?.observacoes || ""),
  };
}

function buildTotalsRow(sales) {
  let value = 0;
  let discount = 0;
  let fee = 0;
  let net = 0;
  for (const s of sales) {
    value += parseFloat(s?.value) || 0;
    discount += parseFloat(s?.discount_amount) || 0;
    fee += parseFloat(s?.delivery_fee) || 0;
    net += getSaleNetValue(s);
  }
  return {
    sale_date: null,
    hora: null,
    sale_number: null,
    customer: "TOTAL",
    phone: "",
    payment_method: "",
    value: round2(value),
    discount_amount: round2(discount),
    delivery_fee: round2(fee),
    net_value: round2(net),
    status: "",
    delivery_method: "",
    observacoes: "",
  };
}

/**
 * Monta as linhas de export prontas para `<ExportButtons>`.
 * Aceita tanto Map/objeto-indexado quanto array de contacts (converte internamente).
 */
export function buildSalesExportRows(sales, contactsMap = {}, options = {}) {
  const safeSales = Array.isArray(sales) ? sales : [];
  const map = Array.isArray(contactsMap)
    ? Object.fromEntries(contactsMap.map((c) => [c.id, c]))
    : contactsMap || {};

  const rows = safeSales.map((s) => buildRow(s, map));
  if (options.includeTotalsRow && safeSales.length > 0) {
    rows.push(buildTotalsRow(safeSales));
  }
  return rows;
}
