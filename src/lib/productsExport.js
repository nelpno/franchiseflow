// Vendas por produto no mês (Gestão › Resultado, tela nova S17, chave ui_v2).
// Pedido da unidade de Bragança (28/09/2026): "Temos um relatório de vendas por produto x
// período? Não encontrei". Mesma fonte do card "Mais vendidos": sale_items das vendas do mês
// (por sale_date), agrupados pelo nome do produto, ordenados por QUANTIDADE. Valor vendido =
// Σ quantidade × preço do item (sem frete e sem o desconto da venda, que não é por item).
// A planilha segue o formato tipado das outras (número de verdade no Excel).
import { sanitizeCSVCell } from "./csvSanitize.js";
import { formatExportMoney } from "./salesExport.js";

const formatText = (v) => (v == null ? "" : String(v));
const formatQtd = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : "";
const formatPct = (n) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "";

/** Lista completa [{ name, quantity, revenue, pct }] (pct = % do valor vendido). */
export function produtosComPercentual(produtos) {
  const total = (produtos || []).reduce((s, p) => s + (p.revenue || 0), 0);
  return (produtos || []).map((p) => ({ ...p, pct: total > 0 ? (p.revenue / total) * 100 : 0 }));
}

export function productsExportColumns(produtos) {
  const inteiros = (produtos || []).every((p) => Number.isInteger(p.quantity));
  return [
    { key: "produto", header: "Produto", type: "text", format: formatText },
    { key: "quantidade", header: "Quantidade", type: inteiros ? "int" : "brl", format: formatQtd },
    { key: "valor", header: "Valor vendido (R$)", type: "brl", format: formatExportMoney },
    { key: "pct", header: "% do total", type: "brl", format: formatPct },
  ];
}

export function buildProductsExportRows(produtos, { includeTotalsRow = false } = {}) {
  const lista = produtosComPercentual(produtos);
  const r2 = (n) => Math.round(n * 100) / 100;
  const rows = lista.map((p) => ({
    produto: sanitizeCSVCell(p.name || "Produto"),
    quantidade: Math.round(p.quantity * 1000) / 1000,
    valor: r2(p.revenue),
    pct: r2(p.pct),
  }));
  if (includeTotalsRow && rows.length > 0) {
    rows.push({
      produto: "TOTAL",
      quantidade: Math.round(lista.reduce((s, p) => s + p.quantity, 0) * 1000) / 1000,
      valor: r2(lista.reduce((s, p) => s + p.revenue, 0)),
      pct: 100,
    });
  }
  return rows;
}
