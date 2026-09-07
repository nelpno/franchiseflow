// Testes puros (node:assert, sem framework) — trava a classificacao da mensalidade.
// Rodar: node src/lib/subscriptionStatus.test.mjs
//
// Os casos refletem o estado REAL medido no banco em 07/09/2026:
//   41 PAID e 22 PENDING com vencimento 05/09 · 1 OVERDUE de 05/08 · 2 CANCELLED
//   · 1 franquia SEM LINHA em system_subscriptions
import assert from "node:assert";
import { classifySubscription, compareCobranca, SITUACAO } from "./subscriptionStatus.js";

const hoje = new Date(2026, 8, 7); // 07/09/2026 (mes 0-indexado)
const c = (sub) => classifySubscription(sub, { hoje });

// ── o caso que era INVISIVEL: nenhuma linha em system_subscriptions ──
assert.equal(c(null).situacao, SITUACAO.SEM_COBRANCA);
assert.equal(c(undefined).situacao, SITUACAO.SEM_COBRANCA);

// ── pago ──
for (const status of ["PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
  const r = c({ asaas_subscription_id: "sub_1", current_payment_status: status, current_payment_due_date: "2026-09-05" });
  assert.equal(r.situacao, SITUACAO.PAGO, status);
  assert.equal(r.diasAtraso, null, `${status} nao tem atraso`);
}

// ── PENDING com vencimento passado E VENCIDO (22 unidades hoje) ──
const pend = c({ asaas_subscription_id: "sub_1", current_payment_status: "PENDING", current_payment_due_date: "2026-09-05" });
assert.equal(pend.situacao, SITUACAO.VENCIDO);
assert.equal(pend.diasAtraso, 2);

// ── PENDING que ainda nao venceu continua pendente ──
const aVencer = c({ asaas_subscription_id: "sub_1", current_payment_status: "PENDING", current_payment_due_date: "2026-09-20" });
assert.equal(aVencer.situacao, SITUACAO.PENDENTE);
assert.equal(aVencer.diasAtraso, null);

// ── vence HOJE ainda nao esta atrasado ──
assert.equal(
  c({ asaas_subscription_id: "s", current_payment_status: "PENDING", current_payment_due_date: "2026-09-07" }).situacao,
  SITUACAO.PENDENTE
);

// ── OVERDUE de verdade, com os dias certos (o caso de Uberlandia) ──
const venc = c({ asaas_subscription_id: "sub_1", current_payment_status: "OVERDUE", current_payment_due_date: "2026-08-05" });
assert.equal(venc.situacao, SITUACAO.VENCIDO);
assert.equal(venc.diasAtraso, 33);

// ── cancelada, pelos dois campos ──
assert.equal(c({ asaas_subscription_id: "s", current_payment_status: "CANCELLED" }).situacao, SITUACAO.CANCELADA);
assert.equal(c({ asaas_subscription_id: "s", subscription_status: "CANCELLED", current_payment_status: "PENDING" }).situacao, SITUACAO.CANCELADA);

// ── cliente no ASAAS sem assinatura criada ≠ sem cobranca ──
assert.equal(c({ asaas_customer_id: "cus_1" }).situacao, SITUACAO.AGUARDANDO);
// linha existe mas sem cliente E sem assinatura: ninguem vai cobrar
assert.equal(c({ franchise_id: "x" }).situacao, SITUACAO.SEM_COBRANCA);

// ── DATE puro nao pode escorregar um dia (fuso) ──
assert.equal(
  c({ asaas_subscription_id: "s", current_payment_status: "OVERDUE", current_payment_due_date: "2026-09-06" }).diasAtraso,
  1
);

// ── ordem de cobranca: sem cobranca primeiro, depois maior atraso ──
const fila = [
  { situacao: SITUACAO.PAGO, diasAtraso: null },
  { situacao: SITUACAO.VENCIDO, diasAtraso: 2 },
  { situacao: SITUACAO.SEM_COBRANCA, diasAtraso: null },
  { situacao: SITUACAO.VENCIDO, diasAtraso: 33 },
  { situacao: SITUACAO.PENDENTE, diasAtraso: null },
].sort(compareCobranca);
assert.deepEqual(
  fila.map((f) => `${f.situacao}:${f.diasAtraso ?? "-"}`),
  ["sem_cobranca:-", "vencido:33", "vencido:2", "pendente:-", "pago:-"]
);

// ── valor e vencimento sao repassados para a tabela ──
const comValor = c({ asaas_subscription_id: "s", current_payment_status: "PENDING", current_payment_due_date: "2026-09-05", current_payment_value: "150.00" });
assert.equal(comValor.valor, 150);
assert.equal(comValor.vencimento, "2026-09-05");

console.log("subscriptionStatus: todas as verificações OK");
