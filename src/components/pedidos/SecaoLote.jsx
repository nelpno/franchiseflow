// Seção de pedidos que se resolve em lote, direto na lista (fluxo de 26/09): todos vêm
// marcados, o frete se edita na própria linha e UMA ação principal age sobre os marcados,
// com contagem, R$, frete, kg e caminhões de 1.500 kg. Usada por "Para confirmar" e
// "Para separar e entregar". Desmarcar é a exceção; por isso o estado guarda quem foi
// DESMARCADO (pedido novo que chega na recarga já entra marcado).
import { forwardRef, useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { safeHref } from "@/lib/safeHref";
import SectionTitle from "@/components/shared/SectionTitle";
import CampoFrete from "./CampoFrete";
import {
  formatKg,
  linhaEsperaLabel,
  isAtrasado,
  ehAcrescimo,
  mensagemChamarPedido,
  pedidosLabel,
  resumoLote,
  CAPACIDADE_CAMINHAO_KG,
} from "./pedidosHelpers";

function Resumo({ r, freteRotulo }) {
  const cap = CAPACIDADE_CAMINHAO_KG.toLocaleString("pt-BR");
  return (
    <p className="text-sm text-ink-2">
      <span className="font-semibold text-ink">{pedidosLabel(r.qtd)}</span>
      {" · "}
      {formatBRLInteger(r.total)} em produtos
      {" · "}
      {freteRotulo} {formatBRLInteger(r.frete)}
      {" · "}
      {formatKg(r.kg)}
      {r.caminhoes > 0 && (
        <span className={r.caminhoes > 1 ? "font-semibold text-ink" : ""}>
          {" "}({r.caminhoes} {r.caminhoes === 1 ? "caminhão" : "caminhões"} de {cap} kg)
        </span>
      )}
    </p>
  );
}

const SecaoLote = forwardRef(function SecaoLote(
  {
    numero,
    titulo,
    vazio,
    orders,
    getFranchiseName,
    onVerItens,
    sugerirFrete,
    rascunhos,
    statusFrete,
    onRascunho,
    onSalvarFrete,
    freteDoLote,
    freteRotulo = "frete",
    acaoPrincipal,
    acoesSecundarias = [],
    ocupado,
    destacarAtraso,
    maisAntigoPorUnidade,
    ultimoFretePorUnidade,
    mensalidadeAtrasadaSet,
    getContato,
    // Seleção controlada pelo pai (opcional): usado em "Para confirmar" para que o
    // "Excluir pedidos marcados" do cabeçalho enxergue a mesma marcação da lista.
    desmarcadosControlado,
    onDesmarcadosChange,
  },
  ref
) {
  const [desmarcadosInterno, setDesmarcadosInterno] = useState(() => new Set());
  const desmarcados = desmarcadosControlado ?? desmarcadosInterno;
  const setDesmarcados = onDesmarcadosChange ?? setDesmarcadosInterno;

  const selecionados = useMemo(() => orders.filter((o) => !desmarcados.has(o.id)), [orders, desmarcados]);
  const resumo = useMemo(() => resumoLote(selecionados, freteDoLote), [selecionados, freteDoLote]);
  const todos = orders.length > 0 && selecionados.length === orders.length;
  const nenhum = selecionados.length === 0;

  const alternar = (id) =>
    setDesmarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const alternarTodos = () => setDesmarcados(todos ? new Set(orders.map((o) => o.id)) : new Set());

  return (
    <section ref={ref} aria-label={titulo} className="scroll-mt-4 space-y-2.5">
      <SectionTitle titulo={`${numero}. ${titulo}`} ajuda={`· ${pedidosLabel(orders.length)}`} />

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-surface-line bg-white p-5 text-sm text-ink-3">{vazio}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-surface-line bg-white">
          {/* Barra do lote: marca/desmarca todos + resumo + a ação que resolve tudo. */}
          <div className="flex flex-col gap-3 border-b border-surface-line bg-surface/60 p-4 lg:flex-row lg:items-center lg:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <label className="-m-2 flex shrink-0 cursor-pointer items-center p-2">
                <input
                  type="checkbox"
                  checked={todos}
                  ref={(el) => { if (el) el.indeterminate = !todos && !nenhum; }}
                  onChange={alternarTodos}
                  className="h-5 w-5 rounded border-ink-4 accent-brand"
                  aria-label={todos ? "Desmarcar todos" : "Marcar todos"}
                />
              </label>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {nenhum ? "Nenhum marcado" : todos ? "Todos marcados" : `${selecionados.length} de ${orders.length} marcados`}
                </p>
                {!nenhum && <Resumo r={resumo} freteRotulo={freteRotulo} />}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap lg:justify-end">
              {acoesSecundarias.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => a.onClick(selecionados)}
                  disabled={nenhum || ocupado}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold disabled:opacity-50 ${
                    a.perigo ? "border-err/30 bg-white text-err hover:bg-err/5" : "border-surface-line bg-white text-ink hover:bg-surface"
                  }`}
                >
                  <MaterialIcon icon={a.icon} size={16} aria-hidden="true" />
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => acaoPrincipal.onClick(selecionados)}
                disabled={nenhum || ocupado}
                className={`order-first inline-flex sm:order-none min-h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 ${acaoPrincipal.cor}`}
              >
                <MaterialIcon
                  icon={ocupado ? "progress_activity" : acaoPrincipal.icon}
                  size={18}
                  className={ocupado ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                {acaoPrincipal.label(selecionados.length)}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-surface-line">
            {orders.map((order) => {
              const marcado = !desmarcados.has(order.id);
              const atrasado = destacarAtraso && isAtrasado(order);
              const nome = getFranchiseName(order.franchise_id);
              const acrescimo = sugerirFrete && ehAcrescimo(order, maisAntigoPorUnidade);
              const pedidoBase = acrescimo ? maisAntigoPorUnidade.get(order.franchise_id) : null;
              const dataPedidoBase = pedidoBase?.ordered_at ? new Date(pedidoBase.ordered_at).toLocaleDateString("pt-BR") : null;
              const mensalidadeAtrasada = mensalidadeAtrasadaSet?.has(order.franchise_id);
              const entregaPrevista = order.estimated_delivery ? new Date(`${order.estimated_delivery}T00:00:00`).toLocaleDateString("pt-BR") : null;
              const contato = getContato?.(order.franchise_id) || {};
              const linkChamar = contato.phone
                ? getWhatsAppLink(contato.phone, mensagemChamarPedido(order, { ownerName: contato.ownerName, atrasado, acrescimo }))
                : null;
              return (
                <li
                  key={order.id}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_9rem_auto] md:items-center md:gap-x-5 ${
                    atrasado ? "border-l-4 border-l-err bg-err/5" : ""
                  } ${marcado ? "" : "opacity-60"}`}
                >
                  <label className="-m-2 flex cursor-pointer items-start p-2 md:items-center">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(order.id)}
                      className="h-5 w-5 rounded border-ink-4 accent-brand"
                      aria-label={`Marcar pedido de ${nome}`}
                    />
                  </label>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{nome}</p>
                    <p className={`text-sm ${atrasado ? "font-semibold text-err" : "text-ink-3"}`}>
                      {linhaEsperaLabel(order)}
                    </p>
                    {(mensalidadeAtrasada || entregaPrevista) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {mensalidadeAtrasada && (
                          <span className="inline-flex items-center rounded-full bg-err/10 px-2 py-0.5 font-semibold text-err">
                            mensalidade atrasada
                          </span>
                        )}
                        {entregaPrevista && <span className="text-ink-3">entrega prevista {entregaPrevista}</span>}
                      </div>
                    )}
                    {order.notes && (
                      <p className="mt-0.5 flex items-start gap-1 text-sm text-ink-2">
                        <MaterialIcon icon="sticky_note_2" size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        <span className="line-clamp-2 break-words">{order.notes}</span>
                      </p>
                    )}
                  </div>

                  <div className="col-start-2 flex items-baseline justify-between gap-3 text-sm md:col-start-auto md:block md:text-right">
                    <span className="font-semibold text-ink">{formatBRL(order.total_amount)}</span>
                    <span className="text-ink-3 md:block">{formatKg(order.total_weight_kg)}</span>
                    <div className="flex items-center gap-1 md:justify-end">
                      {linkChamar && (
                        <a
                          href={safeHref(linkChamar)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Chamar ${nome} no WhatsApp`}
                          title="Chamar no WhatsApp"
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-brand-dark hover:bg-brand-soft"
                        >
                          <MaterialIcon icon="chat" size={18} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onVerItens(order)}
                        className="min-h-10 font-semibold text-brand-dark hover:underline md:min-h-0"
                      >
                        Ver itens →
                      </button>
                    </div>
                  </div>

                  <div className="col-start-2 md:col-start-auto md:w-56">
                    <CampoFrete
                      order={order}
                      rascunho={rascunhos[order.id]}
                      sugerir={sugerirFrete}
                      status={statusFrete[order.id]}
                      onRascunho={onRascunho}
                      onSalvar={onSalvarFrete}
                      nomeUnidade={nome}
                      acrescimo={acrescimo}
                      dataPedidoBase={dataPedidoBase}
                      ultimoFrete={ultimoFretePorUnidade?.get(order.franchise_id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
});

export default SecaoLote;
