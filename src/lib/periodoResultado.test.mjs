// node src/lib/periodoResultado.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIM_SEM_LIMITE,
  INICIO_SEM_LIMITE,
  MODO_MES,
  MODO_PERSONALIZADO,
  MODO_TOTAL,
  intervaloCobre,
  intervaloDoPeriodo,
  montarResultadoPeriodo,
  recortarPeriodo,
  uniaoIntervalos,
  validarIntervalo,
} from "./periodoResultado.js";
import { montarResultadoMes } from "./monthlyReport.js";
import { calculatePnL } from "./financialCalcs.js";

const HOJE = new Date(2026, 9, 13); // 13/10/2026

const sales = [
  { id: "s1", sale_date: "2026-08-31", value: 100, discount_amount: 0, delivery_fee: 10, card_fee_amount: 4, fee_passed_to_customer: false, source: "bot", payment_method: "pix" },
  { id: "s2", sale_date: "2026-09-01", value: 50, discount_amount: 5, delivery_fee: 0, card_fee_amount: 0, source: "manual", payment_method: "pix" },
  { id: "s3", sale_date: "2026-09-15", value: 80, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "manual", payment_method: "dinheiro" },
  { id: "s4", sale_date: "2026-10-02", value: 70, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "bot", payment_method: "pix" },
];
const saleItems = [
  { sale_id: "s1", product_name: "Nhoque", quantity: 2, unit_price: 50 },
  { sale_id: "s2", product_name: "Rondelli", quantity: 1, unit_price: 50 },
  { sale_id: "s3", product_name: "Nhoque", quantity: 1, unit_price: 80 },
  { sale_id: "s4", product_name: "Canelone", quantity: 1, unit_price: 70 },
];
const expenses = [
  { id: "e1", expense_date: "2026-08-10", category: "compra_produto", amount: 30 },
  { id: "e2", expense_date: "2026-09-15", category: "marketing", amount: 20 },
  { id: "e3", expense_date: "2026-10-01", category: "pacote_sistema", amount: 150 },
];
const dados = { sales, saleItems, expenses };

test("modo Mês: o intervalo é o mês em tela inteiro", () => {
  assert.deepEqual(intervaloDoPeriodo({ modo: MODO_MES }, { mes: new Date(2026, 8, 20), hoje: HOJE }), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(intervaloDoPeriodo({ modo: MODO_MES }, { mes: new Date(2024, 1, 3), hoje: HOJE }), { de: "2024-02-01", ate: "2024-02-29" });
});

test("modo Mês: montarResultadoPeriodo de um mês = montarResultadoMes do mesmo mês (mesma regra)", () => {
  const p = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_PERSONALIZADO }, de: "2026-09-01", ate: "2026-09-30" });
  const m = montarResultadoMes({ ...dados, mesSelecionado: new Date(2026, 8, 1), hoje: HOJE });
  assert.equal(p.entrou, m.entrou);
  assert.equal(p.saiu, m.saiu);
  assert.equal(p.sobrou, m.sobrou);
  assert.deepEqual(p.deOndeVeio, m.deOndeVeio);
  assert.deepEqual(p.paraOndeFoi, m.paraOndeFoi);
  assert.deepEqual(p.produtos, m.produtos);
});

test("Desde o início: busca sem piso nem teto; gráfico até o fim do mês atual; soma = histórico inteiro", () => {
  const iv = intervaloDoPeriodo({ modo: MODO_TOTAL }, { hoje: HOJE });
  assert.deepEqual(iv, { de: INICIO_SEM_LIMITE, ate: FIM_SEM_LIMITE });
  const p = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_TOTAL }, ...iv, hoje: HOJE });
  const pnl = calculatePnL(sales, saleItems, expenses);
  assert.equal(p.sobrou, pnl.lucroCaixa);
  assert.equal(p.mes.vendas, 4);
  assert.equal(p.recorte.expenses.length, 3);
  // rótulo e gráfico partem do 1º lançamento real (10/08), não de 2000
  assert.equal(p.periodo.rotulo, "Desde 10/08/2026");
  assert.deepEqual(p.porMes.map((m) => m.chave), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(p.porMes.map((m) => m.atual), [false, false, true]);
  assert.equal(p.periodo.ate, "2026-10-31"); // o teto técnico (9999) nunca aparece
  // soma das barras = total do período
  assert.equal(Math.round(p.porMes.reduce((s, m) => s + m.sobrou, 0) * 100), Math.round(p.sobrou * 100));
  assert.equal(p.comparacao, null);
  assert.deepEqual(p.oQueMudou, []);
  assert.equal(p.relatorio, null);
});

