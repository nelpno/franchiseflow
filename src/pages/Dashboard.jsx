import React, { useState, useEffect } from "react";
import { Franchise, DailySummary, Sale } from "@/entities/all"; // Mudei para DailySummary
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { MessageSquare, TrendingUp, Users, Target } from "lucide-react";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import StatsCard from "../components/dashboard/StatsCard";
import AIInsightsWidget from "../components/dashboard/AIInsightsWidget";
import TopFranchises from "../components/dashboard/TopFranchises";
import MessagesTrend from "../components/dashboard/MessagesTrend";
import ConversionMetrics from "../components/dashboard/ConversionMetrics";
import DailyRevenueChart from "../components/dashboard/DailyRevenueChart";

export default function Dashboard() {
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]); // <- Novo estado para resumos
  const [sales, setSales] = useState([]); // <- Mantido apenas para TopFranchises por enquanto
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState('all');

  useEffect(() => {
    loadDashboardData();

    const intervalId = setInterval(() => {
      loadDashboardData(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const loadDashboardData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      // Agora buscamos os dados pré-agregados
      const [franchisesData, summariesData, salesForTopFranchise] = await Promise.all([
        Franchise.list(),
        DailySummary.list('-date', 1000), // Busca os últimos 1000 dias de resumos
        Sale.list('-sale_date', 500) // Temporariamente mantido para o componente TopFranchises
      ]);

      setFranchises(franchisesData);
      setSummaries(summariesData);
      setSales(salesForTopFranchise); // Mantém os dados brutos de vendas por enquanto

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    }

    if (showLoading) setIsLoading(false);
  };

  const filteredSummaries = selectedFranchiseId === 'all' ?
    summaries :
    summaries.filter(s => s.franchise_id === selectedFranchiseId);
  
  // Agregando os resumos filtrados para obter totais
  const getAggregatedMetrics = (summariesList) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
    const metrics = {
      todayContacts: 0,
      yesterdayContacts: 0,
      todaySalesCount: 0,
      yesterdaySalesCount: 0,
      todaySalesValue: 0,
      yesterdaySalesValue: 0,
    };
  
    summariesList.forEach(summary => {
      if (summary.date === todayStr) {
        metrics.todayContacts += summary.unique_contacts || 0;
        metrics.todaySalesCount += summary.sales_count || 0;
        metrics.todaySalesValue += summary.sales_value || 0;
      } else if (summary.date === yesterdayStr) {
        metrics.yesterdayContacts += summary.unique_contacts || 0;
        metrics.yesterdaySalesCount += summary.sales_count || 0;
        metrics.yesterdaySalesValue += summary.sales_value || 0;
      }
    });

    return metrics;
  };
  
  const { 
    todayContacts, yesterdayContacts, 
    todaySalesCount, yesterdaySalesCount,
    todaySalesValue, yesterdaySalesValue
  } = getAggregatedMetrics(filteredSummaries);

  const conversionRate = todayContacts > 0 ? (todaySalesCount / todayContacts) * 100 : 0;

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-red-50 to-green-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Dashboard Maxi Massas</h1>
          <p className="text-slate-600 text-lg">
            Monitore o desempenho de todas as suas franquias em tempo real
          </p>
        </div>

        <div className="flex justify-end mb-2">
          <Select value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
            <SelectTrigger className="w-full md:w-[280px] bg-white/80 shadow-sm border-slate-300">
              <SelectValue placeholder="Filtrar por franquia..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Franquias</SelectItem>
              {franchises.map((f) =>
                <SelectItem key={f.id} value={f.evolution_instance_id}>
                  {f.city}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* AI Insights Widget - Só mostrar se não estiver filtrado ou se o usuário quiser ver geral */}
        {selectedFranchiseId === 'all' && (
          <div className="mb-8">
            <AIInsightsWidget />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Contatos Únicos Hoje"
            value={todayContacts}
            previousValue={yesterdayContacts}
            icon={MessageSquare}
            trend={todayContacts > yesterdayContacts ? 'up' : todayContacts < yesterdayContacts ? 'down' : null}
            color="emerald" />

          <StatsCard
            title="Vendas Hoje"
            value={todaySalesCount}
            previousValue={yesterdaySalesCount}
            icon={Target}
            trend={todaySalesCount > yesterdaySalesCount ? 'up' : todaySalesCount < yesterdaySalesCount ? 'down' : null}
            color="green" />

          <StatsCard
            title="Faturamento Hoje"
            value={`R$ ${todaySalesValue.toFixed(2)}`}
            previousValue={yesterdaySalesValue}
            icon={TrendingUp}
            trend={todaySalesValue > yesterdaySalesValue ? 'up' : todaySalesValue < yesterdaySalesValue ? 'down' : null}
            color="teal"
            isValue={true} />

          <StatsCard
            title="Taxa de Conversão"
            value={`${conversionRate.toFixed(1)}%`}
            icon={Users}
            color="cyan" />
        </div>

        <div className={`grid ${selectedFranchiseId === 'all' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-8`}>
          <div className={selectedFranchiseId === 'all' ? "lg:col-span-2" : "lg:col-span-1"}>
            <MessagesTrend summaries={filteredSummaries} isLoading={isLoading} />
          </div>
          {selectedFranchiseId === 'all' &&
            <div>
              <TopFranchises franchises={franchises} sales={sales} isLoading={isLoading} />
            </div>
          }
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <ConversionMetrics summaries={filteredSummaries} isLoading={isLoading} />
          <DailyRevenueChart summaries={filteredSummaries} isLoading={isLoading} />
        </div>
      </div>
    </div>);
}