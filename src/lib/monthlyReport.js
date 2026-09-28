import { format, getDate, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculatePnL, getSaleNetValue, getTopProducts, isInMonth } from "./financialCalcs.js";
import { getCategoryMeta } from "./expenseCategories.js";
import { getPaymentMethodLabel } from "./franchiseUtils.js";

/**
 * Relatório do mês para o franqueado — o mesmo número da tela Resultado, num arquivo só.
 *
 * Pedido da franqueada de Itápolis (11/09/2026): "um relatório com o total de vendas, lucro,
 * faturamento e mais vendidos no mês, num único relatório", comparando os meses. A tela já
 * mostrava tudo isso, mas um mês por vez e sem arquivo — o único botão exportava a lista de
 * vendas. Aqui não há consulta nova: sai dos mesmos dados que a tela já carregou, e o lucro
 * é o `calculatePnL`, para o PDF nunca discordar da tela.
 *
 * S17 (28/09/2026): a tela nova do Resultado (chave ui_v2) e o PDF saem do MESMO resumo por
 * mês (`resumirMes`). `montarResultadoMes` monta a tela e carrega junto o `relatorio` do PDF,
 * construído pelo mesmo `resumirMes` — uma fonte só, testada em monthlyReport.test.mjs.
 * Contrato do dinheiro: docs/claude/sobrou-no-mes.md.
 */
export const MESES_NO_RELATORIO = 3;
export const MESES_NO_GRAFICO = 6;

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function rotuloMesCurto(d) {
  return capitalizar(format(d, "MMM/yyyy", { locale: ptBR }).replace(".", ""));
}

export function rotuloMesLongo(d) {
  return capitalizar(format(d, "MMMM 'de' yyyy", { locale: ptBR }));
}

/** "agosto", "setembro" (minúsculo, para o meio da frase). */
export function nomeDoMes(d) {
  return format(d, "MMMM", { locale: ptBR });
}

const diaDoMes = (str) => parseInt(String(str || "").substring(8, 10), 10) || 0;
const num = (v) => parseFloat(v) || 0;
const dataVenda = (s) => s.sale_date || s.created_at;
const dataGasto = (e) => e.expense_date || e.created_at;

function quantidadesPorProduto(items) {
  const mapa = {};
  for (const si of items) {
    const nome = si.product_name || "Produto";
    mapa[nome] = (mapa[nome] || 0) + num(si.quantity);
  }
  return mapa;
}

// Forma de pagamento do robô antigo: "card_machine" = maquininha (crédito ou débito).
const rotuloPagamento = (m) => (m === "card_machine" ? "Maquininha" : m ? getPaymentMethodLabel(m) : "Não informado");

/**
 * Tudo de UM mês, a partir das linhas já carregadas. `ateDia` (mês corrente) acrescenta o
 * `trecho`: o mesmo cálculo só com o que tem data até esse dia, para comparar mês parcial com
 * o mesmo trecho do mês anterior.
 */
