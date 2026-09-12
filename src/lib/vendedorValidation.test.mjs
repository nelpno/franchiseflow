// Testes puros (node:assert, sem framework) — regras da tela Meu Vendedor.
// Rodar: node src/lib/vendedorValidation.test.mjs
import assert from "node:assert";
import { validarEtapa, validarTudo, nomeDeRobo } from "./vendedorValidation.js";

const base = {
  franchise_name: "Maxi Massas Centro", street_address: "Rua Nove, 94", neighborhood: "Vila Zilda", city: "Guarujá",
  personal_phone_for_summary: "13974088382",
  has_delivery: true, has_pickup: false, max_delivery_radius_km: 15,
  delivery_schedule: [{ days: ["seg", "ter", "qua", "qui", "sex"], delivery_start: "16:00", delivery_end: "19:00", order_cutoff: "16:00", charges_fee: true,
    fee_rules: [{ max_km: "5", fee: "8" }, { max_km: "10", fee: "12" }] }],
  payment_delivery: ["pix", "credit"], payment_pickup: [],
  pix_key_type: "cpf", pix_key_data: "123.456.789-00", charges_card_fee_to_customer: false, payment_fees: null,
  agent_name: "Ana",
};
const ok = (r) => r.erros.length === 0 && r.avisos.length === 0;

// ── uma configuração boa passa inteira; a Bauru (corte = início da entrega) passa ──
assert.ok(ok(validarTudo(base, Object.keys(base))), JSON.stringify(validarTudo(base, Object.keys(base))));

// ── nome da atendente: palavra inteira ──
for (const n of ["Ana", "Roberta", "Maria", "Iara", "Bianca"]) assert.equal(nomeDeRobo(n), false, n);
for (const n of ["Robô Ana", "Ana IA", "Assistente Virtual", "Bot Maxi", "ana (ia)", "Robo"]) assert.equal(nomeDeRobo(n), true, n);

// ── problema antigo que a tela não mexeu = aviso; mexeu = erro; configuração nova = erro ──
const robo = { ...base, agent_name: "Assistente Maxi" };
assert.deepEqual(validarEtapa(4, robo, []).erros, []);
assert.equal(validarEtapa(4, robo, []).avisos.length, 1);
assert.equal(validarEtapa(4, robo, ["agent_name"]).erros.length, 1);
assert.equal(validarEtapa(4, robo, [], { novo: true }).erros.length, 1);
// mexer em OUTRA coisa não transforma o aviso em erro
assert.deepEqual(validarEtapa(4, robo, ["promotions_combo"]).erros, []);

// ── entrega e retirada ──
assert.equal(validarEtapa(2, { ...base, has_delivery: false, has_pickup: false }, ["has_delivery"]).erros[0],
  "Ligue a entrega ou a retirada: sem nenhuma, o robô não tem como vender.");
