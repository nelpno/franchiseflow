import React, { useState, useEffect, useMemo, useRef } from "react";
import { Franchise, Sale, Contact, DailyUniqueContact, DailySummary, User, FranchiseConfiguration } from "@/entities/all";
import ErrorBoundary from "../components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";

import KpiCards from "../components/reports/KpiCards";
import SalesRevenueChart from "../components/reports/SalesRevenueChart";
import PaymentMethodChart from "../components/reports/PaymentMethodChart";
import FranchiseRankingChart from "../components/reports/FranchiseRankingChart";
import { buildConfigMap } from "@/lib/franchiseUtils";
import FranchiseComparisonTable from "../components/reports/FranchiseComparisonTable";
import ExportButton from "../components/reports/ExportButton";

function ReportsContent() {
  const [franchises, setFranchises] = useState([]);
  const [sales, setSales] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [dailyContacts, setDailyContacts] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const [rawSales, setRawSales] = useState([]);
  const [rawContacts, setRawContacts] = useState([]);
  const [rawDailyContacts, setRawDailyContacts] = useState([]);
  const [rawSummaries, setRawSummaries] = useState([]);
  const [configMap, setConfigMap] = useState({});

  // Filtros simplificados
  const [selectedFranchise, setSelectedFranchise] = useState('all');
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Carrega tudo uma vez só
  useEffect(() => {
    mountedRef.current = true;
    loadAllData();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const retryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 2;

  const loadAllData = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    setIsLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        User.me({ signal }),
        Franchise.list(null, null, { signal }),
        Sale.list('-sale_date', 2000, { signal }),
        Contact.list('-created_at', 2000, { signal }),
        DailyUniqueContact.list('-date', 500, { signal }),
        DailySummary.list('-date', 500, { signal }),
        FranchiseConfiguration.list(null, null, { columns: 'franchise_evolution_instance_id, franchise_name', signal })
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const getValue = (r) => r.status === "fulfilled" ? r.value : (r.value === undefined ? null : []);
      const currentUserData = results[0].status === "fulfilled" ? results[0].value : null;
      const franchisesData = getValue(results[1]);
      const salesData = getValue(results[2]);
      const contactsData = getValue(results[3]);
      const dailyContactsData = getValue(results[4]);
      const summariesData = getValue(results[5]);

      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["user","franchises","sales","contacts","dailyContacts","summaries","configs"][i] : null)
        .filter(Boolean);

      // Auto-retry if ALL queries failed (likely transient connection/auth issue)
      if (failedQueries.length === results.length && retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current++;
        const delay = retryCountRef.current * 2000; // 2s, 4s
        setTimeout(() => { if (mountedRef.current) loadAllData(); }, delay);
        return;
      }

      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`, {
          action: { label: 'Tentar novamente', onClick: () => { retryCountRef.current = 0; loadAllData(); } },
          duration: 8000,
        });
      }

      retryCountRef.current = 0; // Reset on any success
      if (currentUserData) setCurrentUser(currentUserData);
      setFranchises(franchisesData || []);
      setRawSales(salesData || []);
      setRawContacts(contactsData || []);
      setRawDailyContacts(dailyContactsData || []);
      setRawSummaries(summariesData || []);
      const configData = getValue(results[6]);
      setConfigMap(buildConfigMap(configData || []));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error("Erro ao carregar dados:", error);
      if (!mountedRef.current) return;
      setLoadError("Não foi possível carregar os dados dos relatórios.");
      toast.error("Erro ao carregar relatórios.", {
        action: { label: 'Tentar novamente', onClick: () => { retryCountRef.current = 0; loadAllData(); } },
        duration: 8000,
      });
    }
    if (mountedRef.current) setIsLoading(false);
  };

  // Atualiza datas quando muda o preset
  useEffect(() => {
    const now = new Date();
    switch (periodPreset) {
      case '7d':
        setStartDate(format(subDays(now, 6), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case '30d':
        setStartDate(format(subDays(now, 29), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case '90d':
        setStartDate(format(subDays(now, 89), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      default:
        break;
    }
  }, [periodPreset]);

  // Filtragem local
  useEffect(() => {
    if (isLoading) return;

    let finalSales = rawSales.filter(s => {
      const d = s.sale_date?.substring(0, 10);
      return d >= startDate && d <= endDate;
    });
    let finalDailyContacts = rawDailyContacts.filter(c => c.date >= startDate && c.date <= endDate);
    let finalSummaries = rawSummaries.filter(s => s.date >= startDate && s.date <= endDate);
    let finalContacts = rawContacts.filter(c => {
      const d = c.created_at?.substring(0, 10);
      return d >= startDate && d <= endDate;
    });

    if (selectedFranchise !== 'all') {
      finalSales = finalSales.filter(s => s.franchise_id === selectedFranchise);
      finalDailyContacts = finalDailyContacts.filter(c => c.franchise_id === selectedFranchise);
      finalSummaries = finalSummaries.filter(s => s.franchise_id === selectedFranchise);
      finalContacts = finalContacts.filter(c => c.franchise_id === selectedFranchise);
    }

    setSales(finalSales);
    setDailyContacts(finalDailyContacts);
    setSummaries(finalSummaries);
    setContacts(finalContacts);
  }, [selectedFranchise, startDate, endDate, rawSales, rawContacts, rawDailyContacts, rawSummaries, isLoading]);

  // Dados do período anterior para comparação
  const previousPeriodData = useMemo(() => {
    if (isLoading) return { sales: [], contacts: [] };
    const days = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
    const prevEnd = format(subDays(new Date(startDate), 1), 'yyyy-MM-dd');
    const prevStart = format(subDays(new Date(startDate), days), 'yyyy-MM-dd');

    let prevSales = rawSales.filter(s => {
      const d = s.sale_date?.substring(0, 10);
      return d >= prevStart && d <= prevEnd;
    });
    let prevContacts = rawContacts.filter(c => {
      const d = c.created_at?.substring(0, 10);
      return d >= prevStart && d <= prevEnd;
    });

    if (selectedFranchise !== 'all') {
      prevSales = prevSales.filter(s => s.franchise_id === selectedFranchise);
      prevContacts = prevContacts.filter(c => c.franchise_id === selectedFranchise);
    }

    return { sales: prevSales, contacts: prevContacts };
  }, [rawSales, rawContacts, startDate, endDate, selectedFranchise, isLoading]);

  // Filtrar franquias baseado nas permissões do usuário
  const availableFranchises = currentUser?.role === 'admin'
    ? franchises
    : franchises.filter(f =>
        currentUser?.managed_franchise_ids?.includes(f.id) ||
        currentUser?.managed_franchise_ids?.includes(f.evolution_instance_id)
      );

  const periodLabel = {
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    'month': 'Este mês',
    '90d': 'Últimos 3 meses',
  }[periodPreset] || 'Período personalizado';

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="hidden md:block">
            <h1 className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#a80012] flex items-center justify-center">
                <MaterialIcon icon="bar_chart" size={24} className="text-white" />
              </div>
              Relatórios
            </h1>
            <p className="text-[#4a3d3d] mt-1 text-sm md:text-base">
              Visão executiva do desempenho das franquias
            </p>
          </div>
          <ExportButton
            summaries={summaries}
            franchises={availableFranchises}
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* Filtros compactos inline */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: '7d', label: '7 dias' },
              { key: '30d', label: '30 dias' },
              { key: 'month', label: 'Este mês' },
              { key: '90d', label: '3 meses' },
            ].map(p => (
              <Button
                key={p.key}
                variant={periodPreset === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodPreset(p.key)}
                className={periodPreset === p.key
                  ? 'bg-[#a80012] hover:bg-[#8a000f] text-white'
                  : 'border-[#291715]/10 text-[#4a3d3d] hover:bg-[#a80012]/5 hover:text-[#a80012] hover:border-[#a80012]/20'
                }
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
            <SelectTrigger className="w-full sm:w-[220px] border-[#291715]/10">
              <SelectValue placeholder="Franquia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Franquias</SelectItem>
              {availableFranchises.map(f => (
                <SelectItem key={f.id} value={f.evolution_instance_id}>
                  {f.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Erro de carregamento */}
        {loadError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MaterialIcon icon="cloud_off" size={48} className="text-gray-300 mb-4" />
            <p className="text-[#4a3d3d] font-medium mb-2">{loadError}</p>
            <Button variant="outline" onClick={loadAllData} className="mt-2">
              <MaterialIcon icon="refresh" size={16} className="mr-2" />
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Seção 1 — KPIs */}
        {!loadError && (
          <>
            <KpiCards
              sales={sales}
              contacts={contacts}
              previousSales={previousPeriodData.sales}
              previousContacts={previousPeriodData.contacts}
              isLoading={isLoading}
            />

            {/* Seção 2 — Gráficos principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SalesRevenueChart
                sales={sales}
                isLoading={isLoading}
                startDate={startDate}
                endDate={endDate}
              />
              <PaymentMethodChart
                sales={sales}
                isLoading={isLoading}
              />
            </div>

            {/* Ranking horizontal */}
            <div className="mb-6">
              <FranchiseRankingChart
                sales={sales}
                franchises={availableFranchises}
                isLoading={isLoading}
                configMap={configMap}
              />
            </div>

            {/* Seção 3 — Tabela comparativa */}
            <FranchiseComparisonTable
              sales={sales}
              contacts={contacts}
              summaries={summaries}
              franchises={availableFranchises}
              isLoading={isLoading}
              periodLabel={periodLabel}
              configMap={configMap}
            />
          </>
        )}
      </div>
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
