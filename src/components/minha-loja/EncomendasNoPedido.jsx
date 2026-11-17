// Bloco "Encomendas para entregar até o próximo pedido" (17/11/2026), dentro do formulário de pedido
// à fábrica (Reposição). Lista as encomendas ainda abertas, soma por produto e, no botão
// "Somar ao pedido", acrescenta as quantidades ao pedido. Quem soma e quem marca "pedida" é o
// PurchaseOrderForm (somarEncomendas / envio); aqui só a escolha. Regras: lib/encomendas.js.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEncomendas } from "@/hooks/useEncomendas";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatDateOnly } from "@/lib/dateOnly";
import {
  JANELA_PEDIDO_DIAS, abertasParaPedido, diasAte, rotuloPrazo, somaPorProduto, totalUnidades,
} from "@/lib/encomendas";
import { BTN_CONTORNO_MARCA } from "@/components/shared/adminUi";
import { format } from "date-fns";

export default function EncomendasNoPedido({ franchiseId, produtosDoPedido, somadas, onSomar, disabled = false }) {
  const { encomendas, isLoading } = useEncomendas(franchiseId);
  const [escolha, setEscolha] = useState({}); // id -> true/false; sem entrada = regra da janela
  const hoje = format(new Date(), "yyyy-MM-dd");

  const abertas = useMemo(() => abertasParaPedido(encomendas), [encomendas]);
  // só conta as que ainda existem como abertas (o rascunho pode trazer id de encomenda já cancelada/entregue)
  const jaSomadas = useMemo(() => {
    const ids = new Set(somadas || []);
    return new Set(abertas.filter((e) => ids.has(e.id)).map((e) => e.id));
  }, [somadas, abertas]);
  const pendentes = abertas.filter((e) => !jaSomadas.has(e.id));
  const marcada = (e) => (e.id in escolha ? escolha[e.id] : (diasAte(e.entregar_em, hoje) ?? 999) <= JANELA_PEDIDO_DIAS);
  const selecionadas = pendentes.filter(marcada);
  const soma = useMemo(() => somaPorProduto(selecionadas), [selecionadas]);

  if (isLoading || abertas.length === 0) return null;

  const idsPedido = new Set((produtosDoPedido || []).map((p) => p.id));
  const fora = soma.filter((r) => !r.inventory_item_id || !idsPedido.has(r.inventory_item_id));

  return (
    <section aria-labelledby="titulo-enc-pedido" className="rounded-2xl border border-brand-gold/40 bg-[#fffbeb] p-4 space-y-3">
      <div className="flex items-start gap-2">
        <MaterialIcon icon="event_available" size={20} className="mt-0.5 shrink-0 text-brand-gold-ink" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="titulo-enc-pedido" className="font-plus-jakarta text-base font-bold text-ink">
            Encomendas para entregar até o próximo pedido
          </h3>
          <p className="mt-0.5 text-xs text-ink-2">
            Marque as que este pedido deve cobrir e toque em Somar ao pedido. Ao enviar, elas passam para “pedida à fábrica”.
          </p>
        </div>
      </div>

      {jaSomadas.size > 0 && (
        <p role="status" className="flex items-start gap-1.5 rounded-xl bg-white px-3 py-2 text-sm text-ink">
          <MaterialIcon icon="check_circle" size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
          <span>
            {jaSomadas.size === 1 ? "1 encomenda já somada" : `${jaSomadas.size} encomendas já somadas`} a este pedido.
            Se errou, ajuste a quantidade do produto abaixo.
          </span>
        </p>
      )}

      {pendentes.length > 0 && (
        <>
          <ul className="space-y-1">
            {pendentes.map((e) => {
              const dias = diasAte(e.entregar_em, hoje);
              const on = marcada(e);
              return (
                <li key={e.id}>
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={(ev) => setEscolha((prev) => ({ ...prev, [e.id]: ev.target.checked }))}
                      className="mt-1 h-5 w-5 shrink-0 accent-[#b91c1c]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{e.cliente_nome}</span>
                      <span className="block text-xs text-ink-2">
                        {formatDateOnly(e.entregar_em, "EEE, dd/MM")} · {rotuloPrazo(dias)} · {totalUnidades(e)} un.
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {soma.length > 0 && (
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Soma por produto</p>
              <ul className="mt-1 space-y-0.5">
                {soma.map((r) => (
                  <li key={r.inventory_item_id || r.nome} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{r.nome}</span>
                    <span className="shrink-0 font-bold tabular-nums text-ink">{r.qtd}</span>
                  </li>
                ))}
              </ul>
              {fora.length > 0 && (
                <p className="mt-2 text-xs text-[#92400e]">
                  Não entram no pedido à fábrica (produto da unidade): {fora.map((r) => r.nome).join(", ")}.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={disabled || selecionadas.length === 0}
            onClick={() => {
              onSomar(selecionadas);
              setEscolha({});
            }}
            className={`${BTN_CONTORNO_MARCA} min-h-11 w-full sm:w-auto`}
          >
            <MaterialIcon icon="add_shopping_cart" size={18} aria-hidden="true" />
            Somar ao pedido
          </button>
        </>
      )}
    </section>
  );
}

// Aviso no alto da Reposição (antes de abrir o formulário): a unidade vê que há encomenda
// aberta e que ela aparece para somar na hora de montar o pedido. Some quando não há nenhuma.
export function EncomendasAviso({ franchiseId }) {
  const { encomendas, isLoading } = useEncomendas(franchiseId);
  if (isLoading) return null;
  const abertas = abertasParaPedido(encomendas);
  if (abertas.length === 0) return null;
  const unidades = abertas.reduce((s, e) => s + totalUnidades(e), 0);
  return (
    <section aria-label="Encomendas abertas" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand-gold-line bg-brand-gold-soft px-4 py-3">
      <MaterialIcon icon="event_available" size={20} className="shrink-0 text-brand-gold-ink" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-ink">
        <strong>{abertas.length === 1 ? "1 encomenda aberta" : `${abertas.length} encomendas abertas`}</strong>
        {" "}({unidades} un.) ainda não pedida{abertas.length === 1 ? "" : "s"} à fábrica. Ao montar o pedido, elas aparecem para você somar.
      </p>
      <Link to="/Vendas?aba=encomendas" className="inline-flex min-h-10 items-center whitespace-nowrap text-sm font-semibold text-brand-dark hover:underline">
        Ver encomendas
      </Link>
    </section>
  );
}
