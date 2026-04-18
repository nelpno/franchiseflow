import { useState, useEffect, useCallback, useRef } from "react";
import { Franchise, FranchiseConfiguration, SystemSubscription } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { missingFiscalFields } from "@/lib/saveFiscalData";

function formatCpfCnpj(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function StatusBadge({ status, asaasId, cpfCnpj }) {
  if (asaasId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#16a34a]/10 text-[#16a34a]">
        <MaterialIcon icon="check_circle" size={14} />
        Cadastrado
      </span>
    );
  }
  if (cpfCnpj) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#d4af37]/10 text-[#d4af37]">
        <MaterialIcon icon="schedule" size={14} />
        Pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#dc2626]/10 text-[#dc2626]">
      <MaterialIcon icon="error" size={14} />
      Falta CPF/CNPJ
    </span>
  );
}

function SubscriptionBadge({ sub }) {
  if (!sub) return <span className="text-xs text-gray-400">—</span>;
  const status = sub.current_payment_status;
  // Customer cadastrado mas assinatura ainda não criada
  if (sub.asaas_customer_id && !sub.asaas_subscription_id && status !== "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#d4af37]/10 text-[#d4af37]">
        <MaterialIcon icon="hourglass_empty" size={14} />
        Aguardando criar
      </span>
    );
  }
  if (status === "PAID" || status === "RECEIVED" || status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#16a34a]/10 text-[#16a34a]">
        <MaterialIcon icon="check_circle" size={14} />
        Pago
      </span>
    );
  }
  if (status === "OVERDUE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#dc2626]/10 text-[#dc2626]">
        <MaterialIcon icon="error" size={14} />
        Vencido
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#d4af37]/10 text-[#d4af37]">
        <MaterialIcon icon="schedule" size={14} />
        Pendente
      </span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <MaterialIcon icon="block" size={14} />
        Cancelada
      </span>
    );
  }
  return <span className="text-xs text-gray-400">{status || "—"}</span>;
}

