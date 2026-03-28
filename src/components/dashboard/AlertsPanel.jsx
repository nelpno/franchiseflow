import React, { useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { subDays, differenceInDays } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

const PREVIEW_NAMES = 3;

function formatAlertDetail(item, type) {
  const name = typeof item === "string" ? item : item.name;
  if (type === "noSales") {
    const days = item.days;
    return days ? `${name} (${days}d)` : `${name} (nunca)`;
  }
  if (type === "zeroStock" || type === "lowStock") {
    return item.count ? `${name} (${item.count} itens)` : name;
  }
  if (type === "noReorder") {
    const days = item.days;
    return days ? `${name} (${days}d)` : `${name} (nunca)`;
  }
  return name;
}

function AlertGroup({ level, icon, label, items, type }) {
  const [expanded, setExpanded] = useState(false);
  const isRed = level === "red";
  const borderColor = isRed ? "border-[#a80012]" : "border-[#775a19]";
  const bgColor = isRed ? "bg-[#a80012]/5" : "bg-[#775a19]/5";
  const iconColor = isRed ? "text-[#a80012]" : "text-[#775a19]";

  const names = items.map(i => typeof i === "string" ? i : i.name);
  const preview = names.slice(0, PREVIEW_NAMES);
  const remaining = names.length - PREVIEW_NAMES;

  // Dynamic label with max days
  const dynamicLabel = useMemo(() => {
    if (type === "noSales") {
      const maxDays = Math.max(...items.map(i => i.days || 0));
      return maxDays > 0 ? `sem vendas (até ${maxDays}d)` : label;
    }
    return label;
  }, [items, type, label]);

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} rounded-r-xl`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <MaterialIcon icon={icon} size={18} className={iconColor} />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-[#1b1c1d] font-plus-jakarta">
            {items.length} {items.length === 1 ? "franquia" : "franquias"}
          </span>
          <span className="text-[#4a3d3d] text-sm"> — {dynamicLabel}</span>
        </div>
        <MaterialIcon
          icon={expanded ? "expand_less" : "expand_more"}
          size={18}
          className="text-[#4a3d3d]/50"
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pl-10">
          <p className="text-xs text-[#4a3d3d]">
            {items.map(i => formatAlertDetail(i, type)).join(", ")}
          </p>
        </div>
      )}

      {!expanded && items.length > 0 && (
        <div className="px-3 pb-2 pl-10">
          <p className="text-xs text-[#4a3d3d]/70">
            {preview.join(", ")}
            {remaining > 0 && `, +${remaining}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AlertsPanel({ franchises, summaries, inventoryByFranchise, purchaseOrders, configMap = {} }) {
  const navigate = useNavigate();

  const alertGroups = useMemo(() => {
    const noSales = [];
    const zeroStock = [];
    const lowStock = [];
    const noReorder = [];
    const twoDaysAgo = subDays(new Date(), 2);
    const now = new Date();

    for (const franchise of franchises) {
      const evoId = franchise.evolution_instance_id;
      const config = configMap[evoId];
      const fName = getFranchiseDisplayName(franchise, config);

      const inventory = inventoryByFranchise?.[franchise.id] || inventoryByFranchise?.[evoId] || [];

      // Filter: skip franchises that never operated (no sales history AND no inventory)
      const franchiseSummaries = summaries.filter(
        (s) => s.franchise_id === evoId || s.franchise_id === franchise.id
      );
      const hasAnySales = franchiseSummaries.some((s) => (s.sales_count || 0) > 0);
      const hasInventory = inventory.length > 0;

      if (!hasAnySales && !hasInventory) continue;

      // No sales in 2+ days — with exact day count
      const sortedSummaries = [...franchiseSummaries].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      const lastSaleDay = sortedSummaries.find((s) => (s.sales_count || 0) > 0);
      if (!lastSaleDay || new Date(lastSaleDay.date) < twoDaysAgo) {
        const days = lastSaleDay ? differenceInDays(now, new Date(lastSaleDay.date)) : null;
        noSales.push({ name: fName, days });
      }

      // Zero stock — with count of zeroed products
      const zeroItems = inventory.filter((i) => (i.quantity || 0) === 0);
      if (zeroItems.length > 0) {
        zeroStock.push({ name: fName, count: zeroItems.length });
      }

      // Low stock
      const lowItems = inventory.filter((i) => (i.quantity || 0) > 0 && (i.quantity || 0) < 5);
      if (lowItems.length > 0) {
        lowStock.push({ name: fName, count: lowItems.length });
      }

      // No reorder in 30+ days — with exact day count
      const franchiseOrders = (purchaseOrders || []).filter(
        (po) => po.franchise_id === franchise.id || po.franchise_id === evoId
      );
      const latestOrder = franchiseOrders.sort(
        (a, b) => new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0)
      )[0];
      const reorderDays = latestOrder ? differenceInDays(now, new Date(latestOrder.ordered_at)) : null;
      if (!latestOrder || reorderDays >= 30) {
        noReorder.push({ name: fName, days: reorderDays });
      }
    }

    return { noSales, zeroStock, lowStock, noReorder };
  }, [franchises, summaries, inventoryByFranchise, purchaseOrders, configMap]);

  const redCount = alertGroups.noSales.length + alertGroups.zeroStock.length;
  const yellowCount = alertGroups.lowStock.length + alertGroups.noReorder.length;
  const totalGroups =
    (alertGroups.noSales.length > 0 ? 1 : 0) +
    (alertGroups.zeroStock.length > 0 ? 1 : 0) +
    (alertGroups.lowStock.length > 0 ? 1 : 0) +
    (alertGroups.noReorder.length > 0 ? 1 : 0);

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-[#291715]/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1b1c1d] font-bold tracking-tight font-plus-jakarta text-sm">
          ALERTAS
        </h4>
        <div className="flex items-center gap-4 text-xs font-medium">
          {redCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#a80012]">
              <span className="w-2 h-2 rounded-full bg-[#a80012]" />
              {redCount} {redCount === 1 ? "critico" : "criticos"}
            </span>
          )}
          {yellowCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#775a19]">
              <span className="w-2 h-2 rounded-full bg-[#775a19]" />
              {yellowCount} atencao
            </span>
          )}
        </div>
      </div>

      {/* Alert groups or empty state */}
      {totalGroups === 0 ? (
        <div className="flex items-center gap-3 p-3 bg-[#f0fdf4] border-l-4 border-[#22c55e] rounded-r-xl">
          <MaterialIcon icon="check_circle" filled size={20} className="text-[#16a34a]" />
          <span className="text-sm font-medium text-[#15803d]">
            Todas as franquias operando normalmente
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {alertGroups.noSales.length > 0 && (
            <AlertGroup
              level="red"
              icon="warning"
              label="sem vendas há 2+ dias"
              items={alertGroups.noSales}
              type="noSales"
            />
          )}
          {alertGroups.zeroStock.length > 0 && (
            <AlertGroup
              level="red"
              icon="inventory"
              label="com estoque zerado"
              items={alertGroups.zeroStock}
              type="zeroStock"
            />
          )}
          {alertGroups.lowStock.length > 0 && (
            <AlertGroup
              level="yellow"
              icon="inventory"
              label="com estoque baixo"
              items={alertGroups.lowStock}
              type="lowStock"
            />
          )}
          {alertGroups.noReorder.length > 0 && (
            <AlertGroup
              level="yellow"
              icon="local_shipping"
              label="sem reposição há 30+ dias"
              items={alertGroups.noReorder}
              type="noReorder"
            />
          )}

          {/* Link para Acompanhamento */}
          <button
            onClick={() => navigate(createPageUrl("Acompanhamento"))}
            className="flex items-center gap-2 mt-2 text-sm font-medium text-[#a80012] hover:underline"
          >
            <MaterialIcon icon="monitoring" size={18} />
            Ver detalhes no Acompanhamento
          </button>
        </div>
      )}
    </section>
  );
}
