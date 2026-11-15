// node src/components/pedidos/pedidosHelpers.test.mjs
import assert from "node:assert";
import {
  isAcionavel,
  diasDesdePedido,
  haNDiasLabel,
  diasDesdeConfirmacao,
  linhaEsperaLabel,
  isAtrasado,
  freteLabel,
  formatKg,
  caminhoesLabel,
  somaPedidos,
  ordenarPorEsperaAsc,
  filtrarPorTermo,
  isDeletable,
  freteSugerido,
  parseFrete,
  freteSalvo,
  freteParaTexto,
  estadoFrete,
  freteNaConfirmacao,
  pedidoAbertoMaisAntigoPorUnidade,
  ehAcrescimo,
  ultimoFretePorUnidade,
  mensagemChamarPedido,
  dataBRT,
  meioDiaBRT,
  resumoLote,
  pedidosLabel,
  mesAtualBRT,
  limitesMesBRT,
  ateDiaBRT,
  diasPedidoAteEntrega,
  resumoEntregas,
} from "./pedidosHelpers.js";

// Horário fixo (meio-dia BRT) — nunca `new Date().toISOString()` puro: entre 21h e 24h BRT o
// UTC já é o dia seguinte, e o teste passaria a horas erradas dependendo de quando rodasse
// (achado 26/09: `isAtrasado`/`diasDesdeConfirmacao` ficavam errados nessa janela).
function diasAtras(n) {
  return meioDiaBRT(dataBRT(-n));
}

// isAcionavel
assert.strictEqual(isAcionavel({ status: "pendente" }), true);
assert.strictEqual(isAcionavel({ status: "confirmado" }), true);
assert.strictEqual(isAcionavel({ status: "entregue" }), false);
assert.strictEqual(isAcionavel({ status: "cancelado" }), false);
assert.strictEqual(isAcionavel(null), false);

// diasDesdePedido / haNDiasLabel
assert.strictEqual(diasDesdePedido({ ordered_at: diasAtras(4) }), 4);
assert.strictEqual(diasDesdePedido({}), null);
assert.strictEqual(haNDiasLabel({ ordered_at: diasAtras(0) }), "hoje");
assert.strictEqual(haNDiasLabel({ ordered_at: diasAtras(1) }), "há 1 dia");
assert.strictEqual(haNDiasLabel({ ordered_at: diasAtras(4) }), "há 4 dias");
assert.strictEqual(haNDiasLabel({}), "");

// isAtrasado (26/09): pendente > 3 dias (contado do pedido); confirmado > 5 dias,
// contado da CONFIRMAÇÃO (confirmed_at) — sem confirmed_at (pedido antigo, sem backfill),
// cai no fallback de ordered_at.
assert.strictEqual(isAtrasado({ status: "pendente", ordered_at: diasAtras(3) }), false);
assert.strictEqual(isAtrasado({ status: "pendente", ordered_at: diasAtras(4) }), true);
assert.strictEqual(isAtrasado({ status: "confirmado", confirmed_at: diasAtras(1), ordered_at: diasAtras(9) }), false);
assert.strictEqual(isAtrasado({ status: "confirmado", confirmed_at: diasAtras(6), ordered_at: diasAtras(9) }), true);
assert.strictEqual(isAtrasado({ status: "confirmado", ordered_at: diasAtras(5) }), false); // fallback: 5 não é > 5
assert.strictEqual(isAtrasado({ status: "confirmado", ordered_at: diasAtras(11) }), true); // fallback
assert.strictEqual(isAtrasado({ status: "entregue", ordered_at: diasAtras(30) }), false);

// diasDesdeConfirmacao / linhaEsperaLabel
assert.strictEqual(diasDesdeConfirmacao({ confirmed_at: diasAtras(2) }), 2);
assert.strictEqual(diasDesdeConfirmacao({ ordered_at: diasAtras(9) }), 9); // fallback sem confirmed_at
assert.strictEqual(diasDesdeConfirmacao({}), null);
assert.strictEqual(
  linhaEsperaLabel({ status: "confirmado", confirmed_at: diasAtras(2), ordered_at: diasAtras(6) }),
  `confirmado há 2 dias · pedido em ${new Date(diasAtras(6)).toLocaleDateString("pt-BR")}`
);
assert.ok(linhaEsperaLabel({ status: "pendente", ordered_at: diasAtras(3) }).startsWith("pedido há 3 dias"));

