/**
 * Salvar Configurações sem desfazer o que outra pessoa gravou (plano de frete 12/09/2026, Fase 1).
 *
 * Antes, o wizard mandava a linha INTEIRA a cada "Salvar"/"Próximo": uma aba aberta de manhã
 * desfazia à tarde a correção que o suporte tinha gravado no banco (Guarujá, 11/09: corrigido às
 * 14:49, sobrescrito às 18:47). Agora:
 *   1. só vão ao banco as colunas que ESTA tela mudou desde que abriu (diffPatch);
 *   2. antes de gravar, confere se alguma dessas colunas mudou no banco nesse meio-tempo
 *      (findConflicts). Mudou -> não grava e pede para recarregar;
 *   3. o rascunho local guarda só o que a pessoa mudou, nunca a tela inteira. Restaurar a tela
 *      inteira traria de volta o valor antigo de campos que ela nem tocou.
 * Coluna que a tela não mexeu nunca é reenviada, então a correção do suporte fica.
 */

// Igualdade por valor, sem depender da ordem das chaves (o jsonb do Postgres devolve em outra ordem).
export function stableStringify(value) {
  if (value === undefined || value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + stableStringify(value[k]))
    .join(",") + "}";
}

export function sameValue(a, b) {
  return stableStringify(a) === stableStringify(b);
}

/** Campos de `next` cujo valor difere de `baseline` (o que a tela carregou). */
export function diffPatch(baseline, next) {
  const patch = {};
  for (const key of Object.keys(next || {})) {
    if (!sameValue(baseline?.[key], next[key])) patch[key] = next[key];
  }
  return patch;
}

/**
 * Das colunas que esta tela vai gravar, as que mudaram no banco depois que ela abriu — e para um
 * valor diferente do que ela quer gravar (os dois chegarem ao mesmo valor não é conflito).
 */
export function findConflicts(loadedRow, currentRow, patch) {
  return Object.keys(patch || {}).filter(
    (key) => !sameValue(loadedRow?.[key], currentRow?.[key]) && !sameValue(currentRow?.[key], patch[key])
  );
}

// Campos que o wizard grava juntos: se um deles bateu de frente com outra pessoa, o rascunho perde
// o grupo inteiro (a cópia antiga de delivery_fee_rules sobrescreveria a nova, por exemplo).
const GRUPOS = [
  ["delivery_schedule", "delivery_fee_rules", "delivery_start_time", "order_cutoff_time",
    "charges_delivery_fee", "operating_hours", "opening_hours", "working_days"],
  ["unit_address", "street_address", "neighborhood", "city", "cep"],
];

/** Campos a tirar do rascunho local depois de um conflito. */
export function camposDoRascunhoADescartar(conflitos) {
  const tirar = new Set(conflitos);
  for (const grupo of GRUPOS) if (grupo.some((c) => tirar.has(c))) grupo.forEach((c) => tirar.add(c));
  return [...tirar];
}

const NOME_CAMPO = {
  delivery_schedule: "horários e taxas de entrega",
  delivery_fee_rules: "horários e taxas de entrega",
  promotions_combo: "promoções",
  pix_key_data: "chave Pix",
  pix_holder_name: "titular do Pix",
  payment_delivery: "pagamento na entrega",
  payment_pickup: "pagamento na retirada",
  max_delivery_radius_km: "raio de entrega",
  min_order_value: "pedido mínimo",
  avg_prep_time_minutes: "tempo de entrega",
  pickup_schedule: "horário de retirada",
  agent_name: "nome do vendedor",
  unit_address: "endereço",
  address_reference: "ponto de referência",
  catalog_image_url: "catálogo",
};

export function nomesDosCampos(keys) {
  return [...new Set((keys || []).map((k) => NOME_CAMPO[k] || "outros dados"))].join(", ");
}

const preenchido = (v) => v !== null && v !== undefined && String(v).trim() !== "";

function linhasDoFrete(feeRules) {
  const porModalidade = !!feeRules && !Array.isArray(feeRules) && feeRules.mode === "modality";
  const linhas = porModalidade ? feeRules.rules || [] : Array.isArray(feeRules) ? feeRules : [];
  return { porModalidade, linhas };
}

/**
 * Linhas de frete preenchidas pela metade. A vw_dadosunidade descarta linha sem valor sem avisar:
 * foi assim que Maré Mansa e Pedreira sumiram do fim de semana do Guarujá em 11/09.
 * @returns {{index: number, falta: "valor"|"descrição"|"km"}[]}
 */
export function incompleteFeeRows(feeRules) {
  const { porModalidade, linhas } = linhasDoFrete(feeRules);
  const out = [];
  linhas.forEach((linha, index) => {
    const chave = porModalidade ? linha?.label : linha?.max_km;
    if (preenchido(chave) === preenchido(linha?.fee)) return;
    out.push({ index, falta: preenchido(chave) ? "valor" : porModalidade ? "descrição" : "km" });
  });
  return out;
}

function temLinhaValida(feeRules) {
  const { porModalidade, linhas } = linhasDoFrete(feeRules);
  return linhas.some((l) => preenchido(porModalidade ? l?.label : l?.max_km) && preenchido(l?.fee));
}

const DIA = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
const ORDEM = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export function rotuloDias(days) {
  const d = ORDEM.filter((x) => (days || []).includes(x));
  if (d.length === 7) return "Todos os dias";
  if (d.length === 2) return `${DIA[d[0]]} e ${DIA[d[1]]}`;
  const seguidos = d.every((x, i) => i === 0 || ORDEM.indexOf(x) === ORDEM.indexOf(d[i - 1]) + 1);
  if (d.length >= 3 && seguidos) return `${DIA[d[0]]} a ${DIA[d[d.length - 1]]}`;
  return d.map((x) => DIA[x]).join(", ") || "Faixa sem dias";
}

/** O que impede salvar o frete, em frases prontas para a tela. */
export function validateDeliverySchedule(schedule) {
  const problemas = [];
  (Array.isArray(schedule) ? schedule : []).forEach((grupo) => {
    if (grupo?.charges_fee === false) return;
    const dias = rotuloDias(grupo?.days);
    const metade = incompleteFeeRows(grupo?.fee_rules);
    for (const { index, falta } of metade) {
      problemas.push(`${dias}, linha ${index + 1}: falta ${falta === "valor" ? "o valor" : falta === "km" ? "o km" : "a descrição"}`);
    }
    if (!metade.length && !temLinhaValida(grupo?.fee_rules)) {
      problemas.push(`${dias}: está marcado "Cobro taxa de entrega", mas não tem nenhum valor`);
    }
  });
  return problemas;
}
