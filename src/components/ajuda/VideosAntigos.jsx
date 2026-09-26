import { useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { CARTAO, H3_CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { VIDEOS, urlVideo } from "@/lib/guiasAjuda";

// Vídeos gravados antes das mudanças de set/2026. Saíram da frente (as telas mudaram), mas
// continuam acessíveis aqui embaixo, fechados por padrão.
export default function VideosAntigos() {
  const [aberto, setAberto] = useState(false);
  return (
    <section className={CARTAO}>
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-10 w-full items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
          <MaterialIcon icon="play_circle" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block ${H3_CARTAO}`}>Vídeos</span>
          <span className="block text-sm text-ink-3">
            Gravados antes das últimas mudanças: algumas telas estão diferentes. Os guias acima estão atualizados.
          </span>
        </span>
        <MaterialIcon icon={aberto ? "expand_less" : "expand_more"} size={20} className="shrink-0 text-ink-3" />
      </button>
      {aberto && (
        <ul className="mt-3 divide-y divide-surface-line border-t border-surface-line">
          {VIDEOS.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-sm text-ink">{v.titulo}</span>
              <a href={urlVideo(v)} target="_blank" rel="noopener noreferrer" className={LINK_ACAO}>
                Assistir no YouTube →
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
