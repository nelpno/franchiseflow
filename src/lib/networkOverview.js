// Régua ÚNICA da rede no admin. Hoje, Unidades, Financeiro ("Mais caíram"), Marketing e a
// Ficha importam daqui; nenhuma tela repete limite à mão (decisões 1-4 da Onda 1, 26/09).
// Linhas = get_admin_network_overview() (1 por unidade ativa e não-teste). A Ficha usa as
// MESMAS funções com linhaDaFicha(get_unit_360), então lista e ficha nunca se contradizem.
// Plano: ~/.claude/plans/admin-redesign-2026-09-26.md (princípios 3-5).
// Puro, sem alias "@/": node src/lib/networkOverview.test.mjs
import { formatPct } from "./formatters.js";
import { dataCurta, haDias, nomeMes } from "./adminFormat.js";

// ---------- limites (a única cópia) ----------

export const LIMITE_QUEDA_PCT = -20;
export const LIMITE_ALTA_PCT = 20;
// Base mínima do mês anterior (mesmo trecho) para comparar. O banco já devolve
// rev_delta_pct = NULL abaixo disso; aqui vale para quem calcula a partir de {rev, prev}.
export const PISO_BASE_QUEDA = 3000;
export const DIAS_SEM_VENDA = 7;
export const DIAS_ROBO_PARADO = 7;
// Unidade com menos de 30 dias é "Nova na trilha" (tom neutro, sem cobrança de venda/verba)...
// Era 60; Nelson baixou para 30 em 29/09/2026 (reunião com o Celso: "nova é inauguração,
// uns 30 dias; passou disso, sai"). O get_unit_360 ainda manda is_new com 60, mas aqui
// age_days manda sobre is_new, então a régua do front é 30 em todo lugar.
export const IDADE_NOVA_DIAS = 30;
// ...a não ser que esteja parada de verdade: mais de 30 dias sem venda (ou trilha aprovada).
export const DIAS_SEM_VENDA_NOVA = 30;

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------- régua por unidade ----------

export function semVendaDias(row) {
  return num(row?.days_since_last_sale);
}

// < IDADE_NOVA_DIAS na rede. Usa age_days quando existe; senão o is_new do banco.
export function ehNova(row) {
  if (!row) return false;
  const idade = num(row.age_days);
  if (idade !== null) return idade < IDADE_NOVA_DIAS;
  return !!row.is_new;
}

export function trilhaAprovada(row) {
  return row?.onboarding_status === "approved";
}

// Nova e ainda na trilha: fica protegida (tom neutro). Trilha aprovada = já roda, régua normal.
export function novaNaTrilha(row) {
  return ehNova(row) && !trilhaAprovada(row);
}

// "Sem venda": 7+ dias ou nunca vendeu. Nova na trilha só entra com mais de 30 dias parada.
export function semVenda(row) {
  const d = semVendaDias(row);
  if (novaNaTrilha(row)) return d !== null && d > DIAS_SEM_VENDA_NOVA;
  return d === null || d >= DIAS_SEM_VENDA;
}

// Robô sem nenhuma conversa há 7+ dias (sem histórico = null = não acusa).
export function roboParado(row) {
  const d = num(row?.days_since_last_bot);
  return d !== null && d >= DIAS_ROBO_PARADO;
}

// Dias desde a última conversa com o robô (null = sem histórico). Par de semVendaDias,
// pra listar "Unidade (N dias)" com o contador certo em cada motivo (achado 26/09).
export function roboParadoDias(row) {
  return num(row?.days_since_last_bot);
}

// % do mês até hoje contra o MESMO trecho do mês anterior. Aceita a linha do banco
// (rev_delta_pct, já com o piso aplicado) ou {rev, prev} / {rev_mtd, rev_prev_same}.
// null = sem base para comparar (anterior < R$ 3 mil).
export function deltaVendas(x) {
  if (!x) return null;
  if (x.rev_delta_pct !== undefined) return num(x.rev_delta_pct);
  const rev = num(x.rev ?? x.rev_mtd);
  const prev = num(x.prev ?? x.rev_prev_same);
  if (rev === null || prev === null || prev < PISO_BASE_QUEDA) return null;
  return Math.round((1000 * (rev - prev)) / prev) / 10;
}

// "Caiu" = queda de 20% ou mais com base ≥ R$ 3 mil. A MESMA em todas as telas.
export function caiu(x) {
  const d = deltaVendas(x);
  return d !== null && d <= LIMITE_QUEDA_PCT;
}

