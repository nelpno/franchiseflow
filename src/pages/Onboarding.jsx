import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Franchise, User, OnboardingChecklist } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { BLOCKS, GATE_BLOCK, TOTAL_ITEMS } from "@/components/onboarding/ONBOARDING_BLOCKS";
import OnboardingBlock from "@/components/onboarding/OnboardingBlock";
import GateBlock from "@/components/onboarding/GateBlock";
import ProgressRing from "@/components/onboarding/ProgressRing";

const ALL_BLOCK_KEYS = [
  ...BLOCKS.flatMap(b => b.items.map(i => i.key)),
  ...GATE_BLOCK.items.map(i => i.key),
];

function computeCounts(items) {
  const count = ALL_BLOCK_KEYS.filter(k => items[k]).length;
  return {
    completed_count: count,
    completion_percentage: Math.round((count / TOTAL_ITEMS) * 100),
  };
}

function blocks1to8Complete(items) {
  return BLOCKS.every(block => block.items.every(item => items[item.key]));
}

function StatusBadge({ status }) {
  if (status === "approved") return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Aprovado</Badge>;
  if (status === "pending_approval") return <Badge className="bg-[#d4af37]/10 text-[#775a19] border border-[#d4af37]/30">Aguardando</Badge>;
  return <Badge className="bg-[#b91c1c]/5 text-[#b91c1c] border border-[#b91c1c]/20">Em andamento</Badge>;
}

// Find the first block that is not 100% complete
function findActiveBlockId(items) {
  for (const block of BLOCKS) {
    const allChecked = block.items.every(i => items[i.key]);
    if (!allChecked) return block.id;
  }
  return 9; // gate block
}

const BLOCK_CELEBRATION = [
  "Primeiros passos feitos! Bora!",
  "Você já conhece todos os produtos!",
  "Espaço pronto! Operação tomando forma!",
  "WhatsApp configurado! Agora sim!",
  "Vendedor ativado! Seu robô está pronto!",
  "Primeiro pedido feito! Estoque a caminho!",
  "Treinamento completo! Você está craque!",
  "Redes sociais no ar! Quase lá!",
];

