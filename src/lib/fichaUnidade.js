// Ficha da unidade (/Unidade?id=<evo>) — diagnóstico em 1 frase, roteiro da conversa
// e mensagem pronta. Puro (sem React, sem alias "@/"): roda em
// `node src/lib/fichaUnidade.test.mjs`. Fase 2 do redesenho do admin
// (~/.claude/plans/admin-redesign-2026-09-26.md).
//
// O motivo principal vem PRIMEIRO da régua única (networkOverview.sinaisUnidade,
// aplicada a linhaDaFicha(unit) — o MESMO jsonb que Unidades/Hoje/Financeiro usam).
// Antes a Ficha lia direto unit.health.flags (o cache de saúde, calculado 1x/dia às
// 13:32) e podia dizer "Está indo bem" numa unidade que a lista já mostrava "sem
// venda há 82 dias" ou "mensalidade vencida" — o admin clicava achando engano.
// As bandeiras de saúde (unit.health.flags) só entram DEPOIS, para os motivos que a
// régua não cobre (margem, giro, estoque, mix, robô nunca conectado, pagamento).
// Lista de flags/severidade: supabase/cs-cockpit/11-health-signals-limiar-relativo.sql.
// Mensagem pronta: gerador único em mensagemFranqueado.js (reexport fino abaixo).
import { formatBRLInteger, formatPct } from "./formatters.js";
import { dataCurta, haDias } from "./adminFormat.js";
import { DIAS_SEM_VENDA_NOVA, linhaDaFicha, mensalidadeVencida, rotuloMesVerba, semVerba, sinaisUnidade } from "./networkOverview.js";
import { PALAVRAS_PROIBIDAS, mensagemDaFicha, temPalavraProibida } from "./mensagemFranqueado.js";

export { PALAVRAS_PROIBIDAS, temPalavraProibida };

// Motivos das bandeiras de saúde que a régua única NÃO cobre — entram só quando
// sinaisUnidade(linhaDaFicha(unit)) não acusa nada (sem_venda/robo_parado/caiu/
// sem_verba/mensalidade/nova). bot_silent/bot_never cobrem o caso "nunca conversou"
// que roboParado (days_since_last_bot === null) ainda não pega.
const ORDEM_MOTIVOS_SAUDE = [
  "stopped_buying",
  "bot_silent",
  "bot_never",
  "margin_negative",
  "giro_baixo",
  "margin_squeeze",
  "key_stock_zero",
  "purchase_mix_shrink",
  "purchase_freq_drop",
  "payment_unset",
  "pix_missing",
];

// Motivo principal: 1º pela régua única (sinaisUnidade), senão a 1ª bandeira de
// saúde que a régua não cobre.
export function motivoPrincipal(unit) {
  const row = linhaDaFicha(unit);
  const sinal = sinaisUnidade(row)[0];
  if (sinal) return sinal.chave; // sem_venda | robo_parado | caiu | sem_verba | mensalidade | nova
  const flags = unit?.health?.flags || [];
  const chaves = new Set(flags.map((f) => f.key));
  for (const k of ORDEM_MOTIVOS_SAUDE) if (chaves.has(k)) return k;
  return null;
}

// ---------- diagnóstico ----------

