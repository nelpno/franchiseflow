// Testes puros (node:assert) — S11.1: faixa da mensalidade na Início e resumo da Equipe Digital.
// Rodar: node src/lib/pagamentos.test.mjs
// Fuso do processo em UTC: a data de "hoje" tem de sair de Brasília, não do aparelho.
process.env.TZ = "UTC";

import assert from "node:assert";
import { faixaMensalidade, resumoEquipeDigital, mesAtualBRT, mesBRT, FAIXA_DIAS_ANTES } from "./pagamentos.js";

const sub = (over = {}) => ({
  asaas_customer_id: "cus_1",
  asaas_subscription_id: "sub_1",
  subscription_status: "ACTIVE",
  current_payment_status: "PENDING",
  current_payment_due_date: "2026-10-05",
  current_payment_value: 150,
  ...over,
});
const dia = (iso) => new Date(`${iso}T12:00:00-03:00`);

// ── faixa: janela de 3 dias antes até o dia ──
assert.equal(FAIXA_DIAS_ANTES, 3);
assert.equal(faixaMensalidade(sub(), { hoje: dia("2026-10-01") }), null, "4 dias antes: sem faixa");
const f3 = faixaMensalidade(sub(), { hoje: dia("2026-10-02") });
assert.equal(f3.dias, 3);
assert.equal(f3.texto, "A mensalidade da Equipe Digital Maxi vence dia 05/10.");
assert.equal(faixaMensalidade(sub(), { hoje: dia("2026-10-04") }).dias, 1);
const f0 = faixaMensalidade(sub(), { hoje: dia("2026-10-05") });
assert.equal(f0.texto, "A mensalidade da Equipe Digital Maxi vence hoje (05/10).");
// depois do vencimento a faixa some (a da carência assume)
assert.equal(faixaMensalidade(sub(), { hoje: dia("2026-10-06") }), null);
// paga, cancelada, sem assinatura, sem linha: nunca
assert.equal(faixaMensalidade(sub({ current_payment_status: "PAID" }), { hoje: dia("2026-10-03") }), null);
assert.equal(faixaMensalidade(sub({ subscription_status: "CANCELLED" }), { hoje: dia("2026-10-03") }), null);
assert.equal(faixaMensalidade(sub({ asaas_subscription_id: null }), { hoje: dia("2026-10-03") }), null);
assert.equal(faixaMensalidade(null, { hoje: dia("2026-10-03") }), null);
assert.equal(faixaMensalidade(sub({ current_payment_due_date: null }), { hoje: dia("2026-10-03") }), null);
// meia-noite de Brasília: 02/10 23:30 BRT = 03/10 02:30 UTC → ainda é dia 02 (3 dias antes)
assert.equal(faixaMensalidade(sub(), { hoje: new Date("2026-10-03T02:30:00Z") }).dias, 3);
// 01/10 23:59 BRT (02/10 02:59 UTC) → ainda 4 dias antes, sem faixa (o aparelho em UTC diria 3)
assert.equal(faixaMensalidade(sub(), { hoje: new Date("2026-10-02T02:59:00Z") }), null);
// texto nunca usa "amanhã"
for (let d = 2; d <= 5; d++) {
  const f = faixaMensalidade(sub(), { hoje: dia(`2026-10-0${d}`) });
  assert.ok(!/amanh/i.test(f.texto), f.texto);
}

// ── resumo da Equipe Digital ──
assert.deepEqual(resumoEquipeDigital({}), [], "sem dado nenhum: lista vazia");
assert.deepEqual(resumoEquipeDigital({ atribuicao: { verba_bruta: 0, vendas_anuncio: 0 } }), [], "zeros não viram linha");
const r = resumoEquipeDigital({
  atribuicao: { verba_bruta: "500", vendas_anuncio: 12, receita_anuncio: "1234.5", clientes_novos_anuncio: 1 },
  funil: { has_bot_data: true, reached: 230, converted: 31 },
});
assert.deepEqual(r.map((l) => l.chave), ["anuncio", "vendas_anuncio", "clientes_novos", "robo"]);
assert.ok(r[0].texto.startsWith("Anúncio no ar com R$"), r[0].texto);
assert.ok(r[0].texto.includes("500"), r[0].texto);
assert.ok(r[1].texto.startsWith("12 vendas de quem chegou pelo anúncio"), r[1].texto);
assert.equal(r[2].texto, "1 cliente novo veio do anúncio");
assert.equal(r[3].texto, "O robô atendeu 230 pessoas; 31 compraram");
// robô sem base (parado) não aparece — mesma trava do card de conversão
assert.deepEqual(resumoEquipeDigital({ funil: { has_bot_data: false, reached: 4, converted: 4 } }), []);
assert.equal(resumoEquipeDigital({ funil: { has_bot_data: true, reached: 25, converted: 0 } })[0].texto, "O robô atendeu 25 pessoas");
assert.equal(resumoEquipeDigital({ atribuicao: { vendas_anuncio: 1, receita_anuncio: 50 } })[0].texto.slice(0, 7), "1 venda");
// nenhuma linha com palavra proibida
for (const l of r) assert.ok(!/margem|amanh|loja|reserv|separ|invent|ticket|líquido/i.test(l.texto), l.texto);

// ── mês atual em Brasília ──
assert.deepEqual(mesAtualBRT({ hoje: new Date("2026-10-01T02:00:00Z") }), { chave: "2026-09", inicio: "2026-09-01", ate: "2026-09-30" });
assert.deepEqual(mesAtualBRT({ hoje: dia("2026-10-07") }), { chave: "2026-10", inicio: "2026-10-01", ate: "2026-10-07" });

// ── mês anterior fechado (setas do card) ──
assert.deepEqual(mesBRT({ hoje: dia("2026-10-01"), deslocamento: -1 }), { chave: "2026-09", inicio: "2026-09-01", ate: "2026-09-30" });
assert.deepEqual(mesBRT({ hoje: dia("2026-03-15"), deslocamento: -1 }), { chave: "2026-02", inicio: "2026-02-01", ate: "2026-02-28" });
assert.deepEqual(mesBRT({ hoje: dia("2026-01-10"), deslocamento: -1 }), { chave: "2025-12", inicio: "2025-12-01", ate: "2025-12-31" });
// 23h de 31/10 em Brasília já é 01/11 em UTC: o "anterior" continua setembro
assert.equal(mesBRT({ hoje: new Date("2026-11-01T02:00:00Z"), deslocamento: -1 }).chave, "2026-09");
assert.deepEqual(mesBRT({ hoje: dia("2026-10-07") }), mesAtualBRT({ hoje: dia("2026-10-07") }));

console.log("pagamentos.test.mjs: ok");
