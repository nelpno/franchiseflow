// node src/lib/networkOverview.test.mjs
import assert from "node:assert/strict";
import { FILTROS, aplicarFiltro, buscar, contarFiltros, isFiltroValido, nomeCurto, nomesResumo, resumoRede } from "./networkOverview.js";

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

const base = {
  is_new: false, days_since_last_sale: 1, days_since_last_bot: 0, rev_delta_pct: null,
  rev_mtd: 1000, rev_prev_same: 1000, rev_90d: 3000,
  marketing_month_paid: true, marketing_target_paid: false, onboarding_pct: 100,
};
const u = (over) => ({ ...base, ...over });

test("nova sem venda fica só em Novas, nunca em Sem venda", () => {
  const r = u({ is_new: true, days_since_last_sale: null });
  assert.equal(FILTROS.sem_venda.match(r), false);
  assert.equal(FILTROS.novas.match(r), true);
});

test("unidade antiga que nunca vendeu entra em Sem venda", () => {
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: null })), true);
});

test("sem venda: 7 entra, 6 não", () => {
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: 7 })), true);
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: 6 })), false);
});

test("robô sem histórico (null) não conta como parado", () => {
  assert.equal(FILTROS.robo_parado.match(u({ days_since_last_bot: null })), false);
  assert.equal(FILTROS.robo_parado.match(u({ days_since_last_bot: 7 })), true);
});

test("delta null (base abaixo do piso) fica fora de caiu e subiu", () => {
  const r = u({ rev_delta_pct: null });
  assert.equal(FILTROS.caiu.match(r), false);
  assert.equal(FILTROS.subiu.match(r), false);
});

test("delta vem como string do PostgREST", () => {
  assert.equal(FILTROS.caiu.match(u({ rev_delta_pct: "-20.0" })), true);
  assert.equal(FILTROS.subiu.match(u({ rev_delta_pct: "19.9" })), false);
});

test("sem verba: pagou o mês-alvo já basta", () => {
  assert.equal(FILTROS.sem_verba.match(u({ marketing_month_paid: false, marketing_target_paid: true })), false);
  assert.equal(FILTROS.sem_verba.match(u({ marketing_month_paid: false, marketing_target_paid: false })), true);
});

test("filtro inválido cai em todas", () => {
  assert.equal(isFiltroValido("xyz"), false);
  assert.equal(isFiltroValido("toString"), false);
  assert.equal(aplicarFiltro([u({}), u({})], "xyz").length, 2);
});

test("caiu ordena da maior queda para a menor", () => {
  const out = aplicarFiltro([u({ franchise_name: "A", rev_delta_pct: -25 }), u({ franchise_name: "B", rev_delta_pct: -60 })], "caiu");
  assert.deepEqual(out.map((r) => r.franchise_name), ["B", "A"]);
});

test("contagem do chip = tamanho da lista filtrada", () => {
  const rows = [u({}), u({ days_since_last_sale: 10 }), u({ is_new: true }), u({ rev_delta_pct: -30 })];
  const c = contarFiltros(rows);
  for (const k of Object.keys(c)) assert.equal(c[k], aplicarFiltro(rows, k).length, k);
  assert.equal(c.todas, 4);
});

test("busca ignora acento e caixa", () => {
  const rows = [u({ franchise_name: "Vila dos Remédios" }), u({ franchise_name: "Itatiba", owner_name: "Gustavo" })];
  assert.equal(buscar(rows, "remedios").length, 1);
  assert.equal(buscar(rows, "GUSTAVO").length, 1);
  assert.equal(buscar(rows, "  ").length, 2);
});

test("resumo da rede: delta em %, 1 casa", () => {
  const r = resumoRede([u({ rev_mtd: 95, rev_prev_same: 100 }), u({ rev_mtd: 0, rev_prev_same: 0, days_since_last_sale: null })]);
  assert.equal(r.deltaPct, -5);
  assert.equal(r.venderam7d, 1);
  assert.equal(r.abaixo, 1);
  assert.equal(r.acima, 0);
});

test("resumo sem base anterior não inventa %", () => {
  assert.equal(resumoRede([u({ rev_mtd: 10, rev_prev_same: 0 })]).deltaPct, null);
});

test("nomesResumo", () => {
  const rs = ["A", "B", "C", "D", "E"].map((n) => ({ franchise_name: n }));
  assert.equal(nomesResumo(rs), "A, B, C e mais 2");
  assert.equal(nomesResumo(rs.slice(0, 2)), "A, B");
});

test("nomeCurto tira o prefixo da marca", () => {
  assert.equal(nomeCurto("Maxi Massas Vila Maria"), "Vila Maria");
  assert.equal(nomeCurto("maxi massas - Itatiba"), "Itatiba");
  assert.equal(nomeCurto("Maxi Massas"), "Maxi Massas");
  assert.equal(nomeCurto("Santos"), "Santos");
});

console.log(`networkOverview: ${passed} testes ok`);
