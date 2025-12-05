import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Target, Loader2 } from "lucide-react";

export default function LeadSourceChart({ sales, isLoading }) {
  const getSourceData = () => {
    const sourceGroups = sales.reduce((acc, sale) => {
      const source = sale.source || 'other';
      if (!acc[source]) {
        acc[source] = { count: 0, value: 0 };
      }
      acc[source].count += 1;
      acc[source].value += sale.value || 0;
      return acc;
    }, {});

    const sourceLabels = {
      whatsapp: 'WhatsApp',
      phone_call: 'Telefone',
      in_person: 'Presencial',
      website: 'Site',
      other: 'Outro'
    };

    return Object.entries(sourceGroups).map(([source, data]) => ({
      name: sourceLabels[source] || source,
      vendas: data.count,
      faturamento: data.value,
      color: getSourceColor(source)
    }));
  };

  const getSourceColor = (source) => {
    const colors = {
      whatsapp: '#10b981',
      phone_call: '#3b82f6',
      in_person: '#8b5cf6',
      website: '#f59e0b',
      other: '#6b7280'
    };
    return colors[source] || colors.other;
  };

  const chartData = getSourceData();
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + (s.value || 0), 0);

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Target className="w-6 h-6 text-purple-600" />
          Vendas por Origem do Lead
        </CardTitle>
        <div className="text-sm text-slate-600">
          Total: {totalSales} vendas • R$ {totalRevenue.toFixed(2)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {!isLoading ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
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
                    name === 'faturamento' ? `R$ ${value.toFixed(2)}` : value,
                    name === 'faturamento' ? 'Faturamento' : 'Vendas'
                  ]}
                />
                <Bar 
                  dataKey="vendas" 
                  fill="#8b5cf6" 
                  name="vendas"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
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