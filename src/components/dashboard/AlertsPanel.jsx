import React, { useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { subDays, differenceInDays } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

const LEVEL_ORDER = { red: 0, yellow: 1 };

export default function AlertsPanel({ franchises, summaries, inventoryByFranchise, checklistByFranchise, purchaseOrders }) {
  const alerts = useMemo(() => {
    const result = [];
    const twoDaysAgo = subDays(new Date(), 2);

    for (const franchise of franchises) {
      const fName = franchise.city || franchise.owner_name || "Franquia";

      const evoId = franchise.evolution_instance_id;
      const franchiseSummaries = summaries
        .filter((s) => s.franchise_id === evoId || s.franchise_id === franchise.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const lastSaleDay = franchiseSummaries.find((s) => (s.sales_count || 0) > 0);
      if (!lastSaleDay || new Date(lastSaleDay.date) < twoDaysAgo) {
        const days = lastSaleDay
          ? Math.floor((new Date() - new Date(lastSaleDay.date)) / 86400000)
          : "?";
        result.push({
          level: "red",
          franchise: fName,
          franchiseId: franchise.id,
          description: `Franquia sem vendas registradas há ${days} dias`,
          action: "Ver franquia",
          actionUrl: createPageUrl("Franchises"),
          icon: "warning",
        });
      }

      const inventory = inventoryByFranchise?.[franchise.id] || inventoryByFranchise?.[evoId] || [];
      const zeroStock = inventory.filter((i) => (i.quantity || 0) === 0);
      const lowStock = inventory.filter((i) => (i.quantity || 0) > 0 && (i.quantity || 0) < 5);

      if (zeroStock.length > 0) {
        result.push({
          level: "red",
          franchise: fName,
          franchiseId: franchise.id,
          description: `${zeroStock.length} item(ns) zerado(s) no estoque`,
          action: "Ver estoque",
          actionUrl: createPageUrl("PurchaseOrders"),
          icon: "inventory",
        });
      }
      if (lowStock.length > 0) {
        result.push({
          level: "yellow",
          franchise: fName,
          franchiseId: franchise.id,
          description: `${lowStock.length} item(ns) atingiram o estoque crítico de segurança`,
          action: "Ver estoque",
          actionUrl: createPageUrl("PurchaseOrders"),
          icon: "inventory",
        });
      }

      if (!checklistByFranchise?.[franchise.id]) {
        result.push({
          level: "yellow",
          franchise: fName,
          franchiseId: franchise.id,
          description: "Checklist de abertura não foi realizado hoje",
          action: "Ver franquia",
          actionUrl: createPageUrl("Franchises"),
          icon: "checklist",
        });
      }

      // Purchase order alert: no order in 30+ days
      const franchiseOrders = (purchaseOrders || []).filter(
        (po) =>
          po.franchise_id === franchise.id || po.franchise_id === franchise.evolution_instance_id
      );
      const latestOrder = franchiseOrders.sort(
        (a, b) => new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0)
      )[0];

      const now = new Date();
      if (!latestOrder || differenceInDays(now, new Date(latestOrder.ordered_at)) >= 30) {
        const days = latestOrder
          ? differenceInDays(now, new Date(latestOrder.ordered_at))
          : "30+";
        result.push({
          level: "yellow",
          franchise: fName,
          franchiseId: franchise.id,
          description: `Sem pedido de reposição há ${days} dias`,
          action: "Ver pedidos",
          actionUrl: createPageUrl("PurchaseOrders"),
          icon: "local_shipping",
        });
      }
    }

    return result.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [franchises, summaries, inventoryByFranchise, checklistByFranchise, purchaseOrders]);

  const navigate = useNavigate();

  const getIcon = (alert) => {
    const iconClass = alert.level === "red" ? "text-[#a80012]" : "text-[#775a19]";
    switch (alert.icon) {
      case "inventory":
        return <MaterialIcon icon="inventory" size={20} className={iconClass} />;
      case "checklist":
        return <MaterialIcon icon="fact_check" size={20} className={iconClass} />;
      case "local_shipping":
        return <MaterialIcon icon="local_shipping" size={20} className={iconClass} />;
      default:
        return <MaterialIcon icon="warning" size={20} className={iconClass} />;
    }
  };

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#291715]/5">
      <div className="flex items-center gap-2 mb-6">
        <h4 className="text-[#1b1c1d] font-bold tracking-tight font-plus-jakarta">
          ATENÇÃO CRÍTICA
        </h4>
        {alerts.length > 0 && (
          <span className="bg-[#a80012] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            ({alerts.length})
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-[#f0fdf4] border-l-4 border-[#22c55e] rounded-r-xl">
          <MaterialIcon icon="check_circle" filled size={20} className="text-[#16a34a]" />
          <span className="text-sm font-medium text-[#15803d]">
            Todas as franquias operando normalmente
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-4 rounded-r-xl border-l-4 ${
                alert.level === "red"
                  ? "bg-[#a80012]/5 border-[#a80012]"
                  : "bg-[#775a19]/5 border-[#775a19]"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={alert.level === "red" ? "text-[#a80012]" : "text-[#775a19]"}>
                  {getIcon(alert)}
                </div>
                <div>
                  <h5 className="font-bold text-[#1b1c1d] font-plus-jakarta">
                    {alert.franchise}
                  </h5>
                  <p className="text-sm text-[#1b1c1d]/70">{alert.description}</p>
                </div>
              </div>
              <button
                onClick={alert.actionUrl ? () => navigate(alert.actionUrl) : undefined}
                className={`text-xs font-bold uppercase tracking-wider hover:underline font-plus-jakarta ${
                  alert.level === "red" ? "text-[#a80012]" : "text-[#775a19]"
                }`}
              >
                {alert.action}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
