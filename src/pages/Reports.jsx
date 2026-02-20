import React, { useState, useEffect } from "react";
import { Franchise, Sale, DailyUniqueContact, DailySummary, User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, CalendarDays, TrendingUp, Loader2 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

import SalesRevenueChart from "../components/reports/SalesRevenueChart";
import LeadSourceChart from "../components/reports/LeadSourceChart";
import ConversionAnalysis from "../components/reports/ConversionAnalysis";
import TopPerformers from "../components/reports/TopPerformers";
import FranchiseComparisonChart from "../components/reports/FranchiseComparisonChart";
import PeriodComparison from "../components/reports/PeriodComparison";
import ExportButton from "../components/reports/ExportButton";
import SalesInsightsWidget from "../components/reports/SalesInsightsWidget";

export default function Reports() {
  const [franchises, setFranchises] = useState([]);
  const [sales, setSales] = useState([]);
  const [dailyContacts, setDailyContacts] = useState([]);
  const [summaries, setSummaries] = useState([]); // Adicionado para análise de conversão
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [selectedFranchise, setSelectedFranchise] = useState('all');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodType, setPeriodType] = useState('monthly'); // monthly, quarterly, yearly
  const [selectedSource, setSelectedSource] = useState('all');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const loadReportData = async () => {
      setIsLoading(true);
      try {
        const [salesData, contactsData, summariesData] = await Promise.all([
          Sale.list('-sale_date', 500),
          DailyUniqueContact.list('-date', 500),
          DailySummary.list('-date', 500)
        ]);

        let finalSales = salesData.filter(s => s.sale_date >= startDate && s.sale_date <= endDate);
        let finalContacts = contactsData.filter(c => c.date >= startDate && c.date <= endDate);
        let finalSummaries = summariesData.filter(s => s.date >= startDate && s.date <= endDate);

        if (selectedFranchise !== 'all') {
          finalSales = finalSales.filter(s => s.franchise_id === selectedFranchise);
          finalContacts = finalContacts.filter(c => c.franchise_id === selectedFranchise);
          finalSummaries = finalSummaries.filter(s => s.franchise_id === selectedFranchise);
        }

        if (selectedSource !== 'all') {
          finalSales = finalSales.filter(s => s.source === selectedSource);
        }

        setSales(finalSales);
        setDailyContacts(finalContacts);
        setSummaries(finalSummaries);
      } catch (error) {
        console.error("Erro ao carregar dados do relatório:", error);
      }
      setIsLoading(false);
    };

    loadReportData();
  }, [selectedFranchise, startDate, endDate, selectedSource, currentUser]);

  const loadInitialData = async () => {
    try {
      const [currentUserData, franchisesData] = await Promise.all([
        User.me(),
        Franchise.list()
      ]);

      setCurrentUser(currentUserData);
      setFranchises(franchisesData);
    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
    }
  };



  const setQuickDateRange = (days) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const setCurrentMonth = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
  };

  // Filtrar franquias baseado nas permissões do usuário
  const availableFranchises = currentUser?.role === 'admin' 
    ? franchises 
    : franchises.filter(f => currentUser?.managed_franchise_ids?.includes(f.evolution_instance_id));

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            Relatórios Avançados
          </h1>
          <p className="text-slate-600 mt-1">Análise detalhada do desempenho das suas franquias</p>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Filtros do Relatório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="franchise">Franquia</Label>
                <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a franquia" />
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

              <div>
                <Label htmlFor="source">Origem do Lead</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Origens</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="phone_call">Telefone</SelectItem>
                    <SelectItem value="in_person">Presencial</SelectItem>
                    <SelectItem value="website">Site</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="periodType">Tipo de Período</Label>
                <Select value={periodType} onValueChange={setPeriodType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button onClick={updateReportData}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                  Atualizar
                </Button>
                <ExportButton 
                  summaries={summaries} 
                  franchises={availableFranchises}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            </div>
            
            {/* Botões de período rápido */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(7)}>
                Últimos 7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(30)}>
                Últimos 30 dias
              </Button>
              <Button variant="outline" size="sm" onClick={setCurrentMonth}>
                Este Mês
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(90)}>
                Últimos 3 meses
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatórios */}
        <div className="space-y-8">

          {/* Widget de Insights IA */}
          <SalesInsightsWidget />

          {/* Faturamento e Volume */}
          <SalesRevenueChart 
            sales={sales} 
            isLoading={isLoading}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Grid com dois relatórios */}
          <div className="grid lg:grid-cols-2 gap-8">
            <LeadSourceChart sales={sales} isLoading={isLoading} />
            <ConversionAnalysis 
              summaries={summaries} 
              isLoading={isLoading}
              startDate={startDate}
              endDate={endDate}
            />
          </div>

          {/* Comparação entre Franquias */}
          <FranchiseComparisonChart
            summaries={summaries}
            franchises={availableFranchises}
            isLoading={isLoading}
          />

          {/* Análise por Período */}
          <PeriodComparison
            summaries={summaries}
            isLoading={isLoading}
            periodType={periodType}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Top Performers */}
          <TopPerformers 
            summaries={summaries}
            franchises={availableFranchises}
            isLoading={isLoading}
            startDate={startDate}
            endDate={endDate}
          />
          </div>
      </div>
    </div>
  );
}