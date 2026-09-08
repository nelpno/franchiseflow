import assert from "node:assert/strict";
import { test } from "node:test";
import { unidadesSemVender, unidadesComRoboParado } from "./alertasLeves.js";

const AGORA = new Date("2026-09-08T12:00:00-03:00");

const franquias = [
  { id: "u1", evolution_instance_id: "evo1", name: "Osasco", city: "Osasco - SP" },
  { id: "u2", evolution_instance_id: "evo2", name: "Limeira", city: "Limeira - SP" },
  { id: "u3", evolution_instance_id: "evo3", name: "Araras", city: "Araras - SP" },
  { id: "u4", evolution_instance_id: "evo4", name: "Nova", city: "Bauru - SP" },
];
const configMap = {};

test("sem vender: separa critico (7+) de atencao (3 a 6) e ignora quem vendeu hoje", () => {
  const vendas = [
    { franchise_id: "evo1", sale_date: "2026-09-08" }, // hoje
    { franchise_id: "evo2", sale_date: "2026-09-04" }, // 4 dias
    { franchise_id: "evo3", sale_date: "2026-08-20" }, // 19 dias
  ];
  const { criticas, atencao } = unidadesSemVender({ franchises: franquias, configMap, allSales: vendas, agora: AGORA });
  assert.deepEqual(criticas.map((c) => c.evoId), ["evo3"]);
  assert.equal(criticas[0].days, 19);
  assert.deepEqual(atencao.map((c) => c.evoId), ["evo2"]);
  assert.equal(atencao[0].days, 4);
});

test("sem vender: quem NUNCA vendeu fica de fora (implantacao nao e queda)", () => {
  const { criticas, atencao } = unidadesSemVender({
    franchises: franquias, configMap, allSales: [{ franchise_id: "evo1", sale_date: "2026-09-08" }], agora: AGORA,
  });
  const todos = [...criticas, ...atencao].map((c) => c.evoId);
  assert.ok(!todos.includes("evo4"), "evo4 nunca vendeu e nao pode aparecer");
});

test("sem vender: usa a venda MAIS RECENTE, nao a primeira que aparecer na lista", () => {
  const vendas = [
    { franchise_id: "evo2", sale_date: "2026-07-01" },
    { franchise_id: "evo2", sale_date: "2026-09-06" },
    { franchise_id: "evo2", sale_date: "2026-08-01" },
  ];
  const { criticas, atencao } = unidadesSemVender({ franchises: franquias, configMap, allSales: vendas, agora: AGORA });
  assert.equal(criticas.length, 0, "a venda de 06/09 manda, nao a de 01/07");
  assert.equal(atencao.length, 0, "2 dias ainda nao e alerta");
});

test("sem vender: ordena do mais parado para o menos", () => {
  const vendas = [
    { franchise_id: "evo1", sale_date: "2026-08-30" }, // 9
    { franchise_id: "evo2", sale_date: "2026-08-10" }, // 29
    { franchise_id: "evo3", sale_date: "2026-08-25" }, // 14
  ];
  const { criticas } = unidadesSemVender({ franchises: franquias, configMap, allSales: vendas, agora: AGORA });
  assert.deepEqual(criticas.map((c) => c.days), [29, 14, 9]);
});

test("robo parado: teve conversa na janela, zero nos ultimos 7 dias", () => {
  const resumo = [
    { franchise_id: "evo1", day: "2026-09-07", total: 4 },  // vivo
    { franchise_id: "evo2", day: "2026-07-15", total: 30 }, // parou
    { franchise_id: "evo3", day: "2026-09-01", total: 2 },  // exatamente 7 dias: AINDA conta
  ];
  const paradas = unidadesComRoboParado({ franchises: franquias, configMap, botSummary: resumo, agora: AGORA });
  assert.deepEqual(paradas.map((p) => p.evoId).sort(), ["evo2"]);
});

test("robo parado: a borda de 7 dias e inclusiva — 31/08 ja e parado, 01/09 nao", () => {
  const dentro = unidadesComRoboParado({
    franchises: franquias, configMap, agora: AGORA,
    botSummary: [{ franchise_id: "evo3", day: "2026-09-01", total: 1 }],
  });
  assert.deepEqual(dentro.map((p) => p.evoId), [], "01/09 e o proprio corte: robo vivo");
  const fora = unidadesComRoboParado({
    franchises: franquias, configMap, agora: AGORA,
    botSummary: [{ franchise_id: "evo3", day: "2026-08-31", total: 1 }],
  });
  assert.deepEqual(fora.map((p) => p.evoId), ["evo3"], "31/08 ja esta fora da janela");
});

test("robo parado: quem NUNCA teve conversa fica de fora (nao tem robo != robo parou)", () => {
  const paradas = unidadesComRoboParado({
    franchises: franquias, configMap, botSummary: [{ franchise_id: "evo1", day: "2026-07-01", total: 5 }], agora: AGORA,
  });
  assert.deepEqual(paradas.map((p) => p.evoId), ["evo1"]);
  assert.ok(!paradas.some((p) => p.evoId === "evo4"));
});

test("robo parado: linha com total 0 na janela conta como 'teve robo' mas nao como vivo", () => {
  const resumo = [{ franchise_id: "evo2", day: "2026-09-07", total: 0 }];
  const paradas = unidadesComRoboParado({ franchises: franquias, configMap, botSummary: resumo, agora: AGORA });
  assert.deepEqual(paradas.map((p) => p.evoId), ["evo2"]);
});

test("listas vazias nao quebram", () => {
  assert.deepEqual(unidadesSemVender({}), { criticas: [], atencao: [] });
  assert.deepEqual(unidadesComRoboParado({}), []);
});
