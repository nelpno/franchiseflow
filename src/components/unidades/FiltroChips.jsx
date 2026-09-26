// Chips de filtro da tela Unidades. Ordem e rótulos vêm de @/lib/networkOverview
// (fonte única com o cartão de "Hoje" — a contagem de um bate com a do outro).
import { FILTROS, ORDEM_FILTROS } from "@/lib/networkOverview";

export default function FiltroChips({ contagens, ativo, onSelect }) {
  return (
    <div
      role="group"
      aria-label="Filtros"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
    >
      {ORDEM_FILTROS.map((k) => {
        const isAtivo = ativo === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={isAtivo}
            onClick={() => onSelect(k)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors ${
              isAtivo
                ? "border-brand-dark bg-brand-dark font-semibold text-white"
                : "border-surface-line bg-white font-medium text-ink-2 hover:bg-surface"
            }`}
          >
            {FILTROS[k].chip} · {contagens[k] ?? 0}
          </button>
        );
      })}
    </div>
  );
}
