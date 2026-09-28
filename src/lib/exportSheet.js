// Monta a planilha do <ExportButtons>. Coluna com `type` vai CRUA para o Excel, com o
// formato de célula certo (número soma, data filtra); coluna sem `type` segue como antes
// (o texto do `format`). Separado do componente para testar em Node com o xlsx de verdade.

const CELL_FORMAT = {
  date: "dd/mm/yyyy",
  time: "hh:mm",
  money: "#,##0.00",
  int: "0",
};

function cellValue(col, raw) {
  if (!col.type || col.type === "text") {
    if (col.format) return col.format(raw);
    return raw ?? "";
  }
  if (col.type === "date") return raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : null;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function displayLength(col, raw) {
  const text = col.format ? col.format(raw) : raw;
  return String(text ?? "").length;
}

/**
 * @param XLSX módulo `xlsx` (import dinâmico no navegador, import normal no teste)
 * @param data linhas (objetos por `key`)
 * @param columns [{ key, header, type?, format? }]
 * @returns worksheet
 */
export function buildExportWorksheet(XLSX, data, columns) {
  const aoa = [
    columns.map((c) => c.header),
    ...data.map((row) => columns.map((col) => cellValue(col, row[col.key]))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  columns.forEach((col, c) => {
    const z = CELL_FORMAT[col.type];
    if (!z) return;
    for (let r = 1; r <= data.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v == null || cell.v === "") continue;
      cell.z = z;
    }
  });

  ws["!cols"] = columns.map((col) => ({
    wch: Math.max(col.header.length, ...data.map((r) => displayLength(col, r[col.key]))) + 2,
  }));
  return ws;
}
