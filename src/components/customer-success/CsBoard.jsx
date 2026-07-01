import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { COLUMN_CONFIG } from "./tierConfig";
import CsCard from "./CsCard";

const TIER_DOT = { critical: "🔴", attention: "🟡", standout: "🏆", healthy: "🟢", dormant: "⚪" };

export default function CsBoard({ tasks, signalsByFranchise = {}, onOpen, onMoveTask }) {
  const [showDone, setShowDone] = useState(false);

  const byCol = {};
  COLUMN_CONFIG.forEach((c) => { byCol[c.key] = []; });
  tasks.forEach((t) => { (byCol[t.column_status] || (byCol[t.column_status] = [])).push(t); });

  const onDragEnd = (r) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const task = tasks.find((t) => t.id === r.draggableId);
    if (task) onMoveTask?.(task, r.destination.droppableId);
  };

  const subtitleFor = (t) => {
    if (!t.franchise_id) return "Tarefa geral";
    const s = signalsByFranchise[t.franchise_id];
    return s ? `${s.franchise_name}${s.city ? " · " + s.city : ""}` : null;
  };
  const dotFor = (t) => {
    const s = t.franchise_id ? signalsByFranchise[t.franchise_id] : null;
    if (!s) return "";
    return TIER_DOT[s.is_standout ? "standout" : s.tier] || "";
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMN_CONFIG.map((col) => {
          const isDone = col.key === "feito";
          const collapsed = isDone && !showDone;
          const count = byCol[col.key].length;
          return (
            <Droppable droppableId={col.key} key={col.key}>
              {(prov, snap) => (
                <div
                  ref={prov.innerRef}
                  {...prov.droppableProps}
                  className={`rounded-xl bg-[#f6f2f2] border-t-2 ${col.accent} p-2 ${collapsed ? "self-start" : "min-h-[160px]"} transition-shadow ${snap.isDraggingOver ? "ring-2 ring-[#b91c1c]/30" : ""}`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#4a3d3d] px-1 pb-2 flex justify-between items-center">
                    <span>{col.label}</span>
                    {isDone ? (
                      <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-0.5 text-[#8a7e7e] hover:text-[#b91c1c]" aria-label={showDone ? "Ocultar resolvidos" : "Ver resolvidos"}>
                        {count}
                        <MaterialIcon icon={showDone ? "expand_less" : "expand_more"} size={16} />
                      </button>
                    ) : (
                      <span className="text-[#8a7e7e]">{count}</span>
                    )}
                  </div>
                  {!collapsed && byCol[col.key].map((task, i) => (
                    <Draggable draggableId={task.id} index={i} key={task.id}>
                      {(dp) => (
                        <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} className="mb-2">
                          <CsCard
                            task={task}
                            subtitle={subtitleFor(task)}
                            tierDot={dotFor(task)}
                            onOpen={onOpen}
                            onMove={onMoveTask}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                  {!collapsed && count === 0 && <div className="text-[11px] text-[#c4b8b8] text-center py-4">vazio</div>}
                  {collapsed && (
                    <div className="text-[11px] text-[#c4b8b8] px-1 pb-1">{count ? `${count} resolvido(s) — clique pra ver` : "nada resolvido ainda"}</div>
                  )}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
