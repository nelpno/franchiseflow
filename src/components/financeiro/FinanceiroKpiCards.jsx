import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";

export default function FinanceiroKpiCards({ aggregated, worstFranchise }) {
  const cards = [
    {
      label: "Faturamento Total",
      value: formatBRL(aggregated.totalRecebido),
      icon: "payments",
      color: "#1b1c1d",
      bgColor: "#fbf9fa",
    },
    {
      label: "Lucro Estimado",
      value: formatBRL(aggregated.lucro),
      icon: "trending_up",
      color: aggregated.lucro >= 0 ? "#16a34a" : "#dc2626",
      bgColor: aggregated.lucro >= 0 ? "#f0fdf4" : "#fef2f2",
    },
    {
      label: "Margem Media",
      value: `${aggregated.margem.toFixed(1)}%`,
      icon: "percent",
      color: aggregated.margem >= 40 ? "#16a34a" : aggregated.margem >= 20 ? "#d97706" : "#dc2626",
      bgColor: aggregated.margem >= 40 ? "#f0fdf4" : aggregated.margem >= 20 ? "#fffbeb" : "#fef2f2",
    },
    {
      label: "Menor Margem",
      value: worstFranchise ? worstFranchise.name : "—",
      subtitle: worstFranchise ? `${worstFranchise.margem.toFixed(1)}%` : null,
      icon: "warning",
      color: "#dc2626",
      bgColor: "#fef2f2",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: card.bgColor }}
              >
                <MaterialIcon icon={card.icon} size={18} style={{ color: card.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#7a6d6d] truncate">{card.label}</p>
                <p
                  className="text-lg font-bold font-plus-jakarta truncate"
                  style={{ color: card.color }}
                >
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-xs font-bold" style={{ color: card.color }}>
                    {card.subtitle}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
