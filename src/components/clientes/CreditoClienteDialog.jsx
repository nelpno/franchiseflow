// Crédito do cliente (23/11/2026, pedido do Ricardo/Tatuapé): ver o saldo, dar crédito e apagar um lançamento errado.
// O uso acontece na venda (SaleForm › Desconto › "Usar"). Regras: lib/creditoCliente.js; banco:
// supabase/2026-11-23-credito-cliente.sql (apagar só pela RPC, que recusa crédito já usado).
import React, { useEffect, useState, useCallback } from "react";
import { ClienteCredito, apagarClienteCredito } from "@/entities/all";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatBRL as formatCurrency } from "@/lib/formatters";
import { safeErrorMessage, ehErroDeRegra } from "@/lib/safeErrorMessage";
import { MOTIVOS_CREDITO, erroNovoCredito, rotuloMotivoCredito } from "@/lib/creditoCliente";
import { registrarEvento } from "@/lib/telemetria";

export default function CreditoClienteDialog({ contact, saldo = 0, onOpenChange, onChanged }) {
  const open = !!contact;
  const [entradas, setEntradas] = useState(null); // null = carregando
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("troco");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [apagandoId, setApagandoId] = useState(null);
  const [confirmarApagar, setConfirmarApagar] = useState(null);

  const carregar = useCallback(async () => {
    if (!contact?.id) return;
    try {
      const linhas = await ClienteCredito.filter({ contact_id: contact.id }, "-created_at", 50, {
        columns: "id, valor, motivo, observacao, created_at",
      });
      setEntradas(linhas);
    } catch (err) {
      setEntradas([]);
      toast.error(safeErrorMessage(err, "Não foi possível carregar os créditos."));
    }
  }, [contact?.id]);

  useEffect(() => {
    if (!open) return;
    setEntradas(null);
    setValor("");
    setMotivo("troco");
    setObservacao("");
    setConfirmarApagar(null);
    carregar();
  }, [open, carregar]);

  const salvar = async () => {
    const v = parseFloat(String(valor).replace(",", "."));
    const erro = erroNovoCredito({ valor: v, motivo });
    if (erro) {
      toast.error(erro);
      return;
    }
    setSalvando(true);
    try {
      await ClienteCredito.create({
        contact_id: contact.id,
        franchise_id: contact.franchise_id, // o banco confere pelo contato
        valor: Math.round(v * 100) / 100,
        motivo,
        observacao: observacao.trim() || null,
      });
      registrarEvento("credito_cliente_dado", { detalhe: motivo });
      toast.success(`Crédito de ${formatCurrency(v)} anotado para ${contact.nome || "o cliente"}.`, {
        description: "Na próxima venda dele, toque em \"Usar\" no Desconto.",
      });
      setValor("");
      setObservacao("");
      await carregar();
      onChanged?.();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Não foi possível salvar o crédito."));
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async (id) => {
    setApagandoId(id);
    try {
      await apagarClienteCredito(id);
      registrarEvento("credito_cliente_apagado");
      toast.success("Lançamento apagado.");
      setConfirmarApagar(null);
      await carregar();
      onChanged?.();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Não foi possível apagar."), ehErroDeRegra(err) ? { duration: 10000 } : undefined);
    } finally {
      setApagandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta">Crédito do cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-ok-soft px-4 py-3">
            <p className="text-sm text-ink-2 truncate">{contact?.nome || "Cliente"}</p>
            <p className="font-plus-jakarta text-2xl font-bold text-ok-ink font-mono-numbers" data-credito-saldo>
              {formatCurrency(saldo)}
            </p>
            <p className="text-xs text-ink-2">
              {saldo > 0 ? "Para usar: na próxima venda deste cliente, abra Desconto e toque em \"Usar\"." : "Sem crédito para usar."}
            </p>
          </div>

          {/* Dar crédito */}
          <div className="space-y-3 rounded-xl border border-ink-shadow/10 p-3">
            <p className="text-sm font-semibold text-ink">Novo crédito</p>
            <div>
              <Label htmlFor="credito-valor" className="text-sm">Valor (R$)</Label>
              <Input id="credito-valor" type="number" inputMode="decimal" min={0} step={0.01} value={valor}
                onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="bg-white text-right font-mono-numbers" />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Motivo</p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_CREDITO.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMotivo(m.id)}
                    className={`min-h-10 rounded-xl border px-3 text-sm transition-colors ${
                      motivo === m.id ? "border-brand bg-brand/5 font-semibold text-brand" : "border-surface-line bg-white text-ink-2"
                    }`}>
                    {m.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="credito-obs" className="text-sm">Anotação (opcional)</Label>
              <Input id="credito-obs" maxLength={140} value={observacao} onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: pagou com R$ 100 na entrega de 21/11" className="bg-white" />
            </div>
            <Button type="button" onClick={salvar} disabled={salvando} className="w-full min-h-11 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl">
              {salvando ? "Salvando..." : "Dar crédito"}
            </Button>
          </div>

          {/* Histórico das entradas */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">Créditos lançados</p>
            {entradas === null ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : entradas.length === 0 ? (
              <p className="text-sm text-ink-3">Nenhum crédito lançado para este cliente.</p>
            ) : (
              <ul className="space-y-2">
                {entradas.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-ink">
                        <span className="font-mono-numbers">{formatCurrency(e.valor)}</span> · {rotuloMotivoCredito(e.motivo)}
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {e.created_at ? format(new Date(e.created_at), "dd/MM/yyyy") : ""}
                        {e.observacao ? ` · ${e.observacao}` : ""}
                      </p>
                    </div>
                    {confirmarApagar === e.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl text-xs" onClick={() => setConfirmarApagar(null)}>
                          Não
                        </Button>
                        <Button type="button" size="sm" disabled={!!apagandoId} className="h-9 rounded-xl bg-err text-xs text-white hover:bg-brand"
                          onClick={() => apagar(e.id)}>
                          {apagandoId === e.id ? "Apagando..." : "Apagar"}
                        </Button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmarApagar(e.id)} title="Apagar este lançamento"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-3 hover:bg-err-soft hover:text-err">
                        <MaterialIcon icon="delete" size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-3">Digitou errado? Apague o lançamento e lance de novo. Crédito já usado numa venda só sai tirando da venda.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
