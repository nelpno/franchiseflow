import React, { useState, useMemo } from "react";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { subDays } from "date-fns";

const formatBRL = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function PurchaseOrderForm({
  franchiseId,
  inventoryItems,
  saleItems,
  onSave,
  onCancel,
}) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Standard products = those with cost_price > 0
  const standardProducts = useMemo(() => {
    return (inventoryItems || []).filter(
      (item) => item.cost_price && parseFloat(item.cost_price) > 0
    );
  }, [inventoryItems]);

  // Weekly turnover per item (last 28 days / 4)
  const weeklyTurnover = useMemo(() => {
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

    const result = {};
    for (const [id, total] of Object.entries(agg)) {
      result[id] = total / 4;
    }
    return result;
  }, [saleItems]);

  // Suggestion per item
  const getSuggestion = (item) => {
    const wt = weeklyTurnover[item.id];
    if (!wt || wt <= 0) return null;
    const qty = item.quantity || 0;
    return Math.max(0, Math.ceil(wt * 2) - qty);
  };

  // Quantities state: { itemId: qty }
  const [quantities, setQuantities] = useState(() => {
    const init = {};
    standardProducts.forEach((item) => {
      init[item.id] = 0;
    });
    return init;
  });

  const setQty = (itemId, value) => {
    const parsed = parseInt(value, 10);
    setQuantities((prev) => ({
      ...prev,
      [itemId]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  const handleUseSuggestions = () => {
    const newQtys = { ...quantities };
    standardProducts.forEach((item) => {
      const sug = getSuggestion(item);
      if (sug !== null && sug > 0) {
        newQtys[item.id] = sug;
      }
    });
    setQuantities(newQtys);
    toast.success("Quantidades preenchidas com sugestao.");
  };

  // Line total
  const getLineTotal = (item) => {
    const qty = quantities[item.id] || 0;
    return qty * (parseFloat(item.cost_price) || 0);
  };

  // Grand total
  const grandTotal = useMemo(() => {
    return standardProducts.reduce((sum, item) => sum + getLineTotal(item), 0);
  }, [standardProducts, quantities]);

  const hasAnyQty = standardProducts.some((item) => (quantities[item.id] || 0) > 0);

  const handleSubmit = async () => {
    if (!hasAnyQty) return;

    setIsSubmitting(true);
    try {
      // Create PurchaseOrder
      const order = await PurchaseOrder.create({
        franchise_id: franchiseId,
        status: "pendente",
        total_amount: grandTotal,
        notes: notes.trim() || null,
        ordered_at: new Date().toISOString(),
      });

      // Create PurchaseOrderItems
      const itemsToCreate = standardProducts
        .filter((item) => (quantities[item.id] || 0) > 0)
        .map((item) => ({
          order_id: order.id,
          inventory_item_id: item.id,
          product_name: item.product_name,
          quantity: quantities[item.id],
          unit_price: parseFloat(item.cost_price),
        }));

      // Create each item
      for (const orderItem of itemsToCreate) {
        await PurchaseOrderItem.create(orderItem);
      }

      toast.success("Pedido enviado com sucesso!");
      if (onSave) onSave();
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSuggestions = standardProducts.some(
    (item) => getSuggestion(item) !== null && getSuggestion(item) > 0
  );

  return (
    <div className="space-y-4">
      {/* Header with suggestion button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-[#534343]">
          Selecione as quantidades dos produtos que deseja encomendar.
        </p>
        {hasSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseSuggestions}
            className="gap-2 border-[#d4af37] text-[#775a19] rounded-xl hover:bg-[#d4af37]/10"
          >
            <MaterialIcon icon="auto_fix_high" size={16} />
            Usar sugestao
          </Button>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#cac0c0]/30">
                    <TableHead className="text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Produto
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Custo
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Estoque
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Sugestao
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta w-[100px]">
                      QTD
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#291715]/60 font-plus-jakarta">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardProducts.map((item) => {
                    const suggestion = getSuggestion(item);
                    const hasSug = suggestion !== null && suggestion > 0;
                    const lineTotal = getLineTotal(item);
                    const qty = quantities[item.id] || 0;

                    return (
                      <TableRow
                        key={item.id}
                        className={
                          hasSug
                            ? "border-l-2 border-l-[#d4af37] hover:bg-[#d4af37]/5"
                            : "hover:bg-[#f5f3f4]"
                        }
                      >
                        <TableCell className="font-medium text-[#1b1c1d]">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-right text-sm text-[#4a3d3d]">
                          {formatBRL(item.cost_price)}
                        </TableCell>
                        <TableCell className="text-center text-sm text-[#4a3d3d]">
                          {item.quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {suggestion !== null ? (
                            <Badge
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                hasSug
                                  ? "bg-[#d4af37]/10 text-[#775a19]"
                                  : "bg-[#e9e8e9] text-[#534343]"
                              }`}
                            >
                              {suggestion}
                            </Badge>
                          ) : (
                            <span className="text-sm text-[#cac0c0]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={qty || ""}
                            onChange={(e) => setQty(item.id, e.target.value)}
                            placeholder="0"
                            className="w-20 mx-auto text-center h-8 bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-[#1b1c1d]">
                          {qty > 0 ? formatBRL(lineTotal) : "—"}
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

      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {standardProducts.map((item) => {
          const suggestion = getSuggestion(item);
          const hasSug = suggestion !== null && suggestion > 0;
          const lineTotal = getLineTotal(item);
          const qty = quantities[item.id] || 0;

          return (
            <Card
              key={item.id}
              className={`rounded-2xl shadow-sm border ${
                hasSug
                  ? "border-[#d4af37]/40 bg-[#d4af37]/5"
                  : "border-[#291715]/5 bg-white"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#1b1c1d] truncate">
                      {item.product_name}
                    </h4>
                    <p className="text-xs text-[#534343]">
                      Custo: {formatBRL(item.cost_price)} · Estoque: {item.quantity ?? 0}
                    </p>
                  </div>
                  {suggestion !== null && (
                    <Badge
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ml-2 ${
                        hasSug
                          ? "bg-[#d4af37]/10 text-[#775a19]"
                          : "bg-[#e9e8e9] text-[#534343]"
                      }`}
                    >
                      Sug: {suggestion}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-[10px] uppercase tracking-widest text-[#534343]/70 font-plus-jakarta">
                      Quantidade
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={qty || ""}
                      onChange={(e) => setQty(item.id, e.target.value)}
                      placeholder="0"
                      className="h-9 bg-[#e9e8e9] border-none rounded-xl px-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>
                  <div className="text-right">
                    <Label className="text-[10px] uppercase tracking-widest text-[#534343]/70 font-plus-jakarta">
                      Total
                    </Label>
                    <p className="font-medium text-[#1b1c1d] text-sm mt-1">
                      {qty > 0 ? formatBRL(lineTotal) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-[#1b1c1d]">Comentario</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observacoes sobre o pedido..."
          rows={3}
          className="w-full rounded-xl bg-[#e9e8e9] border-none px-4 py-3 text-sm focus:ring-2 focus:ring-[#b91c1c]/20 focus:outline-none resize-none"
        />
      </div>

      {/* Grand total + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[#cac0c0]/30">
        <div>
          <span className="text-sm text-[#534343]">Total do pedido</span>
          <p className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">
            {formatBRL(grandTotal)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-[#cac0c0] text-[#534343] rounded-xl hover:bg-[#f5f3f4]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasAnyQty || isSubmitting}
            className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
          >
            {isSubmitting ? (
              <>
                <MaterialIcon
                  icon="progress_activity"
                  size={16}
                  className="animate-spin"
                />
                Enviando...
              </>
            ) : (
              <>
                <MaterialIcon icon="send" size={16} />
                Enviar Pedido
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
