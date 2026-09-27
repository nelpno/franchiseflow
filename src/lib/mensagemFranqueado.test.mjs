// node src/lib/mensagemFranqueado.test.mjs
import assert from "node:assert/strict";
import {
  MOTIVOS_MENSAGEM, PALAVRAS_PROIBIDAS, mensagemDaFicha, mensagemParaUnidade, montarMensagemFranqueado,
  temPalavraProibida, montarAvisoEntrega, quandoEntrega,
} from "./mensagemFranqueado.js";
import { montarMensagemUnidade } from "./fichaUnidade.js";
import { montarMensagemVerba } from "../components/marketing/admin/verbaHelpers.js";

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

// Emoji (pictográficos + variação) e travessão/meia-risca.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

const base = { nome: "Maria Aparecida Prado", franchiseName: "Maxi Massas Vila Maria", mes: "2026-09", dias: 12, vencimento: "2026-09-05" };

test("todo motivo: saudação com 1º nome, nome curto, sem emoji, sem travessão, sem palavra proibida", () => {
  for (const motivo of [...MOTIVOS_MENSAGEM, "stopped_selling", "marketing_late", "marketing_unpaid",
    "subscription_overdue", "bot_silent", "revenue_drop", "margin_negative", "xyz", undefined]) {
    const msg = montarMensagemFranqueado({ ...base, motivo });
    assert.ok(msg.startsWith("Oi, Maria! "), `${motivo}: ${msg}`);
    assert.ok(msg.includes("Vila Maria"), `${motivo}: ${msg}`);
    assert.ok(!msg.includes("Maxi Massas Vila"), `${motivo}: nome longo`);
    assert.ok(!EMOJI.test(msg), `${motivo}: emoji em "${msg}"`);
    assert.ok(!TRAVESSAO.test(msg), `${motivo}: travessão em "${msg}"`);
    assert.equal(temPalavraProibida(msg), null, `${motivo}: "${msg}"`);
    assert.ok(!/faz 2 meses/i.test(msg), `${motivo}: afirma o que não conferiu`);
  }
});

test("sem nome: 'Oi!'; sem unidade: 'sua unidade'", () => {
  const msg = montarMensagemFranqueado({ motivo: "nova" });
  assert.ok(msg.startsWith("Oi! "));
  assert.match(msg, /sua unidade/);
});

test("verba nomeia o mês; comprovante e adiantar também", () => {
  assert.match(montarMensagemFranqueado({ ...base, motivo: "sem_verba" }), /verba de anúncio de setembro/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "sem_verba" }), /R\$ 200/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "verba_adiantar", mes: "2026-10" }), /outubro/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "pedir_comprovante" }), /comprovante da verba de setembro/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "mensalidade" }), /desde 05\/09/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "mensalidade" }), /link de pagamento de novo\?$/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "sem_venda" }), /sem venda há 12 dias/);
  assert.match(montarMensagemFranqueado({ ...base, motivo: "sem_venda", dias: null }), /ainda não registrou venda/);
});

test("mensalidade com link: 1 frase coerente, sem 'posso mandar' emendado ao link", () => {
  const msg = montarMensagemFranqueado({ ...base, motivo: "mensalidade", link: "https://asaas.com/i/abc123" });
  assert.match(msg, /desde 05\/09/);
  assert.match(msg, /Segue o link para pagar: https:\/\/asaas\.com\/i\/abc123\./);
  assert.ok(!/Posso te mandar/.test(msg), `não deve mais perguntar se pode mandar: "${msg}"`);
});

test("PALAVRAS_PROIBIDAS é a lista do Quem chamar hoje", () => {
  assert.ok(PALAVRAS_PROIBIDAS.includes("reservar"));
  assert.equal(temPalavraProibida("Vou reservar pra você"), "reservar");
});

// Unidade de cidade compartilhada: a mensagem usa o nome da unidade, nunca a cidade.
const unit = {
  franchise_id: "franquiavilamariasp",
  franchise_name: "Maxi Massas Vila Maria",
  owner_name: "Ricardo Alves",
  city: "São Paulo - SP",
  age_days: 300,
  is_new: false,
  sales: { days_since_last_sale: 9, rev_delta_pct: -40 },
  bot: { days_since_last_conversation: 1 },
  marketing: { calendar_month: "2026-09", target_month: "2026-10", months: [{ month: "2026-09", status: "confirmed", amount: 300 }] },
  subscription: { payment_status: "CONFIRMED" },
  onboarding: { status: "approved", pct: 100 },
  health: { tier: "healthy", flags: [] },
};

