import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { createCsTask } from "@/entities/all";
import { COLUMN_CONFIG } from "./tierConfig";

// Dialog CONTROLADO (a página dona do open) — usado pelo botão "Novo cartão" do board
// e pelo "Criar cartão" do Radar (pré-preenchendo a franquia).
export default function QuickAddCard({ open, onOpenChange, userId, franchises = [], defaultFranchiseId = "", onCreated }) {
  const [title, setTitle] = useState("");
  const [franchiseId, setFranchiseId] = useState("");
  const [column, setColumn] = useState("a_fazer");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setFranchiseId(defaultFranchiseId || ""); setColumn("a_fazer"); }
  }, [open, defaultFranchiseId]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Dê um título pra tarefa."); return; }
    setSaving(true);
    try {
      const task = await createCsTask(
        { title: title.trim(), franchise_id: franchiseId || null, column_status: column, source: "manual" },
        userId,
      );
      toast.success("Cartão criado");
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
            <label className="text-xs font-medium text-[#4a3d3d]">O que precisa ser feito?</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar pra Cotia sobre estoque" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4a3d3d]">Franquia (opcional)</label>
            <select
              value={franchiseId}
              onChange={(e) => setFranchiseId(e.target.value)}
              className="w-full text-sm rounded-md border border-[#291715]/15 px-2 py-2 bg-white"
            >
              <option value="">— Tarefa geral (sem franquia) —</option>
              {franchises.map((f) => (
                <option key={f.franchise_id} value={f.franchise_id}>
                  {f.franchise_name}{f.city ? ` · ${f.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#4a3d3d]">Coluna</label>
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className="w-full text-sm rounded-md border border-[#291715]/15 px-2 py-2 bg-white"
            >
              {COLUMN_CONFIG.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white">
            Criar cartão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
