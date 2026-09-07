/**
 * A conta da venda manual — subtotal, desconto, taxa de cartão e valor líquido.
 *
 * Por que existe: essas quatro contas viviam soltas dentro do JSX do SaleForm, em quatro
 * useMemo, e a regra de "quais métodos têm taxa" estava copiada em QUATRO lugares do mesmo
 * arquivo (o cálculo, dois campos do payload e a linha do resumo). Nenhuma tinha teste, e é
 * a conta que grava `sales.value`, `net_value`, `card_fee_amount` e `discount_amount` —
 * o que o DRE do franqueado lê depois.
 *
 * Regras que estão aqui porque foram decididas e podem ser esquecidas:
 *  - a base da taxa de cartão é (subtotal − desconto + frete), a MESMA nos dois modos
 *    (repassada e absorvida) e a mesma que o bot V4 e o Pedido_Checkout1 usam;
 *  - desconto nunca passa do subtotal, seja em reais ou em porcentagem;
 *  - taxa REPASSADA soma no líquido (o cliente paga), taxa ABSORVIDA subtrai;
 *  - frete só entra quando a entrega é delivery — em retirada ele é zero, mesmo que o
 *    campo tenha valor digitado.
 *
 * Testes: node src/lib/saleCalc.test.mjs
 */

/**
 * Métodos que cobram taxa quando a franquia NÃO tem a tabela `payment_fees` configurada.
 * Com a tabela, quem manda é o percentual dela (cardFeePercent > 0), não esta lista.
 * `card_machine` saiu da UI e por isso não está aqui.
 */
export const FEEABLE_METHODS = ["credit", "debit", "nfc", "payment_link", "meal_voucher"];

/** A venda cobra taxa de cartão? Com tabela de taxas, o percentual decide; sem ela, o método. */
export function chargesCardFee({ paymentMethod, cardFeePercent, hasPaymentFeesConfig }) {
  if (hasPaymentFeesConfig) return Number(cardFeePercent) > 0;
  return FEEABLE_METHODS.includes(paymentMethod);
}

/** Soma dos itens. Quantidade ou preço inválido conta como zero, nunca como NaN. */
export function calcSubtotal(items = []) {
  return items.reduce(
    (soma, it) => soma + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
    0
  );
}

/** Frete só existe em delivery. */
export function calcDeliveryFee({ deliveryMethod, deliveryFee }) {
  return deliveryMethod === "delivery" ? Number(deliveryFee) || 0 : 0;
}

/** Desconto em reais ou em %, sempre limitado ao subtotal. */
export function calcDiscountAmount({ discountInput, discountType, subtotal }) {
  const entrada = Number(discountInput) || 0;
  if (entrada <= 0 || subtotal <= 0) return 0;
  if (discountType === "percent") return Math.min(subtotal * (entrada / 100), subtotal);
  return Math.min(entrada, subtotal);
}

/** Taxa de cartão sobre (subtotal − desconto + frete). */
export function calcCardFeeAmount({
  subtotal,
  discountAmount,
  deliveryFee,
  paymentMethod,
  cardFeePercent,
  hasPaymentFeesConfig,
}) {
  if (!chargesCardFee({ paymentMethod, cardFeePercent, hasPaymentFeesConfig })) return 0;
  const percentual = Number(cardFeePercent) || 0;
  if (percentual <= 0) return 0;
  const base = subtotal - discountAmount + deliveryFee;
  return base * (percentual / 100);
}

/** Repassada soma; absorvida subtrai. */
export function calcNetValue({
  subtotal,
  discountAmount,
  cardFeeAmount,
  deliveryFee,
  feePassedToCustomer,
}) {
  const semTaxa = subtotal - discountAmount + deliveryFee;
  return feePassedToCustomer ? semTaxa + cardFeeAmount : semTaxa - cardFeeAmount;
}

/**
 * Entrada única: recebe o estado do formulário e devolve a conta inteira.
 * `cobraTaxa` sai junto porque o payload e o resumo da tela precisam da MESMA decisão —
 * era essa duplicação que fazia a regra divergir entre o que aparece e o que é gravado.
 */
export function calcSale({
  items = [],
  discountInput = 0,
  discountType = "fixed",
  deliveryMethod = "pickup",
  deliveryFee = 0,
  paymentMethod = "pix",
  cardFeePercent = 0,
  hasPaymentFeesConfig = false,
  feePassedToCustomer = false,
} = {}) {
  const subtotal = calcSubtotal(items);
  const frete = calcDeliveryFee({ deliveryMethod, deliveryFee });
  const discountAmount = calcDiscountAmount({ discountInput, discountType, subtotal });
  const cobraTaxa = chargesCardFee({ paymentMethod, cardFeePercent, hasPaymentFeesConfig });
  const cardFeeAmount = calcCardFeeAmount({
    subtotal,
    discountAmount,
    deliveryFee: frete,
    paymentMethod,
    cardFeePercent,
    hasPaymentFeesConfig,
  });
  const netValue = calcNetValue({
    subtotal,
    discountAmount,
    cardFeeAmount,
    deliveryFee: frete,
    feePassedToCustomer,
  });
  return { subtotal, effectiveDeliveryFee: frete, discountAmount, cardFeeAmount, netValue, cobraTaxa };
}
