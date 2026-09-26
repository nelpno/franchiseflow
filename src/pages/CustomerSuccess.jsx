import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/AuthContext";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { getFranchiseHealthCache, getCsFranchiseContacts, getCsTasks, moveCsTask, reconcileCsAutoTasks, getNetworkFunnelRanking } from "@/entities/all";
import NetworkFunnelPanel from "@/components/dashboard/NetworkFunnelPanel";
import { format, startOfMonth } from "date-fns";
import FranchiseDrawer from "@/components/customer-success/FranchiseDrawer";
import CsBoard from "@/components/customer-success/CsBoard";
import CsRadarPanel from "@/components/customer-success/CsRadarPanel";
import QuickAddCard from "@/components/customer-success/QuickAddCard";
import PageHeader from "@/components/shared/PageHeader";
import { PAGINA_LARGA, BTN_PRIMARIO } from "@/components/shared/adminUi";

// Cache da saúde da rede mais velho que isto → reconcilia em segundo plano ao abrir o Mural.
const CACHE_VELHO_MS = 30 * 60 * 1000;

export default function CustomerSuccess() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [signals, setSignals] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("mural");
  const [selectedTask, setSelectedTask] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddFranchise, setQuickAddFranchise] = useState("");
  // Funil da rede — lazy: a RPC custa ~230ms varrendo todas as franquias, então só
  // carrega quando a aba é aberta (e uma vez só).
  const [funnel, setFunnel] = useState({ rows: [], loading: false, error: null, fetched: false });
  const funnelFetchingRef = useRef(false);

  const loadFunnel = useCallback(async () => {
    if (funnelFetchingRef.current || funnel.fetched) return;
    funnelFetchingRef.current = true;
    setFunnel((s) => ({ ...s, loading: true, error: null }));
    try {
      const rows = await getNetworkFunnelRanking(
        format(startOfMonth(new Date()), "yyyy-MM-dd"),
        format(new Date(), "yyyy-MM-dd")
      );
      setFunnel({ rows, loading: false, error: null, fetched: true });
    } catch (err) {
      setFunnel({ rows: [], loading: false, error: safeErrorMessage(err, "Erro ao carregar o funil"), fetched: false });
    } finally {
      funnelFetchingRef.current = false;
    }
  }, [funnel.fetched]);

  useEffect(() => { if (tab === "funil") loadFunnel(); }, [tab, loadFunnel]);
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

  // Reconciliação em segundo plano: roda a saúde da rede ao vivo (~5 s), regrava o cache e
  // abre/fecha os cartões automáticos. A tela já está desenhada com o cache; ao terminar,
  // recarrega cartões + cache. Uma por vez.
  const reconcilingRef = useRef(false);
  const reconcileEmSegundoPlano = useCallback(async () => {
    if (reconcilingRef.current) return;
    reconcilingRef.current = true;
    try {
      await reconcileCsAutoTasks();
      const [t, s] = await Promise.all([getCsTasks(), getFranchiseHealthCache()]);
      if (mountedRef.current) { setTasks(t); setSignals(s); }
    } catch (e) {
      console.warn("[CustomerSuccess] reconcile", e);
    } finally {
      reconcilingRef.current = false;
    }
  }, []);

  // Carga: cartões + saúde da rede pelo CACHE (franchise_health_cache), sem esperar o
  // recálculo. Só reconcilia (em segundo plano) quando o cache tem mais de 30 min.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // contatos em paralelo: sem dono e telefone, o Celso abre o cartao e ainda
      // precisa procurar em outra tela com quem falar (auditoria 07/09/2026)
      const [t, s, c] = await Promise.all([
        getCsTasks(),
        getFranchiseHealthCache(),
        getCsFranchiseContacts().catch(() => []),
      ]);
      if (mountedRef.current) { setTasks(t); setSignals(s); setContatos(c); }
      const maisNovo = s.reduce((mx, r) => Math.max(mx, Date.parse(r.computed_at) || 0), 0);
      if (!maisNovo || Date.now() - maisNovo > CACHE_VELHO_MS) reconcileEmSegundoPlano();
    } catch (e) {
      console.error("[CustomerSuccess] load", e);
      if (mountedRef.current) setError("Não foi possível carregar o mural. Tente novamente.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [reconcileEmSegundoPlano]);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(reloadTasks, 300000);

  const contatosByFranchise = useMemo(
    () => Object.fromEntries((contatos || []).map((c) => [c.franchise_id, c])),
    [contatos],
  );

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
      .sort((a, b) => (a.franchise_name || "").localeCompare(b.franchise_name || "")),
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

  // Chegada por link: /CustomerSuccess?task=<id> (abre o cartão) ou ?unidade=<evo>
  // (abre o cartão aberto da unidade, ou o preview do Radar se não houver nenhum).
  // Antes a Ficha e o FranchiseDrawer linkavam pra cá sem nenhum parâmetro — o Mural
  // abria inteiro, sem o cartão daquela unidade (achado MÉDIO, 26/09).
  const paramsAplicadosRef = useRef(false);
  useEffect(() => {
    if (loading || paramsAplicadosRef.current) return;
    const taskParam = searchParams.get("task");
    const unidadeParam = searchParams.get("unidade");
    if (!taskParam && !unidadeParam) return;
    paramsAplicadosRef.current = true;
    if (taskParam) {
      const t = tasks.find((x) => x.id === taskParam);
      if (t) openTask(t);
    } else if (unidadeParam) {
      const abertaDaUnidade = tasks.find((t) => t.franchise_id === unidadeParam && t.column_status !== "feito");
      if (abertaDaUnidade) {
        openTask(abertaDaUnidade);
      } else {
        // Sem cartão aberto: o link "Ver histórico →" da Ficha (ConversasCard) promete
        // mostrar os cartões já resolvidos — o preview do Radar não tem seção de
        // histórico (events só existe com task), então abrir o último "feito" da
        // unidade é o que de fato cumpre a promessa (achado MÉDIO, 26/09).
        const resolvidos = tasks
          .filter((t) => t.franchise_id === unidadeParam && t.column_status === "feito")
          .sort((a, b) => new Date(b.resolved_at || b.moved_to_column_at || 0) - new Date(a.resolved_at || a.moved_to_column_at || 0));
        if (resolvidos[0]) {
          openTask(resolvidos[0]);
        } else if (signalsByFranchise[unidadeParam]) {
          openPreview(signalsByFranchise[unidadeParam]);
        }
      }
    }
    // Limpa o parâmetro: um F5 depois, ou o polling recarregando a lista, não deve
    // reabrir o mesmo cartão sozinho.
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    next.delete("unidade");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tasks, signalsByFranchise]);

  return (
    <div className={PAGINA_LARGA}>
      <PageHeader
        titulo="Mural do CS"
        subtitulo="Cada cartão é uma unidade que estamos acompanhando. Fale, registre e marque quando resolver."
        acao={
          tab === "mural" && (
            <button
              type="button"
              onClick={() => { setQuickAddFranchise(""); setQuickAddOpen(true); }}
              className={`${BTN_PRIMARIO} h-11`}
            >
              <MaterialIcon icon="add" size={18} aria-hidden="true" />
              Novo cartão
            </button>
          )
        }
      />

      {/* Abas Mural / Radar */}
      <div className="flex gap-2">
        {[{ key: "mural", label: "Mural", icon: "view_kanban" }, { key: "radar", label: "Radar da rede", icon: "radar" }, { key: "funil", label: "Funil", icon: "filter_alt" }].map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
              tab === tb.key
                ? "bg-brand text-white border-brand"
                : "bg-white text-ink-2 border-ink-shadow/10 hover:border-brand/40"
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
        <div className="text-center py-12 text-ink-2">
          <p>{error}</p>
          <button onClick={load} className="mt-3 text-brand font-semibold">Tentar novamente</button>
        </div>
      ) : tab === "mural" ? (
        <CsBoard tasks={tasks} signalsByFranchise={signalsByFranchise} onOpen={openTask} onMoveTask={onMoveTask} />
      ) : tab === "funil" ? (
        funnel.loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : funnel.error ? (
          <div className="text-center py-12 text-ink-2">
            <p>{funnel.error}</p>
            <button onClick={loadFunnel} className="mt-3 text-brand font-semibold">Tentar novamente</button>
          </div>
        ) : (
          <NetworkFunnelPanel rows={funnel.rows} />
        )
      ) : (
        <CsRadarPanel rows={signals} openCardIds={openCardIds} onCreateCard={createCardFor} onOpenPreview={openPreview} />
      )}

      <FranchiseDrawer
        task={selectedTask}
        row={drawerRow}
        contato={selectedTask?.franchise_id ? contatosByFranchise[selectedTask.franchise_id] : null}
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
