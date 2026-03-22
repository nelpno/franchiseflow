import MaterialIcon from "@/components/ui/MaterialIcon";

const inputClass = "w-full bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none";

export function ToggleCard({ icon, label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
        checked
          ? "border-[#b91c1c] bg-[#b91c1c]/5"
          : "border-[#e9e8e9] bg-[#e9e8e9]/50 hover:border-[#bccac0]"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${checked ? "bg-[#b91c1c]/10" : "bg-[#e9e8e9]"}`}>
        <MaterialIcon icon={icon} filled size={22} className={checked ? "text-[#b91c1c]" : "text-[#3d4a42]/40"} />
      </div>
      <div className="flex-1">
        <span className={`text-sm font-bold ${checked ? "text-[#1b1c1d]" : "text-[#3d4a42]"}`}>{label}</span>
        {description && <p className="text-xs text-[#3d4a42]/50 mt-0.5">{description}</p>}
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-[#b91c1c]" : "bg-[#bccac0]/40"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}

export function RadioCards({ options, value, onChange, disabled = [] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map((opt) => {
        const isDisabled = disabled.includes(opt.value);
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !isDisabled && onChange(opt.value)}
            disabled={isDisabled}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              isDisabled
                ? "opacity-40 cursor-not-allowed border-[#e9e8e9] bg-[#e9e8e9]/30"
                : isSelected
                ? "border-[#b91c1c] bg-[#b91c1c]/5"
                : "border-[#e9e8e9] hover:border-[#bccac0] cursor-pointer"
            }`}
          >
            <span className={`text-sm font-bold ${isSelected ? "text-[#b91c1c]" : "text-[#3d4a42]"}`}>{opt.label}</span>
            {opt.description && <p className="text-xs text-[#3d4a42]/50 mt-1">{opt.description}</p>}
          </button>
        );
      })}
    </div>
  );
}

export function PaymentChipsMulti({ options, value = [], onChange, disabledValues = [], disabledTooltip }) {
  const toggle = (val) => {
    if (disabledValues.includes(val)) return;
    const next = value.includes(val) ? value.filter((v) => v !== val) : [...value, val];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isDisabled = disabledValues.includes(opt.value);
        const isSelected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            disabled={isDisabled}
            title={isDisabled ? disabledTooltip : ""}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              isDisabled
                ? "bg-[#e9e8e9]/50 text-[#3d4a42]/30 cursor-not-allowed"
                : isSelected
                ? "bg-[#b91c1c] text-white"
                : "bg-[#e9e8e9] text-[#3d4a42] hover:bg-[#e3e2e3] cursor-pointer"
            }`}
          >
            <MaterialIcon icon={opt.icon} size={14} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DayChipsToggle({ value, onChange }) {
  const normalizedValue = (value || '').toLowerCase();
  const allDays = [
    { short: 'Seg', full: 'Segunda' },
    { short: 'Ter', full: 'Terça' },
    { short: 'Qua', full: 'Quarta' },
    { short: 'Qui', full: 'Quinta' },
    { short: 'Sex', full: 'Sexta' },
    { short: 'Sáb', full: 'Sábado' },
    { short: 'Dom', full: 'Domingo' },
  ];
  const activeDays = allDays.map(d =>
    normalizedValue.includes(d.short.toLowerCase()) || normalizedValue.includes(d.full.toLowerCase())
  );
  const toggleDay = (index) => {
    const newActive = [...activeDays];
    newActive[index] = !newActive[index];
    const selectedDays = allDays.filter((_, i) => newActive[i]).map(d => d.full);
    onChange(selectedDays.join(', ') || '');
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allDays.map((day, i) => (
        <button
          key={day.short}
          type="button"
          onClick={() => toggleDay(i)}
          className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-colors ${
            activeDays[i]
              ? 'bg-[#b91c1c] text-white'
              : 'bg-[#e9e8e9] text-[#3d4a42] hover:bg-[#e3e2e3]'
          }`}
        >
          {day.short}
        </button>
      ))}
    </div>
  );
}
