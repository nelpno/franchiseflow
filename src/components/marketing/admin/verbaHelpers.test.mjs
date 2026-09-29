// node src/components/marketing/admin/verbaHelpers.test.mjs
import assert from "node:assert/strict";
import {
  obsNaoPagou,
  montarListasVerba,
  montarMensagemVerba,
  montarMensagemComprovante,
  montarMensagemAdiantar,
  mesCobrado,
  textoMesSeguinte,
} from "./verbaHelpers.js";

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

test("obsNaoPagou: nova começando vs nova com meses", () => {
  assert.equal(obsNaoPagou({ is_new: true, age_days: 5 }), "nova · começando");
  assert.equal(obsNaoPagou({ is_new: true, age_days: 20 }), "nova · 20 dias");
  // Nova é < 30 dias (29/09): com 32 dias e sem venda nenhuma, já é "nunca vendeu".
  assert.equal(obsNaoPagou({ is_new: true, age_days: 32 }), "também nunca vendeu");
  // Trilha aprovada deixa de ser "nova" (régua única): sem motivo aparente → vazio.
  assert.equal(obsNaoPagou({ age_days: 20, onboarding_status: "approved", days_since_last_sale: 1 }), "");
  // Nova parada há mais de 30 dias: sem venda ganha de nova.
  assert.equal(obsNaoPagou({ age_days: 50, days_since_last_sale: 35 }), "também sem venda há 35 dias");
});

test("obsNaoPagou: sem venda ganha de queda quando os dois valem", () => {
  assert.equal(
    obsNaoPagou({ is_new: false, days_since_last_sale: 30, rev_delta_pct: -54 }),
    "também sem venda há 30 dias"
  );
});

test("obsNaoPagou: só queda", () => {
  assert.equal(
    obsNaoPagou({ is_new: false, days_since_last_sale: 2, rev_delta_pct: -54.4 }),
    "vendendo 54,4% menos"
  );
});

test("obsNaoPagou: unidade saudável sem motivo aparente fica vazio", () => {
  assert.equal(obsNaoPagou({ is_new: false, days_since_last_sale: 1, rev_delta_pct: -5 }), "");
  assert.equal(obsNaoPagou(null), "");
});

