// Textos e tons derivados de get_admin_network_overview() para a tela Unidades.
// Regra de FILTRO/ordenação/busca é @/lib/networkOverview.js — aqui é só apresentação
// (uma linha por unidade -> o que mostrar em cada coluna).
import { formatBRLInteger } from "@/lib/formatters";
import { DIAS_SEM_VENDA, DIAS_ROBO_PARADO } from "@/lib/networkOverview";

// Colunas: Unidade / Faturamento no mês / Sem venda há / Robô / Último pedido / Verba / Ação.
// String COMPLETA (não montada em runtime) para o scanner do Tailwind achar a classe
// arbitrária — fica igual no header e em cada linha.
export const GRID_COLS = "md:grid-cols-[1.9fr_1.05fr_0.85fr_1.05fr_1.15fr_1.15fr_0.95fr]";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function idadeLabel(row) {
  if (row.is_new) return "Nova";
  const d = num(row.age_days);
  if (d == null) return "";
  if (d < 60) return `${d} ${d === 1 ? "dia" : "dias"}`; // salvaguarda; não deveria ocorrer sem is_new
  const meses = Math.round(d / 30);
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function faturamentoInfo(row) {
  const mtd = num(row.rev_mtd) || 0;
  const delta = num(row.rev_delta_pct);
  return {
    valor: formatBRLInteger(mtd),
    deltaLabel: delta == null ? null : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(1).replace(".", ",")}%`,
    tone: delta == null ? "" : delta >= 0 ? "text-ok-ink" : "text-err",
  };
}

export function semVendaLabel(row) {
  const d = num(row.days_since_last_sale);
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
export function verbaInfo(row) {
  const monthPaid = !!row.marketing_month_paid;
  const targetPaid = !!row.marketing_target_paid;
  if (!monthPaid && !targetPaid) return { status: "nao_pagou", texto: "não pagou" };
  const usaTarget = !monthPaid && targetPaid;
  const raisedAt = usaTarget ? row.marketing_target_raised_at : row.marketing_month_raised_at;
  const amount = usaTarget ? row.marketing_target_amount : row.marketing_month_amount;
  if (!raisedAt) return { status: "sem_campanha", texto: "paga, campanha não subiu" };
  return { status: "paga", texto: `paga · ${formatBRLInteger(num(amount) || 0)}` };
}
