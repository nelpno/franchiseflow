import { format } from "date-fns";
import { rotuloMesLongo } from "./monthlyReport.js";

// PDF de 1 página do relatório do mês. Fonte padrão do jsPDF (helvetica) só cobre Latin-1:
// acento sai certo, mas travessão, seta e reticências não — o texto aqui evita os três.
const MARCA = [185, 28, 28];
const OURO = [212, 175, 55];
const TINTA = [40, 40, 40];
const APAGADO = [110, 110, 110];

const brl = (v) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const negrito = (content, extra = {}) => ({ content, styles: { fontStyle: "bold", ...extra } });

async function carregarLibs() {
  const [jspdfModule, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF: jspdfModule.jsPDF || jspdfModule.default, autoTable: autoTableModule.default };
}

export async function gerarRelatorioMensalPdf({ relatorio, anuncio, nomeUnidade, mesSelecionado, hoje = new Date() }) {
  const { jsPDF, autoTable } = await carregarLibs();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const larg = doc.internal.pageSize.getWidth();
  const m = 14;
  const { meses, categorias, emAndamento, diaCorte } = relatorio;
  const cab = ["", ...meses.map((x) => x.rotulo)];

  // Cabeçalho
  doc.setFillColor(...MARCA);
  doc.rect(0, 0, larg, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Relatório do mês", m, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`${nomeUnidade}  ·  ${rotuloMesLongo(mesSelecionado)}`, m, 19.5);
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(hoje, "dd/MM/yyyy")}`, larg - m, 19.5, { align: "right" });
  doc.setFillColor(...OURO);
  doc.rect(0, 26, larg, 1.2, "F");

  let y = 34;
  if (emAndamento) {
    doc.setTextColor(...APAGADO);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text(`Mês em andamento: os números vão até hoje, dia ${diaCorte}.`, m, y);
    y += 5;
  }

  const secao = (titulo) => {
    doc.setTextColor(...MARCA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(titulo, m, y);
    y += 2.5;
  };
  const tabela = (opts) => {
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: "grid",
      styles: { fontSize: 8.8, cellPadding: 1.8, textColor: TINTA, lineColor: [225, 225, 225], lineWidth: 0.2 },
      headStyles: { fillColor: MARCA, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      didDrawPage: (d) => { y = d.cursor.y; },
      ...opts,
    });
    y += 7;
  };

  // 1. Resultado, mês a mês
  secao("Resultado");
  const linhas = [
    ["Vendas", ...meses.map((x) => inteiro(x.vendas))],
    [negrito("Faturamento"), ...meses.map((x) => negrito(brl(x.faturamento)))],
  ];
  if (emAndamento) {
    linhas.push([`Faturamento até o dia ${diaCorte}`, ...meses.map((x) => brl(x.faturamentoAteDia))]);
  }
  linhas.push(
    ["Valor médio por venda", ...meses.map((x) => brl(x.valorMedio))],
    ["Clientes diferentes", ...meses.map((x) => inteiro(x.clientes))],
  );
  for (const cat of categorias) {
    linhas.push([`Saiu: ${cat}`, ...meses.map((x) => (x.despesasPorCategoria[cat] ? brl(x.despesasPorCategoria[cat]) : "-"))]);
  }
  if (meses.some((x) => x.taxasCartao > 0)) {
    linhas.push(["Saiu: taxa de cartão", ...meses.map((x) => (x.taxasCartao ? brl(x.taxasCartao) : "-"))]);
  }
  const fundo = { fillColor: [250, 245, 230] };
  linhas.push([negrito("Lucro em caixa", fundo), ...meses.map((x) => negrito(brl(x.lucroCaixa), fundo))]);
  tabela({
    head: [cab],
    body: linhas,
    columnStyles: { 0: { cellWidth: 62 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // 2. Mais vendidos
  secao("Mais vendidos (em unidades)");
  const corpoTop = [];
  for (let i = 0; i < 5; i++) {
    const linha = meses.map((x) => {
      const p = x.maisVendidos[i];
      return p ? `${p.name} (${inteiro(p.quantity)})` : "";
    });
    if (linha.some(Boolean)) corpoTop.push(linha);
  }
  if (corpoTop.length) {
    tabela({ head: [meses.map((x) => x.rotulo)], body: corpoTop, styles: { fontSize: 8, cellPadding: 1.6, textColor: TINTA } });
  } else {
    y += 3;
  }

  // 3. Anúncio
  if (anuncio) {
    secao("Seu anúncio");
    tabela({
      head: [cab],
      body: [
        ["Verba paga", ...anuncio.map((a) => (a.verba ? brl(a.verba) : "-"))],
        ["Pessoas novas que vieram do anúncio", ...anuncio.map((a) => inteiro(a.clientesNovos))],
        ["Vendas para quem veio do anúncio", ...anuncio.map((a) => inteiro(a.vendas))],
        [negrito("Valor dessas vendas"), ...anuncio.map((a) => negrito(brl(a.receita)))],
      ],
      columnStyles: { 0: { cellWidth: 62 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  } else if (anuncio === undefined) {
    doc.setTextColor(...APAGADO);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text("Os números do anúncio não carregaram agora. Tente baixar de novo mais tarde.", m, y);
    y += 7;
  }

  // Como ler
  doc.setTextColor(...APAGADO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const notas = [
    "Lucro em caixa = o que entrou menos o que saiu no mês. Ele sobe e desce com a data da compra na fábrica.",
    "Vendas e despesas são as lançadas no painel. Venda que não foi lançada não aparece aqui.",
  ];
  if (anuncio) notas.push("Quem veio do anúncio: o robô marca a pessoa quando ela chega pelo clique no anúncio.");
  for (const n of notas) {
    const partes = doc.splitTextToSize(n, larg - 2 * m);
    doc.text(partes, m, y);
    y += partes.length * 3.8;
  }

  const slug = String(nomeUnidade || "unidade").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`Relatorio_${slug}_${format(mesSelecionado, "yyyy-MM")}.pdf`);
}
