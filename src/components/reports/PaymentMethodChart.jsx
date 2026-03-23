import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";

const PAYMENT_COLORS = {
  pix: { color: '#10b981', label: 'PIX' },
  cash: { color: '#3b82f6', label: 'Dinheiro' },
  card_machine: { color: '#f97316', label: 'Máquina de Cartão' },
  payment_link: { color: '#6366f1', label: 'Link de Pagamento' },
  other: { color: '#9a8c8c', label: 'Outros' },
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div className="bg-white border border-[#291715]/10 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-[#1b1c1d]">{name}</p>
      <p className="text-[#4a3d3d]">
        {formatBRL(value)} ({(percent * 100).toFixed(1)}%)
      </p>
    </div>
  );
};

export default function PaymentMethodChart({ sales, isLoading }) {
  const getData = () => {
    const groups = {};
    sales.forEach(sale => {
      const method = sale.payment_method || 'other';
      if (!groups[method]) groups[method] = 0;
      groups[method] += sale.value || 0;
    });

    const total = Object.values(groups).reduce((a, b) => a + b, 0);

    return Object.entries(groups).map(([key, value]) => ({
      name: PAYMENT_COLORS[key]?.label || key,
      value,
      color: PAYMENT_COLORS[key]?.color || PAYMENT_COLORS.other.color,
      percent: total > 0 ? value / total : 0,
    })).sort((a, b) => b.value - a.value);
  };

  const data = getData();
  const hasData = data.length > 0;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold font-plus-jakarta text-[#1b1c1d]">
          <MaterialIcon icon="credit_card" size={20} className="text-[#a80012]" />
          Método de Pagamento
        </CardTitle>
        <p className="text-xs text-[#7a6b6b]">Distribuição por forma de pagamento</p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-slate-300" />
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full text-[#7a6b6b]">
              <MaterialIcon icon="pie_chart_off" size={48} className="mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma venda no período</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4 h-full">
              <div className="flex-1 w-full h-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 min-w-[140px]">
                {data.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[#4a3d3d] truncate">{entry.name}</span>
                    <span className="font-semibold text-[#1b1c1d] ml-auto font-mono-numbers text-xs">
                      {(entry.percent * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
