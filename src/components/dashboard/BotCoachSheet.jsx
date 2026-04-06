import React, { useState, useEffect, useRef, useCallback } from "react";
import { BotReport } from "@/entities/all";
import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const TIER_CONFIG = {
  beginner: { label: "Iniciante", color: "#d97706", bg: "#d97706" },
  intermediate: { label: "Intermediário", color: "#2563eb", bg: "#2563eb" },
  advanced: { label: "Avançado", color: "#16a34a", bg: "#16a34a" },
};

const PRIORITY_CONFIG = {
  high: { icon: "priority_high", color: "#dc2626" },
  medium: { icon: "drag_handle", color: "#d97706" },
  low: { icon: "arrow_downward", color: "#7a6d6d" },
};

function TierBadge({ tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.beginner;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

export default function BotCoachSheet({ franchiseId, isOpen, onClose }) {
  const mountedRef = useRef(true);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!franchiseId) return;
    setLoading(true);
    try {
      const data = await BotReport.filter(
        { franchise_id: franchiseId },
        "-report_period_end",
        6
      );
      if (mountedRef.current) {
        setReports(data || []);
      }
    } catch (err) {
      console.warn("BotCoachSheet: erro ao carregar relatórios:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      load();
    }
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
  }, [isOpen, load]);

  const latest = reports[0] || null;
  const autonomyRate = parseFloat(latest?.autonomy_rate) || 0;
  const autonomyTarget = parseFloat(latest?.autonomy_target) || 0;
  const progressPct = autonomyTarget > 0 ? Math.min((autonomyRate / autonomyTarget) * 100, 100) : 0;

  // Chart data — oldest first
  const chartData = [...reports].reverse().map((r) => {
    const endDate = r.report_period_end ? parseISO(r.report_period_end) : null;
    return {
      date: endDate ? format(endDate, "dd/MM") : "—",
      autonomy: parseFloat(r.autonomy_rate) || 0,
      target: parseFloat(r.autonomy_target) || 0,
    };
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 font-plus-jakarta">
            <div className="p-1.5 rounded-lg bg-[#b91c1c]/10">
              <MaterialIcon icon="school" size={20} className="text-[#b91c1c]" />
            </div>
            <span>Seu Coach Quinzenal</span>
            {latest?.profile_tier && (
              <TierBadge tier={latest.profile_tier} />
            )}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#b91c1c] border-t-transparent" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-12">
            <MaterialIcon icon="hourglass_empty" size={40} className="text-[#e9e8e9] mx-auto mb-3" />
            <p className="text-sm text-[#7a6d6d]">Aguardando primeiro relatório</p>
            <p className="text-xs text-[#7a6d6d] mt-1">Os relatórios são gerados quinzenalmente.</p>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="space-y-6 pb-6">
            {/* Evolution chart */}
            {chartData.length > 1 && (
              <div>
                <h3 className="text-xs font-semibold text-[#4a3d3d] mb-3 flex items-center gap-1.5">
                  <MaterialIcon icon="show_chart" size={16} className="text-[#7a6d6d]" />
                  Evolução da Autonomia
                </h3>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9e8e9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#7a6d6d" }}
                        axisLine={{ stroke: "#e9e8e9" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#7a6d6d" }}
                        axisLine={{ stroke: "#e9e8e9" }}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Autonomia"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      {autonomyTarget > 0 && (
                        <ReferenceLine
                          y={autonomyTarget}
                          stroke="#d4af37"
                          strokeDasharray="6 3"
                          label={{ value: "Meta", fontSize: 10, fill: "#775a19", position: "right" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="autonomy"
                        stroke="#b91c1c"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#b91c1c" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Target progress bar */}
            {autonomyTarget > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-semibold text-[#4a3d3d] flex items-center gap-1.5">
                    <MaterialIcon icon="flag" size={16} className="text-[#7a6d6d]" />
                    Meta de Autonomia
                  </h3>
                  <span className="text-xs font-medium text-[#4a3d3d]">
                    {autonomyRate}% / {autonomyTarget}%
                  </span>
                </div>
                <div className="w-full h-3 bg-[#e9e8e9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: progressPct >= 100 ? "#16a34a" : "#b91c1c",
                    }}
                  />
                </div>
                {progressPct >= 100 && (
                  <p className="text-[10px] text-[#16a34a] font-medium mt-1 flex items-center gap-0.5">
                    <MaterialIcon icon="check_circle" size={12} />
                    Meta atingida!
                  </p>
                )}
              </div>
            )}

            {/* Latest report text */}
            {latest?.report_text && (
              <div>
                <h3 className="text-xs font-semibold text-[#4a3d3d] mb-2 flex items-center gap-1.5">
                  <MaterialIcon icon="description" size={16} className="text-[#7a6d6d]" />
                  Análise do Coach
                </h3>
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-xs text-[#4a3d3d] leading-relaxed whitespace-pre-line">
                    {latest.report_text}
                  </p>
                </div>
              </div>
            )}

            {/* Action items */}
            {latest?.action_items && Array.isArray(latest.action_items) && latest.action_items.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#4a3d3d] mb-2 flex items-center gap-1.5">
                  <MaterialIcon icon="task_alt" size={16} className="text-[#7a6d6d]" />
                  Ações Recomendadas
                </h3>
                <div className="space-y-2">
                  {latest.action_items.map((item, idx) => {
                    const priority = item.priority || "medium";
                    const pcfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-[#fbf9fa] rounded-xl p-3"
                      >
                        <MaterialIcon
                          icon={pcfg.icon}
                          size={16}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: pcfg.color }}
                        />
                        <p className="text-xs text-[#4a3d3d] leading-relaxed">
                          {item.message || item.text || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* History list */}
            {reports.length > 1 && (
              <div>
                <h3 className="text-xs font-semibold text-[#4a3d3d] mb-2 flex items-center gap-1.5">
                  <MaterialIcon icon="history" size={16} className="text-[#7a6d6d]" />
                  Histórico
                </h3>
                <div className="space-y-1.5">
                  {reports.map((r, idx) => {
                    const endDate = r.report_period_end ? parseISO(r.report_period_end) : null;
                    const dateStr = endDate
                      ? format(endDate, "dd MMM yyyy", { locale: ptBR })
                      : "—";
                    const rate = parseFloat(r.autonomy_rate) || 0;
                    return (
                      <div
                        key={r.id || idx}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#fbf9fa]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#4a3d3d]">{dateStr}</span>
                          {r.profile_tier && <TierBadge tier={r.profile_tier} />}
                        </div>
                        <span className="text-xs font-semibold text-[#1b1c1d]">
                          {rate}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
