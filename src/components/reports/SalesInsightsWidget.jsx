import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { generateSalesReportsAI } from "@/api/functions";
import { motion } from "framer-motion";

export default function SalesInsightsWidget() {
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const data = await generateSalesReportsAI();
      setInsights(data);
    } catch (error) {
      console.error("Erro ao carregar insights de relatórios:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (isLoading && !insights) {
    return (
      <Card className="mb-8 border-blue-100 bg-blue-50/50">
        <CardContent className="p-6 flex items-center justify-center gap-3 text-blue-600">
          <MaterialIcon icon="progress_activity" size={20} className="animate-spin" />
          <span className="font-medium">Gerando inteligência de vendas...</span>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-8">
      {/* Tendências de Perdas */}
      <Card className="border-red-100 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="bg-red-50/50 border-b border-red-100 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-red-700">
            <MaterialIcon icon="trending_down" size={20} />
            Análise de Vendas Perdidas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {insights.lost_sales_trends?.length > 0 ? (
             insights.lost_sales_trends.map((trend, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 bg-white border border-red-100 rounded-lg"
              >
                <p className="text-sm font-medium text-slate-800 mb-2">{trend.trend}</p>
                <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                  <MaterialIcon icon="lightbulb" size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{trend.countermeasure}</span>
                </div>
              </motion.div>
             ))
          ) : (
            <p className="text-sm text-slate-500 italic">Nenhuma tendência negativa crítica detectada recentemente.</p>
          )}
        </CardContent>
      </Card>

      {/* Resumo Semanal */}
      <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-3 flex flex-row justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
            <MaterialIcon icon="monitoring" size={20} />
            Performance Semanal
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={loadInsights} className="h-8 w-8">
            <MaterialIcon icon="sync" size={12} className="text-blue-400" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
            {insights.weekly_performance_summary?.length > 0 ? (
                insights.weekly_performance_summary.map((item, index) => (
                    <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-2 border-b last:border-0 border-slate-50 hover:bg-slate-50 rounded transition-colors"
                    >
                        <span className="text-sm font-semibold text-slate-700 w-1/3">{item.franchise_city}</span>
                        <span className="text-sm text-slate-600 flex-1 text-right">{item.summary}</span>
                    </motion.div>
                ))
            ) : (
                <p className="text-sm text-slate-500">Dados insuficientes para resumo semanal.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}