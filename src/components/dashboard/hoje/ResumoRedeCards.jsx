import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLMil, formatPct1, formatPontos, mesAtualLabel, trechoMesAnteriorLabel, nomeMesAnterior } from "./hojeFormat";

function Cartao({ children }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-ink-shadow/5 shadow-sm flex flex-col gap-2 min-w-0">
      {children}
    </div>
  );
}

function Rotulo({ children }) {
  return <p className="text-[13px] font-bold text-ink-2 tracking-wide">{children}</p>;
}

function Valor({ children }) {
  return (
    <p className="font-plus-jakarta text-[28px] md:text-[32px] font-extrabold text-ink tracking-tight tabular-nums truncate">
      {children}
    </p>
  );
}

// 3 cartões do topo de "Hoje": faturamento, unidades ativas em 7d, conversão robô→compra.
// resumo = resumoRede(overview) de src/lib/networkOverview.js (fonte única com "Unidades").
export default function ResumoRedeCards({ resumo, funil }) {
  const trechoAnterior = trechoMesAnteriorLabel();

  return (
    <section aria-label="Como está a rede" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Cartao>
        <Rotulo>FATURAMENTO DA REDE · {mesAtualLabel()}</Rotulo>
        <Valor>{formatBRLMil(resumo.receitaMes)}</Valor>
        {resumo.deltaPct !== null ? (
          <p className={`text-sm ${resumo.deltaPct >= 0 ? "text-ok-ink" : "text-warn-ink"}`}>
            {resumo.deltaPct >= 0 ? "+" : ""}
            {formatPct1(resumo.deltaPct)} {trechoAnterior} ({formatBRLMil(resumo.receitaAnterior)})
          </p>
        ) : (
          <p className="text-sm text-ink-3">Sem base de comparação ainda</p>
        )}
      </Cartao>

      <Cartao>
        <Rotulo>UNIDADES QUE VENDERAM NOS ÚLTIMOS 7 DIAS</Rotulo>
        <Valor>
          {resumo.venderam7d} <span className="text-lg md:text-xl text-ink-3 font-semibold">de {resumo.total}</span>
        </Valor>
        <p className="text-sm text-ink-2">
          No mês: {resumo.abaixo} abaixo, {resumo.acima} acima de {nomeMesAnterior()}
        </p>
      </Cartao>

      <Cartao>
        <Rotulo>QUEM FALA COM O ROBÔ E COMPRA · {mesAtualLabel()}</Rotulo>
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
            <Valor>{formatPct1(funil.pct)}</Valor>
            {funil.prevPct !== null ? (
              <p className={`text-sm ${funil.pct - funil.prevPct >= 0 ? "text-ok-ink" : "text-warn-ink"}`}>
                {formatPontos(funil.pct - funil.prevPct)} contra {nomeMesAnterior()} ({formatPct1(funil.prevPct)})
              </p>
            ) : (
              <p className="text-sm text-ink-3">Sem base de comparação ainda</p>
            )}
          </>
        )}
      </Cartao>
    </section>
  );
}
