import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MiniRevenueChart({ summaries, franchiseId }) {
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dayLabel = format(subDays(new Date(), i), "EEE", { locale: ptBR });
      const daySummaries = summaries.filter(
        (s) => s.date === date && (!franchiseId || s.franchise_id === franchiseId)
      );
      const revenue = daySummaries.reduce((sum, s) => sum + (s.sales_value || 0), 0);
      days.push({ day: dayLabel, valor: revenue });
    }
    return days;
  }, [summaries, franchiseId]);

  const hasData = chartData.some((d) => d.valor > 0);
  if (!hasData) return null;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Faturamento - Últimos 7 dias</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData}>
            <Tooltip
              formatter={(value) => [`R$ ${value.toLocaleString("pt-BR")}`, "Faturamento"]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
