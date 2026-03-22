import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FranchiseConfiguration, Franchise, User } from "@/entities/all";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { optimizeConfig } from "@/api/functions";
import { toast } from "sonner";
import { PAYMENT_METHODS, DELIVERY_METHODS, BOT_PERSONALITIES, PIX_KEY_TYPES, WEEKDAYS } from "@/lib/franchiseUtils";

import WhatsAppConnectionModal from "../components/whatsapp/WhatsAppConnectionModal";
import ErrorBoundary from "../components/ErrorBoundary";
import WizardStepper from "@/components/vendedor/WizardStepper";
import WizardStep from "@/components/vendedor/WizardStep";
import DeliveryFeeEditor from "@/components/vendedor/DeliveryFeeEditor";
import ReviewSummary from "@/components/vendedor/ReviewSummary";
import OperatingHoursEditor from "@/components/vendedor/OperatingHoursEditor";
import CatalogUpload from "@/components/vendedor/CatalogUpload";
import { ToggleCard, RadioCards, PaymentChipsMulti, DayChipsToggle } from "@/components/vendedor/WizardFields";
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
  catalog_image_url: '',
  bot_personality: '',
};

const inputClass = "w-full bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20 text-sm outline-none";
const labelClass = "block text-xs font-semibold text-[#3d4a42] mb-2";

