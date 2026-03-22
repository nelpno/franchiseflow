import React, { useMemo, useState } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Calculates and displays a health score (0-100) for each franchise.
 *
 * Score breakdown:
 * - Sales (30 pts): recent sales activity
 * - Inventory (20 pts): stock above minimums
 * - Orders (20 pts): recent purchase orders
 * - Checklist (15 pts): daily checklist completion
 * - WhatsApp (15 pts): recent unique contacts
 */

function calculateHealthScore({
  franchise,
  todaySales,
  inventoryItems,
  purchaseOrders,
  checklistData,
  todayContacts,
}) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
  const fourteenDaysAgo = format(subDays(today, 14), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
  const sixtyDaysAgo = format(subDays(today, 60), "yyyy-MM-dd");
  const threeDaysAgo = format(subDays(today, 3), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");

  const evoId = franchise.evolution_instance_id;

  // --- Sales (30 pts) ---
  let salesScore = 0;
  const franchiseSales = todaySales.filter((s) => s.franchise_id === evoId);
  if (franchiseSales.length > 0) {
    // Has sales today or in the data set — check most recent
    const mostRecentDate = franchiseSales.reduce((latest, s) => {
      const d = s.sale_date || s.created_at?.substring(0, 10) || "";
      return d > latest ? d : latest;
    }, "");

    if (mostRecentDate >= sevenDaysAgo) salesScore = 30;
    else if (mostRecentDate >= fourteenDaysAgo) salesScore = 20;
    else if (mostRecentDate >= thirtyDaysAgo) salesScore = 10;
  }

  // --- Inventory (20 pts) ---
  let inventoryScore = 0;
  const items = inventoryItems || [];
  if (items.length > 0) {
    const itemsWithMinStock = items.filter((i) => (i.min_stock || 0) > 0);
    if (itemsWithMinStock.length > 0) {
      const aboveMin = itemsWithMinStock.filter((i) => (i.quantity || 0) >= (i.min_stock || 0)).length;
      inventoryScore = Math.round((aboveMin / itemsWithMinStock.length) * 20);
    } else {
      // No min_stock configured — give partial credit
      const hasStock = items.filter((i) => (i.quantity || 0) > 0).length;
      inventoryScore = Math.round((hasStock / items.length) * 15);
    }
  }

  // --- Orders (20 pts) ---
  let ordersScore = 0;
  const franchiseOrders = purchaseOrders.filter(
    (po) => po.franchise_id === franchise.id || po.franchise_id === evoId
  );
  if (franchiseOrders.length > 0) {
    const mostRecentOrder = franchiseOrders.reduce((latest, po) => {
      const d = po.ordered_at?.substring(0, 10) || "";
      return d > latest ? d : latest;
    }, "");
    if (mostRecentOrder >= thirtyDaysAgo) ordersScore = 20;
    else if (mostRecentOrder >= sixtyDaysAgo) ordersScore = 10;
  }

  // --- Checklist (15 pts) ---
  let checklistScore = 0;
  if (checklistData) {
    const items = checklistData.items || {};
    const values = Object.values(items);
    if (values.length > 0) {
      const done = values.filter(Boolean).length;
      // Full checklist today = 15, partial = proportional
      checklistScore = Math.round((done / values.length) * 15);
    }
  }

  // --- WhatsApp / Contacts (15 pts) ---
  let contactsScore = 0;
  const franchiseContacts = todayContacts.filter(
    (c) => c.franchise_id === evoId
  );
  if (franchiseContacts.length > 0) {
    contactsScore = 15;
  }

  // --- Detail reasons ---
  let salesReason = "Sem vendas registradas";
  if (franchiseSales.length > 0) {
    const mostRecentDate = franchiseSales.reduce((latest, s) => {
      const d = s.sale_date || s.created_at?.substring(0, 10) || "";
      return d > latest ? d : latest;
    }, "");
    if (mostRecentDate) {
      try {
        const dist = formatDistanceToNow(new Date(mostRecentDate + "T12:00:00"), { locale: ptBR, addSuffix: false });
        salesReason = mostRecentDate >= todayStr
          ? "Vendeu hoje"
          : `Ultima venda: ha ${dist}`;
      } catch {
        salesReason = `Ultima venda: ${mostRecentDate}`;
      }
    }
  }

  let inventoryReason = "Sem itens de estoque";
  if (items.length > 0) {
    const itemsWithMinStock = items.filter((i) => (i.min_stock || 0) > 0);
    const lowStock = itemsWithMinStock.filter((i) => (i.quantity || 0) < (i.min_stock || 0));
    if (lowStock.length > 0) {
      inventoryReason = `${lowStock.length} de ${itemsWithMinStock.length} produtos com estoque baixo`;
    } else if (itemsWithMinStock.length > 0) {
      inventoryReason = "Todos os produtos acima do mínimo";
    } else {
      const hasStock = items.filter((i) => (i.quantity || 0) > 0).length;
      inventoryReason = `${hasStock} de ${items.length} produtos com estoque`;
    }
  }

  let ordersReason = "Nenhum pedido de reposição";
  if (franchiseOrders.length > 0) {
    const mostRecentOrder = franchiseOrders.reduce((latest, po) => {
      const d = po.ordered_at?.substring(0, 10) || "";
      return d > latest ? d : latest;
    }, "");
    if (mostRecentOrder) {
      try {
        const dist = formatDistanceToNow(new Date(mostRecentOrder + "T12:00:00"), { locale: ptBR, addSuffix: false });
        ordersReason = `Ultimo pedido: ha ${dist}`;
      } catch {
        ordersReason = `Ultimo pedido: ${mostRecentOrder}`;
      }
    }
  }

  let checklistReason = "Checklist de hoje: não preenchido";
  if (checklistData) {
    const chkItems = checklistData.items || {};
    const values = Object.values(chkItems);
    if (values.length > 0) {
      const done = values.filter(Boolean).length;
      if (done === values.length) {
        checklistReason = "Checklist de hoje: completo";
      } else {
        checklistReason = `Checklist de hoje: ${done}/${values.length} itens`;
      }
    }
  }

  let contactsReason = "Sem contatos recebidos hoje";
  if (franchiseContacts.length > 0) {
    contactsReason = `${franchiseContacts.length} contato${franchiseContacts.length > 1 ? "s" : ""} recebido${franchiseContacts.length > 1 ? "s" : ""} hoje`;
  }

  const total = salesScore + inventoryScore + ordersScore + checklistScore + contactsScore;

  return {
    total,
    breakdown: {
      sales: salesScore,
      inventory: inventoryScore,
      orders: ordersScore,
      checklist: checklistScore,
      contacts: contactsScore,
    },
    reasons: {
      sales: salesReason,
      inventory: inventoryReason,
      orders: ordersReason,
      checklist: checklistReason,
      contacts: contactsReason,
    },
  };
}

function getScoreColor(score) {
  if (score >= 80) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
  if (score >= 50) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
  return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
}

function getScoreLabel(score) {
  if (score >= 80) return "Saudavel";
  if (score >= 50) return "Atenção";
  return "Critico";
}

const CATEGORY_CONFIG = [
  { key: "sales", label: "Vendas", max: 30, icon: "point_of_sale", color: "bg-[#a80012]" },
  { key: "inventory", label: "Estoque", max: 20, icon: "inventory_2", color: "bg-[#775a19]" },
  { key: "orders", label: "Pedidos", max: 20, icon: "local_shipping", color: "bg-[#291715]/60" },
  { key: "checklist", label: "Checklist", max: 15, icon: "checklist", color: "bg-[#0f766e]" },
  { key: "contacts", label: "WhatsApp", max: 15, icon: "chat", color: "bg-[#2563eb]" },
];

export default function FranchiseHealthScore({
  franchises,
  todaySales,
  inventoryByFranchise,
  checklistByFranchise,
  purchaseOrders,
  todayContacts,
}) {
  const navigate = useNavigate();
  const [selectedScore, setSelectedScore] = useState(null);

  const scores = useMemo(() => {
    return franchises
      .map((f) => {
        const score = calculateHealthScore({
          franchise: f,
          todaySales,
          inventoryItems: inventoryByFranchise[f.id] || [],
          purchaseOrders,
          checklistData: checklistByFranchise[f.id] || null,
          todayContacts,
        });
        return {
          franchise: f,
          ...score,
        };
      })
      .sort((a, b) => a.total - b.total); // worst first for attention
  }, [franchises, todaySales, inventoryByFranchise, checklistByFranchise, purchaseOrders, todayContacts]);

  if (scores.length === 0) return null;

  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.total, 0) / scores.length);
  const avgColor = getScoreColor(avgScore);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#291715]/5">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#291715]/60 font-plus-jakarta">
          Health Score por Unidade
        </h4>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${avgColor.bg} ${avgColor.text} ${avgColor.border} border`}>
          <div className={`w-2 h-2 rounded-full ${avgColor.dot}`} />
          Media: {avgScore}
        </div>
      </div>

      <div className="space-y-3">
        {scores.map(({ franchise, total, breakdown, reasons }) => {
          const color = getScoreColor(total);
          const label = getScoreLabel(total);

          return (
            <div
              key={franchise.id}
              onClick={() => setSelectedScore({ franchise, total, breakdown, reasons })}
              className={`flex items-center gap-4 p-3 rounded-xl border ${color.border} ${color.bg}/30 cursor-pointer hover:shadow-md transition-shadow`}
            >
              {/* Score badge */}
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${color.bg} ${color.text}`}>
                <span className="text-lg font-bold font-mono-numbers leading-none">{total}</span>
                <span className="text-[8px] font-bold uppercase leading-none mt-0.5">{label}</span>
              </div>

              {/* Franchise info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#291715] font-plus-jakarta truncate">
                  {franchise.city || franchise.owner_name || "Franquia"}
                </p>
                {/* Mini breakdown bar */}
                <div className="flex gap-0.5 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#a80012] rounded-l-full"
                    style={{ width: `${(breakdown.sales / 30) * 100}%` }}
                    title={`Vendas: ${breakdown.sales}/30`}
                  />
                  <div
                    className="bg-[#775a19]"
                    style={{ width: `${(breakdown.inventory / 20) * 100}%` }}
                    title={`Estoque: ${breakdown.inventory}/20`}
                  />
                  <div
                    className="bg-[#291715]/60"
                    style={{ width: `${(breakdown.orders / 20) * 100}%` }}
                    title={`Pedidos: ${breakdown.orders}/20`}
                  />
                  <div
                    className="bg-[#0f766e]"
                    style={{ width: `${(breakdown.checklist / 15) * 100}%` }}
                    title={`Checklist: ${breakdown.checklist}/15`}
                  />
                  <div
                    className="bg-[#2563eb] rounded-r-full"
                    style={{ width: `${(breakdown.contacts / 15) * 100}%` }}
                    title={`Contatos: ${breakdown.contacts}/15`}
                  />
                </div>
                <div className="flex gap-3 mt-1.5 text-xs text-[#291715]/70 font-medium">
                  <span>Vendas {breakdown.sales}/{30}</span>
                  <span>Estoque {breakdown.inventory}/{20}</span>
                  <span>Pedidos {breakdown.orders}/{20}</span>
                  <span className="hidden md:inline">Check {breakdown.checklist}/{15}</span>
                  <span className="hidden md:inline">WhatsApp {breakdown.contacts}/{15}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#291715]/5 text-xs text-[#291715]/70 font-medium">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>80-100 Saudavel</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>50-79 Atencao</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>0-49 Critico</span>
        </div>
      </div>

      {/* Drill-down Dialog */}
      <Dialog
        open={!!selectedScore}
        onOpenChange={(open) => {
          if (!open) setSelectedScore(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${selectedScore ? getScoreColor(selectedScore.total).bg : ""} ${selectedScore ? getScoreColor(selectedScore.total).text : ""}`}>
                <span className="text-2xl font-bold font-mono-numbers leading-none">
                  {selectedScore?.total || 0}
                </span>
                <span className="text-[8px] font-bold uppercase leading-none mt-0.5">
                  {selectedScore ? getScoreLabel(selectedScore.total) : ""}
                </span>
              </div>
              <div>
                <p className="text-lg">
                  {selectedScore?.franchise?.city || selectedScore?.franchise?.owner_name || "Franquia"}
                </p>
                <p className="text-sm font-normal text-[#534343]">
                  Detalhes do Health Score
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedScore && (
            <div className="space-y-3 pt-2">
              {CATEGORY_CONFIG.map((cat) => {
                const score = selectedScore.breakdown[cat.key] || 0;
                const pct = Math.round((score / cat.max) * 100);
                const reason = selectedScore.reasons?.[cat.key] || "";

                return (
                  <div key={cat.key} className="p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MaterialIcon icon={cat.icon} size={18} className="text-[#534343]" />
                        <span className="text-sm font-semibold text-[#1b1c1d]">{cat.label}</span>
                      </div>
                      <span className="text-sm font-bold font-mono-numbers text-[#1b1c1d]">
                        {score}/{cat.max}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-[#e9e8e9] rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${cat.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* Reason */}
                    <p className="text-xs text-[#534343]">{reason}</p>
                  </div>
                );
              })}

              <div className="pt-2">
                <Button
                  onClick={() => {
                    setSelectedScore(null);
                    navigate("/Franchises");
                  }}
                  className="w-full bg-[#a80012] hover:bg-[#8b0010] text-white font-bold rounded-xl"
                >
                  <MaterialIcon icon="monitoring" size={18} className="mr-2" />
                  Ver Acompanhamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
