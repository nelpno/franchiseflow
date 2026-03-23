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

  const redAlerts = useMemo(() => alerts.filter((a) => a.level === "red"), [alerts]);
  const yellowAlerts = useMemo(() => alerts.filter((a) => a.level === "yellow"), [alerts]);
  const franchisesWithAlerts = useMemo(
    () => new Set(alerts.map((a) => a.franchiseId)).size,
    [alerts]
  );
  const healthyCount = franchises.length - franchisesWithAlerts;

  const visibleRed = redAlerts.slice(0, 3);
  const hiddenRedCount = redAlerts.length - visibleRed.length;

  const getIcon = (iconName) => {
    switch (iconName) {
      case "inventory":
        return <MaterialIcon icon="inventory" size={18} className="text-[#a80012]" />;
      case "local_shipping":
        return <MaterialIcon icon="local_shipping" size={18} className="text-[#a80012]" />;
      default:
        return <MaterialIcon icon="warning" size={18} className="text-[#a80012]" />;
    }
  };

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-[#291715]/5">
      {/* Zona 1: Header com contadores */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1b1c1d] font-bold tracking-tight font-plus-jakarta text-sm">
          ALERTAS
        </h4>
        <div className="flex items-center gap-4 text-xs font-medium">
          {redAlerts.length > 0 && (
            <span className="flex items-center gap-1.5 text-[#a80012]">
              <span className="w-2 h-2 rounded-full bg-[#a80012]" />
              {redAlerts.length} {redAlerts.length === 1 ? "critico" : "criticos"}
            </span>
          )}
          {yellowAlerts.length > 0 && (
            <span className="flex items-center gap-1.5 text-[#775a19]">
              <span className="w-2 h-2 rounded-full bg-[#775a19]" />
              {yellowAlerts.length} {yellowAlerts.length === 1 ? "atencao" : "atencao"}
            </span>
          )}
          {healthyCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#16a34a]">
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
              {healthyCount} ok
            </span>
          )}
        </div>
      </div>

      {/* Zona 2: Alertas vermelhos ou estado vazio */}
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-3 bg-[#f0fdf4] border-l-4 border-[#22c55e] rounded-r-xl">
          <MaterialIcon icon="check_circle" filled size={20} className="text-[#16a34a]" />
          <span className="text-sm font-medium text-[#15803d]">
            Todas as franquias operando normalmente
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRed.map((alert, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-[#a80012]/5 border-l-4 border-[#a80012] rounded-r-xl"
            >
              {getIcon(alert.icon)}
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-[#1b1c1d] font-plus-jakarta">
                  {alert.franchise}
                </span>
                <span className="text-[#4a3d3d] text-sm"> — {alert.description}</span>
              </div>
            </div>
          ))}

          {hiddenRedCount > 0 && (
            <p className="text-xs text-[#4a3d3d] pl-3">
              +{hiddenRedCount} {hiddenRedCount === 1 ? "alerta critico" : "alertas criticos"}
            </p>
          )}

          {/* Zona 3: Link para Acompanhamento */}
          <button
            onClick={() => navigate(createPageUrl("Acompanhamento"))}
            className="flex items-center gap-2 mt-2 text-sm font-medium text-[#a80012] hover:underline"
          >
            <MaterialIcon icon="monitoring" size={18} />
            <span>
              Ver detalhes no Acompanhamento
              {yellowAlerts.length > 0 && (
                <span className="text-[#775a19] font-normal ml-1">
                  ({yellowAlerts.length} {yellowAlerts.length === 1 ? "item" : "itens"} de atencao)
                </span>
              )}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
