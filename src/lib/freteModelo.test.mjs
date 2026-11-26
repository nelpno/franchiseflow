// Cartão "Entrega": ida e volta entre o cadastro antigo e o modelo, limpeza do frete calculado e regras.
// A ida e volta foi conferida também nas 54 unidades reais em modo simples (12/09/2026): 53 idênticas;
// a Vila Mariana tinha prazo 0 e volta como vazio — o robô trata os dois igual (o prompt testa "se tem prazo").
import assert from "node:assert/strict";
import {
  modoDoFrete, legadoParaModelo, modeloParaLegado, limparPricing, problemasDoModelo, fraseDoGrupo,
  novoGrupo, diasLivres, textoTaxa, diasPorExtenso,
} from "./freteModelo.js";

const semana = ["seg", "ter", "qua", "qui", "sex"];
const SIMPLES = {
  max_delivery_radius_km: 10, avg_prep_time_minutes: null,
  delivery_schedule: [
    { days: semana, delivery_start: "10:00", delivery_end: "19:00", order_cutoff: "17:00", charges_fee: true,
      fee_rules: [{ max_km: "3", fee: "6" }, { max_km: "6", fee: "9.00" }, { max_km: "10", fee: "12" }] },
    { days: ["sab"], delivery_start: "10:00", delivery_end: "14:00", charges_fee: true, fee_rules: [{ max_km: "10", fee: "12.00" }] },
    { days: ["dom"], delivery_start: "10:00", delivery_end: "12:00", charges_fee: false, fee_rules: [{ max_km: "5", fee: "5" }] },
  ],
};

// ---- modo
assert.equal(modoDoFrete(SIMPLES), "simples");
assert.equal(modoDoFrete({ delivery_schedule: [{ charges_fee: true, fee_rules: { mode: "modality", rules: [] } }] }), "modalidade");
assert.equal(modoDoFrete({ delivery_schedule: [{ charges_fee: false, fee_rules: { mode: "modality", rules: [] } }] }), "simples", "grupo grátis ignora a lista");
assert.equal(modoDoFrete({ delivery_pricing: { grupos: [] }, delivery_schedule: [{ fee_rules: { mode: "modality" } }] }), "estruturado");
assert.equal(modoDoFrete({ delivery_schedule: [] }), "simples", "sem horário ainda: começa no cartão novo");

// ---- cadastro antigo -> modelo
const m = legadoParaModelo(SIMPLES);
assert.equal(m.raio_km, 10);
assert.deepEqual(m.grupos[0].tipos[0].taxa, { modo: "faixas", faixas: [{ ate: 3, valor: 6 }, { ate: 6, valor: 9 }, { ate: 10, valor: 12 }] });
assert.equal(m.grupos[0].tipos[0].corte, "17:00");
assert.deepEqual(m.grupos[1].tipos[0].taxa, { modo: "fixa", valor: 12 }, "uma faixa que cobre o raio = valor único");
assert.equal(m.grupos[1].tipos[0].corte, "", "sem order_cutoff = até o fim da janela");
assert.deepEqual(m.grupos[2].tipos[0].taxa, { modo: "fixa", valor: 0 }, "charges_fee false = grátis");
assert.equal(m.grupos[0].tipos[0].promessa, "janela");
assert.equal(legadoParaModelo({ ...SIMPLES, avg_prep_time_minutes: 40 }).grupos[0].tipos[0].minutos, 40);

// ---- modelo -> cadastro antigo (o robô lê isto no modo simples)
const leg = modeloParaLegado(m);
assert.deepEqual(leg.delivery_schedule[0], {
  days: semana, delivery_start: "10:00", delivery_end: "19:00", order_cutoff: "17:00", charges_fee: true,
  fee_rules: [{ max_km: "3", fee: "6.00" }, { max_km: "6", fee: "9.00" }, { max_km: "10", fee: "12.00" }],
});
assert.deepEqual(leg.delivery_schedule[1].fee_rules, [{ max_km: "10", fee: "12.00" }]);
assert.equal(leg.delivery_schedule[2].charges_fee, false);
assert.deepEqual(leg.delivery_schedule[2].fee_rules, []);
assert.equal(leg.charges_delivery_fee, true, "algum grupo cobra");
assert.deepEqual(leg.delivery_fee_rules, leg.delivery_schedule[0].fee_rules, "venda manual lê o 1º grupo, como antes");
assert.equal(leg.working_days, "seg,ter,qua,qui,sex,sab,dom");
assert.equal(leg.opening_hours, "seg,ter,qua,qui,sex: 10:00-19:00 | sab: 10:00-14:00 | dom: 10:00-12:00");
assert.equal(leg.avg_prep_time_minutes, null);
assert.equal(leg.max_delivery_radius_km, 10);

