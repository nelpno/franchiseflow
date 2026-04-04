import React, { useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { differenceInDays } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { getFranchiseDisplayName } from "@/lib/franchiseUtils";

const PREVIEW_NAMES = 3;

function formatAlertDetail(item, type) {
  const name = typeof item === "string" ? item : item.name;
  if (type === "noSalesCritical" || type === "noSalesWarning") {
    const days = item.days;
    return days ? `${name} (${days}d)` : name;
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

const LEVEL_STYLES = {
  red: { border: "border-[#a80012]", bg: "bg-[#a80012]/5", icon: "text-[#a80012]" },
  orange: { border: "border-[#c2410c]", bg: "bg-[#c2410c]/5", icon: "text-[#c2410c]" },
  yellow: { border: "border-[#775a19]", bg: "bg-[#775a19]/5", icon: "text-[#775a19]" },
};

function AlertGroup({ level, icon, label, items, type }) {
  const [expanded, setExpanded] = useState(false);
  const styles = LEVEL_STYLES[level] || LEVEL_STYLES.yellow;

  const names = items.map(i => typeof i === "string" ? i : i.name);
  const preview = names.slice(0, PREVIEW_NAMES);
  const remaining = names.length - PREVIEW_NAMES;

  const dynamicLabel = useMemo(() => {
    if (type === "noSalesCritical" || type === "noSalesWarning") {
      const maxDays = Math.max(...items.map(i => i.days || 0));
      return maxDays > 0 ? `${label} (até ${maxDays}d)` : label;
    }
    return label;
  }, [items, type, label]);

  return (
    <div className={`${styles.bg} border-l-4 ${styles.border} rounded-r-xl`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <MaterialIcon icon={icon} size={18} className={styles.icon} />
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

export default function AlertsPanel({ franchises, allSales, inventoryByFranchise, purchaseOrders, configMap = {} }) {
  const navigate = useNavigate();

  const alertGroups = useMemo(() => {
    const noSalesCritical = []; // 7+ dias sem venda
    const noSalesWarning = [];  // 3-7 dias sem venda
    const zeroStock = [];
    const lowStock = [];
    const noReorder = [];
    const now = new Date();

    for (const franchise of franchises) {
      const evoId = franchise.evolution_instance_id;
      const config = configMap[evoId];
      const fName = getFranchiseDisplayName(franchise, config);

      const inventory = inventoryByFranchise?.[franchise.id] || inventoryByFranchise?.[evoId] || [];

      // Vendas reais desta franquia (usa allSales, não DailySummary)
      const franchiseSales = (allSales || []).filter(
        (s) => s.franchise_id === evoId || s.franchise_id === franchise.id
      );

      // Franquia operacional = tem pelo menos 1 venda OU editou estoque (qty > 0 em algum item)
      const hasSales = franchiseSales.length > 0;
      const hasActiveInventory = inventory.some((i) => (i.quantity || 0) > 0);
      if (!hasSales && !hasActiveInventory) continue;

      // --- Sem vendas (usa dados reais, não cron) ---
      if (hasSales) {
        const lastSaleDate = franchiseSales.reduce((latest, s) => {
          return s.sale_date > latest ? s.sale_date : latest;
        }, "");
        const daysSinceLastSale = lastSaleDate
          ? differenceInDays(now, new Date(lastSaleDate))
          : null;

        if (daysSinceLastSale !== null && daysSinceLastSale >= 7) {
          noSalesCritical.push({ name: fName, days: daysSinceLastSale });
        } else if (daysSinceLastSale !== null && daysSinceLastSale >= 3) {
          noSalesWarning.push({ name: fName, days: daysSinceLastSale });
        }
      }

      // --- Estoque inteligente (usa min_stock) ---
      // Itens gerenciados = min_stock > 0 (franqueado configurou)
      const managedItems = inventory.filter((i) => (i.min_stock || 0) > 0);

      const zeroItems = managedItems.filter((i) => (i.quantity || 0) === 0);
      if (zeroItems.length > 0) {
        zeroStock.push({ name: fName, count: zeroItems.length });
      }

      const lowItems = managedItems.filter((i) => {
        const qty = i.quantity || 0;
        const minStock = i.min_stock || 3;
        return qty > 0 && qty < minStock;
      });
      if (lowItems.length > 0) {
        lowStock.push({ name: fName, count: lowItems.length });
      }

      // --- Reposição (só franquias com estoque gerenciado) ---
      if (managedItems.length > 0) {
        const franchiseOrders = (purchaseOrders || []).filter(
          (po) => po.franchise_id === franchise.id || po.franchise_id === evoId
        );
        const latestOrder = franchiseOrders.sort(
          (a, b) => new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0)
        )[0];
        const reorderDays = latestOrder
          ? differenceInDays(now, new Date(latestOrder.ordered_at))
          : null;
        if (!latestOrder || reorderDays >= 45) {
          noReorder.push({ name: fName, days: reorderDays });
        }
      }
    }

    return { noSalesCritical, noSalesWarning, zeroStock, lowStock, noReorder };
  }, [franchises, allSales, inventoryByFranchise, purchaseOrders, configMap]);

  const redCount = alertGroups.noSalesCritical.length;
  const orangeCount = alertGroups.noSalesWarning.length + alertGroups.zeroStock.length;
  const yellowCount = alertGroups.lowStock.length + alertGroups.noReorder.length;
  const totalGroups =
    (alertGroups.noSalesCritical.length > 0 ? 1 : 0) +
    (alertGroups.noSalesWarning.length > 0 ? 1 : 0) +
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
          {orangeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#c2410c]">
              <span className="w-2 h-2 rounded-full bg-[#c2410c]" />
              {orangeCount} {orangeCount === 1 ? "atencao" : "atencao"}
            </span>
          )}
          {yellowCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#775a19]">
              <span className="w-2 h-2 rounded-full bg-[#775a19]" />
              {yellowCount} {yellowCount === 1 ? "informativo" : "informativos"}
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
          {alertGroups.noSalesCritical.length > 0 && (
            <AlertGroup
              level="red"
              icon="warning"
              label="sem vendas há 7+ dias"
              items={alertGroups.noSalesCritical}
              type="noSalesCritical"
            />
          )}
          {alertGroups.noSalesWarning.length > 0 && (
            <AlertGroup
              level="orange"
              icon="schedule"
              label="sem vendas há 3+ dias"
              items={alertGroups.noSalesWarning}
              type="noSalesWarning"
            />
          )}
          {alertGroups.zeroStock.length > 0 && (
            <AlertGroup
              level="orange"
              icon="inventory"
              label="com estoque zerado"
              items={alertGroups.zeroStock}
              type="zeroStock"
            />
          )}
          {alertGroups.lowStock.length > 0 && (
            <AlertGroup
              level="yellow"
              icon="inventory_2"
              label="com estoque baixo"
              items={alertGroups.lowStock}
              type="lowStock"
            />
          )}
          {alertGroups.noReorder.length > 0 && (
            <AlertGroup
              level="yellow"
              icon="local_shipping"
              label="sem reposição há 45+ dias"
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
