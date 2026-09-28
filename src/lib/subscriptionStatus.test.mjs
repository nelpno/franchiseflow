// Testes puros (node:assert, sem framework) — trava a classificacao da mensalidade.
// Rodar: node src/lib/subscriptionStatus.test.mjs
//
// Os casos refletem o estado REAL medido no banco em 07/09/2026:
//   41 PAID e 22 PENDING com vencimento 05/09 · 1 OVERDUE de 05/08 · 2 CANCELLED
//   · 1 franquia SEM LINHA em system_subscriptions
//
// P3 (28/09/2026, achado 3): forca o fuso do PROCESSO para UTC antes de qualquer coisa —
// se `diasDesde` voltar a ler o fuso local (bug antigo), os testes de meia-noite BRT abaixo
// reprovam mesmo rodando nesta maquina (que esta em BRT).
process.env.TZ = "UTC";

import assert from "node:assert";
import {
  classifySubscription,
  compareCobranca,
  isBlockingOverdue,
  dataCivilBRT,
  msAteProximaMeiaNoiteBRT,
  SITUACAO,
} from "./subscriptionStatus.js";

// Meio-dia BRT (explicito, -03:00) em vez de `new Date(2026, 8, 7)`: o construtor local
// depende do fuso do PROCESSO, e este arquivo roda com TZ=UTC (P3 achado 3) — precisamos
// de um instante que caia no dia 7 em Brasilia INDEPENDENTE de onde o teste roda.
const hoje = new Date("2026-09-07T12:00:00-03:00"); // 07/09/2026 meio-dia em Brasilia
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

// ── carencia (S5.3): dia 1 e 2 de atraso NAO bloqueiam; do dia 3 em diante, bloqueia ──
// Vencimento dia 5: dia 6 = atraso 1, dia 7 = atraso 2 (faixa vermelha, sem bloqueio),
// dia 8 = atraso 3 (bloqueia).
// Idem acima: meio-dia BRT explicito, nao construtor local (sensivel ao TZ do processo).
const hojeDia6 = new Date("2026-09-06T12:00:00-03:00");
const hojeDia7 = new Date("2026-09-07T12:00:00-03:00");
const hojeDia8 = new Date("2026-09-08T12:00:00-03:00");
const vencidaDesde5 = (hoje) =>
  classifySubscription(
    { asaas_subscription_id: "sub_1", current_payment_status: "OVERDUE", current_payment_due_date: "2026-09-05" },
    { hoje }
  );

assert.equal(vencidaDesde5(hojeDia6).diasAtraso, 1);
assert.equal(isBlockingOverdue(vencidaDesde5(hojeDia6)), false, "1 dia de atraso: faixa vermelha, sem bloqueio");
assert.equal(vencidaDesde5(hojeDia7).diasAtraso, 2);
assert.equal(isBlockingOverdue(vencidaDesde5(hojeDia7)), false, "2 dias de atraso: ainda na carencia");
assert.equal(vencidaDesde5(hojeDia8).diasAtraso, 3);
assert.equal(isBlockingOverdue(vencidaDesde5(hojeDia8)), true, "3 dias de atraso: bloqueia");

// Controle positivo: o codigo VELHO do paywall bloqueava em QUALQUER status OVERDUE,
// sem olhar diasAtraso (era so `current_payment_status === "OVERDUE"`). Essa checagem
// ingenua reprova o caso de 1 dia de atraso (ela bloquearia; a regra nova nao pode).
const bloqueioIngenuoVelho = (classification) => classification.situacao === SITUACAO.VENCIDO;
assert.equal(bloqueioIngenuoVelho(vencidaDesde5(hojeDia6)), true);
assert.notEqual(
  bloqueioIngenuoVelho(vencidaDesde5(hojeDia6)),
  isBlockingOverdue(vencidaDesde5(hojeDia6)),
  "a checagem velha (so status) e a nova (com carencia) tem de divergir no dia 1 de atraso"
);

// PENDENTE (nunca chegou a vencer) e AGUARDANDO (sem asaas_subscription_id) nunca bloqueiam
assert.equal(isBlockingOverdue(c({ asaas_subscription_id: "s", current_payment_status: "PENDING", current_payment_due_date: "2026-09-20" })), false);
assert.equal(isBlockingOverdue(c({ asaas_customer_id: "cus_1" })), false);
assert.equal(isBlockingOverdue(c(null)), false);

// ── P3 achado 3: a contagem de dias tem de usar o fuso de Brasilia, NUNCA o do processo ──
// Este arquivo roda inteiro com TZ=UTC (linha 1). Vencimento 05/09. O instante
// 2026-09-08T02:59:59Z e "07/09/2026 23:59:59" em Brasilia (UTC-3) — ainda dia 2 de
// atraso (carencia, sem bloqueio). 2026-09-08T03:00:00Z ja e "08/09/2026 00:00:00" em
// Brasilia — vira dia 3 (bloqueia). Se `diasDesde` lesse o fuso do processo (UTC aqui),
// os dois instantes cairiam no mesmo dia civil (08/09) e o primeiro caso reprovaria.
const antesDaMeiaNoiteBRT = new Date("2026-09-08T02:59:59Z");
const depoisDaMeiaNoiteBRT = new Date("2026-09-08T03:00:00Z");
const vencida5comInstante = (instante) =>
  classifySubscription(
    { asaas_subscription_id: "sub_1", current_payment_status: "OVERDUE", current_payment_due_date: "2026-09-05" },
    { hoje: instante }
  );

assert.equal(vencida5comInstante(antesDaMeiaNoiteBRT).diasAtraso, 2, "23:59:59 BRT do dia 7 ainda e o dia 2 de atraso");
assert.equal(isBlockingOverdue(vencida5comInstante(antesDaMeiaNoiteBRT)), false, "dia 2 de atraso: carencia, sem bloqueio");
assert.equal(vencida5comInstante(depoisDaMeiaNoiteBRT).diasAtraso, 3, "00:00:00 BRT do dia 8 vira o dia 3 de atraso");
assert.equal(isBlockingOverdue(vencida5comInstante(depoisDaMeiaNoiteBRT)), true, "dia 3 de atraso: bloqueia");

// dataCivilBRT: mesmo instante UTC, calendario BRT diferente (prova direta do fuso fixo)
assert.equal(dataCivilBRT(antesDaMeiaNoiteBRT).getDate(), 7);
assert.equal(dataCivilBRT(depoisDaMeiaNoiteBRT).getDate(), 8);

// msAteProximaMeiaNoiteBRT: as 23:59:59 BRT faltam ~1s; logo depois da meia-noite, ~24h
assert.ok(msAteProximaMeiaNoiteBRT(antesDaMeiaNoiteBRT) <= 1000, "quase meia-noite: falta <= 1s");
assert.ok(msAteProximaMeiaNoiteBRT(depoisDaMeiaNoiteBRT) >= 23 * 3600 * 1000, "logo apos a meia-noite: falta quase 1 dia inteiro");

console.log("subscriptionStatus: todas as verificações OK");
