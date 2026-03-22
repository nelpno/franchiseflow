/**
 * Formatadores monetários padronizados — BRL (pt-BR)
 *
 * USO:
 *   import { formatBRL, formatBRLCompact } from "@/lib/formatters";
 *   formatBRL(1234.5)       → "R$ 1.234,50"
 *   formatBRLCompact(1234)  → "R$ 1,2k"
 *   formatBRL(81.6)         → "R$ 81,60"   (NUNCA "R$ 81,6,00")
 */

const _full = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const _integer = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** R$ 1.234,56 — uso geral */
export function formatBRL(value) {
  return _full.format(Number(value) || 0);
}

/** R$ 1.235 — sem centavos (para dashboards com valores inteiros) */
export function formatBRLInteger(value) {
  return _integer.format(Number(value) || 0);
}

/** R$ 1,2k ou R$ 850 — compacto para eixos de gráfico */
export function formatBRLCompact(value) {
  const v = Number(value) || 0;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}