test("Desde o início sem nenhum lançamento: vazio, sem gráfico", () => {
  const p = montarResultadoPeriodo({ periodo: { modo: MODO_TOTAL }, de: INICIO_SEM_LIMITE, ate: FIM_SEM_LIMITE, hoje: HOJE });
  assert.equal(p.temDado, false);
  assert.equal(p.periodo.rotulo, "Desde o início");
  assert.deepEqual(p.porMes, []);
  assert.equal(p.sobrou, 0);
});

test("Personalizado de 1 dia: só o que tem aquela data", () => {
  const iv = intervaloDoPeriodo({ modo: MODO_PERSONALIZADO, de: "2026-09-15", ate: "2026-09-15" }, { hoje: HOJE });
  assert.deepEqual(iv, { de: "2026-09-15", ate: "2026-09-15" });
  const p = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_PERSONALIZADO }, ...iv });
  assert.deepEqual(p.recorte.sales.map((s) => s.id), ["s3"]);
  assert.deepEqual(p.recorte.expenses.map((e) => e.id), ["e2"]);
  assert.equal(p.entrou, 80);
  assert.equal(p.saiu, 20);
  assert.equal(p.sobrou, 60);
  assert.equal(p.periodo.rotulo, "15/09/2026");
  assert.equal(p.porMes.length, 1);
});

test("Personalizado cruzando o mês: as duas pontas entram, o mês da ponta só com os dias do período", () => {
  const iv = intervaloDoPeriodo({ modo: MODO_PERSONALIZADO, de: "2026-08-31", ate: "2026-09-01" }, { hoje: HOJE });
  const p = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_PERSONALIZADO }, ...iv });
  assert.deepEqual(p.recorte.sales.map((s) => s.id), ["s1", "s2"]);
  assert.deepEqual(p.recorte.saleItems.map((si) => si.sale_id), ["s1", "s2"]);
  assert.deepEqual(p.recorte.expenses, []); // e1 é 10/08, fora
  assert.equal(p.entrou, 110 + 45);
  assert.equal(p.periodo.rotulo, "31/08/2026 a 01/09/2026");
  assert.deepEqual(p.porMes.map((m) => [m.chave, m.temDado]), [["2026-08", true], ["2026-09", true]]);
  assert.deepEqual(p.limites, { de: "2026-08-31", ate: "2026-09-01" });
});

test("fim antes do início: recusa (validação e intervalo null)", () => {
  assert.equal(validarIntervalo("2026-09-10", "2026-09-01", "2026-10-13"), "A data final vem antes da inicial.");
  assert.equal(intervaloDoPeriodo({ modo: MODO_PERSONALIZADO, de: "2026-09-10", ate: "2026-09-01" }, { hoje: HOJE }), null);
});

test("validação: datas vazias e fim no futuro recusam; mesmo dia e até hoje passam", () => {
  assert.equal(validarIntervalo("", "2026-09-01", "2026-10-13"), "Escolha as duas datas.");
  assert.equal(validarIntervalo("2026-10-01", "2026-10-14", "2026-10-13"), "A data final não pode ser depois de hoje.");
  assert.equal(validarIntervalo("2026-10-13", "2026-10-13", "2026-10-13"), null);
  assert.equal(validarIntervalo("2020-01-01", "2026-10-13", "2026-10-13"), null); // sem teto de tamanho
});

test("recorte usa created_at quando não há data própria", () => {
  const r = recortarPeriodo({ sales: [{ id: "x", created_at: "2026-09-02T10:00:00+00:00" }], expenses: [{ id: "y", created_at: "2026-09-03T10:00:00+00:00" }] }, "2026-09-01", "2026-09-02");
  assert.deepEqual(r.sales.map((s) => s.id), ["x"]);
  assert.deepEqual(r.expenses, []);
});

test("janela da carga: cobre/união nunca encolhem", () => {
  const carregado = { start: "2025-09-01", end: "2026-10-31" };
  assert.equal(intervaloCobre(carregado, { start: "2026-01-01", end: "2026-02-01" }), true);
  assert.equal(intervaloCobre(carregado, { start: INICIO_SEM_LIMITE, end: "2026-10-31" }), false);
  assert.equal(intervaloCobre(null, { start: "2026-01-01", end: "2026-02-01" }), false);
  assert.deepEqual(uniaoIntervalos(carregado, { start: INICIO_SEM_LIMITE, end: "2026-10-31" }), { start: INICIO_SEM_LIMITE, end: "2026-10-31" });
  assert.deepEqual(uniaoIntervalos(carregado, { start: "2026-01-01", end: "2026-02-01" }), carregado);
  assert.deepEqual(uniaoIntervalos(null, { start: "2026-01-01", end: "2026-02-01" }), { start: "2026-01-01", end: "2026-02-01" });
});

