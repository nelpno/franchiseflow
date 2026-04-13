import React, { useMemo } from "react";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatBRL";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function MiniRevenueChart({ summaries, franchiseId, todayRevenue = 0, allSales = [], period = "today" }) {
  const { chartData, title } = useMemo(() => {
    const now = new Date();
    const shortLabels = {
      "domingo": "Dom", "segunda-feira": "Seg", "terça-feira": "Ter",
      "quarta-feira": "Qua", "quinta-feira": "Qui", "sexta-feira": "Sex", "sábado": "Sáb"
    };
    const todayStr = format(now, "yyyy-MM-dd");

    // Determine date range based on period
    let days;
    let chartTitle;

    if (period === "month") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      const allDays = eachDayOfInterval({ start: mStart, end: now });
      // Group by week chunks for month view (too many bars otherwise)
      if (allDays.length <= 10) {
        // Early in the month — show daily
        days = allDays;
        chartTitle = "Faturamento do mês";
      } else {
        // Aggregate by week-of-month
        const weeks = [];
        let weekStart = mStart;
        while (weekStart <= now) {
          const weekEnd = new Date(Math.min(
            new Date(weekStart.getTime() + 6 * 86400000).getTime(),
            now.getTime()
          ));
          const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
          const weekDates = weekDays.map(d => format(d, "yyyy-MM-dd"));
          const weekSales = allSales.filter(s => weekDates.includes(s.sale_date));
          const revenue = weekSales.reduce(
            (sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0
          );
          const label = `${format(weekStart, "dd")}–${format(weekEnd, "dd")}`;
          const isCurrentWeek = weekDates.includes(todayStr);
          weeks.push({ day: label, valor: revenue, isToday: isCurrentWeek });
          weekStart = new Date(weekEnd.getTime() + 86400000);
        }
        return {
          chartData: weeks,
          title: "Faturamento do mês"
        };
      }
    } else if (period === "week") {
      const wkStart = startOfWeek(now, { weekStartsOn: 1 });
      days = eachDayOfInterval({ start: wkStart, end: now });
      chartTitle = "Faturamento da semana";
    } else {
      // "today" — show last 7 days for context
      days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
      chartTitle = "Faturamento 7 dias";
    }

    // Build bar data from days array
    const barsData = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayFull = format(date, "EEEE", { locale: ptBR });
      const capitalizedLabel = shortLabels[dayFull] || dayFull.slice(0, 3);

      // Revenue from daily_summaries (cron)
      const daySummaries = summaries.filter(
        (s) => s.date === dateStr && (!franchiseId || s.franchise_id === franchiseId)
      );
      const cronRevenue = daySummaries.reduce((sum, s) => sum + (parseFloat(s.sales_value) || 0), 0);

      // Revenue from allSales (real-time fallback)
      const daySales = allSales.filter((s) => s.sale_date === dateStr);
      const realtimeRevenue = daySales.reduce(
        (sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0
      );
      const revenue = Math.max(cronRevenue, realtimeRevenue);

      // Label: day-of-month for month view, weekday abbreviation for others
      const label = period === "month" ? format(date, "dd") : capitalizedLabel;

      return { day: label, valor: revenue, isToday: dateStr === todayStr };
    });

    return { chartData: barsData, title: chartTitle };
  }, [summaries, franchiseId, allSales, period]);

  const hasData = chartData.some((d) => d.valor > 0);
  if (!hasData) return null;

  const maxValue = Math.max(...chartData.map((d) => d.valor), 1);
  const average = Math.round(
    chartData.reduce((sum, d) => sum + d.valor, 0) / chartData.length
  );
  const total = chartData.reduce((sum, d) => sum + d.valor, 0);

  // Hide value labels if too many bars (>10) to avoid clutter
  const showValueLabels = chartData.length <= 10;

  return (
    <section className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-[#cac0c0]/10">
      <h3 className="text-sm font-semibold text-[#4a3d3d] mb-6">{title}</h3>
      <TooltipProvider delayDuration={100}>
        <div className="flex items-end justify-between gap-1 mb-4" style={{ height: "128px" }}>
          {chartData.map((entry, index) => {
            const heightPercent = maxValue > 0 ? (entry.valor / maxValue) * 100 : 0;
            const barHeight = Math.max((heightPercent / 100) * 100, 4);
            return (
              <div key={index} className="flex flex-col items-center flex-1 h-full justify-end gap-1">
                {showValueLabels && (
                  <span className="text-xs text-[#4a3d3d] font-mono-numbers">
                    {entry.valor > 0 ? `R$ ${Math.round(entry.valor)}` : ""}
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-full max-w-[32px] rounded-t-lg transition-all duration-300 cursor-pointer ${
                        entry.isToday ? "bg-[#b91c1c]" : "bg-[#ffdad6]"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="font-mono-numbers">{formatBRL(entry.valor)}</span>
                  </TooltipContent>
                </Tooltip>
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
      </TooltipProvider>
      <div className="flex justify-between items-center pt-4 border-t border-[#cac0c0]/10">
        <span className="text-xs text-[#4a3d3d] font-medium">
          Média: {formatBRL(average)}
        </span>
        <span className="text-xs text-[#4a3d3d] font-medium font-mono-numbers">
          Total: {formatBRL(total)}
        </span>
      </div>
    </section>
  );
}

export default React.memo(MiniRevenueChart);
