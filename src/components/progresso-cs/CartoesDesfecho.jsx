// Bloco 3 — "Cartões por desfecho" (get_cs_progresso().desfechos).
// "Resolveu sozinho" fica em tom neutro e separado, com a frase do prompt/estudo (5c):
// fechado pelo sistema não conta como resultado do CS.
import SectionTitle from "@/components/shared/SectionTitle";
import { CARTAO } from "@/components/shared/adminUi";
import { DESFECHO_LABEL, ORDEM_DESFECHOS } from "@/lib/csProgresso";

export default function CartoesDesfecho({ desfechos }) {
  const d = desfechos || {};
  const normais = ORDEM_DESFECHOS.filter((k) => k !== "resolveu_sozinho");
  const total = normais.reduce((soma, k) => soma + (Number(d[k]) || 0), 0);

  return (
    <section aria-labelledby="bloco-desfechos" className="space-y-3">
      <SectionTitle id="bloco-desfechos" titulo="Cartões por desfecho" ajuda={`${total} fechados pelo Celso no período`} />

      <div className={`${CARTAO} space-y-2`}>
        {normais.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-2">{DESFECHO_LABEL[k]}</span>
            <span className="font-semibold tabular-nums text-ink">{Number(d[k]) || 0}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-surface-line bg-surface-2 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink-3">{DESFECHO_LABEL.resolveu_sozinho}</span>
          <span className="font-semibold tabular-nums text-ink-3">{Number(d.resolveu_sozinho) || 0}</span>
        </div>
        <p className="mt-1 text-sm text-ink-3">Fechado pelo sistema, não conta como resultado do CS.</p>
      </div>
    </section>
  );
}
