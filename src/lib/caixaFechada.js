// Produto que a fábrica só vende em caixa fechada (02/11/2026: pão de queijo Dugab, caixa com
// 12 pacotes de 1 kg). O pedido continua gravando PACOTES, que é o que entra no estoque e o que a
// unidade vende; o que a fábrica e a unidade veem do PEDIDO (tela de pedido, admin, separação,
// histórico, conferência) conta em caixas (03/11/2026). O MCD cadastra a caixa (PAO QUEIJO CX12).
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

/** Caixa para o campo de quantidade: só conta em caixas quando o pedido fecha em caixas inteiras
 *  (pedido antigo ou editado com caixa aberta continua em pacotes, sem arredondar calado). */
export function caixaDoCampo(nomeProduto, pacotes) {
  const caixa = tamanhoDaCaixa(nomeProduto);
  return (parseInt(pacotes, 10) || 0) % caixa === 0 ? caixa : 1;
}

/** Volumes do pedido: caixa fechada conta 1 por caixa (caixa aberta conta como mais uma); avulso, cada item. */
export function emUnidadesDePedido(nomeProduto, pacotes) {
  return Math.ceil((Number(pacotes) || 0) / tamanhoDaCaixa(nomeProduto));
}

/** Quantidade do pedido como a fábrica fala: "2 cx" (ou "1 cx + 6 pct") na caixa fechada, "5" no avulso. */
export function qtdTexto(nomeProduto, pacotes) {
  const caixa = tamanhoDaCaixa(nomeProduto);
  const q = parseInt(pacotes, 10) || 0;
  if (caixa === 1) return String(Number(pacotes) || 0);
  const cx = Math.floor(q / caixa), resto = q % caixa;
  if (!resto) return `${cx} cx`;
  return cx ? `${cx} cx + ${resto} pct` : `${resto} pct`;
}

/** Preço da unidade do pedido: a caixa (pacote × 12) ou o próprio item avulso. */
export function precoDaUnidade(nomeProduto, precoPacote) {
  return (parseFloat(precoPacote) || 0) * tamanhoDaCaixa(nomeProduto);
}
