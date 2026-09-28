// S18.1 (28/09/2026): números da Início nova (chave ui_v2), fora do JSX para testar.
// Testes: node src/lib/inicioMes.test.mjs
//
// - "O mês — você contra você": faturamento do mês até HOJE (Brasília) contra o MESMO trecho do
//   mês anterior (dia 1 até o mesmo dia) + ritmo × mediana dos 3 meses anteriores. Sai do MESMO
//   resumo do Resultado e do PDF (`resumirMes`, monthlyReport.js) — nada de recalcular
//   faturamento aqui. Faturamento = getSaleNetValue (value − desconto + frete). Venda com data
//   depois de hoje fica fora do "até hoje" (o `trecho` corta pelo dia).
// - Meta do dia e dias seguidos: a meta de um dia = média dos 30 dias ANTERIORES a ele (uma
//   linha de daily_summaries por data, dias sem venda contam como zero) + 10%, com pelo menos 7
//   dias de base. Cada dia passado é comparado com a meta DAQUELE dia — até 28/09 a sequência
//   comparava todos os dias passados com a meta de hoje (defeito corrigido para todas as
//   unidades, com a chave ligada ou não: RankingStreak.jsx usa diasSeguidosBatendoMeta).
// - Evolução: faturamento por mês, 6 meses, sempre pelas vendas (nunca daily_summaries).
// - A receber: o MESMO recorte da caixa "A receber" da tela Vendas (6 meses, vendasAReceber).
import { format, getDate, getDaysInMonth, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSaleNetValue } from "./financialCalcs.js";
import { nomeDoMes, resumirMes } from "./monthlyReport.js";
import { dataCivilBRT } from "./subscriptionStatus.js";
import { vendasAReceber } from "./vendasLista.js";

export const MESES_MEDIANA = 3;
// Projeção antes de uma semana fechada é chute (dia 2 × 30): só a partir de 7 dias completos.
export const DIAS_MIN_RITMO = 7;
// Percentual com base pequena engana (R$ 40 → R$ 400 = "+900%"): abaixo disso só os reais.
export const PISO_PCT = 500;
// "Faltam R$ X por dia" só quando é alcançável: até 1,5× o que ela vem vendendo por dia. Acima
// disso o número desanima (Itápolis em 28/09: faltariam R$ 929/dia vendendo ~R$ 104/dia) e o
// próximo passo vira uma ação concreta de hoje.
export const FOLGA_ALCANCAVEL = 1.5;
export const MESES_EVOLUCAO = 6;
// Mesmo recorte da tela Vendas (SALES_LOOKBACK_MONTHS em src/pages/Vendas.jsx).
export const MESES_A_RECEBER = 6;

export const JANELA_META_DIAS = 30;
export const MIN_DIAS_META = 7;
export const FATOR_META = 1.1;
export const MAX_DIAS_SEQUENCIA = 90;
// Linhas de daily_summaries para avaliar a sequência inteira: cada dia precisa dos 30 anteriores.
export const RESUMOS_PARA_SEQUENCIA = MAX_DIAS_SEQUENCIA + JANELA_META_DIAS;

const DIA = "yyyy-MM-dd";
const fmt = (d) => format(d, DIA);
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Hoje em Brasília: `data` (meia-noite local daquele dia civil) e `str` 'yyyy-MM-dd'. */
export function hojeBrasilia(agora = new Date()) {
  const data = dataCivilBRT(agora);
  return { data, str: fmt(data) };
}

function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/**
 * O mês até hoje × o mesmo trecho do mês anterior, ritmo e mediana dos 3 meses anteriores.
 * `sales` precisa cobrir do 1º dia do 3º mês anterior em diante (a Início já carrega isso).
 * `hoje` = data civil de Brasília (hojeBrasilia().data).
 */