// { frase, detalhe, motivo } — "O que está acontecendo".
export function diagnosticar(unit) {
  if (!unit) return { frase: "", detalhe: null, motivo: null };

  const row = linhaDaFicha(unit);
  let motivo = motivoPrincipal(unit);
  const s = unit.sales || {};
  const bot = unit.bot || {};
  const po = unit.purchase_orders || {};

  // Item 3, 26/09: verba parada é a CAUSA de o robô ficar sem conversa (sem anúncio, o
  // robô não recebe gente nova) — antes o motivo "robo_parado" escondia a verba não
  // paga e mandava "confira o WhatsApp" (Barretos: verba de setembro em aberto desde
  // 29/08, robô sem conversa desde então).
  const causaVerbaRobo = motivo === "robo_parado" && !!row?.marketing_month && semVerba(row);
  if (causaVerbaRobo) motivo = "sem_verba";

  const partes = [];
  let detalhe = null;

  switch (motivo) {
    case "nova": {
      const idade = row?.age_days ?? unit.age_days ?? 0;
      const pct = row?.onboarding_pct;
      partes.push(
        pct === null || pct === undefined
          ? `Nova na trilha: entrou há ${idade} dias e ainda não tem a trilha de Primeiros passos iniciada.`
          : `Nova na trilha: entrou há ${idade} dias e já cumpriu ${pct}% dos Primeiros passos.`
      );
      // Trilha em andamento não é motivo pra esconder um problema de verdade — só
      // fica em tom neutro (sem_venda > 30d já vira motivo "sem_venda" antes de
      // chegar aqui, via sinaisUnidade). Entre 7 e 30 dias, ou nunca vendeu com a
      // unidade já com alguns dias, é informação, não cobrança.
      if (bot.days_since_last_conversation == null) {
        partes.push("Ainda não teve nenhuma conversa no robô.");
      } else if (bot.days_since_last_conversation >= 7) {
        partes.push(`Sem conversa no robô há ${bot.days_since_last_conversation} dias.`);
      }
      if (s.days_since_last_sale != null && s.days_since_last_sale >= 7 && s.days_since_last_sale <= DIAS_SEM_VENDA_NOVA) {
        partes.push(`Sem venda há ${s.days_since_last_sale} dias.`);
      }
      detalhe = "Menos de 30 dias de rede: ainda não entra nos alertas de venda e de verba.";
      break;
    }
    case "sem_venda": {
      const d = row?.days_since_last_sale;
      partes.push(d == null ? "Nunca vendeu." : `Sem venda ${haDias(d)}.`);
      if (bot.days_since_last_conversation == null) {
        partes.push("Nunca teve conversa no robô.");
      } else if (bot.days_since_last_conversation >= 7) {
        partes.push(`Sem conversa no robô há ${bot.days_since_last_conversation} dias.`);
      }
      if (row?.marketing_month && semVerba(row)) {
        partes.push(`Não pagou a verba de ${rotuloMesVerba(row)}: sem anúncio, o robô parou de receber clientes.`);
      }
      if (mensalidadeVencida(row)) {
        const venc = dataCurta(row?.subscription_due_date);
        partes.push(`Mensalidade vencida${venc ? ` desde ${venc}` : ""}.`);
      }
      break;
    }
    case "robo_parado": {
      const d = row?.days_since_last_bot;
      partes.push(`O robô está sem conversa ${d != null ? haDias(d) : "há alguns dias"}.`);
      partes.push("Vale confirmar se o WhatsApp ainda está conectado.");
      break;
    }
    case "caiu": {
      const pct = row?.rev_delta_pct;
      partes.push(
        pct != null
          ? `Vendendo ${formatPct(Math.abs(pct))} menos que no mesmo trecho do mês passado.`
          : "Vendendo menos que no mesmo trecho do mês passado."
      );
      break;
    }
    case "sem_verba": {
      const mes = rotuloMesVerba(row);
      if (causaVerbaRobo) {
        const d = row?.days_since_last_bot;
        partes.push(`Não pagou a verba${mes ? ` de ${mes}` : ""}: sem anúncio, o robô está sem conversa ${d != null ? haDias(d) : "há alguns dias"}.`);
      } else {
        partes.push(`Não pagou a verba${mes ? ` de ${mes}` : ""}.`);
        partes.push("Sem verba o anúncio para, e sem anúncio o robô recebe menos gente.");
      }
      break;
    }
    case "mensalidade": {
      const venc = dataCurta(row?.subscription_due_date);
      partes.push(`A mensalidade da Equipe Digital Maxi está vencida${venc ? ` desde ${venc}` : ""}.`);
      break;
    }
    case "stopped_buying": {
      partes.push(`Não faz pedido à fábrica há ${po.days_since_last ?? "—"} dias.`);
      break;
    }
    case "bot_silent":
    case "bot_never": {
      partes.push(`O robô está sem conversa há ${bot.days_since_last_conversation ?? "muitos"} dias.`);
      partes.push("Vale confirmar se o WhatsApp ainda está conectado.");
      break;
    }
    case "margin_negative": {
      partes.push("A margem bruta está negativa nos últimos 30 dias.");
      break;
    }
    case "giro_baixo": {
      partes.push("Comprando pouco da fábrica para o quanto está vendendo — pode estar com estoque de outra fonte, ou vendendo sem repor.");
      break;
    }
    case "margin_squeeze": {
      partes.push("A margem bruta está caindo mês a mês.");
      break;
    }
    case "key_stock_zero": {
      partes.push(`${unit.health?.signals?.zeroed_key_items_count ?? "Vários"} itens-chave estão zerados no estoque.`);
      break;
    }
    case "purchase_mix_shrink":
    case "purchase_freq_drop": {
      partes.push("Está comprando menos variedade ou com menos frequência da fábrica que antes.");
      break;
    }
    case "payment_unset": {
      partes.push("Não tem forma de pagamento configurada no robô.");
      break;
    }
    case "pix_missing": {
      partes.push("Aceita PIX mas não cadastrou a chave.");
      break;
    }
    default: {
      partes.push("Sem sinais de alerta agora. Está indo bem.");
    }
  }

  // Item 3, 26/09: acrescenta os OUTROS sinais da régua única (sinaisUnidade) depois da
  // frase principal — "robo_parado" e "caiu" escondiam sem_verba/mensalidade por trás do
  // 1º motivo, e sem_venda não mencionava a mensalidade. sem_venda/sem_verba já cobrem
  // robo_parado/sem_verba/mensalidade manualmente acima (evita repetir com outra frase).
  if (["sem_venda", "robo_parado", "caiu", "sem_verba", "mensalidade"].includes(motivoPrincipal(unit))) {
    const jaCobertos = new Set(motivo === "sem_venda" ? ["robo_parado", "sem_verba", "mensalidade"] : []);
    if (causaVerbaRobo) { jaCobertos.add("robo_parado"); jaCobertos.add("sem_verba"); }
    for (const sinal of sinaisUnidade(row)) {
      if (sinal.chave === motivoPrincipal(unit) || sinal.tom === "neutro" || jaCobertos.has(sinal.chave)) continue;
      partes.push(`${sinal.titulo}.`);
    }
  }

  if (!detalhe && po.last && po.days_since_last != null && po.days_since_last >= 30 && motivo !== "stopped_buying") {
    const dataPedido = dataCurta(po.last.ordered_at);
    detalhe = `Último pedido à fábrica foi ${dataPedido ? `em ${dataPedido}` : ""}${po.last.total_amount ? ` (${formatBRLInteger(po.last.total_amount)})` : ""}. Vale perguntar se ainda tem estoque.`;
  }

  return { frase: partes.join(" "), detalhe, motivo };
}

