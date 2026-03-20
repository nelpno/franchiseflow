import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { format } from "date-fns";

const MEDAL_COLORS = ["text-amber-500", "text-gray-400", "text-amber-700"];
const BAR_COLORS = ["bg-amber-500", "bg-gray-400", "bg-amber-700"];

export default function FranchiseRanking({ franchises, summaries, isLoading }) {
  const rankedFranchises = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todaySummaries = summaries.filter((s) => s.date === today);

    const ranked = franchises.map((f) => {
      const summary = todaySummaries.find((s) => s.franchise_id === f.id);
      return {
        id: f.id,
        name: f.city || f.owner_name || "Franquia",
        revenue: summary?.sales_value || 0,
      };
    });

    return ranked.sort((a, b) => b.revenue - a.revenue);
  }, [franchises, summaries]);

  const maxRevenue = rankedFranchises[0]?.revenue || 1;

  if (isLoading || rankedFranchises.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Ranking do Dia</span>
        </div>

        <div className="space-y-3">
          {rankedFranchises.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3">
              <span className={`text-sm font-bold w-6 ${i < 3 ? MEDAL_COLORS[i] : "text-gray-400"}`}>
                {i + 1}º
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 truncate">{f.name}</span>
                  <span className="text-sm font-bold text-gray-900 ml-2">
                    R$ {f.revenue.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${i < 3 ? BAR_COLORS[i] : "bg-blue-400"}`}
                    style={{ width: `${Math.max((f.revenue / maxRevenue) * 100, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
