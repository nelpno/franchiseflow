// S15.1 (chave ui_v2) — "Seu pedido chegou": a franqueada confere o que veio da fábrica.
// Aparece no topo de Gestão > Reposição só quando há pedido em 'em_rota' (a fábrica marcou
// entregue e o banco espera a conferência). "Recebi tudo certo" (com um toque de confirmação)
// ou "Faltou algo" (diz quanto chegou de cada produto). A RPC fecha o pedido numa transação:
// estoque e despesa uma vez só, pelo que chegou; frete o cobrado. Lógica em conferenciaEntrega.js.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PurchaseOrder, PurchaseOrderItem, confirmarRecebimentoPedido } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatters";
import { novoIdDoEnvio } from "@/lib/enviarPedidoFabrica";
import {
  STATUS_AGUARDA_CONFERENCIA,
  aguardaConferencia,
  prazoConferencia,
  limitarRecebido,
  montarItensRecebidos,
  resumoRecebido,
  mensagemErroConferencia,
} from "@/lib/conferenciaEntrega";

const FUSO = "America/Sao_Paulo";
const diaMes = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" }) : "—");
const diaHora = (d) =>
  d
    ? `${new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" })} às ${new Date(d).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" })}`
    : null;

function LinhaProduto({ item, valor, onChange, disabled }) {
  const pedido = Number(item.quantity) || 0;
  const chegou = limitarRecebido(valor, pedido);
  const diferente = chegou !== pedido;
  const inputId = `chegou-${item.id}`;
  return (
    <li className={`rounded-xl border p-3 ${diferente ? "border-err/30 bg-err-soft" : "border-surface-line bg-white"}`}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink break-words">
        {item.product_name}
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-2">
          Pedido: <strong className="text-ink">{pedido}</strong>
          {diferente && <span className="ml-1 font-semibold text-err">· faltou {pedido - chegou}</span>}
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-label={`Quanto chegou de ${item.product_name}`}>
          <button
            type="button"
            onClick={() => onChange((atual) => Math.max(0, limitarRecebido(atual, pedido) - 1))}
            disabled={disabled || chegou <= 0}
            aria-label="Menos um"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-line bg-white text-ink disabled:opacity-40"
          >
            <MaterialIcon icon="remove" size={20} />
          </button>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={pedido}
            value={valor === "" ? "" : chegou}
            onChange={(e) => onChange(e.target.value === "" ? "" : limitarRecebido(e.target.value, pedido))}
            onBlur={() => { if (valor === "") onChange(0); }}
            disabled={disabled}
            className="h-11 w-16 rounded-xl border border-surface-line bg-surface text-center text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="button"
            onClick={() => onChange((atual) => Math.min(pedido, limitarRecebido(atual, pedido) + 1))}
            disabled={disabled || chegou >= pedido}
            aria-label="Mais um"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-line bg-white text-ink disabled:opacity-40"
          >
            <MaterialIcon icon="add" size={20} />
          </button>
        </div>
      </div>
    </li>
  );
}

