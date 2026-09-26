// Seletor de mês do admin (regra C8 do padrão), extraído do Financeiro.
//
//   <MonthStepper mes="2026-09" min="2025-09" max="2026-09" onChange={(yyyyMm) => …} />
//
// mes/min/max: "yyyy-MM" (string compara certo nesse formato). min/max opcionais: sem eles
// a seta nunca desabilita. rotulo: troca o texto do meio (padrão "Setembro de 2026", via
// nomeMes). A caixa tem h-11 (C5), então fica na mesma altura da busca e da ação principal.
import MaterialIcon from "@/components/ui/MaterialIcon";
import { nomeMes, somarMeses } from "@/lib/adminFormat";

const SETA =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";

export default function MonthStepper({ mes, min, max, onChange, rotulo, className = "" }) {
  const podeVoltar = !min || mes > min;
  const podeAvancar = !max || mes < max;

  return (
    <div
      className={`inline-flex h-11 items-center gap-1 self-start rounded-xl border border-surface-line bg-white px-0.5 sm:self-auto ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange?.(somarMeses(mes, -1))}
        disabled={!podeVoltar}
        aria-label="Mês anterior"
        title="Mês anterior"
        className={SETA}
      >
        <MaterialIcon icon="chevron_left" size={20} aria-hidden="true" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-ink" aria-live="polite">
        {rotulo ?? nomeMes(mes, { ano: true, maiuscula: true })}
      </span>
      <button
        type="button"
        onClick={() => onChange?.(somarMeses(mes, 1))}
        disabled={!podeAvancar}
        aria-label="Próximo mês"
        title="Próximo mês"
        className={SETA}
      >
        <MaterialIcon icon="chevron_right" size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
