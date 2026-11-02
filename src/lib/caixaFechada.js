// Produto que a fábrica só vende em caixa fechada (02/11/2026: pão de queijo Dugab, caixa com
// 12 pacotes de 1 kg). O pedido continua gravando PACOTES, que é o que entra no estoque e o que a
// unidade vende; só a tela de pedido conta em caixas.
const CAIXA_FECHADA = {
  "Pão de Queijo Tradicional - 1kg": 12,
};

/** Pacotes por caixa (1 = produto avulso). */
export function tamanhoDaCaixa(nomeProduto) {
  return CAIXA_FECHADA[nomeProduto] || 1;
}

/** Quantidade em pacotes arredondada para caixas inteiras, para cima (5 pacotes = 1 caixa). Avulso volta como veio. */
export function emCaixasInteiras(nomeProduto, pacotes) {
  const caixa = tamanhoDaCaixa(nomeProduto);
  if (caixa === 1) return pacotes;
  const q = parseInt(pacotes, 10) || 0;
  return q <= 0 ? 0 : Math.ceil(q / caixa) * caixa;
}
