import MaterialIcon from "@/components/ui/MaterialIcon";
import DeliveryFeeEditor from "@/components/vendedor/DeliveryFeeEditor";
import { WEEKDAYS } from "@/lib/franchiseUtils";

const inputClass = "bg-[#e9e8e9] border-none rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none w-28 text-center";

const timeOptions = Array.from({ length: 35 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

function generateLabel(days) {
  if (!days || days.length === 0) return "";
  const ordered = [...days].sort(
    (a, b) => WEEKDAYS.findIndex((w) => w.value === a) - WEEKDAYS.findIndex((w) => w.value === b)
  );
  if (ordered.length === 7) return "Todos os dias";
  if (ordered.length === 1) return WEEKDAYS.find((w) => w.value === ordered[0])?.label || ordered[0];

  // Check consecutive weekdays
  const indices = ordered.map((d) => WEEKDAYS.findIndex((w) => w.value === d));
  const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (isConsecutive) {
    const first = WEEKDAYS[indices[0]]?.label;
    const last = WEEKDAYS[indices[indices.length - 1]]?.label;
    return `${first}-${last}`;
  }
  return ordered.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ");
}

function formatFeeRulesSummary(chargesFee, feeRules) {
  if (!chargesFee) return "frete grátis";
  if (!feeRules) return "";

  if (feeRules?.mode === "modality") {
    const rules = feeRules.rules || [];
    return rules
      .filter((r) => r.label && r.fee)
      .map((r) => `${r.label}: R$${r.fee}`)
      .join(", ");
  }
  const rules = Array.isArray(feeRules) ? feeRules : [];
  return rules
    .filter((r) => r.max_km && r.fee)
    .map((r) => `até ${r.max_km}km R$${r.fee}`)
    .join(", ");
}

export default function DeliveryScheduleEditor({ value = [], onChange }) {
  const ranges = value.length > 0
    ? value
    : [{ days: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"], delivery_start: "06:00", delivery_end: "23:00", charges_fee: true, fee_rules: [{ max_km: "", fee: "" }] }];

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
      onChange(ranges.filter((_, i) => i !== rangeIndex));
      return;
    }
    updateRange(rangeIndex, "days", newDays);
  };

  const addRange = () => {
    if (availableDays.length === 0) return;
    onChange([
      ...ranges,
      {
        days: [availableDays[0].value],
        delivery_start: "09:00",
        delivery_end: "14:00",
        charges_fee: true,
        fee_rules: ranges[0]?.fee_rules || [{ max_km: "", fee: "" }],
      },
    ]);
  };

  const removeRange = (index) => {
    onChange(ranges.filter((_, i) => i !== index));
  };

  const formatPreview = () => {
    if (ranges.length === 0) return "Não definido";
    return ranges
      .map((r) => {
        const label = generateLabel(r.days);
        const time = `${r.delivery_start || "?"}-${r.delivery_end || "?"}`;
        const fee = formatFeeRulesSummary(r.charges_fee, r.fee_rules);
        return `${label}: ${time}${fee ? `, ${fee}` : ""}`;
      })
      .join(" | ");
  };

  return (
    <div className="space-y-4">
      {ranges.map((range, index) => (
        <div key={index} className="bg-white rounded-xl p-4 border border-[#bccac0]/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3d4a42]">
              {generateLabel(range.days) || `Faixa ${index + 1}`}
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
                !isSelected && ranges.some((r, i) => i !== index && r.days.includes(day.value));
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

          {/* Time selects */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#4a3d3d]/60">Entrega das</span>
            <select
              className={inputClass}
              value={range.delivery_start || ""}
              onChange={(e) => updateRange(index, "delivery_start", e.target.value)}
            >
              <option value="">--</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-xs text-[#4a3d3d]/60">às</span>
            <select
              className={inputClass}
              value={range.delivery_end || ""}
              onChange={(e) => updateRange(index, "delivery_end", e.target.value)}
            >
              <option value="">--</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Fee toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9fa] cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={range.charges_fee !== false}
                onChange={(e) => updateRange(index, "charges_fee", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#e9e8e9] rounded-full peer-checked:bg-[#b91c1c] transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-[#3d4a42]">Cobro taxa de entrega</span>
          </label>

          {/* Fee rules */}
          {range.charges_fee !== false ? (
            <DeliveryFeeEditor
              value={range.fee_rules}
              onChange={(val) => updateRange(index, "fee_rules", val)}
            />
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <MaterialIcon icon="local_shipping" size={20} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Entrega grátis nessa faixa</span>
            </div>
          )}
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
          Adicionar faixa de entrega
        </button>
      )}

      {/* Preview */}
      {ranges.length > 0 && (
        <div className="bg-[#fbf9fa] rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/50 mb-1">
            O vendedor vai dizer:
          </p>
          <p className="text-xs text-[#3d4a42] italic">
            "Entregamos {formatPreview()}"
          </p>
        </div>
      )}
    </div>
  );
}
