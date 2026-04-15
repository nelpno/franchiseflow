import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FranchiseConfiguration, Franchise, User } from "@/entities/all";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { PAYMENT_METHODS, DELIVERY_METHODS, PIX_KEY_TYPES } from "@/lib/franchiseUtils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

import WhatsAppConnectionModal from "../components/whatsapp/WhatsAppConnectionModal";
import ErrorBoundary from "../components/ErrorBoundary";
import WizardStepper from "@/components/vendedor/WizardStepper";
import WizardStep from "@/components/vendedor/WizardStep";
import DeliveryFeeEditor from "@/components/vendedor/DeliveryFeeEditor";
import DeliveryScheduleEditor from "@/components/vendedor/DeliveryScheduleEditor";
import ReviewSummary from "@/components/vendedor/ReviewSummary";
import OperatingHoursEditor from "@/components/vendedor/OperatingHoursEditor";
import CatalogUpload from "@/components/vendedor/CatalogUpload";
import { ToggleCard, RadioCards, PaymentChipsMulti } from "@/components/vendedor/WizardFields";
import useWhatsAppConnection from "@/hooks/useWhatsAppConnection";

const initialFormData = {
  franchise_evolution_instance_id: '',
  franchise_name: '',
  accepted_payment_methods: '',
  opening_hours: '',
  working_days: '',
  operating_hours: [],
  price_table_url: '',
  agent_name: '',
  promotions_combo: '',
  shipping_rules_costs: '',
  unit_address: '',
  address_reference: '',
  pix_key_data: '',
  personal_phone_for_summary: '',
  payment_link: '',
  social_media_links: { instagram: '' },
  max_delivery_radius_km: null,
  min_order_value: null,
  avg_prep_time_minutes: null,
  welcome_message: '',
  // New wizard fields (may not exist in DB yet)
  has_delivery: true,
  has_pickup: false,
  pickup_requires_scheduling: true,
  delivery_method: '',
  payment_delivery: [],
  payment_pickup: [],
  delivery_fee_rules: [{ max_km: '', fee: '' }],
  pix_key_type: '',
  pix_holder_name: '',
  pix_bank: '',
  city: '',
  neighborhood: '',
  order_cutoff_time: '',
  delivery_start_time: '',
  charges_delivery_fee: true,
  delivery_schedule: [],
  catalog_image_url: '',
  payment_fees: null,
  bot_personality: '',
  facebook_page_id: '',
};

const inputClass = "w-full bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none";
const labelClass = "block text-xs font-semibold text-[#3d4a42] mb-2";

