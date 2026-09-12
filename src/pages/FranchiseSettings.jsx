import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FranchiseConfiguration, User } from "@/entities/all";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PAYMENT_METHODS, PIX_KEY_TYPES, resolveActiveFranchise } from "@/lib/franchiseUtils";
import { useAuth } from "@/lib/AuthContext";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { assembleUnitAddress, foldStreetNumber, stripCityUf } from "@/lib/addressUtils";
import { diffPatch, findConflicts, nomesDosCampos, camposDoRascunhoADescartar } from "@/lib/configSave";
import { validarEtapa, validarTudo } from "@/lib/vendedorValidation";
import { buscarCep, formatarCep, normalizarCep, ruaJaContem } from "@/lib/cep";

import FranchisePicker from "@/components/shared/FranchisePicker";
import WhatsAppConnectionModal from "../components/whatsapp/WhatsAppConnectionModal";
import ErrorBoundary from "../components/ErrorBoundary";
import WizardStepper from "@/components/vendedor/WizardStepper";
import WizardStep from "@/components/vendedor/WizardStep";
import DeliveryScheduleEditor from "@/components/vendedor/DeliveryScheduleEditor";
import PaymentMatrix from "@/components/vendedor/PaymentMatrix";
import ReviewSummary from "@/components/vendedor/ReviewSummary";
import OperatingHoursEditor from "@/components/vendedor/OperatingHoursEditor";
import CatalogUpload from "@/components/vendedor/CatalogUpload";
import { ToggleCard, RadioCards } from "@/components/vendedor/WizardFields";
import useWhatsAppConnection from "@/hooks/useWhatsAppConnection";
import { listarFranquias } from "@/lib/franchisesCache";

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
  pickup_is_store: false,
  pickup_address: '',
  accepts_reservation_without_payment: false,
  charges_card_fee_to_customer: false,
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

const inputClass = "w-full bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20 text-sm outline-none";
const labelClass = "block text-xs font-semibold text-[#3d4a42] mb-2";

const PICKUP_TYPES = [
  { value: 'simple', label: '🏠 Retirada simples', description: 'Cliente combina e busca com você (sem loja).' },
  { value: 'store', label: '🏪 Loja / ponto físico', description: 'Você tem um ponto comercial. O bot fala "nossa loja" e informa o endereço.' },
];

