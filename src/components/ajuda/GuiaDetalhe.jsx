import MaterialIcon from "@/components/ui/MaterialIcon";
import PageHeader from "@/components/shared/PageHeader";
import { BTN_PRIMARIO, CARTAO, H3_CARTAO, TOM_CHEGADA } from "@/components/shared/adminUi";
import { linkWhatsAppDoGuia } from "@/lib/guiasAjuda";

/**
 * Guia escrito aberto: passos numerados. No lugar do "recorte da tela + seta", cada passo
 * mostra o rótulo EXATO do botão que a pessoa toca (chip com borda da marca) e, quando existe,
 * o recorte real da tela em /public/tutoriais. Nada de imagem inventada.
 */
export function BotaoDaTela({ rotulo }) {
  return (
    <span className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-ink-2">
      <span aria-hidden="true" className="font-bold text-brand-dark">→</span>
      <span className="sr-only">Toque em</span>
      <span className="inline-flex min-h-9 items-center rounded-xl border-2 border-brand bg-white px-3 font-semibold text-ink">
        {rotulo}
      </span>
    </span>
  );
}

function BotaoWhatsApp({ guia, className = "" }) {
  return (
    <a
      href={linkWhatsAppDoGuia(guia)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BTN_PRIMARIO} min-h-11 ${className}`}
    >
      <MaterialIcon icon="share" size={18} />
      Mandar este guia no WhatsApp
    </a>
  );
}

export default function GuiaDetalhe({ guia, voltarLabel, onVoltar, equipe }) {
  const paraQuem = guia.publico === "equipe" ? "Para a equipe Maxi" : "Para o franqueado";
  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        voltar={{ onClick: onVoltar, label: voltarLabel }}
        titulo={guia.titulo}
        subtitulo={guia.resumo}
        acao={<BotaoWhatsApp guia={guia} className="hidden sm:inline-flex" />}
      />

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MaterialIcon icon="schedule" size={16} />
          {guia.tempo}
        </span>
        {equipe && (
          <span className="inline-flex items-center gap-1.5">
            <MaterialIcon icon="person" size={16} />
            {paraQuem}
          </span>
        )}
      </p>

      <ol className="space-y-3">
        {guia.passos.map((p, i) => (
          <li key={i} className={`${CARTAO} flex gap-4`}>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft font-plus-jakarta text-base font-extrabold text-brand-dark"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={H3_CARTAO}>
                <span className="sr-only">Passo {i + 1}: </span>
                {p.titulo}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.texto}</p>
              {p.botao && <BotaoDaTela rotulo={p.botao} />}
              {p.imagem && (
                <img
                  src={p.imagem}
                  alt={`Tela do passo ${i + 1}: ${p.titulo}`}
                  loading="lazy"
                  className="mt-3 w-full max-w-[320px] rounded-xl border border-surface-line"
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      {guia.nota && (
        <div className={`${TOM_CHEGADA} flex gap-3`}>
          <MaterialIcon icon="info" size={20} className="mt-0.5 shrink-0 text-brand-dark" />
          <p className="text-sm leading-relaxed text-ink">{guia.nota}</p>
        </div>
      )}

      <div className={`${CARTAO} flex flex-col gap-3 sm:flex-row sm:items-center`}>
        <p className="text-sm text-ink-2">
          {equipe
            ? "Mande o link deste guia para o franqueado: ele abre direto neste passo a passo."
            : "Mande este guia para quem trabalha com você na unidade."}
        </p>
        <BotaoWhatsApp guia={guia} className="w-full sm:ml-auto sm:w-auto" />
      </div>
    </div>
  );
}
