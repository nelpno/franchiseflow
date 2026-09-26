// "Rotina": usa o Quem chamar hoje?, último pedido à fábrica, mensalidade do sistema.
// Ficha da unidade (/Unidade?id=<evo>).
import { Link, useLocation } from "react-router-dom";
import { formatBRLInteger } from "@/lib/formatters";
import { dataCurta, haDias } from "@/lib/adminFormat";
import { linhaDaFicha, mensalidadeVencida, nomeCurto } from "@/lib/networkOverview";

// Soma os pedidos feitos no MESMO dia (BRT) do "último pedido" — dois pedidos de 02/06 não
// podem virar "R$ 148" quando juntos são R$ 1.879 (achado 26/09, Uberlândia).
function pedidoDoMesmoDia(po) {
  if (!po?.last) return null;
  const diaDoUltimo = dataCurta(po.last.ordered_at);
  const doMesmoDia = (po.recent || []).filter((o) => dataCurta(o?.ordered_at) === diaDoUltimo);
  const total = doMesmoDia.reduce((s, o) => s + (Number(o?.total_amount) || 0), 0) || po.last.total_amount || 0;
  return { data: diaDoUltimo, n: doMesmoDia.length || 1, total };
}

function Card({ titulo, valor, valorTom, detalhe, link }) {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 border border-surface-line flex flex-col gap-1">
      <div className="text-xs font-semibold text-ink-3">{titulo}</div>
      <div className={`text-base font-semibold mt-1 ${valorTom || "text-ink"}`}>{valor}</div>
      {detalhe && <div className="text-sm text-ink-3">{detalhe}</div>}
      {link && (
        <Link to={link.href} state={link.state} className="text-sm font-medium text-brand-dark hover:underline mt-0.5">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

export default function RoutineGrid({ unit, podeVerFinanceiro = true }) {
  const location = useLocation();
  const da = unit.daily_actions || {};
  const po = unit.purchase_orders || {};
  const sub = unit.subscription || {};
  const evo = unit.franchise_id;
  const semCobranca = !unit.subscription;
  // Decisão 7: telas que sabem voltar pra ficha (AsaasSetupPanel, FinanceiroPorUnidade)
  // só mostram "← Voltar para a ficha de X" quando location.state.from casa com
  // /Unidade — sem isso o botão de volta nunca aparecia pra quem clicava aqui
  // (achado MÉDIO, 26/09).
  const stateFicha = { from: location.pathname + location.search, label: `a ficha de ${nomeCurto(unit.franchise_name)}` };

  // Distingue quem nunca usou de quem usou há pouco (item 42, 26/09): "Nenhuma mensagem em 7
  // dias" era igual para os dois casos, mesmo a RPC trazendo last_sent_date.
  const usaQuemChamar = (da.sent_7d ?? 0) > 0
    ? `${da.sent_7d} mensagem${da.sent_7d === 1 ? "" : "s"} nos últimos 7 dias`
    : da.last_sent_date
      ? `Última vez em ${dataCurta(da.last_sent_date)}`
      : "Nunca usou";
  const usaDetalhe = da.top_quartile_units && da.top_quartile_using
    ? `Entre as que mais vendem, ${da.top_quartile_using} em cada ${da.top_quartile_units} usam.`
    : null;

  const pd = pedidoDoMesmoDia(po);
  const pedidoValor = pd
    ? `${pd.data || "—"} · ${pd.n > 1 ? `${pd.n} pedidos · ` : ""}${formatBRLInteger(pd.total)}${po.days_since_last != null ? ` · ${haDias(po.days_since_last)}` : ""}`
    : "Nenhum pedido registrado";

  // MESMA régua da lista (mensalidadeVencida, networkOverview.js — decisão 1): só a
  // cobrança ATUAL OVERDUE. Antes a Rotina calculava sozinha (payment_status OVERDUE
  // OU subscription_status OVERDUE OU vencimento passado) e podia divergir do que
  // Hoje/Financeiro/o diagnóstico da própria Ficha diziam pra mesma unidade.
  const cancelada = sub.payment_status === "CANCELLED" || sub.subscription_status === "CANCELLED";
  const vencida = !cancelada && mensalidadeVencida(linhaDaFicha(unit));
  // Item 6, 26/09: unidade sem NENHUMA cobrança gerada (payment_status e due_date nulos,
  // caso Lapa de Baixo) aparecia "Em dia" em verde — regra E5, ausência de dado não é zero.
  const semPagamentoGerado = !cancelada && !vencida && !sub.payment_status && !sub.due_date;
  const mensalidadeValor = semCobranca
    ? "Sem cobrança criada"
    : cancelada
      ? "Cobrança cancelada"
      : vencida
        ? `Vencida${sub.due_date ? ` desde ${dataCurta(sub.due_date)}` : ""}`
        : semPagamentoGerado
          ? "Primeira cobrança ainda não gerada"
          : "Em dia";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card titulo='USA O "QUEM CHAMAR HOJE"?' valor={usaQuemChamar} detalhe={usaDetalhe} />
      <Card
        titulo="ÚLTIMO PEDIDO À FÁBRICA"
        valor={pedidoValor}
        link={podeVerFinanceiro ? { href: `/PurchaseOrders?unidade=${evo}`, label: "Ver pedidos da unidade", state: stateFicha } : null}
      />
      <Card
        titulo="MENSALIDADE DO SISTEMA"
        valor={mensalidadeValor}
        valorTom={semCobranca || vencida ? "text-err" : cancelada || semPagamentoGerado ? "text-ink-3" : "text-ok-ink"}
        link={podeVerFinanceiro
          ? semPagamentoGerado
            ? { href: `/Financeiro?tab=mensalidades&franchise=${evo}`, label: "Gerar cobrança", state: stateFicha }
            : { href: `/Financeiro?tab=mensalidades&franchise=${evo}`, label: "Ver cobrança", state: stateFicha }
          : null}
      />
    </div>
  );
}