function PedidoParaConferir({ order, items, onConcluido }) {
  // modo: "inicio" | "tudo_certo" (toque de confirmação) | "faltou"
  const [modo, setModo] = useState("inicio");
  const [recebidos, setRecebidos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  // Id do envio: gerado ANTES da 1ª tentativa e mantido nas novas tentativas (rede caindo,
  // resposta perdida). Muda só quando ela muda o que vai mandar.
  const clientIdRef = useRef(novoIdDoEnvio());
  const assinaturaRef = useRef(null);

  const resumo = useMemo(() => resumoRecebido(items, modo === "faltou" ? recebidos : {}), [items, recebidos, modo]);
  const totalUnidades = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const prazo = prazoConferencia(order);

  const enviar = async (itens) => {
    if (enviandoRef.current) return;
    const assinatura = JSON.stringify(itens);
    if (assinaturaRef.current !== null && assinaturaRef.current !== assinatura) clientIdRef.current = novoIdDoEnvio();
    assinaturaRef.current = assinatura;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const { resultado, dados } = await confirmarRecebimentoPedido(order.id, itens, clientIdRef.current);
      if (resultado === "ja_conferido") {
        toast.info("Este pedido já tinha sido conferido. A tela foi atualizada.");
      } else if (dados?.modo === "divergente") {
        toast.success(`Pronto! O pedido ficou em ${formatBRL(dados.total_amount)} e a fábrica foi avisada do que faltou.`);
      } else {
        toast.success("Pronto! O que chegou já está no seu estoque.");
      }
      onConcluido?.();
    } catch (error) {
      console.error("Erro ao confirmar o recebimento:", error);
      toast.error(mensagemErroConferencia(error));
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const confirmarTudoCerto = () => enviar([]);
  const confirmarFaltou = () => {
    const itens = montarItensRecebidos(items, recebidos);
    if (itens.length === 0) {
      toast.error("Você não mudou nenhuma quantidade. Se chegou tudo, toque em \"Recebi tudo certo\".");
      return;
    }
    enviar(itens);
  };

  return (
    <div className="rounded-2xl border border-surface-line bg-surface/60 p-3 sm:p-4">
      <p className="text-sm font-semibold text-ink">
        Pedido de {diaMes(order.ordered_at)} · {formatBRL(order.total_amount)}
      </p>
      <p className="mt-0.5 text-xs text-ink-2">
        {items.length} {items.length === 1 ? "produto" : "produtos"} · {totalUnidades} un.
        {order.shipped_at ? ` · entregue em ${diaMes(order.shipped_at)}` : ""}
      </p>
      {prazo && (
        <p className="mt-2 text-xs text-ink-2">
          Confira até <strong className="text-ink">{diaHora(prazo)}</strong>. Depois disso o pedido conta como recebido completo.
        </p>
      )}

      {modo === "inicio" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => setModo("tudo_certo")}
            disabled={enviando || items.length === 0}
            className="min-h-12 rounded-xl bg-ok-ink text-base font-bold text-white hover:bg-ok-ink/90 gap-2"
          >
            <MaterialIcon icon="check_circle" size={20} />
            Recebi tudo certo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setModo("faltou")}
            disabled={enviando || items.length === 0}
            className="min-h-12 rounded-xl border-err/40 text-base font-bold text-err hover:bg-err-soft gap-2"
          >
            <MaterialIcon icon="error" size={20} />
            Faltou algo
          </Button>
        </div>
      )}

      {modo === "tudo_certo" && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <p className="text-sm text-ink">
            Chegaram as <strong>{totalUnidades}</strong> unidades do pedido? O estoque vai somar tudo agora.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={confirmarTudoCerto}
              disabled={enviando}
              className="min-h-12 rounded-xl bg-ok-ink text-base font-bold text-white hover:bg-ok-ink/90 gap-2"
            >
              <MaterialIcon icon={enviando ? "progress_activity" : "check_circle"} size={20} className={enviando ? "animate-spin" : ""} />
              {enviando ? "Confirmando..." : "Sim, chegou tudo"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModo("inicio")} disabled={enviando} className="min-h-12 rounded-xl border-ink-4 text-ink-2">
              Voltar
            </Button>
          </div>
        </div>
      )}

      {modo === "faltou" && (
        <div className="mt-3">
          <p className="text-sm text-ink">
            Diga quanto <strong>chegou</strong> de cada produto. O que você não mexer conta como completo.
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <LinhaProduto
                key={item.id}
                item={item}
                valor={item.id in recebidos ? recebidos[item.id] : Number(item.quantity) || 0}
                disabled={enviando}
                onChange={(v) =>
                  setRecebidos((prev) => {
                    // função = toque no menos/mais: parte do valor ATUAL (dois toques rápidos contam dois)
                    const atual = item.id in prev ? prev[item.id] : Number(item.quantity) || 0;
                    return { ...prev, [item.id]: typeof v === "function" ? v(atual) : v };
                  })
                }
              />
            ))}
          </ul>
          <div className="sticky bottom-0 mt-3 rounded-xl border border-surface-line bg-white p-3 shadow-sm">
            <p className="text-sm text-ink">
              {resumo.temDiferenca ? (
                <>
                  Chegou <strong>{formatBRL(resumo.totalRecebido)}</strong> de {formatBRL(resumo.totalPedido)}.
                  <span className="block text-xs text-ink-2">O pedido e a despesa ficam com o valor do que chegou. O frete continua o mesmo.</span>
                </>
              ) : (
                "Ainda está tudo igual ao pedido. Use o menos (−) no que faltou."
              )}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={confirmarFaltou}
                disabled={enviando || !resumo.temDiferenca}
                className="min-h-12 rounded-xl bg-brand text-base font-bold text-white hover:bg-brand-dark gap-2"
              >
                <MaterialIcon icon={enviando ? "progress_activity" : "fact_check"} size={20} className={enviando ? "animate-spin" : ""} />
                {enviando ? "Confirmando..." : "Confirmar o que chegou"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setModo("inicio"); setRecebidos({}); }}
                disabled={enviando}
                className="min-h-12 rounded-xl border-ink-4 text-ink-2"
              >
                Voltar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConferirEntregaCard({ franchiseId, refreshKey = 0, onConfirmado }) {
  const [estado, setEstado] = useState({ status: "carregando", pedidos: [], itens: {} });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!franchiseId) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      try {
        // Só conferência S15 (com awaiting_since); em_rota legado segue o fluxo antigo.
        const pedidos = (await PurchaseOrder.filter(
          { franchise_id: franchiseId, status: STATUS_AGUARDA_CONFERENCIA },
          "ordered_at",
          undefined,
          { signal }
        )).filter(aguardaConferencia);
        let itens = {};
        if (pedidos.length > 0) {
          const lista = await PurchaseOrderItem.filter({ order_id: pedidos.map((p) => p.id) }, "product_name", undefined, { signal });
          itens = lista.reduce((acc, it) => { (acc[it.order_id] ||= []).push(it); return acc; }, {});
        }
        if (!signal.aborted) setEstado({ status: "ok", pedidos, itens });
      } catch (error) {
        if (signal.aborted || error?.name === "AbortError") return;
        console.error("Erro ao carregar pedidos para conferir:", error);
        setEstado({ status: "erro", pedidos: [], itens: {} });
      }
    })();
    return () => controller.abort();
  }, [franchiseId, refreshKey, tentativa]);

  const concluido = useCallback(() => {
    setTentativa((n) => n + 1);
    onConfirmado?.();
  }, [onConfirmado]);

  if (estado.status === "carregando") return null; // não empurra a tela enquanto carrega
  if (estado.status === "erro") {
    return (
      <Card className="rounded-2xl border border-err/20 bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-err">Não foi possível ver se chegou algum pedido.</p>
          <Button type="button" variant="outline" onClick={() => setTentativa((n) => n + 1)} className="min-h-10 rounded-xl">
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (estado.pedidos.length === 0) return null;

  return (
    <Card className="rounded-2xl border border-ok/30 bg-white shadow-sm" data-testid="conferir-entrega">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="local_shipping" size={22} className="shrink-0 text-ok-ink" />
          <h3 className="font-plus-jakarta text-base font-bold text-ink">
            {estado.pedidos.length === 1 ? "Seu pedido chegou. Confira!" : `${estado.pedidos.length} pedidos chegaram. Confira!`}
          </h3>
        </div>
        {estado.pedidos.map((order) => (
          <PedidoParaConferir key={order.id} order={order} items={estado.itens[order.id] || []} onConcluido={concluido} />
        ))}
      </CardContent>
    </Card>
  );
}
