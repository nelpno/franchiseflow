import { useMemo } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { createPageUrl } from "@/utils";

export default function BotSummaryCard({ botConversations }) {
  const metrics = useMemo(() => {
    if (!botConversations?.length) return null;

    const total = botConversations.length;
    const ongoing = botConversations.filter(c => c.outcome === 'ongoing').length;
    const concluded = total - ongoing;
    const converted = botConversations.filter(c => c.outcome === 'converted').length;
    const abandoned = botConversations.filter(c => c.outcome === 'abandoned').length;

    const conversionRate = concluded > 0 ? Math.round((converted / concluded) * 100) : 0;
    const abandonRate = concluded > 0 ? Math.round((abandoned / concluded) * 100) : 0;

    // Average quality score (1-5 scale)
    const withScore = botConversations.filter(c => c.quality_score > 0);
    const avgQuality = withScore.length > 0
      ? (withScore.reduce((sum, c) => sum + c.quality_score, 0) / withScore.length).toFixed(1)
      : null;

    return { total, concluded, converted, conversionRate, abandonRate, avgQuality };
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

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Conversão</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{metrics.conversionRate}%</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Abandono</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{metrics.abandonRate}%</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Qualidade</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">
            {metrics.avgQuality ?? "—"}
            {metrics.avgQuality && <span className="text-xs font-normal text-[#4a3d3d]/60">/10</span>}
          </p>
        </div>
      </div>

      <p className="text-xs text-[#4a3d3d]/70">
        {metrics.concluded} conversas concluídas · {metrics.converted} convertidas
      </p>
    </div>
  );
}
