// Pix do pedido à fábrica, lado da unidade (P12, 04/10/2026). Mesmo padrão da verba de marketing:
// a unidade anexa o comprovante, o Nelson confirma em Pedidos. O banco (pix_pedido_guard) só deixa
// a unidade passar de pendente/recusado para enviado, com comprovante; paid_at é do servidor.
// Aparece só com a chave pix_na_baixa ligada e em pedido com payment_status (os antigos não têm).
import React, { useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { PurchaseOrder } from "@/entities/all";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { CNPJ_PIX_MAXI } from "@/lib/mensagemFranqueado";
import { toast } from "sonner";

const BUCKET = "marketing-comprovantes"; // mesmo bucket da verba (5 MB; jpg, png, webp, pdf)
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

export const valorDoPix = (order) => (parseFloat(order?.total_amount) || 0) + (parseFloat(order?.freight_cost) || 0);

export default function PixDoPedido({ order, franchiseId, onChanged }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const st = order?.payment_status;
  if (order?.status !== "entregue" || !st) return null;

  const anexar = async (file) => {
    if (!file) return;
    if (!TIPOS.includes(file.type)) { toast.error("Envie foto (JPG, PNG) ou PDF do comprovante."); return; }
    if (file.size > MAX_BYTES) { toast.error("Arquivo maior que 5 MB. Tire um print do comprovante e envie a imagem."); return; }
    setEnviando(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const filePath = `${franchiseId}/pedido_${order.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      await PurchaseOrder.update(order.id, { payment_status: "enviado", payment_proof_url: urlData.publicUrl });
      toast.success("Comprovante enviado. Obrigado!");
      onChanged?.();
    } catch (error) {
      console.error("Erro ao enviar comprovante do pedido:", error);
      toast.error(safeErrorMessage(error, "Não foi possível enviar o comprovante. Tente de novo."));
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (st === "confirmado") {
    return (
      <div className="px-4 pb-3 -mt-1 text-xs text-ok-ink flex items-center gap-1">
        <MaterialIcon icon="verified" size={14} /> Pix confirmado
      </div>
    );
  }
  if (st === "enviado") {
    return (
      <div className="px-4 pb-3 -mt-1 text-xs text-ink-2 flex items-center gap-1">
        <MaterialIcon icon="schedule" size={14} /> Comprovante enviado, aguardando confirmação da fábrica
      </div>
    );
  }
  // pendente ou recusado
  return (
    <div className="mx-4 mb-3 rounded-xl bg-surface p-3 space-y-2">
      <p className="text-xs text-ink">
        <span className="font-bold">Pix de {formatBRL(valorDoPix(order))}</span>
        {parseFloat(order.freight_cost) > 0 ? " (pedido + frete)" : ""} para o CNPJ {CNPJ_PIX_MAXI}.
      </p>
      {st === "recusado" && (
        <p className="text-xs font-semibold text-err">
          Comprovante não aceito{order.payment_rejection_reason ? `: ${order.payment_rejection_reason}` : ""}. Envie de novo.
        </p>
      )}
      <input ref={inputRef} type="file" accept={TIPOS.join(",")} className="hidden" onChange={(e) => anexar(e.target.files?.[0])} />
      <Button
        type="button"
        size="sm"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="w-full min-h-[40px] text-xs rounded-xl gap-1 bg-brand hover:bg-brand-dark text-white"
      >
        <MaterialIcon icon={enviando ? "progress_activity" : "attach_file"} size={14} className={enviando ? "animate-spin" : ""} />
        {enviando ? "Enviando..." : "Anexar comprovante do Pix"}
      </Button>
    </div>
  );
}
