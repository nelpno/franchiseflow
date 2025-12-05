import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, CheckCircle, ArrowRight, Loader2, RefreshCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function AIInsightsWidget() {
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const { data } = await base44.functions.invoke('getDashboardInsights');
      setInsights(data);
    } catch (error) {
      console.error("Erro ao carregar insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (isLoading && !insights) {
    return (
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-6 flex items-center justify-center gap-3 text-indigo-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">A IA está analisando seus dados...</span>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <Card className="border-indigo-200 shadow-md bg-white overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            Insights Inteligentes MaxiMassas
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={loadInsights} 
            className="text-white/80 hover:text-white hover:bg-white/20"
            disabled={isLoading}
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-indigo-100 text-sm mt-1">
          {insights.sales_forecast_comment}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* Coluna da Esquerda: Alertas e Franquias */}
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Atenção Necessária
            </h3>
            
            {insights.low_performance_franchises?.length > 0 ? (
              <div className="space-y-3">
                {insights.low_performance_franchises.map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm"
                  >
                    <div className="font-medium text-amber-900 flex justify-between">
                      {item.city}
                    </div>
                    <p className="text-amber-700 mt-1">{item.reason}</p>
                    <div className="mt-2 flex items-center text-amber-800 font-medium text-xs bg-amber-100/50 px-2 py-1 rounded w-fit">
                      <ArrowRight className="w-3 h-3 mr-1" /> Sugestão: {item.suggestion}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-medium">Todas as franquias estão performando bem!</p>
              </div>
            )}
          </div>

          {/* Coluna da Direita: Próximos Passos */}
          <div className="p-6 space-y-4 bg-slate-50/50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-500" />
              Próximos Passos Recomendados
            </h3>
            
            <div className="space-y-2">
              {insights.action_items?.map((action, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="flex items-start gap-3 p-2 hover:bg-white rounded transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-indigo-600">{index + 1}</span>
                  </div>
                  <span className="text-slate-600 text-sm">{action}</span>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}