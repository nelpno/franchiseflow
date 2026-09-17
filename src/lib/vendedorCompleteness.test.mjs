// node src/lib/vendedorCompleteness.test.mjs
// Cobre a mesma regra do useMemo `completedSteps` de FranchiseSettings.jsx — a tela
// chama etapasVendedor() em vez de reimplementar isso (ver comentário no topo do lib).
import assert from "node:assert/strict";
import { etapasVendedor } from "./vendedorCompleteness.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FALHOU: ${name}`);
    throw error;
  }
}

const IDENTIDADE_OK = {
  franchise_name: "Maxi Massas Teste",
  street_address: "Rua Teste, 100",
  neighborhood: "Centro",
  city: "Teste - SP",
};

test("completo com entrega: raio + horário + pagamento + agente", () => {
  const r = etapasVendedor({
    ...IDENTIDADE_OK,
    has_delivery: true,
    has_pickup: false,
    max_delivery_radius_km: 20,
    delivery_schedule: [{ days: ["mon"], delivery_start: "18:00", delivery_end: "21:00" }],
    payment_delivery: ["pix"],
    agent_name: "Roberta",
  });
  assert.equal(r.identidade, true);
  assert.equal(r.entrega, true);
  assert.equal(r.pagamento, true);
  assert.equal(r.vendedor, true);
  assert.equal(r.completo, true);
});

test("só retirada, sem raio: entrega não exige raio quando não há entrega ligada", () => {
  const r = etapasVendedor({
    ...IDENTIDADE_OK,
    has_delivery: false,
    has_pickup: true,
    max_delivery_radius_km: null,
    delivery_schedule: [],
    payment_pickup: ["cash"],
    agent_name: "Roberta",
  });
  assert.equal(r.entrega, true);
  assert.equal(r.pagamento, true);
  assert.equal(r.completo, true);
});

test("entrega sem horário fica incompleta (furo do onboarding antigo)", () => {
  const r = etapasVendedor({
    ...IDENTIDADE_OK,
    has_delivery: true,
    has_pickup: false,
    max_delivery_radius_km: 20,
    delivery_schedule: [], // raio preenchido, mas sem dias/horário
    payment_delivery: ["pix"],
    agent_name: "Roberta",
  });
  assert.equal(r.entrega, false);
  assert.equal(r.completo, false);
});

test("nenhuma modalidade ligada (nem entrega nem retirada) fica incompleta", () => {
  const r = etapasVendedor({
    ...IDENTIDADE_OK,
    has_delivery: false,
    has_pickup: false,
    agent_name: "Roberta",
  });
  assert.equal(r.entrega, false);
  assert.equal(r.completo, false);
});

test("sem agent_name fica incompleta mesmo com o resto pronto", () => {
  const r = etapasVendedor({
    ...IDENTIDADE_OK,
    has_delivery: true,
    has_pickup: false,
    max_delivery_radius_km: 20,
    delivery_schedule: [{ days: ["mon"], delivery_start: "18:00", delivery_end: "21:00" }],
    payment_delivery: ["pix"],
    agent_name: "",
  });
  assert.equal(r.vendedor, false);
  assert.equal(r.completo, false);
});

test("etapa pulada: o sinal da etapa continua falso, mas não barra o completo", () => {
  const dados = {
    ...IDENTIDADE_OK,
    has_delivery: true,
    has_pickup: false,
    max_delivery_radius_km: 20,
    delivery_schedule: [{ days: ["mon"], delivery_start: "18:00", delivery_end: "21:00" }],
    payment_delivery: [], // etapa 3 (pagamento) incompleta de propósito
    agent_name: "Roberta",
  };
  const semPular = etapasVendedor(dados);
  assert.equal(semPular.pagamento, false);
  assert.equal(semPular.completo, false);

  const comPular = etapasVendedor(dados, { skippedSteps: [3] });
  assert.equal(comPular.pagamento, false);
  assert.equal(comPular.completo, true);
});

test("dados vazio/undefined não quebra e dá tudo incompleto", () => {
  const r1 = etapasVendedor();
  assert.equal(r1.completo, false);
  const r2 = etapasVendedor(null);
  assert.equal(r2.completo, false);
});

console.log(`${passed} testes de vendedorCompleteness passaram.`);
