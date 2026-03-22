import MaterialIcon from "@/components/ui/MaterialIcon";

export default function StatsCard({ title, value, previousValue, icon: Icon, trend, color, isValue = false }) {
  // Extract numeric value from formatted string like "R$ 123.45"
  const numericValue = typeof value === 'string'
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

  return (
    <div className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-[#cac0c0]/10">
      <p className="text-xs text-[#4a3d3d] font-medium mb-1 truncate">{title}</p>
      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
        <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#1d1b1b]">
          {value}
        </span>
        {getTrendDisplay()}
      </div>
    </div>
  );
}
