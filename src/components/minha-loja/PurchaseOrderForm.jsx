import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { PurchaseOrder, PurchaseOrderItem, getPedidoModelo, getPrecosPedidoFabrica } from "@/entities/all";
import { quantidadesDoModelo } from "@/lib/pedidoModelo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { weeklyTurnoverMap, suggestionFor } from "@/lib/stockSuggestion";
import { getItemWeightKg, formatWeightKg } from "@/lib/productWeight";
import { getProductWeightMap } from "@/entities/all";
import { formatBRL as formatBRLShared } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { supabase } from "@/api/supabaseClient";
import { estimarFreteFabrica } from "@/lib/freteFabrica";
import { comPrecoDaTabela, reposicaoDoItem, unidadeDeMedida } from "@/lib/reposicao";
import {
  enviarPedidoFabrica,
  montarItensDoPedido,
  mensagemErroPedido,
  novoIdDoEnvio,
  idDoEnvioValido,
  ehEnvioDiferente,
} from "@/lib/enviarPedidoFabrica";

// Só essa tela mostra "—" pra vazio em vez de "R$ 0,00" (quantidade ainda não digitada) —
// o formatador em si vem de @/lib/formatters (S8.4, 28/09/2026).
const formatBRL = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return formatBRLShared(value);
};

const getErrorMessage = (error) => {
  const msg = error?.message || "";
  if (msg.includes("JWT") || msg.includes("token") || msg.includes("expired") || error?.status === 401) {
    return "Sessão expirada. Faça login novamente.";
  }
  if (msg.includes("row-level security") || error?.code === "42501") {
    return "Sem permissão para criar pedido. Verifique seu cadastro.";
  }
  if (msg.includes("violates foreign key") || error?.code === "23503") {
    return "Franquia não encontrada. Atualize a página e tente novamente.";
  }
  if (msg.includes("Tempo limite")) {
    return "Servidor demorou para responder. Tente novamente.";
  }
  if (msg.startsWith("Pedido:")) return mensagemErroPedido(error);
  return safeErrorMessage(error, "Não foi possível enviar o pedido. Tente de novo.");
};

