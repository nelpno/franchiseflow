/**
 * Vales (26/11/2026, pedido da Bárbara, Jd. Santa Maria): vale-refeição (meal_voucher) e vale-alimentação (food_voucher)
 * separados + bandeiras aceitas (franchise_configurations.vale_bandeiras, uma lista para os dois).
 * vale_bandeiras NULL = a unidade ainda não revisou os vales depois que o vale-alimentação entrou: o robô não afirma nem
 * nega o vale-alimentação de quem só tinha o vale-refeição marcado (antes não havia a opção). Mexer em qualquer vale ou
 * bandeira grava [] ou a lista. A mesma regra está no robô (V5 › Customer Context › __pagamentoFatos) e na simulação
 * (simulacoesRobo.js › simulacaoVale). Testes: node src/lib/vales.test.mjs
 */
import { VALE_BANDEIRAS, VALE_METODOS } from "./franchiseUtils.js";

/** Quais vales a tela marcou (só nas modalidades ligadas; retirada sem lista = a da entrega, como no robô). */
export function valesMarcados(form, { hasDelivery = true, hasPickup = false } = {}) {
  const ent = hasDelivery ? form?.payment_delivery || [] : [];
  const ret = hasPickup ? ((form?.payment_pickup || []).length ? form.payment_pickup : form?.payment_delivery || []) : [];
  const tem = (v) => ent.includes(v) || ret.includes(v);
  return { vr: tem("meal_voucher"), va: tem("food_voucher") };
}

/** A troca na tabela mexeu em algum vale? */
export function mexeuEmVale(antes, depois) {
  const a = new Set((antes || []).filter((v) => VALE_METODOS.includes(v)));
  const d = new Set((depois || []).filter((v) => VALE_METODOS.includes(v)));
  return a.size !== d.size || [...a].some((v) => !d.has(v));
}

/** O que vai ao banco: null fica null (não revisado); lista = só nomes conhecidos, sem repetir, na ordem do painel. */
export function normalizarBandeiras(v) {
  if (!Array.isArray(v)) return null;
  const marcadas = new Set(v.map((x) => String(x || "").trim()));
  return VALE_BANDEIRAS.filter((b) => marcadas.has(b));
}

/** Liga/desliga uma bandeira (null vira lista: tocar = revisou). */
export function alternarBandeira(atual, nome) {
  const lista = Array.isArray(atual) ? atual : [];
  return normalizarBandeiras(lista.includes(nome) ? lista.filter((b) => b !== nome) : [...lista, nome]);
}
