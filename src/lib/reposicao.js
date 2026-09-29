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

import { suggestionFor, sugestaoDeCompra, INTERVALO_PADRAO_DIAS } from "./stockSuggestion.js";

export const STATUS_PEDIDO_ABERTO = Object.freeze(["pendente", "confirmado", "em_rota"]);

/**
 * "Repetir último pedido" (29/09/2026): o último pedido que NÃO foi cancelado. Antes a tela pegava
 * o mais recente de todos e repetia até pedido cancelado. Espera a lista já em ordem de ordered_at
 * decrescente (como vem do PurchaseOrder.filter com "-ordered_at").
 * @param {Array<{status?:string}>} pedidos
 */
export function ultimoPedidoParaRepetir(pedidos) {
  return (pedidos || []).find((p) => p && p.status !== "cancelado") || null;
}

/**
 * Novo Pedido: o produto vai para a lista de cima ("Sugeridos")? Sobe o que tem sugestão ou
 * já veio com quantidade (rascunho, repetir, modelo). O que a pessoa DIGITOU agora em "Outros
 * produtos" fica onde está: subir na hora tirava o item de baixo do dedo (Celso, 29/09).
 */
export function sobeParaSugeridos({ quantidade, sugestao, digitadoAgora }) {
  if (sugestao !== null && sugestao !== undefined && sugestao > 0) return true;
  return (parseInt(quantidade, 10) || 0) > 0 && !digitadoAgora;
}

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

/**
 * S14.7: troca o custo da unidade pelo preço que o pedido à fábrica grava (mapa do banco).
 * Sem o mapa (carregando ou falhou) fica o custo da unidade, que hoje é igual à tabela.
 */
export function comPrecoDaTabela(itens, precos) {
  if (!precos) return itens;
  return itens.map((item) => {
    const p = precos[item.id];
    return p > 0 && p !== parseFloat(item.cost_price) ? { ...item, cost_price: p } : item;
  });
}

// ============================================================================================
// S25 (29/09/2026, chave ui_v2): a mesma regra nova (stockSuggestion.sugestaoDeCompra) para a
// Reposição, o Estoque, o selo "Repor" e o Novo Pedido.
// ============================================================================================

/** Status que contam como "pediu à fábrica" para medir de quanto em quanto tempo a unidade pede. */
export const STATUS_PEDIDO_FEITO = Object.freeze(["pendente", "confirmado", "em_rota", "entregue"]);

/** Janela do intervalo entre pedidos (a mesma de stockSuggestion.intervaloEntrePedidos). */
export const JANELA_INTERVALO_DIAS = 180;

/**
 * Datas (ordered_at) de TODOS os pedidos NÃO cancelados da unidade nos últimos 180 dias (paginado,
 * sem teto: P3 da S25 — cortar em 12 antes de juntar os acréscimos distorcia a mediana).
 * Erro rejeita: quem chama cai no intervalo padrão (21 dias).
 */
export async function carregarDatasDePedidos({ PurchaseOrder, franchiseId, signal, agora = new Date() }) {
  if (!franchiseId) throw new Error("Unidade não identificada");
  const desde = new Date(new Date(agora).getTime() - JANELA_INTERVALO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const pedidos = await PurchaseOrder.filter(
    { franchise_id: franchiseId, status: [...STATUS_PEDIDO_FEITO] },
    "-ordered_at",
    undefined,
    { signal, fetchAll: true, gte: { ordered_at: desde }, columns: "id, ordered_at, status" }
  );
  return (pedidos || [])
    .filter((p) => p && STATUS_PEDIDO_FEITO.includes(p.status) && p.ordered_at)
    .map((p) => p.ordered_at);
}

const ORDEM_SITUACAO = { acabou: 0, acabando: 1 };

/**
 * Uma linha por produto da FÁBRICA visível (padrão, custo > 0, não oculto), com a sugestão nova.
 * Ordem: acabou, acabando, depois quem tem mais a pedir, depois o nome.
 * @param {Array} inventoryItems
 * @param {{ ritmo?: Record<string, number>, emAberto?: Record<string, number>, intervaloDias?: number }} ctx
 */
export function linhasDeCompra(inventoryItems, { ritmo = {}, emAberto = {}, intervaloDias = INTERVALO_PADRAO_DIAS } = {}) {
  return (inventoryItems || [])
    .filter((item) => ehProdutoDaFabrica(item) && item.active !== false)
    .map((item) => ({
      item,
      unidade: unidadeDeMedida(item),
      ...sugestaoDeCompra(item, {
        ritmoPorDia: ritmo?.[item.id] || 0,
        aCaminho: parseFloat(emAberto?.[item.id]) || 0,
        intervaloDias,
      }),
    }))
    .sort(
      (a, b) =>
        (ORDEM_SITUACAO[a.situacao] ?? 2) - (ORDEM_SITUACAO[b.situacao] ?? 2) ||
        b.repor - a.repor ||
        String(a.item.product_name || "").localeCompare(String(b.item.product_name || ""), "pt-BR")
    );
}

/** Resumo para o cartão da Reposição e o selo do Estoque. */
export function resumoDeCompra(linhas) {
  const paraPedir = (linhas || []).filter((l) => l.repor > 0);
  const quantidades = {};
  let unidades = 0;
  for (const l of paraPedir) {
    quantidades[l.item.id] = l.repor;
    unidades += l.repor;
  }
  return {
    paraPedir,
    quantidades,
    unidades,
    acabando: (linhas || []).filter((l) => l.situacao === "acabou" || l.situacao === "acabando").length,
    negativos: (linhas || []).filter((l) => l.estoqueNegativo).length,
  };
}

/** Margem para relógio do aparelho × servidor ao comparar ordered_at. */
export const MARGEM_PEDIDO_NOVO_MS = 2 * 60 * 1000;

/**
 * S25 (P3): pedidos (não cancelados) feitos DEPOIS que o formulário abriu — por outro aparelho ou
 * aba. O pedido deste próprio envio (id = idProprio) não conta. Mais recente primeiro.
 */
export function pedidosNovosDesde(pedidos, desdeMs, idProprio = null) {
  const corte = desdeMs - MARGEM_PEDIDO_NOVO_MS;
  return (pedidos || [])
    .filter((p) => p && p.status !== "cancelado" && p.id !== idProprio && new Date(p.ordered_at).getTime() >= corte)
    .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());
}
