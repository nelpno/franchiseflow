import MaterialIcon from "@/components/ui/MaterialIcon";
import { VALE_BANDEIRAS } from "@/lib/franchiseUtils";
import { alternarBandeira } from "@/lib/vales";

/**
 * Bandeiras de vale aceitas (26/11/2026). Aparece quando a tabela tem vale-refeição ou vale-alimentação marcado.
 * Regra e o NULL de "não revisado": src/lib/vales.js. O robô diz ao cliente só as bandeiras marcadas.
 */
export default function ValeBandeiras({ value, onChange, vr, va }) {
  const marcadas = Array.isArray(value) ? value : [];
  const naoRevisado = !Array.isArray(value) && vr && !va;
  const quais = [vr && "vale-refeição", va && "vale-alimentação"].filter(Boolean).join(" e ");
  return (
    <div id="mr-vale" className="scroll-mt-24 border-t border-surface-line/10 pt-4 space-y-2">
      <h4 className="text-xs font-bold text-ink-2 flex items-center gap-1.5">
        <MaterialIcon icon="credit_card" size={14} />
        Bandeiras de vale que você aceita
      </h4>
      <p className="text-xs text-ink-3">
        Valem para o {quais}. O robô fala ao cliente só as bandeiras marcadas; sem nenhuma marcada, ele não promete bandeira e avisa você.
      </p>
      {naoRevisado && (
        <div className="rounded-xl bg-warn-soft border border-warn/30 p-3 text-xs text-warn-ink space-y-2">
          <p>
            Agora o vale-alimentação é separado do vale-refeição. Se você aceita vale-alimentação, marque na tabela acima.
            Enquanto você não conferir, o robô não diz sim nem não ao vale-alimentação: ele avisa você.
          </p>
          <button type="button" onClick={() => onChange([])}
            className="font-semibold text-warn-ink underline underline-offset-2">
            Conferi: aceito só vale-refeição
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {VALE_BANDEIRAS.map((b) => {
          const on = marcadas.includes(b);
          return (
            <button key={b} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(alternarBandeira(value, b))}
              className={`min-h-9 px-3 rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                on ? "bg-brand border-brand text-white" : "border-surface-line text-ink-2 hover:border-brand/60"
              }`}>
              {on && <MaterialIcon icon="check" size={14} className="-ml-0.5 mr-1 align-[-2px]" />}
              {b}
            </button>
          );
        })}
      </div>
    </div>
  );
}
