import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";

function FranchiseRanking({ franchises, summaries, todaySales = [], period = "today", isLoading }) {
  // Map evoId → franchise for ID resolution (daily_summaries + sales use evo_id)
  const evoMap = useMemo(() => {
    const map = {};
    franchises.forEach((f) => {
      if (f.evolution_instance_id) {
        map[f.evolution_instance_id] = f;
      }
    });
    return map;
  }, [franchises]);

  const rankedFranchises = useMemo(() => {
    const revenueByEvo = {};

    // Initialize all franchises with 0
    franchises.forEach((f) => {
      if (f.evolution_instance_id) {
        revenueByEvo[f.evolution_instance_id] = 0;
      }
    });

    if (period === "today") {
      // Use LIVE todaySales data (not daily_summaries which doesn't exist for today)
      todaySales.forEach((s) => {
        const evoId = s.franchise_id;
        if (evoId in revenueByEvo) {
          revenueByEvo[evoId] += (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0);
        }
      });
    } else {
      const days = period === "7d" ? 7 : 30;
      const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");

      // Summaries for past days (today's summary doesn't exist until 02:00 BRT)
      summaries.forEach((s) => {
        if (s.date >= cutoff && s.date < todayStr) {
          const evoId = s.franchise_id;
          if (evoId in revenueByEvo) {
            revenueByEvo[evoId] += s.sales_value || 0;
          }
        }
      });

      // Merge live todaySales for today's contribution
      todaySales.forEach((s) => {
        const evoId = s.franchise_id;
        if (evoId in revenueByEvo) {
          revenueByEvo[evoId] += (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0);
        }
      });
    }

    // Build ranked list
    return Object.entries(revenueByEvo)
      .map(([evoId, revenue]) => {
        const f = evoMap[evoId];
        return {
          id: f?.id || evoId,
          name: f ? (f.city || f.name || f.owner_name || "Franquia") : evoId,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [franchises, summaries, todaySales, period, evoMap]);

  // Dynamic daily goal: average of last 30 days + 10% (same as FranchiseeDashboard)
  const dailyGoal = useMemo(() => {
    if (!summaries.length) return 7000;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const todayStr = format(now, "yyyy-MM-dd");

    const recentDays = summaries.filter((s) => {
      const d = s.date;
      return d >= format(thirtyDaysAgo, "yyyy-MM-dd") && d < todayStr;
    });

    if (recentDays.length < 7) return 7000;

    // Group by date, sum all franchises per day
    const byDate = {};
    recentDays.forEach((s) => {
      byDate[s.date] = (byDate[s.date] || 0) + (s.sales_value || 0);
    });
    const dailyTotals = Object.values(byDate);
    const avg = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
    return Math.round(avg * 1.10);
  }, [summaries]);

  const maxRevenue = rankedFranchises[0]?.revenue || 1;

  if (isLoading || rankedFranchises.length === 0) return null;

  const totalRevenue = rankedFranchises.reduce((sum, f) => sum + f.revenue, 0);
  const goalPercent = Math.min(Math.round((totalRevenue / dailyGoal) * 100), 100);
  const remaining = Math.max(dailyGoal - totalRevenue, 0);

  // SVG donut math
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (goalPercent / 100) * circumference;

  const showMeta = period === "today";

  const periodLabel =
    period === "today" ? "Ranking de Vendas Hoje" :
    period === "7d" ? "Ranking de Vendas (7 dias)" :
    "Ranking de Vendas (30 dias)";

  return (
    <div className={showMeta ? "grid grid-cols-1 lg:grid-cols-5 gap-8" : ""}>
      {/* Ranking Table */}
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-[#291715]/5 ${showMeta ? "lg:col-span-3" : ""}`}>
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b1c1d]/70 mb-8 font-plus-jakarta">
          {periodLabel}
        </h4>

        <div className="space-y-8">
          {rankedFranchises.map((f, i) => {
            const pct = maxRevenue > 0 ? Math.max((f.revenue / maxRevenue) * 100, 2) : 2;
            const isFirst = i === 0;
            const opacityClass = isFirst ? "" : i === 1 ? "opacity-80" : i === 2 ? "opacity-70" : "opacity-60";

            return (
              <div key={f.id} className="flex items-center gap-4">
                <span className="w-6 text-sm font-bold text-[#1b1c1d]/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-[#1b1c1d] font-plus-jakarta">
                      {f.name}
                    </span>
                    <span className="text-sm font-bold text-[#a80012]">
                      {formatBRL(f.revenue)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#291715]/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[#a80012] rounded-full ${opacityClass}`}
                      style={{
                        width: `${pct}%`,
                        ...(isFirst
                          ? { boxShadow: "0 0 8px rgba(168, 0, 18, 0.4)" }
                          : {}),
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meta do Dia — only for "today" period */}
      {showMeta && (
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#291715]/5">
            <h4 className="text-sm font-bold text-[#1b1c1d] mb-4 font-plus-jakarta">
              Meta do Dia
            </h4>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    className="text-[#291715]/5"
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="10"
                  />
                  <circle
                    className="text-[#a80012]"
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-mono-numbers text-[#1b1c1d]">
                    {goalPercent}%
                  </span>
                  <span className="text-xs uppercase font-bold text-[#1b1c1d]/70 font-plus-jakarta">
                    Atingido
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-[#1b1c1d]/70 font-medium">
              Faltam{" "}
              <span className="text-[#a80012] font-bold">
                {formatBRL(remaining)}
              </span>{" "}
              para bater a meta global
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FranchiseRanking);
