import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { deltaRanking, diasSeguidosBatendoMeta, hojeBrasilia } from "@/lib/inicioMes";

export default function RankingStreak({
  ranking,
  monthlyRanking,
  period = "today",
  monthLabel,
  isCurrentMonth = true,
  summaries,
  franchiseId,
  dailyGoal,
}) {
  const navigate = useNavigate();

  // S18 (28/09/2026, vale com a chave ligada ou não): cada dia passado contra a meta DAQUELE
  // dia (média dos 30 dias anteriores a ele + 10%). Antes todos os dias eram comparados com a
  // meta de HOJE — um dia forte ontem zerava a sequência; uma semana fraca a inflava.
  // Regra e testes: src/lib/inicioMes.js (diasSeguidosBatendoMeta).
  const streak = useMemo(() => {
    if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;
    return diasSeguidosBatendoMeta(summaries, { hoje: hojeBrasilia().str, franchiseId }).dias;
  }, [summaries, franchiseId, dailyGoal]);

  const showDailyAsPrimary = period === "today";
  const hasDaily = ranking?.position && ranking?.total_franchises;
  const hasMonthly = monthlyRanking?.rank_position && monthlyRanking?.total_franchises;

  const delta = useMemo(() => deltaRanking(monthlyRanking), [monthlyRanking]);

  return (
    <section className="grid grid-cols-2 gap-4 mb-6">
      <div className="flex items-start gap-3 bg-surface/50 p-4 rounded-xl">
        <MaterialIcon
          icon="military_tech"
          filled
          size={20}
          className="text-brand-gold flex-shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          {showDailyAsPrimary && hasDaily ? (
            <>
              <span className="text-xs font-semibold text-ink">
                {ranking.position}º de {ranking.total_franchises} hoje
              </span>
              {hasMonthly && monthLabel && (
                <span className="text-[11px] text-ink-2/80 font-medium">
                  {monthlyRanking.rank_position}º em {monthLabel}
                </span>
              )}
            </>
          ) : hasMonthly ? (
            <>
              <span className="text-xs font-semibold text-ink">
                {monthlyRanking.rank_position}º de {monthlyRanking.total_franchises} em {monthLabel}
              </span>
              {delta && (
                <span
                  className={`text-[11px] font-semibold ${
                    delta.type === "up"
                      ? "text-emerald-700"
                      : delta.type === "down"
                      ? "text-red-700"
                      : "text-ink-2/70"
                  }`}
                >
                  {delta.type === "up" && `↑ subiu ${delta.value} posiç${delta.value === 1 ? "ão" : "ões"}`}
                  {delta.type === "down" && `↓ caiu ${delta.value} posiç${delta.value === 1 ? "ão" : "ões"}`}
                  {delta.type === "same" && "→ mantém posição"}
                </span>
              )}
              {isCurrentMonth && showDailyAsPrimary && !hasDaily && (
                <span className="text-[11px] text-ink-2/80 font-medium">
                  Sem vendas hoje
                </span>
              )}
              {isCurrentMonth && !showDailyAsPrimary && hasDaily && (
                <span className="text-[11px] text-ink-2/80 font-medium">
                  {ranking.position}º hoje
                </span>
              )}
            </>
          ) : (
            <button
              onClick={() => navigate("/Vendas?action=nova-venda")}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer text-left"
            >
              {isCurrentMonth ? "Registre sua primeira venda →" : `Sem vendas em ${monthLabel}`}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-surface/50 p-4 rounded-xl">
        <MaterialIcon
          icon="local_fire_department"
          filled
          size={20}
          className={`flex-shrink-0 ${streak > 0 ? "text-brand" : "text-ink-4"}`}
        />
        <span className="text-xs font-semibold text-ink">
          {streak > 0
            ? `${streak} ${streak === 1 ? "dia" : "dias"} batendo meta`
            : "Bata a meta e inicie sua sequência!"}
        </span>
      </div>
    </section>
  );
}
