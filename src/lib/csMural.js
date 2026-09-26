// Mural do CS — fonte única de rótulos PT-BR + helpers puros de agrupamento/formatação.
// O Progresso do CS (agente separado) importa os rótulos daqui (contrato Onda 2).
// Puro, sem alias "@/": roda em `node src/lib/csMural.test.mjs`.
import { formatBRLInteger } from "./formatters.js";

// ---------- Rótulos (contrato Onda 2, seção 2) ----------

export const CANAL_LABEL = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  reuniao: "Reunião feita",
};

export const RESULTADO_LABEL = {
  vai_fazer: "Respondeu e vai fazer",
  recusou: "Respondeu e recusou",
  nao_respondeu: "Não respondeu",
  resolvido: "Resolvido",
};

export const DESFECHO_LABEL = {
  resolvido: "Resolvido",
  combinado_feito: "Combinado feito",
  recusou: "Franqueado recusou",
  nao_responde: "Não responde",
  vai_para_nelson: "Vai para o Nelson",
  resolveu_sozinho: "Resolveu sozinho",
};

export const MOTIVO_LABEL = {
  sem_venda: "Sem venda",
  caiu: "Caiu",
  nao_lanca: "Não lança venda",
  robo_parado: "Robô parado",
  sem_comprar: "Sem comprar da fábrica",
  manual: "Cartão manual",
};

// Ordem de prioridade dentro de "Falar hoje" (seção 1 do contrato — usada só como
// desempate no front; a RPC já entrega ordenado, isto é só para agrupar por motivo na UI).
export const ORDEM_MOTIVOS = ["sem_venda", "caiu", "nao_lanca", "robo_parado", "sem_comprar", "manual"];

// "Voltar em": chips do passo 3 da folha Registrar.
export const VOLTAR_EM_OPCOES = [
  { key: "2d", label: "2 dias", dias: 2 },
  { key: "1s", label: "1 semana", dias: 7 },
  { key: "2s", label: "2 semanas", dias: 14 },
  { key: "data", label: "Escolher data", dias: null },
];
export const VOLTAR_EM_PADRAO = "1s";

// ---------- Raias do Mural ----------

export const RAIAS = [
  { key: "falar_hoje", label: "Falar hoje" },
  { key: "esperando", label: "Esperando resposta" },
  { key: "resolvidos", label: "Resolvidos" },
];
export const RAIAS_EXTRA = [
  { key: "com_nelson", label: "Com o Nelson" },
  { key: "estacionado", label: "Estacionado" },
];

/**
 * Agrupa os cartões da RPC get_cs_mural (campo `lane` de cada card) nas raias fixas.
 * `resolveu_sozinho` some da lista "Resolvidos" e vira grupo à parte (nunca vitória do CS).
 */
export function agruparPorRaia(cards) {
  const porRaia = { falar_hoje: [], esperando: [], resolvidos: [], resolveu_sozinho: [], com_nelson: [], estacionado: [] };
  (cards || []).forEach((c) => {
    if (c.lane === "resolvidos" && c.closed_reason === "resolveu_sozinho") {
      porRaia.resolveu_sozinho.push(c);
      return;
    }
    if (porRaia[c.lane]) porRaia[c.lane].push(c);
  });
  return porRaia;
}

// ---------- Data "hoje" (SP) para o vencimento de combinado ----------

// "Hoje" em America/Sao_Paulo, não no fuso do aparelho (o CS pode estar viajando) — mesma
// regra do banco: (now() at time zone 'America/Sao_Paulo')::date.
function hojeSP(agora) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora); // "YYYY-MM-DD"
}

