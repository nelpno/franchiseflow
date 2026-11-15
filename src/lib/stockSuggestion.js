import { subDays } from "date-fns";

export const LOOKBACK_DAYS = 28;
export const WEEKS_OF_COVERAGE = 2;

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export function weeklyTurnoverMap(saleItems) {
  const list = saleItems || [];
  if (list.length === 0) return {};

  const cutoff = subDays(new Date(), LOOKBACK_DAYS).toISOString();
  const agg = {};
  let sawAnyKey = false;

  for (const si of list) {
    if (!si.created_at || si.created_at < cutoff) continue;
    const key = si.inventory_item_id;
    if (!key) continue;
    sawAnyKey = true;
    agg[key] = (agg[key] || 0) + (parseFloat(si.quantity) || 0);
  }

  if (isDev && list.length > 0 && !sawAnyKey) {
    console.warn(
      "[stockSuggestion] saleItems chegou sem inventory_item_id — verifique o `columns` da query SaleItem.list. Giro/sugestão vão zerar."
    );
  }

  const out = {};
  for (const [id, total] of Object.entries(agg)) {
    out[id] = total / (LOOKBACK_DAYS / 7);
  }
  return out;
}

export function suggestionFor(item, weeklyTurnover) {
  const wt = weeklyTurnover[item.id] || 0;
  const qty = parseFloat(item.quantity) || 0;
  const minStock = parseFloat(item.min_stock) || 0;

  if (wt <= 0 && minStock <= 0) return null;

  const base = wt > 0 ? Math.ceil(wt * WEEKS_OF_COVERAGE) - qty : 0;
  const floor = minStock > 0 ? minStock - qty : 0;
  return Math.max(base, floor, 0);
}

// ============================================================================================
// S25 (29/09/2026, atrás da chave ui_v2): a conta NOVA da sugestão de compra. Uma regra só para
// Estoque, Reposição, o selo "Repor" e o Novo Pedido. Com a chave desligada as telas continuam
// usando weeklyTurnoverMap/suggestionFor acima (2 semanas do giro de 28 dias).
//
// Por que mudou (medido em 29/09/2026 na rede, sem unidades de teste):
//   - a unidade pede à fábrica a cada ~18 a 21 dias (mediana; 38 de 50 unidades acima de 16
//     dias) e a entrega chega ~5 dias depois do pedido. Duas semanas de venda não chegam à
//     entrega seguinte: no backtest com as vendas e os pedidos reais de 5 unidades a regra
//     antiga atendia só 63% da procura (produto zerado em ~1 de cada 3 dias).
//   - a venda de cada produto é miúda e salteada (mediana 0,75 un/semana; 58% das semanas sem
//     venda): 211 itens padrão com venda nos últimos 84 dias tinham ZERO nos últimos 28, e a
//     regra antiga não sugeria nada para eles.
// Regra nova: ritmo = o MAIOR entre a média de 4 e a de 12 semanas; cobrir o intervalo típico da
// unidade entre pedidos + o prazo de entrega + 1 semana de folga; o mínimo cadastrado é piso
// SÓ para o que vende (P3 da S25: o mínimo 3 é o de fábrica em ~80% dos itens; produto sem venda
// em 12 semanas não recebe sugestão); desconta o que tem (negativo conta como 0) e o que já está
// a caminho. Backtest: 89% da procura
// atendida (antes 63%), pedindo menos unidades do que as 5 unidades pediram de fato no período.
// ============================================================================================

export const JANELA_CURTA_DIAS = 28;
export const JANELA_LONGA_DIAS = 84;
export const PRAZO_ENTREGA_DIAS = 5;
export const FOLGA_DIAS = 7;
export const INTERVALO_PADRAO_DIAS = 21;
export const INTERVALO_MIN_DIAS = 7;
export const INTERVALO_MAX_DIAS = 35;
/** "Acabando" = o que tem (mais o que está a caminho) não dura uma semana de venda. */
export const DIAS_ACABANDO = 7;