// ida e volta estável (a tela reconstrói o modelo a cada mudança)
assert.deepEqual(legadoParaModelo({ ...SIMPLES, ...leg }), m);

// valor único sem raio ainda: a faixa de 60 km volta como valor único (não vira "por distância")
const semRaio = { max_delivery_radius_km: null, delivery_schedule: [{ days: ["seg"], delivery_start: "10:00", delivery_end: "18:00", charges_fee: true, fee_rules: [{ max_km: "60", fee: "" }] }] };
assert.deepEqual(legadoParaModelo(semRaio).grupos[0].tipos[0].taxa, { modo: "fixa", valor: "" });

// valor único acompanha o raio
const raio15 = modeloParaLegado({ ...m, raio_km: 15 });
assert.deepEqual(raio15.delivery_schedule[1].fee_rules, [{ max_km: "15", fee: "12.00" }]);

// linha pela metade continua na tela (vermelha) e volta igual
const metade = legadoParaModelo({ ...SIMPLES, delivery_schedule: [{ ...SIMPLES.delivery_schedule[0], fee_rules: [{ max_km: "3", fee: "6" }, { max_km: "6", fee: "" }] }] });
assert.deepEqual(metade.grupos[0].tipos[0].taxa.faixas[1], { ate: 6, valor: "" });
assert.deepEqual(modeloParaLegado(metade).delivery_schedule[0].fee_rules[1], { max_km: "6", fee: "" });

// ---- frete calculado (formato do Guarujá)
const GUARUJA = {
  versao: 1, raio_km: 15,
  grupos: [
    { dias: semana, tipos: [
      { nome: "Programada", inicio: "16:00", fim: "19:00", corte: "17:00", promessa: "janela", taxa: { modo: "fixa", valor: 10 } },
      { nome: "Imediata", inicio: "10:00", fim: "19:00", corte: "17:00", promessa: "minutos", minutos: 60, taxa: { modo: "fixa", valor: 15 } },
    ] },
    { dias: ["sab", "dom"], tipos: [{ nome: "Entrega", inicio: "10:00", fim: "13:00", corte: "13:00", promessa: "janela", taxa: { modo: "fixa", valor: 15 } }] },
  ],
  zonas: [{ nomes: ["Acapulco"], valor: 20 }, { nomes: ["Pernambuco", "Maré Mansa"], valor: 15 }],
};
assert.deepEqual(limparPricing(GUARUJA), GUARUJA, "limpar o que veio do banco devolve o mesmo");
const legG = modeloParaLegado(GUARUJA, { estruturado: true });
assert.deepEqual(legG.delivery_schedule.map((g) => [g.delivery_start, g.delivery_end, g.order_cutoff]), [["10:00", "19:00", "17:00"], ["10:00", "13:00", "13:00"]],
  "janela do grupo = do primeiro início ao último fim (é o que o horário do robô usa)");
assert.equal(legG.delivery_fee_rules.mode, "modality");
assert.ok(legG.delivery_fee_rules.rules.some((r) => r.label === "Bairro Acapulco (taxa fixa em qualquer janela)" && r.fee === "20.00"));
assert.equal("avg_prep_time_minutes" in legG, false, "no frete calculado o prazo global não vale");

// limpeza do que a tela editou
const editado = {
  ...GUARUJA,
  grupos: [{ dias: ["sex", "seg"], tipos: [{ nome: " Programada ", inicio: "16:00", fim: "19:00", corte: "", promessa: "janela", minutos: 30,
    taxa: { modo: "faixas", faixas: [{ ate: "6", valor: "10,50" }, { ate: "", valor: "" }, { ate: "3", valor: "8" }] } }] }],
  zonas: [{ nomes: [" Acapulco ", "", "Acapulco"], valor: "20", nao_atende: false }, { nomes: [], valor: "" }],
};
const limpo = limparPricing(editado);
assert.deepEqual(limpo.grupos[0].dias, ["seg", "sex"]);
assert.deepEqual(limpo.grupos[0].tipos[0], { nome: "Programada", inicio: "16:00", fim: "19:00", promessa: "janela",
  taxa: { modo: "faixas", faixas: [{ ate: 3, valor: 8 }, { ate: 6, valor: 10.5 }] } });
