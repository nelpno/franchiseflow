import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickAccessCards({ lowStockCount, checklistDone, checklistTotal }) {
  const navigate = useNavigate();

  // SVG circular progress for checklist
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = checklistTotal > 0 ? checklistDone / checklistTotal : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <section className="grid grid-cols-2 gap-4 mb-6">
      {/* Estoque Card */}
      <div
        className="bg-white p-5 rounded-xl shadow-sm border border-[#cac0c0]/10 flex flex-col justify-between cursor-pointer group"
        onClick={() => navigate("/MinhaLoja?tab=estoque")}
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#fdf4d7] flex items-center justify-center">
              <MaterialIcon icon="package" filled size={20} className="text-[#d4af37]" />
            </div>
            {lowStockCount > 0 && (
              <div className="w-2 h-2 rounded-full bg-[#b91c1c]" />
            )}
          </div>
          <h3 className="font-bold text-[#1d1b1b] text-sm mb-1">Estoque</h3>
          <p className="text-xs text-[#4a3d3d] mb-4">
            {lowStockCount > 0
              ? `${lowStockCount} ${lowStockCount === 1 ? "item baixo" : "itens baixos"}`
              : "Tudo em dia"}
          </p>
        </div>
        <span className="text-xs font-bold text-[#b91c1c] flex items-center gap-1">
          Ver estoque
          <MaterialIcon icon="chevron_right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>

      {/* Checklist Card */}
      <div
        className="bg-white p-5 rounded-xl shadow-sm border border-[#cac0c0]/10 flex flex-col justify-between cursor-pointer group"
        onClick={() => navigate(createPageUrl("MyChecklist"))}
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#ffdad6] flex items-center justify-center">
              <MaterialIcon icon="fact_check" filled size={20} className="text-[#b91c1c]" />
            </div>
            <div className="relative flex items-center justify-center">
              <svg className="w-8 h-8 transform -rotate-90">
                <circle
                  className="text-[#f5f3f4]"
                  cx="16"
                  cy="16"
                  fill="transparent"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <circle
                  className="text-[#b91c1c]"
                  cx="16"
                  cy="16"
                  fill="transparent"
                  r={radius}
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[9px] font-bold text-[#1d1b1b]">
                {checklistDone}/{checklistTotal}
              </span>
            </div>
          </div>
          <h3 className="font-bold text-[#1d1b1b] text-sm mb-1">Checklist</h3>
          <p className="text-xs text-[#4a3d3d] mb-4">
            {checklistDone < checklistTotal ? "Abertura pendente" : "Completo!"}
          </p>
        </div>
        <span className="text-xs font-bold text-[#b91c1c] flex items-center gap-1">
          Abrir checklist
          <MaterialIcon icon="chevron_right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </section>
  );
}
