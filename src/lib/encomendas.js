// Encomendas (17/11/2026, pedido do Renato/Ribeirão): cliente encomenda para uma data futura.
// Regras puras, testadas em encomendas.test.mjs. A encomenda NÃO mexe em estoque nem em faturamento:
// só vira venda pelo formulário de venda normal ("Virou venda"), que baixa o estoque pelo trigger de sale_items.
// Proposta: cs-celso/planos/2026-11-17-proposta-encomendas.md · SQL: supabase/2026-11-17-encomendas.sql

import { differenceInCalendarDays } from "date-fns";
import { parseDateOnly } from "./dateOnly.js";

export const STATUS_ENCOMENDA = ["aberta", "pedida", "entregue", "cancelada"];
export const ROTULO_STATUS = {
  aberta: "Aberta",
  pedida: "Pedida à fábrica",
  entregue: "Entregue",
  cancelada: "Cancelada",
};
/** Ainda a entregar (aparece no resumo, no lembrete e no cartão da Início). */
export const STATUS_ATIVOS = ["aberta", "pedida"];

/** "Até o próximo pedido": no bloco da Reposição vêm marcadas as encomendas que vencem nesta janela. */
export const JANELA_PEDIDO_DIAS = 14;
/** Cartão "Encomendas desta semana" da Início. */
export const JANELA_SEMANA_DIAS = 7;

/** Dias de hoje até a entrega (negativo = atrasada). Datas "yyyy-MM-dd" (coluna DATE, sem fuso). */
export function diasAte(entregarEm, hojeStr) {
  const a = parseDateOnly(entregarEm);
  const b = parseDateOnly(hojeStr);
  if (!a || !b) return null;
  return differenceInCalendarDays(a, b);
}

export function rotuloPrazo(dias) {
  if (dias === null || dias === undefined) return "";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias > 1) return `em ${dias} dias`;
  if (dias === -1) return "atrasada 1 dia";
  return `atrasada ${Math.abs(dias)} dias`;
}

/** Itens válidos ({inventory_item_id, nome, qtd}) com qtd inteira > 0; o resto some. */
export function itensValidos(itens) {
  if (!Array.isArray(itens)) return [];
  const out = [];
  for (const it of itens) {
    const qtd = parseInt(it?.qtd, 10);
    if (!Number.isFinite(qtd) || qtd <= 0) continue;
    out.push({
      inventory_item_id: it?.inventory_item_id || null,
      nome: String(it?.nome || "").trim(),
      qtd,
    });
  }
  return out;
}

export function totalUnidades(encomenda) {
  return itensValidos(encomenda?.itens).reduce((s, i) => s + i.qtd, 0);
}

/** Soma por produto de várias encomendas: [{inventory_item_id, nome, qtd}] em ordem alfabética. */
export function somaPorProduto(encomendas) {
  const mapa = new Map();
  for (const enc of encomendas || []) {
    for (const it of itensValidos(enc?.itens)) {
      const chave = it.inventory_item_id || `nome:${it.nome.toLowerCase()}`;
      const atual = mapa.get(chave);
      if (atual) atual.qtd += it.qtd;
      else mapa.set(chave, { ...it });
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Encomendas ainda a entregar, da mais próxima para a mais distante. */
export function ativasOrdenadas(encomendas) {
  return (encomendas || [])
    .filter((e) => STATUS_ATIVOS.includes(e?.status))
    .sort((a, b) => String(a.entregar_em).localeCompare(String(b.entregar_em)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

/** A lembrar no pedido: ainda "aberta" (não pedida), da mais próxima para a mais distante. */
export function abertasParaPedido(encomendas) {
  return ativasOrdenadas(encomendas).filter((e) => e.status === "aberta");
}

/** Cartão da Início: ativas que vencem em até `dias` dias (as atrasadas entram). */
export function daSemana(encomendas, hojeStr, dias = JANELA_SEMANA_DIAS) {
  return ativasOrdenadas(encomendas).filter((e) => {
    const d = diasAte(e.entregar_em, hojeStr);
    return d !== null && d <= dias;
  });
}

/** O que preenche o formulário de venda em "Virou venda". */
export function prefillDaVenda(encomenda) {
  const obs = String(encomenda?.obs || "").trim();
  return {
    encomendaId: encomenda?.id || null,
    contactId: encomenda?.contact_id || null,
    nome: String(encomenda?.cliente_nome || "").trim(),
    telefone: String(encomenda?.telefone || "").trim(),
    itens: itensValidos(encomenda?.itens),
    observacoes: obs ? `Encomenda: ${obs}` : "Encomenda",
  };
}

/** Mensagem de erro (ou null) antes de gravar. */
export function validarEncomenda({ cliente_nome, entregar_em, itens }, hojeStr) {
  if (!String(cliente_nome || "").trim()) return "Informe o nome do cliente.";
  if (!entregar_em || !parseDateOnly(entregar_em)) return "Escolha a data de entrega.";
  if (hojeStr && diasAte(entregar_em, hojeStr) < 0) return "A data de entrega já passou. Escolha hoje ou uma data futura.";
  if (itensValidos(itens).length === 0) return "Adicione pelo menos um produto com quantidade.";
  return null;
}

/** A encomenda inteira cabe no pedido à fábrica? (todo item tem produto e o produto é do catálogo da fábrica) */
export function cabeInteira(encomenda, idsDoPedido) {
  const itens = itensValidos(encomenda?.itens);
  return itens.length > 0 && itens.every((it) => it.inventory_item_id && idsDoPedido.has(it.inventory_item_id));
}

/**
 * Quais encomendas o pedido FINAL ainda cobre: o produto está no pedido com quantidade ≥ à da
 * encomenda (somando as já cobertas antes dela, da entrega mais próxima para a mais distante).
 * Quem não é coberta inteira fica de fora e continua "aberta".
 * @param {Array} encomendas  as somadas ao pedido
 * @param {Object} quantidades  { inventory_item_id: qtd } do pedido final
 */
export function cobertasPeloPedido(encomendas, quantidades) {
  const usado = {};
  const cobertas = [];
  const ordenadas = [...(encomendas || [])].sort((a, b) => String(a.entregar_em).localeCompare(String(b.entregar_em)));
  for (const enc of ordenadas) {
    const itens = itensValidos(enc.itens);
    if (itens.length === 0) continue;
    const precisa = {};
    let valida = true;
    for (const it of itens) {
      if (!it.inventory_item_id) { valida = false; break; }
      precisa[it.inventory_item_id] = (precisa[it.inventory_item_id] || 0) + it.qtd;
    }
    if (!valida) continue;
    const cabe = Object.entries(precisa).every(
      ([id, q]) => (usado[id] || 0) + q <= (parseInt(quantidades?.[id], 10) || 0)
    );
    if (!cabe) continue;
    for (const [id, q] of Object.entries(precisa)) usado[id] = (usado[id] || 0) + q;
    cobertas.push(enc.id);
  }
  return cobertas;
}
