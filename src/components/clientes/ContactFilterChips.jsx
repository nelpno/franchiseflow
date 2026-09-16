import { useMemo } from "react";
import { FILTROS_CLIENTES } from "@/lib/customerActions";

export default function ContactFilterChips({ contacts, activeFilter, onChange }) {
  const counts = useMemo(
    () => Object.fromEntries(FILTROS_CLIENTES.map((f) => [f.key, contacts.filter(f.aceita).length])),
    [contacts]
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar clientes">
      {FILTROS_CLIENTES.map((filtro) => {
        const ativo = activeFilter === filtro.key;
        return (
          <button
            key={filtro.key}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(filtro.key)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors ${
              ativo
                ? "bg-brand text-white shadow-sm"
                : "border border-ink-shadow/10 bg-white text-ink-2 hover:bg-surface"
            }`}
          >
            {filtro.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold font-mono-numbers ${
                ativo ? "bg-white/20 text-white" : "bg-surface-line text-ink-2"
              }`}
            >
              {counts[filtro.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
