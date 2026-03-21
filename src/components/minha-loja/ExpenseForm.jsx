import React, { useState, useEffect } from "react";
import { Expense } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ExpenseForm({ expense, franchiseId, currentUser, onSave, onCancel }) {
  const isEditing = !!expense;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (expense) {
      setDescription(expense.description || "");
      setAmount(expense.amount || "");
      setExpenseDate(expense.expense_date || format(new Date(), "yyyy-MM-dd"));
    }
  }, [expense]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("Informe a descrição da despesa.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        franchise_id: franchiseId,
        description: description.trim(),
        amount: parsedAmount,
        expense_date: expenseDate,
        created_by: currentUser?.id || null,
      };

      if (isEditing) {
        await Expense.update(expense.id, data);
        toast.success("Despesa atualizada!");
      } else {
        await Expense.create(data);
        toast.success("Despesa registrada!");
      }

      onSave();
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      toast.error("Erro ao salvar despesa. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="expense-description" className="text-sm font-medium text-[#1b1c1d]">
          Descricao
        </Label>
        <Input
          id="expense-description"
          placeholder="Ex: Gás, embalagens, limpeza..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-[#e9e8e9]/50"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expense-amount" className="text-sm font-medium text-[#1b1c1d]">
            Valor (R$)
          </Label>
          <Input
            id="expense-amount"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-[#e9e8e9]/50 text-right font-mono-numbers"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-date" className="text-sm font-medium text-[#1b1c1d]">
            Data
          </Label>
          <Input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="bg-[#e9e8e9]/50"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isSubmitting}
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
              Salvando...
            </>
          ) : isEditing ? (
            "Atualizar"
          ) : (
            "Registrar"
          )}
        </Button>
      </div>
    </form>
  );
}
