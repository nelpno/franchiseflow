// Faturamento por dia do mês (admin): a faixa fina de barrinhas no cartão de faturamento
// (Hoje e Ficha) e o detalhe dia a dia. Dado = get_faturamento_por_dia(p_franchise_id)
// (supabase/2026-09-27-admin-16-faturamento-dia.sql): { hoje, mes, dias: [{dia, rev,
// rev_4_semanas}], unidades_por_dia }. A régua de receita é a mesma da overview
// (value − desconto + frete por sale_date), então a soma dos dias = "Setembro até dia N".
// O DIA se compara com o mesmo dia da semana 4 semanas antes (dia − 28): contra o mesmo
// número do mês anterior, todo sábado parecia "+R$ 10 mil" só por cair contra uma quarta.
// Puro, sem alias "@/": node src/lib/faturamentoDia.test.mjs
import { formatBRLInteger } from "./formatters.js";
import { nomeMes } from "./adminFormat.js";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function partes(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { ano: +m[1], mes: +m[2], dia: +m[3] } : null;
}

const pad = (n) => String(n).padStart(2, "0");

/** Dias no mês 'YYYY-MM' (sem Date local: fuso não mexe). */
export function diasNoMes(yyyyMm) {
  const m = String(yyyyMm ?? "").match(/^(\d{4})-(\d{2})/);
  if (!m) return 0;
  return new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
}

export const DIAS_COMPARACAO = 28;

/** Mesmo dia da semana 4 semanas antes: '2026-09-26' (sáb) → '2026-08-29' (sáb). */
export function quatroSemanasAntes(iso) {
  const p = partes(iso);
  if (!p) return null;
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia - DIAS_COMPARACAO));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'acima' (≥ 4 semanas antes), 'abaixo' ou 'futuro'. */
export function tomDoDia({ rev, ant, futuro }) {
  if (futuro) return "futuro";
  return (Number(rev) || 0) < (Number(ant) || 0) ? "abaixo" : "acima";
}

/**
 * Todos os dias do mês de `dados.mes` (1..fim), com os dias depois de hoje como `futuro`.
 * Dia que o banco não mandou (até hoje) vale 0; `ant` = rev_4_semanas (dia − 28, todo dia tem).
 * → [{ dia, n, rev, ant, futuro, hoje, tom, diff }]
 */
export function montarDias(dados) {
  const mes = dados?.mes || String(dados?.hoje ?? "").slice(0, 7);
  const total = diasNoMes(mes);
  if (!total) return [];
  const hoje = dados?.hoje || null;
  const porDia = new Map((dados?.dias || []).map((d) => [d.dia, d]));
  const out = [];
  for (let n = 1; n <= total; n++) {
    const dia = `${mes}-${pad(n)}`;
    const futuro = hoje ? dia > hoje : !porDia.has(dia);
    const linha = porDia.get(dia);
    const rev = futuro ? null : num(linha?.rev) ?? 0;
    const ant = futuro ? null : num(linha?.rev_4_semanas) ?? 0;
    const tom = tomDoDia({ rev, ant, futuro });
    out.push({
      dia,
      n,
      rev,
      ant,
      futuro,
      hoje: dia === hoje,
      tom,
      diff: futuro ? null : Math.round((rev - ant) * 100) / 100,
    });
  }
  return out;
}

/** Maior valor da escala (dia atual e mesmo dia do mês anterior), nunca 0. */
export function escalaMax(dias) {
  let m = 0;
  for (const d of dias || []) {
    if (d.rev > m) m = d.rev;
    if (d.ant > m) m = d.ant;
  }
  return m || 1;
}

/** "Sex, 26/09" */
export function rotuloDia(iso) {
  const p = partes(iso);
  if (!p) return "";
  const dow = new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  return `${DIAS_SEMANA[dow]}, ${pad(p.dia)}/${pad(p.mes)}`;
}

/** Diferença para 4 semanas antes: "+R$ 1.234" · "−R$ 320" · "R$ 0" · "" (sem dado). */
export function textoDiferenca(diff) {
  if (diff === null || diff === undefined) return "";
  const r = Math.round(diff);
  if (r === 0) return "R$ 0";
  return `${r < 0 ? "−" : "+"}${formatBRLInteger(Math.abs(r))}`;
}

/** Resumo para leitor de tela da faixa. */
export function ariaFaixa(dias, mes) {
  const passados = (dias || []).filter((d) => !d.futuro);
  const acima = passados.filter((d) => d.tom === "acima").length;
  const abaixo = passados.filter((d) => d.tom === "abaixo").length;
  const nome = nomeMes(mes) || "no mês";
  if (!passados.length) return `Faturamento por dia em ${nome}: nenhum dia ainda.`;
  return (
    `Faturamento por dia em ${nome}, ${passados.length} ${passados.length === 1 ? "dia" : "dias"} até hoje: ` +
    `${acima} ${acima === 1 ? "dia" : "dias"} igual ou acima do mesmo dia da semana 4 semanas antes, ${abaixo} abaixo. Toque para ver o detalhe.`
  );
}

/** Título e subtítulo do detalhe. */
export function tituloDetalhe(mes) {
  const nome = nomeMes(mes, { maiuscula: true });
  return nome ? `Faturamento por dia · ${nome}` : "Faturamento por dia";
}

export const LEGENDA_LINHA = "mesmo dia da semana, 4 semanas antes";

/** "15 de 26 dias igual ou acima de 4 semanas antes" */
export function subtituloDetalhe(dias) {
  const passados = (dias || []).filter((d) => !d.futuro);
  if (!passados.length) return "Ainda sem dias neste mês.";
  const acima = passados.filter((d) => d.tom === "acima").length;
  return `${acima} de ${passados.length} ${passados.length === 1 ? "dia" : "dias"} igual ou acima de 4 semanas antes`;
}

/** Unidades que venderam num dia (já vêm da maior para a menor do banco; reordena por garantia). */
export function unidadesDoDia(dados, dia) {
  const lista = dados?.unidades_por_dia?.[dia];
  if (!Array.isArray(lista)) return [];
  return lista
    .map((u) => ({ ...u, rev: num(u.rev) ?? 0 }))
    .filter((u) => u.rev > 0)
    .sort((a, b) => b.rev - a.rev);
}
