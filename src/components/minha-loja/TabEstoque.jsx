import React, { useState, useEffect, useRef, useMemo } from "react";
import { InventoryItem, getStandardProductCatalog } from "@/entities/all";
import { sanitizeCSVCell } from "@/lib/csvSanitize";
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
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { toast } from "sonner";
import { format } from "date-fns";
import { weeklyTurnoverMap, suggestionFor } from "@/lib/stockSuggestion";
import { ptBR } from "date-fns/locale";
import {
  initCounts,
  validateCount,
  applyStep,
  computeCountDiff,
  splitSaveResults,
} from "@/lib/stockCount";

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

const GROUP_ORDER = ["Canelone", "Conchiglione", "Massa", "Nhoque", "Fatiado", "Rondelli", "Sofioli", "Molho"];

// Agrupa por tipo de produto (1a palavra do nome) — usado na lista normal e no modo contagem.
function groupItemsByType(list) {
  const groups = [];
  const groupMap = {};

  list.forEach((item) => {
    const firstWord = item.product_name.split(" ")[0];
    const groupKey = GROUP_ORDER.includes(firstWord) ? firstWord : "Outros";
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = { label: groupKey, items: [] };
      groups.push(groupMap[groupKey]);
    }
    groupMap[groupKey].items.push(item);
  });

  groups.sort((a, b) => {
    const orderWithOutros = [...GROUP_ORDER, "Outros"];
    const ai = orderWithOutros.indexOf(a.label);
    const bi = orderWithOutros.indexOf(b.label);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Ordem alfabetica dentro de cada grupo para evitar reordenacao ao atualizar estoque
  groups.forEach((g) => g.items.sort((a, b) =>
    a.product_name.localeCompare(b.product_name, 'pt-BR')
  ));

  return groups;
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
  const [showHidden, setShowHidden] = useState(false);
  const [standardCatalog, setStandardCatalog] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const editInputRef = useRef(null);
  const editingCellRef = useRef(null);
  const suggestionsRef = useRef(null);

  // --- Modo "Contar estoque" (S16.1) ---
  const [countMode, setCountMode] = useState(false);
  const [counts, setCounts] = useState({});
  const [isSavingCount, setIsSavingCount] = useState(false);
  const [editingCountId, setEditingCountId] = useState(null);
  const [countEditValue, setCountEditValue] = useState("");
  const [itemMenuFor, setItemMenuFor] = useState(null); // item com o menu "..." (editar/ocultar/excluir) aberto
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const countEditRef = useRef(null);
  const savingCountRef = useRef(false); // guarda SÍNCRONA — setState não chega a tempo de barrar clique duplo

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Sync items from parent prop
  useEffect(() => {
    setItems(inventoryItems || []);
  }, [inventoryItems]);

  // Fetch standard product catalog (once)
  useEffect(() => {
    let cancelled = false;
    getStandardProductCatalog()
      .then((data) => { if (!cancelled) setStandardCatalog(data); })
      .catch(() => {}); // silent — autocomplete is optional
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    if (editingCountId && countEditRef.current) {
      countEditRef.current.focus();
      countEditRef.current.select();
    }
  }, [editingCountId]);

  const giroByItem = useMemo(() => weeklyTurnoverMap(saleItems), [saleItems]);

  // --- Filtering ---

  const hiddenItems = useMemo(() => items.filter((i) => i.active === false), [items]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (item.active === false) return false; // hidden items shown separately

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
  }), [items, searchTerm, filterCategory, filterStockLevel]);

  // --- Grouping by product type (first word of product_name) ---

  const itemGroups = useMemo(() => groupItemsByType(filteredItems), [filteredItems]);

  // --- Modo "Contar estoque": lista independente do filtro de nivel de estoque
  // (que depende da quantidade — mudaria embaixo do dedo enquanto ela conta),
  // mas ainda respeita busca e categoria para achar o produto rapido.
  const countableItems = useMemo(() => items.filter((item) => {
    if (item.active === false) return false;
    const itemCategory = item.category || getCategoryFromName(item.product_name);
    const matchesSearch =
      !searchTerm ||
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemCategory?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || itemCategory === filterCategory;
    return matchesSearch && matchesCategory;
  }), [items, searchTerm, filterCategory]);

  const countGroups = useMemo(() => groupItemsByType(countableItems), [countableItems]);

  const countDiff = useMemo(() => computeCountDiff(items, counts), [items, counts]);

  // --- Inline edit ---

  const handleCellClick = (itemId, field, currentValue) => {
    if (editingCell?.itemId === itemId && editingCell?.field === field) return;
    const cell = { itemId, field };
    editingCellRef.current = cell;
    setEditingCell(cell);
    setEditValue(String(currentValue ?? ""));
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { itemId, field } = editingCell;
    const blurredCell = editingCell;
    const clearIfSame = () => {
      if (editingCellRef.current === blurredCell) {
        editingCellRef.current = null;
        setEditingCell(null);
      }
    };

    const item = items.find((i) => i.id === itemId);
    const isIntField = field === "quantity" || field === "min_stock";
    const isFloatField = field === "sale_price" || field === "cost_price";
    const newValue = isIntField ? parseInt(editValue, 10) : parseFloat(editValue);

    if (isNaN(newValue) || newValue < 0) {
      toast.error("Valor inválido. Insira um número positivo.");
      clearIfSame();
      return;
    }

    if (Number(item[field]) === newValue) {
      clearIfSame();
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

    clearIfSame();
    await salvarCelula(itemId, field, newValue, item.product_name);
  };

  // Antes, se o update falhava o numero digitado sumia (a celula fechava e voltava o valor
  // antigo, com um "Erro ao atualizar" generico). Agora o aviso diz o produto e o valor e
  // tem "Tentar de novo" com o MESMO valor (27/09/2026).
  const salvarCelula = async (itemId, field, newValue, nomeProduto) => {
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
      const valorTexto = field === "sale_price" || field === "cost_price" ? formatBRL(newValue) : String(newValue);
      toast.error(`Não salvou: ${nomeProduto || "produto"} ficou com o valor antigo.`, {
        description: `Você tinha digitado ${valorTexto}. Toque em "Tentar de novo" para salvar.`,
        duration: 20000,
        action: {
          label: "Tentar de novo",
          onClick: () => salvarCelula(itemId, field, newValue, nomeProduto),
        },
      });
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      editingCellRef.current = null;
      setEditingCell(null);
    }
  };

  // --- Standard product suggestions ---

  const existingNames = useMemo(
    () => new Set(items.map((i) => i.product_name?.toLowerCase())),
    [items]
  );

  const filteredSuggestions = useMemo(() => {
    const term = formData.product_name?.toLowerCase().trim();
    if (!term || term.length < 2 || editingItem) return [];
    return standardCatalog.filter(
      (p) =>
        p.product_name.toLowerCase().includes(term) &&
        !existingNames.has(p.product_name.toLowerCase())
    );
  }, [formData.product_name, standardCatalog, existingNames, editingItem]);

  const [selectedFromCatalog, setSelectedFromCatalog] = useState(false);

  const handleSelectStandard = (product) => {
    setFormData((prev) => ({
      ...prev,
      product_name: product.product_name,
      category: product.category || getCategoryFromName(product.product_name),
      unit: product.unit || "un",
      cost_price: product.cost_price ? String(product.cost_price) : "",
      sale_price: product.sale_price ? String(product.sale_price) : "",
    }));
    setShowSuggestions(false);
    setSelectedFromCatalog(true);
  };

  // --- Add product ---

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_FORM });
    setShowSuggestions(false);
    setSelectedFromCatalog(false);
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
          created_by_franchisee: isAdmin ? false : !selectedFromCatalog,
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
        toast.error(safeErrorMessage(error, "Erro ao salvar produto. Tente novamente."));
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
      const msg = error?.message || "";
      const code = error?.code || error?.details?.code || "";
      const isFkViolation =
        code === "23503" ||
        /foreign key|violates foreign key|sale_items|purchase_order_items/i.test(msg);
      if (isFkViolation) {
        toast.error(
          "Este produto tem vendas ou pedidos no histórico. Use o botão ocultar (👁️) em vez de excluir."
        );
      } else if (msg.includes("permissão")) {
        toast.error("Sem permissão para excluir este produto.");
      } else {
        toast.error("Erro ao remover produto.");
      }
    }
  };

  // --- Toggle active (ocultar/mostrar SKU) ---

  const handleToggleActive = async (item) => {
    const newActive = item.active === false ? true : false;
    try {
      await InventoryItem.update(item.id, { active: newActive });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, active: newActive } : i))
      );
      toast.success(newActive ? "Produto reativado." : "Produto oculto — não aparece para o bot nem na reposição.");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao ocultar/mostrar:", error);
      toast.error("Erro ao alterar visibilidade.");
    }
  };

  // --- Modo "Contar estoque" (S16.1) ---

  const handleEnterCountMode = () => {
    const activeItems = items.filter((i) => i.active !== false);
    setCounts(initCounts(activeItems));
    setFilterStockLevel("all"); // depende da quantidade — evita item sumir da lista no meio da contagem
    setCountMode(true);
  };

  const exitCountMode = () => {
    setCountMode(false);
    setCounts({});
    setEditingCountId(null);
  };

  const handleCancelCount = () => {
    if (countDiff.length > 0) {
      setShowDiscardConfirm(true);
      return;
    }
    exitCountMode();
  };

  const confirmDiscardCount = () => {
    setShowDiscardConfirm(false);
    exitCountMode();
  };

  // Aviso ao fechar a aba/atualizar com contagem não salva (nada some sem avisar).
  useEffect(() => {
    if (!countMode) return;
    const handler = (e) => {
      if (computeCountDiff(items, counts).length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [countMode, items, counts]);

  const handleCountStep = (itemId, step) => {
    setCounts((prev) => ({ ...prev, [itemId]: applyStep(prev[itemId], step) }));
  };

  const handleOpenCountInput = (item) => {
    setEditingCountId(item.id);
    setCountEditValue(String(counts[item.id] ?? 0));
  };

  const handleCountInputBlur = (itemId) => {
    const { valid, value, error } = validateCount(countEditValue);
    if (!valid) {
      toast.error(error || "Número inválido.");
    } else {
      setCounts((prev) => ({ ...prev, [itemId]: value }));
    }
    setEditingCountId(null);
  };

  const handleCountInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setEditingCountId(null);
    }
  };

  // Clique repetido no "Salvar" não duplica: enquanto isSavingCount for true, o botão
  // fica desabilitado; depois de salvar, os itens salvos saem do diff (before === after)
  // e um segundo clique não teria mais nada para reenviar.
  const handleSaveCount = async () => {
    if (savingCountRef.current) return;
    const diff = computeCountDiff(items, counts);
    if (diff.length === 0) return;

    savingCountRef.current = true;
    setIsSavingCount(true);
    try {
      const nowIso = new Date().toISOString();
      const results = await Promise.allSettled(
        diff.map((entry) =>
          InventoryItem.update(entry.id, {
            quantity: entry.after,
            last_updated_by: currentUser?.id || null,
            updated_at: nowIso,
          })
        )
      );
      const { saved, failed } = splitSaveResults(diff, results);

      if (saved.length > 0) {
        setItems((prev) =>
          prev.map((i) => {
            const hit = saved.find((s) => s.id === i.id);
            return hit
              ? { ...i, quantity: hit.after, updated_at: nowIso, last_updated_by: currentUser?.id || i.last_updated_by }
              : i;
          })
        );
      }

      if (failed.length === 0) {
        toast.success(
          `Contagem salva: ${saved.length} produto${saved.length > 1 ? "s" : ""} atualizado${saved.length > 1 ? "s" : ""}.`
        );
        exitCountMode();
        if (onRefresh) onRefresh();
      } else {
        console.error("Erro ao salvar contagem:", failed.map((f) => f.error));
        const okTexto = saved.length > 0 ? `${saved.length} salvos, ` : "";
        toast.error(
          `${okTexto}${failed.length} não salvaram (falha de rede). Os números continuam na tela — toque em "Salvar" de novo para tentar só esses.`,
          { duration: 15000 }
        );
        if (onRefresh) onRefresh();
      }
    } finally {
      savingCountRef.current = false;
      setIsSavingCount(false);
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
        sanitizeCSVCell(item.product_name),
        sanitizeCSVCell(item.category || getCategoryFromName(item.product_name)),
        item.quantity,
        sanitizeCSVCell(item.unit),
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
        <Badge className="bg-surface-line text-ink-2 rounded-full px-2 py-0.5 text-[11px] font-bold">
          Sem minimo
        </Badge>
      );
    }
    if (item.quantity < item.min_stock) {
      return (
        <Badge className="bg-brand/10 text-brand rounded-full px-2 py-0.5 text-[11px] font-bold">
          <MaterialIcon icon="warning" size={12} className="mr-1" />
          Estoque baixo
        </Badge>
      );
    }
    return (
      <Badge className="bg-brand/10 text-[#9c4143] rounded-full px-2 py-0.5 text-[11px] font-bold">
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
      colorClass = "bg-brand/10 text-brand"; // red — will run out
    } else if (stock >= giro * 2) {
      colorClass = "bg-brand-gold/10 text-brand-gold-ink"; // amber — buying too much
    }

    return (
      <Badge className={`${colorClass} rounded-full px-2 py-0.5 text-[11px] font-bold`}>
        {giro.toFixed(1)} {item.unit || "un"}/sem
      </Badge>
    );
  };

  const getSugestaoCompra = (item) => {
    const toBuy = suggestionFor(item, giroByItem);
    if (toBuy === null || toBuy <= 0) return null;

    return (
      <Badge className="bg-brand-gold/10 text-brand-gold-ink rounded-full px-2 py-0.5 text-[11px] font-bold">
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
      colorClass = "bg-brand-gold/10 text-brand-gold-ink";
    }

    return (
      <Badge className={`${colorClass} rounded-full px-1.5 py-0 text-[11px] font-bold ml-1`}>
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

  const faturamentoPotencial = useMemo(() =>
    items.filter(i => i.active !== false).reduce((sum, i) => sum + (i.quantity || 0) * (i.sale_price || 0), 0),
    [items]
  );

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Header actions */}
      {!countMode && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <span className="font-bold text-ink">{totalProducts}</span> produtos
              {lowStockCount > 0 && (
                <Badge className="bg-brand/10 text-brand rounded-full px-2 py-0.5 text-[11px] font-bold ml-2">
                  {lowStockCount} baixo
                </Badge>
              )}
              {faturamentoPotencial > 0 && (
                <Badge className="bg-brand-gold/10 text-brand-gold-ink rounded-full px-2 py-0.5 text-[11px] font-bold ml-2">
                  Potencial {formatBRL(faturamentoPotencial)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleEnterCountMode}
              className="gap-2 border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
              size="sm"
            >
              <MaterialIcon icon="checklist" size={16} />
              Contar estoque
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2 border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
              size="sm"
            >
              <MaterialIcon icon="upload" size={16} />
              CSV
            </Button>
            <Button
              onClick={handleOpenAddDialog}
              className="gap-2 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
              size="sm"
            >
              <MaterialIcon icon="add" size={16} />
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Modo "Contar estoque" */}
      {countMode && (
        <div className="space-y-4">
          <div className="sticky top-0 z-10 -mx-1 px-3 py-3 bg-white/95 backdrop-blur border border-ink-4/20 rounded-2xl shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-ink font-plus-jakarta flex items-center gap-2">
                <MaterialIcon icon="checklist" size={18} className="text-brand" />
                Contar estoque
              </h3>
              <p className="text-xs text-ink-2">
                {countDiff.length === 0
                  ? "Toque em − ou + para contar cada produto."
                  : `${countDiff.length} produto${countDiff.length > 1 ? "s" : ""} alterado${countDiff.length > 1 ? "s" : ""}.`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 rounded-xl border-ink-4 text-ink-2"
                onClick={handleCancelCount}
                disabled={isSavingCount}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-11 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold gap-2"
                onClick={handleSaveCount}
                disabled={isSavingCount || countDiff.length === 0}
              >
                {isSavingCount ? (
                  <>
                    <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>Salvar{countDiff.length > 0 ? ` (${countDiff.length})` : ""}</>
                )}
              </Button>
            </div>
          </div>

          {countGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MaterialIcon icon="package_2" size={64} className="text-ink-4 mb-4" />
              <p className="text-sm text-ink-2">Nenhum produto para contar com esse filtro.</p>
            </div>
          ) : (
            countGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-brand font-plus-jakarta px-1">
                  {group.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const value = counts[item.id] ?? (Number(item.quantity) || 0);
                    const before = Number(item.quantity) || 0;
                    const changed = value !== before;
                    return (
                      <Card
                        key={item.id}
                        className={`rounded-2xl border ${
                          changed ? "border-brand-gold/40 bg-brand-gold/5" : "border-ink-shadow/5 bg-white"
                        }`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-ink leading-snug">{item.product_name}</p>
                              <p className="text-xs text-ink-2">
                                {getUnitLabel(item.unit)}
                                {changed && (
                                  <span className="text-brand-gold-ink font-semibold"> · era {before}</span>
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 shrink-0 -mr-2 -mt-1 text-ink-2"
                              onClick={() => setItemMenuFor(item)}
                              aria-label={`Mais opções de ${item.product_name}`}
                            >
                              <MaterialIcon icon="more_horiz" size={20} />
                            </Button>
                          </div>

                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 shrink-0 rounded-xl border-ink-4 text-ink"
                              onClick={() => handleCountStep(item.id, -1)}
                              aria-label={`Diminuir ${item.product_name}`}
                            >
                              <MaterialIcon icon="remove" size={20} />
                            </Button>

                            {editingCountId === item.id ? (
                              <Input
                                ref={countEditRef}
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={countEditValue}
                                onChange={(e) => setCountEditValue(e.target.value)}
                                onBlur={() => handleCountInputBlur(item.id)}
                                onKeyDown={handleCountInputKeyDown}
                                className="flex-1 h-11 min-w-0 text-center font-bold bg-surface-line border-none rounded-xl focus-visible:ring-2 focus-visible:ring-brand/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex-1 h-11 min-w-0 rounded-xl bg-surface-line font-bold text-ink text-center text-lg"
                                onClick={() => handleOpenCountInput(item)}
                                aria-label={`Quantidade de ${item.product_name}, toque para digitar`}
                              >
                                {value}
                              </button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 shrink-0 rounded-xl border-ink-4 text-ink"
                              onClick={() => handleCountStep(item.id, 1)}
                              aria-label={`Aumentar ${item.product_name}`}
                            >
                              <MaterialIcon icon="add" size={20} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Filters */}
      {!countMode && <FilterBar
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
      />}

      {/* Missing sale_price banner */}
      {!countMode && missingPriceCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-brand-gold/10 border border-brand-gold/30 rounded-xl">
          <MaterialIcon icon="warning" size={20} className="text-brand-gold-ink shrink-0" />
          <p className="text-sm text-brand-gold-ink flex-1">
            <strong>{missingPriceCount} de {items.length}</strong> produtos sem preco de venda definido.
            {" "}Clique no valor para editar.
          </p>
        </div>
      )}

      {/* Content */}
      {!countMode && (filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="package_2" size={64} className="text-ink-4 mb-4" />
          <h3 className="text-lg font-medium text-ink mb-1 font-plus-jakarta">
            Nenhum produto encontrado
          </h3>
          <p className="text-sm text-ink-2 mb-4 max-w-sm">
            {searchTerm || filterCategory !== "all"
              ? "Nenhum produto corresponde aos filtros aplicados."
              : "Comece adicionando produtos ao estoque da sua loja."}
          </p>
          {!searchTerm && filterCategory === "all" && (
            <Button
              onClick={handleOpenAddDialog}
              className="gap-2 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand font-plus-jakarta px-1">
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
                          ? "border-brand/20 bg-brand/5"
                          : "border-ink-shadow/5 bg-white"
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4
                              className="font-medium text-ink truncate cursor-pointer hover:underline hover:text-brand transition-colors"
                              onClick={() => handleOpenEditDialog(item)}
                            >
                              {item.product_name}
                            </h4>
                            <p className="text-xs text-ink-2">
                              {item.category || getCategoryFromName(item.product_name)} · {getUnitLabel(item.unit)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-ink-2 hover:text-brand"
                              onClick={() => handleOpenEditDialog(item)}
                              aria-label="Editar produto"
                              title="Editar produto"
                            >
                              <MaterialIcon icon="edit" size={18} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-ink-2 hover:text-brand-gold-ink"
                              onClick={() => handleToggleActive(item)}
                              aria-label={item.active === false ? "Reativar produto" : "Ocultar do catálogo"}
                              title={item.active === false ? "Reativar produto" : "Ocultar do catálogo"}
                            >
                              <MaterialIcon icon={item.active === false ? "visibility" : "visibility_off"} size={18} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-ink-4 hover:text-brand"
                              onClick={() => setDeleteConfirmId(item.id)}
                              aria-label="Excluir produto"
                              title="Excluir produto"
                            >
                              <MaterialIcon icon="delete" size={18} />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                              Quantidade
                            </span>
                            <div
                              className="font-bold text-ink cursor-pointer active:text-brand-gold-ink flex items-center gap-1 bg-surface-line/50 rounded-lg px-2 py-1 min-h-[32px]"
                              onClick={() =>
                                handleCellClick(item.id, "quantity", item.quantity)
                              }
                            >
                              {editingCell?.itemId === item.id &&
                              editingCell?.field === "quantity" ? (
                                <Input
                                  ref={editInputRef}
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  step="1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full h-6 font-bold bg-transparent border-none rounded-none p-0 focus-visible:ring-0"
                                />
                              ) : (
                                <>
                                  <span>{item.quantity ?? 0} {item.unit}</span>
                                  <MaterialIcon icon="edit" size={12} className="text-ink-2/40" />
                                </>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                              Min.
                            </span>
                            <div
                              className="font-bold text-ink cursor-pointer active:text-brand-gold-ink flex items-center gap-1 bg-surface-line/50 rounded-lg px-2 py-1 min-h-[32px]"
                              onClick={() =>
                                handleCellClick(item.id, "min_stock", item.min_stock)
                              }
                            >
                              {editingCell?.itemId === item.id &&
                              editingCell?.field === "min_stock" ? (
                                <Input
                                  ref={editInputRef}
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  step="1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full h-6 font-bold bg-transparent border-none rounded-none p-0 focus-visible:ring-0"
                                />
                              ) : (
                                <>
                                  <span>{item.min_stock ?? 0}</span>
                                  <MaterialIcon icon="edit" size={12} className="text-ink-2/40" />
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prices */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                              Custo
                            </span>
                            <p className="text-ink-2">{formatBRL(item.cost_price)}</p>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                              Venda
                            </span>
                            <div
                              className={`cursor-pointer active:text-brand-gold-ink flex items-center gap-1 bg-surface-line/50 rounded-lg px-2 py-1 min-h-[32px] ${
                                !item.sale_price ? "text-brand font-medium" : "text-ink-2"
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
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
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
                                        <MaterialIcon icon="warning" size={12} className="text-brand" />
                                        Definir
                                      </>
                                    )}
                                  </span>
                                  <MaterialIcon icon="edit" size={12} className="text-ink-2/40 ml-auto" />
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
          <Card className="hidden md:block bg-white rounded-2xl shadow-sm border border-ink-shadow/5">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-ink-4/30">
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Produto
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Categoria
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Qtd
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Un.
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Min.
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Custo
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Venda
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Giro
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                        Sugestão
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemGroups.map((group) => (
                      <React.Fragment key={group.label}>
                        <TableRow className="bg-surface border-t border-ink-shadow/10">
                          <TableCell colSpan={999} className="py-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-brand font-plus-jakarta">
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
                                  ? "bg-brand/5 hover:bg-brand/10"
                                  : "hover:bg-surface"
                              }
                            >
                              <TableCell className="font-medium text-ink">
                                <span
                                  className="cursor-pointer hover:underline hover:text-brand transition-colors"
                                  onClick={() => handleOpenEditDialog(item)}
                                  title="Clique para editar"
                                >
                                  {item.product_name}
                                </span>
                              </TableCell>

                              <TableCell className="text-sm text-ink-2">
                                {item.category || getCategoryFromName(item.product_name)}
                              </TableCell>

                              {/* Quantity - inline edit */}
                              <TableCell className="text-center w-20">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "quantity" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    className="w-16 mx-auto text-center h-8 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer px-2 py-1 rounded-lg hover:bg-brand-gold/10 hover:text-brand-gold-ink transition-colors inline-block w-16 text-center"
                                    onClick={() =>
                                      handleCellClick(item.id, "quantity", item.quantity)
                                    }
                                    title="Clique para editar"
                                  >
                                    {item.quantity ?? 0}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="text-sm text-ink-2">
                                {getUnitLabel(item.unit)}
                              </TableCell>

                              {/* Min stock - inline edit */}
                              <TableCell className="text-center w-16">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "min_stock" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    className="w-16 mx-auto text-center h-8 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer px-2 py-1 rounded-lg hover:bg-brand-gold/10 hover:text-brand-gold-ink transition-colors inline-block w-16 text-center"
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
                              <TableCell className="text-right text-sm text-ink-2">
                                {formatBRL(item.cost_price)}
                              </TableCell>

                              {/* Sale price - inline edit */}
                              <TableCell className="text-right w-24">
                                {editingCell?.itemId === item.id &&
                                editingCell?.field === "sale_price" ? (
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellBlur}
                                    onKeyDown={handleCellKeyDown}
                                    placeholder={getRecommendedPrice(item) ? formatBRL(getRecommendedPrice(item)) : "0,00"}
                                    className="w-20 ml-auto text-right h-8 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  />
                                ) : (
                                  <span
                                    className={`cursor-pointer px-2 py-1 rounded-lg hover:bg-brand-gold/10 hover:text-brand-gold-ink transition-colors inline-flex items-center gap-1 ${
                                      !item.sale_price
                                        ? "text-brand font-medium"
                                        : "text-ink-2"
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
                                        <MaterialIcon icon="warning" size={14} className="text-brand" />
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
                                    className="h-8 w-8 md:h-8 md:w-8 text-ink-2 hover:text-brand"
                                    onClick={() => handleOpenEditDialog(item)}
                                    aria-label="Editar produto"
                                    title="Editar produto"
                                  >
                                    <MaterialIcon icon="edit" size={16} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 md:h-8 md:w-8 text-ink-2 hover:text-brand-gold-ink"
                                    onClick={() => handleToggleActive(item)}
                                    aria-label="Ocultar do catálogo"
                                    title="Ocultar produto — não aparece para o bot nem na reposição"
                                  >
                                    <MaterialIcon icon="visibility_off" size={16} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 md:h-8 md:w-8 text-ink-4 hover:text-brand"
                                    onClick={() => setDeleteConfirmId(item.id)}
                                    aria-label="Excluir produto"
                                    title="Excluir produto"
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
      ))}

      {/* Hidden items section */}
      {!countMode && hiddenItems.length > 0 && (
        <div className="border border-ink-4/30 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-[#f5f3f4] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MaterialIcon icon="visibility_off" size={18} className="text-ink-2/60" />
              <span className="text-sm font-semibold text-ink-2">
                {hiddenItems.length} produto{hiddenItems.length > 1 ? "s" : ""} oculto{hiddenItems.length > 1 ? "s" : ""}
              </span>
              <span className="text-xs text-ink-2/60">
                — não aparecem para o bot nem na reposição
              </span>
            </div>
            <MaterialIcon icon={showHidden ? "expand_less" : "expand_more"} size={20} className="text-ink-2/60" />
          </button>
          {showHidden && (
            <div className="p-3 space-y-2 border-t border-ink-4/20">
              {hiddenItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-ink-4/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-ink-2/60 line-through">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-ink-2/40">
                      {item.quantity ?? 0} {item.unit}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-ok-ink hover:text-ok-ink hover:bg-ok/10"
                    onClick={() => handleToggleActive(item)}
                  >
                    <MaterialIcon icon="visibility" size={14} />
                    Reativar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit product dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-ink">
              <MaterialIcon icon="inventory_2" size={20} className="text-brand" />
              {editingItem ? "Editar Produto" : "Adicionar Produto"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitProduct} className="space-y-4">
            {/* Product name with autocomplete */}
            <div className="space-y-2 relative">
              <Label className="text-ink">Nome do Produto *</Label>
              <Input
                value={formData.product_name}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    product_name: e.target.value,
                  }));
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Ex: Lasanha Bolonhesa 500g"
                required
                autoComplete="off"
                className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20"
              />
              {showSuggestions && filteredSuggestions.length > 0 && !editingItem && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-ink-4/30 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  <p className="px-3 py-1.5 text-xs uppercase tracking-widest text-ink-2/60 font-plus-jakarta border-b border-ink-4/10">
                    Produtos padrão da rede
                  </p>
                  {filteredSuggestions.slice(0, 8).map((p) => (
                    <button
                      key={p.product_name}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-brand/5 transition-colors text-sm text-ink flex justify-between items-center"
                      onClick={() => handleSelectStandard(p)}
                    >
                      <span className="truncate">{p.product_name}</span>
                      <span className="text-xs text-ink-2/60 ml-2 shrink-0">
                        {p.sale_price ? formatBRL(p.sale_price) : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-ink">Categoria</Label>
              <Select
                value={formData.category || "none"}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger className="bg-surface-line border-none rounded-xl">
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
                <Label className="text-ink">Quantidade</Label>
                <Input
                  type="number"
                  inputMode="decimal"
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
                  className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-ink">Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, unit: val }))
                  }
                >
                  <SelectTrigger className="bg-surface-line border-none rounded-xl">
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
              <Label className="text-ink">Estoque Minimo</Label>
              <Input
                type="number"
                inputMode="decimal"
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
                className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20"
              />
              <p className="text-xs text-ink-2">
                Você será alertado quando a quantidade ficar abaixo deste valor.
              </p>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-ink">
                  Preco de Custo (R$)
                  {!isAdmin && editingItem && !canEditCostPrice(editingItem) && (
                    <span className="text-xs text-ink-2 ml-1">(somente admin)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
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
                  className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-ink">Preco de Venda (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
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
                  className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20"
                />
                {formData.cost_price && parseFloat(formData.cost_price) > 0 && (
                  <p className="text-xs text-ink-2">
                    Sugerido: {formatBRL(parseFloat(formData.cost_price) * 2)} (100% markup)
                    {formData.sale_price && parseFloat(formData.sale_price) > 0 && (
                      <span className={`ml-2 font-bold ${
                        ((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price) * 100) >= 80
                          ? "text-green-600"
                          : ((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price) * 100) >= 50
                            ? "text-brand-gold-ink"
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
                className="border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-2"
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
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-ink">
              <MaterialIcon icon="delete" size={20} className="text-brand" />
              Confirmar Exclusao
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-2">
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
              className="border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const item = items.find((i) => i.id === deleteConfirmId);
                if (item) handleDelete(item);
              }}
              className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-2"
            >
              <MaterialIcon icon="delete" size={16} />
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modo contagem: menu "..." com editar/ocultar/excluir juntos (não soltos na linha) */}
      <Dialog open={!!itemMenuFor} onOpenChange={(open) => !open && setItemMenuFor(null)}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta text-ink text-base truncate">
              {itemMenuFor?.product_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-12 rounded-xl border-ink-4 text-ink"
              onClick={() => {
                handleOpenEditDialog(itemMenuFor);
                setItemMenuFor(null);
              }}
            >
              <MaterialIcon icon="edit" size={18} />
              Editar produto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-12 rounded-xl border-ink-4 text-ink"
              onClick={() => {
                handleToggleActive(itemMenuFor);
                setItemMenuFor(null);
              }}
            >
              <MaterialIcon icon={itemMenuFor?.active === false ? "visibility" : "visibility_off"} size={18} />
              {itemMenuFor?.active === false ? "Reativar produto" : "Ocultar do catálogo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-12 rounded-xl border-brand/30 text-brand"
              onClick={() => {
                setDeleteConfirmId(itemMenuFor?.id);
                setItemMenuFor(null);
              }}
            >
              <MaterialIcon icon="delete" size={18} />
              Excluir produto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sair da contagem com alteração não salva */}
      <Dialog open={showDiscardConfirm} onOpenChange={(open) => !open && setShowDiscardConfirm(false)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-ink">
              <MaterialIcon icon="warning" size={20} className="text-brand" />
              Descartar a contagem?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-2">
            {countDiff.length === 1
              ? "1 produto com número alterado ainda não foi salvo."
              : `${countDiff.length} produtos com número alterado ainda não foram salvos.`}
            {" "}Se sair agora, essa contagem se perde.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(false)}
              className="border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
            >
              Continuar contando
            </Button>
            <Button
              onClick={confirmDiscardCount}
              className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-2"
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
