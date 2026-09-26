// Testes de src/lib/fichaUnidade.js — node:assert puro, sem framework.
// Roda com: node src/lib/fichaUnidade.test.mjs
import assert from "node:assert";
import {
  motivoPrincipal, diagnosticar, roteiroPara, montarMensagemUnidade,
  temPalavraProibida, guiaPara, PALAVRAS_PROIBIDAS,
} from "./fichaUnidade.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FALHOU: ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

// Unidade "Itápolis" — sem venda há 30 dias, robô parado, verba de outubro (mês-alvo)
// ainda não paga (mas setembro, o mês do calendário, também não). Reflete o jsonb de
// get_unit_360, não o cache de saúde: motivoPrincipal deve usar a régua única
// (networkOverview.sinaisUnidade sobre linhaDaFicha), não unit.health.flags cru.
const baseUnit = {
  franchise_id: "franquiaitatibasp",
  franchise_name: "Maxi Massas Itatiba",
  city: "Itatiba - SP",
  owner_name: "Gustavo Silva",
  age_days: 188,
  is_new: false,
  sales: { days_since_last_sale: 30, rev_delta_pct: -100 },
  bot: { days_since_last_conversation: 30, people_7d: 0 },
  marketing: { months: [{ month: "2026-09", status: "not_paid" }], target_month: "2026-10", calendar_month: "2026-09" },
  subscription: { due_date: "2026-09-05", payment_status: "PENDING" },
  purchase_orders: { last: { ordered_at: "2026-04-25", total_amount: 4470 }, days_since_last: 154 },
  onboarding: { status: "approved", pct: 100 },
  // O cache de saúde (13:32) diz outra coisa — a régua da lista tem de vencer.
  health: { flags: [{ key: "margin_negative", sev: "high" }], tier: "healthy" },
};

test("motivoPrincipal usa a régua única (sem_venda), não o cache de saúde desatualizado", () => {
  assert.strictEqual(motivoPrincipal(baseUnit), "sem_venda");
});

test("motivoPrincipal cai nas bandeiras de saúde quando a régua não acusa nada", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 1, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PAID" },
    health: { flags: [{ key: "pix_missing", sev: "med" }], tier: "healthy" },
  };
  assert.strictEqual(motivoPrincipal(u), "pix_missing");
});

test("motivoPrincipal sem nenhum sinal (régua ou saúde) devolve null", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 1, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PAID" },
    health: { flags: [], tier: "healthy" },
  };
  assert.strictEqual(motivoPrincipal(u), null);
});

test("diagnosticar unidade nova (trilha em andamento) ignora venda/verba, mas trilha APROVADA não protege mais", () => {
  const u = { ...baseUnit, is_new: true, age_days: 5, onboarding: { status: "in_progress", pct: 40 }, sales: { days_since_last_sale: 3 }, bot: {} };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "nova");
  assert.match(d.frase, /Nova na trilha/);
  assert.match(d.frase, /40%/);
});

test("diagnosticar: unidade nova mas com a trilha JÁ APROVADA cai na régua normal (não fica 'nova' pra sempre)", () => {
  const u = { ...baseUnit, is_new: true, age_days: 40, onboarding: { status: "approved", pct: 100 } };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "sem_venda");
  assert.doesNotMatch(d.frase, /Nova na trilha/);
});

test("diagnosticar: unidade nova com problema real (>30 dias sem venda) mostra o problema, não só 'nova'", () => {
  const u = {
    ...baseUnit,
    is_new: true,
    age_days: 45,
    onboarding: { status: "in_progress", pct: 10 },
    sales: { days_since_last_sale: 35, rev_delta_pct: null },
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "sem_venda");
});

test("diagnosticar sem_venda menciona dias sem venda, robô parado e o MÊS DO CALENDÁRIO quando NENHUM dos dois foi pago", () => {
  const d = diagnosticar(baseUnit);
  assert.strictEqual(d.motivo, "sem_venda");
  assert.match(d.frase, /Sem venda há 30 dias/);
  assert.match(d.frase, /Sem conversa no robô há 30 dias/);
  assert.match(d.frase, /setembro/); // calendar_month, não o alvo (outubro)
});

test("diagnosticar sem_venda não acusa falta de verba quando o mês do calendário JÁ está pago (só o alvo falta, e falta de propósito)", () => {
  const u = {
    ...baseUnit,
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
  };
  const d = diagnosticar(u);
  assert.doesNotMatch(d.frase, /Não pagou a verba/);
});

test("diagnosticar 'caiu' usa o MESMO percentual da régua (sales.rev_delta_pct), não o do cache de saúde", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 2, rev_delta_pct: -27.3 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PAID" },
    // cache de saúde diz -44.5% (outra janela/régua) — a Ficha tem de ignorar isso.
    health: { flags: [{ key: "revenue_drop", sev: "med" }], signals: { revenue_delta_pct: -44.5 }, tier: "attention" },
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "caiu");
  assert.match(d.frase, /27,3% menos/);
  assert.doesNotMatch(d.frase, /44,5/);
});

test("diagnosticar mensalidade vencida bate com a MESMA régua da lista (subscription_payment_status OVERDUE), mesmo com tier saudável no cache", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 1, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-08-05", payment_status: "OVERDUE" },
    health: { flags: [], tier: "healthy" }, // cache desatualizado: nunca rodou de novo
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "mensalidade");
  assert.match(d.frase, /vencida desde 05\/08/);
});

test("diagnosticar sem flag nenhum e régua limpa devolve frase positiva", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 1, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "confirmed" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PAID" },
    health: { flags: [], tier: "healthy" },
  };
  const d = diagnosticar(u);
  assert.match(d.frase, /Sem sinais de alerta/);
});

