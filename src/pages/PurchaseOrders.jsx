import React, { useState, useEffect, useMemo, useRef } from "react";
import { PurchaseOrder, PurchaseOrderItem, Franchise, FranchiseConfiguration, addDefaultProduct } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { formatDateOnly } from "@/lib/dateOnly";
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
import FilterBar from "@/components/shared/FilterBar";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, isSameMonth } from "date-fns";
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

const PRODUCT_CATEGORIES = ["Massas", "Molhos", "Outros"];

const PRODUCT_UNITS = [
  { value: "un", label: "Unidade (un)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "pct", label: "Pacote (pct)" },
];

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
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [franchiseFilter, setFranchiseFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkChanging, setBulkChanging] = useState(false);
  const [confirmBulkAction, setConfirmBulkAction] = useState(null);

  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedFreight, setEditedFreight] = useState("");
  const [editedDeliveryDate, setEditedDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Ref to track current order load (race condition guard)
  const currentLoadRef = useRef(null);
  // Bulk PDF state
  const [generatingBulkPdf, setGeneratingBulkPdf] = useState(false);

  // Delete state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteAction, setConfirmDeleteAction] = useState(null); // { type: "single" | "bulk", orderId? }

  // New default product dialog
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    unit: "un",
    cost_price: "",
    min_stock: "5",
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState(null); // { type: "entregue" | "cancelado", orderId }

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        PurchaseOrder.list("-ordered_at"),
        Franchise.list(),
        FranchiseConfiguration.list(null, null, { columns: 'franchise_evolution_instance_id, franchise_name' }),
      ]);
      if (!mountedRef.current) return;

      const ordersData = results[0].status === "fulfilled" ? results[0].value : [];
      const franchisesData = results[1].status === "fulfilled" ? results[1].value : [];
      const configsData = results[2].status === "fulfilled" ? results[2].value : [];

      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["pedidos","franquias","configs"][i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setOrders(ordersData);
      setFranchises(franchisesData);
      setConfigs(configsData);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar pedidos:", error);
      const msg = error?.message || "";
      const userMsg = msg.includes("JWT") || msg.includes("expired") || error?.status === 401
        ? "Sessão expirada. Faça login novamente."
        : msg.includes("Tempo limite")
        ? "Servidor demorou para responder. Tente novamente."
        : msg || "Erro desconhecido ao carregar pedidos.";
      setLoadError(userMsg);
      toast.error(userMsg);
    } finally {
      if (mountedRef.current) setLoading(false);
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

  const configMap = useMemo(() => {
    const map = {};
    configs.forEach((c) => {
      if (c.franchise_evolution_instance_id) {
        map[c.franchise_evolution_instance_id] = c;
      }
    });
    return map;
  }, [configs]);

  const getFranchiseName = (franchiseId) => {
    const f = franchiseMap[franchiseId];
    const cfg = configMap[franchiseId] || configMap[f?.evolution_instance_id];
    return cfg?.franchise_name || f?.city || f?.owner_name || "Franquia";
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Filter by month — but always show pending/confirmed/em_rota (actionable orders)
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    result = result.filter((o) => {
      // Actionable orders always visible regardless of month
      if (o.status === "pendente" || o.status === "confirmado" || o.status === "em_rota") return true;
      if (!o.ordered_at) return false;
      const d = new Date(o.ordered_at);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    if (statusFilter !== "todos") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (franchiseFilter !== "todos") {
      result = result.filter((o) => o.franchise_id === franchiseFilter);
    }

    // Search by franchise name
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((o) => {
        const franchiseName = getFranchiseName(o.franchise_id).toLowerCase();
        return franchiseName.includes(term);
      });
    }

    // Sort: pendente first, then by ordered_at desc
    result.sort((a, b) => {
      const statusA = STATUS_CONFIG[a.status]?.order ?? 99;
      const statusB = STATUS_CONFIG[b.status]?.order ?? 99;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0);
    });

    return result;
  }, [orders, statusFilter, franchiseFilter, searchTerm, selectedMonth]);

  // Unique franchises present in orders for filter
  const orderFranchiseIds = useMemo(() => {
    const ids = new Set(orders.map((o) => o.franchise_id).filter(Boolean));
    return Array.from(ids);
  }, [orders]);

  const isOverdue = (order) => {
    if (order.status !== "pendente" && order.status !== "confirmado") return false;
    if (!order.ordered_at) return false;
    return differenceInDays(new Date(), parseISO(order.ordered_at.substring(0, 10))) > 7;
  };

  const getStatusBadge = (status, overdue) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <Badge className={`${config.color} rounded-full px-2 py-0.5 text-[10px] font-bold gap-1`}>
          <MaterialIcon icon={config.icon} size={12} />
          {config.label}
        </Badge>
        {overdue && (
          <Badge className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-[10px] font-bold gap-1">
            <MaterialIcon icon="warning" size={12} />
            ATRASADO
          </Badge>
        )}
      </div>
    );
  };

  // --- Dialog logic ---

  const openOrderDetail = async (order) => {
    const loadId = order.id;
    currentLoadRef.current = loadId;

    // Reset state BEFORE opening (prevents stale data flash)
    setOrderItems([]);
    setEditedQuantities({});
    setSelectedOrder(order);
    setEditedFreight(order.freight_cost != null ? String(order.freight_cost) : "");
    setEditedDeliveryDate(order.estimated_delivery || "");
    setDialogOpen(true);
    setLoadingItems(true);

    try {
      const items = await PurchaseOrderItem.filter({ order_id: order.id });
      // Discard stale response if user opened another order
      if (currentLoadRef.current !== loadId) return;
      setOrderItems(items);
      const qtyMap = {};
      items.forEach((item) => {
        qtyMap[item.id] = item.quantity;
      });
      setEditedQuantities(qtyMap);
    } catch (error) {
      if (currentLoadRef.current !== loadId) return;
      console.error("Erro ao carregar itens:", error);
      toast.error("Erro ao carregar itens do pedido.");
    } finally {
      if (currentLoadRef.current === loadId) {
        setLoadingItems(false);
      }
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

      // Only update items whose quantity actually changed (numeric comparison)
      const changedItems = orderItems.filter((item) => {
        const newQty = editedQuantities[item.id];
        return newQty !== undefined && parseFloat(newQty) !== parseFloat(item.quantity);
      });
      if (changedItems.length > 0) {
        await Promise.all(changedItems.map((item) =>
          PurchaseOrderItem.update(item.id, { quantity: editedQuantities[item.id] })
        ));
      }

      toast.success("Pedido atualizado com sucesso!");
      closeDialog();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error(error?.message || "Erro ao salvar alterações.");
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
      if (newStatus === 'entregue') {
        updates.delivered_at = new Date().toISOString();
      }
      if (selectedOrder && orderId === selectedOrder.id) {
        const newTotal = recalculateTotal();
        updates.freight_cost = editedFreight ? parseFloat(editedFreight) : null;
        updates.estimated_delivery = editedDeliveryDate || null;
        updates.total_amount = newTotal;

        // Only update items whose quantity actually changed (numeric comparison)
        const changedItems = orderItems.filter((item) => {
          const newQty = editedQuantities[item.id];
          return newQty !== undefined && parseFloat(newQty) !== parseFloat(item.quantity);
        });
        if (changedItems.length > 0) {
          await Promise.all(changedItems.map((item) =>
            PurchaseOrderItem.update(item.id, { quantity: editedQuantities[item.id] })
          ));
        }
      }

      await PurchaseOrder.update(orderId, updates);

      // Notificar franqueado sobre mudança de status (fire-and-forget — erro aqui NÃO afeta o status)
      try {
        const franchiseUUID = franchiseMap[selectedOrder?.franchise_id]?.id;
        if (franchiseUUID) {
          const statusMessages = {
            confirmado: { title: "Pedido confirmado", message: "Seu pedido de reposição foi confirmado pela fábrica.", icon: "check_circle" },
            em_rota: { title: "Pedido em rota", message: "Seu pedido está a caminho!", icon: "local_shipping" },
            entregue: { title: "Pedido entregue", message: "Seu pedido foi entregue — estoque atualizado automaticamente.", icon: "inventory" },
            cancelado: { title: "Pedido cancelado", message: "Seu pedido de reposição foi cancelado.", icon: "cancel" },
          };
          const msg = statusMessages[newStatus];
          if (msg) {
            await supabase.rpc('notify_franchise_users', {
              p_franchise_id: franchiseUUID,
              p_title: msg.title,
              p_message: msg.message,
              p_type: newStatus === "cancelado" ? "warning" : "info",
              p_icon: msg.icon,
              p_link: '/Gestao?tab=reposicao',
            });
          }
        }
      } catch { /* notificação é bonus, status já foi alterado */ }

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
      toast.error(error?.message || "Erro ao alterar status do pedido.");
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

  // --- Bulk status change ---
  const doBulkStatusChange = async () => {
    if (!confirmBulkAction) return;
    const { status: newStatus, orderIds } = confirmBulkAction;
    if (!orderIds || orderIds.length === 0 || !newStatus) {
      toast.error("Nenhum pedido válido para alterar.");
      setConfirmBulkAction(null);
      return;
    }
    setBulkChanging(true);
    try {
      const results = await Promise.allSettled(
        orderIds.map((id) => {
          const updates = { status: newStatus };
          if (newStatus === 'entregue') {
            updates.delivered_at = new Date().toISOString();
          }
          return PurchaseOrder.update(id, updates);
        })
      );

      // Notify franchisees (fire-and-forget)
      const statusMessages = {
        confirmado: { title: "Pedido confirmado", message: "Seu pedido de reposição foi confirmado pela fábrica.", icon: "check_circle", type: "info" },
        em_rota: { title: "Pedido em rota", message: "Seu pedido está a caminho!", icon: "local_shipping", type: "info" },
        entregue: { title: "Pedido entregue", message: "Seu pedido foi entregue — estoque atualizado automaticamente.", icon: "inventory", type: "info" },
      };
      const msg = statusMessages[newStatus];
      if (msg) {
        const uniqueFranchiseIds = [...new Set(orderIds.map((id) => {
          const o = orders.find((ord) => ord.id === id);
          return o ? franchiseMap[o.franchise_id]?.id : null;
        }).filter(Boolean))];
        uniqueFranchiseIds.forEach((fid) => {
          supabase.rpc('notify_franchise_users', {
            p_franchise_id: fid, p_title: msg.title, p_message: msg.message,
            p_type: msg.type, p_icon: msg.icon, p_link: '/Gestao?tab=reposicao',
          }).then(() => {}, () => {});
        });
      }

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failedResults = results.filter((r) => r.status === "rejected");
      if (failedResults.length > 0) {
        console.error("Bulk status failures:", failedResults.map((r) => r.reason));
        const firstError = failedResults[0]?.reason?.message || "Erro desconhecido";
        toast.warning(`${succeeded} alterado${succeeded > 1 ? "s" : ""}, ${failedResults.length} falhou: ${firstError}`);
      } else {
        toast.success(`${succeeded} pedido${succeeded > 1 ? "s" : ""} alterado${succeeded > 1 ? "s" : ""} para ${STATUS_CONFIG[newStatus]?.label}.`);
      }

      setSelectedIds(new Set());
      setBulkStatus("");
      loadData();
    } catch (error) {
      console.error("Erro ao alterar status em lote:", error);
      toast.error(error?.message || "Erro ao alterar status dos pedidos.");
    } finally {
      setBulkChanging(false);
      setConfirmBulkAction(null);
    }
  };

  // --- Delete logic ---

  const isDeletable = (order) => order.status === "pendente" || order.status === "cancelado";

  const toggleSelectOrder = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const deleteOrders = async (orderIds) => {
    setDeleting(true);
    const toastId = toast.loading(`Excluindo ${orderIds.length} pedido${orderIds.length > 1 ? "s" : ""}...`);
    try {
      for (const oid of orderIds) {
        // Delete items first (FK constraint)
        const items = await PurchaseOrderItem.filter({ order_id: oid });
        if (items.length > 0) {
          await Promise.all(items.map((item) => PurchaseOrderItem.delete(item.id)));
        }
        await PurchaseOrder.delete(oid);
      }
      toast.success(`${orderIds.length} pedido${orderIds.length > 1 ? "s excluídos" : " excluído"}.`, { id: toastId });
      setSelectedIds(new Set());
      closeDialog();
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error(error?.message || "Erro ao excluir pedido(s).", { id: toastId });
      loadData(); // re-sync after partial failure
    } finally {
      setDeleting(false);
      setConfirmDeleteAction(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (!confirmDeleteAction) return;
    if (confirmDeleteAction.type === "single") {
      deleteOrders([confirmDeleteAction.orderId]);
    } else {
      deleteOrders(Array.from(selectedIds));
    }
  };

  // --- Bulk Picking Sheet ---

  const handleBulkPickingSheet = async () => {
    if (selectedIds.size === 0) return;
    setGeneratingBulkPdf(true);
    const toastId = toast.loading("Gerando fichas de separação...");
    try {
      const selectedOrders = filteredOrders.filter((o) => selectedIds.has(o.id));
      const ordersWithItems = await Promise.all(
        selectedOrders.map(async (order) => {
          const items = await PurchaseOrderItem.filter({ order_id: order.id });
          return {
            order,
            items,
            franchiseName: getFranchiseName(order.franchise_id),
          };
        })
      );
      const { generateBulkPickingSheet } = await import("@/lib/pickingSheetPdf");
      await generateBulkPickingSheet(ordersWithItems);
      toast.success(`${ordersWithItems.length} fichas geradas!`, { id: toastId });
    } catch (err) {
      console.error("Erro ao gerar fichas:", err);
      toast.error(err?.message || "Erro ao gerar fichas.", { id: toastId });
    } finally {
      setGeneratingBulkPdf(false);
    }
  };

  // --- New Default Product ---

  const handleCreateDefaultProduct = async () => {
    const { name, category, unit, cost_price, min_stock } = newProduct;

    if (!name.trim() || !category) {
      toast.error("Preencha nome e categoria do produto.");
      return;
    }

    setSavingProduct(true);
    try {
      const count = await addDefaultProduct({
        name: name.trim(),
        category: category.toLowerCase(),
        unit,
        costPrice: cost_price ? parseFloat(cost_price) : null,
        minStock: min_stock ? parseInt(min_stock, 10) : 5,
      });

      toast.success(`Produto adicionado a ${count} franquia${count !== 1 ? "s" : ""}.`);
      setNewProductOpen(false);
      setNewProduct({ name: "", category: "", unit: "un", cost_price: "", min_stock: "5" });
    } catch (error) {
      console.error("Erro ao criar produto padrão:", error);
      toast.error("Erro ao criar produto padrão.");
    } finally {
      setSavingProduct(false);
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

  if (loadError) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MaterialIcon icon="cloud_off" className="text-5xl text-[#7a6d6d]" />
          <p className="text-[#4a3d3d] text-center">{loadError}</p>
          <Button variant="outline" onClick={loadData} className="mt-2">
            <MaterialIcon icon="refresh" className="mr-2 text-lg" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hidden md:flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#b91c1c]/10 flex items-center justify-center">
            <MaterialIcon icon="local_shipping" size={22} className="text-[#b91c1c]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1b1c1d] font-plus-jakarta">
              Pedidos de Compra
            </h1>
            <p className="text-sm text-[#4a3d3d]">
              Gerencie os pedidos de todas as franquias
            </p>
          </div>
        </div>
        <Button
          onClick={() => setNewProductOpen(true)}
          className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl gap-1.5"
        >
          <MaterialIcon icon="add_circle" size={18} />
          <span className="hidden sm:inline">Novo Produto Padrão</span>
          <span className="sm:hidden">Produto</span>
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMonth((m) => subMonths(m, 1))}
          className="hover:bg-[#b91c1c]/5 rounded-xl"
        >
          <MaterialIcon icon="chevron_left" size={20} />
        </Button>
        <span className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta min-w-[160px] text-center capitalize">
          {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          disabled={isSameMonth(selectedMonth, new Date())}
          className="hover:bg-[#b91c1c]/5 rounded-xl"
        >
          <MaterialIcon icon="chevron_right" size={20} />
        </Button>
      </div>

      {/* Summary Stats */}
      {(() => {
        const monthOrders = filteredOrders;
        const pendentes = monthOrders.filter(o => o.status === "pendente" || o.status === "confirmado");
        const emRota = monthOrders.filter(o => o.status === "em_rota");
        const entregues = monthOrders.filter(o => o.status === "entregue");
        const pendentesTotal = pendentes.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

        // Tempo médio de entrega
        const entregas = entregues.filter(o => o.ordered_at && o.delivered_at);
        let tempoMedio = null;
        if (entregas.length > 0) {
          const totalHours = entregas.reduce((sum, o) => {
            return sum + (new Date(o.delivered_at) - new Date(o.ordered_at)) / (1000 * 60 * 60);
          }, 0);
          const avgHours = totalHours / entregas.length;
          const days = Math.floor(avgHours / 24);
          const hours = Math.round(avgHours % 24);
          tempoMedio = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        }

        const stats = [
          { icon: "schedule", label: "Pendentes", value: pendentes.length, detail: pendentesTotal > 0 ? formatBRL(pendentesTotal) : null, color: "#d97706" },
          { icon: "local_shipping", label: "Em Rota", value: emRota.length, color: "#ea580c" },
          { icon: "inventory", label: "Entregues", value: entregues.length, detail: tempoMedio ? `média ${tempoMedio}` : null, color: "#16a34a" },
          { icon: "timer", label: "Tempo Médio", value: tempoMedio || "—", detail: entregas.length > 0 ? `${entregas.length} entrega${entregas.length > 1 ? "s" : ""}` : "sem dados", color: "#2563eb" },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-white p-4 rounded-2xl shadow-sm border border-[#291715]/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + "15", color: s.color }}>
                    <MaterialIcon icon={s.icon} size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1b1c1d]/60 font-plus-jakarta">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-[#1b1c1d]">{s.value}</p>
                {s.detail && <p className="text-xs text-[#4a3d3d] mt-0.5">{s.detail}</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por franquia..."
        filters={[
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: STATUS_FILTER_OPTIONS,
          },
          {
            key: "franchise",
            label: "Franquia",
            value: franchiseFilter,
            onChange: setFranchiseFilter,
            options: [
              { value: "todos", label: "Todas as Franquias" },
              ...orderFranchiseIds.map((fid) => ({
                value: fid,
                label: getFranchiseName(fid),
              })),
            ],
          },
        ]}
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#b91c1c]/5 border border-[#b91c1c]/20 rounded-xl px-4 py-3">
          <span className="text-sm text-[#1b1c1d] font-medium">
            {selectedIds.size} pedido{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Bulk status change */}
            {(() => {
              const selectedStatuses = new Set(
                Array.from(selectedIds).map((id) => filteredOrders.find((o) => o.id === id)?.status).filter(Boolean)
              );
              const hasNonFinal = Array.from(selectedIds).some((id) => {
                const o = filteredOrders.find((fo) => fo.id === id);
                return o && o.status !== "entregue" && o.status !== "cancelado";
              });
              if (!hasNonFinal) return null;

              const statusOptions = [
                { value: "confirmado", label: "Confirmar" },
                { value: "em_rota", label: "Em Rota" },
                { value: "entregue", label: "Entregue" },
              ].filter((opt) => !selectedStatuses.has(opt.value) || selectedStatuses.size > 1);

              return (
                <>
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger className="w-[130px] h-8 bg-white border-[#cac0c0] rounded-xl text-xs">
                      <SelectValue placeholder="Alterar para..." />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!bulkStatus || bulkChanging}
                    onClick={() => {
                      const ids = Array.from(selectedIds).filter((id) => {
                        const o = filteredOrders.find((fo) => fo.id === id);
                        return o && o.status !== "entregue" && o.status !== "cancelado";
                      });
                      setConfirmBulkAction({ status: bulkStatus, orderIds: ids });
                    }}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl gap-1 text-xs"
                  >
                    <MaterialIcon icon="sync" size={14} />
                    {bulkChanging ? "Alterando..." : "Aplicar"}
                  </Button>
                </>
              );
            })()}

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectedIds(new Set()); setBulkStatus(""); }}
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl text-xs"
            >
              Limpar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkPickingSheet}
              disabled={generatingBulkPdf}
              className="text-[#d4af37] border-[#d4af37]/30 rounded-xl text-xs gap-1"
            >
              <MaterialIcon icon="print" size={14} />
              <span className="hidden sm:inline">{generatingBulkPdf ? "Gerando..." : "Fichas de Separação"}</span>
              <span className="sm:hidden">{generatingBulkPdf ? "..." : "Fichas"}</span>
            </Button>
            {Array.from(selectedIds).every((id) => {
              const o = filteredOrders.find((fo) => fo.id === id);
              return o && isDeletable(o);
            }) && (
              <Button
                size="sm"
                onClick={() => setConfirmDeleteAction({ type: "bulk" })}
                disabled={deleting}
                className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold rounded-xl gap-1 text-xs"
              >
                <MaterialIcon icon="delete" size={14} />
                <span className="hidden sm:inline">Excluir Selecionados</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="local_shipping" size={48} className="text-[#cac0c0] mb-3" />
          <h4 className="text-sm font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Nenhum pedido recebido.
          </h4>
          <p className="text-xs text-[#4a3d3d]">
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
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id))}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-[#cac0c0] text-[#b91c1c] focus:ring-[#b91c1c]/20"
                          />
                        </TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Franquia
                        </TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Data Pedido
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Total
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Frete
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Status
                        </TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const overdue = isOverdue(order);
                        return (
                          <TableRow
                            key={order.id}
                            className={
                              overdue
                                ? "bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100/60"
                                : "hover:bg-[#fbf9fa]"
                            }
                          >
                            <TableCell className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(order.id)}
                                onChange={() => toggleSelectOrder(order.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-[#cac0c0] text-[#b91c1c] focus:ring-[#b91c1c]/20"
                              />
                            </TableCell>
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
                              {getStatusBadge(order.status, overdue)}
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const overdue = isOverdue(order);
              return (
              <Card
                key={order.id}
                className={`rounded-2xl shadow-sm border bg-white ${
                  overdue
                    ? "border-red-300 border-l-4 border-l-red-500 bg-red-50"
                    : "border-[#291715]/5"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleSelectOrder(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 mt-1 mr-3 flex-shrink-0 rounded border-[#cac0c0] text-[#b91c1c] focus:ring-[#b91c1c]/20"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#1b1c1d] truncate font-plus-jakarta">
                        {getFranchiseName(order.franchise_id)}
                      </h4>
                      <p className="text-xs text-[#4a3d3d]">
                        {order.ordered_at
                          ? format(new Date(order.ordered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "\u2014"}
                      </p>
                    </div>
                    {getStatusBadge(order.status, overdue)}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
                        {formatBRL(order.total_amount)}
                      </span>
                      {order.freight_cost != null && parseFloat(order.freight_cost) > 0 && (
                        <span className="text-xs text-[#4a3d3d] flex items-center gap-1">
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
              );
            })}
          </div>
        </>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="receipt_long" size={20} className="text-[#b91c1c]" />
              Detalhes do Pedido
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="flex flex-col min-h-0 flex-1">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pr-1">
              {/* Order info */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-[#1b1c1d]">
                  {getFranchiseName(selectedOrder.franchise_id)}
                </span>
                {getStatusBadge(selectedOrder.status, isOverdue(selectedOrder))}
              </div>

              {/* Timeline logística */}
              <div className="bg-[#fbf9fa] rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[#4a3d3d]">
                    <MaterialIcon icon="shopping_cart" size={14} className="text-[#d97706]" />
                    <span className="font-medium">Pedido:</span>
                    {selectedOrder.ordered_at
                      ? format(new Date(selectedOrder.ordered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </span>
                  {selectedOrder.estimated_delivery && (
                    <span className="flex items-center gap-1.5 text-[#4a3d3d]">
                      <MaterialIcon icon="event" size={14} className="text-[#2563eb]" />
                      <span className="font-medium">Previsão:</span>
                      {formatDateOnly(selectedOrder.estimated_delivery)}
                    </span>
                  )}
                  {selectedOrder.delivered_at && (
                    <span className="flex items-center gap-1.5 text-[#16a34a]">
                      <MaterialIcon icon="check_circle" size={14} />
                      <span className="font-medium">Entregue:</span>
                      {format(new Date(selectedOrder.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {selectedOrder.delivered_at && selectedOrder.ordered_at && (() => {
                  const diffMs = new Date(selectedOrder.delivered_at) - new Date(selectedOrder.ordered_at);
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const wasLate = selectedOrder.estimated_delivery &&
                    new Date(selectedOrder.delivered_at) > new Date(selectedOrder.estimated_delivery + 'T23:59:59');
                  return (
                    <div className="flex items-center gap-2 pt-1 border-t border-[#cac0c0]/20">
                      <span className={`flex items-center gap-1 text-xs font-medium ${wasLate ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                        <MaterialIcon icon="timer" size={14} />
                        Tempo de atendimento: {diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`}
                        {wasLate && ' (atrasado)'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Items */}
              {loadingItems ? (
                <div className="flex items-center justify-center py-6">
                  <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-[#cac0c0]" />
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
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
                            <p className="text-xs text-[#4a3d3d]">
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
                              <span className="text-sm text-[#4a3d3d] w-16 text-center">
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

                  {/* Total dos Itens */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#cac0c0]/30">
                    <span className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta">Total dos Itens</span>
                    <span className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
                      {formatBRL(recalculateTotal())}
                    </span>
                  </div>

                  {/* Frete + Total do Pedido */}
                  {(parseFloat(editedFreight) || 0) > 0 && (
                    <>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-[#4a3d3d]">Frete</span>
                        <span className="text-sm text-[#4a3d3d]">
                          {formatBRL(parseFloat(editedFreight))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#cac0c0]/30">
                        <span className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta">Total do Pedido</span>
                        <span className="text-lg font-bold text-[#b91c1c] font-plus-jakarta">
                          {formatBRL(recalculateTotal() + parseFloat(editedFreight))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Editable fields */}
              {selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
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
                    <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
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
                <div className="p-3 bg-[#fbf9fa] rounded-xl">
                  <p className="text-xs text-[#4a3d3d]">
                    <span className="font-medium">Obs:</span> {selectedOrder.notes}
                  </p>
                </div>
              )}

            </div>
              {/* Action buttons — outside scroll area */}
              <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-between border-t border-[#cac0c0]/20 pt-3 mt-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { generatePickingSheet } = await import("@/lib/pickingSheetPdf");
                        await generatePickingSheet({
                          order: selectedOrder,
                          items: orderItems,
                          franchiseName: getFranchiseName(selectedOrder.franchise_id),
                          editedQuantities,
                        });
                        toast.success("Ficha de separacao gerada!");
                      } catch (err) {
                        console.error("Erro ao gerar ficha:", err);
                        toast.error(safeErrorMessage(err, "Erro ao gerar ficha de separação."));
                      }
                    }}
                    disabled={loadingItems || orderItems.length === 0}
                    className="text-[#d4af37] border-[#d4af37]/30 rounded-xl hover:bg-[#d4af37]/5 gap-1"
                  >
                    <MaterialIcon icon="print" size={16} />
                    Ficha de Separacao
                  </Button>
                  {selectedOrder.status !== "entregue" && selectedOrder.status !== "cancelado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("cancelado")}
                      disabled={saving || deleting}
                      className="text-[#6b7280] border-[#6b7280]/30 rounded-xl hover:bg-[#6b7280]/5 gap-1"
                    >
                      <MaterialIcon icon="cancel" size={16} />
                      Cancelar Pedido
                    </Button>
                  )}
                  {isDeletable(selectedOrder) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDeleteAction({ type: "single", orderId: selectedOrder.id })}
                      disabled={saving || deleting}
                      className="text-[#dc2626] border-[#dc2626]/30 rounded-xl hover:bg-[#dc2626]/5 gap-1"
                    >
                      <MaterialIcon icon="delete" size={16} />
                      Excluir
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
                      className="border-[#cac0c0] text-[#4a3d3d] rounded-xl hover:bg-[#fbf9fa] gap-1"
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

          <p className="text-sm text-[#4a3d3d]">
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
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl"
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

      {/* Bulk Status Confirmation Dialog */}
      <Dialog open={!!confirmBulkAction} onOpenChange={(open) => { if (!open) setConfirmBulkAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon
                icon={STATUS_CONFIG[confirmBulkAction?.status]?.icon || "sync"}
                size={20}
                style={{ color: STATUS_CONFIG[confirmBulkAction?.status]?.icon ? undefined : "#2563eb" }}
                className={confirmBulkAction?.status === "entregue" ? "text-[#16a34a]" : confirmBulkAction?.status === "em_rota" ? "text-[#ea580c]" : "text-[#2563eb]"}
              />
              Alterar {confirmBulkAction?.orderIds?.length} pedido{confirmBulkAction?.orderIds?.length > 1 ? "s" : ""} para {STATUS_CONFIG[confirmBulkAction?.status]?.label}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-[#4a3d3d]">
            {confirmBulkAction?.status === "entregue"
              ? `O estoque de ${confirmBulkAction?.orderIds?.length} franquia(s) será atualizado automaticamente. Essa ação não pode ser desfeita.`
              : `Alterar o status de ${confirmBulkAction?.orderIds?.length} pedido${confirmBulkAction?.orderIds?.length > 1 ? "s" : ""} para "${STATUS_CONFIG[confirmBulkAction?.status]?.label}".`}
          </p>

          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulkAction(null)}
              disabled={bulkChanging}
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={doBulkStatusChange}
              disabled={bulkChanging}
              className={`font-bold rounded-xl gap-1 ${
                confirmBulkAction?.status === "entregue" ? "bg-[#16a34a] hover:bg-[#15803d] text-white"
                : confirmBulkAction?.status === "em_rota" ? "bg-[#ea580c] hover:bg-[#c2410c] text-white"
                : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              }`}
            >
              {bulkChanging ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : (
                <MaterialIcon icon={STATUS_CONFIG[confirmBulkAction?.status]?.icon || "sync"} size={16} />
              )}
              {bulkChanging ? "Alterando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteAction} onOpenChange={(open) => { if (!open) setConfirmDeleteAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="delete" size={20} className="text-[#dc2626]" />
              Excluir Pedido{confirmDeleteAction?.type === "bulk" && selectedIds.size > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-[#4a3d3d]">
            {confirmDeleteAction?.type === "bulk"
              ? `Excluir ${selectedIds.size} pedido${selectedIds.size > 1 ? "s" : ""} permanentemente? Essa ação não pode ser desfeita.`
              : "Excluir este pedido permanentemente? Essa ação não pode ser desfeita."}
          </p>

          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteAction(null)}
              disabled={deleting}
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl"
            >
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold rounded-xl gap-1"
            >
              {deleting ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : (
                <MaterialIcon icon="delete" size={16} />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Default Product Dialog */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="add_circle" size={20} className="text-[#b91c1c]" />
              Novo Produto Padrão
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-[#4a3d3d]">
            O produto será adicionado ao estoque de todas as franquias existentes.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                Nome do Produto *
              </Label>
              <Input
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Nhoque Quatro Queijos"
                className="h-9 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                Categoria *
              </Label>
              <Select
                value={newProduct.category}
                onValueChange={(val) => setNewProduct((p) => ({ ...p, category: val }))}
              >
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                Unidade
              </Label>
              <Select
                value={newProduct.unit}
                onValueChange={(val) => setNewProduct((p) => ({ ...p, unit: val }))}
              >
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                  Custo Unitário (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.cost_price}
                  onChange={(e) => setNewProduct((p) => ({ ...p, cost_price: e.target.value }))}
                  placeholder="0,00"
                  className="h-9 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                  Estoque Mínimo
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={newProduct.min_stock}
                  onChange={(e) => setNewProduct((p) => ({ ...p, min_stock: e.target.value }))}
                  className="h-9 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewProductOpen(false)}
              disabled={savingProduct}
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateDefaultProduct}
              disabled={savingProduct || !newProduct.name.trim() || !newProduct.category}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl gap-1"
            >
              {savingProduct ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : (
                <MaterialIcon icon="add_circle" size={16} />
              )}
              Adicionar a Todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
