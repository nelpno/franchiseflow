import MaterialIcon from "@/components/ui/MaterialIcon";
import SectionTitle from "@/components/shared/SectionTitle";
import { CARTAO_CLICAVEL, H3_CARTAO } from "@/components/shared/adminUi";

// Grade de guias: cada cartão inteiro abre o guia (K2). Tile de ícone K10.
export function GuiaCard({ guia, onAbrir }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(guia.slug)}
      className={`${CARTAO_CLICAVEL} flex w-full items-start gap-3 text-left`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
        <MaterialIcon icon={guia.icone} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block ${H3_CARTAO}`}>{guia.titulo}</span>
        <span className="mt-1 block text-sm text-ink-2 line-clamp-2">{guia.resumo}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-3">{guia.passos.length} passos · {guia.tempo}</span>
          <span className="font-semibold text-brand-dark">Ler o guia →</span>
        </span>
      </span>
    </button>
  );
}

export default function GuiaLista({ titulo, ajuda, guias, onAbrir }) {
  if (!guias.length) return null;
  return (
    <section className="space-y-3">
      <SectionTitle titulo={titulo} ajuda={ajuda} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {guias.map((g) => (
          <GuiaCard key={g.slug} guia={g} onAbrir={onAbrir} />
        ))}
      </div>
    </section>
  );
}