export function montarInicioMes({ sales = [], hoje = dataCivilBRT() } = {}) {
  const base = startOfMonth(hoje);
  const dia = getDate(hoje);
  const diasNoMes = getDaysInMonth(hoje);
  const mes = resumirMes(base, { sales, ateDia: dia });
  const antData = subMonths(base, 1);
  const anterior = resumirMes(antData, { sales, ateDia: dia });

  const faturamento = mes.trecho.faturamento;
  const vendas = mes.trecho.vendas;

  // Sem venda no mês anterior não há com quem comparar (unidade nova ou parada).
  let comparacao = null;
  if (anterior.vendas > 0) {
    const antes = anterior.trecho.faturamento;
    const diff = faturamento - antes;
    comparacao = {
      mesAnterior: nomeDoMes(antData),
      antes,
      diff,
      pct: antes >= PISO_PCT ? Math.round((diff / antes) * 100) : null,
      // dia 31 contra um mês de 30 dias: o "mesmo trecho" é o mês anterior inteiro
      mesInteiro: dia >= getDaysInMonth(antData),
    };
  }

  // Mediana: só com os 3 meses com venda (mês sem venda = unidade ainda não abria).
  const anteriores = Array.from({ length: MESES_MEDIANA }, (_, i) => resumirMes(subMonths(base, i + 1), { sales }));
  const medianaValor = anteriores.every((m) => m.vendas > 0) ? mediana(anteriores.map((m) => m.faturamento)) : null;

  // Ritmo pelos dias FECHADOS (até ontem); hoje entra pelo que já vendeu.
  let ritmo = null;
  const diasFechados = dia - 1;
  if (diasFechados >= DIAS_MIN_RITMO) {
    const ateOntem = resumirMes(base, { sales, ateDia: diasFechados }).trecho.faturamento;
    if (ateOntem > 0) {
      const porDia = ateOntem / diasFechados;
      ritmo = { porDia, projecao: faturamento + porDia * (diasNoMes - dia) };
    }
  }

  let paraMediana = null;
  if (medianaValor !== null) {
    const falta = medianaValor - faturamento;
    const diasRestantes = diasNoMes - dia + 1; // hoje ainda conta
    // referência de "quanto ela vende por dia": o ritmo do mês ou, na 1ª semana, a mediana/dia
    const referencia = ritmo ? ritmo.porDia : medianaValor / diasNoMes;
    const porDia = falta / diasRestantes;
    paraMediana = falta > 0
      ? { falta, diasRestantes, porDia, alcancavel: porDia <= referencia * FOLGA_ALCANCAVEL }
      : { falta: 0, passou: -falta };
  }

  return {
    nomeMes: nomeDoMes(base),
    dia,
    diasNoMes,
    faturamento,
    vendas,
    valorMedio: vendas ? faturamento / vendas : 0,
    // vendas deste mês com data depois de hoje (não entram no "até hoje")
    depoisDeHoje: mes.vendas - vendas,
    comparacao,
    mediana: medianaValor,
    mesesMediana: anteriores.map((m) => ({ chave: m.chave, faturamento: m.faturamento, vendas: m.vendas })),
    ritmo,
    paraMediana,
  };
}

/** "perto de R$ X": centenas a partir de R$ 1.000, dezenas abaixo. */
export function arredondarPerto(v) {
  const n = Number(v) || 0;
  return Math.abs(n) >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10;
}

/**
 * Textos do cartão do mês (tom de cuidado: comparar com ela mesma e mostrar o próximo passo).
 * `brl` = formatador de reais (a tela passa formatBRLInteger).
 */
export function textosInicioMes(m, brl) {
  if (!m) return null;
  const titulo = `${capitalizar(m.nomeMes)} até hoje`;
  const c = m.comparacao;

  // Sem venda ainda no mês o selo seria "−100%" no dia 2: não diz nada útil, só desanima.
  let selo = null;
  if (c && c.pct !== null && m.vendas > 0) {
    if (c.pct === 0) selo = { texto: `igual a ${c.mesAnterior}`, tom: "neutro" };
    else selo = { texto: `${c.pct > 0 ? "+" : "−"}${Math.abs(c.pct)}% que ${c.mesAnterior}`, tom: c.pct > 0 ? "ok" : "atencao" };
  }

  let comparacao = null;
  if (c) {
    comparacao = c.mesInteiro
      ? `Até o dia ${m.dia}: ${brl(m.faturamento)}, contra ${brl(c.antes)} em ${c.mesAnterior} inteiro.`
      : `Até o dia ${m.dia}: ${brl(m.faturamento)}, contra ${brl(c.antes)} no mesmo trecho de ${c.mesAnterior}.`;
  }

  let ritmo = null;
  if (m.ritmo && m.mediana !== null) {
    ritmo = `No ritmo de agora, ${m.nomeMes} fecha perto de ${brl(arredondarPerto(m.ritmo.projecao))}. Sua mediana dos últimos 3 meses é ${brl(m.mediana)}.`;
  } else if (m.ritmo) {
    ritmo = `No ritmo de agora, ${m.nomeMes} fecha perto de ${brl(arredondarPerto(m.ritmo.projecao))}.`;
  } else if (m.mediana !== null) {
    ritmo = `Sua mediana dos últimos 3 meses é ${brl(m.mediana)}.`;
  }

  // P3 S18 #8: cada mensagem leva o seu tom — "ok" (conquista, verde) ou "acao" (próximo passo).
  let proximoPasso = null;
  const p = m.paraMediana;
  if (p && p.falta > 0 && p.alcancavel) {
    proximoPasso = {
      tom: "acao",
      texto: p.diasRestantes > 1
        ? `Para chegar na sua mediana faltam ${brl(p.falta)}: cerca de ${brl(Math.ceil(p.porDia))} por dia até o fim do mês.`
        : `Para chegar na sua mediana faltam ${brl(p.falta)} hoje.`,
    };
  } else if (p && p.falta > 0) {
    proximoPasso = { tom: "acao", texto: "Um bom próximo passo para hoje: chamar os clientes do “Quem chamar hoje”, aqui na Início." };
  } else if (p && p.passou >= 0 && m.faturamento > 0) {
    proximoPasso = { tom: "ok", texto: "Você já passou da sua mediana dos últimos 3 meses. Parabéns!" };
  }

  return { titulo, selo, comparacao, ritmo, proximoPasso };
}

