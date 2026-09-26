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

/**
 * Percentual em pt-BR, com vírgula e o sinal de menos tipográfico (U+2212).
 *   formatPct(-27.34)               → "−27,3%"
 *   formatPct(13.2, { sinal: true }) → "+13,2%"
 *   formatPct(27.3, { casas: 0 })    → "27%"
 * `sinal: true` põe "+" nos positivos (delta). null/undefined/"" → "" (a tela decide o traço).
 */
export function formatPct(value, { sinal = false, casas = 1 } = {}) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const fator = 10 ** casas;
  const r = Math.round(Math.abs(n) * fator) / fator;
  const corpo = r.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (r === 0) return `${corpo}%`;
  if (n < 0) return `−${corpo}%`;
  return `${sinal ? "+" : ""}${corpo}%`;
}
