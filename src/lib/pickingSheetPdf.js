import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const GROUP_ORDER = [
  "Canelone", "Conchiglione", "Massa", "Nhoque",
  "Fatiado", "Rondelli Fatiado", "Rondelli Rolo", "Sofioli", "Molho",
];

function getGroupKey(productName) {
  const name = productName || "Outros";
  const words = name.split(" ");
  if (words[0].toLowerCase() === "rondelli") {
    const lower = name.toLowerCase();
    if (lower.includes("fatiado")) return "Rondelli Fatiado";
    if (lower.includes("rolo")) return "Rondelli Rolo";
    return "Rondelli";
  }
  return words[0];
}

function groupItems(items, editedQuantities) {
  const groupMap = {};
  items.forEach((item) => {
    const qty = Number(editedQuantities?.[item.id] ?? item.quantity ?? 0);
    if (!qty || qty <= 0) return;
    const key = getGroupKey(item.product_name);
    if (!groupMap[key]) groupMap[key] = { label: key.toUpperCase(), items: [] };
    groupMap[key].items.push({ ...item, finalQty: qty });
  });
  const groups = Object.values(groupMap);
  groups.sort((a, b) => {
    const normalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const labelA = a.label.split(" ").map(normalize).join(" ");
    const labelB = b.label.split(" ").map(normalize).join(" ");
    const ai = GROUP_ORDER.indexOf(labelA);
    const bi = GROUP_ORDER.indexOf(labelB);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  groups.forEach((g) => g.items.sort((a, b) => a.product_name.localeCompare(b.product_name)));
  return groups;
}

function fmtBRL(v) {
  if (v == null) return "---";
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function fmtDate(d) {
  if (!d) return "---";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return String(d); }
}

function getDisplayName(productName) {
  if (productName && productName.includes("Fatiado") && !productName.startsWith("Fatiado")) {
    return "Fatiado " + productName.replace(/\s*Fatiado\s*/, " ").trim();
  }
  return productName;
}

/**
 * Compact A4 picking sheet — designed to fit on a single page.
 */
export async function generatePickingSheet({ order, items, franchiseName, editedQuantities }) {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const m = 8; // tight margins
  const usable = pw - m * 2;
  const shortId = order.id.slice(0, 8).toUpperCase();

  // ── Header — brand + PED on line 1, subtitle on line 2 ──
  let y = m;
  doc.setFontSize(18);
  doc.setTextColor(185, 28, 28);
  doc.setFont("helvetica", "bold");
  const brandLabel = franchiseName ? franchiseName.toUpperCase() : "MAXI MASSAS";
  doc.text(brandLabel, m, y + 5);

  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(`PED-${shortId}`, pw - m, y + 5, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(140, 110, 50);
  doc.setFont("helvetica", "normal");
  doc.text("FICHA DE SEPARACAO", m, y + 11);

  y += 15;
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.6);
  doc.line(m, y, pw - m, y);
  y += 4;

  // ── Info — 1 compact line ─────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(franchiseName || "---", m, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const infoRight = `Pedido: ${fmtDate(order.ordered_at)}    Entrega: ${fmtDate(order.estimated_delivery)}`;
  doc.text(infoRight, pw - m, y, { align: "right" });

  y += 5;

  // ── Items Table ───────────────────────────────────────
  const groups = groupItems(items, editedQuantities);
  const tableBody = [];
  let totalUnits = 0;
  let totalItems = 0;
  let totalValue = 0;

  groups.forEach((group) => {
    // Group separator — thin gray row
    tableBody.push([
      { content: group.label, colSpan: 5, styles: { fillColor: [230, 230, 230], fontStyle: "bold", fontSize: 7.5, textColor: [100, 100, 100], cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 } } },
    ]);

    group.items.forEach((item) => {
      totalItems++;
      totalUnits += item.finalQty;
      totalValue += item.finalQty * Number(item.unit_price || 0);
      tableBody.push([
        "", // Sep checkbox
        getDisplayName(item.product_name) || "---",
        String(item.finalQty),
        "", // Conf checkbox
        fmtBRL(item.unit_price),
      ]);
    });
  });

  const chk = 3.5; // checkbox size

  autoTable(doc, {
    startY: y,
    head: [["SEP", "PRODUTO", "QTD", "CONF", "UNIT"]],
    body: tableBody,
    styles: {
      fontSize: 9,
      cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" }, // Sep checkbox
      1: { cellWidth: usable - 14 - 16 - 14 - 18, fontSize: 10 }, // Produto
      2: { cellWidth: 16, halign: "center", fontStyle: "bold", fontSize: 10 }, // QTD
      3: { cellWidth: 14, halign: "center" }, // Conf checkbox
      4: { cellWidth: 18, halign: "right", fontSize: 10 }, // Unit price
    },
    alternateRowStyles: { fillColor: [248, 247, 247] },
    showHead: "everyPage",
    margin: { left: m, right: m },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index !== 0 && data.column.index !== 3) return;
      const raw = data.row.raw;
      if (Array.isArray(raw) && raw.length === 1 && raw[0]?.colSpan) return;
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2;
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.25);
      doc.rect(cx - chk / 2, cy - chk / 2, chk, chk);
    },
  });

  // ── Footer ────────────────────────────────────────────
  const tableEnd = doc.lastAutoTable || doc.previousAutoTable;
  let fy = (tableEnd ? tableEnd.finalY : y + 20) + 4;

  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.4);
  doc.line(m, fy, pw - m, fy);
  fy += 4;

  // Totals — single line
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  let summary = `${totalItems} itens  |  ${totalUnits} un  |  ${fmtBRL(totalValue)}`;
  if (order.freight_cost && Number(order.freight_cost) > 0) {
    summary += `  |  Frete: ${fmtBRL(order.freight_cost)}  |  Total: ${fmtBRL(totalValue + Number(order.freight_cost))}`;
  }
  doc.text(summary, m, fy);

  if (order.notes) {
    fy += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(doc.splitTextToSize(`Obs: ${order.notes}`, usable), m, fy);
    fy += 4;
  }

  // Signatures — compact, inline
  fy += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);

  const sig1 = m + 5;
  const sig2 = pw / 2 + 10;
  const sw = 55;

  doc.line(sig1, fy, sig1 + sw, fy);
  doc.text("Separado por", sig1, fy + 4);

  doc.line(sig2, fy, sig2 + sw, fy);
  doc.text("Conferido por", sig2, fy + 4);

  // ── Save ──────────────────────────────────────────────
  const dateStr = format(new Date(), "yyyyMMdd");
  doc.save(`Ficha_Separacao_${shortId}_${dateStr}.pdf`);
}
