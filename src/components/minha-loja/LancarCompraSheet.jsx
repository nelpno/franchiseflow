import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/api/supabaseClient";

const TIPOS = [
  { value: "produto", label: "Produto", icon: "shopping_basket", color: "#b91c1c", help: "Massas, molhos, sobremesas — sobe no estoque" },
  { value: "embalagem", label: "Embalagem", icon: "inventory_2", color: "#7c2d12", help: "Sacolas, filme, etiquetas — só registra despesa" },
  { value: "insumo", label: "Insumo", icon: "kitchen", color: "#a16207", help: "Gás, tempero, óleo — só registra despesa" },
];

export default function LancarCompraSheet({
  open,
  onOpenChange,
  franchiseId,
  inventoryItems = [],
  recentSuppliers = [],
  onSaved,
}) {
  const [type, setType] = useState("produto");
  const [supplier, setSupplier] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setType("produto");
      setSupplier("");
      setInventoryItemId("");
      setQty("");
      setUnitCost("");
      setExpenseDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
    }
  }, [open]);

  // Item escolhido (pra mostrar custo médio sugerido)
  const selectedItem = useMemo(
    () => inventoryItems.find(i => i.id === inventoryItemId),
    [inventoryItems, inventoryItemId]
  );

  // Custo médio ponderado sugerido (preview client-side)
  const sugestaoCustoMedio = useMemo(() => {
    if (type !== "produto" || !selectedItem || !qty || !unitCost) return null;
    const qOld = parseFloat(selectedItem.quantity) || 0;
    const cOld = parseFloat(selectedItem.cost_price) || 0;
    const qNew = parseFloat(qty) || 0;
    const cNew = parseFloat(unitCost) || 0;
    if (qOld + qNew <= 0) return null;
    if (qOld <= 0 || cOld <= 0) return cNew;
    return ((qOld * cOld) + (qNew * cNew)) / (qOld + qNew);
  }, [type, selectedItem, qty, unitCost]);

  const totalAmount = useMemo(() => {
    const q = parseFloat(qty) || 0;
    const c = parseFloat(unitCost) || 0;
    return q * c;
  }, [qty, unitCost]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();

    // Validações
    const q = parseFloat(qty);
    const c = parseFloat(unitCost);
    if (!q || q <= 0) { toast.error("Informe a quantidade."); return; }
    if (!c || c <= 0) { toast.error("Informe o custo unitário."); return; }
    if (type === "produto" && !inventoryItemId) {
      toast.error("Selecione o produto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("record_external_purchase", {
        p_franchise_id: franchiseId,
        p_type: type,
        p_unit_cost: c,
        p_qty: q,
        p_supplier: supplier.trim() || null,
        p_expense_date: expenseDate,
        p_inventory_item_id: type === "produto" ? inventoryItemId : null,
        p_description: description.trim() || null,
      });

      if (error) throw error;

      const msg = type === "produto"
        ? `Compra registrada! Estoque atualizado: +${q} un · R$ ${(q * c).toFixed(2)}`
        : `Compra registrada! Despesa de R$ ${(q * c).toFixed(2)} criada.`;
      toast.success(msg);
      onSaved?.(data);
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao lançar compra:", err);
      toast.error(err?.message || "Erro ao lançar compra. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [type, inventoryItemId, qty, unitCost, supplier, expenseDate, description, franchiseId, onSaved, onOpenChange]);

  const tipoMeta = TIPOS.find(t => t.value === type) || TIPOS[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto sm:max-w-2xl sm:mx-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-plus-jakarta">
            <MaterialIcon icon="add_shopping_cart" size={20} className="text-[#b91c1c]" />
            Lançar compra externa
          </SheetTitle>
          <SheetDescription className="text-xs">
            Compras de mercado, distribuidora, fornecedor externo. Pedido da Maxi Massas é registrado automático ao receber.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#1b1c1d]">Tipo de compra</Label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    type === t.value
                      ? "border-[#b91c1c] bg-[#b91c1c]/5"
                      : "border-[#291715]/10 hover:border-[#291715]/20 bg-white"
                  }`}
                >
                  <MaterialIcon icon={t.icon} size={20} style={{ color: t.color }} />
                  <span className="text-xs font-medium text-[#1b1c1d]">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#4a3d3d]/70">{tipoMeta.help}</p>
          </div>

          {/* Produto (só se tipo=produto) */}
          {type === "produto" && (
            <div className="space-y-2">
              <Label htmlFor="lc-item" className="text-sm font-medium text-[#1b1c1d]">
                Produto do estoque
              </Label>
              <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
                <SelectTrigger id="lc-item" className="bg-[#e9e8e9]/50">
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems
                    .filter(i => i.active !== false)
                    .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""))
                    .map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{i.product_name}</span>
                          <span className="text-xs text-[#4a3d3d] font-mono-numbers">
                            estoque {i.quantity} un
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-[11px] text-[#4a3d3d]/70">
                  Custo atual: R$ {parseFloat(selectedItem.cost_price || 0).toFixed(2)} · estoque {selectedItem.quantity} un
                </p>
              )}
            </div>
          )}

          {/* Quantidade + Custo unitário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lc-qty" className="text-sm font-medium text-[#1b1c1d]">
                Quantidade
              </Label>
              <Input
                id="lc-qty"
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="bg-[#e9e8e9]/50 text-right font-mono-numbers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lc-unit-cost" className="text-sm font-medium text-[#1b1c1d]">
                Custo unitário (R$)
              </Label>
              <Input
                id="lc-unit-cost"
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                placeholder="0,00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="bg-[#e9e8e9]/50 text-right font-mono-numbers"
              />
            </div>
          </div>

          {/* Total + sugestão custo médio */}
          {totalAmount > 0 && (
            <div className="rounded-xl bg-[#fbf9fa] border border-[#291715]/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4a3d3d]">Total da compra</span>
                <span className="font-bold text-[#1b1c1d] font-mono-numbers">R$ {totalAmount.toFixed(2)}</span>
              </div>
              {sugestaoCustoMedio !== null && selectedItem && (
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#291715]/5">
                  <span className="text-[#4a3d3d] flex items-center gap-1">
                    <MaterialIcon icon="lightbulb" size={12} className="text-[#d4af37]" />
                    Novo custo médio do produto
                  </span>
                  <span className="font-mono-numbers font-medium text-[#775a19]">
                    R$ {sugestaoCustoMedio.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Fornecedor */}
          <div className="space-y-2">
            <Label htmlFor="lc-supplier" className="text-sm font-medium text-[#1b1c1d]">
              Fornecedor <span className="text-[11px] text-[#4a3d3d]/60 font-normal">(opcional)</span>
            </Label>
            <Input
              id="lc-supplier"
              placeholder="Ex: Mercado X, Distribuidora Y..."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="bg-[#e9e8e9]/50"
              autoComplete="off"
              list="supplier-list"
            />
            {recentSuppliers.length > 0 && (
              <datalist id="supplier-list">
                {recentSuppliers.map((s) => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>

          {/* Descrição opcional */}
          <div className="space-y-2">
            <Label htmlFor="lc-description" className="text-sm font-medium text-[#1b1c1d]">
              Descrição <span className="text-[11px] text-[#4a3d3d]/60 font-normal">(opcional)</span>
            </Label>
            <Input
              id="lc-description"
              placeholder="Ex: Reposição emergencial Sábado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#e9e8e9]/50"
              autoComplete="off"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="lc-date" className="text-sm font-medium text-[#1b1c1d]">Data</Label>
            <Input
              id="lc-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="bg-[#e9e8e9]/50"
              max={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white"
            >
              {isSubmitting ? (
                <>
                  <MaterialIcon icon="progress_activity" size={16} className="animate-spin mr-2" />
                  Lançando...
                </>
              ) : (
                "Lançar compra"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
