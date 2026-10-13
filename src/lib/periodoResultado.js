// Período da tela Gestão › Resultado (versão nova, chave ui_v2), fora do JSX para testar.
// Testes: node src/lib/periodoResultado.test.mjs
//
// Pedido do Alex (13/10/2026): o dashboard antigo tinha "período total ou de tal a tal data" e
// a versão nova só andava mês a mês. Três modos:
//   - "mes": o de sempre (montarResultadoMes, com setas, comparação e PDF);
//   - "total": desde o primeiro lançamento da unidade até o fim do mês atual (o mês atual conta
//     inteiro, como no modo Mês: venda com data futura dentro do mês entra);
//   - "personalizado": de tal a tal data, as duas inclusive, fim até hoje.
// Fora do modo Mês não há comparação nem PDF (o PDF é por mês). A regra do dinheiro é a MESMA:
// o resumo sai de resumirLinhas (monthlyReport.js), o mesmo corpo de resumirMes.
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { linhasDeOndeVeio, resumirLinhas, resumirMes, rotuloMesCurto } from "./monthlyReport.js";
import { rotuloPeriodo } from "./periodoProdutos.js";

export const MODO_MES = "mes";
export const MODO_TOTAL = "total";
export const MODO_PERSONALIZADO = "personalizado";
// "Desde o início" busca sem piso real: a data mais antiga que a busca aceita.
export const INICIO_SEM_LIMITE = "2000-01-01";
// Barras do "Quanto sobrou por mês" num período longo: os últimos 12 meses dele.
export const MESES_NO_GRAFICO_PERIODO = 12;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA = "yyyy-MM-dd";
const diaDe = (str) => String(str || "").substring(0, 10);
const dataVenda = (s) => s.sale_date || s.created_at;
const dataGasto = (e) => e.expense_date || e.created_at;
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Mensagem para a tela quando o período de tal a tal data não serve; null quando está certo. */
export function validarIntervalo(de, ate, hoje = format(new Date(), DIA)) {
  if (!ISO.test(String(de ?? "")) || !ISO.test(String(ate ?? ""))) return "Escolha as duas datas.";
  if (ate < de) return "A data final vem antes da inicial.";
  if (ate > hoje) return "A data final não pode ser depois de hoje.";
  return null;
}

/**
 * Intervalo { de, ate } ('yyyy-MM-dd', inclusive) do período. null = período inválido.
 * @param {{ modo: string, de?: string, ate?: string }} periodo
 * @param {{ mes?: Date, hoje?: Date }} ctx  mes = mês em tela no modo Mês
 */
export function intervaloDoPeriodo(periodo, { mes = new Date(), hoje = new Date() } = {}) {
  const modo = periodo?.modo || MODO_MES;
  if (modo === MODO_MES) return { de: format(startOfMonth(mes), DIA), ate: format(endOfMonth(mes), DIA) };
  if (modo === MODO_TOTAL) return { de: INICIO_SEM_LIMITE, ate: format(endOfMonth(hoje), DIA) };
  if (modo === MODO_PERSONALIZADO) {
    return validarIntervalo(periodo.de, periodo.ate, format(hoje, DIA)) ? null : { de: periodo.de, ate: periodo.ate };
  }
  return null;
}

/** A janela já carregada ({ start, end }) cobre a necessária? */
export function intervaloCobre(carregado, necessario) {
  if (!carregado || !necessario) return false;
  return necessario.start >= carregado.start && necessario.end <= carregado.end;
}

/** União das duas janelas: a carga do Resultado nunca encolhe (mesma ideia de resultadoWindow). */
export function uniaoIntervalos(carregado, necessario) {
  if (!carregado) return { ...necessario };
  return {
    start: necessario.start < carregado.start ? necessario.start : carregado.start,
    end: necessario.end > carregado.end ? necessario.end : carregado.end,
  };
}

