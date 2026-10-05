// Gerador ÚNICO de mensagem pronta do admin para a franqueada (decisão 5 da Onda 1, 26/09).
// Ficha, Marketing (verba, comprovante) e qualquer "Chamar no WhatsApp" do admin montam o
// texto aqui. Regras, todas com teste (mensagemFranqueado.test.mjs):
//   - saudação "Oi, <primeiro nome>!" (sem nome: "Oi!");
//   - unidade = nomeCurto(franchise_name), NUNCA a cidade (30 unidades dividem cidade);
//   - sem emoji e sem travessão (voz do Nelson no WhatsApp);
//   - nenhuma palavra de PALAVRAS_PROIBIDAS (a mesma lista do "Quem chamar hoje");
//   - não afirma o que não conferiu ("faz 2 meses", "o anúncio não subiu").
// Puro, sem alias "@/": node src/lib/mensagemFranqueado.test.mjs
import { PALAVRAS_PROIBIDAS } from "./customerActions.js";
import { dataCurta, nomeMes, primeiroNome } from "./adminFormat.js";
import { linhaDaFicha, nomeCurto, sinaisUnidade } from "./networkOverview.js";
import { formatBRL } from "./formatters.js";

export { PALAVRAS_PROIBIDAS };

// Nomes antigos (flags do cache de saúde) → motivo da régua única.
const ALIAS = {
  stopped_selling: "sem_venda",
  marketing_late: "sem_verba",
  marketing_unpaid: "sem_verba",
  subscription_overdue: "mensalidade",
  bot_silent: "robo_parado",
  revenue_drop: "caiu",
};

const n = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

// ctx = { nome, unidade (já curta), mes ('YYYY-MM'), dias, vencimento }
const TEXTOS = {
  sem_venda: (c) =>
    c.dias === null
      ? `Vi que a unidade ${c.unidade} ainda não registrou venda no painel. Está tudo bem por aí? Posso te ligar hoje para vermos isso juntos?`
      : `Vi que a unidade ${c.unidade} está sem venda há ${c.dias} ${c.dias === 1 ? "dia" : "dias"}. Está tudo bem por aí? Posso te ligar hoje para vermos isso juntos?`,
  sem_verba: (c) =>
    `Passando para lembrar da verba de anúncio de ${nomeMes(c.mes) || "este mês"} da unidade ${c.unidade}. O mínimo é R$ 200 e, assim que o pagamento é confirmado, a campanha sobe. Qualquer dúvida, é só me chamar.`,
  verba_adiantar: (c) =>
    `A verba de anúncio de ${nomeMes(c.mes) || "o próximo mês"} da unidade ${c.unidade} já pode ser paga. O mínimo é R$ 200 e a campanha sobe assim que o pagamento é confirmado. Qualquer dúvida, é só me chamar.`,
  pedir_comprovante: (c) =>
    `Pode me mandar a foto do comprovante da verba de ${nomeMes(c.mes) || "anúncio"} da unidade ${c.unidade}? Obrigado!`,
  mensalidade: (c) =>
    c.link
      ? `A mensalidade da Equipe Digital Maxi da unidade ${c.unidade} está em aberto${c.vencimento ? ` desde ${c.vencimento}` : ""}. Segue o link para pagar: ${c.link}. Qualquer dúvida, é só me chamar.`
      : `A mensalidade da Equipe Digital Maxi da unidade ${c.unidade} está em aberto${c.vencimento ? ` desde ${c.vencimento}` : ""}. Posso te mandar o link de pagamento de novo?`,
  robo_parado: (c) =>
    `O robô da unidade ${c.unidade} está sem conversa${c.dias !== null ? ` há ${c.dias} ${c.dias === 1 ? "dia" : "dias"}` : " há alguns dias"}. Consegue conferir se o WhatsApp dele ainda está conectado?`,
  caiu: (c) =>
    `Reparei que a unidade ${c.unidade} está vendendo menos que no mesmo período do mês passado. Aconteceu alguma coisa? Posso ajudar em algo?`,
  nova: (c) =>
    `Passando para ver como estão os Primeiros passos da unidade ${c.unidade}. Precisa de ajuda com alguma etapa?`,
  stopped_buying: (c) =>
    `Faz ${c.dias !== null ? `${c.dias} dias` : "um tempo"} que a unidade ${c.unidade} não faz pedido à fábrica. Como está o estoque aí?`,
  bot_never: (c) =>
    `Vi que o robô da unidade ${c.unidade} ainda não teve nenhuma conversa. Posso te ajudar a configurar?`,
  key_stock_zero: (c) =>
    `Vi que alguns itens principais estão zerados no estoque da unidade ${c.unidade}. Quer ajuda para montar o pedido?`,
  payment_unset: (c) =>
    `Vi que o robô da unidade ${c.unidade} está sem forma de pagamento configurada. Vamos configurar juntos?`,
  pix_missing: (c) =>
    `Vi que a unidade ${c.unidade} aceita PIX, mas a chave ainda não foi cadastrada. Consigo te ajudar a cadastrar agora?`,
  default: (c) => `Passando para saber como estão as coisas na unidade ${c.unidade}. Posso ajudar em algo?`,
};

