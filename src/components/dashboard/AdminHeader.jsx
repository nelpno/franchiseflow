
const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export default function AdminHeader({ period, onPeriodChange }) {
  return (
    <header className="flex flex-row md:fixed md:top-0 md:right-0 md:z-50 md:h-20 items-center justify-between px-4 md:px-8 py-3 md:py-0 bg-[#fdf3f2]/80 backdrop-blur-xl shadow-sm shadow-[#291715]/5 rounded-2xl md:rounded-none mb-4 md:mb-0" style={{ width: "auto" }}>
      <h2 className="hidden md:block text-2xl font-bold tracking-tight text-[#1b1c1d] font-plus-jakarta">
        Painel Geral
      </h2>

      <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
        {/* Period Toggle */}
        <div className="flex bg-[#291715]/5 p-1 rounded-xl flex-1 md:flex-none">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3 md:px-4 py-2 text-sm font-plus-jakarta transition-all active:scale-95 flex-1 md:flex-none ${
                period === p.value
                  ? "font-bold text-white bg-[#a80012] rounded-lg shadow-sm"
                  : "font-medium text-[#1b1c1d]/70 hover:text-[#a80012]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
