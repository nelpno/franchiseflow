import React, { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import MaterialIcon from "@/components/ui/MaterialIcon";

function getCategoryFromName(name) {
  const lower = (name || "").toLowerCase();
  if (/^(canelone|conchiglione|massa|nhoque|rondelli|sofioli)/.test(lower)) return "Massas";
  if (/^molho/.test(lower)) return "Molhos";
  return "Outros";
}

const CATEGORY_ORDER = ["Massas", "Molhos", "Outros"];
const CATEGORY_ICONS = { Massas: "lunch_dining", Molhos: "soup_kitchen", Outros: "inventory_2" };

function getStockStatus(item) {
  const qty = item.quantity || 0;
  const min = item.min_stock || 0;
  if (qty === 0) return { label: "Zerado", color: "#dc2626", bg: "bg-red-50" };
  if (min > 0 && qty < min) return { label: "Baixo", color: "#d97706", bg: "bg-amber-50" };
  return { label: "OK", color: "#16a34a", bg: "bg-emerald-50" };
}

function formatCurrency(value) {
  if (value == null) return "-";
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

export default function InventorySheet({ open, onOpenChange, franchiseName, items }) {
  const { grouped, summary } = useMemo(() => {
    const byCategory = {};
    let zerados = 0;
    let baixos = 0;
    let ok = 0;

    (items || []).forEach((item) => {
      const cat = getCategoryFromName(item.product_name);
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);

      const status = getStockStatus(item);
      if (status.label === "Zerado") zerados++;
      else if (status.label === "Baixo") baixos++;
      else ok++;
    });

    // Sort items within each category by product_name
    Object.values(byCategory).forEach((arr) =>
      arr.sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""))
    );

    return {
      grouped: byCategory,
      summary: { zerados, baixos, ok, total: (items || []).length },
    };
  }, [items]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-plus-jakarta text-lg flex items-center gap-2">
            <MaterialIcon icon="inventory_2" size={22} className="text-[#775a19]" />
            Estoque — {franchiseName}
          </SheetTitle>
        </SheetHeader>

        {/* Summary badges */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {summary.zerados > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-[#dc2626] border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
              {summary.zerados} zerado{summary.zerados > 1 ? "s" : ""}
            </span>
          )}
          {summary.baixos > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-[#d97706] border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
              {summary.baixos} abaixo do minimo
            </span>
          )}
          {summary.ok > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#16a34a] border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              {summary.ok} OK
            </span>
          )}
        </div>

        {summary.total === 0 ? (
          <div className="text-center py-12 text-[#4a3d3d]">
            <MaterialIcon icon="inventory_2" size={40} className="text-[#7a6d6d] mb-2" />
            <p className="text-sm">Nenhum item de estoque cadastrado</p>
          </div>
        ) : (
          <div className="space-y-5">
            {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <MaterialIcon icon={CATEGORY_ICONS[cat]} size={16} className="text-[#4a3d3d]" />
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#4a3d3d]">
                    {cat}
                  </span>
                  <span className="text-xs text-[#7a6d6d]">({grouped[cat].length})</span>
                </div>

                {/* Items table */}
                <div className="rounded-xl border border-[#291715]/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#fbf9fa] text-[#4a3d3d] text-xs">
                        <th className="text-left py-2 px-3 font-semibold">Produto</th>
                        <th className="text-right py-2 px-2 font-semibold w-14">Qtd</th>
                        <th className="text-right py-2 px-2 font-semibold w-20 hidden sm:table-cell">Custo</th>
                        <th className="text-right py-2 px-2 font-semibold w-20 hidden sm:table-cell">Venda</th>
                        <th className="text-center py-2 px-2 font-semibold w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[cat].map((item) => {
                        const status = getStockStatus(item);
                        return (
                          <tr
                            key={item.id}
                            className="border-t border-[#291715]/5 hover:bg-[#fbf9fa]/50"
                          >
                            <td className="py-2 px-3 text-[#1b1c1d] font-medium text-xs">
                              {item.product_name}
                            </td>
                            <td className="py-2 px-2 text-right font-mono-numbers font-bold text-xs" style={{ color: status.color }}>
                              {item.quantity || 0}
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-[#4a3d3d] hidden sm:table-cell">
                              {formatCurrency(item.cost_price)}
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-[#4a3d3d] hidden sm:table-cell">
                              {formatCurrency(item.sale_price)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${status.bg}`}
                                style={{ color: status.color }}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