assert.match(validarEtapa(2, { ...base, max_delivery_radius_km: 0 }, ["max_delivery_radius_km"]).erros[0], /entre 1 e 60/);
assert.match(validarEtapa(2, { ...base, max_delivery_radius_km: 70 }, ["max_delivery_radius_km"]).erros[0], /entre 1 e 60/);
assert.match(validarEtapa(2, { ...base, max_delivery_radius_km: 8 }, ["max_delivery_radius_km"]).erros[0], /menor que a maior faixa de frete \(10 km\)/);
assert.match(validarEtapa(2, { ...base, delivery_schedule: [] }, ["delivery_schedule"]).erros[0], /Defina os dias e o horário/);
// corte depois do fim barra; corte igual ao início (Bauru) não
const corteTarde = [{ ...base.delivery_schedule[0], order_cutoff: "20:00" }];
assert.match(validarEtapa(2, { ...base, delivery_schedule: corteTarde }, ["delivery_schedule"]).erros[0], /passa do fim da entrega/);
// linha de frete pela metade (regra do configSave, agora dentro da etapa)
const metade = [{ ...base.delivery_schedule[0], fee_rules: [{ max_km: "5", fee: "8" }, { max_km: "10", fee: "" }] }];
assert.match(validarEtapa(2, { ...base, delivery_schedule: metade }, ["delivery_schedule"]).erros[0], /^Seg a Sex, faixa 2: falta o valor\./);
// frete em texto livre ("por modalidade") segue no editor antigo, com a regra antiga
const modal = [{ ...base.delivery_schedule[0], fee_rules: { mode: "modality", rules: [{ label: "Centro", fee: "" }] } }];
assert.match(validarEtapa(2, { ...base, delivery_schedule: modal }, ["delivery_schedule"]).erros[0], /^Frete: Seg a Sex, linha 1: falta o valor/);
// cartão novo: o que a tela mostra (modelo em edição) é o que vale
const editando = { ...base, _frete_modelo: { raio_km: 15, zonas: [], grupos: [{ dias: ["seg"], tipos: [{ nome: "Entrega", inicio: "10:00", fim: "18:00", corte: "", promessa: "minutos", minutos: "", taxa: { modo: "fixa", valor: 8 } }] }] } };
assert.match(validarEtapa(2, editando, ["_frete_modelo"]).erros[0], /^Seg: diga em até quantos minutos/);
// frete calculado: bairro sem valor barra
const calculado = { ...base, delivery_pricing: { raio_km: 15, grupos: editando._frete_modelo.grupos.map((g) => ({ ...g, tipos: [{ ...g.tipos[0], promessa: "janela" }] })), zonas: [{ nomes: ["Centro"], valor: "" }] } };
assert.match(validarEtapa(2, calculado, ["delivery_pricing"]).erros[0], /^Bairros com taxa diferente, linha 1: falta o valor/);
// retirada que fecha antes de abrir
const retirada = { ...base, has_pickup: true, has_custom_pickup_hours: true, payment_pickup: ["pix"], pickup_schedule: [{ days: ["sab"], open: "14:00", close: "12:00" }] };
assert.match(validarEtapa(2, retirada, ["pickup_schedule"]).erros[0], /fechamento tem de ser depois/);
// só retirada, sem entrega: raio e horário de entrega não importam
assert.ok(ok(validarEtapa(2, { ...base, has_delivery: false, has_pickup: true, max_delivery_radius_km: null, delivery_schedule: [] }, ["has_delivery"])));

// ── pagamento ──
assert.match(validarEtapa(3, { ...base, pix_key_data: "" }, ["pix_key_data"]).erros[0], /Pix marcado/);
assert.match(validarEtapa(3, { ...base, payment_delivery: [] }, ["payment_delivery"]).erros[0], /na entrega/);
// repassar taxa: 0 vale; vazio não
assert.match(validarEtapa(3, { ...base, charges_card_fee_to_customer: true }, ["charges_card_fee_to_customer"]).erros[0], /percentual de Crédito/);
assert.ok(ok(validarEtapa(3, { ...base, charges_card_fee_to_customer: true, payment_fees: { credit: 0 } }, ["charges_card_fee_to_customer"])));
// formato da chave e do link: só aviso, nunca barra
const pixEstranho = validarEtapa(3, { ...base, pix_key_data: "1234" }, ["pix_key_data"]);
assert.equal(pixEstranho.erros.length, 0);
assert.match(pixEstranho.avisos[0], /não parece CPF/);
assert.ok(ok(validarEtapa(3, { ...base, pix_key_type: "random", pix_key_data: "123e4567-e89b-12d3-a456-426614174000" }, ["pix_key_data"])));
assert.ok(ok(validarEtapa(3, { ...base, pix_key_type: "phone", pix_key_data: "+55 (13) 97408-8382" }, ["pix_key_data"])));
assert.equal(validarEtapa(3, { ...base, payment_link: "meu link" }, ["payment_link"]).erros.length, 0);
assert.equal(validarEtapa(3, { ...base, payment_link: "meu link" }, ["payment_link"]).avisos.length, 1);
assert.ok(ok(validarEtapa(3, { ...base, payment_link: "mpago.la/abc123" }, ["payment_link"])));

// ── telefone ──
assert.ok(ok(validarEtapa(1, { ...base, personal_phone_for_summary: "5513974088382" }, ["personal_phone_for_summary"])));
assert.match(validarEtapa(1, { ...base, personal_phone_for_summary: "9740883" }, ["personal_phone_for_summary"]).erros[0], /DDD \+ número/);

console.log("vendedorValidation: ok");
