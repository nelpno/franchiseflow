import React from "react";

export default function ChecklistProgress({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const barColor =
    pct <= 33
      ? "from-red-500 to-red-600"
      : pct <= 66
      ? "from-yellow-400 to-yellow-500"
      : "from-[#b91c1c] to-[#991b1b]";

  const textColor =
    pct <= 33 ? "text-red-600" : pct <= 66 ? "text-yellow-600" : "text-[#b91c1c]";

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-2">
        <span className="text-slate-600 text-sm font-medium">Progresso do dia</span>
        <span className={`font-bold text-2xl ${textColor}`}>
          {completed}/{total} <span className="text-base">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}