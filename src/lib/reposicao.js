// Reposição à fábrica: o que está acabando e quanto pedir (S14.1, 28/09/2026). Puro, sem React.
//
// Reusa a sugestão de sempre (stockSuggestion.suggestionFor: 2 semanas de giro, mínimo como
// piso) e acrescenta duas coisas que faltavam:
//   1. PEDIDOS ABERTOS: o que já está a caminho (pendente/confirmado/em rota) conta como
//      estoque. Sem isso, "Repor 10" pedia de novo o que ela pediu ontem.
//   2. UNIDADE DE MEDIDA: pedido à fábrica é em unidades inteiras (purchase_order_items.quantity
//      é integer; inventory_items.unit = "un" em 100% da rede em 28/09) -> arredonda para cima.
// E a regra do alerta: produto ZERADO entra SEMPRE (mesmo sem mínimo cadastrado — 24 itens na
// rede em 28/09); abaixo do mínimo entra como antes. Só catálogo padrão da fábrica
// (created_by_franchisee !== true, custo > 0) e visível (active !== false): extras da unidade
// não vão para a fábrica (bug Santos 28/06, memória project_reposicao_so_itens_padrao).

import { suggestionFor } from "./stockSuggestion.js";

export const STATUS_PEDIDO_ABERTO = Object.freeze(["pendente", "confirmado", "em_rota"]);

export function ehProdutoDaFabrica(item) {
  return !!item && item.created_by_franchisee !== true && (parseFloat(item.cost_price) || 0) > 0;
}

export function unidadeDeMedida(item) {
  const u = String(item?.unit ?? "").trim();
  return u || "un";
}

/**
 * Soma, por inventory_item_id, o que está em pedidos ainda não entregues.
 * @param {Array<{id:string,status:string}>} pedidos
 * @param {Record<string, Array<{inventory_item_id:string, quantity:number|string}>>} itensPorPedido
 */
export function quantidadesEmAberto(pedidos, itensPorPedido) {
  const out = {};
  for (const pedido of pedidos || []) {
    if (!pedido || !STATUS_PEDIDO_ABERTO.includes(pedido.status)) continue;
    for (const it of itensPorPedido?.[pedido.id] || []) {
      if (!it?.inventory_item_id) continue;
      const q = parseFloat(it.quantity) || 0;
      if (q <= 0) continue;
      out[it.inventory_item_id] = (out[it.inventory_item_id] || 0) + q;
    }
  }
  return out;
}

/**
 * Quanto pedir de UM produto, já descontando o que está a caminho.
 * `repor` é inteiro (>= 0). `semBase` = sem giro e sem mínimo: não há número para sugerir.
 */
export function reposicaoDoItem(item, weeklyTurnover, emAberto) {
  const estoque = parseFloat(item?.quantity) || 0;
  const aCaminho = parseFloat(emAberto?.[item?.id]) || 0;
  const minimo = parseFloat(item?.min_stock) || 0;
  const sug = suggestionFor({ ...item, quantity: estoque + aCaminho }, weeklyTurnover || {});
  const repor = sug === null ? 0 : Math.max(0, Math.ceil(sug));
  return {
    estoque,
    aCaminho,
    minimo,
    repor,
    zerado: estoque <= 0,
    abaixoDoMinimo: minimo > 0 && estoque < minimo,
    semBase: sug === null,
  };
}

/**
 * Linhas do alerta "Acabando": zerados sempre + abaixo do mínimo. Zerados primeiro, depois
 * o menor estoque.
 */
export function itensParaRepor(inventoryItems, weeklyTurnover, emAberto) {
  return (inventoryItems || [])
    .filter((item) => ehProdutoDaFabrica(item) && item.active !== false)
    .map((item) => ({ item, unidade: unidadeDeMedida(item), ...reposicaoDoItem(item, weeklyTurnover, emAberto) }))
    .filter((l) => l.zerado || l.abaixoDoMinimo)
    .sort(
      (a, b) =>
        Number(b.zerado) - Number(a.zerado) ||
        a.estoque - b.estoque ||
        String(a.item.product_name || "").localeCompare(String(b.item.product_name || ""), "pt-BR")
    );
}

/** { [inventory_item_id]: repor } só para linhas com algo a pedir. */
export function quantidadesParaRepor(linhas) {
  const out = {};
  for (const l of linhas || []) {
    if (l?.item?.id && l.repor > 0) out[l.item.id] = l.repor;
  }
  return out;
}

/**
 * Carrega o que está A CAMINHO (P3 da S14, ponto 4): só pedidos ABERTOS da unidade e TODOS os
 * itens deles (fetchAll pagina; ids em lotes). Erro NÃO vira "nada a caminho": a promessa rejeita
 * e a tela trata como indisponível (Repor desligado), senão pediria em dobro.
 * Entidades injetadas (PurchaseOrder/PurchaseOrderItem de @/entities/all) para testar sem banco.
 * @returns {Promise<{pedidos: Array, itensPorPedido: Record<string, Array>, emAberto: Record<string, number>}>}
 */
export async function carregarPedidosAbertos({ PurchaseOrder, PurchaseOrderItem, franchiseId, signal, lote = 100 }) {
  if (!franchiseId) throw new Error("Unidade não identificada");
  const pedidos = await PurchaseOrder.filter(
    { franchise_id: franchiseId, status: [...STATUS_PEDIDO_ABERTO] },
    "-ordered_at",
    undefined,
    { signal, fetchAll: true, columns: "id, status" }
  );
  const abertos = (pedidos || []).filter((p) => STATUS_PEDIDO_ABERTO.includes(p?.status));
  const itensPorPedido = {};
  const ids = abertos.map((p) => p.id);
  for (let i = 0; i < ids.length; i += lote) {
    const parte = ids.slice(i, i + lote);
    const itens = await PurchaseOrderItem.filter(
      { order_id: parte },
      null,
      undefined,
      { signal, fetchAll: true, columns: "id, order_id, inventory_item_id, quantity" }
    );
    for (const it of itens || []) {
      (itensPorPedido[it.order_id] = itensPorPedido[it.order_id] || []).push(it);
    }
  }
  return { pedidos: abertos, itensPorPedido, emAberto: quantidadesEmAberto(abertos, itensPorPedido) };
}