assert.deepEqual(limpo.zonas, [{ nomes: ["Acapulco"], valor: 20 }]);
// regra que a tela não conhece (do suporte) passa intacta
assert.equal(limparPricing({ ...GUARUJA, zonas: [{ nomes: ["Ilha"], especial: "barco" }] }).zonas[0].especial, "barco");

// ---- bairro com dias e valor por dia (Cordeirópolis, São Vicente) e grupo grátis com cidade vizinha que cobra
const ITAPOLIS = { raio_km: 10, grupos: [{ dias: ["seg"], tipos: [{ nome: "Entrega", inicio: "18:00", fim: "19:30", promessa: "janela", taxa: { modo: "fixa", valor: 0 } }] }],
  zonas: [{ nomes: ["Ibitinga"], valor: 15 }] };
const legI = modeloParaLegado(ITAPOLIS, { estruturado: true });
assert.equal(legI.delivery_schedule[0].charges_fee, true, "grátis na cidade, mas Ibitinga cobra");
assert.ok(legI.delivery_fee_rules.rules.some((r) => r.label.includes("Ibitinga") && r.fee === "15.00"));
const CORD = { raio_km: null,
  grupos: [
    { dias: ["seg"], tipos: [{ nome: "Entrega", inicio: "11:00", fim: "15:00", promessa: "janela", taxa: { modo: "especial", texto: "x" } }] },
    { dias: ["dom"], tipos: [{ nome: "Entrega", inicio: "09:00", fim: "12:00", promessa: "janela", taxa: { modo: "fixa", valor: 12 } }] }],
  zonas: [{ nomes: ["Cordeirópolis"], valor: 12, dias: ["qui", "sab"] }, { nomes: ["São Vicente"], valor: 12, por_dia: { dom: 15 } }, { nomes: ["Figueira"], especial: "y" }] };
const legC = modeloParaLegado(CORD, { estruturado: true });
assert.ok(!legC.delivery_schedule[0].fee_rules.rules.some((r) => r.label.includes("Cordeirópolis")), "fora dos dias do bairro");
assert.equal(legC.delivery_schedule[1].fee_rules.rules.find((r) => r.label.includes("São Vicente")).fee, "15.00");
// 26/11/2026: bairro só em dia SEM entrega passou a ser aviso (este cadastro de teste tem Cordeirópolis qui/sáb e entrega só seg/dom)
assert.deepEqual(problemasDoModelo(CORD, { estruturado: true }).map((p) => p.chave), ["z0.dias"], "bairro com regra especial não precisa de valor; bairro em dia sem entrega avisa");
assert.deepEqual(problemasDoModelo({ ...CORD, grupos: [...CORD.grupos, { dias: ["qui"], tipos: CORD.grupos[1].tipos }] }, { estruturado: true }), [], "com a quinta de entrega, Cordeirópolis passa");
assert.deepEqual(limparPricing(CORD).zonas[0].dias, ["qui", "sab"], "a limpeza não perde os dias do bairro");
assert.deepEqual(limparPricing(CORD).zonas[1].por_dia, { dom: 15 });

