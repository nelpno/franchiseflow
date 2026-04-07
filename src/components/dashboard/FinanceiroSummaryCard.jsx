import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { createPageUrl } from "@/utils";
import { formatBRLInteger } from "@/lib/formatters";

export default function FinanceiroSummaryCard({ allSales, configMap }) {
  const metrics = useMemo(() => {
    if (!allSales?.length) return null;

    const currentMonth = format(new Date(), "yyyy-MM");
    const monthSales = allSales.filter(s => s.sale_date?.startsWith(currentMonth));

    const totalRevenue = monthSales.reduce(
      (sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0
    );
    const totalSalesCount = monthSales.length;

    // Revenue by franchise
    const byFranchise = {};
    for (const s of monthSales) {
      const fid = s.franchise_id;
      if (!byFranchise[fid]) byFranchise[fid] = 0;
      byFranchise[fid] += (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0);
    }

    // Top and bottom franchise
    const entries = Object.entries(byFranchise);
    let topFranchise = null;
    let bottomFranchise = null;
    if (entries.length > 1) {
      entries.sort((a, b) => b[1] - a[1]);
      const topId = entries[0][0];
      const bottomId = entries[entries.length - 1][0];
      topFranchise = { name: configMap[topId] || topId, value: entries[0][1] };
      bottomFranchise = { name: configMap[bottomId] || bottomId, value: entries[entries.length - 1][1] };
    }

    // Valor médio por venda
    const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    return { totalRevenue, totalSalesCount, avgTicket, topFranchise, bottomFranchise };
  }, [allSales, configMap]);

  if (!metrics) {
    return (
      <div className="bg-white rounded-2xl border border-[#291715]/5 p-5 flex flex-col items-center justify-center text-[#4a3d3d]/50 min-h-[140px]">
        <MaterialIcon icon="account_balance" size={28} className="mb-2 opacity-40" />
        <p className="text-sm">Sem dados financeiros</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#291715]/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#a80012]/10 flex items-center justify-center">
            <MaterialIcon icon="account_balance" size={18} className="text-[#a80012]" />
          </div>
          <h3 className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta">Financeiro do Mês</h3>
        </div>
        <Link to={createPageUrl("Financeiro")} className="text-xs text-[#a80012] hover:underline font-medium">
          Ver detalhes
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Faturamento</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{formatBRLInteger(metrics.totalRevenue)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Vendas</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{metrics.totalSalesCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1b1c1d]/50 uppercase tracking-wider">Valor Médio</p>
          <p className="text-lg font-extrabold text-[#1b1c1d] font-mono-numbers">{formatBRLInteger(metrics.avgTicket)}</p>
        </div>
      </div>

      {metrics.bottomFranchise && (
        <p className="text-xs text-[#4a3d3d]/70">
          <MaterialIcon icon="arrow_downward" size={12} className="text-[#ba1a1a] align-middle mr-0.5" />
          {metrics.bottomFranchise.name}: {formatBRLInteger(metrics.bottomFranchise.value)}
        </p>
      )}
    </div>
  );
}
