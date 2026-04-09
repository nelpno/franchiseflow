import { useMemo } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { createPageUrl } from "@/utils";

export default function BotSummaryCard({ botConversations }) {
  const metrics = useMemo(() => {
    if (!botConversations?.length) return null;

    const total = botConversations.length;
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const activeStatuses = ['started', 'catalog_sent', 'items_discussed', 'checkout_started'];

    const ongoing = botConversations.filter(c => {
      if (c.outcome) return c.outcome === 'ongoing';
      return activeStatuses.includes(c.status) && new Date(c.updated_at).getTime() >= cutoff24h;
    }).length;
    const concluded = total - ongoing;

    const converted = botConversations.filter(c =>
      c.status === 'converted' || c.outcome === 'converted'
    ).length;
    const abandoned = botConversations.filter(c =>
      c.status === 'abandoned' || c.outcome === 'abandoned'
    ).length;

    const conversionRate = concluded > 0 ? Math.round((converted / concluded) * 100) : 0;
    const abandonRate = concluded > 0 ? Math.round((abandoned / concluded) * 100) : 0;

    return { total, concluded, converted, conversionRate, abandonRate };
  }, [botConversations]);

  if (!metrics) {
    return (
      <div className="bg-white rounded-2xl border border-[#291715]/5 p-5 flex flex-col items-center justify-center text-[#4a3d3d]/50 min-h-[140px]">
        <MaterialIcon icon="smart_toy" size={28} className="mb-2 opacity-40" />
        <p className="text-sm">Sem dados de bot</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#291715]/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#705d00]/10 flex items-center justify-center">
            <MaterialIcon icon="psychology" size={18} className="text-[#705d00]" />
          </div>
          <h3 className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta">Performance Bot</h3>
        </div>
        <Link to={createPageUrl("BotIntelligence")} className="text-xs text-[#a80012] hover:underline font-medium">
          Ver detalhes
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Conversão</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{metrics.conversionRate}%</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Abandono</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{metrics.abandonRate}%</p>
        </div>
      </div>

      <p className="text-xs text-[#4a3d3d]/70">
        {metrics.concluded} conversas concluídas · {metrics.converted} convertidas
      </p>
    </div>
  );
}
