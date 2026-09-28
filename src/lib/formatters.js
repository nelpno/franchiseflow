/**
 * Formatadores monetários padronizados — BRL (pt-BR)
 *
 * USO:
 *   import { formatBRL, formatBRLCompact } from "@/lib/formatters";
 *   formatBRL(1234.5)       → "R$ 1.234,50"
 *   formatBRLCompact(1234)  → "R$ 1,2k"
 *   formatBRL(81.6)         → "R$ 81,60"   (NUNCA "R$ 81,6,00")
 *
 * formatBRLCompactResultado é OUTRA função (não uma variação de opção da de cima): a tela
 * Resultado usa 2 casas no "k" e trata negativo diferente — ver o comentário dela mais abaixo.
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
 * Variante de formatBRLCompact usada SÓ na tela Resultado (Gestão > Resultado e Financeiro >
 * por unidade) — preserva o formato que sempre esteve lá (S8-P3, 28/09/2026: a unificação do
 * S8.4 trocou o formatador local da tela pelo formatBRLCompact genérico acima e mudou número
 * na tela sem querer — R$ 81,60 virava R$ 82, R$ 1,23k virava R$ 1,2k, e negativo saía errado
 * de vez: R$ -1,23k virava R$ -1.235, porque o genérico compara `v >= 1000` sem valor
 * absoluto). Diferenças de propósito, as duas funções continuam existindo:
 *   - abaixo de R$ 1.000 (por valor ABSOLUTO): valor cheio, 2 casas — nunca arredonda pro
 *     inteiro (R$ 81,60, não R$ 82);
 *   - de R$ 1.000 a R$ 9.999 (abs): 2 casas no "k" (R$ 1,23k, não R$ 1,2k);
 *   - R$ 10.000 pra cima: 1 casa (R$ 12,3k) — aqui o corte histórico da tela É pelo valor cru,
 *     não pelo absoluto (mantido de propósito: é o comportamento de sempre, testado abaixo).
 * NÃO mudar sem rodar formatters.test.mjs — qualquer mudança aqui muda número na tela do
 * franqueado.
 */
export function formatBRLCompactResultado(value) {
  const n = parseFloat(value) || 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(".", ",")}k`;
  return formatBRL(n);
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
