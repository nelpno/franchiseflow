import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { InventoryItem, getStandardProductCatalog, updateInventoryCountIfUnchanged } from "@/entities/all";
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
import { weeklyTurnoverMap, suggestionFor, ritmoDeVendaMap, sugestaoDeCompra } from "@/lib/stockSuggestion";
import { ehProdutoDaFabrica, linhasDeCompra, resumoDeCompra } from "@/lib/reposicao";
import { usePedidosDaUnidade } from "@/hooks/usePedidosDaUnidade";
import { ResumoEstoque, ListaEstoqueV2, ItemEstoqueSheet } from "./EstoqueV2";
import EmptyState from "@/components/shared/EmptyState";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CHIP, CHIP_ATIVO, CHIP_INATIVO } from "@/components/shared/adminUi";
import { ptBR } from "date-fns/locale";
import {
  validateCount,
  applyStep,
  canStepCount,
  computeCountDiff,
  splitSaveResults,
  reconcileDraftWithItems,
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
  const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
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
  // `countBase`: quantidade que a franqueada VIU ao tocar o item pela 1a vez — imutável
  // até um conflito de save a corrigir. `counts`: valor atual da tela para cada item
  // tocado. Item que nunca foi tocado não está em nenhum dos dois (não entra no diff).
  const [countMode, setCountMode] = useState(false);
  const [countBase, setCountBase] = useState({});
  const [counts, setCounts] = useState({});
  const [countNames, setCountNames] = useState({}); // id -> nome (snapshot do toque — sobrevive a exclusão do item)
  const [countConflicts, setCountConflicts] = useState({}); // id -> { currentQuantity } — mudou no meio da contagem
  const [isSavingCount, setIsSavingCount] = useState(false);
  const [editingCountId, setEditingCountId] = useState(null);
  const [countEditValue, setCountEditValue] = useState("");
  const [itemMenuFor, setItemMenuFor] = useState(null); // item com o menu "..." (editar/ocultar/excluir) aberto
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showResumeChoice, setShowResumeChoice] = useState(false); // "Continuar" x "Começar do zero" ao achar rascunho
  const [pendingDraft, setPendingDraft] = useState(null); // rascunho salvo no sessionStorage de outra aba/sessão
  const countEditRef = useRef(null);
  const savingCountRef = useRef(false); // guarda SÍNCRONA — setState não chega a tempo de barrar clique duplo
  const prevFranchiseRef = useRef(franchiseId);

  const draftKey = franchiseId ? `stockCount_draft_${franchiseId}` : null;

  // Trocou de unidade com a contagem aberta: reseta ANTES de pintar (padrão React de
  // "resetar estado quando a prop muda"), senão o efeito de persistência do rascunho
  // gravaria a contagem da unidade ANTIGA na chave da unidade NOVA por uma renderização.
  if (prevFranchiseRef.current !== franchiseId) {
    prevFranchiseRef.current = franchiseId;
    if (countMode || Object.keys(countBase).length > 0) {
      setCountMode(false);
      setCountBase({});
      setCounts({});
      setCountNames({});
      setCountConflicts({});
      setEditingCountId(null);
      setPendingDraft(null);
      setShowResumeChoice(false);
    }
  }

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const nomeTravado = !isAdmin && !!editingItem && !editingItem.created_by_franchisee;

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

  // Rascunho da contagem em sessionStorage — sobrevive a troca de aba da Gestão, rota
  // ou até fechar e reabrir a aba do navegador (sessionStorage, não localStorage: some
  // se ela fechar o navegador de verdade, o que é aceitável pra uma contagem do dia).
  useEffect(() => {
    if (!draftKey || !countMode) return;
    try {
      if (Object.keys(countBase).length === 0) {
        sessionStorage.removeItem(draftKey);
      } else {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ base: countBase, counts, names: countNames, savedAt: Date.now() })
        );
      }
    } catch {
      // sessionStorage indisponível (aba anônima, storage bloqueado etc.) — segue sem rascunho
    }
  }, [draftKey, countMode, countBase, counts, countNames]);

  // Ao abrir a tela (ou trocar de unidade) fora do modo contagem, avisa se sobrou
  // rascunho de uma sessão anterior — sem isso, sair pela aba/rota perdia tudo calado.
  useEffect(() => {
    if (!draftKey || countMode) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.base && Object.keys(parsed.base).length > 0) {
          setPendingDraft(parsed);
          return;
        }
      }
    } catch {
      // ignora — sem rascunho pra oferecer
    }
    setPendingDraft(null);
  }, [draftKey, countMode]);

  const giroByItem = useMemo(() => weeklyTurnoverMap(saleItems), [saleItems]);

  // --- S25 (chave ui_v2): a conta nova, a mesma da Reposição e do Novo Pedido ---
  const pedidosUnidade = usePedidosDaUnidade(franchiseId, { enabled: uiV2 });
  const ritmoV2 = useMemo(() => (uiV2 ? ritmoDeVendaMap(saleItems) : {}), [uiV2, saleItems]);
  const sugestaoPronta = pedidosUnidade.status === "ok";
  const infoV2 = useMemo(() => {
    if (!uiV2) return {};
    const out = {};
    for (const item of items) {
      out[item.id] = {
        daFabrica: ehProdutoDaFabrica(item),
        pronta: sugestaoPronta,
        s: sugestaoDeCompra(item, {
          ritmoPorDia: ritmoV2[item.id] || 0,
          aCaminho: sugestaoPronta ? parseFloat(pedidosUnidade.emAberto?.[item.id]) || 0 : 0,
          intervaloDias: pedidosUnidade.intervalo.dias,
        }),
      };
    }
    return out;
  }, [uiV2, items, ritmoV2, sugestaoPronta, pedidosUnidade.emAberto, pedidosUnidade.intervalo.dias]);
  const resumoV2 = useMemo(() => {
    if (!uiV2) return null;
    const ativos = items.filter((i) => i.active !== false);
    const linhas = linhasDeCompra(ativos, {
      ritmo: ritmoV2,
      emAberto: sugestaoPronta ? pedidosUnidade.emAberto : {},
      intervaloDias: pedidosUnidade.intervalo.dias,
    });
    const r = resumoDeCompra(linhas);
    const somar = (campo) => ativos.reduce((t, i) => t + Math.max(parseFloat(i.quantity) || 0, 0) * (parseFloat(i[campo]) || 0), 0);
    return {
      acabando: r.acabando,
      paraPedir: sugestaoPronta ? r.paraPedir.length : 0,
      negativos: ativos.filter((i) => (parseFloat(i.quantity) || 0) < 0).length,
      valorCusto: somar("cost_price"),
      valorVenda: somar("sale_price"),
    };
  }, [uiV2, items, ritmoV2, sugestaoPronta, pedidosUnidade.emAberto, pedidosUnidade.intervalo.dias]);
  const [filtroV2, setFiltroV2] = useState("todos");
  const [itemAbertoId, setItemAbertoId] = useState(null);
  const itemAberto = itemAbertoId ? items.find((i) => i.id === itemAbertoId) || null : null;

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

  // S25: lista do Estoque novo — busca + um filtro por situação (sem categoria repetida).
  const filtrosV2 = useMemo(() => {
    if (!uiV2) return [];
    const ativos = items.filter((i) => i.active !== false);
    const eAcabando = (i) => ["acabou", "acabando"].includes(infoV2[i.id]?.s?.situacao) || !!infoV2[i.id]?.s?.estoqueNegativo;
    const ePedir = (i) => !!(infoV2[i.id]?.daFabrica && infoV2[i.id]?.pronta && infoV2[i.id]?.s?.repor > 0);
    const eSemVenda = (i) => !(infoV2[i.id]?.s?.porSemana > 0);
    return [
      { key: "todos", rotulo: "Todos", teste: () => true, n: ativos.length },
      { key: "acabando", rotulo: "Acabando", teste: eAcabando, n: ativos.filter(eAcabando).length },
      { key: "pedir", rotulo: "Para pedir", teste: ePedir, n: ativos.filter(ePedir).length },
      { key: "sem_venda", rotulo: "Sem venda", teste: eSemVenda, n: ativos.filter(eSemVenda).length },
    ];
  }, [uiV2, items, infoV2]);
  const gruposV2 = useMemo(() => {
    if (!uiV2) return [];
    const filtro = filtrosV2.find((f) => f.key === filtroV2) || filtrosV2[0];
    const termo = searchTerm.trim().toLowerCase();
    const lista = items.filter((item) =>
      item.active !== false &&
      (!termo || item.product_name?.toLowerCase().includes(termo)) &&
      (!filtro || filtro.teste(item))
    );
    return groupItemsByType(lista);
  }, [uiV2, items, filtrosV2, filtroV2, searchTerm]);

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

  const countDiff = useMemo(() => computeCountDiff(countBase, counts, items), [countBase, counts, items]);

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
          `Preço mínimo recomendado: ${formatBRL(minPrice)} (markup de 80%). Preço salvo mesmo assim.`
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
  // Comparar nomes de produto: sem diferença de maiúsculas e de espaços repetidos (29/09).
  const normalizarNome = (nome) => String(nome || "").toLowerCase().replace(/\s+/g, " ").trim();

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
        unit: formData.unit,
        min_stock: parseInt(formData.min_stock, 10) || 0,
        cost_price: parseFloat(formData.cost_price) || null,
        sale_price: parseFloat(formData.sale_price) || null,
      };

      // Editar produto pelo menu "..." do modo Contar estoque NÃO mexe em quantidade —
      // isso é só do +/- da contagem (que grava por update condicional). Fora do modo
      // contagem (ou criando produto novo), o campo Quantidade normal vale.
      if (!(countMode && editingItem)) {
        payload.quantity = parseInt(formData.quantity, 10) || 0;
      }

      // Cost price e nome: admin always edits; franchisee only for items they created
      // (nome da fábrica é o que o pedido à fábrica e o robô usam; o banco também preserva, 29/09).
      if (!isAdmin && editingItem && !editingItem.created_by_franchisee) {
        delete payload.cost_price;
        delete payload.product_name;
      }

      // Minimum price validation (warning only, not blocking)
      if (payload.sale_price && payload.cost_price && payload.cost_price > 0) {
        const minPrice = payload.cost_price * 1.8;
        if (payload.sale_price < minPrice) {
          toast.warning(
            `Preco minimo recomendado: ${formatBRL(minPrice)} (markup de 80%). Salvo mesmo assim.`
          );
        }
      }

      if (editingItem) {
        if (payload.product_name
          && normalizarNome(payload.product_name) !== normalizarNome(editingItem.product_name)
          && items.some((i) => i.id !== editingItem.id
          && normalizarNome(i.product_name) === normalizarNome(payload.product_name))) {
          toast.error("Já existe outro produto com esse nome no seu Estoque.");
          return;
        }
        const updated = await InventoryItem.update(editingItem.id, {
          ...payload,
          updated_at: new Date().toISOString(),
        });
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...updated } : i))
        );
        toast.success("Produto atualizado.");
      } else {
        const nomeNovo = normalizarNome(payload.product_name);
        if (items.some((i) => normalizarNome(i.product_name) === nomeNovo)) {
          toast.error("Esse produto já está no seu Estoque. Procure na lista (ou em produtos ocultos).");
          return;
        }
        const daTabela = standardCatalog.find((p) => normalizarNome(p.product_name) === nomeNovo);
        // Nome da fábrica sempre grava como está na tabela (maiúsculas/espaços da digitação não).
        if (daTabela) payload.product_name = daTabela.product_name;
        const nomeDaFabrica = standardCatalog.length > 0
          ? !!daTabela
          : selectedFromCatalog; // catálogo não carregou: vale a escolha na sugestão, como antes
        const newItem = await InventoryItem.create({
          ...payload,
          // Produto da fábrica = nome IGUAL ao da tabela (escolhido na sugestão ou digitado igual);
          // nome mudado depois de escolher vira produto próprio (29/09).
          created_by_franchisee: isAdmin ? false : !nomeDaFabrica,
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

  // Começa uma contagem do ZERO (sem rascunho, ou depois de descartar um explicitamente).
  const startFreshCount = () => {
    setCountBase({});
    setCounts({});
    setCountNames({});
    setCountConflicts({});
    setSearchTerm("");
    setFilterCategory("all");
    setFilterStockLevel("all"); // depende da quantidade — evita item sumir da lista no meio da contagem
    setCountMode(true);
  };

  // "Contar estoque": se JÁ existe um rascunho pendente (outra aba/sessão deixou
  // contagem sem salvar), NUNCA descarta calado — pergunta antes (revisão P3, rodada 2).
  const handleEnterCountMode = () => {
    if (pendingDraft && Object.keys(pendingDraft.base || {}).length > 0) {
      setShowResumeChoice(true);
      return;
    }
    startFreshCount();
  };

  const exitCountMode = () => {
    setCountMode(false);
    setCountBase({});
    setCounts({});
    setCountNames({});
    setCountConflicts({});
    setEditingCountId(null);
    if (draftKey) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // sem storage — nada a limpar
      }
    }
  };

  // Retoma o rascunho — mas primeiro reconcilia contra os items ATUAIS: produto
  // excluído enquanto a contagem ficou pendente sai sozinho, com aviso (nunca fica
  // preso pra sempre esperando um "valor atual" que não existe mais).
  const handleResumeDraft = () => {
    if (!pendingDraft) return;
    const { base, counts: reconciledCounts, names, removedNames } = reconcileDraftWithItems(
      pendingDraft.base,
      pendingDraft.counts,
      pendingDraft.names,
      items
    );
    setCountBase(base);
    setCounts(reconciledCounts);
    setCountNames(names);
    setCountConflicts({});
    setSearchTerm("");
    setFilterCategory("all");
    setFilterStockLevel("all");
    setCountMode(true);
    setPendingDraft(null);
    setShowResumeChoice(false);
    if (removedNames.length > 0) {
      toast.warning(
        removedNames.length === 1
          ? `"${removedNames[0]}" foi excluído e saiu da contagem.`
          : `${removedNames.length} produtos foram excluídos e saíram da contagem: ${removedNames.join(", ")}.`
      );
    }
  };

  const handleDiscardDraft = () => {
    if (draftKey) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // sem storage — nada a limpar
      }
    }
    setPendingDraft(null);
    setShowResumeChoice(false);
  };

  // Escolheu "Começar do zero" tendo um rascunho pendente: aí sim descarta — mas foi
  // ação explícita da franqueada, não o clique de "Contar estoque" descartando calado.
  const handleStartFreshFromChoice = () => {
    handleDiscardDraft();
    startFreshCount();
  };

  const handleCancelCount = () => {
    if (isSavingCount) return;
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
  // Trocar de aba da Gestão, de rota ou de unidade não passa por aqui — isso fica
  // coberto pelo rascunho em sessionStorage (efeito acima) + o banner "Continuar
  // contagem" ao voltar.
  useEffect(() => {
    if (!countMode) return;
    const handler = (e) => {
      if (countDiff.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [countMode, countDiff]);

  // Registra a BASE do item na 1a vez que ele é tocado (+/-, digitação). Depois disso
  // só muda por conflito de save (o servidor tinha outro valor) — nunca por um refresh
  // externo do `items`.
  const ensureCountBase = (item) => {
    setCountBase((prev) => (item.id in prev ? prev : { ...prev, [item.id]: Number(item.quantity) || 0 }));
    setCountNames((prev) => (item.id in prev ? prev : { ...prev, [item.id]: item.product_name }));
  };

  const clearCountConflict = (itemId) => {
    setCountConflicts((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleCountStep = (itemId, step) => {
    if (savingCountRef.current) return; // guarda também no handler, não só no `disabled`
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    // Gate do decimal legado: lê o valor mais recentemente conhecido (não é 100% à
    // prova de 2 cliques na MESMA tick, mas um item quebrado não muda de quebrado
    // pra inteiro sozinho — o resultado é o mesmo aviso nos dois cliques).
    const knownCurrent = counts[itemId] ?? countBase[itemId] ?? (Number(item.quantity) || 0);
    if (!canStepCount(knownCurrent)) {
      // Estoque legado com numeric quebrado (ex.: 2.5) — +/- so trocaria um numero
      // quebrado por outro. Pede correção explícita via digitação direta.
      toast.warning(
        `"${item.product_name}" está com número quebrado (${knownCurrent}). Digite a contagem certa.`
      );
      handleOpenCountInput(item);
      return;
    }
    ensureCountBase(item);
    // O incremento em si SEMPRE dentro do updater funcional: cliques que caem na
    // MESMA tick do React (2 eventos antes do 1o re-render) têm que encadear em
    // cima do `prev` da fila, nunca do valor lido do escopo do render — senão 3
    // cliques rápidos em "+" produzem 9 em vez de 11 (regressão pega no smoke).
    setCounts((prev) => {
      const current = prev[itemId] ?? (Number(item.quantity) || 0);
      return { ...prev, [itemId]: applyStep(current, step) };
    });
    clearCountConflict(itemId);
  };

  const handleOpenCountInput = (item) => {
    if (savingCountRef.current) return;
    ensureCountBase(item);
    setEditingCountId(item.id);
    setCountEditValue(String(counts[item.id] ?? countBase[item.id] ?? (Number(item.quantity) || 0)));
  };

  const handleCountInputBlur = (itemId) => {
    if (savingCountRef.current) return;
    const { valid, value, error } = validateCount(countEditValue);
    if (!valid) {
      toast.error(error || "Número inválido.");
    } else {
      const item = items.find((i) => i.id === itemId);
      if (item) ensureCountBase(item);
      setCounts((prev) => ({ ...prev, [itemId]: value }));
      clearCountConflict(itemId);
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

  const handleOpenItemMenu = (item) => {
    if (savingCountRef.current) return;
    setItemMenuFor(item);
  };

  // Clique repetido no "Salvar" não duplica: `savingCountRef` bloqueia de forma
  // SÍNCRONA (setState não chegaria a tempo). O update é CONDICIONAL — só grava se a
  // quantidade no banco ainda for a BASE que a franqueada viu; senão é conflito (o robô
  // ou outra aba mexeram no meio) e a linha NÃO é sobrescrita.
  const handleSaveCount = async () => {
    if (savingCountRef.current) return;
    const diff = computeCountDiff(countBase, counts, items);
    if (diff.length === 0) return;

    savingCountRef.current = true;
    setIsSavingCount(true);
    try {
      const results = await Promise.allSettled(
        diff.map((entry) =>
          updateInventoryCountIfUnchanged(entry.id, franchiseId, entry.before, entry.after, currentUser?.id || null)
        )
      );
      const { saved, conflicted, missing, failed } = splitSaveResults(diff, results);

      if (saved.length > 0) {
        const nowIso = new Date().toISOString();
        setItems((prev) =>
          prev.map((i) => {
            const hit = saved.find((s) => s.id === i.id);
            return hit
              ? { ...i, quantity: hit.quantity ?? hit.after, updated_at: nowIso, last_updated_by: currentUser?.id || i.last_updated_by }
              : i;
          })
        );
        // Item salvo com sucesso sai da fila — sem ele, um clique repetido reenviaria.
        setCountBase((prev) => {
          const next = { ...prev };
          saved.forEach((s) => delete next[s.id]);
          return next;
        });
        setCounts((prev) => {
          const next = { ...prev };
          saved.forEach((s) => delete next[s.id]);
          return next;
        });
      }

      if (missing.length > 0) {
        // Produto excluído enquanto a contagem ficou pendente — NÃO é conflito (não há
        // "valor atual" pra reconferir), sai da fila sozinho (senão fica preso pra
        // sempre com conflito de valor null). Ver revisão P3 rodada 2, 28/09/2026.
        setCountBase((prev) => {
          const next = { ...prev };
          missing.forEach((m) => delete next[m.id]);
          return next;
        });
        setCounts((prev) => {
          const next = { ...prev };
          missing.forEach((m) => delete next[m.id]);
          return next;
        });
        setCountNames((prev) => {
          const next = { ...prev };
          missing.forEach((m) => delete next[m.id]);
          return next;
        });
        setCountConflicts((prev) => {
          const next = { ...prev };
          missing.forEach((m) => delete next[m.id]);
          return next;
        });
      }

      if (conflicted.length > 0) {
        // A base vira o valor ATUAL do servidor (é o que o próximo Salvar vai
        // comparar); o rascunho (o número que ela digitou) NÃO é tocado.
        setCountBase((prev) => {
          const next = { ...prev };
          conflicted.forEach((c) => { next[c.id] = c.currentQuantity; });
          return next;
        });
        setCountConflicts((prev) => {
          const next = { ...prev };
          conflicted.forEach((c) => { next[c.id] = { currentQuantity: c.currentQuantity }; });
          return next;
        });
      }

      const nomeDe = (entry) => countNames[entry.id] || entry.product_name || "produto";

      if (failed.length === 0 && conflicted.length === 0) {
        const partesSucesso = [];
        if (saved.length > 0) {
          partesSucesso.push(`${saved.length} atualizado${saved.length > 1 ? "s" : ""}`);
        }
        if (missing.length > 0) {
          const nomes = missing.map(nomeDe).join(", ");
          partesSucesso.push(
            missing.length === 1
              ? `1 excluído (${nomes}) saiu da contagem`
              : `${missing.length} excluídos saíram da contagem (${nomes})`
          );
        }
        toast.success(`Contagem salva: ${partesSucesso.join(", ")}.`);
        exitCountMode();
        if (onRefresh) onRefresh();
      } else {
        console.error("Erro ao salvar contagem:", failed.map((f) => f.error));
        const partes = [];
        if (saved.length > 0) partes.push(`${saved.length} salvo${saved.length > 1 ? "s" : ""}`);
        if (missing.length > 0) {
          partes.push(
            missing.length === 1 ? "1 excluído (saiu da contagem)" : `${missing.length} excluídos (saíram da contagem)`
          );
        }
        if (conflicted.length > 0) {
          partes.push(
            conflicted.length === 1
              ? "1 mudou enquanto você contava"
              : `${conflicted.length} mudaram enquanto você contava`
          );
        }
        if (failed.length > 0) {
          partes.push(
            failed.length === 1 ? "1 não salvou (falha de rede)" : `${failed.length} não salvaram (falha de rede)`
          );
        }
        toast.error(
          `${partes.join(", ")}. Confira os produtos destacados e toque em "Salvar" de novo.`,
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
      {/* S25 (chave ui_v2): resumo que diz algo útil + ações */}
      {uiV2 && !countMode && resumoV2 && (
        <>
          <ResumoEstoque
            resumo={resumoV2}
            sugestaoStatus={pedidosUnidade.status}
            onTentarDeNovo={pedidosUnidade.tentarDeNovo}
            onContar={handleEnterCountMode}
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative flex-1 md:max-w-sm">
              <span className="sr-only">Buscar produto</span>
              <MaterialIcon icon="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produto"
                className="h-11 w-full rounded-xl border border-surface-line bg-white pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <div className="flex gap-2 md:ml-auto">
              <button type="button" onClick={handleEnterCountMode} className={`${BTN_SECUNDARIO} min-h-11 flex-1 whitespace-nowrap md:flex-none`}>
                <MaterialIcon icon="checklist" size={18} aria-hidden="true" />
                Contar estoque
              </button>
              <button type="button" onClick={handleExportCSV} className={`${BTN_SECUNDARIO} min-h-11 min-w-11 px-3`} title="Baixar planilha do estoque (CSV)">
                <MaterialIcon icon="upload" size={18} aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">CSV</span>
              </button>
              <button type="button" onClick={handleOpenAddDialog} className={`${BTN_PRIMARIO} min-h-11`}>
                <MaterialIcon icon="add" size={18} aria-hidden="true" />
                Adicionar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header actions */}
      {!uiV2 && !countMode && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <span className="font-bold text-ink">{totalProducts}</span> produtos
              {lowStockCount > 0 && uiV2 && (
                // Menu novo (Onda 5, pendência da S14): o selo leva à Reposição, onde o
                // "Acabando" monta o pedido. Com a chave desligada, o selo de sempre.
                <Link
                  to="/Gestao?tab=reposicao"
                  className="ml-2 inline-flex min-h-[32px] items-center gap-1 rounded-full bg-brand/10 px-2.5 text-[11px] font-bold text-brand touch-manipulation active:scale-[0.97]"
                >
                  {lowStockCount} baixo · Repor
                  <MaterialIcon icon="chevron_right" size={14} aria-hidden="true" />
                </Link>
              )}
              {lowStockCount > 0 && !uiV2 && (
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

      {/* Rascunho de contagem pendente (trocou de aba/rota/unidade sem salvar) */}
      {!countMode && pendingDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-brand-gold/10 border border-brand-gold/30 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-brand-gold-ink">
            <MaterialIcon icon="checklist" size={18} className="shrink-0" />
            <span>
              Contagem de estoque pendente ({Object.keys(pendingDraft.base || {}).length} produto
              {Object.keys(pendingDraft.base || {}).length > 1 ? "s" : ""} alterado
              {Object.keys(pendingDraft.base || {}).length > 1 ? "s" : ""}) — continue de onde parou.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
              className="h-9 rounded-xl border-ink-4 text-ink-2"
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={handleResumeDraft}
              className="h-9 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold"
            >
              Continuar contagem
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
                    const touched = item.id in countBase;
                    const before = touched ? Number(countBase[item.id]) : Number(item.quantity) || 0;
                    const value = touched ? counts[item.id] ?? before : Number(item.quantity) || 0;
                    const changed = touched && value !== before;
                    const conflict = countConflicts[item.id];
                    return (
                      <Card
                        key={item.id}
                        className={`rounded-2xl border ${
                          conflict
                            ? "border-brand/50 bg-brand/5"
                            : changed
                              ? "border-brand-gold/40 bg-brand-gold/5"
                              : "border-ink-shadow/5 bg-white"
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
                              {conflict && (
                                <p className="text-xs text-brand font-semibold flex items-center gap-1 mt-0.5">
                                  <MaterialIcon icon="warning" size={13} />
                                  Mudou enquanto você contava (agora {conflict.currentQuantity}). Confira e salve de novo.
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 shrink-0 -mr-2 -mt-1 text-ink-2"
                              onClick={() => handleOpenItemMenu(item)}
                              disabled={isSavingCount}
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
                              disabled={isSavingCount}
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
                                disabled={isSavingCount}
                                className="flex-1 h-11 min-w-0 text-center font-bold bg-surface-line border-none rounded-xl focus-visible:ring-2 focus-visible:ring-brand/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex-1 h-11 min-w-0 rounded-xl bg-surface-line font-bold text-ink text-center text-lg disabled:opacity-60"
                                onClick={() => handleOpenCountInput(item)}
                                disabled={isSavingCount}
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
                              disabled={isSavingCount}
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

      {/* S25: filtro por situação (chips) */}
      {uiV2 && !countMode && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filtrar produtos">
          {filtrosV2.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filtroV2 === f.key}
              onClick={() => setFiltroV2(f.key)}
              className={`${CHIP} ${filtroV2 === f.key ? CHIP_ATIVO : CHIP_INATIVO}`}
            >
              {f.rotulo} · {f.n}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {!uiV2 && !countMode && <FilterBar
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
            {" "}{uiV2 ? "Toque no produto e em Editar produto para pôr o preço." : "Clique no valor para editar."}
          </p>
        </div>
      )}

      {/* S25: lista enxuta; detalhes ao tocar no produto */}
      {uiV2 && !countMode && (gruposV2.length === 0 ? (
        items.filter((i) => i.active !== false).length === 0 ? (
          <EmptyState
            cartao
            icone="package_2"
            titulo="Nenhum produto no estoque"
            texto="Comece pelos produtos da fábrica: toque em Adicionar."
            acao={{ rotulo: "Adicionar produto", onClick: handleOpenAddDialog }}
          />
        ) : (
          <EmptyState
            cartao
            icone="search_off"
            titulo="Nenhum produto com esse filtro"
            texto="Troque o filtro ou limpe a busca."
            acao={{ rotulo: "Ver todos", onClick: () => { setFiltroV2("todos"); setSearchTerm(""); } }}
          />
        )
      ) : (
        <ListaEstoqueV2 grupos={gruposV2} infoDe={(item) => infoV2[item.id]} onAbrir={(item) => setItemAbertoId(item.id)} />
      ))}

      {/* Content */}
      {!uiV2 && !countMode && (filteredItems.length === 0 ? (
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

      {/* S25: detalhes do produto (custo, venda, markup, mínimo, categoria) e ações */}
      {uiV2 && (
        <ItemEstoqueSheet
          item={countMode ? null : itemAberto}
          info={itemAberto ? infoV2[itemAberto.id] : null}
          intervaloDias={pedidosUnidade.intervalo.dias}
          categoria={itemAberto ? itemAberto.category || getCategoryFromName(itemAberto.product_name) : ""}
          onFechar={() => setItemAbertoId(null)}
          onEditar={() => { const it = itemAberto; setItemAbertoId(null); if (it) handleOpenEditDialog(it); }}
          onOcultar={() => { const it = itemAberto; setItemAbertoId(null); if (it) handleToggleActive(it); }}
          onExcluir={() => { const it = itemAberto; setItemAbertoId(null); if (it) setDeleteConfirmId(it.id); }}
          onContar={() => { setItemAbertoId(null); handleEnterCountMode(); }}
        />
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
                readOnly={nomeTravado}
                aria-describedby={nomeTravado ? "nome-fabrica-aviso" : undefined}
                autoComplete="off"
                className="bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20"
              />
              {nomeTravado && (
                <p id="nome-fabrica-aviso" className="text-xs text-ink-2">
                  Produto da fábrica: o nome é o da tabela da Maxi e não muda.
                </p>
              )}
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

            {/* Quantity and Unit — Quantidade some quando editando pelo menu do modo
                Contar estoque: quem muda a quantidade ali é só o +/- da contagem. */}
            <div className={`grid gap-3 ${countMode && editingItem ? "grid-cols-1" : "grid-cols-2"}`}>
              {!(countMode && editingItem) && (
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
              )}

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
                        Markup: {(((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price)) * 100).toFixed(0)}%
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

      {/* "Contar estoque" com rascunho pendente: nunca descarta calado — pergunta antes */}
      <Dialog open={showResumeChoice} onOpenChange={(open) => !open && setShowResumeChoice(false)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-ink">
              <MaterialIcon icon="checklist" size={20} className="text-brand" />
              Já tem uma contagem pendente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-2">
            {Object.keys(pendingDraft?.base || {}).length === 1
              ? "1 produto com número alterado ainda não foi salvo."
              : `${Object.keys(pendingDraft?.base || {}).length} produtos com número alterado ainda não foram salvos.`}
            {" "}Quer continuar de onde parou ou começar do zero?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleStartFreshFromChoice}
              className="border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
            >
              Começar do zero
            </Button>
            <Button
              onClick={handleResumeDraft}
              className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-2"
            >
              Continuar contagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
