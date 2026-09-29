// "Números da unidade": vendas por semana (12 semanas), robô 7d, verba de marketing,
// clientes que voltam. Ficha da unidade (/Unidade?id=<evo>).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FaixaDias from "@/components/shared/FaixaDias";
import FaturamentoDiaSheet from "@/components/shared/FaturamentoDiaSheet";
import { CARTAO_CLICAVEL } from "@/components/shared/adminUi";
import { useFaturamentoDia } from "@/entities/faturamentoDia";
import { montarDias } from "@/lib/faturamentoDia";
import { nomeCurto } from "@/lib/networkOverview";
import { formatBRLInteger, formatPct } from "@/lib/formatters";
import { dataCurta, nomeMes, somarMeses } from "@/lib/adminFormat";
import { infoMesSeguinte, linhaDaFicha, novaNaTrilha, rotuloMesVerba, semVerba } from "@/lib/networkOverview";
import { trechoMesAnteriorLabel } from "@/components/dashboard/hoje/hojeFormat";

function Card({ titulo, children, className = "", onClick }) {
  // K2: com o faturamento por dia disponível, o cartão de vendas vira o botão do detalhe.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${CARTAO_CLICAVEL} block w-full text-left ${className}`}>
        <span className="block text-xs font-semibold text-ink-3">{titulo}</span>
        {children}
      </button>
    );
  }
  return (
    <div className={`bg-white rounded-2xl p-4 md:p-5 border border-surface-line ${className}`}>
      <div className="text-xs font-semibold text-ink-3">{titulo}</div>
      {children}
    </div>
  );
}

// Conta os zeros a partir do FIM da série (item 31, 26/09): a legenda fixa "últimas 4"
// ficava errada quando a unidade estava zerada há mais semanas (Uberlândia: 11).
function zerosDoFim(semanas) {
  let n = 0;
  for (let i = semanas.length - 1; i >= 0; i--) {
    if (Number(semanas[i]?.revenue)) break;
    n++;
  }
  return n;
}

function SalesBars({ weeks, mesAtual }) {
  const semanas = weeks || [];
  const max = Math.max(1, ...semanas.map((w) => Number(w.revenue) || 0));
  const zerosRecentes = zerosDoFim(semanas);
  const picoAntes = Math.max(0, ...semanas.slice(0, Math.max(0, semanas.length - zerosRecentes)).map((w) => Number(w.revenue) || 0));
  const ultimaSemanaVenda = zerosRecentes === 0 ? null : [...semanas].reverse().find((w) => Number(w.revenue))?.week_start || null;
  return (
    <div>
      <div className="flex items-end gap-1 h-14 mt-3" aria-hidden="true">
        {semanas.map((w, i) => {
          const alt = Number(w.revenue) || 0;
          const pctH = Math.max(3, Math.round((alt / max) * 100));
          const ehSemanaAtual = i === semanas.length - 1;
          const recente = zerosRecentes > 0 && i >= semanas.length - zerosRecentes;
          return (
            <div
              key={w.week_start || i}
              className={`flex-1 rounded-sm ${recente ? "bg-err" : "bg-stone-300"} ${ehSemanaAtual ? "opacity-50" : ""}`}
              style={{ height: `${pctH}%` }}
              title={ehSemanaAtual ? "semana atual (até hoje)" : undefined}
            />
          );
        })}
      </div>
      <div className="text-xs text-ink-3 mt-2">
        {zerosRecentes >= 5
          ? ultimaSemanaVenda
            ? `Última venda em ${dataCurta(ultimaSemanaVenda)}. Zero nas últimas ${zerosRecentes} semanas.`
            : "Nunca vendeu nas últimas 12 semanas."
          : picoAntes > 0 && zerosRecentes > 0
            ? `Vendia até ${formatBRLInteger(picoAntes)} por semana. Zero ${zerosRecentes === 1 ? "na última semana" : `nas últimas ${zerosRecentes} semanas`}.`
            : "Faturamento por semana, últimas 12 semanas (a última, até hoje)."}
      </div>
      {mesAtual && (
        <div className="text-xs text-ink-3 mt-1">
          {nomeMes(mesAtual.mes, { maiuscula: true })} até hoje: {formatBRLInteger(mesAtual.rev)}
          {mesAtual.sales != null ? ` (${mesAtual.sales} vendas)` : ""}
          {mesAtual.deltaTexto ? ` · ${mesAtual.deltaTexto}` : ""}
        </div>
      )}
    </div>
  );
}

