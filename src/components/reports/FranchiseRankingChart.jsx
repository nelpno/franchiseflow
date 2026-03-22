import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";

const RANK_COLORS = ['#d4af37', '#9a8c8c', '#cd7f32', '#a80012', '#b91c1c', '#534343', '#7a6b6b', '#291715'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#291715]/10 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-[#1b1c1d] mb-1">{d.name}</p>
      <p className="text-[#534343]">Faturamento: <span className="font-semibold text-[#1b1c1d]">{formatBRL(d.revenue)}</span></p>
      <p className="text-[#534343]">Vendas: <span className="font-semibold text-[#1b1c1d]">{d.salesCount}</span></p>
    </div>
  );
};

export default function FranchiseRankingChart({ sales, franchises, isLoading }) {
  const getData = () => {
    return franchises.map(f => {
      const fSales = sales.filter(s => s.franchise_id === f.evolution_instance_id);
      const revenue = fSales.reduce((sum, s) => sum + (s.value || 0), 0);
      return {
        name: f.city,
        revenue,
        salesCount: fSales.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  };

  const data = getData();
  const hasData = data.some(d => d.revenue > 0);

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold font-plus-jakarta text-[#1b1c1d]">
          <MaterialIcon icon="emoji_events" size={20} className="text-[#d4af37]" />
          Ranking de Franquias
        </CardTitle>
        <p className="text-xs text-[#7a6b6b]">Faturamento por unidade no período</p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-slate-300" />
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full text-[#7a6b6b]">
              <MaterialIcon icon="leaderboard_off" size={48} className="mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma venda no período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  stroke="#9a8c8c"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#9a8c8c"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f0f0' }} />
                <Bar dataKey="revenue" radius={[0, 8, 8, 0]} barSize={28}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={RANK_COLORS[i] || RANK_COLORS[RANK_COLORS.length - 1]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
