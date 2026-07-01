import { differenceInCalendarDays } from "date-fns";
import { COLUMN_CONFIG } from "./tierConfig";

// Cor do "parado há X dias": amarelo a partir de 3d, vermelho a partir de 7d
function agingClass(days) {
  if (days >= 7) return "text-red-600 font-semibold";
  if (days >= 3) return "text-amber-600";
  return "text-[#8a7e7e]";
}

export default function CsCard({ task, subtitle, tierDot, onOpen, onMove }) {
  const days = differenceInCalendarDays(new Date(), new Date(task.moved_to_column_at));
  return (
    <div
      onClick={(e) => { if (e.target.closest("button, select, a")) return; onOpen?.(task); }}
      className="cursor-pointer rounded-lg border border-[#291715]/10 bg-white p-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" title={task.source === "auto" ? "Gerado pelo radar de saúde" : "Criado manualmente"}>
          {task.source === "auto" ? "🤖" : "✍️"}{tierDot ? ` ${tierDot}` : ""}
        </span>
        {task.priority === "alta" && task.column_status !== "feito" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Prioridade</span>
        )}
      </div>
      <div className="font-semibold text-sm text-[#1b1c1d] mt-1 leading-snug">{task.title}</div>
      {subtitle && <div className="text-[11px] text-[#8a7e7e] mt-0.5">{subtitle}</div>}
      {task.description && <div className="text-xs text-[#4a3d3d] mt-1 leading-snug">{task.description}</div>}
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-[#8a7e7e]">{task.assignee ? "👤 assumido" : ""}</span>
        {task.column_status !== "feito" && <span className={agingClass(days)}>parado há {days}d</span>}
      </div>
      {/* fallback mobile: mover de coluna sem arrastar */}
      <select
        className="mt-2 w-full text-xs sm:hidden border border-[#291715]/15 rounded p-1 bg-white"
        value={task.column_status}
        onChange={(e) => onMove?.(task, e.target.value)}
        aria-label="Mover cartão para outra coluna"
      >
        {COLUMN_CONFIG.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    </div>
  );
}
