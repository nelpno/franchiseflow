// Etapa 5 "Como o robô vai responder": respostas montadas pelo motor do robô com o cadastro da tela.
import assert from "node:assert/strict";
import { montarSimulacoes, montarConferencias, modeloDaSimulacao, preposicaoBairro } from "./simulacoesRobo.js";

assert.equal(preposicaoBairro("Vila Nova"), "na");
assert.equal(preposicaoBairro("Maré Mansa"), "na");
assert.equal(preposicaoBairro("Jardim Acapulco"), "no");
assert.equal(preposicaoBairro("Pernambuco"), "no");

const semana = ["seg", "ter", "qua", "qui", "sex"];
const HOJE = "2026-09-14"; // segunda-feira

// ---- frete calculado, formato do Guarujá
const GUARUJA = {
  has_delivery: true, has_pickup: true, pickup_requires_scheduling: true, pickup_is_store: false, pickup_address: "",
  street_address: "Rua Nove, 94", neighborhood: "Vila Zilda", catalog_image_url: "x",
  payment_delivery: ["pix", "card_machine", "cash"], payment_pickup: ["pix", "cash"],
  delivery_schedule: [{ days: semana, fee_rules: { mode: "modality", rules: [] }, charges_fee: true }],
  delivery_pricing: {
    versao: 1, raio_km: 15,
    grupos: [
      { dias: semana, tipos: [
        { nome: "Programada", inicio: "16:00", fim: "19:00", corte: "17:00", promessa: "janela", taxa: { modo: "fixa", valor: 10 } },
        { nome: "Imediata", inicio: "10:00", fim: "19:00", corte: "17:00", promessa: "minutos", minutos: 60, taxa: { modo: "fixa", valor: 15 } },
      ] },
      { dias: ["sab", "dom"], tipos: [{ nome: "Entrega", inicio: "10:00", fim: "13:00", corte: "13:00", promessa: "janela", taxa: { modo: "fixa", valor: 15 } }] },
    ],
    zonas: [{ nomes: ["Acapulco"], valor: 20 }, { nomes: ["Pernambuco", "Maré Mansa"], valor: 15 }, { nomes: ["Ilha"], nao_atende: true }],
  },
};
const g = montarSimulacoes(GUARUJA, HOJE);
const por = (rot) => g.find((x) => x.rotulo.includes(rot));

assert.equal(por("Pergunta geral").resposta,
  "Entregamos sim! De segunda a sexta, programada das 16h às 19h e imediata das 10h às 19h. Sábado e domingo, das 10h às 13h. Atendemos até 15 km daqui.");
assert.equal(por("entrega no mesmo dia").rotulo, "Segunda, 14/09, 15h · entrega no mesmo dia");
assert.equal(por("entrega no mesmo dia").resposta,
  "Hoje dá para receber na programada, das 16h às 19h, por R$ 10, ou na imediata, das 10h às 19h, que chega em até 60 min, por R$ 15.");
assert.equal(por("pede para amanhã").rotulo, "Sexta, 18/09, 18h30 · pede para amanhã");
assert.equal(por("pede para amanhã").resposta, "Entregamos sim! Amanhã, sábado, a entrega fica das 10h às 13h, por R$ 15.", "vale a tabela do dia da entrega");
const bairros = g.filter((x) => x.rotulo === "Bairro com taxa própria");
assert.equal(bairros.length, 2);
assert.equal(bairros[0].resposta, "Entregamos! No Acapulco a entrega é R$ 20 em qualquer horário: das 16h às 19h ou das 10h às 19h (em até 60 min).");
assert.equal(por("depois do horário").resposta,
  "Hoje os pedidos fecharam às 17h. Já anoto para você receber amanhã, terça, na programada, das 16h às 19h, por R$ 10, ou na imediata, das 10h às 19h, que chega em até 60 min, por R$ 15.");
