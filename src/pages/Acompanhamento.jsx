import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useNavigate } from "react-router-dom";
import {
  Franchise, User, Sale, InventoryItem, PurchaseOrder,
  OnboardingChecklist, FranchiseConfiguration, DailyChecklist, FranchiseNote
} from "@/entities/all";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { calculateFranchiseHealth, STATUS_COLORS, STATUS_LABELS } from "@/lib/healthScore";
import HealthScoreBar from "@/components/acompanhamento/HealthScoreBar";
import FranchiseHealthDetail from "@/components/acompanhamento/FranchiseHealthDetail";

export default function Acompanhamento() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [healthScores, setHealthScores] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const user = await User.me();
      if (!mountedRef.current) return;
      setCurrentUser(user);

      if (user.role !== "admin" && user.role !== "manager") {
        setIsLoading(false);
        return;
      }

      const results = await Promise.allSettled([
          Franchise.list(),
          Sale.list("-created_at", 1000),
          InventoryItem.list("franchise_id", null, { range: [0, 4999] }),
          PurchaseOrder.list("-ordered_at", 500),
          OnboardingChecklist.list("franchise_id", 200),
          FranchiseConfiguration.list("franchise_evolution_instance_id", 200),
          DailyChecklist.list("-date", 500),
          FranchiseNote.list("-created_at", 500),
        ]);

      if (!mountedRef.current) return;

      const getValue = (r) => r.status === "fulfilled" ? r.value : [];
      const allFranchises = getValue(results[0]);
      const sales = getValue(results[1]);
      const inventory = getValue(results[2]);
      const orders = getValue(results[3]);
      const onboarding = getValue(results[4]);
      const configs = getValue(results[5]);
      const checklists = getValue(results[6]);
      const notes = getValue(results[7]);

      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["franchises","sales","inventory","orders","onboarding","configs","checklists","notes"][i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      // Franchises is critical
      if (results[0].status === "rejected") {
        setLoadError("Erro ao carregar franquias. Tente novamente.");
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      const data = { sales, inventory, orders, onboarding, configs, checklists };

      const scores = allFranchises.map((franchise) => ({
        franchise,
        health: calculateFranchiseHealth(franchise, data),
      }));

      // Default sort: worst score first
      scores.sort((a, b) => a.health.total - b.health.total);

      setFranchises(allFranchises);
      setHealthScores(scores);
      setAllNotes(notes);
      setAllInventory(inventory);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      if (mountedRef.current) {
        setLoadError(error.message || "Erro ao carregar dados");
        toast.error(error.message || "Erro ao carregar dados de acompanhamento");
      }
    }
    if (mountedRef.current) setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling inteligente: só refaz queries quando a aba está visível
  useVisibilityPolling(loadData, 300000);

  // Summary metrics
  const metrics = useMemo(() => {
    const criticos = healthScores.filter((s) => s.health.status === "critico").length;
    const atencao = healthScores.filter((s) => s.health.status === "atencao").length;
    const saudaveis = healthScores.filter((s) => s.health.status === "saudavel").length;
    const novas = healthScores.filter((s) => s.health.status === "nova").length;
    const avg = healthScores.length
      ? Math.round(healthScores.reduce((sum, s) => sum + s.health.total, 0) / healthScores.length)
      : 0;
    return { criticos, atencao, saudaveis, novas, avg };
  }, [healthScores]);

  // Filtered + sorted list
  const filteredList = useMemo(() => {
    let list = [...healthScores];

    // Search
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (s) =>
          s.franchise.owner_name?.toLowerCase().includes(q) ||
          s.franchise.city?.toLowerCase().includes(q) ||
          s.franchise.name?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      list = list.filter((s) => s.health.status === filterStatus);
    }

    // Sort
    if (sortBy === "score") {
      list.sort((a, b) => a.health.total - b.health.total);
    } else if (sortBy === "lastSale") {
      list.sort((a, b) => {
        const aDays = a.health.dimensions.vendas.daysSince ?? 999;
        const bDays = b.health.dimensions.vendas.daysSince ?? 999;
        return bDays - aDays;
      });
    } else if (sortBy === "lastOrder") {
      list.sort((a, b) => {
        const aDays = a.health.dimensions.reposicao.daysSince ?? 999;
        const bDays = b.health.dimensions.reposicao.daysSince ?? 999;
        return bDays - aDays;
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.franchise.name || "").localeCompare(b.franchise.name || ""));
    }

    return list;
  }, [healthScores, searchText, filterStatus, sortBy]);

  function handleToggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function getNotesForFranchise(franchiseId) {
    return allNotes.filter((n) => n.franchise_id === franchiseId);
  }

  // Access control
  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "manager") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "#dc2626" }}>Acesso Negado</h1>
        <p className="mt-2" style={{ color: "#4a3d3d" }}>Apenas administradores e gerentes podem acessar esta página.</p>
        <Button className="mt-4" onClick={() => navigate(createPageUrl("Dashboard"))}>
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  // Error state
  if (loadError && !isLoading) {
    return (
      <div className="p-8 text-center">
        <MaterialIcon icon="error_outline" className="text-4xl mx-auto mb-3" style={{ color: "#dc2626" }} />
        <h2 className="text-lg font-semibold" style={{ color: "#1b1c1d" }}>Erro ao carregar dados</h2>
        <p className="mt-1 text-sm" style={{ color: "#4a3d3d" }}>{loadError}</p>
        <Button className="mt-4" onClick={loadData}>Tentar novamente</Button>
      </div>
    );
  }

  const summaryCards = [
    { label: "Críticos", icon: "warning", count: metrics.criticos, status: "critico" },
    { label: "Atenção", icon: "info", count: metrics.atencao, status: "atencao" },
    { label: "Saudáveis", icon: "check_circle", count: metrics.saudaveis, status: "saudavel" },
    { label: "Novas", icon: "fiber_new", count: metrics.novas, status: "nova" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-2xl sm:text-3xl font-bold font-plus-jakarta flex items-center gap-3" style={{ color: "#1b1c1d" }}>
            <MaterialIcon icon="monitoring" size={28} className="shrink-0" style={{ color: "#b91c1c" }} />
            Acompanhamento
          </h1>
          <p className="text-sm mt-1" style={{ color: "#4a3d3d" }}>
            Saúde das franquias · Atualizado às {format(lastRefresh, "HH:mm")}
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2 self-start sm:self-auto shrink-0">
          <MaterialIcon icon="refresh" size={16} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, icon, count, status }) => {
          const colors = STATUS_COLORS[status];
          return (
            <Card
              key={status}
              className="border cursor-pointer transition-colors"
              style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              onClick={() => setFilterStatus((prev) => (prev === status ? "all" : status))}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon icon={icon} size={20} style={{ color: colors.text }} />
                  <span className="text-sm font-medium" style={{ color: "#4a3d3d" }}>{label}</span>
                </div>
                <div className="text-2xl sm:text-4xl font-bold" style={{ color: colors.text }}>{count}</div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border" style={{ backgroundColor: "#fbf9fa", borderColor: "#e9e8e9" }}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon icon="monitoring" size={20} style={{ color: "#4a3d3d" }} />
              <span className="text-sm font-medium" style={{ color: "#4a3d3d" }}>Score Médio</span>
            </div>
            <div className="text-2xl sm:text-4xl font-bold" style={{ color: "#1b1c1d" }}>{metrics.avg}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border" style={{ borderColor: "#e9e8e9" }}>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <MaterialIcon icon="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#7a6d6d" }} />
            <Input
              placeholder="Buscar por nome ou cidade..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="critico">🔴 Críticos</SelectItem>
              <SelectItem value="atencao">🟡 Atenção</SelectItem>
              <SelectItem value="saudavel">🟢 Saudáveis</SelectItem>
              <SelectItem value="nova">🔵 Novas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Score (pior primeiro)</SelectItem>
              <SelectItem value="lastSale">Última venda</SelectItem>
              <SelectItem value="lastOrder">Último pedido</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Franchise List */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Card className="bg-white border overflow-hidden" style={{ borderColor: "#e9e8e9" }}>
          {filteredList.length === 0 ? (
            <div className="p-12 text-center" style={{ color: "#7a6d6d" }}>
              <MaterialIcon icon="search_off" className="text-4xl mx-auto mb-2" />
              <p>Nenhum franqueado encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#e9e8e9" }}>
              {filteredList.map(({ franchise, health }) => {
                const isExpanded = expandedId === franchise.id;
                const colors = STATUS_COLORS[health.status];
                const dimensionBars = [
                  { label: "Vendas", score: health.dimensions.vendas.score },
                  { label: "Estoque", score: health.dimensions.estoque.score },
                  { label: "Pedidos", score: health.dimensions.reposicao.score },
                  { label: "Setup", score: health.dimensions.setup.score },
                ];

                return (
                  <div key={franchise.id}>
                    {/* Row */}
                    <div
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer hover:bg-[#fbf9fa] transition-colors"
                      onClick={() => handleToggleExpand(franchise.id)}
                    >
                      {/* Score badge */}
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: colors.bg, border: `1.5px solid ${colors.border}` }}
                      >
                        <span className="text-lg sm:text-xl font-bold" style={{ color: colors.text }}>
                          {health.total}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate" style={{ color: "#1b1c1d" }}>
                            {franchise.name}
                          </span>
                          <span className="text-sm shrink-0" style={{ color: "#7a6d6d" }}>
                            · {franchise.city}
                          </span>
                          {franchise.owner_name && (
                            <span className="text-xs shrink-0 hidden sm:inline" style={{ color: "#7a6d6d" }}>
                              — {franchise.owner_name}
                            </span>
                          )}
                          {health.isNew && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ backgroundColor: STATUS_COLORS.nova.bg, color: STATUS_COLORS.nova.text }}
                            >
                              NOVA
                            </span>
                          )}
                        </div>

                        {/* Mini bars - hidden on small mobile */}
                        <div className="hidden sm:flex items-center gap-3 mt-1.5">
                          {dimensionBars.map((d) => (
                            <HealthScoreBar key={d.label} label={d.label} score={d.score} />
                          ))}
                        </div>

                        {/* Problem summary */}
                        {health.problems.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: "#4a3d3d" }}>
                            <MaterialIcon icon="warning" className="text-sm" style={{ color: "#d97706" }} />
                            <span className="truncate">{health.problems.join(" · ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <MaterialIcon
                        icon={isExpanded ? "expand_less" : "expand_more"}
                        className="text-xl shrink-0"
                        style={{ color: "#7a6d6d" }}
                      />
                    </div>

                    {/* Drill-down */}
                    {isExpanded && (
                      <FranchiseHealthDetail
                        franchise={franchise}
                        healthData={health}
                        notes={getNotesForFranchise(franchise.id)}
                        currentUserId={currentUser?.id}
                        currentUserName={currentUser?.full_name}
                        onNoteAdded={loadData}
                        inventoryItems={allInventory.filter(
                          (i) => i.franchise_id === franchise.evolution_instance_id
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Skeleton cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border" style={{ borderColor: "#e9e8e9" }}>
            <CardContent className="p-5">
              <div className="h-4 w-20 rounded bg-[#e9e8e9] animate-pulse mb-2" />
              <div className="h-8 w-12 rounded bg-[#e9e8e9] animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Skeleton rows */}
      <Card className="border" style={{ borderColor: "#e9e8e9" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b" style={{ borderColor: "#e9e8e9" }}>
            <div className="w-14 h-14 rounded-xl bg-[#e9e8e9] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-[#e9e8e9] animate-pulse" />
              <div className="h-3 w-60 rounded bg-[#e9e8e9] animate-pulse" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