// ---------- roteiro da conversa ----------

const ROTEIROS = {
  sem_venda: [
    "Está tudo bem? Aconteceu alguma coisa?",
    "Quer voltar a anunciar? A verba mínima é R$ 200 por mês.",
    "Tem produto em estoque ou precisa fazer pedido?",
  ],
  robo_parado: [
    "Consegue checar se o WhatsApp do robô ainda está conectado?",
    "Está recebendo pedido por outro canal?",
  ],
  caiu: [
    "O que mudou por aí: estoque, anúncio, robô, férias?",
    "Posso te ajudar em alguma coisa?",
  ],
  sem_verba: [
    "Está tudo bem? Percebi que a verba {mes} ainda não entrou.",
    "Consigo te ajudar a fazer o PIX agora? O mínimo é R$ 200.",
    "Quer que eu explique de novo como funciona a verba de anúncio?",
  ],
  mensalidade: [
    "Está tudo bem? A mensalidade da Equipe Digital Maxi está em aberto.",
    "Consigo te mandar o link de pagamento de novo?",
    "Precisa de ajuda com o PIX ou o cartão?",
  ],
  stopped_buying: [
    "Como está o estoque aí? Está vendendo com o que já tem?",
    "Precisa de ajuda para montar o pedido?",
  ],
  bot_silent: [
    "Consegue checar se o WhatsApp do robô ainda está conectado?",
    "Está recebendo pedido por outro canal?",
  ],
  bot_never: [
    "Vamos configurar o robô juntos? Posso te ajudar agora.",
  ],
  margin_negative: [
    "Vamos olhar juntos o que está pesando no custo?",
    "Os preços de venda estão atualizados?",
  ],
  giro_baixo: [
    "Está comprando de outro fornecedor ou vendendo o que já tinha em estoque?",
  ],
  margin_squeeze: [
    "Os preços de venda foram reajustados junto com o custo da fábrica?",
  ],
  key_stock_zero: [
    "Quer que eu te ajude a montar um pedido com os itens que faltam?",
  ],
  purchase_mix_shrink: [
    "Parou de vender algum produto? Posso ajudar a repor a variedade.",
  ],
  purchase_freq_drop: [
    "Está comprando menos vezes — precisa de ajuda para planejar o próximo pedido?",
  ],
  payment_unset: [
    "Vamos configurar as formas de pagamento do robô agora?",
  ],
  pix_missing: [
    "Consigo te ajudar a cadastrar a chave PIX agora?",
  ],
  nova: [
    "Como estão indo os Primeiros passos?",
    "Precisa de ajuda com alguma etapa?",
  ],
};

