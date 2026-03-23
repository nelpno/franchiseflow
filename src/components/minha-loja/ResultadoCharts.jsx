import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format, subMonths, parseISO, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";

function isInMonth(dateStr, monthDate) {
  if (!dateStr) return false;
  const d = parseISO(dateStr.substring(0, 10));
  return isSameMonth(d, monthDate);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white p-3 rounded-xl shadow-lg border border-[#291715]/10 text-xs">
      <p className="font-medium text-[#1b1c1d] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-mono-numbers">
          {entry.name}: {formatBRL(entry.value)}
        </p>
      ))}
    </div>
  );
}

function MarginTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white p-3 rounded-xl shadow-lg border border-[#291715]/10 text-xs">
      <p className="font-medium text-[#1b1c1d] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-mono-numbers">
          {entry.name}: {entry.dataKey === "margin" ? `${entry.value.toFixed(1)}%` : formatBRL(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function ResultadoCharts({ sales, expenses, saleItems }) {
  const [showCharts, setShowCharts] = useState(true);

  // Build 6-month data
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const label = format(monthDate, "MMM yy", { locale: ptBR });

      const monthSales = sales.filter((s) => {
        const dateStr = s.sale_date || s.created_at;
        return isInMonth(dateStr, monthDate);
      });

      const monthSaleIds = new Set(monthSales.map((s) => s.id));

      const monthItems = saleItems.filter((si) => monthSaleIds.has(si.sale_id));

      const revenue = monthSales.reduce(
        (sum, s) => sum + (parseFloat(s.value) || 0),
        0
      );

      const costProducts = monthItems.reduce(
        (sum, si) =>
          sum +
          (parseFloat(si.quantity) || 0) * (parseFloat(si.cost_price) || 0),
        0
      );

      const cardFees = monthSales.reduce(
        (sum, s) => sum + (parseFloat(s.card_fee_amount) || 0),
        0
      );

      const deliveryFees = monthSales.reduce(
        (sum, s) => sum + (parseFloat(s.delivery_fee) || 0),
        0
      );

      const monthExpenses = expenses.filter((e) => {
        const dateStr = e.expense_date || e.created_at;
        return isInMonth(dateStr, monthDate);
      });

      const otherExpenses = monthExpenses.reduce(
        (sum, e) => sum + (parseFloat(e.amount) || 0),
        0
      );

      const totalExpenses = costProducts + cardFees + deliveryFees + otherExpenses;
      const profit = revenue - totalExpenses;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      months.push({
        label,
        revenue,
        totalExpenses,
        profit,
        margin,
      });
    }

    return months;
  }, [sales, expenses, saleItems]);

  // Check if there's enough data (at least 2 months with revenue)
  const monthsWithData = monthlyData.filter((m) => m.revenue > 0).length;
  const hasEnoughData = monthsWithData >= 2;

  if (!hasEnoughData) {
    return (
      <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Evolucao
            </h3>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MaterialIcon
              icon="show_chart"
              size={48}
              className="text-[#cac0c0] mb-3"
            />
            <p className="text-sm text-[#4a3d3d]">
              Dados insuficientes para graficos
            </p>
            <p className="text-xs text-[#4a3d3d]/70 mt-1">
              Lance vendas em pelo menos 2 meses diferentes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
            Evolucao
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCharts(!showCharts)}
            className="gap-1.5 text-[#4a3d3d] hover:text-[#b91c1c] text-xs rounded-xl"
          >
            <MaterialIcon
              icon={showCharts ? "visibility_off" : "visibility"}
              size={16}
            />
            {showCharts ? "Esconder" : "Mostrar"}
          </Button>
        </div>

        {showCharts && (
          <div className="space-y-6">
            {/* Area Chart — Faturamento mensal */}
            <div>
              <p className="text-xs font-medium text-[#4a3d3d] mb-2">
                Faturamento Mensal
              </p>
              <div className="h-48 md:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="gradRevenue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#b91c1c"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#b91c1c"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#291715"
                      strokeOpacity={0.06}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#4a3d3d" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatBRLCompact}
                      tick={{ fontSize: 10, fill: "#4a3d3d" }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Faturamento"
                      stroke="#b91c1c"
                      strokeWidth={2}
                      fill="url(#gradRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Composed Chart — Receita vs Despesas + Margem */}
            <div>
              <p className="text-xs font-medium text-[#4a3d3d] mb-2">
                Receita vs Despesas + Margem
              </p>
              <div className="h-48 md:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#291715"
                      strokeOpacity={0.06}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#4a3d3d" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={formatBRLCompact}
                      tick={{ fontSize: 10, fill: "#4a3d3d" }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      tick={{ fontSize: 10, fill: "#d4af37" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<MarginTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      name="Receita"
                      fill="#b91c1c"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="totalExpenses"
                      name="Despesas"
                      fill="#4a3d3d"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                      opacity={0.6}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="margin"
                      name="Margem"
                      stroke="#d4af37"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#d4af37" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
