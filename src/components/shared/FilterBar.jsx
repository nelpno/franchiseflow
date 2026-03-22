import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * FilterBar — Barra de filtros reutilizavel
 *
 * Props:
 * - searchValue: string
 * - onSearchChange: (value) => void
 * - searchPlaceholder: string
 * - filters: Array<{ key, label, options: Array<{ value, label }>, value, onChange }>
 * - sortOptions: Array<{ value, label }> (optional)
 * - sortValue: string (optional)
 * - onSortChange: (value) => void (optional)
 * - className: string (optional)
 */
export default function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters = [],
  sortOptions,
  sortValue,
  onSortChange,
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);

  const hasFilters = filters.length > 0 || (sortOptions && sortOptions.length > 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search + mobile toggle row */}
      <div className="flex gap-2">
        {onSearchChange && (
          <div className="relative flex-1">
            <MaterialIcon
              icon="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a3d3d]/50"
            />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-[#e9e8e9] border-none rounded-xl h-10"
            />
          </div>
        )}

        {/* Mobile filter toggle */}
        {hasFilters && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="sm:hidden flex items-center gap-1 px-3 py-2 bg-white border border-[#291715]/10 rounded-xl text-sm text-[#534343] hover:bg-[#fbf9fa] shrink-0"
          >
            <MaterialIcon icon="tune" size={18} />
            Filtros
            {expanded ? (
              <MaterialIcon icon="expand_less" size={16} />
            ) : (
              <MaterialIcon icon="expand_more" size={16} />
            )}
          </button>
        )}
      </div>

      {/* Filter selects — always visible on desktop, collapsible on mobile */}
      {hasFilters && (
        <div
          className={`flex-col sm:flex sm:flex-row gap-2 ${
            expanded ? "flex" : "hidden sm:flex"
          }`}
        >
          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={filter.value}
              onValueChange={filter.onChange}
            >
              <SelectTrigger className="w-full sm:w-[180px] bg-white border-[#cac0c0]/30 rounded-xl h-10 text-sm">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {sortOptions && sortOptions.length > 0 && (
            <Select value={sortValue || ""} onValueChange={onSortChange}>
              <SelectTrigger className="w-full sm:w-[180px] bg-white border-[#cac0c0]/30 rounded-xl h-10 text-sm">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
