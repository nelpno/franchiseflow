import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";

function formatarData(iso) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM", { locale: ptBR });
  } catch {
    return "";
  }
}

/**
 * Bloco "A Maxi faz por você" — todos os itens `maxi` dos 5 passos, juntos (não é
 * por passo). Só leitura pra franqueada; quem marca é a equipe Maxi (Onboarding.jsx,
 * visão admin, bloco separado com checkboxes reais).
 */
export default function MaxiDoesList({ passos }) {
  const itens = (passos || []).flatMap((p) => p.maxi || []);
  if (itens.length === 0) return null;

  return (
    <div className="bg-brand-gold-soft border border-brand-gold-line rounded-[22px] p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-brand-gold text-white flex items-center justify-center shrink-0">
          <MaterialIcon icon="star" filled size={22} />
        </span>
        <div className="flex flex-col">
          <span className="font-plus-jakarta font-extrabold text-[17px] text-ink">A Maxi faz por você</span>
          <span className="text-sm text-ink-2">Você acompanha aqui. Quem marca é a equipe Maxi.</span>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-brand-gold-line/60">
        {itens.map((m) => (
          <li key={m.id} className="min-h-[44px] py-2 flex items-start gap-3">
            {m.feito ? (
              <span className="w-[22px] h-[22px] mt-0.5 rounded-full bg-brand-gold-ink text-white flex items-center justify-center shrink-0">
                <MaterialIcon icon="check" size={14} />
              </span>
            ) : (
              <span className="w-[18px] h-[18px] mt-1.5 rounded-full border-2 border-brand-gold shrink-0" />
            )}
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[15px] text-ink">{m.nome}</span>
              {m.sub && <span className="text-xs text-ink-3">{m.sub}</span>}
            </div>
            <span
              className={`text-xs font-semibold shrink-0 ${m.feito ? "text-brand-gold-ink" : "text-ink-3"}`}
            >
              {m.feito ? (m.feitoEm ? formatarData(m.feitoEm) : "feito") : "a fazer"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