test("diagnosticar acrescenta detalhe do último pedido quando antigo e o motivo não é esse", () => {
  const d = diagnosticar(baseUnit);
  assert.ok(d.detalhe);
  assert.match(d.detalhe, /25\/04/);
});

test("roteiroPara devolve roteiro específico do motivo (chave da régua, não a antiga do cache)", () => {
  const r = roteiroPara("sem_venda");
  assert.strictEqual(r.length, 3);
  assert.match(r[1], /verba mínima é R\$ 200/);
});

test("roteiroPara motivo desconhecido devolve fallback genérico", () => {
  const r = roteiroPara("motivo_inexistente");
  assert.strictEqual(r.length, 1);
});

test("montarMensagemUnidade prioriza 'nova' mesmo quando a unidade já tem algum flag", () => {
  const u = { ...baseUnit, is_new: true, age_days: 5, onboarding: { status: "in_progress", pct: 10 } };
  const msg = montarMensagemUnidade(u);
  assert.match(msg, /Primeiros passos/);
});

test("montarMensagemUnidade usa nomeCurto (SEM cidade — 21 unidades dividem 'São Paulo')", () => {
  const u = { ...baseUnit, city: "São Paulo - SP", franchise_name: "Maxi Massas Vila Maria" };
  const msg = montarMensagemUnidade(u);
  assert.match(msg, /Vila Maria/);
  assert.doesNotMatch(msg, /São Paulo/);
});

test("montarMensagemUnidade nunca usa palavra proibida", () => {
  for (const motivo of ["sem_venda", "sem_verba", "mensalidade", "robo_parado", "caiu", "stopped_buying", "bot_never", "default"]) {
    const u = { ...baseUnit, health: { flags: [{ key: motivo, sev: "med" }], tier: "healthy" } };
    const msg = montarMensagemUnidade(u);
    assert.strictEqual(temPalavraProibida(msg), null, `motivo=${motivo}: "${msg}"`);
  }
});

test("temPalavraProibida acerta a lista compartilhada com customerActions", () => {
  assert.ok(PALAVRAS_PROIBIDAS.includes("desconto"));
  assert.strictEqual(temPalavraProibida("Posso te dar um desconto hoje"), "desconto");
  assert.strictEqual(temPalavraProibida("Posso te ajudar com o pedido"), null);
});

test("guiaPara devolve null para todo motivo — /Ajuda e os ids de tutorial ainda não existem", () => {
  for (const motivo of ["sem_verba", "mensalidade", "bot_never", "bot_silent", "caiu", null]) {
    assert.strictEqual(guiaPara(motivo), null, `motivo=${motivo}`);
  }
});

test("diagnosticar: robô parado POR FALTA DE VERBA vira causa 'sem_verba' (item 3, 26/09)", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 2, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 28 },
    marketing: { months: [{ month: "2026-09", status: "not_paid" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PENDING" },
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "sem_verba");
  assert.match(d.frase, /Não pagou a verba de setembro/);
  assert.match(d.frase, /robô está sem conversa há 28 dias/);
  assert.doesNotMatch(d.frase, /confirmar se o WhatsApp/);
  // Achado do orquestrador (26/09): a frase da verba não pode se repetir — o sinal
  // "sem_verba" da régua única também cobre esse motivo e ficava sendo acrescentado
  // de novo depois da frase principal.
  assert.strictEqual((d.frase.match(/Não pagou a verba/g) || []).length, 1, d.frase);
});

test("diagnosticar: mensagem pronta usa o motivo de VERBA (não robô) na mesma combinação", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 2, rev_delta_pct: 5 },
    bot: { days_since_last_conversation: 28 },
    marketing: { months: [{ month: "2026-09", status: "not_paid" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-09-05", payment_status: "PENDING" },
  };
  const msg = montarMensagemUnidade(u);
  assert.match(msg, /verba de anúncio/);
  assert.doesNotMatch(msg, /WhatsApp/);
});

test("diagnosticar: sem_venda também acrescenta a mensalidade vencida (item 3, 26/09)", () => {
  const u = {
    ...baseUnit,
    subscription: { due_date: "2026-09-05", payment_status: "OVERDUE" },
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "sem_venda");
  assert.match(d.frase, /Sem venda há 30 dias/);
  assert.match(d.frase, /Mensalidade vencida desde 05\/09/);
});

test("diagnosticar: 'caiu' acrescenta os outros sinais reais (sem_verba/mensalidade) que antes sumiam", () => {
  const u = {
    ...baseUnit,
    sales: { days_since_last_sale: 2, rev_delta_pct: -27.3 },
    bot: { days_since_last_conversation: 1 },
    marketing: { months: [{ month: "2026-09", status: "not_paid" }], target_month: "2026-10", calendar_month: "2026-09" },
    subscription: { due_date: "2026-08-05", payment_status: "OVERDUE" },
  };
  const d = diagnosticar(u);
  assert.strictEqual(d.motivo, "caiu");
  assert.match(d.frase, /27,3% menos/);
  assert.match(d.frase, /Não pagou a verba de setembro/);
  assert.match(d.frase, /Mensalidade vencida desde 05\/08/);
});

test("diagnosticar não quebra com unit null/vazio", () => {
  assert.strictEqual(diagnosticar(null).frase, "");
  // {} sem nenhum dado de venda cai em "nunca vendeu" pela régua (mesmo texto que a
  // lista mostraria pra uma linha sem histórico algum) — o importante é não quebrar.
  assert.doesNotThrow(() => diagnosticar({}));
  assert.ok(diagnosticar({}).frase.length > 0);
});

console.log(`${passed} testes passaram.`);
