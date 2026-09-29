import MaterialIcon from "@/components/ui/MaterialIcon";
import PageHeader from "@/components/shared/PageHeader";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO, TOM_ATENCAO, TOM_CHEGADA, TOM_MAXI } from "@/components/shared/adminUi";
import { safeHref } from "@/lib/safeHref";
import { linkWhatsAppDoGuia } from "@/lib/guiasAjuda";
import { linkFalarComMaxiDoGuia } from "@/lib/contatoMaxi";
import IssoResolveu from "./IssoResolveu";

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

function BotaoFalarComMaxi({ guia }) {
  const link = linkFalarComMaxiDoGuia(guia);
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`}
    >
      <MaterialIcon icon="chat" size={18} />
      Falar com a Maxi
    </a>
  );
}

// Dica, Erro comum e link do Drive (S24.1, P3 29/09/2026): os campos v2 de guiasAjuda.js que
// a Ajuda nova ainda não mostrava. Só com `mostrarAjudaExtra` (Ajuda v2, ui_v2 ligada): com a
// chave desligada o guia segue idêntico ao de antes.
export function GuiaExtras({ guia }) {
  const driveHref = guia.drive ? safeHref(guia.drive.href) : "#";
  return (
    <>
      {guia.dica && (
        <div className={`${TOM_MAXI} flex gap-3`}>
          <MaterialIcon icon="lightbulb" size={20} className="mt-0.5 shrink-0 text-brand-gold-ink" />
          <p className="text-sm leading-relaxed text-ink">
            <strong className="font-bold">Dica: </strong>
            {guia.dica}
          </p>
        </div>
      )}
      {guia.erroComum && (
        <div className={`${TOM_ATENCAO} flex gap-3`}>
          <MaterialIcon icon="warning" size={20} className="mt-0.5 shrink-0 text-warn-ink" />
          <p className="text-sm leading-relaxed text-ink">
            <strong className="font-bold">Erro comum: </strong>
            {guia.erroComum}
          </p>
        </div>
      )}
      {guia.drive && driveHref !== "#" && (
        <a
          href={driveHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`}
        >
          <MaterialIcon icon="open_in_new" size={18} />
          {guia.drive.rotulo}
        </a>
      )}
    </>
  );
}

// `mostrarAjudaExtra` (S10.2, 28/09/2026): "Isso resolveu?" e "Falar com a Maxi" direto
// (sem passar pelo compartilhar). Só true quando a tela Ajuda v2 está no ar (atrás de
// ui_v2, franqueado) — sem a prop, o guia renderiza EXATAMENTE como antes (a chave
// desligada não pode mudar nada aqui).
export default function GuiaDetalhe({ guia, voltarLabel, onVoltar, equipe, mostrarAjudaExtra = false }) {
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

      {mostrarAjudaExtra && <GuiaExtras guia={guia} />}

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

      {mostrarAjudaExtra && !equipe && (
        <>
          {/* key=slug (P3, S10): sem isso, a resposta de um guia ficava em memória
              (useState) e vazava pro próximo ao navegar entre deep-links sem
              desmontar o componente — o React só cria a instância de novo quando
              a key muda. */}
          <IssoResolveu key={guia.slug} slug={guia.slug} />
          {/* Sem WHATSAPP_MAXI cadastrado, `linkFalarComMaxiDoGuia` volta null (P3,
              28/09/2026): nesse caso o card some inteiro — nunca prometer "fale com
              a equipe" sem ter pra onde mandar. */}
          {linkFalarComMaxiDoGuia(guia) && (
            <div className={`${CARTAO} flex flex-col gap-3 sm:flex-row sm:items-center`}>
              <p className="text-sm text-ink-2">Não resolveu? Fale direto com a equipe Maxi.</p>
              <BotaoFalarComMaxi guia={guia} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