function FieldHint({ text }) {
  return (
    <p className="text-[11px] text-[#4a3d3d]/70 mt-1.5 flex items-start gap-1">
      <MaterialIcon icon="info" size={12} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

function RequiredDot() {
  return <span className="text-[#b91c1c] ml-0.5">*</span>;
}

function FranchiseSettingsContent() {
  const [configurations, setConfigurations] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [displayConfigurations, setDisplayConfigurations] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const updateConfigurationStatus = useCallback((configId, updates) => {
    setConfigurations((prev) => prev.map((config) =>
      config.id === configId ? { ...config, ...updates } : config
    ));
  }, []);

  const {
    isConnectingWhatsApp, showWhatsAppModal, isCheckingStatus,
    checkingStatusFor, modalData,
    handleConnectWhatsApp, handleCheckWhatsAppStatus,
    handleCloseModalAndCheckStatus, handleCheckStatusFromBadge,
  } = useWhatsAppConnection({ currentUser, updateConfigurationStatus });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        FranchiseConfiguration.list(),
        Franchise.list(),
        User.me()
      ]);

      const configsData = results[0].status === "fulfilled" ? results[0].value : [];
      const franchisesData = results[1].status === "fulfilled" ? results[1].value : [];
      const currentUserData = results[2].status === "fulfilled" ? results[2].value : null;

      const failedQueries = results
        .map((r, i) => r.status === "rejected" ? ["configs","franchises","user"][i] : null)
        .filter(Boolean);
      if (failedQueries.length > 0) {
        console.warn("Queries parcialmente falharam:", failedQueries);
        toast.error(`Alguns dados não carregaram: ${failedQueries.join(", ")}`);
      }

      setConfigurations(configsData);
      setFranchises(franchisesData);
      if (currentUserData) setCurrentUser(currentUserData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações. Por favor, recarregue a página.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isLoading && currentUser && franchises.length > 0 && configurations.length > 0) {
      const availableFranchises = (currentUser.role === 'admin' || currentUser.role === 'manager')
        ? franchises
        : franchises.filter((f) =>
            currentUser.managed_franchise_ids?.includes(f.id) ||
            currentUser.managed_franchise_ids?.includes(f.evolution_instance_id)
          );

      const availableFranchiseIds = availableFranchises.map(f => f.evolution_instance_id);
      const filteredConfigs = configurations.filter(config =>
        availableFranchiseIds.includes(config.franchise_evolution_instance_id)
      );

      const configsToDisplay = filteredConfigs.map(config => {
        const franchise = availableFranchises.find(f => f.evolution_instance_id === config.franchise_evolution_instance_id);
        return { ...config, franchise };
      });

      setDisplayConfigurations(configsToDisplay);

      if (!selectedConfigId && configsToDisplay.length > 0) {
        const first = configsToDisplay[0];
        setSelectedConfigId(first.id);
        loadConfigIntoForm(first);
      }
    } else if (!isLoading && currentUser) {
      setDisplayConfigurations([]);
    }
  }, [isLoading, currentUser, franchises, configurations]);

  // Auto-check WhatsApp status when config is selected/loaded
  useEffect(() => {
    if (currentConfig && currentConfig.franchise_evolution_instance_id && !checkingStatusFor) {
      handleCheckStatusFromBadge(currentConfig);
    }
  }, [selectedConfigId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const loadConfigIntoForm = (config) => {
    setEditingConfig(config);

    const baseData = {
      ...initialFormData,
      ...config,
      accepted_payment_methods: Array.isArray(config.accepted_payment_methods)
        ? config.accepted_payment_methods.join(', ')
        : config.accepted_payment_methods || '',
      address_reference: config.address_reference || '',
      social_media_links: { instagram: config.social_media_links?.instagram || '' },
      franchise_name: config.franchise_name || '',
      working_days: config.working_days || '',
      max_delivery_radius_km: config.max_delivery_radius_km ?? null,
      min_order_value: config.min_order_value ?? null,
      avg_prep_time_minutes: config.avg_prep_time_minutes ?? null,
      welcome_message: config.welcome_message || '',
      has_delivery: config.has_delivery ?? true,
      has_pickup: config.has_pickup ?? false,
      delivery_method: config.delivery_method || '',
      payment_delivery: config.payment_delivery || [],
      payment_pickup: config.payment_pickup || [],
      delivery_fee_rules: config.delivery_fee_rules || [{ max_km: '', fee: '' }],
      delivery_schedule: config.delivery_schedule || [],
      pix_key_type: config.pix_key_type || '',
      order_cutoff_time: config.order_cutoff_time || '',
      bot_personality: config.bot_personality || '',
      operating_hours: config.operating_hours || [],
      pix_holder_name: config.pix_holder_name || '',
      pix_bank: config.pix_bank || '',
      city: config.city || '',
      neighborhood: config.neighborhood || '',
      street_address: config.street_address || config.unit_address || '',
      cep: config.cep || '',
      pickup_schedule: config.pickup_schedule || [],
      has_custom_pickup_hours: config.has_custom_pickup_hours ?? false,
      pickup_requires_scheduling: config.pickup_requires_scheduling ?? true,
      catalog_image_url: config.catalog_image_url || '',
      facebook_page_id: config.facebook_page_id || '',
      payment_fees: config.payment_fees || null,
    };

    // Restore draft from localStorage only for franchisees (admin edits directly, no drafts)
    if (currentUser?.role !== 'admin') {
      const draftKey = `wizard_draft_${config.franchise_evolution_instance_id}`;
      try {
        const draftRaw = localStorage.getItem(draftKey);
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          const maxDraftAge = 24 * 60 * 60 * 1000; // 24h max
          const draftAge = Date.now() - (draft.savedAt || 0);
          // If updated_at missing, treat config as "just now" to avoid stale drafts overriding
          const configUpdatedAt = config.updated_at ? new Date(config.updated_at).getTime() : Date.now();

          if (draftAge < maxDraftAge && draft.savedAt > configUpdatedAt) {
            setFormData({ ...baseData, ...draft.data });
            setCurrentStep(draft.step || 1);
            setIsDirty(true);
            toast.info("Rascunho restaurado. Suas alterações não salvas foram recuperadas.", { duration: 5000 });
            return;
          } else {
            localStorage.removeItem(draftKey);
          }
        }
      } catch { /* corrupted draft — ignore */ }
    }

    setFormData(baseData);
    setIsDirty(false);
  };

  const [pendingConfigId, setPendingConfigId] = useState(null);

  const handleSelectConfig = (configId) => {
    if (isDirty) {
      setPendingConfigId(configId);
      return;
    }
    applyConfigSelection(configId);
  };

  const applyConfigSelection = (configId) => {
    const config = displayConfigurations.find(c => c.id === configId);
    if (config) {
      setSelectedConfigId(configId);
      loadConfigIntoForm(config);
      setCurrentStep(1);
    }
    setPendingConfigId(null);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return; // Prevent double-click
    setIsSubmitting(true);

    // Show slow-save warning after 8s
    const slowTimer = setTimeout(() => {
      toast.info("Salvamento em andamento... A conexão está lenta.");
    }, 8000);

    // Strip UI-only / read-only fields before sending to DB
    const { id, created_at, updated_at, franchise, whatsapp_status, whatsapp_qr, ...dbFields } = formData;

    // Build unit_address from structured fields
    const streetPart = (dbFields.street_address || '').trim();
    const neighborhoodPart = (dbFields.neighborhood || '').trim();
    const cityPart = (dbFields.city || '').trim();
    const cepPart = (dbFields.cep || '').trim();
    const assembledAddress = [streetPart, neighborhoodPart, cityPart].filter(Boolean).join(', ')
      + (cepPart ? ` - ${cepPart}` : '');

    const finalData = {
      ...dbFields,
      unit_address: assembledAddress,
      accepted_payment_methods: typeof dbFields.accepted_payment_methods === 'string' ?
        dbFields.accepted_payment_methods :
        Array.isArray(dbFields.accepted_payment_methods) ?
          dbFields.accepted_payment_methods.join(', ') : '',
      address_reference: dbFields.address_reference || '',
      personal_phone_for_summary: dbFields.personal_phone_for_summary
        ? dbFields.personal_phone_for_summary.replace(/\D/g, '')
        : ''
    };

    try {
      if (editingConfig) {
        await FranchiseConfiguration.update(editingConfig.id, finalData);
        updateConfigurationStatus(editingConfig.id, finalData);
      } else {
        const newConfig = await FranchiseConfiguration.create(finalData);
        setConfigurations((prev) => [...prev, newConfig]);
      }
      setIsDirty(false);
      setLastSavedAt(new Date());
      // Clear draft from localStorage after successful save
      const draftKey = `wizard_draft_${editingConfig?.franchise_evolution_instance_id || formData.franchise_evolution_instance_id}`;
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      const msg = safeErrorMessage(error, "Falha ao salvar configurações.");
      toast.error(msg, error?.message?.includes("Tempo limite") ? { duration: 6000 } : undefined);
    } finally {
      clearTimeout(slowTimer);
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-save draft to localStorage only for franchisees (admin edits directly)
      if (currentUser?.role !== 'admin') {
        const draftKey = `wizard_draft_${editingConfig?.franchise_evolution_instance_id || 'new'}`;
        try {
          const draftData = { ...updated };
          delete draftData.pix_key;
          delete draftData.cpf_cnpj;
          delete draftData.asaas_customer_id;
          delete draftData.asaas_subscription_id;
          localStorage.setItem(draftKey, JSON.stringify({ data: draftData, step: currentStep, savedAt: Date.now() }));
        } catch { /* quota exceeded — ignore */ }
      }
      return updated;
    });
    setIsDirty(true);
  };


  const availableFranchisesForUser = useMemo(() => {
    if (!currentUser) return [];
    return (currentUser.role === 'admin' || currentUser.role === 'manager') ?
      franchises :
      franchises.filter((f) =>
        currentUser.managed_franchise_ids?.includes(f.id) ||
        currentUser.managed_franchise_ids?.includes(f.evolution_instance_id)
      );
  }, [currentUser, franchises]);

  const configuredInstanceIds = configurations.map((c) => c.franchise_evolution_instance_id);
  const franchisesWithoutConfig = availableFranchisesForUser.filter((f) => !configuredInstanceIds.includes(f.evolution_instance_id));

  const currentConfig = displayConfigurations.find(c => c.id === selectedConfigId);
  const currentFranchise = currentConfig?.franchise;
  const whatsappStatus = currentConfig?.whatsapp_status || 'disconnected';
  const isConnected = whatsappStatus === 'connected';

  const getLastSavedText = () => {
    if (!lastSavedAt) return null;
    const diffMs = Date.now() - lastSavedAt.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Salvo agora.";
    return `Salvo há ${diffMin} min.`;
  };

  // Determine which steps to skip
  const hasDelivery = formData.has_delivery ?? true;
  const hasPickup = formData.has_pickup ?? false;
  const skippedSteps = [
    ...(!hasDelivery ? [3] : []),
  ];

  // Determine completed steps (basic validation)
  const completedSteps = useMemo(() => {
    const done = [];
    if (formData.franchise_name && formData.street_address && formData.neighborhood && formData.city) done.push(1);
    // Step 2: Operação e Pagamentos
    const deliveryPaymentOk = !hasDelivery || (formData.payment_delivery?.length > 0);
    const pickupPaymentOk = !hasPickup || (formData.payment_pickup?.length > 0);
    if (formData.has_delivery !== undefined && deliveryPaymentOk && pickupPaymentOk) done.push(2);
    // Step 3: Entrega (only when hasDelivery — pickup hours moved to Step 2)
    if (hasDelivery) {
      if (formData.max_delivery_radius_km) done.push(3);
    } else {
      done.push(3); // Skipped step counts as done
    }
    if (formData.agent_name) done.push(4);
    return done;
  }, [formData, hasDelivery, hasPickup]);

  const goToStep = (step) => {
    if (skippedSteps.includes(step)) return;
    setCurrentStep(step);
    // Persist current step in draft only for franchisees
    if (currentUser?.role !== 'admin') {
      const draftKey = `wizard_draft_${editingConfig?.franchise_evolution_instance_id}`;
      try {
        const draftRaw = localStorage.getItem(draftKey);
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          draft.step = step;
          localStorage.setItem(draftKey, JSON.stringify(draft));
        }
      } catch { /* ignore */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    let next = currentStep + 1;
    while (next <= 5 && skippedSteps.includes(next)) next++;
    if (next <= 5) goToStep(next);
  };

  const prevStep = () => {
    let prev = currentStep - 1;
    while (prev >= 1 && skippedSteps.includes(prev)) prev--;
    if (prev >= 1) goToStep(prev);
  };

  // Disabled payment methods for third-party delivery
  const thirdPartyDisabledPayments = formData.delivery_method === 'third_party'
    ? ['card_machine', 'cash']
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-[#3d4a42]">
          <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-[#b91c1c]" />
          <span className="text-sm font-medium">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  if (displayConfigurations.length === 0 && !isLoading) {
    return (
      <div className="px-4 md:px-8 pt-12">
        <div className="max-w-4xl mx-auto text-center py-24">
          <MaterialIcon icon="info" filled size={64} className="text-[#bccac0] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1b1c1d] mb-2">Nenhuma configuração encontrada</h3>
          <p className="text-[#3d4a42]/60 mb-6">Comece adicionando a primeira configuração de franquia.</p>
          {franchisesWithoutConfig.length > 0 && (
            <div className="max-w-xs mx-auto space-y-3">
              <Select onValueChange={(value) => {
                setFormData(prev => ({ ...prev, franchise_evolution_instance_id: value }));
              }}>
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                  <SelectValue placeholder="Selecione uma franquia..." />
                </SelectTrigger>
                <SelectContent>
                  {[...franchisesWithoutConfig].sort((a, b) => (a.city || '').localeCompare(b.city || '', 'pt-BR')).map((f) =>
                    <SelectItem key={f.id} value={f.evolution_instance_id}>{f.city}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <button
                onClick={async () => {
                  if (!formData.franchise_evolution_instance_id) {
                    toast.error("Selecione uma franquia primeiro.");
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    const newConfig = await FranchiseConfiguration.create(formData);
                    setConfigurations((prev) => [...prev, newConfig]);
                    toast.success("Configuração criada! Preencha os dados.");
                  } catch (error) {
                    toast.error("Falha ao criar configuração.");
                  }
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting}
                className="w-full bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl font-bold py-3 px-6 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />}
                Criar Configuração
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1b1c1d]">Meu Vendedor</h2>
            <p className="text-sm text-[#3d4a42]/70 mt-0.5">Configure o assistente de vendas da sua unidade</p>
          </div>
          <div className="flex items-center gap-3">
            {displayConfigurations.length > 1 && (
              <Select value={selectedConfigId} onValueChange={handleSelectConfig}>
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl text-sm w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...displayConfigurations].sort((a, b) => (a.franchise_name || a.franchise?.city || '').localeCompare(b.franchise_name || b.franchise?.city || '', 'pt-BR')).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.franchise_name || c.franchise?.city || 'Franquia'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              onClick={() => currentConfig && handleCheckStatusFromBadge(currentConfig)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                isConnected
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-[#e9e8e9]/50 border-[#bccac0]/30'
              }`}
              title="Clique para verificar o status atual"
            >
              {checkingStatusFor === currentConfig?.id ? (
                <MaterialIcon icon="progress_activity" size={8} className="animate-spin text-[#4a3d3d]" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#7a6d6d]'}`} />
              )}
              <span className={`text-xs font-semibold ${isConnected ? 'text-emerald-700' : 'text-[#4a3d3d]'}`}>
                {checkingStatusFor === currentConfig?.id ? 'Verificando...' : isConnected ? 'Conectado' : 'Não conectado'}
              </span>
            </button>
          </div>
        </div>

        {/* WhatsApp Connection Card */}
        <section className={`rounded-2xl shadow-sm border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isConnected ? 'bg-emerald-50/50 border-emerald-200/50' : 'bg-white border-[#bccac0]/5'
        }`}>
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden ${
                isConnected ? 'bg-emerald-100' : 'bg-[#e9e8e9]/50'
              }`}>
                {isConnected ? (
                  <MaterialIcon icon="check_circle" filled size={32} className="text-emerald-600" />
                ) : (
                  <MaterialIcon icon="qr_code_2" size={36} className="text-[#bccac0]/60" />
                )}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1b1c1d]">
                {isConnected ? 'WhatsApp ativo' : 'Conectar WhatsApp'}
              </h3>
              <p className="text-xs text-[#4a3d3d] mt-0.5">
                {isConnected
                  ? 'Seu vendedor está recebendo mensagens'
                  : 'Escaneie o QR Code para ativar seu vendedor'}
              </p>
            </div>
          </div>
          <button
            onClick={() => currentConfig && handleConnectWhatsApp(currentConfig)}
            disabled={isConnectingWhatsApp}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap ${
              isConnected
                ? 'border border-[#7a6d6d]/30 text-[#4a3d3d] hover:bg-[#e9e8e9]/50'
                : 'bg-[#b91c1c] text-white hover:bg-[#991b1b]'
            }`}
          >
            {isConnectingWhatsApp ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
            ) : (
              <MaterialIcon icon={isConnected ? 'refresh' : 'qr_code_2'} size={16} />
            )}
            {isConnectingWhatsApp ? 'Gerando QR Code...' : isConnected ? 'Reconectar' : 'Gerar QR Code'}
          </button>
        </section>

        {/* Wizard Stepper */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#bccac0]/5 p-4 md:p-6">
          <WizardStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
            skippedSteps={skippedSteps}
            onStepClick={goToStep}
          />
        </div>

        {/* Step Content */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">

          {/* Step 1: Sua Unidade */}
          {currentStep === 1 && (
            <WizardStep icon="storefront" title="Sua Unidade" subtitle="Dados básicos da sua franquia — o bot usa essas informações para atender clientes">
              <div>
                <label className={labelClass}>Como os clientes conhecem sua unidade?<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.franchise_name}
                  onChange={(e) => handleInputChange('franchise_name', e.target.value)}
                  placeholder="Ex: Maxi Massas - Itaim Bibi" />
                <FieldHint text="Esse nome aparece nas mensagens do bot para o cliente." />
              </div>
              <div>
                <label className={labelClass}>Rua e número<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.street_address}
                  onChange={(e) => handleInputChange('street_address', e.target.value)}
                  placeholder="Ex: Rua das Flores, 123" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Bairro<RequiredDot /></label>
                  <input className={inputClass} type="text" value={formData.neighborhood}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    placeholder="Ex: Centro" />
                </div>
                <div>
                  <label className={labelClass}>Cidade<RequiredDot /></label>
                  <input className={inputClass} type="text" value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Ex: São João da Boa Vista" />
                </div>
                <div>
                  <label className={labelClass}>CEP</label>
                  <input className={inputClass} type="text" value={formData.cep}
                    onChange={(e) => handleInputChange('cep', e.target.value)}
                    placeholder="00000-000" />
                </div>
              </div>
              <FieldHint text="O bot usa esse endereço para calcular frete e informar o ponto de retirada." />
              <div>
                <label className={labelClass}>Ponto de referência para clientes</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={formData.address_reference}
                  onChange={(e) => handleInputChange('address_reference', e.target.value)}
                  placeholder="Ex: Próximo à praça, casa com portão azul..." />
                <FieldHint text="O bot informa essa referência quando o cliente pergunta onde fica sua unidade." />
              </div>
              <div>
                <label className={labelClass}>Seu WhatsApp pessoal (recebe relatório quinzenal)</label>
                <input className={inputClass} type="tel" inputMode="numeric"
                  value={formData.personal_phone_for_summary?.replace(/\D/g, '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3').replace(/^(\d{2})(\d{1,5})$/, '($1) $2').replace(/^(\d{1,2})$/, '($1') || ''}
                  onChange={(e) => handleInputChange('personal_phone_for_summary', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="(11) 98765-4321" />
                <FieldHint text="Formato: DDD + número (11 dígitos). Ex: 11987654321" />
              </div>
            </WizardStep>
          )}

          {/* Step 2: Horários */}
          {/* Step 2: Operação e Pagamentos */}
          {currentStep === 2 && (
            <WizardStep icon="settings" title="Operação e Pagamentos" subtitle="Entrega, retirada e formas de pagamento">
              {/* Delivery toggle + options */}
              <ToggleCard
                icon="delivery_dining"
                label="Sua unidade faz ENTREGA?"
                description="Clientes recebem os pedidos em casa"
                checked={formData.has_delivery ?? true}
                onChange={(val) => handleInputChange('has_delivery', val)}
              />
              {(formData.has_delivery ?? true) && (
                <>
                  <div>
                    <label className={labelClass}>Método de entrega</label>
                    <RadioCards
                      options={DELIVERY_METHODS}
                      value={formData.delivery_method}
                      onChange={(val) => handleInputChange('delivery_method', val)}
                    />
                    {formData.delivery_method === 'third_party' && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <MaterialIcon icon="info" size={14} />
                        Se usa Uber/Flash, o motoboy NÃO leva máquina de cartão
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Pagamento aceito na ENTREGA</label>
                    <PaymentChipsMulti
                      options={PAYMENT_METHODS}
                      value={formData.payment_delivery || []}
                      onChange={(val) => handleInputChange('payment_delivery', val)}
                      disabledValues={thirdPartyDisabledPayments}
                      disabledTooltip="Motoboy terceirizado não leva máquina"
                    />
                  </div>
                </>
              )}

              {/* Pickup toggle + options */}
              <ToggleCard
                icon="store"
                label="Aceita RETIRADA no local?"
                description="Clientes buscam o pedido na sua unidade"
                checked={formData.has_pickup ?? false}
                onChange={(val) => handleInputChange('has_pickup', val)}
              />
              {(formData.has_pickup ?? false) && (
                <div className="ml-4 mt-2 mb-3">
                  <ToggleCard
                    icon="calendar_clock"
                    label="Somente retirada agendada"
                    description="O bot vai pedir pro cliente combinar dia e horário antes de vir buscar."
                    checked={formData.pickup_requires_scheduling ?? true}
                    onChange={(val) => handleInputChange('pickup_requires_scheduling', val)}
                  />
                  <p className="text-xs text-[#7a6d6d] mt-1 ml-1">
                    Desative se você tem um espaço onde o cliente pode chegar e comprar sem precisar agendar.
                  </p>
                </div>
              )}
              {(formData.has_pickup ?? false) && (
                <>
                  <div>
                    <label className={labelClass}>Pagamento aceito na RETIRADA</label>
                    <PaymentChipsMulti
                      options={PAYMENT_METHODS}
                      value={formData.payment_pickup || []}
                      onChange={(val) => handleInputChange('payment_pickup', val)}
                    />
                  </div>

                  {/* Pickup hours — only when both delivery and pickup are enabled */}
                  {(formData.has_delivery ?? true) ? (
                    <div className="mt-2">
                      <ToggleCard
                        icon="schedule"
                        label="Horário de retirada diferente da entrega?"
                        description="Se desligado, a retirada segue o mesmo horário da entrega"
                        checked={formData.has_custom_pickup_hours ?? false}
                        onChange={(val) => {
                          handleInputChange('has_custom_pickup_hours', val);
                          if (!val) handleInputChange('pickup_schedule', []);
                        }}
                      />
                      {(formData.has_custom_pickup_hours ?? false) && (
                        <div className="mt-3">
                          <label className={labelClass}>Horários de retirada</label>
                          <OperatingHoursEditor
                            value={formData.pickup_schedule || []}
                            onChange={(val) => handleInputChange('pickup_schedule', val)}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <label className={labelClass}>Horários de retirada</label>
                      <p className="text-[11px] text-[#4a3d3d]/70 mb-3 flex items-start gap-1">
                        <MaterialIcon icon="info" size={12} className="mt-0.5 shrink-0" />
                        <span>Defina quando sua unidade aceita retirada. Esses horários também definem quando sua unidade funciona.</span>
                      </p>
                      <OperatingHoursEditor
                        value={formData.pickup_schedule?.length > 0 ? formData.pickup_schedule : (formData.operating_hours || [])}
                        onChange={(val) => {
                          handleInputChange('pickup_schedule', val);
                          handleInputChange('has_custom_pickup_hours', true);
                          handleInputChange('operating_hours', val);
                          // Só atualiza opening_hours se NÃO tem delivery (pickup-only = horário geral)
                          if (!formData.has_delivery) {
                            const summary = val.map(r => `${r.days.join(',')}: ${r.open}-${r.close}`).join(' | ');
                            handleInputChange('opening_hours', summary);
                            handleInputChange('working_days', [...new Set(val.flatMap(r => r.days))].join(','));
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Payment fees per method */}
              <div className="border-t border-[#bccac0]/10 pt-4 mt-2">
                <h4 className="text-xs font-bold text-[#3d4a42] mb-3 flex items-center gap-1.5">
                  <MaterialIcon icon="percent" size={14} />
                  Taxa por Forma de Pagamento
                </h4>
                <p className="text-[11px] text-[#4a3d3d]/70 mb-3">
                  Defina a taxa (%) cobrada pela operadora em cada forma de pagamento. Usado no cálculo automático de vendas.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((pm) => (
                    <div key={pm.value}>
                      <label className="text-xs font-medium text-[#4a3d3d] flex items-center gap-1 mb-1">
                        <MaterialIcon icon={pm.icon} size={14} />
                        {pm.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          className="w-full bg-[#e9e8e9] border-none rounded-xl px-3 py-2 pr-8 text-sm text-right font-mono"
                          value={formData.payment_fees?.[pm.value] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            const updated = { ...(formData.payment_fees || {}), [pm.value]: val };
                            handleInputChange('payment_fees', updated);
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4a3d3d]/50">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared payment data */}
              <div className="border-t border-[#bccac0]/10 pt-4 mt-2">
                <h4 className="text-xs font-bold text-[#3d4a42] mb-3 flex items-center gap-1.5">
                  <MaterialIcon icon="payments" size={14} />
                  Dados de Pagamento
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Tipo da chave PIX</label>
                    <select
                      className={inputClass}
                      value={formData.pix_key_type}
                      onChange={(e) => handleInputChange('pix_key_type', e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {PIX_KEY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <FieldHint text="Tipo da sua chave PIX para receber pagamentos." />
                  </div>
                  <div>
                    <label className={labelClass}>Sua chave PIX</label>
                    <input className={inputClass} type="text" value={formData.pix_key_data}
                      onChange={(e) => handleInputChange('pix_key_data', e.target.value)}
                      placeholder="Chave PIX" />
                    <FieldHint text="Sua chave PIX (CPF, email, telefone ou aleatória)." />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className={labelClass}>Nome do titular</label>
                    <input className={inputClass} type="text" value={formData.pix_holder_name}
                      onChange={(e) => handleInputChange('pix_holder_name', e.target.value)}
                      placeholder="Ex: Nelson Pulitano" />
                  </div>
                  <div>
                    <label className={labelClass}>Banco</label>
                    <input className={inputClass} type="text" value={formData.pix_bank}
                      onChange={(e) => handleInputChange('pix_bank', e.target.value)}
                      placeholder="Ex: Itaú, Nubank..." />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelClass}>Link de pagamento (se usar)</label>
                  <input className={inputClass} type="url" value={formData.payment_link}
                    onChange={(e) => handleInputChange('payment_link', e.target.value)}
                    placeholder="https://..." />
                </div>
              </div>
            </WizardStep>
          )}

          {/* Step 3: Entrega + Horários (pickup-only mostra só horários) */}
          {currentStep === 3 && hasDelivery && (
            <WizardStep icon="delivery_dining" title="Entrega" subtitle="Configure raio, horários, taxas e regras — o bot usa isso para calcular frete automaticamente">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Raio maximo de entrega (km)</label>
                  <input className={`${inputClass} font-mono`} type="number"
                    value={formData.max_delivery_radius_km ?? ''}
                    onChange={(e) => handleInputChange('max_delivery_radius_km', e.target.value ? Number(e.target.value) : null)}
                    placeholder="7" />
                  <FieldHint text="O bot recusa pedidos fora desse raio automaticamente." />
                </div>
                <div>
                  <label className={labelClass}>Pedido minimo para entrega (R$)</label>
                  <input className={`${inputClass} font-mono`} type="number"
                    value={formData.min_order_value ?? ''}
                    onChange={(e) => handleInputChange('min_order_value', e.target.value ? Number(e.target.value) : null)}
                    placeholder="45" />
                  <FieldHint text="Abaixo desse valor, o bot sugere retirada no local." />
                </div>
                <div>
                  <label className={labelClass}>Tempo médio de entrega (minutos)</label>
                  <input className={`${inputClass} font-mono`} type="number"
                    value={formData.avg_prep_time_minutes ?? ''}
                    onChange={(e) => handleInputChange('avg_prep_time_minutes', e.target.value ? Number(e.target.value) : null)}
                    placeholder="40" />
                  <FieldHint text="Tempo total desde o pedido fechado até o cliente receber: separar, chamar motoboy e entregar." />
                </div>
              </div>

              <div className="mt-2">
                <label className={labelClass}>Horários e taxas de entrega</label>
                <p className="text-[11px] text-[#4a3d3d]/70 mb-3 flex items-start gap-1">
                  <MaterialIcon icon="info" size={12} className="mt-0.5 shrink-0" />
                  <span>Configure horários e fretes diferentes por dia da semana. Esses horários também definem quando sua unidade funciona.</span>
                </p>
                <DeliveryScheduleEditor
                  value={formData.delivery_schedule}
                  onChange={(val) => {
                    handleInputChange('delivery_schedule', val);
                    // Sync legacy delivery fields from first range
                    if (val.length > 0) {
                      const first = val[0];
                      handleInputChange('delivery_start_time', first.delivery_start || '');
                      handleInputChange('order_cutoff_time', first.delivery_end || '');
                      handleInputChange('charges_delivery_fee', first.charges_fee !== false);
                      handleInputChange('delivery_fee_rules', first.fee_rules || [{ max_km: '', fee: '' }]);
                    }
                    // Derive operating_hours from delivery_schedule
                    const opHours = val.map(r => ({
                      days: r.days,
                      open: r.delivery_start,
                      close: r.delivery_end,
                    }));
                    handleInputChange('operating_hours', opHours);
                    const summary = opHours.map(r => `${r.days.join(',')}: ${r.open}-${r.close}`).join(' | ');
                    handleInputChange('opening_hours', summary);
                    handleInputChange('working_days', [...new Set(val.flatMap(r => r.days))].join(','));
                  }}
                />
              </div>
            </WizardStep>
          )}

          {/* Step 4: Seu Vendedor */}
          {currentStep === 4 && (
            <WizardStep icon="smart_toy" title="Seu Vendedor" subtitle="Configure a personalidade e as mensagens do seu assistente virtual de vendas">
              <div>
                <label className={labelClass}>Nome do assistente virtual<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.agent_name}
                  onChange={(e) => handleInputChange('agent_name', e.target.value)}
                  placeholder="Ex: Ana" />
                <FieldHint text="O bot se apresenta com esse nome ao atender clientes no WhatsApp." />
              </div>
              <div>
                <label className={labelClass}>Promoções ativas (o bot oferece automaticamente)</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={formData.promotions_combo}
                  onChange={(e) => handleInputChange('promotions_combo', e.target.value)}
                  placeholder="Ex: Leve 3 massas e ganhe 1 molho pomodoro..." />
                <FieldHint text="O bot menciona essas promoções quando o cliente pergunta sobre ofertas." />
              </div>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <div>
                <label className={labelClass}>ID da Página do Facebook (Meta Ads)</label>
                <input className={inputClass} type="text" value={formData.facebook_page_id}
                  onChange={(e) => handleInputChange('facebook_page_id', e.target.value)}
                  placeholder="Ex: 123456789012345" />
                <FieldHint text="Necessário para rastrear conversões via WhatsApp (CAPI). Encontre em: Página do Facebook → Sobre → ID da Página." />
              </div>
              )}
              <div>
                <label className={labelClass}>Catálogo / Cardápio (imagem que o bot envia ao cliente)</label>
                <CatalogUpload
                  value={formData.catalog_image_url}
                  onChange={(url) => handleInputChange('catalog_image_url', url)}
                  franchiseId={editingConfig?.franchise_evolution_instance_id || 'default'}
                />
              </div>
            </WizardStep>
          )}

          {/* Step 5: Revisão */}
          {currentStep === 5 && (
            <WizardStep icon="checklist" title="Revisão" subtitle="Confira todos os dados antes de salvar">
              <ReviewSummary formData={formData} onGoToStep={goToStep} />
            </WizardStep>
          )}
        </form>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && modalData && (
        <WhatsAppConnectionModal
          isOpen={showWhatsAppModal}
          onClose={handleCloseModalAndCheckStatus}
          qrCode={modalData.qrCode}
          status={modalData.status}
          onCheckStatus={handleCheckWhatsAppStatus}
          isCheckingStatus={isCheckingStatus}
        />
      )}

      {/* Fixed Bottom Navigation */}
      <footer className="fixed bottom-16 md:bottom-0 right-0 left-0 md:left-[260px] bg-white border-t border-[#e9e8e9] px-4 md:px-8 py-3 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Voltar */}
          <div className="w-28">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[#b91c1c] text-[#b91c1c] font-bold text-sm hover:bg-[#b91c1c]/5 transition-all"
              >
                <MaterialIcon icon="arrow_back" size={16} />
                Voltar
              </button>
            )}
          </div>

          {/* Center: step dots (mobile) + save status */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1.5 md:hidden">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    skippedSteps.includes(s)
                      ? 'bg-[#e9e8e9]/50'
                      : s === currentStep
                      ? 'bg-[#b91c1c]'
                      : completedSteps.includes(s)
                      ? 'bg-[#b91c1c]/30'
                      : 'bg-[#e9e8e9]'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#3d4a42]/50 italic">
              {getLastSavedText() || (isDirty ? "Alterações não salvas" : "")}
            </span>
          </div>

          {/* Right: Próximo / Salvar */}
          <div className="w-28 flex justify-end">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-sm shadow-lg shadow-[#b91c1c]/20 transition-all"
              >
                Próximo
                <MaterialIcon icon="arrow_forward" size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !isDirty}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-sm shadow-lg shadow-[#b91c1c]/20 transition-all disabled:opacity-50"
              >
                {isSubmitting && <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />}
                Salvar
              </button>
            )}
          </div>
        </div>
      </footer>
      {/* Discard changes dialog (replaces window.confirm) */}
      {pendingConfigId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1b1c1d] mb-2">Alterações não salvas</h3>
            <p className="text-sm text-[#3d4a42] mb-6">Você tem alterações não salvas. Deseja descartá-las?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingConfigId(null)}
                className="px-4 py-2 rounded-xl border border-[#bccac0] text-[#3d4a42] text-sm font-medium hover:bg-[#fbf9fa]"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setIsDirty(false); applyConfigSelection(pendingConfigId); }}
                className="px-4 py-2 rounded-xl bg-[#b91c1c] text-white text-sm font-bold hover:bg-[#991b1b]"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FranchiseSettings() {
  return (
    <ErrorBoundary>
      <FranchiseSettingsContent />
    </ErrorBoundary>
  );
}
