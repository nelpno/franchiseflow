/**
 * Horário especial com data e Instagram da loja (06/11/2026; SPEC bots/vendedor/docs/plans/2026-11-dados-da-loja).
 * Funções puras. O formato é o que o robô lê (V5 › Customer Context, DistanceService › Cota Frete,
 * EnviaPedidoFechado › Prepare Sale Data): franchise_configurations.horario_especial =
 *   [{ de: "AAAA-MM-DD", ate: "AAAA-MM-DD", tipo: "fechado" | "horario", abre: "HH:MM", fecha: "HH:MM",
 *      vale: "ambos" | "entrega" | "retirada" }]
 * "Horário diferente" é de um dia só (de = ate), como na pesquisa de 06/11: os períodos pedidos eram todos "fechado".
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;
const minutos = (t) => (HHMM.test(String(t || "")) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
export const MAX_DIAS_PERIODO = 62;

/** Hoje em São Paulo, "AAAA-MM-DD" (nunca toISOString: em BRT volta um dia depois das 21h). */
export function hojeBRT(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

const diasEntre = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

// sem data válida não é "vencido": é item incompleto (o salvar avisa)
export const vencido = (item, hoje) => { const fim = String(item?.ate || item?.de || ""); return ISO.test(fim) && fim < hoje; };

/** Item novo SEM data: a pessoa escolhe (nascer "fechado hoje" fecharia o robô hoje num toque sem querer). */
export function novoItem() {
  return { de: "", ate: "", tipo: "fechado", vale: "ambos" };
}

/**
 * O que vai ao banco: tira os vencidos (até < hoje), completa "até" e "vale", limpa abre/fecha do "fechado" e ordena.
 * Idempotente (roda no que a tela abriu e no que vai salvar: só o que a pessoa mudou entra no diff).
 */
export function normalizarHorarioEspecial(lista, hoje, { hasDelivery = true, hasPickup = true } = {}) {
  const duas = hasDelivery && hasPickup;
  return (Array.isArray(lista) ? lista : [])
    .filter((x) => x && ISO.test(String(x.de || "")))
    // "só entrega"/"só retirada" de uma modalidade que a unidade desligou sai (virar "ambos" fecharia a outra)
    .filter((x) => !(x.vale === "entrega" && !hasDelivery) && !(x.vale === "retirada" && !hasPickup))
    .map((x) => {
      const tipo = x.tipo === "horario" ? "horario" : "fechado";
      const ate = tipo === "horario" ? x.de : (ISO.test(String(x.ate || "")) ? x.ate : x.de);
      const vale = duas && (x.vale === "entrega" || x.vale === "retirada") ? x.vale : "ambos";
      const out = { de: x.de, ate, tipo, vale };
      if (tipo === "horario") { out.abre = String(x.abre || ""); out.fecha = String(x.fecha || ""); }
      return out;
    })
    .filter((x) => !vencido(x, hoje))
    .sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0));
}

const cruza = (a, b) => a.de <= b.ate && b.de <= a.ate && (a.vale === "ambos" || b.vale === "ambos" || a.vale === b.vale);
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Problemas que barram o salvar (lista normalizada ou não). Vencido não é problema: sai ao salvar. */
export function problemasHorarioEspecial(lista, hoje) {
  const itens = (Array.isArray(lista) ? lista : []).filter((x) => x && !vencido(x, hoje));
  const erros = [];
  itens.forEach((x) => {
    const de = String(x.de || ""), ate = x.tipo === "horario" ? de : String(x.ate || de);
    if (!ISO.test(de)) { erros.push("Horário especial: escolha a data."); return; }
    if (!ISO.test(ate) || ate < de) erros.push(`Horário especial de ${ddmm(de)}: a data final vem antes da inicial.`);
    else if (diasEntre(de, ate) + 1 > MAX_DIAS_PERIODO) erros.push(`Horário especial de ${ddmm(de)}: período de até ${MAX_DIAS_PERIODO} dias.`);
    if (x.tipo === "horario") {
      const a = minutos(x.abre), f = minutos(x.fecha);
      if (a === null || f === null) erros.push(`Horário especial de ${ddmm(de)}: preencha a hora de abrir e de fechar.`);
      else if (a >= f) erros.push(`Horário especial de ${ddmm(de)}: a hora de fechar tem de ser depois da de abrir.`);
    }
  });
  const norm = itens.map((x) => ({ de: String(x.de || ""), ate: x.tipo === "horario" ? String(x.de || "") : String(x.ate || x.de || ""), vale: x.vale || "ambos" })).filter((x) => ISO.test(x.de) && ISO.test(x.ate));
  for (let i = 0; i < norm.length; i++) for (let j = i + 1; j < norm.length; j++) {
    if (cruza(norm[i], norm[j])) { erros.push(`Horário especial: dois itens caem no mesmo dia (${ddmm(norm[i].de > norm[j].de ? norm[i].de : norm[j].de)}). Deixe um só por dia.`); return [...new Set(erros)]; }
  }
  return [...new Set(erros)];
}

// ---------- Instagram da loja ----------
/** Só o usuário: sem @, sem instagram.com/, sem ?igsh=…, em minúsculas. */
export function normalizarInstagram(v) {
  return String(v ?? "").trim().replace(/^@+/, "").replace(/^(https?:\/\/)?([a-z0-9-]+\.)?(instagram\.com|instagr\.am)\//i, "").replace(/[/?#].*$/, "").trim().toLowerCase();
}
export const instagramValido = (v) => { const u = normalizarInstagram(v); return /^[a-z0-9._]{1,30}$/.test(u) && !/instagram\.com|instagr\.am/.test(u); };
