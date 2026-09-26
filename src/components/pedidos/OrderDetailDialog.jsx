// "Ver itens →" — detalhe do pedido. Extraído do PurchaseOrders.jsx original (1.679
// linhas); mesma lógica de edição/status/exclusão/ficha individual, agora self-contained
// (busca os itens sozinho ao abrir, avisa o pai só quando algo muda de verdade via
// onChanged, para a lista recarregar).
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { formatDateOnly } from "@/lib/dateOnly";
import { formatBRL } from "@/lib/formatters";
import { linkFicha } from "@/lib/networkOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABEL, isAtrasado, isDeletable, freteSugerido, dataBRT, meioDiaBRT } from "./pedidosHelpers";

const STATUS_ICON = {
  pendente: "schedule",
  confirmado: "check_circle",
  em_rota: "local_shipping",
  entregue: "inventory",
  cancelado: "cancel",
};
// R1 do padrão visual: só tokens (nunca hex cru). "pendente"/"confirmado" usam warn/brand
// (mais perto do amarelo/azul originais que existe no token set); em_rota e cancelado usam
// ink-3 (neutro, sem status próprio no design system).
const STATUS_COLOR = {
  pendente: "bg-warn-soft text-warn-ink",
  confirmado: "bg-brand-soft text-brand-dark",
  em_rota: "bg-warn-soft text-warn-ink",
  entregue: "bg-ok/10 text-ok-ink",
  cancelado: "bg-surface-2 text-ink-2",
};