export function subiu(x) {
  const d = deltaVendas(x);
  return d !== null && d >= LIMITE_ALTA_PCT;
}

// Sem verba = não pagou nem o mês do calendário nem o mês-alvo (últimos 5 dias → mês seguinte).
export function semVerba(row) {
  return !row?.marketing_month_paid && !row?.marketing_target_paid;
}

// Mesma regra do paywall: só a cobrança atual OVERDUE.
export function mensalidadeVencida(row) {
  return row?.subscription_payment_status === "OVERDUE";
}

// ---------- mês da verba (vem do banco, nunca do relógio do aparelho) ----------

// Aceita a linha da overview, o array da overview (usa a 1ª linha), linhaDaFicha ou o
// bloco marketing da get_unit_360. → { mes, alvo, janela } | null
export function mesesVerba(x) {
  const r = Array.isArray(x) ? x[0] : x;
  if (!r) return null;
  const mes = r.marketing_month ?? r.calendar_month ?? r.marketing?.calendar_month ?? null;
  if (!mes) return null;
  const alvo = r.marketing_target_month ?? r.target_month ?? r.marketing?.target_month ?? mes;
  return { mes, alvo, janela: alvo !== mes };
}

// Mês PRINCIPAL (o do calendário): "setembro". Opções de nomeMes ({ maiuscula, ano }).
export function rotuloMesVerba(x, opcoes) {
  const m = mesesVerba(x);
  return m ? nomeMes(m.mes, opcoes) : "";
}

// "7 unidades não pagaram a verba de setembro" (mesmo texto em Hoje, Unidades e Marketing).
export function textoSemVerba(n, meses) {
  const mes = rotuloMesVerba(meses);
  const de = mes ? ` de ${mes}` : " do mês";
  return n === 1 ? `1 unidade não pagou a verba${de}` : `${n} unidades não pagaram a verba${de}`;
}

// Informação SECUNDÁRIA e neutra dos últimos 5 dias (o mês seguinte já pode ser pago).
// Fora da janela → null. Nunca é cobrança: tom sempre "neutro".
//   rede (array):   { texto: "Outubro: 12 já pagaram", pagaram, total }
//   unidade (linha): { texto: "Out: já pagou" | "Out: ainda pode pagar", pago }
export function infoMesSeguinte(x) {
  const m = mesesVerba(x);
  if (!m?.janela) return null;
  if (Array.isArray(x)) {
    const pagaram = x.filter((r) => r?.marketing_target_paid).length;
    return {
      mes: m.alvo,
      tom: "neutro",
      pagaram,
      total: x.length,
      texto: `${nomeMes(m.alvo, { maiuscula: true })}: ${pagaram} ${pagaram === 1 ? "já pagou" : "já pagaram"}`,
    };
  }
  const pago = !!x.marketing_target_paid;
  return {
    mes: m.alvo,
    tom: "neutro",
    pago,
    texto: `${nomeMes(m.alvo, { curto: true })}: ${pago ? "já pagou" : "ainda pode pagar"}`,
  };
}

// ---------- Ficha: get_unit_360 no formato de uma linha da overview ----------

function pernaVerba(months, mes) {
  const linhas = (months || []).filter((p) => p?.month === mes && p?.status === "confirmed");
  if (!linhas.length) return { paid: false, amount: 0, raised_at: null };
  return {
    paid: true,
    amount: linhas.reduce((s, p) => s + (num(p.amount) || 0), 0),
    raised_at: linhas.map((p) => p.campaign_raised_at).filter(Boolean).sort().pop() || null,
  };
}

// Normaliza o jsonb da get_unit_360 para as MESMAS chaves da overview. A Ficha passa o
// resultado para sinaisUnidade/semVenda/caiu/semVerba e nunca decide sozinha.
export function linhaDaFicha(unit) {
  if (!unit) return null;
  const s = unit.sales || {};
  const bot = unit.bot || {};
  const mk = unit.marketing || {};
  const sub = unit.subscription || {};
  const po = unit.purchase_orders || {};
  const mes = mk.calendar_month ?? null;
  const alvo = mk.target_month ?? mes;
  const pm = pernaVerba(mk.months, mes);
  const pa = pernaVerba(mk.months, alvo);
  return {
    franchise_id: unit.franchise_id,
    franchise_name: unit.franchise_name,
    owner_name: unit.owner_name,
    phone: unit.phone ?? null,
    city: unit.city,
    age_days: num(unit.age_days),
    is_new: !!unit.is_new,
    onboarding_status: unit.onboarding?.status ?? null,
    onboarding_pct: num(unit.onboarding?.pct),
    rev_mtd: num(s.rev_mtd),
    rev_prev_same: num(s.rev_prev_same),
    rev_delta_pct: num(s.rev_delta_pct),
    days_since_last_sale: num(s.days_since_last_sale),
    people_7d: num(bot.people_7d),
    days_since_last_bot: num(bot.days_since_last_conversation),
    days_since_last_po: num(po.days_since_last),
    pending_po_count: num(po.pending_count),
    marketing_month: mes,
    marketing_month_paid: pm.paid,
    marketing_month_amount: pm.amount,
    marketing_month_raised_at: pm.raised_at,
    marketing_target_month: alvo,
    marketing_target_paid: pa.paid,
    marketing_target_amount: pa.amount,
    marketing_target_raised_at: pa.raised_at,
    subscription_payment_status: sub.payment_status ?? null,
    subscription_due_date: sub.due_date ?? null,
  };
}

