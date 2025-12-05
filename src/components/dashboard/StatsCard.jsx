
import React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const colorStyles = {
  emerald: {
    bg: "from-emerald-500 to-emerald-600",
    light: "bg-emerald-50",
    text: "text-emerald-700"
  },
  green: {
    bg: "from-green-500 to-green-600", 
    light: "bg-green-50",
    text: "text-green-700"
  },
  teal: {
    bg: "from-teal-500 to-teal-600",
    light: "bg-teal-50", 
    text: "text-teal-700"
  },
  cyan: {
    bg: "from-cyan-500 to-cyan-600",
    light: "bg-cyan-50",
    text: "text-cyan-700"
  }
};


export default function StatsCard({ title, value, previousValue, icon: Icon, trend, color, isValue = false }) {
  const styles = colorStyles[color];

  // Extrai o valor numérico, caso o 'value' seja uma string formatada como "R$ 123.45"
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9,.-]+/g,"").replace(",", ".")) 
    : value;

  const getTrendDisplay = () => {
    // Se não houver 'trend', não mostra nada.
    if (!trend) {
      return null;
    }

    let percentageChange = 0;
    // Caso 1: Valor anterior é maior que zero, cálculo normal.
    if (previousValue > 0) {
      percentageChange = ((numericValue - previousValue) / previousValue) * 100;
    } 
    // Caso 2: Valor anterior era zero e o atual é positivo (crescimento infinito). Mostra 100%.
    else if (numericValue > 0 && previousValue === 0) {
      percentageChange = 100;
    }
    // Caso 3: Ambos são zero ou o valor atual é zero. A mudança é 0.

    const trendIcon = trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />;
    
    return (
      <div className={`flex items-center text-sm font-bold ${
        trend === 'up' ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {trendIcon}
        {`${Math.abs(percentageChange).toFixed(1)}%`}
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden bg-white/95 backdrop-blur-sm shadow-xl border-0 hover:shadow-2xl transition-all duration-300 hover:scale-105">
      <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${styles.bg} opacity-10 rounded-full transform translate-x-10 -translate-y-10`}></div>
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${styles.light} shadow-sm`}>
            <Icon className={`w-6 h-6 ${styles.text}`} />
          </div>
          {getTrendDisplay()}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
