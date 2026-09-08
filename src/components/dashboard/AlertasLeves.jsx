import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { unidadesSemVender, unidadesComRoboParado } from "@/lib/alertasLeves";

const NOMES_NA_PREVIA = 3;

/**
 * Faixa de alertas no TOPO do Painel Geral.
 *
 * Os dois sinais mais duros da rede — unidade que parou de vender e robo calado — moravam
 * dentro da secao "Alertas", colapsada no fim da pagina, e expandir dispara a busca dos
 * 31 mil contatos. Estes dois saem de `allSales` e `botSummary`, que ja estao em memoria:
 * custam ZERO requisicao. Medido em 08/09/2026: 8 unidades sem vender ha 7+ dias e 8 com o
 * robo parado ha 7+ dias, nenhuma visivel sem clicar.
 *
 * A regra vive em lib/alertasLeves.js e e a MESMA que o AlertsPanel usa — nao ha copia.
 */
export default function AlertasLeves({ franchises, configMap, allSales, botSummary, isLoading }) {
  const navigate = useNavigate();

  const { criticas, roboParado } = useMemo(() => {
    if (isLoading) return { criticas: [], roboParado: [] };
    const { criticas } = unidadesSemVender({ franchises, configMap, allSales });
    return { criticas, roboParado: unidadesComRoboParado({ franchises, configMap, botSummary }) };
  }, [franchises, configMap, allSales, botSummary, isLoading]);

  const faixas = [];
  if (criticas.length > 0) {
    faixas.push({
      chave: "sem-venda",
      icone: "trending_down",
      titulo: `${criticas.length} ${criticas.length === 1 ? "unidade parou" : "unidades pararam"} de vender`,
      detalhe: `até ${criticas[0].days} dias sem uma venda`,
      nomes: criticas,
    });
  }
  if (roboParado.length > 0) {
    faixas.push({
      chave: "robo",
      icone: "smart_toy",
      titulo: `${roboParado.length} ${roboParado.length === 1 ? "unidade está" : "unidades estão"} com o robô parado`,
      detalhe: "nenhuma conversa nos últimos 7 dias",
      nomes: roboParado,
    });
  }

  if (faixas.length === 0) return null;

  return (
    <div className="space-y-2">
      {faixas.map((f) => {
        const previa = f.nomes.slice(0, NOMES_NA_PREVIA);
        const resto = f.nomes.length - previa.length;
        return (
          <button
            key={f.chave}
            type="button"
            onClick={() => navigate("/CustomerSuccess")}
            className="w-full text-left bg-brand/5 border-l-4 border-brand rounded-r-xl p-3 flex items-center gap-3 min-h-[56px] active:bg-brand/10 hover:bg-brand/10 transition-colors"
          >
            <MaterialIcon icon={f.icone} size={20} className="text-brand shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink font-plus-jakarta">
                {f.titulo}
                <span className="font-normal text-ink-2"> — {f.detalhe}</span>
              </p>
              <p className="text-xs text-ink-2 truncate">
                {previa.map((u) => (u.days != null ? `${u.name} (${u.days}d)` : u.name)).join(", ")}
                {resto > 0 ? ` +${resto}` : ""}
              </p>
            </div>
            <MaterialIcon icon="chevron_right" size={20} className="text-ink-3 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
