import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, AlertCircle, QrCode } from "lucide-react";

export default function WhatsAppConnectionModal({ 
  isOpen, 
  onClose, 
  qrCode, 
  status, 
  onCheckStatus,
  isCheckingStatus 
}) {
  const [qrCodeError, setQrCodeError] = React.useState(false);

  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-800',
          text: 'Conectado'
        };
      case 'pending_qr':
        return {
          icon: QrCode,
          color: 'bg-yellow-100 text-yellow-800',
          text: 'Aguardando QR Code'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'bg-red-100 text-red-800',
          text: 'Erro'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'bg-gray-100 text-gray-800',
          text: 'Desconectado'
        };
    }
  };

  const handleCloseAndCheck = () => {
    // A lógica de verificação agora é tratada pela função onClose do pai
    onClose();
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Verificação robusta do QR Code
  const hasValidQrCode = qrCode && 
    (typeof qrCode === 'string') && 
    qrCode.trim().length > 0 && 
    qrCode !== 'null' && 
    qrCode !== 'undefined';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-green-600" />
            Conectar WhatsApp
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Status da Conexão:</span>
            <Badge className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.text}
            </Badge>
          </div>

          {status === 'connected' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                WhatsApp Conectado com Sucesso!
              </h3>
              <p className="text-slate-600">
                O robô já está funcionando e pronto para receber mensagens.
              </p>
            </div>
          ) : hasValidQrCode ? (
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-4">
                Escaneie o QR Code abaixo com seu WhatsApp:
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200 inline-block">
                {!qrCodeError ? (
                  <img 
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48 mx-auto"
                    onError={() => {
                      console.error('Erro ao carregar QR Code:', qrCode);
                      setQrCodeError(true);
                    }}
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <p className="text-red-500 text-sm text-center">
                      Erro ao carregar QR Code. Tente gerar novamente.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>1. Abra o WhatsApp no seu celular</p>
                <p>2. Vá em Menu {"> Aparelhos conectados"}</p>
                <p>3. Toque em "Conectar um aparelho"</p>
                <p>4. Escaneie este QR Code</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-slate-400" />
              </div>
              {status === 'pending_qr' ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                  <p className="text-slate-600">
                    Gerando QR Code...
                  </p>
                </div>
              ) : (
                <p className="text-slate-600">
                  Clique em "Gerar QR Code" para começar a conexão.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={onCheckStatus}
              disabled={isCheckingStatus}
              className="flex-1"
            >
              {isCheckingStatus ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Verificar Status
            </Button>
            <Button onClick={handleCloseAndCheck} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}