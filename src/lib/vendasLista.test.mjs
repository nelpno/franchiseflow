// node src/lib/vendasLista.test.mjs — lista de vendas (S12.1 e S12.5)
import assert from "node:assert/strict";
import {
  filtrarVendas, resumoVendas, paginar, gruposVisiveis, agruparPorDia, vendasAReceber,
  formatRecebidoEm, rotuloRecebimento, telefoneDaVenda, dataEmBrasilia, PAGINA_VENDAS,
  horaEmBrasilia, diaMes,
} from "./vendasLista.js";
import { getSaleNetValue } from "./financialCalcs.js";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// Fixture: 173 vendas em setembro/2026, valores quebrados, parte a receber, com frete e desconto.
const vendas = [];
for (let i = 0; i < 173; i++) {
  const dia = String(1 + (i % 28)).padStart(2, "0");
  vendas.push({
    id: `v${i}`,
    sale_date: `2026-09-${dia}`,
    created_at: `2026-09-${dia}T1${i % 10}:00:00Z`,
    value: 37.9 + (i % 13) * 11.35,
    discount_amount: i % 7 === 0 ? 5.5 : 0,
    delivery_fee: i % 5 === 0 ? 12 : 0,
    payment_confirmed: i % 4 !== 0,
    confirmed_at: i % 4 !== 0 ? `2026-09-${dia}T23:30:00Z` : null,
    contact_id: i % 3 === 0 ? `c${i % 9}` : null,
    customer_name: `Cliente ${i}`,
  });
}
const base = { period: "month", monthStart: "2026-09-01", monthEnd: "2026-09-30", todayStr: "2026-09-28", weekStart: "2026-09-22" };

test("totais iguais antes e depois da paginação (somando as páginas)", () => {
  const lista = filtrarVendas(vendas, base);
  const r = resumoVendas(lista);
  let visiveis = PAGINA_VENDAS;
  let desenhadas = [];
  // simula "Ver mais 50" até o fim
  for (;;) {
    const { pagina, restantes } = paginar(lista, visiveis);
    desenhadas = pagina;
    if (restantes === 0) break;
    visiveis += PAGINA_VENDAS;
  }
  const soma = desenhadas.reduce((s, v) => s + getSaleNetValue(v), 0);
  assert.equal(desenhadas.length, r.count);
  assert.equal(new Set(desenhadas.map((v) => v.id)).size, r.count); // nada repetido
  assert.equal(Math.round(soma * 100), Math.round(r.total * 100));
  assert.equal(paginar(lista, 50).pagina.length, 50);
  assert.equal(paginar(lista, 50).restantes, 123);
});

test("resumo bate com a soma direta (recebidas + a receber = total)", () => {
  const r = resumoVendas(filtrarVendas(vendas, base));
  const direto = vendas.reduce((s, v) => s + getSaleNetValue(v), 0);
  assert.equal(Math.round(r.total * 100), Math.round(direto * 100));
  assert.equal(Math.round((r.pendingTotal + r.confirmedTotal) * 100), Math.round(r.total * 100));
  assert.equal(r.pendingCount + r.confirmedCount, 173);
});

test("grupos visíveis: cabeçalho com o total do DIA inteiro, mesmo cortado", () => {
  const lista = filtrarVendas(vendas, base);
  const grupos = agruparPorDia(lista, "2026-09-28", "2026-09-27");
  assert.equal(grupos[0].rotulo, "Hoje");
  assert.equal(grupos[1].rotulo, "Ontem");
  assert.equal(grupos[2].rotulo, "26/09");
  const vis = gruposVisiveis(grupos, 8);
  const desenhadas = vis.reduce((s, g) => s + g.vendas.length, 0);
  assert.equal(desenhadas, 8);
  const cortado = vis[vis.length - 1];
  const inteiro = grupos.find((g) => g.dia === cortado.dia);
  assert.ok(cortado.vendas.length < inteiro.vendas.length);
  assert.equal(cortado.quantidade, inteiro.vendas.length);
  assert.equal(cortado.total, inteiro.total);
  const somaGrupos = grupos.reduce((s, g) => s + g.total, 0);
  assert.equal(Math.round(somaGrupos * 100), Math.round(resumoVendas(lista).total * 100));
});

test("filtro 'hoje' e recebimento", () => {
  const hoje = filtrarVendas(vendas, { ...base, period: "today" });
  assert.ok(hoje.length > 0 && hoje.every((v) => v.sale_date === "2026-09-28"));
  const pend = filtrarVendas(vendas, { ...base, confirmationFilter: "pending" });
  assert.ok(pend.length > 0 && pend.every((v) => !v.payment_confirmed));
});

test("a receber: mais antigas primeiro", () => {
  const a = vendasAReceber(vendas);
  assert.ok(a.length > 0 && a.every((v) => !v.payment_confirmed));
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].sale_date <= a[i].sale_date);
});

test("Recebido em dd/mm pelo relógio de Brasília", () => {
  assert.equal(formatRecebidoEm("2026-09-27T23:30:00Z"), "27/09");
  // 02:00Z do dia 28 ainda é dia 27 em Brasília
  assert.equal(formatRecebidoEm("2026-09-28T02:00:00Z"), "27/09");
  assert.equal(formatRecebidoEm(null), null);
  assert.equal(rotuloRecebimento({ payment_confirmed: true, confirmed_at: "2026-09-26T15:00:00Z" }), "Recebido em 26/09");
  assert.equal(rotuloRecebimento({ payment_confirmed: true, confirmed_at: null }), "Recebido");
  assert.equal(rotuloRecebimento({ payment_confirmed: false }), "A receber");
  assert.equal(dataEmBrasilia(new Date("2026-09-28T02:00:00Z")), "2026-09-27");
});

test("telefone da linha: contato, senão o da venda", () => {
  assert.equal(telefoneDaVenda({ contact_id: "c1", contact_phone: "11900000000" }, { c1: { telefone: "11911111111" } }), "11911111111");
  assert.equal(telefoneDaVenda({ contact_id: null, contact_phone: "11900000000" }, {}), "11900000000");
  assert.equal(telefoneDaVenda({}, {}), null);
});

test("hora do lançamento em Brasília e dia/mês da venda", () => {
  assert.equal(horaEmBrasilia("2026-09-28T02:05:00Z"), "23:05");
  assert.equal(horaEmBrasilia(null), "");
  assert.equal(diaMes("2026-09-07"), "07/09");
  assert.equal(diaMes(""), "");
});

console.log(`\n${passed} testes ok`);
