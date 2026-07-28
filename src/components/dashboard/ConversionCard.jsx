import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Card "Conversão" do dashboard do franqueado.
 *
 * Não reusa o StatsCard de propósito: aqui o delta correto é em PONTOS PERCENTUAIS
 * (17,1% → 15,6% é -1,5 p.p., não -8,8% relativo), e o card precisa de onClick
 * para abrir o detalhe — o StatsCard só suporta href.
 */
function ConversionCard({ funnel, loading, onClick }) {
  const base = "bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-[#cac0c0]/10 text-left w-full";

  if (loading || !funnel) {
    return (
      <div className={base}>
        <p className="text-xs text-[#4a3d3d] font-medium mb-1 truncate">Conversão</p>
        <div className="h-6 sm:h-8 w-12 bg-[#291715]/5 rounded animate-pulse" />
      </div>
    );
  }

  const reached = Number(funnel.reached) || 0;
  const converted = Number(funnel.converted) || 0;
  const prevReached = Number(funnel.prev_reached) || 0;
  const prevConverted = Number(funnel.prev_converted) || 0;

  // Robô parado ou inexistente: sem denominador confiável, não inventa número.
  // Contato lançado na mão é criado PELA venda, então daria 100% sempre.
  if (!funnel.has_bot_data) {
    return (
      <button type="button" onClick={onClick} className={base + " cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"}>
        <p className="text-xs text-[#4a3d3d] font-medium mb-1 truncate">Conversão</p>
        <div className="flex items-baseline gap-1">
          <span className="text-base sm:text-2xl font-extrabold tracking-tight text-[#7a6d6d]">—</span>
        </div>
        <p className="text-[10px] sm:text-xs text-[#7a6d6d] mt-0.5 leading-tight">
          Ative o robô para medir
        </p>
      </button>
    );
  }

  const rate = reached > 0 ? (converted / reached) * 100 : 0;
  const prevRate = prevReached > 0 ? (prevConverted / prevReached) * 100 : null;
  const deltaPP = prevRate != null ? rate - prevRate : null;
  const hasDelta = deltaPP != null && Math.abs(deltaPP) >= 0.1;
  const isUp = hasDelta && deltaPP > 0;

  return (
    <button type="button" onClick={onClick} className={base + " cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"}>
      <p className="text-xs text-[#4a3d3d] font-medium mb-1 truncate">Conversão</p>
      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
        <span className="text-base sm:text-2xl font-extrabold tracking-tight text-[#1d1b1b] tabular-nums">
          {rate.toFixed(0)}%
        </span>
        {hasDelta && (
          <span className={`text-xs font-bold flex items-center gap-0.5 ${isUp ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
            <MaterialIcon icon={isUp ? "arrow_upward" : "arrow_downward"} size={14} />
            {Math.abs(deltaPP).toFixed(1).replace(".", ",")} p.p.
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-xs text-[#7a6d6d] mt-0.5 leading-tight tabular-nums">
        {converted} de {reached} contatos
      </p>
    </button>
  );
}

export default React.memo(ConversionCard);
