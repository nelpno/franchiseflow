import React from "react";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";

/**
 * ExportButtons — exports data to Excel (.xlsx) or PDF.
 *
 * Props:
 *   data      – array of objects
 *   columns   – [{ key, header, format? }]
 *   filename  – base filename (no extension)
 *   title     – PDF header title
 */
export default function ExportButtons({ data, columns, filename, title }) {
  const handleExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const { saveAs } = await import("file-saver");

      const rows = data.map((row) =>
        columns.reduce((acc, col) => {
          acc[col.header] = col.format ? col.format(row[col.key]) : row[col.key];
          return acc;
        }, {})
      );

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");

      // Auto-size columns
      const colWidths = columns.map((col) => ({
        wch: Math.max(
          col.header.length,
          ...data.map((r) => String(col.format ? col.format(r[col.key]) : r[col.key] ?? "").length)
        ) + 2,
      }));
      ws["!cols"] = colWidths;

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar Excel:", err);
      toast.error("Erro ao exportar Excel.");
    }
  };

  const handlePdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });

      // Header
      doc.setFontSize(18);
      doc.setTextColor(185, 28, 28); // #b91c1c
      doc.text("Maxi Massas", 14, 18);

      doc.setFontSize(12);
      doc.setTextColor(83, 67, 67); // #534343
      doc.text(title || filename, 14, 26);

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 32);

      // Table
      const head = [columns.map((c) => c.header)];
      const body = data.map((row) =>
        columns.map((col) => (col.format ? col.format(row[col.key]) : row[col.key] ?? ""))
      );

      doc.autoTable({
        startY: 38,
        head,
        body,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [185, 28, 28],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [251, 249, 250] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${filename}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      toast.error("Erro ao exportar PDF.");
    }
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        className="gap-1.5 text-[#534343] hover:text-[#16a34a] hover:border-[#16a34a]/30 rounded-xl text-xs"
      >
        <MaterialIcon icon="download" size={16} />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        className="gap-1.5 text-[#534343] hover:text-[#b91c1c] hover:border-[#b91c1c]/30 rounded-xl text-xs"
      >
        <MaterialIcon icon="picture_as_pdf" size={16} />
        PDF
      </Button>
    </div>
  );
}
