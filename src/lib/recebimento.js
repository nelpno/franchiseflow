// Contrato do recebimento da venda (S6.2, 28/09/2026).
//
// - Venda NOVA com a chave ui_v2 ligada nasce RECEBIDA, a não ser que a franqueada marque
//   "Ainda vou receber". Com a chave desligada, nada muda: nasce "a receber" e ela toca
//   "Recebido" na lista (como sempre foi).
// - Gravação: o formulário manda payment_confirmed no p_sale_data e a RPC save_sale_with_items
//   grava no INSERT (mesma transação; a nova tentativa pelo client_id não mexe no recebimento).
// - Editar uma venda NUNCA mexe no recebimento (é o botão da lista que muda).
// - "Recebido em" = `confirmed_at`, gravado pelo relógio do SERVIDOR
//   (trigger trg_sales_confirmed_at_servidor); o que o aparelho manda é só compatibilidade.
// - O evento do anúncio (CAPI) sai quando a venda vira recebida, uma vez só por venda
//   (o workflow pula se capi_sent=true).

/**
 * @param {{ uiV2: boolean, isEditing: boolean, aindaVouReceber: boolean }} p
 * @returns {boolean} true = mandar payment_confirmed:true para a RPC
 */
export function nasceRecebida({ uiV2, isEditing, aindaVouReceber }) {
  if (!uiV2 || isEditing) return false;
  return !aindaVouReceber;
}

/**
 * Patch que marca/desmarca o recebimento. `confirmed_at` vai só por compatibilidade
 * (sem o trigger no banco); com o trigger, vale a hora do servidor.
 */
export function patchRecebimento(recebida, agora = new Date()) {
  return {
    payment_confirmed: !!recebida,
    confirmed_at: recebida ? agora.toISOString() : null,
  };
}
