
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { format, eachDayOfInterval } from "date-fns";
import { DollarSign, Loader2 } from "lucide-react";

export default function SalesRevenueChart({ sales, isLoading, startDate, endDate }) {
  const getChartData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySales = sales.filter(s => s.sale_date === dayStr);
      const totalRevenue = daySales.reduce((sum, s) => sum + (s.value || 0), 0);
      
      return {
        date: format(day, 'dd/MM'),
        faturamento: totalRevenue,
        vendas: daySales.length,
        ticketMedio: daySales.length > 0 ? totalRevenue / daySales.length : 0
      };
    });
  };

  const chartData = getChartData();
  const totalRevenue = sales.reduce((sum, s) => sum + (s.value || 0), 0);
  const totalSales = sales.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <DollarSign className="w-6 h-6 text-green-600" />
              Faturamento e Volume de Vendas
            </CardTitle>
            <p className="text-slate-600 text-sm mt-1">Evolução diária no período selecionado</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">R$ {totalRevenue.toFixed(2)}</div>
            <div className="text-sm text-slate-600">{totalSales} vendas • Ticket médio: R$ {avgTicket.toFixed(2)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          {!isLoading ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
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
                  formatter={(value, name) => {
                    if (name === 'faturamento') return [`R$ ${value.toFixed(2)}`, 'Faturamento'];
                    if (name === 'vendas') return [value, 'Vendas'];
                    return [value, name];
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="faturamento" 
                  fill="#10b981" 
                  name="faturamento"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="vendas" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="vendas"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
