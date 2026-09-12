/**
 * Regras da tela "Meu Vendedor" (plano 06 revisado + plano de frete 12/09/2026). Funções puras.
 *
 * Cada regra diz de quais campos depende. Se esta tela mexeu num deles, a regra BARRA o avanço e
 * o salvar; se não mexeu, aparece só como aviso. Ninguém fica preso por um problema antigo que não
 * criou agora — medido em 12/09: 9 unidades têm "bot"/"IA" no nome da atendente, 11 têm raio fora
 * de 1 a 60 km, 3 repassam a taxa de cartão sem percentual, 5 têm entrega sem horário.
 *
 * O que NÃO é regra (revisão adversarial do plano 06):
 *   - link de pagamento sem URL é o normal (a unidade manda o link na hora) — só aviso de formato;
 *   - corte de pedidos igual ao início da entrega é a operação da Bauru — só barra corte DEPOIS do fim.
 */
import { validateDeliverySchedule, rotuloDias } from "./configSave.js";
import { modoDoFrete, legadoParaModelo, problemasDoModelo } from "./freteModelo.js";

const digitos = (v) => String(v ?? "").replace(/\D/g, "");
const vazio = (v) => v === null || v === undefined || String(v).trim() === "";
const minutos = (hhmm) => {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const entrega = (f) => f.has_delivery !== false;
const usaMetodo = (f, metodo) =>
  (entrega(f) && (f.payment_delivery || []).includes(metodo)) ||
  (!!f.has_pickup && (f.payment_pickup || []).includes(metodo));

const METODOS_COM_TAXA = ["credit", "debit", "nfc", "payment_link", "meal_voucher"];
const ROTULO_METODO = { credit: "Crédito", debit: "Débito", nfc: "Aproximação", payment_link: "Link", meal_voucher: "Vale-refeição" };

// Palavra inteira, não pedaço: "Roberta" e "Maria" passam; "Ana IA", "Robô Ana" e "Assistente" não.
const PALAVRAS_DE_ROBO = ["bot", "chatbot", "virtual", "assistente", "robo", "robô", "ia"];
export function nomeDeRobo(nome) {
  return String(nome || "").toLowerCase().split(/[^a-z0-9à-öø-ÿ]+/).some((p) => PALAVRAS_DE_ROBO.includes(p));
}

function maiorFaixaKm(schedule) {
  let maior = null;
  for (const g of Array.isArray(schedule) ? schedule : []) {
    if (g?.charges_fee === false || !Array.isArray(g?.fee_rules)) continue;
    for (const r of g.fee_rules) {
      const km = Number(String(r?.max_km ?? "").replace(",", "."));
      if (!vazio(r?.fee) && km > 0 && (maior === null || km > maior)) maior = km;
    }
  }
  return maior;
}

const temHorario = (schedule) =>
  Array.isArray(schedule) && schedule.length > 0 &&
  schedule.every((g) => (g?.days || []).length > 0 && !vazio(g?.delivery_start) && !vazio(g?.delivery_end));

function corteDepoisDoFim(schedule) {
  for (const g of Array.isArray(schedule) ? schedule : []) {
    const corte = minutos(g?.order_cutoff), fim = minutos(g?.delivery_end);
    if (corte !== null && fim !== null && corte > fim) {
      return `${rotuloDias(g.days)}: o limite de pedidos (${g.order_cutoff}) passa do fim da entrega (${g.delivery_end}).`;
    }
  }
  return null;
}

function retiradaInvertida(pickupSchedule) {
  for (const g of Array.isArray(pickupSchedule) ? pickupSchedule : []) {
    const abre = minutos(g?.open), fecha = minutos(g?.close);
    if (abre !== null && fecha !== null && abre >= fecha) {
      return `Retirada ${rotuloDias(g.days)}: abre ${g.open} e fecha ${g.close}. O fechamento tem de ser depois.`;
    }
  }
  return null;
}

function formatoPixEstranho(f) {
  const chave = String(f.pix_key_data || "").trim();
  if (!chave || !f.pix_key_type) return null;
  const n = digitos(chave);
  const ok = {
    cpf: () => n.length === 11,
    cnpj: () => n.length === 14,
    phone: () => n.replace(/^55(?=\d{10,11}$)/, "").length >= 10 && n.replace(/^55(?=\d{10,11}$)/, "").length <= 11,
    email: () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(chave),
    random: () => /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(chave),
  }[f.pix_key_type];
  if (!ok || ok()) return null;
  const tipo = { cpf: "CPF (11 números)", cnpj: "CNPJ (14 números)", phone: "telefone (DDD + número)", email: "e-mail", random: "chave aleatória" }[f.pix_key_type];
  return `A chave Pix não parece ${tipo}. Confira: o robô manda exatamente o que está escrito.`;
}

const REGRAS = [
  // Etapa 1 — Sua unidade
  { etapa: 1, campos: ["franchise_name"], checar: (f) => vazio(f.franchise_name) && "Preencha o nome da unidade." },
  {
    etapa: 1, campos: ["street_address", "neighborhood", "city"],
    checar: (f) => (vazio(f.street_address) || vazio(f.neighborhood) || vazio(f.city)) &&
      "Preencha rua e número, bairro e cidade: o robô calcula a distância da entrega a partir daqui.",
  },
  {
    etapa: 1, campos: ["personal_phone_for_summary"],
    checar: (f) => {
      const n = digitos(f.personal_phone_for_summary).replace(/^55(?=\d{10,11}$)/, "");
      return (n.length < 10 || n.length > 11) && "Seu WhatsApp precisa de DDD + número (10 ou 11 dígitos): é para ele que vão os pedidos fechados.";
    },
  },

  // Etapa 2 — Entrega e retirada
  { etapa: 2, campos: ["has_delivery", "has_pickup"], checar: (f) => !entrega(f) && !f.has_pickup && "Ligue a entrega ou a retirada: sem nenhuma, o robô não tem como vender." },
  {
    etapa: 2, campos: ["has_delivery", "max_delivery_radius_km"],
    checar: (f) => entrega(f) && !(Number(f.max_delivery_radius_km) >= 1 && Number(f.max_delivery_radius_km) <= 60) &&
      "Raio de entrega entre 1 e 60 km.",
  },
  {
    etapa: 2, campos: ["max_delivery_radius_km", "delivery_schedule"],
    checar: (f) => {
      const maior = entrega(f) ? maiorFaixaKm(f.delivery_schedule) : null;
      return maior !== null && Number(f.max_delivery_radius_km) > 0 && Number(f.max_delivery_radius_km) < maior &&
        `O raio (${f.max_delivery_radius_km} km) é menor que a maior faixa de frete (${maior} km): o robô recusaria quem está nessa faixa.`;
    },
  },
  {
    etapa: 2, campos: ["has_delivery", "delivery_schedule"],
    checar: (f) => entrega(f) && !temHorario(f.delivery_schedule) && "Defina os dias e o horário de entrega (sem isso o WhatsApp não conecta).",
  },
  {
    etapa: 2, campos: ["delivery_schedule"],
    checar: (f) => {
      const p = entrega(f) && modoDoFrete(f) === "modalidade" ? validateDeliverySchedule(f.delivery_schedule) : [];
      return p.length > 0 && `Frete: ${p[0]}${p.length > 1 ? ` (e mais ${p.length - 1})` : ""}. Preencha ou apague a linha.`;
    },
  },
  { etapa: 2, campos: ["delivery_schedule"], checar: (f) => entrega(f) && modoDoFrete(f) === "modalidade" && corteDepoisDoFim(f.delivery_schedule) },
  // Cartão "Entrega" (frete por km/valor único e frete calculado): a regra lê o que a tela mostra.
  {
    etapa: 2, campos: ["_frete_modelo", "delivery_pricing", "delivery_schedule", "avg_prep_time_minutes"],
    checar: (f) => {
      if (!entrega(f)) return null;
      const modo = modoDoFrete(f);
      if (modo === "modalidade") return null;
      const modelo = modo === "estruturado" ? f.delivery_pricing : f._frete_modelo || legadoParaModelo(f);
      const p = problemasDoModelo(modelo, { estruturado: modo === "estruturado" });
      return p.length > 0 && `${p[0].msg}${p.length > 1 ? ` (e mais ${p.length - 1})` : ""}`;
    },
  },
  { etapa: 2, campos: ["pickup_schedule", "has_custom_pickup_hours", "has_pickup"], checar: (f) => !!f.has_pickup && retiradaInvertida(f.pickup_schedule) },

  // Etapa 3 — Pagamento
  { etapa: 3, campos: ["has_delivery", "payment_delivery"], checar: (f) => entrega(f) && !(f.payment_delivery || []).length && "Marque ao menos uma forma de pagamento na entrega." },
  { etapa: 3, campos: ["has_pickup", "payment_pickup"], checar: (f) => !!f.has_pickup && !(f.payment_pickup || []).length && "Marque ao menos uma forma de pagamento na retirada." },
  {
    etapa: 3, campos: ["payment_delivery", "payment_pickup", "pix_key_data"],
    checar: (f) => usaMetodo(f, "pix") && vazio(f.pix_key_data) && "Pix marcado: preencha a chave (o robô manda essa chave para o cliente pagar).",
  },
  { etapa: 3, soAviso: true, campos: ["pix_key_data", "pix_key_type"], checar: formatoPixEstranho },
  {
    etapa: 3, campos: ["charges_card_fee_to_customer", "payment_fees", "payment_delivery", "payment_pickup"],
    checar: (f) => {
      if (!f.charges_card_fee_to_customer) return null;
      const faltam = METODOS_COM_TAXA.filter((m) => usaMetodo(f, m) && vazio(f.payment_fees?.[m]));
      return faltam.length > 0 &&
        `"Repassar taxa" está ligado: preencha o percentual de ${faltam.map((m) => ROTULO_METODO[m]).join(", ")} (0 também vale).`;
    },
  },
  {
    etapa: 3, soAviso: true, campos: ["payment_link"],
    checar: (f) => !vazio(f.payment_link) && !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(String(f.payment_link).trim()) &&
      "O link de pagamento não parece um endereço (https://...). Sem link, o robô diz que a unidade envia na hora.",
  },

  // Etapa 4 — Seu vendedor
  {
    etapa: 4, campos: ["agent_name"],
    checar: (f) => (vazio(f.agent_name) ? "Preencha o nome da atendente." :
      nomeDeRobo(f.agent_name) && 'Use nome de pessoa para a atendente, sem "bot", "IA", "robô", "assistente" ou "virtual".'),
  },
];

/**
 * @param {number|null} etapa  1-4, ou null para todas
 * @param {object} form        formData da tela
 * @param {string[]} alterados campos que esta tela mudou desde que abriu
 * @param {{novo?: boolean}} opts novo = configuração ainda não existe (tudo barra)
 * @returns {{erros: string[], avisos: string[]}}
 */
export function validarEtapa(etapa, form, alterados = [], { novo = false } = {}) {
  const mexeu = new Set(alterados);
  const erros = [];
  const avisos = [];
  for (const regra of REGRAS) {
    if (etapa && regra.etapa !== etapa) continue;
    const msg = regra.checar(form || {});
    if (!msg) continue;
    const barra = !regra.soAviso && (novo || regra.campos.some((c) => mexeu.has(c)));
    (barra ? erros : avisos).push(msg);
  }
  return { erros, avisos };
}

export function validarTudo(form, alterados, opts) {
  return validarEtapa(null, form, alterados, opts);
}
