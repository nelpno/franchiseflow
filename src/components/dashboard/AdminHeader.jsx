import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export default function AdminHeader({ period, onPeriodChange }) {
  return (
    <header className="hidden md:flex fixed top-0 right-0 z-50 h-20 items-center justify-between px-8 bg-[#fdf3f2]/80 backdrop-blur-xl shadow-sm shadow-[#291715]/5" style={{ width: "calc(100% - 16rem)" }}>
      <div className="flex flex-col">
        <h2 className="text-2xl font-bold tracking-tight text-[#291715] font-plus-jakarta">
          Painel Geral
        </h2>
        <div className="flex items-center gap-4 mt-1">
          <a
            href="#"
            className="text-sm font-semibold text-[#a80012] border-b-2 border-[#775a19] pb-1 font-plus-jakarta"
          >
            Dashboard
          </a>
          <a
            href="#"
            className="text-sm text-[#291715]/70 hover:text-[#a80012] transition-colors font-plus-jakarta"
          >
            Relatórios
          </a>
          <a
            href="#"
            className="text-sm text-[#291715]/70 hover:text-[#a80012] transition-colors font-plus-jakarta"
          >
            Configurações
          </a>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Period Toggle */}
        <div className="flex bg-[#291715]/5 p-1 rounded-xl">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-4 py-1.5 text-sm font-plus-jakarta transition-all active:scale-95 ${
                period === p.value
                  ? "font-bold text-white bg-[#a80012] rounded-lg shadow-sm"
                  : "font-medium text-[#291715]/70 hover:text-[#a80012]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-[#291715]/70 hover:bg-[#a80012]/5 rounded-lg transition-all active:scale-90">
            <MaterialIcon icon="notifications" size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#291715]/10 overflow-hidden border-2 border-white shadow-sm ml-2 flex items-center justify-center">
            <MaterialIcon icon="account_circle" size={24} className="text-[#291715]/60" />
          </div>
        </div>
      </div>
    </header>
  );
}