assert.equal(por("Fora da área").resposta, "Esse endereço fica fora da nossa área de entrega: atendemos até 15 km. Se quiser, você pode retirar aqui com a gente.");
assert.equal(por("Pagamento").resposta,
  "Na entrega aceitamos Pix, crédito, débito e dinheiro. Na retirada, Pix e dinheiro. Pode buscar sim, com horário combinado aqui pelo WhatsApp, na Rua Nove, 94, Vila Zilda.");

const conf = montarConferencias(GUARUJA);
assert.ok(conf.some((c) => c.texto === "De segunda a sexta: o prazo em minutos aparece só na imediata; a programada fala só da janela."));
assert.ok(conf.some((c) => c.texto.startsWith("Os bairros com taxa própria valem")));
assert.ok(conf.some((c) => c.texto === "Sábado e domingo: pedidos até as 13h. Depois disso, fica para o próximo dia de entrega."));

// ---- frete por faixa de km (a maioria): mesma conta que o robô faz lendo a tabela
const SIMPLES = {
  has_delivery: true, has_pickup: false, max_delivery_radius_km: 10, avg_prep_time_minutes: 40, catalog_image_url: "",
  payment_delivery: ["pix", "credit"],
  delivery_schedule: [
    { days: semana, delivery_start: "10:00", delivery_end: "19:00", order_cutoff: "", charges_fee: true, fee_rules: [{ max_km: "3", fee: "6" }, { max_km: "10", fee: "12" }] },
  ],
};
const s = montarSimulacoes(SIMPLES, HOJE);
assert.equal(s.find((x) => x.rotulo.includes("mesmo dia")).rotulo, "Segunda, 14/09, 17h · entrega no mesmo dia");
assert.equal(s.find((x) => x.rotulo.includes("mesmo dia")).tag, "cliente a 2,5 km");
assert.equal(s.find((x) => x.rotulo.includes("mesmo dia")).resposta, "Hoje dá para receber das 10h às 19h, que chega em até 40 min, por R$ 6.");
assert.equal(s.find((x) => x.rotulo.includes("depois do horário")), undefined, "sem limite de pedidos, sem esse cenário");
assert.equal(s.find((x) => x.rotulo === "Pagamento e retirada").resposta, "Na entrega aceitamos Pix e crédito. Por enquanto a gente só faz entrega.");
const confS = montarConferencias(SIMPLES, { avisos: ["Raio de entrega entre 1 e 60 km."] });
assert.deepEqual(confS[0], { tipo: "aviso", texto: "Raio de entrega entre 1 e 60 km." });
assert.ok(confS.some((c) => c.texto === 'O robô promete a entrega "em até 40 min" depois de confirmado.'));
assert.ok(confS.some((c) => c.texto.startsWith("Sem catálogo")));

// ---- texto livre ("por modalidade"): sem simulação de frete, com o aviso
const MODALIDADE = { has_delivery: true, has_pickup: true, catalog_image_url: "x", payment_delivery: ["pix"], payment_pickup: ["pix"],
  delivery_schedule: [{ days: semana, delivery_start: "10:00", delivery_end: "18:00", charges_fee: true, fee_rules: { mode: "modality", rules: [{ label: "Centro", fee: "8" }] } }] };
assert.equal(modeloDaSimulacao(MODALIDADE), null);
assert.deepEqual(montarSimulacoes(MODALIDADE, HOJE).map((x) => x.rotulo), ["Pagamento e retirada"]);
assert.ok(montarConferencias(MODALIDADE).some((c) => c.texto.startsWith("Seu frete está em texto livre")));

// ---- só retirada
assert.deepEqual(montarSimulacoes({ has_delivery: false, has_pickup: true, pickup_requires_scheduling: false, payment_pickup: ["cash"], street_address: "Rua A, 1" }, HOJE),
  [{ rotulo: "Pagamento e retirada", pergunta: "Aceita cartão? Posso buscar aí?", resposta: "Na retirada, dinheiro. Pode buscar sim, é só vir no horário, na Rua A, 1." }]);

console.log("simulacoesRobo: ok");
