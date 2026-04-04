import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

function MiniRevenueChart({ summaries, franchiseId, todayRevenue = 0, allSales = [] }) {
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dayFull = format(subDays(new Date(), i), "EEEE", { locale: ptBR });
      const shortLabels = { "domingo": "Dom", "segunda-feira": "Seg", "terça-feira": "Ter", "quarta-feira": "Qua", "quinta-feira": "Qui", "sexta-feira": "Sex", "sábado": "Sáb" };
      const capitalizedLabel = shortLabels[dayFull] || dayFull.slice(0, 3);
      // Revenue from daily_summaries (cron)
      const daySummaries = summaries.filter(
        (s) => s.date === date && (!franchiseId || s.franchise_id === franchiseId)
      );
      const cronRevenue = daySummaries.reduce((sum, s) => sum + (parseFloat(s.sales_value) || 0), 0);
      // Revenue from allSales (real-time fallback para cobrir falhas do cron)
      const daySales = allSales.filter((s) => s.sale_date === date);
      const realtimeRevenue = daySales.reduce(
        (sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0
      );
      const revenue = Math.max(cronRevenue, realtimeRevenue);
      days.push({ day: capitalizedLabel, valor: revenue, isToday: i === 0 });
    }
    return days;
  }, [summaries, franchiseId, allSales]);

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
      <div className="flex items-end justify-between gap-2 mb-4" style={{ height: "128px" }}>
        {chartData.map((entry, index) => {
          const heightPercent = maxValue > 0 ? (entry.valor / maxValue) * 100 : 0;
          const barHeight = Math.max((heightPercent / 100) * 100, 4);
          return (
            <div key={index} className="flex flex-col items-center flex-1 h-full justify-end gap-1">
              <span className="text-xs text-[#4a3d3d] font-mono-numbers">
                {entry.valor > 0 ? `R$ ${Math.round(entry.valor)}` : ""}
              </span>
              <div
                className={`w-full max-w-[32px] rounded-t-lg transition-all duration-300 ${
                  entry.isToday ? "bg-[#b91c1c]" : "bg-[#ffdad6]"
                }`}
                style={{ height: `${barHeight}px` }}
              />
              <span
                className={`text-xs ${
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
        <span className="text-xs text-[#4a3d3d] font-medium">
          Média: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(average)}
        </span>
        <span className="text-xs text-[#4a3d3d] font-medium font-mono-numbers">
          Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
        </span>
      </div>
    </section>
  );
}

export default React.memo(MiniRevenueChart);
