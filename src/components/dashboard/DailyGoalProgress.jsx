import { formatBRL } from "@/lib/formatters";

export default function DailyGoalProgress({ todayRevenue, dailyGoal }) {
  if (dailyGoal === null || dailyGoal <= 0) return null;

  const revenue = todayRevenue || 0;
  const percentage = Math.min(Math.round((revenue / dailyGoal) * 100), 100);
  const remaining = dailyGoal - revenue;
  const exceeded = revenue >= dailyGoal;

  return (
    <section className="mb-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-[#b91c1c]">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#4a3d3d]">
            Meta do Dia
          </span>
          <span className="text-xs font-semibold text-[#b91c1c]">
            {percentage}% concluída
          </span>
        </div>
        <div className="w-full bg-[#fbf9fa] h-3 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-[#b91c1c] rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-sm">
          <div className="text-[#4a3d3d]">
            <span className="font-bold text-[#1d1b1b]">
              {formatBRL(revenue)}
            </span>{" "}
            <span className="text-xs opacity-80">
              de {formatBRL(dailyGoal)}
            </span>
          </div>
          <div className="font-semibold text-[#b91c1c]">
            {exceeded
              ? `Meta batida! +${formatBRL(revenue - dailyGoal)}`
              : `Faltam ${formatBRL(remaining)}!`}
          </div>
        </div>
      </div>
    </section>
  );
}
