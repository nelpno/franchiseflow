// Pedidos à fábrica (admin) — Fase 3 do redesenho (~/.claude/plans/admin-redesign-2026-09-26.md).
// 3 seções por status (Para confirmar / Para separar e entregar / Entregues), sem "Em rota"
// (decisão Nelson 26/09: 0 pedidos nesse status).
//
// Fluxo em lote (26/09, pedido do Nelson: "o que for mais prático e fácil"): a rotina
// acontece NA LISTA, sem abrir pedido por pedido. Todos vêm marcados; o frete se digita na
// própria linha (Enter pula para o próximo, salva sozinho) e já vem com a sugestão da regra
// em "Para confirmar"; UMA ação por seção resolve tudo: "Confirmar N e gerar fichas" e
// "Marcar N como entregues". O detalhe ("Ver itens →") fica para exceção: mudar quantidade,
// previsão de entrega, cancelar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PurchaseOrder, PurchaseOrderItem, FranchiseConfiguration, getProductWeightMap } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { avisarEntregaPedidos } from "@/api/functions";
import { montarAvisoEntrega } from "@/lib/mensagemFranqueado";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { resolveDeliveryAddress } from "@/lib/addressUtils";
import { formatBRLInteger } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { listarFranquias } from "@/lib/franchisesCache";
import { nomeCurto, linkFicha, mensalidadeVencida } from "@/lib/networkOverview";
import { useAdminNetworkOverview, invalidarAdmin } from "@/hooks/useAdminNetworkOverview";
import PageHeader, { BuscaCabecalho } from "@/components/shared/PageHeader";
import { PAGINA } from "@/components/shared/adminUi";
import MaisAcoesMenu from "@/components/shared/MaisAcoesMenu";
import ErrorState from "@/components/shared/ErrorState";
import NovoProdutoDialog from "@/components/pedidos/NovoProdutoDialog";
import OrderDetailDialog from "@/components/pedidos/OrderDetailDialog";
import SecaoLote from "@/components/pedidos/SecaoLote";
import EntreguesSection from "@/components/pedidos/EntreguesSection";
import AguardandoConferenciaSection from "@/components/pedidos/AguardandoConferenciaSection";
import { aguardaConferencia } from "@/lib/conferenciaEntrega";
import {
  filtrarPorTermo,
  ordenarPorEsperaAsc,
  COLUNAS_PEDIDO,
  parseFrete,
  freteSalvo,
  freteNaConfirmacao,
  pedidoAbertoMaisAntigoPorUnidade,
  ehAcrescimo,
  ultimoFretePorUnidade,
  pedidosLabel,
  resumoLote,
  dataBRT,
  meioDiaBRT,
} from "@/components/pedidos/pedidosHelpers";