const DIA_MS = 24 * 60 * 60 * 1000;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/**
 * Venda média por DIA de cada produto: o maior entre as últimas 4 e as últimas 12 semanas
 * (semana fraca não zera o produto; produto que começou a vender agora não fica diluído).
 * Usa sale_items.created_at (como o giro de sempre). @returns {Record<string, number>}
 */
export function ritmoDeVendaMap(saleItems, agora = new Date()) {
  const t0 = ms(agora);
  const corteLongo = t0 - JANELA_LONGA_DIAS * DIA_MS;
  const corteCurto = t0 - JANELA_CURTA_DIAS * DIA_MS;
  const longo = {};
  const curto = {};
  for (const si of saleItems || []) {
    const key = si?.inventory_item_id;
    if (!key || !si.created_at) continue;
    const t = ms(si.created_at);
    if (!Number.isFinite(t) || t < corteLongo || t > t0 + DIA_MS) continue;
    const q = num(si.quantity);
    if (q <= 0) continue;
    longo[key] = (longo[key] || 0) + q;
    if (t >= corteCurto) curto[key] = (curto[key] || 0) + q;
  }
  const out = {};
  for (const key of Object.keys(longo)) {
    out[key] = Math.max((curto[key] || 0) / JANELA_CURTA_DIAS, longo[key] / JANELA_LONGA_DIAS);
  }
  return out;
}

/**
 * De quanto em quanto tempo a unidade pede à fábrica: mediana dos intervalos entre os pedidos
 * (não cancelados) dos últimos 180 dias. Pedidos a menos de 2 dias um do outro contam como um
 * só (acréscimo). Com menos de 2 intervalos, vale o padrão da rede (21 dias).
 * @param {Array<string|Date>} datas datas dos pedidos (ordered_at)
 * @returns {{ dias: number, daUnidade: boolean }}
 */
export function intervaloEntrePedidos(datas, agora = new Date()) {
  const t0 = ms(agora);
  const ts = (datas || [])
    .map(ms)
    .filter((t) => Number.isFinite(t) && t <= t0 + DIA_MS && t >= t0 - 180 * DIA_MS)
    .sort((a, b) => a - b);
  const gaps = [];
  let anterior = null;
  for (const t of ts) {
    if (anterior !== null) {
      const g = (t - anterior) / DIA_MS;
      if (g < 2) continue; // acréscimo ao mesmo pedido: não mexe na âncora
      gaps.push(g);
    }
    anterior = t;
  }
  if (gaps.length < 2) return { dias: INTERVALO_PADRAO_DIAS, daUnidade: false };
  gaps.sort((a, b) => a - b);
  const meio = Math.floor(gaps.length / 2);
  const mediana = gaps.length % 2 ? gaps[meio] : (gaps[meio - 1] + gaps[meio]) / 2;
  const dias = Math.min(INTERVALO_MAX_DIAS, Math.max(INTERVALO_MIN_DIAS, Math.round(mediana)));
  return { dias, daUnidade: true };
}

/** Quantos dias o pedido de hoje precisa cobrir: intervalo + prazo de entrega + folga. */
export function diasDeCobertura(intervaloDias = INTERVALO_PADRAO_DIAS) {
  const i = num(intervaloDias) > 0 ? num(intervaloDias) : INTERVALO_PADRAO_DIAS;
  return i + PRAZO_ENTREGA_DIAS + FOLGA_DIAS;
}

/**
 * Quanto pedir de UM produto (regra nova). Inteiro para cima (pedido à fábrica é em unidades).
 * @param {object} item linha de inventory_items
 * @param {{ ritmoPorDia?: number, aCaminho?: number, intervaloDias?: number }} ctx
 */
