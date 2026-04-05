import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BotConversation, Franchise, FranchiseConfiguration } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { getAvailableFranchises } from "@/lib/franchiseUtils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Translation maps ---
const ABANDON_REASON_LABELS = {
  preco: "Preço",
  frete: "Frete",
  indisponivel: "Indisponível",
  demora: "Demora",
  confuso: "Bot confuso",
  sem_resposta: "Sem resposta",
  preferiu_humano: "Preferiu humano",
  outro: "Outro",
};

const INTENT_LABELS = {
  compra: "Comprar",
  duvida_produto: "Dúvida produto",
  duvida_entrega: "Dúvida entrega",
  reclamacao: "Reclamação",
  preparo_faq: "Modo de preparo",
  preco: "Preço",
  catalogo: "Catálogo",
  saudacao: "Saudação",
  outro: "Outro",
};

const SENTIMENT_LABELS = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
  frustrado: "Frustrado",
};

const STATUS_LABELS = {
  started: "Iniciadas",
  catalog_sent: "Catálogo Enviado",
  items_discussed: "Itens Discutidos",
  checkout_started: "Checkout",
  converted: "Convertidas",
  abandoned: "Abandonadas",
  escalated: "Escaladas",
};

const FUNNEL_STATUSES = [
  "started",
  "catalog_sent",
  "checkout_started",
  "converted",
  "abandoned",
  "escalated",
];

const FUNNEL_COLORS = ["#b91c1c", "#c53030", "#d4af37", "#16a34a", "#6b7280", "#775a19"];

const OUTCOME_LABELS = {
  converted: "Convertida",
  abandoned: "Abandonada",
  escalated: "Escalada",
  informational: "Informativa",
  ongoing: "Em andamento",
};

// --- Score color helper ---
function scoreColor(score) {
  if (score === null || score === undefined) return "#7a6d6d";
  if (score >= 8) return "#16a34a";
  if (score >= 5) return "#d4af37";
  return "#dc2626";
}

// --- Skeleton ---
function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-[#e9e8e9] rounded ${className}`} />
  );
}

