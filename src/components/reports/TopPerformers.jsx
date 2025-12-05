import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Users, DollarSign, Target, Loader2 } from "lucide-react";

export default function TopPerformers({ summaries, franchises, isLoading, startDate, endDate }) {
  const getPerformanceData = () => {
    return franchises.map(franchise => {
      // Filtra os resumos desta franquia no período selecionado
      const franchiseSummaries = summaries.filter(s => s.franchise_id === franchise.evolution_instance_id);
      
      // Soma os totais usando os dados já agregados
      const totalRevenue = franchiseSummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
      const salesCount = franchiseSummaries.reduce((sum, s) => sum + (s.sales_count || 0), 0);
      const contactsCount = franchiseSummaries.reduce((sum, s) => sum + (s.unique_contacts || 0), 0);
      const conversionRate = contactsCount > 0 ? (salesCount / contactsCount * 100) : 0;
      const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
      
      return {
        ...franchise,
        totalRevenue,
        salesCount,
        contactsCount,
        conversionRate,
        avgTicket
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  const performanceData = getPerformanceData();

  const getMedalIcon = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}º`;
  };

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Crown className="w-6 h-6 text-yellow-600" />
          Ranking de Franquias no Período
        </CardTitle>
        <p className="text-slate-600 text-sm">Desempenho detalhado ordenado por faturamento</p>
      </CardHeader>
      <CardContent>
        {!isLoading ? (
          <div className="space-y-4">
            {performanceData.map((franchise, index) => (
              <div 
                key={franchise.id} 
                className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200' :
                  index === 1 ? 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200' :
                  index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200' :
                  'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold">{getMedalIcon(index)}</div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{franchise.city}</h3>
                      <p className="text-slate-600 text-sm">{franchise.owner_name}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-green-700">R$ {franchise.totalRevenue.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">Faturamento</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-blue-700">{franchise.salesCount}</div>
                      <div className="text-xs text-slate-500">Vendas</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-purple-700">{franchise.contactsCount}</div>
                      <div className="text-xs text-slate-500">Contatos</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                        <Target className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-orange-700">{franchise.conversionRate.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">Conversão</div>
                    </div>
                  </div>
                </div>
                
                {franchise.avgTicket > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Ticket Médio:</span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                        R$ {franchise.avgTicket.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {performanceData.filter(f => f.totalRevenue > 0).length === 0 && (
              <div className="text-center text-slate-500 py-8">
                Nenhuma venda registrada no período selecionado.
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}