export const MOTIVOS_MENSAGEM = Object.keys(TEXTOS).filter((k) => k !== "default");

/**
 * Mensagem para a franqueada.
 *   montarMensagemFranqueado({
 *     motivo: "sem_venda" | "sem_verba" | "verba_adiantar" | "pedir_comprovante" | "mensalidade"
 *             | "robo_parado" | "caiu" | "nova" | flag antiga (stopped_selling...) | outro → genérica,
 *     nome: owner_name (usa o 1º nome), franchiseName: franchise_name (vira nomeCurto),
 *     mes: 'YYYY-MM', dias: número, vencimento: 'YYYY-MM-DD',
 *     link: URL de pagamento (só o motivo "mensalidade" usa; sem ela, pergunta antes de mandar) })
 */
export function montarMensagemFranqueado({ motivo, nome, franchiseName, mes, dias, vencimento, link } = {}) {
  const chave = ALIAS[motivo] || motivo;
  const primeiro = primeiroNome(nome);
  const ctx = {
    unidade: nomeCurto(franchiseName) || "sua unidade",
    mes: mes || null,
    dias: n(dias),
    vencimento: vencimento ? dataCurta(vencimento) : "",
    link: link || null,
  };
  const corpo = (TEXTOS[chave] || TEXTOS.default)(ctx);
  return `${primeiro ? `Oi, ${primeiro}!` : "Oi!"} ${corpo}`;
}

// Motivo principal da unidade pela régua única (sinaisUnidade) + os dados que o texto usa.
// `row` = linha da overview ou linhaDaFicha(get_unit_360). `motivoReserva` entra só quando a
// régua não acusa nada (ex.: flag do cache como estoque zerado). `motivoForcado` (aditivo,
// 26/09) sobrepõe o 1º sinal da régua — usado quando a Ficha já decidiu a CAUSA raiz de uma
// combinação (ex.: robô parado por falta de verba: a mensagem tem de falar de verba, não de
// WhatsApp desconectado).
export function mensagemParaUnidade(row, { motivoReserva = null, motivoForcado = null } = {}) {
  if (!row) return "";
  const sinal = sinaisUnidade(row)[0] || null;
  const motivo = motivoForcado || sinal?.chave || motivoReserva || "default";
  const dadosPorMotivo = {
    sem_venda: { dias: row.days_since_last_sale },
    robo_parado: { dias: row.days_since_last_bot },
    sem_verba: { mes: row.marketing_month },
    mensalidade: { vencimento: row.subscription_due_date },
    stopped_buying: { dias: row.days_since_last_po },
  };
  return montarMensagemFranqueado({
    motivo,
    nome: row.owner_name,
    franchiseName: row.franchise_name,
    ...(dadosPorMotivo[ALIAS[motivo] || motivo] || {}),
  });
}

// Atalho da Ficha: jsonb da get_unit_360 → mensagem.
export function mensagemDaFicha(unit, opcoes) {
  return mensagemParaUnidade(linhaDaFicha(unit), opcoes);
}

// Confere a mensagem contra a lista compartilhada. Devolve a palavra achada ou null.
export function temPalavraProibida(texto) {
  const alvo = String(texto || "").toLowerCase();
  return PALAVRAS_PROIBIDAS.find((p) => alvo.includes(p)) || null;
}

