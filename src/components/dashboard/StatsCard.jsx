import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

function StatsCard({ title, value, rawValue, previousValue, icon: Icon, trend, color, isValue = false, href }) {
  const numericValue = rawValue != null ? rawValue
    : typeof value === 'string'
      ? parseFloat(value.replace(/[^0-9,.-]+/g, "").replace(",", "."))
      : value;

  const getTrendDisplay = () => {
    if (!trend) return null;

    // Sem base nao existe porcentagem. A versao anterior inventava "+100%" quando o
    // periodo anterior era ZERO — e isso e o caso NORMAL, nao a excecao: nos ultimos
    // 90 dias, 828 dos 3.169 dias com venda (26,1%), em 65 das 67 unidades, vinham de
    // um dia sem venda nenhuma (segunda contra domingo fechado). O card dizia "+100%"
    // toda segunda. Sem base, nao dizemos nada — que e o que o card do admin ja fazia
    // e o que o CLAUDE.md ja descrevia. Auditoria 08/09/2026.
    if (previousValue == null || previousValue <= 0) return null;

    const percentageChange = ((numericValue - previousValue) / previousValue) * 100;
    if (!Number.isFinite(percentageChange)) return null;

    const isUp = trend === 'up';
    return (
      <span className={`text-xs font-bold flex items-center gap-0.5 ${
        isUp ? 'text-ok-ink' : 'text-err'
      }`}>
        <MaterialIcon icon={isUp ? "arrow_upward" : "arrow_downward"} size={14} />
        {isUp ? '+' : ''}{Math.abs(percentageChange).toFixed(0)}%
      </span>
    );
  };

  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href, "aria-label": `Ver detalhes de ${title}` } : {};
  const baseClasses = "bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-ink-4/10";
  const clickClasses = href ? " cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" : "";

  return (
    <Wrapper {...wrapperProps} className={baseClasses + clickClasses}>
      <p className="text-xs text-ink-2 font-medium mb-1 truncate">{title}</p>
      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
        <span className="text-base sm:text-2xl font-extrabold tracking-tight text-ink">
          {value}
        </span>
        {getTrendDisplay()}
      </div>
    </Wrapper>
  );
}

export default React.memo(StatsCard);