export default function Onboarding() {
  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [items, setItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allChecklists, setAllChecklists] = useState([]);
  const [celebrated, setCelebrated] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [completedBlocks, setCompletedBlocks] = useState(new Set());
  const saveTimerRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const blockRefs = useRef({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const allFranchises = await Franchise.list();

      if (user.role === "admin") {
        setFranchises(allFranchises);
        const allOb = await OnboardingChecklist.list();
        setAllChecklists(allOb);
      } else {
        const ids = user.managed_franchise_ids || [];
        const myFranchises = allFranchises.filter(f =>
          ids.includes(f.evolution_instance_id) || ids.includes(f.id)
        );
        setFranchises(myFranchises);

        if (myFranchises.length > 0) {
          setSelectedFranchise(myFranchises[0]);
          await loadFranchiseChecklist(myFranchises[0], user);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar onboarding:", error);
      toast.error("Erro ao carregar dados. Tente recarregar a página.");
    }
    setIsLoading(false);
  }, []);

  const loadFranchiseChecklist = async (franchise) => {
    const existing = await OnboardingChecklist.filter({
      franchise_id: franchise.evolution_instance_id,
    });

    if (existing.length > 0) {
      const cl = existing[0];
      setChecklist(cl);
      setItems(cl.items || {});
      // Set initial expanded block
      const activeId = findActiveBlockId(cl.items || {});
      setExpandedBlockId(activeId);
      // Track already completed blocks
      const done = new Set();
      BLOCKS.forEach(b => {
        if (b.items.every(i => (cl.items || {})[i.key])) done.add(b.id);
      });
      setCompletedBlocks(done);
    } else {
      setChecklist(null);
      setItems({});
      setExpandedBlockId(1);
      setCompletedBlocks(new Set());
    }
  };

  const handleSelectFranchise = async (franchiseId) => {
    const franchise = franchises.find(f => f.evolution_instance_id === franchiseId);
    if (!franchise) return;
    setSelectedFranchise(franchise);
    setIsLoading(true);
    await loadFranchiseChecklist(franchise);
    setIsLoading(false);
  };

  const handleDeleteOnboarding = async () => {
    if (!checklist) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await OnboardingChecklist.delete(checklist.id);
    setAllChecklists(prev => prev.filter(c => c.id !== checklist.id));
    setChecklist(null);
    setItems({});
    setSelectedFranchise(null);
    setConfirmingDelete(false);
  };

  const handleStartOnboarding = async () => {
    if (!selectedFranchise) {
      toast.error("Selecione uma franquia primeiro.");
      return;
    }
    try {
      const created = await OnboardingChecklist.create({
        franchise_id: selectedFranchise.evolution_instance_id,
        status: "in_progress",
        items: {},
        completed_count: 0,
        completion_percentage: 0,
      });
      setChecklist(created);
      setItems({});
      setExpandedBlockId(1);
      toast.success("Onboarding iniciado!");
    } catch (error) {
      console.error("Erro ao iniciar onboarding:", error);
      toast.error("Erro ao iniciar onboarding. Verifique as permissões.");
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, [loadData]);

  const saveItems = useCallback(async (newItems, currentChecklist, user) => {
    if (!currentChecklist) return;
    setIsSaving(true);
    try {
      const b18Complete = blocks1to8Complete(newItems);
      const finalItems = { ...newItems, "9-1": b18Complete };

      const counts = computeCounts(finalItems);

      let status = currentChecklist.status;
      if (finalItems["9-4"] && user?.role === "admin") {
        status = "approved";
      } else if (b18Complete && status === "in_progress") {
        status = "pending_approval";
      } else if (!b18Complete && status === "pending_approval") {
        status = "in_progress";
      }

      const updateData = {
        items: finalItems,
        ...counts,
        status,
      };

      if (status === "approved" && currentChecklist.status !== "approved" && user?.role === "admin") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user.full_name || user.email;
        setCelebrated(true);
        setTimeout(() => setCelebrated(false), 5000);
      }

      const updated = await OnboardingChecklist.update(currentChecklist.id, updateData);
      setChecklist(updated);
    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleToggle = (key) => {
    const newItems = { ...items, [key]: !items[key] };
    setItems(newItems);

    // Check if any block just became complete
    BLOCKS.forEach((block, idx) => {
      const wasComplete = completedBlocks.has(block.id);
      const isNowComplete = block.items.every(i => newItems[i.key]);

      if (!wasComplete && isNowComplete) {
        // Block just completed! Celebrate and move to next
        const newCompleted = new Set(completedBlocks);
        newCompleted.add(block.id);
        setCompletedBlocks(newCompleted);

        toast.success(BLOCK_CELEBRATION[idx] || "Missão completa!", {
          duration: 3000,
          icon: "🎉",
        });

        // Auto-expand next incomplete block after celebration (3.4s)
        if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = setTimeout(() => {
          const nextActiveId = findActiveBlockId(newItems);
          setExpandedBlockId(nextActiveId);

          // Auto-scroll to next block
          setTimeout(() => {
            const nextRef = blockRefs.current[nextActiveId];
            if (nextRef) {
              nextRef.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 150);
          celebrationTimerRef.current = null;
        }, 3400);
      }
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveItems(newItems, checklist, currentUser);
    }, 500);
  };

  const isAdmin = currentUser?.role === "admin";
  const b18Complete = blocks1to8Complete(items);
  const liveCounts = checklist ? computeCounts(items) : { completed_count: 0, completion_percentage: 0 };
  const progressPct = liveCounts.completion_percentage;

  // Count completed blocks
  const completedBlockCount = BLOCKS.filter(b => b.items.every(i => items[i.key])).length;

  // Next active block (first incomplete)
  const nextActiveBlockId = useMemo(() => findActiveBlockId(items), [items]);

  // Motivational message
  const motivationalMessage = useMemo(() => {
    if (progressPct === 0) return "Vamos começar! Sua primeira missão já está esperando.";
    if (progressPct <= 25) return "Ótimo começo! Continue assim.";
    if (progressPct <= 50) return "Quase na metade! Você está voando.";
    if (progressPct <= 75) return "Mais da metade! A reta final está perto.";
    if (progressPct < 100) return "Falta pouco! Você está quase lá!";
    return "Todas as missões completas! 🎉";
  }, [progressPct]);

  // Manual block toggle — cancels celebration auto-expand timer
  const handleManualToggle = (blockId) => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    setExpandedBlockId(expandedBlockId === blockId ? null : blockId);
  };

  // Admin summary counts
  const inProgressCount = allChecklists.filter(c => c.status === "in_progress").length;
  const pendingCount = allChecklists.filter(c => c.status === "pending_approval").length;
  const approvedCount = allChecklists.filter(c => c.status === "approved").length;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center text-[#4a3d3d]">
          <MaterialIcon icon="rocket_launch" size={40} className="mx-auto mb-3 animate-pulse text-[#d4af37]" />
          Carregando onboarding...
        </div>
      </div>
    );
  }

  if (currentUser && !isAdmin) {
    if (franchises.length === 0) {
      return (
        <div className="p-8 text-center">
          <MaterialIcon icon="store" size={48} className="mx-auto mb-3 text-[#291715]/20" />
          <h1 className="text-xl font-bold text-[#1b1c1d]">Nenhuma franquia associada</h1>
          <p className="text-[#4a3d3d] mt-2">Entre em contato com o administrador.</p>
        </div>
      );
    }
  }

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa]">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-2 sm:gap-3">
            <MaterialIcon icon="rocket_launch" size={28} className="text-[#d4af37] shrink-0" />
            Suas Missões
          </h1>
          <p className="text-sm sm:text-base text-[#4a3d3d] mt-1">Complete as missões e prepare tudo para sua primeira venda</p>
        </div>

        {/* Admin summary */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <Card className="bg-[#d4af37]/5 border-[#d4af37]/20 border">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl font-bold text-[#775a19]">{inProgressCount}</div>
                <div className="text-xs text-[#4a3d3d]/70 leading-tight">Em andamento</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200 border">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
                <div className="text-xs text-[#4a3d3d]/70 leading-tight">Aguardando</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 border">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">{approvedCount}</div>
                <div className="text-xs text-[#4a3d3d]/70 leading-tight">Aprovados</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin franchisee list */}
        {isAdmin && !selectedFranchise && (
          <Card className="mb-6 bg-white rounded-2xl shadow-sm border border-[#291715]/5">
            <CardContent className="p-0">
              {franchises.filter(f => allChecklists.find(c => c.franchise_id === f.evolution_instance_id)).length === 0 ? (
                <div className="p-8 text-center text-[#4a3d3d]/70">
                  <MaterialIcon icon="groups" size={40} className="mx-auto mb-2 opacity-40" />
                  <p>Nenhum franqueado iniciou o onboarding ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#291715]/5">
                  {franchises
                    .filter(f => allChecklists.find(c => c.franchise_id === f.evolution_instance_id))
                    .map(f => {
                      const ob = allChecklists.find(c => c.franchise_id === f.evolution_instance_id);
                      const pct = ob?.completion_percentage || 0;
                      const status = ob?.status || "in_progress";
                      return (
                        <button
                          key={f.id}
                          onClick={() => handleSelectFranchise(f.evolution_instance_id)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#d4af37]/5 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#1b1c1d] text-sm">{f.owner_name}</div>
                            <div className="text-xs text-[#4a3d3d]/70">{f.city}</div>
                          </div>
                          <div className="w-24 sm:w-32">
                            <div className="bg-[#291715]/5 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: pct === 100 ? "#10b981" : "#d4af37",
                                }}
                              />
                            </div>
                            <div className="text-xs text-[#4a3d3d]/70 mt-1 text-right">{pct}%</div>
                          </div>
                          <StatusBadge status={status} />
                        </button>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Back button when a franchise is selected */}
        {isAdmin && selectedFranchise && (
          <button
            onClick={() => { setSelectedFranchise(null); setChecklist(null); setItems({}); }}
            className="mb-4 flex items-center gap-2 text-sm text-[#4a3d3d] hover:text-[#1b1c1d] transition-colors"
          >
            <MaterialIcon icon="arrow_back" size={16} /> Voltar para a lista
          </button>
        )}

        {/* Admin selector - to start onboarding for any franchisee */}
        {isAdmin && !selectedFranchise && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-medium text-[#4a3d3d] mb-2 flex items-center gap-2">
                <MaterialIcon icon="person_add" size={16} /> Iniciar onboarding para novo franqueado
              </label>
              <Select value="" onValueChange={handleSelectFranchise}>
                <SelectTrigger className="w-full md:w-96 mt-2">
                  <SelectValue placeholder="Escolha um franqueado..." />
                </SelectTrigger>
                <SelectContent>
                  {franchises.map(f => {
                    const ob = allChecklists.find(c => c.franchise_id === f.evolution_instance_id);
                    return (
                      <SelectItem key={f.id} value={f.evolution_instance_id}>
                        <span className="font-medium">{f.owner_name}</span>
                        <span className="text-[#4a3d3d]/70 ml-2">{f.city}</span>
                        {ob && <span className="ml-2 text-xs text-[#4a3d3d]/70">{ob.completion_percentage}%</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* No checklist yet (franchisee) */}
        {!isAdmin && franchises.length > 0 && !checklist && !isLoading && (
          <Card className="mb-6 text-center border-2 border-dashed border-[#d4af37]/40 bg-[#d4af37]/5">
            <CardContent className="p-8">
              <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-[#d4af37]" />
              <h3 className="font-bold text-[#1b1c1d] text-lg mb-1">Vamos preparar tudo!</h3>
              <p className="text-[#4a3d3d] text-sm mb-4">8 missões rápidas para deixar sua franquia pronta para vender.</p>
              <Button onClick={() => handleStartOnboarding()} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl px-6 py-3 text-base">
                Começar Missões
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No checklist yet (admin) */}
        {isAdmin && selectedFranchise && !checklist && (
          <Card className="mb-6 text-center border-2 border-dashed border-[#d4af37]/40 bg-[#d4af37]/5">
            <CardContent className="p-8">
              <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-[#d4af37]" />
              <h3 className="font-bold text-[#1b1c1d] text-lg mb-1">Nenhum onboarding iniciado</h3>
              <p className="text-[#4a3d3d] text-sm mb-4">Este franqueado ainda não tem um onboarding.</p>
              <Button onClick={handleStartOnboarding} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl px-6 py-3">
                Iniciar Onboarding
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Checklist content */}
        {checklist && (
          <>
            {/* Franchise info + overall progress */}
            <Card className="mb-6 bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1b1c1d]">
                      {selectedFranchise?.owner_name || franchises[0]?.owner_name}
                    </h2>
                    <p className="text-[#4a3d3d] text-sm">{selectedFranchise?.city || franchises[0]?.city}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={checklist.status} />
                    {isSaving && <span className="text-xs text-[#4a3d3d]/70 animate-pulse">Salvando...</span>}
                    {isAdmin && !confirmingDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteOnboarding}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Excluir onboarding"
                      >
                        <MaterialIcon icon="delete" size={16} />
                      </Button>
                    )}
                    {isAdmin && confirmingDelete && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Excluir?</span>
                        <Button variant="ghost" size="sm" onClick={handleDeleteOnboarding} className="text-red-600 hover:text-red-800 hover:bg-red-50 text-xs h-7">Sim</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} className="text-[#4a3d3d] text-xs h-7">Não</Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overall progress with ProgressRing */}
                <div className="flex items-center gap-4">
                  <div className="sm:hidden">
                    <ProgressRing
                      size={48}
                      progress={progressPct}
                      isComplete={progressPct === 100}
                      icon="rocket_launch"
                      color="#d4af37"
                    />
                  </div>
                  <div className="hidden sm:block">
                    <ProgressRing
                      size={56}
                      progress={progressPct}
                      isComplete={progressPct === 100}
                      icon="rocket_launch"
                      color="#d4af37"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="flex-1 bg-[#291715]/5 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full transition-all duration-700"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100
                              ? "#10b981"
                              : "linear-gradient(90deg, #b91c1c 0%, #d4af37 50%, #10b981 100%)",
                            backgroundSize: "300% 100%",
                            backgroundPosition: `${100 - progressPct}% 0`,
                          }}
                        />
                      </div>
                      <span className="font-bold text-[#1b1c1d] text-sm whitespace-nowrap">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-[#4a3d3d]/70">
                      <span>{completedBlockCount} de 8 missões completas</span>
                      <span>{liveCounts.completed_count}/{TOTAL_ITEMS} itens</span>
                    </div>
                    <p className="text-xs text-[#4a3d3d] mt-1.5 italic">{motivationalMessage}</p>
                  </div>
                </div>

                {/* Celebration banner */}
                {(celebrated || checklist.status === "approved") && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-emerald-700 font-bold text-lg">Parabéns! Onboarding completo!</p>
                    <p className="text-emerald-600 text-sm mt-1">O tráfego pago será ativado em breve.</p>
                    {checklist.approved_by && (
                      <p className="text-emerald-500 text-xs mt-1">Aprovado por {checklist.approved_by}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Blocks 1-8 as accordion */}
            <div className="space-y-3 mb-4">
              {BLOCKS.map(block => (
                <OnboardingBlock
                  key={block.id}
                  block={block}
                  items={items}
                  onToggle={handleToggle}
                  isAdmin={isAdmin}
                  disabled={checklist.status === "approved"}
                  isExpanded={expandedBlockId === block.id}
                  onToggleExpand={() => handleManualToggle(block.id)}
                  isNextActive={block.id === nextActiveBlockId}
                  blockRef={el => { blockRefs.current[block.id] = el; }}
                />
              ))}
            </div>

            {/* Franchisee: peak-end celebration when all 8 missions done */}
            {!isAdmin && b18Complete && checklist.status !== "approved" && (
              <Card className="mb-4 overflow-hidden rounded-2xl border-2 border-emerald-200"
                    style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #fef9e7 100%)" }}>
                <CardContent className="p-5 sm:p-8 text-center">
                  <MaterialIcon icon="celebration" size={64} className="mx-auto mb-3 text-[#d4af37] animate-bounce" />
                  <h3 className="text-xl font-bold text-emerald-700 font-plus-jakarta mb-2">
                    Parabéns! Você está pronto para vender!
                  </h3>
                  <p className="text-emerald-600 text-sm mb-1">
                    O CS foi notificado e vai validar suas configurações.
                  </p>
                  <p className="text-emerald-500 text-xs">
                    Tráfego pago ativado em até 48h.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Admin only: Gate Block 9 */}
            {isAdmin && (
              <div ref={el => { blockRefs.current[9] = el; }}>
                <GateBlock
                  items={{ ...items, "9-1": b18Complete }}
                  onToggle={handleToggle}
                  isAdmin={isAdmin}
                  blocks1to8Complete={b18Complete}
                />
              </div>
            )}
          </>
        )}

        {/* Nothing selected yet (admin) */}
        {isAdmin && !selectedFranchise && (
          <div className="text-center py-12 text-[#4a3d3d]/70">
            <MaterialIcon icon="task_alt" size={48} className="mx-auto mb-3 opacity-30" />
            <p>Selecione um franqueado acima para ver o onboarding</p>
          </div>
        )}
      </div>
    </div>
  );
}
