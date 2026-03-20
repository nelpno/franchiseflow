import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Franchise, DailySummary, Sale, DailyUniqueContact, InventoryItem, DailyChecklist } from "@/entities/all";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, TrendingUp, Users, Target } from "lucide-react";
import StatsCard from "./StatsCard";
import AdminHeader from "./AdminHeader";
import AlertsPanel from "./AlertsPanel";
import FranchiseRanking from "./FranchiseRanking";
import DailyRevenueChart from "./DailyRevenueChart";
import MessagesTrend from "./MessagesTrend";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [todayContacts, setTodayContacts] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [yesterdayContacts, setYesterdayContacts] = useState([]);
  const [inventoryByFranchise, setInventoryByFranchise] = useState({});
  const [checklistByFranchise, setChecklistByFranchise] = useState({});

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterday = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        franchiseData,
        summaryData,
        todayContactData,
        yesterdayContactData,
        todaySaleData,
        yesterdaySaleData,
      ] = await Promise.all([
        Franchise.list("city"),
        DailySummary.list("-date", 365),
        DailyUniqueContact.filter({ date: today }),
        DailyUniqueContact.filter({ date: yesterday }),
        Sale.filter({ sale_date: today }),
        Sale.filter({ sale_date: yesterday }),
      ]);

      setFranchises(franchiseData);
      setSummaries(summaryData);
      setTodayContacts(todayContactData);
      setYesterdayContacts(yesterdayContactData);
      setTodaySales(todaySaleData);
      setYesterdaySales(yesterdaySaleData);

      const inventoryMap = {};
      const checklistMap = {};
      await Promise.all(
        franchiseData.map(async (f) => {
          const [inv, cl] = await Promise.all([
            InventoryItem.filter({ franchise_id: f.id }),
            f.evolution_instance_id
              ? DailyChecklist.filter({ franchise_id: f.evolution_instance_id, date: today })
              : Promise.resolve([]),
          ]);
          inventoryMap[f.id] = inv;
          if (cl.length > 0) checklistMap[f.id] = cl[0];
        })
      );
      setInventoryByFranchise(inventoryMap);
      setChecklistByFranchise(checklistMap);
    } catch (err) {
      console.error("Error loading admin dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const stats = useMemo(() => {
    if (period === "today") {
      const salesCount = todaySales.length;
      const prevSalesCount = yesterdaySales.length;
      const revenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const prevRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const contacts = todayContacts.length;
      const prevContacts = yesterdayContacts.length;
      const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
      const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
    }

    const days = period === "7d" ? 7 : 30;
    const cutoff = format(subDays(new Date(), days), "yyyy-MM-dd");
    const prevCutoff = format(subDays(new Date(), days * 2), "yyyy-MM-dd");

    const currentPeriod = summaries.filter((s) => s.date >= cutoff);
    const prevPeriod = summaries.filter((s) => s.date >= prevCutoff && s.date < cutoff);

    const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0);

    const salesCount = sum(currentPeriod, "sales_count");
    const prevSalesCount = sum(prevPeriod, "sales_count");
    const revenue = sum(currentPeriod, "sales_value");
    const prevRevenue = sum(prevPeriod, "sales_value");
    const contacts = sum(currentPeriod, "unique_contacts");
    const prevContacts = sum(prevPeriod, "unique_contacts");
    const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
    const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
  }, [period, todaySales, yesterdaySales, todayContacts, yesterdayContacts, summaries]);

  const chartDays = period === "30d" ? 30 : 7;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" /> <Skeleton className="h-28" />
          <Skeleton className="h-28" /> <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  const trendFor = (current, previous) =>
    current > previous ? 'up' : current < previous ? 'down' : null;

  return (
    <div className="p-6">
      <AdminHeader period={period} onPeriodChange={setPeriod} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Vendas"
          value={stats.salesCount}
          previousValue={stats.prevSalesCount}
          icon={Target}
          trend={trendFor(stats.salesCount, stats.prevSalesCount)}
          color="emerald"
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${stats.revenue.toFixed(2)}`}
          previousValue={stats.prevRevenue}
          icon={TrendingUp}
          trend={trendFor(stats.revenue, stats.prevRevenue)}
          color="green"
          isValue
        />
        <StatsCard
          title="Contatos"
          value={stats.contacts}
          previousValue={stats.prevContacts}
          icon={MessageSquare}
          trend={trendFor(stats.contacts, stats.prevContacts)}
          color="teal"
        />
        <StatsCard
          title="Conversão"
          value={`${stats.conversion}%`}
          previousValue={stats.prevConversion}
          icon={Users}
          trend={trendFor(stats.conversion, stats.prevConversion)}
          color="cyan"
        />
      </div>

      <AlertsPanel
        franchises={franchises}
        summaries={summaries}
        inventoryByFranchise={inventoryByFranchise}
        checklistByFranchise={checklistByFranchise}
      />

      <FranchiseRanking
        franchises={franchises}
        summaries={summaries}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyRevenueChart summaries={summaries} isLoading={isLoading} days={chartDays} />
        <MessagesTrend summaries={summaries} isLoading={isLoading} days={chartDays} />
      </div>
    </div>
  );
}
