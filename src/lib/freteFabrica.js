// Frete ESTIMADO do pedido à fábrica (S14.2, 28/09/2026). Puro, sem React.
//
// Desde 22/10/2026 a tela da franqueada mostra R$ 350 por pedido, igual à COF V3 / Contrato V4
// ("R$ 350,00 por pedido; outro valor só se combinado por escrito antes do pedido, em razão da
// distância"). Pedido do Alex: a fórmula antiga min(350, max(250, 10%)) contradizia a COF.
// O valor que vale é o que a fábrica LANÇA no pedido (purchase_orders.freight_cost, à mão;
// a sugestão da fábrica em pedidosHelpers.freteSugerido continua na fórmula antiga):
// aqui é só a estimativa que a franqueada vê antes de enviar. Frete zero no lançado é
// legítimo (acréscimo de outro pedido ou retirada) — por isso a tela diz "estimado".

export const FRETE_POR_PEDIDO = 350;

/**
 * @param {number|string} totalProdutos soma dos produtos do pedido (sem frete)
 * @returns {number} frete estimado em reais; 0 quando não há produto.
 */
export function estimarFreteFabrica(totalProdutos) {
  const total = Number(totalProdutos);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return FRETE_POR_PEDIDO;
}
