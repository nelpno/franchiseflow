import React, { useState, useMemo, useCallback } from "react";
import { Sale, Contact } from "@/entities/all";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format, subDays, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PRESETS = [
  {
    key: "week",
    label: "Esta semana vs anterior",
    getPeriods: () => {
      const now = new Date();
      return {
        period1: {
          start: format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "yyyy-MM-dd"),
          end: format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "yyyy-MM-dd"),
          label: "Semana passada",
        },
        period2: {
          start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
          label: "Esta semana",
        },
      };
    },
  },
  {
    key: "month",
    label: "Este mes vs anterior",
    getPeriods: () => {
      const now = new Date();
      const prevMonth = subMonths(now, 1);
      return {
        period1: {
          start: format(startOfMonth(prevMonth), "yyyy-MM-dd"),
          end: format(endOfMonth(prevMonth), "yyyy-MM-dd"),
          label: format(prevMonth, "MMMM", { locale: ptBR }),
        },
        period2: {
          start: format(startOfMonth(now), "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
          label: format(now, "MMMM", { locale: ptBR }),
        },
      };
    },
  },
];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function DeltaBadge({ current, previous, isInverted = false }) {
  if (previous === 0 && current === 0) return null;
  const delta = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const improved = isInverted ? delta < 0 : delta > 0;
  const color = improved ? "text-[#16a34a]" : "text-[#b91c1c]";
  const bg = improved ? "bg-[#16a34a]/10" : "bg-[#b91c1c]/10";
  const icon = delta > 0 ? "trending_up" : delta < 0 ? "trending_down" : "trending_flat";

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${color} ${bg}`}>
      <MaterialIcon icon={icon} size={12} />
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

export default function PeriodComparisonCard({ franchiseId }) {
  const [activePreset, setActivePreset] = useState("week");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const loadComparison = useCallback(async (presetKey) => {
    if (!franchiseId) return;
    const preset = PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;

    setLoading(true);
    try {
      const { period1, period2 } = preset.getPeriods();

      // Fetch sales for both periods
      const allSales = await Sale.list("-sale_date");
      const sales1 = allSales.filter(
        (s) =>
          s.franchise_id === franchiseId &&
          s.sale_date >= period1.start &&
          s.sale_date <= period1.end
      );
      const sales2 = allSales.filter(
        (s) =>
          s.franchise_id === franchiseId &&
          s.sale_date >= period2.start &&
          s.sale_date <= period2.end
      );

      // Fetch contacts
      const allContacts = await Contact.filter({ franchise_id: franchiseId });
      const contacts1 = allContacts.filter(
        (c) =>
          c.created_at &&
          c.created_at.slice(0, 10) >= period1.start &&
          c.created_at.slice(0, 10) <= period1.end
      );
      const contacts2 = allContacts.filter(
        (c) =>
          c.created_at &&
          c.created_at.slice(0, 10) >= period2.start &&
          c.created_at.slice(0, 10) <= period2.end
      );

      const revenue1 = sales1.reduce((s, sale) => s + (parseFloat(sale.value) || 0), 0);
      const revenue2 = sales2.reduce((s, sale) => s + (parseFloat(sale.value) || 0), 0);
      const avg1 = sales1.length > 0 ? revenue1 / sales1.length : 0;
      const avg2 = sales2.length > 0 ? revenue2 / sales2.length : 0;

      setData({
        period1Label: period1.label,
        period2Label: period2.label,
        metrics: [
          {
            label: "Vendas",
            icon: "receipt_long",
            period1: sales1.length,
            period2: sales2.length,
            format: (v) => v.toString(),
          },
          {
            label: "Faturamento",
            icon: "payments",
            period1: revenue1,
            period2: revenue2,
            format: formatBRL,
          },
          {
            label: "Valor Medio",
            icon: "avg_pace",
            period1: avg1,
            period2: avg2,
            format: formatBRL,
          },
          {
            label: "Contatos novos",
            icon: "person_add",
            period1: contacts1.length,
            period2: contacts2.length,
            format: (v) => v.toString(),
          },
        ],
      });
    } catch (err) {
      console.error("Erro ao comparar periodos:", err);
      toast.error("Erro ao carregar comparacao");
    } finally {
      setLoading(false);
    }
  }, [franchiseId]);

  // Auto-load on mount when expanded by default
  React.useEffect(() => {
    if (expanded && !data && franchiseId) {
      loadComparison(activePreset);
    }
  }, [franchiseId]);

  const handlePresetChange = (key) => {
    setActivePreset(key);
    loadComparison(key);
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !data) {
      loadComparison(activePreset);
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm font-bold font-plus-jakarta text-[#1b1c1d] hover:text-[#b91c1c] transition-colors mb-3"
      >
        <MaterialIcon icon="compare_arrows" size={18} className="text-[#d4af37]" />
        Comparar Periodos
        <MaterialIcon
          icon={expanded ? "expand_less" : "expand_more"}
          size={18}
          className="text-[#534343]"
        />
      </button>

      {expanded && (
        <div className="bg-white rounded-2xl border border-[#291715]/5 shadow-sm p-4 space-y-4">
          {/* Preset buttons */}
          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetChange(preset.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  activePreset === preset.key
                    ? "bg-[#b91c1c] text-white"
                    : "bg-[#e9e8e9] text-[#534343] hover:bg-[#e9e8e9]/80"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#b91c1c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* Period labels */}
              <div className="flex items-center justify-between text-xs text-[#534343] px-1">
                <span className="font-medium capitalize">{data.period1Label}</span>
                <MaterialIcon icon="arrow_forward" size={14} />
                <span className="font-bold text-[#1b1c1d] capitalize">{data.period2Label}</span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                {data.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="bg-[#fbf9fa] rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-[#534343]">
                      <MaterialIcon icon={metric.icon} size={14} />
                      <span className="text-[11px] font-medium">{metric.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-[#1b1c1d] font-mono-numbers">
                        {metric.format(metric.period2)}
                      </span>
                      <DeltaBadge current={metric.period2} previous={metric.period1} />
                    </div>
                    <p className="text-[10px] text-[#534343]/60 font-mono-numbers">
                      antes: {metric.format(metric.period1)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-sm text-[#534343]">
              Selecione um periodo para comparar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
