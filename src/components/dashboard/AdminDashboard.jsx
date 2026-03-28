import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Franchise, DailySummary, Sale, Contact, DailyUniqueContact, InventoryItem, PurchaseOrder, FranchiseConfiguration } from "@/entities/all";
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
import { buildConfigMap } from "@/lib/franchiseUtils";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [todayContacts, setTodayContacts] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [yesterdayContacts, setYesterdayContacts] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [inventoryByFranchise, setInventoryByFranchise] = useState({});
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [configMap, setConfigMap] = useState({});
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const getToday = () => format(new Date(), "yyyy-MM-dd");
  const getYesterday = () => format(subDays(new Date(), 1), "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    if (!hasLoadedOnceRef.current) setIsLoading(true);
    setLoadError(null);
    try {
      const today = getToday();
      const yesterday = getYesterday();

      // Franchise é crítica — retry automático em caso de timeout
      const fetchFranchises = async () => {
        try {
          return await Franchise.list("city", null, { columns: 'id, city, owner_name, evolution_instance_id, name', signal });
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          return await Franchise.list("city", null, { columns: 'id, city, owner_name, evolution_instance_id, name', signal });
        }
      };

      const results = await Promise.allSettled([
        fetchFranchises(),
        DailySummary.list("-date", 90, { columns: 'id, franchise_id, date, sales_count, sales_value, unique_contacts', signal }),
        DailyUniqueContact.filter({ date: today }, null, null, { columns: 'id, franchise_id, date', signal }),
        DailyUniqueContact.filter({ date: yesterday }, null, null, { columns: 'id, franchise_id, date', signal }),
        Sale.list('-sale_date', 2000, { columns: 'id, value, delivery_fee, discount_amount, franchise_id, sale_date', signal }),
        Contact.list('-created_at', 2000, { columns: 'id, created_at, franchise_id', signal }),
        PurchaseOrder.list("-ordered_at", 500, { columns: 'id, franchise_id, status, ordered_at, delivered_at', signal }),
        InventoryItem.list(null, 1000, { columns: 'id, product_name, quantity, min_stock, franchise_id', signal }),
        FranchiseConfiguration.list(null, null, { columns: 'franchise_evolution_instance_id, franchise_name', signal }),
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (r) => r.status === "fulfilled" ? r.value : [];
      const franchiseData = getValue(results[0]);
      const summaryData = getValue(results[1]);
      const todayContactData = getValue(results[2]);
      const yesterdayContactData = getValue(results[3]);
      const allSaleData = getValue(results[4]);
      const allContactData = getValue(results[5]);
      const todaySaleData = allSaleData.filter(s => s.sale_date === today);
      const yesterdaySaleData = allSaleData.filter(s => s.sale_date === yesterday);
      const purchaseOrderData = getValue(results[6]);

      // Franchises is critical — if it failed, show error state
      if (results[0].status === "rejected") {
        const reason = results[0].reason?.message || "Erro desconhecido";
        setLoadError(`Erro ao carregar franquias: ${reason}`);
        toast.error(`Erro ao carregar franquias: ${reason}`);
        return;
      }

      // Log non-critical failures without blocking the dashboard
      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["franchises","summaries","todayContacts","yesterdayContacts","allSales","allContacts","purchaseOrders","estoque","configs"][i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setFranchises(franchiseData);
      setSummaries(summaryData);
      setTodayContacts(todayContactData);
      setYesterdayContacts(yesterdayContactData);
      setTodaySales(todaySaleData);
      setYesterdaySales(yesterdaySaleData);
      setAllSales(allSaleData);
      setAllContacts(allContactData);
      setPurchaseOrders(purchaseOrderData);

      // Inventory já veio paralelo no Promise.allSettled (index 7)
      const allInventory = getValue(results[7]);

      if (!mountedRef.current) return;

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

      setInventoryByFranchise(inventoryMap);

      // Build configMap for standardized franchise display names
      const configData = getValue(results[8]);
      setConfigMap(buildConfigMap(configData));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!mountedRef.current) return;
      console.error("Erro ao carregar dashboard admin:", err);
      setLoadError(`Erro ao carregar dados: ${err?.message || "Erro desconhecido"}`);
      toast.error(`Erro ao carregar dashboard: ${err?.message || "Erro desconhecido"}`);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [loadData]);

  useVisibilityPolling(loadData, 300000);

  const stats = useMemo(() => {
    if (period === "today") {
      const salesCount = todaySales.length;
      const prevSalesCount = yesterdaySales.length;
      const revenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const prevRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const contacts = todayContacts.length;
      const prevContacts = yesterdayContacts.length;
      const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
      const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
    }

    const days = period === "7d" ? 7 : 30;
    const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    const prevCutoff = format(subDays(new Date(), days * 2 - 1), "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Use raw sales/contacts data (like Reports.jsx) for accurate period filtering
    const currentSales = allSales.filter(s => {
      const d = s.sale_date;
      return d >= cutoff && d <= todayStr;
    });
    const prevSales = allSales.filter(s => {
      const d = s.sale_date;
      return d >= prevCutoff && d < cutoff;
    });
    const currentContacts = allContacts.filter(c => {
      const d = c.created_at?.substring(0, 10);
      return d >= cutoff && d <= todayStr;
    });
    const prevContactsList = allContacts.filter(c => {
      const d = c.created_at?.substring(0, 10);
      return d >= prevCutoff && d < cutoff;
    });

    const salesCount = currentSales.length;
    const prevSalesCount = prevSales.length;
    const revenue = currentSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0), 0);
    const prevRevenue = prevSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0), 0);
    const contacts = currentContacts.length;
    const prevContacts = prevContactsList.length;
    const conversion = contacts > 0 ? Math.round((salesCount / contacts) * 100) : 0;
    const prevConversion = prevContacts > 0 ? Math.round((prevSalesCount / prevContacts) * 100) : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, contacts, prevContacts, conversion, prevConversion };
  }, [period, allSales, allContacts, todaySales, yesterdaySales, todayContacts, yesterdayContacts]);

  // Live today totals for real-time chart data
  const liveTodayRevenue = useMemo(() =>
    todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0),
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
      <div className="p-4 md:p-8 space-y-6 bg-[#fbf9fa]">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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

  if (loadError) {
    return (
      <div className="p-4 md:p-8 bg-[#fbf9fa]">
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
    <div className="md:pt-20 p-4 md:p-8 space-y-6 md:space-y-8 bg-[#fbf9fa] max-w-[1920px] mx-auto">
      <AdminHeader period={period} onPeriodChange={setPeriod} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
              className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-[#291715]/5 flex flex-col gap-3 md:gap-4"
            >
              {/* Top: icon + trend */}
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center`}>
                  <MaterialIcon icon={card.materialIcon} size={20} className="md:!text-[24px]" />
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
                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight font-mono-numbers text-[#1b1c1d]">
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
        purchaseOrders={purchaseOrders}
        configMap={configMap}
      />

      <FranchiseRanking
        franchises={franchises}
        summaries={summaries}
        todaySales={todaySales}
        period={period}
        isLoading={isLoading}
        configMap={configMap}
      />

      <FranchiseHealthScore
        franchises={franchises}
        todaySales={todaySales}
        inventoryByFranchise={inventoryByFranchise}
        purchaseOrders={purchaseOrders}
        todayContacts={todayContacts}
        configMap={configMap}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DailyRevenueChart summaries={summaries} isLoading={isLoading} days={chartDays} todayRevenue={liveTodayRevenue} />
        <MessagesTrend summaries={summaries} isLoading={isLoading} days={chartDays} todayContacts={liveTodayContactsCount} />
      </div>
    </div>
  );
}