function FieldHint({ text }) {
  return (
    <p className="text-[11px] text-[#534343]/50 mt-1.5 flex items-start gap-1">
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
  const [isOptimizing, setIsOptimizing] = useState(false);
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
      const [configsData, franchisesData, currentUserData] = await Promise.all([
        FranchiseConfiguration.list(),
        Franchise.list(),
        User.me()
      ]);
      setConfigurations(configsData);
      setFranchises(franchisesData);
      setCurrentUser(currentUserData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações. Por favor, recarregue a página.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isLoading && currentUser && franchises.length > 0 && configurations.length > 0) {
      const availableFranchises = currentUser.role === 'admin'
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

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const loadConfigIntoForm = (config) => {
    setEditingConfig(config);
    setFormData({
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
      // New fields with safe defaults
      has_delivery: config.has_delivery ?? true,
      has_pickup: config.has_pickup ?? false,
      delivery_method: config.delivery_method || '',
      payment_delivery: config.payment_delivery || [],
      payment_pickup: config.payment_pickup || [],
      delivery_fee_rules: config.delivery_fee_rules || [{ max_km: '', fee: '' }],
      pix_key_type: config.pix_key_type || '',
      order_cutoff_time: config.order_cutoff_time || '',
      bot_personality: config.bot_personality || '',
      operating_hours: config.operating_hours || [],
      pix_holder_name: config.pix_holder_name || '',
      pix_bank: config.pix_bank || '',
      city: config.city || '',
      neighborhood: config.neighborhood || '',
      catalog_image_url: config.catalog_image_url || '',
    });
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
    setIsSubmitting(true);

    const finalData = {
      ...formData,
      accepted_payment_methods: typeof formData.accepted_payment_methods === 'string' ?
        formData.accepted_payment_methods :
        Array.isArray(formData.accepted_payment_methods) ?
          formData.accepted_payment_methods.join(', ') : '',
      address_reference: formData.address_reference || ''
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
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Falha ao salvar configuração.");
    }
    setIsSubmitting(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const { data: optimizedData } = await optimizeConfig(formData);
      setFormData((prevData) => ({
        ...prevData,
        ...optimizedData,
        social_media_links: {
          ...prevData.social_media_links,
          ...(optimizedData.social_media_links || {})
        }
      }));
      setIsDirty(true);
      toast.success("Textos otimizados com IA! Revise as sugestões e salve as alterações.");
    } catch (error) {
      console.error("Erro ao otimizar com IA:", error);
      toast.error("Ocorreu um erro ao tentar otimizar os dados. Tente novamente.");
    }
    setIsOptimizing(false);
  };

  const availableFranchisesForUser = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.role === 'admin' ?
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
    ...(!hasDelivery ? [4] : []),
  ];

  // Determine completed steps (basic validation)
  const completedSteps = useMemo(() => {
    const done = [];
    if (formData.franchise_name && formData.unit_address) done.push(1);
    if ((formData.operating_hours?.length > 0) || (formData.working_days && formData.opening_hours)) done.push(2);
    // Step 3: Operação e Pagamentos — complete if operation mode set + relevant payments configured
    const deliveryPaymentOk = !hasDelivery || (formData.payment_delivery?.length > 0);
    const pickupPaymentOk = !hasPickup || (formData.payment_pickup?.length > 0);
    if (formData.has_delivery !== undefined && deliveryPaymentOk && pickupPaymentOk) done.push(3);
    if (!hasDelivery || formData.max_delivery_radius_km) done.push(4);
    if (formData.agent_name) done.push(5);
    return done;
  }, [formData, hasDelivery, hasPickup]);

  const goToStep = (step) => {
    if (skippedSteps.includes(step)) return;
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    let next = currentStep + 1;
    while (next <= 6 && skippedSteps.includes(next)) next++;
    if (next <= 6) goToStep(next);
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
                  {franchisesWithoutConfig.map((f) =>
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
    <div className="pb-28">
      <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1b1c1d]">Meu Vendedor</h2>
            <p className="text-sm text-[#3d4a42]/60 mt-0.5">Configure o assistente de vendas da sua unidade</p>
          </div>
          <div className="flex items-center gap-3">
            {displayConfigurations.length > 1 && (
              <Select value={selectedConfigId} onValueChange={handleSelectConfig}>
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl text-sm w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {displayConfigurations.map((c) => (
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
                  ? 'bg-[#ffdad6]/30 border-[#b91c1c]/10'
                  : 'bg-red-50 border-red-200'
              }`}
              title="Clique para verificar o status atual"
            >
              {checkingStatusFor === currentConfig?.id ? (
                <MaterialIcon icon="progress_activity" size={8} className="animate-spin text-[#b91c1c]" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#b91c1c] animate-pulse' : 'bg-red-500'}`} />
              )}
              <span className={`text-xs font-semibold ${isConnected ? 'text-[#b91c1c]' : 'text-red-600'}`}>
                {checkingStatusFor === currentConfig?.id ? 'Verificando...' : isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </button>
          </div>
        </div>

        {/* WhatsApp Connection Card */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#bccac0]/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 bg-[#e9e8e9]/50 rounded-xl flex items-center justify-center overflow-hidden">
                <MaterialIcon icon="qr_code_2" size={52} className={isConnected ? 'text-[#bccac0]/20' : 'text-[#bccac0]/40'} />
                {isConnected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MaterialIcon icon="check_circle" filled size={28} className="text-[#b91c1c]" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1b1c1d]">
                {currentConfig?.franchise_name || currentFranchise?.city || 'N/A'}
              </h3>
              <p className="text-xs text-[#3d4a42]/60 flex items-center gap-1 mt-0.5">
                <MaterialIcon icon="smartphone" size={12} />
                {formData.personal_phone_for_summary || 'Telefone não configurado'}
              </p>
              <div className={`mt-1.5 text-xs font-semibold ${isConnected ? 'text-[#b91c1c]' : 'text-red-500'}`}>
                {isConnected ? 'WhatsApp ativo' : 'WhatsApp desconectado'}
              </div>
            </div>
          </div>
          <button
            onClick={() => currentConfig && handleConnectWhatsApp(currentConfig)}
            disabled={isConnectingWhatsApp}
            className="px-5 py-2.5 rounded-xl border border-[#b91c1c] text-[#b91c1c] text-sm font-bold hover:bg-[#b91c1c]/5 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {isConnectingWhatsApp ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
            ) : (
              <MaterialIcon icon="smartphone" size={16} />
            )}
            {isConnected ? 'Reconectar' : 'Conectar'}
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
            <WizardStep icon="storefront" title="Sua Unidade" subtitle="Dados basicos da sua franquia — o bot usa essas informacoes para atender clientes">
              <div>
                <label className={labelClass}>Como os clientes conhecem sua unidade?<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.franchise_name}
                  onChange={(e) => handleInputChange('franchise_name', e.target.value)}
                  placeholder="Ex: Maxi Massas - Itaim Bibi" />
                <FieldHint text="Esse nome aparece nas mensagens do bot para o cliente." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input className={inputClass} type="text" value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Ex: Sao Joao da Boa Vista" />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input className={inputClass} type="text" value={formData.neighborhood}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    placeholder="Ex: Centro" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Endereco completo com numero e CEP<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.unit_address}
                  onChange={(e) => handleInputChange('unit_address', e.target.value)}
                  placeholder="Rua, numero, bairro, cidade - CEP" />
                <FieldHint text="O bot envia esse endereco quando o cliente pede para retirar o pedido." />
              </div>
              <div>
                <label className={labelClass}>Ponto de referencia para clientes e motoboys</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={formData.address_reference}
                  onChange={(e) => handleInputChange('address_reference', e.target.value)}
                  placeholder="Ex: Proximo a praca, casa com portao azul..." />
                <FieldHint text="Ajuda o motoboy a encontrar sua unidade mais rapido." />
              </div>
              <div>
                <label className={labelClass}>Seu WhatsApp pessoal (recebe resumo diario)</label>
                <input className={inputClass} type="text" value={formData.personal_phone_for_summary}
                  onChange={(e) => handleInputChange('personal_phone_for_summary', e.target.value)}
                  placeholder="(11) 98765-4321" />
                <FieldHint text="Voce recebe um resumo diario de vendas e atendimentos nesse numero." />
              </div>
            </WizardStep>
          )}

          {/* Step 2: Horários */}
          {currentStep === 2 && (
            <WizardStep icon="schedule" title="Horários" subtitle="Quando sua unidade funciona">
              <div>
                <label className={labelClass}>Faixas de horário</label>
                <p className="text-xs text-[#3d4a42]/60 mb-3">
                  Defina horários diferentes para cada grupo de dias (ex: Seg-Sex um horário, Sáb outro)
                </p>
                <OperatingHoursEditor
                  value={formData.operating_hours || []}
                  onChange={(val) => {
                    handleInputChange('operating_hours', val);
                    // Sync with legacy fields for backward compatibility
                    const summary = val.map(r => {
                      const days = r.days.join(',');
                      return `${days}: ${r.open}-${r.close}`;
                    }).join(' | ');
                    handleInputChange('opening_hours', summary);
                    handleInputChange('working_days', val.flatMap(r => r.days).join(','));
                  }}
                />
              </div>
            </WizardStep>
          )}

          {/* Step 3: Operação e Pagamentos */}
          {currentStep === 3 && (
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
                <div>
                  <label className={labelClass}>Pagamento aceito na RETIRADA</label>
                  <PaymentChipsMulti
                    options={PAYMENT_METHODS}
                    value={formData.payment_pickup || []}
                    onChange={(val) => handleInputChange('payment_pickup', val)}
                  />
                </div>
              )}

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
                  </div>
                  <div>
                    <label className={labelClass}>Sua chave PIX</label>
                    <input className={inputClass} type="text" value={formData.pix_key_data}
                      onChange={(e) => handleInputChange('pix_key_data', e.target.value)}
                      placeholder="Chave PIX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
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

          {/* Step 4: Entrega (skipped if has_delivery=false) */}
          {currentStep === 4 && (
            <WizardStep icon="delivery_dining" title="Entrega" subtitle="Configure raio, taxas e regras — o bot usa isso para calcular frete automaticamente">
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
                  <label className={labelClass}>Tempo medio de preparo (minutos)</label>
                  <input className={`${inputClass} font-mono`} type="number"
                    value={formData.avg_prep_time_minutes ?? ''}
                    onChange={(e) => handleInputChange('avg_prep_time_minutes', e.target.value ? Number(e.target.value) : null)}
                    placeholder="25" />
                  <FieldHint text="O bot informa ao cliente o tempo estimado de entrega." />
                </div>
                <div>
                  <label className={labelClass}>Horario limite para pedidos</label>
                  <input className={inputClass} type="text" value={formData.order_cutoff_time}
                    onChange={(e) => handleInputChange('order_cutoff_time', e.target.value)}
                    placeholder="Ex: Pedidos ate 17h" />
                  <FieldHint text="Depois desse horario, o bot avisa que so entrega no dia seguinte." />
                </div>
              </div>
              <div>
                <label className={labelClass}>Taxas de entrega por faixa de distância</label>
                <DeliveryFeeEditor
                  value={formData.delivery_fee_rules}
                  onChange={(val) => handleInputChange('delivery_fee_rules', val)}
                />
              </div>
            </WizardStep>
          )}

          {/* Step 5: Seu Vendedor */}
          {currentStep === 5 && (
            <WizardStep icon="smart_toy" title="Seu Vendedor" subtitle="Configure a personalidade e as mensagens do seu assistente virtual de vendas">
              <div>
                <label className={labelClass}>Nome do assistente virtual<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.agent_name}
                  onChange={(e) => handleInputChange('agent_name', e.target.value)}
                  placeholder="Ex: Ana" />
                <FieldHint text="O bot se apresenta com esse nome ao atender clientes no WhatsApp." />
              </div>
              <div>
                <label className={labelClass}>Personalidade do bot</label>
                <RadioCards
                  options={BOT_PERSONALITIES}
                  value={formData.bot_personality}
                  onChange={(val) => handleInputChange('bot_personality', val)}
                />
                <FieldHint text="Define o tom das respostas: formal para publico corporativo, casual para bairro, etc." />
              </div>
              <div>
                <label className={labelClass}>Promocoes ativas (o bot oferece automaticamente)</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={formData.promotions_combo}
                  onChange={(e) => handleInputChange('promotions_combo', e.target.value)}
                  placeholder="Ex: Leve 3 massas e ganhe 1 molho pomodoro..." />
                <FieldHint text="O bot menciona essas promocoes quando o cliente pergunta sobre ofertas." />
              </div>
              <div>
                <label className={labelClass}>Catalogo / Cardapio (imagem que o bot envia ao cliente)</label>
                <CatalogUpload
                  value={formData.catalog_image_url}
                  onChange={(url) => handleInputChange('catalog_image_url', url)}
                  franchiseId={editingConfig?.franchise_evolution_instance_id || 'default'}
                />
              </div>
              {editingConfig && (
                <button
                  type="button"
                  onClick={handleOptimize}
                  disabled={isOptimizing || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#b91c1c] text-[#b91c1c] font-bold text-sm hover:bg-[#b91c1c]/5 transition-all disabled:opacity-50"
                >
                  {isOptimizing ? <MaterialIcon icon="progress_activity" size={16} className="animate-spin" /> : <MaterialIcon icon="auto_awesome" filled size={16} />}
                  Otimizar com IA
                </button>
              )}
            </WizardStep>
          )}

          {/* Step 6: Revisão */}
          {currentStep === 6 && (
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
      <footer className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/90 backdrop-blur-md border-t border-[#bccac0]/10 px-4 md:px-8 py-4 z-40">
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
              {[1, 2, 3, 4, 5, 6].map((s) => (
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
            {currentStep < 6 ? (
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
                className="px-4 py-2 rounded-xl border border-[#bccac0] text-[#3d4a42] text-sm font-medium hover:bg-[#f5f3f4]"
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