test("Ficha: motivo pela régua única e nome curto (não a cidade)", () => {
  const msg = mensagemDaFicha(unit);
  assert.match(msg, /^Oi, Ricardo! Vi que a unidade Vila Maria está sem venda há 9 dias/);
  assert.ok(!msg.includes("São Paulo"));
  assert.equal(montarMensagemUnidade(unit), msg, "reexport fino da Ficha");
});

test("Ficha: 26/09 com setembro pago não cobra outubro", () => {
  const ok = { ...unit, sales: { days_since_last_sale: 1, rev_delta_pct: 5 } };
  const msg = mensagemDaFicha(ok);
  assert.ok(!/verba/.test(msg), msg);
});

test("Ficha: nada na régua → motivo reserva do cache; sem nada → genérica", () => {
  const ok = { ...unit, sales: { days_since_last_sale: 1, rev_delta_pct: 5 } };
  assert.match(mensagemDaFicha(ok, { motivoReserva: "key_stock_zero" }), /zerados no estoque/);
  assert.match(mensagemDaFicha(ok), /como estão as coisas na unidade Vila Maria/);
  const comFlag = { ...ok, health: { flags: [{ key: "pix_missing", sev: "med" }] } };
  assert.match(montarMensagemUnidade(comFlag), /chave ainda não foi cadastrada/);
});

test("Ficha: unidade nova na trilha recebe a mensagem dos Primeiros passos", () => {
  const nova = { ...unit, age_days: 20, is_new: true, sales: { days_since_last_sale: null }, onboarding: { status: "in_progress", pct: 30 } };
  assert.match(mensagemDaFicha(nova), /Primeiros passos da unidade Vila Maria/);
});

test("linha da overview também serve", () => {
  const row = { franchise_name: "Maxi Massas Itatiba", owner_name: "Gustavo", days_since_last_sale: 1,
    marketing_month: "2026-09", marketing_month_paid: false, marketing_target_paid: false };
  assert.match(mensagemParaUnidade(row), /^Oi, Gustavo! Passando para lembrar da verba de anúncio de setembro da unidade Itatiba/);
  assert.equal(mensagemParaUnidade(null), "");
});

test("montarMensagemVerba (reexport do Marketing) usa o mesmo gerador", () => {
  const msg = montarMensagemVerba("2026-09", { owner_name: "Karina Souza", franchise_name: "Maxi Massas Itápolis" });
  assert.equal(msg, montarMensagemFranqueado({ motivo: "sem_verba", mes: "2026-09", nome: "Karina Souza", franchiseName: "Maxi Massas Itápolis" }));
  assert.ok(!EMOJI.test(montarMensagemVerba("2026-10")));
});

test("aviso de entrega: um pedido com frete, amanhã", () => {
  const m = montarAvisoEntrega({ nome: "Maria Aparecida", pedidos: [{ total: 3600.8, frete: 350 }], data: "2026-09-28", hoje: "2026-09-27" });
  assert.ok(m.startsWith("Oi, Maria! Seu pedido da Maxi sai para entrega amanhã, segunda (28/09)."), m);
  assert.ok(m.includes("Produtos: R$\u00a03.600,80") && m.includes("Frete: R$\u00a0350,00") && m.includes("Total: R$\u00a03.950,80"), m);
  assert.ok(!EMOJI.test(m) && !TRAVESSAO.test(m) && !temPalavraProibida(m) && !m.includes("**"));
});

test("aviso de entrega: acréscimo soma, frete zero vira Valor, sem nome", () => {
  const m = montarAvisoEntrega({ pedidos: [{ total: "100" }, { total: 50.5, frete: 0 }], data: "2026-10-03", hoje: "2026-09-27" });
  assert.ok(m.startsWith("Oi! Seus 2 pedidos da Maxi saem para entrega no sábado (03/10)."), m);
  assert.ok(m.includes("Valor: R$\u00a0150,50") && !m.includes("Frete"), m);
});

test("quando entrega: hoje / dia útil com artigo", () => {
  assert.equal(quandoEntrega("2026-09-27", "2026-09-27"), "hoje, domingo (27/09)");
  assert.equal(quandoEntrega("2026-09-30", "2026-09-27"), "na quarta (30/09)");
  assert.equal(quandoEntrega("", "2026-09-27"), "");
});

console.log(`mensagemFranqueado: ${passed} testes ok`);
