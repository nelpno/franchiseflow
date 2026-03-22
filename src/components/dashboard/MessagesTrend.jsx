import React, { useMemo } from 'react';
import { format, subDays } from "date-fns";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function MessagesTrend({ summaries, isLoading, days = 7, todayContacts = 0 }) {
  const chartData = useMemo(() => {
    const data = [];
    const todayStr = format(new Date(), "yyyy-MM-dd");
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const daySummaries = summaries.filter(s => s.date === dateStr);
      let contacts = daySummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
      if (dateStr === todayStr && todayContacts > contacts) {
        contacts = todayContacts;
      }
      data.push({
        dayLabel: DAY_LABELS[date.getDay()],
        contacts,
        isLast: i === 0,
      });
    }
    return data;
  }, [summaries, days, todayContacts]);

  const totalContacts = chartData.reduce((sum, d) => sum + d.contacts, 0);
  const maxContacts = Math.max(...chartData.map(d => d.contacts), 1);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#291715]/5">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-[#291715] font-plus-jakarta">
          Contatos Recebidos
        </h4>
        <span className="text-xs font-black text-[#775a19] uppercase tracking-tight">
          {totalContacts} LEADS
        </span>
      </div>
      <div className="h-48 flex items-end justify-between gap-3 px-2">
        {chartData.map((d, i) => {
          const heightPct = maxContacts > 0 ? Math.max((d.contacts / maxContacts) * 100, 4) : 4;
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-lg ${
                d.isLast
                  ? "bg-gradient-to-t from-[#775a19]/40 to-[#775a19]"
                  : "bg-gradient-to-t from-[#775a19]/20 to-[#775a19]/40"
              }`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-4 text-[10px] font-bold text-[#291715]/40 uppercase tracking-widest font-plus-jakarta">
        {chartData.map((d, i) => (
          <span key={i}>{d.dayLabel}</span>
        ))}
      </div>
    </div>
  );
}
