import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Franchise } from "@/entities/all";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, ClipboardCheck, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
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
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border border-green-300">✅ Aprovado — Pronto para vendas!</Badge>;
  if (status === "pending_approval") return <Badge className="bg-blue-100 text-blue-800 border border-blue-300">⏳ Aguardando Aprovação</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border border-amber-300">🔄 Em andamento</Badge>;
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
  const saveTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const user = await base44.auth.me();
    setCurrentUser(user);

    const allFranchises = await Franchise.filter({ status: "active" });

    if (user.role === "admin") {
      setFranchises(allFranchises);
      // Load all onboarding records for admin summary
      const allOb = await base44.entities.OnboardingChecklist.list();
      setAllChecklists(allOb);
    } else {
      const ids = user.managed_franchise_ids || [];
      const myFranchises = allFranchises.filter(f => ids.includes(f.evolution_instance_id));
      setFranchises(myFranchises);

      if (myFranchises.length > 0) {
        await loadFranchiseChecklist(myFranchises[0], user);
        setSelectedFranchise(myFranchises[0]);
      }
    }
    setIsLoading(false);
  }, []);

  const loadFranchiseChecklist = async (franchise, user) => {
    const existing = await base44.entities.OnboardingChecklist.filter({
      franchise_id: franchise.evolution_instance_id,
    });

    if (existing.length > 0) {
      setChecklist(existing[0]);
      setItems(existing[0].items || {});
    } else if (user?.role !== "admin") {
      // Auto-create for franchisee
      const created = await base44.entities.OnboardingChecklist.create({
        franchise_id: franchise.evolution_instance_id,
        status: "in_progress",
        items: {},
        completed_count: 0,
        total_items: TOTAL_ITEMS,
        completion_percentage: 0,
        started_at: new Date().toISOString(),
      });
      setChecklist(created);
      setItems({});
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

  const handleStartOnboarding = async () => {
    if (!selectedFranchise) return;
    const created = await base44.entities.OnboardingChecklist.create({
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

    const updated = await base44.entities.OnboardingChecklist.update(currentChecklist.id, updateData);
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
  const progressPct = checklist?.completion_percentage || 0;

  // Admin summary counts
  const inProgressCount = allChecklists.filter(c => c.status === "in_progress").length;
  const pendingCount = allChecklists.filter(c => c.status === "pending_approval").length;
  const approvedCount = allChecklists.filter(c => c.status === "approved").length;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center text-slate-500">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 animate-pulse text-blue-400" />
          Carregando onboarding...
        </div>
      </div>
    );
  }

  if (currentUser && !isAdmin) {
    if (franchises.length === 0) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-slate-700">Nenhuma franquia associada</h1>
          <p className="text-slate-500 mt-2">Entre em contato com o administrador.</p>
        </div>
      );
    }
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-amber-50 min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Rocket className="w-8 h-8 text-amber-600" />
            Checklist de Iniciação
          </h1>
          <p className="text-slate-500 mt-1">Tudo que precisa estar pronto antes da sua primeira venda</p>
        </div>

        {/* Admin summary */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-amber-50 border-amber-200 border">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold text-amber-700">{inProgressCount}</div>
                  <div className="text-xs text-slate-500">Em andamento</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200 border">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-700">{pendingCount}</div>
                  <div className="text-xs text-slate-500">Aguardando aprovação</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200 border">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-700">{approvedCount}</div>
                  <div className="text-xs text-slate-500">Aprovados</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin franchisee list */}
        {isAdmin && franchises.length > 0 && (
          <Card className="mb-6 border-0 shadow-sm bg-white/90">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {franchises.map(f => {
                  const ob = allChecklists.find(c => c.franchise_id === f.evolution_instance_id);
                  const pct = ob?.completion_percentage || 0;
                  const status = ob?.status || null;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFranchise(f.evolution_instance_id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left ${selectedFranchise?.id === f.id ? "bg-amber-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">{f.owner_name}</div>
                        <div className="text-xs text-slate-400">{f.city}</div>
                      </div>
                      {ob ? (
                        <>
                          <div className="w-32 hidden sm:block">
                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-amber-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-xs text-slate-400 mt-1 text-right">{pct}%</div>
                          </div>
                          <StatusBadge status={status} />
                        </>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border border-slate-200">Não iniciado</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Franchise selector (admin) */}
        {isAdmin && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                <Users className="w-4 h-4" /> Selecionar Franqueado
              </label>
              <Select value={selectedFranchise?.evolution_instance_id || ""} onValueChange={handleSelectFranchise}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Escolha um franqueado..." />
                </SelectTrigger>
                <SelectContent>
                  {franchises.map(f => {
                    const ob = allChecklists.find(c => c.franchise_id === f.evolution_instance_id);
                    return (
                      <SelectItem key={f.id} value={f.evolution_instance_id}>
                        <span className="font-medium">{f.owner_name}</span>
                        <span className="text-slate-400 ml-2">· {f.city}</span>
                        {ob && <span className="ml-2 text-xs text-slate-400">{ob.completion_percentage}%</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* No checklist yet (admin) */}
        {isAdmin && selectedFranchise && !checklist && (
          <Card className="mb-6 text-center border-dashed border-2 border-amber-300 bg-amber-50/60">
            <CardContent className="p-8">
              <Rocket className="w-12 h-12 mx-auto mb-3 text-amber-500" />
              <h3 className="font-bold text-slate-800 mb-1">Nenhum onboarding iniciado</h3>
              <p className="text-slate-500 text-sm mb-4">Este franqueado ainda não tem um onboarding.</p>
              <Button onClick={handleStartOnboarding} className="bg-amber-600 hover:bg-amber-700 text-white">
                Iniciar Onboarding
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Checklist content */}
        {checklist && (
          <>
            {/* Franchise info + progress */}
            <Card className="mb-6 border-0 shadow-sm bg-white/90">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedFranchise?.owner_name || franchises[0]?.owner_name}
                    </h2>
                    <p className="text-slate-500 text-sm">{selectedFranchise?.city || franchises[0]?.city}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={checklist.status} />
                    {isSaving && <span className="text-xs text-slate-400 animate-pulse">Salvando...</span>}
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
                  <span className="font-bold text-slate-700 w-16 text-right">
                    {checklist.completed_count}/{TOTAL_ITEMS}
                  </span>
                </div>
                <div className="text-right text-sm text-slate-500 mt-1">{progressPct}% concluído</div>

                {/* Celebration banner */}
                {(celebrated || checklist.status === "approved") && (
                  <div className="mt-4 bg-green-50 border border-green-300 rounded-xl p-4 text-center animate-pulse">
                    <p className="text-green-800 font-bold text-lg">🎉 Parabéns! Onboarding completo!</p>
                    <p className="text-green-600 text-sm mt-1">O tráfego pago será ativado em breve.</p>
                    {checklist.approved_by && (
                      <p className="text-green-500 text-xs mt-1">Aprovado por {checklist.approved_by}</p>
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
          <div className="text-center py-16 text-slate-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Selecione um franqueado para ver o onboarding</p>
          </div>
        )}
      </div>
    </div>
  );
}