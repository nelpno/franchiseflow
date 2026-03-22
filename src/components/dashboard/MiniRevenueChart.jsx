import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MiniRevenueChart({ summaries, franchiseId, todayRevenue = 0 }) {
  const chartData = useMemo(() => {
    const days = [];
    const todayDate = format(new Date(), "yyyy-MM-dd");
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dayLabel = format(subDays(new Date(), i), "EEE", { locale: ptBR });
      const capitalizedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
      const daySummaries = summaries.filter(
        (s) => s.date === date && (!franchiseId || s.franchise_id === franchiseId)
      );
      let revenue = daySummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
      // Para hoje, usar o maior valor entre daily_summaries (cron) e vendas em tempo real
      if (date === todayDate && todayRevenue > revenue) {
        revenue = todayRevenue;
      }
      days.push({ day: capitalizedLabel, valor: revenue, isToday: i === 0 });
    }
    return days;
  }, [summaries, franchiseId, todayRevenue]);

  const hasData = chartData.some((d) => d.valor > 0);
  if (!hasData) return null;

  const maxValue = Math.max(...chartData.map((d) => d.valor), 1);
  const average = Math.round(
    chartData.reduce((sum, d) => sum + d.valor, 0) / chartData.length
  );
  const total = chartData.reduce((sum, d) => sum + d.valor, 0);

  return (
    <section className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-[#cac0c0]/10">
      <h3 className="text-sm font-semibold text-[#4a3d3d] mb-6">Faturamento 7 dias</h3>
      <div className="flex items-end justify-between h-32 gap-2 mb-4">
        {chartData.map((entry, index) => {
          const heightPercent = maxValue > 0 ? (entry.valor / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex flex-col items-center flex-1 gap-2">
              <div
                className={`w-full rounded-t-lg ${
                  entry.isToday ? "bg-[#b91c1c]" : "bg-[#ffdad6]"
                }`}
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
              <span
                className={`text-[10px] ${
                  entry.isToday
                    ? "text-[#b91c1c] font-bold"
                    : "text-[#4a3d3d] font-medium"
                }`}
              >
                {entry.day}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-[#cac0c0]/10">
        <span className="text-[10px] text-[#4a3d3d] font-medium">
          Média: R$ {average.toLocaleString("pt-BR")},00
        </span>
        <span className="text-[10px] text-[#4a3d3d] font-medium">
          Total: R$ {total.toLocaleString("pt-BR")},00
        </span>
      </div>
    </section>
  );
}