/** Faturamento por mês (o mês atual até hoje), do mais antigo para o atual. */
export function montarEvolucao({ sales = [], hoje = dataCivilBRT(), meses = MESES_EVOLUCAO } = {}) {
  const base = startOfMonth(hoje);
  const dia = getDate(hoje);
  const lista = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = subMonths(base, i);
    const atual = i === 0;
    const r = resumirMes(d, { sales, ateDia: atual ? dia : null });
    lista.push({
      chave: r.chave,
      rotulo: format(d, "MMM", { locale: ptBR }).replace(".", ""),
      valor: atual ? r.trecho.faturamento : r.faturamento,
      vendas: atual ? r.trecho.vendas : r.vendas,
      atual,
    });
  }
  return lista;
}

/**
 * Junta listas de vendas sem repetir (mesmo id): a PRIMEIRA lista ganha. A janela principal e o
 * histórico não se cruzam, mas na virada do mês uma pode ter sido carregada antes da outra mudar
 * de corte — e uma venda movida de data aparece nas duas.
 */
export function unirVendas(...listas) {
  const vistos = new Set();
  const out = [];
  for (const lista of listas) {
    for (const s of lista || []) {
      if (!s?.id || vistos.has(s.id)) continue;
      vistos.add(s.id);
      out.push(s);
    }
  }
  return out;
}

/**
 * Vendas que a evolução e o "a receber" usam (P3 S18 #5): a janela principal vem PRIMEIRO — ela é
 * recarregada a cada 5 min; o histórico é uma cópia mais velha. Venda que mudou de maio para
 * setembro aparece nas duas: vale a versão da janela principal.
 */
export function vendasDaInicio({ principal = [], historico = [] } = {}) {
  return unirVendas(principal, historico);
}

/**
 * Cortes e parâmetros da Início nova, todos do MESMO dia civil de Brasília que os cálculos usam
 * (P3 S18 #3: aparelho em UTC às 01h de 01/10 ainda é 30/09 em Brasília; cortar pelo relógio do
 * aparelho tirava junho da mediana). Só o corte do "a receber" segue o relógio do aparelho, porque
 * tem de bater com a caixa da tela Vendas, que usa o mesmo.
 */
export function janelasInicio(agora = new Date()) {
  const hoje = dataCivilBRT(agora);
  const inicioJanela = startOfMonth(subMonths(hoje, MESES_MEDIANA));
  const corteVendas = corteAReceber(agora);
  const inicioEvolucao = fmt(startOfMonth(subMonths(hoje, MESES_EVOLUCAO - 1)));
  return {
    hoje: fmt(hoje),
    mes: format(hoje, "yyyy-MM"),
    // janela principal (polling): do 1º dia do 3º mês anterior em diante
    inicioJanela: fmt(inicioJanela),
    // histórico (1 vez): o que a evolução de 6 meses e o "a receber" precisam antes disso
    historicoDesde: corteVendas < inicioEvolucao ? corteVendas : inicioEvolucao,
    historicoAte: fmt(subDays(inicioJanela, 1)),
    corteAReceber: corteVendas,
  };
}

/**
 * O que o bloco "Agora" pode afirmar (P3 S18 #6). "Tudo em dia!" só quando TODAS as fontes
 * responderam e nada pede ação: histórico carregando ou com erro (a receber desconhecido) ou
 * falha de pedidos/marketing/config nunca viram "tudo certo". Falha de marketing/config esconde
 * também a ação prioritária (ela leria o vazio como "marketing pendente"/"ative o robô").
 * @param {{ temFaixa: boolean, temPedido: boolean, aReceber: {status: string, n?: number}|null,
 *           falhas?: string[] }} p
 */
export const FONTES_DO_AGORA = ["pedidos", "marketing", "config", "robô"];
export function avaliarAgora({ temFaixa = false, temPedido = false, aReceber = null, falhas = [] } = {}) {
  const falhouFonte = falhas.filter((f) => FONTES_DO_AGORA.includes(f));
  const aReceberConhecido = aReceber?.status === "ok";
  const pendencia = temFaixa || temPedido || (aReceberConhecido && (aReceber.n || 0) > 0);
  return {
    mostrarPrioridade: !falhouFonte.some((f) => f === "marketing" || f === "config" || f === "robô"),
    permitirTudoEmDia: !pendencia && aReceberConhecido && falhouFonte.length === 0,
    erro: falhouFonte.length > 0 || aReceber?.status === "erro",
    carregando: aReceber?.status === "loading",
  };
}

