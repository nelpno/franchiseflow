import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { WEEKDAYS } from "@/lib/franchiseUtils";

/**
 * Editor de horários de funcionamento por faixa.
 * Permite definir horários diferentes para grupos de dias.
 *
 * Formato: [{ days: ["seg","ter","qua","qui","sex"], open: "09:00", close: "19:00" }]
 */

const inputClass = "bg-[#e9e8e9] border-none rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none w-24 text-center";

export default function OperatingHoursEditor({ value = [], onChange }) {
  const ranges = value.length > 0 ? value : [{ days: ["seg", "ter", "qua", "qui", "sex"], open: "09:00", close: "19:00" }];

  const usedDays = ranges.flatMap((r) => r.days);
  const availableDays = WEEKDAYS.filter((d) => !usedDays.includes(d.value));

  const updateRange = (index, field, val) => {
    const updated = ranges.map((r, i) => (i === index ? { ...r, [field]: val } : r));
    onChange(updated);
  };

  const toggleDay = (rangeIndex, day) => {
    const range = ranges[rangeIndex];
    const newDays = range.days.includes(day)
      ? range.days.filter((d) => d !== day)
      : [...range.days, day];

    if (newDays.length === 0) {
      // Remove range if no days selected
      onChange(ranges.filter((_, i) => i !== rangeIndex));
      return;
    }
    updateRange(rangeIndex, "days", newDays);
  };

  const addRange = () => {
    if (availableDays.length === 0) return;
    onChange([...ranges, { days: [availableDays[0].value], open: "09:00", close: "13:00" }]);
  };

  const removeRange = (index) => {
    onChange(ranges.filter((_, i) => i !== index));
  };

  // Format display text for prompt preview
  const formatSummary = () => {
    if (ranges.length === 0) return "Não definido";
    return ranges
      .map((r) => {
        const dayLabels = r.days
          .sort((a, b) => WEEKDAYS.findIndex((d) => d.value === a) - WEEKDAYS.findIndex((d) => d.value === b))
          .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
          .join(", ");
        return `${dayLabels}: ${r.open} - ${r.close}`;
      })
      .join(" | ");
  };

  return (
    <div className="space-y-4">
      {ranges.map((range, index) => (
        <div
          key={index}
          className="bg-white rounded-xl p-4 border border-[#bccac0]/10 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3d4a42]">
              Faixa {index + 1}
            </span>
            {ranges.length > 1 && (
              <button
                type="button"
                onClick={() => removeRange(index)}
                className="text-xs text-[#b91c1c] hover:underline flex items-center gap-1"
              >
                <MaterialIcon icon="close" size={14} />
                Remover
              </button>
            )}
          </div>

          {/* Day chips */}
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const isSelected = range.days.includes(day.value);
              const isUsedElsewhere =
                !isSelected &&
                ranges.some((r, i) => i !== index && r.days.includes(day.value));

              return (
                <button
                  key={day.value}
                  type="button"
                  disabled={isUsedElsewhere}
                  onClick={() => toggleDay(index, day.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-[#b91c1c] text-white"
                      : isUsedElsewhere
                      ? "bg-[#e9e8e9] text-[#3d4a42]/30 cursor-not-allowed"
                      : "bg-[#e9e8e9] text-[#3d4a42] hover:bg-[#e3e2e3]"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          {/* Time inputs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#3d4a42]">Abre:</span>
              <input
                type="time"
                value={range.open}
                onChange={(e) => updateRange(index, "open", e.target.value)}
                className={inputClass}
              />
            </div>
            <span className="text-[#3d4a42]">—</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#3d4a42]">Fecha:</span>
              <input
                type="time"
                value={range.close}
                onChange={(e) => updateRange(index, "close", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add range button */}
      {availableDays.length > 0 && (
        <button
          type="button"
          onClick={addRange}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#bccac0]/30 text-sm font-medium text-[#3d4a42] hover:border-[#b91c1c]/30 hover:text-[#b91c1c] transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="add" size={18} />
          Adicionar faixa de horário
        </button>
      )}

      {/* Preview of what the bot will say */}
      {ranges.length > 0 && (
        <div className="bg-[#f5f3f4] rounded-xl p-3 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/50 mb-1">
            O vendedor vai dizer:
          </p>
          <p className="text-xs text-[#3d4a42] italic">
            "Funcionamos {formatSummary()}"
          </p>
        </div>
      )}
    </div>
  );
}
