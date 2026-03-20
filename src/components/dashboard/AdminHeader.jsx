import React from "react";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export default function AdminHeader({ period, onPeriodChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
          <LayoutDashboard className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Geral</h1>
          <p className="text-sm text-gray-500">Maxi Massas — Todas as Franquias</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onPeriodChange(p.value)}
            className={period === p.value ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
