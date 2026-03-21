import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, eachDayOfInterval } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function ConversionAnalysis({ summaries, isLoading, startDate, endDate }) {
  const getConversionData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      
      // Filtra os resumos para o dia atual e soma os totais
      const daySummaries = summaries.filter(s => s.date === dayStr);
      const dayContacts = daySummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
      const daySales = daySummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
      const conversionRate = dayContacts > 0 ? (daySales / dayContacts * 100) : 0;
      
      return {
        date: format(day, 'dd/MM'),
        contatos: dayContacts,
        vendas: daySales,
        conversao: conversionRate
      };
    });
  };

  const chartData = getConversionData();
  
  // Calcula totais usando os summaries pré-agregados
  const totalContacts = summaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
  const totalSales = summaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
  const overallConversion = totalContacts > 0 ? (totalSales / totalContacts * 100) : 0;

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <MaterialIcon icon="trending_up" size={24} className="text-blue-600" />
          Análise de Conversão
        </CardTitle>
        <div className="text-sm text-slate-600">
          {totalContacts} contatos • {totalSales} vendas • {overallConversion.toFixed(1)}% conversão geral
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {!isLoading ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name) => [
                    name === 'conversao' ? `${value.toFixed(1)}%` : value,
                    name === 'conversao' ? 'Taxa de Conversão' : 
                    name === 'contatos' ? 'Contatos Únicos' : 'Vendas'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="contatos" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', strokeWidth: 2, r: 3 }}
                  name="contatos"
                />
                <Line 
                  type="monotone" 
                  dataKey="vendas" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                  name="vendas"
                />
                <Line 
                  type="monotone" 
                  dataKey="conversao" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  name="conversao"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-slate-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}