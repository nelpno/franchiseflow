import { parseDateOnly } from "./dateOnly.js";

/**
 * Classifica a mensalidade (ASAAS) de uma unidade numa situacao unica, com dias de
 * atraso. Fonte unica para o badge, os chips de filtro e a coluna da tabela em
 * Financeiro > Mensalidades.
 *
 * Tres defeitos que isto corrige (auditoria 07/09/2026):
 *
 * 1. Franquia SEM LINHA em `system_subscriptions` aparecia como um travessao neutro
 *    ("—"). Ela nao e um caso neutro: e a mais grave de todas, porque o cron de sync
 *    nunca vai ve-la e ninguem vai cobrar. Foi assim que a Americana ficou 4 meses
 *    sem cobranca (CLAUDE.md, 19/08/2026). Hoje ha 1 unidade nesse estado.
 * 2. "PENDING" era o MESMO badge para "vence dia 5" e "venceu ha 30 dias". Medido em
 *    07/09: 22 unidades PENDING com vencimento em 05/09 — todas ja vencidas.
 * 3. Nao havia dias de atraso em lugar nenhum, entao nao dava para priorizar a cobranca.
 *
 * `current_payment_due_date` e DATE puro: tem de passar por parseDateOnly, senao
 * new Date("2026-09-05") vira meia-noite UTC e, em Brasilia, volta um dia.
 */
export const SITUACAO = {
  PAGO: "pago",
  VENCIDO: "vencido",
  PENDENTE: "pendente",
  SEM_COBRANCA: "sem_cobranca",
  AGUARDANDO: "aguardando",
  CANCELADA: "cancelada",
};

export const SITUACAO_LABEL = {
  [SITUACAO.PAGO]: "Pago",
  [SITUACAO.VENCIDO]: "Vencido",
  [SITUACAO.PENDENTE]: "Pendente",
  [SITUACAO.SEM_COBRANCA]: "Sem cobrança",
  [SITUACAO.AGUARDANDO]: "Aguardando criar",
  [SITUACAO.CANCELADA]: "Cancelada",
};

const PAGOS = new Set(["PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

function diasDesde(dateOnly, hoje) {
  const d = parseDateOnly(dateOnly);
  if (!d || Number.isNaN(d.getTime())) return null;
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((base - alvo) / 86400000);
}

/**
 * @param {object|null|undefined} sub linha de `system_subscriptions` (ou ausencia dela)
 * @returns {{situacao: string, diasAtraso: number|null, vencimento: string|null, valor: number|null}}
 */
export function classifySubscription(sub, { hoje = new Date() } = {}) {
  const vazio = { diasAtraso: null, vencimento: null, valor: null };

  // A unidade nem linha tem: o cron de sync nunca a vera.
  if (!sub) return { situacao: SITUACAO.SEM_COBRANCA, ...vazio };

  const status = sub.current_payment_status;
  const vencimento = sub.current_payment_due_date || null;
  const valor = sub.current_payment_value != null ? Number(sub.current_payment_value) : null;

  if (status === "CANCELLED" || sub.subscription_status === "CANCELLED") {
    return { situacao: SITUACAO.CANCELADA, diasAtraso: null, vencimento, valor };
  }

  // Tem cliente no ASAAS mas ninguem criou a assinatura ainda.
  if (!sub.asaas_subscription_id) {
    const situacao = sub.asaas_customer_id ? SITUACAO.AGUARDANDO : SITUACAO.SEM_COBRANCA;
    return { situacao, diasAtraso: null, vencimento, valor };
  }

  if (PAGOS.has(status)) {
    return { situacao: SITUACAO.PAGO, diasAtraso: null, vencimento, valor };
  }

  const atraso = vencimento ? diasDesde(vencimento, hoje) : null;

  if (status === "OVERDUE") {
    return { situacao: SITUACAO.VENCIDO, diasAtraso: atraso, vencimento, valor };
  }

  // PENDING com vencimento no passado E vencido, ainda que o ASAAS nao tenha
  // virado o status: e o caso de 22 das 67 unidades hoje.
  if (atraso !== null && atraso > 0) {
    return { situacao: SITUACAO.VENCIDO, diasAtraso: atraso, vencimento, valor };
  }

  return { situacao: SITUACAO.PENDENTE, diasAtraso: null, vencimento, valor };
}

/** Ordem de cobranca: quem esta mais atrasado primeiro; quem nao tem cobranca no topo. */
export const ORDEM_COBRANCA = [
  SITUACAO.SEM_COBRANCA,
  SITUACAO.VENCIDO,
  SITUACAO.AGUARDANDO,
  SITUACAO.PENDENTE,
  SITUACAO.PAGO,
  SITUACAO.CANCELADA,
];

export function compareCobranca(a, b) {
  const pa = ORDEM_COBRANCA.indexOf(a.situacao);
  const pb = ORDEM_COBRANCA.indexOf(b.situacao);
  if (pa !== pb) return pa - pb;
  return (b.diasAtraso ?? -1) - (a.diasAtraso ?? -1);
}
