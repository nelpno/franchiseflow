import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const GROUP_ORDER = [
  "Canelone", "Conchiglione", "Massa", "Nhoque",
  "Fatiado", "Rondelli", "Sofioli", "Molho",
];

const STATUS_LABELS = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_rota: "Em Rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function groupItems(items, editedQuantities) {
  const groupMap = {};

  items.forEach((item) => {
    const qty = editedQuantities?.[item.id] ?? item.quantity ?? 0;
    if (qty <= 0) return;
    const firstWord = (item.product_name || "Outros").split(" ")[0];
    if (!groupMap[firstWord]) groupMap[firstWord] = { label: firstWord.toUpperCase(), items: [] };
    groupMap[firstWord].items.push({ ...item, finalQty: qty });
  });

  const groups = Object.values(groupMap);
  groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.label.charAt(0).toUpperCase() + a.label.slice(1).toLowerCase());
    const bi = GROUP_ORDER.indexOf(b.label.charAt(0).toUpperCase() + b.label.slice(1).toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  groups.forEach((g) => g.items.sort((a, b) => a.product_name.localeCompare(b.product_name)));
  return groups;
}

function formatCurrency(value) {
  if (value == null) return "---";
  return "R$ " + Number(value).toFixed(2).replace(".", ",");
}

function formatDate(dateStr) {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return String(dateStr);
  }
}

/**
 * Generates a printable A4 picking sheet PDF for a purchase order.
 */
export async function generatePickingSheet({ order, items, franchiseName, editedQuantities }) {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
  const applyPlugin = autoTableModule.default;
  if (typeof applyPlugin === "function") {
    try { applyPlugin(jsPDF); } catch (_) { /* already applied */ }
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 12;
  const usable = pageWidth - margin * 2;
  const shortId = order.id.slice(0, 8).toUpperCase();

  // ── Header ──────────────────────────────────────────────
  let y = margin;

  doc.setFontSize(22);
  doc.setTextColor(185, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.text("MAXI MASSAS", margin, y + 7);

  doc.setFontSize(13);
  doc.setTextColor(180, 148, 47);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE SEPARACAO", margin, y + 14);

  // Order ID right-aligned
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(`PED-${shortId}`, pageWidth - margin, y + 7, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${STATUS_LABELS[order.status] || order.status}`, pageWidth - margin, y + 13, { align: "right" });

  y += 20;

  // Separator line
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Info block — 2 columns
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const col2x = margin + usable / 2;

  doc.setFont("helvetica", "bold");
  doc.text("Franquia:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(franchiseName || "---", margin + 22, y);

  doc.setFont("helvetica", "bold");
  doc.text("Data do Pedido:", col2x, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(order.ordered_at), col2x + 36, y);

  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Previsao Entrega:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(order.estimated_delivery), margin + 40, y);

  doc.setFont("helvetica", "bold");
  doc.text("Impresso em:", col2x, y);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), col2x + 30, y);

  y += 8;

  // ── Items Table ─────────────────────────────────────────
  const groups = groupItems(items, editedQuantities);
  const tableBody = [];
  let seq = 0;
  let totalUnits = 0;
  let totalItems = 0;

  groups.forEach((group) => {
    // Group header row
    tableBody.push([
      { content: group.label, colSpan: 6, styles: { fillColor: [235, 235, 235], fontStyle: "bold", fontSize: 9, textColor: [60, 60, 60], halign: "left" } },
    ]);

    group.items.forEach((item) => {
      seq++;
      totalItems++;
      totalUnits += item.finalQty;
      tableBody.push([
        { content: String(seq), styles: { halign: "center", fontSize: 9 } },
        { content: item.product_name || "Produto sem nome", styles: { fontSize: 10 } },
        { content: String(item.finalQty), styles: { halign: "center", fontStyle: "bold", fontSize: 13 } },
        { content: "", styles: { halign: "center" } }, // Sep. checkbox
        { content: "", styles: { halign: "center" } }, // Conf. checkbox
        { content: "", styles: { fontSize: 8 } }, // Obs
      ]);
    });
  });

  const checkboxSize = 5;

  doc.autoTable({
    startY: y,
    head: [["#", "Produto", "Qtd", "Sep.", "Conf.", "Obs"]],
    body: tableBody,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: usable - 8 - 70 - 20 - 18 - 18 },
    },
    alternateRowStyles: { fillColor: [251, 249, 250] },
    showHead: "everyPage",
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index !== 3 && data.column.index !== 4) return;
      // Skip group header rows (raw array has 1 element with colSpan)
      const raw = data.row.raw;
      if (Array.isArray(raw) && raw.length === 1 && raw[0]?.colSpan) return;
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2;
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.rect(cx - checkboxSize / 2, cy - checkboxSize / 2, checkboxSize, checkboxSize);
    },
  });

  // ── Summary ─────────────────────────────────────────────
  let finalY = doc.lastAutoTable.finalY + 8;

  // Check if we need a new page for summary + signatures (~50mm)
  if (finalY > 250) {
    doc.addPage();
    finalY = margin;
  }

  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY - 2, pageWidth - margin, finalY - 2);

  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", margin, finalY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  finalY += 10;

  const totalValue = items.reduce((sum, item) => {
    const qty = editedQuantities?.[item.id] ?? item.quantity ?? 0;
    return sum + qty * (item.unit_price || 0);
  }, 0);

  doc.text(`Total de itens: ${totalItems}`, margin, finalY);
  doc.text(`Total de unidades: ${totalUnits}`, margin + 50, finalY);
  doc.text(`Valor total: ${formatCurrency(totalValue)}`, margin + 105, finalY);
  finalY += 5;

  if (order.freight_cost) {
    doc.text(`Frete: ${formatCurrency(order.freight_cost)}`, margin, finalY);
    doc.setFont("helvetica", "bold");
    doc.text(`Total com frete: ${formatCurrency(totalValue + Number(order.freight_cost))}`, margin + 50, finalY);
    doc.setFont("helvetica", "normal");
    finalY += 5;
  }

  if (order.notes) {
    finalY += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(`Obs: ${order.notes}`, usable);
    doc.text(noteLines, margin, finalY);
    finalY += noteLines.length * 4 + 2;
    doc.setFont("helvetica", "normal");
  }

  // ── Signature Block ─────────────────────────────────────
  finalY += 12;
  if (finalY > 265) {
    doc.addPage();
    finalY = margin + 10;
  }

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);

  const sigWidth = 65;
  const sig1x = margin + 10;
  const sig2x = pageWidth - margin - sigWidth - 10;

  doc.line(sig1x, finalY, sig1x + sigWidth, finalY);
  doc.text("Separado por", sig1x + sigWidth / 2, finalY + 5, { align: "center" });
  doc.text("Data: ___/___/______", sig1x + sigWidth / 2, finalY + 10, { align: "center" });

  doc.line(sig2x, finalY, sig2x + sigWidth, finalY);
  doc.text("Conferido por", sig2x + sigWidth / 2, finalY + 5, { align: "center" });
  doc.text("Data: ___/___/______", sig2x + sigWidth / 2, finalY + 10, { align: "center" });

  // ── Save ────────────────────────────────────────────────
  const dateStr = format(new Date(), "yyyyMMdd");
  doc.save(`Ficha_Separacao_${shortId}_${dateStr}.pdf`);
}
