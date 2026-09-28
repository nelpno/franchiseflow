// Despesas do mês (Gestão › Resultado): ordem da lista e planilha.
// Pedido da unidade de Ubatuba (28/09/2026): a lista saía na ordem do `id` (aleatória) e não
// havia como exportar. Ordem = data da despesa, mais recente primeiro; no mesmo dia, a lançada
// por último primeiro. A planilha usa o mesmo formato tipado da de vendas (número e data de verdade).
import { getCategoryMeta } from "./expenseCategories.js";
import { sanitizeCSVCell } from "./csvSanitize.js";
import { formatExportDate, formatExportMoney } from "./salesExport.js";

const ORIGEM = {
  manual: "Lançada à mão",
  purchase_order: "Pedido à fábrica",
  marketing_payment: "Verba de anúncio",
  external_purchase: "Compra externa",
  asaas_subscription: "Mensalidade",
};

function parseDateOnlyLocal(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Data/hora do lançamento em Brasília (created_at é UTC), como Date "local" para o Excel.
function lancadoEmBR(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}

export function sortExpenses(expenses) {
  return [...(expenses || [])].sort((a, b) => {
    const da = String(a?.expense_date || a?.created_at || "").slice(0, 10);
    const db = String(b?.expense_date || b?.created_at || "").slice(0, 10);
    if (da !== db) return db.localeCompare(da);
    return String(b?.created_at || "").localeCompare(String(a?.created_at || ""));
  });
}

const pad2 = (n) => String(n).padStart(2, "0");
const formatDateTime = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? `${formatExportDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : "";
const formatText = (v) => (v == null ? "" : String(v));

export const EXPENSES_EXPORT_COLUMNS = [
  { key: "expense_date", header: "Data", type: "date", format: formatExportDate },
  { key: "categoria", header: "Categoria", type: "text", format: formatText },
  { key: "descricao", header: "Descrição", type: "text", format: formatText },
  { key: "fornecedor", header: "Fornecedor", type: "text", format: formatText },
  { key: "origem", header: "Origem", type: "text", format: formatText },
  { key: "amount", header: "Valor (R$)", type: "brl", format: formatExportMoney },
  { key: "lancado_em", header: "Lançado em", type: "datetime", format: formatDateTime },
];

export function buildExpensesExportRows(expenses, { includeTotalsRow = false } = {}) {
  const ordered = sortExpenses(expenses);
  const rows = ordered.map((e) => ({
    expense_date: parseDateOnlyLocal(e?.expense_date || e?.created_at),
    categoria: getCategoryMeta(e?.category)?.label || formatText(e?.category),
    descricao: sanitizeCSVCell(e?.description || ""),
    fornecedor: sanitizeCSVCell(e?.supplier || ""),
    origem: ORIGEM[e?.source] || "",
    amount: Math.round((parseFloat(e?.amount) || 0) * 100) / 100,
    lancado_em: lancadoEmBR(e?.created_at),
  }));
  if (includeTotalsRow && rows.length > 0) {
    rows.push({
      expense_date: null, categoria: "TOTAL", descricao: "", fornecedor: "", origem: "",
      amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      lancado_em: null,
    });
  }
  return rows;
}
