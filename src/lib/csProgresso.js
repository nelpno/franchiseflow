// Textos e cálculos puros da página "Progresso do CS" (/ProgressoCS, admin).
// Sem alias "@/": roda em `node src/lib/csProgresso.test.mjs`. Dinheiro fica em
// formatters.js (formatBRLInteger/formatPct); nome de mês e "há N dias" ficam em
// adminFormat.js — este arquivo só monta o período (semana/mês) e os textos do placar
// que o Bloco 5 (get_cs_impacto) e os Blocos 1-4 (get_cs_progresso) precisam.
//
// TODO(rótulos): quando src/lib/csMural.js existir (outro agente da Onda 2 está
// criando agora), trocar as constantes MOTIVO_LABEL/DESFECHO_LABEL/CANAL_LABEL abaixo
// pelo import de lá — os valores já são os mesmos do CONTRATO.md, só a fonte muda.
import { nomeMes, somarMeses, dataCurta, haDias } from "./adminFormat.js";
import { formatPct } from "./formatters.js";

const FUSO = "America/Sao_Paulo";

// ---------------------------------------------------------------------------
// Rótulos (fonte provisória — ver TODO acima)
// ---------------------------------------------------------------------------

export const MOTIVO_LABEL = {
  sem_venda: "Sem venda",
  caiu: "Caiu",
  nao_lanca: "Não lança venda",
  robo_parado: "Robô parado",
  sem_comprar: "Sem comprar da fábrica",
  manual: "Cartão manual",
};

export const DESFECHO_LABEL = {
  resolvido: "Resolvido",
  combinado_feito: "Combinado feito",
  recusou: "Franqueado recusou",
  nao_responde: "Não responde",
  vai_para_nelson: "Vai para o Nelson",
  resolveu_sozinho: "Resolveu sozinho",
};

export const CANAL_LABEL = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  reuniao: "Reunião feita",
};

// Ordem fixa dos desfechos no Bloco 3 (o "resolveu_sozinho" fica sempre por último e em
// tom neutro — nunca conta como resultado do CS, regra do prompt/estudo seção 5c).
export const ORDEM_DESFECHOS = [
  "resolvido",
  "combinado_feito",
  "recusou",
  "nao_responde",
  "vai_para_nelson",
  "resolveu_sozinho",
];

export const TIPO_IMPACTO_LABEL = {
  reuniao: "Reunião estruturada",
  mensagem: "Mensagem/contato solto",
};

// Ressalvas fixas do Bloco 5 (seção 5c do estudo). Usadas quando a RPC não manda
// `ressalvas` (harness/mock) ou como piso — a RPC pode enviar mais.
export const RESSALVAS_PADRAO = [
  "Amostra pequena: poucos episódios para tirar conclusão definitiva.",
  "Quem aceita reunião é quem já está mais engajado — o efeito pode ser do dono, não da reunião.",
  "Parte da melhora pode ser regressão à média (unidade que caiu muito tende a voltar sozinha).",
  "O Mural subnotifica contatos: parte do grupo de controle pode ter sido tocada fora do sistema.",
];

// ---------------------------------------------------------------------------
// Período (semana seg-dom · mês) — tudo em datas 'YYYY-MM-DD', sem passar por Date
// em fuso local (Date.UTC evita o erro de fuso que já pegou outras telas do admin).
// ---------------------------------------------------------------------------

function partesData(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { ano: +m[1], mes: +m[2], dia: +m[3] };
}

function diasEpoch(iso) {
  const p = partesData(iso);
  if (!p) return null;
  return Math.floor(Date.UTC(p.ano, p.mes - 1, p.dia) / 86400000);
}