// ---------- motivos da unidade, em ordem de prioridade ----------

// Ordem = a dos chips da lista + mensalidade. O 1º motivo vira a frase da Ficha.
export const ORDEM_SINAIS = ["sem_venda", "robo_parado", "caiu", "sem_verba", "mensalidade"];

const TOM_SINAL = { sem_venda: "err", robo_parado: "warn", caiu: "warn", sem_verba: "err", mensalidade: "err" };

// Lista de motivos de uma unidade (linha da overview ou linhaDaFicha):
//   [{ chave, titulo, tom: "err"|"warn"|"neutro", filtro }]
// - Unidade antiga: os que valem, na ORDEM_SINAIS.
// - Nova na trilha: "sem venda" só se passou de 30 dias (e aí é problema de verdade, fica
//   primeiro); depois vem "nova" (tom neutro); o resto aparece, mas em tom neutro.
// - Nenhum motivo → [] (a tela diz "sem alerta agora").
export function sinaisUnidade(row) {
  if (!row) return [];
  const protegida = novaNaTrilha(row);
  const mes = rotuloMesVerba(row);
  const out = [];
  for (const chave of ORDEM_SINAIS) {
    let titulo = null;
    if (chave === "sem_venda" && semVenda(row)) {
      const d = semVendaDias(row);
      titulo = d === null ? "Nunca vendeu" : `Sem venda ${haDias(d)}`;
    } else if (chave === "robo_parado" && roboParado(row)) {
      titulo = `Robô sem conversa ${haDias(num(row.days_since_last_bot))}`;
    } else if (chave === "caiu" && caiu(row)) {
      titulo = `Vendendo ${formatPct(Math.abs(deltaVendas(row)))} menos que no mesmo trecho do mês passado`;
    } else if (chave === "sem_verba" && semVerba(row)) {
      titulo = mes ? `Não pagou a verba de ${mes}` : "Não pagou a verba do mês";
    } else if (chave === "mensalidade" && mensalidadeVencida(row)) {
      const venc = dataCurta(row.subscription_due_date);
      titulo = `Mensalidade vencida${venc ? ` desde ${venc}` : ""}`;
    }
    if (!titulo) continue;
    const tom = protegida && chave !== "sem_venda" ? "neutro" : TOM_SINAL[chave];
    out.push({ chave, titulo, tom, filtro: FILTRO_DO_SINAL[chave] || null });
  }
  if (!protegida) return out;
  const pct = num(row.onboarding_pct);
  const nova = {
    chave: "nova",
    titulo: `Nova na trilha${pct !== null ? `: ${pct}% dos Primeiros passos` : ""}`,
    tom: "neutro",
    filtro: "novas",
  };
  const reais = out.filter((s) => s.tom !== "neutro");
  const neutros = out.filter((s) => s.tom === "neutro");
  return [...reais, nova, ...neutros];
}

const FILTRO_DO_SINAL = { sem_venda: "sem_venda", robo_parado: "robo_parado", caiu: "caiu", sem_verba: "sem_verba" };

// ---------- filtros da lista (chips de Unidades e cartões de Hoje) ----------

