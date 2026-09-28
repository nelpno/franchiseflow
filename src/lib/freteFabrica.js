// Frete ESTIMADO do pedido à fábrica (S14.2, 28/09/2026). Puro, sem React.
//
// Regra da rede desde 30/08/2026 (CLAUDE.md raiz): frete = min(350, max(250, 10% do total)).
// O valor que vale é o que a fábrica LANÇA no pedido (purchase_orders.freight_cost, à mão):
// aqui é só a estimativa que a franqueada vê antes de enviar. Frete zero no lançado é
// legítimo (acréscimo de outro pedido ou retirada) — por isso a tela diz "estimado".
//
// Arredonda para REAIS inteiros: é como a fábrica lança (pedido de R$ 2.702,30 -> R$ 270,
// R$ 3.001,30 -> R$ 300; conferido em 5 pedidos reais de 20/09/2026, ver o teste).

export const FRETE_MINIMO = 250;
export const FRETE_MAXIMO = 350;
export const FRETE_PERCENTUAL = 0.1;

/**
 * @param {number|string} totalProdutos soma dos produtos do pedido (sem frete)
 * @returns {number} frete estimado em reais inteiros; 0 quando não há produto.
 */
export function estimarFreteFabrica(totalProdutos) {
  const total = Number(totalProdutos);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const bruto = Math.min(FRETE_MAXIMO, Math.max(FRETE_MINIMO, total * FRETE_PERCENTUAL));
  return Math.round(bruto);
}
