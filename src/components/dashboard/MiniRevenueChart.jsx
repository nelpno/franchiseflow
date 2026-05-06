import React, { useMemo } from "react";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatBRL";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function sumNet(sales) {
  return sales.reduce(
    (sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0),
    0
  );
}

function MiniRevenueChart({ summaries, franchiseId, todayRevenue = 0, allSales = [], period = "today", monthOffset = 0, customRange = null }) {
  const { chartData, title } = useMemo(() => {
    const now = new Date();
    const shortLabels = {
      "domingo": "Dom", "segunda-feira": "Seg", "terça-feira": "Ter",
      "quarta-feira": "Qua", "quinta-feira": "Qui", "sexta-feira": "Sex", "sábado": "Sáb"
    };
    const todayStr = format(now, "yyyy-MM-dd");

    let days;
    let chartTitle;

    if (period === "month") {
      const refDate = addMonths(now, monthOffset);
      const mStart = startOfMonth(refDate);
      const mEnd = endOfMonth(refDate);
      const isCurrentMonth = monthOffset === 0;
      const rangeEnd = isCurrentMonth && now < mEnd ? now : mEnd;
      const allDays = eachDayOfInterval({ start: mStart, end: rangeEnd });
      const monthLabelTitle = format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
      const titleStr = isCurrentMonth ? "Faturamento do mês" : `Faturamento — ${monthLabelTitle}`;

      if (allDays.length <= 10) {
        days = allDays;
        chartTitle = titleStr;
      } else {
        const weeks = [];
        let weekStart = mStart;
        while (weekStart <= rangeEnd) {
          const candidateEnd = new Date(weekStart.getTime() + 6 * 86400000);
          const weekEnd = candidateEnd > rangeEnd ? rangeEnd : candidateEnd;
          const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
          const weekDates = weekDays.map(d => format(d, "yyyy-MM-dd"));
          const revenue = sumNet(allSales.filter(s => weekDates.includes(s.sale_date)));
          const label = `${format(weekStart, "dd")}–${format(weekEnd, "dd")}`;
          const isCurrentWeek = isCurrentMonth && weekDates.includes(todayStr);
          weeks.push({ day: label, valor: revenue, isToday: isCurrentWeek });
          weekStart = new Date(weekEnd.getTime() + 86400000);
        }
        return { chartData: weeks, title: titleStr };
      }
    } else if (period === "custom" && customRange?.start && customRange?.end) {
      const totalDays = differenceInDays(customRange.end, customRange.start) + 1;
      chartTitle = `Faturamento — ${format(customRange.start, "dd/MM")} a ${format(customRange.end, "dd/MM")}`;

      if (totalDays > 31) {
        const weeks = [];
        let weekStart = customRange.start;
        while (weekStart <= customRange.end) {
          const candidateEnd = new Date(weekStart.getTime() + 6 * 86400000);
          const weekEnd = candidateEnd > customRange.end ? customRange.end : candidateEnd;
          const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
          const weekDates = weekDays.map(d => format(d, "yyyy-MM-dd"));
          const revenue = sumNet(allSales.filter(s => weekDates.includes(s.sale_date)));
          const label = `${format(weekStart, "dd/MM")}`;
          weeks.push({ day: label, valor: revenue, isToday: weekDates.includes(todayStr) });
          weekStart = new Date(weekEnd.getTime() + 86400000);
        }
        return { chartData: weeks, title: chartTitle };
      }
      days = eachDayOfInterval({ start: customRange.start, end: customRange.end });
    } else if (period === "week") {
      const wkStart = startOfWeek(now, { weekStartsOn: 1 });
      days = eachDayOfInterval({ start: wkStart, end: now });
      chartTitle = "Faturamento da semana";
    } else {
      days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
      chartTitle = "Faturamento 7 dias";
    }

    const barsData = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayFull = format(date, "EEEE", { locale: ptBR });
      const capitalizedLabel = shortLabels[dayFull] || dayFull.slice(0, 3);
      const daySales = allSales.filter((s) => s.sale_date === dateStr);
      const revenue = sumNet(daySales);
      const label = (period === "month" || period === "custom") ? format(date, "dd") : capitalizedLabel;
      return { day: label, valor: revenue, isToday: dateStr === todayStr };
    });

    return { chartData: barsData, title: chartTitle };
  }, [summaries, franchiseId, allSales, period, monthOffset, customRange?.start, customRange?.end]);

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
