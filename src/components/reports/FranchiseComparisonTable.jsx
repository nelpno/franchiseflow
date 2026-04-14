import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

const TIER_CONFIG = {
  4: { label: "Elite", icon: "star", className: "bg-[#d4af37]/15 text-[#775a19] border-[#d4af37]/30" },
  3: { label: "Bom", icon: "trending_up", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  2: { label: "Atenção", icon: "trending_down", className: "bg-amber-50 text-amber-700 border-amber-200" },
  1: { label: "Crítico", icon: "warning", className: "bg-red-50 text-red-600 border-red-200" },
};

const SORT_KEYS = [
  { key: 'city', label: 'Franquia' },
  { key: 'salesCount', label: 'Vendas' },
  { key: 'revenue', label: 'Faturamento' },
  { key: 'avgTicket', label: 'Valor Médio' },
  { key: 'contactsCount', label: 'Leads' },
  { key: 'tier', label: 'Performance' },
];

export default function FranchiseComparisonTable({ sales, contacts, summaries, franchises, isLoading, periodLabel, configMap = {} }) {
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');

  const data = useMemo(() => {
    const rows = franchises.map(f => {
      const fSales = sales.filter(s => s.franchise_id === f.evolution_instance_id);
      const fContacts = contacts.filter(c => c.franchise_id === f.evolution_instance_id);
      const revenue = fSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0) - (parseFloat(s.discount_amount) || 0) + (parseFloat(s.delivery_fee) || 0), 0);
      const salesCount = fSales.length;
      const avgTicket = salesCount > 0 ? revenue / salesCount : 0;
      const contactsCount = fContacts.length;
      const config = configMap[f.evolution_instance_id];

      return {
        id: f.id,
        city: getFranchiseDisplayName(f, config),
        ownerName: f.owner_name,
        salesCount,
        revenue,
        avgTicket,
        contactsCount,
        tier: 0,
      };
    });

    // Assign performance tiers based on revenue percentile
    if (rows.length > 0) {
      const revenues = rows.map(r => r.revenue).sort((a, b) => b - a);
      const p75 = revenues[Math.floor(revenues.length * 0.25)] || 0;
      const p50 = revenues[Math.floor(revenues.length * 0.5)] || 0;
      const p25 = revenues[Math.floor(revenues.length * 0.75)] || 0;
      rows.forEach(r => {
        if (r.revenue >= p75 && r.revenue > 0) r.tier = 4;      // Elite
        else if (r.revenue >= p50 && r.revenue > 0) r.tier = 3;  // Bom
        else if (r.revenue >= p25 && r.revenue > 0) r.tier = 2;  // Atenção
        else r.tier = 1;                                          // Crítico
      });
    }

    return rows;
  }, [franchises, sales, contacts, configMap]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortDir]);

  const bestRevenue = Math.max(...data.map(d => d.revenue), 0);
  const worstRevenue = Math.min(...data.filter(d => d.revenue > 0).map(d => d.revenue), Infinity);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortHeader = ({ colKey, label, align = 'left', className: extraClass = '' }) => (
    <th
      className={`px-3 md:px-4 py-3 font-semibold text-xs uppercase tracking-wider text-[#7a6b6b] cursor-pointer hover:text-[#a80012] transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'} ${extraClass}`}
      onClick={() => handleSort(colKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortKey === colKey && (
          <MaterialIcon icon={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={14} />
        )}
      </div>
    </th>
  );

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold font-plus-jakarta text-[#1b1c1d]">
              <MaterialIcon icon="table_chart" size={20} className="text-[#a80012]" />
              Comparativo por Franquia
            </CardTitle>
            <p className="text-xs text-[#7a6b6b] mt-0.5">{periodLabel}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-slate-300" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#7a6b6b]">
            <MaterialIcon icon="storefront" size={48} className="mb-2 text-slate-300" />
            <p className="text-sm">Nenhuma franquia encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#291715]/5">
                  <SortHeader colKey="city" label="Franquia" />
                  <SortHeader colKey="salesCount" label="Vendas" align="right" />
                  <SortHeader colKey="revenue" label="Faturamento" align="right" />
                  <SortHeader colKey="avgTicket" label="Valor Médio" align="right" className="hidden md:table-cell" />
                  <SortHeader colKey="contactsCount" label="Leads" align="right" className="hidden md:table-cell" />
                  <SortHeader colKey="tier" label="Performance" align="center" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const isBest = row.revenue === bestRevenue && bestRevenue > 0;
                  const isWorst = row.revenue === worstRevenue && data.filter(d => d.revenue > 0).length > 1;

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-[#291715]/3 last:border-0 hover:bg-[#fbf9fa] transition-colors ${
                        isBest ? 'bg-emerald-50/50' : isWorst ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-3 md:px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {isBest && (
                            <div className="w-5 h-5 rounded-full bg-[#d4af37] flex items-center justify-center text-white text-[10px] font-bold">1</div>
                          )}
                          <div>
                            <div className="font-semibold text-[#1b1c1d]">{row.city}</div>
                            {row.ownerName && (
                              <div className="text-xs text-[#7a6b6b]">{row.ownerName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3.5 text-right font-mono-numbers font-medium text-[#1b1c1d]">
                        {row.salesCount}
                      </td>
                      <td className="px-3 md:px-4 py-3.5 text-right">
                        <span className={`font-mono-numbers font-bold ${isBest ? 'text-emerald-700' : isWorst ? 'text-red-600' : 'text-[#1b1c1d]'}`}>
                          {formatBRL(row.revenue)}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-3 md:px-4 py-3.5 text-right font-mono-numbers font-medium text-[#4a3d3d]">
                        {formatBRL(row.avgTicket)}
                      </td>
                      <td className="hidden md:table-cell px-3 md:px-4 py-3.5 text-right font-mono-numbers font-medium text-[#4a3d3d]">
                        {row.contactsCount}
                      </td>
                      <td className="px-3 md:px-4 py-3.5 text-center">
                        {(() => {
                          const t = TIER_CONFIG[row.tier] || TIER_CONFIG[1];
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${t.className}`}>
                              <MaterialIcon icon={t.icon} size={12} />
                              {t.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
