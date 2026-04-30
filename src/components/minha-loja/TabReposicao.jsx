import React, { useState, useMemo, useEffect, useRef } from "react";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { weeklyTurnoverMap, suggestionFor } from "@/lib/stockSuggestion";
import PurchaseOrderForm from "./PurchaseOrderForm";
import PurchaseOrderHistory from "./PurchaseOrderHistory";

export default function TabReposicao({
  franchiseId,
  inventoryItems,
  saleItems,
}) {
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const [initialQuantities, setInitialQuantities] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [loadingLastOrder, setLoadingLastOrder] = useState(true);
  const abortControllerRef = useRef(null);

  // Load last order for "Repetir Ultimo"
  useEffect(() => {
    if (!franchiseId) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingLastOrder(true);
    PurchaseOrder.filter({ franchise_id: franchiseId }, "-ordered_at", 1, { signal: controller.signal })
      .then((orders) => {
        setLastOrder(orders.length > 0 ? orders[0] : null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLastOrder(null);
      })
      .finally(() => setLoadingLastOrder(false));

    return () => controller.abort();
  }, [franchiseId, orderRefreshKey]);

  const weeklyTurnover = useMemo(() => weeklyTurnoverMap(saleItems), [saleItems]);

  const suggestions = useMemo(() => {
    const items = (inventoryItems || []).filter(
      (item) => item.active !== false && item.cost_price && parseFloat(item.cost_price) > 0
    );
    return items
      .map((item) => {
        const sug = suggestionFor(item, weeklyTurnover);
        if (sug === null || sug <= 0) return null;
        return {
          id: item.id,
          name: item.product_name,
          stock: parseFloat(item.quantity) || 0,
          weeklyTurnover: weeklyTurnover[item.id] || 0,
          suggestion: sug,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.suggestion - a.suggestion)
      .slice(0, 5);
  }, [inventoryItems, weeklyTurnover]);

  const hasHistory = Object.keys(weeklyTurnover).length > 0;

  const handleRepeatLastOrder = async () => {
    if (!lastOrder) return;
    try {
      const items = await PurchaseOrderItem.filter({ order_id: lastOrder.id });
      if (items.length === 0) {
        toast.error("O último pedido não tem itens.");
        return;
      }
      // Build initialQuantities map: inventory_item_id -> quantity
      const qtyMap = {};
      items.forEach((item) => {
        if (item.inventory_item_id) {
          qtyMap[item.inventory_item_id] = item.quantity || 0;
        }
      });
      setInitialQuantities(qtyMap);
      setShowOrderDialog(true);
    } catch (error) {
      console.error("Erro ao carregar último pedido:", error);
      toast.error("Erro ao carregar itens do último pedido.");
    }
  };

  const handleNewOrder = () => {
    setInitialQuantities(null);
    setShowOrderDialog(true);
  };

  // Items below minimum stock (critical)
  const criticalItems = useMemo(() => {
    return (inventoryItems || [])
      .filter(item => {
        if (item.active === false) return false;
        const qty = item.quantity || 0;
        const min = item.min_stock || 0;
        return min > 0 && qty < min;
      })
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
  }, [inventoryItems]);

  return (
    <div className="space-y-6">
      {/* Critical stock alert */}
      {criticalItems.length > 0 && (
        <Card className="bg-gradient-to-r from-[#dc2626]/5 to-[#dc2626]/10 rounded-2xl shadow-sm border border-[#dc2626]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon icon="warning" size={20} className="text-[#dc2626]" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#dc2626] font-plus-jakarta">
                Estoque Crítico ({criticalItems.length})
              </h3>
            </div>
            <div className="space-y-2">
              {criticalItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/60"
                >
                  <span className="text-sm font-medium text-[#1b1c1d] truncate flex-1 min-w-0">
                    {item.product_name}
                  </span>
                  <div className="text-right ml-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#dc2626] font-mono-numbers">
                      {item.quantity || 0}
                    </span>
                    <span className="text-xs text-[#4a3d3d]">
                      / mín {item.min_stock}
                    </span>
                  </div>
                </div>
              ))}
              {criticalItems.length > 8 && (
                <p className="text-xs text-[#dc2626]/60 text-center">
                  +{criticalItems.length - 8} produtos abaixo do mínimo
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestion card */}
      {suggestions.length > 0 ? (
        <Card className="bg-gradient-to-r from-[#d4af37]/5 to-[#d4af37]/10 rounded-2xl shadow-sm border border-[#d4af37]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon icon="lightbulb" size={20} className="text-[#d4af37]" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#775a19] font-plus-jakarta">
                Sugestão de Reposição
              </h3>
            </div>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/60"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#1b1c1d] truncate block">
                      {item.name}
                    </span>
                    <span className="text-xs text-[#4a3d3d]">
                      Estoque: {item.stock} · Giro: {item.weeklyTurnover.toFixed(1)}/sem
                    </span>
                  </div>
                  <div className="text-right ml-3">
                    <span className="text-sm font-bold text-[#b91c1c] font-mono-numbers">
                      +{item.suggestion}
                    </span>
                    <span className="text-xs text-[#4a3d3d] block">un</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !hasHistory ? (
        <Card className="bg-gradient-to-r from-[#1b1c1d]/5 to-[#1b1c1d]/10 rounded-2xl shadow-sm border border-[#1b1c1d]/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-2">
              <MaterialIcon icon="hourglass_empty" size={20} className="text-[#4a3d3d] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#1b1c1d]">
                  Sem histórico de vendas suficiente.
                </p>
                <p className="text-xs text-[#4a3d3d] mt-1">
                  Registre vendas por alguns dias para começarmos a sugerir reposições baseadas no seu giro.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-[#16a34a]/5 to-[#16a34a]/10 rounded-2xl shadow-sm border border-[#16a34a]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="check_circle" size={20} className="text-[#16a34a]" />
              <span className="text-sm font-medium text-[#16a34a]">
                Estoque em dia!
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
            Reposição de Estoque
          </h2>
          <p className="text-sm text-[#4a3d3d]">
            Faça pedidos para a fábrica Maxi Massas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleRepeatLastOrder}
                    disabled={!lastOrder || loadingLastOrder}
                    className="gap-2 border-[#d4af37] text-[#775a19] font-bold rounded-xl hover:bg-[#d4af37]/10 disabled:opacity-50"
                  >
                    <MaterialIcon icon="replay" size={18} />
                    Repetir último
                  </Button>
                </span>
              </TooltipTrigger>
              {!lastOrder && !loadingLastOrder && (
                <TooltipContent>
                  <p>Nenhum pedido anterior</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <Button
            onClick={handleNewOrder}
            className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
          >
            <MaterialIcon icon="add_shopping_cart" size={18} />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Purchase Order History */}
      <PurchaseOrderHistory franchiseId={franchiseId} refreshKey={orderRefreshKey} />

      {/* Purchase Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-[#1b1c1d] min-w-0">
              <MaterialIcon icon="local_shipping" size={20} className="text-[#d4af37] shrink-0" />
              <span className="truncate">
                {initialQuantities ? "Repetir Pedido" : "Novo Pedido de Compra"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            franchiseId={franchiseId}
            inventoryItems={inventoryItems}
            saleItems={saleItems}
            initialQuantities={initialQuantities}
            onSave={() => {
              setShowOrderDialog(false);
              setInitialQuantities(null);
              setOrderRefreshKey((k) => k + 1);
            }}
            onCancel={() => {
              setShowOrderDialog(false);
              setInitialQuantities(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
