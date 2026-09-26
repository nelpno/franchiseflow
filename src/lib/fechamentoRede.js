// Regras puras da aba "Fechamento do mês" do Financeiro (admin).
// Linhas = get_financeiro_rede(p_month): 1 por unidade (não teste; ativa ou com venda no mês).
// Plano: ~/.claude/plans/admin-redesign-2026-09-26.md (princípios 4 e 7).
// A régua de "caiu" vem de networkOverview.js (LIMITE_QUEDA_PCT) — a MESMA do Hoje e de
// Unidades, para os números baterem entre as telas (achado "duplicidades" da Onda 1).
// Testes: node src/lib/fechamentoRede.test.mjs
import { caiu, infoMesSeguinte, mensalidadeVencida, mesesVerba, rotuloMesVerba, semVerba, textoSemVerba } from "./networkOverview.js";
import { MESES, somarMeses } from "./adminFormat.js";

// Mês por extenso e soma de meses moram em adminFormat.js (um lugar só); o piso de R$ 3 mil
// da queda é aplicado pelo banco (rev_delta_pct = NULL abaixo dele) e pela régua caiu().
export { infoMesSeguinte, mensalidadeVencida, mesesVerba, rotuloMesVerba, somarMeses, textoSemVerba };

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// A migração supabase/2026-09-26-admin-12-financeiro-rede-cobranca.sql acrescenta
// unconfirmed_old_count/future_count/po_amount/po_prev_amount a get_financeiro_rede, mas
// NÃO foi aplicada (regra do orquestrador: só SELECT via MCP). Até aplicar, a RPC antiga
// não devolve essas colunas — `campoPresente` detecta a ausência para o front cair no
// comportamento de sempre em vez de mostrar "0" como se fosse dado real.
function campoPresente(rows, campo) {
  return (Array.isArray(rows) ? rows : []).some(
    (r) => r && Object.prototype.hasOwnProperty.call(r, campo) && r[campo] !== null && r[campo] !== undefined
  );
}

// 'YYYY-MM-DD' -> { ano, mes (0-11), dia } sem passar por Date (fuso não mexe).
function partes(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]) - 1, dia: Number(m[3]) };
}

function ultimoDia(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

export function mesValido(yearMonth, atual, maxAtras = 12) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(yearMonth ?? ""))) return false;
  return yearMonth <= atual && yearMonth >= somarMeses(atual, -maxAtras);
}

// Rótulos do período a partir das datas que a própria RPC devolve (fonte única do corte).
// Mês corrente: "até dia 26" / "1 a 26 de agosto". Mês fechado: "setembro inteiro".
//
// "Fechado" olha os DOIS lados: num mês curto (ex.: setembro, 30 dias) o dia 30 fecha o mês
// atual, mas a RPC corta o mês anterior (agosto, 31 dias) no MESMO dia — 30/08, não o mês
// inteiro. Sem checar o lado anterior, o rótulo dizia "agosto inteiro" faltando o dia 31.
export function rotulosPeriodo(row) {
  const ini = partes(row?.period_start);
  const fim = partes(row?.period_end);
  const pIni = partes(row?.prev_start);
  const pFim = partes(row?.prev_end);
  if (!ini || !fim || !pIni || !pFim) return null;
  const atualCompleto = fim.dia === ultimoDia(fim.ano, fim.mes);
  const anteriorCompleto = pFim.dia === ultimoDia(pFim.ano, pFim.mes);
  const parcial = !atualCompleto;
  const comparacaoCompleta = atualCompleto && anteriorCompleto;
  const mesAtual = MESES[ini.mes];
  const mesAnterior = MESES[pIni.mes];
  return {
    parcial,
    diaFim: fim.dia,
    mesAtual,
    mesAnterior,
    resumo: parcial ? `até dia ${fim.dia}` : `${mesAtual} inteiro`,
    comparacao: comparacaoCompleta ? `${mesAnterior} inteiro` : `1 a ${pFim.dia} de ${mesAnterior}`,
    colunaAtual: parcial ? `${cap(mesAtual)} (até ${fim.dia})` : cap(mesAtual),
    colunaAnterior: comparacaoCompleta ? cap(mesAnterior) : `${cap(mesAnterior)} (até ${pFim.dia})`,
  };
}

// Sem verba = unidade ativa que não pagou (confirmado) a verba do mês nem a do mês-alvo.
// get_financeiro_rede devolve as MESMAS colunas que get_admin_network_overview
// (marketing_month_paid / marketing_target_paid) — reusa o semVerba único de
// networkOverview.js (achado "duplicidades" + achado "médio" 26/09: o nome do mês tinha
// que bater com Hoje/Unidades/Marketing, e agora bate porque a fonte é a mesma função).
export function semVerbaFechamento(row) {
  return !!row?.is_active && semVerba(row);
}

