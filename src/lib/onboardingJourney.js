// Lógica pura da trilha "Primeiros passos" (16/09/2026). Junta:
//   - conteúdo estático dos 5 passos (journeySteps.js);
//   - "estado atual" calculado NA HORA a partir de franchise/config (fiscal, cardápio,
//     vendedor) — nunca gravado;
//   - "marcos com data" que vêm da RPC get_onboarding_facts (entities/all.js);
//   - confirmações da franqueada e itens que a Maxi marca, que ficam salvos em `items`
//     (a coluna jsonb de onboarding_checklists), com data quando o valor é string ISO.
//
// Zero I/O aqui — quem chama busca franchise/config/facts/items e passa prontos.
// Testado com unidades reais (Santa Isabel, Uberaba, Itapevi, SP20): ver
// onboardingJourney.test.mjs. Ver CLAUDE.md raiz do dashboard, "Primeiros passos".
import { missingFiscalFields } from "./fiscalFields.js";
import { etapasVendedor } from "./vendedorCompleteness.js";
import { JOURNEY_STEPS } from "../components/onboarding/journeySteps.js";

// Confirmações de toque único da franqueada (1 por passo, quando o passo tem dica/preparo
// físico). O banco (guard_onboarding_checklist) trata como "dela": franqueado pode gravar.
export const CHAVES_CONFIRMACAO = ["p_whatsapp_ok", "p_espaco_ok", "p_pedido_ok"];

// Itens que só a equipe Maxi marca — o banco preserva o valor deles se a franqueada
// mandar outro (mesma trava que já existia para os CHAVES_MAXI do onboarding antigo).
export const CHAVES_MAXI_V2 = JOURNEY_STEPS.flatMap((passo) => (passo.maxi || []).map((m) => m.id));

// Migração: só os 3 itens da Maxi que SEMPRE foram reais (alguém marcava de fato) viram
// legado. '1-1'/'1-2' (Passo 1 antigo) eram "automáticos" que nunca ninguém marcou de
// verdade — não migram (ver CLAUDE.md, ponto cego 3 do plano de Primeiros Passos). As
// confirmações da franqueada também não migram: eram um toque novo, sem equivalente.
const LEGADO_MAXI = { maxi_grupo: "4-4", maxi_redes: "8-1", maxi_validacao: "9-3" };

function lerItem(items, chave) {
  const v = items?.[chave];
  if (!v) return { feito: false, feitoEm: null };
  return { feito: true, feitoEm: typeof v === "string" ? v : null };
}

// Sinais que o sistema já sabe responder sozinho — recalculados a cada chamada, nunca
// persistidos (é o que evita o "marcado automaticamente nunca volta atrás" do antigo).
function calcularSinais({ franchise, config, facts }) {
  const f = facts || {};
  return {
    fiscal: missingFiscalFields(franchise, config).length === 0,
    cardapio: Boolean(f.has_catalog || config?.catalog_image_url),
    vendedor: etapasVendedor(config).completo,
    robo_respondeu: Boolean(f.first_bot_reply_at),
    pedido_enviado: Boolean(f.first_order_at),
    pedido_entregue: Boolean(f.first_delivered_at || f.stock_now),
    primeira_venda: Boolean(f.first_sale_at),
  };
}

function montarTarefa(tarefaDef, { sinais, items }) {
  if (tarefaDef.tipo === "dica" || tarefaDef.tipo === "material") {
    return { ...tarefaDef, feita: null, feitaEm: null };
  }
  if (tarefaDef.tipo === "auto") {
    return { ...tarefaDef, feita: Boolean(sinais[tarefaDef.id]), feitaEm: null };
  }
  // confirmacao: só existe pelo que a franqueada tocou
  const { feito, feitoEm } = lerItem(items, tarefaDef.id);
  return { ...tarefaDef, feita: feito, feitaEm: feitoEm };
}

function montarMaxi(itemDef, items) {
  const direto = items?.[itemDef.id];
  if (direto) {
    return { ...itemDef, feito: true, feitoEm: typeof direto === "string" ? direto : null, legado: false };
  }
  const chaveLegada = LEGADO_MAXI[itemDef.id];
  if (chaveLegada && items?.[chaveLegada]) {
    return { ...itemDef, feito: true, feitoEm: null, legado: true };
  }
  return { ...itemDef, feito: false, feitoEm: null, legado: false };
}

/**
 * @param {object} args
 * @param {object} args.franchise  linha de `franchises`
 * @param {object} args.config     linha de `franchise_configurations`
 * @param {object} args.facts      retorno de getOnboardingFacts (RPC get_onboarding_facts)
 * @param {object} args.items      `onboarding_checklists.items` (confirmações + legado + Maxi)
 */
export function montarJornada({ franchise, config, facts, items } = {}) {
  const sinais = calcularSinais({ franchise, config, facts });
  const itensSalvos = items || {};

  const passos = JOURNEY_STEPS.map((passoDef) => {
    const tarefas = passoDef.tarefas.map((t) => montarTarefa(t, { sinais, items: itensSalvos }));
    const maxi = (passoDef.maxi || []).map((m) => montarMaxi(m, itensSalvos));

    const contadas = tarefas.filter((t) => t.tipo === "auto" || t.tipo === "confirmacao");
    const feitas = contadas.filter((t) => t.feita).length;
    const total = contadas.length;
    const pronto = total > 0 ? feitas === total : true;

    return { id: passoDef.id, numero: passoDef.numero, titulo: passoDef.titulo, pronto, feitas, total, tarefas, maxi };
  });

  const passoAtual = passos.find((p) => !p.pronto) || null;
  let agora = null;
  if (passoAtual) {
    const tarefaAgora = passoAtual.tarefas.find(
      (t) => (t.tipo === "auto" || t.tipo === "confirmacao") && !t.feita
    );
    if (tarefaAgora) {
      agora = {
        passoId: passoAtual.id,
        passoNumero: passoAtual.numero,
        tarefaId: tarefaAgora.id,
        titulo: tarefaAgora.titulo,
        resumo: tarefaAgora.resumo,
        texto: tarefaAgora.texto,
        destinos: tarefaAgora.destinos,
      };
    }
  }

  const prontos = passos.filter((p) => p.pronto).length;
  const totalContadas = passos.reduce((soma, p) => soma + p.total, 0);
  const feitasContadas = passos.reduce((soma, p) => soma + p.feitas, 0);
  const completo = passos.every((p) => p.pronto);
  const porcentagem = totalContadas > 0 ? Math.round((feitasContadas / totalContadas) * 100) : 100;

  const avisos = [];
  if (facts?.first_sale_at && !facts?.first_sale_with_contact_at) {
    avisos.push("Vincule o cliente nas próximas vendas para a lista Quem chamar hoje funcionar.");
  }

  return { passos, agora, prontos, total: 5, completo, porcentagem, avisos };
}
