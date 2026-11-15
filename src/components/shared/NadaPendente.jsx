// Seção sem pendência (regra E4 do padrão): uma linha em cartão K1. A seção NÃO some —
// quem abre precisa ver que conferiu.
//
//   <NadaPendente>Nada para confirmar agora.</NadaPendente>
//   <NadaPendente texto="Nenhuma mensalidade vencida." />
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function NadaPendente({ texto, children, className = "" }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-surface-line bg-white p-4 sm:p-5 ${className}`}>
      <MaterialIcon icon="check_circle" size={20} className="shrink-0 text-ok-ink" aria-hidden="true" />
      <p className="min-w-0 text-sm text-ink-2">{children ?? texto}</p>
    </div>
  );
}
