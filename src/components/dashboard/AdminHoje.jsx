import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, subMonths, getDaysInMonth } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { getNetworkFunnelBenchmark, getCsTasks } from "@/entities/all";
import { useAdminNetworkOverview } from "@/hooks/useAdminNetworkOverview";
import { resumoRede, FILTROS, mesesVerba } from "@/lib/networkOverview";
import { useAdminPendingCounts } from "@/hooks/useAdminPendingCounts";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { Skeleton } from "@/components/ui/skeleton";
import NotificationBell from "@/components/ui/NotificationBell";
import { saudacao, dataExtenso } from "./hoje/hojeFormat";
import { primeiroNome } from "@/lib/adminFormat";
import ResumoRedeCards from "./hoje/ResumoRedeCards";
import QuemPrecisaDeVoce from "./hoje/QuemPrecisaDeVoce";
import PendenciasGrid from "./hoje/PendenciasGrid";
import MuralResumoCard from "./hoje/MuralResumoCard";
import ErrorState from "@/components/shared/ErrorState";
import { H1, PAGINA } from "@/components/shared/adminUi";

// Nova home do admin/gerente/CS (substitui AdminDashboard — Fase 1 do redesenho,
// plano ~/.claude/plans/admin-redesign-2026-09-26.md). A overview (get_admin_network_overview)
// é COMPARTILHADA com Unidades via react-query (useAdminNetworkOverview, queryKey
// ['admin-overview']) — trocar de tela não rebaixa os ~50 KB de novo. Pendências/mural/funil
// são secundárias e não travam a tela — cada uma tem seu próprio loading/erro, e o funil fica
// FORA do polling de 5 min da principal (staleTime próprio; a base do mês anterior é fixa).
export default function AdminHoje() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const {
    overview,
    isLoading,
    error: loadError,
    refetch,
  } = useAdminNetworkOverview({ refetchInterval: 300000 });
  const { pending } = useAdminPendingCounts();

  const now = new Date();
  const curStart = format(startOfMonth(now), "yyyy-MM-dd");
  const curEnd = format(now, "yyyy-MM-dd");
  const prevMonthRef = subMonths(now, 1);
  const prevStart = format(startOfMonth(prevMonthRef), "yyyy-MM-dd");
  const prevEndDay = Math.min(now.getDate(), getDaysInMonth(prevMonthRef));
  const prevEnd = format(new Date(prevMonthRef.getFullYear(), prevMonthRef.getMonth(), prevEndDay), "yyyy-MM-dd");

  // Mês até hoje: pode ficar velho depois de 30 min (ninguém percebe a diferença de 1 venda).
  const funilAtualQuery = useQuery({
    queryKey: ["funil-rede", curStart, curEnd],
    queryFn: () => getNetworkFunnelBenchmark(curStart, curEnd),
    staleTime: 30 * 60 * 1000,
  });
  // Mesmo trecho do mês anterior: nunca muda depois de calculado uma vez.
  const funilAnteriorQuery = useQuery({
    queryKey: ["funil-rede", prevStart, prevEnd],
    queryFn: () => getNetworkFunnelBenchmark(prevStart, prevEnd),
    staleTime: Infinity,
  });
  const funilErro = funilAtualQuery.error || funilAnteriorQuery.error;
  const funil = {
    isLoading: funilAtualQuery.isLoading || funilAnteriorQuery.isLoading,
    error: funilErro ? safeErrorMessage(funilErro, "Erro") : null,
    pct: funilAtualQuery.data?.network_conversion_pct != null ? Number(funilAtualQuery.data.network_conversion_pct) : null,
    prevPct:
      funilAnteriorQuery.data?.network_conversion_pct != null ? Number(funilAnteriorQuery.data.network_conversion_pct) : null,
    // network_reached (item 40, supabase/2026-09-26-admin-13-funil-total-pessoas.sql):
    // coluna nova, ainda NÃO aplicada — vem undefined até lá, e o card some com o "· N
    // pessoas" sozinho (front tolerante, decisão 4 do orquestrador).
    pessoas: funilAtualQuery.data?.network_reached != null ? Number(funilAtualQuery.data.network_reached) : null,
  };

  // Mural: secundária, não trava a tela principal. `assignee` entrou em 26/09 (item 35)
  // para dar "resolvidas em 30 dias" e "sem responsável" — sem ele o Nelson não via se o
  // CS está andando.
  const muralQuery = useQuery({
    queryKey: ["cs-tasks-resumo-hoje"],
    queryFn: ({ signal }) => getCsTasks({ columns: "franchise_id,column_status,moved_to_column_at,assignee", signal }),
    staleTime: 60 * 1000,
  });
  const mural = {
    isLoading: muralQuery.isLoading,
    error: muralQuery.error ? safeErrorMessage(muralQuery.error, "Erro") : null,
    tasks: muralQuery.data || [],
  };

  const resumo = useMemo(() => resumoRede(overview), [overview]);
  const semVerbaCount = useMemo(() => overview.filter(FILTROS.sem_verba.match).length, [overview]);

  const nome = primeiroNome(user?.full_name);

  if (isLoading) {
    return (
      <div className={PAGINA}>
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
      <div className={PAGINA}>
        <ErrorState texto={safeErrorMessage(loadError, "Erro ao carregar o painel")} onTentarNovamente={() => refetch()} cartao />
      </div>
    );
  }

  return (
    <div className={PAGINA}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-3">{dataExtenso()}</p>
          <h1 className={`${H1} mt-1`}>
            {saudacao()}, {nome}. Veja quem precisa de você hoje.
          </h1>
        </div>
        {/* A barra do topo some nesta tela no computador; o sino vem para cá. No celular ele já está na barra. */}
        <div className="hidden md:block shrink-0 pt-1">
          <NotificationBell size={20} />
        </div>
      </header>

      <ResumoRedeCards resumo={resumo} funil={funil} mes={mesesVerba(overview)?.mes} />

      <QuemPrecisaDeVoce overview={overview} />

      {isAdmin && <PendenciasGrid pending={pending} semVerbaCount={semVerbaCount} overview={overview} />}

      <MuralResumoCard mural={mural} />
    </div>
  );
}
