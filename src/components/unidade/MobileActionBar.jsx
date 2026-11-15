// Barra fixa no rodapé do celular: Registrar conversa | WhatsApp. Some em desktop
// (md+, onde as ações já estão no MessageCard). Ficha da unidade.
import { safeHref } from "@/lib/safeHref";
import { getWhatsAppLink } from "@/lib/whatsappUtils";

export default function MobileActionBar({ mensagem, phone, onRegistrar, registrando, onEnviar }) {
  const link = phone ? getWhatsAppLink(phone, mensagem) : null;
  return (
    <div className="md:hidden fixed left-0 right-0 bottom-16 bg-white border-t border-surface-line px-4 pt-3 pb-3 grid grid-cols-2 gap-2.5 z-30">
      <button
        type="button"
        onClick={onRegistrar}
        disabled={registrando}
        className="min-h-[48px] rounded-xl border border-surface-line bg-white font-semibold text-sm text-ink disabled:opacity-60"
      >
        {registrando ? "Registrando…" : "Registrar a conversa"}
      </button>
      {link ? (
        <a
          href={safeHref(link)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onEnviar?.(mensagem)}
          className="min-h-[48px] rounded-xl bg-ok-ink hover:bg-ok-ink/90 text-white flex items-center justify-center font-semibold text-sm"
        >
          Enviar no WhatsApp
        </a>
      ) : (
        <span className="min-h-[48px] rounded-xl bg-surface flex items-center justify-center text-xs text-ink-3 text-center px-1">
          Sem telefone
        </span>
      )}
    </div>
  );
}
