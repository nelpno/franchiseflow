import { format, parseISO } from "date-fns";
import { getSaleNetValue } from "./financialCalcs.js";
import { getPaymentMethodLabel } from "./franchiseUtils.js";
import { sanitizeCSVCell } from "./csvSanitize.js";

const DELIVERY_LABEL = {
  delivery: "Entrega",
  pickup: "Retirada",
};

function formatDateBR(value) {
  if (!value) return "";
  try {
    const d = parseISO(String(value).substring(0, 10));
    return format(d, "dd/MM/yyyy");
  } catch {
    return "";
  }
}

function formatMoney(value) {
  const n = parseFloat(value) || 0;
  return n.toFixed(2).replace(".", ",");
}

/**
 * Definição única das colunas exportadas para vendas.
 * Importada por TabLancar (tela Vendas) e TabResultado (Gestão > Resultado).
 * Adicionar/renomear coluna aqui propaga para os dois exports automaticamente.
 */
export const SALES_EXPORT_COLUMNS = [
  { key: "sale_date", header: "Data" },
  { key: "customer", header: "Cliente" },
  { key: "payment_method", header: "Pagamento" },
  { key: "value", header: "Valor Bruto (R$)" },
  { key: "discount_amount", header: "Desconto (R$)" },
  { key: "delivery_fee", header: "Frete (R$)" },
  { key: "net_value", header: "Valor Recebido (R$)" },
  { key: "status", header: "Status" },
  { key: "delivery_method", header: "Tipo" },
  { key: "observacoes", header: "Observações" },
];

function resolveCustomerName(sale, contactsMap) {
  const contact = sale?.contact_id ? contactsMap?.[sale.contact_id] : null;
  const raw = contact?.nome || sale?.customer_name || "—";
  return sanitizeCSVCell(raw);
}

function buildRow(sale, contactsMap) {
  const value = parseFloat(sale?.value) || 0;
  const discount = parseFloat(sale?.discount_amount) || 0;
  const fee = parseFloat(sale?.delivery_fee) || 0;
  const net = getSaleNetValue(sale);

  return {
    sale_date: formatDateBR(sale?.sale_date || sale?.created_at),
    customer: resolveCustomerName(sale, contactsMap),
    payment_method: getPaymentMethodLabel(sale?.payment_method),
    value: formatMoney(value),
    discount_amount: formatMoney(discount),
    delivery_fee: formatMoney(fee),
    net_value: formatMoney(net),
    status: sale?.payment_confirmed ? "Recebido" : "Pendente",
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
    sale_date: "",
    customer: "TOTAL",
    payment_method: "",
    value: formatMoney(value),
    discount_amount: formatMoney(discount),
    delivery_fee: formatMoney(fee),
    net_value: formatMoney(net),
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
