import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, Franchise, DailyChecklist, InventoryItem, getFranchiseRanking } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { createPageUrl } from "@/utils";
import StatsCard from "./StatsCard";
import FranchiseeGreeting from "./FranchiseeGreeting";
import DailyGoalProgress from "./DailyGoalProgress";
import QuickAccessCards from "./QuickAccessCards";
import MiniRevenueChart from "./MiniRevenueChart";
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

      const evoId = myFranchise?.evolution_instance_id;
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
        evoId ? InventoryItem.filter({ franchise_id: evoId }) : Promise.resolve([]),
        evoId ? DailyChecklist.filter({ franchise_id: evoId, date: today }) : Promise.resolve([]),
      ]);

      setTodaySales(todaySalesData);
      setYesterdaySales(yesterdaySalesData);
      setSummaries(summariesData);

      setLowStockCount(inventoryData.filter((i) => (i.quantity || 0) < (i.min_stock || 5)).length);

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
      <div className="p-4 md:px-12 max-w-lg mx-auto md:max-w-none space-y-4 bg-[#fbf9fa] min-h-screen">
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
    <div className="pt-4 pb-32 px-4 md:px-12 max-w-lg mx-auto md:max-w-none bg-[#fbf9fa] min-h-screen">
      <FranchiseeGreeting
        userName={user?.full_name}
        franchiseName={franchise ? `Unidade ${franchise.city}` : null}
      />

      <section className="grid grid-cols-2 gap-4 mb-6">
        <StatsCard
          title="Vendas Hoje"
          value={todaySalesCount}
          previousValue={yesterdaySalesCount}
          trend={todaySalesCount > yesterdaySalesCount ? 'up' : todaySalesCount < yesterdaySalesCount ? 'down' : null}
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${Math.round(todayRevenue).toLocaleString("pt-BR")}`}
          previousValue={yesterdayRevenue}
          trend={todayRevenue > yesterdayRevenue ? 'up' : todayRevenue < yesterdayRevenue ? 'down' : null}
        />
      </section>

      <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />

      <QuickAccessCards
        lowStockCount={lowStockCount}
        checklistDone={checklistProgress.done}
        checklistTotal={checklistProgress.total}
      />

      <MiniRevenueChart summaries={summaries} franchiseId={franchiseId} />

      <RankingStreak
        ranking={ranking}
        summaries={summaries}
        franchiseId={franchiseId}
        dailyGoal={dailyGoal}
      />

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-20 md:bottom-10 left-0 right-0 px-6 max-w-lg mx-auto md:max-w-none md:flex md:justify-end z-50">
        <Button
          onClick={() => navigate(createPageUrl("Sales"))}
          className="w-full md:w-auto md:min-w-[240px] h-14 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-[0_10px_30px_-10px_rgba(185,28,28,0.4)] flex items-center justify-center gap-3 active:scale-95 transition-transform text-base"
        >
          <MaterialIcon icon="point_of_sale" size={20} />
          REGISTRAR VENDA
        </Button>
      </div>
    </div>
  );
}
