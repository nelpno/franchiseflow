import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Sale, SaleItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import SaleForm from "./SaleForm";
import SaleReceipt from "./SaleReceipt";
import ExportButtons from "@/components/shared/ExportButtons";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { generateReceiptImage, shareImage, printReceipt } from "@/lib/shareUtils";
import { getSaleNetValue } from "@/lib/financialCalcs";
import { SALES_EXPORT_COLUMNS, buildSalesExportRows } from "@/lib/salesExport";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

const PERIOD_FILTERS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todas" },
];

const CONFIRMATION_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "confirmed", label: "Confirmadas" },
];

const SOURCE_CONFIG = {
  manual: { label: "Manual", icon: "edit", className: "bg-[#4a3d3d]/10 text-[#4a3d3d]" },
  bot: { label: "Bot", icon: "smart_toy", className: "bg-[#775a19]/10 text-[#775a19]" },
};

function getPaymentIcon(method) {
  const pm = PAYMENT_METHODS.find((p) => p.value === method);
  return pm?.icon || "payments";
}

function getPaymentLabel(method) {
  const pm = PAYMENT_METHODS.find((p) => p.value === method);
  return pm?.label || method || "—";
}

function formatDateSafe(dateString) {
  if (!dateString) return "—";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "—";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatTimeSafe(dateString) {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "";
    return format(date, "HH:mm");
  } catch {
    return "";
  }
}

