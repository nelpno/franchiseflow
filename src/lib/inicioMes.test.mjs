// S18.1 (28/09/2026): números da Início nova. Rodar: node src/lib/inicioMes.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { format, subDays } from "date-fns";
import {
  montarInicioMes, textosInicioMes, montarEvolucao, aReceberDesde, corteAReceber, hojeBrasilia,
  metaDoDia, diasSeguidosBatendoMeta, deltaRanking, faturamentoDoDia, arredondarPerto,
} from "./inicioMes.js";
import { resumirMes } from "./monthlyReport.js";
import { vendasAReceber } from "./vendasLista.js";

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const brl = (v) => `R$ ${Math.round(v)}`;

let seq = 0;
const venda = (sale_date, value, extra = {}) => ({
  id: `v${++seq}`, sale_date, value, discount_amount: 0, delivery_fee: 0, payment_confirmed: true, ...extra,
});

// Junho 3.000 · julho 5.000 · agosto 4.000 (3.000 até o dia 28) · setembro até 28/09 = 3.600
// (+ uma venda com data 30/09, que fica fora do "até hoje").
const sales = [
  venda("2026-06-05", 1000), venda("2026-06-15", 1000), venda("2026-06-30", 1000),
  ...[1, 8, 15, 22, 29].map((d) => venda(`2026-07-${String(d).padStart(2, "0")}`, 1000)),
  venda("2026-08-03", 900, { delivery_fee: 100 }),
  venda("2026-08-20", 1500, { discount_amount: 100 }),
  venda("2026-08-28", 600),
  venda("2026-08-29", 1000),
  venda("2026-09-02", 800),
  venda("2026-09-10", 1200, { discount_amount: 50, delivery_fee: 50 }),
  venda("2026-09-27", 1000, { payment_confirmed: false }),
  venda("2026-09-28", 600),
  venda("2026-09-30", 700), // data futura
];
const HOJE = new Date(2026, 8, 28);

test("mês até hoje × mesmo trecho do mês anterior (venda com data futura fica fora)", () => {
  const m = montarInicioMes({ sales, hoje: HOJE });
  perto(m.faturamento, 3600);
  assert.equal(m.vendas, 4);
  assert.equal(m.depoisDeHoje, 1);
  perto(m.valorMedio, 900);
  assert.equal(m.comparacao.mesAnterior, "agosto");
  perto(m.comparacao.antes, 3000);
  perto(m.comparacao.diff, 600);
  assert.equal(m.comparacao.pct, 20);
  assert.equal(m.comparacao.mesInteiro, false);
  // o faturamento é o MESMO do resumo do Resultado/PDF (resumirMes), cortado no dia
  perto(m.faturamento, resumirMes(HOJE, { sales, ateDia: 28 }).trecho.faturamento);
});

test("mediana dos 3 meses anteriores, ritmo e o que falta para chegar nela", () => {
  const m = montarInicioMes({ sales, hoje: HOJE });
  assert.equal(m.mediana, 4000); // jun 3.000, jul 5.000, ago 4.000
  // ritmo pelos 27 dias fechados (3.000) + o que já entrou hoje
  perto(m.ritmo.porDia, 3000 / 27);
  perto(m.ritmo.projecao, 3600 + (3000 / 27) * 2);
  perto(m.paraMediana.falta, 400);
  assert.equal(m.paraMediana.diasRestantes, 3);
  assert.equal(m.paraMediana.alcancavel, true); // 133/dia contra ~111/dia de ritmo (até 1,5×)
  const t = textosInicioMes(m, brl);
  assert.equal(t.titulo, "Setembro até hoje");
  assert.deepEqual(t.selo, { texto: "+20% que agosto", tom: "ok" });
  assert.equal(t.comparacao, "Até o dia 28: R$ 3600, contra R$ 3000 no mesmo trecho de agosto.");
  assert.equal(t.ritmo, "No ritmo de agora, setembro fecha perto de R$ 3800. Sua mediana dos últimos 3 meses é R$ 4000.");
  assert.equal(t.proximoPasso, "Para chegar na sua mediana faltam R$ 400: cerca de R$ 134 por dia até o fim do mês.");
});

test("mediana longe demais: o próximo passo vira uma ação de hoje, sem número que desanima", () => {
  const fraco = sales.filter((s) => s.sale_date !== "2026-09-10" && s.sale_date !== "2026-09-27");
  const m = montarInicioMes({ sales: fraco, hoje: HOJE });
  perto(m.paraMediana.falta, 2600); // 4.000 − 1.400
  assert.equal(m.paraMediana.alcancavel, false); // 867/dia contra ~30/dia
  assert.equal(textosInicioMes(m, brl).proximoPasso, "Um bom próximo passo para hoje: chamar os clientes do “Quem chamar hoje”, aqui na Início.");
});