export default function AsaasSetupPanel() {
  const [franchises, setFranchises] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCpf, setEditingCpf] = useState({});
  const [savingCpf, setSavingCpf] = useState({});
  const [editingEmail, setEditingEmail] = useState({});
  const [savingEmail, setSavingEmail] = useState({});
  // Cancelamento
  const [cancellingSub, setCancellingSub] = useState(null); // franchise object | null
  const [isCancelling, setIsCancelling] = useState(false);
  // Atualizar valor
  const [monthlyValue, setMonthlyValue] = useState(150);
  const [showValueDialog, setShowValueDialog] = useState(false);
  const [applyToCurrent, setApplyToCurrent] = useState(false);
  const [isUpdatingValue, setIsUpdatingValue] = useState(false);
  const [creatingAsaas, setCreatingAsaas] = useState({});
  const [creatingAll, setCreatingAll] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [revealedCpfs, setRevealedCpfs] = useState({});
  const mountedRef = useRef(true);

  function maskCpfCnpj(value, franchiseId) {
    if (!value) return "—";
    if (revealedCpfs[franchiseId]) return formatCpfCnpj(value);
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }

  function toggleCpfReveal(franchiseId) {
    setRevealedCpfs(prev => ({ ...prev, [franchiseId]: !prev[franchiseId] }));
  }

  const loadData = useCallback(async () => {
    try {
      const [fRes, cRes, sRes] = await Promise.allSettled([
        Franchise.list("name", null, { columns: "id,name,owner_name,city,phone_number,evolution_instance_id,cpf_cnpj,state_uf,address_number,neighborhood,status,billing_email" }),
        FranchiseConfiguration.list(null, null, { columns: "franchise_evolution_instance_id,street_address,cep,franchise_name" }),
        SystemSubscription.list(null, null, { columns: "*" }),
      ]);
      if (!mountedRef.current) return;
      setFranchises(fRes.status === "fulfilled" ? fRes.value : []);
      setConfigs(cRes.status === "fulfilled" ? cRes.value : []);
      setSubscriptions(sRes.status === "fulfilled" ? sRes.value : []);
    } catch (err) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  const getConfig = (evoId) => configs.find(c => c.franchise_evolution_instance_id === evoId);
  const getSub = (evoId) => subscriptions.find(s => s.franchise_id === evoId);

  const activeFranchises = franchises.filter(f => f.status === "active");

  const handleSaveEmail = async (franchise) => {
    const email = (editingEmail[franchise.id] || "").trim();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Email inválido");
      return;
    }
    setSavingEmail(prev => ({ ...prev, [franchise.id]: true }));
    try {
      await Franchise.update(franchise.id, { billing_email: email });
      setFranchises(prev => prev.map(f => f.id === franchise.id ? { ...f, billing_email: email } : f));
      setEditingEmail(prev => { const n = { ...prev }; delete n[franchise.id]; return n; });
      toast.success(`Email salvo para ${franchise.name}`);
    } catch (err) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingEmail(prev => ({ ...prev, [franchise.id]: false }));
    }
  };

  const handleSaveCpf = async (franchise) => {
    const cpf = editingCpf[franchise.id];
    if (!cpf) return;
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error("CPF deve ter 11 dígitos ou CNPJ 14 dígitos");
      return;
    }
    setSavingCpf(prev => ({ ...prev, [franchise.id]: true }));
    try {
      await Franchise.update(franchise.id, { cpf_cnpj: digits });
      setFranchises(prev => prev.map(f => f.id === franchise.id ? { ...f, cpf_cnpj: digits } : f));
      setEditingCpf(prev => { const n = { ...prev }; delete n[franchise.id]; return n; });
      toast.success(`CPF/CNPJ salvo para ${franchise.name}`);
    } catch (err) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingCpf(prev => ({ ...prev, [franchise.id]: false }));
    }
  };

  const handleCreateAsaas = async (franchise) => {
    const evoId = franchise.evolution_instance_id;
    setCreatingAsaas(prev => ({ ...prev, [evoId]: true }));
    try {
      const { error } = await supabase.functions.invoke("asaas-billing", {
        body: { action: "register", franchise_id: evoId },
      });
      if (error) throw error;
      toast.success(`${franchise.name} cadastrado no ASAAS`);
      // Reload data after a short delay for n8n to process
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      toast.error("Erro ao cadastrar no ASAAS: " + err.message);
    } finally {
      setCreatingAsaas(prev => ({ ...prev, [evoId]: false }));
    }
  };

  const handleCreateAllSubscriptions = async () => {
    setCreatingAll(true);
    try {
      const { error } = await supabase.functions.invoke("asaas-billing", {
        body: { action: "subscribe-batch", value: monthlyValue },
      });
      if (error) throw error;
      toast.success(`Assinaturas criadas a R$ ${monthlyValue.toFixed(2)}!`);
      setShowReview(false);
      setTimeout(() => loadData(), 5000);
    } catch (err) {
      toast.error("Erro ao criar assinaturas: " + err.message);
    } finally {
      setCreatingAll(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancellingSub) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("asaas-billing", {
        body: { action: "cancel-subscription", franchise_id: cancellingSub.evolution_instance_id },
      });
      if (error) throw error;
      toast.success(`Assinatura de ${cancellingSub.name} cancelada`);
      setCancellingSub(null);
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      toast.error("Erro ao cancelar: " + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateValue = async () => {
    if (!Number.isFinite(monthlyValue) || monthlyValue < 5 || monthlyValue > 5000) {
      toast.error("Valor deve estar entre R$ 5 e R$ 5.000");
      return;
    }
    setIsUpdatingValue(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-billing", {
        body: {
          action: "update-subscription-value",
          all_active: true,
          new_value: monthlyValue,
          apply_to_current: applyToCurrent,
        },
      });
      if (error) throw error;
      const updated = data?.updated ?? 0;
      const total = data?.total ?? 0;
      toast.success(`${updated}/${total} assinaturas atualizadas para R$ ${monthlyValue.toFixed(2)}`);
      setShowValueDialog(false);
      setApplyToCurrent(false);
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      toast.error("Erro ao atualizar valor: " + err.message);
    } finally {
      setIsUpdatingValue(false);
    }
  };

  // Helper: franquia tem todos os campos necessários para ASAAS?
  const getMissing = (f) => missingFiscalFields(f, getConfig(f.evolution_instance_id));
  const isFiscalComplete = (f) => getMissing(f).length === 0;

  // Stats
  const totalActive = activeFranchises.length;
  const fiscalComplete = activeFranchises.filter(isFiscalComplete).length;
  const registered = activeFranchises.filter(f => getSub(f.evolution_instance_id)?.asaas_customer_id).length;
  const withSubscription = activeFranchises.filter(f => getSub(f.evolution_instance_id)?.asaas_subscription_id).length;
  const pendingRegister = activeFranchises.filter(f => isFiscalComplete(f) && !getSub(f.evolution_instance_id)?.asaas_customer_id);
  const hasAnyActiveSub = activeFranchises.some(f => {
    const s = getSub(f.evolution_instance_id);
    return s?.asaas_subscription_id && s?.subscription_status !== "CANCELLED";
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Review screen before creating subscriptions
  if (showReview) {
    const readyForSubscription = activeFranchises.filter(f => {
      const sub = getSub(f.evolution_instance_id);
      return sub?.asaas_customer_id && !sub?.asaas_subscription_id;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowReview(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <MaterialIcon icon="arrow_back" size={20} />
          </button>
          <h2 className="text-lg font-semibold font-plus-jakarta">Confirmar Assinaturas</h2>
        </div>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <MaterialIcon icon="info" size={20} className="text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Revise antes de confirmar</p>
              <p>Serão criadas {readyForSubscription.length} assinaturas de R$ 150,00/mês com vencimento no dia 5.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {readyForSubscription.map(f => {
            const config = getConfig(f.evolution_instance_id);
            return (
              <Card key={f.id} className="bg-white">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                      {f.owner_name} —{" "}
                      {maskCpfCnpj(f.cpf_cnpj, f.evolution_instance_id || f.id)}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleCpfReveal(f.evolution_instance_id || f.id); }}
                        className="text-[#4a3d3d]/40 hover:text-[#4a3d3d]/70 transition-colors"
                        title={revealedCpfs[f.evolution_instance_id || f.id] ? "Ocultar" : "Revelar"}
                      >
                        <MaterialIcon icon={revealedCpfs[f.evolution_instance_id || f.id] ? "visibility_off" : "visibility"} size={14} />
                      </button>
                    </p>
                    <p className="text-xs text-gray-400">{config?.street_address || f.city}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">R$ 150,00</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {readyForSubscription.length > 0 ? (
          <Button
            onClick={handleCreateAllSubscriptions}
            disabled={creatingAll}
            className="w-full bg-[#b91c1c] hover:bg-[#991b1b] text-white"
          >
            {creatingAll ? (
              <>
                <MaterialIcon icon="sync" size={18} className="animate-spin mr-2" />
                Criando assinaturas...
              </>
            ) : (
              <>
                <MaterialIcon icon="send" size={18} className="mr-2" />
                Criar {readyForSubscription.length} assinaturas
              </>
            )}
          </Button>
        ) : (
          <p className="text-center text-sm text-gray-500">Nenhum franqueado pronto para assinatura. Cadastre no ASAAS primeiro.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Franquias ativas", value: totalActive, icon: "store", color: "#1b1c1d" },
          { label: "Dados fiscais completos", value: `${fiscalComplete}/${totalActive}`, icon: "fact_check", color: fiscalComplete === totalActive ? "#16a34a" : "#d4af37" },
          { label: "No ASAAS", value: `${registered}/${totalActive}`, icon: "cloud_done", color: registered === totalActive ? "#16a34a" : "#d4af37" },
          { label: "Com assinatura", value: `${withSubscription}/${totalActive}`, icon: "autorenew", color: withSubscription === totalActive ? "#16a34a" : "#d4af37" },
        ].map(stat => (
          <Card key={stat.label} className="bg-white">
            <CardContent className="p-3 text-center">
              <MaterialIcon icon={stat.icon} size={24} className="mx-auto mb-1" style={{ color: stat.color }} />
              <p className="text-lg font-semibold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-end gap-2 mr-auto">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Mensalidade (R$)</label>
            <Input
              type="number"
              min="5"
              max="5000"
              step="0.01"
              value={monthlyValue}
              onChange={e => setMonthlyValue(parseFloat(e.target.value) || 0)}
              className="h-9 w-32 text-sm"
            />
          </div>
          {hasAnyActiveSub && (
            <Button
              onClick={() => setShowValueDialog(true)}
              variant="outline"
              size="sm"
              className="h-9"
              title="Aplicar esse valor em todas as assinaturas ativas"
            >
              <MaterialIcon icon="price_change" size={16} className="mr-1" />
              Atualizar valor de todos
            </Button>
          )}
        </div>
        {pendingRegister.length > 0 && (
          <Button
            onClick={async () => {
              setCreatingAll(true);
              try {
                const { error } = await supabase.functions.invoke("asaas-billing", {
                  body: {
                    action: "register-batch",
                    franchise_ids: pendingRegister.map(f => f.evolution_instance_id),
                  },
                });
                if (error) throw error;
                toast.success(`${pendingRegister.length} franqueados enviados para cadastro no ASAAS`);
                setTimeout(() => loadData(), 5000);
              } catch (err) {
                toast.error("Erro no cadastro batch: " + err.message);
              } finally {
                setCreatingAll(false);
              }
            }}
            variant="outline"
            size="sm"
            disabled={creatingAll}
          >
            <MaterialIcon icon={creatingAll ? "sync" : "cloud_upload"} size={16} className={`mr-1 ${creatingAll ? "animate-spin" : ""}`} />
            {creatingAll ? "Cadastrando..." : `Cadastrar ${pendingRegister.length} pendentes no ASAAS`}
          </Button>
        )}
        <Button onClick={() => setShowReview(true)} variant="outline" size="sm">
          <MaterialIcon icon="autorenew" size={16} className="mr-1" />
          Criar assinaturas
        </Button>
        <Button onClick={loadData} variant="ghost" size="sm">
          <MaterialIcon icon="refresh" size={16} className="mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Franchise table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Franquia</th>
              <th className="pb-2 font-medium">CPF/CNPJ</th>
              <th className="pb-2 font-medium">Email cobrança</th>
              <th className="pb-2 font-medium">Endereço</th>
              <th className="pb-2 font-medium">ASAAS</th>
              <th className="pb-2 font-medium">Assinatura</th>
              <th className="pb-2 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {activeFranchises.map(f => {
              const config = getConfig(f.evolution_instance_id);
              const sub = getSub(f.evolution_instance_id);
              const isEditingThis = f.id in editingCpf;

              return (
                <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-gray-500">{f.owner_name}</p>
                  </td>
                  <td className="py-3">
                    {f.cpf_cnpj && !isEditingThis ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingCpf(prev => ({ ...prev, [f.id]: f.cpf_cnpj }))}
                          className="text-sm hover:underline cursor-pointer"
                        >
                          {maskCpfCnpj(f.cpf_cnpj, f.evolution_instance_id || f.id)}
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleCpfReveal(f.evolution_instance_id || f.id); }}
                          className="text-[#4a3d3d]/40 hover:text-[#4a3d3d]/70 transition-colors"
                          title={revealedCpfs[f.evolution_instance_id || f.id] ? "Ocultar" : "Revelar"}
                        >
                          <MaterialIcon icon={revealedCpfs[f.evolution_instance_id || f.id] ? "visibility_off" : "visibility"} size={14} />
                        </button>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          value={formatCpfCnpj(editingCpf[f.id] || "")}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 14);
                            setEditingCpf(prev => ({ ...prev, [f.id]: digits }));
                          }}
                          placeholder="000.000.000-00"
                          className="h-8 w-40 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveCpf(f)}
                          disabled={savingCpf[f.id]}
                          className="h-8 w-8 p-0"
                        >
                          <MaterialIcon icon={savingCpf[f.id] ? "sync" : "check"} size={16} className={savingCpf[f.id] ? "animate-spin" : "text-[#16a34a]"} />
                        </Button>
                        {f.cpf_cnpj && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingCpf(prev => { const n = { ...prev }; delete n[f.id]; return n; })}
                            className="h-8 w-8 p-0"
                          >
                            <MaterialIcon icon="close" size={16} className="text-gray-400" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    {f.billing_email && !(f.id in editingEmail) ? (
                      <button
                        onClick={() => setEditingEmail(prev => ({ ...prev, [f.id]: f.billing_email }))}
                        className="text-xs hover:underline cursor-pointer max-w-[180px] truncate text-left"
                        title={f.billing_email}
                      >
                        {f.billing_email}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          type="email"
                          value={editingEmail[f.id] || ""}
                          onChange={e => setEditingEmail(prev => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder="email@exemplo.com"
                          className="h-8 w-52 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEmail(f)}
                          disabled={savingEmail[f.id]}
                          className="h-8 w-8 p-0"
                        >
                          <MaterialIcon icon={savingEmail[f.id] ? "sync" : "check"} size={16} className={savingEmail[f.id] ? "animate-spin" : "text-[#16a34a]"} />
                        </Button>
                        {f.billing_email && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingEmail(prev => { const n = { ...prev }; delete n[f.id]; return n; })}
                            className="h-8 w-8 p-0"
                          >
                            <MaterialIcon icon="close" size={16} className="text-gray-400" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <p className="text-xs text-gray-600 max-w-[200px] truncate">
                      {config?.street_address || "—"}
                      {f.address_number ? `, ${f.address_number}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">{f.city}{f.state_uf ? ` - ${f.state_uf}` : ""}</p>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={sub?.subscription_status} asaasId={sub?.asaas_customer_id} cpfCnpj={f.cpf_cnpj} />
                  </td>
                  <td className="py-3">
                    <SubscriptionBadge sub={sub} />
                  </td>
                  <td className="py-3">
                    {(() => {
                      // Se tem sub ativa → botão Cancelar (cinza)
                      if (sub?.asaas_subscription_id) {
                        return (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCancellingSub(f)}
                            className="h-7 text-xs text-gray-500 hover:text-[#dc2626] hover:bg-[#dc2626]/5"
                            title="Cancelar assinatura"
                          >
                            <MaterialIcon icon="block" size={14} className="mr-1" />
                            Cancelar
                          </Button>
                        );
                      }
                      // Customer criado mas sem sub → nenhum botão individual (subscribe-batch cria)
                      if (sub?.asaas_customer_id) return null;
                      // Sem customer: verifica campos fiscais
                      const missing = getMissing(f);
                      if (missing.length > 0) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-[#d4af37]"
                            title={`Faltam: ${missing.join(", ")}`}
                          >
                            <MaterialIcon icon="warning" size={14} />
                            Faltam {missing.length} campo{missing.length > 1 ? "s" : ""}
                          </span>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateAsaas(f)}
                          disabled={creatingAsaas[f.evolution_instance_id]}
                          className="h-7 text-xs"
                        >
                          {creatingAsaas[f.evolution_instance_id] ? (
                            <MaterialIcon icon="sync" size={14} className="animate-spin" />
                          ) : (
                            "Criar"
                          )}
                        </Button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog: cancelar assinatura */}
      <Dialog
        open={!!cancellingSub}
        onOpenChange={(open) => { if (!open && !isCancelling) setCancellingSub(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-[#dc2626]">
              <MaterialIcon icon="block" size={20} />
              Cancelar assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3 text-sm text-[#4a3d3d]">
            <p>
              Confirmar cancelamento da assinatura de{" "}
              <strong>{cancellingSub?.name}</strong>?
            </p>
            <ul className="space-y-1 text-xs list-disc list-inside bg-gray-50 p-3 rounded-lg">
              <li>Cobrança recorrente mensal será encerrada no ASAAS</li>
              <li>Fatura pendente do mês também será cancelada</li>
              <li>Cliente ASAAS será mantido (permite recriar assinatura depois)</li>
              <li className="font-semibold text-[#b91c1c]">A franquia NÃO será desativada</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setCancellingSub(null)}
              disabled={isCancelling}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold rounded-xl"
            >
              {isCancelling ? (
                <>
                  <MaterialIcon icon="sync" size={16} className="animate-spin mr-2" />
                  Cancelando...
                </>
              ) : (
                "Sim, cancelar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: atualizar valor da mensalidade */}
      <Dialog
        open={showValueDialog}
        onOpenChange={(open) => {
          if (!open && !isUpdatingValue) {
            setShowValueDialog(false);
            setApplyToCurrent(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="price_change" size={20} />
              Atualizar valor da mensalidade
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4 text-sm text-[#4a3d3d]">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              Serão atualizadas <strong>{withSubscription}</strong> franquias com assinatura ativa para <strong>R$ {monthlyValue.toFixed(2)}</strong>.
            </div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <Checkbox
                checked={applyToCurrent}
                onCheckedChange={(v) => setApplyToCurrent(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs">
                <strong className="block">Aplicar também à fatura pendente do mês atual</strong>
                <span className="text-[#4a3d3d]/70">
                  Refaz fatura + gera PIX novo. Se desmarcado, só próximos ciclos usam o novo valor.
                </span>
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setShowValueDialog(false); setApplyToCurrent(false); }}
              disabled={isUpdatingValue}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateValue}
              disabled={isUpdatingValue}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
            >
              {isUpdatingValue ? (
                <>
                  <MaterialIcon icon="sync" size={16} className="animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                "Confirmar atualização"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
