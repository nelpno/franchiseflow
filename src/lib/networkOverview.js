// Regras da visão da rede (admin "Hoje" e "Unidades"). Fonte ÚNICA: o cartão da home e o
// chip da lista usam o mesmo `FILTROS[k].match`, então a contagem de um bate com a do outro.
// Linhas = get_admin_network_overview() (1 por unidade ativa e não-teste).
// Plano: ~/.claude/plans/admin-redesign-2026-09-26.md (princípios 3-5).

export const LIMITE_QUEDA_PCT = -20;
export const LIMITE_ALTA_PCT = 20;
export const DIAS_SEM_VENDA = 7;
export const DIAS_ROBO_PARADO = 7;

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function semVendaDias(row) {
  return num(row.days_since_last_sale);
}

// Sem verba = não pagou nem o mês do calendário nem o mês-alvo (últimos 5 dias → mês seguinte).
export function semVerba(row) {
  return !row.marketing_month_paid && !row.marketing_target_paid;
}

// Unidade nova (< 60 dias) fica só em "Novas na trilha": nunca é cobrada como "sem venda".
export const FILTROS = {
  todas: {
    chip: "Todas",
    match: () => true,
  },
  sem_venda: {
    chip: "Sem venda 7+ dias",
    titulo: (n) => `${n} ${n === 1 ? "unidade" : "unidades"} sem venda há 7 dias ou mais`,
    oQueFazer:
      "Ligue para cada uma, começando pela de cima (a que mais vendia). Pergunte: tem estoque? o robô está ligado? precisa de ajuda? Depois registre a conversa.",
    match: (r) => {
      if (r.is_new) return false;
      const d = semVendaDias(r);
      return d === null || d >= DIAS_SEM_VENDA;
    },
    ordem: (a, b) => num(b.rev_90d) - num(a.rev_90d),
  },
  robo_parado: {
    chip: "Robô parado",
    titulo: (n) => `${n} ${n === 1 ? "unidade" : "unidades"} com o robô parado`,
    oQueFazer:
      "Nenhuma conversa em 7 dias: confira se o WhatsApp está conectado e se o anúncio está no ar (sem verba o anúncio para, e com ele o robô).",
    match: (r) => {
      const d = num(r.days_since_last_bot);
      return d !== null && d >= DIAS_ROBO_PARADO;
    },
    ordem: (a, b) => num(b.rev_90d) - num(a.rev_90d),
  },
  caiu: {
    chip: "Vendendo 20% menos",
    titulo: (n) => `${n} ${n === 1 ? "unidade vendendo" : "unidades vendendo"} 20% menos que no mês passado`,
    oQueFazer:
      "Cada uma comparada com ela mesma, no mesmo trecho do mês. Só entra quem vendia mais de R$ 3 mil. Pergunte o que mudou: estoque, anúncio, robô, férias.",
    match: (r) => num(r.rev_delta_pct) !== null && num(r.rev_delta_pct) <= LIMITE_QUEDA_PCT,
    ordem: (a, b) => num(a.rev_delta_pct) - num(b.rev_delta_pct),
  },
  sem_verba: {
    chip: "Sem verba do mês",
    titulo: (n) => `${n} ${n === 1 ? "unidade não pagou" : "unidades não pagaram"} a verba de anúncio`,
    oQueFazer: "Sem verba o anúncio para. Lembre com carinho: o mínimo é R$ 200 e a campanha sobe assim que o pagamento é confirmado.",
    match: semVerba,
    ordem: (a, b) => num(b.rev_90d) - num(a.rev_90d),
  },
  novas: {
    chip: "Novas na trilha",
    titulo: (n) => `${n} ${n === 1 ? "unidade nova" : "unidades novas"} na trilha`,
    oQueFazer: "Menos de 60 dias. Veja em que passo dos Primeiros passos cada uma parou e ajude a dar o próximo.",
    match: (r) => !!r.is_new,
    ordem: (a, b) => num(a.onboarding_pct ?? 0) - num(b.onboarding_pct ?? 0),
  },
  subiu: {
    chip: "Subiram 20%",
    titulo: (n) => `${n} ${n === 1 ? "unidade subiu" : "unidades subiram"} 20% ou mais`,
    oQueFazer: "Dê os parabéns e pergunte o que funcionou: o que der certo numa unidade serve para a rede.",
    match: (r) => num(r.rev_delta_pct) !== null && num(r.rev_delta_pct) >= LIMITE_ALTA_PCT,
    ordem: (a, b) => num(b.rev_delta_pct) - num(a.rev_delta_pct),
  },
};

// Ordem dos chips na tela Unidades.
export const ORDEM_FILTROS = ["todas", "sem_venda", "robo_parado", "caiu", "sem_verba", "novas", "subiu"];

export function isFiltroValido(k) {
  return Object.prototype.hasOwnProperty.call(FILTROS, k);
}

export function contarFiltros(rows) {
  const out = {};
  for (const k of ORDEM_FILTROS) out[k] = rows.filter(FILTROS[k].match).length;
  return out;
}

export function aplicarFiltro(rows, k) {
  const f = FILTROS[isFiltroValido(k) ? k : "todas"];
  const list = rows.filter(f.match);
  return f.ordem ? [...list].sort(f.ordem) : list;
}

// Busca por nome da unidade, franqueado ou cidade, sem acento e sem caixa.
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function buscar(rows, termo) {
  const t = semAcento(termo).trim();
  if (!t) return rows;
  return rows.filter((r) => [r.franchise_name, r.owner_name, r.city].some((v) => semAcento(v).includes(t)));
}

// Cartões do topo de "Hoje". Comparação honesta: mês até hoje × mesmo trecho do mês anterior.
export function resumoRede(rows) {
  const receitaMes = rows.reduce((s, r) => s + (num(r.rev_mtd) || 0), 0);
  const receitaAnterior = rows.reduce((s, r) => s + (num(r.rev_prev_same) || 0), 0);
  const deltaPct = receitaAnterior > 0 ? Math.round((1000 * (receitaMes - receitaAnterior)) / receitaAnterior) / 10 : null;
  const venderam7d = rows.filter((r) => {
    const d = semVendaDias(r);
    return d !== null && d < DIAS_SEM_VENDA;
  }).length;
  const abaixo = rows.filter((r) => num(r.rev_prev_same) > 0 && num(r.rev_mtd) < num(r.rev_prev_same)).length;
  const acima = rows.filter((r) => num(r.rev_mtd) > num(r.rev_prev_same)).length;
  return { total: rows.length, receitaMes, receitaAnterior, deltaPct, venderam7d, abaixo, acima };
}

// "Maxi Massas Vila Maria" -> "Vila Maria". Toda unidade começa igual; o prefixo só gasta espaço.
export function nomeCurto(nome) {
  const s = String(nome ?? "").replace(/^maxi\s+massas\s*[-–:]?\s*/i, "").trim();
  return s || String(nome ?? "");
}

// "Vila dos Remédios, Itatiba, Piratininga e mais 2"
export function nomesResumo(rows, max = 3) {
  const nomes = rows.map((r) => nomeCurto(r.franchise_name)).filter(Boolean);
  if (nomes.length <= max) return nomes.join(", ");
  return `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
}
