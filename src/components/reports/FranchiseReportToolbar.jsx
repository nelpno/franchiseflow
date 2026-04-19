// src/components/reports/FranchiseReportToolbar.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

const PERIOD_PRESETS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "current_month", label: "Mês atual" },
  { value: "previous_month", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
];

export function computeRange(preset, customStart, customEnd) {
  const today = new Date();
  switch (preset) {
    case "7d":
      return {
        start: format(subDays(today, 6), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "30d":
      return {
        start: format(subDays(today, 29), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "current_month":
      return {
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "previous_month": {
      const prev = subMonths(today, 1);
      return {
        start: format(startOfMonth(prev), "yyyy-MM-dd"),
        end: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    case "custom":
    default:
      return { start: customStart, end: customEnd };
  }
}

export default function FranchiseReportToolbar({
  periodPreset,
  onPeriodPresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchQuery,
  onSearchChange,
  onExport,
  isExportDisabled,
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3 flex-1">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-600">Período</label>
          <Select value={periodPreset} onValueChange={onPeriodPresetChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodPreset === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                max={endDate}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                min={startDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-9"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600">Buscar franquia</label>
          <Input
            placeholder="Digite o nome…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <Button
        onClick={onExport}
        disabled={isExportDisabled}
        variant="outline"
        className="gap-2 h-9 md:self-end"
      >
        <MaterialIcon icon="download" className="text-base" />
        Exportar CSV
      </Button>
    </div>
  );
}
