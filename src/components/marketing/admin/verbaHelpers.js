// Funções puras do painel "Verba do mês-alvo" (Marketing, admin/gerente).
// Fase 3 do redesenho do admin (~/.claude/plans/admin-redesign-2026-09-26.md).
// Sem alias "@/" (exceto o import relativo abaixo) — roda direto com
// `node src/components/marketing/admin/verbaHelpers.test.mjs`.
// Mesma régua de "sem verba do mês" e o mesmo mês (banco, nunca o relógio do aparelho) da
// home/Unidades — reusar em vez de reimplementar evita a régua nova divergir da que já existe
// (princípio 3 do plano; achado "duplicidades" 26/09 sobre o mês nomeado divergindo entre telas).
import { semVerba, semVenda, semVendaDias, caiu, deltaVendas, novaNaTrilha, mesesVerba } from "../../../lib/networkOverview.js";
import { nomeMes, diasDesde, haDias, formatPct } from "../../../lib/adminFormat.js";
import { montarMensagemFranqueado } from "../../../lib/mensagemFranqueado.js";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// Nome de mês, "há N dias" e percentual vêm de src/lib/adminFormat.js (um lugar só).

// Mês que se cobra de quem não pagou: o mais antigo em aberto entre o calendário e o
// mês-alvo (achado "duplicidades" alto 26/09 — antes cada tela nomeava um mês diferente
// para a MESMA unidade). Não pagou o mês do calendário → cobra o calendário; já pagou e
// está na janela dos 5 últimos dias → o que resta é adiantar o mês-alvo.
export function mesCobrado(row) {
  if (!row) return null;
  if (!row.marketing_month_paid) return row.marketing_month || null;
  return row.marketing_target_month || row.marketing_month || null;
}

// Por que a unidade não aparece com verba paga — igual ao "obs" do protótipo
// (Marketing.dc.html): sem venda/nova/queda, pela MESMA régua de networkOverview
// (semVenda/novaNaTrilha/caiu). Vazio quando nenhum desses casos vale (unidade saudável
// que só ainda não pagou).
export function obsNaoPagou(row) {
  if (!row) return "";
  // Nova na trilha só cai aqui com mais de 30 dias parada: aí é problema de verdade.
  if (semVenda(row)) {
    const d = semVendaDias(row);
    return d === null ? "também nunca vendeu" : `também sem venda ${haDias(d)}`;
  }
  if (novaNaTrilha(row)) {
    const idade = num(row.age_days);
    if (idade === null || idade < 14) return "nova · começando";
    // Nova agora é < 30 dias (29/09): a idade vai em dias, não em meses.
    return `nova · ${idade} dias`;
  }
  if (caiu(row)) return `vendendo ${formatPct(Math.abs(deltaVendas(row)))} menos`;
  return "";
}

function resumoPerna(overview, pagoKey, amountKey, raisedKey) {
  const pagaram = overview.filter((r) => r[pagoKey]);
  const brutoPago = pagaram.reduce((s, r) => s + (num(r[amountKey]) || 0), 0);
  const subidasCount = pagaram.filter((r) => r[raisedKey]).length;
  return { pagaramCount: pagaram.length, brutoPago, subidasCount };
}

