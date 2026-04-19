import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Franchise,
  Sale,
  Contact,
  FranchiseConfiguration,
  BotConversation,
  SystemSubscription,
} from "@/entities/all";
import ErrorBoundary from "../components/ErrorBoundary";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

import FranchiseReportTable from "../components/reports/FranchiseReportTable";
import FranchiseReportToolbar, {
  computeRange,
} from "../components/reports/FranchiseReportToolbar";
import { sanitizeCSVCell } from "@/lib/csvSanitize";
import { buildConfigMap } from "@/lib/franchiseUtils";

function ReportsContent() {
  const [franchises, setFranchises] = useState([]);
  const [configMap, setConfigMap] = useState({});
  const [rawSales, setRawSales] = useState([]);
  const [rawContacts, setRawContacts] = useState([]);
  const [rawBotConversations, setRawBotConversations] = useState([]);
  const [rawSubscriptions, setRawSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodPreset, setPeriodPreset] = useState("30d");
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 29), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  const loadAllData = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    setIsLoading(true);
    setLoadError(null);

    try {
      const results = await Promise.allSettled([
        Franchise.list(null, null, { signal }),
        FranchiseConfiguration.list(null, null, {
          columns: "franchise_evolution_instance_id, franchise_name",
          signal,
        }),
        Sale.list("-sale_date", null, {
          fetchAll: true,
          filter: `sale_date=gte.${startDate}&sale_date=lte.${endDate}`,
          signal,
        }),
        Contact.list("-created_at", null, {
          fetchAll: true,
          filter: `created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59.999`,
          signal,
        }),
        BotConversation.list("-started_at", null, {
          fetchAll: true,
          columns: "franchise_id, outcome, started_at",
          filter: `started_at=gte.${startDate}T00:00:00&started_at=lte.${endDate}T23:59:59.999`,
          signal,
        }),
        SystemSubscription.list(null, null, {
          columns: "franchise_id, current_payment_status, subscription_status",
          signal,
        }),
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (r, fallback = []) =>
        r.status === "fulfilled" && r.value ? r.value : fallback;

      const franchisesData = getValue(results[0]);
      const configsData = getValue(results[1]);
      const salesData = getValue(results[2]);
      const contactsData = getValue(results[3]);
      const botData = getValue(results[4]);
      const subsData = getValue(results[5]);

      setFranchises(franchisesData);
      setConfigMap(buildConfigMap(configsData));
      setRawSales(salesData);
      setRawContacts(contactsData);
      setRawBotConversations(botData);
      setRawSubscriptions(subsData);
    } catch (err) {
      if (!signal.aborted && mountedRef.current) {
        setLoadError(err?.message || "Erro ao carregar dados");
        toast.error("Não foi possível carregar os relatórios");
      }
    } finally {
      if (mountedRef.current && !signal.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadAllData();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handlePresetChange = (preset) => {
    setPeriodPreset(preset);
    if (preset === "custom") return;
    const { start, end } = computeRange(preset, startDate, endDate);
    setStartDate(start);
    setEndDate(end);
  };

  const rows = useMemo(() => {
    if (!franchises.length) return [];

    const byFranchise = new Map();
    for (const f of franchises) {
      const evo = f.evolution_instance_id;
      if (!evo) continue;
      byFranchise.set(evo, {
        id: f.id,
        evolutionInstanceId: evo,
        name: configMap[evo]?.franchise_name || f.name || "—",
        revenue: 0,
        ordersCount: 0,
        avgTicket: 0,
        botTotal: 0,
        botConverted: 0,
        botConversion: null,
        newCustomers: 0,
        subscriptionStatus: null,
      });
    }

    for (const s of rawSales) {
      const row = byFranchise.get(s.franchise_id);
      if (!row) continue;
      const value = Number(s.value || 0);
      const discount = Number(s.discount_amount || 0);
      const delivery = Number(s.delivery_fee || 0);
      row.revenue += value - discount + delivery;
      row.ordersCount += 1;
    }

    for (const c of rawContacts) {
      const row = byFranchise.get(c.franchise_id);
      if (!row) continue;
      row.newCustomers += 1;
    }

    for (const b of rawBotConversations) {
      const row = byFranchise.get(b.franchise_id);
      if (!row) continue;
      row.botTotal += 1;
      if (b.outcome === "converted") row.botConverted += 1;
    }

    for (const sub of rawSubscriptions) {
      const row = byFranchise.get(sub.franchise_id);
      if (!row) continue;
      row.subscriptionStatus =
        sub.subscription_status === "CANCELLED"
          ? "CANCELLED"
          : sub.current_payment_status || null;
    }

    const out = [];
    for (const row of byFranchise.values()) {
      row.avgTicket = row.ordersCount > 0 ? row.revenue / row.ordersCount : 0;
      row.botConversion = row.botTotal > 0 ? row.botConverted / row.botTotal : null;
      out.push(row);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return out;
    return out.filter((r) => r.name.toLowerCase().includes(q));
  }, [
    franchises,
    configMap,
    rawSales,
    rawContacts,
    rawBotConversations,
    rawSubscriptions,
    searchQuery,
  ]);

  const handleExport = () => {
    if (!rows.length) return;
    const headers = [
      "Franquia",
      "Receita",
      "Pedidos",
      "Ticket médio",
      "Conversão bot",
      "Novos clientes",
      "Assinatura",
    ];
    const body = rows.map((r) => [
      sanitizeCSVCell(r.name),
      r.revenue.toFixed(2).replace(".", ","),
      r.ordersCount,
      r.ordersCount > 0 ? r.avgTicket.toFixed(2).replace(".", ",") : "",
      r.botConversion == null
        ? ""
        : (r.botConversion * 100).toFixed(1).replace(".", ",") + "%",
      r.newCustomers,
      sanitizeCSVCell(r.subscriptionStatus || "Aguardando"),
    ]);
    const csv =
      "\uFEFF" + [headers, ...body].map((line) => line.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorios-franquias-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d]">
          Relatórios
        </h1>
        <p className="text-sm text-gray-600">
          Visão cruzada por franquia — clique em uma linha para abrir os detalhes.
        </p>
      </div>

      <FranchiseReportToolbar
        periodPreset={periodPreset}
        onPeriodPresetChange={handlePresetChange}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExport={handleExport}
        isExportDisabled={isLoading || rows.length === 0}
      />

      {loadError && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 flex items-center justify-between">
          <span>Erro: {loadError}</span>
          <button
            onClick={loadAllData}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <FranchiseReportTable rows={rows} isLoading={isLoading} />
    </div>
  );
}

export default function Reports() {
  return (
    <ErrorBoundary>
      <ReportsContent />
    </ErrorBoundary>
  );
}
