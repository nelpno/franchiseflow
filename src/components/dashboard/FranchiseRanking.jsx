import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

const VISIBLE_COUNT = 5;

function FranchiseRanking({ franchises, summaries, todaySales = [], period = "today", isLoading, configMap = {} }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
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

    const botRevenueByEvo = {};

    // Initialize all franchises with 0
    franchises.forEach((f) => {
      if (f.evolution_instance_id) {
        revenueByEvo[f.evolution_instance_id] = 0;
        botRevenueByEvo[f.evolution_instance_id] = 0;
      }
    });

    const isBotSource = (s) => s.source === 'bot';
    const saleRevenue = (s) => (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0);

    if (period === "today") {
      // Use LIVE todaySales data (not daily_summaries which doesn't exist for today)
      todaySales.forEach((s) => {
        const evoId = s.franchise_id;
        if (evoId in revenueByEvo) {
          const rev = saleRevenue(s);
          revenueByEvo[evoId] += rev;
          if (isBotSource(s)) botRevenueByEvo[evoId] += rev;
        }
      });
    } else {
      const days = period === "7d" ? 7 : 30;
      const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");

      // Summaries for past days (today's summary doesn't exist until 02:00 BRT)
      // Note: summaries don't have source breakdown, only todaySales does
      summaries.forEach((s) => {
        if (s.date >= cutoff && s.date < todayStr) {
          const evoId = s.franchise_id;
          if (evoId in revenueByEvo) {
            revenueByEvo[evoId] += parseFloat(s.sales_value) || 0;
          }
        }
      });

      // Merge live todaySales for today's contribution
      todaySales.forEach((s) => {
        const evoId = s.franchise_id;
        if (evoId in revenueByEvo) {
          const rev = saleRevenue(s);
          revenueByEvo[evoId] += rev;
          if (isBotSource(s)) botRevenueByEvo[evoId] += rev;
        }
      });
    }

    // Build ranked list
    return Object.entries(revenueByEvo)
      .map(([evoId, revenue]) => {
        const f = evoMap[evoId];
        const config = configMap[evoId];
        const botRevenue = botRevenueByEvo[evoId] || 0;
        return {
          id: f?.id || evoId,
          evoId,
          name: f ? getFranchiseDisplayName(f, config) : evoId,
          revenue,
          botPercent: revenue > 0 ? Math.round((botRevenue / revenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [franchises, summaries, todaySales, period, evoMap, configMap]);

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
      byDate[s.date] = (byDate[s.date] || 0) + (parseFloat(s.sales_value) || 0);
    });
    const dailyTotals = Object.values(byDate);
    const avg = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
    return Math.round(avg * 1.10);
  }, [summaries]);

  // Only show franchises with actual revenue in the ranking
  const activeFranchises = rankedFranchises.filter(f => f.revenue > 0);
  const inactiveFranchises = rankedFranchises.length - activeFranchises.length;
  const maxRevenue = activeFranchises[0]?.revenue || 1;

  if (isLoading || rankedFranchises.length === 0) return null;

  const totalRevenue = rankedFranchises.reduce((sum, f) => sum + f.revenue, 0);
  const goalPercent = Math.round((totalRevenue / dailyGoal) * 100);
  const goalPercentCapped = Math.min(goalPercent, 100);
  const remaining = dailyGoal - totalRevenue;
  const exceeded = remaining <= 0;

  // SVG donut math
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (goalPercentCapped / 100) * circumference;

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
          {activeFranchises.length === 0 && (
            <p className="text-sm text-[#4a3d3d]/60 text-center py-4">Nenhuma franquia com vendas no período</p>
          )}
          {(expanded ? activeFranchises : activeFranchises.slice(0, VISIBLE_COUNT)).map((f, i) => {
            const pct = maxRevenue > 0 ? Math.max((f.revenue / maxRevenue) * 100, 2) : 2;
            const isFirst = i === 0;
            const opacityClass = isFirst ? "" : i === 1 ? "opacity-80" : i === 2 ? "opacity-70" : "opacity-60";

            return (
              <div
                key={f.id}
                className="flex items-center gap-4 cursor-pointer hover:bg-[#fbf9fa] rounded-xl px-2 py-1 -mx-2 transition-colors"
                onClick={() => navigate(`/Acompanhamento?franchise=${f.evoId}`)}
                title={`Ver detalhes de ${f.name}`}
              >
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
                  <div className="h-2 w-full bg-[#291715]/5 rounded-full overflow-hidden flex" title={`${f.botPercent}% bot · ${100 - f.botPercent}% manual`}>
                    {f.botPercent > 0 && (
                      <div
                        className={`h-full bg-[#705d00] ${f.botPercent >= 100 ? 'rounded-full' : 'rounded-l-full'} ${opacityClass}`}
                        style={{
                          width: `${(pct * f.botPercent) / 100}%`,
                        }}
                      />
                    )}
                    {f.botPercent < 100 && (
                      <div
                        className={`h-full bg-[#a80012] ${f.botPercent <= 0 ? 'rounded-full' : 'rounded-r-full'} ${opacityClass}`}
                        style={{
                          width: `${(pct * (100 - f.botPercent)) / 100}%`,
                          ...(isFirst && f.botPercent <= 0
                            ? { boxShadow: "0 0 8px rgba(168, 0, 18, 0.4)" }
                            : {}),
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeFranchises.length > VISIBLE_COUNT && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-[#a80012] hover:bg-[#a80012]/5 rounded-xl transition-colors"
          >
            <MaterialIcon icon={expanded ? "expand_less" : "expand_more"} size={18} />
            {expanded
              ? "Mostrar menos"
              : `Ver todas (+${activeFranchises.length - VISIBLE_COUNT})`}
          </button>
        )}
        {/* Bottom performers — "Precisam de Atenção" */}
        {activeFranchises.length > 5 && (() => {
          const bottom5 = activeFranchises.slice(-5).reverse();
          return (
            <div className="mt-6 pt-4 border-t border-[#291715]/5">
              <h5 className="text-xs font-bold uppercase tracking-[0.15em] text-[#b91c1c]/70 mb-3 flex items-center gap-1.5">
                <MaterialIcon icon="trending_down" size={14} />
                Precisam de Atenção
              </h5>
              <div className="space-y-2">
                {bottom5.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-red-50/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/Acompanhamento?franchise=${f.evoId}`)}
                  >
                    <span className="text-sm text-[#4a3d3d] font-medium">{f.name}</span>
                    <span className="text-xs font-semibold text-[#b91c1c]">{formatBRL(f.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {inactiveFranchises > 0 && (
          <p className="text-xs text-[#4a3d3d]/40 text-center mt-3">
            {inactiveFranchises} franquia{inactiveFranchises > 1 ? "s" : ""} sem vendas no período
          </p>
        )}
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
                  <span className={`text-2xl font-bold font-mono-numbers ${exceeded ? "text-[#2e7d32]" : "text-[#1b1c1d]"}`}>
                    {goalPercent}%
                  </span>
                  <span className={`text-xs uppercase font-bold font-plus-jakarta ${exceeded ? "text-[#2e7d32]/70" : "text-[#1b1c1d]/70"}`}>
                    Atingido
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-[#1b1c1d]/70 font-medium">
              {exceeded ? (
                <>
                  Meta batida!{" "}
                  <span className="text-[#2e7d32] font-bold">
                    +{formatBRL(totalRevenue - dailyGoal)}
                  </span>
                </>
              ) : (
                <>
                  Faltam{" "}
                  <span className="text-[#a80012] font-bold">
                    {formatBRL(remaining)}
                  </span>{" "}
                  para bater a meta global
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FranchiseRanking);
