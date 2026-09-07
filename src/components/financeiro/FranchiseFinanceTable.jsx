import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FranchiseFinanceDrilldown from "./FranchiseFinanceDrilldown";
import { formatBRLInteger } from "@/lib/formatters";

/**
 * Δ% do faturamento contra o mes anterior. O dado (`prevPnl`) SEMPRE existiu — era
 * calculado para as 66 unidades e so aparecia abrindo uma linha por vez, o que fazia
 * "quem caiu?" custar 66 cliques (auditoria 07/09/2026).
 * `prevRecebidoComparavel` ja vem cortado no mesmo dia do mes quando o mes exibido e o
 * corrente; sem isso, todo mes comecaria com a rede inteira "em queda".
 */
export function variacaoFaturamento(f) {
  const anterior = Number(f.prevRecebidoComparavel ?? f.prevPnl?.totalRecebido ?? 0);
  const atual = Number(f.pnl?.totalRecebido ?? 0);
  if (anterior <= 0) return null; // sem base de comparacao: nao inventar percentual
  return ((atual - anterior) / anterior) * 100;
}

function DeltaBadge({ valor }) {
  if (valor === null) return <span className="text-xs text-ink-4">—</span>;
  const caiu = valor < 0;
  const forte = valor <= -10;
  const cor = forte ? "text-err font-bold" : caiu ? "text-[#b45309]" : "text-[#15803d]";
  return (
    <span className={`text-sm ${cor}`}>
      {caiu ? "▼" : "▲"} {Math.abs(valor).toFixed(0)}%
    </span>
  );
}

function MarginBadge({ margem }) {
  let colorClass = "bg-green-100 text-green-700";
  if (margem < 20) {
    colorClass = "bg-red-100 text-red-700";
  } else if (margem < 40) {
    colorClass = "bg-brand-gold/10 text-brand-gold-ink";
  }
  return (
    <span className={`${colorClass} rounded-full px-2 py-0.5 text-xs font-bold`}>
      {margem.toFixed(1)}%
    </span>
  );
}

const SORT_OPTIONS = [
  { key: "queda", label: "Maior queda", icon: "trending_down" },
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
          va = a.pnl.margemCaixa;
          vb = b.pnl.margemCaixa;
          break;
        case "queda": {
          // sem base de comparacao vai para o fim, nao para o topo da "maior queda"
          const da = variacaoFaturamento(a);
          const db = variacaoFaturamento(b);
          va = da === null ? Number.POSITIVE_INFINITY : da;
          vb = db === null ? Number.POSITIVE_INFINITY : db;
          break;
        }
        case "lucro":
          va = a.pnl.lucroCaixa;
          vb = b.pnl.lucroCaixa;
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
          va = a.pnl.margemCaixa;
          vb = b.pnl.margemCaixa;
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
      setSortAsc(key === "margem" || key === "queda"); // pior primeiro
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar franquia..."
            className="pl-10 bg-surface-line border-none rounded-xl"
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
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-ink-2 hover:bg-brand/5"
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
            <MaterialIcon icon="search_off" size={32} className="text-ink-3 mx-auto mb-2" />
            <p className="text-sm text-ink-3">Nenhuma franquia encontrada</p>
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
                  <div className="hidden md:grid md:grid-cols-[2fr_0.8fr_1fr_1fr_1fr_0.9fr_0.8fr_auto] items-center gap-2 px-4 py-3 hover:bg-surface transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink truncate">{f.name}</p>
                      <p className="text-xs text-ink-3 truncate">{f.city} &middot; {f.ownerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-3">Vendas</p>
                      <p className="text-sm font-medium text-ink">{f.pnl.salesCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-3">Faturamento</p>
                      <p className="text-sm font-medium text-ink">{formatBRLInteger(f.pnl.totalRecebido)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-3">Custos</p>
                      <p className="text-sm font-medium text-ink-2">
                        {formatBRLInteger(f.pnl.taxasCartao + f.pnl.outrasDespesas)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-3">Lucro</p>
                      <p className={`text-sm font-bold ${f.pnl.lucroCaixa >= 0 ? "text-ok-ink" : "text-err"}`}>
                        {formatBRLInteger(f.pnl.lucroCaixa)}
                      </p>
                    </div>
                    <div className="text-right">
                      <MarginBadge margem={f.pnl.margemCaixa} />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-3">vs mês ant.</p>
                      <DeltaBadge valor={variacaoFaturamento(f)} />
                    </div>
                    <MaterialIcon
                      icon={isExpanded ? "expand_less" : "expand_more"}
                      size={20}
                      className="text-ink-3"
                    />
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3 active:bg-surface">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-ink truncate">{f.name}</p>
                        <p className="text-xs text-ink-3">{f.city}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeltaBadge valor={variacaoFaturamento(f)} />
                        <MarginBadge margem={f.pnl.margemCaixa} />
                        <MaterialIcon
                          icon={isExpanded ? "expand_less" : "expand_more"}
                          size={20}
                          className="text-ink-3"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-ink-3">Faturamento</p>
                        <p className="text-xs font-medium text-ink">{formatBRLInteger(f.pnl.totalRecebido)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink-3">Custos</p>
                        <p className="text-xs font-medium text-ink-2">
                          {formatBRLInteger(f.pnl.taxasCartao + f.pnl.outrasDespesas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink-3">Lucro</p>
                        <p className={`text-xs font-bold ${f.pnl.lucroCaixa >= 0 ? "text-ok-ink" : "text-err"}`}>
                          {formatBRLInteger(f.pnl.lucroCaixa)}
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
