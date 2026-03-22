import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, DailyChecklist, InventoryItem, Contact, DailyUniqueContact, getFranchiseRanking } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
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
  const [isLoading, setIsLoading] = useState(true);
  const [franchise, setFranchise] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [checklistProgress, setChecklistProgress] = useState({ done: 0, total: 0 });
  const [contacts, setContacts] = useState([]);
  const [botActive, setBotActive] = useState(false);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterday = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);

  const franchiseId = ctxFranchise?.id;

  const loadData = useCallback(async () => {
    if (!franchiseId) return;
    setIsLoading(true);
    try {
      setFranchise(ctxFranchise);

      const evoId = ctxFranchise?.evolution_instance_id;
      const fId = evoId || franchiseId;
      const [
        todaySalesData,
        yesterdaySalesData,
        summariesData,
        inventoryData,
        checklistData,
        contactsData,
      ] = await Promise.all([
        evoId ? Sale.filter({ sale_date: today, franchise_id: evoId }) : Promise.resolve([]),
        evoId ? Sale.filter({ sale_date: yesterday, franchise_id: evoId }) : Promise.resolve([]),
        DailySummary.list("-date", 30),
        evoId ? InventoryItem.filter({ franchise_id: evoId }) : Promise.resolve([]),
        evoId ? DailyChecklist.filter({ franchise_id: evoId, date: today }) : Promise.resolve([]),
        evoId ? Contact.filter({ franchise_id: evoId }) : Promise.resolve([]),
      ]);

      setTodaySales(todaySalesData);
      setYesterdaySales(yesterdaySalesData);
      setSummaries(summariesData);

      setContacts(contactsData);
      setLowStockCount(inventoryData.filter((i) => (i.quantity || 0) < (i.min_stock || 5)).length);

      // Check bot activity (DailyUniqueContact in last 3 days)
      if (evoId) {
        try {
          const threeDaysAgo = format(subDays(new Date(), 3), "yyyy-MM-dd");
          const recentContacts = await DailyUniqueContact.filter({ franchise_id: evoId });
          const hasRecent = recentContacts.some((c) => c.date >= threeDaysAgo);
          setBotActive(hasRecent);
        } catch {
          setBotActive(false);
        }
      }

      if (checklistData.length > 0) {
        const items = checklistData[0].items || {};
        const values = Object.values(items);
        setChecklistProgress({
          done: values.filter(Boolean).length,
          total: values.length,
        });
      }

      try {
        const rankData = await getFranchiseRanking(today, fId);
        setRanking(rankData);
      } catch {
        setRanking(null);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
      toast.error("Erro ao carregar dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [franchiseId, today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

  const todaySalesCount = todaySales.length;
  const yesterdaySalesCount = yesterdaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);

  const todayAvgTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;
  const yesterdayAvgTicket = yesterdaySalesCount > 0 ? yesterdayRevenue / yesterdaySalesCount : 0;

  const evoId = franchise?.evolution_instance_id;

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
        <div className="grid grid-cols-2 gap-4">
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
                : "bg-[#e9e8e9] text-[#534343]"
            }`}>
              <MaterialIcon icon="smart_toy" size={12} />
              {botActive ? "Bot ativo" : "Bot inativo"}
            </div>
          )}
        </div>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <StatsCard
          title="Vendas Hoje"
          value={todaySalesCount}
          previousValue={yesterdaySalesCount}
          trend={todaySalesCount > yesterdaySalesCount ? 'up' : todaySalesCount < yesterdaySalesCount ? 'down' : null}
        />
        <StatsCard
          title="Faturamento"
          value={formatBRLInteger(todayRevenue)}
          previousValue={yesterdayRevenue}
          trend={todayRevenue > yesterdayRevenue ? 'up' : todayRevenue < yesterdayRevenue ? 'down' : null}
        />
        <StatsCard
          title="Valor Médio"
          value={formatBRLInteger(todayAvgTicket)}
          previousValue={yesterdayAvgTicket}
          trend={todayAvgTicket > yesterdayAvgTicket ? 'up' : todayAvgTicket < yesterdayAvgTicket ? 'down' : null}
        />
      </section>

      <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />

      <QuickAccessCards
        lowStockCount={lowStockCount}
        pendingActionsCount={generateSmartActions(contacts, 0).length}
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
          onClick={() => navigate("/MinhaLoja?tab=lancar&action=nova-venda")}
          className="h-12 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg flex items-center gap-2 px-6"
        >
          <MaterialIcon icon="point_of_sale" size={18} />
          Nova Venda
        </Button>
      </div>
    </div>
  );
}
