import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { subDays } from "date-fns";

const LEVEL_ORDER = { red: 0, yellow: 1 };

export default function AlertsPanel({ franchises, summaries, inventoryByFranchise, checklistByFranchise }) {
  const alerts = useMemo(() => {
    const result = [];
    const twoDaysAgo = subDays(new Date(), 2);

    for (const franchise of franchises) {
      const fName = franchise.city || franchise.owner_name || "Franquia";

      const franchiseSummaries = summaries
        .filter((s) => s.franchise_id === franchise.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const lastSaleDay = franchiseSummaries.find((s) => (s.sales_count || 0) > 0);
      if (!lastSaleDay || new Date(lastSaleDay.date) < twoDaysAgo) {
        const days = lastSaleDay
          ? Math.floor((new Date() - new Date(lastSaleDay.date)) / 86400000)
          : "?";
        result.push({ level: "red", message: `${fName} — sem vendas há ${days} dias` });
      }

      const inventory = inventoryByFranchise?.[franchise.id] || [];
      const zeroStock = inventory.filter((i) => (i.quantity || 0) === 0);
      const lowStock = inventory.filter((i) => (i.quantity || 0) > 0 && (i.quantity || 0) < 5);

      if (zeroStock.length > 0) {
        result.push({ level: "red", message: `${fName} — ${zeroStock.length} item(ns) zerado(s) no estoque` });
      }
      if (lowStock.length > 0) {
        result.push({ level: "yellow", message: `${fName} — ${lowStock.length} item(ns) com estoque baixo` });
      }

      if (!checklistByFranchise?.[franchise.id]) {
        result.push({ level: "yellow", message: `${fName} — checklist não feito hoje` });
      }
    }

    return result.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [franchises, summaries, inventoryByFranchise, checklistByFranchise]);

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className={`h-4 w-4 ${alerts.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
          <span className="text-sm font-medium text-gray-700">
            {alerts.length > 0 ? `Atenção (${alerts.length})` : "Tudo em dia"}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Todas as franquias operando normalmente</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                  alert.level === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  alert.level === "red" ? "bg-red-500" : "bg-amber-500"
                }`} />
                {alert.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