test("período longo: gráfico com os últimos 12 meses, totais do período inteiro", () => {
  const muitas = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(2025, 4 + i, 5);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-05`;
    muitas.push({ id: `m${i}`, sale_date: iso, value: 10, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0 });
  }
  const p = montarResultadoPeriodo({ sales: muitas, periodo: { modo: MODO_TOTAL }, de: INICIO_SEM_LIMITE, ate: FIM_SEM_LIMITE, hoje: HOJE });
  assert.equal(p.periodo.mesesNoPeriodo, 18);
  assert.equal(p.porMes.length, 12);
  assert.equal(p.porMes[0].chave, "2025-11");
  assert.equal(p.ano.mesesComDado, 18);
  assert.equal(p.sobrou, 180);
});

test("revisão 01e370d: início antes de 01/01/2000 (ano 0026 digitado errado) é recusado", () => {
  assert.equal(validarIntervalo("0026-10-01", "2026-10-13", "2026-10-13"), "A data inicial não pode ser antes de 01/01/2000.");
  assert.equal(intervaloDoPeriodo({ modo: MODO_PERSONALIZADO, de: "0026-10-01", ate: "2026-10-13" }, { hoje: HOJE }), null);
  assert.equal(validarIntervalo("1999-12-31", "2026-10-13", "2026-10-13"), "A data inicial não pode ser antes de 01/01/2000.");
  assert.equal(validarIntervalo(INICIO_SEM_LIMITE, "2026-10-13", "2026-10-13"), null);
});

test("revisão 01e370d: Desde o início conta a venda do robô com data de entrega no mês seguinte", () => {
  const futura = { id: "s5", sale_date: "2026-11-04", value: 60, discount_amount: 0, delivery_fee: 0, card_fee_amount: 0, source: "bot", payment_method: "pix" };
  const todas = [...sales, futura];
  const iv = intervaloDoPeriodo({ modo: MODO_TOTAL }, { hoje: HOJE });
  const p = montarResultadoPeriodo({ sales: todas, saleItems, expenses, periodo: { modo: MODO_TOTAL }, ...iv, hoje: HOJE });
  assert.equal(p.sobrou, calculatePnL(todas, saleItems, expenses).lucroCaixa);
  assert.equal(p.entrou, 110 + 45 + 80 + 70 + 60);
  assert.ok(p.recorte.sales.some((s) => s.id === "s5"));
  assert.equal(p.periodo.rotulo, "Desde 10/08/2026");
  assert.equal(p.periodo.ate, "2026-11-30");
  assert.deepEqual(p.limites, { de: "2026-08-10", ate: "2026-11-30" });
  assert.deepEqual(p.porMes.map((m) => [m.chave, m.atual]), [["2026-08", false], ["2026-09", false], ["2026-10", true], ["2026-11", false]]);
  assert.equal(Math.round(p.porMes.reduce((s, m) => s + m.sobrou, 0) * 100), Math.round(p.sobrou * 100));
});

test("revisão 01e370d: no Personalizado a barra 'atual' é só o mês corrente de verdade", () => {
  const passado = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_PERSONALIZADO }, de: "2026-08-01", ate: "2026-09-30", hoje: HOJE });
  assert.deepEqual(passado.porMes.map((m) => m.atual), [false, false]);
  const ateHoje = montarResultadoPeriodo({ ...dados, periodo: { modo: MODO_PERSONALIZADO }, de: "2026-09-01", ate: "2026-10-13", hoje: HOJE });
  assert.deepEqual(ateHoje.porMes.map((m) => [m.chave, m.atual]), [["2026-09", false], ["2026-10", true]]);
});

test("revisão 01e370d: a janela de 'Desde o início' cobre qualquer mês (voltar para Mês não busca de novo)", () => {
  const total = { start: INICIO_SEM_LIMITE, end: FIM_SEM_LIMITE };
  assert.equal(intervaloCobre(total, { start: "2025-09-01", end: "2026-11-30" }), true);
  assert.equal(intervaloCobre({ start: "2025-09-01", end: "2026-10-31" }, total), false);
});
