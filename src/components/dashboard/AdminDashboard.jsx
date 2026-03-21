import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Franchise, DailySummary, Sale, DailyUniqueContact, InventoryItem, DailyChecklist } from "@/entities/all";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
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
            f.evolution_instance_id
              ? InventoryItem.filter({ franchise_id: f.evolution_instance_id })
              : Promise.resolve([]),
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

  // Generate mini sparkline data from recent summaries
  const sparklineData = useMemo(() => {
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
      const daySummaries = summaries.filter((s) => s.date === dateStr);
      last6.push({
        sales: daySummaries.reduce((s, r) => s + (r.sales_count || 0), 0),
        revenue: daySummaries.reduce((s, r) => s + (r.sales_value || 0), 0),
        contacts: daySummaries.reduce((s, r) => s + (r.unique_contacts || 0), 0),
      });
    }
    return last6;
  }, [summaries]);

  const chartDays = period === "30d" ? 30 : 7;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 bg-[#fdf3f2] min-h-screen">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const trendFor = (current, previous) =>
    current > previous ? 'up' : current < previous ? 'down' : null;

  // Stats card configs matching Stitch design
  const statsCards = [
    {
      title: "VENDAS",
      value: stats.salesCount,
      previousValue: stats.prevSalesCount,
      materialIcon: "shopping_bag",
      trend: trendFor(stats.salesCount, stats.prevSalesCount),
      iconBg: "bg-[#a80012]/10",
      iconColor: "text-[#a80012]",
      trendColor: "text-[#a80012]",
      sparkKey: "sales",
      sparkColor: "#a80012",
    },
    {
      title: "FATURAMENTO",
      value: `R$ ${stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      previousValue: stats.prevRevenue,
      materialIcon: "payments",
      trend: trendFor(stats.revenue, stats.prevRevenue),
      iconBg: "bg-[#775a19]/10",
      iconColor: "text-[#775a19]",
      trendColor: "text-[#a80012]",
      sparkKey: "revenue",
      sparkColor: "#775a19",
      isValue: true,
    },
    {
      title: "CONTATOS",
      value: stats.contacts,
      previousValue: stats.prevContacts,
      materialIcon: "chat_bubble",
      trend: trendFor(stats.contacts, stats.prevContacts),
      iconBg: "bg-[#291715]/5",
      iconColor: "text-[#291715]/70",
      trendColor: null, // dynamic: red for down, primary for up
      sparkKey: "contacts",
      sparkColor: "#291715",
    },
    {
      title: "CONVERSÃO",
      value: `${stats.conversion}%`,
      previousValue: stats.prevConversion,
      materialIcon: "trending_up",
      trend: trendFor(stats.conversion, stats.prevConversion),
      iconBg: "bg-[#775a19]/10",
      iconColor: "text-[#775a19]",
      trendColor: "text-[#a80012]",
      sparkKey: "sales",
      sparkColor: "#775a19",
    },
  ];

  return (
    <div className="pt-20 p-8 space-y-8 bg-[#fdf3f2] min-h-screen max-w-[1920px] mx-auto">
      <AdminHeader period={period} onPeriodChange={setPeriod} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((card) => {
          // Icon is now MaterialIcon
          const numericValue = typeof card.value === "string"
            ? parseFloat(card.value.replace(/[^0-9,.-]+/g, "").replace(",", "."))
            : card.value;
          let percentageChange = 0;
          if (card.previousValue > 0) {
            percentageChange = ((numericValue - card.previousValue) / card.previousValue) * 100;
          } else if (numericValue > 0) {
            percentageChange = 100;
          }
          const isUp = card.trend === "up";
          const isDown = card.trend === "down";

          // Determine trend text color
          let trendTextColor;
          if (card.trendColor) {
            trendTextColor = card.trendColor;
          } else {
            trendTextColor = isDown ? "text-[#ba1a1a]" : "text-[#a80012]";
          }

          const sparkValues = sparklineData.map((d) => d[card.sparkKey]);
          const maxSpark = Math.max(...sparkValues, 1);

          return (
            <div
              key={card.title}
              className="bg-white p-6 rounded-2xl shadow-sm border border-[#291715]/5 flex flex-col gap-4"
            >
              {/* Top: icon + trend */}
              <div className="flex justify-between items-start">
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center`}>
                  <MaterialIcon icon={card.materialIcon} size={24} />
                </div>
                {card.trend && (
                  <div className={`flex items-center gap-1 text-sm font-bold ${trendTextColor}`}>
                    {isUp ? (
                      <MaterialIcon icon="trending_up" size={14} />
                    ) : (
                      <MaterialIcon icon="trending_down" size={14} />
                    )}
                    {isUp ? "+" : ""}{Math.abs(percentageChange).toFixed(0)}%
                  </div>
                )}
              </div>

              {/* Label + Value */}
              <div>
                <p className="text-[#291715]/60 text-sm font-bold font-plus-jakarta tracking-tight">
                  {card.title}
                </p>
                <h3 className="text-3xl font-extrabold tracking-tight font-mono-numbers text-[#291715]">
                  {card.value}
                </h3>
              </div>

              {/* Mini sparkline bars */}
              <div className="h-8 flex items-end gap-1">
                {sparkValues.map((v, idx) => {
                  const h = Math.max((v / maxSpark) * 100, 10);
                  const isLast = idx === sparkValues.length - 1;
                  return (
                    <div
                      key={idx}
                      className="w-full rounded-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor: isLast
                          ? card.sparkColor
                          : `${card.sparkColor}1A`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DailyRevenueChart summaries={summaries} isLoading={isLoading} days={chartDays} />
        <MessagesTrend summaries={summaries} isLoading={isLoading} days={chartDays} />
      </div>
    </div>
  );
}