export default function OrderDetailDialog({
  order,
  onClose,
  franchiseName,
  franchiseContact,
  franchiseUUID,
  weightMap,
  onChanged,
}) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedFreight, setEditedFreight] = useState("");
  const [editedDeliveryDate, setEditedDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "entregue" | "cancelado" | "excluir"
  // "Entregue em" (26/09): default hoje, atalho ontem — pedido entregue de madrugada e
  // marcado depois não pode ficar com a data errada no histórico/despesa.
  const [dataEntrega, setDataEntrega] = useState(() => dataBRT());
  const currentLoadRef = useRef(null);
  const location = useLocation();
  // O pai passa o pedido VIVO da lista (mesmo id, objeto novo a cada recarga). Só a troca de
  // pedido reinicia o formulário; o frete salvo na lista depois de abrir entra no campo
  // enquanto ninguém mexeu nele aqui (freteTocadoRef).
  const orderRef = useRef(order);
  orderRef.current = order;
  const freteTocadoRef = useRef(false);
  const orderId = order?.id;
  const freteDoBanco = order?.freight_cost != null ? String(order.freight_cost) : "";

  useEffect(() => {
    const atual = orderRef.current;
    if (!atual) return;
    const loadId = atual.id;
    currentLoadRef.current = loadId;
    freteTocadoRef.current = false;
    setItems([]);
    setEditedQuantities({});
    setEditedFreight(atual.freight_cost != null ? String(atual.freight_cost) : "");
    setEditedDeliveryDate(atual.estimated_delivery || "");
    setLoadingItems(true);
    PurchaseOrderItem.filter({ order_id: loadId })
      .then((data) => {
        if (currentLoadRef.current !== loadId) return;
        setItems(data);
        const qtyMap = {};
        data.forEach((item) => { qtyMap[item.id] = item.quantity; });
        setEditedQuantities(qtyMap);
      })
      .catch((error) => {
        if (currentLoadRef.current !== loadId) return;
        console.error("Erro ao carregar itens:", error);
        toast.error("Erro ao carregar itens do pedido.");
      })
      .finally(() => { if (currentLoadRef.current === loadId) setLoadingItems(false); });
  }, [orderId]);

  useEffect(() => {
    if (!freteTocadoRef.current) setEditedFreight(freteDoBanco);
  }, [freteDoBanco]);

  if (!order) return null;

  const recalculateTotal = () =>
    items.reduce((sum, item) => {
      const qty = editedQuantities[item.id] ?? item.quantity ?? 0;
      return sum + qty * (parseFloat(item.unit_price) || 0);
    }, 0);

  const isEditable = order.status !== "entregue" && order.status !== "cancelado";
  const frete = parseFloat(editedFreight) || 0;
  // Frete só vai no patch se mudou aqui: nunca regrava por cima do que a lista salvou.
  const patchFrete = () =>
    editedFreight !== freteDoBanco ? { freight_cost: editedFreight ? parseFloat(editedFreight) : null } : {};

  const changedItemsPayload = () =>
    items.filter((item) => {
      const newQty = editedQuantities[item.id];
      return newQty !== undefined && parseFloat(newQty) !== parseFloat(item.quantity);
    });

  const notifyFranchisee = async (newStatus) => {
    if (!franchiseUUID) return;
    const messages = {
      confirmado: { title: "Pedido confirmado", message: "Seu pedido de reposição foi confirmado pela fábrica.", icon: "check_circle", type: "info" },
      entregue: { title: "Pedido entregue", message: "Seu pedido foi entregue — estoque atualizado automaticamente.", icon: "inventory", type: "info" },
      cancelado: { title: "Pedido cancelado", message: "Seu pedido de reposição foi cancelado.", icon: "cancel", type: "warning" },
    };
    const msg = messages[newStatus];
    if (!msg) return;
    try {
      await supabase.rpc("notify_franchise_users", {
        p_franchise_id: franchiseUUID,
        p_title: msg.title,
        p_message: msg.message,
        p_type: msg.type,
        p_icon: msg.icon,
        p_link: "/Gestao?tab=reposicao",
      });
    } catch { /* notificação é bônus, status já foi alterado */ }
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const newTotal = recalculateTotal();
      await PurchaseOrder.update(order.id, {
        ...patchFrete(),
        estimated_delivery: editedDeliveryDate || null,
        total_amount: newTotal,
      });
      const changed = changedItemsPayload();
      if (changed.length > 0) {
        await Promise.all(changed.map((item) => PurchaseOrderItem.update(item.id, { quantity: editedQuantities[item.id] })));
      }
      toast.success("Pedido atualizado com sucesso!");
      onChanged();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error(safeErrorMessage(error, "Erro ao salvar alterações."));
    } finally {
      setSaving(false);
    }
  };

  const doStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const updates = { status: newStatus };
      if (newStatus === "entregue") updates.delivered_at = meioDiaBRT(dataEntrega) || new Date().toISOString();
      if (newStatus === "confirmado" && order.status !== "confirmado") updates.confirmed_at = new Date().toISOString();
      const newTotal = recalculateTotal();
      Object.assign(updates, patchFrete());
      updates.estimated_delivery = editedDeliveryDate || null;
      updates.total_amount = newTotal;
      const changed = changedItemsPayload();
      if (changed.length > 0) {
        await Promise.all(changed.map((item) => PurchaseOrderItem.update(item.id, { quantity: editedQuantities[item.id] })));
      }
      await PurchaseOrder.update(order.id, updates);
      notifyFranchisee(newStatus);

      if (newStatus === "entregue") toast.success("Pedido entregue! Estoque da franquia atualizado.");
      else if (newStatus === "cancelado") toast.success("Pedido cancelado.");
      else toast.success(`Status alterado para ${STATUS_LABEL[newStatus] || newStatus}.`);

      onChanged();
      onClose();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error(safeErrorMessage(error, "Erro ao alterar status do pedido."));
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === "entregue" || newStatus === "cancelado") {
      if (newStatus === "entregue") setDataEntrega(dataBRT());
      setConfirmAction(newStatus);
      return;
    }
    doStatusChange(newStatus);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading("Excluindo pedido...");
    try {
      const { error: itemsErr } = await supabase.from("purchase_order_items").delete().eq("order_id", order.id);
      if (itemsErr) throw itemsErr;
      const { error: orderErr } = await supabase.from("purchase_orders").delete().eq("id", order.id);
      if (orderErr) throw orderErr;
      toast.success("Pedido excluído.", { id: toastId });
      onChanged();
      onClose();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error(safeErrorMessage(error, "Erro ao excluir pedido."), { id: toastId });
    } finally {
      setDeleting(false);
      setConfirmAction(null);
    }
  };

  const handlePrintSheet = async () => {
    try {
      const { generatePickingSheet } = await import("@/lib/pickingSheetPdf");
      await generatePickingSheet({
        order,
        items,
        franchiseName,
        ...franchiseContact,
        editedQuantities,
        weightMap,
      });
      toast.success("Ficha de separação gerada!");
    } catch (err) {
      console.error("Erro ao gerar ficha:", err);
      toast.error(safeErrorMessage(err, "Erro ao gerar ficha de separação."));
    }
  };

  return (
    <>
      <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="receipt_long" size={20} className="text-brand" />
              Detalhes do pedido
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pr-1">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-ink">{franchiseName}</span>
                {/* order.franchise_id é o evolution_instance_id (a chave operacional das
                    telas, não um UUID) — achado carga.md: Pedidos não linkava pra Ficha.
                    state.from/label (decisão 7): a Ficha volta "← Voltar para Pedidos" em vez
                    de "← Unidades". */}
                {(() => {
                  const { to, state } = linkFicha(order.franchise_id, {
                    from: location.pathname + location.search,
                    label: "Pedidos",
                  });
                  return (
                    <Link to={to} state={state} className="text-xs font-semibold text-brand-dark hover:underline">
                      Ver ficha da unidade →
                    </Link>
                  );
                })()}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={`${STATUS_COLOR[order.status] || STATUS_COLOR.pendente} rounded-full px-2 py-0.5 text-[10px] font-bold gap-1`}>
                    <MaterialIcon icon={STATUS_ICON[order.status] || "schedule"} size={12} />
                    {STATUS_LABEL[order.status] || order.status}
                  </Badge>
                  {isAtrasado(order) && (
                    <Badge className="bg-err/10 text-err rounded-full px-2 py-0.5 text-[10px] font-bold gap-1">
                      <MaterialIcon icon="warning" size={12} />
                      ATRASADO
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-surface rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <MaterialIcon icon="shopping_cart" size={14} className="text-warn-ink" />
                    <span className="font-medium">Pedido:</span>
                    {order.ordered_at ? format(new Date(order.ordered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                  </span>
                  {order.confirmed_at && (
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <MaterialIcon icon="check_circle" size={14} className="text-brand-dark" />
                      <span className="font-medium">Confirmado:</span>
                      {format(new Date(order.confirmed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {order.estimated_delivery && (
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <MaterialIcon icon="event" size={14} className="text-ink-3" />
                      <span className="font-medium">Previsão:</span>
                      {formatDateOnly(order.estimated_delivery)}
                    </span>
                  )}
                  {order.delivered_at && (
                    <span className="flex items-center gap-1.5 text-ok-ink">
                      <MaterialIcon icon="check_circle" size={14} />
                      <span className="font-medium">Entregue:</span>
                      {format(new Date(order.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>

              {loadingItems ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-ink-3 font-plus-jakarta">Itens do pedido</h4>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const qty = editedQuantities[item.id] ?? item.quantity ?? 0;
                      const lineTotal = qty * (parseFloat(item.unit_price) || 0);
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-ink-4/15 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-ink">{item.product_name}</span>
                            <p className="text-xs text-ink-2">{formatBRL(item.unit_price)} / un</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={qty}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  setEditedQuantities((prev) => ({ ...prev, [item.id]: isNaN(parsed) || parsed < 0 ? 0 : parsed }));
                                }}
                                className="w-16 text-center h-8 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
                              />
                            ) : (
                              <span className="text-sm text-ink-2 w-16 text-center">{qty}</span>
                            )}
                            <span className="text-sm font-medium text-ink min-w-[80px] text-right">{formatBRL(lineTotal)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-ink-4/30">
                    <span className="text-sm font-bold text-ink font-plus-jakarta">Total dos itens</span>
                    <span className="text-lg font-bold text-ink font-plus-jakarta">{formatBRL(recalculateTotal())}</span>
                  </div>

                  {/* Frete zero é legítimo (acréscimo já no total, ou retirada) — só mostra linha quando > 0 */}
                  {frete > 0 && (
                    <>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-ink-2">Frete</span>
                        <span className="text-sm text-ink-2">{formatBRL(frete)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-ink-4/30">
                        <span className="text-sm font-bold text-ink font-plus-jakarta">Total do pedido</span>
                        <span className="text-lg font-bold text-brand font-plus-jakarta">{formatBRL(recalculateTotal() + frete)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isEditable && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-ink-3 font-plus-jakarta">Frete (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editedFreight}
                      onChange={(e) => { freteTocadoRef.current = true; setEditedFreight(e.target.value); }}
                      placeholder={`sugerido: ${freteSugerido(recalculateTotal())}`}
                      className="h-10 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-ink-3 font-plus-jakarta">Previsão de entrega</Label>
                    <Input
                      type="date"
                      value={editedDeliveryDate}
                      onChange={(e) => setEditedDeliveryDate(e.target.value)}
                      className="h-10 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="p-3 bg-surface rounded-xl">
                  <p className="text-xs text-ink-2"><span className="font-medium">Obs:</span> {order.notes}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-between border-t border-ink-4/20 pt-3 mt-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintSheet}
                  disabled={loadingItems || items.length === 0}
                  className="min-h-10 text-brand-gold border-brand-gold/30 rounded-xl hover:bg-brand-gold/5 gap-1"
                >
                  <MaterialIcon icon="print" size={16} />
                  Ficha de separação
                </Button>
                {isEditable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction("cancelado")}
                    disabled={saving || deleting}
                    className="min-h-10 text-ink-2 border-surface-line rounded-xl hover:bg-surface gap-1"
                  >
                    <MaterialIcon icon="cancel" size={16} />
                    Cancelar pedido
                  </Button>
                )}
                {isDeletable(order) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction("excluir")}
                    disabled={saving || deleting}
                    className="min-h-10 text-err border-err/30 rounded-xl hover:bg-err/5 gap-1"
                  >
                    <MaterialIcon icon="delete" size={16} />
                    Excluir
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={handleSaveEdits} disabled={saving} className="min-h-10 border-ink-4 text-ink-2 rounded-xl hover:bg-surface gap-1">
                    <MaterialIcon icon="save" size={16} />
                    Salvar
                  </Button>
                )}
                {order.status === "pendente" && (
                  <Button size="sm" onClick={() => handleStatusChange("confirmado")} disabled={saving} className="min-h-10 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-1">
                    <MaterialIcon icon="check_circle" size={16} />
                    Confirmar pedido
                  </Button>
                )}
                {order.status === "confirmado" && (
                  <Button size="sm" onClick={() => handleStatusChange("entregue")} disabled={saving} className="min-h-10 bg-ok-ink hover:bg-ok-ink/90 text-white font-bold rounded-xl gap-1">
                    <MaterialIcon icon="inventory" size={16} />
                    Marcar como entregue
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação: entregue/cancelado/excluir */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon
                icon={confirmAction === "entregue" ? "inventory" : confirmAction === "excluir" ? "delete" : "cancel"}
                size={20}
                className={confirmAction === "entregue" ? "text-ok-ink" : confirmAction === "excluir" ? "text-err" : "text-ink-2"}
              />
              {confirmAction === "entregue" ? "Marcar como entregue" : confirmAction === "excluir" ? "Excluir pedido" : "Cancelar pedido"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-ink-2">
            {confirmAction === "entregue"
              ? `Ao confirmar, o estoque de ${franchiseName || "a unidade"} recebe os produtos e o pedido entra como despesa no Resultado dela (produtos + frete). Isso não pode ser desfeito.`
              : confirmAction === "excluir"
              ? "Excluir este pedido permanentemente? Essa ação não pode ser desfeita."
              : "Tem certeza que deseja cancelar este pedido? Essa ação não pode ser desfeita."}
          </p>

          {confirmAction === "entregue" && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="detalhe-entregue-em" className="text-xs font-bold uppercase tracking-wide text-ink-3">
                Entregue em
              </label>
              <input
                id="detalhe-entregue-em"
                type="date"
                value={dataEntrega}
                max={dataBRT()}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="h-10 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDataEntrega(dataBRT(-1))}
                className="min-h-10 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink-2 hover:bg-surface"
              >
                Ontem
              </button>
            </div>
          )}

          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)} disabled={saving || deleting} className="min-h-10 border-ink-4 text-ink-2 rounded-xl">
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={() => (confirmAction === "excluir" ? handleDelete() : doStatusChange(confirmAction))}
              disabled={saving || deleting}
              className={`min-h-10 font-bold rounded-xl gap-1 text-white ${
                confirmAction === "entregue" ? "bg-ok-ink hover:bg-ok-ink/90" : confirmAction === "excluir" ? "bg-err hover:bg-brand" : "bg-ink-2 hover:bg-ink"
              }`}
            >
              {saving || deleting ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : (
                <MaterialIcon icon={confirmAction === "entregue" ? "check_circle" : confirmAction === "excluir" ? "delete" : "cancel"} size={16} />
              )}
              {confirmAction === "entregue" ? "Confirmar" : confirmAction === "excluir" ? "Excluir" : "Cancelar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
