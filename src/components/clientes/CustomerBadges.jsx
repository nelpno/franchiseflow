import MaterialIcon from "@/components/ui/MaterialIcon";
import { marcaDoCliente, textoDias, tomDaRecencia } from "@/lib/customerActions";

const TOM_BOLINHA = { ok: "bg-ok", warn: "bg-warn", err: "bg-err" };

// Selo "quem é": Fiel · Voltou · Novo · Nunca comprou
export function CustomerMark({ purchases }) {
  const marca = marcaDoCliente(purchases);
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-ink-2">
      <MaterialIcon icon={marca.icone} size={14} />
      {marca.label}
    </span>
  );
}

// "Comprou há X dias" com a bolinha verde / amarela / vermelha
export function Recency({ days, prefix = "Comprou" }) {
  if (days == null) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${TOM_BOLINHA[tomDaRecencia(days)]}`} />
      <span className="truncate">
        {prefix} {textoDias(days)}
      </span>
    </span>
  );
}
