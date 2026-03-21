import React, { useState, useEffect, useMemo } from "react";
import { PurchaseOrder, PurchaseOrderItem, Franchise } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (value) => {
  if (value === null || value === undefined || value === "") return "\u2014";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const STATUS_CONFIG = {
  pendente: { color: "bg-[#d97706]/10 text-[#d97706]", icon: "schedule", label: "Pendente", order: 0 },
  confirmado: { color: "bg-[#2563eb]/10 text-[#2563eb]", icon: "check_circle", label: "Confirmado", order: 1 },
  em_rota: { color: "bg-[#ea580c]/10 text-[#ea580c]", icon: "local_shipping", label: "Em Rota", order: 2 },
  entregue: { color: "bg-[#16a34a]/10 text-[#16a34a]", icon: "inventory", label: "Entregue", order: 3 },
  cancelado: { color: "bg-[#6b7280]/10 text-[#6b7280]", icon: "cancel", label: "Cancelado", order: 4 },
};

const STATUS_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "confirmado", label: "Confirmados" },
  { value: "em_rota", label: "Em Rota" },
  { value: "entregue", label: "Entregues" },
  { value: "cancelado", label: "Cancelados" },
];

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [franchiseFilter, setFranchiseFilter] = useState("todos");

  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedFreight, setEditedFreight] = useState("");
  const [editedDeliveryDate, setEditedDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState(null); // { type: "entregue" | "cancelado", orderId }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, franchisesData] = await Promise.all([
        PurchaseOrder.list("-ordered_at"),
        Franchise.list(),
      ]);
      setOrders(ordersData);
      setFranchises(franchisesData);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  };

  const franchiseMap = useMemo(() => {
    const map = {};
    franchises.forEach((f) => {
      map[f.id] = f;
      if (f.evolution_instance_id) {
        map[f.evolution_instance_id] = f;
      }
    });
    return map;
  }, [franchises]);

  const getFranchiseName = (franchiseId) => {
    const f = franchiseMap[franchiseId];
    return f ? f.city || f.owner_name || "Franquia" : franchiseId || "Desconhecida";
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== "todos") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (franchiseFilter !== "todos") {
      result = result.filter((o) => o.franchise_id === franchiseFilter);
    }

    // Sort: pendente first, then by ordered_at desc
    result.sort((a, b) => {
      const statusA = STATUS_CONFIG[a.status]?.order ?? 99;
      const statusB = STATUS_CONFIG[b.status]?.order ?? 99;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0);
    });

    return result;
  }, [orders, statusFilter, franchiseFilter]);

  // Unique franchises present in orders for filter
  const orderFranchiseIds = useMemo(() => {
    const ids = new Set(orders.map((o) => o.franchise_id).filter(Boolean));
    return Array.from(ids);
  }, [orders]);

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
    return (
      <Badge className={`${config.color} rounded-full px-2 py-0.5 text-[10px] font-bold gap-1`}>
        <MaterialIcon icon={config.icon} size={12} />
        {config.label}
      </Badge>
    );
  };

  // --- Dialog logic ---

  const openOrderDetail = async (order) => {
    setSelectedOrder(order);
    setEditedFreight(order.freight_cost != null ? String(order.freight_cost) : "");
    setEditedDeliveryDate(order.estimated_delivery || "");
    setDialogOpen(true);
    setLoadingItems(true);
    setEditedQuantities({});

    try {
      const items = await PurchaseOrderItem.filter({ order_id: order.id });
      setOrderItems(items);
      const qtyMap = {};
      items.forEach((item) => {
        qtyMap[item.id] = item.quantity;
      });
      setEditedQuantities(qtyMap);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      toast.error("Erro ao carregar itens do pedido.");
    } finally {
      setLoadingItems(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
    setOrderItems([]);
    setEditedQuantities({});
  };

  const recalculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const qty = editedQuantities[item.id] ?? item.quantity ?? 0;
      return sum + qty * (parseFloat(item.unit_price) || 0);
    }, 0);
  };

  const handleSaveEdits = async () => {
    if (!selectedOrder) return;
    setSaving(true);

    try {
      const newTotal = recalculateTotal();

      // Update order
      await PurchaseOrder.update(selectedOrder.id, {
        freight_cost: editedFreight ? parseFloat(editedFreight) : null,
        estimated_delivery: editedDeliveryDate || null,
        total_amount: newTotal,
      });

      // Update items with changed quantities
      for (const item of orderItems) {
        const newQty = editedQuantities[item.id];
        if (newQty !== undefined && newQty !== item.quantity) {
          await PurchaseOrderItem.update(item.id, { quantity: newQty });
        }
      }

      toast.success("Pedido atualizado com sucesso!");
      closeDialog();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alteracoes.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedOrder) return;

    // Require confirmation for entregue and cancelado
    if (newStatus === "entregue" || newStatus === "cancelado") {
      setConfirmAction({ type: newStatus, orderId: selectedOrder.id });
      return;
    }

    await doStatusChange(selectedOrder.id, newStatus);
  };

  const doStatusChange = async (orderId, newStatus) => {
    setSaving(true);
    try {
      // Save any pending edits together with status change
      const updates = { status: newStatus };
      if (selectedOrder && orderId === selectedOrder.id) {
        const newTotal = recalculateTotal();
        updates.freight_cost = editedFreight ? parseFloat(editedFreight) : null;
        updates.estimated_delivery = editedDeliveryDate || null;
        updates.total_amount = newTotal;

        // Update items
        for (const item of orderItems) {
          const newQty = editedQuantities[item.id];
          if (newQty !== undefined && newQty !== item.quantity) {
            await PurchaseOrderItem.update(item.id, { quantity: newQty });
          }
        }
      }

      await PurchaseOrder.update(orderId, updates);

      if (newStatus === "entregue") {
        toast.success("Pedido entregue! Estoque da franquia atualizado.");
      } else if (newStatus === "cancelado") {
        toast.success("Pedido cancelado.");
      } else {
        const label = STATUS_CONFIG[newStatus]?.label || newStatus;
        toast.success(`Status alterado para ${label}.`);
      }

      closeDialog();
      loadData();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status do pedido.");
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  const confirmAndExecute = () => {
    if (confirmAction) {
      doStatusChange(confirmAction.orderId, confirmAction.type);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#cac0c0]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#b91c1c]/10 flex items-center justify-center">
          <MaterialIcon icon="local_shipping" size={22} className="text-[#b91c1c]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1b1c1d] font-plus-jakarta">
            Pedidos de Compra
          </h1>
          <p className="text-sm text-[#534343]">
            Gerencie os pedidos de todas as franquias
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white border-[#cac0c0]/30 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={franchiseFilter} onValueChange={setFranchiseFilter}>
          <SelectTrigger className="w-full sm:w-[220px] bg-white border-[#cac0c0]/30 rounded-xl">
            <SelectValue placeholder="Franquia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as Franquias</SelectItem>
            {orderFranchiseIds.map((fid) => (
              <SelectItem key={fid} value={fid}>
                {getFranchiseName(fid)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="local_shipping" size={48} className="text-[#cac0c0] mb-3" />
          <h4 className="text-sm font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Nenhum pedido recebido.
          </h4>
          <p className="text-xs text-[#534343]">
            Os pedidos das franquias aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#cac0c0]/30">
                        <TableHead className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Franquia
                        </TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Data Pedido
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Total
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Frete
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Status
                        </TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-[#f5f3f4]">
                          <TableCell className="font-medium text-[#1b1c1d]">
                            {getFranchiseName(order.franchise_id)}
                          </TableCell>
                          <TableCell className="text-sm text-[#4a3d3d]">
                            {order.ordered_at
                              ? format(new Date(order.ordered_at), "dd/MM/yyyy", { locale: ptBR })
                              : "\u2014"}
                          </TableCell>
                          <TableCell className="text-center text-sm font-medium text-[#1b1c1d]">
                            {formatBRL(order.total_amount)}
                          </TableCell>
                          <TableCell className="text-center text-sm text-[#4a3d3d]">
                            {order.freight_cost != null && parseFloat(order.freight_cost) > 0
                              ? formatBRL(order.freight_cost)
                              : "\u2014"}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(order.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openOrderDetail(order)}
                              className="text-[#b91c1c] hover:text-[#991b1b] hover:bg-[#b91c1c]/5 rounded-xl gap-1"
                            >
                              <MaterialIcon icon="visibility" size={16} />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="rounded-2xl shadow-sm border border-[#291715]/5 bg-white"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#1b1c1d] truncate font-plus-jakarta">
                        {getFranchiseName(order.franchise_id)}
                      </h4>
                      <p className="text-xs text-[#534343]">
                        {order.ordered_at
                          ? format(new Date(order.ordered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "\u2014"}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
                        {formatBRL(order.total_amount)}
                      </span>
                      {order.freight_cost != null && parseFloat(order.freight_cost) > 0 && (
                        <span className="text-xs text-[#534343] flex items-center gap-1">
                          <MaterialIcon icon="local_shipping" size={12} />
                          {formatBRL(order.freight_cost)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openOrderDetail(order)}
                      className="text-[#b91c1c] hover:text-[#991b1b] hover:bg-[#b91c1c]/5 rounded-xl gap-1"
                    >
                      <MaterialIcon icon="visibility" size={16} />
                      Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="receipt_long" size={20} className="text-[#b91c1c]" />
              Detalhes do Pedido
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              {/* Order info */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-[#1b1c1d]">
                  {getFranchiseName(selectedOrder.franchise_id)}
                </span>
                <span className="text-[#534343]">
                  {selectedOrder.ordered_at
                    ? format(new Date(selectedOrder.ordered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "\u2014"}
                </span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Items */}
              {loadingItems ? (
                <div className="flex items-center justify-center py-6">
                  <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-[#cac0c0]" />
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                    Itens do Pedido
                  </h4>
                  <div className="space-y-2">
                    {orderItems.map((item) => {
                      const qty = editedQuantities[item.id] ?? item.quantity ?? 0;
                      const lineTotal = qty * (parseFloat(item.unit_price) || 0);
                      const isEditable = selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado";

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2 border-b border-[#cac0c0]/15 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[#1b1c1d]">{item.product_name}</span>
                            <p className="text-xs text-[#534343]">
                              {formatBRL(item.unit_price)} / un
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={qty}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  setEditedQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
                                  }));
                                }}
                                className="w-16 text-center h-8 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                              />
                            ) : (
                              <span className="text-sm text-[#534343] w-16 text-center">
                                {qty}
                              </span>
                            )}
                            <span className="text-sm font-medium text-[#1b1c1d] min-w-[80px] text-right">
                              {formatBRL(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#cac0c0]/30">
                    <span className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta">Total dos Itens</span>
                    <span className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
                      {formatBRL(recalculateTotal())}
                    </span>
                  </div>
                </div>
              )}

              {/* Editable fields */}
              {selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Frete (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editedFreight}
                      onChange={(e) => setEditedFreight(e.target.value)}
                      placeholder="0,00"
                      className="h-9 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Previsão de Entrega
                    </Label>
                    <Input
                      type="date"
                      value={editedDeliveryDate}
                      onChange={(e) => setEditedDeliveryDate(e.target.value)}
                      className="h-9 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="p-3 bg-[#f5f3f4] rounded-xl">
                  <p className="text-xs text-[#534343]">
                    <span className="font-medium">Obs:</span> {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("cancelado")}
                      disabled={saving}
                      className="text-[#6b7280] border-[#6b7280]/30 rounded-xl hover:bg-[#6b7280]/5 gap-1"
                    >
                      <MaterialIcon icon="cancel" size={16} />
                      Cancelar Pedido
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveEdits}
                      disabled={saving}
                      className="border-[#cac0c0] text-[#534343] rounded-xl hover:bg-[#f5f3f4] gap-1"
                    >
                      <MaterialIcon icon="save" size={16} />
                      Salvar
                    </Button>
                  )}

                  {selectedOrder.status === "pendente" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange("confirmado")}
                      disabled={saving}
                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl gap-1"
                    >
                      <MaterialIcon icon="check_circle" size={16} />
                      Confirmar Pedido
                    </Button>
                  )}

                  {selectedOrder.status === "confirmado" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange("em_rota")}
                      disabled={saving}
                      className="bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded-xl gap-1"
                    >
                      <MaterialIcon icon="local_shipping" size={16} />
                      Marcar Em Rota
                    </Button>
                  )}

                  {selectedOrder.status === "em_rota" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange("entregue")}
                      disabled={saving}
                      className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl gap-1"
                    >
                      <MaterialIcon icon="inventory" size={16} />
                      Confirmar Entrega
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon
                icon={confirmAction?.type === "entregue" ? "inventory" : "cancel"}
                size={20}
                className={confirmAction?.type === "entregue" ? "text-[#16a34a]" : "text-[#6b7280]"}
              />
              {confirmAction?.type === "entregue" ? "Confirmar Entrega" : "Cancelar Pedido"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-[#534343]">
            {confirmAction?.type === "entregue"
              ? "Ao confirmar a entrega, o estoque da franquia será atualizado automaticamente. Essa ação não pode ser desfeita."
              : "Tem certeza que deseja cancelar este pedido? Essa ação não pode ser desfeita."}
          </p>

          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction(null)}
              disabled={saving}
              className="border-[#cac0c0] text-[#534343] rounded-xl"
            >
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={confirmAndExecute}
              disabled={saving}
              className={`font-bold rounded-xl gap-1 ${
                confirmAction?.type === "entregue"
                  ? "bg-[#16a34a] hover:bg-[#15803d] text-white"
                  : "bg-[#6b7280] hover:bg-[#4b5563] text-white"
              }`}
            >
              {saving ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : (
                <MaterialIcon
                  icon={confirmAction?.type === "entregue" ? "check_circle" : "cancel"}
                  size={16}
                />
              )}
              {confirmAction?.type === "entregue" ? "Confirmar" : "Cancelar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