// "A confirmar" = só vendas sem pagamento confirmado. Mensalidade vencida e verba não paga
// já têm cartão próprio ("A receber das unidades") — não duplicar aqui (achado "design").
export function temPendencia(row) {
  return num(row?.unconfirmed_count) > 0;
}

// Pendências da linha, em texto curto (hoje só vendas a confirmar). Com a RPC nova
// (unconfirmed_old_count presente), mostra só a parte com mais de 7 dias — é a que
// pede ação; venda de hoje ainda sem confirmar é normal (#21).
export function pendenciasDaLinha(row) {
  const out = [];
  const temAntiga = row && Object.prototype.hasOwnProperty.call(row, "unconfirmed_old_count") && row.unconfirmed_old_count !== null;
  const n = temAntiga ? num(row.unconfirmed_old_count) : num(row?.unconfirmed_count);
  if (n > 0) out.push(`${n} ${n === 1 ? "venda a confirmar" : "vendas a confirmar"}${temAntiga ? " (7+ dias)" : ""}`);
  return out;
}

// Diferença em %, só quando o banco liberou (base >= piso). null = não comparar.
export function deltaPct(row) {
  const v = row?.rev_delta_pct;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function resumoFechamento(rows) {
  const lista = Array.isArray(rows) ? rows : [];
  const receita = lista.reduce((s, r) => s + num(r.rev_month), 0);
  const anterior = lista.reduce((s, r) => s + num(r.rev_prev_same), 0);
  const delta = anterior > 0 ? Math.round((1000 * (receita - anterior)) / anterior) / 10 : null;
  const naoConfirmadas = lista.reduce((s, r) => s + num(r.unconfirmed_count), 0);
  const valorNaoConfirmado = lista.reduce((s, r) => s + num(r.unconfirmed_value), 0);
  let topNaoConfirmadas = null;
  for (const r of lista) {
    const n = num(r.unconfirmed_count);
    if (n > 0 && (!topNaoConfirmadas || n > topNaoConfirmadas.n)) {
      topNaoConfirmadas = { franchise_id: r.franchise_id, franchise_name: r.franchise_name, n };
    }
  }

  // #21: só a fração com mais de 7 dias (RPC nova — ver campoPresente acima).
  const temAntigas = campoPresente(lista, "unconfirmed_old_count");
  const naoConfirmadasAntigas = temAntigas ? lista.reduce((s, r) => s + num(r.unconfirmed_old_count), 0) : null;
  let topAntigas = null;
  if (temAntigas) {
    for (const r of lista) {
      const n = num(r.unconfirmed_old_count);
      if (n > 0 && (!topAntigas || n > topAntigas.n)) {
        topAntigas = { franchise_id: r.franchise_id, franchise_name: r.franchise_name, n };
      }
    }
  }

  // #22: vendas com sale_date futura, fora do mês sem aviso (RPC nova).
  const temFuturas = campoPresente(lista, "future_count");
  const vendasFuturas = temFuturas ? lista.reduce((s, r) => s + num(r.future_count), 0) : null;

  // #22: quanto a Maxi recebeu de pedidos à fábrica no mesmo trecho (RPC nova).
  const temPedidos = campoPresente(lista, "po_amount");
  const poAmount = temPedidos ? lista.reduce((s, r) => s + num(r.po_amount), 0) : null;
  const poPrevAmount = temPedidos ? lista.reduce((s, r) => s + num(r.po_prev_amount), 0) : null;
  const poDeltaPct = temPedidos && poPrevAmount > 0 ? Math.round((1000 * (poAmount - poPrevAmount)) / poPrevAmount) / 10 : null;

  // #19: "3 vencidas · R$ 450 · a mais antiga há 52 dias (Uberlândia)" — subscription_value
  // e subscription_due_date já vêm da RPC atual, sem precisar da migração nova.
  const vencidas = lista.filter(mensalidadeVencida);
  const valorVencidas = vencidas.reduce((s, r) => s + num(r.subscription_value), 0);
  let maisAntigaVencida = null;
  for (const r of vencidas) {
    if (!r.subscription_due_date) continue;
    if (!maisAntigaVencida || r.subscription_due_date < maisAntigaVencida.subscription_due_date) {
      maisAntigaVencida = r;
    }
  }

  return {
    unidades: lista.length,
    receita,
    anterior,
    deltaPct: delta,
    mensalidadesVencidas: vencidas.length,
    valorVencidas,
    maisAntigaVencida: maisAntigaVencida
      ? { franchise_id: maisAntigaVencida.franchise_id, franchise_name: maisAntigaVencida.franchise_name, dueDate: maisAntigaVencida.subscription_due_date }
      : null,
    semVerba: lista.filter(semVerbaFechamento).length,
    // Mês principal = o do calendário (decisão 2). NÃO pré-computar com mesesVerba/
    // rotuloMesVerba aqui: eles esperam as linhas CRUAS (marketing_month/marketing_target_
    // month), não um objeto já transformado — quem quiser o rótulo chama rotuloMesVerba(rows)
    // direto, passando esta mesma `rows`.
    naoConfirmadas,
    valorNaoConfirmado,
    topNaoConfirmadas,
    naoConfirmadasAntigas,
    topAntigas,
    vendasFuturas,
    poAmount,
    poPrevAmount,
    poDeltaPct,
    comPendencia: lista.filter(temPendencia).length,
  };
}

// Dias de atraso a partir de uma data DATE ('YYYY-MM-DD'), sem passar por Date (fuso).
export function diasAtraso(dataIso, hojeIso) {
  const a = partes(dataIso);
  const hoje = partes(hojeIso) || (() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth(), dia: d.getDate() };
  })();
  if (!a) return null;
  const ms = Date.UTC(hoje.ano, hoje.mes, hoje.dia) - Date.UTC(a.ano, a.mes, a.dia);
  return Math.round(ms / 86400000);
}