// CAPI Manual Sale: dispara Purchase Meta ao confirmar venda manual.
// Workflow n8n SendCapiOnSaleManual idempotente (skipa se capi_sent=true).
// Fire-and-forget: falha silenciosa pra nao bloquear UI.
async function fireCapiOnConfirm(saleId) {
  try {
    const base = import.meta.env.VITE_N8N_WEBHOOK_BASE;
    const token = import.meta.env.VITE_CAPI_MANUAL_TOKEN;
    if (!base || !token || !saleId) return;
    await fetch(`${base}/send-capi-on-sale-manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sale_id: saleId }),
    });
  } catch {
    /* fail silent */
  }
}

// Throttle helper para bulk confirm: chunks de 5 com 200ms gap.
async function fireCapiBatch(saleIds, batchSize = 5, gapMs = 200) {
  for (let i = 0; i < saleIds.length; i += batchSize) {
    const chunk = saleIds.slice(i, i + batchSize);
    await Promise.all(chunk.map((id) => fireCapiOnConfirm(id)));
    if (i + batchSize < saleIds.length) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}

export default function TabLancar({
  franchiseId,
  franchiseName,
  currentUser,
  sales,
  contacts,
  inventoryItems,
  onRefresh,
  autoOpenForm = false,
  onFormOpened,
  initialContactId = null,
  initialPhone = null,
}) {
  const [showFormDialog, setShowFormDialog] = useState(autoOpenForm);
  // Persist initial contact params in state so they survive URL param clearing
  const [savedContactId, setSavedContactId] = useState(initialContactId);
  const [savedPhone, setSavedPhone] = useState(initialPhone);

  // React to autoOpenForm changes (e.g. FAB clicked while already on Vendas)
  useEffect(() => {
    if (autoOpenForm) {
      setEditingSale(null);
      setShowFormDialog(true);
      if (initialContactId) setSavedContactId(initialContactId);
      if (initialPhone) setSavedPhone(initialPhone);
      onFormOpened?.();
    }
  }, [autoOpenForm]);

  const [editingSale, setEditingSale] = useState(null);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [deletingSale, setDeletingSale] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sharingSaleId, setSharingSaleId] = useState(null);
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const receiptRef = useRef(null);

  // Filters
  const [period, setPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmationFilter, setConfirmationFilter] = useState("all");
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [showConfirmAllDialog, setShowConfirmAllDialog] = useState(false);

  // Contacts map for quick lookup
  const contactsMap = useMemo(() => {
    const map = {};
    contacts.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [contacts]);

  // Period filtering
  const filteredSales = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    return sales
      .filter((s) => {
        const saleDate = s.sale_date || s.created_at?.substring(0, 10) || "";

        // Period filter
        if (period === "today" && saleDate !== todayStr) return false;
        if (period === "week" && saleDate < weekStart) return false;
        if (period === "month" && saleDate < monthStart) return false;

        // Search filter
        if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          const contact = s.contact_id ? contactsMap[s.contact_id] : null;
          const contactName = (contact?.nome || "").toLowerCase();
          const customerName = (s.customer_name || "").toLowerCase();
          if (!contactName.includes(lower) && !customerName.includes(lower)) {
            return false;
          }
        }

        // Confirmation filter
        if (confirmationFilter === "pending" && s.payment_confirmed) return false;
        if (confirmationFilter === "confirmed" && !s.payment_confirmed) return false;

        return true;
      })
      .sort((a, b) => {
        const dateA = a.sale_date || a.created_at || "";
        const dateB = b.sale_date || b.created_at || "";
        return dateB.localeCompare(dateA);
      });
  }, [sales, period, searchTerm, confirmationFilter, contactsMap]);

  // Load sale items for expanded view
  const handleToggleExpand = async (saleId) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }
    setExpandedSaleId(saleId);

    if (!expandedItems[saleId]) {
      try {
        const items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      } catch (err) {
        console.error("Erro ao carregar itens:", err);
        toast.error("Erro ao carregar itens da venda.");
      }
    }
  };

  // Open form for new sale
  const handleNewSale = () => {
    setEditingSale(null);
    setShowFormDialog(true);
  };

  // Open form for editing
  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setShowFormDialog(true);
  };

  // Delete sale
  const handleConfirmDelete = async () => {
    if (!deletingSale) return;
    // Aviso quando venda ja enviou CAPI: deletar deixa Purchase fantasma no Meta
    if (deletingSale.capi_sent) {
      const ok = window.confirm(
        "Esta venda ja enviou conversao para o Meta Ads. Deletar agora deixa um registro fantasma na atribuicao do anuncio. Continuar mesmo assim?"
      );
      if (!ok) return;
    }
    setIsDeleting(true);
    try {
      await Sale.delete(deletingSale.id);
      toast.success("Venda excluída.");
      setDeletingSale(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast.error("Erro ao excluir venda.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle payment confirmation
  const handleToggleConfirmation = async (e, sale) => {
    e.stopPropagation();
    const newValue = !sale.payment_confirmed;

    setTogglingIds((prev) => new Set(prev).add(sale.id));
    try {
      await Sale.update(sale.id, {
        payment_confirmed: newValue,
        confirmed_at: newValue ? new Date().toISOString() : null,
      });
      toast.success(newValue ? "Pagamento confirmado!" : "Confirmação removida.");
      // Dispara CAPI Purchase apenas na flip false -> true
      if (newValue) fireCapiOnConfirm(sale.id);
      onRefresh();
    } catch (err) {
      console.error("Erro ao confirmar pagamento:", err);
      toast.error("Erro ao atualizar confirmação.");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(sale.id);
        return next;
      });
    }
  };

  // Confirm all visible pending sales (batched in groups of 10)
  const handleConfirmAllVisible = async () => {
    const pendingSales = filteredSales.filter((s) => !s.payment_confirmed);
    if (pendingSales.length === 0) return;

    setIsConfirmingAll(true);
    setShowConfirmAllDialog(false);
    const now = new Date().toISOString();
    let succeeded = 0;
    let failed = 0;
    try {
      const BATCH_SIZE = 10;
      const succeededIds = [];
      for (let i = 0; i < pendingSales.length; i += BATCH_SIZE) {
        const batch = pendingSales.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((s) =>
            Sale.update(s.id, { payment_confirmed: true, confirmed_at: now })
          )
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") {
            succeeded += 1;
            succeededIds.push(batch[idx].id);
          } else {
            failed += 1;
          }
        });
      }
      if (failed > 0) {
        toast.error(`${failed} venda(s) não foram confirmadas.`);
      }
      if (succeeded > 0) {
        toast.success(`${succeeded} venda(s) confirmada(s)!`);
      }
      // Dispara CAPI em batch (throttle 5x para nao floodar Meta)
      if (succeededIds.length > 0) fireCapiBatch(succeededIds);
      onRefresh();
    } catch (err) {
      console.error("Erro ao confirmar vendas em lote:", err);
      toast.error("Erro ao confirmar vendas.");
    } finally {
      setIsConfirmingAll(false);
    }
  };

  // After save
  const handleFormSave = () => {
    setShowFormDialog(false);
    setEditingSale(null);
    setExpandedItems({});
    onRefresh();
  };

  // Share sale receipt
  const [shareData, setShareData] = useState(null);

  const handleShareSale = useCallback(async (sale) => {
    const saleId = sale.id;
    setSharingSaleId(saleId);
    try {
      // Ensure items are loaded
      let items = expandedItems[saleId];
      if (!items) {
        items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      }

      const contact = sale.contact_id ? contactsMap[sale.contact_id] : null;

      // Set share data to render receipt off-screen
      setShareData({ sale, saleItems: items, contact });

      // Wait for React to render the receipt
      await new Promise((r) => setTimeout(r, 100));

      if (!receiptRef.current) {
        toast.error("Erro ao gerar comprovante.");
        return;
      }

      const blob = await generateReceiptImage(receiptRef.current);
      const dateStr = format(new Date(), "ddMMyyyy");
      const clientName = contact?.nome?.replace(/\s+/g, "-") || "venda";
      const filename = `comprovante-${clientName}-${dateStr}.png`;

      await shareImage(blob, filename);
    } catch (err) {
      console.error("Erro ao compartilhar:", err);
      toast.error("Erro ao gerar comprovante.");
    } finally {
      setSharingSaleId(null);
      setShareData(null);
    }
  }, [expandedItems, contactsMap]);

  const handlePrintSale = useCallback(async (sale) => {
    const saleId = sale.id;
    setPrintingSaleId(saleId);
    try {
      let items = expandedItems[saleId];
      if (!items) {
        items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      }

      const contact = sale.contact_id ? contactsMap[sale.contact_id] : null;
      setShareData({ sale, saleItems: items, contact });

      await new Promise((r) => setTimeout(r, 100));

      if (!receiptRef.current) {
        toast.error("Erro ao gerar comprovante.");
        return;
      }

      await printReceipt(receiptRef.current);
    } catch (err) {
      console.error("Erro ao imprimir:", err);
      toast.error("Erro ao imprimir comprovante.");
    } finally {
      setPrintingSaleId(null);
      setShareData(null);
    }
  }, [expandedItems, contactsMap]);

  const getContactName = (sale) => {
    if (sale.contact_id && contactsMap[sale.contact_id]) {
      return contactsMap[sale.contact_id].nome || "Sem nome";
    }
    return sale.customer_name || "—";
  };

  const getSourceBadge = (source) => {
    const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
    return (
      <Badge className={`${config.className} rounded-full px-2 py-0.5 text-[10px] font-bold gap-1`}>
        <MaterialIcon icon={config.icon} size={12} />
        {config.label}
      </Badge>
    );
  };

  // Total pending count (ignores confirmation filter — used for badge)
  const totalPendingCount = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    return sales.filter((s) => {
      if (s.payment_confirmed) return false;
      const saleDate = s.sale_date || s.created_at?.substring(0, 10) || "";
      if (period === "today" && saleDate !== todayStr) return false;
      if (period === "week" && saleDate < weekStart) return false;
      if (period === "month" && saleDate < monthStart) return false;
      return true;
    }).length;
  }, [sales, period]);

  // Summary for the filtered period
  const periodStats = useMemo(() => {
    const pending = filteredSales.filter((s) => !s.payment_confirmed);
    const confirmed = filteredSales.filter((s) => s.payment_confirmed);

    return {
      count: filteredSales.length,
      total: filteredSales.reduce((sum, s) => sum + getSaleNetValue(s), 0),
      pendingCount: pending.length,
      pendingTotal: pending.reduce((sum, s) => sum + getSaleNetValue(s), 0),
      confirmedCount: confirmed.length,
      confirmedTotal: confirmed.reduce((sum, s) => sum + getSaleNetValue(s), 0),
    };
  }, [filteredSales]);

  // Export config — period label slug + filename
  const exportConfig = useMemo(() => {
    const periodLabel = PERIOD_FILTERS.find((p) => p.value === period)?.label || "vendas";
    const slug = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const today = format(new Date(), "yyyy-MM-dd");
    const filename = `vendas_${slug(franchiseName) || "franquia"}_${slug(periodLabel)}_${today}`;
    const title = `Vendas — ${franchiseName || ""} (${periodLabel})`;
    const data = buildSalesExportRows(filteredSales, contactsMap, { includeTotalsRow: true });
    return { filename, title, data };
  }, [filteredSales, contactsMap, period, franchiseName]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Button
          onClick={handleNewSale}
          className="bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1.5 shrink-0"
        >
          <MaterialIcon icon="add_circle" size={18} />
          Nova Venda
        </Button>

        {/* Period tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-[#291715]/5 p-1 overflow-x-auto">
          {PERIOD_FILTERS.map((pf) => (
            <button
              key={pf.value}
              onClick={() => setPeriod(pf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                period === pf.value
                  ? "bg-[#b91c1c] text-white"
                  : "text-[#4a3d3d] hover:bg-[#fbf9fa]"
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MaterialIcon
            icon="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a3d3d]/60"
          />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Confirmation filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl border border-[#291715]/5 p-1">
          {CONFIRMATION_FILTERS.map((cf) => (
            <button
              key={cf.value}
              onClick={() => setConfirmationFilter(cf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                confirmationFilter === cf.value
                  ? "bg-[#4a3d3d] text-white"
                  : "text-[#4a3d3d] hover:bg-[#fbf9fa]"
              }`}
            >
              {cf.label}
              {cf.value === "pending" && totalPendingCount > 0 && (
                <span className="ml-1.5 bg-[#f59e0b]/20 text-[#92400e] rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {totalPendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Confirm all visible button */}
        {periodStats.pendingCount > 0 && confirmationFilter !== "confirmed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmAllDialog(true)}
            disabled={isConfirmingAll}
            className="gap-1.5 text-[#16a34a] border-[#16a34a]/30 hover:bg-[#16a34a]/5"
          >
            {isConfirmingAll ? (
              <>
                <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <MaterialIcon icon="done_all" size={14} />
                <span className="hidden sm:inline">Confirmar todas</span>
                <span className="sm:hidden">Todas</span>
                <span className="font-mono-numbers">({periodStats.pendingCount})</span>
              </>
            )}
          </Button>
        )}

        {/* Export (Excel + PDF) */}
        <div className="ml-auto">
          <ExportButtons
            data={exportConfig.data}
            columns={SALES_EXPORT_COLUMNS}
            filename={exportConfig.filename}
            title={exportConfig.title}
          />
        </div>
      </div>

      {/* Period summary */}
      {filteredSales.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#4a3d3d]">
          <span className="flex items-center gap-1">
            <MaterialIcon icon="schedule" size={14} className="text-[#f59e0b]" />
            <strong className="text-[#1b1c1d] font-mono-numbers">{periodStats.pendingCount}</strong>
            {" "}pendente{periodStats.pendingCount !== 1 ? "s" : ""}
            {" "}<span className="font-mono-numbers">({formatCurrency(periodStats.pendingTotal)})</span>
          </span>
          <span className="text-[#291715]/20">|</span>
          <span className="flex items-center gap-1">
            <MaterialIcon icon="check_circle" size={14} className="text-[#16a34a]" />
            <strong className="text-[#1b1c1d] font-mono-numbers">{periodStats.confirmedCount}</strong>
            {" "}recebida{periodStats.confirmedCount !== 1 ? "s" : ""}
            {" "}<span className="font-mono-numbers">({formatCurrency(periodStats.confirmedTotal)})</span>
          </span>
          <span className="text-[#291715]/20">|</span>
          <span>
            Total{" "}
            <strong className="text-[#1b1c1d] font-mono-numbers">
              {formatCurrency(periodStats.total)}
            </strong>
          </span>
        </div>
      )}

      {/* Sales list */}
      {filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="point_of_sale" size={64} className="text-[#cac0c0] mb-4" />
          <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Nenhuma venda registrada
          </h3>
          <p className="text-sm text-[#4a3d3d] max-w-sm">
            Comece lançando sua primeira venda!
          </p>
          <Button
            onClick={handleNewSale}
            className="mt-4 bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1.5"
          >
            <MaterialIcon icon="add_circle" size={18} />
            Nova Venda
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const isExpanded = expandedSaleId === sale.id;
            const saleItemsList = expandedItems[sale.id] || [];

            return (
              <Card
                key={sale.id}
                className={`bg-white rounded-2xl shadow-sm border border-[#291715]/5 overflow-hidden border-l-[3px] ${
                  sale.payment_confirmed
                    ? "border-l-[#16a34a]"
                    : "border-l-[#f59e0b]"
                }`}
              >
                <CardContent className="p-0">
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#fbf9fa]/50 transition-colors"
                    onClick={() => handleToggleExpand(sale.id)}
                  >
                    {/* Payment icon */}
                    <div className="p-2 bg-[#e9e8e9]/50 rounded-xl shrink-0">
                      <MaterialIcon
                        icon={getPaymentIcon(sale.payment_method)}
                        size={20}
                        className="text-[#4a3d3d]"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1b1c1d] truncate">
                          {getContactName(sale)}
                        </span>
                        {getSourceBadge(sale.source)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#4a3d3d] mt-0.5">
                        <span>{formatDateSafe(sale.sale_date || sale.created_at)}{formatTimeSafe(sale.created_at) && ` às ${formatTimeSafe(sale.created_at)}`}</span>
                        <span className="text-[#291715]/20">|</span>
                        <span className="truncate">{getPaymentLabel(sale.payment_method)}</span>
                        {sale.delivery_method === "delivery" && (
                          <span className="flex items-center gap-0.5 text-[#b91c1c]/70">
                            <MaterialIcon icon="delivery_dining" size={12} />
                            Entrega
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Values */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#1b1c1d] font-mono-numbers">
                        {formatCurrency((parseFloat(sale.value) || 0) - (parseFloat(sale.discount_amount) || 0) + (parseFloat(sale.delivery_fee) || 0))}
                      </p>
                      {(sale.delivery_fee > 0 || sale.discount_amount > 0) && (
                        <p className="text-xs text-[#4a3d3d] font-mono-numbers">
                          {formatCurrency(sale.value)}
                          {sale.discount_amount > 0 && ` − ${formatCurrency(sale.discount_amount)} desc`}
                          {sale.delivery_fee > 0 && ` + ${formatCurrency(sale.delivery_fee)} frete`}
                        </p>
                      )}
                    </div>

                    {/* Confirmation toggle chip */}
                    <button
                      onClick={(e) => handleToggleConfirmation(e, sale)}
                      disabled={togglingIds.has(sale.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 min-h-[40px] transition-colors ${
                        sale.payment_confirmed
                          ? "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20"
                          : "bg-[#fef3c7]/50 text-[#92400e] border-[#f59e0b]/30 hover:bg-[#16a34a]/5 hover:text-[#16a34a] hover:border-[#16a34a]/20"
                      }`}
                      title={sale.payment_confirmed ? "Pagamento recebido" : "Marcar como recebido"}
                    >
                      {togglingIds.has(sale.id) ? (
                        <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
                      ) : (
                        <MaterialIcon
                          icon={sale.payment_confirmed ? "check_circle" : "radio_button_unchecked"}
                          size={16}
                        />
                      )}
                      <span className="hidden sm:inline">
                        {sale.payment_confirmed ? "Recebido" : "Pendente"}
                      </span>
                    </button>

                    {/* Expand icon */}
                    <MaterialIcon
                      icon={isExpanded ? "expand_less" : "expand_more"}
                      size={20}
                      className="text-[#4a3d3d] shrink-0"
                    />
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#291715]/5 px-4 py-3 bg-[#fbf9fa]/50 space-y-3">
                      {/* Sale items */}
                      {saleItemsList.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[#4a3d3d] uppercase tracking-wider mb-1">
                            Produtos
                          </p>
                          {saleItemsList.map((si) => (
                            <div
                              key={si.id}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="text-[#1b1c1d]">
                                {si.product_name}{" "}
                                <span className="text-[#4a3d3d]">x{si.quantity}</span>
                              </span>
                              <span className="font-mono-numbers text-[#4a3d3d]">
                                {formatCurrency(si.quantity * si.unit_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#4a3d3d]">
                          Sem detalhamento de produtos
                        </p>
                      )}

                      {/* Financial breakdown */}
                      {(sale.card_fee_amount > 0 || sale.delivery_fee > 0 || sale.discount_amount > 0) && (
                        <div className="border-t border-[#291715]/5 pt-2 space-y-1 text-sm">
                          {sale.discount_amount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#4a3d3d]">
                                Desconto{sale.discount_type === "percent" && sale.discount_input ? ` (${sale.discount_input}%)` : ""}
                              </span>
                              <span className="text-[#dc2626] font-mono-numbers">
                                − {formatCurrency(sale.discount_amount)}
                              </span>
                            </div>
                          )}
                          {sale.delivery_fee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#4a3d3d]">Frete cobrado</span>
                              <span className="text-[#16a34a] font-mono-numbers">
                                + {formatCurrency(sale.delivery_fee)}
                              </span>
                            </div>
                          )}
                          {sale.card_fee_amount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#4a3d3d]">
                                Taxa {sale.payment_method === "payment_link" ? "link" : "cartão"} ({sale.card_fee_percent}%)
                              </span>
                              <span className="text-[#dc2626] font-mono-numbers">
                                - {formatCurrency(sale.card_fee_amount)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Profit margin */}
                      {saleItemsList.length > 0 && (() => {
                        const custoTotal = saleItemsList.reduce(
                          (sum, si) => sum + (parseFloat(si.cost_price) || 0) * (si.quantity || 1),
                          0
                        );
                        const totalRecebido = (parseFloat(sale.value) || 0) - (parseFloat(sale.discount_amount) || 0) + (parseFloat(sale.delivery_fee) || 0);
                        const taxaCartao = parseFloat(sale.card_fee_amount) || 0;
                        const lucro = totalRecebido - custoTotal - taxaCartao;
                        const margem = totalRecebido > 0 ? (lucro / totalRecebido) * 100 : 0;
                        const isPositive = lucro >= 0;

                        return custoTotal > 0 ? (
                          <div className="border-t border-[#291715]/5 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#4a3d3d]">Custo dos produtos</span>
                              <span className="font-mono-numbers text-[#4a3d3d]">
                                {formatCurrency(custoTotal)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[#4a3d3d]">Lucro da venda</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold font-mono-numbers ${
                                    isPositive ? "text-[#16a34a]" : "text-[#dc2626]"
                                  }`}
                                >
                                  {formatCurrency(lucro)}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold inline-flex items-center ${
                                    !isPositive
                                      ? "bg-[#dc2626]/10 text-[#dc2626]"
                                      : margem < 25
                                      ? "bg-[#f59e0b]/10 text-[#b45309]"
                                      : "bg-[#16a34a]/10 text-[#16a34a]"
                                  }`}
                                >
                                  {!isPositive ? "\u2193" : margem < 25 ? "!" : "\u2191"} {Math.abs(margem).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareSale(sale);
                          }}
                          disabled={sharingSaleId === sale.id}
                          className="gap-1.5 text-[#4a3d3d]"
                        >
                          {sharingSaleId === sale.id ? (
                            <>
                              <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                              <span className="hidden sm:inline">Gerando...</span>
                            </>
                          ) : (
                            <>
                              <MaterialIcon icon="share" size={14} />
                              <span className="hidden sm:inline">Compartilhar</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintSale(sale);
                          }}
                          disabled={printingSaleId === sale.id}
                          className="gap-1.5 text-[#4a3d3d]"
                        >
                          {printingSaleId === sale.id ? (
                            <>
                              <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                              <span className="hidden sm:inline">Imprimindo...</span>
                            </>
                          ) : (
                            <>
                              <MaterialIcon icon="print" size={14} />
                              <span className="hidden sm:inline">Imprimir</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSale(sale);
                          }}
                          className="gap-1.5 text-[#4a3d3d]"
                        >
                          <MaterialIcon icon="edit" size={14} />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSale(sale);
                          }}
                          className="gap-1.5 text-[#b91c1c] border-[#b91c1c]/30 hover:bg-[#b91c1c]/5"
                        >
                          <MaterialIcon icon="delete" size={14} />
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sale Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) { setSavedContactId(null); setSavedPhone(null); }
      }}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[85dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">
              {editingSale ? "Editar Venda" : "Nova Venda"}
            </DialogTitle>
          </DialogHeader>
          <SaleForm
            sale={editingSale}
            franchiseId={franchiseId}
            contacts={contacts}
            inventoryItems={inventoryItems}
            currentUser={currentUser}
            onSave={handleFormSave}
            onCancel={() => setShowFormDialog(false)}
            initialContactId={!editingSale ? savedContactId : null}
            initialPhone={!editingSale ? savedPhone : null}
          />
        </DialogContent>
      </Dialog>

      {/* Off-screen receipt for image generation */}
      {shareData && (
        <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
          <SaleReceipt
            ref={receiptRef}
            sale={shareData.sale}
            saleItems={shareData.saleItems}
            contact={shareData.contact}
            franchiseName={franchiseName}
          />
        </div>
      )}

      {/* Confirm all dialog */}
      <Dialog open={showConfirmAllDialog} onOpenChange={setShowConfirmAllDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Confirmar recebimento?</DialogTitle>
            <DialogDescription className="text-[#4a3d3d]">
              Marcar{" "}
              <strong>{periodStats.pendingCount} venda{periodStats.pendingCount !== 1 ? "s" : ""}</strong>{" "}
              como recebida{periodStats.pendingCount !== 1 ? "s" : ""}?
              <br />
              <span className="font-mono-numbers">
                Total: <strong>{formatCurrency(periodStats.pendingTotal)}</strong>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmAllDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAllVisible}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white gap-1.5"
            >
              <MaterialIcon icon="done_all" size={16} />
              Confirmar todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingSale} onOpenChange={() => setDeletingSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Excluir venda?</DialogTitle>
            <DialogDescription className="text-[#4a3d3d]">
              Esta ação não pode ser desfeita. A venda de{" "}
              <strong>{formatCurrency(deletingSale?.value)}</strong> será removida
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingSale(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white"
            >
              {isDeleting ? (
                <>
                  <MaterialIcon icon="progress_activity" size={16} className="animate-spin mr-1" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