// freteLabel: frete zero é legítimo -> null (não "erro"), nunca aparece como pendência
assert.strictEqual(freteLabel({ freight_cost: 0 }), null);
assert.strictEqual(freteLabel({ freight_cost: null }), null);
assert.strictEqual(freteLabel({ freight_cost: "120.50" }), 120.5);

// formatKg / caminhoesLabel
assert.strictEqual(formatKg(958.4), "958,4 kg");
assert.strictEqual(formatKg(0), "0 kg");
assert.strictEqual(caminhoesLabel(958), "1 caminhão de 1.500 kg");
assert.strictEqual(caminhoesLabel(1500), "1 caminhão de 1.500 kg");
assert.strictEqual(caminhoesLabel(1501), "2 caminhões de 1.500 kg");
assert.strictEqual(caminhoesLabel(0), null);

// somaPedidos
const soma = somaPedidos([
  { total_amount: "100.5", total_weight_kg: "10" },
  { total_amount: "50", total_weight_kg: "5.5" },
]);
assert.strictEqual(soma.total, 150.5);
assert.strictEqual(soma.kg, 15.5);

// ordenarPorEsperaAsc
const ord = ordenarPorEsperaAsc([
  { id: "b", ordered_at: diasAtras(1) },
  { id: "a", ordered_at: diasAtras(5) },
]);
assert.deepStrictEqual(ord.map((o) => o.id), ["a", "b"]);

// filtrarPorTermo
const nomeFn = (fid) => ({ f1: "Hortolândia", f2: "Ubatuba" })[fid] || "";
const filtrado = filtrarPorTermo(
  [{ franchise_id: "f1" }, { franchise_id: "f2" }],
  "horto",
  nomeFn
);
assert.strictEqual(filtrado.length, 1);
assert.strictEqual(filtrado[0].franchise_id, "f1");
assert.strictEqual(filtrarPorTermo([{ franchise_id: "f1" }], "", nomeFn).length, 1);

// isDeletable
assert.strictEqual(isDeletable({ status: "pendente" }), true);
assert.strictEqual(isDeletable({ status: "cancelado" }), true);
assert.strictEqual(isDeletable({ status: "confirmado" }), false);
assert.strictEqual(isDeletable({ status: "entregue" }), false);

// freteSugerido: min(350, max(250, 10%)) arredondado para a dezena (como o Nelson digita)
assert.strictEqual(freteSugerido(135), 250);          // pedido pequeno: piso
assert.strictEqual(freteSugerido(2500), 250);
assert.strictEqual(freteSugerido(2702.3), 270);       // real: digitado 270
assert.strictEqual(freteSugerido(3001.3), 300);       // real: digitado 300
assert.strictEqual(freteSugerido(2592.7), 260);       // real: digitado 260
assert.strictEqual(freteSugerido(9652.2), 350);       // teto
assert.strictEqual(freteSugerido("3600.80"), 350);
assert.strictEqual(freteSugerido(null), 250);

// parseFrete
assert.strictEqual(parseFrete(""), 0);                // vazio = sem frete
assert.strictEqual(parseFrete("  "), 0);
assert.strictEqual(parseFrete("250"), 250);
assert.strictEqual(parseFrete("250,5"), 250.5);
assert.strictEqual(parseFrete("250.5"), 250.5);
assert.strictEqual(parseFrete("R$ 1.250,50"), 1250.5);
assert.strictEqual(parseFrete("0"), 0);
assert.ok(Number.isNaN(parseFrete("abc")));
assert.ok(Number.isNaN(parseFrete("-10")));
assert.ok(Number.isNaN(parseFrete("1.2.3")));

