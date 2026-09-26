// Faixa "Você veio de X" — só aparece com filtro aplicado (princípio 2 do plano do admin:
// chegada já filtrada, com "o que fazer" e "ver todas").
import { FILTROS, semVerba } from "@/lib/networkOverview";

const MOSTRA_REPARE = new Set(["sem_venda", "robo_parado", "caiu"]);

export default function ArrivalBanner({ filtroKey, rows, total, onVerTodas }) {
  const f = FILTROS[filtroKey];
  if (!f || filtroKey === "todas") return null;

  const n = rows.length;
  const semVerbaCount = MOSTRA_REPARE.has(filtroKey) ? rows.filter(semVerba).length : 0;

  return (
    <section
      aria-label="Por que você está aqui"
      className="flex flex-col gap-3 rounded-2xl bg-brand-soft p-5 sm:flex-row sm:items-start sm:gap-5"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
          Você veio de: {f.chip} · {n} {n === 1 ? "unidade" : "unidades"}
        </p>
        <p className="text-base leading-snug text-ink">
          <strong>O que fazer:</strong> {f.oQueFazer}
        </p>
        {semVerbaCount > 0 && (
          <p className="text-sm text-ink-2">
            Repare: {semVerbaCount} das {n} também não pagaram a verba do mês.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onVerTodas}
        className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-brand-dark bg-white px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft"
      >
        Ver todas as {total}
      </button>
    </section>
  );
}
