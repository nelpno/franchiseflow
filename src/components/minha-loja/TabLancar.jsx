import React, { useState, useMemo } from "react";
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
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
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
  { value: "month", label: "Este mes" },
  { value: "all", label: "Todas" },
];

const SOURCE_CONFIG = {
  manual: { label: "Manual", icon: "edit", className: "bg-[#534343]/10 text-[#534343]" },
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

export default function TabLancar({
  franchiseId,
  currentUser,
  sales,
  contacts,
  inventoryItems,
  onRefresh,
  autoOpenForm = false,
}) {
  const [showFormDialog, setShowFormDialog] = useState(autoOpenForm);
  const [editingSale, setEditingSale] = useState(null);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [deletingSale, setDeletingSale] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      toast.success("Venda excluida.");
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
    const total = filteredSales.reduce((s, sale) => s + (parseFloat(sale.value) || 0), 0);
    const net = filteredSales.reduce((s, sale) => s + (parseFloat(sale.net_value ?? sale.value) || 0), 0);
    return { count: filteredSales.length, total, net };
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
                  : "text-[#534343] hover:bg-[#f5f3f4]"
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#534343]/60"
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
        <div className="flex items-center gap-4 text-sm text-[#534343]">
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
          {periodStats.net !== periodStats.total && (
            <>
              <span className="text-[#291715]/20">|</span>
              <span>
                Liquido{" "}
                <strong className="text-[#1b1c1d] font-mono-numbers">
                  {formatCurrency(periodStats.net)}
                </strong>
              </span>
            </>
          )}
        </div>
      )}

      {/* Sales list */}
      {filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="point_of_sale" size={64} className="text-[#cac0c0] mb-4" />
          <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Nenhuma venda registrada
          </h3>
          <p className="text-sm text-[#534343] max-w-sm">
            Comece lancando sua primeira venda!
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
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#f5f3f4]/50 transition-colors"
                    onClick={() => handleToggleExpand(sale.id)}
                  >
                    {/* Payment icon */}
                    <div className="p-2 bg-[#e9e8e9]/50 rounded-xl shrink-0">
                      <MaterialIcon
                        icon={getPaymentIcon(sale.payment_method)}
                        size={20}
                        className="text-[#534343]"
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
                      <div className="flex items-center gap-2 text-xs text-[#534343] mt-0.5">
                        <span>{formatDateSafe(sale.sale_date || sale.created_at)}</span>
                        <span className="text-[#291715]/20">|</span>
                        <span>{getPaymentLabel(sale.payment_method)}</span>
                        {sale.delivery_method === "delivery" && (
                          <>
                            <span className="text-[#291715]/20">|</span>
                            <span className="flex items-center gap-0.5">
                              <MaterialIcon icon="local_shipping" size={12} />
                              Delivery
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Values */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#1b1c1d] font-mono-numbers">
                        {formatCurrency(sale.value)}
                      </p>
                      {sale.net_value != null && sale.net_value !== sale.value && (
                        <p className="text-xs text-[#534343] font-mono-numbers">
                          Liq. {formatCurrency(sale.net_value)}
                        </p>
                      )}
                    </div>

                    {/* Expand icon */}
                    <MaterialIcon
                      icon={isExpanded ? "expand_less" : "expand_more"}
                      size={20}
                      className="text-[#534343] shrink-0"
                    />
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#291715]/5 px-4 py-3 bg-[#fbf9fa]/50 space-y-3">
                      {/* Sale items */}
                      {saleItemsList.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[#534343] uppercase tracking-wider mb-1">
                            Produtos
                          </p>
                          {saleItemsList.map((si) => (
                            <div
                              key={si.id}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="text-[#1b1c1d]">
                                {si.product_name}{" "}
                                <span className="text-[#534343]">x{si.quantity}</span>
                              </span>
                              <span className="font-mono-numbers text-[#534343]">
                                {formatCurrency(si.quantity * si.unit_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#534343]">
                          Sem detalhamento de produtos
                        </p>
                      )}

                      {/* Financial breakdown */}
                      {(sale.card_fee_amount > 0 || sale.delivery_fee > 0) && (
                        <div className="border-t border-[#291715]/5 pt-2 space-y-1 text-sm">
                          {sale.card_fee_amount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#534343]">
                                Taxa cartao ({sale.card_fee_percent}%)
                              </span>
                              <span className="text-[#b91c1c] font-mono-numbers">
                                - {formatCurrency(sale.card_fee_amount)}
                              </span>
                            </div>
                          )}
                          {sale.delivery_fee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#534343]">Frete</span>
                              <span className="text-[#b91c1c] font-mono-numbers">
                                - {formatCurrency(sale.delivery_fee)}
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
                        const saleValue = parseFloat(sale.value) || 0;
                        const netVal = parseFloat(sale.net_value ?? sale.value) || 0;
                        const lucro = netVal - custoTotal;
                        const margem = saleValue > 0 ? (lucro / saleValue) * 100 : 0;
                        const isPositive = lucro >= 0;

                        return custoTotal > 0 ? (
                          <div className="border-t border-[#291715]/5 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#534343]">Custo dos produtos</span>
                              <span className="font-mono-numbers text-[#534343]">
                                {formatCurrency(custoTotal)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[#534343]">Lucro da venda</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold font-mono-numbers ${
                                    isPositive ? "text-[#16a34a]" : "text-[#b91c1c]"
                                  }`}
                                >
                                  {formatCurrency(lucro)}
                                </span>
                                <Badge
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isPositive
                                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                                      : "bg-[#b91c1c]/10 text-[#b91c1c]"
                                  }`}
                                >
                                  {isPositive ? "\u2191" : "\u2193"} {Math.abs(margem).toFixed(0)}%
                                </Badge>
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
                            handleEditSale(sale);
                          }}
                          className="gap-1.5 text-[#534343]"
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
            onSave={handleFormSave}
            onCancel={() => setShowFormDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingSale} onOpenChange={() => setDeletingSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Excluir venda?</DialogTitle>
            <DialogDescription className="text-[#534343]">
              Esta acao nao pode ser desfeita. A venda de{" "}
              <strong>{formatCurrency(deletingSale?.value)}</strong> sera removida
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