export function resumirMes(d, { sales = [], saleItems = [], expenses = [], ateDia = null } = {}) {
  const mSales = sales.filter((s) => isInMonth(dataVenda(s), d));
  const ids = new Set(mSales.map((s) => s.id));
  const mItems = saleItems.filter((si) => ids.has(si.sale_id));
  const mExp = expenses.filter((e) => isInMonth(dataGasto(e), d));
  const pnl = calculatePnL(mSales, mItems, mExp);

  const despesasPorCategoria = {};
  for (const e of mExp) {
    const rotulo = getCategoryMeta(e.category).label;
    despesasPorCategoria[rotulo] = (despesasPorCategoria[rotulo] || 0) + num(e.amount);
  }

  // De onde veio: robô × lançada à mão (sales.source) e formas de pagamento, em valor recebido.
  const porOrigem = { robo: { n: 0, valor: 0 }, manual: { n: 0, valor: 0 } };
  const pagamentos = {};
  for (const s of mSales) {
    const v = getSaleNetValue(s);
    const o = s.source === "bot" ? porOrigem.robo : porOrigem.manual;
    o.n += 1;
    o.valor += v;
    const rot = rotuloPagamento(s.payment_method);
    if (!pagamentos[rot]) pagamentos[rot] = { rotulo: rot, n: 0, valor: 0 };
    pagamentos[rot].n += 1;
    pagamentos[rot].valor += v;
  }
  const porPagamento = Object.values(pagamentos).sort((a, b) => b.valor - a.valor);

  // Para onde foi: pedido à fábrica (compra + frete, gerados sozinhos na entrega) numa linha;
  // o resto pela categoria; a taxa de cartão absorvida no fim. Soma = Saiu.
  const grupos = {};
  const pedidosFabrica = new Set();
  for (const e of mExp) {
    let chave;
    let rotulo;
    if (e.source === "purchase_order") {
      chave = "__fabrica__";
      rotulo = "Pedidos à fábrica";
      if (e.source_id) pedidosFabrica.add(e.source_id);
    } else {
      chave = e.category || "outros";
      rotulo = getCategoryMeta(e.category).label;
    }
    if (!grupos[chave]) grupos[chave] = { chave, rotulo, valor: 0, n: 0 };
    grupos[chave].valor += num(e.amount);
    grupos[chave].n += 1;
  }
  if (grupos.__fabrica__) grupos.__fabrica__.pedidos = pedidosFabrica.size;
  if (pnl.taxasCartao > 0) {
    grupos.__taxas__ = { chave: "__taxas__", rotulo: "Taxas de cartão", valor: pnl.taxasCartao, n: 0 };
  }
  const paraOndeFoi = Object.values(grupos).sort((a, b) => b.valor - a.valor);

  let trecho = null;
  if (ateDia) {
    const tSales = mSales.filter((s) => diaDoMes(dataVenda(s)) <= ateDia);
    const tIds = new Set(tSales.map((s) => s.id));
    const tExp = mExp.filter((e) => diaDoMes(dataGasto(e)) <= ateDia);
    const tPnl = calculatePnL(tSales, [], tExp);
    trecho = {
      faturamento: tSales.reduce((soma, s) => soma + getSaleNetValue(s), 0),
      sobrou: tPnl.lucroCaixa,
      quantidades: quantidadesPorProduto(mItems.filter((si) => tIds.has(si.sale_id))),
    };
  }

  return {
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
    // Todos os produtos do mês, pela mesma regra do card (Bragança, 28/09: vendas por produto).
    produtos: getTopProducts(mItems, Infinity),
    faturamentoAteDia: trecho ? trecho.faturamento : null,
    // S17 (tela nova)
    vendasBrutas: pnl.vendas,
    frete: pnl.freteCobrado,
    descontos: pnl.totalDescontos,
    entregas: mSales.filter((s) => num(s.delivery_fee) > 0).length,
    saiu: pnl.taxasCartao + pnl.outrasDespesas,
    porOrigem,
    porPagamento,
    paraOndeFoi,
    quantidades: quantidadesPorProduto(mItems),
    temDado: mSales.length > 0 || mExp.length > 0,
    trecho,
  };
}

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
    lista.push(resumirMes(subMonths(base, i), { sales, saleItems, expenses, ateDia: diaCorte }));
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

/**
 * S17.2 — o bloco do anúncio só entra no PDF quando o robô tem base para atribuir venda ao
 * anúncio: a mesma régua do card de Conversão (`has_bot_data` = 20+ pessoas falaram com o
 * robô no período). Sem base, "vendas que vieram do anúncio" sai perto de zero mesmo com
 * anúncio rodando (Santos: 4 pessoas no robô, 193 vendas manuais) e o PDF mentiria.
 * `funil` undefined = não deu para saber (o PDF avisa que o anúncio não carregou).
 */
export function anuncioComBase(anuncio, funil) {
  if (anuncio === undefined || funil === undefined) return undefined;
  if (!anuncio) return null;
  return funil?.has_bot_data === true ? anuncio : null;
}

