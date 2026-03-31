import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FranchiseFinanceDrilldown from "./FranchiseFinanceDrilldown";
import { formatBRLCompact } from "@/lib/formatBRL";

function MarginBadge({ margem }) {
  let colorClass = "bg-green-100 text-green-700";
  if (margem < 20) {
    colorClass = "bg-red-100 text-red-700";
  } else if (margem < 40) {
    colorClass = "bg-[#d4af37]/10 text-[#775a19]";
  }
  return (
    <span className={`${colorClass} rounded-full px-2 py-0.5 text-xs font-bold`}>
      {margem.toFixed(1)}%
    </span>
  );
}

const SORT_OPTIONS = [
  { key: "margem", label: "Margem", icon: "percent" },
  { key: "lucro", label: "Lucro", icon: "trending_up" },
  { key: "faturamento", label: "Faturamento", icon: "payments" },
  { key: "name", label: "Nome", icon: "sort_by_alpha" },
];

export default function FranchiseFinanceTable({
  franchiseData,
  inventoryByFranchise,
  saleItemsByFranchise,
}) {
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("margem");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...franchiseData];

    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (f) =>
          f.name?.toLowerCase().includes(q) ||
          f.city?.toLowerCase().includes(q) ||
          f.ownerName?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case "margem":
          va = a.pnl.margem;
          vb = b.pnl.margem;
          break;
        case "lucro":
          va = a.pnl.lucro;
          vb = b.pnl.lucro;
          break;
        case "faturamento":
          va = a.pnl.totalRecebido;
          vb = b.pnl.totalRecebido;
          break;
        case "name":
          return sortAsc
            ? (a.name || "").localeCompare(b.name || "", "pt-BR")
            : (b.name || "").localeCompare(a.name || "", "pt-BR");
        default:
          va = a.pnl.margem;
          vb = b.pnl.margem;
      }
      return sortAsc ? va - vb : vb - va;
    });

    return list;
  }, [franchiseData, searchText, sortBy, sortAsc]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(key);
      setSortAsc(key === "margem"); // margem default asc (pior primeiro)
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <MaterialIcon
            icon="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6d6d]"
          />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar franquia..."
            className="pl-10 bg-[#e9e8e9] border-none rounded-xl"
          />
        </div>
        <div className="flex gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              variant="ghost"
              size="sm"
              onClick={() => handleSort(opt.key)}
              className={`h-9 px-2.5 rounded-xl text-xs gap-1 ${
                sortBy === opt.key
                  ? "bg-[#b91c1c]/10 text-[#b91c1c] font-semibold"
                  : "text-[#4a3d3d] hover:bg-[#b91c1c]/5"
              }`}
            >
              <MaterialIcon icon={opt.icon} size={14} />
              <span className="hidden sm:inline">{opt.label}</span>
              {sortBy === opt.key && (
                <MaterialIcon
                  icon={sortAsc ? "arrow_upward" : "arrow_downward"}
                  size={12}
                />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-8 text-center">
            <MaterialIcon icon="search_off" size={32} className="text-[#7a6d6d] mx-auto mb-2" />
            <p className="text-sm text-[#7a6d6d]">Nenhuma franquia encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const isExpanded = expandedId === f.franchiseId;
            return (
              <Card key={f.franchiseId} className="border-none shadow-sm overflow-hidden">
                <CardContent
                  className="p-0 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : f.franchiseId)}
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 px-4 py-3 hover:bg-[#fbf9fa] transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#1b1c1d] truncate">{f.name}</p>
                      <p className="text-xs text-[#7a6d6d] truncate">{f.city} &middot; {f.ownerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7a6d6d]">Vendas</p>
                      <p className="text-sm font-medium text-[#1b1c1d]">{f.pnl.salesCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7a6d6d]">Faturamento</p>
                      <p className="text-sm font-medium text-[#1b1c1d]">{formatBRLCompact(f.pnl.totalRecebido)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7a6d6d]">Custos</p>
                      <p className="text-sm font-medium text-[#4a3d3d]">
                        {formatBRLCompact(f.pnl.custoProdutos + f.pnl.taxasCartao + f.pnl.outrasDespesas)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7a6d6d]">Lucro</p>
                      <p className={`text-sm font-bold ${f.pnl.lucro >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                        {formatBRLCompact(f.pnl.lucro)}
                      </p>
                    </div>
                    <div className="text-right">
                      <MarginBadge margem={f.pnl.margem} />
                    </div>
                    <MaterialIcon
                      icon={isExpanded ? "expand_less" : "expand_more"}
                      size={20}
                      className="text-[#7a6d6d]"
                    />
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3 active:bg-[#fbf9fa]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-[#1b1c1d] truncate">{f.name}</p>
                        <p className="text-xs text-[#7a6d6d]">{f.city}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MarginBadge margem={f.pnl.margem} />
                        <MaterialIcon
                          icon={isExpanded ? "expand_less" : "expand_more"}
                          size={20}
                          className="text-[#7a6d6d]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-[#7a6d6d]">Faturamento</p>
                        <p className="text-xs font-medium text-[#1b1c1d]">{formatBRLCompact(f.pnl.totalRecebido)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#7a6d6d]">Custos</p>
                        <p className="text-xs font-medium text-[#4a3d3d]">
                          {formatBRLCompact(f.pnl.custoProdutos + f.pnl.taxasCartao + f.pnl.outrasDespesas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#7a6d6d]">Lucro</p>
                        <p className={`text-xs font-bold ${f.pnl.lucro >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                          {formatBRLCompact(f.pnl.lucro)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Drill-down */}
                {isExpanded && (
                  <FranchiseFinanceDrilldown
                    franchiseData={f}
                    inventoryItems={inventoryByFranchise[f.franchiseId] || []}
                    saleItems={saleItemsByFranchise[f.franchiseId] || []}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
