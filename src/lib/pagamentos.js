// S11.1 (28/09/2026) — tela Mais › Pagamentos e faixa da Início (atrás da chave ui_v2).
// Regras puras, testadas em pagamentos.test.mjs.
import { classifySubscription, dataCivilBRT, SITUACAO } from "./subscriptionStatus.js";
import { parseDateOnly } from "./dateOnly.js";
import { formatBRL, formatBRLInteger } from "./formatters.js";

// Faixa na Início: de 3 dias antes até o dia do vencimento, com a fatura em aberto.
// Depois do vencimento quem avisa é a faixa vermelha da carência (S5.3).
export const FAIXA_DIAS_ANTES = 3;

function ddmm(dateOnly) {
  const d = parseDateOnly(dateOnly);
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @returns {null | {dias: number, vencimento: string, texto: string}}
 */
export function faixaMensalidade(sub, { hoje = new Date() } = {}) {
  const c = classifySubscription(sub, { hoje });
  if (c.situacao !== SITUACAO.PENDENTE || !c.vencimento) return null;
  const venc = parseDateOnly(c.vencimento);
  if (!venc || Number.isNaN(venc.getTime())) return null;
  const alvo = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const dias = Math.round((alvo - dataCivilBRT(hoje)) / 86400000);
  if (dias < 0 || dias > FAIXA_DIAS_ANTES) return null;
  const quando = dias === 0 ? `vence hoje (${ddmm(c.vencimento)})` : `vence dia ${ddmm(c.vencimento)}`;
  return { dias, vencimento: c.vencimento, texto: `A mensalidade da Equipe Digital Maxi ${quando}.` };
}

/**
 * "O que sua Equipe Digital fez no mês" — só números reais da unidade; linha sem número
 * não aparece (nada de "0 vendas pelo anúncio" soando como cobrança).
 * @param {{atribuicao?: object|null, funil?: object|null}} dados
 *   atribuicao = linha de get_marketing_attribution (mês, unidade)
 *   funil      = linha de get_franchise_funnel_stats (mês, unidade)
 * @returns {Array<{chave: string, icone: string, texto: string}>}
 */
export function resumoEquipeDigital({ atribuicao = null, funil = null } = {}) {
  const linhas = [];
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };

  if (atribuicao && n(atribuicao.verba_bruta) > 0) {
    linhas.push({ chave: "anuncio", icone: "campaign", texto: `Anúncio no ar com ${formatBRLInteger(n(atribuicao.verba_bruta))} de verba` });
  }
  if (atribuicao && n(atribuicao.vendas_anuncio) > 0) {
    const v = n(atribuicao.vendas_anuncio);
    linhas.push({
      chave: "vendas_anuncio",
      icone: "point_of_sale",
      texto: `${v} ${v === 1 ? "venda" : "vendas"} de quem chegou pelo anúncio (${formatBRL(n(atribuicao.receita_anuncio))})`,
    });
  }
  if (atribuicao && n(atribuicao.clientes_novos_anuncio) > 0) {
    const c = n(atribuicao.clientes_novos_anuncio);
    linhas.push({ chave: "clientes_novos", icone: "people", texto: `${c} ${c === 1 ? "cliente novo veio" : "clientes novos vieram"} do anúncio` });
  }
  if (funil && funil.has_bot_data === true && n(funil.reached) > 0) {
    const r = n(funil.reached);
    const conv = n(funil.converted);
    const compraram = conv > 0 ? `; ${conv} ${conv === 1 ? "comprou" : "compraram"}` : "";
    linhas.push({ chave: "robo", icone: "smart_toy", texto: `O robô atendeu ${r} ${r === 1 ? "pessoa" : "pessoas"}${compraram}` });
  }
  return linhas;
}

/** Primeiro e último dia do mês de `hoje` (em Brasília) no formato yyyy-MM-dd, e a chave yyyy-MM. */
export function mesAtualBRT({ hoje = new Date() } = {}) {
  const d = dataCivilBRT(hoje);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const mm = String(m).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { chave: `${y}-${mm}`, inicio: `${y}-${mm}-01`, ate: `${y}-${mm}-${dd}` };
}
