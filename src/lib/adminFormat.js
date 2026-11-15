// Textos curtos do painel admin: nome de mês, percentual, "há N dias", data curta, idade da
// unidade e primeiro nome. UM lugar só (antes havia 6 "nomeMes", 4 "há N dias" e 2 "fmtData"
// com saídas diferentes). Puro, sem alias "@/": roda em `node src/lib/networkOverview.test.mjs`.
// Dinheiro continua em src/lib/formatters.js (formatBRL/formatBRLInteger).
import { formatPct } from "./formatters.js";

export { formatPct };

const FUSO = "America/Sao_Paulo";

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function partesMes(yyyyMm) {
  const m = String(yyyyMm ?? "").match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano: Number(m[1]), mes };
}

/**
 * 'YYYY-MM' (ou 'YYYY-MM-DD') → nome do mês, sem passar por Date (fuso não mexe).
 *   nomeMes("2026-09")                         → "setembro"
 *   nomeMes("2026-09", { maiuscula: true })    → "Setembro"
 *   nomeMes("2026-09", { ano: true })          → "setembro de 2026"
 *   nomeMes("2026-09", { curto: true })        → "Set"
 * Inválido → "".
 */
export function nomeMes(yyyyMm, { ano = false, maiuscula = false, curto = false } = {}) {
  const p = partesMes(yyyyMm);
  if (!p) return "";
  const nome = MESES[p.mes - 1];
  if (curto) return cap(nome.slice(0, 3));
  const base = ano ? `${nome} de ${p.ano}` : nome;
  return maiuscula ? cap(base) : base;
}

/** 'YYYY-MM' ± n meses (vira o ano certo). */
export function somarMeses(yyyyMm, n) {
  const p = partesMes(yyyyMm);
  if (!p) return "";
  const total = p.ano * 12 + (p.mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Dia em São Paulo como número de dias (para diferença entre datas sem erro de fuso).
function diaSP(valor) {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return Date.UTC(+valor.slice(0, 4), +valor.slice(5, 7) - 1, +valor.slice(8, 10)) / 86400000;
  }
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const s = d.toLocaleDateString("en-CA", { timeZone: FUSO });
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
}

/** Dias inteiros entre a data (ISO ou 'YYYY-MM-DD') e agora, contados no calendário de SP. */
export function diasDesde(iso, agora = new Date()) {
  const a = diaSP(iso);
  const b = diaSP(agora);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round(b - a));
}

/** 0 → "hoje" · 1 → "há 1 dia" · 25 → "há 25 dias" · null → "". */
export function haDias(n) {
  if (n === null || n === undefined || n === "") return "";
  const d = Number(n);
  if (!Number.isFinite(d)) return "";
  if (d <= 0) return "hoje";
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

/** "2026-09-05" ou timestamp → "05/09" (calendário de SP). Inválido → "". */
export function dataCurta(iso) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO });
}

/** Idade da unidade na rede: "12 dias" · "3 meses" · "1 ano e 2 meses". */
export function idadeUnidade(dias) {
  const d = Number(dias);
  if (dias === null || dias === undefined || !Number.isFinite(d)) return "";
  if (d < 60) return d === 1 ? "1 dia" : `${Math.max(0, d)} dias`;
  const meses = Math.floor(d / 30.44);
  if (meses < 12) return `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos === 1 ? "1 ano" : `${anos} anos`;
  if (!resto) return a;
  return `${a} e ${resto === 1 ? "1 mês" : `${resto} meses`}`;
}

/** "Maria Aparecida Prado" → "Maria". Vazio → "". */
export function primeiroNome(nome) {
  return String(nome ?? "").trim().split(/\s+/)[0] || "";
}
