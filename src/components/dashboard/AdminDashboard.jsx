import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { supabase } from "@/api/supabaseClient";
import { Franchise, DailySummary, Sale, DailyUniqueContact, InventoryItem, PurchaseOrder, FranchiseConfiguration, BotConversation, Contact } from "@/entities/all";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRLInteger } from "@/lib/formatters";
import { safeFailedQueriesMessage } from "@/lib/safeErrorMessage";
import AdminHeader from "./AdminHeader";
import AlertsPanel from "./AlertsPanel";
import FranchiseRanking from "./FranchiseRanking";
import FranchiseHealthScore from "./FranchiseHealthScore";
import DailyRevenueChart from "./DailyRevenueChart";
import BotSummaryCard from "./BotSummaryCard";
import FinanceiroSummaryCard from "./FinanceiroSummaryCard";
import { buildConfigMap } from "@/lib/franchiseUtils";

const isBotSource = (s) => s.source === 'bot';

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWave2, setIsLoadingWave2] = useState(true);
  const [period, setPeriod] = useState("today");
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [todayContacts, setTodayContacts] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [inventoryByFranchise, setInventoryByFranchise] = useState({});
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [configMap, setConfigMap] = useState({});
  const [botConversations, setBotConversations] = useState([]);
  const [botLeadsDaily, setBotLeadsDaily] = useState([]);
  const [humanMsgCounts, setHumanMsgCounts] = useState([]);
  const [contacts, setContacts] = useState([]);
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
      const cutoff90d = format(subDays(new Date(), 90), "yyyy-MM-dd");

      // Franchise é crítica — retry automático em caso de timeout
      const fetchFranchises = async () => {
        try {
          return await Franchise.list("city", null, { columns: 'id, city, owner_name, evolution_instance_id, name', signal });
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          return await Franchise.list("city", null, { columns: 'id, city, owner_name, evolution_instance_id, name', signal });
        }
      };

      // ═══ WAVE 1: Stats + Ranking (6 queries — aparece em ~1s) ═══
      const wave1 = await Promise.allSettled([
        fetchFranchises(),
        DailySummary.list("-date", null, { columns: 'id, franchise_id, date, sales_count, sales_value, unique_contacts', signal, fetchAll: true, gte: { date: cutoff90d } }),
        DailyUniqueContact.filter({ date: today }, null, null, { columns: 'id, franchise_id, date', signal }),
        Sale.list('-sale_date', null, { columns: 'id, value, delivery_fee, discount_amount, franchise_id, sale_date, source', signal, fetchAll: true, gte: { sale_date: cutoff90d } }),
        FranchiseConfiguration.list(null, null, { columns: 'franchise_evolution_instance_id, franchise_name', signal }),
        supabase.rpc('get_bot_leads_daily', { p_since: cutoff90d }).abortSignal(signal),
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (r) => r.status === "fulfilled" ? r.value : [];
      const franchiseData = getValue(wave1[0]);
      const summaryData = getValue(wave1[1]);
      const todayContactData = getValue(wave1[2]);
      const allSaleData = getValue(wave1[3]);
      const todaySaleData = allSaleData.filter(s => s.sale_date === today);
      const yesterdaySaleData = allSaleData.filter(s => s.sale_date === yesterday);

      if (wave1[0].status === "rejected") {
        const reason = wave1[0].reason?.message || "Erro desconhecido";
        setLoadError(`Erro ao carregar franquias: ${reason}`);
        toast.error(`Erro ao carregar franquias: ${reason}`);
        return;
      }

      // Bot leads daily RPC (Wave 1[5])
      const botLeadsRpc = wave1[5].status === "fulfilled" ? wave1[5].value : { data: [] };
      const botLeadsDailyData = botLeadsRpc?.data || [];

      const w1Failed = wave1
        .map((r, i) => r.status === "rejected" ? ["franchises","summaries","todayContacts","allSales","configs","botLeadsDaily"][i] : null)
        .filter(Boolean);
      if (w1Failed.length > 0) {
        console.warn("Wave 1 parcialmente falhou:", w1Failed);
        toast.error(safeFailedQueriesMessage(w1Failed));
      }

      const configData = getValue(wave1[4]);
      const cMap = buildConfigMap(configData);

      setFranchises(franchiseData);
      setSummaries(summaryData);
      setTodayContacts(todayContactData);
      setTodaySales(todaySaleData);
      setYesterdaySales(yesterdaySaleData);
      setAllSales(allSaleData);
      setConfigMap(cMap);
      setBotLeadsDaily(botLeadsDailyData);
      setIsLoading(false);
      hasLoadedOnceRef.current = true;

      // ═══ WAVE 2: Alertas + Health Score (background, ~27 requests → ~20 com RPC) ═══
      const wave2 = await Promise.allSettled([
        BotConversation.list('-started_at', null, { columns: 'id, franchise_id, started_at, outcome, status, updated_at', signal, fetchAll: true, gte: { started_at: cutoff90d } }),
        supabase.rpc('get_human_message_counts', { p_since: cutoff90d }).abortSignal(signal),
        Contact.list(null, null, { columns: 'id, franchise_id, status, updated_at, last_contact_at, last_purchase_at, purchase_count, nome, telefone, created_at', signal, fetchAll: true }),
        InventoryItem.list(null, null, { columns: 'id, product_name, quantity, min_stock, franchise_id', signal, fetchAll: true }),
        PurchaseOrder.list("-ordered_at", 500, { columns: 'id, franchise_id, status, ordered_at, delivered_at', signal }),
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const w2Failed = wave2
        .map((r, i) => r.status === "rejected" ? ["botConversations","humanMsgCounts","contacts","estoque","purchaseOrders"][i] : null)
        .filter(Boolean);
      if (w2Failed.length > 0) {
        console.warn("Wave 2 parcialmente falhou:", w2Failed);
        toast.error(safeFailedQueriesMessage(w2Failed));
      }

      // RPC returns { data, error } directly from supabase.rpc()
      const rpcResult = wave2[1].status === "fulfilled" ? wave2[1].value : { data: [] };
      const msgCountsData = rpcResult?.data || [];

      setBotConversations(getValue(wave2[0]));
      setHumanMsgCounts(msgCountsData);
      setContacts(getValue(wave2[2]));
      setPurchaseOrders(getValue(wave2[4]));

      // Group inventory by franchise UUID
      const allInventory = getValue(wave2[3]);
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
      setIsLoadingWave2(false);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!mountedRef.current) return;
      console.error("Erro ao carregar dashboard admin:", err);
      setLoadError(`Erro ao carregar dados: ${err?.message || "Erro desconhecido"}`);
      toast.error(`Erro ao carregar dashboard: ${err?.message || "Erro desconhecido"}`);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsLoadingWave2(false);
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

  // Build conversationMessages-compatible array from RPC counts for child components
  const conversationMessages = useMemo(() => {
    return humanMsgCounts.map(row => ({
      conversation_id: row.conversation_id,
      franchise_id: row.franchise_id,
      direction: 'human',
      _count: row.msg_count,
    }));
  }, [humanMsgCounts]);

  // Helper: sum unique_contacts from summaries for a date range
  const contactsFromSummaries = useCallback((startDate, endDate) => {
    return summaries
      .filter(s => s.date >= startDate && s.date <= endDate)
      .reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
  }, [summaries]);

  // Helper: conversion rate = total sales / concluded bot conversations for a date range
  // Uses server-side RPC aggregates (get_bot_leads_daily) instead of iterating all rows
  const botLeadsForRange = useCallback((startDate, endDate) => {
    let total = 0, ongoing = 0;
    for (const row of botLeadsDaily) {
      const d = row.day;
      if (d >= startDate && d <= endDate) {
        total += Number(row.total_count) || 0;
        ongoing += Number(row.ongoing_count) || 0;
      }
    }
    return total - ongoing;
  }, [botLeadsDaily]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

    if (period === "today") {
      const salesCount = todaySales.length;
      const prevSalesCount = yesterdaySales.length;
      const revenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const prevRevenue = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const contacts = Math.max(todayContacts.length, contactsFromSummaries(todayStr, todayStr));
      const prevContacts = contactsFromSummaries(yesterdayStr, yesterdayStr);
      const leads = botLeadsForRange(todayStr, todayStr);
      const prevLeads = botLeadsForRange(yesterdayStr, yesterdayStr);
      const conversion = leads > 0 ? Math.round((salesCount / leads) * 100) : 0;
      const prevConversion = prevLeads > 0 ? Math.round((prevSalesCount / prevLeads) * 100) : 0;
      const botPercent = salesCount > 0 ? Math.round(todaySales.filter(isBotSource).length / salesCount * 100) : 0;
      const prevBotPercent = prevSalesCount > 0 ? Math.round(yesterdaySales.filter(isBotSource).length / prevSalesCount * 100) : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, conversion, prevConversion, botPercent, prevBotPercent };
    }

    const days = period === "7d" ? 7 : 30;
    const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    const prevCutoff = format(subDays(new Date(), days * 2 - 1), "yyyy-MM-dd");

    const currentSales = allSales.filter(s => s.sale_date >= cutoff && s.sale_date <= todayStr);
    const prevSales = allSales.filter(s => s.sale_date >= prevCutoff && s.sale_date < cutoff);

    const salesCount = currentSales.length;
    const prevSalesCount = prevSales.length;
    const revenue = currentSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0) - (parseFloat(sale.discount_amount) || 0) + (parseFloat(sale.delivery_fee) || 0), 0);
    const prevRevenue = prevSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0) - (parseFloat(sale.discount_amount) || 0) + (parseFloat(sale.delivery_fee) || 0), 0);
    let contacts = contactsFromSummaries(cutoff, todayStr);
    if (todayContacts.length > 0) contacts = Math.max(contacts, contactsFromSummaries(cutoff, format(subDays(new Date(), 1), "yyyy-MM-dd")) + todayContacts.length);
    const prevContacts = contactsFromSummaries(prevCutoff, format(subDays(new Date(), days), "yyyy-MM-dd"));
    const leads = botLeadsForRange(cutoff, todayStr);
    const prevLeads = botLeadsForRange(prevCutoff, format(subDays(new Date(), days), "yyyy-MM-dd"));
    const conversion = leads > 0 ? Math.round((salesCount / leads) * 100) : 0;
    const prevConversion = prevLeads > 0 ? Math.round((prevSalesCount / prevLeads) * 100) : 0;
    const botPercent = salesCount > 0 ? Math.round(currentSales.filter(isBotSource).length / salesCount * 100) : 0;
    const prevBotPercent = prevSalesCount > 0 ? Math.round(prevSales.filter(isBotSource).length / prevSalesCount * 100) : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, conversion, prevConversion, botPercent, prevBotPercent };
  }, [period, allSales, todaySales, yesterdaySales, todayContacts, summaries, contactsFromSummaries, botLeadsForRange, botLeadsDaily]);

  const liveTodayRevenue = useMemo(() =>
    todaySales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0),
    [todaySales]
  );

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

  const statsCards = [
    {
      title: "VENDAS",
      value: stats.salesCount,
      rawValue: stats.salesCount,
      previousValue: stats.prevSalesCount,
      materialIcon: "shopping_bag",
      trend: trendFor(stats.salesCount, stats.prevSalesCount),
      iconBg: "bg-[#a80012]/10",
      iconColor: "text-[#a80012]",
      trendColor: "text-[#a80012]",
    },
    {
      title: "FATURAMENTO",
      value: formatBRLInteger(stats.revenue),
      rawValue: stats.revenue,
      previousValue: stats.prevRevenue,
      materialIcon: "payments",
      trend: trendFor(stats.revenue, stats.prevRevenue),
      iconBg: "bg-[#775a19]/10",
      iconColor: "text-[#775a19]",
      trendColor: "text-[#a80012]",
    },
    {
      title: "CONVERSÃO",
      value: `${stats.conversion}%`,
      rawValue: stats.conversion,
      previousValue: stats.prevConversion,
      materialIcon: "trending_up",
      trend: trendFor(stats.conversion, stats.prevConversion),
      iconBg: "bg-[#775a19]/10",
      iconColor: "text-[#775a19]",
      trendColor: "text-[#a80012]",
    },
    {
      title: "VENDAS BOT",
      value: `${stats.botPercent}%`,
      rawValue: stats.botPercent,
      previousValue: stats.prevBotPercent,
      materialIcon: "smart_toy",
      trend: trendFor(stats.botPercent, stats.prevBotPercent),
      iconBg: "bg-[#705d00]/10",
      iconColor: "text-[#705d00]",
      trendColor: "text-[#a80012]",
    },
  ];

  return (
    <div className="md:pt-20 p-4 md:p-8 space-y-6 md:space-y-8 bg-[#fbf9fa] max-w-[1920px] mx-auto">
      <AdminHeader period={period} onPeriodChange={setPeriod} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statsCards.map((card) => {
          const numericValue = card.rawValue;
          let percentageChange = null;
          if (card.previousValue > 0) {
            percentageChange = ((numericValue - card.previousValue) / card.previousValue) * 100;
          }
          const isUp = card.trend === "up";
          const isDown = card.trend === "down";

          let trendTextColor;
          if (card.trendColor) {
            trendTextColor = card.trendColor;
          } else {
            trendTextColor = isDown ? "text-[#ba1a1a]" : "text-[#a80012]";
          }

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
                {card.trend && percentageChange !== null && (
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
            </div>
          );
        })}
      </div>

      {/* Wave 2 sections — skeleton while loading */}
      {isLoadingWave2 ? (
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <AlertsPanel
            franchises={franchises}
            allSales={allSales}
            inventoryByFranchise={inventoryByFranchise}
            purchaseOrders={purchaseOrders}
            configMap={configMap}
            botConversations={botConversations}
            conversationMessages={conversationMessages}
            contacts={contacts}
          />

          <FranchiseHealthScore
            franchises={franchises}
            allSales={allSales}
            inventoryByFranchise={inventoryByFranchise}
            purchaseOrders={purchaseOrders}
            todayContacts={todayContacts}
            configMap={configMap}
            botConversations={botConversations}
            conversationMessages={conversationMessages}
            botSales={allSales}
          />

          {/* Mini-cards de drill-down */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <BotSummaryCard botConversations={botConversations} />
            <FinanceiroSummaryCard allSales={allSales} configMap={configMap} />
          </div>
        </>
      )}

      <FranchiseRanking
        franchises={franchises}
        summaries={summaries}
        todaySales={todaySales}
        period={period}
        isLoading={isLoading}
        configMap={configMap}
      />

      {/* Chart — Faturamento por dia usando dados reais de vendas */}
      <DailyRevenueChart allSales={allSales} isLoading={isLoading} days={chartDays} />
    </div>
  );
}
