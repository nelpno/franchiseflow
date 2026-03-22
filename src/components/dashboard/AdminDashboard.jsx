import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Franchise, DailySummary, Sale, DailyUniqueContact, InventoryItem, DailyChecklist, PurchaseOrder } from "@/entities/all";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRLInteger } from "@/lib/formatters";
import AdminHeader from "./AdminHeader";
import AlertsPanel from "./AlertsPanel";
import FranchiseRanking from "./FranchiseRanking";
import FranchiseHealthScore from "./FranchiseHealthScore";
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
  const [purchaseOrders, setPurchaseOrders] = useState([]);

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
        purchaseOrderData,
      ] = await Promise.all([
        Franchise.list("city"),
        DailySummary.list("-date", 365),
        DailyUniqueContact.filter({ date: today }),
        DailyUniqueContact.filter({ date: yesterday }),
        Sale.filter({ sale_date: today }),
        Sale.filter({ sale_date: yesterday }),
        PurchaseOrder.list("-ordered_at"),
      ]);

      setFranchises(franchiseData);
      setSummaries(summaryData);
      setTodayContacts(todayContactData);
      setYesterdayContacts(yesterdayContactData);
      setTodaySales(todaySaleData);
      setYesterdaySales(yesterdaySaleData);
      setPurchaseOrders(purchaseOrderData);

      // Fetch ALL inventory and checklists in 2 queries (instead of N*2)
      const [allInventory, allChecklists] = await Promise.all([
        InventoryItem.list(),
        DailyChecklist.filter({ date: today }),
      ]);

      // Group inventory by franchise UUID (using evoId → franchise.id mapping)
      const evoToId = {};
      franchiseData.forEach((f) => {
        if (f.evolution_instance_id) evoToId[f.evolution_instance_id] = f.id;
      });

      const inventoryMap = {};
      allInventory.forEach((item) => {
        const fUuid = evoToId[item.franchise_id];
        if (fUuid) {
          if (!inventoryMap[fUuid]) inventoryMap[fUuid] = [];
          inventoryMap[fUuid].push(item);
        }
      });

      const checklistMap = {};
      allChecklists.forEach((cl) => {
        const fUuid = evoToId[cl.franchise_id];
        if (fUuid) checklistMap[fUuid] = cl;
      });

      setInventoryByFranchise(inventoryMap);
      setChecklistByFranchise(checklistMap);
    } catch (err) {
      console.error("Erro ao carregar dashboard admin:", err);
      toast.error("Erro ao carregar dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 180000);
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

  // Live today totals for real-time chart data
  const liveTodayRevenue = useMemo(() =>
    todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0),
    [todaySales]
  );
  const liveTodayContactsCount = todayContacts.length;

  // Generate mini sparkline data from recent summaries + live today
  const sparklineData = useMemo(() => {
    const last6 = [];
    const todayStr = format(new Date(), "yyyy-MM-dd");
    for (let i = 5; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
      const daySummaries = summaries.filter((s) => s.date === dateStr);
      let sales = daySummaries.reduce((s, r) => s + (r.sales_count || 0), 0);
      let revenue = daySummaries.reduce((s, r) => s + (r.sales_value || 0), 0);
      let contacts = daySummaries.reduce((s, r) => s + (r.unique_contacts || 0), 0);
      if (dateStr === todayStr) {
        if (todaySales.length > sales) sales = todaySales.length;
        if (liveTodayRevenue > revenue) revenue = liveTodayRevenue;
        if (liveTodayContactsCount > contacts) contacts = liveTodayContactsCount;
      }
      last6.push({ sales, revenue, contacts });
    }
    return last6;
  }, [summaries, todaySales, liveTodayRevenue, liveTodayContactsCount]);

  const chartDays = period === "30d" ? 30 : 7;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6 bg-[#fdf3f2]">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      value: formatBRLInteger(stats.revenue),
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
      iconColor: "text-[#1b1c1d]/70",
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
    <div className="pt-20 p-4 md:p-8 space-y-6 md:space-y-8 bg-[#fdf3f2] max-w-[1920px] mx-auto">
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
                <p className="text-[#1b1c1d]/60 text-sm font-bold font-plus-jakarta tracking-tight">
                  {card.title}
                </p>
                <h3 className="text-3xl font-extrabold tracking-tight font-mono-numbers text-[#1b1c1d]">
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
        purchaseOrders={purchaseOrders}
      />

      <FranchiseRanking
        franchises={franchises}
        summaries={summaries}
        isLoading={isLoading}
      />

      <FranchiseHealthScore
        franchises={franchises}
        todaySales={todaySales}
        inventoryByFranchise={inventoryByFranchise}
        checklistByFranchise={checklistByFranchise}
        purchaseOrders={purchaseOrders}
        todayContacts={todayContacts}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DailyRevenueChart summaries={summaries} isLoading={isLoading} days={chartDays} todayRevenue={liveTodayRevenue} />
        <MessagesTrend summaries={summaries} isLoading={isLoading} days={chartDays} todayContacts={liveTodayContactsCount} />
      </div>
    </div>
  );
}