// Fonte ÚNICA: o cartão da home e o chip da lista usam o mesmo `FILTROS[k].match`.
export const FILTROS = {
  todas: {
    chip: "Todas",
    match: () => true,
    // Quem tem sinal primeiro (mais sinais primeiro), depois quem mais vendeu em 90 dias.
    // Sem isso "Todas" caía em ordem alfabética: 66 cartões, quem precisa de atenção
    // misturado com quem está bem (achado médio 26/09).
    ordem: (a, b) => {
      const sa = sinaisUnidade(a).filter((s) => s.tom !== "neutro").length;
      const sb = sinaisUnidade(b).filter((s) => s.tom !== "neutro").length;
      if (sb !== sa) return sb - sa;
      return (num(b.rev_90d) || 0) - (num(a.rev_90d) || 0);
    },
  },
  sem_venda: {
    chip: "Sem venda 7+ dias",
    titulo: (n) => `${n} ${n === 1 ? "unidade" : "unidades"} sem venda há 7 dias ou mais`,
    oQueFazer:
      "Ligue para cada uma, começando pela de cima (a que mais vendia). Pergunte: tem estoque? o robô está ligado? precisa de ajuda? Depois registre a conversa.",
    match: semVenda,
    ordem: (a, b) => (num(b.rev_90d) || 0) - (num(a.rev_90d) || 0),
  },
  robo_parado: {
    chip: "Robô parado",
    titulo: (n) => `${n} ${n === 1 ? "unidade" : "unidades"} com o robô parado`,
    oQueFazer:
      "Nenhuma conversa em 7 dias: confira se o WhatsApp está conectado e se o anúncio está no ar (sem verba o anúncio para, e com ele o robô).",
    match: roboParado,
    ordem: (a, b) => (num(b.rev_90d) || 0) - (num(a.rev_90d) || 0),
  },
  caiu: {
    chip: "Vendendo 20% menos",
    titulo: (n) => `${n} ${n === 1 ? "unidade vendendo" : "unidades vendendo"} 20% menos que no mês passado`,
    oQueFazer:
      "Cada uma comparada com ela mesma, no mesmo trecho do mês. Só entra quem vendia mais de R$ 3 mil. Pergunte o que mudou: estoque, anúncio, robô, férias.",
    match: caiu,
    ordem: (a, b) => deltaVendas(a) - deltaVendas(b),
  },
  sem_verba: {
    chip: "Sem verba do mês",
    // `meses` (opcional) = a overview ou uma linha dela: nomeia o mês do calendário.
    titulo: (n, meses) => textoSemVerba(n, meses),
    oQueFazer: "Sem verba o anúncio para. Lembre com carinho: o mínimo é R$ 200 e a campanha sobe assim que o pagamento é confirmado.",
    match: semVerba,
    ordem: (a, b) => (num(b.rev_90d) || 0) - (num(a.rev_90d) || 0),
  },
  novas: {
    chip: "Novas na trilha",
    titulo: (n) => `${n} ${n === 1 ? "unidade nova" : "unidades novas"} na trilha`,
    oQueFazer: "Menos de 30 dias. Veja em que passo dos Primeiros passos cada uma parou e ajude a dar o próximo.",
    match: novaNaTrilha,
    ordem: (a, b) => (num(a.onboarding_pct) ?? 0) - (num(b.onboarding_pct) ?? 0),
  },
  subiu: {
    chip: "Subiram 20%",
    titulo: (n) => `${n} ${n === 1 ? "unidade subiu" : "unidades subiram"} 20% ou mais`,
    oQueFazer: "Dê os parabéns e pergunte o que funcionou: o que der certo numa unidade serve para a rede.",
    match: subiu,
    ordem: (a, b) => deltaVendas(b) - deltaVendas(a),
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
// `cairam`/`subiram` = a régua dos chips (use estes quando o texto disser "caíram").
// `abaixo`/`acima` = qualquer diferença, sem piso: só para a distribuição informativa.
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
  const cairam = rows.filter(caiu).length;
  const subiram = rows.filter(subiu).length;
  return { total: rows.length, receitaMes, receitaAnterior, deltaPct, venderam7d, abaixo, acima, cairam, subiram };
}

// ---------- nomes ----------

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

// ---------- ordenação (cabeçalho clicável no desktop, seletor no celular) ----------

// Filtros em que a coluna do mês mostra "vendia em 90 dias" em vez do faturamento do mês
// (a fila real de quem ligar primeiro) — mesma régua de unidadeDisplay.js/rotuloColunaFaturamento,
// centralizada aqui para o clique no cabeçalho ordenar pelo MESMO número que a coluna mostra.
export const FILTROS_REV_90D = new Set(["sem_venda", "robo_parado"]);

function rankVerba(row) {
  if (!row) return null;
  return (row.marketing_month_paid ? 1 : 0) + (row.marketing_target_paid ? 1 : 0);
}

// Cada opção: `rotulo` (cabeçalho/seletor), `direcaoPadrao` (o que o 1º clique mostra) e
// `valor(row, filtro)` — o número/texto que ordena. null SEMPRE fica no fim, nas duas
// direções (regra à parte em `compararComNulos`, não no sinal do valor).
export const OPCOES_ORDEM = {
  unidade: {
    rotulo: "Unidade (A–Z)",
    direcaoPadrao: "asc",
    valor: (row) => nomeCurto(row?.franchise_name) || null,
  },
  faturamento: {
    rotulo: "Faturamento no mês",
    direcaoPadrao: "desc",
    valor: (row, filtro) => num(FILTROS_REV_90D.has(filtro) ? row?.rev_90d : row?.rev_mtd),
  },
  variacao: {
    rotulo: "Variação vs. mês anterior",
    direcaoPadrao: "desc",
    valor: (row) => deltaVendas(row),
  },
  sem_venda: {
    rotulo: "Sem venda há",
    direcaoPadrao: "desc",
    valor: (row) => semVendaDias(row),
  },
  robo: {
    rotulo: "Robô",
    direcaoPadrao: "desc",
    valor: (row) => roboParadoDias(row),
  },
  ultimo_pedido: {
    rotulo: "Último pedido",
    direcaoPadrao: "desc",
    valor: (row) => num(row?.days_since_last_po),
  },
  verba: {
    rotulo: "Verba",
    direcaoPadrao: "asc",
    valor: (row) => rankVerba(row),
  },
};

// Ordem dos campos no seletor "Ordenar por" do celular (mesma dos cabeçalhos do desktop).
export const ORDEM_OPCOES_LISTA = ["unidade", "faturamento", "variacao", "sem_venda", "robo", "ultimo_pedido", "verba"];

export function isOrdemValida(k) {
  return Object.prototype.hasOwnProperty.call(OPCOES_ORDEM, k);
}

export function direcaoPadraoOrdem(chave) {
  return OPCOES_ORDEM[chave]?.direcaoPadrao || "desc";
}

// null/undefined SEMPRE no fim, nas duas direções (não "menor" no asc nem "maior" no desc).
function compararComNulos(a, b, dir) {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  const r =
    typeof a === "string" || typeof b === "string"
      ? String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" })
      : a - b;
  return dir === "asc" ? r : -r;
}

// Ordena `rows` por uma chave de OPCOES_ORDEM. `chave` inválida/ausente devolve `rows` sem
// mexer (a tela já aplicou a ordem padrão do filtro antes de chamar isto).
export function ordenarPor(rows, chave, dir, filtro) {
  const opc = OPCOES_ORDEM[chave];
  if (!opc) return rows;
  const direcao = dir === "asc" || dir === "desc" ? dir : opc.direcaoPadrao;
  return [...rows].sort((a, b) => compararComNulos(opc.valor(a, filtro), opc.valor(b, filtro), direcao));
}

// ---------- ida e volta da Ficha (decisão 7) ----------

// Link para a Ficha que lembra de onde veio:
//   const { to, state } = linkFicha(evo, { from: location.pathname + location.search, label: "Unidades" });
//   <Link to={to} state={state}>
export function linkFicha(evo, { from, label } = {}) {
  const to = `/Unidade?id=${encodeURIComponent(evo ?? "")}`;
  return from ? { to, state: { from, label: label || "a tela anterior" } } : { to, state: undefined };
}

// Caminho interno seguro ("/X..." e nunca "//host" nem "/\host").
const caminhoInterno = (p) => typeof p === "string" && /^\/(?![/\\])/.test(p);

// Para onde o "← Voltar" da Ficha leva. Ordem: location.state.from → ?voltar= → Unidades.
//   voltarDaFicha(location) → { to, label, texto: "← Voltar para Hoje" }
export function voltarDaFicha(location) {
  const st = location?.state;
  if (st && caminhoInterno(st.from)) {
    const label = st.label || "a tela anterior";
    return { to: st.from, label, texto: `← Voltar para ${label}` };
  }
  let voltar = null;
  try {
    voltar = new URLSearchParams(location?.search || "").get("voltar");
  } catch {
    voltar = null;
  }
  if (caminhoInterno(voltar)) return { to: voltar, label: "a lista", texto: "← Voltar para a lista" };
  // Formato antigo: ?voltar=<query string da tela Unidades> (ex.: "filtro=sem_venda").
  if (voltar && !/[/\\:]/.test(voltar)) {
    return { to: `/Unidades?${voltar.replace(/^\?/, "")}`, label: "Unidades", texto: "← Voltar para Unidades" };
  }
  return { to: "/Unidades", label: "Unidades", texto: "← Unidades" };
}