// Aviso de entrega do pedido à fábrica (27/09): sai pelo WhatsApp do Nelson (admin_nelson),
// disparado em "Para separar e entregar". Uma mensagem por UNIDADE (acréscimo soma junto).
//   montarAvisoEntrega({ nome: owner_name, pedidos: [{ total, frete }], data: 'YYYY-MM-DD',
//                        hoje: 'YYYY-MM-DD' (BRT) })
// Frete zero (acréscimo/retirada) não aparece: só "Valor". Data: "hoje"/"amanhã" só quando é.
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function quandoEntrega(data, hoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return "";
  const t = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const dow = new Date(t(data)).getUTCDay();
  const dia = `${DIAS_SEMANA[dow]} (${dataCurta(data)})`;
  const diff = hoje ? Math.round((t(data) - t(hoje)) / 86400000) : null;
  if (diff === 0) return `hoje, ${dia}`;
  if (diff === 1) return `amanhã, ${dia}`;
  return `${dow === 0 || dow === 6 ? "no" : "na"} ${dia}`;
}

export function montarAvisoEntrega({ nome, pedidos = [], data, hoje } = {}) {
  const primeiro = primeiroNome(nome);
  const produtos = pedidos.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
  const frete = pedidos.reduce((s, p) => s + (parseFloat(p.frete) || 0), 0);
  const varios = pedidos.length > 1;
  const linhas = [
    `${primeiro ? `Oi, ${primeiro}!` : "Oi!"} ${varios ? `Seus ${pedidos.length} pedidos da Maxi saem` : "Seu pedido da Maxi sai"} para entrega ${quandoEntrega(data, hoje)}.`,
    "",
  ];
  if (frete > 0) {
    linhas.push(`Produtos: ${formatBRL(produtos)}`, `Frete: ${formatBRL(frete)}`, `Total: ${formatBRL(produtos + frete)}`);
  } else {
    linhas.push(`Valor: ${formatBRL(produtos)}`);
  }
  // L3 (P12, 04/10): o aviso já pede a conferência; a baixa e o Pix vêm depois do ok dela.
  linhas.push("", CONFERENCIA_AVISO);
  return linhas.join("\n");
}

export const CONFERENCIA_AVISO =
  'Quando chegar, confere com a ficha e me manda "chegou tudo certo" ou o que faltou. Aí dou a baixa, entra no seu estoque e te mando o valor do Pix.';

// Pix do pedido (P12, 04/10): sai pelo WhatsApp do Nelson quando o pedido é dado como ENTREGUE.
// Uma mensagem por unidade (pedidos entregues juntos somam). O valor é o do pedido JÁ editado
// (falta de item o Nelson tira antes da baixa) + frete. Comprovante: Estoque › Reposição.
//   montarPedidoPix({ nome: owner_name, pedidos: [{ total, frete, data: 'YYYY-MM-DD' (do pedido) }] })
export const CNPJ_PIX_MAXI = "00.494.317/0001-21";

export function montarPedidoPix({ nome, pedidos = [] } = {}) {
  const primeiro = primeiroNome(nome);
  const produtos = pedidos.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
  const frete = pedidos.reduce((s, p) => s + (parseFloat(p.frete) || 0), 0);
  const datas = [...new Set(pedidos.map((p) => dataCurta(p.data)).filter(Boolean))];
  const deQuando = datas.length ? ` de ${datas.join(" e ")}` : "";
  const varios = pedidos.length > 1;
  const linhas = [
    `${primeiro ? `Oi, ${primeiro}!` : "Oi!"} Dei baixa ${varios ? `nos seus ${pedidos.length} pedidos` : "no seu pedido"}${deQuando}, já está no seu estoque.`,
    "",
  ];
  if (frete > 0) {
    linhas.push(`Produtos: ${formatBRL(produtos)}`, `Frete: ${formatBRL(frete)}`, `Total do Pix: ${formatBRL(produtos + frete)}`);
  } else {
    linhas.push(`Total do Pix: ${formatBRL(produtos)}`);
  }
  // 05/10: a rede manda o comprovante no WhatsApp desde sempre; os dois caminhos valem (o Nelson
  // confirma em Pedidos › Entregues com ou sem anexo).
  linhas.push("", `Faz o Pix para o CNPJ ${CNPJ_PIX_MAXI} e anexa o comprovante no app (Estoque › Reposição) ou me manda aqui. Obrigado!`);
  return linhas.join("\n");
}
