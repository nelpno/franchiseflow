import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

const inputClass = "w-full bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none";

export default function DeliveryFeeEditor({ value, onChange }) {
  // value is an array of { max_km, fee } objects
  const rows = Array.isArray(value) && value.length > 0
    ? value
    : [{ max_km: "", fee: "" }];

  const updateRow = (index, field, val) => {
    const updated = rows.map((r, i) =>
      i === index ? { ...r, [field]: val } : r
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...rows, { max_km: "", fee: "" }]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    const updated = rows.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">Até</span>
          <input
            className={`${inputClass} !w-20 font-mono text-center`}
            type="number"
            value={row.max_km}
            onChange={(e) => updateRow(i, "max_km", e.target.value)}
            placeholder="5"
          />
          <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">km: R$</span>
          <input
            className={`${inputClass} !w-24 font-mono text-center`}
            type="number"
            step="0.5"
            value={row.fee}
            onChange={(e) => updateRow(i, "fee", e.target.value)}
            placeholder="8,00"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-[#3d4a42]/40 hover:text-red-500 transition-colors"
            >
              <MaterialIcon icon="close" size={18} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#b91c1c] hover:text-[#991b1b] transition-colors mt-1"
      >
        <MaterialIcon icon="add" size={16} />
        Adicionar faixa
      </button>
    </div>
  );
}