// Soma dias em cima de um 'YYYY-MM-DD' usando UTC puro (sem hora nenhuma envolvida),
// então não tem DST/fuso do aparelho para errar a conta.
function somaDias(isoDate, dias) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Chave da opção "voltar em" (contrato) → 'YYYY-MM-DD' a partir de hoje EM SP. Para "data" usa `dataEscolhida`. */
export function calcularNextAt(chave, dataEscolhida, agora = new Date()) {
  const opc = VOLTAR_EM_OPCOES.find((o) => o.key === chave);
  if (!opc) return null;
  if (opc.dias === null) return dataEscolhida || null;
  return somaDias(hojeSP(agora), opc.dias);
}

// ---------- Texto do cartão ----------

/** "vendia R$ 900/mês · agora R$ 300/mês" (ou "sem vendas") a partir dos campos da RPC. */
export function linhaVenda(card) {
  const antes = Number(card?.rev_month_before);
  const mtd = card?.rev_mtd;
  const antesTxt = Number.isFinite(antes) && antes > 0 ? `vendia ${formatBRLInteger(antes)}/mês` : null;
  if (!antesTxt) return null;
  const agora = Number(mtd);
  const agoraTxt = Number.isFinite(agora) ? (agora > 0 ? `agora ${formatBRLInteger(agora)}` : "agora sem vendas") : null;
  return agoraTxt ? `${antesTxt} · ${agoraTxt}` : antesTxt;
}

/** "volta em DD/MM" a partir de `next_at` ('YYYY-MM-DD'). */
export function rotuloVoltaEm(nextAt) {
  if (!nextAt) return "";
  const s = String(nextAt).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `volta em ${m[3]}/${m[2]}`;
}

/** "DD/MM" simples, para combinados/fechamentos. */
export function dataDDMM(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : "";
}

/** Frase "fechado em DD/MM como 'X'; o motivo continua" para cartão reaberto (reopen_count > 0). */
export function fraseReabertura(card) {
  if (!card?.last_closed_at || !card?.last_closed_reason) return null;
  const data = dataDDMM(card.last_closed_at);
  const motivo = DESFECHO_LABEL[card.last_closed_reason] || card.last_closed_reason;
  return data ? `Fechado em ${data} como "${motivo}"; o motivo continua.` : null;
}

/** "Combinado: <texto> · revisar em DD/MM" (acordo) ou "Combinado em DD/MM: <texto>" (último evento). */
export function linhaAcordo(agreement) {
  if (!agreement?.reason) return null;
  const revisar = agreement.review_at ? ` · revisar em ${dataDDMM(agreement.review_at)}` : "";
  return `Acordo: ${agreement.reason}${revisar}`;
}

export function linhaUltimoCombinado(lastEvent) {
  if (!lastEvent?.commitment) return null;
  const data = dataDDMM(lastEvent.created_at);
  return data ? `Combinado em ${data}: ${lastEvent.commitment}` : `Combinado: ${lastEvent.commitment}`;
}

// ---------- Validação da folha "Registrar" ----------

/**
 * Valida o formulário de registro antes de chamar a RPC.
 * Devolve string de erro (para toast.error) ou null se ok.
 */
export function validarRegistro({ channel, outcome, nextAtChave, nextAtData, note }) {
  if (!channel || !CANAL_LABEL[channel]) return "Escolha como você falou com a unidade.";
  if (!outcome || !RESULTADO_LABEL[outcome]) return "Escolha o resultado da conversa.";
  if (outcome !== "resolvido" && nextAtChave === "data" && !nextAtData) {
    return "Escolha a data de voltar.";
  }
  if (note && note.length > 1000) return "A nota pode ter no máximo 1000 caracteres.";
  return null;
}

/** Cor/tom do chip de motivo (classes do padrão visual — tokens, sem cor crua). */
export function motivoChipClasse(motivo) {
  if (motivo === "sem_venda" || motivo === "caiu") return "border-err/40 bg-err/10 text-err";
  if (motivo === "robo_parado" || motivo === "nao_lanca") return "border-warn/40 bg-warn-soft text-warn-ink";
  return "border-surface-line bg-surface text-ink-2";
}