// freteSalvo / freteParaTexto
assert.strictEqual(freteSalvo({ freight_cost: null }), null);
assert.strictEqual(freteSalvo({ freight_cost: "0.00" }), 0);
assert.strictEqual(freteSalvo({ freight_cost: "400.00" }), 400);
assert.strictEqual(freteParaTexto(400), "400");
assert.strictEqual(freteParaTexto(125.5), "125,50");
assert.strictEqual(freteParaTexto(null), "");

// estadoFrete: salvo nunca é trocado pela sugestão; sugestão só onde a seção pede
const pNovo = { total_amount: 3001.3, freight_cost: null };
const pDistancia = { total_amount: 3001.3, freight_cost: 450 };
const pZero = { total_amount: 3001.3, freight_cost: 0 };
assert.deepStrictEqual(estadoFrete(pNovo, undefined, { sugerir: true }), { texto: "300", origem: "sugerido" });
assert.deepStrictEqual(estadoFrete(pNovo, undefined, { sugerir: false }), { texto: "", origem: "vazio" });
assert.deepStrictEqual(estadoFrete(pDistancia, undefined, { sugerir: true }), { texto: "450", origem: "salvo" });
assert.deepStrictEqual(estadoFrete(pZero, undefined, { sugerir: true }), { texto: "0", origem: "salvo" });
assert.deepStrictEqual(estadoFrete(pDistancia, "4", { sugerir: true }), { texto: "4", origem: "digitando" });

// freteNaConfirmacao: rascunho > salvo > sugerido; zero digitado vale
assert.strictEqual(freteNaConfirmacao(pNovo, undefined), 300);
assert.strictEqual(freteNaConfirmacao(pDistancia, undefined), 450);
assert.strictEqual(freteNaConfirmacao(pZero, undefined), 0);
assert.strictEqual(freteNaConfirmacao(pNovo, ""), 0);
assert.strictEqual(freteNaConfirmacao(pNovo, "125"), 125);
assert.ok(Number.isNaN(freteNaConfirmacao(pNovo, "x")));

// Acréscimo: mesma unidade com outro pedido pendente/confirmado mais antigo -> sugere 0
const baseAntigo = { id: "base", franchise_id: "f1", status: "confirmado", ordered_at: diasAtras(4) };
const acrescimoNovo = { id: "novo", franchise_id: "f1", status: "pendente", ordered_at: diasAtras(0), total_amount: 135, freight_cost: null };
const outraUnidade = { id: "outro", franchise_id: "f2", status: "pendente", ordered_at: diasAtras(0), total_amount: 706.9, freight_cost: null };
const mapaAntigo = pedidoAbertoMaisAntigoPorUnidade([baseAntigo, acrescimoNovo, outraUnidade]);
assert.strictEqual(mapaAntigo.get("f1").id, "base");
assert.strictEqual(ehAcrescimo(acrescimoNovo, mapaAntigo), true);
assert.strictEqual(ehAcrescimo(baseAntigo, mapaAntigo), false); // é o próprio mais antigo
assert.strictEqual(ehAcrescimo(outraUnidade, mapaAntigo), false); // única em aberto na unidade
assert.deepStrictEqual(estadoFrete(acrescimoNovo, undefined, { sugerir: true, acrescimo: true }), { texto: "0", origem: "acrescimo" });
assert.strictEqual(freteNaConfirmacao(acrescimoNovo, undefined, { acrescimo: true }), 0);
assert.strictEqual(freteNaConfirmacao(acrescimoNovo, "50", { acrescimo: true }), 50); // rascunho sempre ganha

// ultimoFretePorUnidade: o mais RECENTE (maior ordered_at) entre freight_cost > 0
const historico = [
  { franchise_id: "f3", ordered_at: diasAtras(60), freight_cost: 160 },
  { franchise_id: "f3", ordered_at: diasAtras(13), freight_cost: 190 },
  { franchise_id: "f3", ordered_at: diasAtras(30), freight_cost: 0 }, // frete 0 não conta
];
const mapaUltimo = ultimoFretePorUnidade(historico);
assert.strictEqual(mapaUltimo.get("f3").valor, 190);
assert.strictEqual(mapaUltimo.get("f4"), undefined);

