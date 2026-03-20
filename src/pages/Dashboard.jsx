import React, { useState, useEffect } from "react";
import { Franchise, DailySummary, Sale, DailyUniqueContact } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { MessageSquare, TrendingUp, Users, Target } from "lucide-react";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import StatsCard from "../components/dashboard/StatsCard";
import TopFranchises from "../components/dashboard/TopFranchises";
import MessagesTrend from "../components/dashboard/MessagesTrend";
import ConversionMetrics from "../components/dashboard/ConversionMetrics";
import DailyRevenueChart from "../components/dashboard/DailyRevenueChart";

export default function Dashboard() {
  const [franchises, setFranchises] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [todayContactsRaw, setTodayContactsRaw] = useState([]);
  const [todaySalesRaw, setTodaySalesRaw] = useState([]);
  const [yesterdayContactsRaw, setYesterdayContactsRaw] = useState([]);
  const [yesterdaySalesRaw, setYesterdaySalesRaw] = useState([]);
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
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      const [franchisesData, summariesData, todayContacts, yesterdayContacts, todaySales, yesterdaySales] = await Promise.all([
        Franchise.list(),
        DailySummary.list('-date', 365),
        DailyUniqueContact.filter({ date: todayStr }),
        DailyUniqueContact.filter({ date: yesterdayStr }),
        Sale.filter({ sale_date: todayStr }),
        Sale.filter({ sale_date: yesterdayStr }),
      ]);

      setFranchises(franchisesData);
      setSummaries(summariesData);
      setTodayContactsRaw(todayContacts);
      setYesterdayContactsRaw(yesterdayContacts);
      setTodaySalesRaw(todaySales);
      setYesterdaySalesRaw(yesterdaySales);

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    }

    if (showLoading) setIsLoading(false);
  };

  const filteredSummaries = selectedFranchiseId === 'all' ?
    summaries :
    summaries.filter(s => s.franchise_id === selectedFranchiseId);

  // Métricas de hoje/ontem lidas diretamente das entidades (não dependem do DailySummary)
  const filterByFranchise = (arr) => selectedFranchiseId === 'all' ? arr : arr.filter(r => r.franchise_id === selectedFranchiseId);

  const todayContacts = filterByFranchise(todayContactsRaw).length;
  const yesterdayContacts = filterByFranchise(yesterdayContactsRaw).length;

  const todaySalesFiltered = filterByFranchise(todaySalesRaw);
  const yesterdaySalesFiltered = filterByFranchise(yesterdaySalesRaw);

  const todaySalesCount = todaySalesFiltered.length;
  const yesterdaySalesCount = yesterdaySalesFiltered.length;
  const todaySalesValue = todaySalesFiltered.reduce((sum, s) => sum + (s.value || 0), 0);
  const yesterdaySalesValue = yesterdaySalesFiltered.reduce((sum, s) => sum + (s.value || 0), 0);

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Contatos Hoje"
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
            title="Conversão"
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
              <TopFranchises franchises={franchises} summaries={summaries} isLoading={isLoading} />
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