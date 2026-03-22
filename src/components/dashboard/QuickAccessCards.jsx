import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickAccessCards({ lowStockCount, pendingActionsCount }) {
  const navigate = useNavigate();

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

      {/* Meus Clientes Card */}
      <div
        className="bg-white p-5 rounded-xl shadow-sm border border-[#cac0c0]/10 flex flex-col justify-between cursor-pointer group"
        onClick={() => navigate(createPageUrl("MyContacts"))}
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#ffdad6] flex items-center justify-center">
              <MaterialIcon icon="group" filled size={20} className="text-[#b91c1c]" />
            </div>
            {pendingActionsCount > 0 && (
              <span className="bg-[#b91c1c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingActionsCount}
              </span>
            )}
          </div>
          <h3 className="font-bold text-[#1d1b1b] text-sm mb-1">Meus Clientes</h3>
          <p className="text-xs text-[#4a3d3d] mb-4">
            {pendingActionsCount > 0
              ? `${pendingActionsCount} ${pendingActionsCount === 1 ? "ação pendente" : "ações pendentes"}`
              : "Nenhuma ação pendente"}
          </p>
        </div>
        <span className="text-xs font-bold text-[#b91c1c] flex items-center gap-1">
          Ver clientes
          <MaterialIcon icon="chevron_right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </section>
  );
}
