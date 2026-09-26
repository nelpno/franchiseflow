// Menu "Mais ações" (regras C11, C12, B7 do padrão): o que é raro ou perigoso sai do fluxo
// principal sem sumir. Sem dropdown-menu do shadcn (removido por não uso em 02/07/2026).
//
//   <MaisAcoesMenu
//     actions={[
//       { label: "Novo produto padrão", icon: "add_circle", onClick: … },
//       podeExcluir && { label: "Excluir pedidos marcados", icon: "delete", onClick: …, perigo: true },
//     ]}
//     rotulo="Mais ações"        // opcional
//     alinhar="direita"          // "direita" (padrão) | "esquerda": para que lado o menu abre
//     className=""               // extra no botão (ex.: "w-full sm:w-auto")
//   />
//
// Itens falsos (false/null) e `hidden: true` são ignorados. Com UM item só, não há menu:
// vira botão secundário com o próprio rótulo do item (C12). Sem itens, não renderiza nada.
// `perigo: true` pinta o item de text-err (B7); a confirmação fica com quem chama (AlertDialog).
import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { BTN_SECUNDARIO } from "./adminUi";

export default function MaisAcoesMenu({ actions = [], rotulo = "Mais ações", alinhar = "direita", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const itens = actions.filter((a) => a && !a.hidden);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (itens.length === 0) return null;

  if (itens.length === 1) {
    const a = itens[0];
    return (
      <button
        type="button"
        onClick={a.onClick}
        disabled={a.disabled}
        className={`${BTN_SECUNDARIO} h-11 shrink-0 whitespace-nowrap ${a.perigo ? "text-err" : ""} ${className}`}
      >
        {a.icon && <MaterialIcon icon={a.icon} size={18} aria-hidden="true" />}
        {a.label}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${BTN_SECUNDARIO} h-11 whitespace-nowrap ${className}`}
      >
        {rotulo}
        <MaterialIcon icon="expand_more" size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute ${alinhar === "esquerda" ? "left-0" : "right-0"} z-20 mt-1.5 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-surface-line bg-white py-1 shadow-lg`}
        >
          {itens.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={() => {
                setOpen(false);
                a.onClick?.();
              }}
              className={`flex min-h-10 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${
                a.perigo ? "text-err" : "text-ink"
              }`}
            >
              {a.icon && (
                <MaterialIcon
                  icon={a.icon}
                  size={18}
                  className={`shrink-0 ${a.perigo ? "text-err" : "text-ink-3"}`}
                  aria-hidden="true"
                />
              )}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
