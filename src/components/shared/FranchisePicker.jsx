import React from "react";
import { useAuth } from "@/lib/AuthContext";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Mostrado quando o usuário gerencia 2+ unidades e nenhuma está selecionada.
 *
 * Antes as telas caíam na "primeira da lista" nesse caso — e abriam a unidade
 * errada em silêncio (bug 05/08/2026, Araras × Limeira). Perguntar é melhor que
 * adivinhar: aqui ele escolhe e a escolha vale para o app inteiro (mesmo estado
 * do seletor do topo).
 */
export default function FranchisePicker({ franchises = [], title = "Selecione a unidade" }) {
  const { setSelectedFranchise } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <MaterialIcon icon="storefront" size={48} className="text-[#cac0c0] mb-4" />
      <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">{title}</h3>
      <p className="text-sm text-[#4a3d3d] max-w-sm mb-6">
        Você gerencia mais de uma unidade. Escolha qual quer ver — dá para trocar
        a qualquer momento no seletor do topo.
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center w-full max-w-md">
        {franchises.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFranchise(f)}
            className="flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-white border-2 border-[#b91c1c]/20 text-[#b91c1c] font-bold text-sm hover:border-[#b91c1c] active:scale-[0.98] transition-all"
          >
            <MaterialIcon icon="storefront" size={18} />
            {f.city || f.name || "Franquia"}
          </button>
        ))}
      </div>
    </div>
  );
}
