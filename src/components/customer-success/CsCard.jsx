import { differenceInCalendarDays } from "date-fns";
import { COLUMN_CONFIG, SEV } from "./tierConfig";

// Cor do "parado há X dias": amarelo a partir de 3d, vermelho a partir de 7d
function agingClass(days) {
  if (days >= 7) return "text-red-600 font-semibold";
  if (days >= 3) return "text-amber-600";
  return "text-[#8a7e7e]";
}

// "Hoje no radar" — o cartão MANUAL guarda o texto do dia em que foi escrito e nunca é
// reescrito (o reconcile só mexe em cartão auto, de propósito: ele não sabe se a tarefa que o
// CS anotou terminou). Sem esta linha, quem varre o mural lê "Bot parado, Pix não cadastrado"
// de duas semanas atrás como se fosse o estado de agora — e liga para o franqueado cobrando o
// que já foi resolvido. Caso real que originou isto: Vila dos Remédios, 17/08/2026.
// No cartão AUTO não aparece: a description dele JÁ é essa lista, reescrita a cada carga.
function RadarHoje({ signals }) {
  const flags = signals?.flags || [];
  if (flags.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {flags.slice(0, 3).map((f, i) => (
          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${SEV[f.sev] || SEV.low}`}>{f.label}</span>
        ))}
        {flags.length > 3 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">+{flags.length - 3}</span>
        )}
      </div>
    );
  }
  // Sem flag NÃO é o mesmo que "resolvido" — é "o radar não acusa nada". O texto tem que
  // mandar conferir, não dar alta. E dormente (sem venda em 90d) não é unidade saudável.
  return signals?.tier === "dormant" ? (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">sem venda nos últimos 90 dias</span>
  ) : (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">nada no radar hoje — confira antes de cobrar</span>
  );
}

export default function CsCard({ task, subtitle, tierDot, signals, onOpen, onMove }) {
  const days = differenceInCalendarDays(new Date(), new Date(task.moved_to_column_at));
  const mostraRadar = task.source !== "auto" && !!task.franchise_id && !!signals && task.column_status !== "feito";
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
      {mostraRadar && (
        <div className="mt-2 pt-2 border-t border-[#291715]/5">
          <div className="text-[10px] uppercase tracking-wide text-[#8a7e7e] mb-1">Hoje no radar</div>
          <RadarHoje signals={signals} />
        </div>
      )}
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
