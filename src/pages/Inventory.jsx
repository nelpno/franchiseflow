import React, { useState, useEffect, useRef } from "react";
import { User, InventoryItem, Franchise } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import {
  Package,
  Plus,
  Download,
  AlertTriangle,
  Check,
  Trash2,
  Loader2,
  Search,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const UNIT_OPTIONS = [
  { value: "un", label: "Unidade" },
  { value: "kg", label: "Quilograma" },
  { value: "pacote", label: "Pacote" },
];

const CATEGORY_OPTIONS = [
  "Massas",
  "Molhos",
  "Recheios",
  "Embalagens",
  "Insumos",
  "Outros",
];

const EMPTY_FORM = {
  product_name: "",
  category: "",
  quantity: "",
  unit: "un",
  min_stock: "",
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [selectedFranchise, setSelectedFranchise] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const editInputRef = useRef(null);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const loadData = async () => {
    try {
      const [userData, franchisesData] = await Promise.all([
        User.me(),
        Franchise.list(),
      ]);

      setCurrentUser(userData);
      setFranchises(franchisesData);

      // RLS filtra automaticamente por permissao
      const inventoryData = await InventoryItem.list("-updated_at");
      setItems(inventoryData);

      // Pre-selecionar franquia se franqueado gerencia apenas uma
      if (
        userData.role !== "admin" &&
        userData.managed_franchise_ids?.length === 1
      ) {
        setSelectedFranchise(userData.managed_franchise_ids[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar inventario:", error);
      toast.error("Erro ao carregar dados do inventario.");
    } finally {
      setLoading(false);
    }
  };

  // --- Filtragem ---

  const filteredItems = items.filter((item) => {
    const matchesFranchise =
      selectedFranchise === "all" ||
      item.franchise_id === selectedFranchise;

    const matchesSearch =
      !searchTerm ||
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || item.category === filterCategory;

    return matchesFranchise && matchesSearch && matchesCategory;
  });

  // --- Inline edit ---

  const handleCellClick = (itemId, field, currentValue) => {
    setEditingCell({ itemId, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { itemId, field } = editingCell;
    const item = items.find((i) => i.id === itemId);
    const newValue = parseFloat(editValue);

    if (isNaN(newValue) || newValue < 0) {
      toast.error("Valor invalido. Insira um numero positivo.");
      setEditingCell(null);
      return;
    }

    // Nao salvar se nao mudou
    if (Number(item[field]) === newValue) {
      setEditingCell(null);
      return;
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
      toast.success("Estoque atualizado.");
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

  // --- Adicionar produto ---

  const handleOpenAddDialog = () => {
    const defaultFranchiseId =
      !isAdmin && currentUser?.managed_franchise_ids?.length === 1
        ? currentUser.managed_franchise_ids[0]
        : selectedFranchise !== "all"
          ? selectedFranchise
          : "";

    setFormData({ ...EMPTY_FORM, franchise_id: defaultFranchiseId });
    setShowAddDialog(true);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!formData.franchise_id) {
      toast.error("Selecione uma franquia.");
      return;
    }
    if (!formData.product_name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newItem = await InventoryItem.create({
        franchise_id: formData.franchise_id,
        product_name: formData.product_name.trim(),
        category: formData.category || null,
        quantity: parseFloat(formData.quantity) || 0,
        unit: formData.unit,
        min_stock: parseFloat(formData.min_stock) || 0,
      });

      setItems((prev) => [newItem, ...prev]);
      setShowAddDialog(false);
      toast.success("Produto adicionado ao inventario.");
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      toast.error("Erro ao adicionar produto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Deletar produto ---

  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir "${item.product_name}"? Esta acao nao pode ser desfeita.`
      )
    ) {
      return;
    }

    try {
      await InventoryItem.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Produto removido.");
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao remover produto.");
    }
  };

  // --- Exportar CSV (admin) ---

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error("Nenhum item para exportar.");
      return;
    }

    const getFranchiseName = (franchiseId) => {
      const f = franchises.find(
        (fr) => fr.id === franchiseId || fr.evolution_instance_id === franchiseId
      );
      return f?.city || f?.name || franchiseId || "";
    };

    const headers = [
      "Franquia",
      "Produto",
      "Categoria",
      "Quantidade",
      "Unidade",
      "Estoque Minimo",
      "Ultima Atualizacao",
    ];

    const rows = filteredItems.map((item) => [
      getFranchiseName(item.franchise_id),
      item.product_name,
      item.category || "",
      item.quantity,
      item.unit,
      item.min_stock,
      item.updated_at
        ? format(new Date(item.updated_at), "dd/MM/yyyy HH:mm", {
            locale: ptBR,
          })
        : "",
    ]);

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
    link.download = `inventario_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  };

  // --- Helpers ---

  const getFranchiseName = (franchiseId) => {
    const f = franchises.find(
      (fr) => fr.id === franchiseId || fr.evolution_instance_id === franchiseId
    );
    return f?.city || f?.name || franchiseId || "—";
  };

  const getStockBadge = (item) => {
    if (!item.min_stock || item.min_stock <= 0) {
      return <Badge className="bg-gray-100 text-gray-600">Sem minimo</Badge>;
    }
    if (item.quantity < item.min_stock) {
      return (
        <Badge className="bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Estoque baixo
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700">
        <Check className="h-3 w-3 mr-1" />
        OK
      </Badge>
    );
  };

  const getUnitLabel = (unit) => {
    const found = UNIT_OPTIONS.find((u) => u.value === unit);
    return found?.label || unit;
  };

  const availableFranchises = isAdmin
    ? franchises
    : franchises.filter((f) =>
        currentUser?.managed_franchise_ids?.includes(f.id) ||
        currentUser?.managed_franchise_ids?.includes(f.evolution_instance_id)
      );

  // --- Stats ---

  const lowStockCount = filteredItems.filter(
    (i) => i.min_stock > 0 && i.quantity < i.min_stock
  ).length;

  const totalProducts = filteredItems.length;

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-gray-500">Carregando inventario...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Package className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-500">
              Controle de estoque dos produtos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
          <Button onClick={handleOpenAddDialog} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Produtos</p>
              <p className="text-xl font-bold">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estoque Baixo</p>
              <p className="text-xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estoque OK</p>
              <p className="text-xl font-bold text-green-600">
                {totalProducts - lowStockCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por produto ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtro franquia (admin) */}
            {isAdmin && (
              <Select
                value={selectedFranchise}
                onValueChange={setSelectedFranchise}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Todas as franquias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as franquias</SelectItem>
                  {franchises.map((f) => (
                    <SelectItem
                      key={f.id || f.evolution_instance_id}
                      value={f.id || f.evolution_instance_id}
                    >
                      {f.city || f.name || f.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtro categoria */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <PackageOpen className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                Nenhum produto encontrado
              </h3>
              <p className="text-sm text-gray-500 mb-4 max-w-sm">
                {searchTerm || filterCategory !== "all"
                  ? "Nenhum produto corresponde aos filtros aplicados."
                  : "Comece adicionando produtos ao inventario da franquia."}
              </p>
              {!searchTerm && filterCategory === "all" && (
                <Button
                  onClick={handleOpenAddDialog}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Primeiro Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Franquia</TableHead>}
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-center">
                      Estoque Minimo
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock =
                      item.min_stock > 0 && item.quantity < item.min_stock;

                    return (
                      <TableRow
                        key={item.id}
                        className={
                          isLowStock
                            ? "bg-red-50/50 hover:bg-red-50"
                            : "hover:bg-gray-50"
                        }
                      >
                        {isAdmin && (
                          <TableCell className="font-medium text-sm">
                            {getFranchiseName(item.franchise_id)}
                          </TableCell>
                        )}

                        <TableCell className="font-medium">
                          {item.product_name}
                        </TableCell>

                        <TableCell className="text-sm text-gray-600">
                          {item.category || "—"}
                        </TableCell>

                        {/* Quantidade - inline edit */}
                        <TableCell className="text-center">
                          {editingCell?.itemId === item.id &&
                          editingCell?.field === "quantity" ? (
                            <Input
                              ref={editInputRef}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              className="w-20 mx-auto text-center h-8"
                            />
                          ) : (
                            <span
                              className="cursor-pointer px-2 py-1 rounded hover:bg-emerald-50 hover:text-emerald-700 transition-colors inline-block min-w-[3rem]"
                              onClick={() =>
                                handleCellClick(
                                  item.id,
                                  "quantity",
                                  item.quantity
                                )
                              }
                              title="Clique para editar"
                            >
                              {item.quantity ?? 0}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-sm">
                          {getUnitLabel(item.unit)}
                        </TableCell>

                        {/* Estoque minimo - inline edit */}
                        <TableCell className="text-center">
                          {editingCell?.itemId === item.id &&
                          editingCell?.field === "min_stock" ? (
                            <Input
                              ref={editInputRef}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              className="w-20 mx-auto text-center h-8"
                            />
                          ) : (
                            <span
                              className="cursor-pointer px-2 py-1 rounded hover:bg-emerald-50 hover:text-emerald-700 transition-colors inline-block min-w-[3rem]"
                              onClick={() =>
                                handleCellClick(
                                  item.id,
                                  "min_stock",
                                  item.min_stock
                                )
                              }
                              title="Clique para editar"
                            >
                              {item.min_stock ?? 0}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>{getStockBadge(item)}</TableCell>

                        <TableCell className="text-sm text-gray-500">
                          {item.updated_at
                            ? format(
                                new Date(item.updated_at),
                                "dd/MM/yy HH:mm",
                                { locale: ptBR }
                              )
                            : "—"}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add product dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Adicionar Produto
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddProduct} className="space-y-4">
            {/* Franquia */}
            {(isAdmin || availableFranchises.length > 1) && (
              <div className="space-y-2">
                <Label>Franquia *</Label>
                <Select
                  value={formData.franchise_id || ""}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, franchise_id: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a franquia" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFranchises.map((f) => (
                      <SelectItem
                        key={f.id || f.evolution_instance_id}
                        value={f.id || f.evolution_instance_id}
                      >
                        {f.city || f.name || f.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Nome do produto */}
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
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
              />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.category || "none"}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger>
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

            {/* Quantidade e Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, unit: val }))
                  }
                >
                  <SelectTrigger>
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

            {/* Estoque minimo */}
            <div className="space-y-2">
              <Label>Estoque Minimo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.min_stock}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    min_stock: e.target.value,
                  }))
                }
                placeholder="0"
              />
              <p className="text-xs text-gray-500">
                Voce sera alertado quando a quantidade ficar abaixo deste valor.
              </p>
            </div>

            {/* Botoes */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
