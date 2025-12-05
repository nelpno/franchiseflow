import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { MessageSquare } from "lucide-react";

export default function MessagesTrend({ summaries, isLoading }) {
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Filtra os resumos para o dia e soma os contatos
      const daySummaries = summaries.filter(s => s.date === dateStr);
      const totalContacts = daySummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
      
      data.push({
        date: format(date, 'dd/MM'),
        contatos: totalContacts
      });
    }
    return data;
  };

  const chartData = getLast7DaysData();

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          Contatos Únicos dos Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {!isLoading ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                />
                <Bar 
                  dataKey="contatos" 
                  fill="#10b981" 
                  name="Contatos Únicos"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-slate-500">Carregando gráfico...</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}