function isoDeDias(epochDias) {
  const d = new Date(epochDias * 86400000);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Hoje em São Paulo, 'YYYY-MM-DD'. Aceita `agora` (Date) só para teste. */
export function hojeSP(agora = new Date()) {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Dia da semana ISO (1=segunda .. 7=domingo) de uma data 'YYYY-MM-DD'. */
function diaSemanaIso(iso) {
  const e = diasEpoch(iso);
  if (e === null) return null;
  // 1970-01-01 é quinta (dia 4 na numeração 1..7)
  return ((e + 3) % 7) + 1;
}

/** Segunda-feira da semana que contém a data. */
export function segundaDaSemana(iso) {
  const e = diasEpoch(iso);
  const dow = diaSemanaIso(iso);
  if (e === null || dow === null) return "";
  return isoDeDias(e - (dow - 1));
}

/** Domingo da semana que contém a data. */
export function domingoDaSemana(iso) {
  const seg = segundaDaSemana(iso);
  const e = diasEpoch(seg);
  if (e === null) return "";
  return isoDeDias(e + 6);
}

/** Último dia do mês 'YYYY-MM-DD' (mesmo mês da data). */
export function fimDoMes(iso) {
  const p = partesData(iso);
  if (!p) return "";
  const proximoMes = new Date(Date.UTC(p.ano, p.mes, 1));
  return isoDeDias(Math.floor(proximoMes.getTime() / 86400000) - 1);
}

/** Primeiro dia do mês 'YYYY-MM-DD' (mesmo mês da data). */
export function inicioDoMes(iso) {
  const p = partesData(iso);
  if (!p) return "";
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-01`;
}

export function periodoValido(p) {
  return p === "semana" || p === "mes";
}

export function refValida(ref) {
  return partesData(ref) !== null;
}

/**
 * Intervalo {ini, fim} de um período, ancorado em `ref` ('YYYY-MM-DD').
 * - semana: segunda a domingo da semana de `ref`.
 * - mes: 1º dia do mês de `ref` até o último dia — exceto no mês corrente, onde o fim
 *   é `hoje` (mesmo padrão do card Conversão: mês parcial não compara contra mês inteiro).
 * `hoje` (padrão hojeSP()) só entra para decidir o corte do mês corrente.
 */
export function periodoRange(periodo, ref, hoje = hojeSP()) {
  if (periodo === "semana") {
    return { ini: segundaDaSemana(ref), fim: domingoDaSemana(ref) };
  }
  const ini = inicioDoMes(ref);
  const fimMes = fimDoMes(ref);
  const mesCorrente = inicioDoMes(ref) === inicioDoMes(hoje);
  const fim = mesCorrente && hoje < fimMes ? hoje : fimMes;
  return { ini, fim };
}

/** `ref` do período que contém `hoje` — usado como valor default da URL. */
export function refPadrao(periodo, hoje = hojeSP()) {
  return hoje;
}

/** Novo `ref` ao apertar "◀" (semana anterior / mês anterior). */
export function periodoAnterior(periodo, ref) {
  if (periodo === "semana") {
    const e = diasEpoch(segundaDaSemana(ref));
    return e === null ? ref : isoDeDias(e - 7);
  }
  return somarMeses(ref.slice(0, 7), -1) + "-01";
}

/** Novo `ref` ao apertar "▶" (semana seguinte / mês seguinte). */
export function periodoProximo(periodo, ref) {
  if (periodo === "semana") {
    const e = diasEpoch(segundaDaSemana(ref));
    return e === null ? ref : isoDeDias(e + 7);
  }
  return somarMeses(ref.slice(0, 7), 1) + "-01";
}

/** Falso quando o período de `ref` já é (ou passou d)o período que contém `hoje`. */
export function podeAvancar(periodo, ref, hoje = hojeSP()) {
  const atualIni = periodo === "semana" ? segundaDaSemana(hoje) : inicioDoMes(hoje);
  const refIni = periodo === "semana" ? segundaDaSemana(ref) : inicioDoMes(ref);
  return refIni < atualIni;
}

/** "22–28 de setembro" (semana) ou "Setembro de 2026" (mês), para o cabeçalho. */
export function rotuloPeriodo(periodo, ref, hoje = hojeSP()) {
  if (periodo === "mes") return nomeMes(ref.slice(0, 7), { ano: true, maiuscula: true });
  const { ini, fim } = periodoRange(periodo, ref, hoje);
  const pIni = partesData(ini);
  const pFim = partesData(fim);
  if (!pIni || !pFim) return "";
  const diaIni = `${pIni.dia}`;
  const diaFim = `${pFim.dia} de ${nomeMes(fim.slice(0, 7))}`;
  return pIni.mes === pFim.mes ? `${diaIni}–${diaFim}` : `${diaIni} de ${nomeMes(ini.slice(0, 7))}–${diaFim}`;
}

// ---------------------------------------------------------------------------
// Bloco 1 — "O que o Celso fez"
// ---------------------------------------------------------------------------

/** "mediana de 2 dias até o 1º contato" · null/undefined → "sem dado ainda". */
export function textoMedianaContato(dias) {
  if (dias === null || dias === undefined || dias === "") return "Sem dado ainda";
  const d = Number(dias);
  if (!Number.isFinite(d)) return "Sem dado ainda";
  if (d === 0) return "Mediana: no mesmo dia";
  return d === 1 ? "Mediana: 1 dia até o 1º contato" : `Mediana: ${d} dias até o 1º contato`;
}

/**
 * Normaliza `por_semana` (get_cs_progresso) para uma mini-série de barras CSS.
 * `campo`: qual número da linha usar ("conversas"/"unidades"/"reunioes"). Retorna
 * [{ semanaIni, valor, alturaPct, rotulo }], altura relativa ao maior valor da série
 * (0 quando a série é toda zero, para não dividir por zero).
 */
export function serieSemanal(porSemana, campo) {
  const linhas = Array.isArray(porSemana) ? porSemana : [];
  const max = linhas.reduce((m, l) => Math.max(m, Number(l?.[campo]) || 0), 0);
  return linhas.map((l) => {
    const valor = Number(l?.[campo]) || 0;
    return {
      semanaIni: l?.semana_ini ?? "",
      valor,
      alturaPct: max > 0 ? Math.round((valor / max) * 100) : 0,
      rotulo: dataCurta(l?.semana_ini),
    };
  });
}

// ---------------------------------------------------------------------------
// Bloco 2 — "Estado da fila"
// ---------------------------------------------------------------------------

/** "Falar hoje: 3 há mais de 2 dias" — texto da linha de alerta da fila. */
export function textoFalarHojeAtrasado(n) {
  const v = Number(n) || 0;
  if (v === 0) return "Nenhum esperando há mais de 2 dias.";
  return v === 1 ? "1 unidade esperando há mais de 2 dias." : `${v} unidades esperando há mais de 2 dias.`;
}

export function textoEsquecidos(n) {
  const v = Number(n) || 0;
  if (v === 0) return "Nenhum cartão esquecido.";
  return v === 1 ? "1 cartão parado há 7+ dias." : `${v} cartões parados há 7+ dias.`;
}

/** "Nenhuma queda sem cartão." ou "2 quedas sem cartão." — deve ser sempre a 1ª frase. */
export function textoQuedasSemCartao(lista) {
  const n = Array.isArray(lista) ? lista.length : 0;
  if (n === 0) return "Nenhuma queda sem cartão.";
  return n === 1 ? "1 queda sem cartão." : `${n} quedas sem cartão.`;
}

// ---------------------------------------------------------------------------
// Bloco 5 — "Placar de impacto" (get_cs_impacto)
// ---------------------------------------------------------------------------

/** true quando o grupo tem menos casos do que dá para concluir algo (regra do prompt). */
export function poucosCasos(n) {
  const v = Number(n);
  return !Number.isFinite(v) || v < 5;
}

/** "poucos casos para concluir" — texto fixo quando `poucosCasos(n)`. */
export function textoPoucosCasos() {
  return "Poucos casos para concluir.";
}

/** "6 de 7 acima do controle". */
export function textoAcimaControle(acimaDoControle, n) {
  const a = Number(acimaDoControle) || 0;
  const t = Number(n) || 0;
  return `${a} de ${t} acima do controle`;
}

/** "+21 p.p. vs controle" · "−5 p.p. vs controle" · sem dado → "". */
export function textoMedianaVsControle(pct) {
  if (pct === null || pct === undefined || pct === "") return "";
  const f = formatPct(pct, { sinal: true, casas: 0 });
  if (!f) return "";
  return `${f.replace("%", " p.p.")} vs controle`;
}

/** Variação do próprio grupo de controle no período: "+10%". */
export function textoControle(pct) {
  if (pct === null || pct === undefined || pct === "") return "";
  return formatPct(pct, { sinal: true, casas: 0 }) || "";
}

/** "R$ 82 → R$ 152/dia" a partir de rev_dia_antes/rev_dia_depois (aceita null). */
export function textoAntesDepois(revDiaAntes, revDiaDepois) {
  const fmt = (v) => (v === null || v === undefined ? "—" : `R$ ${Math.round(Number(v)).toLocaleString("pt-BR")}`);
  return `${fmt(revDiaAntes)} → ${fmt(revDiaDepois)}/dia`;
}

/** "subindo (+32%)" · "caindo (−55%)" · sem dado → "". A partir de tendencia_antes_pct. */
export function textoJaVinha(tendenciaAntesPct) {
  if (tendenciaAntesPct === null || tendenciaAntesPct === undefined || tendenciaAntesPct === "") return "";
  const n = Number(tendenciaAntesPct);
  if (!Number.isFinite(n)) return "";
  const verbo = n >= 0 ? "subindo" : "caindo";
  return `${verbo} (${formatPct(n, { sinal: true, casas: 0 })})`;
}

/** Classe de cor (token) para o resultado vs controle: acima = ok, abaixo = err. */
export function corVsControle(pct) {
  if (pct === null || pct === undefined || pct === "") return "text-ink-2";
  return Number(pct) >= 0 ? "text-ok-ink" : "text-err";
}

export function rotuloTipoImpacto(tipo) {
  return TIPO_IMPACTO_LABEL[tipo] || tipo || "";
}

export { haDias, dataCurta };
