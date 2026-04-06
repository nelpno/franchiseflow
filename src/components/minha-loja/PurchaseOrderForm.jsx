import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
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

const getErrorMessage = (error) => {
  const msg = error?.message || "";
  if (msg.includes("JWT") || msg.includes("token") || msg.includes("expired") || error?.status === 401) {
    return "Sessão expirada. Faça login novamente.";
  }
  if (msg.includes("row-level security") || error?.code === "42501") {
    return "Sem permissão para criar pedido. Verifique seu cadastro.";
  }
  if (msg.includes("violates foreign key") || error?.code === "23503") {
    return "Franquia não encontrada. Atualize a página e tente novamente.";
  }
  if (msg.includes("Tempo limite")) {
    return "Servidor demorou para responder. Tente novamente.";
  }
  return msg || "Erro desconhecido";
};

export default function PurchaseOrderForm({
  franchiseId,
  inventoryItems,
  saleItems,
  initialQuantities,
  onSave,
  onCancel,
}) {
  const DRAFT_KEY = `reposicao_draft_${franchiseId}`;
  const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > DRAFT_MAX_AGE) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return draft;
    } catch { return null; }
  };

  const draft = useRef(loadDraft());

  const [notes, setNotes] = useState(draft.current?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Standard products = those with cost_price > 0
  const standardProducts = useMemo(() => {
    return (inventoryItems || []).filter(
      (item) => item.cost_price && parseFloat(item.cost_price) > 0
    );
  }, [inventoryItems]);

  // Group products by type (first word of product_name)
  const productGroups = useMemo(() => {
    const groups = [];
    const groupMap = {};
    const ORDER = ["Canelone", "Conchiglione", "Massa", "Nhoque", "Fatiado", "Rondelli", "Sofioli", "Molho"];

    standardProducts.forEach((item) => {
      const firstWord = item.product_name.split(" ")[0];
      if (!groupMap[firstWord]) {
        groupMap[firstWord] = { label: firstWord, items: [] };
        groups.push(groupMap[firstWord]);
      }
      groupMap[firstWord].items.push(item);
    });

    // Sort groups by the ORDER array, unknown types go to the end
    groups.sort((a, b) => {
      const ai = ORDER.indexOf(a.label);
      const bi = ORDER.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return groups;
  }, [standardProducts]);

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

  // Quantities state: { itemId: qty } — restore from draft > initialQuantities > 0
  const [quantities, setQuantities] = useState(() => {
    const savedQtys = draft.current?.quantities;
    const init = {};
    standardProducts.forEach((item) => {
      if (initialQuantities && initialQuantities[item.id]) {
        init[item.id] = initialQuantities[item.id];
      } else if (savedQtys && savedQtys[item.id]) {
        init[item.id] = savedQtys[item.id];
      } else {
        init[item.id] = 0;
      }
    });
    return init;
  });

  // Persist draft to localStorage on change
  const saveDraft = useCallback((qtys, n) => {
    const hasData = Object.values(qtys).some(v => v > 0) || n.trim().length > 0;
    if (hasData) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ quantities: qtys, notes: n, savedAt: Date.now() }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [DRAFT_KEY]);

  useEffect(() => { saveDraft(quantities, notes); }, [quantities, notes, saveDraft]);

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  const setQty = (itemId, value) => {
    if (value === "" || value === undefined) {
      setQuantities((prev) => ({ ...prev, [itemId]: "" }));
      return;
    }
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
    toast.success("Quantidades preenchidas com sugestão.");
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
    if (submittingRef.current) return;

    if (!franchiseId) {
      toast.error("Franquia não identificada. Atualize a página.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const toastId = toast.loading("Enviando pedido...");
    let order = null;
    try {
      // Create PurchaseOrder header
      order = await PurchaseOrder.create({
        franchise_id: franchiseId,
        status: "pendente",
        total_amount: grandTotal,
        notes: notes.trim() || null,
        ordered_at: new Date().toISOString(),
      });

      // Create all items in a single atomic request
      const itemsToCreate = standardProducts
        .filter((item) => (quantities[item.id] || 0) > 0)
        .map((item) => ({
          order_id: order.id,
          inventory_item_id: item.id,
          product_name: item.product_name,
          quantity: quantities[item.id],
          unit_price: parseFloat(item.cost_price),
        }));

      await PurchaseOrderItem.createMany(itemsToCreate);

      // Notificar admins (fire-and-forget — erro aqui NÃO afeta o pedido)
      // Trigger on_new_purchase_order foi esvaziado — notificação fica no frontend
      // porque aqui já temos valor total e quantidade calculados
      try {
        await supabase.rpc('notify_admins', {
          p_title: 'Novo pedido de reposição',
          p_message: `Pedido de ${formatBRL(grandTotal)} — ${itemsToCreate.length} produtos`,
          p_type: 'info',
          p_icon: 'local_shipping',
          p_link: '/PurchaseOrders',
        });
      } catch { /* notificação é bonus, pedido já foi criado */ }

      clearDraft();
      toast.success("Pedido enviado com sucesso!", { id: toastId });
      // NÃO resetar submittingRef — componente vai desmontar via onSave
      if (onSave) onSave();
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      // Cleanup orphan order if items failed
      if (order?.id) {
        PurchaseOrder.delete(order.id).catch(() => {});
      }
      toast.error(getErrorMessage(error), { id: toastId });
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const hasSuggestions = standardProducts.some(
    (item) => getSuggestion(item) !== null && getSuggestion(item) > 0
  );

  return (
    <div className="space-y-4">
      {/* Draft restored indicator */}
      {draft.current && !initialQuantities && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-sm text-[#775a19]">
          <MaterialIcon icon="history" size={18} />
          <span>Rascunho restaurado.</span>
          <button
            onClick={() => {
              clearDraft();
              const reset = {};
              standardProducts.forEach(i => { reset[i.id] = 0; });
              setQuantities(reset);
              setNotes("");
              draft.current = null;
            }}
            className="ml-auto text-xs font-medium underline"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Header with suggestion button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-[#4a3d3d]">
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
                    <TableHead className="text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                      Produto
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                      Custo
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                      Estoque
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                      Sugestão
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta w-[100px]">
                      QTD
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-[#1b1c1d]/60 font-plus-jakarta">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productGroups.map((group) => (
                    <React.Fragment key={group.label}>
                      <TableRow className="bg-[#fbf9fa] border-t border-[#291715]/10">
                        <TableCell colSpan={6} className="py-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#b91c1c] font-plus-jakarta">
                            {group.label}
                          </span>
                        </TableCell>
                      </TableRow>
                      {group.items.map((item) => {
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
                                : "hover:bg-[#fbf9fa]"
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
                                      : "bg-[#e9e8e9] text-[#4a3d3d]"
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
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: card layout grouped */}
      <div className="md:hidden space-y-4">
        {productGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#b91c1c] font-plus-jakarta px-1">
              {group.label}
            </h3>
            {group.items.map((item) => {
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
                    <p className="text-xs text-[#4a3d3d]">
                      Custo: {formatBRL(item.cost_price)} · Estoque: {item.quantity ?? 0}
                    </p>
                  </div>
                  {suggestion !== null && (
                    <Badge
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ml-2 ${
                        hasSug
                          ? "bg-[#d4af37]/10 text-[#775a19]"
                          : "bg-[#e9e8e9] text-[#4a3d3d]"
                      }`}
                    >
                      Sug: {suggestion}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
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
                    <Label className="text-[10px] uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
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
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-[#1b1c1d]">Comentário</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações sobre o pedido..."
          rows={3}
          className="w-full rounded-xl bg-[#e9e8e9] border-none px-4 py-3 text-sm focus:ring-2 focus:ring-[#b91c1c]/20 focus:outline-none resize-none"
        />
      </div>

      {/* Grand total + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[#cac0c0]/30">
        <div>
          <span className="text-sm text-[#4a3d3d]">Total do pedido</span>
          <p className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">
            {formatBRL(grandTotal)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-[#cac0c0] text-[#4a3d3d] rounded-xl hover:bg-[#fbf9fa]"
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