// ---- o que impede salvar
const chaves = (mod, opts) => problemasDoModelo(mod, opts).map((p) => p.chave);
const umTipo = (t) => ({ raio_km: 10, grupos: [{ dias: ["seg"], tipos: [{ nome: "Entrega", inicio: "10:00", fim: "18:00", corte: "", promessa: "janela", taxa: { modo: "fixa", valor: 8 }, ...t }] }], zonas: [] });
assert.deepEqual(chaves(umTipo({})), []);
assert.deepEqual(chaves(umTipo({ inicio: "" })), ["g0.t0.janela"]);
assert.deepEqual(chaves(umTipo({ inicio: "18:00", fim: "10:00" })), ["g0.t0.janela"]);
assert.deepEqual(chaves(umTipo({ corte: "19:00" })), ["g0.t0.corte"]);
assert.deepEqual(chaves(umTipo({ corte: "10:00" })), [], "corte igual ao início é a operação da Bauru");
assert.deepEqual(chaves(umTipo({ taxa: { modo: "fixa", valor: "" } })), ["g0.t0.taxa"]);
assert.deepEqual(chaves(umTipo({ taxa: { modo: "fixa", valor: 0 } })), [], "grátis vale");
assert.deepEqual(chaves(umTipo({ taxa: { modo: "faixas", faixas: [{ ate: 3, valor: 6 }, { ate: 5, valor: "" }] } })), ["g0.t0.faixa1"]);
assert.deepEqual(chaves(umTipo({ taxa: { modo: "faixas", faixas: [{ ate: "", valor: "" }] } })), ["g0.t0.taxa"]);
assert.deepEqual(chaves(umTipo({ promessa: "minutos", minutos: "" })), ["g0.t0.minutos"]);
// junção 10/11/2026: mesma faixa do banco (cardapio_prazo_unidade): 15 a 180
assert.deepEqual(chaves(umTipo({ promessa: "minutos", minutos: 5 })), ["g0.t0.minutos"]);
assert.deepEqual(chaves(umTipo({ promessa: "minutos", minutos: 600 })), ["g0.t0.minutos"]);
assert.deepEqual(chaves(umTipo({ promessa: "minutos", minutos: 15 })), []);
assert.deepEqual(chaves(umTipo({ promessa: "minutos", minutos: 180 })), []);
assert.match(problemasDoModelo(umTipo({ corte: "19:00" }))[0].msg, /^Seg: o limite de pedidos \(19:00\) passa do fim da entrega \(18:00\)\.$/);
const doisTipos = { grupos: [{ dias: ["seg"], tipos: [umTipo({}).grupos[0].tipos[0], { ...umTipo({}).grupos[0].tipos[0], nome: "entrega" }] }], zonas: [] };
assert.deepEqual(chaves(doisTipos, { estruturado: true }), ["g0.t1.nome"]);
const zonasRuins = { grupos: [], zonas: [{ nomes: [], valor: 10 }, { nomes: ["Centro"], valor: "" }, { nomes: ["centro"], valor: 5 }, { nomes: ["Ilha"], nao_atende: true }] };
assert.deepEqual(chaves(zonasRuins, { estruturado: true }), ["z0.nomes", "z1.valor", "z2.nomes"]);

// ---- frases
assert.equal(fraseDoGrupo(GUARUJA.grupos[0]),
  "De segunda a sexta, tem a programada, das 16h às 19h, por R$ 10 e a imediata, das 10h às 19h, que chega em até 60 min, por R$ 15. Pedidos até as 17h.");
assert.equal(fraseDoGrupo(m.grupos[0]),
  "De segunda a sexta, entregamos das 10h às 19h, por R$ 6 até 3 km, R$ 9 até 6 km e R$ 12 até 10 km. Pedidos até as 17h.");
assert.equal(fraseDoGrupo(m.grupos[2]), "No domingo, entregamos das 10h às 12h, sem taxa.");
assert.equal(textoTaxa({ modo: "fixa", valor: 10.5 }), "por R$ 10,50");
// com bairros na lista a taxa do grupo só vale fora dela (Ubatuba lia "por R$ 20" como preço fechado, 24/09)
const ubaSemana = { dias: ["seg", "ter", "qua", "qui", "sex"], tipos: [{ nome: "Entrega", inicio: "08:30", fim: "18:00", corte: "17:00", promessa: "minutos", minutos: 60, taxa: { modo: "especial", texto: "bairro fora da lista da unidade" } }] };
assert.equal(fraseDoGrupo(ubaSemana, { temBairros: true }),
  "De segunda a sexta, entregamos das 8h30 às 18h, em até 60 min depois de confirmado, fora da lista, com taxa que a unidade confirma. Bairros da lista, pelo valor de cada um. Pedidos até as 17h.");
