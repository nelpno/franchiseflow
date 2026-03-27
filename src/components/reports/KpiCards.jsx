import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";

function KpiCard({ icon, iconBg, label, value, subtitle, delta, isLoading }) {
  const deltaColor = delta > 0 ? 'text-[#16a34a]' : delta < 0 ? 'text-[#dc2626]' : 'text-[#4a3d3d]';
  const deltaIcon = delta > 0 ? 'arrow_upward' : delta < 0 ? 'arrow_downward' : 'remove';
  const deltaBg = delta > 0 ? 'bg-[#16a34a]/10' : delta < 0 ? 'bg-[#dc2626]/10' : 'bg-slate-50';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <MaterialIcon icon={icon} size={22} className="text-white" />
        </div>
        {delta !== null && delta !== undefined && !isLoading && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${deltaBg} ${deltaColor}`}>
            <MaterialIcon icon={deltaIcon} size={14} />
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-2/3" />
          <div className="h-4 bg-slate-50 rounded w-1/2" />
        </div>
      ) : (
        <>
          <div>
            <div className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] tracking-tight">
              {value}
            </div>
            <div className="text-sm text-[#4a3d3d] mt-0.5">{label}</div>
          </div>
          {subtitle && (
            <div className="text-xs text-[#7a6b6b]">{subtitle}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function KpiCards({ sales, contacts, previousSales, previousContacts, isLoading }) {
  const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
  const totalSales = sales.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalContacts = contacts.length;

  const prevRevenue = previousSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
  const prevSalesCount = previousSales.length;
  const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
  const prevContacts = previousContacts.length;

  const calcDelta = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (v) => {
    if (v >= 1000) return formatBRLCompact(v);
    return formatBRL(v);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <KpiCard
        icon="payments"
        iconBg="bg-[#16a34a]"
        label="Faturamento"
        value={formatCurrency(totalRevenue)}
        subtitle={`vs. ${formatCurrency(prevRevenue)} anterior`}
        delta={calcDelta(totalRevenue, prevRevenue)}
        isLoading={isLoading}
      />
      <KpiCard
        icon="receipt_long"
        iconBg="bg-blue-600"
        label="Vendas"
        value={totalSales.toString()}
        subtitle={`vs. ${prevSalesCount} anterior`}
        delta={calcDelta(totalSales, prevSalesCount)}
        isLoading={isLoading}
      />
      <KpiCard
        icon="avg_pace"
        iconBg="bg-[#a80012]"
        label="Valor Médio"
        value={formatBRL(avgTicket)}
        subtitle={prevAvgTicket > 0 ? `vs. ${formatBRL(prevAvgTicket)} anterior` : null}
        delta={calcDelta(avgTicket, prevAvgTicket)}
        isLoading={isLoading}
      />
      <KpiCard
        icon="person_add"
        iconBg="bg-[#d4af37]"
        label="Novos Contatos"
        value={totalContacts.toString()}
        subtitle={`vs. ${prevContacts} anterior`}
        delta={calcDelta(totalContacts, prevContacts)}
        isLoading={isLoading}
      />
    </div>
  );
}
