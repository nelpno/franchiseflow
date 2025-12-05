import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { Target } from "lucide-react";

export default function ConversionMetrics({ summaries, isLoading }) {
  const getConversionData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const daySummaries = summaries.filter(s => s.date === dateStr);
      const totalContacts = daySummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
      const totalSales = daySummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
      
      const conversionRate = totalContacts > 0 ? (totalSales / totalContacts * 100) : 0;
      
      data.push({
        date: format(date, 'dd/MM'),
        contatos: totalContacts,
        vendas: totalSales,
        conversao: conversionRate
      });
    }
    return data;
  };

  const chartData = getConversionData();

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Target className="w-5 h-5 text-emerald-500" />
          Taxa de Conversão - Contatos para Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {!isLoading ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name) => [
                    name === 'conversao' ? `${Number(value).toFixed(1)}%` : value,
                    name === 'conversao' ? 'Taxa de Conversão' : 
                    name === 'contatos' ? 'Contatos Únicos' : 'Vendas'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="conversao" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-slate-500">Carregando conversões...</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}