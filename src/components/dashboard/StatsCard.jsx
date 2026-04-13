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

    let percentageChange = 0;
    if (previousValue > 0) {
      percentageChange = ((numericValue - previousValue) / previousValue) * 100;
    } else if (numericValue > 0 && previousValue === 0) {
      percentageChange = 100;
    }

    const isUp = trend === 'up';
    return (
      <span className={`text-xs font-bold flex items-center gap-0.5 ${
        isUp ? 'text-[#16a34a]' : 'text-[#dc2626]'
      }`}>
        <MaterialIcon icon={isUp ? "arrow_upward" : "arrow_downward"} size={14} />
        {isUp ? '+' : ''}{Math.abs(percentageChange).toFixed(0)}%
      </span>
    );
  };

  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href, "aria-label": `Ver detalhes de ${title}` } : {};
  const baseClasses = "bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-[#cac0c0]/10";
  const clickClasses = href ? " cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" : "";

  return (
    <Wrapper {...wrapperProps} className={baseClasses + clickClasses}>
      <p className="text-xs text-[#4a3d3d] font-medium mb-1 truncate">{title}</p>
      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
        <span className="text-base sm:text-2xl font-extrabold tracking-tight text-[#1d1b1b]">
          {value}
        </span>
        {getTrendDisplay()}
      </div>
    </Wrapper>
  );
}

export default React.memo(StatsCard);