// `mes` = rotuloMesVerba(linhaDaFicha(unit)) ("setembro"): o roteiro nomeia o mês do
// calendário, igual à frase do diagnóstico, em vez de um "deste mês" fixo.
export function roteiroPara(motivo, { mes = "" } = {}) {
  const linhas = ROTEIROS[motivo] || ["Está tudo bem? Posso te ajudar em alguma coisa?"];
  return linhas.map((l) => l.replace("{mes}", mes ? `de ${mes}` : "do mês"));
}

// ---------- mensagem pronta ----------

// Monta a mensagem pronta (editável) da Ficha. Reexport fino: a regra mora em
// src/lib/mensagemFranqueado.js (régua única de networkOverview + nome curto da unidade).
// O flag do cache só entra quando a régua não acusa nada (ex.: estoque zerado).
export function montarMensagemUnidade(unit) {
  if (!unit) return "";
  const row = linhaDaFicha(unit);
  // Mesma causal do diagnóstico (item 3, 26/09): robô parado por falta de verba manda a
  // mensagem de verba, não a de "confira o WhatsApp".
  const causaVerbaRobo = row && motivoPrincipal(unit) === "robo_parado" && !!row.marketing_month && semVerba(row);
  return mensagemDaFicha(unit, {
    motivoReserva: motivoPrincipal(unit),
    motivoForcado: causaVerbaRobo ? "sem_verba" : null,
  });
}

// ---------- material para mandar junto ----------

// Não existe página "/Ajuda" (o menu rotula Tutoriais como "Ajuda", mas a URL é
// /Tutoriais) nem os ids verba-marketing/mensalidade/conectar-robo em
// TUTORIAL_VIDEOS (src/pages/Tutoriais.jsx) — link para eles cai em 404. Até esses
// guias existirem, guiaPara() não oferece nenhum (nunca aponta pra tela errada).
const GUIAS = {};

export function guiaPara(motivo) {
  return GUIAS[motivo] || null;
}
