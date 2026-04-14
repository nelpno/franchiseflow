import { useState, useEffect, useCallback, useRef } from "react";
import { Franchise, FranchiseConfiguration, SystemSubscription } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";

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
  return <span className="text-xs text-gray-400">{status || "—"}</span>;
}

export default function AsaasSetupPanel() {
  const [franchises, setFranchises] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCpf, setEditingCpf] = useState({});
  const [savingCpf, setSavingCpf] = useState({});
  const [creatingAsaas, setCreatingAsaas] = useState({});
  const [creatingAll, setCreatingAll] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    try {
      const [fRes, cRes, sRes] = await Promise.allSettled([
        Franchise.list("name", null, { columns: "id,name,owner_name,city,phone_number,evolution_instance_id,cpf_cnpj,state_uf,address_number,neighborhood,status" }),
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
        body: { action: "subscribe-batch" },
      });
      if (error) throw error;
      toast.success("Assinaturas criadas com sucesso!");
      setShowReview(false);
      setTimeout(() => loadData(), 5000);
    } catch (err) {
      toast.error("Erro ao criar assinaturas: " + err.message);
    } finally {
      setCreatingAll(false);
    }
  };

  // Stats
  const totalActive = activeFranchises.length;
  const withCpf = activeFranchises.filter(f => f.cpf_cnpj).length;
  const registered = activeFranchises.filter(f => getSub(f.evolution_instance_id)?.asaas_customer_id).length;
  const withSubscription = activeFranchises.filter(f => getSub(f.evolution_instance_id)?.asaas_subscription_id).length;
  const pendingRegister = activeFranchises.filter(f => f.cpf_cnpj && !getSub(f.evolution_instance_id)?.asaas_customer_id);

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
                    <p className="text-xs text-gray-500">{f.owner_name} — {formatCpfCnpj(f.cpf_cnpj)}</p>
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
          { label: "Com CPF/CNPJ", value: `${withCpf}/${totalActive}`, icon: "badge", color: withCpf === totalActive ? "#16a34a" : "#d4af37" },
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
      <div className="flex flex-wrap gap-2">
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
                      <button
                        onClick={() => setEditingCpf(prev => ({ ...prev, [f.id]: f.cpf_cnpj }))}
                        className="text-sm hover:underline cursor-pointer"
                      >
                        {formatCpfCnpj(f.cpf_cnpj)}
                      </button>
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
                    {f.cpf_cnpj && !sub?.asaas_customer_id && (
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
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
