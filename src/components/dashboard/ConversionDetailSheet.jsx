import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { getNetworkFunnelBenchmark } from "@/entities/all";

const pct = (n) => `${Number(n).toFixed(1).replace(".", ",")}%`;
const dec = (n) => Number(n).toFixed(2).replace(".", ",");

function Row({ label, hint, value, sub }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-[#291715]/5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1d1b1b]">{label}</p>
        {hint && <p className="text-xs text-[#7a6d6d] leading-tight mt-0.5">{hint}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-[#1d1b1b] tabular-nums">{value}</p>
        {sub && <p className="text-xs text-[#7a6d6d] tabular-nums">{sub}</p>}
      </div>
    </div>
  );
}

export default function ConversionDetailSheet({ open, onOpenChange, funnel, range, label }) {
  const [benchmark, setBenchmark] = useState(null);
  const fetchedForRef = useRef(null);

  // Benchmark da rede custa ~230ms (varre todas as franquias) — por isso só carrega
  // quando o detalhe abre, e uma vez por período.
  useEffect(() => {
    if (!open || !range?.start || !range?.end) return;
    const key = `${range.start}|${range.end}`;
    if (fetchedForRef.current === key) return;
    fetchedForRef.current = key;
    const controller = new AbortController();
    let alive = true;
    getNetworkFunnelBenchmark(range.start, range.end, { signal: controller.signal })
      .then((b) => { if (alive) setBenchmark(b); })
      .catch(() => { /* silencioso: comparativo é opcional, não trava o detalhe */ });
    return () => { alive = false; controller.abort(); };
  }, [open, range?.start, range?.end]);

  const reached = Number(funnel?.reached) || 0;
  const converted = Number(funnel?.converted) || 0;
  const newReached = Number(funnel?.new_reached) || 0;
  const newConverted = Number(funnel?.new_converted) || 0;
  const retReached = Number(funnel?.returning_reached) || 0;
  const retConverted = Number(funnel?.returning_converted) || 0;
  const customers = Number(funnel?.customers) || 0;
  const repeatCustomers = Number(funnel?.repeat_customers) || 0;
  const ppc = funnel?.purchases_per_customer;
  const prevReached = Number(funnel?.prev_reached) || 0;
  const prevConverted = Number(funnel?.prev_converted) || 0;

  const rate = reached > 0 ? (converted / reached) * 100 : 0;
  const prevRate = prevReached > 0 ? (prevConverted / prevReached) * 100 : null;
  const deltaPP = prevRate != null ? rate - prevRate : null;
  const hasBot = !!funnel?.has_bot_data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-t-2xl sm:bottom-8 sm:rounded-2xl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-semibold flex items-center gap-2">
            <MaterialIcon icon="groups" className="text-[#b91c1c]" />
            Seus contatos {label ? `· ${label}` : ""}
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-600">
            Quantas pessoas falaram com a sua unidade e quantas compraram.
          </SheetDescription>
        </SheetHeader>

        {!hasBot ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-sm text-[#4a3d3d] bg-[#f5f3f0] border border-[#291715]/10 rounded-lg px-3 py-3">
              <MaterialIcon icon="smart_toy" style={{ fontSize: 20 }} className="text-[#7a6d6d] shrink-0" />
              <div>
                <p className="font-medium text-[#1d1b1b] mb-1">Ainda não dá para medir sua conversão</p>
                <p className="leading-snug">
                  Essa conta usa as conversas do robô para saber quantas pessoas chegaram até você.
                  Sem o robô ativo, só aparecem os clientes que você mesma cadastrou ao lançar a venda —
                  e aí o número seria sempre 100%, o que não ajuda em nada.
                </p>
              </div>
            </div>
            {customers > 0 && (
              <div className="bg-white rounded-lg border border-[#291715]/10 px-3">
                <Row
                  label="Clientes que compraram no período"
                  value={customers}
                  sub={ppc ? `${dec(ppc)} compras cada` : null}
                />
                <Row
                  label="Compraram mais de uma vez"
                  value={repeatCustomers}
                  sub={customers > 0 ? pct((repeatCustomers / customers) * 100) : null}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <section>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold tracking-tight text-[#1d1b1b] tabular-nums">
                  {pct(rate)}
                </span>
                {deltaPP != null && Math.abs(deltaPP) >= 0.1 && (
                  <span className={`text-sm font-bold flex items-center gap-0.5 ${deltaPP > 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                    <MaterialIcon icon={deltaPP > 0 ? "arrow_upward" : "arrow_downward"} size={16} />
                    {Math.abs(deltaPP).toFixed(1).replace(".", ",")} p.p.
                  </span>
                )}
              </div>
              <p className="text-sm text-[#4a3d3d]">
                <strong className="text-[#1d1b1b] tabular-nums">{converted}</strong> das{" "}
                <strong className="text-[#1d1b1b] tabular-nums">{reached}</strong> pessoas que falaram com você compraram.
              </p>

              <div className="mt-3 bg-white rounded-lg border border-[#291715]/10 px-3">
                <Row
                  label="Chegaram agora"
                  hint="Primeira vez que falaram com você"
                  value={newReached > 0 ? pct((newConverted / newReached) * 100) : "—"}
                  sub={`${newConverted} de ${newReached}`}
                />
                <Row
                  label="Já conheciam"
                  hint="Já tinham falado com você antes"
                  value={retReached > 0 ? pct((retConverted / retReached) * 100) : "—"}
                  sub={`${retConverted} de ${retReached}`}
                />
                {prevReached > 0 && (
                  <Row
                    label="Período anterior"
                    value={pct(prevRate)}
                    sub={`${prevConverted} de ${prevReached}`}
                  />
                )}
                {benchmark?.network_conversion_pct != null && (
                  <Row
                    label="Média da rede"
                    hint="Todas as unidades juntas"
                    value={pct(benchmark.network_conversion_pct)}
                  />
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-[#1d1b1b] mb-1 flex items-center gap-1.5">
                <MaterialIcon icon="replay" size={18} className="text-[#b91c1c]" />
                Voltaram a comprar
              </h3>
              <p className="text-sm text-[#4a3d3d]">
                <strong className="text-[#1d1b1b] tabular-nums">{repeatCustomers}</strong> dos{" "}
                <strong className="text-[#1d1b1b] tabular-nums">{customers}</strong> clientes compraram mais de uma vez no período.
              </p>

              <div className="mt-3 bg-white rounded-lg border border-[#291715]/10 px-3">
                <Row
                  label="Compras por cliente"
                  value={ppc ? dec(ppc) : "—"}
                  sub={benchmark?.network_purchases_per_customer != null ? `rede: ${dec(benchmark.network_purchases_per_customer)}` : null}
                />
              </div>

              <p className="text-xs text-[#7a6d6d] leading-snug mt-2">
                Quem gosta costuma voltar em cerca de duas semanas. Cliente que passa um mês sem comprar
                dificilmente volta sozinho — vale uma mensagem antes disso.
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
