import React, { useState, useMemo, useRef, useCallback } from "react";
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
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { generateReceiptImage, shareImage } from "@/lib/shareUtils";
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

const SOURCE_CONFIG = {
  manual: { label: "Manual", icon: "edit", className: "bg-[#4a3d3d]/10 text-[#4a3d3d]" },
  bot: { label: "Bot", icon: "smart_toy", className: "bg-[#775a19]/10 text-[#775a19]" },
  whatsapp: { label: "WhatsApp", icon: "chat", className: "bg-[#b91c1c]/10 text-[#b91c1c]" },
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

export default function TabLancar({
  franchiseId,
  franchiseName,
  currentUser,
  sales,
  contacts,
  inventoryItems,
  onRefresh,
  autoOpenForm = false,
  initialContactId = null,
  initialPhone = null,
}) {
  const [showFormDialog, setShowFormDialog] = useState(autoOpenForm);
  const [editingSale, setEditingSale] = useState(null);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [deletingSale, setDeletingSale] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sharingSaleId, setSharingSaleId] = useState(null);
  const receiptRef = useRef(null);

  // Filters
  const [period, setPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");

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

        return true;
      })
      .sort((a, b) => {
        const dateA = a.sale_date || a.created_at || "";
        const dateB = b.sale_date || b.created_at || "";
        return dateB.localeCompare(dateA);
      });
  }, [sales, period, searchTerm, contactsMap]);

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

  // Summary for the filtered period
  const periodStats = useMemo(() => {
    const total = filteredSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0), 0);
    return { count: filteredSales.length, total };
  }, [filteredSales]);

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

      {/* Period summary */}
      {filteredSales.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-[#4a3d3d]">
          <span>
            <strong className="text-[#1b1c1d] font-mono-numbers">{periodStats.count}</strong>{" "}
            {periodStats.count === 1 ? "venda" : "vendas"}
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
                className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 overflow-hidden"
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
                        {formatCurrency((parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0))}
                      </p>
                      {sale.delivery_fee > 0 && (
                        <p className="text-xs text-[#4a3d3d] font-mono-numbers">
                          {formatCurrency(sale.value)} + {formatCurrency(sale.delivery_fee)} frete
                        </p>
                      )}
                    </div>

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
                      {(sale.card_fee_amount > 0 || sale.delivery_fee > 0) && (
                        <div className="border-t border-[#291715]/5 pt-2 space-y-1 text-sm">
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
                                Taxa cartão ({sale.card_fee_percent}%)
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
                        const totalRecebido = (parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0);
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
                      <div className="flex gap-2 pt-1">
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
                              Gerando...
                            </>
                          ) : (
                            <>
                              <MaterialIcon icon="share" size={14} />
                              Compartilhar
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
                          Editar
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
                          Excluir
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
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
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
            initialContactId={!editingSale ? initialContactId : null}
            initialPhone={!editingSale ? initialPhone : null}
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
