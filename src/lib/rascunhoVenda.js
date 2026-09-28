// Rascunho e edição do formulário da venda (S12.4, 28/09/2026). Regras puras, testadas em
// rascunhoVenda.test.mjs.

/**
 * Data que o rascunho recuperado deve usar. Rascunho salvo HOJE volta como estava (inclusive
 * uma data escolhida à mão); rascunho de outro dia volta com a data de HOJE — antes voltava
 * com a data velha e a venda caía no dia errado (e às vezes no mês errado) sem ninguém ver.
 * @param {{saleDate?:string, salvoEm?:string}} r  datas "yyyy-MM-dd"
 * @param {string} hoje "yyyy-MM-dd"
 * @returns {{data:string, trocou:boolean}}
 */
export function dataDoRascunho({ saleDate, salvoEm } = {}, hoje) {
  if (!saleDate) return { data: hoje, trocou: false };
  if (salvoEm && salvoEm === hoje) return { data: saleDate, trocou: false };
  return { data: hoje, trocou: saleDate !== hoje };
}

function n(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

/**
 * Assinatura do que a franqueada pode mudar ao EDITAR uma venda. Comparada com a de quando a
 * venda terminou de carregar: diferente = há mudança sem salvar (aviso de descartar).
 * Taxa (%) e "cliente paga a taxa" entram (P3): mudar só a taxa e fechar perdia a mudança
 * sem perguntar. A tela recalcula a taxa sozinha ao abrir; por isso a base é tirada DEPOIS
 * dessa hidratação (SaleForm), não aqui.
 */
export function assinaturaEdicao(f) {
  return JSON.stringify({
    items: (f.items || [])
      .filter((it) => it.inventory_item_id)
      .map((it) => [it.inventory_item_id, Number(it.quantity) || 0, n(it.unit_price)]),
    contactId: f.contactId || null,
    paymentMethod: f.paymentMethod || null,
    cardFeePercent: n(f.cardFeePercent),
    feePassedToCustomer: !!f.feePassedToCustomer,
    deliveryMethod: f.deliveryMethod || null,
    deliveryFee: n(f.deliveryFee),
    customerAddress: (f.customerAddress || "").trim(),
    customerNeighborhood: (f.customerNeighborhood || "").trim(),
    discountType: f.discountType || null,
    discountInput: n(f.discountInput),
    saleDate: f.saleDate || null,
    observacoes: (f.observacoes || "").trim(),
  });
}
