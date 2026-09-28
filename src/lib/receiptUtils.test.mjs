// Testes puros do comprovante (S13.1, 28/09/2026): endereco (venda > contato > faltante),
// rotulo Entrega/Retirada, taxa de cartao sem casa inutil, hora fixa em BRT e WhatsApp da
// unidade. Roda: node src/lib/receiptUtils.test.mjs
import assert from "node:assert";
import {
  isDeliverySale,
  resolveDeliveryLabel,
  resolveReceiptAddress,
  formatReceiptAddressLine,
  ENDERECO_NAO_INFORMADO,
  formatCardFeePercent,
  formatReceiptDateTime,
  resolveUnitWhatsApp,
} from "./receiptUtils.js";

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed++;
}

// --- isDeliverySale / resolveDeliveryLabel ---------------------------------
check("delivery -> Entrega", resolveDeliveryLabel("delivery") === "Entrega");
check("retirada -> Retirada", resolveDeliveryLabel("retirada") === "Retirada");
check("pickup (legado) -> Retirada", resolveDeliveryLabel("pickup") === "Retirada");
check("null -> Retirada (default do form)", resolveDeliveryLabel(null) === "Retirada");
check("isDeliverySale true", isDeliverySale("delivery") === true);
check("isDeliverySale false", isDeliverySale("retirada") === false);

// --- resolveReceiptAddress / formatReceiptAddressLine -----------------------
const entregaComEnderecoDaVenda = {
  sale: { delivery_method: "delivery", customer_address: "Rua das Flores, 100", customer_neighborhood: "Centro" },
  contact: { endereco: "Rua Velha, 1", bairro: "Bairro Velho" },
};
check(
  "entrega: endereco da VENDA vence o do contato",
  formatReceiptAddressLine(entregaComEnderecoDaVenda) === "Rua das Flores, 100 — Centro"
);

const entregaSoContato = {
  sale: { delivery_method: "delivery", customer_address: null, customer_neighborhood: null },
  contact: { endereco: "Rua do Contato, 50", bairro: "Vila Nova" },
};
check(
  "entrega: sem endereco na venda cai no contato",
  formatReceiptAddressLine(entregaSoContato) === "Rua do Contato, 50 — Vila Nova"
);

const entregaSemEnderecoNenhum = {
  sale: { delivery_method: "delivery", customer_address: null, customer_neighborhood: null },
  contact: null,
};
check(
  "entrega sem NENHUM endereco -> aviso",
  formatReceiptAddressLine(entregaSemEnderecoNenhum) === ENDERECO_NAO_INFORMADO
);
check(
  "resolveReceiptAddress sinaliza missing",
  resolveReceiptAddress(entregaSemEnderecoNenhum).missing === true
);

const retiradaComEnderecoNaVenda = {
  sale: { delivery_method: "retirada", customer_address: "Rua Que Nao Devia Aparecer, 9" },
  contact: null,
};
check(
  "retirada: NUNCA mostra linha de endereco, mesmo com dado presente",
  formatReceiptAddressLine(retiradaComEnderecoNaVenda) === null
);

// nao mistura rua de uma fonte com bairro de outra
const naoMistura = {
  sale: { delivery_method: "delivery", customer_address: "Rua A, 1", customer_neighborhood: null },
  contact: { endereco: "Rua B, 2", bairro: "Bairro do Contato" },
};
check(
  "endereco da venda sem bairro NAO pega o bairro do contato (fontes nao se misturam)",
  formatReceiptAddressLine(naoMistura) === "Rua A, 1"
);

// --- formatCardFeePercent ----------------------------------------------------
check("3.5 -> 3,5% (nunca 4%)", formatCardFeePercent(3.5) === "3,5%");
check("5 -> 5% (sem ,0 inutil)", formatCardFeePercent(5) === "5%");
check("0 -> 0%", formatCardFeePercent(0) === "0%");
check("3.567 -> 3,57% (arredonda em 2 casas)", formatCardFeePercent(3.567) === "3,57%");
// controle positivo: prova que o smoke pegaria a regressao antiga (.toFixed(0))
check("regressao do .toFixed(0): 3.5 NAO pode virar 4%", `${Math.round(3.5)}%` !== formatCardFeePercent(3.5));

// --- formatReceiptDateTime (hora SEMPRE BRT, nunca o fuso do aparelho) ------
// Venda lancada as 23:30 de Brasilia em 30/09 -> UTC ja e 01/10 02:30.
check(
  "23:30 BRT (created_at em UTC do dia seguinte) mostra 30/09 as 23:30, nao 01/10",
  formatReceiptDateTime("2026-09-30", "2026-10-01T02:30:00.000Z") === "30/09/2026 às 23:30"
);
check(
  "meio-dia BRT simples",
  formatReceiptDateTime("2026-08-30", "2026-08-30T15:20:00.000Z") === "30/08/2026 às 12:20"
);
check("sem created_at -> so a data", formatReceiptDateTime("2026-08-30", null) === "30/08/2026");
check("sem nada -> travessao", formatReceiptDateTime(null, null) === "—");

// --- resolveUnitWhatsApp ------------------------------------------------------
check(
  "franchises.phone_number tem prioridade",
  resolveUnitWhatsApp({ phone_number: "14996637977" }, { personal_phone_for_summary: "14900000000" }) ===
    "(14) 99663-7977"
);
check(
  "sem phone_number cai no personal_phone_for_summary (fallback real, phone_number e quase sempre NULL)",
  resolveUnitWhatsApp({ phone_number: null }, { personal_phone_for_summary: "14996637977" }) === "(14) 99663-7977"
);
check(
  "sem nenhum dos dois -> null (rodape nao mostra a linha)",
  resolveUnitWhatsApp({ phone_number: null }, { personal_phone_for_summary: null }) === null
);
check("sem franchise nem config -> null", resolveUnitWhatsApp(null, null) === null);

console.log(`receiptUtils.test.mjs: ${passed} OK`);
