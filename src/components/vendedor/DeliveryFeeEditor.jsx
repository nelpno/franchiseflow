import MaterialIcon from "@/components/ui/MaterialIcon";
import { incompleteFeeRows } from "@/lib/configSave";

const inputClass = "w-full bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20 text-sm outline-none";
const faltaClass = " ring-2 ring-red-400";
const TEXTO_FALTA = { valor: "o valor", "descrição": "a descrição", km: "o km" };

const pillClass = (active) =>
  `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
    active
      ? "bg-brand text-white"
      : "bg-surface-line text-[#3d4a42]/70 hover:bg-[#ddd]"
  }`;

export default function DeliveryFeeEditor({ value, onChange }) {
  // Detect mode: legacy array = distance, object with mode = modality
  const isModality = value?.mode === "modality";
  const rules = isModality
    ? (value.rules || [{ label: "", fee: "" }])
    : (Array.isArray(value) && value.length > 0 ? value : [{ max_km: "", fee: "" }]);

  // Linha pela metade não vale para o vendedor (a view descarta sem avisar) e não deixa salvar.
  const faltando = new Map(
    incompleteFeeRows(isModality ? { mode: "modality", rules } : rules).map((p) => [p.index, p.falta])
  );
  const marca = (i, campo) => (faltando.get(i) === campo ? faltaClass : "");
  const aviso = (i) =>
    faltando.has(i) ? (
      <p className="text-[11px] text-red-600 pl-1">
        Falta {TEXTO_FALTA[faltando.get(i)]}: sem isso esta linha não vale. Preencha ou apague.
      </p>
    ) : null;

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
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-3">
                <input
                  className={`${inputClass} flex-1${marca(i, "descrição")}`}
                  type="text"
                  value={row.label}
                  aria-invalid={faltando.get(i) === "descrição" || undefined}
                  onChange={(e) => updateRow(i, "label", e.target.value)}
                  placeholder="Ex: Entrega programada Seg-Sex 16h-19h"
                />
                <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">R$</span>
                <input
                  className={`${inputClass} !w-24 font-mono text-center${marca(i, "valor")}`}
                  type="number"
                  step="0.5"
                  value={row.fee}
                  aria-invalid={faltando.get(i) === "valor" || undefined}
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
              {aviso(i)}
            </div>
          ))}
        </>
      ) : (
        /* Distance mode: max_km + fee (original UI) */
        <>
          {rules.map((row, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">Até</span>
                <input
                  className={`${inputClass} !w-20 font-mono text-center${marca(i, "km")}`}
                  type="number"
                  value={row.max_km}
                  aria-invalid={faltando.get(i) === "km" || undefined}
                  onChange={(e) => updateRow(i, "max_km", e.target.value)}
                  placeholder="5"
                />
                <span className="text-xs text-[#3d4a42]/60 whitespace-nowrap">km: R$</span>
                <input
                  className={`${inputClass} !w-24 font-mono text-center${marca(i, "valor")}`}
                  type="number"
                  step="0.5"
                  value={row.fee}
                  aria-invalid={faltando.get(i) === "valor" || undefined}
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
              {aviso(i)}
            </div>
          ))}
        </>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark transition-colors mt-1"
      >
        <MaterialIcon icon="add" size={16} />
        {isModality ? "Adicionar regra" : "Adicionar faixa de km"}
      </button>
    </div>
  );
}
