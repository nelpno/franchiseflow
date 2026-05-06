import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useNavigate } from "react-router-dom";
import { Sale, DailySummary, DailyChecklist, InventoryItem, Contact, getFranchiseRanking, getFranchiseRankingMonthly, PurchaseOrder, OnboardingChecklist, FranchiseConfiguration, MarketingPayment } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, differenceInDays, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRLInteger } from "@/lib/formatters";
import StatsCard from "./StatsCard";
import FranchiseeGreeting from "./FranchiseeGreeting";
import DailyGoalProgress from "./DailyGoalProgress";
import MiniRevenueChart from "./MiniRevenueChart";
import RankingStreak from "./RankingStreak";
import SmartActions from "./SmartActions";
import FinancialObligationsCard from "./FinancialObligationsCard";
import PriorityAction from "./PriorityAction";
import SubscriptionPaymentSheet from "@/components/shared/SubscriptionPaymentSheet";
import CustomDateRangeSheet from "./CustomDateRangeSheet";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { generateSmartActions } from "@/lib/smartActions";

const MONTH_OFFSET_MIN = -2;

function formatMonthLabel(offset) {
  const raw = format(addMonths(new Date(), offset), "MMM/yyyy", { locale: ptBR });
  const cleaned = raw.replace(".", "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function FranchiseeDashboard() {
  const { user, selectedFranchise: ctxFranchise } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [franchise, setFranchise] = useState(null);
  const [allSales, setAllSales] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [onboardingChecklist, setOnboardingChecklist] = useState(null);
  const [franchiseConfig, setFranchiseConfig] = useState(null);
  const [marketingPayment, setMarketingPayment] = useState(null);
  const [period, setPeriod] = useState("today");
  const [monthOffset, setMonthOffset] = useState(0);
  const [customRange, setCustomRange] = useState(null);
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [monthlyRanking, setMonthlyRanking] = useState(null);
  const { subscription, checkPaymentNow, isChecking } = useSubscriptionStatus();
  const [prioritySheetOpen, setPrioritySheetOpen] = useState(false);

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
    // Safety timeout: garante que loading é desligado mesmo se queries travarem
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.warn('[Dashboard] Safety timeout fired — forçando fim do loading');
        controller.abort();
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }, 10000);
    try {
      setFranchise(ctxFranchise);

      const today = getToday();
      const yesterday = getYesterday();
      // Janela 90d: cobre period max "month" (30d) com folga 3×. healthScore + stats não precisam de mais.
      const cutoff90d = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const evoId = ctxFranchise?.evolution_instance_id;
      const results = await Promise.allSettled([
        evoId ? Sale.filter({ franchise_id: evoId }, "-sale_date", null,
          { columns: 'id, franchise_id, value, delivery_fee, discount_amount, card_fee_amount, sale_date, contact_id, created_at, payment_method, source', signal, fetchAll: true, gte: { sale_date: cutoff90d } })
          : Promise.resolve([]),                          // [0] sales últimos 90d (+ source for bot filter)
        evoId ? DailySummary.filter({ franchise_id: evoId }, "-date", 30,
          { columns: 'id, franchise_id, date, sales_count, sales_value, unique_contacts', signal })
          : Promise.resolve([]),                          // [1] summaries (MiniRevenueChart, dailyGoal)
        evoId ? InventoryItem.filter({ franchise_id: evoId }, null, null,
          { columns: 'id, franchise_id, product_name, quantity, min_stock', signal })
          : Promise.resolve([]),                          // [2] inventory
        evoId ? DailyChecklist.filter({ franchise_id: evoId, date: today }, null, null, { signal })
          : Promise.resolve([]),                          // [3] checklist
        evoId ? Contact.filter({ franchise_id: evoId }, "-last_contact_at", 200,
          { columns: 'id, nome, telefone, status, source, last_contact_at, last_purchase_at, purchase_count, total_spent, created_at, updated_at', signal })
          : Promise.resolve([]),                          // [4] contacts
        evoId ? getFranchiseRanking(today, evoId, { signal }) : Promise.resolve(null), // [5] ranking
        evoId ? PurchaseOrder.filter({ franchise_id: evoId }, "-ordered_at", 50, { signal })
          : Promise.resolve([]),                          // [6] purchase orders (health: reposição)
        evoId ? OnboardingChecklist.filter({ franchise_id: evoId }, null, 1, { signal })
          : Promise.resolve([]),                          // [7] onboarding (health: setup)
        evoId ? FranchiseConfiguration.filter({ franchise_evolution_instance_id: evoId }, null, 1, { signal })
          : Promise.resolve([]),                          // [8] config (health: setup/whatsapp)
        evoId ? MarketingPayment.filter({ franchise_id: evoId }, "-reference_month", 1, { signal })
          : Promise.resolve([]),                          // [9] marketing payment (priority action)
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (i) => results[i].status === "fulfilled" ? results[i].value : [];
      const allSalesData = getValue(0);
      const summariesData = getValue(1);
      const inventoryData = getValue(2);
      const contactsData = getValue(4);

      const queryNames = ["vendas","resumos","estoque","checklist","contatos","ranking","pedidos","onboarding","config","marketing"];
      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? queryNames[i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Dashboard queries falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setAllSales(allSalesData);
      setSummaries(summariesData);

      setContacts(contactsData);
      setInventory(inventoryData);

      setPurchaseOrders(getValue(6));
      setOnboardingChecklist(getValue(7)?.[0] || null);
      setFranchiseConfig(getValue(8)?.[0] || null);
      setMarketingPayment(getValue(9)?.[0] || null);



      // Ranking — index [5]
      setRanking(results[5].status === "fulfilled" ? results[5].value : null);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!mountedRef.current) return;
      console.error("Erro ao carregar dashboard:", err);
      setLoadError(`Erro ao carregar dados: ${err?.message || "Erro desconhecido"}`);
      toast.error(`Erro ao carregar dashboard: ${err?.message || "Erro desconhecido"}`);
    } finally {
      clearTimeout(safetyTimer);
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

  // Helper: compute revenue from sales array
  const calcRevenue = useCallback((sales) =>
    sales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0),
  []);

  // Derive today/yesterday from allSales — recalculates when allSales changes (polling refresh)
  const todaySales = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return allSales.filter((s) => s.sale_date === todayStr);
  }, [allSales]);
  const yesterdaySales = useMemo(() => {
    const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");
    return allSales.filter((s) => s.sale_date === yesterdayStr);
  }, [allSales]);

  // Stats based on selected period — uses allSales directly (real-time, not cron)
  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

    if (period === "today") {
      const current = allSales.filter((s) => s.sale_date === today);
      const prev = allSales.filter((s) => s.sale_date === yesterday);
      const salesCount = current.length;
      const prevSalesCount = prev.length;
      const revenue = calcRevenue(current);
      const prevRevenue = calcRevenue(prev);
      const avgTicket = salesCount > 0 ? revenue / salesCount : 0;
      const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
      return { salesCount, prevSalesCount, revenue, prevRevenue, avgTicket, prevAvgTicket };
    }

    let cutoff, endCutoff, prevCutoff, prevEndCutoff;
    if (period === "week") {
      const now = new Date();
      const wkStart = startOfWeek(now, { weekStartsOn: 1 });
      const days = differenceInDays(now, wkStart) + 1;
      cutoff = format(wkStart, "yyyy-MM-dd");
      endCutoff = format(now, "yyyy-MM-dd");
      prevCutoff = format(subDays(wkStart, days), "yyyy-MM-dd");
      prevEndCutoff = format(subDays(wkStart, 1), "yyyy-MM-dd");
    } else if (period === "month") {
      const refDate = addMonths(new Date(), monthOffset);
      const mStart = startOfMonth(refDate);
      const mEnd = endOfMonth(refDate);
      const prevMStart = startOfMonth(subMonths(mStart, 1));
      const prevMEnd = endOfMonth(subMonths(mStart, 1));
      cutoff = format(mStart, "yyyy-MM-dd");
      endCutoff = format(mEnd, "yyyy-MM-dd");
      prevCutoff = format(prevMStart, "yyyy-MM-dd");
      prevEndCutoff = format(prevMEnd, "yyyy-MM-dd");
    } else if (period === "custom" && customRange?.start && customRange?.end) {
      const days = differenceInDays(customRange.end, customRange.start) + 1;
      cutoff = format(customRange.start, "yyyy-MM-dd");
      endCutoff = format(customRange.end, "yyyy-MM-dd");
      prevCutoff = format(subDays(customRange.start, days), "yyyy-MM-dd");
      prevEndCutoff = format(subDays(customRange.start, 1), "yyyy-MM-dd");
    } else {
      const days = 7;
      cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
      endCutoff = format(new Date(), "yyyy-MM-dd");
      prevCutoff = format(subDays(new Date(), days * 2 - 1), "yyyy-MM-dd");
      prevEndCutoff = format(subDays(new Date(), days), "yyyy-MM-dd");
    }

    const currentSales = allSales.filter((s) => s.sale_date >= cutoff && s.sale_date <= endCutoff);
    const prevSales = allSales.filter((s) => s.sale_date >= prevCutoff && s.sale_date <= prevEndCutoff);

    const salesCount = currentSales.length;
    const prevSalesCount = prevSales.length;
    const revenue = calcRevenue(currentSales);
    const prevRevenue = calcRevenue(prevSales);
    const avgTicket = salesCount > 0 ? revenue / salesCount : 0;
    const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;

    return { salesCount, prevSalesCount, revenue, prevRevenue, avgTicket, prevAvgTicket };
  }, [period, monthOffset, customRange, allSales, calcRevenue]);

  const todayRevenue = calcRevenue(todaySales);

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
    // Group by date to get unique days (avoid dividing by rows)
    const byDate = {};
    recentDays.forEach((s) => {
      byDate[s.date] = (byDate[s.date] || 0) + (parseFloat(s.sales_value) || 0);
    });
    const dailyTotals = Object.values(byDate);
    if (dailyTotals.length < 7) return null;
    const avg = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
    return Math.round(avg * 1.10);
  }, [summaries, evoId]);

  // Ranking mensal entre franquias — fora do useVisibilityPolling de propósito.
  // Só dispara quando filtro muda. AbortController evita race em ◀◀◀ rápido.
  useEffect(() => {
    if (!evoId) return;
    const controller = new AbortController();
    let yearMonth;
    if (period === "month") {
      yearMonth = format(addMonths(new Date(), monthOffset), "yyyy-MM");
    } else if (period === "custom" && customRange?.start) {
      yearMonth = format(customRange.start, "yyyy-MM");
    } else {
      yearMonth = format(new Date(), "yyyy-MM");
    }
    getFranchiseRankingMonthly(yearMonth, evoId, { signal: controller.signal })
      .then((r) => { if (mountedRef.current) setMonthlyRanking(r); })
      .catch(() => { /* abort ou erro silencioso — mantém último valor */ });
    return () => controller.abort();
  }, [evoId, period, monthOffset, customRange?.start]);

  // Bot is active if franchise has a config with evolution_instance_id
  const botActive = !!(franchiseConfig && evoId);

  // Smart actions for contacts (bot active = suppress "responder" since bot handles first contact)
  const actions = useMemo(
    () => generateSmartActions(contacts, 5, { botActive }),
    [contacts, botActive]
  );

  // Which priority type is active (to exclude from SmartActions "Outras Ações")
  const activePriorityType = useMemo(() => {
    const lowStock = inventory.some(i => (i.quantity || 0) === 0);
    if (lowStock) return 'repor_estoque';
    if (actions.some(a => a.type === 'responder')) return 'responder';
    if (!marketingPayment || marketingPayment.status === 'rejected') return 'marketing';
    if (!botActive) return 'bot_inativo';
    return null;
  }, [inventory, actions, marketingPayment, botActive]);

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
        </div>
      </div>

      {(() => {
        const monthLabel = formatMonthLabel(monthOffset);
        const prevDisabled = monthOffset <= MONTH_OFFSET_MIN;
        const nextDisabled = monthOffset >= 0;
        const isMonthActive = period === "month";
        const isCustomActive = period === "custom" && !!customRange;
        const customLabel = isCustomActive
          ? `${format(customRange.start, "dd/MM")} – ${format(customRange.end, "dd/MM")}`
          : "Personalizado";

        return (
          <div className="flex gap-1 bg-[#291715]/5 p-1 rounded-xl mb-4 overflow-x-auto sm:w-fit sm:max-w-full">
            {["today", "week"].map((value) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`px-3 py-1.5 text-sm font-plus-jakarta transition-all active:scale-95 rounded-lg whitespace-nowrap min-h-[40px] ${
                  period === value
                    ? "font-bold text-white bg-[#b91c1c] shadow-sm"
                    : "font-medium text-[#1b1c1d]/70"
                }`}
              >
                {value === "today" ? "Hoje" : "Semana"}
              </button>
            ))}

            <div
              className={`flex items-center rounded-lg whitespace-nowrap transition-colors min-h-[40px] ${
                isMonthActive ? "bg-[#b91c1c] text-white shadow-sm" : "text-[#1b1c1d]/70"
              }`}
            >
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => {
                  setPeriod("month");
                  setMonthOffset((o) => Math.max(MONTH_OFFSET_MIN, o - 1));
                }}
                disabled={prevDisabled}
                className={`flex items-center justify-center min-w-[32px] min-h-[40px] rounded-l-lg transition-opacity ${
                  prevDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-black/10"
                }`}
              >
                <MaterialIcon icon="chevron_left" size={18} />
              </button>
              <button
                type="button"
                aria-label={`Filtrar por ${monthLabel}`}
                onClick={() => setPeriod("month")}
                className="px-2 py-1.5 text-xs font-plus-jakarta font-bold tabular-nums hover:bg-black/5 transition-colors min-w-[80px] text-center"
              >
                {monthLabel}
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => {
                  setPeriod("month");
                  setMonthOffset((o) => Math.min(0, o + 1));
                }}
                disabled={nextDisabled}
                className={`flex items-center justify-center min-w-[32px] min-h-[40px] rounded-r-lg transition-opacity ${
                  nextDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-black/10"
                }`}
              >
                <MaterialIcon icon="chevron_right" size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCustomSheetOpen(true)}
              className={`px-2 sm:px-3 py-1.5 text-sm font-plus-jakarta transition-all active:scale-95 rounded-lg whitespace-nowrap min-h-[40px] flex items-center gap-1 ${
                isCustomActive
                  ? "font-bold text-white bg-[#b91c1c] shadow-sm"
                  : "font-medium text-[#1b1c1d]/70"
              }`}
              aria-label="Período personalizado"
              title="Período personalizado"
            >
              <MaterialIcon icon="event" size={16} />
              {isCustomActive ? (
                <span className="tabular-nums">{customLabel}</span>
              ) : (
                <span className="hidden sm:inline">Personalizado</span>
              )}
            </button>
          </div>
        );
      })()}

      <section className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <StatsCard
          title={period === "today" ? "Vendas Hoje" : "Vendas"}
          value={stats.salesCount}
          rawValue={stats.salesCount}
          previousValue={stats.prevSalesCount}
          trend={stats.salesCount > stats.prevSalesCount ? 'up' : stats.salesCount < stats.prevSalesCount ? 'down' : null}
          href="/Vendas"
        />
        <StatsCard
          title="Faturamento"
          value={formatBRLInteger(stats.revenue)}
          rawValue={stats.revenue}
          previousValue={stats.prevRevenue}
          trend={stats.revenue > stats.prevRevenue ? 'up' : stats.revenue < stats.prevRevenue ? 'down' : null}
          href="/Gestao?tab=resultado"
        />
        <StatsCard
          title="Valor Médio"
          value={formatBRLInteger(stats.avgTicket)}
          rawValue={stats.avgTicket}
          previousValue={stats.prevAvgTicket}
          trend={stats.avgTicket > stats.prevAvgTicket ? 'up' : stats.avgTicket < stats.prevAvgTicket ? 'down' : null}
          href="/Vendas"
        />
      </section>

      {(period === "today" || (period === "month" && monthOffset === 0)) && (
        <DailyGoalProgress todayRevenue={todayRevenue} dailyGoal={dailyGoal} />
      )}

      <PriorityAction
        smartActions={actions}
        marketingPayment={marketingPayment}
        botActive={botActive}
        subscription={subscription}
        onOpenPaymentSheet={() => setPrioritySheetOpen(true)}
      />

      <RankingStreak
        ranking={ranking}
        monthlyRanking={monthlyRanking}
        period={period}
        monthLabel={
          period === "month"
            ? formatMonthLabel(monthOffset)
            : period === "custom" && customRange?.start
            ? format(customRange.start, "MMM/yyyy", { locale: ptBR }).replace(".", "")
            : formatMonthLabel(0)
        }
        isCurrentMonth={period !== "month" || monthOffset === 0}
        summaries={summaries}
        franchiseId={evoId}
        dailyGoal={dailyGoal}
      />

      <MiniRevenueChart
        summaries={summaries}
        franchiseId={evoId}
        todayRevenue={todayRevenue}
        allSales={allSales}
        period={period}
        monthOffset={monthOffset}
        customRange={customRange}
      />

      <FinancialObligationsCard marketingPayment={marketingPayment} />

      <SubscriptionPaymentSheet
        open={prioritySheetOpen}
        onOpenChange={setPrioritySheetOpen}
        subscription={subscription}
        checkPaymentNow={checkPaymentNow}
        isChecking={isChecking}
      />

      <CustomDateRangeSheet
        open={customSheetOpen}
        onOpenChange={setCustomSheetOpen}
        currentRange={customRange}
        onApply={(range) => {
          setCustomRange(range);
          setPeriod("custom");
        }}
        onClear={() => {
          setCustomRange(null);
          setPeriod("today");
        }}
      />

      <SmartActions contacts={contacts} franchiseId={evoId} excludeType={activePriorityType} botActive={botActive} />

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
