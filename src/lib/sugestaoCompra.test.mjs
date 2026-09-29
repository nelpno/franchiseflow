// node src/lib/sugestaoCompra.test.mjs — S25: a conta nova da sugestão de compra (chave ui_v2).
// Controle positivo: contra o stockSuggestion.js do main este arquivo FALHA (as funções novas
// não existem), e os casos "regra antiga" abaixo mostram o defeito que a nova corrige.
import assert from "node:assert/strict";
import {
  suggestionFor,
  weeklyTurnoverMap,
  ritmoDeVendaMap,
  intervaloEntrePedidos,
  diasDeCobertura,
  sugestaoDeCompra,
  formatarPorSemana,
  textoIntervalo,
  textoVenda,
  explicarSugestao,
  INTERVALO_PADRAO_DIAS,
} from "./stockSuggestion.js";
import { linhasDeCompra, resumoDeCompra, carregarDatasDePedidos, pedidosNovosDesde, MARGEM_PEDIDO_NOVO_MS } from "./reposicao.js";
import { enviarPedidoFabrica } from "./enviarPedidoFabrica.js";

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };
const DIA = 86400000;
const AGORA = new Date("2026-09-29T15:00:00Z");
const diasAtras = (d) => new Date(AGORA.getTime() - d * DIA).toISOString();
const venda = (id, d, q = 1) => ({ inventory_item_id: id, quantity: q, created_at: diasAtras(d) });
const item = (over) => ({ id: "a", product_name: "Nhoque de Batata - 500g", quantity: 0, min_stock: 0, cost_price: 6.9, created_by_franchisee: false, active: true, unit: "un", ...over });

await t("ritmo = maior entre 4 e 12 semanas (semana fraca não zera o produto)", () => {
  // 12 vendas entre 30 e 80 dias atrás, nenhuma nas últimas 4 semanas
  const vendas = Array.from({ length: 12 }, (_, i) => venda("a", 30 + i * 4));
  const r = ritmoDeVendaMap(vendas, AGORA);
  assert.ok(Math.abs(r.a - 12 / 84) < 1e-9);
  // regra antiga: 0 no giro de 28 dias -> nenhuma sugestão (o defeito)
  const giroAntigo = weeklyTurnoverMap(vendas);
  assert.equal(giroAntigo.a || 0, 0);
  // e a nova sugere
  const s = sugestaoDeCompra(item(), { ritmoPorDia: r.a, intervaloDias: 21 });
  assert.equal(s.repor, Math.ceil((12 / 84) * 33));
});

await t("ritmo pega a alta recente (28 dias maior que 84)", () => {
  const vendas = Array.from({ length: 20 }, (_, i) => venda("a", i + 1));
  const r = ritmoDeVendaMap(vendas, AGORA);
  assert.ok(Math.abs(r.a - 20 / 28) < 1e-9);
});

await t("ritmo ignora venda sem produto, sem data, fora da janela e quantidade inválida", () => {
  const r = ritmoDeVendaMap([
    { inventory_item_id: null, quantity: 5, created_at: diasAtras(1) },
    { inventory_item_id: "a", quantity: 5 },
    venda("a", 90, 9),
    venda("a", 3, "x"),
    venda("a", 3, "2"),
  ], AGORA);
  assert.deepEqual(Object.keys(r), ["a"]);
  assert.ok(Math.abs(r.a - 2 / 28) < 1e-9);
});

await t("intervalo entre pedidos: mediana, acréscimo (<2 dias) não conta, limites 7..35, padrão 21", () => {
  assert.deepEqual(intervaloEntrePedidos([], AGORA), { dias: INTERVALO_PADRAO_DIAS, daUnidade: false });
  assert.deepEqual(intervaloEntrePedidos([diasAtras(10), diasAtras(30)], AGORA), { dias: 21, daUnidade: false });
  // 88, 67, 45, 24, 3 dias atrás -> intervalos 21, 22, 21, 21 -> 21
  assert.deepEqual(intervaloEntrePedidos([88, 67, 45, 24, 3].map(diasAtras), AGORA), { dias: 21, daUnidade: true });
  // acréscimo 1 dia depois não vira intervalo de 1 dia
  assert.deepEqual(intervaloEntrePedidos([43, 29, 28, 15, 1].map(diasAtras), AGORA), { dias: 14, daUnidade: true });
  assert.equal(intervaloEntrePedidos([150, 100, 50, 3].map(diasAtras), AGORA).dias, 35);
  assert.equal(intervaloEntrePedidos([12, 9, 6, 3].map(diasAtras), AGORA).dias, 7);
  // pedido de mais de 180 dias não conta
  assert.equal(intervaloEntrePedidos([300, 250, 10].map(diasAtras), AGORA).daUnidade, false);
});

