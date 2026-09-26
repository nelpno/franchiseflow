import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { createCsTask } from "@/entities/all";

// Dialog CONTROLADO (a página dona do open) — usado pelo botão "Novo cartão" do Mural
// (Onda 2: sem coluna pra escolher — o cartão manual sempre entra em "Falar hoje" com
// motive_key 'manual'; quem decide de onde ele sai é a folha "Registrar"/"Mais ações").
export default function QuickAddCard({ open, onOpenChange, userId, franchises = [], defaultFranchiseId = "", onCreated }) {
  const [title, setTitle] = useState("");
  const [franchiseId, setFranchiseId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setFranchiseId(defaultFranchiseId || ""); }
  }, [open, defaultFranchiseId]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Dê um título pra tarefa."); return; }
    setSaving(true);
    try {
      const task = await createCsTask(
        { title: title.trim(), franchise_id: franchiseId || null, column_status: "a_fazer", source: "manual" },
        userId,
      );
      // Toast fica só no onCreated (CustomerSuccess.jsx) — daqui dobrava ("Cartão criado" 2x).
      onOpenChange?.(false);
      onCreated?.(task);
    } catch (e) {
      console.error("[QuickAddCard]", e);
      toast.error(safeErrorMessage(e, "Não foi possível criar o cartão."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-2">O que precisa ser feito?</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar pra Cotia sobre estoque" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-2">Franquia (opcional)</label>
            <select
              value={franchiseId}
              onChange={(e) => setFranchiseId(e.target.value)}
              className="w-full text-sm rounded-md border border-ink-shadow/15 px-2 py-2 bg-white"
            >
              <option value="">— Tarefa geral (sem franquia) —</option>
              {franchises.map((f) => (
                <option key={f.franchise_id} value={f.franchise_id}>
                  {f.franchise_name}{f.city ? ` · ${f.city}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="bg-brand hover:bg-brand-dark text-white">
            Criar cartão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