test("sem venda num dos 3 meses: sem mediana (unidade ainda não abria)", () => {
  const semJunho = sales.filter((s) => !s.sale_date.startsWith("2026-06"));
  const m = montarInicioMes({ sales: semJunho, hoje: HOJE });
  assert.equal(m.mediana, null);
  assert.equal(m.paraMediana, null);
  const t = textosInicioMes(m, brl);
  assert.equal(t.ritmo, "No ritmo de agora, setembro fecha perto de R$ 3800.");
  assert.equal(t.proximoPasso, null);
});

test("ritmo só com 7 dias fechados; percentual só com base de R$ 500", () => {
  assert.equal(montarInicioMes({ sales, hoje: new Date(2026, 8, 7) }).ritmo, null);
  assert.ok(montarInicioMes({ sales, hoje: new Date(2026, 8, 8) }).ritmo);
  // 02/09: o mesmo trecho de agosto (dias 1 e 2) não tem venda -> sem percentual
  const inicio = montarInicioMes({ sales, hoje: new Date(2026, 8, 2) });
  perto(inicio.comparacao.antes, 0);
  assert.equal(inicio.comparacao.pct, null);
  assert.equal(textosInicioMes(inicio, brl).selo, null);
});

test("dia 31 contra mês de 30 dias = mês anterior inteiro; passou da mediana", () => {
  const out = [...sales, venda("2026-10-02", 6000)];
  const m = montarInicioMes({ sales: out, hoje: new Date(2026, 9, 31) });
  assert.equal(m.comparacao.mesInteiro, true);
  perto(m.comparacao.antes, 4300); // setembro inteiro, com a de 30/09
  const t = textosInicioMes(m, brl);
  assert.equal(t.comparacao, "Até o dia 31: R$ 6000, contra R$ 4300 em setembro inteiro.");
  assert.equal(t.proximoPasso, "Você já passou da sua mediana dos últimos 3 meses. Parabéns!");
});

test("queda: selo de atenção, nunca vermelho de erro", () => {
  const poucas = sales.filter((s) => s.sale_date !== "2026-09-10");
  const t = textosInicioMes(montarInicioMes({ sales: poucas, hoje: HOJE }), brl);
  assert.deepEqual(t.selo, { texto: "−20% que agosto", tom: "atencao" });
});

test("hoje em Brasília, não no fuso do aparelho", () => {
  assert.equal(hojeBrasilia(new Date("2026-09-29T02:30:00Z")).str, "2026-09-28"); // 23h30 em SP
  assert.equal(hojeBrasilia(new Date("2026-09-29T03:30:00Z")).str, "2026-09-29");
});

test("evolução: 6 meses pelas vendas, o atual até hoje", () => {
  const e = montarEvolucao({ sales, hoje: HOJE });
  assert.deepEqual(e.map((x) => x.chave), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(e.map((x) => x.valor), [0, 0, 3000, 5000, 4000, 3600]);
  assert.deepEqual(e.map((x) => x.atual), [false, false, false, false, false, true]);
  assert.equal(e[2].rotulo, "jun");
});

test("a receber: mesmo recorte da caixa da tela Vendas, sem contar venda repetida", () => {
  const desde = "2026-03-28";
  const antigas = [venda("2026-03-27", 100, { payment_confirmed: false }), venda("2026-04-02", 150, { payment_confirmed: false })];
  const todas = [...antigas, ...sales];
  const r = aReceberDesde([...todas, sales[sales.length - 3]], desde); // a de 27/09 veio duas vezes
  assert.equal(r.n, 2);
  perto(r.total, 1150);
  const daTelaVendas = vendasAReceber(todas.filter((s) => s.sale_date >= desde));
  assert.equal(r.n, daTelaVendas.length);
  assert.equal(corteAReceber(new Date(2026, 8, 28)), "2026-03-28");
});

test("faturamento do dia e arredondamento 'perto de'", () => {
  assert.deepEqual(faturamentoDoDia(sales, "2026-09-28"), { total: 600, vendas: 1 });
  assert.equal(arredondarPerto(3722.2), 3700);
  assert.equal(arredondarPerto(456), 460);
});

// ------------------------------------------------------------------ meta e sequência
const EVO = "unidade-x";
const HOJE_STR = "2026-09-28";
// valores[i] = faturamento de (hoje - i dias), i >= 1
function resumos(valorDoDia, dias = 120) {
  const out = [];
  for (let i = 1; i <= dias; i++) {
    const v = valorDoDia(i);
    if (v === undefined) continue;
    out.push({ franchise_id: EVO, date: format(subDays(new Date(2026, 8, 28), i), "yyyy-MM-dd"), sales_value: String(v) });
  }
  return out;
}

// CÓPIA do main (986cfe8) para o controle positivo: FranchiseeDashboard.jsx `dailyGoal` (30
// linhas de daily_summaries) + RankingStreak.jsx `streak` — todos os dias contra a meta de HOJE.
function metaDoMain(summaries, evoId, now) {
  const thirtyDaysAgo = subDays(now, 30);
  const recentDays = summaries.filter((s) => {
    if (s.franchise_id !== evoId) return false;
    const d = new Date(s.date);
    return d >= thirtyDaysAgo && d < now;
  });
  if (recentDays.length < 7) return null;
  const byDate = {};
  recentDays.forEach((s) => { byDate[s.date] = (byDate[s.date] || 0) + (parseFloat(s.sales_value) || 0); });
  const dailyTotals = Object.values(byDate);
  if (dailyTotals.length < 7) return null;
  return Math.round((dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length) * 1.10);
}
function sequenciaDoMain(summaries, franchiseId, dailyGoal) {
  if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;
  const franchiseDays = summaries.filter((s) => s.franchise_id === franchiseId).sort((a, b) => new Date(b.date) - new Date(a.date));
  let count = 0;
  for (const day of franchiseDays) {
    if ((parseFloat(day.sales_value) || 0) >= dailyGoal) count++;
    else break;
  }
  return count;
}
function doMain(r) {
  const trinta = [...r].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30); // limit 30 do main
  return sequenciaDoMain(trinta, EVO, metaDoMain(trinta, EVO, new Date(2026, 8, 28, 15, 0)));
}

