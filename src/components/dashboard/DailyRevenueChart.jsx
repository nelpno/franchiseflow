import React, { useMemo } from 'react';
import { format, subDays } from "date-fns";
import { formatBRL } from "@/lib/formatters";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function DailyRevenueChart({ allSales = [], isLoading, days = 7 }) {
  const chartData = useMemo(() => {
    const data = [];
    const todayStr = format(new Date(), "yyyy-MM-dd");
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const daySales = allSales.filter(s => s.sale_date === dateStr);
      const revenue = daySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      data.push({
        dayLabel: DAY_LABELS[date.getDay()],
        revenue,
        isLast: i === 0,
      });
    }
    return data;
  }, [allSales, days]);

  const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#291715]/5">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-[#1b1c1d] font-plus-jakarta">
          Faturamento {days} dias
        </h4>
        <span className="text-xs font-black text-[#a80012] uppercase tracking-tight">
          {formatBRL(totalRevenue)} TOTAL
        </span>
      </div>
      <div className="h-48 flex items-end justify-between gap-3 px-2">
        {chartData.map((d, i) => {
          const heightPct = maxRevenue > 0 ? Math.max((d.revenue / maxRevenue) * 100, 4) : 4;
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-lg ${
                d.isLast
                  ? "bg-gradient-to-t from-[#a80012]/40 to-[#a80012] shadow-[0_0_15px_rgba(168,0,18,0.2)]"
                  : "bg-gradient-to-t from-[#a80012]/20 to-[#a80012]/40"
              }`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-4 text-xs font-bold text-[#1b1c1d]/60 uppercase tracking-widest font-plus-jakarta">
        {chartData.map((d, i) => (
          <span key={i}>{d.dayLabel}</span>
        ))}
      </div>
    </div>
  );
}

export default React.memo(DailyRevenueChart);
