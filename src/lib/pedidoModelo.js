// Casa o "pedido modelo" da fábrica (RPC get_pedido_modelo, wrapper getPedidoModelo em
// entities/all.js) com os inventory_items reais da franquia. Puro, sem React.
//
// O modelo vem com os nomes do catálogo padrão (unidade NOVA), mas o nome gravado no
// inventory_items da franquia pode divergir em acento/espaço duplo — nunca casar por
// igualdade estrita de string.

// Mesmo padrão de src/lib/monthlyReportPdf.js (normalize NFD + \p{Diacritic}).
export function normalizarNomeProduto(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {Array<{id: string, product_name: string}>} itensPadrao — inventory_items do formulário
 *   (created_by_franchisee=false), os únicos que podem ser pedidos à fábrica.
 * @param {Array<{product_name: string, quantidade: number}>} modelo — retorno de getPedidoModelo().
 * @returns {{ quantidades: Record<string, number>, naoCasados: string[] }}
 *   quantidades: { [item.id]: quantidade }, só para itens que casaram e com quantidade > 0.
 *   naoCasados: nomes do modelo que não têm item correspondente no catálogo da unidade
 *   (para console.warn em dev — não é erro do usuário, é catálogo desalinhado).
 */
export function quantidadesDoModelo(itensPadrao, modelo) {
  const idPorNomeNormalizado = {};
  (itensPadrao || []).forEach((item) => {
    if (!item?.id || !item?.product_name) return;
    idPorNomeNormalizado[normalizarNomeProduto(item.product_name)] = item.id;
  });

  const quantidades = {};
  const naoCasados = [];

  (modelo || []).forEach((linha) => {
    const quantidade = parseInt(linha?.quantidade, 10);
    if (!quantidade || quantidade <= 0) return; // quantidade 0/ausente/inválida não entra

    const itemId = idPorNomeNormalizado[normalizarNomeProduto(linha?.product_name)];
    if (itemId) {
      quantidades[itemId] = quantidade;
    } else {
      naoCasados.push(linha?.product_name);
    }
  });

  return { quantidades, naoCasados };
}
