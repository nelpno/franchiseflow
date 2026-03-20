import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FranchiseConfiguration, Franchise, User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, SlidersHorizontal, Info, Trash2, Sparkles, Loader2, Smartphone, Wifi, WifiOff, Building2, CreditCard, Truck, Megaphone, MessageCircle, CheckCircle2 } from "lucide-react";
import { optimizeConfig, connectWhatsappRobot, checkWhatsappStatus } from "@/api/functions";

import WhatsAppConnectionModal from "../components/whatsapp/WhatsAppConnectionModal";
import ErrorBoundary from "../components/ErrorBoundary";

const initialFormData = {
  franchise_evolution_instance_id: '',
  franchise_name: '', // Added this field for AI purposes
  accepted_payment_methods: '', // Alterado para string
  opening_hours: '',
  price_table_url: '',
  agent_name: '',
  promotions_combo: '',
  shipping_rules_costs: '',
  unit_address: '',
  address_reference: '', // Novo campo
  pix_key_data: '',
  personal_phone_for_summary: '',
  payment_link: '',
  social_media_links: { instagram: '' }
};

function FranchiseSettingsContent() {
  const [configurations, setConfigurations] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false); // State for AI optimization
  const [formData, setFormData] = useState(initialFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [displayConfigurations, setDisplayConfigurations] = useState([]); // Nova state para a lista a ser exibida

  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedConfigForWhatsApp, setSelectedConfigForWhatsApp] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkingStatusFor, setCheckingStatusFor] = useState(null); // Novo estado para indicar qual franquia está sendo verificada

  // Estado específico para controle seguro do modal
  const [modalData, setModalData] = useState(null); // null quando fechado, objeto quando aberto

  // Usar useCallback para estabilizar funções e evitar re-renders desnecessários
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
      alert("Erro ao carregar configurações. Por favor, recarregue a página.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Novo useEffect para calcular a lista de exibição apenas quando os dados mudarem
  useEffect(() => {
    if (!isLoading && currentUser && franchises.length > 0 && configurations.length > 0) {
      // Filtra as franquias que o usuário pode ver
      const availableFranchises = currentUser.role === 'admin'
        ? franchises
        : franchises.filter((f) => currentUser.managed_franchise_ids?.includes(f.evolution_instance_id));
      
      const availableFranchiseIds = availableFranchises.map(f => f.evolution_instance_id);

      // Filtra as configurações que correspondem às franquias disponíveis
      const filteredConfigs = configurations.filter(config =>
        availableFranchiseIds.includes(config.franchise_evolution_instance_id)
      );
      
      // Mapeia os dados para incluir o objeto da franquia
      const configsToDisplay = filteredConfigs.map(config => {
        // Find the corresponding franchise object. This should always find one due to the filtering above.
        const franchise = availableFranchises.find(f => f.evolution_instance_id === config.franchise_evolution_instance_id);
        return { ...config, franchise }; // Adiciona o objeto da franquia à configuração
      });

      setDisplayConfigurations(configsToDisplay);
    } else if (!isLoading && currentUser) {
        // No matching configs found — show empty state
        setDisplayConfigurations([]);
    }
  }, [isLoading, currentUser, franchises, configurations]);

  // Sincroniza o modal com os dados
  useEffect(() => {
    if (modalData) {
      setShowWhatsAppModal(true);
    } else {
      setShowWhatsAppModal(false);
    }
  }, [modalData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Standard for most browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Função auxiliar para atualizar uma configuração específica no estado 'configurations'
  // e, por extensão, acionar o useEffect para atualizar 'displayConfigurations'
  const updateConfigurationStatus = useCallback((configId, updates) => {
    setConfigurations((prev) => prev.map((config) =>
      config.id === configId ?
        { ...config, ...updates } :
        config
    ));
  }, []);

  // Helper function to get franchise by instance ID (used for New Config form and general lookup)
  const getFranchiseByInstanceId = (instanceId) => {
    return franchises.find((f) => f.evolution_instance_id === instanceId);
  };

  const handleNewConfig = () => {
    setEditingConfig(null);
    setFormData(initialFormData);
    setShowForm(true);
    setIsDirty(false);
  };

  const handleEditConfig = (config) => {
    setEditingConfig(config);

    // Converte dados antigos (array) para string para manter a compatibilidade
    const paymentMethods = config.accepted_payment_methods;
    const paymentMethodsStr = Array.isArray(paymentMethods) ? paymentMethods.join(', ') : paymentMethods || '';

    setFormData({
      ...initialFormData, // Start with all initial fields
      ...config, // Overlay with existing config data
      accepted_payment_methods: paymentMethodsStr, // Garante que seja uma string
      address_reference: config.address_reference || '', // Carrega o novo campo
      social_media_links: {
        instagram: config.social_media_links?.instagram || ''
      },
      // Ensure franchise_name is explicitly set, defaulting to empty string if not present in config
      franchise_name: config.franchise_name || ''
    });
    setShowForm(true);
    setIsDirty(false);
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm("Você tem alterações não salvas. Tem certeza que deseja descartá-las?")) {
        setShowForm(false);
        setIsDirty(false);
      }
    } else {
      setShowForm(false);
    }
  };

  const handleDelete = async () => {
    if (!editingConfig) return;
    if (window.confirm("Tem certeza que deseja excluir esta configuração?")) {
      setIsSubmitting(true);
      try {
        await FranchiseConfiguration.delete(editingConfig.id);

        // Remove a configuração do estado local
        setConfigurations((prev) => prev.filter((config) => config.id !== editingConfig.id));

        setShowForm(false);
        setIsDirty(false);
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Falha ao excluir configuração.");
      }
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Garantir que todos os campos sejam strings e não arrays
    const finalData = {
      ...formData,
      // Garante que accepted_payment_methods seja sempre uma string
      accepted_payment_methods: typeof formData.accepted_payment_methods === 'string' ?
        formData.accepted_payment_methods :
        Array.isArray(formData.accepted_payment_methods) ?
          formData.accepted_payment_methods.join(', ') :
          '',
      // Garante que address_reference seja sempre uma string
      address_reference: formData.address_reference || ''
    };

    try {
      if (editingConfig) {
        await FranchiseConfiguration.update(editingConfig.id, finalData);

        // Atualiza apenas a configuração editada no estado local
        updateConfigurationStatus(editingConfig.id, finalData);
      } else {
        const newConfig = await FranchiseConfiguration.create(finalData);

        // Adiciona a nova configuração ao estado local
        setConfigurations((prev) => [...prev, newConfig]);
      }
      setShowForm(false);
      setIsDirty(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Falha ao salvar configuração.");
    }
    setIsSubmitting(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSocialMediaChange = (platform, value) => {
    setFormData((prev) => ({
      ...prev,
      social_media_links: {
        ...prev.social_media_links,
        [platform]: value
      }
    }));
    setIsDirty(true);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      // Envia os dados do formulário atual para a função de backend
      const { data: optimizedData } = await optimizeConfig(formData);

      // Atualiza o formulário com os dados otimizados, mantendo os que não foram alterados
      setFormData((prevData) => ({
        ...prevData,
        ...optimizedData,
        // Garante que objetos aninhados sejam mesclados corretamente
        social_media_links: {
          ...prevData.social_media_links,
          ...(optimizedData.social_media_links || {})
        }
      }));

      setIsDirty(true); // Marca o formulário como alterado
      alert("Textos otimizados com IA! Revise as sugestões e salve as alterações.");
    } catch (error) {
      console.error("Erro ao otimizar com IA:", error);
      alert("Ocorreu um erro ao tentar otimizar os dados. Tente novamente.");
    }
    setIsOptimizing(false);
  };

  const handleConnectWhatsApp = useCallback(async (config) => {
    if (!config || !config.franchise_evolution_instance_id) {
      alert('Configuração inválida. Por favor, recarregue a página e tente novamente.');
      return;
    }

    if (!currentUser) {
      alert('Usuário não identificado. Por favor, faça login novamente.');
      return;
    }

    setIsConnectingWhatsApp(true);
    setSelectedConfigForWhatsApp(config);
    setModalData(null);

    try {
      console.log('Tentando conectar WhatsApp para:', config.franchise_evolution_instance_id);

      const response = await connectWhatsappRobot({
        franchise_evolution_instance_id: config.franchise_evolution_instance_id
      });

      const data = response.data || response;
      console.log('Resposta do connectWhatsappRobot:', data);

      if (data.status === 'connected' || data.connected === true) {
        updateConfigurationStatus(config.id, {
          whatsapp_status: 'connected',
          whatsapp_instance_id: data.instanceId || data.instance_id || config.whatsapp_instance_id || '',
          whatsapp_qr_code: null
        });
        alert('Este WhatsApp já está conectado!');
        
      } else if (data.qrCode || data.qr_code || data.qrcode) {
        const qrCodeValue = data.qrCode || data.qr_code || data.qrcode;
        if (qrCodeValue && typeof qrCodeValue === 'string' && qrCodeValue.trim().length > 0) {
            updateConfigurationStatus(config.id, {
              whatsapp_status: 'pending_qr',
              whatsapp_instance_id: data.instanceId || data.instance_id || config.whatsapp_instance_id || '',
              whatsapp_qr_code: qrCodeValue
            });

            setModalData({
                qrCode: qrCodeValue,
                status: 'pending_qr',
                instanceId: data.instanceId || data.instance_id || config.whatsapp_instance_id || ''
            });
        } else {
            throw new Error('QR Code recebido é inválido ou vazio');
        }
      } else {
        throw new Error('Resposta inesperada do sistema de WhatsApp. Tente novamente.');
      }

    } catch (error) {
      console.error("Erro detalhado ao conectar WhatsApp:", error);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }

      alert(error.response?.status === 403 ?
        "Você não tem permissão para conectar o WhatsApp desta franquia. Entre em contato com o administrador." :
        "Falha ao conectar. Tente novamente."
      );
      setModalData(null);

    } finally {
        setIsConnectingWhatsApp(false);
    }
  }, [currentUser, updateConfigurationStatus]);

  const handleCheckWhatsAppStatus = async () => {
    if (!selectedConfigForWhatsApp) return;

    setIsCheckingStatus(true);
    try {
      console.log('Verificando status do WhatsApp para:', selectedConfigForWhatsApp.franchise_evolution_instance_id);

      const { data } = await checkWhatsappStatus({
        franchise_evolution_instance_id: selectedConfigForWhatsApp.franchise_evolution_instance_id
      });

      console.log('Resposta do status check:', data);

      // Determina o novo status baseado na resposta
      let newStatus = 'disconnected';
      if (data.status === 'open' || data.connected === true) {
        newStatus = 'connected';
      } else if (data.status === 'connecting' || data.status === 'pending') {
        newStatus = 'pending_qr';
      }

      // Atualizar modal data se necessário
      if (modalData) {
        setModalData({ ...modalData, status: newStatus });
      }

      // Atualiza o status local imediatamente na lista principal
      updateConfigurationStatus(selectedConfigForWhatsApp.id, {
        whatsapp_status: newStatus
      });

    } catch (error) {
      console.error("Erro ao verificar status:", error);

      // Verificar se é problema de permissões
      if (error.response?.status === 403 || error.response?.status === 401) {
        alert("Você não tem permissão para verificar o status do WhatsApp desta franquia.");
      } else {
        alert("Erro ao verificar status do WhatsApp.");
      }
    }
    setIsCheckingStatus(false);
  };

  const handleCloseModalAndCheckStatus = () => {
    setModalData(null);
    
    if (selectedConfigForWhatsApp) {
      setTimeout(() => {
        handleCheckWhatsAppStatus();
      }, 500);
    }
  };

  const handleCheckStatusFromBadge = async (config) => {
    if (checkingStatusFor === config.id) return; // Evita múltiplos cliques simultâneos

    setCheckingStatusFor(config.id);
    try {
      console.log('Verificando status do badge para:', config.franchise_evolution_instance_id);

      const { data } = await checkWhatsappStatus({
        franchise_evolution_instance_id: config.franchise_evolution_instance_id
      });

      console.log('Resposta do status badge check:', data);

      // Determina o novo status baseado na resposta
      let newStatus = 'disconnected';
      if (data.status === 'open' || data.connected === true) {
        newStatus = 'connected';
      } else if (data.status === 'connecting' || data.status === 'pending') {
        newStatus = 'pending_qr';
      }

      // Atualiza esta configuração específica
      updateConfigurationStatus(config.id, {
        whatsapp_status: newStatus
      });

    } catch (error) {
      console.error("Erro ao verificar status do badge:", error);

      // Verificar se é problema de permissões
      if (error.response?.status === 403 || error.response?.status === 401) {
        alert("Você não tem permissão para verificar o status do WhatsApp desta franquia.");
      } else {
        alert("Erro ao verificar status do WhatsApp.");
      }
    }
    setCheckingStatusFor(null);
  };

  const getWhatsAppStatusBadge = (config) => {
    const isChecking = checkingStatusFor === config.id;
    const status = config.whatsapp_status || 'disconnected';

    const getBadgeContent = () => {
      if (isChecking) {
        return (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Verificando...
          </>
        );
      }

      switch (status) {
        case 'connected':
          return (
            <>
              <Wifi className="w-3 h-3 mr-1" />
              Conectado
            </>
          );
        case 'pending_qr':
          return (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Conectando
            </>
          );
        case 'error':
          return (
            <>
              <WifiOff className="w-3 h-3 mr-1" />
              Erro
            </>
          );
        default:
          return (
            <>
              <WifiOff className="w-3 h-3 mr-1" />
              Desconectado
            </>
          );
      }
    };

    const getBadgeColor = () => {
      if (isChecking) return 'bg-blue-100 text-blue-800 cursor-wait';

      switch (status) {
        case 'connected':
          return 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer';
        case 'pending_qr':
          return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer';
        case 'error':
          return 'bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer';
        default:
          return 'bg-gray-100 text-gray-800 hover:bg-gray-200 cursor-pointer';
      }
    };

    return (
      <Badge
        className={`transition-colors duration-200 ${getBadgeColor()}`}
        onClick={() => !isChecking && handleCheckStatusFromBadge(config)}
        title={isChecking ? 'Verificando status...' : 'Clique para verificar o status atual'}
      >
        {getBadgeContent()}
      </Badge>
    );
  };

  const availableFranchisesForUser = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.role === 'admin' ?
      franchises :
      franchises.filter((f) => currentUser.managed_franchise_ids?.includes(f.evolution_instance_id));
  }, [currentUser, franchises]);

  const configuredInstanceIds = configurations.map((c) => c.franchise_evolution_instance_id);
  const franchisesWithoutConfig = availableFranchisesForUser.filter((f) => !configuredInstanceIds.includes(f.evolution_instance_id));

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-indigo-50 to-purple-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <SlidersHorizontal className="w-8 h-8 text-indigo-600" />
              Configurações IA
            </h1>
            <p className="text-slate-600 mt-1">Gerencie as variáveis da Inteligência Artificial para cada franquia.</p>
          </div>
          {(franchisesWithoutConfig.length > 0 || currentUser?.role === 'admin') &&
            <Button onClick={handleNewConfig} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Configuração
            </Button>
          }
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ?
            Array.from({ length: 3 }).map((_, i) =>
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-6 bg-slate-200 rounded w-3/4"></div></CardHeader>
                <CardContent><div className="space-y-2"><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></CardContent>
              </Card>
            ) :
            displayConfigurations.length > 0 ?
              displayConfigurations.map((config) => {
                // O objeto da franquia agora está diretamente em config.franchise
                const franchise = config.franchise;

                return (
                  <Card key={config.id} className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <div>
                          <span>{config.franchise_name || franchise.city}</span>
                          <div className="mt-2">
                            {getWhatsAppStatusBadge(config)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditConfig(config)}>
                            <Edit className="w-3 h-3 mr-2" />
                            Editar
                          </Button>
                          {config.whatsapp_status !== 'connected' &&
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnectWhatsApp(config)}
                              disabled={isConnectingWhatsApp && selectedConfigForWhatsApp?.id === config.id}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                              {isConnectingWhatsApp && selectedConfigForWhatsApp?.id === config.id ?
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" /> :
                                <Smartphone className="w-3 h-3 mr-2" />
                              }
                              Conectar Robô
                            </Button>
                          }
                        </div>
                      </CardTitle>
                      <p className="text-sm text-slate-500">{franchise.owner_name}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm"><strong className="text-slate-600">Endereço:</strong> {config.unit_address || 'N/A'}</div>
                      {config.address_reference &&
                        <div className="text-sm"><strong className="text-slate-600">Referência:</strong> {config.address_reference}</div>
                      }
                      <div className="text-sm"><strong className="text-slate-600">Horários:</strong> {config.opening_hours || 'N/A'}</div>
                      <div className="text-sm"><strong className="text-slate-600">Atendente:</strong> {config.agent_name || 'N/A'}</div>

                      {/* Exibição como texto */}
                      <div className="text-sm">
                        <strong className="text-slate-600">Pagamentos:</strong>
                        <p className="text-slate-700 whitespace-pre-wrap pt-1">{config.accepted_payment_methods || 'N/A'}</p>
                      </div>

                      {config.pix_key_data &&
                        <div className="text-sm"><strong className="text-slate-600">PIX:</strong> {config.pix_key_data}</div>
                      }
                    </CardContent>
                  </Card>
                );
              }) :

              <div className="col-span-full text-center py-16">
                <Info className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhuma configuração encontrada</h3>
                <p className="text-slate-600">Comece adicionando a primeira configuração de franquia.</p>
              </div>
          }
        </div>

        {/* Modal do WhatsApp */}
        {showWhatsAppModal && modalData && (
          <WhatsAppConnectionModal
            isOpen={showWhatsAppModal}
            onClose={handleCloseModalAndCheckStatus} // Usa a nova função aqui
            qrCode={modalData.qrCode}
            status={modalData.status}
            onCheckStatus={handleCheckWhatsAppStatus}
            isCheckingStatus={isCheckingStatus} />
        )}


        {showForm &&
          <Dialog open={true} onOpenChange={handleCancel}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle>{editingConfig ? 'Editar' : 'Nova'} Configuração</DialogTitle>
                  {editingConfig &&
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOptimize}
                      disabled={isOptimizing || isSubmitting}
                      className="bg-purple-100  text-purple-700 border-purple-200 hover:bg-purple-200 shadow-sm">
                      {isOptimizing ?
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
                        <Sparkles className="w-4 h-4 mr-2" />
                      }
                      Otimizar com IA
                    </Button>
                  }
                </div>
                <DialogDescription>
                  Preencha os dados de configuração da franquia. Você pode usar a IA para melhorar os textos.
                </DialogDescription>
              </DialogHeader>
              <form id="main-form" onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                {!editingConfig ?
                  <div>
                    <Label htmlFor="franchise-select">Franquia *</Label>
                    <Select onValueChange={(value) => handleInputChange('franchise_evolution_instance_id', value)} required>
                      <SelectTrigger><SelectValue placeholder="Selecione uma franquia..." /></SelectTrigger>
                      <SelectContent>
                        {franchisesWithoutConfig.map((f) =>
                          <SelectItem key={f.id} value={f.evolution_instance_id}>{f.city}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div> :

                  <p><strong>Franquia:</strong> {getFranchiseByInstanceId(formData.franchise_evolution_instance_id)?.city}</p>
                }

                {/* Progress indicator */}
                {(() => {
                  const tabsComplete = [
                    // Tab 1 - Dados da Unidade
                    !!(formData.franchise_name && formData.unit_address && formData.opening_hours),
                    // Tab 2 - Pagamentos
                    !!(formData.accepted_payment_methods && formData.pix_key_data),
                    // Tab 3 - Delivery
                    !!formData.shipping_rules_costs,
                    // Tab 4 - Marketing
                    !!(formData.agent_name || formData.promotions_combo || formData.price_table_url || formData.social_media_links?.instagram),
                    // Tab 5 - WhatsApp
                    !!formData.personal_phone_for_summary
                  ];
                  const completedCount = tabsComplete.filter(Boolean).length;
                  return (
                    <div className="flex items-center gap-2 px-1 py-2 bg-slate-50 rounded-lg">
                      <CheckCircle2 className={`w-4 h-4 ${completedCount === 5 ? 'text-green-600' : 'text-slate-400'}`} />
                      <span className="text-sm text-slate-600">
                        <strong>{completedCount}</strong> de <strong>5</strong> seções completas
                      </span>
                      <div className="flex gap-1 ml-auto">
                        {tabsComplete.map((complete, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${complete ? 'bg-green-500' : 'bg-slate-300'}`} />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <Tabs defaultValue="unidade" className="w-full">
                  <TabsList className="w-full h-auto flex overflow-x-auto justify-start gap-1 bg-slate-100 p-1 rounded-lg">
                    <TabsTrigger value="unidade" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 min-w-fit">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Dados da Unidade</span>
                      <span className="sm:hidden">Unidade</span>
                    </TabsTrigger>
                    <TabsTrigger value="pagamentos" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 min-w-fit">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pagamentos</span>
                    </TabsTrigger>
                    <TabsTrigger value="delivery" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 min-w-fit">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Delivery</span>
                    </TabsTrigger>
                    <TabsTrigger value="marketing" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 min-w-fit">
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Marketing</span>
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 min-w-fit">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab 1 - Dados da Unidade */}
                  <TabsContent value="unidade" className="grid gap-4 mt-4">
                    <div>
                      <Label htmlFor="franchise_name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cidade/bairro da Franquia (para IA)</Label>
                      <Input
                        id="franchise_name"
                        value={formData.franchise_name}
                        onChange={(e) => handleInputChange('franchise_name', e.target.value)}
                        placeholder="Ex: Cordeirópolis e Iracemápolis" />
                    </div>
                    <div>
                      <Label htmlFor="unit_address" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Endereço da Unidade (Rua, nº, Bairro, Cidade)</Label>
                      <Input
                        id="unit_address"
                        value={formData.unit_address}
                        onChange={(e) => handleInputChange('unit_address', e.target.value)}
                        placeholder="Rua, número, bairro, cidade, CEP..."
                        className="w-full" />
                    </div>
                    <div>
                      <Label htmlFor="address_reference">Ponto de Referência e Detalhes da Região</Label>
                      <textarea
                        id="address_reference"
                        value={formData.address_reference}
                        onChange={(e) => handleInputChange('address_reference', e.target.value)}
                        placeholder="Ex: Próximo à praça, casa com portão azul..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[80px] resize-y" />
                    </div>
                    <div>
                      <Label htmlFor="opening_hours" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Horários e Regras de Funcionamento</Label>
                      <textarea
                        id="opening_hours"
                        value={formData.opening_hours}
                        onChange={(e) => handleInputChange('opening_hours', e.target.value)}
                        placeholder="Ex: Seg-Sex: 08h-18h, Sáb: 09h-13h&#10;Não funcionamos nos feriados&#10;Entregas até 20h"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[80px] resize-y" />
                    </div>
                  </TabsContent>

                  {/* Tab 2 - Pagamentos */}
                  <TabsContent value="pagamentos" className="grid gap-4 mt-4">
                    <div>
                      <Label htmlFor="accepted_payment_methods" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Métodos e Regras de Pagamento</Label>
                      <textarea
                        id="accepted_payment_methods"
                        value={formData.accepted_payment_methods}
                        onChange={(e) => handleInputChange('accepted_payment_methods', e.target.value)}
                        placeholder="Ex: Entregas: Pix, Link de Cartão | Retirada: Pix, Dinheiro"
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[80px] resize-y" />
                    </div>
                    <div>
                      <Label htmlFor="pix_key_data">Dados Chave PIX</Label>
                      <Input
                        id="pix_key_data"
                        value={formData.pix_key_data}
                        onChange={(e) => handleInputChange('pix_key_data', e.target.value)}
                        placeholder="Chave PIX ou informações de pagamento" />
                    </div>
                    <div>
                      <Label htmlFor="payment_link">Link de Pagamento</Label>
                      <Input
                        id="payment_link"
                        type="url"
                        value={formData.payment_link}
                        onChange={(e) => handleInputChange('payment_link', e.target.value)}
                        placeholder="https://..." />
                    </div>
                  </TabsContent>

                  {/* Tab 3 - Delivery */}
                  <TabsContent value="delivery" className="grid gap-4 mt-4">
                    <div>
                      <Label htmlFor="shipping_rules_costs">Regras de Frete e Valores Cobrados</Label>
                      <textarea
                        id="shipping_rules_costs"
                        value={formData.shipping_rules_costs}
                        onChange={(e) => handleInputChange('shipping_rules_costs', e.target.value)}
                        placeholder="Descreva as regras de entrega e valores de frete..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[100px] resize-y" />
                    </div>
                  </TabsContent>

                  {/* Tab 4 - Marketing */}
                  <TabsContent value="marketing" className="grid gap-4 mt-4">
                    <div>
                      <Label htmlFor="agent_name">Nome do Agente IA</Label>
                      <Input
                        id="agent_name"
                        value={formData.agent_name}
                        onChange={(e) => handleInputChange('agent_name', e.target.value)}
                        placeholder="Ex: Maria Silva" />
                    </div>
                    <div>
                      <Label htmlFor="promotions_combo">Promoções/Combo</Label>
                      <textarea
                        id="promotions_combo"
                        value={formData.promotions_combo}
                        onChange={(e) => handleInputChange('promotions_combo', e.target.value)}
                        placeholder="Descreva as promoções e combos disponíveis..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[80px] resize-y" />
                    </div>
                    <div>
                      <Label htmlFor="price_table_url" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">URL da Tabela de Estoque</Label>
                      <Input
                        id="price_table_url"
                        type="url"
                        value={formData.price_table_url}
                        onChange={(e) => handleInputChange('price_table_url', e.target.value)}
                        placeholder="https://..." />
                    </div>
                    <div>
                      <Label htmlFor="social_instagram">Instagram</Label>
                      <Input
                        id="social_instagram"
                        value={formData.social_media_links.instagram}
                        onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
                        placeholder="URL do perfil no Instagram" />
                    </div>
                  </TabsContent>

                  {/* Tab 5 - WhatsApp */}
                  <TabsContent value="whatsapp" className="grid gap-4 mt-4">
                    {editingConfig && (
                      <div className="flex flex-col gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-green-700" />
                            <span className="font-medium text-green-800">Conexão WhatsApp</span>
                          </div>
                          {getWhatsAppStatusBadge(editingConfig)}
                        </div>
                        {editingConfig.whatsapp_status !== 'connected' && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleConnectWhatsApp(editingConfig)}
                            disabled={isConnectingWhatsApp && selectedConfigForWhatsApp?.id === editingConfig.id}
                            className="bg-green-100 text-green-700 border-green-300 hover:bg-green-200 w-full sm:w-auto">
                            {isConnectingWhatsApp && selectedConfigForWhatsApp?.id === editingConfig.id ?
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
                              <Smartphone className="w-4 h-4 mr-2" />
                            }
                            Conectar Robô WhatsApp
                          </Button>
                        )}
                      </div>
                    )}
                    <div>
                      <Label htmlFor="personal_phone_for_summary">Telefone Pessoal para Resumo</Label>
                      <Input
                        id="personal_phone_for_summary"
                        value={formData.personal_phone_for_summary}
                        onChange={(e) => handleInputChange('personal_phone_for_summary', e.target.value)}
                        placeholder="Ex: 5511999999999" />
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
              <DialogFooter className="flex justify-between w-full">
                {editingConfig &&
                  <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                }
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCancel}>Cancelar</Button>
                  <Button type="submit" form="main-form" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      </div>
    </div>
  );
}

// Exportar com Error Boundary
export default function FranchiseSettings() {
  return (
    <ErrorBoundary>
      <FranchiseSettingsContent />
    </ErrorBoundary>
  );
}