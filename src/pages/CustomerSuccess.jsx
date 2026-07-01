import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { getFranchiseHealthSignals, getCsTasks, moveCsTask, reconcileCsAutoTasks } from "@/entities/all";
import FranchiseDrawer from "@/components/customer-success/FranchiseDrawer";
import CsBoard from "@/components/customer-success/CsBoard";
import CsRadarPanel from "@/components/customer-success/CsRadarPanel";
import QuickAddCard from "@/components/customer-success/QuickAddCard";

export default function CustomerSuccess() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("mural");
  const [selectedTask, setSelectedTask] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddFranchise, setQuickAddFranchise] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Recarrega só os cartões (barato) — usado após ações e no polling de visibilidade
  const reloadTasks = useCallback(async () => {
    try {
      const t = await getCsTasks();
      if (mountedRef.current) setTasks(t);
    } catch (e) {
      console.error("[CustomerSuccess] reloadTasks", e);
    }
  }, []);

  // Carga completa: reconcilia os automáticos, depois puxa cartões + saúde da rede
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try { await reconcileCsAutoTasks(); } catch (e) { console.warn("[CustomerSuccess] reconcile", e); }
      const [t, s] = await Promise.all([getCsTasks(), getFranchiseHealthSignals()]);
      if (mountedRef.current) { setTasks(t); setSignals(s); }
    } catch (e) {
      console.error("[CustomerSuccess] load", e);
      if (mountedRef.current) setError("Não foi possível carregar o mural. Tente novamente.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(reloadTasks, 300000);

  const signalsByFranchise = useMemo(
    () => Object.fromEntries((signals || []).map((s) => [s.franchise_id, s])),
    [signals],
  );

  const openCardIds = useMemo(
    () => new Set(tasks.filter((t) => t.franchise_id && t.column_status !== "feito").map((t) => t.franchise_id)),
    [tasks],
  );

  const franchisesForAdd = useMemo(
    () => (signals || [])
      .map((s) => ({ franchise_id: s.franchise_id, franchise_name: s.franchise_name, city: s.city }))
      .sort((a, b) => a.franchise_name.localeCompare(b.franchise_name)),
    [signals],
  );

  // Move otimista (arrastar ou "mover para" no mobile), com rollback no erro
  const onMoveTask = useCallback(async (task, col) => {
    if (task.column_status === col) return;
    const prev = tasks;
    const nowIso = new Date().toISOString();
    setTasks((ts) => ts.map((t) => (t.id === task.id
      ? { ...t, column_status: col, moved_to_column_at: nowIso, ...(col === "feito" ? { resolved_at: nowIso } : {}) }
      : t)));
    try {
      await moveCsTask(task.id, col, user?.id, task.franchise_id);
    } catch (e) {
      console.error("[CustomerSuccess] move", e);
      toast.error(safeErrorMessage(e, "Não foi possível mover o cartão."));
      if (mountedRef.current) setTasks(prev);
    }
  }, [tasks, user?.id]);

  const openTask = (task) => { setPreviewRow(null); setSelectedTask(task); };
  const openPreview = (row) => { setSelectedTask(null); setPreviewRow(row); };
  const closeDrawer = () => { setSelectedTask(null); setPreviewRow(null); };
  const createCardFor = (row) => {
    closeDrawer();
    setQuickAddFranchise(row?.franchise_id || "");
    setQuickAddOpen(true);
  };

  const drawerRow = selectedTask
    ? (selectedTask.franchise_id ? signalsByFranchise[selectedTask.franchise_id] : null)
    : previewRow;

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1b1c1d] flex items-center gap-2">
            <MaterialIcon icon="view_kanban" className="text-[#b91c1c]" /> Customer Success
          </h1>
          <p className="text-sm text-[#4a3d3d] mt-1">
            O que precisa ser feito com cada franquia — arraste o cartão até o check.
          </p>
        </div>
        {tab === "mural" && (
          <Button size="sm" onClick={() => { setQuickAddFranchise(""); setQuickAddOpen(true); }}
            className="bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1">
            <MaterialIcon icon="add" size={16} /> Novo cartão
          </Button>
        )}
      </div>

      {/* Abas Mural / Radar */}
      <div className="flex gap-2">
        {[{ key: "mural", label: "Mural", icon: "view_kanban" }, { key: "radar", label: "Radar da rede", icon: "radar" }].map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
              tab === tb.key
                ? "bg-[#b91c1c] text-white border-[#b91c1c]"
                : "bg-white text-[#4a3d3d] border-[#291715]/10 hover:border-[#b91c1c]/40"
            }`}
          >
            <MaterialIcon icon={tb.icon} size={16} /> {tb.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-[#4a3d3d]">
          <p>{error}</p>
          <button onClick={load} className="mt-3 text-[#b91c1c] font-semibold">Tentar novamente</button>
        </div>
      ) : tab === "mural" ? (
        <CsBoard tasks={tasks} signalsByFranchise={signalsByFranchise} onOpen={openTask} onMoveTask={onMoveTask} />
      ) : (
        <CsRadarPanel rows={signals} openCardIds={openCardIds} onCreateCard={createCardFor} onOpenPreview={openPreview} />
      )}

      <FranchiseDrawer
        task={selectedTask}
        row={drawerRow}
        userId={user?.id}
        isAdmin={user?.role === "admin"}
        onClose={closeDrawer}
        onChanged={reloadTasks}
        onCreateCard={createCardFor}
      />

      <QuickAddCard
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        userId={user?.id}
        franchises={franchisesForAdd}
        defaultFranchiseId={quickAddFranchise}
        onCreated={() => { setTab("mural"); reloadTasks(); }}
      />
    </div>
  );
}
