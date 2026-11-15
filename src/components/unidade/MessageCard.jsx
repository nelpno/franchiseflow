// Mensagem pronta (editável) + "Enviar pelo WhatsApp" + "Registrar a conversa".
// Ficha da unidade (/Unidade?id=<evo>).
import { Link } from "react-router-dom";
import { safeHref } from "@/lib/safeHref";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function MessageCard({ mensagem, onChangeMensagem, phone, onRegistrar, registrando, guia, onEnviar }) {
  const link = phone ? getWhatsAppLink(phone, mensagem) : null;

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-surface-line flex flex-col gap-3">
      <label htmlFor="ficha-msg" className="text-xs font-bold text-ink-3 tracking-wide uppercase">
        Mensagem pronta · você pode editar
      </label>
      <textarea
        id="ficha-msg"
        value={mensagem}
        onChange={(e) => onChangeMensagem(e.target.value)}
        rows={5}
        maxLength={1000}
        className="w-full text-sm md:text-base rounded-xl border border-surface-line p-3 leading-relaxed resize-none focus:outline-none focus:border-brand"
      />
      {/* No celular as mesmas duas ações já estão na barra fixa (MobileActionBar) —
          duplicar aqui confundia (dois botões "WhatsApp" e dois "Registrar" na
          mesma tela, achado ALTO, 26/09). */}
      {link ? (
        <a
          href={safeHref(link)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onEnviar?.(mensagem)}
          className="hidden md:flex min-h-[48px] rounded-xl bg-ok-ink hover:bg-ok-ink/90 text-white items-center justify-center gap-2 font-semibold text-base"
        >
          <MaterialIcon icon="chat" size={18} aria-hidden="true" />
          Enviar pelo WhatsApp
        </a>
      ) : (
        <div className="hidden md:flex min-h-[48px] rounded-xl bg-surface items-center justify-center gap-2 text-sm text-ink-3 px-3 text-center">
          Sem telefone cadastrado para esta unidade
        </div>
      )}
      <button
        type="button"
        onClick={onRegistrar}
        disabled={registrando}
        className="hidden md:block min-h-[44px] rounded-xl border border-surface-line bg-white font-semibold text-sm text-ink disabled:opacity-60"
      >
        {registrando ? "Registrando…" : "Registrar a conversa"}
      </button>
      {guia && (
        <Link to={guia.href} className="text-sm font-medium text-brand-dark hover:underline">
          Mandar junto o guia &quot;{guia.titulo}&quot; →
        </Link>
      )}
    </div>
  );
}
