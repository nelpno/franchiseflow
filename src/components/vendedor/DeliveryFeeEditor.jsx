import MaterialIcon from "@/components/ui/MaterialIcon";

const inputClass = "w-full bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none";

const pillClass = (active) =>
  `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
    active
      ? "bg-[#b91c1c] text-white"
      : "bg-[#e9e8e9] text-[#3d4a42]/70 hover:bg-[#ddd]"
  }`;

export default function DeliveryFeeEditor({ value, onChange }) {
  // Detect mode: legacy array = distance, object with mode = modality
  const isModality = value?.mode === "modality";
  const rules = isModality
    ? (value.rules || [{ label: "", fee: "" }])
    : (Array.isArray(value) && value.length > 0 ? value : [{ max_km: "", fee: "" }]);

  const setMode = (mode) => {
    if (mode === "modality" && !isModality) {
      onChange({ mode: "modality", rules: [{ label: "", fee: "" }] });
    } else if (mode === "distance" && isModality) {
      onChange([{ max_km: "", fee: "" }]);
    }
  };

  const updateRow = (index, field, val) => {
    const updated = rules.map((r, i) =>
      i === index ? { ...r, [field]: val } : r
    );
    if (isModality) {
      onChange({ mode: "modality", rules: updated });
    } else {
      onChange(updated);
    }
  };

  const addRow = () => {
    const newRow = isModality ? { label: "", fee: "" } : { max_km: "", fee: "" };
    const updated = [...rules, newRow];
    if (isModality) {
      onChange({ mode: "modality", rules: updated });
    } else {
      onChange(updated);
    }
  };

  const removeRow = (index) => {
    if (rules.length <= 1) return;
    const updated = rules.filter((_, i) => i !== index);
    if (isModality) {
      onChange({ mode: "modality", rules: updated });
    } else {
      onChange(updated);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button type="button" className={pillClass(!isModality)} onClick={() => setMode("distance")}>
          Por distância
        </button>
        <button type="button" className={pillClass(isModality)} onClick={() => setMode("modality")}>
          Por modalidade
        </button>
      </div>

      {isModality ? (
        /* Modality mode: label + fee */
        <>
          {rules.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                className={`${inputClass} flex-1`}
                type="text"
                value={row.label}
                onChange={(e) => updateRow(i, "label", e.target.value)}
                placeholder="Ex: Entrega programada Seg-Sex 16h-19h"
              />
              <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">R$</span>
              <input
                className={`${inputClass} !w-24 font-mono text-center`}
                type="number"
                step="0.5"
                value={row.fee}
                onChange={(e) => updateRow(i, "fee", e.target.value)}
                placeholder="10,00"
              />
              {rules.length > 1 && (
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
        </>
      ) : (
        /* Distance mode: max_km + fee (original UI) */
        <>
          {rules.map((row, i) => (
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
              {rules.length > 1 && (
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
        </>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#b91c1c] hover:text-[#991b1b] transition-colors mt-1"
      >
        <MaterialIcon icon="add" size={16} />
        {isModality ? "Adicionar regra" : "Adicionar faixa"}
      </button>
    </div>
  );
}