// --- KPI Card ---
function KpiCard({ icon, label, value, suffix = "", color = "#b91c1c", loading }) {
  return (
    <Card className="border border-[#e9e8e9] shadow-sm">
      <CardContent className="p-4">
        {loading ? (
          <>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon icon={icon} className="text-base" style={{ color }} />
              <p className="text-xs text-[#7a6d6d] font-medium">{label}</p>
            </div>
            <p className="text-2xl font-bold font-plus-jakarta" style={{ color: "#1b1c1d" }}>
              {value}
              {suffix && <span className="text-sm ml-1 text-[#7a6d6d]">{suffix}</span>}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Custom Tooltip for Recharts ---
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-[#e9e8e9] rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-[#1b1c1d] mb-1">{label}</p>
      <p className="text-[#4a3d3d]">{payload[0].value} conversas</p>
    </div>
  );
}

// --- Main component ---
export default function BotIntelligence() {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("todas");
  const [franchises, setFranchises] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Drill-down sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFranchise, setSheetFranchise] = useState(null);
  const [sheetConvs, setSheetConvs] = useState([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load franchises once
  useEffect(() => {
    const load = async () => {
      try {
        const [fr, cf] = await Promise.allSettled([
          Franchise.list(),
          FranchiseConfiguration.list(),
        ]);
        if (!mountedRef.current) return;
        setFranchises(fr.status === "fulfilled" ? fr.value : []);
        setConfigs(cf.status === "fulfilled" ? cf.value : []);
      } catch (e) {
        // non-critical
      }
    };
    load();
  }, []);

  const availableFranchises = useMemo(
    () => getAvailableFranchises(franchises, user),
    [franchises, user]
  );

  // Load conversations on month/franchise change
  const loadData = useCallback(async () => {
    if (!mountedRef.current) return;
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setIsLoading(true);
    setLoadError(null);

    try {
      const start = startOfMonth(selectedMonth).toISOString();
      const end = endOfMonth(selectedMonth).toISOString();

      // Filter by franchise if selected
      let filterParams = {};
      if (selectedFranchiseId !== "todas") {
        // Find the evo_id from the selected franchise UUID
        const cfg = configs.find(
          (c) => c.franchise_id === selectedFranchiseId || c.franchise_evolution_instance_id === selectedFranchiseId
        );
        if (cfg) filterParams.franchise_id = cfg.franchise_evolution_instance_id;
      }

      // Fetch all classified conversations for the month
      const all = await BotConversation.list("-started_at", 2000);
      if (!mountedRef.current) return;

      // Filter client-side: processed_at not null + within month
      const filtered = all.filter((c) => {
        if (!c.processed_at) return false;
        const started = c.started_at || c.created_at;
        if (!started) return false;
        const d = new Date(started);
        return d >= new Date(start) && d <= new Date(end);
      });

      // If franchise filter active, filter by franchise_id
      const result =
        selectedFranchiseId !== "todas"
          ? filtered.filter((c) => {
              if (filterParams.franchise_id) {
                return c.franchise_id === filterParams.franchise_id;
              }
              return true;
            })
          : filtered;

      if (!mountedRef.current) return;
      setConversations(result);
    } catch (e) {
      if (e.name === "AbortError") return;
      if (!mountedRef.current) return;
      setLoadError(e.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar inteligência do bot");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [selectedMonth, selectedFranchiseId, configs]);

  useEffect(() => {
    if (configs.length > 0 || selectedFranchiseId === "todas") loadData();
  }, [loadData]);

  // --- Computed analytics ---
  const analytics = useMemo(() => {
    if (!conversations.length) return null;

    const total = conversations.length;
    const converted = conversations.filter((c) => c.outcome === "converted").length;
    const escalated = conversations.filter((c) => c.outcome === "escalated").length;
    const scores = conversations
      .map((c) => c.quality_score)
      .filter((s) => s !== null && s !== undefined);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const conversionRate = total ? ((converted / total) * 100).toFixed(1) : "0.0";
    const humanResolutionRate = total
      ? (((total - escalated) / total) * 100).toFixed(1)
      : "0.0";

    // Funnel
    const funnelData = FUNNEL_STATUSES.map((s) => ({
      status: s,
      label: STATUS_LABELS[s],
      count: conversations.filter((c) => c.status === s).length,
    }));

    // Abandon reasons
    const abandonMap = {};
    conversations.forEach((c) => {
      if (c.llm_abandon_reason) {
        const key = c.llm_abandon_reason;
        abandonMap[key] = (abandonMap[key] || 0) + 1;
      }
    });
    const abandonData = Object.entries(abandonMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => ({
        key,
        label: ABANDON_REASON_LABELS[key] || key,
        count,
      }));

    // Intents
    const intentMap = {};
    conversations.forEach((c) => {
      if (c.intent) {
        const key = c.intent;
        intentMap[key] = (intentMap[key] || 0) + 1;
      }
    });
    const intentData = Object.entries(intentMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => ({
        key,
        label: INTENT_LABELS[key] || key,
        count,
      }));

    // Topics
    const topicMap = {};
    conversations.forEach((c) => {
      if (Array.isArray(c.topics)) {
        c.topics.forEach((t) => {
          topicMap[t] = (topicMap[t] || 0) + 1;
        });
      }
    });
    const topicsData = Object.entries(topicMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Ranking by franchise
    const franchiseMap = {};
    conversations.forEach((c) => {
      const fid = c.franchise_id;
      if (!franchiseMap[fid]) {
        franchiseMap[fid] = {
          franchise_id: fid,
          total: 0,
          converted: 0,
          escalated: 0,
          scores: [],
          abandonReasons: {},
        };
      }
      franchiseMap[fid].total++;
      if (c.outcome === "converted") franchiseMap[fid].converted++;
      if (c.outcome === "escalated") franchiseMap[fid].escalated++;
      if (c.quality_score !== null && c.quality_score !== undefined)
        franchiseMap[fid].scores.push(c.quality_score);
      if (c.llm_abandon_reason) {
        const r = c.llm_abandon_reason;
        franchiseMap[fid].abandonReasons[r] = (franchiseMap[fid].abandonReasons[r] || 0) + 1;
      }
    });

    const rankingData = Object.values(franchiseMap)
      .map((f) => {
        const avgS =
          f.scores.length
            ? f.scores.reduce((a, b) => a + b, 0) / f.scores.length
            : null;
        const topAbandon = Object.entries(f.abandonReasons).sort((a, b) => b[1] - a[1])[0];
        // Find franchise name
        const cfg = configs.find(
          (c) => c.franchise_evolution_instance_id === f.franchise_id
        );
        const fr = franchises.find(
          (fr) => fr.id === cfg?.franchise_id
        );
        return {
          ...f,
          name: fr?.name || cfg?.franchise_name || f.franchise_id,
          avgScore: avgS,
          conversionRate: f.total ? ((f.converted / f.total) * 100).toFixed(1) : "0.0",
          humanRate: f.total
            ? (((f.total - f.escalated) / f.total) * 100).toFixed(1)
            : "0.0",
          topAbandon: topAbandon
            ? ABANDON_REASON_LABELS[topAbandon[0]] || topAbandon[0]
            : "—",
        };
      })
      .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

    return {
      total,
      converted,
      escalated,
      avgScore,
      conversionRate,
      humanResolutionRate,
      funnelData,
      abandonData,
      intentData,
      topicsData,
      rankingData,
    };
  }, [conversations, configs, franchises]);

  // --- Open drill-down sheet ---
  function openSheet(row) {
    setSheetFranchise(row);
    const last10 = conversations
      .filter((c) => c.franchise_id === row.franchise_id)
      .sort((a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at))
      .slice(0, 10);
    setSheetConvs(last10);
    setSheetOpen(true);
  }

  // --- Month navigation ---
  const prevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
  const nextMonth = () => setSelectedMonth((m) => addMonths(m, 1));
  const monthLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  // --- Retry ---
  const retry = () => loadData();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold font-plus-jakarta"
            style={{ color: "#1b1c1d" }}
          >
            Inteligência do Bot
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a6d6d" }}>
            Análise de conversas classificadas pelo sistema
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector */}
          <div className="flex items-center gap-1 border border-[#e9e8e9] rounded-lg bg-white px-2 py-1">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-[#fbf9fa] transition-colors"
              aria-label="Mês anterior"
            >
              <MaterialIcon icon="chevron_left" className="text-[#7a6d6d] text-base" />
            </button>
            <span className="text-sm font-medium text-[#1b1c1d] capitalize min-w-[130px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-[#fbf9fa] transition-colors"
              aria-label="Próximo mês"
            >
              <MaterialIcon icon="chevron_right" className="text-[#7a6d6d] text-base" />
            </button>
          </div>

          {/* Franchise selector */}
          <Select value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
            <SelectTrigger className="w-[180px] border-[#e9e8e9] bg-white text-sm">
              <SelectValue placeholder="Todas as franquias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as franquias</SelectItem>
              {availableFranchises
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"))
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {loadError && (
        <Card className="border-[#dc2626]/20 bg-[#dc2626]/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="error_outline" className="text-[#dc2626]" />
              <span className="text-sm text-[#dc2626]">{loadError}</span>
            </div>
            <Button variant="outline" size="sm" onClick={retry}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !loadError && !analytics && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <MaterialIcon icon="smart_toy" className="text-5xl text-[#e9e8e9]" />
          <p className="text-base font-semibold text-[#4a3d3d]">
            Nenhuma conversa classificada neste período
          </p>
          <p className="text-sm text-[#7a6d6d] text-center max-w-xs">
            As conversas são classificadas automaticamente pelo sistema após o encerramento.
            Verifique se o período selecionado possui conversas processadas.
          </p>
        </div>
      )}

      {/* Content */}
      {(isLoading || analytics) && (
        <>
          {/* Section 1 — KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              icon="conversion_path"
              label="Taxa de Conversão"
              value={isLoading ? "—" : `${analytics?.conversionRate}`}
              suffix="%"
              color="#b91c1c"
              loading={isLoading}
            />
            <KpiCard
              icon="support_agent"
              label="Resolução sem Humano"
              value={isLoading ? "—" : `${analytics?.humanResolutionRate}`}
              suffix="%"
              color="#16a34a"
              loading={isLoading}
            />
            <KpiCard
              icon="star"
              label="Score Médio"
              value={
                isLoading
                  ? "—"
                  : analytics?.avgScore !== null && analytics?.avgScore !== undefined
                  ? analytics.avgScore.toFixed(1)
                  : "—"
              }
              color="#d4af37"
              loading={isLoading}
            />
          </div>

          {/* Section 2 — Funil */}
          <Card className="border border-[#e9e8e9] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-base font-semibold font-plus-jakarta"
                style={{ color: "#1b1c1d" }}
              >
                Funil de Conversas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={analytics?.funnelData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 20, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9e8e9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#7a6d6d" }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={120}
                      tick={{ fontSize: 11, fill: "#4a3d3d" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {analytics?.funnelData.map((entry, index) => (
                        <Cell
                          key={entry.status}
                          fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Section 3 — Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Abandon reasons */}
            <Card className="border border-[#e9e8e9] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm font-semibold font-plus-jakarta"
                  style={{ color: "#1b1c1d" }}
                >
                  Por que abandonam
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-36 w-full" />
                ) : analytics?.abandonData.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={analytics.abandonData}
                      layout="vertical"
                      margin={{ top: 2, right: 20, left: 10, bottom: 2 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9e8e9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#7a6d6d" }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fontSize: 10, fill: "#4a3d3d" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#dc2626" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[#7a6d6d] py-8 text-center">
                    Nenhum abandono registrado
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top intents */}
            <Card className="border border-[#e9e8e9] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm font-semibold font-plus-jakarta"
                  style={{ color: "#1b1c1d" }}
                >
                  O que mais buscam
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-36 w-full" />
                ) : analytics?.intentData.length ? (
                  <div className="space-y-2 pt-1">
                    {analytics.intentData.map((item, idx) => {
                      const maxCount = analytics.intentData[0]?.count || 1;
                      const pct = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={item.key} className="flex items-center gap-2">
                          <span className="text-xs text-[#7a6d6d] w-4 shrink-0">{idx + 1}</span>
                          <span className="text-xs text-[#4a3d3d] w-28 shrink-0 truncate">
                            {item.label}
                          </span>
                          <div className="flex-1 bg-[#e9e8e9] rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: "#d4af37" }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[#1b1c1d] w-8 text-right shrink-0">
                            {item.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#7a6d6d] py-8 text-center">
                    Nenhuma intenção registrada
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Topics */}
          {!isLoading && analytics?.topicsData.length > 0 && (
            <Card className="border border-[#e9e8e9] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm font-semibold font-plus-jakarta"
                  style={{ color: "#1b1c1d" }}
                >
                  Tópicos mais mencionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {analytics.topicsData.map((t, idx) => (
                    <div key={t.topic} className="flex items-center gap-3 py-1">
                      <span
                        className="text-xs font-bold w-5 text-center shrink-0"
                        style={{ color: "#b91c1c" }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm text-[#4a3d3d] flex-1 truncate capitalize">
                        {t.topic}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#fbf9fa", color: "#7a6d6d", border: "1px solid #e9e8e9" }}
                      >
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 4 — Ranking */}
          <Card className="border border-[#e9e8e9] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-base font-semibold font-plus-jakarta"
                style={{ color: "#1b1c1d" }}
              >
                Ranking de Franquias
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : analytics?.rankingData.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#e9e8e9]">
                        <TableHead className="text-xs text-[#7a6d6d] font-medium">Franquia</TableHead>
                        <TableHead className="text-xs text-[#7a6d6d] font-medium text-right">Conversas</TableHead>
                        <TableHead className="text-xs text-[#7a6d6d] font-medium text-right">Conversão</TableHead>
                        <TableHead className="text-xs text-[#7a6d6d] font-medium text-right">Score Bot</TableHead>
                        <TableHead className="text-xs text-[#7a6d6d] font-medium text-right">Sem Humano</TableHead>
                        <TableHead className="text-xs text-[#7a6d6d] font-medium">Principal Abandono</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.rankingData.map((row) => (
                        <TableRow
                          key={row.franchise_id}
                          className="border-[#e9e8e9] cursor-pointer hover:bg-[#fbf9fa] transition-colors"
                          onClick={() => openSheet(row)}
                        >
                          <TableCell className="text-sm font-medium text-[#1b1c1d]">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-sm text-right text-[#4a3d3d]">
                            {row.total}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            <span
                              style={{
                                color:
                                  parseFloat(row.conversionRate) >= 20
                                    ? "#16a34a"
                                    : parseFloat(row.conversionRate) >= 10
                                    ? "#d4af37"
                                    : "#dc2626",
                              }}
                            >
                              {row.conversionRate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-right font-bold">
                            <span style={{ color: scoreColor(row.avgScore) }}>
                              {row.avgScore !== null ? row.avgScore.toFixed(1) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-right text-[#4a3d3d]">
                            {row.humanRate}%
                          </TableCell>
                          <TableCell className="text-sm text-[#7a6d6d]">
                            {row.topAbandon}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-[#7a6d6d] py-10 text-center">
                  Nenhum dado por franquia disponível
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Drill-down Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-plus-jakarta text-[#1b1c1d]">
              {sheetFranchise?.name}
            </SheetTitle>
            <p className="text-xs text-[#7a6d6d]">
              Últimas 10 conversas classificadas
            </p>
          </SheetHeader>

          {sheetConvs.length === 0 ? (
            <p className="text-sm text-[#7a6d6d] py-10 text-center">
              Nenhuma conversa encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {sheetConvs.map((c) => {
                const started = c.started_at || c.created_at;
                return (
                  <div
                    key={c.id}
                    className="border border-[#e9e8e9] rounded-lg p-3 space-y-1 bg-[#fbf9fa]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#7a6d6d]">
                        {started
                          ? format(new Date(started), "dd/MM/yyyy HH:mm")
                          : "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Score badge */}
                        {c.quality_score !== null && c.quality_score !== undefined && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: scoreColor(c.quality_score),
                              backgroundColor: `${scoreColor(c.quality_score)}15`,
                              border: `1px solid ${scoreColor(c.quality_score)}30`,
                            }}
                          >
                            ★ {c.quality_score.toFixed(1)}
                          </span>
                        )}
                        {/* Outcome badge */}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor:
                              c.outcome === "converted"
                                ? "#16a34a20"
                                : c.outcome === "abandoned"
                                ? "#dc262620"
                                : c.outcome === "escalated"
                                ? "#d4af3720"
                                : "#e9e8e9",
                            color:
                              c.outcome === "converted"
                                ? "#16a34a"
                                : c.outcome === "abandoned"
                                ? "#dc2626"
                                : c.outcome === "escalated"
                                ? "#775a19"
                                : "#7a6d6d",
                          }}
                        >
                          {OUTCOME_LABELS[c.outcome] || c.outcome || STATUS_LABELS[c.status] || c.status}
                        </span>
                      </div>
                    </div>

                    {/* Summary or topics */}
                    {c.summary && (
                      <p className="text-xs text-[#4a3d3d] leading-relaxed">
                        {c.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {c.intent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#b91c1c]/10 text-[#b91c1c]">
                          {INTENT_LABELS[c.intent] || c.intent}
                        </span>
                      )}
                      {c.llm_sentiment && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4af37]/10 text-[#775a19]">
                          {SENTIMENT_LABELS[c.llm_sentiment] || c.llm_sentiment}
                        </span>
                      )}
                      {c.outcome === "escalated" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#d97706]">
                          Escalado
                        </span>
                      )}
                      {c.llm_abandon_reason && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dc2626]/10 text-[#dc2626]">
                          Abandono: {ABANDON_REASON_LABELS[c.llm_abandon_reason] || c.llm_abandon_reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