assert.match(fraseDoGrupo({ ...ubaSemana, tipos: [{ ...ubaSemana.tipos[0], taxa: { modo: "fixa", valor: 20 } }] }, { temBairros: true }), /fora da lista, por R\$ 20\. Bairros da lista/);
// a regra "a unidade confirma" passa pela limpeza intacta e não trava o salvar
assert.deepEqual(limparPricing({ grupos: [ubaSemana], zonas: [] }).grupos[0].tipos[0].taxa, { modo: "especial", texto: "bairro fora da lista da unidade" });
assert.deepEqual(chaves({ grupos: [ubaSemana], zonas: [{ nomes: ["Centro"], valor: 10 }] }, { estruturado: true }), []);
assert.equal(diasPorExtenso(["seg", "qua", "sex"]), "Segunda, quarta e sexta");
assert.equal(diasPorExtenso(["sab"]), "No sábado");

// ---- ajudas
assert.deepEqual(diasLivres(m), []);
assert.equal(novoGrupo(m), null, "sem dia livre, sem grupo novo");
const soSemana = legadoParaModelo({ ...SIMPLES, delivery_schedule: [SIMPLES.delivery_schedule[0]] });
assert.deepEqual(novoGrupo(soSemana).dias, ["sab"]);
assert.deepEqual(novoGrupo(soSemana).tipos[0].taxa, soSemana.grupos[0].tipos[0].taxa, "copia a taxa do primeiro grupo");

console.log("freteModelo: ok");

// ---- 26/11/2026: saídas fixas (Uberaba) e bairro só em alguns dias (Indaiatuba)
{
  const { legadoParaModelo: l2m, modeloParaLegado: m2l, limparPricing: lp, problemasDoModelo: pm, fraseDoGrupo: fr } = await import("./freteModelo.js");
  const leg = { max_delivery_radius_km: 15, avg_prep_time_minutes: null, delivery_schedule: [{ days: ["ter", "qui", "sex", "sab"], delivery_start: "08:00", delivery_end: "19:00", order_cutoff: "17:30", charges_fee: true, fee_rules: [{ max_km: "5", fee: "8.00" }, { max_km: "15", fee: "18.00" }], saidas: ["18:00", "11:00", "15:00"] }] };
  const mod = l2m(leg);
  assert.equal(mod.grupos[0].tipos[0].promessa, "saidas");
  assert.deepEqual(mod.grupos[0].tipos[0].saidas, ["11:00", "15:00", "18:00"]);
  const volta = m2l(mod);
  assert.deepEqual(volta.delivery_schedule[0].saidas, ["11:00", "15:00", "18:00"], "ida e volta do modo simples mantém as saídas");
  assert.equal(volta.avg_prep_time_minutes, null);
  assert.match(fr(mod.grupos[0]), /em rotas que saem às 11h, 15h e 18h \(o pedido chega ao longo da rota\)/);
  // sem saídas: o item do delivery_schedule não ganha a chave (unidades de hoje ficam iguais)
  const semS = m2l(l2m({ ...leg, delivery_schedule: [{ ...leg.delivery_schedule[0], saidas: undefined }] }));
  assert.equal("saidas" in semS.delivery_schedule[0], false);
  // trocar para janela tira as saídas na limpeza
  const jan = lp({ ...mod, grupos: [{ ...mod.grupos[0], tipos: [{ ...mod.grupos[0].tipos[0], promessa: "janela" }] }] });
  assert.equal("saidas" in jan.grupos[0].tipos[0], false);
  // validação: sem horário e fora da janela
  const t0 = mod.grupos[0].tipos[0];
  const comSaidas = (saidas) => ({ ...mod, grupos: [{ ...mod.grupos[0], tipos: [{ ...t0, saidas }] }] });
  assert.deepEqual(pm(comSaidas([])).map((p) => p.chave), ["g0.t0.saidas"]);
  assert.match(pm(comSaidas(["07:00", "11:00"]))[0].msg, /saída das 7h fica fora da janela \(8h às 19h\)/);
  assert.deepEqual(pm(mod), []);
  // bairro só na quarta: limpeza ordena e some quando vazio
  const ind = { versao: 1, raio_km: 10, grupos: [{ dias: ["seg", "ter", "qua", "qui", "sex", "sab"], tipos: [{ nome: "Entrega", inicio: "09:00", fim: "18:00", promessa: "janela", taxa: { modo: "fixa", valor: 8 } }] }],
    zonas: [{ nomes: ["Jardim Morada do Sol"], valor: 20, dias: ["qua"] }, { nomes: ["Centro"], valor: 5, dias: [] }] };
  assert.deepEqual(lp(ind).zonas[0].dias, ["qua"]);
  assert.equal("dias" in lp(ind).zonas[1], false);
  assert.deepEqual(pm(ind, { estruturado: true }), []);
  console.log("freteModelo 26/11 (saídas e bairro por dia): ok");
}

