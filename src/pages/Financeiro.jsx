import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Franchise, Sale, SaleItem, Expense, InventoryItem, User } from "@/entities/all";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format, subMonths, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculatePnL, isInMonth, groupByFranchiseAndMonth } from "@/lib/financialCalcs";
import { safeFailedQueriesMessage } from "@/lib/safeErrorMessage";
import FinanceiroKpiCards from "@/components/financeiro/FinanceiroKpiCards";
import FranchiseFinanceTable from "@/components/financeiro/FranchiseFinanceTable";
import AsaasSetupPanel from "@/components/financeiro/AsaasSetupPanel";
import TabResultado from "@/components/minha-loja/TabResultado";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

export default function Financeiro() {
  const [activeTab, setActiveTab] = useState("financeiro"); // "financeiro" | "mensalidades" | "porunidade"
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [franchises, setFranchises] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [allSaleItems, setAllSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load base data once (franchises, sales, expenses, inventory)
  const loadBaseData = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setLoadError(null);

    try {
      const user = await User.me();
      if (!mountedRef.current) return;
      if (user.role !== "admin" && user.role !== "manager") {
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      // Janela 18m: cobre 12m úteis + buffer comparativo M-1 (mês -13 ainda dentro do range).
      const cutoff18m = format(subMonths(new Date(), 18), "yyyy-MM-dd");
      const results = await Promise.allSettled([
        Franchise.list(),
        Sale.list("-sale_date", null, {
          columns: "id, franchise_id, sale_date, value, delivery_fee, discount_amount, card_fee_amount, payment_method, created_at",
          fetchAll: true,
          gte: { sale_date: cutoff18m },
        }),
        Expense.list("-expense_date", null, {
          columns: "id, franchise_id, expense_date, amount",
          fetchAll: true,
          gte: { expense_date: cutoff18m },
        }),
        InventoryItem.list("franchise_id", null, {
          columns: "id, franchise_id, product_name, cost_price, sale_price, quantity, min_stock",
          fetchAll: true,
        }),
      ]);

      if (!mountedRef.current) return;

      const getValue = (r) => (r.status === "fulfilled" ? r.value : []);
      const franchisesData = getValue(results[0]);
      const salesData = getValue(results[1]);
      const expensesData = getValue(results[2]);
      const inventoryData = getValue(results[3]);

      const failedQueries = results
        .map((r, i) => (r.status === "rejected" ? ["franquias", "vendas", "despesas", "estoque"][i] : null))
        .filter(Boolean);
      if (failedQueries.length > 0) {
        toast.error(safeFailedQueriesMessage(failedQueries));
      }

      if (!mountedRef.current) return;
      setFranchises(franchisesData);
      setAllSales(salesData);
      setAllExpenses(expensesData);
      setAllInventory(inventoryData);
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error);
      if (mountedRef.current) {
        setLoadError(error.message || "Erro ao carregar dados");
        toast.error("Erro ao carregar dados financeiros");
      }
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  // Load SaleItems when base sales are ready or month changes
  useEffect(() => {
    if (allSales.length === 0) return;
    let cancelled = false;

    const prevMonth = subMonths(selectedMonth, 1);
    const relevantSaleIds = allSales
      .filter((s) => {
        const d = s.sale_date || s.created_at;
        return isInMonth(d, selectedMonth) || isInMonth(d, prevMonth);
      })
      .map((s) => s.id);

    if (relevantSaleIds.length === 0) {
      setAllSaleItems([]);
      return;
    }

    // Batch IDs in chunks of 500 to avoid URL length limits
    const fetchSaleItems = async () => {
      const chunkSize = 500;
      const allItems = [];
      for (let i = 0; i < relevantSaleIds.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = relevantSaleIds.slice(i, i + chunkSize);
        try {
          const items = await SaleItem.filter(
            { sale_id: chunk },
            null,
            null,
            { columns: "id, sale_id, quantity, unit_price, cost_price, product_name" }
          );
          allItems.push(...items);
        } catch (err) {
          console.warn("SaleItems chunk failed:", err);
        }
      }
      if (!cancelled && mountedRef.current) {
        setAllSaleItems(allItems);
      }
    };

    fetchSaleItems();
    return () => { cancelled = true; };
  }, [allSales, selectedMonth]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useVisibilityPolling(loadBaseData, 300000);

  // --- Month navigation ---
  const handlePrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => {
    const next = addMonths(selectedMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // --- Build sale_id → franchise_id lookup ---
  const saleIdToFranchise = useMemo(() => {
    const map = {};
    for (const s of allSales) map[s.id] = s.franchise_id;
    return map;
  }, [allSales]);

  // --- Aggregate per franchise ---
  const { franchiseData, aggregated, worstFranchise, inventoryByFranchise, saleItemsByFranchise } = useMemo(() => {
    const prevMonth = subMonths(selectedMonth, 1);
    const grouped = groupByFranchiseAndMonth(allSales, allExpenses, selectedMonth);
    const prevGrouped = groupByFranchiseAndMonth(allSales, allExpenses, prevMonth);

    // Map sale_items to franchise via sale_id
    const saleItemsByFranchise = {};
    for (const si of allSaleItems) {
      const fid = saleIdToFranchise[si.sale_id];
      if (!fid) continue;
      if (!saleItemsByFranchise[fid]) saleItemsByFranchise[fid] = [];
      saleItemsByFranchise[fid].push(si);
    }

    // Filter sale items by month
    const monthSaleIds = new Set(
      allSales
        .filter((s) => isInMonth(s.sale_date || s.created_at, selectedMonth))
        .map((s) => s.id)
    );
    const prevMonthSaleIds = new Set(
      allSales
        .filter((s) => isInMonth(s.sale_date || s.created_at, prevMonth))
        .map((s) => s.id)
    );

    const currentSaleItemsByFranchise = {};
    const prevSaleItemsByFranchise = {};
    for (const si of allSaleItems) {
      const fid = saleIdToFranchise[si.sale_id];
      if (!fid) continue;
      if (monthSaleIds.has(si.sale_id)) {
        if (!currentSaleItemsByFranchise[fid]) currentSaleItemsByFranchise[fid] = [];
        currentSaleItemsByFranchise[fid].push(si);
      }
      if (prevMonthSaleIds.has(si.sale_id)) {
        if (!prevSaleItemsByFranchise[fid]) prevSaleItemsByFranchise[fid] = [];
        prevSaleItemsByFranchise[fid].push(si);
      }
    }

    let totalRecebidoAll = 0, lucroAll = 0;
    const data = [];

    for (const franchise of franchises) {
      const evoId = franchise.evolution_instance_id;
      if (!evoId) continue;

      const monthData = grouped.get(evoId) || { sales: [], expenses: [] };
      const prevData = prevGrouped.get(evoId) || { sales: [], expenses: [] };

      const pnl = calculatePnL(
        monthData.sales,
        currentSaleItemsByFranchise[evoId] || [],
        monthData.expenses
      );
      const prevPnl = calculatePnL(
        prevData.sales,
        prevSaleItemsByFranchise[evoId] || [],
        prevData.expenses
      );

      totalRecebidoAll += pnl.totalRecebido;
      lucroAll += pnl.lucro;

      data.push({
        franchiseId: evoId,
        franchiseUUID: franchise.id,
        name: franchise.name,
        city: franchise.city,
        ownerName: franchise.owner_name,
        pnl,
        prevPnl,
      });
    }

    const margemAll = totalRecebidoAll > 0 ? (lucroAll / totalRecebidoAll) * 100 : 0;
    const agg = { totalRecebido: totalRecebidoAll, lucro: lucroAll, margem: margemAll };

    // Worst franchise by margin (only those with sales)
    const withSales = data.filter((d) => d.pnl.salesCount > 0);
    const worst = withSales.length > 0
      ? withSales.reduce((min, d) => (d.pnl.margem < min.pnl.margem ? d : min))
      : null;
    const worstInfo = worst ? { name: worst.name, margem: worst.pnl.margem } : null;

    // Inventory grouped by franchise
    const invByFranchise = {};
    for (const item of allInventory) {
      const fid = item.franchise_id;
      if (!invByFranchise[fid]) invByFranchise[fid] = [];
      invByFranchise[fid].push(item);
    }

    return {
      franchiseData: data,
      aggregated: agg,
      worstFranchise: worstInfo,
      inventoryByFranchise: invByFranchise,
      saleItemsByFranchise: currentSaleItemsByFranchise,
    };
  }, [franchises, allSales, allExpenses, allSaleItems, allInventory, selectedMonth, saleIdToFranchise]);

  // --- Render ---
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="h-8 w-48 bg-[#e9e8e9] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#e9e8e9] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-[#e9e8e9] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <MaterialIcon icon="error_outline" size={48} className="text-[#dc2626]" />
        <p className="text-[#4a3d3d]">{loadError}</p>
        <Button onClick={loadBaseData} variant="outline" className="rounded-xl">
          <MaterialIcon icon="refresh" size={16} className="mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#a80012] flex items-center justify-center">
              <MaterialIcon icon="account_balance" size={24} className="text-white" />
            </div>
            Financeiro
          </h1>
          <p className="text-[#4a3d3d] mt-1 text-sm">
            Visao financeira de todas as franquias
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { key: "financeiro", label: "Resultado", icon: "account_balance" },
            { key: "porunidade", label: "Por Unidade", icon: "store" },
            { key: "mensalidades", label: "Mensalidades", icon: "autorenew" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-[#1b1c1d] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <MaterialIcon icon={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "mensalidades" ? (
        <AsaasSetupPanel />
      ) : activeTab === "porunidade" ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#291715]/5 p-4 flex items-center gap-3">
            <MaterialIcon icon="store" size={20} className="text-[#1b1c1d]/60 shrink-0" />
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-[#1b1c1d] outline-none cursor-pointer"
            >
              <option value="">Selecione uma unidade…</option>
              {franchises
                .filter((f) => f.evolution_instance_id)
                .slice()
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                .map((f) => (
                  <option key={f.id} value={f.evolution_instance_id}>
                    {getFranchiseDisplayName(f)}
                  </option>
                ))}
            </select>
          </div>
          {selectedFranchiseId ? (
            <TabResultado franchiseId={selectedFranchiseId} currentUser={currentUser} />
          ) : (
            <div className="bg-white rounded-2xl border border-[#291715]/5 p-12 text-center">
              <MaterialIcon icon="info" size={32} className="text-[#1b1c1d]/30 mx-auto mb-3" />
              <p className="text-sm text-[#4a3d3d]">Escolha uma unidade acima para ver o resultado igual à visão do franqueado.</p>
            </div>
          )}
        </div>
      ) : (
      <>
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="h-9 w-9 rounded-xl"
          >
            <MaterialIcon icon="chevron_left" size={20} />
          </Button>
          <span className="text-sm font-semibold text-[#1b1c1d] min-w-[120px] text-center capitalize">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className="h-9 w-9 rounded-xl"
          >
            <MaterialIcon icon="chevron_right" size={20} />
          </Button>
        </div>

      {/* KPI Cards */}
      <FinanceiroKpiCards aggregated={aggregated} worstFranchise={worstFranchise} />

      {/* Franchise Table */}
      <FranchiseFinanceTable
        franchiseData={franchiseData}
        inventoryByFranchise={inventoryByFranchise}
        saleItemsByFranchise={saleItemsByFranchise}
      />

      {/* Footer info */}
      <p className="text-xs text-[#7a6d6d] text-center">
        {franchiseData.length} franquias &middot; Dados de {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
      </p>
      </>
      )}
    </div>
  );
}
