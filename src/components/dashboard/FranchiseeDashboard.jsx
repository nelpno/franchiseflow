import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, DailyChecklist, InventoryItem, Contact, DailyUniqueContact, getFranchiseRanking } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfWeek, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRLInteger } from "@/lib/formatters";
import StatsCard from "./StatsCard";
import FranchiseeGreeting from "./FranchiseeGreeting";
import DailyGoalProgress from "./DailyGoalProgress";
import QuickAccessCards from "./QuickAccessCards";
import MiniRevenueChart from "./MiniRevenueChart";
import RankingStreak from "./RankingStreak";
import SmartActions from "./SmartActions";
import PeriodComparisonCard from "./PeriodComparisonCard";
import { generateSmartActions } from "@/lib/smartActions";

export default function FranchiseeDashboard() {
  const { user, selectedFranchise: ctxFranchise } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [franchise, setFranchise] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [checklistProgress, setChecklistProgress] = useState({ done: 0, total: 0 });
  const [contacts, setContacts] = useState([]);
  const [botActive, setBotActive] = useState(false);
  const [period, setPeriod] = useState("today");

  // Computed inside loadData to stay fresh after midnight
  const getToday = () => format(new Date(), "yyyy-MM-dd");
  const getYesterday = () => format(subDays(new Date(), 1), "yyyy-MM-dd");

  const franchiseId = ctxFranchise?.id;

  const loadData = useCallback(async () => {
    if (!franchiseId) {
      setIsLoading(false);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    if (!hasLoadedOnceRef.current) setIsLoading(true);
    setLoadError(null);
    try {
      setFranchise(ctxFranchise);

      const today = getToday();
      const yesterday = getYesterday();
      const evoId = ctxFranchise?.evolution_instance_id;
      const results = await Promise.allSettled([
        evoId ? Sale.filter({ sale_date: today, franchise_id: evoId }, null, null,
          { columns: 'id, value, delivery_fee, discount_amount, card_fee_amount, sale_date, contact_id, created_at, payment_method', signal })
          : Promise.resolve([]),       // [0]
        evoId ? Sale.filter({ sale_date: yesterday, franchise_id: evoId }, null, null,
          { columns: 'id, value, delivery_fee, discount_amount, card_fee_amount, sale_date, contact_id, created_at, payment_method', signal })
          : Promise.resolve([]),   // [1]
        evoId ? DailySummary.filter({ franchise_id: evoId }, "-date", 30,
          { columns: 'id, date, sales_count, sales_value, unique_contacts', signal })
          : Promise.resolve([]),    // [2]
        evoId ? InventoryItem.filter({ franchise_id: evoId }, null, null,
          { columns: 'id, product_name, quantity, min_stock', signal })
          : Promise.resolve([]),                // [3]
        evoId ? DailyChecklist.filter({ franchise_id: evoId, date: today }, null, null, { signal })
          : Promise.resolve([]),  // [4]
        evoId ? Contact.filter({ franchise_id: evoId }, "-last_contact_at", 200,
          { columns: 'id, nome, telefone, status, source, last_contact_at, last_purchase_at, purchase_count, total_spent, created_at, updated_at', signal })
          : Promise.resolve([]), // [5]
        evoId ? DailyUniqueContact.filter({ franchise_id: evoId }, "-date", 10,
          { columns: 'id, date', signal })
          : Promise.resolve([]), // [6]
        evoId ? getFranchiseRanking(today, evoId, { signal }) : Promise.resolve(null),                          // [7]
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (i) => results[i].status === "fulfilled" ? results[i].value : [];
      const todaySalesData = getValue(0);
      const yesterdaySalesData = getValue(1);
      const summariesData = getValue(2);
      const inventoryData = getValue(3);
      const checklistData = getValue(4);
      const contactsData = getValue(5);

      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["vendas hoje","vendas ontem","resumos","estoque","checklist","contatos","bot activity","ranking"][i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Dashboard queries falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setTodaySales(todaySalesData);
      setYesterdaySales(yesterdaySalesData);
      setSummaries(summariesData);

      setContacts(contactsData);
      setLowStockCount(inventoryData.filter((i) => (i.quantity || 0) < (i.min_stock || 5)).length);

      // Bot activity (already parallel — index 6)
      const threeDaysAgo = format(subDays(new Date(), 3), "yyyy-MM-dd");
      const recentContacts = getValue(6);
      setBotActive(evoId ? recentContacts.some((c) => c.date >= threeDaysAgo) : false);

      if (checklistData.length > 0) {
        const items = checklistData[0].items || {};
        const values = Object.values(items);
        setChecklistProgress({
          done: values.filter(Boolean).length,
          total: values.length,
        });
      }

      // Ranking (already parallel — index 7)
      setRanking(results[7].status === "fulfilled" ? results[7].value : null);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!mountedRef.current) return;
      console.error("Erro ao carregar dashboard:", err);
      setLoadError(`Erro ao carregar dados: ${err?.message || "Erro desconhecido"}`);
      toast.error(`Erro ao carregar dashboard: ${err?.message || "Erro desconhecido"}`);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, [franchiseId]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [loadData]);

  useVisibilityPolling(loadData, 300000);

  const evoId = franchise?.evolution_instance_id;

  // Stats based on selected period
  const stats = useMemo(() => {
    if (period === "today") {
      const salesCount = todaySales.length;
      const prevSalesCount = yesterdaySales.length;
      const revenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const prevRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const avgTicket = salesCount > 0 ? revenue / salesCount : 0;
      const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, avgTicket, prevAvgTicket };
    }

    let cutoff, prevCutoff;
    if (period === "week") {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
      const days = differenceInDays(new Date(), weekStart) + 1;
      cutoff = format(weekStart, "yyyy-MM-dd");
      prevCutoff = format(subDays(weekStart, days), "yyyy-MM-dd");
    } else {
      const days = period === "7d" ? 7 : 30;
      cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
      prevCutoff = format(subDays(new Date(), days * 2 - 1), "yyyy-MM-dd");
    }

    const mySummaries = summaries.filter((s) => s.franchise_id === evoId);
    const currentPeriod = mySummaries.filter((s) => s.date >= cutoff);
    const prevPeriod = mySummaries.filter((s) => s.date >= prevCutoff && s.date < cutoff);

    const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0);

    const salesCount = sum(currentPeriod, "sales_count");
    const prevSalesCount = sum(prevPeriod, "sales_count");
    const revenue = sum(currentPeriod, "sales_value");
    const prevRevenue = sum(prevPeriod, "sales_value");
    const avgTicket = salesCount > 0 ? revenue / salesCount : 0;
    const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, avgTicket, prevAvgTicket };
  }, [period, todaySales, yesterdaySales, summaries, evoId]);

  const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);

  const pendingActionsCount = useMemo(() => generateSmartActions(contacts, 0).length, [contacts]);

  const dailyGoal = useMemo(() => {
    if (!summaries.length || !evoId) return null;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const recentDays = summaries.filter((s) => {
      if (s.franchise_id !== evoId) return false;
      const d = new Date(s.date);
      return d >= thirtyDaysAgo && d < now;
    });
    if (recentDays.length < 7) return null;
    const totalRevenue = recentDays.reduce((sum, s) => sum + (s.sales_value || 0), 0);
    return Math.round((totalRevenue / recentDays.length) * 1.10);
  }, [summaries, evoId]);

  if (isLoading) {
    return (
      <div className="p-4 md:px-12 max-w-lg mx-auto md:max-w-none space-y-4 bg-[#fbf9fa]">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:px-12 max-w-lg mx-auto md:max-w-none bg-[#fbf9fa]">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <MaterialIcon icon="cloud_off" className="text-5xl text-[#7a6d6d]" />
          <p className="text-[#4a3d3d] text-center">{loadError}</p>
          <button onClick={loadData} className="mt-2 px-4 py-2 border border-[#cac0c0] rounded-lg text-sm text-[#4a3d3d] hover:bg-white">
            <MaterialIcon icon="refresh" className="mr-2 text-lg align-middle" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-4 px-4 md:px-12 max-w-lg mx-auto md:max-w-none bg-[#fbf9fa]">
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <FranchiseeGreeting
            userName={user?.full_name}
            franchiseName={franchise ? `Unidade ${franchise.city}` : null}
          />
          {franchise?.evolution_instance_id && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 mt-1 ${
              botActive
                ? "bg-[#16a34a]/10 text-[#16a34a]"
                : "bg-[#e9e8e9] text-[#4a3d3d]"
            }`}>
              <MaterialIcon icon="smart_toy" size={12} />
              {botActive ? "Bot ativo" : "Bot inativo"}
            </div>
          )}
        </div>
      </div>

      <div className="flex bg-[#291715]/5 p-1 rounded-xl mb-4">
        {[
          { value: "today", label: "Hoje" },
          { value: "week", label: "Semana" },
          { value: "7d", label: "7 dias" },
          { value: "30d", label: "30 dias" },
        ].map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 text-sm font-plus-jakarta transition-all active:scale-95 flex-1 rounded-lg ${
              period === p.value
                ? "font-bold text-white bg-[#b91c1c] shadow-sm"
                : "font-medium text-[#1b1c1d]/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <StatsCard
          title={period === "today" ? "Vendas Hoje" : "Vendas"}
          value={stats.salesCount}
          previousValue={stats.prevSalesCount}
          trend={stats.salesCount > stats.prevSalesCount ? 'up' : stats.salesCount < stats.prevSalesCount ? 'down' : null}
        />
        <StatsCard
          title="Faturamento"
          value={formatBRLInteger(stats.revenue)}
          previousValue={stats.prevRevenue}
          trend={stats.revenue > stats.prevRevenue ? 'up' : stats.revenue < stats.prevRevenue ? 'down' : null}
        />
        <StatsCard
          title="Valor Médio"
          value={formatBRLInteger(stats.avgTicket)}
          previousValue={stats.prevAvgTicket}
          trend={stats.avgTicket > stats.prevAvgTicket ? 'up' : stats.avgTicket < stats.prevAvgTicket ? 'down' : null}
        />
      </section>

      <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />

      <QuickAccessCards
        lowStockCount={lowStockCount}
        pendingActionsCount={pendingActionsCount}
      />

      <MiniRevenueChart summaries={summaries} franchiseId={evoId} todayRevenue={todayRevenue} />

      <RankingStreak
        ranking={ranking}
        summaries={summaries}
        franchiseId={evoId}
        dailyGoal={dailyGoal}
      />

      <PeriodComparisonCard franchiseId={evoId} />

      <SmartActions contacts={contacts} franchiseId={evoId} />

      {/* CTA — hidden on mobile (FAB "Vender" in bottom nav handles it) */}
      <div className="hidden md:flex fixed bottom-10 right-10 z-50">
        <Button
          onClick={() => navigate("/Vendas?action=nova-venda")}
          className="h-12 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg flex items-center gap-2 px-6"
        >
          <MaterialIcon icon="point_of_sale" size={18} />
          Nova Venda
        </Button>
      </div>
    </div>
  );
}