// Uberaba 26/11: saídas por grupo de dias no modo simples (quarta sem a rota das 18h) e grupo novo herda a janela
{
  const ub = { delivery_schedule: [
    { days: ["seg", "ter", "qui", "sex", "sab"], delivery_start: "08:00", delivery_end: "18:00", order_cutoff: "18:00", charges_fee: true, fee_rules: [{ max_km: "5", fee: "8" }], saidas: ["10:30", "15:00", "18:00"] },
    { days: ["qua"], delivery_start: "08:00", delivery_end: "18:00", order_cutoff: "15:00", charges_fee: true, fee_rules: [{ max_km: "5", fee: "8" }], saidas: ["10:30", "15:00"] }],
    max_delivery_radius_km: 10 };
  const mu = legadoParaModelo(ub);
  const volta = modeloParaLegado(mu).delivery_schedule;
  assert.deepEqual(volta.map((g) => g.saidas), [["10:30", "15:00", "18:00"], ["10:30", "15:00"]], "cada grupo guarda as próprias saídas");
  assert.deepEqual(problemasDoModelo(mu), []);
  const so1 = legadoParaModelo({ ...ub, delivery_schedule: [{ ...ub.delivery_schedule[0] }] });
  const ng = novoGrupo(so1);
  assert.deepEqual([ng.dias, ng.tipos[0].inicio, ng.tipos[0].fim, ng.tipos[0].saidas], [["qua"], "08:00", "18:00", ["10:30", "15:00", "18:00"]]);
  console.log("freteModelo 26/11b (saídas por grupo): ok");
}

// Indaiatuba 26/11 (tarde): bairro com horário próprio (Campo Bonito só na quarta, das 10h às 16h)
{
  const base = { versao: 1, raio_km: 10, grupos: [{ dias: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"], tipos: [{ nome: "Entrega", inicio: "09:00", fim: "18:00", promessa: "janela", taxa: { modo: "fixa", valor: 8 } }] }] };
  const com = (z) => ({ ...base, zonas: [{ nomes: ["Campo Bonito"], valor: 15, dias: ["qua"], ...z }] });
  assert.deepEqual([limparPricing(com({ inicio: "10:00", fim: "16:00" })).zonas[0].inicio, limparPricing(com({ inicio: "10:00", fim: "16:00" })).zonas[0].fim], ["10:00", "16:00"]);
  assert.equal("inicio" in limparPricing(com({ inicio: "10:00", fim: "" })).zonas[0], false, "meio horário não vai ao banco");
  assert.equal("inicio" in limparPricing(com({ inicio: "10:00", fim: "16:00", nao_atende: true })).zonas[0], false);
  assert.deepEqual(problemasDoModelo(com({ inicio: "10:00", fim: "16:00" }), { estruturado: true }), []);
  assert.deepEqual(problemasDoModelo(com({}), { estruturado: true }), [], "sem horário segue valendo");
  assert.match(problemasDoModelo(com({ inicio: "10:00" }), { estruturado: true })[0].msg, /horário inteiro/);
  assert.match(problemasDoModelo(com({ inicio: "16:00", fim: "10:00" }), { estruturado: true })[0].msg, /termina/);
  assert.match(problemasDoModelo(com({ inicio: "19:00", fim: "21:00" }), { estruturado: true })[0].msg, /fora do horário/);
  const lim = limparPricing(com({ inicio: "10:00", fim: "16:00" }));
  assert.deepEqual(limparPricing(lim), lim, "limpar é idempotente");
  const txt = modeloParaLegado(lim, { estruturado: true });
  assert.match(JSON.stringify(txt), /Bairro Campo Bonito \(só das 10h às 16h\)/);
  console.log("freteModelo 26/11c (horário do bairro): ok");
}
