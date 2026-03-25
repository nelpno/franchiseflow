import { useState, useCallback, useEffect } from "react";
import { connectWhatsappRobot, checkWhatsappStatus } from "@/api/functions";
import { toast } from "sonner";

/**
 * Validates that required vendor wizard fields are filled before allowing WhatsApp connection.
 * Returns an array of missing field labels (empty = all valid).
 */
function validateVendorConfig(config) {
  const missing = [];

  if (!config.franchise_name?.trim()) {
    missing.push('Nome da unidade');
  }
  if (!config.unit_address?.trim()) {
    missing.push('Endereço');
  }
  if (!config.working_days?.trim()) {
    missing.push('Dias de funcionamento');
  }
  if (!config.opening_hours?.trim()) {
    missing.push('Horário de funcionamento');
  }

  // Must have at least one sales channel (delivery or pickup)
  const hasDelivery = config.has_delivery ?? false;
  const hasPickup = config.has_pickup ?? false;
  if (!hasDelivery && !hasPickup) {
    missing.push('Forma de operação (entrega ou retirada)');
  }

  // If delivery is enabled, must have payment methods for delivery
  if (hasDelivery && (!config.payment_delivery || !Array.isArray(config.payment_delivery) || config.payment_delivery.length === 0)) {
    missing.push('Formas de pagamento (entrega)');
  }

  // If pickup is enabled, must have payment methods for pickup
  if (hasPickup && (!config.payment_pickup || !Array.isArray(config.payment_pickup) || config.payment_pickup.length === 0)) {
    missing.push('Formas de pagamento (retirada)');
  }

  return missing;
}

export default function useWhatsAppConnection({ currentUser, updateConfigurationStatus }) {
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedConfigForWhatsApp, setSelectedConfigForWhatsApp] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkingStatusFor, setCheckingStatusFor] = useState(null);
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    setShowWhatsAppModal(!!modalData);
  }, [modalData]);

  const handleConnectWhatsApp = useCallback(async (config) => {
    if (!config || !config.franchise_evolution_instance_id) {
      toast.error('Configuração inválida. Por favor, recarregue a página e tente novamente.');
      return;
    }
    if (!currentUser) {
      toast.error('Usuário não identificado. Por favor, faça login novamente.');
      return;
    }

    // Validate vendor wizard fields before connecting
    const missingFields = validateVendorConfig(config);
    if (missingFields.length > 0) {
      toast.error(
        `Preencha os campos obrigatórios no "Meu Vendedor" antes de conectar o WhatsApp:\n\n• ${missingFields.join('\n• ')}`,
        { duration: 8000 }
      );
      return;
    }

    setIsConnectingWhatsApp(true);
    setSelectedConfigForWhatsApp(config);
    setModalData(null);
    try {
      const response = await connectWhatsappRobot({ instanceName: config.franchise_evolution_instance_id });
      const data = response.data || response;
      if (data.status === 'connected' || data.connected === true) {
        updateConfigurationStatus(config.id, {
          whatsapp_status: 'connected',
          whatsapp_instance_id: data.instanceId || data.instance_id || config.whatsapp_instance_id || '',
          whatsapp_qr_code: null
        });
        toast.success('Este WhatsApp já está conectado!');
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
      const isTimeout = error.name === 'AbortError' || error.message?.includes('abort');
      if (isTimeout) {
        toast.error("O QR Code demorou para ser gerado. Tente novamente em alguns segundos.", { duration: 6000 });
      } else if (error.response?.status === 403) {
        toast.error("Você não tem permissão para conectar o WhatsApp desta franquia.");
      } else {
        toast.error(`Falha ao conectar: ${error.message || "Tente novamente."}`);
      }
      setModalData(null);
    } finally {
      setIsConnectingWhatsApp(false);
    }
  }, [currentUser, updateConfigurationStatus]);

  const handleCheckWhatsAppStatus = useCallback(async () => {
    if (!selectedConfigForWhatsApp) return;
    setIsCheckingStatus(true);
    try {
      const data = await checkWhatsappStatus({ instanceName: selectedConfigForWhatsApp.franchise_evolution_instance_id });
      let newStatus = 'disconnected';
      if (data.status === 'open' || data.connected === true) newStatus = 'connected';
      else if (data.status === 'connecting' || data.status === 'pending' || data.status === 'pending_qr' || data.qrCode || data.qr_code) newStatus = 'pending_qr';
      if (modalData) setModalData({ ...modalData, status: newStatus });
      updateConfigurationStatus(selectedConfigForWhatsApp.id, { whatsapp_status: newStatus });
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      toast.error(error.response?.status === 403 || error.response?.status === 401
        ? "Você não tem permissão para verificar o status do WhatsApp desta franquia."
        : "Erro ao verificar status do WhatsApp."
      );
    }
    setIsCheckingStatus(false);
  }, [selectedConfigForWhatsApp, modalData, updateConfigurationStatus]);

  const handleCloseModalAndCheckStatus = useCallback(() => {
    setModalData(null);
    if (selectedConfigForWhatsApp) setTimeout(() => handleCheckWhatsAppStatus(), 500);
  }, [selectedConfigForWhatsApp, handleCheckWhatsAppStatus]);

  const handleCheckStatusFromBadge = useCallback(async (config) => {
    if (checkingStatusFor === config.id) return;
    setCheckingStatusFor(config.id);
    try {
      const data = await checkWhatsappStatus({ instanceName: config.franchise_evolution_instance_id });
      let newStatus = 'disconnected';
      if (data.status === 'open' || data.connected === true) newStatus = 'connected';
      else if (data.status === 'connecting' || data.status === 'pending' || data.status === 'pending_qr' || data.qrCode || data.qr_code) newStatus = 'pending_qr';
      updateConfigurationStatus(config.id, { whatsapp_status: newStatus });
    } catch (error) {
      console.error("Erro ao verificar status do badge:", error);
      toast.error(error.response?.status === 403 || error.response?.status === 401
        ? "Você não tem permissão para verificar o status do WhatsApp desta franquia."
        : "Erro ao verificar status do WhatsApp."
      );
    }
    setCheckingStatusFor(null);
  }, [checkingStatusFor, updateConfigurationStatus]);

  return {
    isConnectingWhatsApp,
    showWhatsAppModal,
    isCheckingStatus,
    checkingStatusFor,
    modalData,
    handleConnectWhatsApp,
    handleCheckWhatsAppStatus,
    handleCloseModalAndCheckStatus,
    handleCheckStatusFromBadge,
  };
}
