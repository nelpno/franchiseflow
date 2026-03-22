import React, { useMemo } from "react";
import { format } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";

export default function FranchiseRanking({ franchises, summaries, isLoading }) {
  const rankedFranchises = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todaySummaries = summaries.filter((s) => s.date === today);

    const ranked = franchises.map((f) => {
      const summary = todaySummaries.find((s) => s.franchise_id === f.id);
      return {
        id: f.id,
        name: f.city || f.owner_name || "Franquia",
        revenue: summary?.sales_value || 0,
      };
    });

    return ranked.sort((a, b) => b.revenue - a.revenue);
  }, [franchises, summaries]);

  const maxRevenue = rankedFranchises[0]?.revenue || 1;

  if (isLoading || rankedFranchises.length === 0) return null;

  // Calculate daily goal progress
  const totalRevenue = rankedFranchises.reduce((sum, f) => sum + f.revenue, 0);
  const dailyGoal = 7000;
  const goalPercent = Math.min(Math.round((totalRevenue / dailyGoal) * 100), 100);
  const remaining = Math.max(dailyGoal - totalRevenue, 0);

  // SVG donut math
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (goalPercent / 100) * circumference;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Ranking Table (Left 60%) */}
      <div className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-[#291715]/5">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b1c1d]/60 mb-8 font-plus-jakarta">
          Ranking de Vendas por Unidade
        </h4>

        <div className="space-y-8">
          {rankedFranchises.map((f, i) => {
            const pct = maxRevenue > 0 ? Math.max((f.revenue / maxRevenue) * 100, 2) : 2;
            const isFirst = i === 0;
            // Opacity decreases for lower ranks
            const opacityClass = isFirst ? "" : i === 1 ? "opacity-80" : i === 2 ? "opacity-70" : "opacity-60";

            return (
              <div key={f.id} className="flex items-center gap-4">
                <span className="w-6 text-sm font-bold text-[#1b1c1d]/60">
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

      {/* Right column (40%) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Meta do Dia */}
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
          <p className="text-xs text-center text-[#1b1c1d]/60 font-medium">
            Faltam{" "}
            <span className="text-[#a80012] font-bold">
              {formatBRL(remaining)}
            </span>{" "}
            para bater a meta global
          </p>
        </div>

        {/* Suporte Estratégico */}
        <div className="bg-[#a80012] p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-white font-bold mb-2 font-plus-jakarta">
              Suporte Estratégico
            </h4>
            <p className="text-white/80 text-sm mb-5">
              Dificuldade técnica ou operacional em alguma unidade?
            </p>
            <button className="bg-white text-[#a80012] px-6 py-2.5 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-transform uppercase tracking-wider font-plus-jakarta">
              Abrir Chamado
            </button>
          </div>
          {/* Decorative icon */}
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <MaterialIcon icon="headset_mic" size={80} className="text-white" />
          </div>
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#775a19]/10 rounded-full blur-2xl -mr-16 -mt-16" />
        </div>
      </div>
    </div>
  );
}
