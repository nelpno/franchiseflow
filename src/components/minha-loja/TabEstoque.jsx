import React, { useState, useEffect, useRef, useMemo } from "react";
import { InventoryItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FilterBar from "@/components/shared/FilterBar";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const UNIT_OPTIONS = [
  { value: "un", label: "Unidade" },
  { value: "kg", label: "Quilograma" },
  { value: "pacote", label: "Pacote" },
];

const CATEGORY_OPTIONS = [
  "Massas",
  "Molhos",
  "Outros",
];

const MASSA_PREFIXES = ["canelone", "conchiglione", "massa", "nhoque", "rondelli", "sofioli"];
const MOLHO_PREFIXES = ["molho"];

function getCategoryFromName(name) {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  if (MASSA_PREFIXES.some((p) => lower.startsWith(p))) return "Massas";
  if (MOLHO_PREFIXES.some((p) => lower.startsWith(p))) return "Molhos";
  return "Outros";
}

const EMPTY_FORM = {
  product_name: "",
  category: "",
  quantity: "",
  unit: "un",
  min_stock: "",
  cost_price: "",
  sale_price: "",
};

export default function TabEstoque({
  franchiseId,
  currentUser,
  inventoryItems,
  saleItems = [],
  franchises = [],
  onRefresh,
}) {
  const [items, setItems] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStockLevel, setFilterStockLevel] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const editInputRef = useRef(null);

  const isAdmin = currentUser?.role === "admin";

  // Sync items from parent prop
  useEffect(() => {
    setItems(inventoryItems || []);
  }, [inventoryItems]);

  useEffect(() => {
    if (editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // --- Giro de estoque (last 28 days) ---

  const giroByItem = useMemo(() => {
    const cutoff = subDays(new Date(), 28).toISOString();
    const recentSaleItems = (saleItems || []).filter(
      (si) => si.created_at && si.created_at >= cutoff
    );

    const agg = {};
    recentSaleItems.forEach((si) => {
      const key = si.inventory_item_id;
      if (!key) return;
      agg[key] = (agg[key] || 0) + (parseFloat(si.quantity) || 0);
    });

    // Convert 28-day total to weekly rate
    const result = {};
    for (const [id, total] of Object.entries(agg)) {
      result[id] = total / 4; // 4 weeks
    }
    return result;
  }, [saleItems]);

  // --- Filtering ---

  const filteredItems = items.filter((item) => {
    const itemCategory = item.category || getCategoryFromName(item.product_name);
    const matchesSearch =
      !searchTerm ||
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemCategory?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || itemCategory === filterCategory;

    let matchesStockLevel = true;
    if (filterStockLevel === "low") {
      matchesStockLevel = (item.quantity || 0) > 0 && (item.quantity || 0) < (item.min_stock || 5);
    } else if (filterStockLevel === "out") {
      matchesStockLevel = (item.quantity || 0) === 0;
    } else if (filterStockLevel === "ok") {
      matchesStockLevel = (item.quantity || 0) >= (item.min_stock || 5);
    }

    return matchesSearch && matchesCategory && matchesStockLevel;
  });

  // --- Grouping by product type (first word of product_name) ---

  const itemGroups = useMemo(() => {
    const ORDER = ["Canelone", "Conchiglione", "Massa", "Nhoque", "Fatiado", "Rondelli", "Sofioli", "Molho"];
    const groups = [];
    const groupMap = {};

    filteredItems.forEach((item) => {
      const firstWord = item.product_name.split(" ")[0];
      const groupKey = ORDER.includes(firstWord) ? firstWord : "Outros";
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { label: groupKey, items: [] };
        groups.push(groupMap[groupKey]);
      }
      groupMap[groupKey].items.push(item);
    });

    groups.sort((a, b) => {
      const orderWithOutros = [...ORDER, "Outros"];
      const ai = orderWithOutros.indexOf(a.label);
      const bi = orderWithOutros.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return groups;
  }, [filteredItems]);

  // --- Inline edit ---

  const handleCellClick = (itemId, field, currentValue) => {
    setEditingCell({ itemId, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { itemId, field } = editingCell;
    const item = items.find((i) => i.id === itemId);
    const isIntField = field === "quantity" || field === "min_stock";
    const isFloatField = field === "sale_price" || field === "cost_price";
    const newValue = isIntField ? parseInt(editValue, 10) : parseFloat(editValue);

    if (isNaN(newValue) || newValue < 0) {
      toast.error("Valor inválido. Insira um número positivo.");
      setEditingCell(null);
      return;
    }

    if (Number(item[field]) === newValue) {
      setEditingCell(null);
      return;
    }

    // Minimum price validation for sale_price
    if (field === "sale_price" && item.cost_price && item.cost_price > 0) {
      const minPrice = item.cost_price * 1.8;
      if (newValue < minPrice) {
        toast.warning(
          `Preço mínimo recomendado: ${formatBRL(minPrice)} (margem 80%). Preço salvo mesmo assim.`
        );
      }
    }

    try {
      await InventoryItem.update(itemId, {
        [field]: newValue,
        updated_at: new Date().toISOString(),
      });

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, [field]: newValue, updated_at: new Date().toISOString() }
            : i
        )
      );
      const toastMsg = field === "sale_price" ? "Preço de venda atualizado." : "Estoque atualizado.";
      toast.success(toastMsg);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar estoque.");
    } finally {
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // --- Add product ---

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_FORM });
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name || "",
      category: item.category || getCategoryFromName(item.product_name),
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "un",
      min_stock: String(item.min_stock ?? ""),
      cost_price: String(item.cost_price ?? ""),
      sale_price: String(item.sale_price ?? ""),
    });
    setShowAddDialog(true);
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();

    if (!formData.product_name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        franchise_id: franchiseId,
        product_name: formData.product_name.trim(),
        category: formData.category || null,
        quantity: parseInt(formData.quantity, 10) || 0,
        unit: formData.unit,
        min_stock: parseInt(formData.min_stock, 10) || 0,
        cost_price: parseFloat(formData.cost_price) || null,
        sale_price: parseFloat(formData.sale_price) || null,
      };

      // Cost price: admin always edits; franchisee only for items they created
      if (!isAdmin && editingItem && !editingItem.created_by_franchisee) {
        delete payload.cost_price;
      }

      // Minimum price validation (warning only, not blocking)
      if (payload.sale_price && payload.cost_price && payload.cost_price > 0) {
        const minPrice = payload.cost_price * 1.8;
        if (payload.sale_price < minPrice) {
          toast.warning(
            `Preco minimo recomendado: ${formatBRL(minPrice)} (margem 80%). Salvo mesmo assim.`
          );
        }
      }

      if (editingItem) {
        const updated = await InventoryItem.update(editingItem.id, {
          ...payload,
          updated_at: new Date().toISOString(),
        });
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...updated } : i))
        );
        toast.success("Produto atualizado.");
      } else {
        const newItem = await InventoryItem.create({
          ...payload,
          created_by_franchisee: !isAdmin,
        });
        setItems((prev) => [newItem, ...prev]);
        toast.success("Produto adicionado ao estoque.");
      }

      setShowAddDialog(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      if (error?.code === "42501" || error?.message?.includes("policy")) {
        toast.error("Sem permissão para editar este produto.");
      } else if (error?.message?.includes("Tempo limite")) {
        toast.error("Salvamento demorou demais. Tente novamente.");
      } else {
        toast.error(`Erro ao salvar produto: ${error?.message || "tente novamente"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete product ---

  const handleDelete = async (item) => {
    try {
      await InventoryItem.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDeleteConfirmId(null);
      toast.success("Produto removido.");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao remover produto.");
    }
  };

  // --- CSV export ---

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error("Nenhum item para exportar.");
      return;
    }

    const headers = [
      "Produto",
      "Categoria",
      "Quantidade",
      "Unidade",
      "Estoque Mínimo",
      "Preço Custo",
      "Preço Venda",
      "Vendas por semana",
      "Última Atualização",
    ];

    const rows = filteredItems.map((item) => {
      const giro = giroByItem[item.id] || 0;
      return [
        item.product_name,
        item.category || getCategoryFromName(item.product_name),
        item.quantity,
        item.unit,
        item.min_stock,
        item.cost_price ?? "",
        item.sale_price ?? "",
        giro.toFixed(1),
        item.updated_at
          ? format(new Date(item.updated_at), "dd/MM/yyyy HH:mm", {
              locale: ptBR,
            })
          : "",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estoque_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  };

  // --- Helpers ---

  const getStockBadge = (item) => {
    if (!item.min_stock || item.min_stock <= 0) {
      return (
        <Badge className="bg-[#e9e8e9] text-[#4a3d3d] rounded-full px-2 py-0.5 text-[10px] font-bold">
          Sem minimo
        </Badge>
      );
    }
    if (item.quantity < item.min_stock) {
      return (
        <Badge className="bg-[#b91c1c]/10 text-[#b91c1c] rounded-full px-2 py-0.5 text-[10px] font-bold">
          <MaterialIcon icon="warning" size={12} className="mr-1" />
          Estoque baixo
        </Badge>
      );
    }
    return (
      <Badge className="bg-[#b91c1c]/10 text-[#9c4143] rounded-full px-2 py-0.5 text-[10px] font-bold">
        <MaterialIcon icon="check" size={12} className="mr-1" />
        OK
      </Badge>
    );
  };

  const getUnitLabel = (unit) => {
    const found = UNIT_OPTIONS.find((u) => u.value === unit);
    return found?.label || unit;
  };

  const getGiroBadge = (item) => {
    const giro = giroByItem[item.id] || 0;
    if (giro <= 0) return null;

    const stock = item.quantity || 0;
    let colorClass = "bg-[#9c4143]/10 text-[#9c4143]"; // green/ok

    if (stock <= giro * 0.5) {
      colorClass = "bg-[#b91c1c]/10 text-[#b91c1c]"; // red — will run out
    } else if (stock >= giro * 2) {
      colorClass = "bg-[#d4af37]/10 text-[#775a19]"; // amber — buying too much
    }

    return (
      <Badge className={`${colorClass} rounded-full px-2 py-0.5 text-[10px] font-bold`}>
        {giro.toFixed(1)} {item.unit || "un"}/sem
      </Badge>
    );
  };

  const getSugestaoCompra = (item) => {
    const giro = giroByItem[item.id] || 0;
    if (giro <= 0) return null;

    const stock = item.quantity || 0;
    const idealStock = Math.ceil(giro * 2);
    const toBuy = idealStock - stock;

    if (toBuy <= 0) return null;

    return (
      <Badge className="bg-[#d4af37]/10 text-[#775a19] rounded-full px-2 py-0.5 text-[10px] font-bold">
        <MaterialIcon icon="shopping_cart" size={12} className="mr-1" />
        Comprar {toBuy} {item.unit || "un"}
      </Badge>
    );
  };

  const formatBRL = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const canEditCostPrice = (item) => {
    if (isAdmin) return true;
    return !!item.created_by_franchisee;
  };

  // --- Margin helpers ---

  const getMarginPercent = (item) => {
    if (!item.cost_price || !item.sale_price || item.cost_price <= 0) return null;
    return ((item.sale_price - item.cost_price) / item.cost_price) * 100;
  };

  const getMarginBadge = (item) => {
    const margin = getMarginPercent(item);
    if (margin === null) return null;

    let colorClass = "bg-green-100 text-green-700"; // >= 80%
    if (margin < 50) {
      colorClass = "bg-red-100 text-red-700";
    } else if (margin < 80) {
      colorClass = "bg-[#d4af37]/10 text-[#775a19]";
    }

    return (
      <Badge className={`${colorClass} rounded-full px-1.5 py-0 text-[10px] font-bold ml-1`}>
        {margin.toFixed(0)}%
      </Badge>
    );
  };

  const getRecommendedPrice = (item) => {
    if (!item.cost_price || item.cost_price <= 0) return null;
    return item.cost_price * 2;
  };

  const getMinimumPrice = (item) => {
    if (!item.cost_price || item.cost_price <= 0) return null;
    return item.cost_price * 1.8;
  };

  // --- Stats ---

  const lowStockCount = filteredItems.filter(
    (i) => i.min_stock > 0 && i.quantity < i.min_stock
  ).length;

  const missingPriceCount = items.filter(
    (i) => i.sale_price === null || i.sale_price === undefined || i.sale_price === 0
  ).length;

  const totalProducts = filteredItems.length;

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-[#4a3d3d]">
            <span className="font-bold text-[#1b1c1d]">{totalProducts}</span> produtos
            {lowStockCount > 0 && (
              <Badge className="bg-[#b91c1c]/10 text-[#b91c1c] rounded-full px-2 py-0.5 text-[10px] font-bold ml-2">
                {lowStockCount} baixo
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="gap-2 border-[#cac0c0] text-[#4a3d3d] rounded-xl hover:bg-[#fbf9fa]"
            size="sm"
          >
            <MaterialIcon icon="upload" size={16} />
            CSV
          </Button>
          <Button
            onClick={handleOpenAddDialog}
            className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
            size="sm"
          >
            <MaterialIcon icon="add" size={16} />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por produto ou categoria..."
        filters={[
          {
            key: "category",
            label: "Categoria",
            value: filterCategory,
            onChange: setFilterCategory,
            options: [
              { value: "all", label: "Todas as categorias" },
              ...CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
            ],
          },
          {
            key: "stockLevel",
            label: "Nivel de estoque",
            value: filterStockLevel,
            onChange: setFilterStockLevel,
            options: [
              { value: "all", label: "Todos os niveis" },
              { value: "ok", label: "Estoque normal" },
              { value: "low", label: "Estoque baixo" },
              { value: "out", label: "Sem estoque" },
            ],
          },
        ]}
      />

      {/* Missing sale_price banner */}
      {missingPriceCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-xl">
          <MaterialIcon icon="warning" size={20} className="text-[#775a19] shrink-0" />
          <p className="text-sm text-[#775a19] flex-1">
            <strong>{missingPriceCount} de {items.length}</strong> produtos sem preco de venda definido.
            {" "}Clique no valor para editar.
          </p>
        </div>
      )}

      {/* Content */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="package_2" size={64} className="text-[#cac0c0] mb-4" />
          <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Nenhum produto encontrado
          </h3>
          <p className="text-sm text-[#4a3d3d] mb-4 max-w-sm">
            {searchTerm || filterCategory !== "all"
              ? "Nenhum produto corresponde aos filtros aplicados."
              : "Comece adicionando produtos ao estoque da sua loja."}
          </p>
          {!searchTerm && filterCategory === "all" && (
            <Button
              onClick={handleOpenAddDialog}
              className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
            >
              <MaterialIcon icon="add" size={18} />
              Adicionar Primeiro Produto
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-4">
            {itemGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#b91c1c] font-plus-jakarta px-1">
                  {group.label}
                </h3>
                {group.items.map((item) => {
                  const isLowStock =
                    item.min_stock > 0 && item.quantity < item.min_stock;

                  return (
                    <Card
                      key={item.id}
                      className={`rounded-2xl shadow-sm border ${
                        isLowStock
                          ? "border-[#b91c1c]/20 bg-[#b91c1c]/5"
                          : "border-[#291715]/5 bg-white"
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[#1b1c1d] truncate">
                              {item.product_name}
                            </h4>
                            <p className="text-xs text-[#4a3d3d]">
                              {item.category || getCategoryFromName(item.product_name)} · {getUnitLabel(item.unit)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#4a3d3d] hover:text-[#b91c1c]"
                              onClick={() => handleOpenEditDialog(item)}
                            >
                              <MaterialIcon icon="edit" size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#cac0c0] hover:text-[#b91c1c]"
                              onClick={() => setDeleteConfirmId(item.id)}
                            >
                              <MaterialIcon icon="delete" size={14} />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
                              Quantidade
                            </span>
                            <div
                              className="font-bold text-[#1b1c1d] cursor-pointer active:text-[#775a19] flex items-center gap-1 bg-[#e9e8e9]/50 rounded-lg px-2 py-1 min-h-[32px]"
                              onClick={() =>
                                handleCellClick(item.id, "quantity", item.quantity)
                              }
                            >
                              {editingCell?.itemId === item.id &&
                              editingCell?.field === "quantity" ? (
                                <Input
                                  ref={editInputRef}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full h-6 font-bold bg-transparent border-none rounded-none p-0 focus-visible:ring-0"
                                />
                              ) : (
                                <>
                                  <span>{item.quantity ?? 0} {item.unit}</span>
                                  <MaterialIcon icon="edit" size={12} className="text-[#4a3d3d]/40" />
                                </>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
                              Min.
                            </span>
                            <div
                              className="font-bold text-[#1b1c1d] cursor-pointer active:text-[#775a19] flex items-center gap-1 bg-[#e9e8e9]/50 rounded-lg px-2 py-1 min-h-[32px]"
                              onClick={() =>
                                handleCellClick(item.id, "min_stock", item.min_stock)
                              }
                            >
                              {editingCell?.itemId === item.id &&
                              editingCell?.field === "min_stock" ? (
                                <Input
                                  ref={editInputRef}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full h-6 font-bold bg-transparent border-none rounded-none p-0 focus-visible:ring-0"
                                />
                              ) : (
                                <>
                                  <span>{item.min_stock ?? 0}</span>
                                  <MaterialIcon icon="edit" size={12} className="text-[#4a3d3d]/40" />
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prices */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
                              Custo
                            </span>
                            <p className="text-[#4a3d3d]">{formatBRL(item.cost_price)}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
                              Venda
                            </span>
                            <div
                              className={`cursor-pointer active:text-[#775a19] flex items-center gap-1 bg-[#e9e8e9]/50 rounded-lg px-2 py-1 min-h-[32px] ${
                                !item.sale_price ? "text-[#b91c1c] font-medium" : "text-[#4a3d3d]"
                              }`}
                              onClick={() =>
                                handleCellClick(item.id, "sale_price", item.sale_price)
                              }
                            >
                              {editingCell?.itemId === item.id &&
                              editingCell?.field === "sale_price" ? (
                                <Input
                                  ref={editInputRef}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  placeholder={getRecommendedPrice(item) ? formatBRL(getRecommendedPrice(item)) : "0,00"}
                                  className="w-full h-6 bg-transparent border-none rounded-none p-0 focus-visible:ring-0"
                                />
                              ) : (
                                <>
                                  <span className="flex items-center gap-1">
                                    {item.sale_price ? (
                                      <>
                                        {formatBRL(item.sale_price)}
                                        {getMarginBadge(item)}
                                      </>
                                    ) : (
                                      <>
                                        <MaterialIcon icon="warning" size={12} className="text-[#b91c1c]" />
                                        Definir
                                      </>
                                    )}
                                  </span>
                                  <MaterialIcon icon="edit" size={12} className="text-[#4a3d3d]/40 ml-auto" />
</>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {getStockBadge(item)}
                          {getGiroBadge(item)}
                          {getSugestaoCompra(item)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <Card className="hidden md:block bg-white rounded-2xl shadow-sm border border-[#291715]/5">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#cac0c0]/30">
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Produto
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Categoria
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Qtd
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Un.
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Min.
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Custo
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Venda
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Giro
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                        Sugestao
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemGroups.map((group) => (
                      <React.Fragment key={group.label}>
                        <TableRow className="bg-[#fbf9fa] border-t border-[#291715]/10">
                          <TableCell colSpan={999} className="py-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-[#b91c1c] font-plus-jakarta">
                              {group.label}
                            </span>
                          </TableCell>
                        </TableRow>
                        {group.items.map((item) => {
                          const isLowStock =
                            item.min_stock > 0 && item.quantity < item.min_stock;

                          return (
                            <TableRow
                              key={item.id}
                              className={
                                isLowStock
                                  ? "bg-[#b91c1c]/5 hover:bg-[#b91c1c]/10"
                                  : "hover:bg-[#fbf9fa]"
                              }
                            >
                              <TableCell className="font-medium text-[#1b1c1d]">
                                {item.product_name}
                              </TableCell>

                              <TableCell className="text-sm text-[#4a3d3d]">
                                {item.category || getCategoryFromName(item.product_name)}
                              </TableCell>

                              {/* Quantity - inline edit */}
                              <TableCell className="text-center">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "quantity" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    className="w-20 mx-auto text-center h-8 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer px-2 py-1 rounded-lg hover:bg-[#d4af37]/10 hover:text-[#775a19] transition-colors inline-block min-w-[3rem]"
                                    onClick={() =>
                                      handleCellClick(item.id, "quantity", item.quantity)
                                    }
                                    title="Clique para editar"
                                  >
                                    {item.quantity ?? 0}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="text-sm text-[#4a3d3d]">
                                {getUnitLabel(item.unit)}
                              </TableCell>

                              {/* Min stock - inline edit */}
                              <TableCell className="text-center">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "min_stock" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    className="w-20 mx-auto text-center h-8 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer px-2 py-1 rounded-lg hover:bg-[#d4af37]/10 hover:text-[#775a19] transition-colors inline-block min-w-[3rem]"
                                    onClick={() =>
                                      handleCellClick(item.id, "min_stock", item.min_stock)
                                    }
                                    title="Clique para editar"
                                  >
                                    {item.min_stock ?? 0}
                                  </span>
                                )}
                              </TableCell>

                              {/* Cost price */}
                              <TableCell className="text-right text-sm text-[#4a3d3d]">
                                {formatBRL(item.cost_price)}
                              </TableCell>

                              {/* Sale price - inline edit */}
                              <TableCell className="text-right">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "sale_price" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    placeholder={getRecommendedPrice(item) ? formatBRL(getRecommendedPrice(item)) : "0,00"}
                                    className="w-24 ml-auto text-right h-8 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                                  />
                                ) : (
                                  <span
                                    className={`cursor-pointer px-2 py-1 rounded-lg hover:bg-[#d4af37]/10 hover:text-[#775a19] transition-colors inline-flex items-center gap-1 ${
                                      !item.sale_price
                                        ? "text-[#b91c1c] font-medium"
                                        : "text-[#4a3d3d]"
                                    }`}
                                    onClick={() =>
                                      handleCellClick(item.id, "sale_price", item.sale_price)
                                    }
                                    title="Clique para editar preço de venda"
                                  >
                                    {item.sale_price ? (
                                      <>
                                        {formatBRL(item.sale_price)}
                                        {getMarginBadge(item)}
                                      </>
                                    ) : (
                                      <>
                                        <MaterialIcon icon="warning" size={14} className="text-[#b91c1c]" />
                                        Definir
                                      </>
                                    )}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell>{getStockBadge(item)}</TableCell>

                              <TableCell>{getGiroBadge(item)}</TableCell>

                              <TableCell>{getSugestaoCompra(item)}</TableCell>

                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#4a3d3d] hover:text-[#b91c1c]"
                                    onClick={() => handleOpenEditDialog(item)}
                                  >
                                    <MaterialIcon icon="edit" size={16} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#cac0c0] hover:text-[#b91c1c]"
                                    onClick={() => setDeleteConfirmId(item.id)}
                                  >
                                    <MaterialIcon icon="delete" size={16} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add/Edit product dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-[#1b1c1d]">
              <MaterialIcon icon="inventory_2" size={20} className="text-[#b91c1c]" />
              {editingItem ? "Editar Produto" : "Adicionar Produto"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitProduct} className="space-y-4">
            {/* Product name */}
            <div className="space-y-2">
              <Label className="text-[#1b1c1d]">Nome do Produto *</Label>
              <Input
                value={formData.product_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    product_name: e.target.value,
                  }))
                }
                placeholder="Ex: Lasanha Bolonhesa 500g"
                required
                className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-[#1b1c1d]">Categoria</Label>
              <Select
                value={formData.category || "none"}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[#1b1c1d]">Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="0"
                  className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#1b1c1d]">Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, unit: val }))
                  }
                >
                  <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Min stock */}
            <div className="space-y-2">
              <Label className="text-[#1b1c1d]">Estoque Minimo</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.min_stock}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    min_stock: e.target.value,
                  }))
                }
                placeholder="0"
                className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
              />
              <p className="text-xs text-[#4a3d3d]">
                Você será alertado quando a quantidade ficar abaixo deste valor.
              </p>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[#1b1c1d]">
                  Preco de Custo (R$)
                  {!isAdmin && editingItem && !canEditCostPrice(editingItem) && (
                    <span className="text-[10px] text-[#4a3d3d] ml-1">(somente admin)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cost_price: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                  disabled={!isAdmin && editingItem && !canEditCostPrice(editingItem)}
                  className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#1b1c1d]">Preco de Venda (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sale_price: e.target.value,
                    }))
                  }
                  placeholder={formData.cost_price ? formatBRL(parseFloat(formData.cost_price) * 2) : "0,00"}
                  className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                />
                {formData.cost_price && parseFloat(formData.cost_price) > 0 && (
                  <p className="text-xs text-[#4a3d3d]">
                    Sugerido: {formatBRL(parseFloat(formData.cost_price) * 2)} (100% markup)
                    {formData.sale_price && parseFloat(formData.sale_price) > 0 && (
                      <span className={`ml-2 font-bold ${
                        ((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price) * 100) >= 80
                          ? "text-green-600"
                          : ((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price) * 100) >= 50
                            ? "text-[#775a19]"
                            : "text-red-600"
                      }`}>
                        Margem: {(((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price)) * 100).toFixed(0)}%
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isSubmitting}
                className="border-[#cac0c0] text-[#4a3d3d] rounded-xl hover:bg-[#fbf9fa]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl gap-2"
              >
                {isSubmitting ? (
                  <>
                    <MaterialIcon
                      icon="progress_activity"
                      size={16}
                      className="animate-spin"
                    />
                    Salvando...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon={editingItem ? "check" : "add"} size={18} />
                    {editingItem ? "Salvar" : "Adicionar"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-[#1b1c1d]">
              <MaterialIcon icon="delete" size={20} className="text-[#b91c1c]" />
              Confirmar Exclusao
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#4a3d3d]">
            Tem certeza que deseja remover{" "}
            <strong>
              {items.find((i) => i.id === deleteConfirmId)?.product_name}
            </strong>{" "}
            do estoque?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="border-[#cac0c0] text-[#4a3d3d] rounded-xl hover:bg-[#fbf9fa]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const item = items.find((i) => i.id === deleteConfirmId);
                if (item) handleDelete(item);
              }}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl gap-2"
            >
              <MaterialIcon icon="delete" size={16} />
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
