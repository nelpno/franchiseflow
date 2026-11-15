// "Ordenar por" do celular — não há cabeçalho de tabela em telas pequenas (T9: cartão de
// 3 linhas), então a mesma lista de campos do cabeçalho do desktop vira um seletor
// compacto acima da lista. Campo + botão de direção (mesma semântica do clique de novo
// no cabeçalho: inverte). "Padrão" limpa e devolve a ordem própria do filtro atual.
import MaterialIcon from "@/components/ui/MaterialIcon";
import { OPCOES_ORDEM, ORDEM_OPCOES_LISTA } from "@/lib/networkOverview";

export default function OrdenarSeletor({ ordem, direcao, onEscolher, onInverter }) {
  return (
    <div className="flex items-center gap-2 md:hidden">
      <div className="flex h-11 flex-1 min-w-0 items-center gap-2 rounded-xl border border-surface-line bg-white px-3">
        <label htmlFor="ordenar-unidades" className="shrink-0 text-xs font-bold uppercase tracking-wide text-ink-3">
          Ordenar
        </label>
        <select
          id="ordenar-unidades"
          value={ordem || ""}
          onChange={(e) => onEscolher(e.target.value || null)}
          className="w-full min-w-0 flex-1 truncate border-0 bg-transparent text-sm font-medium text-ink focus:outline-none focus:ring-0"
        >
          <option value="">Padrão</option>
          {ORDEM_OPCOES_LISTA.map((k) => (
            <option key={k} value={k}>
              {OPCOES_ORDEM[k].rotulo}
            </option>
          ))}
        </select>
      </div>
      {ordem && (
        <button
          type="button"
          onClick={onInverter}
          aria-label={
            direcao === "asc" ? "Ordem crescente. Tocar para inverter" : "Ordem decrescente. Tocar para inverter"
          }
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-line bg-white text-ink-2 hover:bg-surface"
        >
          <MaterialIcon icon={direcao === "asc" ? "arrow_upward" : "arrow_downward"} size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
