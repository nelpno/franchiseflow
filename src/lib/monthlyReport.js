import { format, getDate, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculatePnL, getSaleNetValue, getTopProducts, isInMonth } from "./financialCalcs.js";
import { getCategoryMeta } from "./expenseCategories.js";

/**
 * Relatório do mês para o franqueado — o mesmo número da tela Resultado, num arquivo só.
 *
 * Pedido da franqueada de Itápolis (11/09/2026): "um relatório com o total de vendas, lucro,
 * faturamento e mais vendidos no mês, num único relatório", comparando os meses. A tela já
 * mostrava tudo isso, mas um mês por vez e sem arquivo — o único botão exportava a lista de
 * vendas. Aqui não há consulta nova: sai dos mesmos dados que a tela já carregou, e o lucro
 * é o `calculatePnL`, para o PDF nunca discordar da tela.
 */
export const MESES_NO_RELATORIO = 3;

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function rotuloMesCurto(d) {
  return capitalizar(format(d, "MMM/yyyy", { locale: ptBR }).replace(".", ""));
}

export function rotuloMesLongo(d) {
  return capitalizar(format(d, "MMMM 'de' yyyy", { locale: ptBR }));
}

const diaDoMes = (str) => parseInt(String(str || "").substring(8, 10), 10) || 0;

export function montarRelatorioMensal({
  sales = [],
  saleItems = [],
  expenses = [],
  mesSelecionado,
  hoje = new Date(),
  meses = MESES_NO_RELATORIO,
}) {
  const base = startOfMonth(mesSelecionado);
  const emAndamento = isSameMonth(base, hoje);
  // No mês corrente, comparar o mês inteiro dos anteriores com poucos dias deste faz
  // todo começo de mês parecer queda. A linha "até o dia X" é a comparação justa.
  const diaCorte = emAndamento ? getDate(hoje) : null;

  const lista = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = subMonths(base, i);
    const mSales = sales.filter((s) => isInMonth(s.sale_date || s.created_at, d));
    const ids = new Set(mSales.map((s) => s.id));
    const mItems = saleItems.filter((si) => ids.has(si.sale_id));
    const mExp = expenses.filter((e) => isInMonth(e.expense_date || e.created_at, d));
    const pnl = calculatePnL(mSales, mItems, mExp);

    const despesasPorCategoria = {};
    for (const e of mExp) {
      const rotulo = getCategoryMeta(e.category).label;
      despesasPorCategoria[rotulo] = (despesasPorCategoria[rotulo] || 0) + (parseFloat(e.amount) || 0);
    }

    lista.push({
      chave: format(d, "yyyy-MM"),
      rotulo: rotuloMesCurto(d),
      vendas: mSales.length,
      faturamento: pnl.totalRecebido,
      valorMedio: mSales.length ? pnl.totalRecebido / mSales.length : 0,
      clientes: new Set(mSales.map((s) => s.contact_id).filter(Boolean)).size,
      despesas: pnl.outrasDespesas,
      despesasPorCategoria,
      taxasCartao: pnl.taxasCartao,
      lucroCaixa: pnl.lucroCaixa,
      maisVendidos: getTopProducts(mItems, 5),
      faturamentoAteDia: diaCorte
        ? mSales
            .filter((s) => diaDoMes(s.sale_date || s.created_at) <= diaCorte)
            .reduce((soma, s) => soma + getSaleNetValue(s), 0)
        : null,
    });
  }

  // Categorias de despesa que aparecem em qualquer um dos meses, da maior para a menor.
  const totais = {};
  for (const m of lista) {
    for (const [rotulo, v] of Object.entries(m.despesasPorCategoria)) totais[rotulo] = (totais[rotulo] || 0) + v;
  }
  const categorias = Object.keys(totais).sort((a, b) => totais[b] - totais[a]);

  return { meses: lista, categorias, emAndamento, diaCorte };
}

/**
 * Bloco do anúncio a partir de `get_marketing_attribution` (uma linha por mês, ou null).
 * Devolve null quando não houve verba nem venda ligada a anúncio em nenhum dos meses —
 * unidade que não anuncia não ganha uma tabela de zeros.
 */
export function montarBlocoAnuncio(linhasPorMes) {
  const meses = (linhasPorMes || []).map((r) => ({
    verba: parseFloat(r?.verba_bruta) || 0,
    clientesNovos: parseInt(r?.clientes_novos_anuncio, 10) || 0,
    vendas: parseInt(r?.vendas_anuncio, 10) || 0,
    receita: parseFloat(r?.receita_anuncio) || 0,
  }));
  const temAlgo = meses.some((m) => m.verba > 0 || m.vendas > 0 || m.clientesNovos > 0);
  return temAlgo ? meses : null;
}