test("montarListasVerba: separa as 4 filas e não mistura unidade paga em não-pagaram", () => {
  const overview = [
    { franchise_id: "a", franchise_name: "A", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-09", marketing_target_paid: false, is_new: false, days_since_last_sale: 30, rev_90d: 100 },
    { franchise_id: "b", franchise_name: "B", marketing_month: "2026-09", marketing_month_paid: true, marketing_month_raised_at: null, marketing_month_amount: 250, marketing_target_month: "2026-09", marketing_target_paid: true, marketing_target_raised_at: null, marketing_target_amount: 250, rev_90d: 500 },
    { franchise_id: "c", franchise_name: "C", marketing_month: "2026-09", marketing_month_paid: true, marketing_month_raised_at: "2026-09-10T00:00:00Z", marketing_month_amount: 300, marketing_target_month: "2026-09", marketing_target_paid: true, marketing_target_raised_at: "2026-09-10T00:00:00Z", marketing_target_amount: 300, rev_90d: 900 },
  ];
  const payments = [
    { franchise_id: "b", reference_month: "2026-09", status: "confirmed", proof_url: null, created_at: "2026-09-23T12:00:00Z" },
    { franchise_id: "c", reference_month: "2026-09", status: "confirmed", proof_url: "x", created_at: "2026-09-05T00:00:00Z" },
  ];
  const pendentes = [
    { franchise_id: "d", reference_month: "2026-08", status: "pending", proof_url: "y", created_at: "2026-09-24T00:00:00Z" },
  ];
  // "d" não está na overview (teste/inativa) — some da fila mesmo estando pending
  const overviewComD = [...overview, { franchise_id: "d", franchise_name: "D Teste" }];
  const agora = new Date("2026-09-26T12:00:00Z");
  const r = montarListasVerba({ overview, payments, pendentes, mesAtual: "2026-09", mesAlvo: "2026-09", agora });

  assert.equal(r.naoPagaram.length, 1);
  assert.equal(r.naoPagaram[0].row.franchise_id, "a");
  assert.equal(r.naoPagaram[0].obs, "também sem venda há 30 dias");
  assert.equal(r.naoPagaram[0].mes, "2026-09");

  assert.equal(r.faltaSubir.length, 1);
  assert.equal(r.faltaSubir[0].row.franchise_id, "b");
  assert.equal(r.faltaSubir[0].dias, 3);

  assert.equal(r.semComprovante.length, 1);
  assert.equal(r.semComprovante[0].payment.franchise_id, "b");

  // "d" está pending mas fora da overview passada aqui: some da fila
  assert.equal(r.aConfirmar.length, 0);

  const r2 = montarListasVerba({ overview: overviewComD, payments, pendentes, mesAtual: "2026-09", mesAlvo: "2026-09", agora });
  assert.equal(r2.aConfirmar.length, 1);
  assert.equal(r2.aConfirmar[0].payment.franchise_id, "d");
  assert.equal(r2.aConfirmar[0].row.franchise_name, "D Teste");

  assert.equal(r.resumo.total, 3);
  assert.equal(r.resumo.pagaramCount, 2);
  assert.equal(r.resumo.brutoPago, 550);
  assert.equal(r.resumo.subidasCount, 1);
});

test("montarListasVerba: mês corrente pago e não subido aparece mesmo com mês-alvo diferente", () => {
  // Últimos 5 dias do mês: setembro já devia estar rodando, outubro é o que o formulário cobra
  const overview = [
    {
      franchise_id: "a",
      franchise_name: "A",
      marketing_month: "2026-09",
      marketing_month_paid: true,
      marketing_month_raised_at: null,
      marketing_month_amount: 250,
      marketing_target_month: "2026-10",
      marketing_target_paid: false,
      marketing_target_raised_at: null,
      marketing_target_amount: null,
    },
  ];
  const payments = [
    { franchise_id: "a", reference_month: "2026-09", status: "confirmed", proof_url: "x", created_at: "2026-09-20T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments, pendentes: [], mesAtual: "2026-09", mesAlvo: "2026-10" });
  assert.equal(r.faltaSubir.length, 1);
  assert.equal(r.faltaSubir[0].mes, "2026-09");
  assert.equal(r.faltaSubir[0].valor, 250);
  assert.equal(r.faltaSubir[0].payment.franchise_id, "a");
  // não entra em "não pagaram" (marketing_month_paid é true)
  assert.equal(r.naoPagaram.length, 0);
});

test("montarListasVerba: payment de outro mês não entra nas filas do mês-alvo", () => {
  const overview = [{ franchise_id: "a", franchise_name: "A", marketing_month: "2026-09", marketing_month_paid: true, marketing_month_raised_at: null, marketing_month_amount: 200, marketing_target_month: "2026-09", marketing_target_paid: true, marketing_target_raised_at: null, marketing_target_amount: 200 }];
  const payments = [{ franchise_id: "a", reference_month: "2026-08", status: "confirmed", proof_url: null, created_at: "2026-08-01T00:00:00Z" }];
  const r = montarListasVerba({ overview, payments, pendentes: [], mesAtual: "2026-09", mesAlvo: "2026-09" });
  assert.equal(r.semComprovante.length, 0);
  // faltaSubir olha o overview (não o payment), então ainda aparece — mas sem payment casado
  assert.equal(r.faltaSubir.length, 1);
  assert.equal(r.faltaSubir[0].payment, null);
});

test("montarListasVerba: pendente sem comprovante aparece em EXATAMENTE 1 fila (A confirmar)", () => {
  const overview = [
    { franchise_id: "e", franchise_name: "E", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-09", marketing_target_paid: false, is_new: false, days_since_last_sale: 1, rev_delta_pct: 0, rev_90d: 100 },
  ];
  const pendentes = [
    { franchise_id: "e", reference_month: "2026-09", status: "pending", proof_url: null, created_at: "2026-09-24T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: pendentes, pendentes, mesAtual: "2026-09", mesAlvo: "2026-09" });
  // pendente sem comprovante: só em "A confirmar" — nunca em "Não pagaram" nem em
  // "Pagou sem comprovante" (achado "design" alto 26/09).
  assert.equal(r.aConfirmar.length, 1);
  assert.equal(r.naoPagaram.length, 0);
  assert.equal(r.semComprovante.length, 0);
});

test("montarListasVerba: pendente de mês ANTIGO não esconde quem não pagou o mês corrente", () => {
  // achado "medio" 26/09: pendingFids não podia valer pra pendente de agosto quando o mês
  // cobrado é setembro — senão a unidade some de "Não pagaram" mas não está em "A confirmar" do
  // mês certo, e o total da fila diverge do semVerba() que Hoje/Unidades/Financeiro usam.
  const overview = [
    { franchise_id: "f", franchise_name: "F", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-09", marketing_target_paid: false, days_since_last_sale: 1, rev_delta_pct: 0 },
  ];
  const pendentes = [
    { franchise_id: "f", reference_month: "2026-08", status: "pending", proof_url: null, created_at: "2026-08-20T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: [], pendentes, mesAtual: "2026-09", mesAlvo: "2026-09" });
  assert.equal(r.naoPagaram.length, 1);
  assert.equal(r.naoPagaram[0].aguardandoConfirmacao, false);
  assert.equal(r.naoPagaramTodas.length, 1);
});

test("montarListasVerba: fechamento total − pagaram = naoPagaramTodas (achado 'medio' 26/09)", () => {
  const overview = [
    { franchise_id: "a", franchise_name: "A", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-09", marketing_target_paid: false, days_since_last_sale: 1, rev_delta_pct: 0 },
    { franchise_id: "b", franchise_name: "B", marketing_month: "2026-09", marketing_month_paid: true, marketing_month_amount: 200, marketing_target_month: "2026-09", marketing_target_paid: true, marketing_target_amount: 200 },
    // "c" tem um pendente do mês certo: some de naoPagaram (default), mas segue contado em
    // naoPagaramTodas com aguardandoConfirmacao=true — pra o total bater com semVerba().
    { franchise_id: "c", franchise_name: "C", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-09", marketing_target_paid: false, days_since_last_sale: 1, rev_delta_pct: 0 },
  ];
  const pendentes = [
    { franchise_id: "c", reference_month: "2026-09", status: "pending", proof_url: null, created_at: "2026-09-24T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: [], pendentes, mesAtual: "2026-09", mesAlvo: "2026-09" });
  // total(3) − pagaram(1, só "b") = 2 unidades sem verba → naoPagaramTodas tem os 2 (a e c)
  assert.equal(r.resumo.total - r.resumo.pagaramCount, 2);
  assert.equal(r.naoPagaramTodas.length, 2);
  assert.equal(r.naoPagaram.length, 1); // "c" fica de fora da lista de qualidade (está em "A confirmar")
  const c = r.naoPagaramTodas.find((x) => x.row.franchise_id === "c");
  assert.equal(c.aguardandoConfirmacao, true);
});

test("montarListasVerba: semComprovanteTodos inclui pendente sem foto (régua do banco); default não", () => {
  const overview = [
    { franchise_id: "g", franchise_name: "G", marketing_month: "2026-09", marketing_month_paid: true, marketing_target_month: "2026-09", marketing_target_paid: true },
  ];
  const pendentes = [
    { franchise_id: "g", reference_month: "2026-09", status: "pending", proof_url: null, created_at: "2026-09-24T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: pendentes, pendentes, mesAtual: "2026-09", mesAlvo: "2026-09" });
  assert.equal(r.semComprovante.length, 0);
  assert.equal(r.semComprovanteTodos.length, 1);
  assert.equal(r.semComprovanteTodos[0].pendente, true);
});

test("montarListasVerba: resumo.alvo é a perna do mês-alvo, separada do mês do calendário", () => {
  const overview = [
    { franchise_id: "a", franchise_name: "A", marketing_month: "2026-09", marketing_month_paid: true, marketing_month_amount: 200, marketing_month_raised_at: "2026-09-05", marketing_target_month: "2026-10", marketing_target_paid: false, marketing_target_amount: null, marketing_target_raised_at: null },
    { franchise_id: "b", franchise_name: "B", marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-10", marketing_target_paid: true, marketing_target_amount: 300, marketing_target_raised_at: null, is_new: false, days_since_last_sale: 1, rev_delta_pct: 0 },
  ];
  const r = montarListasVerba({ overview, payments: [], pendentes: [], mesAtual: "2026-09", mesAlvo: "2026-10" });
  assert.equal(r.resumo.pagaramCount, 1);
  assert.equal(r.resumo.brutoPago, 200);
  assert.equal(r.resumo.alvo.pagaramCount, 1);
  // valores diferentes por perna (200 de A no calendário, 300 de B no alvo): prova que cada
  // resumo soma só a sua unidade, sem misturar as pernas
  assert.equal(r.resumo.alvo.brutoPago, 300);
});

test("mesCobrado: quem não pagou o mês do calendário é cobrado por ele; quem já pagou, pelo mês-alvo", () => {
  assert.equal(mesCobrado({ marketing_month: "2026-09", marketing_month_paid: false, marketing_target_month: "2026-10" }), "2026-09");
  assert.equal(mesCobrado({ marketing_month: "2026-09", marketing_month_paid: true, marketing_target_month: "2026-10" }), "2026-10");
  assert.equal(mesCobrado(null), null);
});

test("textoMesSeguinte: mês em maiúscula, tom neutro (nunca cobrança)", () => {
  const t = textoMesSeguinte("2026-10", { pagaramCount: 12 }, 66);
  assert.equal(t, "Outubro já abriu: 12 de 66 pagaram até agora →");
  for (const proibida of ["não pagou", "urgente", "atrasad"]) {
    assert.ok(!t.toLowerCase().includes(proibida));
  }
});

test("montarMensagemComprovante: pede a foto, sem emoji nem travessão", () => {
  const msg = montarMensagemComprovante("2026-09", { owner_name: "Karina Silva", franchise_name: "Maxi Massas Itápolis" });
  assert.match(msg, /Oi, Karina!/);
  assert.match(msg, /comprovante/);
  assert.match(msg, /Itápolis/);
  assert.ok(!/—|–/.test(msg));
});

test("montarListasVerba: adiantar só existe com janela ativa (mesAlvo ≠ mesAtual) e ordena por rev_90d", () => {
  const overview = [
    { franchise_id: "a", franchise_name: "A", marketing_target_paid: false, rev_90d: 100 },
    { franchise_id: "b", franchise_name: "B", marketing_target_paid: true, rev_90d: 900 },
    { franchise_id: "c", franchise_name: "C", marketing_target_paid: false, rev_90d: 500 },
  ];
  const semJanela = montarListasVerba({ overview, payments: [], pendentes: [], mesAtual: "2026-09", mesAlvo: "2026-09" });
  assert.equal(semJanela.adiantar.length, 0);

  const comJanela = montarListasVerba({ overview, payments: [], pendentes: [], mesAtual: "2026-09", mesAlvo: "2026-10" });
  assert.equal(comJanela.adiantar.length, 2);
  assert.equal(comJanela.adiantar[0].franchise_id, "c"); // 500 > 100
  assert.equal(comJanela.adiantar[1].franchise_id, "a");
});

test("montarListasVerba: adiantar tira quem já mandou o pagamento do mês-alvo (A confirmar)", () => {
  // achado "medio" 26/09: sem isso a Maxi chamava de novo quem já pagou outubro e só está
  // esperando confirmação.
  const overview = [
    { franchise_id: "a", franchise_name: "A", marketing_target_paid: false, rev_90d: 100 },
    { franchise_id: "c", franchise_name: "C", marketing_target_paid: false, rev_90d: 500 },
  ];
  const pendentes = [
    { franchise_id: "c", reference_month: "2026-10", status: "pending", proof_url: null, created_at: "2026-09-24T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: [], pendentes, mesAtual: "2026-09", mesAlvo: "2026-10" });
  assert.equal(r.adiantar.length, 1);
  assert.equal(r.adiantar[0].franchise_id, "a");
});

test("montarListasVerba: aConfirmar do mais antigo para o mais novo", () => {
  const overview = [
    { franchise_id: "a", franchise_name: "A" },
    { franchise_id: "b", franchise_name: "B" },
  ];
  const pendentes = [
    { franchise_id: "a", reference_month: "2026-09", status: "pending", proof_url: null, created_at: "2026-09-24T00:00:00Z" },
    { franchise_id: "b", reference_month: "2026-09", status: "pending", proof_url: null, created_at: "2026-09-20T00:00:00Z" },
  ];
  const r = montarListasVerba({ overview, payments: [], pendentes, mesAtual: "2026-09", mesAlvo: "2026-09" });
  assert.equal(r.aConfirmar.length, 2);
  assert.equal(r.aConfirmar[0].payment.franchise_id, "b"); // 20/09, mais antigo primeiro
  assert.equal(r.aConfirmar[1].payment.franchise_id, "a");
});

test("montarMensagemAdiantar: tom neutro, nunca cobrança, com o mês-alvo", () => {
  const msg = montarMensagemAdiantar("2026-10", { owner_name: "Karina", franchise_name: "Maxi Massas Itápolis" });
  assert.match(msg, /outubro/);
  assert.match(msg, /Itápolis/);
  for (const proibida of ["atrasad", "não pagou", "urgente"]) {
    assert.ok(!msg.toLowerCase().includes(proibida));
  }
});

test("montarMensagemVerba: nunca promete desconto/prazo, sempre cita o mínimo e o mês", () => {
  const msg = montarMensagemVerba("2026-10");
  assert.match(msg, /R\$ 200/);
  assert.match(msg, /outubro/);
  for (const proibida of ["desconto", "promoção", "grátis"]) {
    assert.ok(!msg.toLowerCase().includes(proibida), `mensagem não deveria conter "${proibida}"`);
  }
});

console.log(`verbaHelpers: ok (${passed} testes)`);
