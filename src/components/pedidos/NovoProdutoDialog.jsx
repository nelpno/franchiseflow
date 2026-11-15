// "Novo Produto Padrão" — extraído do PurchaseOrders.jsx original (mesma lógica, agora
// numa ação "rara" do menu "Mais ações"). Self-contained: gerencia seu próprio estado e
// chama addDefaultProduct diretamente; o pai só controla open/onOpenChange.
import { useState } from "react";
import { addDefaultProduct } from "@/entities/all";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";

const PRODUCT_CATEGORIES = ["Massas", "Molhos", "Outros"];
const PRODUCT_UNITS = [
  { value: "un", label: "Unidade (un)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "pct", label: "Pacote (pct)" },
];

const EMPTY = { name: "", category: "", unit: "un", cost_price: "", min_stock: "5" };

export default function NovoProdutoDialog({ open, onOpenChange }) {
  const [produto, setProduto] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const close = () => {
    onOpenChange(false);
    setProduto(EMPTY);
  };

  const handleCreate = async () => {
    const { name, category, unit, cost_price, min_stock } = produto;
    if (!name.trim() || !category) {
      toast.error("Preencha nome e categoria do produto.");
      return;
    }
    setSaving(true);
    try {
      const count = await addDefaultProduct({
        name: name.trim(),
        category: category.toLowerCase(),
        unit,
        costPrice: cost_price ? parseFloat(cost_price) : null,
        minStock: min_stock ? parseInt(min_stock, 10) : 5,
      });
      toast.success(`Produto adicionado a ${count} franquia${count !== 1 ? "s" : ""}.`);
      close();
    } catch (error) {
      console.error("Erro ao criar produto padrão:", error);
      toast.error("Erro ao criar produto padrão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
            <MaterialIcon icon="add_circle" size={20} className="text-brand" />
            Novo Produto Padrão
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-ink-2">
          O produto será adicionado ao estoque de todas as franquias existentes.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
              Nome do Produto *
            </Label>
            <Input
              value={produto.name}
              onChange={(e) => setProduto((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Nhoque Quatro Queijos"
              className="h-9 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
              Categoria *
            </Label>
            <Select value={produto.category} onValueChange={(val) => setProduto((p) => ({ ...p, category: val }))}>
              <SelectTrigger className="bg-surface-line border-none rounded-xl">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
              Unidade
            </Label>
            <Select value={produto.unit} onValueChange={(val) => setProduto((p) => ({ ...p, unit: val }))}>
              <SelectTrigger className="bg-surface-line border-none rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                Custo Unitário (R$)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={produto.cost_price}
                onChange={(e) => setProduto((p) => ({ ...p, cost_price: e.target.value }))}
                placeholder="0,00"
                className="h-9 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                Estoque Mínimo
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={produto.min_stock}
                onChange={(e) => setProduto((p) => ({ ...p, min_stock: e.target.value }))}
                className="h-9 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={close} disabled={saving} className="border-ink-4 text-ink-2 rounded-xl">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={saving || !produto.name.trim() || !produto.category}
            className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-1"
          >
            {saving ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
            ) : (
              <MaterialIcon icon="add_circle" size={16} />
            )}
            Adicionar a Todas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