await t("cobertura = intervalo + 5 dias de entrega + 7 de folga", () => {
  assert.equal(diasDeCobertura(21), 33);
  assert.equal(diasDeCobertura(0), 33);
  assert.equal(diasDeCobertura(14), 26);
});

await t("sugestão: vende 3/semana, pede a cada 3 semanas, tem 2 -> pede o que falta até a entrega seguinte", () => {
  const s = sugestaoDeCompra(item({ quantity: 2, min_stock: 3 }), { ritmoPorDia: 3 / 7, intervaloDias: 21 });
  assert.equal(s.alvo, Math.ceil((3 / 7) * 33)); // 15
  assert.equal(s.repor, 13);
  assert.equal(s.motivo, "venda");
  assert.equal(s.situacao, "acabando"); // 2 < 3/7*7 = 3
  // regra antiga: 2 semanas -> 6 - 2 = 4 (acaba antes da entrega seguinte)
  assert.equal(suggestionFor({ id: "a", quantity: 2, min_stock: 3 }, { a: 3 }), 4);
});

await t("o que está a caminho desconta; estoque negativo conta como zero e avisa", () => {
  const s = sugestaoDeCompra(item({ quantity: -4, min_stock: 3 }), { ritmoPorDia: 1, aCaminho: 10, intervaloDias: 21 });
  assert.equal(s.conta, 0);
  assert.equal(s.estoqueNegativo, true);
  assert.equal(s.repor, 33 - 10);
  assert.equal(s.situacao, "acabou");
  // regra antiga somava o negativo: pedia a mais (6 + 4 = 10 sem a caminho)
  assert.equal(suggestionFor({ id: "a", quantity: -4, min_stock: 3 }, { a: 3 }), 10);
});

await t("mínimo é piso para o que vende; sem venda em 12 semanas não sugere, mesmo com mínimo", () => {
  const piso = sugestaoDeCompra(item({ quantity: 1, min_stock: 3 }), { ritmoPorDia: 1 / 100 });
  assert.equal(piso.repor, 2);
  assert.equal(piso.motivo, "minimo");
  assert.equal(piso.situacao, null);
  // P3 S25 (decisão): o mínimo 3 de fábrica não faz comprar produto parado
  const parado = sugestaoDeCompra(item({ quantity: 0, min_stock: 3 }), { ritmoPorDia: 0 });
  assert.equal(parado.semBase, true);
  assert.equal(parado.repor, 0);
  assert.equal(parado.situacao, "acabou");
  assert.equal(explicarSugestao(parado), "Sem venda nos últimos 3 meses: não sugerimos compra.");
  assert.equal(textoVenda(parado), "sem venda em 3 meses");
  const paradoComEstoque = sugestaoDeCompra(item({ quantity: 1, min_stock: 3 }), { ritmoPorDia: 0 });
  assert.equal(paradoComEstoque.situacao, null);
  const nada = sugestaoDeCompra(item({ quantity: 0, min_stock: 0 }), { ritmoPorDia: 0 });
  assert.equal(nada.semBase, true);
  assert.equal(nada.repor, 0);
  assert.equal(nada.motivo, null);
  assert.equal(nada.situacao, "acabou");
});

await t("situação só quando importa: item que dura mais de 1 semana não é 'acabando' mesmo abaixo do mínimo padrão", () => {
  // vende 1 por mês, tem 2, mínimo 3 (o padrão da rede): a regra antiga marcava "Estoque baixo"
  const s = sugestaoDeCompra(item({ quantity: 2, min_stock: 3 }), { ritmoPorDia: 1 / 30 });
  assert.equal(s.situacao, null);
  assert.equal(s.repor, 1); // mínimo segue como piso
  // o que está a caminho tira o alarme
  const c = sugestaoDeCompra(item({ quantity: 1 }), { ritmoPorDia: 1, aCaminho: 10 });
  assert.equal(c.situacao, null);
});

