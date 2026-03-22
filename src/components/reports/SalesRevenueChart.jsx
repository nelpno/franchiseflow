import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, eachDayOfInterval } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#291715]/10 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-[#1b1c1d] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-[#534343]">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name === 'faturamento' ? 'Faturamento' : 'Vendas'}:</span>
          <span className="font-semibold text-[#1b1c1d]">
            {entry.name === 'faturamento'
              ? `R$ ${entry.value.toFixed(2).replace('.', ',')}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SalesRevenueChart({ sales, isLoading, startDate, endDate }) {
  const getChartData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySales = sales.filter(s => s.sale_date?.substring(0, 10) === dayStr);
      const totalRevenue = daySales.reduce((sum, s) => sum + (s.value || 0), 0);

      return {
        date: format(day, 'dd/MM'),
        faturamento: totalRevenue,
        vendas: daySales.length,
      };
    });
  };

  const chartData = getChartData();
  const hasData = sales.length > 0;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold font-plus-jakarta text-[#1b1c1d]">
          <MaterialIcon icon="show_chart" size={20} className="text-[#a80012]" />
          Evolução de Vendas
        </CardTitle>
        <p className="text-xs text-[#7a6b6b]">Faturamento diário no período</p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-slate-300" />
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full text-[#7a6b6b]">
              <MaterialIcon icon="bar_chart_off" size={48} className="mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma venda no período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b91c1c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#b91c1c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9a8c8c"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9a8c8c"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="#b91c1c"
                  strokeWidth={2.5}
                  fill="url(#colorRevenue)"
                  name="faturamento"
                  dot={false}
                  activeDot={{ r: 5, fill: '#b91c1c', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
