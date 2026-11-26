/**
 * Vales (26/11/2026, pedido da Bárbara, Jd. Santa Maria): vale-refeição (meal_voucher) e vale-alimentação (food_voucher)
 * separados + bandeiras aceitas (franchise_configurations.vale_bandeiras, uma lista para os dois).
 * vale_bandeiras NULL = a unidade ainda não revisou os vales depois que o vale-alimentação entrou: o robô não afirma nem
 * nega o vale-alimentação de quem só tinha o vale-refeição marcado (antes não havia a opção). Mexer no vale-alimentação ou
 * bandeira grava [] ou a lista. A mesma regra está no robô (V5 › Customer Context › __pagamentoFatos) e na simulação
 * (simulacoesRobo.js › simulacaoVale). Testes: node src/lib/vales.test.mjs
 */
import { VALE_BANDEIRAS } from "./franchiseUtils.js";

/** Quais vales a tela marcou (só nas modalidades ligadas; retirada sem lista = a da entrega, como no robô). */
export function valesMarcados(form, { hasDelivery = true, hasPickup = false } = {}) {
  const ent = hasDelivery ? form?.payment_delivery || [] : [];
  const ret = hasPickup ? ((form?.payment_pickup || []).length ? form.payment_pickup : form?.payment_delivery || []) : [];
  const tem = (v) => ent.includes(v) || ret.includes(v);
  return { vr: tem("meal_voucher"), va: tem("food_voucher") };
}

/**
 * A troca na tabela mexeu no vale-ALIMENTAÇÃO? Só isso conta como revisão (code-review 26/11): desmarcar e remarcar o
 * refeição não diz nada sobre o alimentação. Bandeira tocada e "Conferi" também revisam (ValeBandeiras.jsx).
 */
export function mexeuEmVale(antes, depois) {
  return (antes || []).includes("food_voucher") !== (depois || []).includes("food_voucher");
}

/**
 * O que vai ao banco: null fica null (não revisado); lista = as do painel na ordem dele e, depois, nome de fora da
 * lista já gravado (por script ou bandeira que saiu da lista), limpo, para o salvar não apagar calado (code-review 26/11).
 */
export function normalizarBandeiras(v) {
  if (!Array.isArray(v)) return null;
  const limpa = (x) => String(x ?? "").replace(/[^\p{L}\p{N} ().-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 30);
  const marcadas = [...new Set(v.map(limpa).filter(Boolean))];
  return [...VALE_BANDEIRAS.filter((b) => marcadas.includes(b)), ...marcadas.filter((b) => !VALE_BANDEIRAS.includes(b))];
}

/** Liga/desliga uma bandeira (null vira lista: tocar = revisou). */
export function alternarBandeira(atual, nome) {
  const lista = Array.isArray(atual) ? atual : [];
  return normalizarBandeiras(lista.includes(nome) ? lista.filter((b) => b !== nome) : [...lista, nome]);
}
