// Desfechos do cartão (Mais ações → Concluir / Vai para o Nelson / Estacionar), separados
// da folha "Registrar" porque não são uma conversa: são o fim (ou a pausa) do cartão.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { concluirCsCartao, estacionarCsCartao } from "@/entities/csMural";
import { DESFECHO_LABEL } from "@/lib/csMural";

const DESFECHOS_CONCLUIR = ["resolvido", "combinado_feito", "recusou", "nao_responde"];

function Chip({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3.5 text-sm ${
        ativo ? "border-brand-dark bg-brand-dark font-semibold text-white" : "border-surface-line bg-white font-medium text-ink-2 hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/**
 *   <CartaoAcoesDialog modo="concluir" open task={task} onOpenChange onFeito={reload} />
 * `modo`: "concluir" | "nelson" | "estacionar" | null (null/undefined não abre nada).
 */
export default function CartaoAcoesDialog({ modo, open, onOpenChange, task, onFeito }) {
  const [desfecho, setDesfecho] = useState("resolvido");
  const [texto, setTexto] = useState("");
  const [ate, setAte] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDesfecho("resolvido");
    setTexto("");
    setAte("");
  }, [open, modo]);

  if (!modo) return null;

  const titulo = modo === "concluir" ? "Concluir" : modo === "nelson" ? "Vai para o Nelson" : "Estacionar";

  const salvar = async () => {
    if (modo === "nelson" && !texto.trim()) {
      toast.error("Escreva uma frase para o Nelson.");
      return;
    }
    if (modo === "estacionar" && (!ate || !texto.trim())) {
      toast.error("Escolha a data e escreva o motivo.");
      return;
    }
    setSalvando(true);
    try {
      if (modo === "concluir") {
        await concluirCsCartao(task.id, desfecho, texto.trim() || null);
        toast.success(`Cartão marcado como "${DESFECHO_LABEL[desfecho]}".`);
      } else if (modo === "nelson") {
        await concluirCsCartao(task.id, "vai_para_nelson", texto.trim());
        toast.success("Enviado para a lista de decisões do Nelson.");
      } else if (modo === "estacionar") {
        await estacionarCsCartao(task.id, ate, texto.trim());
        toast.success("Cartão estacionado.");
      }
      onOpenChange(false);
      onFeito?.();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}{task?.franchise_name ? ` — ${task.franchise_name}` : ""}</DialogTitle>
        </DialogHeader>

        {modo === "concluir" && (
          <div role="radiogroup" aria-label="Desfecho" className="flex flex-wrap gap-2">
            {DESFECHOS_CONCLUIR.map((d) => (
              <Chip key={d} ativo={desfecho === d} onClick={() => setDesfecho(d)}>
                {DESFECHO_LABEL[d]}
              </Chip>
            ))}
          </div>
        )}

        {modo === "nelson" && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            O que o Nelson precisa saber
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} className="font-normal" />
          </label>
        )}

        {modo === "estacionar" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
              Não mexer até
              <input
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                className="h-11 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
              Porque
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={300} className="font-normal" />
            </label>
          </div>
        )}

        {modo === "concluir" && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            Nota (opcional)
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={1000} className="font-normal" />
          </label>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