// mensagemChamarPedido: saudação com 1º nome, sem emoji/travessão
assert.ok(mensagemChamarPedido(acrescimoNovo, { ownerName: "Maria Silva", acrescimo: true }).startsWith("Oi, Maria!"));
assert.ok(mensagemChamarPedido(acrescimoNovo, {}).startsWith("Oi!"));
assert.ok(!/—|😀|🎉/.test(mensagemChamarPedido(acrescimoNovo, { ownerName: "Ana", atrasado: true })));

// dataBRT / meioDiaBRT
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dataBRT()));
assert.strictEqual(meioDiaBRT("2026-09-20"), "2026-09-20T12:00:00-03:00");
assert.strictEqual(meioDiaBRT("bobagem"), null);

// resumoLote: R$, frete, kg e caminhões de 1.500 kg
const lote = [
  { total_amount: "9652.20", total_weight_kg: "353.1", freight_cost: null },
  { total_amount: "2032.80", total_weight_kg: "71.9", freight_cost: "250" },
  { total_amount: "3001.30", total_weight_kg: "1100", freight_cost: "0" },
];
const r1 = resumoLote(lote);
assert.deepStrictEqual(r1, { qtd: 3, total: 14686.3, frete: 250, kg: 1525, caminhoes: 2 });
const r2 = resumoLote(lote, (o) => freteNaConfirmacao(o, undefined));
assert.strictEqual(r2.frete, 350 + 250 + 0);
assert.deepStrictEqual(resumoLote([]), { qtd: 0, total: 0, frete: 0, kg: 0, caminhoes: 0 });
assert.strictEqual(resumoLote([{ total_amount: 100, total_weight_kg: 1500 }]).caminhoes, 1);

assert.strictEqual(pedidosLabel(1), "1 pedido");
assert.strictEqual(pedidosLabel(4), "4 pedidos");

// --- Resumo mensal de entregas (26/09) ---

// mesAtualBRT
assert.ok(/^\d{4}-\d{2}$/.test(mesAtualBRT()));
assert.strictEqual(mesAtualBRT(), dataBRT().slice(0, 7));

// limitesMesBRT: mês inteiro, recorte por dia e clamp no último dia do mês
assert.deepStrictEqual(limitesMesBRT("2026-09"), {
  inicio: "2026-09-01T00:00:00-03:00",
  fim: "2026-09-30T23:59:59.999-03:00",
  ultimoDia: 30,
});
assert.deepStrictEqual(limitesMesBRT("2026-09", 26), {
  inicio: "2026-09-01T00:00:00-03:00",
  fim: "2026-09-26T23:59:59.999-03:00",
  ultimoDia: 30,
});
assert.deepStrictEqual(limitesMesBRT("2026-02", 30), {
  inicio: "2026-02-01T00:00:00-03:00",
  fim: "2026-02-28T23:59:59.999-03:00", // 2026 não é bissexto: clampa em 28
  ultimoDia: 28,
});
assert.strictEqual(limitesMesBRT("bobagem"), null);

// ateDiaBRT: dia de hoje quando é o mês corrente, mês inteiro quando já passou
assert.strictEqual(ateDiaBRT("2026-09", "2026-09-26"), 26);
assert.strictEqual(ateDiaBRT("2026-08", "2026-09-26"), 31);
assert.strictEqual(ateDiaBRT("2026-02", "2026-09-26"), 28);

// diasPedidoAteEntrega
assert.strictEqual(diasPedidoAteEntrega({ ordered_at: "2026-09-01T15:00:00+00:00", delivered_at: "2026-09-04T15:00:00+00:00" }), 3);
assert.strictEqual(diasPedidoAteEntrega({ ordered_at: null, delivered_at: "2026-09-04T15:00:00+00:00" }), null);
assert.strictEqual(diasPedidoAteEntrega({ ordered_at: "2026-09-04T15:00:00+00:00", delivered_at: null }), null);
assert.strictEqual(diasPedidoAteEntrega({}), null);
// entrega "antes" do pedido (dado quebrado) não gera dia negativo
assert.strictEqual(diasPedidoAteEntrega({ ordered_at: "2026-09-04T15:00:00+00:00", delivered_at: "2026-09-01T15:00:00+00:00" }), null);