export function sugestaoDeCompra(item, { ritmoPorDia = 0, aCaminho = 0, intervaloDias = INTERVALO_PADRAO_DIAS } = {}) {
  const estoque = num(item?.quantity);
  const conta = Math.max(estoque, 0);
  const caminho = Math.max(num(aCaminho), 0);
  const minimo = Math.max(num(item?.min_stock), 0);
  const r = Math.max(num(ritmoPorDia), 0);
  const cobertura = diasDeCobertura(intervaloDias);

  const alvoVenda = r > 0 ? Math.ceil(r * cobertura - 1e-9) : 0;
  const alvo = Math.max(alvoVenda, Math.ceil(minimo));
  // Sem venda em 12 semanas: não sugere, mesmo com mínimo (decisão da S25, P3).
  const semBase = r <= 0;
  const repor = semBase ? 0 : Math.max(0, Math.ceil(alvo - conta - caminho - 1e-9));
  const motivo = semBase ? null : alvoVenda >= minimo ? "venda" : "minimo";

  let situacao = null;
  if (conta <= 0) situacao = "acabou";
  else if (r > 0 && conta + caminho < r * DIAS_ACABANDO) situacao = "acabando";

  return {
    estoque,
    estoqueNegativo: estoque < 0,
    conta,
    aCaminho: caminho,
    minimo,
    porSemana: r * 7,
    alvo,
    repor,
    motivo,
    semBase,
    situacao,
    diasDeEstoque: r > 0 ? conta / r : null,
  };
}

/** "~1,5", "~3", "menos de 1": venda por semana em pt-BR, sem ponto decimal. */
export function formatarPorSemana(porSemana) {
  const v = num(porSemana);
  if (v <= 0) return "0";
  if (v < 0.5) return "menos de 1";
  const arred = v < 10 ? Math.round(v * 2) / 2 : Math.round(v);
  return `~${arred.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
}

/** "a cada ~3 semanas" / "a cada ~10 dias". */
export function textoIntervalo(dias) {
  const d = Math.round(num(dias));
  if (d >= 12) {
    const sem = Math.round(d / 7);
    return `a cada ~${sem} ${sem === 1 ? "semana" : "semanas"}`;
  }
  return `a cada ~${d} dias`;
}

/** Linha curta para a lista: "vende ~1,5 por semana" / "sem venda em 3 meses". */
export function textoVenda(s) {
  if (!s || !(s.porSemana > 0)) return "sem venda em 3 meses";
  const t = formatarPorSemana(s.porSemana);
  return t === "menos de 1" ? "vende menos de 1 por semana" : `vende ${t} por semana`;
}

/**
 * O porquê da sugestão, em frase simples (tela e guia). Ex.: "Sugerimos 7 porque você vende
 * ~3 por semana e costuma pedir a cada ~3 semanas. Já descontamos o que você tem (2)."
 */
export function explicarSugestao(s, intervaloDias = INTERVALO_PADRAO_DIAS) {
  if (!s) return "";
  if (s.semBase) return "Sem venda nos últimos 3 meses: não sugerimos compra.";
  const descontos = [];
  if (s.conta > 0) descontos.push(`o que você tem (${s.conta})`);
  if (s.aCaminho > 0) descontos.push(`o que está a caminho (${s.aCaminho})`);
  const desconto = descontos.length ? ` Já descontamos ${descontos.join(" e ")}.` : "";
  if (s.repor <= 0) {
    return s.motivo === "venda"
      ? `Dá para esperar: você vende ${formatarPorSemana(s.porSemana)} por semana e o que tem cobre até a entrega seguinte.${desconto}`
      : `Dá para esperar: você já tem o seu mínimo (${s.minimo}).`;
  }
  if (s.motivo === "venda") {
    return `Sugerimos ${s.repor} porque você vende ${formatarPorSemana(s.porSemana)} por semana e costuma pedir ${textoIntervalo(intervaloDias)}.${desconto}`;
  }
  return `Sugerimos ${s.repor} para chegar ao seu mínimo de ${s.minimo}.${desconto}`;
}
