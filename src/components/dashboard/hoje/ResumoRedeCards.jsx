import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLInteger, formatPct } from "@/lib/formatters";
import { formatPontos, mesAtualLabel, trechoMesAnteriorLabel } from "./hojeFormat";
import { CARTAO, CARTAO_CLICAVEL } from "@/components/shared/adminUi";
import FaixaDias from "@/components/shared/FaixaDias";
import FaturamentoDiaSheet from "@/components/shared/FaturamentoDiaSheet";
import { montarDias } from "@/lib/faturamentoDia";

// K9: 1º cartão (o faturamento) ocupa as 2 colunas no celular; os outros dois ficam
// lado a lado. No desktop os 3 dividem a linha igualmente.
function Cartao({ destaque, children, onClick }) {
  const cls = `flex min-w-0 flex-col gap-2 ${destaque ? "col-span-2 md:col-span-1" : ""}`;
  // K2: com o detalhe por dia disponível, o cartão inteiro vira o botão que o abre.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${CARTAO_CLICAVEL} ${cls} w-full text-left`}>
        {children}
      </button>
    );
  }
  return <div className={`${CARTAO} ${cls}`}>{children}</div>;
}

// K6: rótulo em 1 linha no celular — por isso os textos curtos abaixo (achado médio
// 26/09: "UNIDADES QUE VENDERAM NOS ÚLTIMOS 7 DIAS" quebrava em 2 linhas no celular).
function Rotulo({ children }) {
  return <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-ink-3">{children}</p>;
}

function Valor({ children }) {
  return (
    <p className="font-plus-jakarta text-2xl font-extrabold tabular-nums tracking-tight text-ink sm:text-3xl truncate">
      {children}
    </p>
  );
}

// 3 cartões do topo de "Hoje": faturamento, unidades ativas em 7d, conversão robô→compra.
// resumo = resumoRede(overview) de src/lib/networkOverview.js (fonte única com "Unidades").
// mes = 'YYYY-MM' do banco (mesesVerba(overview).mes), nunca o relógio do aparelho.
// fatDia = useFaturamentoDia() da AdminHoje ({ data, isLoading, error }): faixa de dias no
// cartão de faturamento + detalhe. Sem o dado (erro ou função ainda não aplicada) o cartão
// fica como era, sem faixa e sem clique.
export default function ResumoRedeCards({ resumo, funil, mes, fatDia }) {
  const trechoAnterior = trechoMesAnteriorLabel(mes);
  const semVenda7d = resumo.total - resumo.venderam7d;
  const [detalheAberto, setDetalheAberto] = useState(false);
  const dadosDia = fatDia?.data || null;
  const dias = useMemo(() => montarDias(dadosDia), [dadosDia]);
  const temFaixa = dias.length > 0;

  return (
    <section aria-label="Como está a rede" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      <Cartao
        destaque
        onClick={temFaixa ? () => setDetalheAberto(true) : undefined}
      >
        <Rotulo>REDE · {mesAtualLabel(mes)}</Rotulo>
        <Valor>{formatBRLInteger(resumo.receitaMes)}</Valor>
        {resumo.deltaPct !== null ? (
          <p className={`text-sm ${resumo.deltaPct >= 0 ? "text-ok-ink" : "text-warn-ink"}`}>
            <span className="font-semibold">{formatPct(resumo.deltaPct, { sinal: true })}</span>{" "}
            <span className="text-ink-2">
              {trechoAnterior} ({formatBRLInteger(resumo.receitaAnterior)})
            </span>
          </p>
        ) : (
          <p className="text-sm text-ink-3">Sem base de comparação ainda</p>
        )}
        {temFaixa ? (
          <FaixaDias dias={dias} mes={dadosDia.mes} />
        ) : fatDia?.isLoading ? (
          <Skeleton className="h-9 w-full rounded-md motion-reduce:animate-none" />
        ) : null}
      </Cartao>

      <Cartao>
        <Rotulo>VENDERAM EM 7 DIAS</Rotulo>
        <Valor>
          {resumo.venderam7d} <span className="text-lg text-ink-3 font-semibold md:text-xl">de {resumo.total}</span>
        </Valor>
        {/* Item 18: era um 2º número (abaixo/acima de agosto, sem piso) para a mesma
            pergunta que "sem venda 7+ dias" já responde, e não levava a ação nenhuma. */}
        {semVenda7d > 0 ? (
          <Link to="/Unidades?filtro=sem_venda" state={{ from: "hoje" }} className="text-sm font-semibold text-err hover:underline">
            {semVenda7d} sem venda há 7+ dias →
          </Link>
        ) : (
          <p className="text-sm text-ink-3">Todas venderam nos últimos 7 dias</p>
        )}
      </Cartao>

      <Cartao>
        <Rotulo>ROBÔ → COMPRA</Rotulo>
        {funil.isLoading ? (
          <Skeleton className="h-9 w-24 rounded-lg" />
        ) : funil.error ? (
          <p className="text-sm text-ink-3 flex items-center gap-1.5">
            <MaterialIcon icon="cloud_off" size={16} />
            Indisponível agora
          </p>
        ) : funil.pct === null ? (
          <p className="text-sm text-ink-3">Sem dado suficiente ainda</p>
        ) : (
          <>
            <Valor>{formatPct(funil.pct)}</Valor>
            {funil.prevPct !== null ? (
              <p className={`text-sm ${funil.pct - funil.prevPct >= 0 ? "text-ok-ink" : "text-warn-ink"}`}>
                <span className="font-semibold">{formatPontos(funil.pct - funil.prevPct)}</span>{" "}
                <span className="text-ink-2">
                  {trechoAnterior} ({formatPct(funil.prevPct)})
                  {/* network_reached (item 40): coluna nova, ainda não aplicada — o texto
                      "· N pessoas" só aparece depois do SQL admin-12 ir para o ar. */}
                  {funil.pessoas != null ? ` · ${funil.pessoas.toLocaleString("pt-BR")} pessoas` : ""}
                </span>
              </p>
            ) : (
              <p className="text-sm text-ink-3">Sem base de comparação ainda</p>
            )}
          </>
        )}
      </Cartao>

      {temFaixa && (
        <FaturamentoDiaSheet open={detalheAberto} onOpenChange={setDetalheAberto} dados={dadosDia} mostrarUnidades />
      )}
    </section>
  );
}