function FieldHint({ text }) {
  return (
    <p className="text-[11px] text-ink-2/70 mt-1.5 flex items-start gap-1">
      <MaterialIcon icon="info" size={12} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

function RequiredDot() {
  return <span className="text-brand ml-0.5">*</span>;
}

const CAMPOS_DE_TEXTO = ['franchise_name', 'street_address', 'neighborhood', 'city', 'cep', 'address_reference', 'agent_name',
  'pix_key_data', 'pix_holder_name', 'pix_bank', 'payment_link', 'pickup_address', 'promotions_combo', 'facebook_page_id'];

// Entrega e retirada dividem a etapa 2: nenhuma etapa é pulada.
const SEM_ETAPAS_PULADAS = [];

function avisarErros(erros) {
  const mais = erros.length > 1 ? ` (e mais ${erros.length - 1})` : '';
  toast.error(`${erros[0]}${mais}`, { duration: 8000 });
}

// Problema que já estava no cadastro e que esta tela não criou: aparece em amarelo, sem travar.
function AvisosDaEtapa({ avisos }) {
  if (!avisos || avisos.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
      <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
        <MaterialIcon icon="warning" size={14} />
        Vale corrigir
      </p>
      {avisos.map((a) => (
        <p key={a} className="text-xs text-amber-800">{a}</p>
      ))}
    </div>
  );
}

// O que vai ao banco a partir do formulário. Roda 2x: no que a tela abriu (baseline) e no que ela
// vai salvar. A diferença entre as duas é exatamente o que a pessoa mudou.
function buildDbPayload(form) {
  // Strip UI-only / read-only fields before sending to DB
  const { id, created_at, updated_at, franchise, whatsapp_status, whatsapp_qr, ...dbFields } = form;

  // Monta o unit_address pelo helper compartilhado (mesmo formato do fluxo fiscal).
  // O campo "Rua e número" do wizard já traz o número embutido -> number vazio aqui.
  const assembledAddress = assembleUnitAddress({
    street: dbFields.street_address,
    neighborhood: dbFields.neighborhood,
    city: dbFields.city,
    cep: dbFields.cep,
  });

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

  // Texto que vai ao cliente sem espaço sobrando (um "Itaú " cortado ia literal na mensagem)
  for (const campo of CAMPOS_DE_TEXTO) {
    if (typeof finalData[campo] === 'string') finalData[campo] = finalData[campo].trim();
  }
  // Link sem protocolo vira https:// (o robô manda o link como está)
  if (finalData.payment_link && !/^https?:\/\//i.test(finalData.payment_link)) finalData.payment_link = `https://${finalData.payment_link}`;
  // Sem retirada, sem loja nem horário próprio de retirada (loja exige retirada ligada)
  if (finalData.has_pickup === false) {
    finalData.pickup_is_store = false;
    finalData.has_custom_pickup_hours = false;
    finalData.pickup_schedule = [];
  }
  return finalData;
}

function FranchiseSettingsContent() {
  const { selectedFranchise, setSelectedFranchise } = useAuth();
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
  // O que a tela abriu (ou como ficou no último salvar): é contra isso que o salvar calcula o que
  // mudou e confere se alguém mexeu nas mesmas colunas no banco. Ver src/lib/configSave.js.
  const loadedRowRef = useRef(null);    // linha do banco
  const baselineRef = useRef(null);     // o mesmo, no formato que vai ao banco
  const baselineFormRef = useRef(null); // o mesmo, no formato do formulário (base do rascunho)
  const [cepStatus, setCepStatus] = useState('');
  const [pickupAddrMode, setPickupAddrMode] = useState('same');
  useEffect(() => {
    setPickupAddrMode(formData.pickup_address ? 'other' : 'same');
  }, [editingConfig?.id, formData.pickup_is_store]); // eslint-disable-line react-hooks/exhaustive-deps
  const cadastroAddress = [formData.street_address, formData.neighborhood, formData.city].filter(Boolean).join(', ');

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

  const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const availableFranchisesForUser = useMemo(() => {
    if (!currentUser) return [];
    return isAdminUser
      ? franchises
      : franchises.filter((f) =>
          currentUser.managed_franchise_ids?.includes(f.id) ||
          currentUser.managed_franchise_ids?.includes(f.evolution_instance_id)
        );
  }, [currentUser, franchises, isAdminUser]);

  // Unidade ativa = a do seletor do topo (franqueado). O wizard TEM que seguir ela:
  // salvar/conectar WhatsApp na config errada mexeria no bot da outra unidade.
  const activeFranchise = useMemo(
    () => resolveActiveFranchise(franchises, currentUser, selectedFranchise),
    [franchises, currentUser, selectedFranchise]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        FranchiseConfiguration.list(),
        listarFranquias(),
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
      const availableFranchises = availableFranchisesForUser;

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
        // Abre a config da unidade ATIVA. Antes abria configsToDisplay[0] (ordem do
        // banco) — com 2 unidades o wizard mostrava a errada com o seletor do topo
        // dizendo outra coisa (bug Araras × Limeira, 05/08/2026).
        const target = activeFranchise
          ? configsToDisplay.find(
              (c) => c.franchise_evolution_instance_id === activeFranchise.evolution_instance_id
            )
          : null;
        // Admin (seletor próprio, não é dono de unidade) e quem só tem UMA unidade
        // seguem abrindo a primeira. Franqueado com 2+ unidades: nada abre sem
        // seleção — o render pede a unidade em vez de adivinhar. O teto é
        // availableFranchisesForUser, não configsToDisplay: com 2 unidades e só 1
        // configurada, "a única config" ainda seria a unidade errada.
        const chosen =
          target || (isAdminUser || availableFranchisesForUser.length === 1 ? configsToDisplay[0] : null);
        if (chosen) {
          setSelectedConfigId(chosen.id);
          loadConfigIntoForm(chosen);
        }
      }
    } else if (!isLoading && currentUser) {
      setDisplayConfigurations([]);
    }
  }, [isLoading, currentUser, franchises, configurations, activeFranchise, availableFranchisesForUser, isAdminUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Semeia bairro/cidade/número do cadastro fiscal (tabela franchises) quando a config
    // ainda não os tem — evita que um "salvar" no wizard apague o endereço já montado.
    // Só dobra o número na rua se ela ainda NÃO terminar em número (não mexe no que o
    // franqueado digitou).
    const fiscal = franchises.find(
      (f) => f.evolution_instance_id === config.franchise_evolution_instance_id
    );
    const streetHasNumber = /\d\s*$/.test((config.street_address || '').trim());
    const seededStreet = streetHasNumber
      ? (config.street_address || '')
      : foldStreetNumber(config.street_address || '', fiscal?.address_number);
    const seededNeighborhood = config.neighborhood || fiscal?.neighborhood || '';
    const seededCity = config.city || stripCityUf(fiscal?.city) || '';

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
      city: seededCity,
      neighborhood: seededNeighborhood,
      street_address: seededStreet || config.unit_address || '',
      cep: config.cep || '',
      pickup_schedule: config.pickup_schedule || [],
      has_custom_pickup_hours: config.has_custom_pickup_hours ?? false,
      pickup_requires_scheduling: config.pickup_requires_scheduling ?? true,
      pickup_is_store: config.pickup_is_store ?? false,
      pickup_address: config.pickup_address || '',
      accepts_reservation_without_payment: config.accepts_reservation_without_payment ?? false,
      charges_card_fee_to_customer: config.charges_card_fee_to_customer ?? false,
      catalog_image_url: config.catalog_image_url || '',
      facebook_page_id: config.facebook_page_id || '',
      payment_fees: config.payment_fees || null,
    };

    loadedRowRef.current = config;
    baselineFormRef.current = baseData;
    baselineRef.current = buildDbPayload(baseData);

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

          // v2 = só o que a pessoa mudou. O formato antigo (tela inteira) traria valores velhos de volta.
          if (draft.v === 2 && draftAge < maxDraftAge && draft.savedAt > configUpdatedAt) {
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
      // Uma escolha só para o app inteiro: trocar aqui move o seletor do topo junto
      // (e vice-versa, no efeito abaixo). Duas fontes de verdade foi o que confundiu.
      if (!isAdminUser && config.franchise) setSelectedFranchise(config.franchise);
    }
    setPendingConfigId(null);
  };

  // Seletor do topo mudou -> o wizard acompanha (com o mesmo aviso de edição não salva).
  useEffect(() => {
    if (isAdminUser || !activeFranchise || displayConfigurations.length === 0) return;
    const target = displayConfigurations.find(
      (c) => c.franchise_evolution_instance_id === activeFranchise.evolution_instance_id
    );
    if (target && target.id !== selectedConfigId) handleSelectConfig(target.id);
  }, [activeFranchise?.evolution_instance_id, displayConfigurations, selectedConfigId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conflito: tira do rascunho local só o que outra pessoa mudou (e o que é gravado junto). Depois
  // de recarregar, a tela mostra a versão do banco nesses campos e mantém o resto do que foi feito.
  const descartarDoRascunho = (campos) => {
    const draftKey = `wizard_draft_${editingConfig?.franchise_evolution_instance_id}`;
    try {
      const draftRaw = localStorage.getItem(draftKey);
      if (!draftRaw) return;
      const draft = JSON.parse(draftRaw);
      for (const c of camposDoRascunhoADescartar(campos)) delete draft.data?.[c];
      draft.savedAt = Date.now();
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return false; // Prevent double-click
    setIsSubmitting(true);

    // Show slow-save warning after 8s
    const slowTimer = setTimeout(() => {
      toast.info("Salvamento em andamento... A conexão está lenta.");
    }, 8000);

    const finalData = buildDbPayload(formData);

    // Regras da tela (lib/vendedorValidation.js): barram só o que esta tela mexeu; o resto vira aviso.
    const { erros } = validarTudo(formData, Object.keys(diffPatch(baselineFormRef.current || {}, formData)), { novo: !editingConfig });
    if (erros.length > 0) {
      clearTimeout(slowTimer);
      setIsSubmitting(false);
      avisarErros(erros);
      return false;
    }

    try {
      if (editingConfig) {
        // Só as colunas que esta tela mudou, e só se ninguém mudou as mesmas no banco depois que ela abriu.
        const patch = diffPatch(baselineRef.current, finalData);
        const colunas = Object.keys(patch);
        if (colunas.length > 0) {
          const [atual] = await FranchiseConfiguration.filter({ id: editingConfig.id }, null, 1, { columns: colunas.join(',') });
          const conflitos = findConflicts(loadedRowRef.current, atual, patch);
          if (conflitos.length > 0) {
            descartarDoRascunho(conflitos);
            toast.error(
              `Nada foi salvo. Enquanto esta tela estava aberta, alguém (outra aba ou o suporte) mudou: ${nomesDosCampos(conflitos)}. Recarregue para ver a versão atual e refaça só essa parte.`,
              { duration: 15000, action: { label: 'Recarregar', onClick: () => window.location.reload() } }
            );
            return false;
          }
          const salvo = await FranchiseConfiguration.update(editingConfig.id, patch);
          loadedRowRef.current = { ...loadedRowRef.current, ...salvo };
          updateConfigurationStatus(editingConfig.id, salvo);
        }
        baselineRef.current = finalData;
        baselineFormRef.current = formData;
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
      return true;
    } catch (error) {
      console.error("Erro ao salvar:", error);
      const msg = safeErrorMessage(error, "Falha ao salvar configurações.");
      toast.error(msg, error?.message?.includes("Tempo limite") ? { duration: 6000 } : undefined);
      return false;
    } finally {
      clearTimeout(slowTimer);
      setIsSubmitting(false);
    }
  };

  // Botao final do wizard. Com algo por salvar, salva. Sem nada por salvar (o caso
  // normal, porque cada "Proximo" ja salvou), confirma em voz alta em vez de ficar
  // inerte — um clique que nao produz nada e a falha mais cara desta tela.
  const handleFinish = async (e) => {
    e?.preventDefault();
    if (isDirty) {
      const ok = await handleSubmit(e);
      if (!ok) return;
    } else {
      toast.success("Tudo salvo! Seu vendedor está configurado.");
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-save draft to localStorage only for franchisees (admin edits directly)
      if (currentUser?.role !== 'admin') {
        const draftKey = `wizard_draft_${editingConfig?.franchise_evolution_instance_id || 'new'}`;
        try {
          // só o que mudou desde que a tela abriu (restaurar a tela inteira desfaria correção do suporte)
          const draftData = diffPatch(baselineFormRef.current || {}, updated);
          delete draftData.pix_key;
          delete draftData.pix_key_data; // a chave Pix não fica guardada no navegador
          delete draftData.cpf_cnpj;
          delete draftData.asaas_customer_id;
          delete draftData.asaas_subscription_id;
          localStorage.setItem(draftKey, JSON.stringify({ v: 2, data: draftData, step: currentStep, savedAt: Date.now() }));
        } catch { /* quota exceeded — ignore */ }
      }
      return updated;
    });
    setIsDirty(true);
  };


  // CEP -> ViaCEP preenche bairro e cidade. A rua só muda se o CEP for de outra rua (preserva o número).
  const handleCepChange = async (valor) => {
    handleInputChange('cep', formatarCep(valor));
    if (normalizarCep(valor).length !== 8) { setCepStatus(''); return; }
    setCepStatus('Buscando o CEP...');
    const achado = await buscarCep(valor);
    if (!achado) { setCepStatus('CEP não encontrado. Confira ou preencha rua, bairro e cidade à mão.'); return; }
    if (achado.rua && !ruaJaContem(formData.street_address, achado.rua)) handleInputChange('street_address', `${achado.rua}, `);
    if (achado.bairro) handleInputChange('neighborhood', achado.bairro);
    if (achado.cidade) handleInputChange('city', achado.cidade);
    setCepStatus(achado.rua ? 'Endereço preenchido pelo CEP. Confira o número da casa.' : 'CEP geral da cidade: preencha a rua e o bairro.');
  };

  // Horários de entrega e o que ainda é derivado deles: opening_hours e working_days (robô e checagem do QR)
  // e delivery_fee_rules (venda manual, 1º grupo). "Cobra frete" = algum grupo cobra: antes vinha só do
  // 1º grupo, e um grupo grátis anunciava frete grátis para a semana toda. operating_hours,
  // delivery_start_time e order_cutoff_time não têm leitor e deixaram de ser gravados.
  const handleScheduleChange = (val) => {
    handleInputChange('delivery_schedule', val);
    if (val.length > 0) {
      handleInputChange('charges_delivery_fee', val.some((r) => r.charges_fee !== false));
      handleInputChange('delivery_fee_rules', val[0].fee_rules || [{ max_km: '', fee: '' }]);
    }
    handleInputChange('opening_hours', val.map((r) => `${r.days.join(',')}: ${r.delivery_start}-${r.delivery_end}`).join(' | '));
    handleInputChange('working_days', [...new Set(val.flatMap((r) => r.days))].join(','));
  };

  const configuredInstanceIds = configurations.map((c) => c.franchise_evolution_instance_id);
  const franchisesWithoutConfig = availableFranchisesForUser.filter((f) => !configuredInstanceIds.includes(f.evolution_instance_id));

  const currentConfig = displayConfigurations.find(c => c.id === selectedConfigId);
  // Unidade ativa existe mas ainda não tem config: mostra a tela de "criar
  // configuração" (abaixo), nunca a config da outra unidade.
  const activeHasNoConfig = Boolean(
    !isAdminUser &&
    activeFranchise &&
    !displayConfigurations.some(
      (c) => c.franchise_evolution_instance_id === activeFranchise.evolution_instance_id
    )
  );
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
  const skippedSteps = SEM_ETAPAS_PULADAS;

  // Determine completed steps (basic validation)
  const completedSteps = useMemo(() => {
    const done = [];
    if (formData.franchise_name && formData.street_address && formData.neighborhood && formData.city) done.push(1);
    // Etapa 2: entrega e retirada
    if ((hasDelivery || hasPickup) && (!hasDelivery || (formData.max_delivery_radius_km && formData.delivery_schedule?.length > 0))) done.push(2);
    // Etapa 3: pagamento
    if ((!hasDelivery || formData.payment_delivery?.length > 0) && (!hasPickup || formData.payment_pickup?.length > 0)) done.push(3);
    if (formData.agent_name) done.push(4);
    // Etapa 5 (Revisão) fica "concluída" visualmente quando todas as anteriores estão ok
    const requiredSteps = [1, 2, 3, 4].filter(n => !skippedSteps.includes(n));
    if (requiredSteps.every(n => done.includes(n))) done.push(5);
    return done;
  }, [formData, hasDelivery, hasPickup, skippedSteps]);

  // Campos que esta tela mudou desde que abriu (ou desde o último salvar): as regras só barram o que depende deles.
  const alterados = useMemo(
    () => Object.keys(diffPatch(baselineFormRef.current || {}, formData)),
    [formData, lastSavedAt] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const validacaoEtapa = useMemo(
    () => validarEtapa(currentStep, formData, alterados, { novo: !editingConfig }),
    [currentStep, formData, alterados, editingConfig]
  );

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

  const nextStep = async () => {
    // Regras da etapa: barram o que esta tela mexeu; problema antigo aparece só como aviso.
    const { erros } = validarEtapa(currentStep, formData, alterados, { novo: !editingConfig });
    if (erros.length > 0) { avisarErros(erros); return; }
    if (isDirty) {
      const ok = await handleSubmit();
      if (!ok) return;
    }
    let next = currentStep + 1;
    while (next <= 5 && skippedSteps.includes(next)) next++;
    if (next <= 5) goToStep(next);
  };

  const prevStep = () => {
    let prev = currentStep - 1;
    while (prev >= 1 && skippedSteps.includes(prev)) prev--;
    if (prev >= 1) goToStep(prev);
  };

  // Formas marcadas em alguma modalidade ligada: Pix, link e taxa só aparecem quando fazem sentido.
  const metodosMarcados = PAYMENT_METHODS.filter((pm) =>
    (hasDelivery && (formData.payment_delivery || []).includes(pm.value)) ||
    (hasPickup && (formData.payment_pickup || []).includes(pm.value)));
  const usaPix = metodosMarcados.some((pm) => pm.value === 'pix');
  const usaLink = metodosMarcados.some((pm) => pm.value === 'payment_link');
  const metodosComTaxa = metodosMarcados.filter((pm) => pm.value !== 'cash');

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 pt-12 min-h-[60vh]">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if ((displayConfigurations.length === 0 || activeHasNoConfig) && !isLoading) {
    return (
      <div className="px-4 md:px-8 pt-12">
        <div className="max-w-4xl mx-auto text-center py-24">
          <MaterialIcon icon="info" filled size={64} className="text-[#bccac0] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-ink mb-2">Nenhuma configuração encontrada</h3>
          <p className="text-[#3d4a42]/60 mb-6">Comece adicionando a primeira configuração de franquia.</p>
          {franchisesWithoutConfig.length > 0 && (
            <div className="max-w-xs mx-auto space-y-3">
              <Select onValueChange={(value) => {
                setFormData(prev => ({ ...prev, franchise_evolution_instance_id: value }));
              }}>
                <SelectTrigger className="bg-surface-line border-none rounded-xl">
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
                className="w-full bg-brand hover:bg-brand-dark text-white rounded-xl font-bold py-3 px-6 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
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

  // Franqueado com 2+ unidades e nenhuma escolhida: perguntar. Abrir "a primeira"
  // aqui faria ele editar o bot da unidade errada achando que era a outra.
  if (!isAdminUser && !currentConfig && availableFranchisesForUser.length > 1) {
    return (
      <FranchisePicker
        franchises={availableFranchisesForUser}
        title="Configurar o vendedor de qual unidade?"
      />
    );
  }

  return (
    <div className="pb-32">
      <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Meu Vendedor</h2>
            <p className="text-sm text-[#3d4a42]/70 mt-0.5">
              {/* Com 2+ unidades, dizer QUAL está aberta — o wizard mostra o nome
                  da unidade nos campos, e sem isso não dá pra ter certeza. */}
              {availableFranchisesForUser.length > 1 && currentFranchise
                ? `Unidade ${currentFranchise.city || currentFranchise.name}`
                : "Configure o assistente de vendas da sua unidade"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {displayConfigurations.length > 1 && (
              <Select value={selectedConfigId} onValueChange={handleSelectConfig}>
                <SelectTrigger className="bg-surface-line border-none rounded-xl text-sm w-48">
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
                  : 'bg-surface-line/50 border-[#bccac0]/30'
              }`}
              title="Clique para verificar o status atual"
            >
              {checkingStatusFor === currentConfig?.id ? (
                <MaterialIcon icon="progress_activity" size={8} className="animate-spin text-ink-2" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-ink-3'}`} />
              )}
              <span className={`text-xs font-semibold ${isConnected ? 'text-emerald-700' : 'text-ink-2'}`}>
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
                isConnected ? 'bg-emerald-100' : 'bg-surface-line/50'
              }`}>
                {isConnected ? (
                  <MaterialIcon icon="check_circle" filled size={32} className="text-emerald-600" />
                ) : (
                  <MaterialIcon icon="qr_code_2" size={36} className="text-[#bccac0]/60" />
                )}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                {isConnected ? 'WhatsApp ativo' : 'Conectar WhatsApp'}
              </h3>
              <p className="text-xs text-ink-2 mt-0.5">
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
                ? 'border border-ink-3/30 text-ink-2 hover:bg-surface-line/50'
                : 'bg-brand text-white hover:bg-brand-dark'
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

          {/* Etapa 1: Sua unidade — o CEP preenche rua, bairro e cidade */}
          {currentStep === 1 && (
            <WizardStep icon="storefront" title="Sua unidade" subtitle="Onde fica e como falar com você. O robô usa o endereço para calcular a distância até o cliente.">
              <AvisosDaEtapa avisos={validacaoEtapa.avisos} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>CEP</label>
                  <input className={`${inputClass} font-mono`} type="text" inputMode="numeric" value={formData.cep || ''}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Rua e número<RequiredDot /></label>
                  <input className={inputClass} type="text" value={formData.street_address || ''}
                    onChange={(e) => handleInputChange('street_address', e.target.value)}
                    placeholder="Ex: Rua das Flores, 123" />
                </div>
              </div>
              <FieldHint text={cepStatus || 'Digite o CEP: rua, bairro e cidade vêm sozinhos. Depois confira o número.'} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Bairro<RequiredDot /></label>
                  <input className={inputClass} type="text" value={formData.neighborhood || ''}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    placeholder="Ex: Centro" />
                </div>
                <div>
                  <label className={labelClass}>Cidade<RequiredDot /></label>
                  <input className={inputClass} type="text" value={formData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Ex: São João da Boa Vista" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Como os clientes conhecem sua unidade?<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.franchise_name || ''}
                  onChange={(e) => handleInputChange('franchise_name', e.target.value)}
                  placeholder="Ex: Maxi Massas - Itaim Bibi" />
                <FieldHint text="Esse nome aparece nas mensagens do robô para o cliente." />
              </div>
              <div>
                <label className={labelClass}>Ponto de referência para clientes</label>
                <textarea className={`${inputClass} resize-none`} rows={2} maxLength={400} value={formData.address_reference || ''}
                  onChange={(e) => handleInputChange('address_reference', e.target.value)}
                  placeholder="Ex: Próximo à praça, casa com portão azul..." />
                <FieldHint text={`SÓ ponto de referência (Ex: "casa azul ao lado do mercado"). NÃO coloque horários, endereço completo nem promoções. (${(formData.address_reference || '').length}/400)`} />
              </div>
              <div>
                <label className={labelClass}>Seu WhatsApp (recebe cada pedido fechado e os avisos do robô)<RequiredDot /></label>
                <input className={inputClass} type="tel" inputMode="numeric"
                  value={formData.personal_phone_for_summary?.replace(/\D/g, '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3').replace(/^(\d{2})(\d{1,5})$/, '($1) $2').replace(/^(\d{1,2})$/, '($1') || ''}
                  onChange={(e) => handleInputChange('personal_phone_for_summary', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="(11) 98765-4321" />
                <FieldHint text="Não é o número que atende os clientes (esse fica no card do WhatsApp, no topo). É para onde o robô manda os pedidos fechados e pede ajuda. DDD + número." />
              </div>
            </WizardStep>
          )}

          {/* Etapa 2: Entrega e retirada — como o cliente recebe */}
          {currentStep === 2 && (
            <WizardStep icon="local_shipping" title="Entrega e retirada" subtitle="Como o cliente recebe o pedido. O robô só oferece o que estiver ligado aqui.">
              <AvisosDaEtapa avisos={validacaoEtapa.avisos} />
              <ToggleCard
                icon="delivery_dining"
                label="Sua unidade faz ENTREGA?"
                description="O cliente recebe o pedido em casa"
                checked={hasDelivery}
                onChange={(val) => handleInputChange('has_delivery', val)}
              />
              {hasDelivery && (
                <div className="space-y-4 rounded-2xl border border-[#bccac0]/20 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Raio máximo (km)<RequiredDot /></label>
                      <input className={`${inputClass} font-mono`} type="number" min="1" max="60"
                        value={formData.max_delivery_radius_km ?? ''}
                        onChange={(e) => handleInputChange('max_delivery_radius_km', e.target.value ? Number(e.target.value) : null)}
                        placeholder="7" />
                    </div>
                    <div>
                      <label className={labelClass}>Pedido mínimo (R$)</label>
                      <input className={`${inputClass} font-mono`} type="number" min="0"
                        value={formData.min_order_value ?? ''}
                        onChange={(e) => handleInputChange('min_order_value', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Sem mínimo" />
                    </div>
                    <div>
                      <label className={labelClass}>Prazo de entrega (min)</label>
                      <input className={`${inputClass} font-mono`} type="number" min="0"
                        value={formData.avg_prep_time_minutes ?? ''}
                        onChange={(e) => handleInputChange('avg_prep_time_minutes', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Vazio" />
                    </div>
                  </div>
                  <FieldHint text='O robô recusa endereço fora do raio. Prazo: ele diz "em até X min" depois de confirmado. Se você entrega por janela de horário, deixe vazio.' />
                  <div>
                    <label className={labelClass}>Dias, horários e taxas de entrega</label>
                    <DeliveryScheduleEditor value={formData.delivery_schedule} onChange={handleScheduleChange} />
                  </div>
                </div>
              )}

              <ToggleCard
                icon="store"
                label="Aceita RETIRADA?"
                description="O cliente busca o pedido com você"
                checked={hasPickup}
                onChange={(val) => handleInputChange('has_pickup', val)}
              />
              {hasPickup && (
                <div className="space-y-4 rounded-2xl border border-[#bccac0]/20 p-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Como funciona a retirada?</label>
                    <RadioCards
                      options={PICKUP_TYPES}
                      value={formData.pickup_is_store ? 'store' : 'simple'}
                      onChange={(val) => handleInputChange('pickup_is_store', val === 'store')}
                    />
                  </div>
                  <ToggleCard
                    icon="calendar_clock"
                    label="Só com hora combinada"
                    description="O robô pede para o cliente combinar dia e horário antes de vir buscar. Desligue se o cliente pode chegar sem avisar."
                    checked={formData.pickup_requires_scheduling ?? true}
                    onChange={(val) => handleInputChange('pickup_requires_scheduling', val)}
                  />
                  <div className="space-y-2">
                    <label className={labelClass}>Endereço de retirada</label>
                    <RadioCards
                      options={[
                        { value: 'same', label: 'O da unidade', description: cadastroAddress || 'Preencha o endereço na etapa "Sua unidade"' },
                        { value: 'other', label: 'Outro endereço', description: 'A retirada é em outro lugar.' },
                      ]}
                      value={pickupAddrMode}
                      onChange={(val) => {
                        setPickupAddrMode(val);
                        if (val === 'same') handleInputChange('pickup_address', '');
                      }}
                    />
                    {pickupAddrMode === 'other' && (
                      <input className={inputClass} type="text" value={formData.pickup_address || ''}
                        onChange={(e) => handleInputChange('pickup_address', e.target.value)}
                        placeholder="Ex: Av. Brasil, 500 - Centro" />
                    )}
                    <FieldHint text="Só o endereço, sem instrução de acesso (portão, interfone): o robô não passa isso ao cliente." />
                  </div>
                  {hasDelivery ? (
                    <div>
                      <ToggleCard
                        icon="schedule"
                        label="Horário de retirada diferente da entrega?"
                        description="Desligado, a retirada segue o horário da entrega"
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
                    <div>
                      <label className={labelClass}>Horários de retirada</label>
                      <FieldHint text="Quando o cliente pode buscar. Sem entrega, esses horários também são o horário de funcionamento da unidade." />
                      <div className="mt-3">
                        <OperatingHoursEditor
                          value={formData.pickup_schedule?.length > 0 ? formData.pickup_schedule : (formData.operating_hours || [])}
                          onChange={(val) => {
                            handleInputChange('pickup_schedule', val);
                            handleInputChange('has_custom_pickup_hours', true);
                            const summary = val.map((r) => `${r.days.join(',')}: ${r.open}-${r.close}`).join(' | ');
                            handleInputChange('opening_hours', summary);
                            handleInputChange('working_days', [...new Set(val.flatMap((r) => r.days))].join(','));
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </WizardStep>
          )}

          {/* Etapa 3: Pagamento — uma tabela forma × entrega/retirada */}
          {currentStep === 3 && (
            <WizardStep icon="payments" title="Pagamento" subtitle="O que o cliente pode usar em cada caso. O robô só oferece o que estiver marcado.">
              <AvisosDaEtapa avisos={validacaoEtapa.avisos} />
              <PaymentMatrix
                methods={PAYMENT_METHODS}
                entrega={hasDelivery ? (formData.payment_delivery || []) : null}
                retirada={hasPickup ? (formData.payment_pickup || []) : null}
                onChangeEntrega={(val) => handleInputChange('payment_delivery', val)}
                onChangeRetirada={(val) => handleInputChange('payment_pickup', val)}
              />

              {(usaPix || formData.pix_key_data) && (
                <div className="border-t border-[#bccac0]/10 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-[#3d4a42] flex items-center gap-1.5">
                    <MaterialIcon icon="qr_code_2" size={14} />
                    Pix
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Tipo da chave</label>
                      <select
                        className={inputClass}
                        value={formData.pix_key_type || ''}
                        onChange={(e) => handleInputChange('pix_key_type', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {PIX_KEY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Chave Pix{usaPix && <RequiredDot />}</label>
                      <input className={inputClass} type="text" value={formData.pix_key_data || ''}
                        onChange={(e) => handleInputChange('pix_key_data', e.target.value)}
                        placeholder="Chave Pix" />
                    </div>
                    <div>
                      <label className={labelClass}>Nome do titular</label>
                      <input className={inputClass} type="text" value={formData.pix_holder_name || ''}
                        onChange={(e) => handleInputChange('pix_holder_name', e.target.value)}
                        placeholder="Ex: Nelson Pulitano" />
                    </div>
                    <div>
                      <label className={labelClass}>Banco</label>
                      <input className={inputClass} type="text" value={formData.pix_bank || ''}
                        onChange={(e) => handleInputChange('pix_bank', e.target.value)}
                        placeholder="Ex: Itaú, Nubank..." />
                    </div>
                  </div>
                  <FieldHint text="O robô manda a chave exatamente como está aqui, com o titular e o banco, para o cliente conferir para quem está pagando." />
                </div>
              )}

              {(usaLink || formData.payment_link) && (
                <div className="border-t border-[#bccac0]/10 pt-4">
                  <label className={labelClass}>Link de pagamento (opcional)</label>
                  <input className={inputClass} type="url" value={formData.payment_link || ''}
                    onChange={(e) => handleInputChange('payment_link', e.target.value)}
                    placeholder="https://..." />
                  <FieldHint text="Sem link fixo aqui, o robô diz que a unidade envia o link na hora. É o normal." />
                </div>
              )}

              <div className="border-t border-[#bccac0]/10 pt-4 space-y-3">
                <ToggleCard
                  icon="request_quote"
                  label="Repassar a taxa de cartão ao cliente?"
                  description="Ligado, a taxa é somada ao total que o cliente paga, no robô e no caixa (dá para mudar em cada venda)."
                  checked={formData.charges_card_fee_to_customer ?? false}
                  onChange={(val) => handleInputChange('charges_card_fee_to_customer', val)}
                />
                {metodosComTaxa.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-[#3d4a42] mb-1 flex items-center gap-1.5">
                      <MaterialIcon icon="percent" size={14} />
                      Taxa da operadora (%)
                    </h4>
                    <p className="text-[11px] text-ink-2/70 mb-3">
                      Só das formas que você marcou. Entra no cálculo do caixa; com "repassar" ligado, é somada ao total do cliente.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {metodosComTaxa.map((pm) => (
                        <div key={pm.value}>
                          <label className="text-xs font-medium text-ink-2 flex items-center gap-1 mb-1">
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
                              className="w-full bg-surface-line border-none rounded-xl px-3 py-2 pr-8 text-sm text-right font-mono"
                              value={formData.payment_fees?.[pm.value] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                handleInputChange('payment_fees', { ...(formData.payment_fees || {}), [pm.value]: val });
                              }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-2/50">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </WizardStep>
          )}

          {/* Etapa 4: Seu vendedor */}
          {currentStep === 4 && (
            <WizardStep icon="smart_toy" title="Seu vendedor" subtitle="Nome, catálogo, promoções e reservas: o que o robô usa para vender.">
              <AvisosDaEtapa avisos={validacaoEtapa.avisos} />
              <div>
                <label className={labelClass}>Nome da atendente (ex.: Ana)<RequiredDot /></label>
                <input className={inputClass} type="text" value={formData.agent_name || ''}
                  onChange={(e) => handleInputChange('agent_name', e.target.value)}
                  placeholder="Ex: Ana" />
                <FieldHint text='É o nome com que o robô se apresenta no WhatsApp. Use nome de pessoa, sem "bot", "IA" ou "assistente".' />
              </div>
              <div>
                <label className={labelClass}>Catálogo / Cardápio (imagem que o robô envia ao cliente)</label>
                <CatalogUpload
                  value={formData.catalog_image_url}
                  onChange={(url) => handleInputChange('catalog_image_url', url)}
                  franchiseId={editingConfig?.franchise_evolution_instance_id || 'default'}
                />
              </div>
              <div>
                <label className={labelClass}>Promoções ativas (o robô oferece uma vez por conversa)</label>
                <textarea className={`${inputClass} resize-y min-h-[120px]`} rows={5} maxLength={1500} value={formData.promotions_combo || ''}
                  onChange={(e) => handleInputChange('promotions_combo', e.target.value)}
                  placeholder="Ex: COMBO 1 (serve 5): 1 nhoque muçarela + 1 canelone brócolis — R$ 74,90&#10;COMBO 2 (serve 8): ... — R$ 99,90&#10;Pagamento via PIX." />
                <FieldHint text={`Use SÓ para promoções e combos ATIVOS. Avisos de horário, endereço, restrições, cumprimentos vão em outros campos. DEIXE VAZIO se não houver promoção. (${(formData.promotions_combo || '').length}/1500)`} />
                {(() => {
                  const t = (formData.promotions_combo || '').toLowerCase();
                  const flag = ['não temos promo', 'nao temos promo', 'no momento não', 'no momento nao', 'sendo elaborado', 'não há', 'nao ha', 'em breve', 'aguardando'].some(p => t.includes(p));
                  return flag ? (
                    <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                      <MaterialIcon icon="warning" size={14} className="mt-0.5 shrink-0" />
                      <span>Esse texto não é uma promoção — apague o campo (deixe vazio). Texto "não temos promoção" polui o robô e gasta tokens à toa.</span>
                    </p>
                  ) : null;
                })()}
              </div>
              <div>
                <ToggleCard
                  icon="event_available"
                  label="Aceitar reserva para outro dia sem pagamento antecipado?"
                  description="Vale para entrega e retirada. Ligado, o robô aceita pedido para outro dia sem cobrar na hora e avisa você para separar e confirmar."
                  checked={formData.accepts_reservation_without_payment ?? false}
                  onChange={(val) => handleInputChange('accepts_reservation_without_payment', val)}
                />
                <p className="text-xs text-ink-3 mt-1 ml-1">
                  Desligado por padrão. Ligue só se você aceita separar produto antes de receber: o risco do cliente sumir é seu.
                </p>
              </div>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <div>
                <label className={labelClass}>ID da Página do Facebook (Meta Ads)</label>
                <input className={inputClass} type="text" value={formData.facebook_page_id || ''}
                  onChange={(e) => handleInputChange('facebook_page_id', e.target.value)}
                  placeholder="Ex: 123456789012345" />
                <FieldHint text="Necessário para rastrear conversões via WhatsApp (CAPI). Encontre em: Página do Facebook → Sobre → ID da Página." />
              </div>
              )}
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
      <footer className="fixed bottom-16 md:bottom-0 right-0 left-0 md:left-[260px] bg-white border-t border-surface-line px-4 md:px-8 py-3 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Voltar */}
          <div className="w-28">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-brand text-brand font-bold text-sm hover:bg-brand/5 transition-all"
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
                      ? 'bg-surface-line/50'
                      : s === currentStep
                      ? 'bg-brand'
                      : completedSteps.includes(s)
                      ? 'bg-brand/30'
                      : 'bg-surface-line'
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
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm shadow-lg shadow-brand/20 transition-all disabled:opacity-60"
              >
                {isSubmitting && <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />}
                Próximo
                {!isSubmitting && <MaterialIcon icon="arrow_forward" size={16} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                /* NUNCA voltar a por `!isDirty` aqui. O "Proximo" ja salva sozinho a
                   cada etapa (nextStep -> handleSubmit quando isDirty), entao ao
                   chegar na Revisao nao ha nada sujo e o botao nascia MORTO: a
                   franqueada clicava em "Salvar" e nao acontecia nada. Era o
                   candidato mais forte aos 26,3% de sessoes com dead click nesta
                   tela (Clarity, 3 dias, auditoria 07/09/2026). */
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm shadow-lg shadow-brand/20 transition-all disabled:opacity-50"
              >
                {isSubmitting && <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />}
                Concluir
              </button>
            )}
          </div>
        </div>
      </footer>
      {/* Discard changes dialog (replaces window.confirm) */}
      {pendingConfigId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink mb-2">Alterações não salvas</h3>
            <p className="text-sm text-[#3d4a42] mb-6">Você tem alterações não salvas. Deseja descartá-las?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setPendingConfigId(null);
                  // Se a troca veio do seletor do topo, devolve o topo para a unidade
                  // que continua aberta aqui — senão o topo diz uma e o wizard mostra outra.
                  if (!isAdminUser && currentFranchise) setSelectedFranchise(currentFranchise);
                }}
                className="px-4 py-2 rounded-xl border border-[#bccac0] text-[#3d4a42] text-sm font-medium hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setIsDirty(false); applyConfigSelection(pendingConfigId); }}
                className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
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
