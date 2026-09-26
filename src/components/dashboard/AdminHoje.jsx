import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format, startOfMonth, subMonths, getDaysInMonth } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { getAdminNetworkOverview, getNetworkFunnelBenchmark, getCsTasks } from "@/entities/all";
import { resumoRede, FILTROS } from "@/lib/networkOverview";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useAdminPendingCounts } from "@/hooks/useAdminPendingCounts";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import NotificationBell from "@/components/ui/NotificationBell";
import { saudacao, primeiroNome, dataExtenso } from "./hoje/hojeFormat";
import ResumoRedeCards from "./hoje/ResumoRedeCards";
import QuemPrecisaDeVoce from "./hoje/QuemPrecisaDeVoce";
import PendenciasGrid from "./hoje/PendenciasGrid";
import MuralResumoCard from "./hoje/MuralResumoCard";

// Nova home do admin/gerente/CS (substitui AdminDashboard — Fase 1 do redesenho,
// plano ~/.claude/plans/admin-redesign-2026-09-26.md). Uma consulta principal
// (get_admin_network_overview); pendências/mural/funil são secundárias e não travam
// a tela — cada uma tem seu próprio loading/erro.
export default function AdminHoje() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [overview, setOverview] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { pending } = useAdminPendingCounts();
  const [funil, setFunil] = useState({ isLoading: true, error: null, pct: null, prevPct: null });
  const [mural, setMural] = useState({ isLoading: true, error: null, tasks: [] });
  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const temDadosRef = useRef(false);

  // silent (atualização automática): se falhar com dados já na tela, mantém o que está
  // lá em vez de trocar tudo pela tela de erro.
  const carregarPrincipal = useCallback(async ({ silent = false } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    if (!silent) setLoadError(null);
    try {
      const rows = await getAdminNetworkOverview({ signal });
      if (!mountedRef.current || signal.aborted) return;
      temDadosRef.current = true;
      setOverview(rows);
      setLoadError(null);
      setIsLoading(false);
    } catch (err) {
      if (err?.name === "AbortError" || signal.aborted) return;
      if (!mountedRef.current) return;
      if (silent && temDadosRef.current) return;
      setLoadError(safeErrorMessage(err, "Erro ao carregar o painel"));
      setIsLoading(false);
    }
  }, []);

  // Mural: secundária, não trava a tela principal. Pendências vêm do hook
  // useAdminPendingCounts (react-query já cuida do cache/refetch dele).
  const carregarMural = useCallback(async () => {
    setMural((s) => ({ ...s, isLoading: true }));
    try {
      const tasks = await getCsTasks();
      if (mountedRef.current) setMural({ isLoading: false, error: null, tasks });
    } catch (err) {
      if (mountedRef.current) setMural({ isLoading: false, error: safeErrorMessage(err, "Erro"), tasks: [] });
    }
  }, []);

  // Funil da rede: mês até hoje × mesmo trecho do mês anterior, em pontos. Carrega
  // DEPOIS da principal e não bloqueia — falha vira "indisponível agora", sem toast.
  const carregarFunil = useCallback(async () => {
    setFunil((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const now = new Date();
      const curStart = format(startOfMonth(now), "yyyy-MM-dd");
      const curEnd = format(now, "yyyy-MM-dd");

      const prevMonthRef = subMonths(now, 1);
      const prevStart = startOfMonth(prevMonthRef);
      const prevEndDay = Math.min(now.getDate(), getDaysInMonth(prevMonthRef));
      const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevEndDay);

      const [atual, anterior] = await Promise.all([
        getNetworkFunnelBenchmark(curStart, curEnd),
        getNetworkFunnelBenchmark(format(prevStart, "yyyy-MM-dd"), format(prevEnd, "yyyy-MM-dd")),
      ]);
      if (!mountedRef.current) return;
      setFunil({
        isLoading: false,
        error: null,
        pct: atual?.network_conversion_pct != null ? Number(atual.network_conversion_pct) : null,
        prevPct: anterior?.network_conversion_pct != null ? Number(anterior.network_conversion_pct) : null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setFunil({ isLoading: false, error: safeErrorMessage(err, "Erro"), pct: null, prevPct: null });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    carregarPrincipal();
    carregarMural();
    carregarFunil();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza em background a cada 5 min — sem polling pesado, só a consulta principal
  // (mural/funil reusam o mesmo ciclo pra não desincronizar; pendências têm seu
  // próprio refetch via react-query).
  useVisibilityPolling(() => {
    carregarPrincipal({ silent: true });
    carregarMural();
    carregarFunil();
  }, 300000);

  const resumo = useMemo(() => resumoRede(overview), [overview]);
  const semVerbaCount = useMemo(() => overview.filter(FILTROS.sem_verba.match).length, [overview]);

  const nome = primeiroNome(user?.full_name);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6 bg-surface">
        <Skeleton className="h-16 w-2/3 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-8 bg-surface">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <MaterialIcon icon="cloud_off" className="text-5xl text-ink-3" />
          <p className="text-ink-2 text-center">{loadError}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              carregarPrincipal();
            }}
            className="mt-2 px-4 py-2 border border-ink-4 rounded-lg text-sm text-ink-2 hover:bg-white flex items-center gap-2"
          >
            <MaterialIcon icon="refresh" size={16} />
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-7 bg-surface max-w-[1400px] mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
        <p className="text-sm text-ink-3">{dataExtenso()}</p>
        <h1 className="font-plus-jakarta text-2xl md:text-[32px] font-extrabold text-ink tracking-tight mt-1">
          {saudacao()}, {nome}. Veja quem precisa de você hoje.
        </h1>
        </div>
        {/* A barra do topo some nesta tela no computador; o sino vem para cá. No celular ele já está na barra. */}
        <div className="hidden md:block shrink-0 pt-1">
          <NotificationBell size={20} />
        </div>
      </header>

      <ResumoRedeCards resumo={resumo} funil={funil} />

      <QuemPrecisaDeVoce overview={overview} />

      {isAdmin && <PendenciasGrid pending={pending} semVerbaCount={semVerbaCount} />}

      <MuralResumoCard mural={mural} />
    </div>
  );
}
