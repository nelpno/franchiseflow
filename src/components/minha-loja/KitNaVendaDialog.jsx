// Kit da promoção dentro da venda do app (24/11/2026). Regra em lib/kitNaVenda.js (testada).
// A franqueada escolhe o kit e, nos itens à escolha, o sabor de cada unidade; o SaleForm recebe as linhas
// e o desconto (soma − preço do kit) e lança como Desconto em R$ com motivo "Promoção".
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL as formatCurrency } from "@/lib/formatters";
import {
  montarKit, escolhasIniciais, escolhasCompletas, itensDoKit, kitJaNaVenda,
  somarKitNosItens, descontoDoKit, faltaEstoque, textoDoKit,
} from "@/lib/kitNaVenda";

export default function KitNaVendaDialog({ open, onOpenChange, kits, inventoryItems, items, deEncomenda = false, onAplicar }) {
  const [indice, setIndice] = useState(null);
  const [escolhas, setEscolhas] = useState([]);
  const [soDesconto, setSoDesconto] = useState(false);

  // Abriu: com um kit só, já entra nele
  useEffect(() => {
    if (!open) return;
    setIndice(kits.length === 1 ? 0 : null);
  }, [open, kits.length]);

  const regra = indice != null ? kits[indice] : null;
  const montado = useMemo(() => (regra ? montarKit(regra, inventoryItems) : null), [regra, inventoryItems]);
  // Zera as escolhas só ao trocar de kit (o estoque recarregado em fundo não apaga o que ela já escolheu)
  useEffect(() => {
    setEscolhas(regra ? escolhasIniciais(montarKit(regra, inventoryItems)) : []);
  }, [regra, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const itensKit = useMemo(() => (montado ? itensDoKit(montado, escolhas) : null), [montado, escolhas]);
  const jaNaVenda = useMemo(() => kitJaNaVenda(items, itensKit), [items, itensKit]);
  // "Virou venda" de uma encomenda de kit: os produtos já estão lá, o normal é só aplicar o desconto.
  // Venda comum começa DESMARCADO: dois kits iguais na mesma venda é o caso normal do Natal.
  useEffect(() => { setSoDesconto(jaNaVenda && deEncomenda); }, [jaNaVenda, deEncomenda]);

  const usarSoDesconto = jaNaVenda && soDesconto;
  const linhasFinais = useMemo(
    () => (itensKit ? (usarSoDesconto ? items : somarKitNosItens(items, itensKit)) : null),
    [itensKit, usarSoDesconto, items],
  );
  const conta = itensKit ? descontoDoKit(regra, itensKit, linhasFinais) : null;
  const falta = itensKit ? faltaEstoque(itensKit, items, usarSoDesconto) : [];

  const escolher = (i, j, id) => setEscolhas((prev) => prev.map((e, k) => (k === i ? e.map((x, m) => (m === j ? id : x)) : e)));

  const aplicar = () => {
    if (!itensKit || !conta) return;
    onAplicar({
      nome: String(regra.nome || "Kit").trim(),
      novosItens: usarSoDesconto ? null : linhasFinais,
      desconto: conta.desconto,
      linhaObs: textoDoKit(regra, montado, escolhas),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain" data-kit-venda>
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta">{regra ? String(regra.nome || "Kit").trim() : "Kit da promoção"}</DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            {regra
              ? `Preço do kit: ${formatCurrency(Number(regra.preco) || 0)}. Os produtos entram na venda e a diferença vira desconto.`
              : "Escolha o kit que o cliente pediu."}
          </DialogDescription>
        </DialogHeader>

        {!regra && (
          <ul className="space-y-2">
            {kits.map((k, i) => {
              const m = montarKit(k, inventoryItems);
              return (
                <li key={`${k.nome}-${i}`}>
                  <button type="button" disabled={!m.ok} onClick={() => setIndice(i)}
                    className="w-full min-h-[56px] rounded-xl border border-ink-shadow/10 bg-white px-4 py-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-semibold text-ink truncate">{String(k.nome || "Kit").trim()}</span>
                      <span className="shrink-0 font-mono-numbers font-semibold text-brand">{formatCurrency(Number(k.preco) || 0)}</span>
                    </span>
                    {!m.ok && <span className="mt-1 block text-xs text-[#92400e]">{m.motivo} Arrume no Estoque ou no Cardápio digital.</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {regra && montado && !montado.ok && (
          <p className="rounded-xl bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">{montado.motivo} Arrume no Estoque ou no Cardápio digital.</p>
        )}

        {regra && montado?.ok && (
          <div className="space-y-3">
            <ul className="space-y-2">
              {montado.linhas.map((l, i) => (
                <li key={i} className="rounded-xl bg-surface px-3 py-2">
                  {l.tipo === "fixo" ? (
                    <p className="text-sm text-ink"><span className="font-mono-numbers font-semibold">{l.qtd}×</span> {l.nome}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-ink">{l.qtd}× {l.rotulo} <span className="font-normal text-ink-3">à escolha</span></p>
                      {(escolhas[i] || []).map((id, j) => (
                        <select key={j} value={id} onChange={(e) => escolher(i, j, e.target.value)}
                          aria-label={`${l.rotulo}${l.qtd > 1 ? ` (${j + 1} de ${l.qtd})` : ""}`}
                          className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink ${id ? "border-surface-line" : "border-brand/40"}`}>
                          <option value="">{l.qtd > 1 ? `Escolha o ${j + 1}º` : "Escolha"}</option>
                          {l.opcoes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.product_name} · {formatCurrency(Number(o.sale_price) || 0)}{(Number(o.quantity) || 0) <= 0 ? " · sem estoque" : ""}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {jaNaVenda && (
              <label className="flex items-start gap-2 rounded-xl border border-ink-shadow/10 px-3 py-2 text-sm text-ink">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b91c1c]" checked={soDesconto} onChange={(e) => setSoDesconto(e.target.checked)} />
                <span>Os produtos deste kit já estão na venda: só aplicar o desconto.</span>
              </label>
            )}

            {conta && (
              <div className="space-y-1 rounded-xl border border-ink-shadow/10 px-3 py-2 text-sm">
                <p className="flex justify-between"><span className="text-ink-2">Produtos pelo preço normal</span><span className="font-mono-numbers">{formatCurrency(conta.soma)}</span></p>
                <p className="flex justify-between"><span className="text-ink-2">Preço do kit</span><span className="font-mono-numbers">{formatCurrency(conta.preco)}</span></p>
                {conta.desconto > 0 ? (
                  <p className="flex justify-between font-semibold text-ok-ink"><span>Desconto (Promoção)</span><span className="font-mono-numbers">−{formatCurrency(conta.desconto)}</span></p>
                ) : (
                  <p className="text-xs text-[#92400e]">Com essas escolhas os produtos já saem por menos que o kit: entram pelo preço normal, sem desconto.</p>
                )}
              </div>
            )}

            {falta.length > 0 && (
              <div className="flex gap-1.5 rounded-xl bg-[#fffbeb] px-3 py-2">
                <MaterialIcon icon="warning" size={16} className="mt-0.5 shrink-0 text-brand-gold" />
                <p className="text-xs text-[#92400e]">
                  Estoque não cobre: {falta.map((f) => `${f.nome} (tem ${f.tem}, o kit leva ${f.precisa})`).join("; ")}. A venda entra mesmo assim; confira o estoque.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {kits.length > 1 ? (
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setIndice(null)}>Outro kit</Button>
              ) : <span />}
              <Button type="button" disabled={!escolhasCompletas(montado, escolhas)} onClick={aplicar}
                className="min-h-11 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl">
                {usarSoDesconto ? "Aplicar o desconto" : "Pôr o kit na venda"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
