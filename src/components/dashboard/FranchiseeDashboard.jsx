import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, Franchise, DailyChecklist, InventoryItem, getFranchiseRanking } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, DollarSign } from "lucide-react";
import { createPageUrl } from "@/utils";
import StatsCard from "./StatsCard";
import FranchiseeGreeting from "./FranchiseeGreeting";
import DailyGoalProgress from "./DailyGoalProgress";
import QuickAccessCards from "./QuickAccessCards";
import RankingStreak from "./RankingStreak";

export default function FranchiseeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [franchise, setFranchise] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [checklistProgress, setChecklistProgress] = useState({ done: 0, total: 0 });

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterday = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);

  const franchiseId = user?.managed_franchise_ids?.[0];

  const loadData = useCallback(async () => {
    if (!franchiseId) return;
    setIsLoading(true);
    try {
      const franchises = await Franchise.list();
      const myFranchise = franchises.find((f) => f.id === franchiseId || f.evolution_instance_id === franchiseId);
      setFranchise(myFranchise);

      const [
        todaySalesData,
        yesterdaySalesData,
        summariesData,
        inventoryData,
        checklistData,
      ] = await Promise.all([
        Sale.filter({ sale_date: today, franchise_id: franchiseId }),
        Sale.filter({ sale_date: yesterday, franchise_id: franchiseId }),
        DailySummary.list("-date", 30),
        InventoryItem.filter({ franchise_id: franchiseId }),
        myFranchise?.evolution_instance_id
          ? DailyChecklist.filter({ franchise_id: myFranchise.evolution_instance_id, date: today })
          : Promise.resolve([]),
      ]);

      setTodaySales(todaySalesData);
      setYesterdaySales(yesterdaySalesData);
      setSummaries(summariesData);

      setLowStockCount(inventoryData.filter((i) => (i.quantity || 0) < 5).length);

      if (checklistData.length > 0) {
        const items = checklistData[0].items || {};
        const values = Object.values(items);
        setChecklistProgress({
          done: values.filter(Boolean).length,
          total: values.length,
        });
      }

      try {
        const rankData = await getFranchiseRanking(today, franchiseId);
        setRanking(rankData);
      } catch {
        setRanking(null);
      }
    } catch (err) {
      console.error("Error loading franchisee dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [franchiseId, today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const todaySalesCount = todaySales.length;
  const yesterdaySalesCount = yesterdaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);

  const dailyGoal = useMemo(() => {
    if (!summaries.length || !franchiseId) return null;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const recentDays = summaries.filter((s) => {
      if (s.franchise_id !== franchiseId) return false;
      const d = new Date(s.date);
      return d >= thirtyDaysAgo && d < now;
    });
    if (recentDays.length < 7) return null;
    const totalRevenue = recentDays.reduce((sum, s) => sum + (s.sales_value || 0), 0);
    return Math.round((totalRevenue / recentDays.length) * 1.10);
  }, [summaries, franchiseId]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <FranchiseeGreeting
        userName={user?.full_name}
        franchiseName={franchise ? `Unidade ${franchise.city}` : null}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatsCard
          title="Vendas Hoje"
          value={todaySalesCount}
          previousValue={yesterdaySalesCount}
          icon={Target}
          trend={todaySalesCount > yesterdaySalesCount ? 'up' : todaySalesCount < yesterdaySalesCount ? 'down' : null}
          color="emerald"
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${todayRevenue.toFixed(2)}`}
          previousValue={yesterdayRevenue}
          icon={DollarSign}
          trend={todayRevenue > yesterdayRevenue ? 'up' : todayRevenue < yesterdayRevenue ? 'down' : null}
          color="green"
          isValue
        />
      </div>

      <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />

      <QuickAccessCards
        lowStockCount={lowStockCount}
        checklistDone={checklistProgress.done}
        checklistTotal={checklistProgress.total}
      />

      <RankingStreak
        ranking={ranking}
        summaries={summaries}
        franchiseId={franchiseId}
        dailyGoal={dailyGoal}
      />

      <Button
        onClick={() => navigate(createPageUrl("Sales"))}
        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-medium"
      >
        <Plus className="h-5 w-5 mr-2" />
        Registrar Venda
      </Button>
    </div>
  );
}