export const LISTAS = {
  // Mesma régua do Hoje e de Unidades (LIMITE_QUEDA_PCT = −20, base ≥ R$ 3 mil): o gestor não
  // pode ver "27 caíram" aqui e "17 vendendo 20% menos" lá, para a mesma rede no mesmo dia.
  caiu: {
    chip: "Caíram 20% ou mais",
    nota: "Só unidades que vendiam mais de R$ 3 mil no mesmo trecho do mês anterior.",
    vazio: "Nenhuma unidade caiu 20% ou mais neste mês (entre as que vendiam mais de R$ 3 mil).",
    filtro: caiu,
    ordem: (a, b) => deltaPct(a) - deltaPct(b),
  },
  vendeu: {
    chip: "Mais venderam",
    nota: "Da que mais faturou para a que menos faturou no mês.",
    vazio: "Nenhuma venda registrada neste mês.",
    filtro: (r) => num(r.rev_month) > 0,
    ordem: (a, b) => num(b.rev_month) - num(a.rev_month),
  },
  // Só vendas sem pagamento confirmado. Mensalidade vencida e verba não paga já aparecem
  // (com ação própria) no cartão "A receber das unidades" — não duplicar na lista.
  confirmar: {
    chip: "A confirmar",
    nota: "Venda registrada sem o pagamento confirmado pelo franqueado.",
    vazio: "Nenhuma venda para confirmar. Tudo em dia!",
    filtro: temPendencia,
    ordem: (a, b) => num(b.unconfirmed_count) - num(a.unconfirmed_count) || num(b.rev_month) - num(a.rev_month),
  },
};

export const ORDEM_LISTAS = ["caiu", "vendeu", "confirmar"];

export function isListaValida(k) {
  return Object.prototype.hasOwnProperty.call(LISTAS, k);
}

// #21: "A confirmar" vira "Sem confirmar há 7+ dias" quando a RPC nova está aplicada
// (unconfirmed_old_count presente nas linhas); sem ela, cai no LISTAS.confirmar de
// sempre (unconfirmed_count) — nunca mostra "0" como se fosse dado conferido.
export function temPendenciaAntiga(row) {
  return num(row?.unconfirmed_old_count) > 0;
}

function listaConfirmar(rows) {
  if (!campoPresente(rows, "unconfirmed_old_count")) return LISTAS.confirmar;
  return {
    chip: "Sem confirmar há 7+ dias",
    nota: "Venda registrada há mais de 7 dias sem o pagamento confirmado pelo franqueado.",
    vazio: "Nenhuma venda sem confirmar há mais de 7 dias. Tudo em dia!",
    filtro: temPendenciaAntiga,
    ordem: (a, b) => num(b.unconfirmed_old_count) - num(a.unconfirmed_old_count) || num(b.rev_month) - num(a.rev_month),
  };
}

// Config efetiva da lista `k` para ESTAS `rows` — só "confirmar" varia (acima).
export function cfgDaLista(rows, k) {
  const chave = isListaValida(k) ? k : "caiu";
  return chave === "confirmar" ? listaConfirmar(rows) : LISTAS[chave];
}

export function aplicarLista(rows, k) {
  const l = cfgDaLista(rows, k);
  return (Array.isArray(rows) ? rows : []).filter(l.filtro).sort(l.ordem);
}

export function contarListas(rows) {
  const out = {};
  for (const k of ORDEM_LISTAS) out[k] = (Array.isArray(rows) ? rows : []).filter(cfgDaLista(rows, k).filtro).length;
  return out;
}