await t("textos em pt-BR, sem ponto decimal", () => {
  assert.equal(formatarPorSemana(0.8), "~1");
  assert.equal(formatarPorSemana(1.5), "~1,5");
  assert.equal(formatarPorSemana(1.3), "~1,5");
  assert.equal(formatarPorSemana(12.4), "~12");
  assert.equal(formatarPorSemana(0.2), "menos de 1");
  assert.equal(textoIntervalo(21), "a cada ~3 semanas");
  assert.equal(textoIntervalo(14), "a cada ~2 semanas");
  assert.equal(textoIntervalo(8), "a cada ~8 dias");
  assert.equal(textoVenda({ porSemana: 0 }), "sem venda em 3 meses");
  assert.equal(textoVenda({ porSemana: 4.5 }), "vende ~4,5 por semana");
  const s = sugestaoDeCompra(item({ quantity: 2 }), { ritmoPorDia: 3 / 7, aCaminho: 4, intervaloDias: 21 });
  assert.equal(explicarSugestao(s, 21), "Sugerimos 9 porque você vende ~3 por semana e costuma pedir a cada ~3 semanas. Já descontamos o que você tem (2) e o que está a caminho (4).");
  for (const txt of [explicarSugestao(s, 21), textoVenda(s)]) {
    assert.ok(!/margem|amanhã|loja|reserv|separ/i.test(txt));
    assert.ok(!/\d\.\d/.test(txt));
  }
});

await t("linhas: só produto da fábrica visível; ordem acabou > acabando > mais a pedir", () => {
  const itens = [
    item({ id: "ok", product_name: "B", quantity: 30 }),
    item({ id: "acab", product_name: "C", quantity: 1 }),
    item({ id: "zero", product_name: "D", quantity: 0 }),
    item({ id: "proprio", product_name: "E", created_by_franchisee: true }),
    item({ id: "oculto", product_name: "F", active: false }),
    item({ id: "semcusto", product_name: "G", cost_price: 0 }),
  ];
  const ritmo = { ok: 1, acab: 1, zero: 0.5 };
  const linhas = linhasDeCompra(itens, { ritmo, emAberto: {}, intervaloDias: 21 });
  assert.deepEqual(linhas.map((l) => l.item.id), ["zero", "acab", "ok"]);
  const r = resumoDeCompra(linhas);
  assert.equal(r.acabando, 2);
  assert.deepEqual(r.quantidades, { zero: 17, acab: 32, ok: 3 });
  assert.equal(r.unidades, 52);
});

await t("carregarDatasDePedidos: 180 dias inteiros paginados (sem teto), só status válidos, rejeita no erro", async () => {
  let pedido;
  const PurchaseOrder = { filter: async (crit, ord, lim, opts) => { pedido = { crit, ord, lim, opts }; return [
    { id: 1, status: "entregue", ordered_at: "2026-09-01T10:00:00Z" },
    { id: 2, status: "cancelado", ordered_at: "2026-09-10T10:00:00Z" },
    { id: 3, status: "pendente", ordered_at: null },
  ]; } };
  const datas = await carregarDatasDePedidos({ PurchaseOrder, franchiseId: "x", agora: AGORA });
  assert.deepEqual(datas, ["2026-09-01T10:00:00Z"]);
  assert.deepEqual(pedido.crit.status, ["pendente", "confirmado", "em_rota", "entregue"]);
  assert.equal(pedido.lim, undefined); // P3: o teto de 12 distorcia a mediana
  assert.equal(pedido.opts.fetchAll, true);
  assert.equal(pedido.opts.gte.ordered_at, diasAtras(180));
  // o caso da P3: 12 pedidos nas últimas horas + pedidos a cada 14 dias antes -> 14, não 21
  const muitos = [...Array.from({ length: 12 }, (_, i) => new Date(AGORA.getTime() - i * 3600000).toISOString()), diasAtras(14), diasAtras(28), diasAtras(42)];
  assert.equal(intervaloEntrePedidos(muitos, AGORA).dias, 14);
  assert.equal(intervaloEntrePedidos(muitos.slice(0, 12), AGORA).daUnidade, false);
  await assert.rejects(carregarDatasDePedidos({ PurchaseOrder: { filter: async () => { throw new Error("rede"); } }, franchiseId: "x" }));
  await assert.rejects(carregarDatasDePedidos({ PurchaseOrder, franchiseId: null }));
});