// Monta as 4 filas acionáveis + resumo do mês a partir de:
//   overview  = linhas de get_admin_network_overview() (1 por unidade)
//   payments  = MarketingPayment.filter({ reference_month: [mesAtual, mesAlvo] }) (todos os
//               status) — as DUAS pernas que a RPC get_admin_pending_counts também usa para
//               marketing_sem_campanha/marketing_sem_comprovante, senão o painel some com a
//               unidade que pagou o mês corrente e não subiu (achado alto de 26/09)
//   pendentes = MarketingPayment.filter({ status: 'pending' }) (qualquer mês — mesma régua de
//               marketing_a_confirmar da RPC)
//   mesAtual/mesAlvo = 'YYYY-MM' (o do calendário / o mês-alvo — os DOIS vêm do banco, nunca
//               do relógio do aparelho: use mesesVerba(overview) no caller)
export function montarListasVerba({
  overview = [],
  payments = [],
  pendentes = [],
  mesAtual,
  mesAlvo,
  agora = new Date(),
} = {}) {
  const porFid = new Map(overview.map((r) => [r.franchise_id, r]));
  // Unidade de teste/inativa não está na overview — fora das filas (não a mostra por UUID/id cru)
  const soUnidadesReais = (list) => list.filter((p) => porFid.has(p.franchise_id));
  // Defesa própria (não confiar só no filtro da query do caller): só as duas pernas do mês
  const mesesValidos = new Set([mesAtual, mesAlvo].filter(Boolean));
  const pagamentos = soUnidadesReais(payments).filter((p) => mesesValidos.size === 0 || mesesValidos.has(p.reference_month));
  const pendentesReais = soUnidadesReais(pendentes);
  // Achado "medio" 26/09: só pendente do MESMO mês (corrente ou alvo) tira a unidade de
  // "Não pagaram" — pendente de mês antigo (ex.: agosto) não pode esconder quem não pagou
  // setembro (senão a régua daqui divergia do semVerba() que Hoje/Unidades/Financeiro usam).
  const pendingFids = new Set(
    pendentesReais
      .filter((p) => p.status === "pending" && (mesesValidos.size === 0 || mesesValidos.has(p.reference_month)))
      .map((p) => p.franchise_id)
  );

  // Cada pagamento numa fila só (achado "design" alto 26/09): quem tem pagamento PENDENTE
  // some de "Não pagaram" (já está em "A confirmar", não em silêncio) — sem isso a mesma
  // unidade aparecia como "pagou" e "não pagou" ao mesmo tempo na tela.
  const naoPagaramOrdenado = (list) => [...list].sort((a, b) => (num(b.row.rev_90d) || 0) - (num(a.row.rev_90d) || 0));
  const semVerbaTodas = overview.filter(semVerba).map((row) => ({
    row,
    obs: obsNaoPagou(row),
    mes: mesCobrado(row),
    aguardandoConfirmacao: pendingFids.has(row.franchise_id),
  }));
  const naoPagaram = naoPagaramOrdenado(semVerbaTodas.filter((x) => !x.aguardandoConfirmacao));
  // Fechamento pedido no achado "medio" 26/09 (total − pagaram = naoPagaram): usada na
  // CHEGADA filtrada (?filtro=sem_verba), onde "A confirmar" fica escondida — sem esta lista
  // o card "N sem verba" do Hoje/Unidades levava a uma tela com menos linhas que N.
  const naoPagaramTodas = naoPagaramOrdenado(semVerbaTodas);

  // Duas pernas possíveis por unidade (mês corrente já devia estar no ar; mês-alvo é o que o
  // formulário cobra agora): dedup por unidade, mostrando a perna mais urgente (mês mais
  // antigo entre as duas que faltam subir).
  const faltaSubir = overview
    .filter(
      (r) =>
        (r.marketing_month_paid && !r.marketing_month_raised_at) ||
        (r.marketing_target_paid && !r.marketing_target_raised_at)
    )
    .map((row) => {
      const pernas = [];
      if (row.marketing_month_paid && !row.marketing_month_raised_at) {
        pernas.push({ mes: row.marketing_month, valor: num(row.marketing_month_amount) });
      }
      if (
        row.marketing_target_paid &&
        !row.marketing_target_raised_at &&
        row.marketing_target_month !== row.marketing_month
      ) {
        pernas.push({ mes: row.marketing_target_month, valor: num(row.marketing_target_amount) });
      }
      pernas.sort((a, b) => (a.mes || "").localeCompare(b.mes || ""));
      const perna = pernas[0] || { mes: row.marketing_target_month, valor: num(row.marketing_target_amount) };
      const payment =
        pagamentos.find((p) => p.franchise_id === row.franchise_id && p.reference_month === perna.mes && p.kind !== "complemento") || null;
      // A overview soma mensal + adicional; o botão marca só o mensal, então o valor é o dele.
      const valor = num(payment?.amount) ?? perna.valor;
      return { row, payment, mes: perna.mes, valor, dias: diasDesde(payment?.created_at, agora) };
    })
    // Valor adicional do mês (kind 'complemento', 03/10/2026): item próprio na fila, porque a
    // campanha sobe por pagamento e a overview só enxerga o mês inteiro.
    .concat(
      pagamentos
        .filter((p) => p.kind === "complemento" && p.status === "confirmed" && !p.campaign_raised_at)
        .map((p) => ({ row: porFid.get(p.franchise_id), payment: p, mes: p.reference_month, valor: num(p.amount), dias: diasDesde(p.created_at, agora), adicional: true }))
    )
    .sort((a, b) => (num(a.dias) ?? 0) - (num(b.dias) ?? 0));

  // Só pagamento CONFIRMADO sem foto entra aqui — pendente sem comprovante é problema de
  // "A confirmar" (achado "design" alto 26/09: um pendente sem proof_url caía nas duas filas).
  const semComprovante = pagamentos
    .filter((p) => p.status === "confirmed" && !p.proof_url)
    .map((payment) => ({ payment, row: porFid.get(payment.franchise_id) || null }));

  // Mesma régua do contador do banco (get_admin_pending_counts.marketing_sem_comprovante:
  // status <> 'rejected' and proof_url is null) — usada só na CHEGADA filtrada
  // (?filtro=sem_comprovante), pra o "N" clicado no card do Hoje bater com a lista (achado
  // "alto" 26/09). O painel por dentro (navegação normal) continua mostrando só o confirmado
  // sem foto, que é o caso de qualidade real; o pendente sem foto já aparece em "A confirmar".
  const semComprovanteTodos = pagamentos
    .filter((p) => p.status !== "rejected" && !p.proof_url)
    .map((payment) => ({ payment, row: porFid.get(payment.franchise_id) || null, pendente: payment.status === "pending" }));

  // Do mais antigo para o mais novo — quem espera há mais tempo aparece primeiro
  // (achado "media" 26/09: a fila não dizia de quando é a espera).
  const aConfirmar = pendentesReais
    .filter((p) => p.status === "pending")
    .map((payment) => ({ payment, row: porFid.get(payment.franchise_id) || null }))
    .sort((a, b) => new Date(a.payment.created_at || 0) - new Date(b.payment.created_at || 0));

  // "Adiantar o mês-alvo" — só faz sentido nos últimos 5 dias (mesAlvo ≠ mesAtual), quando o
  // que resta fazer não é mais cobrar o mês do calendário, e sim adiantar o seguinte, que já
  // pode ser pago (achado "alto" 26/09: o painel cobrava setembro a 4 dias do fim do mês).
  // Achado "medio" 26/09: quem já mandou o pagamento do mês-alvo e está "A confirmar" NÃO
  // pode continuar aqui — senão a Maxi chama de novo pedindo um pagamento que já foi feito
  // (marketing_target_paid só vira true quando o pagamento é CONFIRMADO).
  const pendentesAlvoFids = new Set(
    pendentesReais.filter((p) => p.status === "pending" && p.reference_month === mesAlvo).map((p) => p.franchise_id)
  );
  const adiantar = mesAlvo && mesAlvo !== mesAtual
    ? overview
        .filter((r) => !r.marketing_target_paid && !pendentesAlvoFids.has(r.franchise_id))
        .sort((a, b) => (num(b.rev_90d) || 0) - (num(a.rev_90d) || 0))
    : [];

  return {
    naoPagaram,
    naoPagaramTodas,
    faltaSubir,
    semComprovante,
    semComprovanteTodos,
    aConfirmar,
    adiantar,
    // Resumo do mês do CALENDÁRIO é o principal (decisão 2 da Onda 1); `alvo` é a perna
    // secundária e NEUTRA do mês-alvo, mostrada só nos últimos 5 dias do mês.
    resumo: {
      total: overview.length,
      ...resumoPerna(overview, "marketing_month_paid", "marketing_month_amount", "marketing_month_raised_at"),
      alvo: resumoPerna(overview, "marketing_target_paid", "marketing_target_amount", "marketing_target_raised_at"),
    },
  };
}

