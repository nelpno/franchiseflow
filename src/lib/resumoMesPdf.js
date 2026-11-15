import { format } from "date-fns";

// PDF de 1 página do "Resumo do mês" de Marketing (01/10/2026, Suzano e Itápolis pediram).
// Mesmo visual do relatório do mês (monthlyReportPdf.js). Helvetica do jsPDF só cobre Latin-1:
// nada de travessão, seta ou reticências no texto.
const MARCA = [185, 28, 28];
const OURO = [212, 175, 55];
const TINTA = [40, 40, 40];
const APAGADO = [110, 110, 110];

const latin1 = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[–—]/g, "-");

/**
 * @param {{linhas: Array<{texto: string}>, nomeUnidade: string, mesNome: string, chave: string,
 *          emAndamento: boolean, hoje?: Date}} p
 */
export async function gerarResumoMesPdf({ linhas, nomeUnidade, mesNome, chave, emAndamento, hoje = new Date() }) {
  const mod = await import("jspdf");
  const JsPDF = mod.jsPDF || mod.default;
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const larg = doc.internal.pageSize.getWidth();
  const m = 14;

  doc.setFillColor(...MARCA);
  doc.rect(0, 0, larg, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(latin1(`Resumo de ${mesNome}`), m, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(latin1(`${nomeUnidade}  ·  O que o anúncio e o robô trouxeram`), m, 19.5);
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(hoje, "dd/MM/yyyy")}`, larg - m, 19.5, { align: "right" });
  doc.setFillColor(...OURO);
  doc.rect(0, 26, larg, 1.2, "F");

  let y = 38;
  if (emAndamento) {
    doc.setTextColor(...APAGADO);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Mês em andamento: números até ${format(hoje, "dd/MM")}.`, m, y);
    y += 8;
  }

  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  for (const l of linhas) {
    doc.setFillColor(...MARCA);
    doc.circle(m + 1.5, y - 1.3, 1.1, "F");
    const partes = doc.splitTextToSize(latin1(l.texto), larg - 2 * m - 7);
    doc.text(partes, m + 6, y);
    y += partes.length * 5.5 + 3.5;
  }

  y += 4;
  doc.setTextColor(...APAGADO);
  doc.setFontSize(8.5);
  const notas = [
    "Quem veio do anúncio: o robô marca a pessoa quando ela chega pelo clique no anúncio.",
    "Venda que não foi lançada no painel não aparece aqui.",
  ];
  for (const n of notas) {
    const partes = doc.splitTextToSize(n, larg - 2 * m);
    doc.text(partes, m, y);
    y += partes.length * 4;
  }

  const slug = String(nomeUnidade || "unidade").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`Resumo_${slug}_${chave}.pdf`);
}
