import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

function getBand(daysSince) {
  if (daysSince === null) {
    return { bg: "bg-[#291715]/5", text: "text-[#1b1c1d]/60", border: "border-[#291715]/10", dot: "bg-[#1b1c1d]/30", label: "Nunca pediu" };
  }
  if (daysSince > 30) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", label: `há ${daysSince}d` };
  if (daysSince >= 15) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", label: `há ${daysSince}d` };
  return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: `há ${daysSince}d` };
}

export default function LastPurchaseOrderCard({ franchises, purchaseOrders, configMap = {} }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const today = new Date();
    return franchises
      .map((f) => {
        const orders = purchaseOrders.filter(
          (po) => po.franchise_id === f.id || po.franchise_id === f.evolution_instance_id
        );
        let lastOrder = null;
        for (const po of orders) {
          if (!po.ordered_at) continue;
          if (!lastOrder || po.ordered_at > lastOrder.ordered_at) lastOrder = po;
        }
        const daysSince = lastOrder ? differenceInDays(today, new Date(lastOrder.ordered_at)) : null;
        return { franchise: f, lastOrder, daysSince };
      })
      .sort((a, b) => {
        if (a.daysSince === null && b.daysSince === null) return 0;
        if (a.daysSince === null) return -1;
        if (b.daysSince === null) return 1;
        return b.daysSince - a.daysSince;
      });
  }, [franchises, purchaseOrders]);

  if (rows.length === 0) return null;

  const overdueCount = rows.filter((r) => r.daysSince === null || r.daysSince > 30).length;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#291715]/5">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b1c1d]/60 font-plus-jakarta">
          Última Reposição por Unidade
        </h4>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {overdueCount} sem pedir há 30+ dias
          </div>
        )}
      </div>

      <div className="space-y-3">
        {(expanded ? rows : rows.slice(0, 5)).map(({ franchise, lastOrder, daysSince }) => {
          const band = getBand(daysSince);
          const evoId = franchise.evolution_instance_id;
          const subtitle = lastOrder?.ordered_at
            ? `Último pedido: ${formatDistanceToNow(new Date(lastOrder.ordered_at), { locale: ptBR, addSuffix: false })}`
            : "Nenhum pedido registrado";

          return (
            <div
              key={franchise.id}
              onClick={() => navigate(`/Franchises?id=${encodeURIComponent(evoId)}&openSheet=1`)}
              className={`flex items-center gap-4 p-3 rounded-xl border ${band.border} ${band.bg}/30 cursor-pointer hover:shadow-md transition-shadow`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${band.bg} ${band.text}`}>
                <MaterialIcon icon="local_shipping" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#1b1c1d] font-plus-jakarta truncate">
                  {getFranchiseDisplayName(franchise, configMap[evoId])}
                </p>
                <p className="text-xs text-[#1b1c1d]/60 truncate">{subtitle}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${band.bg} ${band.text} ${band.border} border shrink-0`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${band.dot}`} />
                  {band.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-4 py-2 text-xs font-bold uppercase tracking-wide text-[#1b1c1d]/60 hover:text-[#b91c1c] transition-colors"
        >
          {expanded ? "Mostrar menos" : `Ver todas (${rows.length})`}
        </button>
      )}
    </div>
  );
}
