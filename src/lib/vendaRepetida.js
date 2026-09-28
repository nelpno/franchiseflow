// Aviso "o robô já lançou esta venda" (S12.3, 28/09/2026). SÓ AVISA, nunca bloqueia.
//
// Por quê (S4.4): em 90 dias, 219 vendas do robô foram apagadas; em 59 a franqueada tinha
// lançado a mesma venda à mão ANTES de apagar a do robô (não viu que o robô já tinha lançado).
// Apagar a do robô leva junto a atribuição do anúncio.
//
// Regra, medida por SELECT em 28/09/2026 (90 dias, sem unidades de teste):
//   mesmo cliente (contact_id OU telefone) + data da venda a até 1 dia + valor parecido
//   (diferença até max(R$ 5, 15%), comparando bruto e líquido nos dois lados).
//   - 63 vendas do robô depois apagadas teriam sido avisadas (acerto);
//   - 26 lançamentos manuais de 8.502 teriam o aviso com a do robô ainda viva (teto do falso
//     positivo: parte delas é repetida que ninguém apagou; 14 com o MESMO valor no mesmo dia).
//   Qualquer valor no mesmo cliente pegaria 68 × 37: a tolerância de valor tira recompra.

import { normalizePhone } from "./whatsappUtils.js";
import { getSaleNetValue } from "./financialCalcs.js";

export const JANELA_DIAS = 1;
export const TOLERANCIA_MIN = 5;
export const TOLERANCIA_PCT = 0.15;

function num(v) {
  return parseFloat(v) || 0;
}

/** "yyyy-MM-dd" ± n dias, sem fuso (conta de calendário). */
export function somarDias(dataStr, n) {
  const [y, m, d] = String(dataStr).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function diasEntre(a, b) {
  const pa = String(a).split("-").map(Number);
  const pb = String(b).split("-").map(Number);
  if (pa.length !== 3 || pb.length !== 3 || pa.some(isNaN) || pb.some(isNaN)) return Infinity;
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.abs(Math.round((ta - tb) / 86400000));
}

/** Janela de datas para buscar as vendas do robô (inclusive). */
export function janelaDeBusca(saleDate) {
  return { de: somarDias(saleDate, -JANELA_DIAS), ate: somarDias(saleDate, JANELA_DIAS) };
}

/**
 * Diferença de valor entre a venda que está sendo lançada e uma do robô: o menor entre
 * bruto×bruto, líquido×líquido e os cruzados (a do robô às vezes guarda o frete dentro
 * do valor; a manual põe à parte).
 */
export function diferencaDeValor(candidata, venda) {
  const cb = num(candidata.value);
  const cl = candidata.net != null ? num(candidata.net) : cb;
  const vb = num(venda.value);
  const vl = getSaleNetValue(venda);
  return Math.min(Math.abs(cb - vb), Math.abs(cl - vl), Math.abs(cb - vl), Math.abs(cl - vb));
}

export function valoresParecidos(candidata, venda) {
  const ref = Math.max(getSaleNetValue(venda), num(venda.value));
  return diferencaDeValor(candidata, venda) <= Math.max(TOLERANCIA_MIN, TOLERANCIA_PCT * ref);
}

function telefoneValido(t) {
  const n = normalizePhone(t || "");
  return n && n.length >= 10 ? n : null;
}

export function mesmoCliente(candidata, venda) {
  if (candidata.contactId && venda.contact_id && candidata.contactId === venda.contact_id) return true;
  const a = telefoneValido(candidata.telefone);
  const b = telefoneValido(venda.contact_phone);
  return !!(a && b && a === b);
}

/**
 * Procura, entre as vendas dadas, uma do ROBÔ que pareça a mesma da que está sendo lançada.
 * @param {{contactId?:string|null, telefone?:string|null, saleDate:string, value:number, net?:number}} candidata
 * @param {Array} vendas  linhas de `sales` (precisa de source, contact_id, contact_phone, sale_date,
 *                        value, discount_amount, delivery_fee)
 * @returns a venda do robô mais parecida, ou null
 */
export function acharVendaDoRobo(candidata, vendas) {
  if (!candidata?.saleDate || !Array.isArray(vendas)) return null;
  if (!candidata.contactId && !telefoneValido(candidata.telefone)) return null;
  let melhor = null;
  let melhorChave = null;
  for (const v of vendas) {
    if (!v || v.source !== "bot") continue;
    const dd = diasEntre(candidata.saleDate, v.sale_date);
    if (dd > JANELA_DIAS) continue;
    if (!mesmoCliente(candidata, v)) continue;
    if (!valoresParecidos(candidata, v)) continue;
    const chave = [diferencaDeValor(candidata, v), dd];
    if (!melhor || chave[0] < melhorChave[0] || (chave[0] === melhorChave[0] && chave[1] < melhorChave[1])) {
      melhor = v;
      melhorChave = chave;
    }
  }
  return melhor;
}
