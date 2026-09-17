import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  OnboardingChecklist,
  FranchiseConfiguration,
  setOnboardingStatus,
  setOnboardingItem,
  getOnboardingFacts,
} from "@/entities/all";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import FiscalDataGate from "@/components/onboarding/FiscalDataGate";
import NextActionCard from "@/components/onboarding/NextActionCard";
import JourneyStep from "@/components/onboarding/JourneyStep";
import MaxiDoesList from "@/components/onboarding/MaxiDoesList";
import { montarJornada } from "@/lib/onboardingJourney";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { useAuth } from "@/lib/AuthContext";
import FranchisePicker from "@/components/shared/FranchisePicker";
import { listarFranquias, invalidarFranquias } from "@/lib/franchisesCache";
import { tarefasFeitas, mensagemPronto, lerFeitas, gravarFeitas } from "@/lib/primeirosPassosAviso";
import { createPageUrl } from "@/utils";

// "Primeiros passos" — trilha de 5 passos (substituiu os 9 blocos do onboarding
// antigo, 16/09/2026). A lógica de estado vive em src/lib/onboardingJourney.js
// (montarJornada); este arquivo só carrega os dados, grava as ações da franqueada/
// admin e desenha a UI. Ver CLAUDE.md raiz do dashboard, "Primeiros passos".

function formatarData(iso) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM", { locale: ptBR });
  } catch {
    return "";
  }
}

function contarFeitas(jornada) {
  return jornada.passos.reduce((soma, p) => soma + p.feitas, 0);
}

// "approved" só muda pela RPC set_onboarding_status; aqui é só in_progress <-> pending_approval.
function proximoStatus(statusAtual, completo) {
  if (statusAtual === "approved") return statusAtual;
  if (completo && statusAtual === "in_progress") return "pending_approval";
  if (!completo && statusAtual === "pending_approval") return "in_progress";
  return statusAtual;
}

