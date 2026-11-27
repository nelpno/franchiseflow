import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { safeHref } from "@/lib/safeHref";
import {
  BUCKET_COMPROVANTES,
  VALIDADE_COMPROVANTE_SEG,
  caminhoDoComprovante,
} from "@/lib/comprovantes";

// Link "Ver comprovante": o bucket é privado, então o clique gera uma URL assinada (1 h) e abre.
// A aba é aberta no próprio clique (senão o navegador bloqueia o pop-up) e recebe a URL depois.
export default function ComprovanteLink({ url, className, title, children }) {
  const abrir = async (e) => {
    e.preventDefault();
    const caminho = caminhoDoComprovante(url);
    if (!caminho) {
      // URL de outro lugar (nunca assina): abre como está, só se for http(s).
      const href = safeHref(url);
      if (href !== "#") window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    const aba = window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_COMPROVANTES)
        .createSignedUrl(caminho, VALIDADE_COMPROVANTE_SEG);
      if (error || !data?.signedUrl) throw error || new Error("sem url");
      if (aba) {
        aba.opener = null;
        aba.location.href = data.signedUrl;
      } else {
        window.location.assign(data.signedUrl);
      }
    } catch (err) {
      if (aba) aba.close();
      toast.error(safeErrorMessage(err, "Não foi possível abrir o comprovante. Tente de novo."));
    }
  };

  return (
    <a href="#" role="button" onClick={abrir} className={className} title={title}>
      {children}
    </a>
  );
}
