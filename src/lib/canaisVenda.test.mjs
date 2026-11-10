// node src/lib/canaisVenda.test.mjs
import assert from "node:assert/strict";
import {
  totalRs, totalVendas, conversaoRobo, variacaoPct, participacao, resumoAdesao, sinaisUnidade,
  ordenarUnidades, periodoValido, filtroValido, ordemValida, FILTROS_LISTA, textoFatia, comparacaoCurta, baseComparacao,
} from "./canaisVenda.js";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}`); throw e; }
}
const agora = new Date("2026-11-10T21:00:00Z");
const m = (o = {}) => ({
  robo_contatos: 0, robo_compraram: 0, visitas: 0, pedidos_enviados: 0, pedidos_chegaram: 0, pedidos_viraram_venda: 0,
  vendas_cardapio: 0, rs_cardapio: 0, vendas_cardapio_robo: 0, vendas_robo: 0, rs_robo: 0, vendas_manual: 0, rs_manual: 0, ...o,
});

test("total soma os 3 canais uma vez (números do Imirim, 04 a 10/11)", () => {
  const imirim = m({ rs_robo: 842, rs_manual: 1276.26, rs_cardapio: 490.5, vendas_robo: 10, vendas_manual: 12, vendas_cardapio: 4 });
  assert.equal(Math.round(totalRs(imirim) * 100), 260876); // = soma direta de sales no período (bot 1054 + manual 1554,76)
  assert.equal(totalVendas(imirim), 26);
});

test("conversão e variação não inventam número sem base", () => {
  assert.equal(conversaoRobo(m()), null);
  assert.equal(Math.round(conversaoRobo(m({ robo_contatos: 129, robo_compraram: 17 })) * 10), 132);
  assert.equal(variacaoPct(10, 0), null);
  assert.equal(variacaoPct(150, 100), 50);
  assert.equal(participacao(m()), null);
  const p = participacao(m({ rs_robo: 50, rs_cardapio: 25, rs_manual: 25 }));
  assert.deepEqual(p, { robo: 50, cardapio: 25, manual: 25 });
});

test("adesão conta os estados e o total", () => {
  const r = resumoAdesao({ ligado: 7, pronto: 20, pausado_maxi: 40, estado_novo: 3 });
  assert.equal(r.ligado, 7);
  assert.equal(r.falta, 0);
  assert.equal(r.total, 70);
});

test("cardápio ligado há 2+ dias sem visita = divulgar; ligado hoje não acusa", () => {
  const velho = { estado: "ligado", cardapio_desde: "2026-11-05T12:00:00Z", atual: m(), anterior: m() };
  const novo = { estado: "ligado", cardapio_desde: "2026-11-10T20:00:00Z", atual: m(), anterior: m() };
  assert.deepEqual(sinaisUnidade(velho, agora).map((s) => s.id), ["sem_visita"]);
  assert.deepEqual(sinaisUnidade(novo, agora), []);
});

test("controle negativo: unidade sem cardápio e robô estável não tem sinal", () => {
  const guaruja = { estado: "pausado_maxi", atual: m({ robo_contatos: 127, robo_compraram: 29 }), anterior: m({ robo_contatos: 141, robo_compraram: 27 }) };
  assert.deepEqual(sinaisUnidade(guaruja, agora), []);
});

test("visitas sem pedido, pedido que não chega e pedido sem venda", () => {
  const u = { estado: "ligado", cardapio_desde: "2026-11-01", atual: m({ visitas: 40 }), anterior: m() };
  assert.deepEqual(sinaisUnidade(u, agora).map((s) => s.id), ["visita_sem_pedido"]);
  const u2 = { estado: "ligado", atual: m({ visitas: 40, pedidos_enviados: 4 }), anterior: m() };
  assert.deepEqual(sinaisUnidade(u2, agora).map((s) => s.id), ["pedido_nao_chega"]);
  const u3 = { estado: "ligado", atual: m({ visitas: 40, pedidos_enviados: 4, pedidos_chegaram: 3 }), anterior: m() };
  assert.deepEqual(sinaisUnidade(u3, agora).map((s) => s.id), ["pedido_sem_venda"]);
  const u4 = { ...u3, atual: { ...u3.atual, pedidos_viraram_venda: 1 } };
  assert.deepEqual(sinaisUnidade(u4, agora), []);
});

test("queda do robô só com base nos dois períodos, 5 p.p. e 25% relativos", () => {
  const caiu = { estado: "pausado_maxi", atual: m({ robo_contatos: 100, robo_compraram: 10 }), anterior: m({ robo_contatos: 100, robo_compraram: 20 }) };
  assert.equal(sinaisUnidade(caiu, agora)[0].id, "robo_caindo");
  assert.match(sinaisUnidade(caiu, agora)[0].rotulo, /de 20% para 10%/);
  const pouco = { ...caiu, anterior: m({ robo_contatos: 15, robo_compraram: 10 }) };
  assert.deepEqual(sinaisUnidade(pouco, agora), []);
  const leve = { ...caiu, anterior: m({ robo_contatos: 100, robo_compraram: 14 }) };
  assert.deepEqual(sinaisUnidade(leve, agora), []);
  // 6 pontos de 40% (15% relativo) é ruído: não acusa
  const alta = { estado: "ligado", cardapio_desde: "2026-11-10T20:00:00Z", atual: m({ robo_contatos: 100, robo_compraram: 34 }), anterior: m({ robo_contatos: 100, robo_compraram: 40 }) };
  assert.deepEqual(sinaisUnidade(alta, agora), []);
});

test("pronto para ligar é estado, não sinal; fatia pequena não vira 0%", () => {
  const pronto = { estado: "pronto", atual: m(), anterior: m() };
  assert.deepEqual(sinaisUnidade(pronto, agora), []);
  const comSinal = FILTROS_LISTA.find((f) => f.id === "sinal");
  assert.equal(comSinal.match(pronto, agora), false);
  assert.equal(FILTROS_LISTA.find((f) => f.id === "pronto").match(pronto, agora), true);
  assert.equal(textoFatia(0.49), "menos de 1%");
  assert.equal(textoFatia(0), "0%");
  assert.equal(textoFatia(25.6), "26%");
});

test("ordenação: R$, conversão (sem base no fim), queda, nome", () => {
  const a = { nome: "A", atual: m({ rs_robo: 10, robo_contatos: 50, robo_compraram: 5 }), anterior: m({ robo_contatos: 50, robo_compraram: 15 }) };
  const b = { nome: "B", atual: m({ rs_manual: 30, robo_contatos: 50, robo_compraram: 25 }), anterior: m({ robo_contatos: 50, robo_compraram: 25 }) };
  const c = { nome: "C", atual: m({ rs_cardapio: 20, visitas: 9, robo_contatos: 3, robo_compraram: 0 }), anterior: m() };
  const lista = [c, a, b];
  assert.deepEqual(ordenarUnidades(lista, "rs").map((u) => u.nome), ["B", "C", "A"]);
  assert.deepEqual(ordenarUnidades(lista, "conversao").map((u) => u.nome), ["A", "B", "C"]);
  assert.deepEqual(ordenarUnidades(lista, "queda").map((u) => u.nome), ["A", "B", "C"]);
  assert.deepEqual(ordenarUnidades(lista, "cardapio").map((u) => u.nome), ["C", "A", "B"]);
  assert.deepEqual(ordenarUnidades(lista, "nome").map((u) => u.nome), ["A", "B", "C"]);
  assert.deepEqual(lista.map((u) => u.nome), ["C", "A", "B"]); // não muda o original
});

test("comparação curta e com o que compara", () => {
  assert.deepEqual(comparacaoCurta(116, 100), { texto: "+16%", tom: "ok" });
  assert.deepEqual(comparacaoCurta(92, 100), { texto: "−8%", tom: "err" });
  assert.deepEqual(comparacaoCurta(491, 0), { texto: "novo", tom: "neutro" });
  assert.deepEqual(comparacaoCurta(0, 0), { texto: "—", tom: "neutro" });
  assert.deepEqual(comparacaoCurta(100.2, 100), { texto: "0%", tom: "neutro" });
  assert.equal(baseComparacao({ periodo: "7d" }), "semana anterior");
  assert.equal(baseComparacao({ periodo: "mes", inicio_anterior: "2026-10-01", corte_anterior: "2026-10-10T23:39:00Z" }), "mesmo trecho de outubro");
  assert.equal(baseComparacao({ periodo: "mes", inicio_anterior: "2026-02-01", corte_anterior: null }), "fevereiro");
  assert.equal(baseComparacao({ periodo: "mes_anterior", inicio_anterior: "2026-09-01" }), "setembro");
});

test("parâmetros da URL inválidos caem no padrão", () => {
  assert.equal(periodoValido("mes"), "mes");
  assert.equal(periodoValido("30"), "mes");
  assert.equal(periodoValido("7"), "7d");
  assert.equal(periodoValido("90"), "7d");
  assert.equal(filtroValido("x"), "todas");
  assert.equal(ordemValida("x"), "rs");
});

console.log(`canaisVenda: ${passed} testes OK`);
