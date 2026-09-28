// S18.1 — 4º bloco da Início nova (chave ui_v2): faturamento dos últimos 6 meses, pelas
// VENDAS (montarEvolucao em src/lib/inicioMes.js), nunca por daily_summaries.
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLCompact, formatBRLInteger } from "@/lib/formatters";
import { CARTAO, H3_CARTAO } from "@/components/shared/adminUi";

export default function InicioEvolucao({ meses, status, mediana, nomeMes }) {
  if (status === "loading") {
    return (
      <section className={CARTAO} aria-label="Evolução">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      </section>
    );
  }
  if (!meses?.length || !meses.some((m) => m.valor > 0)) return null;

  const maior = Math.max(...meses.map((m) => m.valor), 1);

  return (
    <section className={CARTAO} aria-label="Evolução">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={H3_CARTAO}>Evolução</h2>
        <span className="text-xs text-ink-3">faturamento por mês, em R$</span>
      </div>
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
        {meses.map((m) => {
          const altura = Math.max(4, Math.round((m.valor / maior) * 88));
          return (
            <div key={m.chave} className="flex min-w-0 flex-col items-center gap-1" title={formatBRLInteger(m.valor)}>
              <div className="flex h-[112px] w-full flex-col items-center justify-end gap-1">
                <span className={`text-[11px] tabular-nums ${m.atual ? "font-bold text-brand" : "text-ink-3"}`}>
                  {m.valor > 0 ? formatBRLCompact(m.valor).replace("R$ ", "") : "—"}
                </span>
                <div
                  className={`w-full max-w-[44px] rounded-t-lg ${m.atual ? "bg-brand" : "bg-brand/15"}`}
                  style={{ height: altura }}
                />
              </div>
              <span className={`text-xs capitalize ${m.atual ? "font-bold text-ink" : "text-ink-2"}`}>{m.rotulo}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {nomeMes ? `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} vai até hoje.` : "O mês atual vai até hoje."}
        {mediana !== null && mediana !== undefined && ` Sua mediana dos 3 meses anteriores: ${formatBRLInteger(mediana)}.`}
        {status === "erro" && " Os meses mais antigos não carregaram agora."}
      </p>
    </section>
  );
}