export default function MetricsGrid({ unit }) {
  const bot = unit.bot || {};
  const marketing = unit.marketing || {};
  const customers = unit.customers || {};
  const sales = unit.sales || {};
  const row = linhaDaFicha(unit);
  // Item 31, 26/09: os 3 MESES do calendário anteriores ao atual (não os 3 últimos
  // PAGAMENTOS) — listar pagamentos escondia o mês em aberto (Uberlândia: sem agosto).
  const mesesCalendario = row?.marketing_month
    ? [somarMeses(row.marketing_month, -3), somarMeses(row.marketing_month, -2), somarMeses(row.marketing_month, -1)]
    : [];
  const meses = mesesCalendario.map((m) => ({
    month: m,
    pago: (marketing.months || []).find((p) => p?.month === m && p?.status === "confirmed"),
  }));
  const mesAtual = row?.marketing_month
    ? {
        mes: row.marketing_month,
        rev: sales.rev_mtd ?? 0,
        sales: sales.sales_mtd ?? null,
        deltaTexto: sales.rev_delta_pct != null
          ? `${formatPct(sales.rev_delta_pct, { sinal: true })} ${trechoMesAnteriorLabel(row.marketing_month)}`
          : null,
      }
    : null;
  // Mês PRINCIPAL = o do calendário (não o alvo): nos últimos 5 dias do mês, o mês
  // seguinte (alvo) é só informação secundária e NEUTRA — nunca vermelho, nunca
  // cobrando um mês que ainda nem começou (achado ALTO, 26/09: "Out: não pagou" no
  // dia 26/09, com setembro pago).
  // mesPago usa a régua única (semVerba: paga se cobriu o mês do calendário OU o
  // alvo) — antes olhava só marketing_month_paid e contradizia Hoje/Unidades/o
  // diagnóstico da própria Ficha quando o pagamento tinha ido para o mês-alvo
  // (achado MÉDIO, 26/09: unidade pagou em 27/09 e caiu em outubro).
  const pagouMes = !!row?.marketing_month_paid;
  const mesPago = !semVerba(row);
  // Pagou só o mês-alvo (não o do calendário): cobre a régua, mas o texto principal
  // não pode dizer "Set: pago" quando quem pagou foi Out — fica neutro/verde, nunca
  // vermelho (decisão 2).
  const cobertoPeloAlvo = mesPago && !pagouMes;
  const mesNome = rotuloMesVerba(row);
  const proximoMes = infoMesSeguinte(row); // só preenche nos últimos 5 dias do mês (tom sempre neutro)
  // Unidade nova (< 60 dias) na trilha: nunca vermelho por "não pagou" — tom neutro
  // (decisão 4). Sem isso, uma unidade com 5 dias de rede aparecia cobrada de verba
  // que ainda nem fazia sentido pagar.
  const nova = novaNaTrilha(row);

  // Item 42, 26/09: robô que nunca conversou aparecia "0 pessoas / metade da rede recebe
  // 70+", como se estivesse fraco — quando o problema é não estar conectado.
  const roboNuncaConversou = bot.last_conversation_date == null;

  // Faturamento por dia desta unidade (faixa no cartão de vendas + detalhe, sem a lista de
  // unidades). Sem o dado, o cartão fica como era.
  const fatDia = useFaturamentoDia(unit.franchise_id);
  const dadosDia = fatDia.data || null;
  const dias = useMemo(() => montarDias(dadosDia), [dadosDia]);
  const temFaixa = dias.length > 0;
  const [detalheAberto, setDetalheAberto] = useState(false);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        titulo="VENDAS POR SEMANA · 12 SEMANAS"
        className="col-span-2 lg:col-span-1"
        onClick={temFaixa ? () => setDetalheAberto(true) : undefined}
      >
        <SalesBars weeks={unit.sales?.weeks} mesAtual={mesAtual} />
        {temFaixa && <FaixaDias dias={dias} mes={dadosDia.mes} className="mt-3" />}
      </Card>
      {temFaixa && (
        <FaturamentoDiaSheet
          open={detalheAberto}
          onOpenChange={setDetalheAberto}
          dados={dadosDia}
          titulo={nomeCurto(unit.franchise_name)}
        />
      )}

      <Card titulo="ROBÔ · ÚLTIMOS 7 DIAS">
        {roboNuncaConversou ? (
          <>
            <div className="mt-1.5 text-sm font-semibold text-ink-3">Robô ainda não conversou com ninguém.</div>
            <Link to={`/FranchiseSettings?franchise=${unit.franchise_id}`} className="text-sm font-semibold text-brand-dark hover:underline mt-1 inline-block">
              Configurar robô →
            </Link>
          </>
        ) : (
          <>
            <div className="mt-1.5">
              <span className="font-plus-jakarta text-2xl font-extrabold text-ink">{bot.people_7d ?? 0}</span>
              <span className="text-sm font-semibold text-ink-3 ml-1.5">pessoas</span>
            </div>
            <div className="text-xs text-ink-3 mt-1">
              {bot.network_median_people_7d != null
                ? `Metade da rede recebe ${bot.network_median_people_7d} ou mais por semana.`
                : "Sem comparação da rede."}
            </div>
          </>
        )}
      </Card>

      <Card titulo="VERBA DE MARKETING">
        <div className="text-sm mt-2.5 leading-7">
          {meses.length > 0 && (
            <>
              {meses.map((m) => (
                // Item do orquestrador (26/09): unidade nova (<60 dias) não pode aparecer
                // cobrada em vermelho por meses anteriores à entrada na rede (não temos a
                // data de abertura real — só sabemos que ela é nova, decisão 4/5). Fica
                // neutro em vez de "não pagou".
                <span key={m.month} className={m.pago ? "" : nova ? "text-ink-3" : "text-err"}>
                  {nomeMes(m.month, { curto: true })} {m.pago ? formatBRLInteger(m.pago.amount || 0) : "—"}
                </span>
              )).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, " · ", el]), [])}
              <br />
            </>
          )}
          <strong className={mesPago ? "text-ok-ink" : nova ? "text-ink-3" : "text-err"}>
            {mesNome ? `${nomeMes(row.marketing_month, { curto: true })}: ` : ""}
            {cobertoPeloAlvo
              ? `coberto pelo pagamento de ${nomeMes(row.marketing_target_month, { curto: true })}`
              : mesPago
                ? "pago"
                : nova
                  ? "ainda não precisa"
                  : "ainda não pagou"}
          </strong>
          {proximoMes && !cobertoPeloAlvo && <div className="text-xs text-ink-3 mt-0.5">{proximoMes.texto}</div>}
        </div>
      </Card>

      <Card titulo="CLIENTES QUE VOLTAM" className="col-span-2 lg:col-span-1">
        {!customers.buyers ? (
          <div className="mt-1.5 text-sm font-semibold text-ink-3">Ainda sem clientes com compra registrada.</div>
        ) : (
          <>
            <div className="mt-1.5">
              <span className="font-plus-jakarta text-2xl font-extrabold text-ink">
                {customers.repeat_rate_pct != null ? formatPct(customers.repeat_rate_pct) : "—"}
              </span>
            </div>
            <div className="text-xs text-ink-3 mt-1">
              {`${customers.repeat_buyers ?? 0} de ${customers.buyers} clientes compraram 2 vezes ou mais.`}
              {customers.top_quartile_repeat_rate_pct != null && ` As que mais vendem ficam perto de ${formatPct(customers.top_quartile_repeat_rate_pct)}.`}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