// resumoEntregas: amostra REAL de setembro/2026 (54 pedidos entregue, franquias não-teste,
// via MCP Supabase SELECT em 26/09/2026) — confere que o helper reproduz os números que o
// Nelson confirmou: 54 entregas, 44 unidades, 5,3 dias em média (mediana 5).
const ENTREGAS_SETEMBRO_2026 = [
  { franchise_id: "franquiacajamarsp", ordered_at: "2026-08-30T23:09:15.573+00:00", delivered_at: "2026-09-02T14:09:54.23609+00:00", total_amount: "3168.90", total_weight_kg: "113.700", freight_cost: "320.00" },
  { franchise_id: "franquiaitusp", ordered_at: "2026-08-30T18:35:05.187+00:00", delivered_at: "2026-09-02T16:35:12.701024+00:00", total_amount: "2478.90", total_weight_kg: "92.200", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp10", ordered_at: "2026-08-30T13:14:15.239+00:00", delivered_at: "2026-09-04T15:28:19.83111+00:00", total_amount: "1635.40", total_weight_kg: "73.700", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp4", ordered_at: "2026-08-30T16:24:36.734+00:00", delivered_at: "2026-09-04T15:29:36.333222+00:00", total_amount: "886.60", total_weight_kg: "32.000", freight_cost: "125.00" },
  { franchise_id: "franquiasaopaulosp13", ordered_at: "2026-08-30T16:43:04.256+00:00", delivered_at: "2026-09-04T15:29:36.345605+00:00", total_amount: "843.20", total_weight_kg: "37.200", freight_cost: "125.00" },
  { franchise_id: "franquiasantoandresp1", ordered_at: "2026-08-30T22:34:21.757+00:00", delivered_at: "2026-09-04T16:05:16.094668+00:00", total_amount: "1299.50", total_weight_kg: "44.300", freight_cost: "250.00" },
  { franchise_id: "franquiarioclarosp", ordered_at: "2026-09-01T17:05:12.06+00:00", delivered_at: "2026-09-04T16:07:10.809168+00:00", total_amount: "1496.30", total_weight_kg: "62.500", freight_cost: null },
  { franchise_id: "franquialimeirasp", ordered_at: "2026-09-01T16:35:13.322+00:00", delivered_at: "2026-09-04T16:07:10.814642+00:00", total_amount: "656.20", total_weight_kg: "48.300", freight_cost: "250.00" },
  { franchise_id: "franquiairacemapolissp", ordered_at: "2026-08-31T17:23:47.862+00:00", delivered_at: "2026-09-04T16:07:10.815438+00:00", total_amount: "384.10", total_weight_kg: "12.700", freight_cost: null },
  { franchise_id: "franquiasaopaulosp3", ordered_at: "2026-08-30T18:10:43.713+00:00", delivered_at: "2026-09-04T16:07:28.368271+00:00", total_amount: "3806.20", total_weight_kg: "136.600", freight_cost: "350.00" },
  { franchise_id: "franquiajundiaisp", ordered_at: "2026-08-30T22:43:46.856+00:00", delivered_at: "2026-09-04T19:05:36.103589+00:00", total_amount: "1339.00", total_weight_kg: "63.500", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp16", ordered_at: "2026-09-01T16:17:54.595+00:00", delivered_at: "2026-09-04T23:12:38.602646+00:00", total_amount: "2479.10", total_weight_kg: "96.800", freight_cost: "125.00" },
  { franchise_id: "franquiasorocabasp1", ordered_at: "2026-09-06T19:20:12.305+00:00", delivered_at: "2026-09-09T12:58:29.472875+00:00", total_amount: "1873.30", total_weight_kg: "79.900", freight_cost: "250.00" },
  { franchise_id: "franquiajundiaisp", ordered_at: "2026-09-07T21:44:28.948+00:00", delivered_at: "2026-09-09T14:39:38.821874+00:00", total_amount: "1903.20", total_weight_kg: "64.600", freight_cost: "250.00" },
  { franchise_id: "franquiasorocabasp2", ordered_at: "2026-09-06T21:07:27.421+00:00", delivered_at: "2026-09-09T14:39:38.847671+00:00", total_amount: "1304.80", total_weight_kg: "46.150", freight_cost: "250.00" },
  { franchise_id: "franquialimeirasp", ordered_at: "2026-09-07T20:26:02.218+00:00", delivered_at: "2026-09-09T16:10:43.786033+00:00", total_amount: "3389.60", total_weight_kg: "123.800", freight_cost: "350.00" },
  { franchise_id: "franquiahortolandiasp", ordered_at: "2026-09-07T14:50:40.866+00:00", delivered_at: "2026-09-09T16:10:43.827194+00:00", total_amount: "1906.90", total_weight_kg: "63.700", freight_cost: "190.00" },
  { franchise_id: "franquiaribeiraopretosp", ordered_at: "2026-08-30T21:56:50.339+00:00", delivered_at: "2026-09-09T17:07:06.042046+00:00", total_amount: "1262.50", total_weight_kg: "44.600", freight_cost: null },
  { franchise_id: "franquiasaopaulosp8", ordered_at: "2026-09-07T19:38:10.892+00:00", delivered_at: "2026-09-11T12:33:32.592307+00:00", total_amount: "2592.70", total_weight_kg: "99.000", freight_cost: "260.00" },
  { franchise_id: "franquiasaopaulosp15", ordered_at: "2026-09-06T17:13:57.089+00:00", delivered_at: "2026-09-11T12:35:57.838579+00:00", total_amount: "2155.10", total_weight_kg: "72.900", freight_cost: "125.00" },
  { franchise_id: "franquiasaopaulosp2", ordered_at: "2026-09-07T19:53:23.449+00:00", delivered_at: "2026-09-11T12:35:57.840063+00:00", total_amount: "5348.90", total_weight_kg: "214.300", freight_cost: "350.00" },
  { franchise_id: "franquiamauasp", ordered_at: "2026-09-07T21:00:32.711+00:00", delivered_at: "2026-09-11T16:17:43.380304+00:00", total_amount: "4607.90", total_weight_kg: "174.500", freight_cost: "350.00" },
  { franchise_id: "franquiasuzanosp", ordered_at: "2026-09-06T19:36:06.511+00:00", delivered_at: "2026-09-11T16:17:43.402916+00:00", total_amount: "2714.90", total_weight_kg: "100.400", freight_cost: "270.00" },
  { franchise_id: "franquiasantoandresp", ordered_at: "2026-09-07T20:14:56.77+00:00", delivered_at: "2026-09-11T17:17:34.471051+00:00", total_amount: "2503.90", total_weight_kg: "97.400", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp18", ordered_at: "2026-09-07T14:36:05.762+00:00", delivered_at: "2026-09-14T13:51:02.905213+00:00", total_amount: "1852.60", total_weight_kg: "63.900", freight_cost: "250.00" },
  { franchise_id: "franquiaosascosp", ordered_at: "2026-09-07T19:37:49.151+00:00", delivered_at: "2026-09-14T13:51:02.907661+00:00", total_amount: "4021.50", total_weight_kg: "148.500", freight_cost: "350.00" },
  { franchise_id: "franquiasaopaulosp7", ordered_at: "2026-09-06T19:27:09.314+00:00", delivered_at: "2026-09-14T14:44:31.432891+00:00", total_amount: "3020.20", total_weight_kg: "114.600", freight_cost: "300.00" },
  { franchise_id: "franquiasaopaulosp5", ordered_at: "2026-09-07T16:51:50.175+00:00", delivered_at: "2026-09-14T14:44:41.418402+00:00", total_amount: "2489.20", total_weight_kg: "89.300", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp19", ordered_at: "2026-09-06T17:15:29.367+00:00", delivered_at: "2026-09-14T15:23:57.070398+00:00", total_amount: "1322.10", total_weight_kg: "48.300", freight_cost: "125.00" },
  { franchise_id: "franquiasaopaulosp11", ordered_at: "2026-09-06T17:07:50.681+00:00", delivered_at: "2026-09-14T15:23:57.081133+00:00", total_amount: "1191.40", total_weight_kg: "45.000", freight_cost: "125.00" },
  { franchise_id: "franquiaembudasartessp", ordered_at: "2026-09-06T20:09:57.613+00:00", delivered_at: "2026-09-14T18:28:11.389754+00:00", total_amount: "2313.50", total_weight_kg: "93.500", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp12", ordered_at: "2026-09-07T21:24:22.274+00:00", delivered_at: "2026-09-14T18:36:47.177727+00:00", total_amount: "2117.00", total_weight_kg: "78.000", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp6", ordered_at: "2026-09-07T17:18:04.854+00:00", delivered_at: "2026-09-14T18:36:47.177731+00:00", total_amount: "4030.10", total_weight_kg: "142.700", freight_cost: "350.00" },
  { franchise_id: "franquiabarretossp", ordered_at: "2026-09-07T17:30:17.272+00:00", delivered_at: "2026-09-16T12:25:26.988405+00:00", total_amount: "2588.40", total_weight_kg: "107.450", freight_cost: "250.00" },
  { franchise_id: "franquiaassissp", ordered_at: "2026-09-07T05:35:08.418+00:00", delivered_at: "2026-09-16T13:27:24.6769+00:00", total_amount: "7891.00", total_weight_kg: "273.500", freight_cost: "450.00" },
  { franchise_id: "franquialemesp", ordered_at: "2026-09-14T12:42:37.746+00:00", delivered_at: "2026-09-16T21:44:05.395629+00:00", total_amount: "771.20", total_weight_kg: "43.400", freight_cost: null },
  { franchise_id: "franquialimeirasp", ordered_at: "2026-09-16T20:52:49.342+00:00", delivered_at: "2026-09-18T11:19:31.331095+00:00", total_amount: "1627.00", total_weight_kg: "59.000", freight_cost: null },
  { franchise_id: "franquiacotiasp", ordered_at: "2026-09-13T13:53:47.922+00:00", delivered_at: "2026-09-19T11:01:22.530164+00:00", total_amount: "2199.20", total_weight_kg: "88.950", freight_cost: "250.00" },
  { franchise_id: "franquiasantossp", ordered_at: "2026-09-13T21:51:26.468+00:00", delivered_at: "2026-09-19T12:19:46.612338+00:00", total_amount: "5828.50", total_weight_kg: "205.000", freight_cost: "400.00" },
  { franchise_id: "franquiasaopaulosp13", ordered_at: "2026-09-13T22:28:11.231+00:00", delivered_at: "2026-09-19T14:41:32.607834+00:00", total_amount: "2040.70", total_weight_kg: "78.300", freight_cost: "200.00" },
  { franchise_id: "franquiasaopaulosp4", ordered_at: "2026-09-13T22:19:16.628+00:00", delivered_at: "2026-09-19T14:41:32.608303+00:00", total_amount: "1308.70", total_weight_kg: "47.850", freight_cost: "130.00" },
  { franchise_id: "franquiasaopaulosp2", ordered_at: "2026-09-16T15:38:37.627+00:00", delivered_at: "2026-09-19T14:41:32.609853+00:00", total_amount: "458.00", total_weight_kg: "14.000", freight_cost: null },
  { franchise_id: "franquiabragancapaulistasp", ordered_at: "2026-09-08T13:06:31.899+00:00", delivered_at: "2026-09-19T17:43:35.146007+00:00", total_amount: "4101.80", total_weight_kg: "143.100", freight_cost: "350.00" },
  { franchise_id: "franquiasantanadeparnaibasp1", ordered_at: "2026-09-13T22:33:34.753+00:00", delivered_at: "2026-09-19T17:43:35.146911+00:00", total_amount: "2555.70", total_weight_kg: "90.300", freight_cost: "250.00" },
  { franchise_id: "franquianovaodessasp", ordered_at: "2026-09-13T21:37:15.177+00:00", delivered_at: "2026-09-20T01:48:48.580655+00:00", total_amount: "1115.10", total_weight_kg: "46.300", freight_cost: "120.00" },
  { franchise_id: "franquiaamericanasp", ordered_at: "2026-09-13T21:37:14.212+00:00", delivered_at: "2026-09-20T01:48:48.583769+00:00", total_amount: "1398.30", total_weight_kg: "58.100", freight_cost: "130.00" },
  { franchise_id: "franquiauberabamg", ordered_at: "2026-09-12T14:06:20.405+00:00", delivered_at: "2026-09-22T12:03:40.055548+00:00", total_amount: "4361.30", total_weight_kg: "156.250", freight_cost: "450.00" },
  { franchise_id: "franquialimeirasp", ordered_at: "2026-09-20T22:00:39.581+00:00", delivered_at: "2026-09-24T11:04:24.82697+00:00", total_amount: "1893.30", total_weight_kg: "65.700", freight_cost: "250.00" },
  { franchise_id: "franquialimeirasp", ordered_at: "2026-09-23T15:33:04.63+00:00", delivered_at: "2026-09-24T11:04:24.832974+00:00", total_amount: "632.50", total_weight_kg: "27.500", freight_cost: null },
  { franchise_id: "franquiaguarujasp", ordered_at: "2026-09-21T00:11:21.889+00:00", delivered_at: "2026-09-24T14:16:44.535882+00:00", total_amount: "7233.40", total_weight_kg: "265.600", freight_cost: "400.00" },
  { franchise_id: "franquiasaopaulosp7", ordered_at: "2026-09-20T19:31:54.556+00:00", delivered_at: "2026-09-24T16:08:03.138623+00:00", total_amount: "2038.80", total_weight_kg: "79.800", freight_cost: "250.00" },
  { franchise_id: "franquiasaopaulosp14", ordered_at: "2026-09-20T02:59:56.485+00:00", delivered_at: "2026-09-24T17:44:07.892693+00:00", total_amount: "1556.40", total_weight_kg: "60.200", freight_cost: "250.00" },
  { franchise_id: "franquiaribeiraopretosp", ordered_at: "2026-09-20T21:36:36.987+00:00", delivered_at: "2026-09-25T15:55:51.374209+00:00", total_amount: "1800.60", total_weight_kg: "65.500", freight_cost: null },
  { franchise_id: "franquiaubatubasp", ordered_at: "2026-09-15T23:17:19.845+00:00", delivered_at: "2026-09-26T14:47:26.32867+00:00", total_amount: "3201.70", total_weight_kg: "103.250", freight_cost: "500.00" },
];
assert.strictEqual(ENTREGAS_SETEMBRO_2026.length, 54);

const resumoSetembro = resumoEntregas(ENTREGAS_SETEMBRO_2026);
assert.strictEqual(resumoSetembro.entregas, 54);
assert.strictEqual(resumoSetembro.unidades, 44);
assert.strictEqual(resumoSetembro.valor, 130996.3); // soma exata dos total_amount reais
assert.strictEqual(resumoSetembro.frete, 12070);
assert.strictEqual(resumoSetembro.peso, 4897.6); // soma exata dos total_weight_kg reais
assert.strictEqual(resumoSetembro.diasMedio, 5.3);
assert.strictEqual(resumoSetembro.diasMediana, 5);

// resumoEntregas: mês sem nenhum pedido
assert.deepStrictEqual(resumoEntregas([]), { entregas: 0, unidades: 0, valor: 0, frete: 0, peso: null, diasMedio: null, diasMediana: null });

// resumoEntregas: peso "não registrado" (maio/junho, antes de 29/06/2026) — TODOS os
// pedidos do mês sem total_weight_kg, então o helper não soma nada (nunca trata como 0)
const semPeso = ENTREGAS_SETEMBRO_2026.slice(0, 3).map((o) => ({ ...o, total_weight_kg: null }));
assert.strictEqual(resumoEntregas(semPeso).peso, null);
// mesmo com 1 SÓ pedido sem peso no meio de pedidos com peso, a soma do mês não sai —
// senão o peso do mês ficaria subcontado em silêncio
const pesoParcial = [ENTREGAS_SETEMBRO_2026[0], { ...ENTREGAS_SETEMBRO_2026[1], total_weight_kg: null }];
assert.strictEqual(resumoEntregas(pesoParcial).peso, null);

console.log("pedidosHelpers.test.mjs: todos os testes passaram");