/** Vendas, itens e gastos com data dentro de [de, ate] (mesma régua do mês: o dia da data). */
export function recortarPeriodo({ sales = [], saleItems = [], expenses = [] } = {}, de, ate) {
  const dentro = (str) => {
    const d = diaDe(str);
    return !!d && d >= de && d <= ate;
  };
  const pSales = sales.filter((s) => dentro(dataVenda(s)));
  const ids = new Set(pSales.map((s) => s.id));
  return {
    sales: pSales,
    saleItems: saleItems.filter((si) => ids.has(si.sale_id)),
    expenses: expenses.filter((e) => dentro(dataGasto(e))),
  };
}

/**
 * Modelo da tela Resultado para "Desde o início"/"Personalizado", com os MESMOS campos que a
 * tela lê de montarResultadoMes. Sem comparação (comparacao null, oQueMudou vazio), sem aviso
 * do pedido à fábrica (é do mês em andamento) e sem relatorio (o PDF é por mês).
 */
export function montarResultadoPeriodo({ sales = [], saleItems = [], expenses = [], periodo, de, ate }) {
  const recorte = recortarPeriodo({ sales, saleItems, expenses }, de, ate);
  const r = resumirLinhas({ mSales: recorte.sales, mItems: recorte.saleItems, mExp: recorte.expenses });

  // "Desde o início" mostra a data do 1º lançamento, nunca o piso técnico da busca.
  const datas = [...recorte.sales.map((s) => diaDe(dataVenda(s))), ...recorte.expenses.map((e) => diaDe(dataGasto(e)))]
    .filter(Boolean)
    .sort();
  const primeiroDia = datas[0] || null;
  const total = periodo?.modo === MODO_TOTAL;
  const inicio = total ? primeiroDia : de;

  // Mês a mês dentro do período (mês da ponta entra só com os dias do período).
  const meses = [];
  if (inicio) {
    for (let d = startOfMonth(parseISO(inicio)); format(d, DIA) <= ate; d = addMonths(d, 1)) {
      const m = resumirMes(d, recorte);
      meses.push({ ...m, rotuloMes: format(d, "MMM", { locale: ptBR }).replace(".", "") });
    }
  }
  const noGrafico = meses.slice(-MESES_NO_GRAFICO_PERIODO);
  const porMes = noGrafico.map((m, i) => ({
    chave: m.chave,
    rotulo: m.rotuloMes,
    sobrou: m.lucroCaixa,
    temDado: m.temDado,
    atual: i === noGrafico.length - 1,
  }));
  const comDado = meses.filter((m) => m.temDado);
  const melhor = comDado.reduce((b, m) => (b === null || m.lucroCaixa > b.lucroCaixa ? m : b), null);

  const rotulo = total
    ? (primeiroDia ? `Desde ${br(primeiroDia)}` : "Desde o início")
    : rotuloPeriodo(de, ate);

  return {
    periodo: {
      modo: periodo?.modo,
      de: inicio || de,
      ate,
      rotulo,
      mesesNoGrafico: porMes.length,
      mesesNoPeriodo: meses.length,
    },
    // VendasPorProduto abre nestas datas (no lugar do mês).
    limites: { de: inicio || ate, ate },
    chave: null,
    nomeMes: null,
    emAndamento: false,
    diaCorte: null,
    mes: r,
    anterior: null,
    entrou: r.faturamento,
    saiu: r.saiu,
    sobrou: r.lucroCaixa,
    comparacao: null,
    deOndeVeio: linhasDeOndeVeio(r),
    paraOndeFoi: r.paraOndeFoi,
    maisVendidos: r.maisVendidos,
    produtos: r.produtos,
    oQueMudou: [],
    porMes,
    ano: {
      ano: null,
      total: r.lucroCaixa,
      mesesComDado: comDado.length,
      melhorMes: false,
      mesesAzul: comDado.filter((m) => m.lucroCaixa > 0).length,
      media: comDado.length ? comDado.reduce((s, m) => s + m.lucroCaixa, 0) / comDado.length : 0,
      melhor: melhor ? { rotulo: rotuloMesCurto(parseISO(`${melhor.chave}-01`)), valor: melhor.lucroCaixa } : null,
    },
    avisoFabrica: null,
    relatorio: null,
    recorte,
    temDado: r.temDado,
  };
}
