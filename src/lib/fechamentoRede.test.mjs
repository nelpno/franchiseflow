// node src/lib/fechamentoRede.test.mjs
import assert from "node:assert/strict";
import {
  aplicarLista, cfgDaLista, contarListas, deltaPct, diasAtraso, infoMesSeguinte, isListaValida,
  mesValido, pendenciasDaLinha, resumoFechamento, rotuloMesVerba, rotulosPeriodo,
  semVerbaFechamento, somarMeses, temPendencia, temPendenciaAntiga, textoSemVerba,
} from "./fechamentoRede.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FALHOU: ${name}`);
    throw e;
  }
}

const PERIODO_SET = { period_start: "2026-09-01", period_end: "2026-09-26", prev_start: "2026-08-01", prev_end: "2026-08-26" };
const PERIODO_AGO = { period_start: "2026-08-01", period_end: "2026-08-31", prev_start: "2026-07-01", prev_end: "2026-07-31" };

// Linhas no formato da RPC (numeric chega como string ou número)
const L = (o) => ({
  franchise_id: o.id, franchise_name: `Maxi Massas ${o.id}`, is_active: o.ativa ?? true,
  rev_month: o.rev ?? 0, rev_prev_same: o.ant ?? 0, rev_delta_pct: o.delta ?? null,
  unconfirmed_count: o.nc ?? 0, unconfirmed_value: o.vnc ?? 0,
  // Colunas iguais a get_admin_network_overview (decisão 2): marketing_month = mês do
  // CALENDÁRIO (o principal). Nos testes fixos não há janela dos últimos 5 dias, então
  // mês-alvo = mês do calendário e os dois "pagou" andam juntos.
  marketing_month: "2026-10", marketing_month_paid: o.mkt ?? true,
  marketing_target_month: "2026-10", marketing_target_paid: o.mkt ?? true,
  subscription_payment_status: o.sub ?? "RECEIVED", subscription_value: o.subVal ?? null,
  subscription_due_date: o.subDue ?? null, ...PERIODO_SET,
});

const ROWS = [
  L({ id: "tatuape", rev: "4887.70", ant: "8804.68", delta: "-44.5", nc: 14, vnc: "1500.5" }),
  L({ id: "vila", rev: 80, ant: 3262, delta: -97.5 }),
  L({ id: "santos", rev: 12000, ant: 10000, delta: 20, sub: "OVERDUE", subVal: 150, subDue: "2026-09-05" }),
  L({ id: "nova", rev: 500, ant: 0, delta: null, mkt: false }),
  L({ id: "pequena", rev: 100, ant: 2900, delta: null, nc: 1, vnc: 100 }),
  L({ id: "encerrada", rev: 300, ant: 0, ativa: false, mkt: false }),
  L({ id: "zerada", rev: 0, ant: 0 }),
];

test("resumo soma faturamento e compara com o mesmo trecho", () => {
  const r = resumoFechamento(ROWS);
  assert.equal(r.unidades, 7);
  assert.equal(Math.round(r.receita * 100) / 100, 17867.7);
  assert.equal(Math.round(r.anterior * 100) / 100, 24966.68);
  assert.equal(r.deltaPct, -28.4);
});

test("resumo: vendas sem confirmar e a unidade que mais tem", () => {
  const r = resumoFechamento(ROWS);
  assert.equal(r.naoConfirmadas, 15);
  assert.equal(r.valorNaoConfirmado, 1600.5);
  assert.deepEqual(r.topNaoConfirmadas, { franchise_id: "tatuape", franchise_name: "Maxi Massas tatuape", n: 14 });
});

test("resumo: a receber (mensalidade vencida e sem verba só de unidade ativa)", () => {
  const r = resumoFechamento(ROWS);
  assert.equal(r.mensalidadesVencidas, 1);
  assert.equal(r.semVerba, 1); // encerrada não conta
  // Mês PRINCIPAL vem sempre do calendário (decisão 2) — mesmo texto de Hoje/Unidades/Marketing.
  // rotuloMesVerba/textoSemVerba leem as linhas CRUAS, não um campo pré-computado do resumo.
  assert.equal(rotuloMesVerba(ROWS), "outubro");
  assert.equal(textoSemVerba(r.semVerba, ROWS), "1 unidade não pagou a verba de outubro");
});

// #19: "3 vencidas · R$ 450 · a mais antiga há 52 dias (Uberlândia)" — subscription_value/
// subscription_due_date já vêm da RPC atual (sem precisar da migração nova).
test("resumo: valor e unidade mais antiga entre as vencidas", () => {
  const rows = [
    L({ id: "carla", rev: 100, sub: "OVERDUE", subVal: 150, subDue: "2026-09-05" }),
    L({ id: "gustavo", rev: 100, sub: "OVERDUE", subVal: 150, subDue: "2026-09-05" }),
    L({ id: "uberlandia", rev: 100, sub: "OVERDUE", subVal: 150, subDue: "2026-08-05" }),
    L({ id: "paga", rev: 100 }),
  ];
  const r = resumoFechamento(rows);
  assert.equal(r.mensalidadesVencidas, 3);
  assert.equal(r.valorVencidas, 450);
  assert.equal(r.maisAntigaVencida.franchise_id, "uberlandia");
  assert.equal(r.maisAntigaVencida.dueDate, "2026-08-05");
});

