import React, { useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function RankingStreak({ ranking, summaries, franchiseId, dailyGoal }) {
  const streak = useMemo(() => {
    if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;

    const franchiseDays = summaries
      .filter((s) => s.franchise_id === franchiseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let count = 0;
    for (const day of franchiseDays) {
      if ((day.sales_value || 0) >= dailyGoal) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [summaries, franchiseId, dailyGoal]);

  return (
    <section className="grid grid-cols-2 gap-4 mb-6">
      <div className="flex items-center gap-3 bg-[#f5f3f4]/50 p-4 rounded-xl">
        <MaterialIcon icon="military_tech" filled size={20} className="text-[#d4af37] flex-shrink-0" />
        {ranking?.position ? (
          <span className="text-xs font-semibold text-[#1d1b1b]">
            {ranking.position}º de {ranking.total_franchises} franquias
          </span>
        ) : (
          <span className="text-xs font-semibold text-[#4a3d3d]">Ranking aparece após sua primeira venda</span>
        )}
      </div>

      <div className="flex items-center gap-3 bg-[#f5f3f4]/50 p-4 rounded-xl">
        <MaterialIcon icon="local_fire_department" filled size={20} className={`flex-shrink-0 ${streak > 0 ? "text-[#b91c1c]" : "text-[#cac0c0]"}`} />
        <span className="text-xs font-semibold text-[#1d1b1b]">
          {streak > 0
            ? `${streak} ${streak === 1 ? "dia" : "dias"} batendo meta`
            : "Bata a meta e inicie sua sequência!"}
        </span>
      </div>
    </section>
  );
}
