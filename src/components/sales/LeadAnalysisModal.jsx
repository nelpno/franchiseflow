import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { analyzeLead } from "@/api/functions";
import { Progress } from "@/components/ui/progress";

export default function LeadAnalysisModal({ sale, trigger }) {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const data = await analyzeLead({
        phone: sale.contact_phone,
        name: sale.customer_name,
        value: sale.value,
        source: sale.source,
        franchise_id: sale.franchise_id
      });
      setAnalysis(data);
    } catch (error) {
      console.error("Erro ao analisar lead:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset state when opening
  const onOpenChange = (open) => {
    setIsOpen(open);
    if (open && !analysis) {
      handleAnalyze();
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch(sentiment) {
      case 'positive': return <MaterialIcon icon="thumb_up" size={20} className="text-green-500" />;
      case 'negative': return <MaterialIcon icon="thumb_down" size={20} className="text-red-500" />;
      default: return <MaterialIcon icon="remove" size={20} className="text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                <MaterialIcon icon="psychology" size={16} className="mr-2" />
                Análise IA
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon icon="psychology" size={20} className="text-indigo-600" />
            Análise de Potencial do Lead
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <MaterialIcon icon="progress_activity" size={32} className="text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500">Analisando histórico e perfil...</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Potencial de Fechamento/Upsell</span>
                  <span className="text-lg font-bold text-indigo-600">{analysis.score}%</span>
                </div>
                <Progress value={analysis.score} className="h-2" />
              </div>

              {/* Análise */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    {getSentimentIcon(analysis.sentiment)}
                    Análise do Perfil
                </h4>
                <p className="text-sm text-slate-600">{analysis.analysis}</p>
              </div>

              {/* Sugestão */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <h4 className="text-sm font-semibold text-indigo-900 mb-2">Sugestão de Ação</h4>
                <p className="text-sm text-indigo-700">{analysis.suggestion}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              Não foi possível gerar a análise. Tente novamente.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}