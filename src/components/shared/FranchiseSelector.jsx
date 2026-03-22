import React from "react";
import { useAuth } from "@/lib/AuthContext";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Dropdown selector for users with multiple franchises.
 * Shows franchise name only (no dropdown) if user has a single franchise.
 */
export default function FranchiseSelector({ franchises }) {
  const { selectedFranchise, setSelectedFranchise } = useAuth();

  if (!franchises || franchises.length === 0) return null;

  // Single franchise — show name only
  if (franchises.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#b91c1c]/5 text-sm font-medium text-[#b91c1c]">
        <MaterialIcon icon="storefront" size={16} />
        <span className="truncate max-w-[160px]">
          {franchises[0].city || franchises[0].name || "Minha Franquia"}
        </span>
      </div>
    );
  }

  // Multiple franchises — dropdown
  const handleChange = (e) => {
    const franchise = franchises.find((f) => f.id === e.target.value);
    if (franchise) {
      setSelectedFranchise(franchise);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#b91c1c]/5">
        <MaterialIcon icon="storefront" size={16} className="text-[#b91c1c] shrink-0" />
        <select
          value={selectedFranchise?.id || ""}
          onChange={handleChange}
          className="bg-transparent text-sm font-medium text-[#b91c1c] border-none outline-none cursor-pointer pr-1 max-w-[160px] truncate appearance-none"
          style={{ WebkitAppearance: "none" }}
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.city || f.name || "Franquia"}
            </option>
          ))}
        </select>
        <MaterialIcon icon="expand_more" size={16} className="text-[#b91c1c] shrink-0 -ml-1" />
      </div>
    </div>
  );
}
