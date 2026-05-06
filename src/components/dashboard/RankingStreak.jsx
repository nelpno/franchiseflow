import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

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

  const streak = useMemo(() => {
    if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;
    const franchiseDays = summaries
      .filter((s) => s.franchise_id === franchiseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    let count = 0;
    for (const day of franchiseDays) {
      if ((parseFloat(day.sales_value) || 0) >= dailyGoal) count++;
      else break;
    }
    return count;
  }, [summaries, franchiseId, dailyGoal]);

  const showDailyAsPrimary = period === "today";
  const hasDaily = ranking?.position && ranking?.total_franchises;
  const hasMonthly = monthlyRanking?.rank_position && monthlyRanking?.total_franchises;

  const delta = useMemo(() => {
    if (!hasMonthly || !monthlyRanking?.prev_rank_position) return null;
    const diff = monthlyRanking.prev_rank_position - monthlyRanking.rank_position;
    if (diff > 0) return { type: "up", value: diff };
    if (diff < 0) return { type: "down", value: Math.abs(diff) };
    return { type: "same", value: 0 };
  }, [hasMonthly, monthlyRanking]);

  return (
    <section className="grid grid-cols-2 gap-4 mb-6">
      <div className="flex items-start gap-3 bg-[#fbf9fa]/50 p-4 rounded-xl">
        <MaterialIcon
          icon="military_tech"
          filled
          size={20}
          className="text-[#d4af37] flex-shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          {showDailyAsPrimary && hasDaily ? (
            <>
              <span className="text-xs font-semibold text-[#1d1b1b]">
                {ranking.position}º de {ranking.total_franchises} hoje
              </span>
              {hasMonthly && monthLabel && (
                <span className="text-[11px] text-[#4a3d3d]/80 font-medium">
                  {monthlyRanking.rank_position}º em {monthLabel}
                </span>
              )}
            </>
          ) : hasMonthly ? (
            <>
              <span className="text-xs font-semibold text-[#1d1b1b]">
                {monthlyRanking.rank_position}º de {monthlyRanking.total_franchises} em {monthLabel}
              </span>
              {delta && (
                <span
                  className={`text-[11px] font-semibold ${
                    delta.type === "up"
                      ? "text-emerald-700"
                      : delta.type === "down"
                      ? "text-red-700"
                      : "text-[#4a3d3d]/70"
                  }`}
                >
                  {delta.type === "up" && `↑ subiu ${delta.value} posiç${delta.value === 1 ? "ão" : "ões"}`}
                  {delta.type === "down" && `↓ caiu ${delta.value} posiç${delta.value === 1 ? "ão" : "ões"}`}
                  {delta.type === "same" && "→ mantém posição"}
                </span>
              )}
              {isCurrentMonth && showDailyAsPrimary && !hasDaily && (
                <span className="text-[11px] text-[#4a3d3d]/80 font-medium">
                  Sem vendas hoje
                </span>
              )}
              {isCurrentMonth && !showDailyAsPrimary && hasDaily && (
                <span className="text-[11px] text-[#4a3d3d]/80 font-medium">
                  {ranking.position}º hoje
                </span>
              )}
            </>
          ) : (
            <button
              onClick={() => navigate("/Vendas?action=nova-venda")}
              className="text-xs font-semibold text-[#b91c1c] hover:underline cursor-pointer text-left"
            >
              {isCurrentMonth ? "Registre sua primeira venda →" : `Sem vendas em ${monthLabel}`}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-[#fbf9fa]/50 p-4 rounded-xl">
        <MaterialIcon
          icon="local_fire_department"
          filled
          size={20}
          className={`flex-shrink-0 ${streak > 0 ? "text-[#b91c1c]" : "text-[#cac0c0]"}`}
        />
        <span className="text-xs font-semibold text-[#1d1b1b]">
          {streak > 0
            ? `${streak} ${streak === 1 ? "dia" : "dias"} batendo meta`
            : "Bata a meta e inicie sua sequência!"}
        </span>
      </div>
    </section>
  );
}
