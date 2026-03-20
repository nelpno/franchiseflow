import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame } from "lucide-react";

export default function RankingStreak({ ranking, summaries, franchiseId, dailyGoal }) {
  const streak = useMemo(() => {
    if (!summaries || !dailyGoal || dailyGoal <= 0) return 0;

    const franchiseDays = summaries
      .filter((s) => s.franchise_id === franchiseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let count = 0;
    for (const day of franchiseDays) {
      if ((day.sales_value || 0) >= dailyGoal) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [summaries, franchiseId, dailyGoal]);

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-amber-500" />
          {ranking?.position ? (
            <span className="text-sm text-gray-700">
              <span className="font-bold text-gray-900">{ranking.position}º</span> de {ranking.total_franchises} franquias
            </span>
          ) : (
            <span className="text-sm text-gray-400">Sem dados hoje</span>
          )}
        </div>

        {dailyGoal && (
          <div className="flex items-center gap-3">
            <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-500" : "text-gray-300"}`} />
            <span className="text-sm text-gray-700">
              {streak > 0
                ? <><span className="font-bold text-gray-900">{streak}</span> {streak === 1 ? "dia" : "dias"} batendo meta</>
                : "Comece hoje!"
              }
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
