import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Crown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TopFranchises({ franchises, summaries, isLoading }) {
  const getTopPerformingFranchises = () => {
    const today = new Date();
    const currentMonthStr = format(today, 'yyyy-MM');

    // Usa summaries (já agregados) para calcular totais do mês
    const franchiseStats = franchises.map(franchise => {
      const monthlySummaries = summaries.filter(s => 
        s.franchise_id === franchise.evolution_instance_id &&
        s.date && s.date.startsWith(currentMonthStr)
      );
      
      const totalValue = monthlySummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
      const salesCount = monthlySummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
      
      return { ...franchise, totalValue, salesCount };
    });
    
    return franchiseStats
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  };

  const topFranchises = !isLoading ? getTopPerformingFranchises() : [];
  const currentMonthName = format(new Date(), 'MMMM', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());

  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 whitespace-nowrap">
          <Crown className="w-5 h-5 text-yellow-500" />
          Top Franqueados do Mês
        </CardTitle>
        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          {currentMonthName}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {topFranchises.map((franchise, index) => (
              <div key={franchise.id} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-blue-50 hover:to-blue-100 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                    index === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
                    index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                    'bg-gradient-to-r from-blue-400 to-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{franchise.city}</p>
                    <p className="text-sm text-slate-600">{franchise.owner_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">R$ {franchise.totalValue.toFixed(2)}</p>
                  <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
                    <TrendingUp className="w-3 h-3" />
                    {franchise.salesCount} vendas
                  </div>
                </div>
              </div>
            ))}
            {topFranchises.filter(f => f.totalValue > 0).length === 0 && (
              <div className="text-center text-slate-500 py-8">
                Nenhuma venda registrada este mês.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}