// Data (yyyy-MM-dd) de um timestamptz como o banco a vê: o trigger da despesa do pedido usa
// `delivered_at::date` no fuso do banco (UTC). O PostgREST devolve o ISO com "+00:00", então
// os 10 primeiros caracteres já são a data UTC; com outro offset, converte.
function dataUtc(ts) {
  if (!ts) return null;
  const s = String(ts);
  if (/(\+00:00|Z)$/.test(s) || s.length <= 10) return s.substring(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.substring(0, 10) : d.toISOString().substring(0, 10);
}

// Dia (yyyy-MM-dd) de um timestamptz em Brasília — o mês em que a franqueada FEZ o pedido.
function diaEmBrasilia(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * S17.2 — "compra da fábrica ainda não lançada". A despesa do pedido à fábrica só nasce
 * quando o pedido vira "entregue" (trigger tr_po_generate_expenses: compra + frete, com a
 * data da entrega). Então, num mês em andamento, pedido já feito e ainda não entregue NÃO
 * está no Sobrou — e ele vai cair (medido 28/09: 18 pedidos "confirmado" na rede, ~5 dias
 * do pedido à entrega, 59 de 257 entregues noutro mês). Regra:
 *   - aCaminho: só no mês em andamento, pedidos que não estão "entregue" nem "cancelado" E
 *     que foram FEITOS (ordered_at, dia de Brasília) neste mês ou no anterior. Pedido aberto
 *     mais velho que isso é registro esquecido (não vai chegar) e não pode baixar o Sobrou de
 *     um mês que não é o dele (P3 S17; medido 28/09: 0 abertos anteriores a set/2026, todos
 *     os 18 são de 22 a 27/09 — a regra não esconde nenhum pedido real hoje);
 *     valor = total_amount + freight_cost (é o que a despesa vai somar: 249/258 batem).
 *   - semGasto: pedidos "entregue" com a data da entrega neste mês e sem NENHUMA despesa com
 *     source 'purchase_order' e source_id = pedido (1 caso em 120 dias; legado).
 * purchaseOrders null/undefined = não carregou → null (não afirma nada).
 */
export function avaliarComprasFabrica({ purchaseOrders, expenses = [], mesSelecionado, hoje = new Date() }) {
  if (!Array.isArray(purchaseOrders)) return null;
  const emAndamento = isSameMonth(startOfMonth(mesSelecionado), hoje);
  const comGasto = new Set(
    expenses.filter((e) => e.source === "purchase_order" && e.source_id).map((e) => e.source_id)
  );
  const valorPedido = (p) => num(p.total_amount) + num(p.freight_cost);
  const base = startOfMonth(mesSelecionado);
  const recente = (p) => {
    const dia = diaEmBrasilia(p.ordered_at);
    return !!dia && (isInMonth(dia, base) || isInMonth(dia, subMonths(base, 1)));
  };
  const aCaminhoLista = emAndamento
    ? purchaseOrders.filter((p) => p.status !== "entregue" && p.status !== "cancelado" && recente(p))
    : [];
  const semGastoLista = purchaseOrders.filter(
    (p) => p.status === "entregue" && !comGasto.has(p.id) && isInMonth(dataUtc(p.delivered_at), mesSelecionado)
  );
  const soma = (l) => l.reduce((s, p) => s + valorPedido(p), 0);
  if (!aCaminhoLista.length && !semGastoLista.length) return null;
  return {
    aCaminho: { n: aCaminhoLista.length, valor: soma(aCaminhoLista) },
    semGasto: { n: semGastoLista.length, valor: soma(semGastoLista) },
  };
}

/**
 * Modelo da tela nova do Resultado (S17.1, chave ui_v2) + o relatório do PDF (S17.2).
 * Comparação ("O que mudou" e o delta do Sobrou): no mês em andamento, contra o MESMO trecho
 * do mês anterior (até o mesmo dia); mês fechado, contra o mês anterior inteiro.
 */
export function montarResultadoMes({
  sales = [],
  saleItems = [],
  expenses = [],
  purchaseOrders = null,
  mesSelecionado,
  hoje = new Date(),
}) {
  const base = startOfMonth(mesSelecionado);
  const emAndamento = isSameMonth(base, hoje);
  const diaCorte = emAndamento ? getDate(hoje) : null;
  const dados = { sales, saleItems, expenses, ateDia: diaCorte };

  const mes = resumirMes(base, dados);
  const anteriorData = subMonths(base, 1);
  const anterior = resumirMes(anteriorData, dados);

  const sobrouAgora = emAndamento ? mes.trecho.sobrou : mes.lucroCaixa;
  const sobrouAntes = emAndamento ? anterior.trecho.sobrou : anterior.lucroCaixa;
  const diff = sobrouAgora - sobrouAntes;
  const comparacao = anterior.temDado
    ? {
        mesAnterior: nomeDoMes(anteriorData),
        agora: sobrouAgora,
        antes: sobrouAntes,
        diff,
        pct: sobrouAntes > 0 ? Math.round((diff / sobrouAntes) * 100) : null,
        mesmoTrecho: emAndamento,
      }
    : null;

  // O que mudou: produtos com a maior variação em unidades (mesmo trecho no mês corrente).
  const qAgora = emAndamento ? mes.trecho.quantidades : mes.quantidades;
  const qAntes = emAndamento ? anterior.trecho.quantidades : anterior.quantidades;
  const nomes = new Set([...Object.keys(qAgora), ...Object.keys(qAntes)]);
  const oQueMudou = anterior.temDado
    ? [...nomes]
        .map((nome) => ({ nome, antes: qAntes[nome] || 0, agora: qAgora[nome] || 0 }))
        .filter((p) => Math.abs(p.agora - p.antes) >= 2)
        .sort((a, b) => Math.abs(b.agora - b.antes) - Math.abs(a.agora - a.antes) || a.nome.localeCompare(b.nome))
        .slice(0, 3)
    : [];

  const deOndeVeio = [
    { chave: "vendas", rotulo: "Vendas", valor: mes.vendasBrutas, n: mes.vendas },
  ];
  if (mes.frete > 0) deOndeVeio.push({ chave: "frete", rotulo: "Frete cobrado", valor: mes.frete, n: mes.entregas });
  if (mes.descontos > 0) deOndeVeio.push({ chave: "descontos", rotulo: "Descontos dados", valor: -mes.descontos });

  // Quanto sobrou por mês (6 meses até o selecionado) e o acumulado do ano.
  const porMes = [];
  for (let i = MESES_NO_GRAFICO - 1; i >= 0; i--) {
    const d = subMonths(base, i);
    const r = i === 0 ? mes : i === 1 ? anterior : resumirMes(d, { sales, saleItems, expenses });
    porMes.push({ chave: r.chave, rotulo: format(d, "MMM", { locale: ptBR }).replace(".", ""), sobrou: r.lucroCaixa, temDado: r.temDado, atual: i === 0 });
  }
  const mesesDoAno = [];
  for (let m = 0; m <= base.getMonth(); m++) {
    const d = new Date(base.getFullYear(), m, 1);
    mesesDoAno.push(m === base.getMonth() ? mes : resumirMes(d, { sales, saleItems, expenses }));
  }
  const doAnoComDado = mesesDoAno.filter((r) => r.temDado);
  const ano = {
    ano: base.getFullYear(),
    total: mesesDoAno.reduce((s, r) => s + r.lucroCaixa, 0),
    mesesComDado: doAnoComDado.length,
    melhorMes: doAnoComDado.length >= 2 && mes.temDado && doAnoComDado.every((r) => r.lucroCaixa <= mes.lucroCaixa),
  };

  const relatorio = montarRelatorioMensal({ sales, saleItems, expenses, mesSelecionado: base, hoje });

  return {
    chave: mes.chave,
    nomeMes: nomeDoMes(base),
    emAndamento,
    diaCorte,
    mes,
    anterior,
    entrou: mes.faturamento,
    saiu: mes.saiu,
    sobrou: mes.lucroCaixa,
    comparacao,
    deOndeVeio,
    paraOndeFoi: mes.paraOndeFoi,
    maisVendidos: mes.maisVendidos,
    produtos: mes.produtos,
    oQueMudou,
    porMes,
    ano,
    avisoFabrica: avaliarComprasFabrica({ purchaseOrders, expenses, mesSelecionado: base, hoje }),
    relatorio,
  };
}
