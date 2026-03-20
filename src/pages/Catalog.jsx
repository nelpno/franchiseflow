import React, { useState, useEffect, useCallback, useRef } from "react";
import { CatalogProduct } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  X,
  Loader2,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";

const CATEGORIES = [
  { value: "Massas", label: "Massas" },
  { value: "Molhos", label: "Molhos" },
  { value: "Sobremesas", label: "Sobremesas" },
  { value: "Combos", label: "Combos" },
  { value: "Outros", label: "Outros" },
];

const CATEGORY_COLORS = {
  Massas: "bg-amber-100 text-amber-800",
  Molhos: "bg-red-100 text-red-800",
  Sobremesas: "bg-pink-100 text-pink-800",
  Combos: "bg-blue-100 text-blue-800",
  Outros: "bg-gray-100 text-gray-800",
};

function formatPrice(value) {
  if (value == null || value === "") return "";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ── Image Upload Helper ──────────────────────────────────────────────
async function uploadImage(file) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("catalog-images")
    .upload(fileName, file);
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from("catalog-images").getPublicUrl(fileName);
  return publicUrl;
}

// ── Product Form Dialog ──────────────────────────────────────────────
function ProductFormDialog({ open, onOpenChange, product, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Massas");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const isEditing = !!product;

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setCategory(product.category || "Massas");
      setPrice(product.price != null ? String(product.price) : "");
      setActive(product.active !== false);
      setImageUrl(product.image_path || "");
    } else {
      setName("");
      setDescription("");
      setCategory("Massas");
      setPrice("");
      setActive(true);
      setImageUrl("");
    }
  }, [product, open]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    try {
      setUploading(true);
      const url = await uploadImage(file);
      setImageUrl(url);
      toast.success("Imagem enviada com sucesso.");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("O nome do produto é obrigatório.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        price: price ? parseFloat(price.replace(",", ".")) : null,
        active,
        image_path: imageUrl || null,
      };

      if (isEditing) {
        await CatalogProduct.update(product.id, payload);
        toast.success("Produto atualizado.");
      } else {
        await CatalogProduct.create(payload);
        toast.success("Produto criado.");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(isEditing ? "Erro ao atualizar produto." : "Erro ao criar produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Image upload */}
          <div>
            <Label>Imagem</Label>
            <div
              className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-500">Enviando...</span>
                </div>
              ) : imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="mx-auto max-h-40 rounded-md object-contain"
                  />
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageUrl("");
                    }}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-gray-400">
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">
                    Arraste uma imagem ou clique para selecionar
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="product-name">Nome *</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lasanha Bolonhesa"
              className="mt-1"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="product-desc">Descrição</Label>
            <Textarea
              id="product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição breve do produto"
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Category + Price row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product-price">Preço (R$)</Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className="mt-1"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Produto ativo</Label>
              <p className="text-xs text-gray-500">
                Produtos inativos não aparecem para franqueados
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                "Salvar Alterações"
              ) : (
                "Criar Produto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation Dialog ───────────────────────────────────────
function DeleteDialog({ open, onOpenChange, product, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await CatalogProduct.delete(product.id);
      toast.success("Produto excluído.");
      onOpenChange(false);
      onConfirm();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir produto.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Excluir Produto</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 py-2">
          Tem certeza que deseja excluir{" "}
          <span className="font-semibold">{product?.name}</span>? Esta ação não
          pode ser desfeita.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Product Card ─────────────────────────────────────────────────────
function ProductCard({ product, isAdmin, onEdit, onDelete }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {product.image_path ? (
          <img
            src={product.image_path}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {!product.active && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge variant="secondary" className="bg-white/90 text-gray-700">
              <EyeOff className="mr-1 h-3 w-3" />
              Inativo
            </Badge>
          </div>
        )}
        {/* Admin actions overlay */}
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-white/90 hover:bg-white shadow"
              onClick={() => onEdit(product)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-white/90 hover:bg-red-50 shadow text-red-600"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2">
            {product.name}
          </h3>
        </div>

        {product.description && (
          <p className="text-sm text-gray-500 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <Badge
            variant="secondary"
            className={CATEGORY_COLORS[product.category] || CATEGORY_COLORS.Outros}
          >
            {product.category || "Outros"}
          </Badge>
          {product.price != null && (
            <span className="text-lg font-bold text-emerald-600">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyState({ hasFilters, isAdmin, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Package className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">
        {hasFilters ? "Nenhum produto encontrado" : "Catálogo vazio"}
      </h3>
      <p className="text-sm text-gray-500 mb-4 max-w-sm">
        {hasFilters
          ? "Tente ajustar os filtros de busca."
          : "Adicione o primeiro produto ao catálogo da Maxi Massas."}
      </p>
      {isAdmin && !hasFilters && (
        <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function Catalog() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await CatalogProduct.list("sort_order");
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products:", err);
      toast.error("Erro ao carregar catálogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ── Filtering ────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    // Active filter: admin can toggle, franchisee only sees active
    if (!isAdmin && !p.active) return false;
    if (isAdmin && !showInactive && !p.active) return false;

    // Category filter
    if (categoryFilter !== "Todos" && p.category !== categoryFilter) return false;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = p.name?.toLowerCase().includes(q);
      const matchesDesc = p.description?.toLowerCase().includes(q);
      if (!matchesName && !matchesDesc) return false;
    }

    return true;
  });

  const hasFilters =
    searchQuery.trim() !== "" || categoryFilter !== "Todos";

  // ── Handlers ─────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDeleteClick = (product) => {
    setDeletingProduct(product);
    setDeleteOpen(true);
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
            <p className="text-sm text-gray-500">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "produto" : "produtos"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={handleAdd}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category tabs */}
        <Tabs
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="Todos">Todos</TabsTrigger>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c.value} value={c.value}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Show inactive toggle (admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
              id="show-inactive"
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer whitespace-nowrap">
              {showInactive ? (
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Mostrando inativos
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" /> Ocultar inativos
                </span>
              )}
            </Label>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          isAdmin={isAdmin}
          onAdd={handleAdd}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSaved={loadProducts}
      />

      {deletingProduct && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={(v) => {
            setDeleteOpen(v);
            if (!v) setDeletingProduct(null);
          }}
          product={deletingProduct}
          onConfirm={loadProducts}
        />
      )}
    </div>
  );
}
