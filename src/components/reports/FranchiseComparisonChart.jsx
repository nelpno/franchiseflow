import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function FranchiseComparisonChart({ summaries, franchises, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon icon="trending_up" size={20} />
            Comparação entre Franquias
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

  // Agregar dados por franquia
  const franchiseData = franchises.map(franchise => {
    const franchiseSummaries = summaries.filter(s => s.franchise_id === franchise.evolution_instance_id);
    
    const totalRevenue = franchiseSummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
    const totalSales = franchiseSummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
    const totalContacts = franchiseSummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
    const avgConversion = totalContacts > 0 ? (totalSales / totalContacts) * 100 : 0;

    return {
      name: franchise.city,
      revenue: totalRevenue,
      sales: totalSales,
      contacts: totalContacts,
      conversion: parseFloat(avgConversion.toFixed(1))
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon icon="trending_up" size={20} />
          Comparação entre Franquias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Faturamento por Franquia</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={franchiseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            {franchiseData.slice(0, 3).map((franchise, index) => (
              <div key={franchise.name} className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl mb-1">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</div>
                <div className="font-semibold text-slate-900">{franchise.name}</div>
                <div className="text-sm text-slate-600 mt-1">R$ {franchise.revenue.toFixed(2)}</div>
                <div className="text-xs text-slate-500">{franchise.sales} vendas</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}