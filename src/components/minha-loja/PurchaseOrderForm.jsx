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
import { weeklyTurnoverMap, suggestionFor, sugestaoDeCompra, textoVenda, INTERVALO_PADRAO_DIAS } from "@/lib/stockSuggestion";
import { BTN_PRIMARIO, BTN_SECUNDARIO, LINK_ACAO } from "@/components/shared/adminUi";
import { getItemWeightKg, formatWeightKg } from "@/lib/productWeight";
import { getProductWeightMap } from "@/entities/all";
import { formatBRL as formatBRLShared } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { supabase } from "@/api/supabaseClient";
import { estimarFreteFabrica } from "@/lib/freteFabrica";
import { comPrecoDaTabela, reposicaoDoItem, unidadeDeMedida } from "@/lib/reposicao";
import { pedidosNovosDesde } from "@/lib/reposicao";
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
  // S25 (chave): venda média por dia de cada produto (stockSuggestion.ritmoDeVendaMap) e de
  // quanto em quanto tempo a unidade pede. Com os dois, a sugestão é a conta nova (a mesma do
  // Estoque e da Reposição) e o formulário já abre preenchido com ela.
  ritmo = null,
  intervaloDias = INTERVALO_PADRAO_DIAS,
  // S25 P3 (2ª passada): só preenche (sugestão ou modelo) depois de saber se é o 1º pedido.
  primeiroPedidoPronto = true,
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
  // S25 (chave): o rascunho (com o id) é a única memória do envio, como na S14. Com a chave, a
  // sugestão/modelo automáticos também viram rascunho: fechar e reabrir retoma o MESMO id, e a
  // idempotência da RPC cobre o reenvio. "Repetir" é sempre um pedido novo (id novo).
  const clientIdRef = useRef(
    uiV2 && initialQuantities
      ? novoIdDoEnvio()
      : idDoEnvioValido(draft.current?.clientId) ? draft.current.clientId : novoIdDoEnvio()
  );
  const abertoEmRef = useRef(Date.now());

  const [notes, setNotes] = useState(draft.current?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // S25: "Enviar pedido" abre a revisão; só "Confirmar e enviar" grava. Nada de preencher sozinho
  // com a revisão aberta.
  const [revisando, setRevisando] = useState(false);
  const revisandoRef = useRef(false);
  revisandoRef.current = revisando;
  // Pedido que a RPC diz já existir, mas CANCELADO pela Maxi (id deste rascunho reaproveitado).
  const [pedidoCancelado, setPedidoCancelado] = useState(false);
  // Pedido feito por outro aparelho/aba depois que o formulário abriu.
  const [pedidoNovoAviso, setPedidoNovoAviso] = useState(null);
  const ignorarPedidoNovoRef = useRef(false);
  const [conferindoAbertos, setConferindoAbertos] = useState(false);
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

  // S14.7: preços da tabela da fábrica (o que a RPC grava). Envio só depois de carregar (P3: o
  // total mostrado tem de ser o que vai gravar). Banco sem a função (PGRST202) = custo, como antes.
  const [precosTabela, setPrecosTabela] = useState(null);
  const [precosStatus, setPrecosStatus] = useState("loading");
  const [precosTentativa, setPrecosTentativa] = useState(0);
  useEffect(() => {
    if (!franchiseId) return undefined;
    let alive = true;
    setPrecosStatus("loading");
    getPrecosPedidoFabrica(franchiseId)
      .then((m) => { if (alive) { setPrecosTabela(m); setPrecosStatus("ok"); } })
      .catch((e) => { if (alive) setPrecosStatus(e?.code === "PGRST202" ? "ok" : "erro"); });
    return () => { alive = false; };
  }, [franchiseId, precosTentativa]);
  const precosProntos = precosStatus === "ok";

  // Produtos da fábrica = catálogo padrão da rede (created_by_franchisee === false) com custo > 0.
  // Itens extras criados pela própria franquia (created_by_franchisee === true) NÃO podem ser
  // pedidos à fábrica — o controle desses é da unidade. Antes o filtro usava só cost_price > 0,
  // o que deixava itens extras com custo (queijo ralado, salsaretti, molhos próprios) vazarem pro pedido.
  const standardProducts = useMemo(() => {
    return comPrecoDaTabela((inventoryItems || []).filter(
      (item) =>
        item.created_by_franchisee !== true &&
        item.cost_price &&
        parseFloat(item.cost_price) > 0 &&
        // S25 P3: produto oculto (active=false) não entra no pedido nem no preenchimento automático
        (!uiV2 || item.active !== false)
    ), precosTabela);
  }, [inventoryItems, precosTabela, uiV2]);

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
  const aCaminhoDe = (item) => (uiV2 ? parseFloat(emAberto?.[item.id]) || 0 : 0);
  const sugestaoV2De = (item) =>
    sugestaoDeCompra(item, { ritmoPorDia: ritmo?.[item.id] || 0, aCaminho: aCaminhoDe(item), intervaloDias });
  const getSuggestion = (item) => {
    if (!uiV2) return suggestionFor(item, weeklyTurnover);
    if (sugestaoIndisponivel) return null;
    if (ritmo) {
      const s2 = sugestaoV2De(item);
      return s2.semBase ? null : s2.repor;
    }
    const r = reposicaoDoItem(item, weeklyTurnover, emAberto);
    return r.semBase ? null : r.repor;
  };

  // Quantities state: { itemId: qty } — restore from draft > initialQuantities > 0
  const [quantities, setQuantities] = useState(() => {
    const savedQtys = draft.current?.quantities;
    const init = {};
    standardProducts.forEach((item) => {
      if (initialQuantities && initialQuantities[item.id]) {
        init[item.id] = initialQuantities[item.id];
      } else if (uiV2 && initialQuantities) {
        init[item.id] = 0; // S25 P3: Repetir traz só as quantidades do pedido repetido
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
    try {
      if (hasData) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ quantities: qtys, notes: n, clientId: clientIdRef.current, savedAt: Date.now() }));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch { /* storage cheio/privado: segue sem rascunho, o pedido não depende dele */ }
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
    if (revisandoRef.current) return;
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

  // S25 (chave): o formulário já abre com a sugestão. Rascunho, "Repetir último"/"Repor" e o
  // pedido modelo (1º pedido) continuam ganhando, como antes; e se ela já mexeu, não sobrescreve.
  // Espera o "a caminho" carregar (sem ele a conta pediria em dobro).
  const prefillFeitoRef = useRef(false);
  const [preenchidoComSugestao, setPreenchidoComSugestao] = useState(false);
  // Produtos que aparecem em cima ("Sugeridos"): quem tem sugestão ou quantidade. Só ACRESCENTA
  // (zerar um item não faz ele pular para "Outros produtos" embaixo do dedo).
  const [emCima, setEmCima] = useState(() => new Set());
  useEffect(() => {
    if (!uiV2 || !ritmo || prefillFeitoRef.current) return;
    if (!primeiroPedidoPronto || revisandoRef.current) return;
    const draftTemQuantidade = draft.current?.quantities && Object.values(draft.current.quantities).some((v) => v > 0);
    if (initialQuantities || draftTemQuantidade || primeiroPedido || usuarioMexeuRef.current) {
      prefillFeitoRef.current = true;
      return;
    }
    if (sugestaoIndisponivel || standardProducts.length === 0) return;
    prefillFeitoRef.current = true;
    const next = {};
    let algum = false;
    standardProducts.forEach((item) => {
      const sug = getSuggestion(item);
      next[item.id] = sug !== null && sug > 0 ? sug : 0;
      if (next[item.id] > 0) algum = true;
    });
    if (algum) {
      setQuantities(next);
      setPreenchidoComSugestao(true);
    }
    // getSuggestion lê as mesmas props listadas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiV2, ritmo, sugestaoIndisponivel, standardProducts, initialQuantities, primeiroPedido, primeiroPedidoPronto]);
  useEffect(() => {
    if (!uiV2) return;
    setEmCima((prev) => {
      let mudou = false;
      const next = new Set(prev);
      standardProducts.forEach((item) => {
        if (next.has(item.id)) return;
        const sug = getSuggestion(item);
        if ((quantities[item.id] || 0) > 0 || (sug !== null && sug > 0)) { next.add(item.id); mudou = true; }
      });
      return mudou ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiV2, standardProducts, quantities, ritmo, sugestaoIndisponivel, emAberto]);
  const [verOutros, setVerOutros] = useState(false);
  const corpoRef = useRef(null);
  // S25 P3 (2ª passada): antes de gravar, reconsulta os pedidos da unidade. Se entrou pedido
  // DEPOIS que este formulário abriu (outro aparelho/aba), não envia sem ela ver.
  // Validade da confirmação: voltar, fechar, trocar de unidade (remonta) ou desmontar durante a
  // reconsulta invalida o token, e a resposta que chega depois NÃO envia.
  const confirmacaoRef = useRef(0);
  const montadoRef = useRef(true);
  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false; confirmacaoRef.current += 1; }; }, []);
  const confirmarEnvio = async () => {
    if (conferindoAbertos || isSubmitting) return;
    const token = ++confirmacaoRef.current;
    const aindaValida = () => montadoRef.current && token === confirmacaoRef.current && revisandoRef.current;
    if (!ignorarPedidoNovoRef.current) {
      setConferindoAbertos(true);
      try {
        const recentes = await PurchaseOrder.filter(
          { franchise_id: franchiseId, status: ["pendente", "confirmado", "em_rota", "entregue"] },
          "-ordered_at",
          10,
          { columns: "id, status, total_amount, ordered_at", gte: { ordered_at: new Date(abertoEmRef.current - 5 * 60 * 1000).toISOString() } }
        );
        if (!aindaValida()) return;
        const novos = pedidosNovosDesde(recentes, abertoEmRef.current, clientIdRef.current);
        if (novos.length > 0) {
          setPedidoNovoAviso(novos[0]);
          return;
        }
      } catch (err) {
        if (!aindaValida()) return;
        console.error("Erro ao conferir pedidos recentes:", err);
        toast.error("Não deu para conferir seus pedidos agora. Tente de novo.");
        return;
      } finally {
        if (montadoRef.current) setConferindoAbertos(false);
      }
    }
    if (!aindaValida()) return;
    handleSubmit();
  };
  const abrirRevisao = () => {
    setRevisando(true);
    try { corpoRef.current?.scrollTo({ top: 0 }); } catch { /* sem scroll */ }
  };

  const passo = (itemId, delta) => {
    usuarioMexeuRef.current = true;
    setQuantities((prev) => {
      const atual = parseInt(prev[itemId], 10) || 0;
      return { ...prev, [itemId]: Math.max(0, atual + delta) };
    });
  };

  const zerarTudo = () => {
    usuarioMexeuRef.current = true;
    const next = {};
    standardProducts.forEach((i) => { next[i.id] = 0; });
    setQuantities(next);
    setPreenchidoComSugestao(false);
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
    if (!precosProntos) {
      toast.error("Espere carregar os preços da fábrica para enviar.");
      return;
    }

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
    const itensDoEnvio = montarItensDoPedido(standardProducts, quantities);
    try {
      const resultado = await enviarPedidoFabrica({
        rpc: (fn, params) => supabase.rpc(fn, params),
        clientId: clientIdRef.current,
        franchiseId,
        itens: itensDoEnvio,
        notes: notes.trim() || null,
        totalWeightKg: grandWeight,
        legado: gravarPeloCaminhoAntigo,
      });

      // Notificação por RPC removida (26/09/2026): "Pendências" na home do admin
      // (get_admin_pending_counts) substitui as notificações de pedido/pagamento.
      // S25: o id deste rascunho já virou um pedido que a Maxi CANCELOU — não é sucesso.
      if (uiV2 && resultado.jaExistia && resultado.status === "cancelado") {
        toast.error("Esse pedido foi cancelado pela Maxi. Para pedir de novo, toque em Fazer pedido novo.", { id: toastId });
        setPedidoCancelado(true);
        setRevisando(false);
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }
      clearDraft();
      if (modeloAplicadoRef.current) {
        try { window.clarity?.('event', 'pedido_modelo_usado'); } catch { /* telemetria não pode derrubar o envio */ }
      }
      if (resultado.jaExistia) {
        toast.success(
          resultado.totalAmount != null
            ? `Este pedido já tinha sido enviado (total ${formatBRLShared(resultado.totalAmount)}). Ele está no histórico.`
            : "Este pedido já tinha sido enviado. Ele está no histórico.",
          { id: toastId }
        );
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

  if (uiV2) {
    // "Usar a sugestão" só quando alguma quantidade está diferente da sugestão.
    const difereDaSugestao = standardProducts.some((item) => {
      const sug = getSuggestion(item);
      return sug !== null && sug > 0 && (parseInt(quantities[item.id], 10) || 0) !== sug;
    });
    const sugeridos = standardProducts
      .filter((item) => emCima.has(item.id))
      .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), "pt-BR"));
    const outros = standardProducts
      .filter((item) => !emCima.has(item.id))
      .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), "pt-BR"));
    const linhaProduto = (item) => {
      const qty = parseInt(quantities[item.id], 10) || 0;
      const sug = getSuggestion(item);
      const s2 = ritmo ? sugestaoV2De(item) : null;
      const tem = parseFloat(item.quantity) || 0;
      const caminho = aCaminhoDe(item);
      const apoio = [
        s2 ? textoVenda(s2) : null,
        `tem ${tem.toLocaleString("pt-BR", { maximumFractionDigits: 2 }).replace("-", "−")}`,
        caminho > 0 ? `${caminho} a caminho` : null,
      ].filter(Boolean).join(" · ");
      return (
        <li key={item.id} className="flex flex-col gap-2 border-t border-surface-line py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-ink">{item.product_name}</p>
            <p className="mt-0.5 text-sm text-ink-2 tabular-nums">{apoio}</p>
            <p className="text-xs text-ink-3 tabular-nums">
              {formatBRL(item.cost_price)} cada
              {sug !== null && sug > 0 && sug !== qty ? ` · sugestão ${sug}` : ""}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => passo(item.id, -1)}
                disabled={qty <= 0 || isSubmitting}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-line bg-white text-ink hover:bg-surface disabled:opacity-40"
                aria-label={`Diminuir ${item.product_name}`}
              >
                <MaterialIcon icon="remove" size={20} aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={quantities[item.id] === "" ? "" : qty}
                onChange={(e) => setQty(item.id, e.target.value)}
                onFocus={(e) => e.target.select()}
                disabled={isSubmitting}
                aria-label={`Quantidade de ${item.product_name}`}
                className="h-11 w-16 rounded-xl border border-surface-line bg-surface-2 text-center text-base font-bold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => passo(item.id, 1)}
                disabled={isSubmitting}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-line bg-white text-ink hover:bg-surface disabled:opacity-40"
                aria-label={`Aumentar ${item.product_name}`}
              >
                <MaterialIcon icon="add" size={20} aria-hidden="true" />
              </button>
            </div>
            <span className="w-24 text-right text-sm font-semibold tabular-nums text-ink">{qty > 0 ? formatBRL(getLineTotal(item)) : "—"}</span>
          </div>
        </li>
      );
    };

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={corpoRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {pedidoNovoAviso && (
            <div role="alert" className="space-y-3 rounded-2xl border border-warn/40 bg-warn-soft p-4">
              <p className="text-sm text-ink">
                Já tem um pedido enviado há pouco
                {pedidoNovoAviso.total_amount != null ? ` (${formatBRLShared(pedidoNovoAviso.total_amount)}, às ${new Date(pedidoNovoAviso.ordered_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })})` : ""}.
                {" "}Confira no Histórico antes de enviar outro.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={onCancel} className={`${BTN_SECUNDARIO} min-h-11`}>
                  Ver histórico
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ignorarPedidoNovoRef.current = true;
                    setPedidoNovoAviso(null);
                    abrirRevisao();
                  }}
                  className={`${BTN_PRIMARIO} min-h-11`}
                >
                  Enviar mesmo assim
                </button>
              </div>
            </div>
          )}
          {pedidoCancelado && (
            <div role="alert" className="space-y-3 rounded-2xl border border-err/30 bg-err-soft p-4">
              <p className="text-sm text-ink">
                Esse pedido foi cancelado pela Maxi. As quantidades continuam aqui: confira e faça um pedido novo.
              </p>
              <button
                type="button"
                onClick={() => {
                  clientIdRef.current = novoIdDoEnvio();
                  saveDraft(quantities, notes);
                  setPedidoCancelado(false);
                  abrirRevisao();
                }}
                className={`${BTN_PRIMARIO} min-h-11`}
              >
                Fazer pedido novo
              </button>
            </div>
          )}
          {revisando ? (
            <section aria-labelledby="titulo-revisao" className="space-y-3">
              <div>
                <h3 id="titulo-revisao" className="font-plus-jakarta text-base font-bold text-ink">Confira antes de enviar</h3>
                <p className="mt-0.5 text-sm text-ink-2">Veja cada produto e a quantidade. Se algo estiver errado, toque em Voltar e ajustar.</p>
              </div>
              <ul className="rounded-2xl border border-surface-line bg-white px-4">
                {standardProducts
                  .filter((item) => (parseInt(quantities[item.id], 10) || 0) > 0)
                  .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), "pt-BR"))
                  .map((item) => {
                    const q = parseInt(quantities[item.id], 10) || 0;
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3 border-t border-surface-line py-2.5 first:border-t-0">
                        <span className="min-w-0 text-sm text-ink">
                          <b className="font-semibold">{q}×</b> {item.product_name}
                          <span className="block text-xs text-ink-3 tabular-nums">{formatBRL(item.cost_price)} cada</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatBRL(getLineTotal(item))}</span>
                      </li>
                    );
                  })}
              </ul>
              <dl className="space-y-1 rounded-2xl bg-surface-2 p-4 text-sm tabular-nums">
                <div className="flex justify-between gap-3"><dt className="text-ink-2">{totalItems} {totalItems === 1 ? "produto" : "produtos"} · {totalUnits} un.</dt><dd className="text-ink">{grandWeight > 0 ? formatWeightKg(grandWeight) : ""}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-2">Produtos</dt><dd className="text-ink">{formatBRL(grandTotal)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-2">Frete estimado</dt><dd className="text-ink">{formatBRL(freteEstimado)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-surface-line pt-1"><dt className="font-semibold text-ink">Total estimado</dt><dd className="font-plus-jakarta text-lg font-extrabold text-ink">{formatBRL(grandTotal + freteEstimado)}</dd></div>
              </dl>
              {notes.trim() && (
                <p className="text-sm text-ink-2"><b className="text-ink">Comentário:</b> {notes.trim()}</p>
              )}
            </section>
          ) : (
          <>
          {primeiroPedido && pedidoModeloItens && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand-gold-line bg-brand-gold-soft p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-gold-ink">Pedido modelo da Maxi</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  Já preenchemos com a sugestão da Maxi para começar com variedade. Mude o que quiser antes de enviar.
                </p>
              </div>
              <button type="button" onClick={aplicarModelo} className={`${BTN_SECUNDARIO} shrink-0`}>
                <MaterialIcon icon="replay" size={18} aria-hidden="true" />
                Voltar ao modelo
              </button>
            </div>
          )}

          {draft.current && !initialQuantities && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink">
              <MaterialIcon icon="history" size={18} className="text-warn-ink" aria-hidden="true" />
              <span className="flex-1">
                Voltou o pedido que você tinha começado.
              </span>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  zerarTudo();
                  setNotes("");
                  draft.current = null;
                  clientIdRef.current = novoIdDoEnvio();
                }}
                className={LINK_ACAO}
              >
                Começar do zero
              </button>
            </div>
          )}

          {sugestaoIndisponivel ? (
            <div role="status" className="flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink sm:flex-row sm:items-center">
              <span className="flex-1">
                {abertosStatus === "erro"
                  ? "Não conseguimos ver seus pedidos abertos agora. A sugestão fica desligada para não pedir em dobro."
                  : "Conferindo o que já está a caminho…"}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="flex-1 text-sm text-ink-2">
                {preenchidoComSugestao
                  ? "Já preenchemos com a sugestão pelas suas vendas. Ajuste com − e +."
                  : "Escolha as quantidades com − e +, ou digite."}
              </p>
              {difereDaSugestao && (
                <button type="button" onClick={() => { handleUseSuggestions(); setPreenchidoComSugestao(true); }} className={LINK_ACAO}>
                  Usar a sugestão
                </button>
              )}
              {hasAnyQty && (
                <button type="button" onClick={zerarTudo} className={LINK_ACAO}>
                  Zerar tudo
                </button>
              )}
            </div>
          )}

          {sugeridos.length > 0 && (
            <section aria-label="Produtos sugeridos">
              <h3 className="text-sm font-bold text-ink-2">Sugeridos ({sugeridos.length})</h3>
              <ul>{sugeridos.map(linhaProduto)}</ul>
            </section>
          )}

          {outros.length > 0 && (
            <section aria-label="Outros produtos" className="rounded-2xl border border-surface-line">
              <button
                type="button"
                onClick={() => setVerOutros((v) => !v)}
                aria-expanded={verOutros || sugeridos.length === 0}
                className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-bold text-ink-2"
              >
                Outros produtos ({outros.length})
                <MaterialIcon icon={verOutros || sugeridos.length === 0 ? "expand_less" : "expand_more"} size={20} aria-hidden="true" />
              </button>
              {(verOutros || sugeridos.length === 0) && <ul className="px-4 pb-2">{outros.map(linhaProduto)}</ul>}
            </section>
          )}

          <div className="space-y-2">
            <label htmlFor="obs-pedido" className="text-sm font-semibold text-ink">Comentário para a fábrica</label>
            <textarea
              id="obs-pedido"
              value={notes}
              onChange={(e) => { usuarioMexeuRef.current = true; setNotes(e.target.value); }}
              placeholder="Se quiser, escreva algo sobre o pedido"
              rows={2}
              className="w-full resize-none rounded-xl border border-surface-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          </>
          )}

          {envioDiferente && (
            <div role="alert" className="space-y-3 rounded-2xl border border-err/30 bg-err-soft p-4">
              <p className="text-sm text-ink">
                Um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo.
                Seu rascunho continua aqui.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className={`${BTN_SECUNDARIO} min-h-11`}>
                  Ver o histórico
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // S25 P3: pedido novo = id novo e REVISÃO do conteúdo atual; só "Confirmar e enviar" grava.
                    clientIdRef.current = novoIdDoEnvio();
                    saveDraft(quantities, notes);
                    setEnvioDiferente(false);
                    abrirRevisao();
                  }}
                  disabled={isSubmitting}
                  className={`${BTN_PRIMARIO} min-h-11`}
                >
                  Enviar como pedido novo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo: sempre à vista */}
        <div className="shrink-0 border-t border-surface-line bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <p className="min-w-0 text-sm text-ink-2 tabular-nums">
              {totalItems > 0
                ? `${totalItems} ${totalItems === 1 ? "produto" : "produtos"} · ${totalUnits} un.${grandWeight > 0 ? ` · ${formatWeightKg(grandWeight)}` : ""}`
                : "Nenhum produto ainda"}
              <br />
              <span className="text-xs text-ink-3">
                Produtos {formatBRL(grandTotal)} + frete estimado {hasAnyQty ? formatBRL(freteEstimado) : "—"}
                {missingWeightCount > 0 ? ` · ${missingWeightCount} sem peso cadastrado` : ""}
              </span>
            </p>
            <p className="shrink-0 text-right">
              <span className="block text-xs text-ink-3">Total estimado</span>
              <span className="font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">
                {hasAnyQty ? formatBRL(grandTotal + freteEstimado) : "—"}
              </span>
            </p>
          </div>
          <div role="status" aria-live="polite" className={precosStatus === "ok" ? "sr-only" : "mt-1 text-sm"}>
            {precosStatus === "loading" && <span className="text-ink-3">Carregando preços…</span>}
            {precosStatus === "erro" && (
              <button type="button" onClick={() => setPrecosTentativa((n) => n + 1)} className="min-h-11 text-err underline">
                Não carreguei os preços. Tentar de novo
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            {revisando ? (
              <button
                type="button"
                onClick={() => { confirmacaoRef.current += 1; setRevisando(false); }}
                disabled={isSubmitting || conferindoAbertos}
                className={`${BTN_SECUNDARIO} min-h-11`}
              >
                Voltar e ajustar
              </button>
            ) : (
              <button type="button" onClick={onCancel} disabled={isSubmitting} className={`${BTN_SECUNDARIO} min-h-11`}>
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={revisando ? confirmarEnvio : abrirRevisao}
              disabled={!hasAnyQty || isSubmitting || !precosProntos || conferindoAbertos || !!pedidoNovoAviso || pedidoCancelado}
              className={`${BTN_PRIMARIO} min-h-11 flex-1`}
            >
              {isSubmitting ? (
                <>
                  <MaterialIcon icon="progress_activity" size={18} className="animate-spin" aria-hidden="true" />
                  Enviando…
                </>
              ) : revisando ? (
                <>
                  <MaterialIcon icon="send" size={18} aria-hidden="true" />
                  Confirmar e enviar
                </>
              ) : (
                <>
                  <MaterialIcon icon="send" size={18} aria-hidden="true" />
                  Enviar pedido
                </>
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            O frete é estimado (10% do pedido, entre R$ 250 e R$ 350). A fábrica confirma o valor.
          </p>
        </div>
      </div>
    );
  }

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div role="status" aria-live="polite" className={precosStatus === "ok" ? "sr-only" : "w-full sm:w-auto text-sm"}>
            {precosStatus === "loading" && <span className="text-ink-3">Carregando preços…</span>}
            {precosStatus === "erro" && (
              <button
                type="button"
                onClick={() => setPrecosTentativa((n) => n + 1)}
                className="text-err underline min-h-[44px] px-2 touch-manipulation"
              >
                Não carreguei os preços. Tentar de novo
              </button>
            )}
          </div>
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
            disabled={!hasAnyQty || isSubmitting || !precosProntos}
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
