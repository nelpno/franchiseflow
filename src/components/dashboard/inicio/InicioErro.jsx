// S18 (P3 #2): na Início nova, consulta que falhou NUNCA vira zero na tela ("R$ 0", "sem venda
// hoje"): o bloco diz que não carregou e oferece tentar de novo.
import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { CARTAO } from "@/components/shared/adminUi";

export function InicioErroLinha({ texto, onTentarDeNovo }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-line bg-white p-3">
      <MaterialIcon icon="cloud_off" size={20} className="shrink-0 text-ink-3" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-ink-2">{texto}</p>
      {onTentarDeNovo && (
        <button type="button" onClick={onTentarDeNovo} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-brand">
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export default function InicioErro({ rotulo, texto, onTentarDeNovo, className = "" }) {
  return (
    <section className={`${CARTAO} ${className}`} aria-label={rotulo}>
      <div className="flex items-start gap-3">
        <MaterialIcon icon="cloud_off" size={22} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{texto}</p>
          <p className="text-xs text-ink-3">Confira a internet. Nada foi perdido: é só a leitura que falhou.</p>
        </div>
      </div>
      {onTentarDeNovo && (
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink-2 hover:bg-surface"
        >
          <MaterialIcon icon="refresh" size={18} aria-hidden="true" />
          Tentar de novo
        </button>
      )}
    </section>
  );
}
