// Textos e tons derivados de get_admin_network_overview() para a tela Unidades.
// Regra de FILTRO/ordenação/busca é @/lib/networkOverview.js — aqui é só apresentação
// (uma linha por unidade -> o que mostrar em cada coluna).
import { formatBRLInteger, formatPct } from "@/lib/formatters";
import {
  DIAS_SEM_VENDA,
  DIAS_ROBO_PARADO,
  DIAS_SEM_VENDA_NOVA,
  novaNaTrilha,
  infoMesSeguinte,
  FILTROS_REV_90D,
} from "@/lib/networkOverview";

// Colunas: Unidade / Faturamento no mês / Sem venda há / Robô / Último pedido / Verba / Ação.
// String COMPLETA (não montada em runtime) para o scanner do Tailwind achar a classe
// arbitrária — fica igual no header e em cada linha. Robô e Verba ganharam mais espaço
// (achado do print 26/09: "parado há 28 dias" e "não pagou · Out: ainda pode pagar"
// quebravam em 2-4 linhas); Ação e Sem venda encolheram para compensar (texto curto e fixo).
export const GRID_COLS = "md:grid-cols-[1.85fr_1.1fr_0.75fr_1.3fr_1.1fr_1.15fr_0.85fr]";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// created_at é a data de CADASTRO no painel (a migração de março jogou 39 das 66 unidades
// nela), não a de abertura — então só mostramos a idade quando é recente o bastante para
// não mentir (decisão 1 do orquestrador, 26/09). Acima de 60 dias, "" (sem idade nenhuma).
// Se o Nelson quiser a idade real, criar franchises.opened_at e usar essa coluna aqui.
export function idadeLabel(row) {
  if (row.is_new) return "Nova";
  const d = num(row.age_days);
  if (d == null || d >= 60) return "";
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

// Filtros em que a coluna do mês (quase sempre R$ 0 nessas listas) some e dá lugar ao
// que REALMENTE ordena a fila — "vendia em 90 dias" (T8: a coluna visível tem de ser a
// que ordena). Mesma régua do texto "começando pela de cima" dos dois FILTROS. Fonte única
// em networkOverview.js (o clique no cabeçalho "Faturamento" tem de ordenar pelo MESMO
// número que a coluna mostra).
const USA_REV_90D = FILTROS_REV_90D;
export const ROTULO_COLUNA_FATURAMENTO = "Faturamento no mês";
export const ROTULO_COLUNA_REV_90D = "Vendia em 90 dias";

export function rotuloColunaFaturamento(filtro) {
  return USA_REV_90D.has(filtro) ? ROTULO_COLUNA_REV_90D : ROTULO_COLUNA_FATURAMENTO;
}

// Cabeçalho da tabela em 1 linha (item 33, T3): "Mês" / "90 dias" — a versão completa
// ("Faturamento no mês" / "Vendia em 90 dias") fica só no rótulo inline do cartão do celular.
export function rotuloColunaFaturamentoCurto(filtro) {
  return USA_REV_90D.has(filtro) ? "90 dias" : "Mês";
}

// `filtro` (opcional): com sem_venda/robo_parado, mostra rev_90d em vez do mês (item 12).
export function faturamentoInfo(row, filtro) {
  if (USA_REV_90D.has(filtro)) {
    return { valor: formatBRLInteger(num(row.rev_90d) || 0), deltaLabel: null, tone: "" };
  }
  const mtd = num(row.rev_mtd) || 0;
  const delta = num(row.rev_delta_pct);
  return {
    valor: formatBRLInteger(mtd),
    deltaLabel: delta == null ? null : formatPct(delta, { sinal: true }),
    tone: delta == null ? "" : delta >= 0 ? "text-ok-ink" : "text-err",
  };
}

// Nova na trilha (< 60 dias, régua protegida): nunca vermelho por "nunca vendeu" —
// SALVO quem já passou dos 30 dias parada, que é problema de verdade (decisões 3/4;
// mesma régua de sinaisUnidade — achado médio 26/09: antes `destaque` ficava sempre false
// pra unidade nova, mesmo com 30+ dias sem venda, contradizendo o chip vermelho da Ficha).
export function semVendaLabel(row) {
  const d = num(row.days_since_last_sale);
  const protegida = novaNaTrilha(row);
  if (protegida) {
    if (d !== null && d > DIAS_SEM_VENDA_NOVA) {
      return { texto: `${d} dias`, destaque: true };
    }
    return { texto: d == null ? "ainda sem venda" : `${d} ${d === 1 ? "dia" : "dias"}`, destaque: false };
  }
  if (d == null) return { texto: "nunca vendeu", destaque: true };
  return { texto: `${d} ${d === 1 ? "dia" : "dias"}`, destaque: d >= DIAS_SEM_VENDA };
}

export function roboLabel(row) {
  const pessoas = num(row.people_7d) || 0;
  if (pessoas > 0) return { texto: `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} em 7 dias`, destaque: false };
  const d = num(row.days_since_last_bot);
  if (d == null) return { texto: "sem conversas", destaque: false };
  return { texto: `parado há ${d} ${d === 1 ? "dia" : "dias"}`, destaque: d >= DIAS_ROBO_PARADO };
}

export function pedidoLabel(row) {
  const d = num(row.days_since_last_po);
  const texto = d == null ? "nunca" : `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const pend = num(row.pending_po_count) || 0;
  return { texto, extra: pend > 0 ? `${pend} para confirmar` : null };
}

// Mesma regra combinada da FILTROS.sem_verba (mês do calendário OU mês-alvo pago).
// Nova na trilha: "ainda não pagou" em tom neutro, nunca a cobrança vermelha de quem já roda.
// `secundario`/o atributo title (decisão 2, ajustado 26/09): só nos últimos 5 dias do mês,
// texto NEUTRO sobre o mês seguinte (infoMesSeguinte) — nunca cobrança, nunca zera o principal.
// "Já pagou" é curto e positivo: fica visível. "Ainda pode pagar" é o estado default da
// MAIORIA nesses 5 dias (achado do print 26/09: linha de 3-4 quebras na coluna Verba, só
// por repetir um óbvio) — vira dica ao passar o mouse, a coluna some ao invés de estourar.
export function verbaInfo(row) {
  const seg = infoMesSeguinte(row);
  const secundario = seg?.pago ? seg.texto : null;
  const tooltip = seg && !seg.pago ? seg.texto : null;
  const monthPaid = !!row.marketing_month_paid;
  const targetPaid = !!row.marketing_target_paid;
  if (!monthPaid && !targetPaid) {
    if (novaNaTrilha(row)) return { status: "nao_pagou_nova", texto: "ainda não pagou", secundario, tooltip };
    return { status: "nao_pagou", texto: "não pagou", secundario, tooltip };
  }
  const usaTarget = !monthPaid && targetPaid;
  const raisedAt = usaTarget ? row.marketing_target_raised_at : row.marketing_month_raised_at;
  const amount = usaTarget ? row.marketing_target_amount : row.marketing_month_amount;
  if (!raisedAt) return { status: "sem_campanha", texto: "paga, campanha não subiu", secundario, tooltip };
  return { status: "paga", texto: `paga · ${formatBRLInteger(num(amount) || 0)}`, secundario, tooltip };
}
