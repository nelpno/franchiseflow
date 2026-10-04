// Pix do pedido, lado do admin, na lista de Entregues (P12, 04/10/2026). Mesmo fluxo da verba:
// a unidade anexa, o Nelson confirma (ou recusa com motivo). Confirmar sem comprovante também
// vale (o Pix chegou pelo WhatsApp). Quem/quando carimba o banco (pix_pedido_guard).
import { useState } from "react";
import { PurchaseOrder } from "@/entities/all";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { safeHref } from "@/lib/safeHref";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { toast } from "sonner";

const ROTULO = {
  pendente: { txt: "Pix pendente", cls: "bg-surface-2 text-ink-2", icon: "schedule" },
  enviado: { txt: "Comprovante enviado", cls: "bg-warn-soft text-warn-ink", icon: "receipt_long" },
  confirmado: { txt: "Pix confirmado", cls: "bg-ok/10 text-ok-ink", icon: "verified" },
  recusado: { txt: "Comprovante recusado", cls: "bg-err-soft text-err", icon: "error" },
};

export function ChipPix({ order }) {
  const r = ROTULO[order?.payment_status];
  if (!r) return null;
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-bold ${r.cls}`}>
      <MaterialIcon icon={r.icon} size={12} aria-hidden="true" />
      {r.txt}
    </span>
  );
}

export default function PixAdminAcoes({ order, onChanged }) {
  const [salvando, setSalvando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const st = order?.payment_status;
  if (!st || st === "confirmado") return null;

  const gravar = async (patch, ok) => {
    setSalvando(true);
    try {
      await PurchaseOrder.update(order.id, patch);
      toast.success(ok);
      setRecusando(false);
      setMotivo("");
      onChanged?.();
    } catch (error) {
      console.error("Erro ao gravar o Pix do pedido:", error);
      toast.error(safeErrorMessage(error, "Não foi possível salvar. Tente de novo."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {order.payment_proof_url && (
        <a href={safeHref(order.payment_proof_url)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-dark hover:underline">
          Ver comprovante
        </a>
      )}
      <Button size="sm" disabled={salvando} onClick={() => gravar({ payment_status: "confirmado", payment_rejection_reason: null }, "Pix confirmado.")}
        className="min-h-9 rounded-xl bg-ok-ink hover:bg-ok-ink/90 text-white text-xs font-bold gap-1">
        <MaterialIcon icon="verified" size={14} /> Confirmar Pix
      </Button>
      {st === "enviado" && (
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => setRecusando(true)} className="min-h-9 rounded-xl border-ink-4 text-ink-2 text-xs">
          Recusar
        </Button>
      )}
      <Dialog open={recusando} onOpenChange={(open) => { if (!open && !salvando) setRecusando(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Recusar comprovante</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-2">A unidade vê o motivo e pode enviar outro.</p>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={160} placeholder="Ex.: valor diferente do pedido" />
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setRecusando(false)} disabled={salvando} className="min-h-10 rounded-xl border-ink-4 text-ink-2">Voltar</Button>
            <Button size="sm" disabled={salvando || !motivo.trim()} onClick={() => gravar({ payment_status: "recusado", payment_rejection_reason: motivo.trim() }, "Comprovante recusado.")}
              className="min-h-10 rounded-xl bg-err hover:bg-brand text-white font-bold">Recusar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
