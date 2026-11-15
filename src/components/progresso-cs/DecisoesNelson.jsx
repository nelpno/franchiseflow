// Bloco 4 — "Decisões para você" (get_cs_progresso().com_nelson). Cartões "vai para o
// Nelson" com a prova datada (motive_evidence) e a nota do Celso (escalated_note).
import { Link } from "react-router-dom";
import SectionTitle from "@/components/shared/SectionTitle";
import NadaPendente from "@/components/shared/NadaPendente";
import { LINK_ACAO, TOM_ATENCAO } from "@/components/shared/adminUi";
import { dataCurta } from "@/lib/csProgresso";

export default function DecisoesNelson({ comNelson }) {
  const lista = Array.isArray(comNelson) ? comNelson : [];

  return (
    <section aria-labelledby="bloco-decisoes" className="space-y-3">
      <SectionTitle
        id="bloco-decisoes"
        titulo="Decisões para você"
        ajuda={lista.length ? `${lista.length} esperando sua decisão` : undefined}
      />

      {lista.length === 0 ? (
        <NadaPendente texto="Nenhum cartão esperando sua decisão agora." />
      ) : (
        <div className="space-y-3">
          {lista.map((c) => (
            <div key={c.task_id} className={TOM_ATENCAO}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-plus-jakarta text-base font-bold text-ink">{c.franchise_name}</p>
                  {c.motive_evidence && <p className="mt-1 text-sm text-ink-2">{c.motive_evidence}</p>}
                  {c.escalated_note && (
                    <p className="mt-1 text-sm text-ink">
                      <span className="font-semibold">Celso: </span>
                      {c.escalated_note}
                    </p>
                  )}
                  {c.escalated_at && (
                    <p className="mt-1 text-sm text-ink-3">Foi para você em {dataCurta(c.escalated_at)}</p>
                  )}
                </div>
                <Link to={`/Unidade?id=${c.franchise_id}`} className={`${LINK_ACAO} shrink-0`}>
                  Abrir ficha →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
