import SectionTitle from "@/components/shared/SectionTitle";
import { CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { PERGUNTAS_FREQUENTES, acharGuia } from "@/lib/guiasAjuda";

// Perguntas frequentes (S10.1, 28/09/2026): <details>/<summary> nativo — sem depender
// de nenhum componente shadcn de accordion (os órfãos foram removidos em 02/07/2026,
// CLAUDE.md § Features Removidas — não trazer de volta).
// `onAbrir(slug)` é o mesmo callback que GuiaLista usa (troca `?abrir=` na URL).
export default function AjudaFaq({ role, onAbrir }) {
  if (!PERGUNTAS_FREQUENTES.length) return null;
  return (
    <section className="space-y-3">
      <SectionTitle titulo="Perguntas frequentes" />
      <div className={`${CARTAO} divide-y divide-surface-line p-0`}>
        {PERGUNTAS_FREQUENTES.map((f, i) => {
          const guia = f.guiaSlug ? acharGuia(f.guiaSlug, role) : null;
          return (
            <details key={i} className="group p-4 sm:p-5">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink touch-manipulation">
                {f.pergunta}
                <span aria-hidden="true" className="shrink-0 text-ink-3 transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <div className="mt-2 text-sm leading-relaxed text-ink-2">
                <p>{f.resposta}</p>
                {guia && (
                  <button type="button" onClick={() => onAbrir?.(guia.slug)} className={`${LINK_ACAO} mt-2`}>
                    Ver o guia completo →
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