test("diasAtraso: dias corridos entre a data e hoje, sem passar por Date/fuso", () => {
  assert.equal(diasAtraso("2026-08-05", "2026-09-26"), 52);
  assert.equal(diasAtraso("2026-09-26", "2026-09-26"), 0);
  assert.equal(diasAtraso(null, "2026-09-26"), null);
});

// #21/#22: a RPC nova (unconfirmed_old_count/future_count/po_amount) ainda não foi
// aplicada — resumoFechamento tem de tratar a ausência como "sem dado", não como zero.
test("resumo: sem a migração nova, os campos ficam null (não 0)", () => {
  const r = resumoFechamento(ROWS);
  assert.equal(r.naoConfirmadasAntigas, null);
  assert.equal(r.topAntigas, null);
  assert.equal(r.vendasFuturas, null);
  assert.equal(r.poAmount, null);
  assert.equal(r.poPrevAmount, null);
  assert.equal(r.poDeltaPct, null);
});

test("resumo: com a migração aplicada, soma os campos novos de verdade", () => {
  const rows = ROWS.map((r) => ({
    ...r,
    unconfirmed_old_count: r.franchise_id === "tatuape" ? 14 : 0,
    future_count: r.franchise_id === "vila" ? 2 : 0,
    po_amount: r.franchise_id === "tatuape" ? 1000 : 0,
    po_prev_amount: r.franchise_id === "tatuape" ? 2000 : 0,
  }));
  const r = resumoFechamento(rows);
  assert.equal(r.naoConfirmadasAntigas, 14);
  assert.deepEqual(r.topAntigas, { franchise_id: "tatuape", franchise_name: "Maxi Massas tatuape", n: 14 });
  assert.equal(r.vendasFuturas, 2);
  assert.equal(r.poAmount, 1000);
  assert.equal(r.poPrevAmount, 2000);
  assert.equal(r.poDeltaPct, -50);
});

test("cfgDaLista/'confirmar': sem a migração usa unconfirmed_count; com ela, só 7+ dias", () => {
  assert.equal(cfgDaLista(ROWS, "confirmar").chip, "A confirmar");
  const comMigracao = ROWS.map((r) => ({ ...r, unconfirmed_old_count: r.franchise_id === "tatuape" ? 14 : 0 }));
  const cfg = cfgDaLista(comMigracao, "confirmar");
  assert.equal(cfg.chip, "Sem confirmar há 7+ dias");
  assert.deepEqual(aplicarLista(comMigracao, "confirmar").map((r) => r.franchise_id), ["tatuape"]);
  assert.equal(temPendenciaAntiga({ unconfirmed_old_count: 1 }), true);
  assert.equal(temPendenciaAntiga({ unconfirmed_old_count: 0 }), false);
});

test("pendenciasDaLinha: com unconfirmed_old_count, marca '(7+ dias)'", () => {
  const linha = { ...ROWS[0], unconfirmed_old_count: 14 };
  assert.deepEqual(pendenciasDaLinha(linha), ["14 vendas a confirmar (7+ dias)"]);
});

test("resumo vazio não quebra e não inventa %", () => {
  const r = resumoFechamento([]);
  assert.equal(r.receita, 0);
  assert.equal(r.deltaPct, null);
  assert.equal(r.topNaoConfirmadas, null);
  assert.equal(resumoFechamento(null).unidades, 0);
});

test("Caíram 20% ou mais: mesma régua de networkOverview (LIMITE_QUEDA_PCT), pior primeiro", () => {
  const ids = aplicarLista(ROWS, "caiu").map((r) => r.franchise_id);
  assert.deepEqual(ids, ["vila", "tatuape"]);
});

test("Caíram 20% ou mais ignora quem caiu mas vendia menos de R$ 3 mil (delta null)", () => {
  assert.ok(!aplicarLista(ROWS, "caiu").some((r) => r.franchise_id === "pequena"));
});

test("Caíram 20% ou mais exige >= 20% de queda, não qualquer queda", () => {
  // santos subiu (delta +20, não entra); só quedas <= -20 entram.
  const ids = aplicarLista(ROWS, "caiu").map((r) => r.franchise_id);
  assert.ok(!ids.includes("santos"));
});

test("Mais venderam: por faturamento, sem quem não vendeu", () => {
  const ids = aplicarLista(ROWS, "vendeu").map((r) => r.franchise_id);
  assert.deepEqual(ids, ["santos", "tatuape", "nova", "encerrada", "pequena", "vila"]);
});

test("A confirmar: só vendas sem pagamento confirmado (mensalidade e verba ficam no cartão de cima)", () => {
  const ids = aplicarLista(ROWS, "confirmar").map((r) => r.franchise_id);
  assert.deepEqual(ids, ["tatuape", "pequena"]);
  assert.ok(!ids.includes("santos")); // só tem mensalidade vencida, sem venda a confirmar
  assert.ok(!ids.includes("nova")); // só está sem verba
});

