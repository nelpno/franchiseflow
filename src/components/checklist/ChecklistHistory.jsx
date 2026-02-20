import React from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ChecklistHistory({ history }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = history.find((h) => h.date === dateStr);
    const pct = entry ? entry.completion_percentage : 0;
    return { dateStr, label: format(date, "EEE", { locale: ptBR }), pct };
  });

  // Calcular streak
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    if (days[i].pct === 100) streak++;
    else break;
  }
  // Checar dias anteriores ao histórico exibido para streak mais longo
  // (simplificado: conta apenas nos últimos 7)

  const getCircleStyle = (pct) => {
    if (pct === 100) return "bg-green-500 text-white";
    if (pct > 0) return "bg-yellow-400 text-yellow-900";
    return "bg-slate-200 text-slate-500";
  };

  const getCircleContent = (pct) => {
    if (pct === 100) return "✓";
    if (pct > 0) return `${Math.round(pct)}%`;
    return "✗";
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-slate-800">Histórico — Últimos 7 dias</h3>
        <div className="flex items-center gap-2">
          {streak >= 30 && (
            <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🏆 Franqueado Destaque!
            </span>
          )}
          {streak >= 7 && streak < 30 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🔥 Semana completa!
            </span>
          )}
          <span className="text-slate-700 font-semibold text-sm">
            🔥 Streak: <strong>{streak} dia{streak !== 1 ? "s" : ""}</strong>
          </span>
        </div>
      </div>
      <div className="flex justify-around">
        {days.map((day) => (
          <div key={day.dateStr} className="flex flex-col items-center gap-2">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${getCircleStyle(
                day.pct
              )}`}
            >
              {getCircleContent(day.pct)}
            </div>
            <span className="text-xs text-slate-500 capitalize">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}