test("meta do dia = média dos 30 dias anteriores + 10% (dia sem venda conta zero)", () => {
  const r = resumos((i) => (i <= 30 ? (i % 2 ? 200 : 0) : 999));
  assert.equal(metaDoDia(r, HOJE_STR), 110); // média 100 nos 30 dias antes de hoje
  assert.equal(metaDoDia(r.slice(0, 6), HOJE_STR), null); // menos de 7 dias de base
  assert.equal(metaDoDia(r, HOJE_STR, { franchiseId: "outra" }), null);
});

test("sequência: meta SUBINDO (dia forte ontem) — cada dia contra a meta dele", () => {
  // 100 por dia; 150 de 5 a 2 dias atrás; 3.000 ontem. Meta de cada dia: 110, 112, 114, 116, 117.
  const r = resumos((i) => (i === 1 ? 3000 : i <= 5 ? 150 : 100));
  const { dias } = diasSeguidosBatendoMeta(r, { hoje: HOJE_STR, franchiseId: EVO });
  assert.equal(dias, 5);
  // controle positivo: o main compara com a meta de hoje (~216) e para em 1
  assert.equal(doMain(r), 1);
});

test("sequência: meta CAINDO (dias fortes saindo da janela) — não conta dia que não bateu a sua", () => {
  // 1.000 de 60 a 31 dias atrás, 100 de 30 a 11, 200 nos últimos 10.
  const r = resumos((i) => (i > 30 ? 1000 : i > 10 ? 100 : 200));
  const { dias } = diasSeguidosBatendoMeta(r, { hoje: HOJE_STR, franchiseId: EVO });
  assert.equal(dias, 1); // ontem bateu 176; anteontem não bateu 205
  assert.equal(doMain(r), 10); // controle positivo: o main contava 10 (meta de hoje ~147)
});

test("sequência: resumo de ontem ainda não saiu (cron das 02h) e buraco sem resumo", () => {
  const semOntem = resumos((i) => (i === 1 ? undefined : i <= 4 ? 500 : 100));
  assert.equal(diasSeguidosBatendoMeta(semOntem, { hoje: HOJE_STR, franchiseId: EVO }).dias, 3);
  const buraco = resumos((i) => (i === 3 ? undefined : i <= 5 ? 500 : 100));
  assert.equal(diasSeguidosBatendoMeta(buraco, { hoje: HOJE_STR, franchiseId: EVO }).dias, 2);
});

test("sequência: hoje só SOMA quando já bateu a meta de hoje", () => {
  const r = resumos((i) => (i <= 2 ? 300 : 100)); // meta de hoje = (28×100 + 600)/30 × 1,1 = 125
  assert.deepEqual(diasSeguidosBatendoMeta(r, { hoje: HOJE_STR, franchiseId: EVO, faturamentoHoje: 124 }), { dias: 2, hojeConta: false });
  assert.deepEqual(diasSeguidosBatendoMeta(r, { hoje: HOJE_STR, franchiseId: EVO, faturamentoHoje: 125 }), { dias: 3, hojeConta: true });
  // sem base (menos de 7 dias) não há sequência nem meta
  assert.deepEqual(diasSeguidosBatendoMeta(r.slice(0, 5), { hoje: HOJE_STR, franchiseId: EVO, faturamentoHoje: 9999 }), { dias: 0, hojeConta: false });
});

test("ranking: subiu, caiu, manteve, sem mês anterior", () => {
  assert.deepEqual(deltaRanking({ rank_position: 12, total_franchises: 58, prev_rank_position: 15 }), { type: "up", value: 3 });
  assert.deepEqual(deltaRanking({ rank_position: 12, total_franchises: 58, prev_rank_position: 10 }), { type: "down", value: 2 });
  assert.deepEqual(deltaRanking({ rank_position: 12, total_franchises: 58, prev_rank_position: 12 }), { type: "same", value: 0 });
  assert.equal(deltaRanking({ rank_position: 12, total_franchises: 58, prev_rank_position: null }), null);
  assert.equal(deltaRanking(null), null);
});
