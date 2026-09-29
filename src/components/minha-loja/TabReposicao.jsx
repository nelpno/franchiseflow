import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PurchaseOrder, PurchaseOrderItem, InventoryItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { weeklyTurnoverMap, suggestionFor, ritmoDeVendaMap } from "@/lib/stockSuggestion";
import {
  linhasDeCompra,
  resumoDeCompra,
} from "@/lib/reposicao";
import { usePedidosDaUnidade } from "@/hooks/usePedidosDaUnidade";
import ReposicaoV2 from "./ReposicaoV2";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { useAuth } from "@/lib/AuthContext";
import PurchaseOrderForm from "./PurchaseOrderForm";
import PurchaseOrderHistory from "./PurchaseOrderHistory";
import ConferirEntregaCard from "./ConferirEntregaCard";

// Mesmas colunas do Gestao.jsx (INVENTORY_COLUMNS): o estoque relido aqui depois da
// conferência (S15) tem de ter o mesmo formato do que a página passa.
const COLUNAS_ESTOQUE = "id, franchise_id, product_name, quantity, min_stock, cost_price, sale_price, category, updated_at, created_by_franchisee, active";

export default function TabReposicao({
  franchiseId,
  inventoryItems: inventoryItemsProp,
  saleItems,
  onRefreshInventory,
}) {
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const [initialQuantities, setInitialQuantities] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [loadingLastOrder, setLoadingLastOrder] = useState(true);
  const abortControllerRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const modeloParamHandledRef = useRef(false);

  // S14 (chave ui_v2): "Repor N" abre o pedido preenchido, descontando os pedidos abertos.
  const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
  const { selectedFranchise } = useAuth();
  const franchiseName =
    selectedFranchise?.evolution_instance_id === franchiseId ? selectedFranchise?.name || null : null;
  const [origemPedido, setOrigemPedido] = useState(null);
  // O que está A CAMINHO: consulta própria só dos pedidos ABERTOS, com todos os itens (P3,
  // ponto 4). Enquanto carrega ou se der erro, o Repor fica DESLIGADO com aviso — "nada a
  // caminho" por falha de rede faria pedir em dobro. S25: a mesma consulta vira um hook,
  // que também traz de quanto em quanto tempo a unidade pede (intervalo da conta nova).
  const pedidosUnidade = usePedidosDaUnidade(franchiseId, { enabled: uiV2, refreshKey: orderRefreshKey });
  const abertos = { status: pedidosUnidade.status, emAberto: pedidosUnidade.emAberto };
  const setAbertosTentativa = pedidosUnidade.tentarDeNovo;
  const pedidosProntos = abertos.status === "ok";

  // S15 (chave ui_v2): conferiu a entrega -> o estoque mudou no banco. Relê o estoque aqui
  // (a página só relê a cada 5 min) para o "Acabando"/"Repor" não sugerir de novo o que
  // acabou de chegar; vale até a página mandar uma lista nova.
  const [estoqueFresco, setEstoqueFresco] = useState(null);
  const inventoryItems =
    estoqueFresco && estoqueFresco.base === inventoryItemsProp ? estoqueFresco.lista : inventoryItemsProp;
  const aoConfirmarEntrega = async () => {
    const base = inventoryItemsProp;
    try {
      const lista = await InventoryItem.filter({ franchise_id: franchiseId }, null, null, { columns: COLUNAS_ESTOQUE });
      setEstoqueFresco({ base, lista });
    } catch (err) {
      console.error("Erro ao reler o estoque depois da conferência:", err);
    }
    onRefreshInventory?.();
    setOrderRefreshKey((k) => k + 1);
  };
  const emAberto = abertos.emAberto;

  // Unidade nunca fez pedido à fábrica (dado que a tela já busca pra "Repetir Ultimo") →
  // é o 1º pedido dela: PurchaseOrderForm mostra a faixa do pedido modelo da Maxi.
  const primeiroPedido = !loadingLastOrder && !lastOrder;

  // Link da trilha de onboarding (/Gestao?tab=reposicao&modelo=1): abre o formulário
  // automaticamente uma vez e limpa o parâmetro da URL (não fica reabrindo em F5/back).
  useEffect(() => {
    if (modeloParamHandledRef.current) return;
    if (searchParams.get("modelo") !== "1") return;
    modeloParamHandledRef.current = true;
    setOrigemPedido(null);
    setInitialQuantities(null);
    setShowOrderDialog(true);
    const next = new URLSearchParams(searchParams);
    next.delete("modelo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load last order for "Repetir Ultimo"
  useEffect(() => {
    if (!franchiseId) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingLastOrder(true);
    PurchaseOrder.filter({ franchise_id: franchiseId }, "-ordered_at", 1, { signal: controller.signal })
      .then((orders) => {
        setLastOrder(orders.length > 0 ? orders[0] : null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLastOrder(null);
      })
      .finally(() => setLoadingLastOrder(false));

    return () => controller.abort();
  }, [franchiseId, orderRefreshKey]);

  const weeklyTurnover = useMemo(() => weeklyTurnoverMap(saleItems), [saleItems]);

  // S25: conta nova (a mesma do Estoque e do Novo Pedido).
  const ritmoV2 = useMemo(() => (uiV2 ? ritmoDeVendaMap(saleItems) : {}), [uiV2, saleItems]);
  const resumoV2 = useMemo(() => {
    if (!uiV2) return null;
    return resumoDeCompra(
      linhasDeCompra(inventoryItems, { ritmo: ritmoV2, emAberto, intervaloDias: pedidosUnidade.intervalo.dias })
    );
  }, [uiV2, inventoryItems, ritmoV2, emAberto, pedidosUnidade.intervalo.dias]);
  const abrirNovoPedidoV2 = (origem) => {
    setOrigemPedido(origem);
    setInitialQuantities(null);
    setShowOrderDialog(true);
    try { window.clarity?.("event", origem === "sugestao" ? "pedido_sugestao_aberto" : "pedido_novo_aberto"); } catch { /* telemetria */ }
  };

  const suggestions = useMemo(() => {
    // Só itens do catálogo padrão da fábrica — extras da franquia (created_by_franchisee) não
    // são pedidos à fábrica, então não fazem parte da sugestão de reposição.
    const items = (inventoryItems || []).filter(
      (item) =>
        item.created_by_franchisee !== true &&
        item.active !== false &&
        item.cost_price &&
        parseFloat(item.cost_price) > 0
    );
    // Com a chave, a sugestão é o bloco da S25 (ReposicaoV2); este cartão é só o de sempre.
    if (uiV2) return [];
    return items
      .map((item) => {
        const sug = suggestionFor(item, weeklyTurnover);
        if (sug === null || sug <= 0) return null;
        return {
          id: item.id,
          name: item.product_name,
          stock: parseFloat(item.quantity) || 0,
          weeklyTurnover: weeklyTurnover[item.id] || 0,
          suggestion: sug,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.suggestion - a.suggestion)
      .slice(0, 5);
  }, [inventoryItems, weeklyTurnover, uiV2]);

  const hasHistory = Object.keys(weeklyTurnover).length > 0;

  const handleRepeatLastOrder = async () => {
    if (!lastOrder) return;
    try {
      const items = await PurchaseOrderItem.filter({ order_id: lastOrder.id });
      if (items.length === 0) {
        toast.error("O último pedido não tem itens.");
        return;
      }
      // Build initialQuantities map: inventory_item_id -> quantity
      const qtyMap = {};
      items.forEach((item) => {
        if (item.inventory_item_id) {
          qtyMap[item.inventory_item_id] = item.quantity || 0;
        }
      });
      setOrigemPedido(null);
      setInitialQuantities(qtyMap);
      setShowOrderDialog(true);
    } catch (error) {
      console.error("Erro ao carregar último pedido:", error);
      toast.error("Erro ao carregar itens do último pedido.");
    }
  };

  const handleNewOrder = () => {
    setOrigemPedido(null);
    setInitialQuantities(null);
    setShowOrderDialog(true);
  };

  // Items below minimum stock (critical) — só catálogo padrão da fábrica.
  // Itens extras da franquia (created_by_franchisee) não entram no alerta de reposição da fábrica.
  const criticalItems = useMemo(() => {
    return (inventoryItems || [])
      .filter(item => {
        if (item.active === false) return false;
        if (item.created_by_franchisee === true) return false;
        const qty = item.quantity || 0;
        const min = item.min_stock || 0;
        return min > 0 && qty < min;
      })
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
  }, [inventoryItems]);

  return (
    <div className="space-y-6">
      {/* S15.1 — Seu pedido chegou: conferir. A chave ui_v2 só decide INICIAR a conferência (no
          banco); a que já começou aparece mesmo com a chave desligada, até concluir. Sem nada
          esperando, o cartão não desenha nada. */}
      <ConferirEntregaCard franchiseId={franchiseId} refreshKey={orderRefreshKey} onConfirmado={aoConfirmarEntrega} />

      {/* S25 — Reposição num bloco só (chave ui_v2) */}
      {uiV2 && (
        <ReposicaoV2
          status={abertos.status}
          onTentarDeNovo={() => setAbertosTentativa()}
          resumo={resumoV2}
          intervalo={pedidosUnidade.intervalo}
          temVenda={Object.keys(ritmoV2).length > 0}
          primeiroPedido={primeiroPedido}
          onMontar={() => abrirNovoPedidoV2("sugestao")}
          onNovo={() => abrirNovoPedidoV2(null)}
          onRepetir={handleRepeatLastOrder}
          podeRepetir={!!lastOrder && !loadingLastOrder}
        />
      )}

      {/* Critical stock alert */}
      {!uiV2 && criticalItems.length > 0 && (
        <Card className="bg-gradient-to-r from-err/5 to-err/10 rounded-2xl shadow-sm border border-err/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon icon="warning" size={20} className="text-err" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-err font-plus-jakarta">
                Estoque Crítico ({criticalItems.length})
              </h3>
            </div>
            <div className="space-y-2">
              {criticalItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/60"
                >
                  <span className="text-sm font-medium text-ink truncate flex-1 min-w-0">
                    {item.product_name}
                  </span>
                  <div className="text-right ml-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-err font-mono-numbers">
                      {item.quantity || 0}
                    </span>
                    <span className="text-xs text-ink-2">
                      / mín {item.min_stock}
                    </span>
                  </div>
                </div>
              ))}
              {criticalItems.length > 8 && (
                <p className="text-xs text-err/60 text-center">
                  +{criticalItems.length - 8} produtos abaixo do mínimo
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestion card */}
      {!uiV2 && (suggestions.length > 0 ? (
        <Card className="bg-gradient-to-r from-brand-gold/5 to-brand-gold/10 rounded-2xl shadow-sm border border-brand-gold/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon icon="lightbulb" size={20} className="text-brand-gold" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-gold-ink font-plus-jakarta">
                Sugestão de Reposição
              </h3>
            </div>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/60"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-ink truncate block">
                      {item.name}
                    </span>
                    <span className="text-xs text-ink-2">
                      Estoque: {item.stock} · Giro: {item.weeklyTurnover.toFixed(1)}/sem
                    </span>
                  </div>
                  <div className="text-right ml-3">
                    <span className="text-sm font-bold text-brand font-mono-numbers">
                      +{item.suggestion}
                    </span>
                    <span className="text-xs text-ink-2 block">un</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !hasHistory ? (
        <Card className="bg-gradient-to-r from-ink/5 to-ink/10 rounded-2xl shadow-sm border border-ink/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-2">
              <MaterialIcon icon="hourglass_empty" size={20} className="text-ink-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-ink">
                  Sem histórico de vendas suficiente.
                </p>
                <p className="text-xs text-ink-2 mt-1">
                  Registre vendas por alguns dias para começarmos a sugerir reposições baseadas no seu giro.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-ok/5 to-ok/10 rounded-2xl shadow-sm border border-ok/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="check_circle" size={20} className="text-ok" />
              <span className="text-sm font-medium text-ok-ink">
                Estoque em dia!
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Header */}
      {!uiV2 && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink font-plus-jakarta">
            Reposição de Estoque
          </h2>
          <p className="text-sm text-ink-2">
            Faça pedidos para a fábrica Maxi Massas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleRepeatLastOrder}
                    disabled={!lastOrder || loadingLastOrder}
                    className="gap-2 border-brand-gold text-brand-gold-ink font-bold rounded-xl hover:bg-brand-gold/10 disabled:opacity-50"
                  >
                    <MaterialIcon icon="replay" size={18} />
                    Repetir último
                  </Button>
                </span>
              </TooltipTrigger>
              {!lastOrder && !loadingLastOrder && (
                <TooltipContent>
                  <p>Nenhum pedido anterior</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <Button
            onClick={handleNewOrder}
            className="gap-2 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
          >
            <MaterialIcon icon="add_shopping_cart" size={18} />
            Novo Pedido
          </Button>
        </div>
      </div>
      )}

      {/* Purchase Order History */}
      <PurchaseOrderHistory
        franchiseId={franchiseId}
        refreshKey={orderRefreshKey}
        uiV2={uiV2}
        franchiseName={franchiseName}
        onChanged={() => setAbertosTentativa()}
      />

      {/* Purchase Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent
          className={
            uiV2
              ? "flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90dvh] sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl"
              : "sm:max-w-4xl max-h-[90dvh] rounded-2xl p-4 sm:p-6"
          }
          onInteractOutside={uiV2 ? (e) => e.preventDefault() : undefined}
          onOpenAutoFocus={uiV2 ? (e) => e.preventDefault() : undefined}
        >
          <DialogHeader className={uiV2 ? "shrink-0 border-b border-surface-line px-4 py-3 pr-14 text-left sm:px-6" : undefined}>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-ink min-w-0">
              <MaterialIcon icon="local_shipping" size={20} className="text-brand-gold shrink-0" />
              <span className="truncate">
                {uiV2
                  ? initialQuantities && origemPedido !== "repor" ? "Repetir pedido" : "Novo pedido à fábrica"
                  : origemPedido === "repor" ? "Repor estoque" : initialQuantities ? "Repetir Pedido" : "Novo Pedido de Compra"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            franchiseId={franchiseId}
            inventoryItems={inventoryItems}
            saleItems={saleItems}
            initialQuantities={initialQuantities}
            primeiroPedido={primeiroPedido}
            primeiroPedidoPronto={!loadingLastOrder}
            uiV2={uiV2}
            aberto={showOrderDialog}
            emAberto={uiV2 && pedidosProntos ? emAberto : null}
            abertosStatus={abertos.status}
            ritmo={uiV2 ? ritmoV2 : null}
            intervaloDias={pedidosUnidade.intervalo.dias}
            origem={origemPedido}
            onSave={() => {
              setShowOrderDialog(false);
              setInitialQuantities(null);
              setOrderRefreshKey((k) => k + 1);
            }}
            onCancel={() => {
              setShowOrderDialog(false);
              setInitialQuantities(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
