import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

export default function DailyGoalProgress({ todayRevenue, dailyGoal }) {
  if (dailyGoal === null || dailyGoal <= 0) return null;

  const revenue = todayRevenue || 0;
  const percentage = Math.min(Math.round((revenue / dailyGoal) * 100), 100);
  const remaining = dailyGoal - revenue;
  const exceeded = revenue >= dailyGoal;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-gray-700">Meta do Dia</span>
        </div>
        <Progress value={percentage} className="h-3 mb-2" />
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">
            R$ {revenue.toLocaleString("pt-BR")} / R$ {dailyGoal.toLocaleString("pt-BR")}
          </span>
          <span className={`text-sm font-medium ${exceeded ? "text-emerald-600" : "text-gray-500"}`}>
            {exceeded
              ? `Meta batida! +R$ ${(revenue - dailyGoal).toLocaleString("pt-BR")}`
              : `Faltam R$ ${remaining.toLocaleString("pt-BR")}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
