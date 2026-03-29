import React, { useState, useEffect } from "react";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const STATUS_CONFIG = {
  pendente: { color: "bg-[#d97706]/10 text-[#d97706]", icon: "schedule", label: "Pendente" },
  confirmado: { color: "bg-[#2563eb]/10 text-[#2563eb]", icon: "check_circle", label: "Confirmado" },
  em_rota: { color: "bg-[#ea580c]/10 text-[#ea580c]", icon: "local_shipping", label: "Em Rota" },
  entregue: { color: "bg-[#16a34a]/10 text-[#16a34a]", icon: "inventory", label: "Entregue" },
  cancelado: { color: "bg-[#6b7280]/10 text-[#6b7280]", icon: "cancel", label: "Cancelado" },
};

export default function PurchaseOrderHistory({ franchiseId, refreshKey }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [loadingItems, setLoadingItems] = useState({});
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  useEffect(() => {
    if (!franchiseId) return;
    loadOrders();
  }, [franchiseId, refreshKey]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await PurchaseOrder.filter(
        { franchise_id: franchiseId },
        "-ordered_at"
      );
      setOrders(data);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);

    // Load items if not cached
    if (!orderItems[orderId]) {
      setLoadingItems((prev) => ({ ...prev, [orderId]: true }));
      try {
        const items = await PurchaseOrderItem.filter({ order_id: orderId });
        setOrderItems((prev) => ({ ...prev, [orderId]: items }));
      } catch (error) {
        console.error("Erro ao carregar itens do pedido:", error);
      } finally {
        setLoadingItems((prev) => ({ ...prev, [orderId]: false }));
      }
    }
  };

  const handleCancelOrder = async (orderId) => {
    setCancellingId(orderId);
    try {
      await PurchaseOrder.update(orderId, { status: 'cancelado' });
      toast.success("Pedido cancelado.");
      loadOrders();
    } catch (error) {
      console.error("Erro ao cancelar pedido:", error);
      toast.error(error?.message || "Erro ao cancelar pedido.");
    } finally {
      setCancellingId(null);
      setConfirmCancelId(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
    return (
      <Badge className={`${config.color} rounded-full px-2 py-0.5 text-[10px] font-bold gap-1`}>
        <MaterialIcon icon={config.icon} size={12} />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-[#cac0c0]" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MaterialIcon icon="shopping_bag" size={48} className="text-[#cac0c0] mb-3" />
        <h4 className="text-sm font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
          Nenhum pedido realizado ainda.
        </h4>
        <p className="text-xs text-[#4a3d3d]">
          Faca seu primeiro pedido clicando em "Fazer Pedido" acima.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta flex items-center gap-2">
        <MaterialIcon icon="history" size={18} className="text-[#b91c1c]" />
        Histórico de Pedidos
      </h3>

      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.id;
        const items = orderItems[order.id] || [];
        const isLoadingItems = loadingItems[order.id];

        return (
          <Card
            key={order.id}
            className="rounded-2xl shadow-sm border border-[#291715]/5 bg-white overflow-hidden"
          >
            <CardContent className="p-0">
              {/* Order header - clickable */}
              <button
                type="button"
                onClick={() => toggleExpand(order.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#fbf9fa] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#1b1c1d]">
                      {order.ordered_at
                        ? format(new Date(order.ordered_at), "dd/MM/yyyy 'as' HH:mm", {
                            locale: ptBR,
                          })
                        : "—"}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
                      {formatBRL(order.total_amount)}
                    </span>

                    {order.estimated_delivery && (
                      <span className="text-xs text-[#4a3d3d] flex items-center gap-1">
                        <MaterialIcon icon="calendar_today" size={12} />
                        Previsao:{" "}
                        {format(new Date(order.estimated_delivery), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    )}

                    {order.freight_cost != null && parseFloat(order.freight_cost) > 0 && (
                      <span className="text-xs text-[#4a3d3d] flex items-center gap-1">
                        <MaterialIcon icon="local_shipping" size={12} />
                        Frete: {formatBRL(order.freight_cost)}
                      </span>
                    )}
                  </div>
                </div>

                <MaterialIcon
                  icon={isExpanded ? "expand_less" : "expand_more"}
                  size={20}
                  className="text-[#4a3d3d] ml-2 flex-shrink-0"
                />
              </button>

              {/* Expanded items */}
              {isExpanded && (
                <div className="border-t border-[#cac0c0]/20 px-4 pb-4">
                  {isLoadingItems ? (
                    <div className="flex items-center justify-center py-4">
                      <MaterialIcon
                        icon="progress_activity"
                        size={18}
                        className="animate-spin text-[#cac0c0]"
                      />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="text-xs text-[#4a3d3d] py-3">Nenhum item encontrado.</p>
                  ) : (
                    <div className="space-y-2 pt-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-[#1b1c1d]">{item.product_name}</span>
                          </div>
                          <div className="flex items-center gap-4 ml-2">
                            <span className="text-[#4a3d3d]">
                              {item.quantity} x {formatBRL(item.unit_price)}
                            </span>
                            <span className="font-medium text-[#1b1c1d] min-w-[80px] text-right">
                              {formatBRL(
                                (parseFloat(item.quantity) || 0) *
                                  (parseFloat(item.unit_price) || 0)
                              )}
                            </span>
                          </div>
                        </div>
                      ))}

                      {order.notes && (
                        <div className="pt-2 mt-2 border-t border-[#cac0c0]/20">
                          <p className="text-xs text-[#4a3d3d]">
                            <span className="font-medium">Obs:</span> {order.notes}
                          </p>
                        </div>
                      )}

                      {/* Cancelar pedido pendente */}
                      {order.status === "pendente" && (
                        <div className="pt-3 mt-2 border-t border-[#cac0c0]/20">
                          {confirmCancelId === order.id ? (
                            <div className="flex items-center justify-between gap-2 bg-[#fbf9fa] rounded-xl p-3">
                              <span className="text-xs text-[#4a3d3d]">Cancelar este pedido?</span>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); setConfirmCancelId(null); }}
                                  disabled={cancellingId === order.id}
                                  className="h-7 text-xs border-[#cac0c0] text-[#4a3d3d] rounded-lg"
                                >
                                  Não
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                  disabled={cancellingId === order.id}
                                  className="h-7 text-xs bg-[#6b7280] hover:bg-[#4b5563] text-white rounded-lg gap-1"
                                >
                                  {cancellingId === order.id ? (
                                    <MaterialIcon icon="progress_activity" size={12} className="animate-spin" />
                                  ) : (
                                    <MaterialIcon icon="cancel" size={12} />
                                  )}
                                  Sim, cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setConfirmCancelId(order.id); }}
                              className="w-full h-8 text-xs text-[#6b7280] border-[#6b7280]/30 rounded-xl hover:bg-[#6b7280]/5 gap-1"
                            >
                              <MaterialIcon icon="cancel" size={14} />
                              Cancelar Pedido
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
