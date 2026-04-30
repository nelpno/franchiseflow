import { useEffect, useState } from "react";
import { FranchiseConfiguration } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import FranchiseForm from "@/components/franchises/FranchiseForm";
import { saveFiscalData, missingFiscalFields } from "@/lib/saveFiscalData";

// Gate do onboarding: se a franquia não tem todos os dados fiscais (email, CPF, endereço completo),
// bloqueia o acesso ao checklist e pede que o franqueado complete.
// Reusa FranchiseForm no modo "fiscal-only".
//
// Props:
//   franchise: objeto da franquia (já carregado pelo Onboarding.jsx)
//   onReady(): callback chamado quando a franquia passa a ter dados completos
//              (parent deve recarregar os dados da franquia para liberar o checklist)
export default function FiscalDataGate({ franchise, onReady }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const configs = await FranchiseConfiguration.filter({
          franchise_evolution_instance_id: franchise.evolution_instance_id,
        });
        if (!cancelled) setConfig(configs[0] || null);
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [franchise.evolution_instance_id]);

  if (loading) return null;

  const missing = missingFiscalFields(franchise, config);
  if (missing.length === 0) return null; // sem gate — segue direto para o checklist

  const initialData = {
    name: franchise.name,
    owner_name: franchise.owner_name,
    city: franchise.city,
    status: franchise.status,
    billing_email: franchise.billing_email,
    cpf_cnpj: franchise.cpf_cnpj,
    cep: config?.cep,
    street_address: config?.street_address,
    address_number: franchise.address_number,
    address_complement: franchise.address_complement,
    neighborhood: franchise.neighborhood,
    state_uf: franchise.state_uf,
  };

  const handleSubmit = async (franchiseData, _email, addressExtras) => {
    setSaving(true);
    try {
      await saveFiscalData(franchise.id, franchise.evolution_instance_id, {
        billing_email: franchiseData.billing_email,
        cpf_cnpj: franchiseData.cpf_cnpj,
        address_number: franchiseData.address_number,
        address_complement: franchiseData.address_complement,
        neighborhood: franchiseData.neighborhood,
        state_uf: franchiseData.state_uf,
        city: franchiseData.city,
        cep: addressExtras?.cep,
        street_address: addressExtras?.street_address,
      });
      toast.success("Dados fiscais salvos!");
      onReady?.();
    } catch (err) {
      toast.error("Erro ao salvar: " + (err?.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-[#d4af37]/10 border-[#d4af37]/30">
        <CardContent className="p-4 flex items-start gap-3">
          <MaterialIcon icon="info" size={20} className="text-[#775a19] mt-0.5 shrink-0" />
          <div className="text-sm text-[#775a19]">
            <p className="font-semibold">Antes de começar, precisamos dos seus dados fiscais.</p>
            <p className="mt-1">
              São usados na mensalidade (ASAAS) e na emissão de notas fiscais.
              Complete para liberar as missões.
            </p>
          </div>
        </CardContent>
      </Card>

      <FranchiseForm
        mode="fiscal-only"
        initialData={initialData}
        onSubmit={handleSubmit}
        isSubmitting={saving}
      />
    </div>
  );
}