/** Corte da caixa "A receber" da tela Vendas (mesma fórmula, relógio do aparelho como lá). */
export function corteAReceber(agora = new Date()) {
  return fmt(subMonths(agora, MESES_A_RECEBER));
}

/** Vendas a receber desde `desde` ('yyyy-MM-dd'), sem repetir venda que veio em duas listas. */
export function aReceberDesde(sales = [], desde) {
  const unicas = unirVendas(sales).filter((s) => (s.sale_date || "") >= desde);
  const lista = vendasAReceber(unicas);
  return { n: lista.length, total: lista.reduce((t, s) => t + getSaleNetValue(s), 0) };
}

// ------------------------------------------------------------------ meta do dia e sequência

function mapaDeResumos(resumos, franchiseId) {
  const mapa = new Map();
  for (const r of resumos || []) {
    if (!r?.date) continue;
    if (franchiseId && r.franchise_id !== franchiseId) continue;
    const k = String(r.date).slice(0, 10);
    mapa.set(k, (mapa.get(k) || 0) + (parseFloat(r.sales_value) || 0));
  }
  return mapa;
}

function metaNoMapa(mapa, diaStr) {
  const d = parseISO(diaStr);
  let soma = 0;
  let n = 0;
  for (let i = 1; i <= JANELA_META_DIAS; i++) {
    const k = fmt(subDays(d, i));
    if (mapa.has(k)) {
      soma += mapa.get(k);
      n++;
    }
  }
  if (n < MIN_DIAS_META) return null;
  return Math.round((soma / n) * FATOR_META);
}

/**
 * Meta de um dia ('yyyy-MM-dd'): média dos 30 dias anteriores + 10% (null com menos de 7 dias
 * de base). `resumos` = linhas de daily_summaries { franchise_id, date, sales_value }.
 */
export function metaDoDia(resumos, diaStr, { franchiseId } = {}) {
  return metaNoMapa(mapaDeResumos(resumos, franchiseId), diaStr);
}

/**
 * Dias seguidos batendo a meta, cada dia contra a meta DAQUELE dia.
 * Começa em ontem (ou anteontem, se o resumo de ontem ainda não saiu: o cron roda às 02h) e
 * para no primeiro dia sem resumo, sem meta ou abaixo da meta. `faturamentoHoje` (opcional):
 * hoje ainda está em andamento — só SOMA quando já bateu a meta de hoje, nunca quebra.
 */
export function diasSeguidosBatendoMeta(resumos, { hoje, franchiseId, faturamentoHoje = null, maxDias = MAX_DIAS_SEQUENCIA } = {}) {
  const mapa = mapaDeResumos(resumos, franchiseId);
  const d0 = parseISO(hoje);
  let cursor = subDays(d0, 1);
  if (!mapa.has(fmt(cursor)) && mapa.has(fmt(subDays(d0, 2)))) cursor = subDays(d0, 2);

  let dias = 0;
  for (let i = 0; i < maxDias; i++) {
    const k = fmt(cursor);
    if (!mapa.has(k)) break;
    const meta = metaNoMapa(mapa, k);
    if (!meta || meta <= 0 || mapa.get(k) < meta) break;
    dias++;
    cursor = subDays(cursor, 1);
  }

  let hojeConta = false;
  if (faturamentoHoje !== null && faturamentoHoje !== undefined) {
    const metaHoje = metaNoMapa(mapa, hoje);
    if (metaHoje && metaHoje > 0 && faturamentoHoje >= metaHoje) {
      dias++;
      hojeConta = true;
    }
  }
  return { dias, hojeConta };
}

/** Subiu/caiu no ranking do mês (null sem posição do mês anterior). */
export function deltaRanking(monthlyRanking) {
  const atual = monthlyRanking?.rank_position;
  const antes = monthlyRanking?.prev_rank_position;
  if (!atual || !monthlyRanking?.total_franchises || !antes) return null;
  const diff = antes - atual;
  if (diff > 0) return { type: "up", value: diff };
  if (diff < 0) return { type: "down", value: -diff };
  return { type: "same", value: 0 };
}

/** Faturamento de um dia ('yyyy-MM-dd') pelas vendas. */
export function faturamentoDoDia(sales = [], diaStr) {
  let total = 0;
  let n = 0;
  for (const s of sales) {
    if (s?.sale_date === diaStr) {
      total += getSaleNetValue(s);
      n++;
    }
  }
  return { total, vendas: n };
}