const SECOES_VALIDAS = new Set(["confirmar", "entregar", "entregues"]);

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Sobe a cada recarga — a seção Entregues usa como gatilho pra rebuscar o mês aberto.
  const [versao, setVersao] = useState(0);

  // Detalhe aberto: guarda o id e uma cópia só de reserva (pedido de Entregues não está em
  // a lista de pedidos). O diálogo recebe o pedido VIVO da lista, com o frete que acabou de ser salvo.
  const [detalhe, setDetalhe] = useState(null); // { id, copia }
  const [novoProdutoOpen, setNovoProdutoOpen] = useState(false);
  // Ação em lote em andamento: "confirmar" | "entregar" | "fichas" | null
  const [loteOcupado, setLoteOcupado] = useState(null);
  // Confirmações de ações irreversíveis em lote (lista de pedidos marcados)
  const [confirmarEntrega, setConfirmarEntrega] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [excluindoLote, setExcluindoLote] = useState(false);
  const [entreguesAberto, setEntreguesAberto] = useState(false);
  const [entreguesAba, setEntreguesAba] = useState("entregue");
  // Marcação de "Para confirmar" — sobe pra cá (em vez de ficar interna ao SecaoLote) pra
  // que "Excluir pedidos marcados" do cabeçalho (Mais ações) opere na MESMA seleção da lista.
  const [desmarcadosConfirmar, setDesmarcadosConfirmar] = useState(() => new Set());
  // Data em BRT ("yyyy-MM-dd") pro campo "Entregue em" do diálogo de entrega em lote.
  const [dataEntrega, setDataEntrega] = useState(() => dataBRT());
  // "Avisar entrega": pedidos marcados + data que vai na mensagem (padrão: amanhã).
  const [avisoEntrega, setAvisoEntrega] = useState(null);
  const [dataAviso, setDataAviso] = useState(() => dataBRT(1));

  // Frete digitado na lista: rascunho por pedido (texto) + estado do salvamento.
  const [rascunhos, setRascunhos] = useState({});
  const [statusFrete, setStatusFrete] = useState({});
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  // Salvamentos do MESMO pedido em fila (sair do campo e tocar "Sem frete" logo em seguida
  // não podem chegar fora de ordem no banco).
  const filaFreteRef = useRef({});
  const timersRef = useRef({});

  const [weightMap, setWeightMap] = useState({});
  useEffect(() => {
    let alive = true;
    getProductWeightMap().then((m) => { if (alive) setWeightMap(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const secaoParam = searchParams.get("secao");
  const secao = SECOES_VALIDAS.has(secaoParam) ? secaoParam : null;
  const unidadeParam = searchParams.get("unidade") || "";

  const refConfirmar = useRef(null);
  const refEntregar = useRef(null);
  const refEntregues = useRef(null);
  // ?secao= só rola/abre na PRIMEIRA carga.
  const jaRolouRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (loading || !secao || jaRolouRef.current) return;
    jaRolouRef.current = true;
    if (secao === "entregues") setEntreguesAberto(true);
    const alvo = { confirmar: refConfirmar, entregar: refEntregar, entregues: refEntregues }[secao];
    const id = setTimeout(() => alvo.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(id);
  }, [loading, secao]);

  // silent=true: recarrega SEM o Skeleton de página inteira (usado após mutações).
  // Só pendente/confirmado, sem teto: o histórico a EntreguesSection busca sozinha.
  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        PurchaseOrder.filter({ status: ["pendente", "confirmado"] }, "-ordered_at", null, { columns: COLUNAS_PEDIDO }),
        listarFranquias(),
        // street_address/cep/neighborhood/city: a ficha do motorista monta o endereço pelos
        // COMPONENTES (resolveDeliveryAddress) — o unit_address é só fallback.
        FranchiseConfiguration.list(null, null, { columns: "franchise_evolution_instance_id, franchise_name, personal_phone_for_summary, unit_address, street_address, cep, neighborhood, city" }),
      ]);
      if (!mountedRef.current) return;

      const ordersData = results[0].status === "fulfilled" ? results[0].value : [];
      const franchisesData = results[1].status === "fulfilled" ? results[1].value : [];
      const configsData = results[2].status === "fulfilled" ? results[2].value : [];

      const failedQueries = results.map((r, i) => (r.status === "rejected" ? ["pedidos", "franquias", "configs"][i] : null)).filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setOrders(ordersData);
      setFranchises(franchisesData);
      setConfigs(configsData);
      setVersao((v) => v + 1);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar pedidos:", error);
      const msg = error?.message || "";
      const userMsg = msg.includes("JWT") || msg.includes("expired") || error?.status === 401
        ? "Sessão expirada. Faça login novamente."
        : msg.includes("Tempo limite")
        ? "Servidor demorou para responder. Tente novamente."
        : "Não foi possível carregar os pedidos.";
      setLoadError(userMsg);
      toast.error(userMsg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const franchiseMap = useMemo(() => {
    const map = {};
    franchises.forEach((f) => {
      map[f.id] = f;
      if (f.evolution_instance_id) map[f.evolution_instance_id] = f;
    });
    return map;
  }, [franchises]);

  const configMap = useMemo(() => {
    const map = {};
    configs.forEach((c) => { if (c.franchise_evolution_instance_id) map[c.franchise_evolution_instance_id] = c; });
    return map;
  }, [configs]);

  // nomeCurto(f.name): mesma coluna (franchises.name) que Hoje/Unidades/Financeiro/Ficha
  // usam — franchise_configurations.franchise_name é o nome digitado no robô e pode divergir.
  const getFranchiseName = useCallback((franchiseId) => {
    const f = franchiseMap[franchiseId];
    const cfg = configMap[franchiseId] || configMap[f?.evolution_instance_id];
    return nomeCurto(f?.name || cfg?.franchise_name || f?.city || "Franquia");
  }, [franchiseMap, configMap]);

  // Unidades de teste (is_test) ficam fora das 3 seções.
  const testFranchiseIds = useMemo(() => {
    const set = new Set();
    franchises.forEach((f) => {
      if (f.is_test) {
        set.add(f.id);
        if (f.evolution_instance_id) set.add(f.evolution_instance_id);
      }
    });
    return set;
  }, [franchises]);

  // Quem recebe + telefone + endereço da unidade — pra ficha do motorista.
  const getFranchiseContact = useCallback((franchiseId) => {
    const f = franchiseMap[franchiseId];
    const cfg = configMap[franchiseId] || configMap[f?.evolution_instance_id];
    return {
      phone: cfg?.personal_phone_for_summary || "",
      address: resolveDeliveryAddress(f, cfg),
      ownerName: f?.owner_name || "",
    };
  }, [franchiseMap, configMap]);

  const unidadeNome = unidadeParam ? getFranchiseName(unidadeParam) : null;

  const limparUnidade = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("unidade");
    setSearchParams(next, { replace: true });
  };

  const baseOrders = useMemo(() => {
    let result = orders.filter((o) => !testFranchiseIds.has(o.franchise_id));
    if (unidadeParam) result = result.filter((o) => o.franchise_id === unidadeParam);
    result = filtrarPorTermo(result, searchTerm, getFranchiseName);
    return result;
  }, [orders, unidadeParam, searchTerm, getFranchiseName, testFranchiseIds]);

  const paraConfirmar = useMemo(
    () => ordenarPorEsperaAsc(baseOrders.filter((o) => o.status === "pendente")),
    [baseOrders]
  );
  const paraEntregar = useMemo(
    () => ordenarPorEsperaAsc(baseOrders.filter((o) => o.status === "confirmado")),
    [baseOrders]
  );

  // franchise_id -> pedido pendente/confirmado mais antigo da unidade, entre TODOS os
  // pedidos abertos carregados (não só os da busca/filtro), pra "acréscimo" não depender do
  // que está visível na tela.
  const maisAntigoPorUnidade = useMemo(() => pedidoAbertoMaisAntigoPorUnidade(orders), [orders]);

  // Régua única da rede: mensalidade vencida (paywall) por unidade, pra pílula da linha.
  const { overview } = useAdminNetworkOverview();
  const mensalidadeAtrasadaSet = useMemo(() => {
    const set = new Set();
    (overview || []).forEach((row) => { if (mensalidadeVencida(row)) set.add(row.franchise_id); });
    return set;
  }, [overview]);

  const getContato = useCallback(
    (franchiseId) => {
      const cfg = configMap[franchiseId] || configMap[franchiseMap[franchiseId]?.evolution_instance_id];
      const f = franchiseMap[franchiseId];
      return { phone: cfg?.personal_phone_for_summary || "", ownerName: f?.owner_name || "" };
    },
    [configMap, franchiseMap]
  );

  // Último frete pago por cada unidade que está em "Para confirmar" — consulta leve (só os
  // franchise_id em jogo), busca 1x por carregamento da tela.
  const [historicoFrete, setHistoricoFrete] = useState([]);
  useEffect(() => {
    const ids = [...new Set(paraConfirmar.map((o) => o.franchise_id))];
    if (ids.length === 0) { setHistoricoFrete([]); return; }
    let alive = true;
    PurchaseOrder.filter(
      { franchise_id: ids, status: ["entregue", "confirmado"] },
      "-ordered_at",
      null,
      { columns: "id, franchise_id, ordered_at, freight_cost" }
    )
      .then((data) => { if (alive) setHistoricoFrete(data || []); })
      .catch(() => { if (alive) setHistoricoFrete([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);
  const ultimoFretePorUnidadeMap = useMemo(() => ultimoFretePorUnidade(historicoFrete), [historicoFrete]);

  // --- Frete na lista ---

  const definirRascunho = useCallback((id, texto) => {
    setRascunhos((prev) => {
      const next = { ...prev };
      if (texto === undefined) delete next[id]; else next[id] = texto;
      return next;
    });
    setStatusFrete((prev) => {
      if (!prev[id] || prev[id] === "salvando") return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const marcarStatusFrete = useCallback((id, status) => {
    clearTimeout(timersRef.current[id]);
    setStatusFrete((prev) => ({ ...prev, [id]: status }));
    if (status === "salvo") {
      timersRef.current[id] = setTimeout(() => {
        if (!mountedRef.current) return;
        setStatusFrete((prev) => {
          if (prev[id] !== "salvo") return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 2500);
    }
  }, []);

  // Salva só o frete (nada de recarregar a tela): atualiza a linha local e mostra "salvo".
  const salvarFrete = useCallback((order, texto) => {
    const valor = parseFrete(texto);
    if (!Number.isFinite(valor)) {
      marcarStatusFrete(order.id, "erro");
      toast.error(`Frete de ${getFranchiseName(order.franchise_id)} não entendido. Use só números, como 250 ou 250,50.`);
      return;
    }
    const atual = ordersRef.current.find((o) => o.id === order.id);
    if (atual && freteSalvo(atual) === valor) {
      setRascunhos((prev) => {
        if (prev[order.id] !== texto) return prev;
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      return;
    }
    marcarStatusFrete(order.id, "salvando");
    const anterior = filaFreteRef.current[order.id] || Promise.resolve();
    const tarefa = anterior
      .catch(() => {})
      .then(() => PurchaseOrder.update(order.id, { freight_cost: valor }))
      .then(() => {
        if (!mountedRef.current) return;
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, freight_cost: valor } : o)));
        setRascunhos((prev) => {
          if (prev[order.id] !== texto) return prev;
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
        marcarStatusFrete(order.id, "salvo");
      })
      .catch((error) => {
        console.error("Erro ao salvar frete:", error);
        if (!mountedRef.current) return;
        marcarStatusFrete(order.id, "erro");
        toast.error(safeErrorMessage(error, `Não salvou o frete de ${getFranchiseName(order.franchise_id)}.`));
      });
    filaFreteRef.current[order.id] = tarefa;
  }, [getFranchiseName, marcarStatusFrete]);

  // Frete que entra no resumo de cada seção (o que vai para o banco se a ação rodar agora).
  const freteNaSecao1 = useCallback(
    (o) => freteNaConfirmacao(o, rascunhos[o.id], { acrescimo: ehAcrescimo(o, maisAntigoPorUnidade) }),
    [rascunhos, maisAntigoPorUnidade]
  );
  const freteNaSecao2 = useCallback(
    (o) => (rascunhos[o.id] !== undefined ? parseFrete(rascunhos[o.id]) : freteSalvo(o) || 0),
    [rascunhos]
  );

  // Espera os salvamentos de frete em andamento destes pedidos (sem falhar se algum falhou).
  const esperarFretes = (ids) =>
    Promise.allSettled(ids.map((id) => filaFreteRef.current[id]).filter(Boolean));

  const selectedOrder = detalhe ? orders.find((o) => o.id === detalhe.id) || detalhe.copia : null;

  // "Ver itens →": o blur do frete da mesma linha dispara o salvamento logo antes do clique;
  // abre só depois dele, para o detalhe não nascer com o frete antigo.
  const abrirDetalhe = useCallback(async (order) => {
    const pendente = filaFreteRef.current[order.id];
    if (pendente) await pendente.catch(() => {});
    if (!mountedRef.current) return;
    const vivo = ordersRef.current.find((o) => o.id === order.id);
    setDetalhe({ id: order.id, copia: vivo || order });
  }, []);

  const limparRascunhos = (ids) => {
    setRascunhos((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  };

  // --- Mutações em lote ---

  const notifyFranchisee = async (order, newStatus) => {
    const franchiseUUID = franchiseMap[order.franchise_id]?.id;
    if (!franchiseUUID) return;
    const messages = {
      confirmado: { title: "Pedido confirmado", message: "Seu pedido de reposição foi confirmado pela fábrica.", icon: "check_circle", type: "info" },
      entregue: { title: "Pedido entregue", message: "Seu pedido foi entregue — estoque atualizado automaticamente.", icon: "inventory", type: "info" },
    };
    const msg = messages[newStatus];
    if (!msg) return;
    try {
      await supabase.rpc("notify_franchise_users", {
        p_franchise_id: franchiseUUID, p_title: msg.title, p_message: msg.message,
        p_type: msg.type, p_icon: msg.icon, p_link: "/Gestao?tab=reposicao",
      });
    } catch { /* notificação é bônus */ }
  };

  // Roda um update por pedido e separa quem deu certo de quem falhou. `salvos` = linha como
  // o banco gravou (S15: o "entregue" de unidade com o app novo volta como 'em_rota').
  const atualizarVarios = async (lista, patchDe) => {
    const resultados = await Promise.allSettled(lista.map((o) => PurchaseOrder.update(o.id, patchDe(o))));
    const ok = [];
    const falhou = [];
    const salvos = new Map();
    resultados.forEach((r, i) => {
      (r.status === "fulfilled" ? ok : falhou).push(lista[i]);
      if (r.status === "fulfilled" && r.value) salvos.set(lista[i].id, r.value);
    });
    if (falhou.length > 0) {
      console.error("Falhas no lote:", resultados.filter((r) => r.status === "rejected").map((r) => r.reason));
    }
    return { ok, falhou, salvos };
  };

  const nomesDe = (lista) => lista.map((o) => getFranchiseName(o.franchise_id)).join(", ");

  const imprimirLote = async (ordersDoLote, { silencioso = false } = {}) => {
    if (!silencioso) setLoteOcupado("fichas");
    const toastId = toast.loading(`Gerando ${ordersDoLote.length === 1 ? "a ficha" : `${ordersDoLote.length} fichas`} de separação...`);
    try {
      // 1 query pros itens de todos os pedidos do lote (.in por baixo).
      const ids = ordersDoLote.map((o) => o.id);
      const allItems = ids.length > 0 ? await PurchaseOrderItem.filter({ order_id: ids }) : [];
      const itemsByOrder = {};
      allItems.forEach((item) => {
        (itemsByOrder[item.order_id] ||= []).push(item);
      });
      const ordersWithItems = ordersDoLote.map((order) => ({
        order,
        items: itemsByOrder[order.id] || [],
        franchiseName: getFranchiseName(order.franchise_id),
        ...getFranchiseContact(order.franchise_id),
      }));
      const { generateBulkPickingSheet } = await import("@/lib/pickingSheetPdf");
      await generateBulkPickingSheet(ordersWithItems, weightMap);
      toast.success(`${ordersWithItems.length === 1 ? "Ficha gerada" : `${ordersWithItems.length} fichas geradas`}.`, { id: toastId });
    } catch (err) {
      console.error("Erro ao gerar fichas:", err);
      toast.error(safeErrorMessage(err, "Erro ao gerar fichas."), { id: toastId });
    } finally {
      if (!silencioso && mountedRef.current) setLoteOcupado(null);
    }
  };

  // "Confirmar N (e gerar fichas)": grava status + frete (digitado > salvo > sugerido) de
  // uma vez e, se pedido, já baixa as fichas dos que confirmaram.
  const confirmarLote = async (lista, { gerarFichas }) => {
    const comFrete = lista.map((o) => ({ o, frete: freteNaConfirmacao(o, rascunhos[o.id], { acrescimo: ehAcrescimo(o, maisAntigoPorUnidade) }) }));
    const invalidos = comFrete.filter((x) => !Number.isFinite(x.frete));
    if (invalidos.length > 0) {
      toast.error(`Confira o frete de ${nomesDe(invalidos.map((x) => x.o))}: use só números, como 250 ou 250,50.`);
      return;
    }
    const freteDe = new Map(comFrete.map((x) => [x.o.id, x.frete]));
    setLoteOcupado("confirmar");
    try {
      // Um "Sem frete"/salvamento ainda em voo não pode chegar DEPOIS e sobrescrever o lote.
      await esperarFretes(lista.map((o) => o.id));
      const confirmedAt = new Date().toISOString();
      const { ok, falhou } = await atualizarVarios(lista, (o) => ({ status: "confirmado", freight_cost: freteDe.get(o.id), confirmed_at: confirmedAt }));
      if (!mountedRef.current) return;
      ok.forEach((o) => notifyFranchisee(o, "confirmado"));
      limparRascunhos(ok.map((o) => o.id));
      if (ok.length > 0) toast.success(`${ok.length === 1 ? "1 pedido confirmado" : `${ok.length} pedidos confirmados`}.`);
      if (falhou.length > 0) toast.error(`Não confirmou: ${nomesDe(falhou)}. Tente de novo.`);
      if (gerarFichas && ok.length > 0) {
        await imprimirLote(ok.map((o) => ({ ...o, status: "confirmado", freight_cost: freteDe.get(o.id) })), { silencioso: true });
      }
      loadData({ silent: true });
      invalidarAdmin(queryClient);
    } finally {
      if (mountedRef.current) setLoteOcupado(null);
    }
  };

  const entregarLote = async (lista) => {
    // Frete digitado e ainda não salvo vai junto (a despesa de transporte nasce na entrega).
    const invalidos = lista.filter((o) => rascunhos[o.id] !== undefined && !Number.isFinite(parseFrete(rascunhos[o.id])));
    if (invalidos.length > 0) {
      toast.error(`Confira o frete de ${nomesDe(invalidos)} antes de marcar a entrega.`);
      setConfirmarEntrega(null);
      return;
    }
    setLoteOcupado("entregar");
    try {
      await esperarFretes(lista.map((o) => o.id));
      const entregueEm = meioDiaBRT(dataEntrega) || new Date().toISOString();
      const { ok, falhou, salvos } = await atualizarVarios(lista, (o) => ({
        status: "entregue",
        delivered_at: entregueEm,
        ...(rascunhos[o.id] !== undefined ? { freight_cost: parseFrete(rascunhos[o.id]) } : {}),
      }));
      if (!mountedRef.current) return;
      // S15: unidade com o app novo confere antes (o banco já avisou a unidade).
      const aConferir = ok.filter((o) => aguardaConferencia(salvos.get(o.id)));
      const entregues = ok.filter((o) => !aguardaConferencia(salvos.get(o.id)));
      entregues.forEach((o) => notifyFranchisee(o, "entregue"));
      limparRascunhos(ok.map((o) => o.id));
      if (entregues.length > 0) toast.success(`${entregues.length === 1 ? "1 pedido entregue" : `${entregues.length} pedidos entregues`}. Estoque das unidades atualizado.`);
      if (aConferir.length > 0) toast.success(`${aConferir.length === 1 ? "1 pedido espera" : `${aConferir.length} pedidos esperam`} a unidade conferir o que chegou (até 2 dias).`);
      if (falhou.length > 0) toast.error(`Não marcou como entregue: ${nomesDe(falhou)}. Tente de novo.`);
      loadData({ silent: true });
      invalidarAdmin(queryClient);
    } finally {
      if (mountedRef.current) {
        setLoteOcupado(null);
        setConfirmarEntrega(null);
      }
    }
  };

  // "Avisar entrega": uma mensagem por unidade (acréscimo vai junto), com o frete da tela.
  const gruposAviso = useMemo(() => {
    if (!avisoEntrega) return [];
    const porUnidade = new Map();
    avisoEntrega.forEach((o) => {
      if (!porUnidade.has(o.franchise_id)) porUnidade.set(o.franchise_id, []);
      porUnidade.get(o.franchise_id).push(o);
    });
    return [...porUnidade.entries()].map(([franchiseId, pedidos]) => {
      const contato = getContato(franchiseId);
      return {
        franchiseId,
        nome: getFranchiseName(franchiseId),
        temTelefone: !!String(contato.phone || "").replace(/\D/g, ""),
        jaAvisada: pedidos.some((o) => o.delivery_notice_status === "enviado"),
        pedidos,
        texto: montarAvisoEntrega({
          nome: contato.ownerName,
          pedidos: pedidos.map((o) => ({ total: o.total_amount, frete: freteNaSecao2(o) })),
          data: dataAviso,
          hoje: dataBRT(),
        }),
      };
    });
  }, [avisoEntrega, getContato, getFranchiseName, freteNaSecao2, dataAviso]);

  const avisoComTelefone = gruposAviso.filter((g) => g.temTelefone);

  const enviarAvisos = async () => {
    const grupos = avisoComTelefone;
    const lista = grupos.flatMap((g) => g.pedidos);
    const invalidos = lista.filter((o) => rascunhos[o.id] !== undefined && !Number.isFinite(parseFrete(rascunhos[o.id])));
    if (invalidos.length > 0) {
      toast.error(`Confira o frete de ${nomesDe(invalidos)} antes de avisar.`);
      return;
    }
    if (!dataAviso) {
      toast.error("Escolha a data da entrega.");
      return;
    }
    setLoteOcupado("avisar");
    try {
      await esperarFretes(lista.map((o) => o.id));
      // A data avisada vira a "Previsão" que a franqueada já vê no app.
      const { ok, falhou } = await atualizarVarios(lista, (o) => ({
        estimated_delivery: dataAviso,
        delivery_notice_status: "fila",
        delivery_notice_error: null,
        ...(rascunhos[o.id] !== undefined ? { freight_cost: parseFrete(rascunhos[o.id]) } : {}),
      }));
      if (!mountedRef.current) return;
      limparRascunhos(ok.map((o) => o.id));
      const okIds = new Set(ok.map((o) => o.id));
      const avisos = grupos
        .map((g) => ({ franchise_id: g.franchiseId, order_ids: g.pedidos.filter((o) => okIds.has(o.id)).map((o) => o.id), text: g.texto }))
        .filter((a) => a.order_ids.length > 0);
      if (avisos.length > 0) {
        try {
          await avisarEntregaPedidos(avisos);
          const min = Math.max(1, Math.round((avisos.length - 1) * 0.8));
          toast.success(
            avisos.length === 1
              ? "Aviso na fila. Chega em alguns segundos."
              : `${avisos.length} avisos na fila. Saem um por vez, com intervalo, em uns ${min} min.`
          );
        } catch (err) {
          console.error("Erro ao avisar entrega:", err);
          await atualizarVarios(ok, () => ({ delivery_notice_status: "falhou", delivery_notice_error: "Não foi possível falar com o WhatsApp" }));
          toast.error("Não consegui mandar os avisos agora. Tente de novo em instantes.");
        }
      }
      if (falhou.length > 0) toast.error(`Não avisou: ${nomesDe(falhou)}. Tente de novo.`);
      setAvisoEntrega(null);
      loadData({ silent: true });
    } finally {
      if (mountedRef.current) setLoteOcupado(null);
    }
  };

  // Enquanto houver aviso na fila do n8n, recarrega a cada 20 s para a etiqueta mudar sozinha.
  const temAvisoNaFila = orders.some((o) => o.delivery_notice_status === "fila");
  useEffect(() => {
    if (!temAvisoNaFila) return undefined;
    const id = setTimeout(() => loadData({ silent: true }), 20000);
    return () => clearTimeout(id);
  }, [temAvisoNaFila, versao]);

  // Exclusão definitiva (pendentes marcados em "Para confirmar" e cancelados em Entregues).
  // Devolve true/false — a EntreguesSection só limpa a seleção quando deu certo.
  const excluirPedidos = async (orderIds) => {
    setExcluindoLote(true);
    const toastId = toast.loading(`Excluindo ${orderIds.length} pedido${orderIds.length > 1 ? "s" : ""}...`);
    try {
      const { error: itemsErr } = await supabase.from("purchase_order_items").delete().in("order_id", orderIds);
      if (itemsErr) throw itemsErr;
      const { error: ordersErr } = await supabase.from("purchase_orders").delete().in("id", orderIds);
      if (ordersErr) throw ordersErr;
      toast.success(`${orderIds.length} pedido${orderIds.length > 1 ? "s excluídos" : " excluído"}.`, { id: toastId });
      limparRascunhos(orderIds);
      loadData({ silent: true });
      invalidarAdmin(queryClient);
      return true;
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error(safeErrorMessage(error, "Erro ao excluir pedido(s)."), { id: toastId });
      loadData({ silent: true });
      return false;
    } finally {
      if (mountedRef.current) setExcluindoLote(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className={PAGINA}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={PAGINA}>
        <ErrorState texto={loadError} onTentarNovamente={() => loadData()} />
      </div>
    );
  }

  const resumoEntrega = confirmarEntrega ? resumoLote(confirmarEntrega, freteNaSecao2) : null;
  const semFreteNaEntrega = confirmarEntrega ? confirmarEntrega.filter((o) => !(freteNaSecao2(o) > 0)).length : 0;

  const selecionadosParaConfirmar = paraConfirmar.filter((o) => !desmarcadosConfirmar.has(o.id));

  return (
    <div className={PAGINA}>
      <PageHeader
        titulo="Pedidos à fábrica"
        subtitulo={
          <>
            Confira o frete, confirme e as fichas saem na hora. Marcar como entregue soma no estoque da unidade e lança a despesa dela.
            <span className="hidden sm:inline"> Enter pula para o próximo frete.</span>
          </>
        }
        acao={
          <>
            <BuscaCabecalho
              id="busca-pedidos"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar unidade"
              rotulo="Buscar unidade"
              className="sm:w-56"
            />
            <MaisAcoesMenu
              actions={[
                { label: "Novo produto padrão", icon: "add_circle", onClick: () => setNovoProdutoOpen(true) },
                {
                  // Todos vêm marcados por padrão (desmarcadosConfirmar vazio = seleção
                  // inteira) — sem exigir que alguém DESMARQUE pelo menos 1, o item nasce
                  // habilitado ao abrir o menu e o 1º clique apaga TODOS os pendentes visíveis.
                  // Só habilita depois de uma escolha explícita na seção 1.
                  label: desmarcadosConfirmar.size > 0
                    ? `Excluir ${pedidosLabel(selecionadosParaConfirmar.length)} marcados em Para confirmar`
                    : "Excluir pedidos marcados em Para confirmar (desmarque algum na lista para habilitar)",
                  icon: "delete",
                  perigo: true,
                  disabled: selecionadosParaConfirmar.length === 0 || desmarcadosConfirmar.size === 0 || excluindoLote || !!loteOcupado,
                  onClick: () => setConfirmarExclusao(selecionadosParaConfirmar),
                },
              ]}
            />
          </>
        }
      />

      {/* Único lugar que aponta pra cá com ?unidade= é o card "Último pedido à fábrica" da
          Ficha (RoutineGrid) — por isso o link de volta pode assumir a origem (decisão 7). */}
      {unidadeParam && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft px-5 py-3.5">
          <Link to={linkFicha(unidadeParam).to} className="text-sm font-semibold text-brand-dark hover:underline">
            ← Voltar para a ficha de {unidadeNome}
          </Link>
          <button type="button" onClick={limparUnidade} className="min-h-10 text-sm font-semibold text-brand-dark hover:underline">
            Ver pedidos de todas →
          </button>
        </div>
      )}

      <SecaoLote
        ref={refConfirmar}
        numero={1}
        titulo="Para confirmar"
        vazio="Nenhum pedido esperando confirmação."
        orders={paraConfirmar}
        getFranchiseName={getFranchiseName}
        onVerItens={abrirDetalhe}
        sugerirFrete
        rascunhos={rascunhos}
        statusFrete={statusFrete}
        onRascunho={definirRascunho}
        onSalvarFrete={salvarFrete}
        freteDoLote={freteNaSecao1}
        destacarAtraso
        ocupado={!!loteOcupado || excluindoLote}
        maisAntigoPorUnidade={maisAntigoPorUnidade}
        ultimoFretePorUnidade={ultimoFretePorUnidadeMap}
        mensalidadeAtrasadaSet={mensalidadeAtrasadaSet}
        getContato={getContato}
        desmarcadosControlado={desmarcadosConfirmar}
        onDesmarcadosChange={setDesmarcadosConfirmar}
        acaoPrincipal={{
          label: (n) => (n === 1 ? "Confirmar 1 e gerar a ficha" : `Confirmar ${n} e gerar as fichas`),
          icon: "check_circle",
          cor: "bg-brand hover:bg-brand-dark",
          onClick: (sel) => confirmarLote(sel, { gerarFichas: true }),
        }}
        acoesSecundarias={[
          { label: "Só confirmar", icon: "check", onClick: (sel) => confirmarLote(sel, { gerarFichas: false }) },
        ]}
      />

      <SecaoLote
        ref={refEntregar}
        numero={2}
        titulo="Para separar e entregar"
        vazio="Nenhum pedido para separar agora."
        orders={paraEntregar}
        getFranchiseName={getFranchiseName}
        onVerItens={abrirDetalhe}
        sugerirFrete={false}
        rascunhos={rascunhos}
        statusFrete={statusFrete}
        onRascunho={definirRascunho}
        onSalvarFrete={salvarFrete}
        freteDoLote={freteNaSecao2}
        destacarAtraso
        ocupado={!!loteOcupado || excluindoLote}
        mensalidadeAtrasadaSet={mensalidadeAtrasadaSet}
        getContato={getContato}
        acaoPrincipal={{
          label: (n) => (n === 1 ? "Marcar 1 como entregue" : `Marcar ${n} como entregues`),
          icon: "inventory",
          cor: "bg-ok-ink hover:bg-ok-ink/90",
          onClick: (sel) => { setDataEntrega(dataBRT()); setConfirmarEntrega(sel); },
        }}
        acoesSecundarias={[
          { label: "Imprimir fichas", icon: "print", onClick: (sel) => imprimirLote(sel) },
          { label: "Avisar entrega", icon: "send", onClick: (sel) => { setDataAviso(dataBRT(1)); setAvisoEntrega(sel); } },
        ]}
      />

      <AguardandoConferenciaSection
        getFranchiseName={getFranchiseName}
        onVerItens={abrirDetalhe}
        unidadeParam={unidadeParam}
        searchTerm={searchTerm}
        testFranchiseIds={testFranchiseIds}
        versao={versao}
      />

      <EntreguesSection
        ref={refEntregues}
        getFranchiseName={getFranchiseName}
        onVerItens={abrirDetalhe}
        onExcluirLote={excluirPedidos}
        excluindo={excluindoLote}
        aberto={entreguesAberto}
        onAbrirChange={setEntreguesAberto}
        statusAba={entreguesAba}
        onStatusAbaChange={setEntreguesAba}
        unidadeParam={unidadeParam}
        searchTerm={searchTerm}
        testFranchiseIds={testFranchiseIds}
        versao={versao}
      />

      <OrderDetailDialog
        order={selectedOrder}
        onClose={() => setDetalhe(null)}
        onChanged={() => {
          if (selectedOrder) limparRascunhos([selectedOrder.id]);
          loadData({ silent: true });
          invalidarAdmin(queryClient);
        }}
        franchiseName={selectedOrder ? getFranchiseName(selectedOrder.franchise_id) : ""}
        franchiseContact={selectedOrder ? getFranchiseContact(selectedOrder.franchise_id) : {}}
        franchiseUUID={selectedOrder ? franchiseMap[selectedOrder.franchise_id]?.id : null}
        weightMap={weightMap}
      />

      <NovoProdutoDialog open={novoProdutoOpen} onOpenChange={setNovoProdutoOpen} />

      {/* "Marcar N como entregues": irreversível (soma estoque + lança despesas). */}
      <Dialog open={!!confirmarEntrega} onOpenChange={(open) => { if (!open && loteOcupado !== "entregar") setConfirmarEntrega(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="inventory" size={20} className="text-ok-ink" />
              {confirmarEntrega?.length === 1 ? "Marcar como entregue" : `Marcar ${confirmarEntrega?.length || 0} como entregues`}
            </DialogTitle>
          </DialogHeader>
          {resumoEntrega && (
            <div className="space-y-2 text-sm text-ink-2">
              <p>
                {confirmarEntrega.length === 1 ? (
                  <>O estoque de <strong>{getFranchiseName(confirmarEntrega[0].franchise_id)}</strong> recebe os produtos e o pedido entra como despesa no Resultado dela</>
                ) : (
                  <>O estoque de cada unidade recebe os produtos e cada pedido entra como despesa no Resultado dela</>
                )}
                : {formatBRLInteger(resumoEntrega.total)} em produtos + {formatBRLInteger(resumoEntrega.frete)} de frete. Isso não pode ser desfeito.
              </p>
              {semFreteNaEntrega > 0 && (
                <p className="text-ink-3">
                  {semFreteNaEntrega === 1 ? "1 pedido vai sem frete" : `${semFreteNaEntrega} pedidos vão sem frete`} (acréscimo ou retirada). Se não for o caso, volte e digite o valor.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label htmlFor="entregue-em" className="text-xs font-bold uppercase tracking-wide text-ink-3">
                  Entregue em
                </label>
                <input
                  id="entregue-em"
                  type="date"
                  value={dataEntrega}
                  max={dataBRT()}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="h-10 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDataEntrega(dataBRT(-1))}
                  className="min-h-10 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink-2 hover:bg-surface"
                >
                  Ontem
                </button>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmarEntrega(null)} disabled={loteOcupado === "entregar"} className="min-h-10 border-ink-4 text-ink-2 rounded-xl">
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={() => entregarLote(confirmarEntrega)}
              disabled={loteOcupado === "entregar"}
              className="min-h-10 bg-ok-ink hover:bg-ok-ink/90 text-white font-bold rounded-xl gap-1"
            >
              <MaterialIcon
                icon={loteOcupado === "entregar" ? "progress_activity" : "check_circle"}
                size={16}
                className={loteOcupado === "entregar" ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "Avisar entrega": WhatsApp pelo número do Nelson, uma mensagem por unidade. */}
      <Dialog open={!!avisoEntrega} onOpenChange={(open) => { if (!open && loteOcupado !== "avisar") setAvisoEntrega(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="send" size={20} className="text-brand" />
              Avisar entrega
            </DialogTitle>
          </DialogHeader>
          {avisoEntrega && (
            <div className="space-y-3 text-sm text-ink-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="aviso-data" className="text-xs font-bold uppercase tracking-wide text-ink-3">
                  Entrega em
                </label>
                <input
                  id="aviso-data"
                  type="date"
                  value={dataAviso}
                  min={dataBRT()}
                  onChange={(e) => setDataAviso(e.target.value)}
                  className="h-10 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDataAviso(dataBRT(1))}
                  className="min-h-10 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink-2 hover:bg-surface"
                >
                  Amanhã
                </button>
              </div>
              <p>
                {avisoComTelefone.length === 1 ? "1 unidade recebe" : `${avisoComTelefone.length} unidades recebem`} a mensagem no
                WhatsApp, pelo seu número, uma de cada vez, com intervalo de 25 a 70 segundos. A data também aparece como previsão no app delas.
              </p>
              {avisoComTelefone[0] && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-3">Exemplo: {avisoComTelefone[0].nome}</p>
                  <p className="whitespace-pre-line rounded-xl border border-surface-line bg-surface p-3 text-ink">{avisoComTelefone[0].texto}</p>
                </div>
              )}
              {avisoComTelefone.some((g) => g.jaAvisada) && (
                <p className="font-semibold text-ink">
                  Já avisadas antes (recebem de novo): {avisoComTelefone.filter((g) => g.jaAvisada).map((g) => g.nome).join(", ")}.
                </p>
              )}
              {gruposAviso.some((g) => !g.temTelefone) && (
                <p className="font-semibold text-err">
                  Sem telefone cadastrado (não recebem): {gruposAviso.filter((g) => !g.temTelefone).map((g) => g.nome).join(", ")}.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAvisoEntrega(null)} disabled={loteOcupado === "avisar"} className="min-h-10 border-ink-4 text-ink-2 rounded-xl">
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={enviarAvisos}
              disabled={loteOcupado === "avisar" || avisoComTelefone.length === 0}
              className="min-h-10 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl gap-1"
            >
              <MaterialIcon
                icon={loteOcupado === "avisar" ? "progress_activity" : "send"}
                size={16}
                className={loteOcupado === "avisar" ? "animate-spin" : ""}
                aria-hidden="true"
              />
              {avisoComTelefone.length === 1 ? "Enviar 1 aviso" : `Enviar ${avisoComTelefone.length} avisos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir pendentes marcados: apaga de vez (a franqueada perde o pedido). */}
      <Dialog open={!!confirmarExclusao} onOpenChange={(open) => { if (!open && !excluindoLote) setConfirmarExclusao(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="delete" size={20} className="text-err" />
              Excluir {confirmarExclusao ? pedidosLabel(confirmarExclusao.length) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-2">
            {confirmarExclusao ? nomesDe(confirmarExclusao) : ""}: o pedido some da tela da unidade e não pode ser recuperado.
            Para só recusar, abra o pedido em “Ver itens” e use “Cancelar pedido”.
          </p>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmarExclusao(null)} disabled={excluindoLote} className="min-h-10 border-ink-4 text-ink-2 rounded-xl">
              Voltar
            </Button>
            <Button
              size="sm"
              disabled={excluindoLote}
              onClick={async () => {
                await excluirPedidos(confirmarExclusao.map((o) => o.id));
                if (mountedRef.current) setConfirmarExclusao(null);
              }}
              className="min-h-10 bg-err hover:bg-brand-dark text-white font-bold rounded-xl gap-1"
            >
              <MaterialIcon icon={excluindoLote ? "progress_activity" : "delete"} size={16} className={excluindoLote ? "animate-spin" : ""} aria-hidden="true" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