test("lista inválida cai em 'caiu'", () => {
  assert.equal(isListaValida("xpto"), false);
  assert.deepEqual(aplicarLista(ROWS, "xpto"), aplicarLista(ROWS, "caiu"));
});

test("contarListas bate com aplicarLista", () => {
  const c = contarListas(ROWS);
  assert.deepEqual(c, { caiu: 2, vendeu: 6, confirmar: 2 });
});

test("pendências da linha em texto (só vendas a confirmar)", () => {
  assert.deepEqual(pendenciasDaLinha(ROWS[0]), ["14 vendas a confirmar"]);
  assert.deepEqual(pendenciasDaLinha(L({ id: "x", nc: 1, sub: "OVERDUE", mkt: false })), ["1 venda a confirmar"]);
  assert.deepEqual(pendenciasDaLinha(ROWS[6]), []);
  assert.equal(temPendencia(ROWS[6]), false);
  assert.equal(semVerbaFechamento(ROWS[5]), false);
});

test("deltaPct aceita string e devolve null quando o banco não liberou", () => {
  assert.equal(deltaPct({ rev_delta_pct: "-44.5" }), -44.5);
  assert.equal(deltaPct({ rev_delta_pct: null }), null);
  assert.equal(deltaPct({}), null);
});

test("rótulos do mês corrente (corte no mesmo dia)", () => {
  const r = rotulosPeriodo(PERIODO_SET);
  assert.equal(r.parcial, true);
  assert.equal(r.resumo, "até dia 26");
  assert.equal(r.comparacao, "1 a 26 de agosto");
  assert.equal(r.colunaAtual, "Setembro (até 26)");
  assert.equal(r.colunaAnterior, "Agosto (até 26)");
});

test("rótulos do mês fechado", () => {
  const r = rotulosPeriodo(PERIODO_AGO);
  assert.equal(r.parcial, false);
  assert.equal(r.resumo, "agosto inteiro");
  assert.equal(r.comparacao, "julho inteiro");
  assert.equal(r.colunaAtual, "Agosto");
});

test("rótulos: 31/03 compara com fevereiro até 28", () => {
  const r = rotulosPeriodo({ period_start: "2027-03-01", period_end: "2027-03-30", prev_start: "2027-02-01", prev_end: "2027-02-28" });
  assert.equal(r.comparacao, "1 a 28 de fevereiro");
  assert.equal(rotulosPeriodo({}), null);
});

test("rótulos: mês curto fechado (30/09) não promete 'agosto inteiro' — agosto tem 31 dias", () => {
  // A RPC corta o mês anterior no MESMO dia do mês atual: 30/09 compara com 1-30/08,
  // faltando o dia 31. O rótulo tem que dizer isso, não "agosto inteiro" (achado medio Onda 1).
  const r = rotulosPeriodo({ period_start: "2026-09-01", period_end: "2026-09-30", prev_start: "2026-08-01", prev_end: "2026-08-30" });
  assert.equal(r.parcial, false); // setembro (30 dias) está completo
  assert.equal(r.resumo, "setembro inteiro");
  assert.equal(r.comparacao, "1 a 30 de agosto");
  assert.equal(r.colunaAtual, "Setembro");
  assert.equal(r.colunaAnterior, "Agosto (até 30)");
});

test("rótulos: mês fechado dos dois lados (31 dias contra 31 dias) diz 'inteiro'", () => {
  const r = rotulosPeriodo({ period_start: "2026-10-01", period_end: "2026-10-31", prev_start: "2026-09-01", prev_end: "2026-09-30" });
  assert.equal(r.comparacao, "setembro inteiro");
  assert.equal(r.colunaAnterior, "Setembro");
});

test("meses: navegação, nome e validação", () => {
  assert.equal(somarMeses("2026-01", -1), "2025-12");
  assert.equal(somarMeses("2026-12", 1), "2027-01");
  assert.equal(somarMeses("2026-09", -12), "2025-09");
  assert.equal(mesValido("2026-09", "2026-09"), true);
  assert.equal(mesValido("2026-10", "2026-09"), false);
  assert.equal(mesValido("2025-08", "2026-09"), false);
  assert.equal(mesValido("2026-13", "2026-09"), false);
  assert.equal(mesValido(null, "2026-09"), false);
});

test("fora da janela dos últimos 5 dias, sem info do mês seguinte", () => {
  assert.equal(infoMesSeguinte(ROWS), null); // mes === alvo nos fixtures (sem janela)
});

test("na janela: info do mês seguinte é sempre neutra, nunca cobrança", () => {
  const janela = [
    L({ id: "a", mkt: true }), L({ id: "b", mkt: false }),
  ].map((r) => ({ ...r, marketing_target_month: "2026-11", marketing_target_paid: r.franchise_id === "a" }));
  const info = infoMesSeguinte(janela);
  assert.equal(info.tom, "neutro");
  assert.equal(info.pagaram, 1);
  assert.equal(info.total, 2);
  assert.equal(info.texto, "Novembro: 1 já pagou");
});

console.log(`fechamentoRede: ${passed} testes ok`);