await t("backtest sintético: venda salteada, pedido a cada 3 semanas -> a regra nova falta bem menos", () => {
  // produto que vende ~1 a cada 2 dias, com semanas vazias; 20 semanas; pedido a cada 21 dias, chega em 5
  let semente = 7;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const dias = 140;
  const procura = Array.from({ length: dias + 84 }, (_, d) => (Math.floor(d / 7) % 3 === 2 ? 0 : rnd() < 0.7 ? 1 : 0));
  const simular = (regra) => {
    let est = 5, faltou = 0, total = 0;
    const chegadas = {};
    for (let d = 84; d < 84 + dias; d++) {
      if (chegadas[d]) est += chegadas[d];
      if ((d - 84) % 21 === 0) {
        const hist = procura.slice(0, d).map((q, i) => ({ inventory_item_id: "a", quantity: q, created_at: new Date(AGORA.getTime() - (d - i - 0.5) * DIA).toISOString() })).filter((v) => v.quantity > 0);
        const aCaminho = Object.entries(chegadas).filter(([k]) => +k > d).reduce((s, [, q]) => s + q, 0);
        const q = regra(hist, est, aCaminho);
        chegadas[d + 5] = (chegadas[d + 5] || 0) + q;
      }
      total += procura[d];
      const serve = Math.min(procura[d], Math.max(est, 0));
      faltou += procura[d] - serve;
      est -= serve;
    }
    return faltou / total;
  };
  const antiga = simular((hist, est, aCaminho) => suggestionFor({ id: "a", quantity: est + aCaminho, min_stock: 3 }, weeklyTurnoverMap(hist.map((h) => ({ ...h, created_at: new Date(Date.now() - (AGORA.getTime() - new Date(h.created_at).getTime())).toISOString() })))) || 0);
  const nova = simular((hist, est, aCaminho) => sugestaoDeCompra({ quantity: est, min_stock: 3 }, { ritmoPorDia: ritmoDeVendaMap(hist, AGORA).a || 0, aCaminho, intervaloDias: 21 }).repor);
  console.log(`   faltou: antiga ${(antiga * 100).toFixed(0)}% x nova ${(nova * 100).toFixed(0)}% da procura`);
  assert.ok(nova < antiga / 2, `nova ${nova.toFixed(2)} x antiga ${antiga.toFixed(2)}`);
});

await t("dois aparelhos: pedido feito depois que o formulário abriu é pego; o próprio e o cancelado não", () => {
  const aberto = Date.parse("2026-09-29T12:00:00Z");
  const ID = "11111111-2222-4333-8444-555555555555";
  const pedidos = [
    { id: "velho", status: "entregue", ordered_at: "2026-09-20T10:00:00Z" },
    { id: "outro", status: "pendente", ordered_at: "2026-09-29T12:05:00Z" },
    { id: "cancelado", status: "cancelado", ordered_at: "2026-09-29T12:06:00Z" },
    { id: ID, status: "pendente", ordered_at: "2026-09-29T12:07:00Z" },
    { id: "relogio", status: "pendente", ordered_at: new Date(aberto - MARGEM_PEDIDO_NOVO_MS + 1000).toISOString() },
  ];
  assert.deepEqual(pedidosNovosDesde(pedidos, aberto, ID).map((p) => p.id), ["outro", "relogio"]);
  assert.deepEqual(pedidosNovosDesde(null, aberto, ID), []);
});

await t("envio: pedido que já existia devolve o status (cancelado pela Maxi não passa por sucesso comum)", async () => {
  const r = await enviarPedidoFabrica({
    rpc: async (f, p) => ({ data: { id: p.p_client_id, ja_existia: true, status: "cancelado", total_amount: 10 }, error: null }),
    clientId: "11111111-2222-4333-8444-555555555555", franchiseId: "u", itens: [{ inventory_item_id: "a", quantity: 1 }], notes: null,
  });
  assert.equal(r.jaExistia, true);
  assert.equal(r.status, "cancelado");
});

console.log(`\n${n} testes ok`);
