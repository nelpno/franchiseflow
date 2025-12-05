import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfQuarter, endOfQuarter, eachQuarterOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PeriodComparison({ summaries, isLoading, periodType, startDate, endDate }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Análise por Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-slate-500">Carregando dados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const generatePeriodData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (periodType === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      return months.map(month => {
        const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
        
        const periodSummaries = summaries.filter(s => s.date >= monthStart && s.date <= monthEnd);
        
        const revenue = periodSummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
        const sales = periodSummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
        const contacts = periodSummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
        
        return {
          period: format(month, 'MMM/yy', { locale: ptBR }),
          revenue,
          sales,
          contacts
        };
      });
    } else if (periodType === 'quarterly') {
      const quarters = eachQuarterOfInterval({ start, end });
      return quarters.map((quarter, index) => {
        const quarterStart = format(startOfQuarter(quarter), 'yyyy-MM-dd');
        const quarterEnd = format(endOfQuarter(quarter), 'yyyy-MM-dd');
        
        const periodSummaries = summaries.filter(s => s.date >= quarterStart && s.date <= quarterEnd);
        
        const revenue = periodSummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
        const sales = periodSummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
        const contacts = periodSummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
        
        return {
          period: `Q${Math.floor(quarter.getMonth() / 3) + 1}/${quarter.getFullYear()}`,
          revenue,
          sales,
          contacts
        };
      });
    } else {
      // Yearly
      const years = [...new Set(summaries.map(s => new Date(s.date).getFullYear()))].sort();
      return years.map(year => {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        
        const periodSummaries = summaries.filter(s => s.date >= yearStart && s.date <= yearEnd);
        
        const revenue = periodSummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
        const sales = periodSummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
        const contacts = periodSummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
        
        return {
          period: year.toString(),
          revenue,
          sales,
          contacts
        };
      });
    }
  };

  const data = generatePeriodData();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Análise por Período - {periodType === 'monthly' ? 'Mensal' : periodType === 'quarterly' ? 'Trimestral' : 'Anual'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'revenue') return [`R$ ${value.toFixed(2)}`, 'Faturamento'];
                if (name === 'sales') return [value, 'Vendas'];
                if (name === 'contacts') return [value, 'Contatos'];
                return value;
              }}
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Faturamento" />
            <Line yAxisId="right" type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Vendas" />
            <Line yAxisId="right" type="monotone" dataKey="contacts" stroke="#f59e0b" strokeWidth={2} name="Contatos" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}