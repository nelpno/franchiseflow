import { useState, useEffect, useCallback, useRef } from "react";
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
  if (status === "approved") return <Badge className="bg-[#b91c1c]/10 text-[#b91c1c] border border-[#b91c1c]/30">✅ Aprovado — Pronto para vendas!</Badge>;
  if (status === "pending_approval") return <Badge className="bg-[#d4af37]/10 text-[#775a19] border border-[#d4af37]/30">⏳ Aguardando Aprovação</Badge>;
  return <Badge className="bg-[#d4af37]/10 text-[#775a19] border border-[#d4af37]/40">🔄 Em andamento</Badge>;
}

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
  const saveTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Buscar todas as franquias (sem filtro de status para garantir que encontra)
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

  const loadFranchiseChecklist = async (franchise, user) => {
    const existing = await OnboardingChecklist.filter({
      franchise_id: franchise.evolution_instance_id,
    });

    if (existing.length > 0) {
      setChecklist(existing[0]);
      setItems(existing[0].items || {});
    } else {
      setChecklist(null);
      setItems({});
    }
  };

  const handleSelectFranchise = async (franchiseId) => {
    const franchise = franchises.find(f => f.evolution_instance_id === franchiseId);
    if (!franchise) return;
    setSelectedFranchise(franchise);
    setIsLoading(true);
    await loadFranchiseChecklist(franchise, currentUser);
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
    if (!selectedFranchise) return;
    const created = await OnboardingChecklist.create({
      franchise_id: selectedFranchise.evolution_instance_id,
      status: "in_progress",
      items: {},
      completed_count: 0,
      total_items: TOTAL_ITEMS,
      completion_percentage: 0,
      started_at: new Date().toISOString(),
    });
    setChecklist(created);
    setItems({});
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveItems = useCallback(async (newItems, currentChecklist, user) => {
    if (!currentChecklist) return;
    setIsSaving(true);

    const b18Complete = blocks1to8Complete(newItems);
    // Auto-mark 9-1
    const finalItems = { ...newItems, "9-1": b18Complete };

    const counts = computeCounts(finalItems);

    // Determine status
    let status = currentChecklist.status;
    if (finalItems["9-5"] && user?.role === "admin") {
      status = "approved";
    } else if (b18Complete && status === "in_progress") {
      status = "pending_approval";
    } else if (!b18Complete && status === "pending_approval") {
      status = "in_progress";
    }

    const updateData = {
      items: finalItems,
      ...counts,
      total_items: TOTAL_ITEMS,
      status,
    };

    // If newly approved
    if (status === "approved" && currentChecklist.status !== "approved" && user?.role === "admin") {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user.full_name || user.email;
      setCelebrated(true);
      setTimeout(() => setCelebrated(false), 5000);
    }

    const updated = await OnboardingChecklist.update(currentChecklist.id, updateData);
    setChecklist(updated);
    setIsSaving(false);
  }, []);

  const handleToggle = (key) => {
    const newItems = { ...items, [key]: !items[key] };
    setItems(newItems);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveItems(newItems, checklist, currentUser);
    }, 500);
  };

  const isAdmin = currentUser?.role === "admin";
  const b18Complete = blocks1to8Complete(items);
  // Recalculate live from current items to avoid stale stored value
  const liveCounts = checklist ? computeCounts(items) : { completed_count: 0, completion_percentage: 0 };
  const progressPct = liveCounts.completion_percentage;

  // Admin summary counts
  const inProgressCount = allChecklists.filter(c => c.status === "in_progress").length;
  const pendingCount = allChecklists.filter(c => c.status === "pending_approval").length;
  const approvedCount = allChecklists.filter(c => c.status === "approved").length;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center text-[#534343]">
          <MaterialIcon icon="task_alt" size={40} className="mx-auto mb-3 animate-pulse text-[#b91c1c]" />
          Carregando onboarding...
        </div>
      </div>
    );
  }

  if (currentUser && !isAdmin) {
    if (franchises.length === 0) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-[#4a3d3d]">Nenhuma franquia associada</h1>
          <p className="text-[#534343] mt-2">Entre em contato com o administrador.</p>
        </div>
      );
    }
  }

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa] min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-2 sm:gap-3">
            <MaterialIcon icon="rocket_launch" size={28} className="text-[#d4af37] shrink-0" />
            Checklist de Iniciação
          </h1>
          <p className="text-sm sm:text-base text-[#534343] mt-1">Tudo que precisa estar pronto antes da sua primeira venda</p>
        </div>

        {/* Admin summary */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <Card className="bg-[#d4af37]/10 border-[#d4af37]/30 border">
              <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
                <MaterialIcon icon="schedule" size={20} className="text-[#d4af37] hidden sm:block" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#775a19]">{inProgressCount}</div>
                  <div className="text-[10px] sm:text-xs text-[#534343] leading-tight">Em andamento</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#d4af37]/10 border-[#d4af37]/30 border">
              <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
                <MaterialIcon icon="error" size={20} className="text-[#d4af37] hidden sm:block" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#775a19]">{pendingCount}</div>
                  <div className="text-[10px] sm:text-xs text-[#534343] leading-tight">Aguardando{"\n"}aprovação</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#b91c1c]/5 border-[#b91c1c]/20 border">
              <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
                <MaterialIcon icon="check_circle" size={20} className="text-[#b91c1c] hidden sm:block" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#b91c1c]">{approvedCount}</div>
                  <div className="text-[10px] sm:text-xs text-[#534343] leading-tight">Aprovados</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin franchisee list - only those who started */}
        {isAdmin && !selectedFranchise && (
          <Card className="mb-6 bg-white rounded-2xl shadow-sm border border-[#291715]/5">
            <CardContent className="p-0">
              {franchises.filter(f => allChecklists.find(c => c.franchise_id === f.evolution_instance_id)).length === 0 ? (
                <div className="p-8 text-center text-[#534343]/60">Nenhum franqueado iniciou o onboarding ainda.</div>
              ) : (
                <div className="divide-y divide-slate-100">
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
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#d4af37]/10 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#1b1c1d] text-sm">{f.owner_name}</div>
                            <div className="text-xs text-[#534343]/60">{f.city}</div>
                          </div>
                          <div className="w-32 hidden sm:block">
                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-[#d4af37]/100 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-xs text-[#534343]/60 mt-1 text-right">{pct}%</div>
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
            className="mb-4 flex items-center gap-2 text-sm text-[#534343] hover:text-[#1b1c1d] transition-colors"
          >
            ← Voltar para a lista
          </button>
        )}

        {/* Franchise selector (admin) - to start onboarding for any franchisee */}
        {isAdmin && !selectedFranchise && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-medium text-[#4a3d3d] mb-2 block flex items-center gap-2">
                <MaterialIcon icon="group" size={16} /> Selecionar Franqueado para iniciar onboarding
              </label>
              <Select value="" onValueChange={handleSelectFranchise}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Escolha um franqueado..." />
                </SelectTrigger>
                <SelectContent>
                  {franchises.map(f => {
                    const ob = allChecklists.find(c => c.franchise_id === f.evolution_instance_id);
                    return (
                      <SelectItem key={f.id} value={f.evolution_instance_id}>
                        <span className="font-medium">{f.owner_name}</span>
                        <span className="text-[#534343]/60 ml-2">· {f.city}</span>
                        {ob && <span className="ml-2 text-xs text-[#534343]/60">{ob.completion_percentage}%</span>}
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
          <Card className="mb-6 text-center border-dashed border-2 border-[#d4af37]/40 bg-[#d4af37]/10/60">
            <CardContent className="p-8">
              <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-[#d4af37]" />
              <h3 className="font-bold text-[#1b1c1d] mb-1">Nenhum onboarding iniciado</h3>
              <p className="text-[#534343] text-sm mb-4">Clique abaixo para iniciar seu checklist de inauguração.</p>
              <Button onClick={() => handleStartOnboarding()} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl">
                Iniciar Onboarding
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No checklist yet (admin) */}
        {isAdmin && selectedFranchise && !checklist && (
          <Card className="mb-6 text-center border-dashed border-2 border-[#d4af37]/40 bg-[#d4af37]/10/60">
            <CardContent className="p-8">
              <MaterialIcon icon="rocket_launch" size={48} className="mx-auto mb-3 text-[#d4af37]" />
              <h3 className="font-bold text-[#1b1c1d] mb-1">Nenhum onboarding iniciado</h3>
              <p className="text-[#534343] text-sm mb-4">Este franqueado ainda não tem um onboarding.</p>
              <Button onClick={handleStartOnboarding} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl">
                Iniciar Onboarding
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Checklist content */}
        {checklist && (
          <>
            {/* Franchise info + progress */}
            <Card className="mb-6 bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#1b1c1d]">
                      {selectedFranchise?.owner_name || franchises[0]?.owner_name}
                    </h2>
                    <p className="text-[#534343] text-sm">{selectedFranchise?.city || franchises[0]?.city}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={checklist.status} />
                    {isSaving && <span className="text-xs text-[#534343]/60 animate-pulse">Salvando...</span>}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteOnboarding}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 text-xs h-7"
                        >
                          Sim
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingDelete(false)}
                          className="text-[#534343] hover:bg-[#f5f3f4] text-xs h-7"
                        >
                          Não
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPct}%`,
                        background: "linear-gradient(90deg, #D32F2F 0%, #C49A2A 50%, #43A047 100%)",
                        backgroundSize: "300% 100%",
                        backgroundPosition: `${100 - progressPct}% 0`,
                      }}
                    />
                  </div>
                  <span className="font-bold text-[#4a3d3d] w-16 text-right">
                    {liveCounts.completed_count}/{TOTAL_ITEMS}
                  </span>
                </div>
                <div className="text-right text-sm text-[#534343] mt-1">{progressPct}% concluído</div>

                {/* Celebration banner */}
                {(celebrated || checklist.status === "approved") && (
                  <div className="mt-4 bg-[#b91c1c]/5 border border-[#b91c1c]/30 rounded-xl p-4 text-center animate-pulse">
                    <p className="text-[#b91c1c] font-bold text-lg">🎉 Parabéns! Onboarding completo!</p>
                    <p className="text-[#991b1b] text-sm mt-1">O tráfego pago será ativado em breve.</p>
                    {checklist.approved_by && (
                      <p className="text-[#b91c1c]/70 text-xs mt-1">Aprovado por {checklist.approved_by}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Blocks 1-8 */}
            <div className="grid gap-4 mb-4">
              {BLOCKS.map(block => (
                <OnboardingBlock
                  key={block.id}
                  block={block}
                  items={items}
                  onToggle={handleToggle}
                  isAdmin={isAdmin}
                  disabled={checklist.status === "approved"}
                />
              ))}
            </div>

            {/* Gate Block 9 */}
            <GateBlock
              items={{ ...items, "9-1": b18Complete }}
              onToggle={handleToggle}
              isAdmin={isAdmin}
              blocks1to8Complete={b18Complete}
            />
          </>
        )}

        {/* Nothing selected yet (admin) */}
        {isAdmin && !selectedFranchise && (
          <div className="text-center py-16 text-[#534343]/60">
            <MaterialIcon icon="task_alt" size={48} className="mx-auto mb-3 opacity-40" />
            <p>Selecione um franqueado para ver o onboarding</p>
          </div>
        )}
      </div>
    </div>
  );
}