function StatusBadge({ status }) {
  if (status === "approved") return <Badge className="bg-ok-soft text-ok-ink border border-ok/30">Aprovado</Badge>;
  if (status === "pending_approval") return <Badge className="bg-brand-gold-soft text-brand-gold-ink border border-brand-gold-line">Aguardando</Badge>;
  return <Badge className="bg-brand-soft text-brand border border-brand/20">Em andamento</Badge>;
}

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedFranchise: ctxFranchise } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [items, setItems] = useState({});
  const [facts, setFacts] = useState(null);
  // false = a leitura dos fatos falhou: a tela mostra, mas não grava progresso (senão regredia o %).
  const [factsOk, setFactsOk] = useState(false);
  // Confirmações ainda sem resposta do banco: a sincronização automática espera por elas.
  const [salvandoItens, setSalvandoItens] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [allChecklists, setAllChecklists] = useState([]);
  const [configsByEvoId, setConfigsByEvoId] = useState({});
  const [openStepId, setOpenStepId] = useState(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStatusAction, setConfirmingStatusAction] = useState(false);
  const mountedRef = useRef(true);
  const stepRefs = useRef({});
  const syncedPercentRef = useRef(new Set());
  const syncedToastRef = useRef(new Set());
  // Sobe a cada troca de unidade: resposta de uma leitura/gravação anterior é descartada.
  const loadSeqRef = useRef(0);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const config = selectedFranchise ? configsByEvoId[selectedFranchise.evolution_instance_id] : null;

  const jornada = useMemo(
    () => montarJornada({ franchise: selectedFranchise, config, facts, items }),
    [selectedFranchise, config, facts, items]
  );

  // Mantém a lista do admin igual ao que acabou de ser gravado (senão, ao voltar para a
  // lista e reabrir a unidade, a tela mostrava o estado antigo).
  const atualizarCache = (row) => {
    if (!row?.franchise_id) return;
    setAllChecklists((lista) => {
      const existe = lista.some((c) => c.franchise_id === row.franchise_id);
      return existe
        ? lista.map((c) => (c.franchise_id === row.franchise_id ? row : c))
        : [...lista, row];
    });
  };

  // Só troca se a tela ainda mostra a mesma linha (resposta atrasada de outra unidade não entra).
  const aplicarLinha = (row) => {
    if (!row?.id) return;
    setChecklist((atual) => (atual && atual.id === row.id ? row : atual));
  };

  const loadFranchiseChecklist = async (franchise) => {
    const seq = ++loadSeqRef.current;
    // Sempre do banco: a lista em memória pode estar velha (outra pessoa marcou algo).
    const [existingResult, factsResult] = await Promise.allSettled([
      OnboardingChecklist.filter({ franchise_id: franchise.evolution_instance_id }),
      getOnboardingFacts(franchise.evolution_instance_id),
    ]);
    const existing = existingResult.status === "fulfilled" ? existingResult.value : [];
    // A RPC só devolve null sem acesso; para a própria unidade, null = a leitura falhou.
    const factsData = factsResult.status === "fulfilled" ? factsResult.value : null;
    if (!mountedRef.current || seq !== loadSeqRef.current) return;
    setFacts(factsData);
    setFactsOk(factsData !== null);
    if (factsData === null) {
      toast.error("Não deu para conferir todo o seu progresso agora. Abra esta tela de novo em instantes.");
    }
    if (existing.length > 0) {
      setChecklist(existing[0]);
      setItems(existing[0].items || {});
      setAdminNotesDraft(existing[0].admin_notes || "");
    } else {
      setChecklist(null);
      setItems({});
      setAdminNotesDraft("");
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [userResult, franchisesResult, configsResult] = await Promise.allSettled([
        User.me(),
        listarFranquias(),
        FranchiseConfiguration.list("franchise_evolution_instance_id", 200),
      ]);
      const user = userResult.status === "fulfilled" ? userResult.value : null;
      const allFranchises = franchisesResult.status === "fulfilled" ? franchisesResult.value : [];
      const configs = configsResult.status === "fulfilled" ? configsResult.value : [];
      if (!user) throw new Error("Não foi possível carregar usuário");
      if (!mountedRef.current) return;
      setCurrentUser(user);

      const configMap = {};
      const fullConfigMap = {};
      configs.forEach((c) => {
        if (c.franchise_name) configMap[c.franchise_evolution_instance_id] = c.franchise_name;
        fullConfigMap[c.franchise_evolution_instance_id] = c;
      });
      setConfigsByEvoId(fullConfigMap);
      const enriched = allFranchises.map((f) => ({
        ...f,
        franchise_name: configMap[f.evolution_instance_id] || null,
      }));

      if (user.role === "admin" || user.role === "manager") {
        setFranchises(enriched);
        const allOb = await OnboardingChecklist.list();
        if (!mountedRef.current) return;
        setAllChecklists(allOb);

        const urlFranchiseId = searchParams.get("franchise");
        if (urlFranchiseId) {
          const match = enriched.find((f) => f.evolution_instance_id === urlFranchiseId);
          if (match) {
            setSelectedFranchise(match);
            await loadFranchiseChecklist(match);
          }
        }
      } else {
        const ids = user.managed_franchise_ids || [];
        const myFranchises = enriched.filter((f) => ids.includes(f.evolution_instance_id) || ids.includes(f.id));
        setFranchises(myFranchises);
        // Só resolve sozinho quando há UMA unidade. Com 2+, quem manda é o seletor
        // do topo (efeito abaixo) — "a primeira da lista" abria a unidade errada
        // (bug 05/08/2026).
        if (myFranchises.length === 1) {
          setSelectedFranchise(myFranchises[0]);
          await loadFranchiseChecklist(myFranchises[0]);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar primeiros passos:", error);
      if (mountedRef.current) setLoadError("Erro ao carregar dados.");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Franqueado com 2+ unidades: a trilha segue o seletor do topo.
  useEffect(() => {
    if (!currentUser || currentUser.role === "admin" || currentUser.role === "manager") return;
    if (!ctxFranchise || franchises.length === 0) return;
    const match = franchises.find((f) => f.evolution_instance_id === ctxFranchise.evolution_instance_id);
    if (!match) return;
    if (match.evolution_instance_id !== selectedFranchise?.evolution_instance_id) {
      handleSelectFranchise(match.evolution_instance_id);
    } else if (match !== selectedFranchise) {
      // Mesma unidade, lista recarregada (ex.: dados fiscais salvos): usa o cadastro novo.
      setSelectedFranchise(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxFranchise?.evolution_instance_id, franchises, currentUser]);

  // Passo aberto por padrão = o atual (1º incompleto); ao completar tudo, o último.
  // Só reavalia quando TROCA de checklist/unidade — "toque abre/fecha" manda depois.
  useEffect(() => {
    if (!checklist) {
      setOpenStepId(null);
      return;
    }
    const atual = jornada.passos.find((p) => !p.pronto);
    setOpenStepId(atual ? atual.id : jornada.passos[jornada.passos.length - 1]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist?.id]);

  // Se os fatos automáticos já fecharam tudo (ou avançaram) mas o percentual salvo
  // ficou pra trás, sincroniza UMA vez — é isso que dispara o aviso pra equipe Maxi
  // quando a franqueada nem tocou em nada nesta visita.
  // Vale para qualquer mudança dos valores calculados (dados fiscais salvos agora, trilha
  // reaberta já completa...). Nunca reenvia `items` — só números e status. A assinatura
  // evita repetir a mesma gravação (inclusive se ela falhar).
  useEffect(() => {
    if (!checklist || isAdmin || !factsOk || salvandoItens > 0) return;
    // Na troca de unidade, jornada (unidade nova) e checklist (antiga) ficam misturados por um instante.
    if (checklist.franchise_id !== selectedFranchise?.evolution_instance_id) return;
    const completedCount = contarFeitas(jornada);
    const novoStatus = proximoStatus(checklist.status, jornada.completo);
    const precisaSincronizar =
      checklist.completion_percentage !== jornada.porcentagem
      || checklist.completed_count !== completedCount
      || novoStatus !== checklist.status;
    if (!precisaSincronizar) return;
    const assinatura = `${checklist.id}|${jornada.porcentagem}|${completedCount}|${novoStatus}`;
    if (syncedPercentRef.current.has(assinatura)) return;
    syncedPercentRef.current.add(assinatura);
    const patch = { completed_count: completedCount, completion_percentage: jornada.porcentagem };
    if (novoStatus !== checklist.status) patch.status = novoStatus;
    OnboardingChecklist.update(checklist.id, patch)
      .then((atualizado) => {
        if (!mountedRef.current || !atualizado) return;
        // Gravou o que pediu: libera a assinatura para uma volta legítima (marca, desmarca, marca).
        if (
          atualizado.completion_percentage === patch.completion_percentage
          && atualizado.completed_count === patch.completed_count
          && atualizado.status === novoStatus
        ) {
          syncedPercentRef.current.delete(assinatura);
        }
        aplicarLinha(atualizado);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist?.id, checklist?.status, checklist?.completion_percentage, checklist?.completed_count, jornada.porcentagem, jornada.completo, factsOk, salvandoItens, selectedFranchise?.evolution_instance_id]);

  // "Pronto: X. Próximo: Y" — compara com a última visita (sessionStorage) pra
  // avisar quando algo terminou sozinho enquanto ela estava em outra tela.
  // Avisa só na chegada; enquanto ela está aqui, a lista guardada acompanha o que ela mesma
  // fez (senão a faixa das outras telas avisaria de novo algo que ela acabou de ver).
  const feitasChave = tarefasFeitas(jornada).join("|");
  useEffect(() => {
    if (!checklist || isAdmin || !selectedFranchise || !factsOk) return;
    const evoId = selectedFranchise.evolution_instance_id;
    if (checklist.franchise_id !== evoId) return;
    if (!syncedToastRef.current.has(checklist.id)) {
      syncedToastRef.current.add(checklist.id);
      const mensagem = mensagemPronto(jornada, lerFeitas(evoId));
      if (mensagem) toast.success(mensagem);
    }
    gravarFeitas(evoId, tarefasFeitas(jornada));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist?.id, factsOk, feitasChave]);

  const handleSelectFranchise = async (franchiseId) => {
    const franchise = franchises.find((f) => f.evolution_instance_id === franchiseId);
    if (!franchise) return;
    setConfirmingDelete(false);
    setConfirmingStatusAction(false);
    setSelectedFranchise(franchise);
    setChecklist(null);
    setItems({});
    setFacts(null);
    setFactsOk(false);
    setIsLoading(true);
    const carregando = loadFranchiseChecklist(franchise);
    const seq = loadSeqRef.current;
    try {
      await carregando;
    } catch (error) {
      console.error("Erro ao carregar checklist:", error);
      if (seq === loadSeqRef.current) toast.error(safeErrorMessage(error, "Erro ao carregar primeiros passos."));
    } finally {
      // Troca rápida (A -> B): quem desliga o carregando é a leitura de B.
      if (mountedRef.current && seq === loadSeqRef.current) setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    loadSeqRef.current += 1;
    setSelectedFranchise(null);
    setChecklist(null);
    setItems({});
    setFacts(null);
    setFactsOk(false);
    setConfirmingDelete(false);
    setConfirmingStatusAction(false);
  };

  const handleFiscalReady = () => {
    // A lista de franquias fica 60 s em cache: sem isto, o passo 1 seguia "faltando".
    invalidarFranquias();
    loadData();
  };

  const handleStartOnboarding = async () => {
    if (!selectedFranchise) {
      toast.error("Selecione uma franquia primeiro.");
      return;
    }
    try {
      const factsData = await getOnboardingFacts(selectedFranchise.evolution_instance_id).catch(() => null);
      const cfg = configsByEvoId[selectedFranchise.evolution_instance_id];
      const jornadaInicial = montarJornada({ franchise: selectedFranchise, config: cfg, facts: factsData, items: {} });
      const created = await OnboardingChecklist.create({
        franchise_id: selectedFranchise.evolution_instance_id,
        status: "in_progress",
        items: {},
        completed_count: contarFeitas(jornadaInicial),
        completion_percentage: jornadaInicial.porcentagem,
      });
      setChecklist(created);
      setItems({});
      setFacts(factsData);
      setFactsOk(factsData !== null);
      setAdminNotesDraft("");
      toast.success("Primeiros passos iniciados.");
      window.dispatchEvent(new Event("onboarding-started"));
    } catch (error) {
      console.error("Erro ao iniciar primeiros passos:", error);
      toast.error(safeErrorMessage(error, "Erro ao iniciar. Verifique as permissões."));
    }
  };

  const handleDeleteOnboarding = async () => {
    if (!checklist) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const seq = loadSeqRef.current;
    try {
      await OnboardingChecklist.delete(checklist.id);
      setAllChecklists((prev) => prev.filter((c) => c.id !== checklist.id));
      // Já abriu outra unidade enquanto excluía: não mexe na tela dela.
      if (seq !== loadSeqRef.current) return;
      loadSeqRef.current += 1;
      setChecklist(null);
      setItems({});
      setSelectedFranchise(null);
      setFacts(null);
      setFactsOk(false);
    } catch (error) {
      toast.error(safeErrorMessage(error, "Não foi possível excluir."));
    } finally {
      setConfirmingDelete(false);
    }
  };

  const handleSetOnboardingStatus = async (newStatus) => {
    if (!checklist) return;
    if (!confirmingStatusAction) {
      setConfirmingStatusAction(true);
      return;
    }
    setConfirmingStatusAction(false);
    try {
      const updated = await setOnboardingStatus(checklist.franchise_id, newStatus);
      if (updated) {
        aplicarLinha(updated);
        atualizarCache(updated);
      }
      toast.success(
        newStatus === "approved"
          ? "Primeiros passos concluídos. Some da tela da franqueada."
          : "Primeiros passos reabertos."
      );
      window.dispatchEvent(new CustomEvent("onboarding-status-changed", {
        detail: { franchiseId: checklist.franchise_id, status: newStatus },
      }));
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error(safeErrorMessage(error, "Não foi possível atualizar."));
    }
  };

  const handleToggleConfirmacao = async (passoId, tarefaId) => {
    if (!checklist || isAdmin) return;
    const valorAnterior = items[tarefaId];
    const isFeito = Boolean(valorAnterior);
    // Mexe só nesta chave (ida e volta): outro toque ainda salvando não é desfeito junto.
    const trocar = (mapa, volta) => {
      const novo = { ...(mapa || {}) };
      if (isFeito === volta) novo[tarefaId] = volta ? valorAnterior : new Date().toISOString();
      else delete novo[tarefaId];
      return novo;
    };

    setItems((atual) => trocar(atual, false));
    setChecklist((prev) => prev && { ...prev, items: trocar(prev.items, false) });
    const seq = loadSeqRef.current;
    setSalvandoItens((n) => n + 1);

    let linha = null;
    try {
      // Só a chave tocada vai para o banco. Números e status: a sincronização automática
      // grava depois, a partir do que o banco devolveu (nunca de um clique que pode falhar).
      linha = await setOnboardingItem(checklist.franchise_id, tarefaId, !isFeito);
    } catch (error) {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setItems((atual) => trocar(atual, true));
        setChecklist((prev) => prev && { ...prev, items: trocar(prev.items, true) });
        toast.error(safeErrorMessage(error, "Não foi possível salvar. Tente novamente."));
      }
      return;
    } finally {
      if (mountedRef.current) setSalvandoItens((n) => n - 1);
    }
    if (!mountedRef.current || !linha || seq !== loadSeqRef.current) return;
    // Ação nova dela: uma sincronização que falhou antes pode (e deve) ser tentada de novo.
    syncedPercentRef.current.clear();
    aplicarLinha(linha);
    setItems(linha.items || {});
  };

  // feitoAtual = o que a tela mostra (inclui a chave legada 4-4/8-1/9-3), não só items[itemId].
  const handleToggleMaxi = async (itemId, feitoAtual) => {
    if (!checklist || !isAdmin) return;
    const previousItems = items;
    const previousChecklist = checklist;
    const isFeito = typeof feitoAtual === "boolean" ? feitoAtual : Boolean(items[itemId]);
    const newItems = { ...items };
    if (isFeito) delete newItems[itemId];
    else newItems[itemId] = new Date().toISOString();

    setItems(newItems);
    setChecklist((prev) => prev && { ...prev, items: newItems });
    const seq = loadSeqRef.current;

    try {
      // Um item por vez: não apaga a confirmação que a franqueada fez depois que esta tela abriu.
      // Desmarcar também tira a chave legada equivalente (4-4, 8-1, 9-3) no banco.
      const updated = await setOnboardingItem(checklist.franchise_id, itemId, !isFeito);
      if (mountedRef.current && updated) {
        atualizarCache(updated);
        if (seq === loadSeqRef.current) {
          aplicarLinha(updated);
          setItems(updated.items || {});
        }
      }
    } catch (error) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setItems(previousItems);
      setChecklist(previousChecklist);
      toast.error(safeErrorMessage(error, "Não foi possível salvar."));
    }
  };

  const handleAdminNotesBlur = async () => {
    if (!checklist || !isAdmin) return;
    if (adminNotesDraft === (checklist.admin_notes || "")) return;
    try {
      const updated = await OnboardingChecklist.update(checklist.id, { admin_notes: adminNotesDraft });
      if (mountedRef.current && updated) {
        aplicarLinha(updated);
        atualizarCache(updated);
      }
    } catch (error) {
      toast.error(safeErrorMessage(error, "Não foi possível salvar a anotação."));
    }
  };

  const handleDestino = (destino, passoId) => {
    if (!destino) return;
    if (destino.tipo === "app") {
      navigate(destino.href);
      return;
    }
    if (destino.tipo === "acao") {
      setOpenStepId(passoId);
      return;
    }
    window.open(destino.href, "_blank", "noopener,noreferrer");
  };

  const handleAgoraAction = (destino, passoId) => {
    try {
      window.clarity?.("event", "primeiros_passos_continuar");
    } catch {
      // Analytics nunca pode travar a navegação
    }
    handleDestino(destino, passoId);
  };

  const handleVerPasso = (passoId) => {
    setOpenStepId(passoId);
    requestAnimationFrame(() => {
      stepRefs.current[passoId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const unidadesEmAndamento = useMemo(
    () =>
      franchises.filter((f) => {
        const ob = allChecklists.find((c) => c.franchise_id === f.evolution_instance_id);
        return ob && ob.status !== "approved";
      }),
    [franchises, allChecklists]
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-surface">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-[22px]" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <MaterialIcon icon="error_outline" size={48} className="mx-auto mb-3 text-brand/40" />
          <p className="text-ink-2 mb-4">{loadError}</p>
          <Button onClick={loadData} className="bg-brand hover:bg-brand-dark text-white rounded-xl">
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-surface">
      <div className="max-w-3xl mx-auto">
        {/* Franqueado sem franquia */}
        {!isAdmin && currentUser && franchises.length === 0 && (
          <div className="p-8 text-center">
            <MaterialIcon icon="store" size={48} className="mx-auto mb-3 text-ink-4" />
            <h1 className="text-xl font-bold text-ink">Nenhuma franquia associada</h1>
            <p className="text-ink-2 mt-2">Entre em contato com o administrador.</p>
          </div>
        )}

        {/* Franqueado com 2+ unidades e nenhuma escolhida */}
        {!isAdmin && !selectedFranchise && franchises.length > 1 && (
          <FranchisePicker franchises={franchises} title="Primeiros passos de qual unidade?" />
        )}

        {/* ADMIN */}
        {isAdmin && (
          <>
            <div className="mb-6">
              <h1 className="font-plus-jakarta font-extrabold text-2xl sm:text-3xl text-ink flex items-center gap-2.5">
                <MaterialIcon icon="rocket_launch" size={28} className="text-brand-gold shrink-0" />
                Primeiros passos
              </h1>
              <p className="text-sm sm:text-base text-ink-2 mt-1">
                Acompanhe a jornada de cada unidade nova até a primeira venda.
              </p>
            </div>

            {!selectedFranchise && unidadesEmAndamento.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-sm font-semibold text-ink-3 mr-1">Em primeiros passos:</span>
                {unidadesEmAndamento.map((f) => {
                  const ob = allChecklists.find((c) => c.franchise_id === f.evolution_instance_id);
                  const prontaParaConferir = ob?.status === "pending_approval";
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectFranchise(f.evolution_instance_id)}
                      className={`h-9 rounded-full px-3.5 flex items-center gap-2 text-sm font-semibold ${
                        prontaParaConferir
                          ? "bg-ok-soft border border-ok/30 text-ok-ink"
                          : "bg-white border border-surface-line text-ink-2"
                      }`}
                    >
                      {prontaParaConferir && <span className="w-2 h-2 rounded-full bg-ok" />}
                      {f.franchise_name || f.owner_name} · {ob?.completion_percentage ?? 0}%
                      {prontaParaConferir && " · pronta para conferir"}
                    </button>
                  );
                })}
              </div>
            )}

            {!selectedFranchise && (
              <div className="bg-white rounded-2xl border border-surface-line p-4 mb-6">
                <label className="text-sm font-medium text-ink-2 mb-2 flex items-center gap-2">
                  <MaterialIcon icon="person_add" size={16} /> Iniciar primeiros passos para um franqueado
                </label>
                <Select value="" onValueChange={handleSelectFranchise}>
                  <SelectTrigger className="w-full md:w-96 mt-2">
                    <SelectValue placeholder="Escolha um franqueado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {franchises.map((f) => {
                      const ob = allChecklists.find((c) => c.franchise_id === f.evolution_instance_id);
                      return (
                        <SelectItem key={f.id} value={f.evolution_instance_id}>
                          <span className="font-medium">{f.franchise_name || f.owner_name}</span>
                          <span className="text-ink-3 ml-2">{f.city}</span>
                          {ob && <span className="ml-2 text-xs text-ink-3">{ob.completion_percentage}%</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!selectedFranchise && (
              <div className="bg-white rounded-2xl border border-surface-line overflow-hidden mb-6">
                {franchises.filter((f) => allChecklists.find((c) => c.franchise_id === f.evolution_instance_id)).length === 0 ? (
                  <div className="p-8 text-center text-ink-3">
                    <MaterialIcon icon="groups" size={40} className="mx-auto mb-2 opacity-40" />
                    <p>Nenhum franqueado iniciou os primeiros passos ainda.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-line">
                    {franchises
                      .filter((f) => allChecklists.find((c) => c.franchise_id === f.evolution_instance_id))
                      .map((f) => {
                        const ob = allChecklists.find((c) => c.franchise_id === f.evolution_instance_id);
                        const pct = ob?.completion_percentage || 0;
                        const status = ob?.status || "in_progress";
                        return (
                          <button
                            key={f.id}
                            onClick={() => handleSelectFranchise(f.evolution_instance_id)}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-brand-soft/40 transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-ink text-sm">{f.franchise_name || f.owner_name}</div>
                              <div className="text-xs text-ink-3">{f.owner_name}{f.city ? ` · ${f.city}` : ""}</div>
                            </div>
                            <div className="w-24 sm:w-32">
                              <div className="bg-surface-2 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#16a34a" : "#d4af37" }}
                                />
                              </div>
                              <div className="text-xs text-ink-3 mt-1 text-right">{pct}%</div>
                            </div>
                            <StatusBadge status={status} />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {selectedFranchise && (
              <button
                onClick={handleBackToList}
                className="mb-4 flex items-center gap-2 text-sm text-ink-2 hover:text-ink transition-colors"
              >
                <MaterialIcon icon="arrow_back" size={16} /> Voltar para a lista
              </button>
            )}

            {selectedFranchise && !checklist && (
              <div className="text-center border-2 border-dashed border-brand-gold-line bg-brand-gold-soft rounded-2xl p-8 mb-6">
                <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-brand-gold" />
                <h3 className="font-bold text-ink text-lg mb-1">Nenhum checklist iniciado</h3>
                <p className="text-ink-2 text-sm mb-4">Este franqueado ainda não tem uma trilha de primeiros passos.</p>
                <Button onClick={handleStartOnboarding} className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl px-6 py-3">
                  Iniciar primeiros passos
                </Button>
              </div>
            )}

            {selectedFranchise && checklist && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-plus-jakarta font-extrabold text-2xl text-ink">
                      {selectedFranchise.franchise_name || selectedFranchise.owner_name}
                    </h2>
                    <p className="text-ink-2 text-sm">
                      {selectedFranchise.owner_name}
                      {selectedFranchise.city ? ` · ${selectedFranchise.city}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={checklist.status} />
                    {!confirmingStatusAction && (
                      <Button
                        size="sm"
                        onClick={() => handleSetOnboardingStatus(checklist.status === "approved" ? "in_progress" : "approved")}
                        className={`min-h-[40px] rounded-lg px-3 text-xs font-semibold ${
                          checklist.status === "approved"
                            ? "bg-white border border-surface-line text-ink-2 hover:bg-surface-2"
                            : "bg-ok hover:bg-ok-ink text-white"
                        }`}
                      >
                        <MaterialIcon icon={checklist.status === "approved" ? "replay" : "task_alt"} size={16} />
                        {checklist.status === "approved" ? "Reabrir" : "Concluir primeiros passos"}
                      </Button>
                    )}
                    {confirmingStatusAction && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-2">
                          {checklist.status === "approved" ? "Reabrir?" : "Concluir?"}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleSetOnboardingStatus(checklist.status === "approved" ? "in_progress" : "approved")}
                          className="min-h-[40px] text-xs bg-ok hover:bg-ok-ink text-white"
                        >
                          Sim
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingStatusAction(false)} className="min-h-[40px] text-xs text-ink-2">
                          Não
                        </Button>
                      </div>
                    )}
                    {!confirmingDelete && (
                      <Button variant="ghost" size="sm" onClick={handleDeleteOnboarding} className="text-err hover:text-err hover:bg-err-soft" title="Excluir onboarding">
                        <MaterialIcon icon="delete" size={16} />
                      </Button>
                    )}
                    {confirmingDelete && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-err">Excluir?</span>
                        <Button variant="ghost" size="sm" onClick={handleDeleteOnboarding} className="text-err hover:bg-err-soft text-xs h-7">Sim</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} className="text-ink-2 text-xs h-7">Não</Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 bg-surface-2 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-ok transition-all duration-500"
                      style={{ width: `${checklist.completion_percentage || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-ink whitespace-nowrap">{checklist.completion_percentage || 0}%</span>
                </div>

                <div className="flex flex-col gap-2.5 mb-5">
                  {jornada.passos.map((passo) => (
                    <JourneyStep
                      key={passo.id}
                      passo={passo}
                      isOpen={openStepId === passo.id}
                      onToggleOpen={() => setOpenStepId((prev) => (prev === passo.id ? null : passo.id))}
                      onDestino={() => {}}
                      onToggleConfirmacao={() => {}}
                      readOnly
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4 mb-5">
                  <div className="bg-brand-gold-soft border border-brand-gold-line rounded-[20px] p-5 flex flex-col gap-3">
                    <div>
                      <h3 className="font-plus-jakarta font-extrabold text-[17px] text-ink">A Maxi faz</h3>
                      <p className="text-sm text-ink-2">A franqueada vê esta lista, só para leitura.</p>
                    </div>
                    <div className="flex flex-col divide-y divide-brand-gold-line/60">
                      {jornada.passos.flatMap((p) => p.maxi).map((m) => (
                        <label key={m.id} className="min-h-[44px] flex items-center gap-3 py-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={m.feito}
                            onChange={() => handleToggleMaxi(m.id, m.feito)}
                            className="w-5 h-5 accent-brand-gold-ink shrink-0"
                          />
                          <span className="flex-1 text-[15px] text-ink">{m.nome}</span>
                          {m.feitoEm && <span className="text-xs font-semibold text-brand-gold-ink">{formatarData(m.feitoEm)}</span>}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-surface-line rounded-[20px] p-5 flex flex-col gap-2">
                    <label htmlFor="admin-notes" className="text-[15px] font-bold text-ink">Anotações da equipe</label>
                    <textarea
                      id="admin-notes"
                      rows={3}
                      value={adminNotesDraft}
                      onChange={(e) => setAdminNotesDraft(e.target.value)}
                      onBlur={handleAdminNotesBlur}
                      className="border border-surface-line rounded-xl px-3 py-2.5 text-[15px] bg-surface resize-y focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <p className="text-xs text-ink-3">Ao concluir, o menu e o cartão somem para a franqueada. Dá para reabrir.</p>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* FRANQUEADA */}
        {!isAdmin && selectedFranchise && !checklist && (
          <div className="text-center py-16 px-4">
            <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-ink-4" />
            <h3 className="font-bold text-ink text-lg mb-1">Nenhuma trilha ativa</h3>
            <p className="text-ink-2 text-sm">Fale com a equipe Maxi se precisar retomar seus primeiros passos.</p>
          </div>
        )}

        {!isAdmin && selectedFranchise && checklist && (
          <>
            <div className="flex flex-col gap-2 mb-5">
              <span className="text-sm font-semibold text-ink-3">
                {selectedFranchise.franchise_name || selectedFranchise.owner_name}
              </span>
              <h1 className="font-plus-jakarta font-extrabold text-2xl sm:text-[28px] text-ink leading-tight">
                {jornada.completo ? "Primeiros passos completos" : `Passo ${jornada.agora?.passoNumero ?? 5} de 5`}
              </h1>
              <div
                role="img"
                aria-label={`${jornada.prontos} de 5 passos prontos`}
                className="grid grid-cols-5 gap-1.5 mt-1"
              >
                {jornada.passos.map((p) => {
                  const atual = jornada.agora?.passoId === p.id;
                  return (
                    <span
                      key={p.id}
                      className={`h-2 rounded-full ${p.pronto ? "bg-ok" : atual ? "bg-brand" : "bg-surface-line"}`}
                    />
                  );
                })}
              </div>
            </div>

            {jornada.avisos?.length > 0 && (
              <div className="bg-warn-soft border border-warn/30 rounded-2xl p-4 flex items-start gap-3 mb-4">
                <MaterialIcon icon="info" size={20} className="text-warn-ink mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  {jornada.avisos.map((aviso, i) => (
                    <p key={i} className="text-sm text-warn-ink">{aviso}</p>
                  ))}
                </div>
              </div>
            )}

            {!jornada.completo && (
              <div className="mb-5">
                <NextActionCard
                  agora={jornada.agora}
                  passoTitulo={jornada.passos.find((p) => p.id === jornada.agora?.passoId)?.titulo}
                  onAction={handleAgoraAction}
                  onVerPasso={handleVerPasso}
                />
              </div>
            )}

            {jornada.completo && checklist.status !== "approved" && (
              <div className="mb-5 bg-gradient-to-br from-ok-soft to-brand-gold-soft border-2 border-ok/30 rounded-[22px] p-6 sm:p-8 text-center flex flex-col items-center gap-2">
                <span className="w-16 h-16 rounded-full bg-ok text-white flex items-center justify-center">
                  <MaterialIcon icon="celebration" size={34} />
                </span>
                <h3 className="font-plus-jakarta font-extrabold text-xl text-ink">Tudo pronto!</h3>
                <p className="text-ok-ink text-sm">A equipe Maxi foi avisada e vai conferir tudo com você.</p>
              </div>
            )}

            {checklist.status === "approved" && (
              <div className="mb-5 bg-ok-soft border border-ok/30 rounded-[22px] p-6 text-center">
                <p className="text-ok-ink font-bold text-lg">A equipe Maxi concluiu seus primeiros passos.</p>
                {checklist.approved_by && <p className="text-ok-ink/80 text-xs mt-1">Aprovado por {checklist.approved_by}</p>}
              </div>
            )}

            <h2 className="font-plus-jakarta font-extrabold text-lg text-ink mb-2">Seus 5 passos</h2>
            <div className="flex flex-col gap-2.5 mb-5">
              {jornada.passos.map((passo) => (
                <div key={passo.id} ref={(el) => { stepRefs.current[passo.id] = el; }}>
                  <JourneyStep
                    passo={passo}
                    isOpen={openStepId === passo.id}
                    onToggleOpen={() => setOpenStepId((prev) => (prev === passo.id ? null : passo.id))}
                    onDestino={(destino) => handleDestino(destino, passo.id)}
                    onToggleConfirmacao={handleToggleConfirmacao}
                    fiscalGate={
                      passo.id === "dados"
                        ? <FiscalDataGate franchise={selectedFranchise} onReady={handleFiscalReady} />
                        : null
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mb-5">
              <MaxiDoesList passos={jornada.passos} />
            </div>

            <Link
              to={`${createPageUrl("Tutoriais")}?abrir=primeiros-passos`}
              className="flex items-center justify-center gap-2 min-h-[44px] text-brand font-semibold text-sm"
            >
              Ver o guia
              <MaterialIcon icon="arrow_forward" size={16} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