export default function PurchaseOrderForm({
  franchiseId,
  inventoryItems,
  saleItems,
  initialQuantities,
  primeiroPedido = false,
  onSave,
  onCancel,
  // S14 (atrás da chave ui_v2, decidida no TabReposicao): o que já está a caminho em pedidos
  // abertos ({ inventory_item_id: qtd }) e de onde o formulário foi aberto ("repor" = "Repor N").
  uiV2 = false,
  emAberto = null,
  origem = null,
  // Estado do "a caminho" (P3 2ª passada): "ok" | "carregando" | "erro". Só vale com a chave;
  // fora de "ok" a sugestão automática fica desligada (calcularia zero a caminho = pedir em dobro).
  abertosStatus = "ok",
}) {
  const DRAFT_KEY = `reposicao_draft_${franchiseId}`;
  const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > DRAFT_MAX_AGE) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return draft;
    } catch { return null; }
  };

  const draft = useRef(loadDraft());

  // S14.3: id do envio gerado ANTES da 1ª tentativa e mantido nas seguintes (e no rascunho,
  // para sobreviver a fechar/abrir). A RPC grava uma vez só por id; resposta perdida + nova
  // tentativa devolve o mesmo pedido em vez de criar outro.
  const clientIdRef = useRef(
    idDoEnvioValido(draft.current?.clientId) ? draft.current.clientId : novoIdDoEnvio()
  );

  const [notes, setNotes] = useState(draft.current?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // P3 da S14 (ponto 3): o mesmo envio já chegou à fábrica com OUTRO conteúdo (outra aba, ou a
  // tela mudou depois de uma resposta perdida). O rascunho fica; envio novo só se ela confirmar.
  const [envioDiferente, setEnvioDiferente] = useState(false);
  const submittingRef = useRef(false);

  // Mapa de pesos (tabela-mestra). Falha silenciosa cai no parser do nome.
  const [weightMap, setWeightMap] = useState({});
  useEffect(() => {
    let alive = true;
    getProductWeightMap()
      .then((m) => { if (alive) setWeightMap(m); })
      .catch(() => { /* sem mapa: getItemWeightKg usa o parser do nome */ });
    return () => { alive = false; };
  }, []);

  // S14.7: preços da tabela da fábrica (o que a RPC grava). Falha = fica o custo da unidade.
  const [precosTabela, setPrecosTabela] = useState(null);
  useEffect(() => {
    if (!franchiseId) return undefined;
    let alive = true;
    getPrecosPedidoFabrica(franchiseId)
      .then((m) => { if (alive) setPrecosTabela(m); })
      .catch(() => { /* sem a função/rede: o total mostrado segue o custo; a RPC grava pela tabela */ });
    return () => { alive = false; };
  }, [franchiseId]);

  // Produtos da fábrica = catálogo padrão da rede (created_by_franchisee === false) com custo > 0.
  // Itens extras criados pela própria franquia (created_by_franchisee === true) NÃO podem ser
  // pedidos à fábrica — o controle desses é da unidade. Antes o filtro usava só cost_price > 0,
  // o que deixava itens extras com custo (queijo ralado, salsaretti, molhos próprios) vazarem pro pedido.
  const standardProducts = useMemo(() => {
    return comPrecoDaTabela((inventoryItems || []).filter(
      (item) =>
        item.created_by_franchisee !== true &&
        item.cost_price &&
        parseFloat(item.cost_price) > 0
    ), precosTabela);
  }, [inventoryItems, precosTabela]);

  // Group products by type (first word of product_name)
  const productGroups = useMemo(() => {
    const groups = [];
    const groupMap = {};
    const ORDER = ["Canelone", "Conchiglione", "Massa", "Nhoque", "Fatiado", "Rondelli", "Sofioli", "Molho"];

    standardProducts.forEach((item) => {
      const firstWord = item.product_name.split(" ")[0];
      if (!groupMap[firstWord]) {
        groupMap[firstWord] = { label: firstWord, items: [] };
        groups.push(groupMap[firstWord]);
      }
      groupMap[firstWord].items.push(item);
    });

    // Sort groups by the ORDER array, unknown types go to the end
    groups.sort((a, b) => {
      const ai = ORDER.indexOf(a.label);
      const bi = ORDER.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return groups;
  }, [standardProducts]);

  const weeklyTurnover = useMemo(() => weeklyTurnoverMap(saleItems), [saleItems]);

  const sugestaoIndisponivel = uiV2 && abertosStatus !== "ok";
  const getSuggestion = (item) => {
    if (!uiV2) return suggestionFor(item, weeklyTurnover);
    if (sugestaoIndisponivel) return null;
    const r = reposicaoDoItem(item, weeklyTurnover, emAberto);
    return r.semBase ? null : r.repor;
  };
  const aCaminhoDe = (item) => (uiV2 ? parseFloat(emAberto?.[item.id]) || 0 : 0);

  // Quantities state: { itemId: qty } — restore from draft > initialQuantities > 0
  const [quantities, setQuantities] = useState(() => {
    const savedQtys = draft.current?.quantities;
    const init = {};
    standardProducts.forEach((item) => {
      if (initialQuantities && initialQuantities[item.id]) {
        init[item.id] = initialQuantities[item.id];
      } else if (savedQtys && savedQtys[item.id]) {
        init[item.id] = savedQtys[item.id];
      } else {
        init[item.id] = 0;
      }
    });
    return init;
  });

  const draftMescladoCount = useMemo(() => {
    if (!uiV2 || !initialQuantities || !draft.current?.quantities) return 0;
    return standardProducts.filter(
      (item) => !initialQuantities[item.id] && (draft.current.quantities[item.id] || 0) > 0
    ).length;
    // só no carregamento: é o que veio do rascunho quando o formulário abriu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mostrarAvisoRascunho, setMostrarAvisoRascunho] = useState(true);

  // Persist draft to localStorage on change
  const saveDraft = useCallback((qtys, n) => {
    const hasData = Object.values(qtys).some(v => v > 0) || n.trim().length > 0;
    if (hasData) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ quantities: qtys, notes: n, clientId: clientIdRef.current, savedAt: Date.now() }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [DRAFT_KEY]);

  useEffect(() => { saveDraft(quantities, notes); }, [quantities, notes, saveDraft]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* sem storage: nada a limpar */ }
  };

  // Pedido modelo da Maxi (1º pedido): busca ao abrir; falha aqui NÃO bloqueia o formulário,
  // só não mostra a faixa. `modeloAplicadoRef` alimenta o evento de Clarity no envio.
  const [pedidoModeloItens, setPedidoModeloItens] = useState(null);
  const modeloAplicadoUmaVezRef = useRef(false);
  const modeloAplicadoRef = useRef(false);
  // Se ela já mexeu nas quantidades enquanto o modelo carregava, o modelo não sobrescreve.
  const usuarioMexeuRef = useRef(false);

  useEffect(() => {
    if (!primeiroPedido) return;
    let alive = true;
    getPedidoModelo()
      .then((modelo) => { if (alive && modelo?.length > 0) setPedidoModeloItens(modelo); })
      .catch(() => { /* sem modelo: formulário segue normal, sem a faixa */ });
    return () => { alive = false; };
  }, [primeiroPedido]);

  const aplicarModelo = useCallback(() => {
    if (!pedidoModeloItens || standardProducts.length === 0) return;
    const { quantidades, naoCasados } = quantidadesDoModelo(standardProducts, pedidoModeloItens);
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV && naoCasados.length > 0) {
      console.warn(
        "[PurchaseOrderForm] produtos do pedido modelo sem item correspondente no catálogo da unidade:",
        naoCasados
      );
    }
    const next = {};
    standardProducts.forEach((item) => { next[item.id] = quantidades[item.id] || 0; });
    setQuantities(next);
    modeloAplicadoRef.current = true;
  }, [pedidoModeloItens, standardProducts]);

  // Preenche automaticamente UMA vez ao carregar — só se não houver rascunho com quantidade
  // (rascunho > modelo, mesma prioridade que já vale para initialQuantities).
  useEffect(() => {
    if (!pedidoModeloItens || standardProducts.length === 0) return;
    if (modeloAplicadoUmaVezRef.current) return;
    modeloAplicadoUmaVezRef.current = true;
    if (usuarioMexeuRef.current) return;
    const draftTemQuantidade = draft.current?.quantities
      && Object.values(draft.current.quantities).some((v) => v > 0);
    if (!draftTemQuantidade) aplicarModelo();
  }, [pedidoModeloItens, standardProducts, aplicarModelo]);

  const setQty = (itemId, value) => {
    usuarioMexeuRef.current = true;
    if (value === "" || value === undefined) {
      setQuantities((prev) => ({ ...prev, [itemId]: "" }));
      return;
    }
    const parsed = parseInt(value, 10);
    setQuantities((prev) => ({
      ...prev,
      [itemId]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  const handleUseSuggestions = () => {
    if (sugestaoIndisponivel) return;
    usuarioMexeuRef.current = true;
    const newQtys = { ...quantities };
    standardProducts.forEach((item) => {
      const sug = getSuggestion(item);
      if (sug !== null && sug > 0) {
        newQtys[item.id] = sug;
      }
    });
    setQuantities(newQtys);
    toast.success("Quantidades preenchidas com sugestão.");
  };

  // Line total
  const getLineTotal = (item) => {
    const qty = quantities[item.id] || 0;
    return qty * (parseFloat(item.cost_price) || 0);
  };

  // Grand total
  const grandTotal = useMemo(() => {
    return standardProducts.reduce((sum, item) => sum + getLineTotal(item), 0);
  }, [standardProducts, quantities]);

  // Peso total = Σ(qtd × peso unit). Item sem peso conta 0 e é sinalizado.
  const { grandWeight, missingWeightCount } = useMemo(() => {
    let total = 0, missing = 0;
    standardProducts.forEach((item) => {
      const qty = quantities[item.id] || 0;
      if (qty <= 0) return;
      const w = getItemWeightKg(item, weightMap);
      if (w == null) { missing++; return; }
      total += qty * w;
    });
    return { grandWeight: total, missingWeightCount: missing };
  }, [standardProducts, quantities, weightMap]);

  // S14.2: estimativa (a fábrica lança o frete de verdade; zero é legítimo em acréscimo/retirada).
  const freteEstimado = useMemo(() => estimarFreteFabrica(grandTotal), [grandTotal]);

  const totalItems = useMemo(() =>
    standardProducts.filter((item) => (quantities[item.id] || 0) > 0).length,
    [standardProducts, quantities]
  );
  const totalUnits = useMemo(() =>
    Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0),
    [quantities]
  );

  const hasAnyQty = standardProducts.some((item) => (quantities[item.id] || 0) > 0);

  const handleSubmit = async () => {
    if (!hasAnyQty) return;
    if (submittingRef.current) return;

    if (!franchiseId) {
      toast.error("Franquia não identificada. Atualize a página.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const toastId = toast.loading("Enviando pedido...");
    let order = null;
    // Caminho antigo (2 chamadas) — só roda se a RPC ainda não existir no banco.
    const gravarPeloCaminhoAntigo = async () => {
      order = await PurchaseOrder.create({
        franchise_id: franchiseId,
        status: "pendente",
        total_amount: grandTotal,
        total_weight_kg: grandWeight,
        notes: notes.trim() || null,
        ordered_at: new Date().toISOString(),
      });

      // Create all items in a single atomic request
      const itemsToCreate = standardProducts
        .filter((item) => (quantities[item.id] || 0) > 0)
        .map((item) => ({
          order_id: order.id,
          inventory_item_id: item.id,
          product_name: item.product_name,
          quantity: quantities[item.id],
          unit_price: parseFloat(item.cost_price),
        }));

      await PurchaseOrderItem.createMany(itemsToCreate);
      return order;
    };
    try {
      const resultado = await enviarPedidoFabrica({
        rpc: (fn, params) => supabase.rpc(fn, params),
        clientId: clientIdRef.current,
        franchiseId,
        itens: montarItensDoPedido(standardProducts, quantities),
        notes: notes.trim() || null,
        totalWeightKg: grandWeight,
        legado: gravarPeloCaminhoAntigo,
      });

      // Notificação por RPC removida (26/09/2026): "Pendências" na home do admin
      // (get_admin_pending_counts) substitui as notificações de pedido/pagamento.
      clearDraft();
      if (modeloAplicadoRef.current) {
        try { window.clarity?.('event', 'pedido_modelo_usado'); } catch { /* telemetria não pode derrubar o envio */ }
      }
      if (resultado.jaExistia) {
        toast.success("Este pedido já tinha sido enviado. Ele está no histórico.", { id: toastId });
      } else {
        const difere = resultado.totalAmount != null && Math.abs(resultado.totalAmount - grandTotal) > 0.009;
        toast.success(
          difere ? `Pedido enviado! Total pela tabela da fábrica: ${formatBRLShared(resultado.totalAmount)}` : "Pedido enviado com sucesso!",
          { id: toastId }
        );
      }
      // NÃO resetar submittingRef — componente vai desmontar via onSave
      if (onSave) onSave();
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      // Caminho antigo: tenta limpar o cabeçalho sem itens. (A policy de DELETE é só admin,
      // então para a franqueada isso falha — é o defeito que a RPC atômica resolve.)
      if (order?.id) {
        PurchaseOrder.delete(order.id).catch(() => {});
      }
      if (ehEnvioDiferente(error)) {
        setEnvioDiferente(true);
        toast.error(
          "Um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo.",
          { id: toastId }
        );
      } else {
        toast.error(getErrorMessage(error), { id: toastId });
      }
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const hasSuggestions = standardProducts.some(
    (item) => getSuggestion(item) !== null && getSuggestion(item) > 0
  );

  return (
    <div className="space-y-4">
      {/* Pedido modelo da Maxi (1º pedido) */}
      {primeiroPedido && pedidoModeloItens && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-[#fbf6e6] border border-[#ecdca8]">
          <MaterialIcon icon="star" size={20} className="text-brand-gold-ink shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-brand-gold-ink font-plus-jakarta">
              Pedido modelo da Maxi
            </h3>
            <p className="text-xs text-ink-2 mt-0.5">
              Já preenchemos com a sugestão da Maxi para começar com variedade. Mude o que quiser antes de enviar.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={aplicarModelo}
            className="gap-2 border-brand-gold text-brand-gold-ink font-bold rounded-xl hover:bg-brand-gold/10 min-h-[40px] shrink-0"
          >
            <MaterialIcon icon="replay" size={16} />
            Voltar ao modelo
          </Button>
        </div>
      )}

      {uiV2 && origem === "repor" && initialQuantities && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-sm text-ink">
          <MaterialIcon icon="auto_fix_high" size={18} className="text-brand-gold-ink shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Preenchido com o que está acabando. Revise as quantidades antes de enviar.</p>
            <p className="text-xs text-ink-2 mt-0.5">
              A conta já desconta o que está a caminho em pedidos abertos.
            </p>
            {draftMescladoCount > 0 && mostrarAvisoRascunho && (
              <p className="text-xs text-ink-2 mt-1">
                {draftMescladoCount === 1
                  ? "1 produto do seu rascunho também voltou."
                  : `${draftMescladoCount} produtos do seu rascunho também voltaram.`}{" "}
                <button
                  type="button"
                  onClick={() => {
                    usuarioMexeuRef.current = true;
                    const next = {};
                    standardProducts.forEach((i) => { next[i.id] = initialQuantities[i.id] || 0; });
                    setQuantities(next);
                    setMostrarAvisoRascunho(false);
                  }}
                  className="font-medium underline min-h-[32px]"
                >
                  Tirar do pedido
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Draft restored indicator */}
      {draft.current && !initialQuantities && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-sm text-brand-gold-ink">
          <MaterialIcon icon="history" size={18} />
          <span>Rascunho restaurado.</span>
          <button
            onClick={() => {
              clearDraft();
              const reset = {};
              standardProducts.forEach(i => { reset[i.id] = 0; });
              setQuantities(reset);
              setNotes("");
              draft.current = null;
              clientIdRef.current = novoIdDoEnvio();
            }}
            className="ml-auto text-xs font-medium underline"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Header with suggestion button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-2">
          Selecione as quantidades dos produtos que deseja encomendar.
        </p>
        {sugestaoIndisponivel && (
          <div role="status" className="flex flex-col items-start sm:items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-2 border-brand-gold text-brand-gold-ink rounded-xl"
            >
              <MaterialIcon icon="auto_fix_high" size={16} />
              Usar sugestão
            </Button>
            <span className="text-xs text-ink-2 max-w-[280px] sm:text-right">
              {abertosStatus === "erro"
                ? "Não conseguimos ver seus pedidos abertos agora. A sugestão fica desligada para não pedir em dobro."
                : "Conferindo o que já está a caminho…"}
            </span>
          </div>
        )}
        {!sugestaoIndisponivel && hasSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseSuggestions}
            className="gap-2 border-brand-gold text-brand-gold-ink rounded-xl hover:bg-brand-gold/10"
          >
            <MaterialIcon icon="auto_fix_high" size={16} />
            Usar sugestão
          </Button>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Card className="bg-white rounded-2xl shadow-sm border border-ink-shadow/5">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-ink-4/30">
                    <TableHead className="text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                      Produto
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                      Custo
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                      Estoque
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                      Sugestão
                    </TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta w-[100px]">
                      QTD
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink/60 font-plus-jakarta">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productGroups.map((group) => (
                    <React.Fragment key={group.label}>
                      <TableRow className="bg-surface border-t border-ink-shadow/10">
                        <TableCell colSpan={6} className="py-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-brand font-plus-jakarta">
                            {group.label}
                          </span>
                        </TableCell>
                      </TableRow>
                      {group.items.map((item) => {
                        const suggestion = getSuggestion(item);
                        const hasSug = suggestion !== null && suggestion > 0;
                        const lineTotal = getLineTotal(item);
                        const qty = quantities[item.id] || 0;

                        return (
                          <TableRow
                            key={item.id}
                            className={
                              hasSug
                                ? "border-l-2 border-l-brand-gold hover:bg-brand-gold/5"
                                : "hover:bg-surface"
                            }
                          >
                            <TableCell className="font-medium text-ink">
                              {item.product_name}
                            </TableCell>
                            <TableCell className="text-right text-sm text-ink-2">
                              {formatBRL(item.cost_price)}
                            </TableCell>
                            <TableCell className="text-center text-sm text-ink-2">
                              {item.quantity ?? 0}
                              {aCaminhoDe(item) > 0 && (
                                <span className="block text-[11px] text-ink-2">
                                  +{aCaminhoDe(item)} a caminho
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {suggestion !== null ? (
                                <Badge
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                    hasSug
                                      ? "bg-brand-gold/10 text-brand-gold-ink"
                                      : "bg-surface-line text-ink-2"
                                  }`}
                                >
                                  {suggestion}
                                </Badge>
                              ) : (
                                <span className="text-sm text-ink-4">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="1"
                                value={qty || ""}
                                onChange={(e) => setQty(item.id, e.target.value)}
                                placeholder="0"
                                className="w-20 mx-auto text-center h-8 bg-surface-line border-none rounded-xl focus:ring-2 focus:ring-brand/20"
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-ink">
                              {qty > 0 ? formatBRL(lineTotal) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: card layout grouped */}
      <div className="md:hidden space-y-4">
        {productGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand font-plus-jakarta px-1">
              {group.label}
            </h3>
            {group.items.map((item) => {
              const suggestion = getSuggestion(item);
              const hasSug = suggestion !== null && suggestion > 0;
              const lineTotal = getLineTotal(item);
              const qty = quantities[item.id] || 0;

              return (
                <Card
                  key={item.id}
                  className={`rounded-2xl shadow-sm border ${
                    hasSug
                      ? "border-brand-gold/40 bg-brand-gold/5"
                      : "border-ink-shadow/5 bg-white"
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-ink truncate">
                      {item.product_name}
                    </h4>
                    <p className={`text-xs text-ink-2 ${uiV2 ? "" : "truncate"}`}>
                      Custo: {formatBRL(item.cost_price)} · Estoque: {item.quantity ?? 0}
                      {uiV2 ? ` ${unidadeDeMedida(item)}` : ""}
                      {aCaminhoDe(item) > 0 ? ` · ${aCaminhoDe(item)} a caminho` : ""}
                    </p>
                  </div>
                  {suggestion !== null && (
                    <Badge
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        hasSug
                          ? "bg-brand-gold/10 text-brand-gold-ink"
                          : "bg-surface-line text-ink-2"
                      }`}
                    >
                      Sug: {suggestion}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                      Quantidade
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={qty || ""}
                      onChange={(e) => setQty(item.id, e.target.value)}
                      placeholder="0"
                      className="h-9 bg-surface-line border-none rounded-xl px-3 focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="text-right">
                    <Label className="text-xs uppercase tracking-widest text-ink-2/70 font-plus-jakarta">
                      Total
                    </Label>
                    <p className="font-medium text-ink text-sm mt-1">
                      {qty > 0 ? formatBRL(lineTotal) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
              );
            })}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-ink">Comentário</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações sobre o pedido..."
          rows={3}
          className="w-full rounded-xl bg-surface-line border-none px-4 py-3 text-sm focus:ring-2 focus:ring-brand/20 focus:outline-none resize-none"
        />
      </div>

      {envioDiferente && (
        <div role="alert" className="p-4 rounded-2xl border border-err/30 bg-err/5 space-y-3">
          <div className="flex items-start gap-2">
            <MaterialIcon icon="warning" size={18} className="text-err shrink-0 mt-0.5" />
            <p className="text-sm text-ink">
              Um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de
              enviar de novo. Seu rascunho continua aqui.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl border-ink-4 text-ink"
            >
              Ver o histórico
            </Button>
            <Button
              type="button"
              onClick={() => {
                // Confirmação explícita: só aqui nasce um envio novo (id novo).
                clientIdRef.current = novoIdDoEnvio();
                saveDraft(quantities, notes);
                setEnvioDiferente(false);
                handleSubmit();
              }}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl bg-brand hover:bg-brand-dark text-white font-bold"
            >
              Enviar como pedido novo
            </Button>
          </div>
        </div>
      )}

      {/* Grand total + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-ink-4/30">
        <div>
          {uiV2 ? (
            <div className="space-y-1 min-w-[240px]">
              <div className="flex items-center justify-between gap-6 text-sm text-ink-2">
                <span>Produtos</span>
                <span className="font-mono-numbers">{formatBRL(grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-6 text-sm text-ink-2">
                <span>Frete estimado</span>
                <span className="font-mono-numbers">{hasAnyQty ? formatBRL(freteEstimado) : "—"}</span>
              </div>
              <div className="flex items-baseline justify-between gap-6 pt-1 border-t border-ink-4/30">
                <span className="text-sm font-medium text-ink">Total estimado</span>
                <span className="text-2xl font-bold text-ink font-plus-jakarta">
                  {hasAnyQty ? formatBRL(grandTotal + freteEstimado) : "—"}
                </span>
              </div>
              <p className="text-xs text-ink-2 max-w-[320px]">
                O frete é estimado (10% do pedido, entre R$ 250 e R$ 350). A fábrica confirma o valor;
                acréscimo a outro pedido ou retirada na fábrica pode sair sem frete.
              </p>
            </div>
          ) : (
            <>
              <span className="text-sm text-ink-2">Total do pedido</span>
              <p className="text-2xl font-bold text-ink font-plus-jakarta">
                {formatBRL(grandTotal)}
              </p>
            </>
          )}
          {totalItems > 0 && (
            <span className="text-xs text-ink-2">
              {totalItems} {totalItems === 1 ? "produto" : "produtos"} · {totalUnits} un.
            </span>
          )}
          {grandWeight > 0 && (
            <p className="text-sm font-bold text-ink mt-1">
              Peso total: {formatWeightKg(grandWeight)}
            </p>
          )}
          {missingWeightCount > 0 && (
            <span className="text-xs text-brand">
              {missingWeightCount} {missingWeightCount === 1 ? "item sem peso cadastrado" : "itens sem peso cadastrado"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-ink-4 text-ink-2 rounded-xl hover:bg-surface"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasAnyQty || isSubmitting}
            className="gap-2 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
          >
            {isSubmitting ? (
              <>
                <MaterialIcon
                  icon="progress_activity"
                  size={16}
                  className="animate-spin"
                />
                Enviando...
              </>
            ) : (
              <>
                <MaterialIcon icon="send" size={16} />
                Enviar Pedido
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
