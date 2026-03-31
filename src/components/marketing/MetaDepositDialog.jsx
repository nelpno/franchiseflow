import React, { useState } from "react";
import { MarketingMetaDeposit } from "@/entities/all";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";

export default function MetaDepositDialog({ open, onOpenChange, referenceMonth, onSaved }) {
  const [amount, setAmount] = useState("");
  const [depositDate, setDepositDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Informe um valor valido");
      return;
    }

    setSubmitting(true);
    try {
      await MarketingMetaDeposit.create({
        reference_month: referenceMonth,
        amount: numAmount,
        deposit_date: depositDate,
        notes: notes.trim() || null,
      });
      toast.success("Deposito registrado!");
      setAmount("");
      setNotes("");
      setDepositDate(format(new Date(), "yyyy-MM-dd"));
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error("Erro ao registrar deposito:", err);
      toast.error(`Erro: ${err.message || "Tente novamente"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Deposito Meta</DialogTitle>
          <DialogDescription>
            Registre o valor depositado na conta Meta Ads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Valor (R$)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="1.500,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-[#e9e8e9]"
              inputMode="decimal"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-sm">Data do deposito</Label>
            <Input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="border-[#e9e8e9]"
            />
          </div>

          <div>
            <Label className="text-sm">Observacao (opcional)</Label>
            <Textarea
              placeholder="Ex: Primeiro lote do mes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="border-[#e9e8e9] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting || !amount}
            className="bg-[#b91c1c] hover:bg-[#991b1b] text-white"
          >
            {submitting ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
