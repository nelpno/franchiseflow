import MaterialIcon from "@/components/ui/MaterialIcon";
import { BTN_PRIMARIO, CARTAO, H3_CARTAO } from "@/components/shared/adminUi";
import { MENSAGEM_AJUDA, linkWhatsAppMaxi } from "@/lib/contatoMaxi";

// Cartão "Falar com a Maxi" da tela Ajuda v2 (S10.1, 28/09/2026): mensagem genérica
// (não veio de um guia aberto) para quem não achou o guia certo na busca.
// O número (WHATSAPP_MAXI) nunca aparece cru aqui nem em print — só dentro do link.
export default function FalarComMaxiCard() {
  const link = linkWhatsAppMaxi(MENSAGEM_AJUDA);
  if (!link) return null;
  return (
    <section className={`${CARTAO} flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
          <MaterialIcon icon="chat" size={20} />
        </span>
        <div>
          <p className={H3_CARTAO}>Não achou o que precisava?</p>
          <p className="mt-1 text-sm text-ink-2">Fale com a equipe Maxi pelo WhatsApp.</p>
        </div>
      </div>
      <a href={link} target="_blank" rel="noopener noreferrer" className={`${BTN_PRIMARIO} min-h-11 w-full sm:w-auto`}>
        <MaterialIcon icon="chat" size={18} />
        Falar com a Maxi
      </a>
    </section>
  );
}
