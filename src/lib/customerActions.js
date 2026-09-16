// "Quem chamar hoje": textos e regras de exibição da lista diária de clientes.
// A lista em si vem pronta da RPC get_daily_customer_actions
// (supabase/2026-09-17-crm-quem-chamar-hoje.sql). Aqui só o que a tela mostra.
// Puro (sem React, sem alias "@/"): roda em `node src/lib/customerActions.test.mjs`.
import { formatPhone } from "./whatsappUtils.js";

// A mensagem pronta nunca pode prometer o que a unidade não faz:
// sem reserva sem pagamento, e desconto/promoção só quem decide é o franqueado.
export const PALAVRAS_PROIBIDAS = ["separar", "reservar", "guardar", "desconto", "promoção", "grátis"];

const FUSO = "America/Sao_Paulo";
const diaEmSP = (date) => new Date(`${date.toLocaleDateString("en-CA", { timeZone: FUSO })}T00:00:00Z`).getTime();

export function diasEntre(iso, agora = new Date()) {
  if (!iso) return null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return Math.max(0, Math.round((diaEmSP(agora) - diaEmSP(data)) / 86400000));
}

export function textoDias(dias) {
  if (dias == null) return "";
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function textoQuando(iso, agora = new Date()) {
  const dias = diasEntre(iso, agora);
  return dias == null ? "recentemente" : textoDias(dias);
}

export const ACTION_TYPES = {
  voltou_a_falar: {
    key: "voltou_a_falar",
    titulo: "Voltou a falar e não comprou",
    icone: "local_fire_department",
    tom: "quente",
    motivo: (item) => `Já comprou ${item.compras ?? 0}x e falou com o robô ${textoQuando(item.conversa_em)}`,
  },
  quase_comprou: {
    key: "quase_comprou",
    titulo: "Quase comprou",
    icone: "chat",
    tom: "quente",
    motivo: (item) => `Conversou com o robô ${textoQuando(item.conversa_em)} e não fechou`,
  },
  repetir: {
    key: "repetir",
    titulo: "Hora de repetir",
    icone: "replay",
    tom: "normal",
    motivo: (item) => `Já comprou ${item.compras ?? 0}x · a última foi ${textoDias(item.dias)}`,
  },
  primeira_compra: {
    key: "primeira_compra",
    titulo: "Primeira compra",
    icone: "volunteer_activism",
    tom: "normal",
    motivo: (item) => `Comprou pela 1ª vez ${textoDias(item.dias)}`,
  },
  sumido: {
    key: "sumido",
    titulo: "Sumido",
    icone: "bedtime",
    tom: "frio",
    motivo: (item) => `Não compra ${textoDias(item.dias)}`,
  },
};

export const ACTION_ORDER = ["voltou_a_falar", "quase_comprou", "repetir", "primeira_compra", "sumido"];

// ---------- nomes ----------

const palavras = (nome) => String(nome ?? "").match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || [];
const capitalizar = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
const semAcento = (p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GENERICOS = ["cliente", "contato"];
const TRATAMENTOS = ["seu", "sua", "dona", "dom", "sr", "sra", "dr", "dra"];

// "MARIA souza" → "Maria"; "Dona Cida" → "Dona Cida"; telefone, emoji ou "Cliente" → "".
export function primeiroNome(nome) {
  if (!nome || (String(nome).match(/\d/g) || []).length >= 6) return "";
  const [primeira, segunda] = palavras(nome);
  if (!primeira || GENERICOS.includes(semAcento(primeira))) return "";
  if (TRATAMENTOS.includes(semAcento(primeira))) {
    return segunda ? `${capitalizar(primeira)} ${capitalizar(segunda)}` : "";
  }
  return capitalizar(primeira);
}

// Nome para o cartão: até 2 palavras; sem nome, o telefone formatado.
export function nomeExibicao(item) {
  if (!primeiroNome(item?.nome)) return formatPhone(item?.telefone || "") || "Cliente sem nome";
  return palavras(item.nome).slice(0, 2).map(capitalizar).join(" ");
}

// "Rondelli 4 Queijos - 700g Rolo" → "Rondelli 4 Queijos"
export function nomeCurtoProduto(nome) {
  if (typeof nome !== "string") return null;
  return nome.split(" - ")[0].trim() || null;
}

// "Maxi Massas Itaquera" → "Itaquera"; sem nome, a cidade ("Campinas - SP" → "Campinas").
export function cidadeDaUnidade(franquia) {
  const pelo_nome = String(franquia?.name || "").replace(/^\s*maxi\s*massas\s*/i, "").trim();
  if (pelo_nome) return pelo_nome;
  return String(franquia?.city || "").split(" - ")[0].trim();
}

// ---------- mensagem pronta ----------

// Mesmo cliente, mesma variação: a prévia não muda a cada carregamento.
export function escolherVariante(contactId, n) {
  let hash = 0;
  for (const char of String(contactId ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return n > 0 ? hash % n : 0;
}

// Produto entra sem artigo ("repetir Lasanha Bolonhesa"): "do/da" erraria o gênero.
export function montarMensagem(item, { cidade = "" } = {}) {
  const nome = primeiroNome(item?.nome);
  const fav = nomeCurtoProduto(item?.favorito);
  const ult = nomeCurtoProduto(item?.ultimo_produto);
  const variante = escolherVariante(item?.contact_id, 2);

  const saudacao = nome ? `Oi, ${nome}!` : "Oi!";
  const unidade = `Aqui é da Maxi Massas${cidade ? ` ${cidade}` : ""} 😊`;

  const textos = {
    voltou_a_falar: [
      "Vi que você falou com a gente. Posso te ajudar a fechar seu pedido?",
      fav
        ? `Vi sua mensagem por aqui. Vai de ${fav} de novo? Posso te ajudar com o pedido.`
        : "Vi sua mensagem por aqui. Quer que eu te ajude com o pedido?",
    ],
    quase_comprou: [
      "Ficou alguma dúvida sobre as massas? Posso te ajudar a escolher.",
      "Vi que você estava olhando nossas massas. Quer uma sugestão pra hoje?",
    ],
    repetir: [
      fav
        ? `Já está na hora de pedir ${fav} de novo? Posso montar seu pedido.`
        : "Já está na hora de repor as massas? Posso montar seu pedido.",
      fav
        ? `Passando pra saber se você quer repetir ${fav}. É só me responder por aqui.`
        : "Passando pra saber se você quer repetir o pedido. É só me responder por aqui.",
    ],
    primeira_compra: [
      ult
        ? `O que você achou do seu pedido de ${ult}? Sua opinião ajuda muito a gente.`
        : "O que você achou da sua primeira compra? Sua opinião ajuda muito a gente.",
      ult
        ? `Queria saber se você gostou do seu pedido de ${ult}. Qualquer coisa, estou por aqui.`
        : "Queria saber se você gostou das massas. Qualquer coisa, estou por aqui.",
    ],
    sumido: [
      "Faz um tempinho que você não pede. Quer ver as opções desta semana?",
      fav
        ? `Sentimos sua falta por aqui. Que tal repetir ${fav}? É só me chamar.`
        : "Sentimos sua falta por aqui. Posso te ajudar com um pedido?",
    ],
  };

  const corpo = (textos[item?.tipo] || textos.quase_comprou)[variante];
  const tudoBem = variante === 1 ? " Tudo bem?" : "";
  return `${saudacao}${tudoBem} ${unidade} ${corpo}`;
}

// ---------- marca do cliente ----------

export function marcaDoCliente(compras) {
  const n = Number(compras) || 0;
  if (n >= 5) return { key: "fiel", label: "Fiel", icone: "star" };
  if (n >= 2) return { key: "voltou", label: "Voltou", icone: "replay" };
  if (n >= 1) return { key: "novo", label: "Novo", icone: "fiber_new" };
  return { key: "nunca", label: "Nunca comprou", icone: "chat_bubble" };
}

// Cor do "comprou há X dias": verde até 30, amarelo até 60, vermelho depois.
export function tomDaRecencia(dias) {
  if (dias == null) return null;
  if (dias <= 30) return "ok";
  if (dias <= 60) return "warn";
  return "err";
}

// Filtros da aba Todos (mesma régua da marca e da recência).
export const FILTROS_CLIENTES = [
  { key: "todos", label: "Todos", aceita: () => true },
  { key: "fieis", label: "Fiéis", aceita: (c) => (Number(c.purchase_count) || 0) >= 5 },
  { key: "nunca", label: "Nunca compraram", aceita: (c) => !(Number(c.purchase_count) > 0) },
  { key: "sumidos", label: "Sumidos (30+ dias)", aceita: (c) => (diasEntre(c.last_purchase_at) ?? -1) > 30 },
  { key: "sem_telefone", label: "Sem telefone", aceita: (c) => !String(c.telefone || "").trim() },
  { key: "nao_chamar", label: "Não chamar", aceita: (c) => !!c.do_not_contact_at },
];

export function filtrarClientes(contatos, key) {
  const filtro = FILTROS_CLIENTES.find((f) => f.key === key) || FILTROS_CLIENTES[0];
  return contatos.filter(filtro.aceita);
}
