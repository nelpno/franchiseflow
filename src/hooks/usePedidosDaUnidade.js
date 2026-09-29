import { useEffect, useState, useCallback } from "react";
import { PurchaseOrder, PurchaseOrderItem } from "@/entities/all";
import { carregarPedidosAbertos, carregarDatasDePedidos } from "@/lib/reposicao";
import { intervaloEntrePedidos, INTERVALO_PADRAO_DIAS } from "@/lib/stockSuggestion";

/**
 * S25 (chave ui_v2): o que a conta da sugestão precisa saber dos pedidos à fábrica da unidade.
 *  - `status`/`emAberto`: o que já está A CAMINHO (pedidos pendente/confirmado/em rota). Enquanto
 *    carrega ou se der erro, quem sugere compra fica desligado (P3 da S14: "nada a caminho" por
 *    falha de rede faria pedir em dobro).
 *  - `intervalo`: de quanto em quanto tempo a unidade pede. Erro aqui NÃO bloqueia: vale o
 *    padrão da rede (21 dias).
 * Usado pelo Estoque e pela Reposição (as abas não ficam montadas juntas).
 */
export function usePedidosDaUnidade(franchiseId, { enabled = true, refreshKey = 0 } = {}) {
  const [abertos, setAbertos] = useState({ status: "carregando", emAberto: {} });
  const [intervalo, setIntervalo] = useState({ dias: INTERVALO_PADRAO_DIAS, daUnidade: false });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!enabled || !franchiseId) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    setAbertos({ status: "carregando", emAberto: {} });
    carregarPedidosAbertos({ PurchaseOrder, PurchaseOrderItem, franchiseId, signal })
      .then((r) => { if (!signal.aborted) setAbertos({ status: "ok", emAberto: r.emAberto }); })
      .catch((err) => {
        if (signal.aborted || err?.name === "AbortError") return;
        console.error("Erro ao carregar pedidos abertos:", err);
        setAbertos({ status: "erro", emAberto: {} });
      });
    carregarDatasDePedidos({ PurchaseOrder, franchiseId, signal })
      .then((datas) => { if (!signal.aborted) setIntervalo(intervaloEntrePedidos(datas)); })
      .catch((err) => {
        if (signal.aborted || err?.name === "AbortError") return;
        setIntervalo({ dias: INTERVALO_PADRAO_DIAS, daUnidade: false });
      });
    return () => controller.abort();
  }, [enabled, franchiseId, refreshKey, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);

  return { status: abertos.status, emAberto: abertos.emAberto, intervalo, tentarDeNovo };
}
