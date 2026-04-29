import { useMemo } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { createPageUrl } from "@/utils";
import { startOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Performance Bot mensal — consome agregados do RPC get_bot_conversation_summary.
 * Shape: Array<{day: string|Date, total, converted, abandoned, ongoing, ...}>
 */
export default function BotSummaryCard({ botSummary }) {
  const metrics = useMemo(() => {
    if (!botSummary?.length) return null;

    const monthStartStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
    // String(s.day) defensivo: supabase pode retornar `day` como string YYYY-MM-DD ou Date.
    const monthData = botSummary.filter((s) => String(s.day) >= monthStartStr);
    if (!monthData.length) return null;

    const total = monthData.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const ongoing = monthData.reduce((sum, s) => sum + Number(s.ongoing || 0), 0);
    const converted = monthData.reduce((sum, s) => sum + Number(s.converted || 0), 0);
    const abandoned = monthData.reduce((sum, s) => sum + Number(s.abandoned || 0), 0);
    const concluded = total - ongoing;

    const conversionRate = concluded > 0 ? Math.round((converted / concluded) * 100) : 0;
    const abandonRate = concluded > 0 ? Math.round((abandoned / concluded) * 100) : 0;

    const monthLabel = format(new Date(), "MMM/yy", { locale: ptBR });
    return { total, concluded, converted, conversionRate, abandonRate, monthLabel };
  }, [botSummary]);

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
        {metrics.concluded} concluídas · {metrics.converted} convertidas
        <span className="ml-1.5 text-[#4a3d3d]/40">({metrics.monthLabel})</span>
      </p>
    </div>
  );
}