// Reexport fino: o texto mora em src/lib/mensagemFranqueado.js (gerador único, sem emoji,
// com o primeiro nome e o nome curto da unidade). `row` = linha da overview (opcional).
export function montarMensagemVerba(mes, row = null) {
  return montarMensagemFranqueado({
    motivo: "sem_verba",
    mes,
    nome: row?.owner_name,
    franchiseName: row?.franchise_name,
  });
}

// "Pedir comprovante" (WhatsApp da fila "Pagou sem comprovante" — achado "design" alto 26/09:
// antes a fila não tinha ação nenhuma).
export function montarMensagemComprovante(mes, row = null) {
  return montarMensagemFranqueado({
    motivo: "pedir_comprovante",
    mes,
    nome: row?.owner_name,
    franchiseName: row?.franchise_name,
  });
}

// "Adiantar outubro" — tom neutro (a verba já pode ser paga, não está atrasada). Usado no
// bloco "Adiantar outubro" e na fila "Não pagaram" quando a janela dos últimos 5 dias está
// ativa (achado "alto" 26/09: cobrar o mês do calendário no dia 26 não gera anúncio útil).
export function montarMensagemAdiantar(mesAlvo, row = null) {
  return montarMensagemFranqueado({
    motivo: "verba_adiantar",
    mes: mesAlvo,
    nome: row?.owner_name,
    franchiseName: row?.franchise_name,
  });
}

// "Outubro já abriu: 12 de 66 pagaram até agora →" — link neutro do resumo, só nos últimos 5
// dias do mês (achado "design" alto 26/09: o painel não pode zerar nem sumir com o mês no ar).
export function textoMesSeguinte(mesAlvo, resumoAlvo, total) {
  const mes = nomeMes(mesAlvo, { maiuscula: true });
  if (!mes || !resumoAlvo) return "";
  return `${mes} já abriu: ${resumoAlvo.pagaramCount} de ${total} pagaram até agora →`;
}

export { mesesVerba };

export const FILTRO_LABELS = {
  sem_verba: "Não pagaram a verba",
  sem_campanha: "Pagou e a campanha não subiu",
  sem_comprovante: "Pagou sem comprovante",
  a_confirmar: "Verba esperando confirmação",
};
