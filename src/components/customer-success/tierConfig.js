// Config compartilhada de tiers/severidade do Cockpit de Customer Success
export const TIER = {
  critical: { label: "Crítico", dot: "🔴", chip: "bg-red-50 text-red-700 border-red-200", rank: 0 },
  attention: { label: "Atenção", dot: "🟡", chip: "bg-amber-50 text-amber-700 border-amber-200", rank: 1 },
  standout: { label: "Destaque", dot: "🏆", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", rank: 2 },
  healthy: { label: "Saudável", dot: "🟢", chip: "bg-green-50 text-green-700 border-green-200", rank: 3 },
  dormant: { label: "Dormente", dot: "⚪", chip: "bg-gray-50 text-gray-600 border-gray-200", rank: 4 },
};

export const SEV = {
  high: "bg-red-100 text-red-700",
  med: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};
