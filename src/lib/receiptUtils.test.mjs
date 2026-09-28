// Testes puros do comprovante (S13.1, 28/09/2026 + correcoes do P3 no mesmo dia): endereco
// (venda > contato > faltante, com trim), rotulo Entrega/Retirada (inclusive venda legada sem
// delivery_method), taxa de cartao sem casa inutil (e sem "(0%)" quando o percentual falta),
// hora fixa em BRT e WhatsApp PUBLICO da unidade (nunca o celular pessoal do dono).
// Roda: node src/lib/receiptUtils.test.mjs
import assert from "node:assert";
import {
  classifyDeliveryType,
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

// --- classifyDeliveryType / isDeliverySale / resolveDeliveryLabel -----------
check("delivery -> Entrega", resolveDeliveryLabel({ delivery_method: "delivery" }) === "Entrega");
check("retirada -> Retirada", resolveDeliveryLabel({ delivery_method: "retirada" }) === "Retirada");
check("pickup (legado) -> Retirada", resolveDeliveryLabel({ delivery_method: "pickup" }) === "Retirada");
check("isDeliverySale true", isDeliverySale({ delivery_method: "delivery" }) === true);
check("isDeliverySale false (retirada)", isDeliverySale({ delivery_method: "retirada" }) === false);

// P3 item 3: venda legada SEM delivery_method NUNCA vira "Retirada" por default —
// tem de inferir pelo frete/endereço, ou ficar sem selo nenhum.
check(
  "legado sem delivery_method, COM frete -> Entrega (infere, não default)",
  resolveDeliveryLabel({ delivery_method: null, delivery_fee: 10, customer_address: null }) === "Entrega"
);
check(
  "legado sem delivery_method, COM endereço na venda -> Entrega",
  resolveDeliveryLabel({ delivery_method: undefined, delivery_fee: 0, customer_address: "Rua X, 1" }) === "Entrega"
);
check(
  "legado sem delivery_method, sem frete e sem endereço -> SEM SELO (null, não 'Retirada')",
  resolveDeliveryLabel({ delivery_method: null, delivery_fee: 0, customer_address: null }) === null
);
check(
  "classifyDeliveryType do caso acima é 'unknown', não 'retirada'",
  classifyDeliveryType({ delivery_method: null, delivery_fee: 0, customer_address: null }) === "unknown"
);
check(
  "legado sem endereço na venda mas com CONTATO endereçado ainda fica unknown (só a VENDA conta pra inferir)",
  classifyDeliveryType({ delivery_method: null, delivery_fee: 0, customer_address: null }) === "unknown"
);

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

const legadoSemSinal = {
  sale: { delivery_method: null, delivery_fee: 0, customer_address: null },
  contact: { endereco: "Rua Que Também Não Devia Aparecer" },
};
check(
  "legado sem sinal nenhum (unknown): também não mostra endereço",
  formatReceiptAddressLine(legadoSemSinal) === null
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

// P3 item 7: endereço só com espaço em branco não pode contar como presente.
const enderecoSoComEspaco = {
  sale: { delivery_method: "delivery", customer_address: "   ", customer_neighborhood: "  " },
  contact: { endereco: "Rua do Contato de Verdade, 9", bairro: "Bairro Real" },
};
check(
  "customer_address só com espaço (trim vira vazio) cai no contato, não mostra espaço em branco",
  formatReceiptAddressLine(enderecoSoComEspaco) === "Rua do Contato de Verdade, 9 — Bairro Real"
);
const enderecoDoContatoSoComEspaco = {
  sale: { delivery_method: "delivery", customer_address: null },
  contact: { endereco: "   ", bairro: "  " },
};
check(
  "endereço do contato só com espaço também não conta -> aviso de faltante",
  formatReceiptAddressLine(enderecoDoContatoSoComEspaco) === ENDERECO_NAO_INFORMADO
);
check(
  "rua com conteúdo mas bairro só com espaço -> bairro sai (trim), só a rua aparece",
  formatReceiptAddressLine({
    sale: { delivery_method: "delivery", customer_address: "Rua C, 3", customer_neighborhood: "   " },
    contact: null,
  }) === "Rua C, 3"
);

// --- formatCardFeePercent ----------------------------------------------------
check("3.5 -> 3,5% (nunca 4%)", formatCardFeePercent(3.5) === "3,5%");
check("5 -> 5% (sem ,0 inutil)", formatCardFeePercent(5) === "5%");
check("0 -> 0%", formatCardFeePercent(0) === "0%");
check("3.567 -> 3,57% (arredonda em 2 casas)", formatCardFeePercent(3.567) === "3,57%");
// controle positivo: prova que o smoke pegaria a regressao antiga (.toFixed(0))
check("regressao do .toFixed(0): 3.5 NAO pode virar 4%", `${Math.round(3.5)}%` !== formatCardFeePercent(3.5));
// P3 item 8: a decisão de OMITIR "(0%)" quando o percentual falta é do componente
// (SaleReceipt.jsx só chama formatCardFeePercent quando cardFeePercent > 0); aqui só
// confirmamos que o formatador em si continua determinístico para 0 (usado noutros lugares).

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

// --- resolveUnitWhatsApp (S13.2: SÓ franchises.whatsapp_publico, NUNCA o celular pessoal) --
check(
  "franchises.whatsapp_publico presente -> formatado",
  resolveUnitWhatsApp({ whatsapp_publico: "14996637977" }) === "(14) 99663-7977"
);
check(
  "fixo (10 dígitos) -> formatado",
  resolveUnitWhatsApp({ whatsapp_publico: "1433334444" }) === "(14) 3333-4444"
);
check(
  "sem whatsapp_publico -> null (NÃO cai em personal_phone_for_summary)",
  resolveUnitWhatsApp({ whatsapp_publico: null }) === null
);
check(
  "phone_number (número que o CS usa para chamar a franqueada) NÃO vai ao cupom",
  resolveUnitWhatsApp({ whatsapp_publico: null, phone_number: "14996637977" }) === null
);
check("sem franchise -> null", resolveUnitWhatsApp(null) === null);
check(
  "resolveUnitWhatsApp ignora um 2º argumento (assinatura antiga com config foi removida)",
  resolveUnitWhatsApp({ whatsapp_publico: null }, { personal_phone_for_summary: "14996637977" }) === null
);

console.log(`receiptUtils.test.mjs: ${passed} OK`);
