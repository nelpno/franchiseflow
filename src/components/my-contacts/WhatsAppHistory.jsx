import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatPhone } from "@/lib/whatsappUtils";
import { getWhatsAppMessages } from "@/api/functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WhatsAppHistory({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  instanceName,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const loadMessages = async () => {
    if (!contactPhone || !instanceName) {
      setError("connect");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getWhatsAppMessages(instanceName, contactPhone, 20);
      setMessages(data);
      if (data.length === 0) {
        setError("empty");
      }
    } catch (err) {
      console.error("Erro ao buscar mensagens WhatsApp:", err);
      setError("unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && contactPhone) {
      loadMessages();
    } else {
      setMessages([]);
      setError(null);
    }
  }, [open, contactPhone, instanceName]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp * 1000);
      if (isNaN(date.getTime())) {
        const dateAlt = new Date(timestamp);
        if (isNaN(dateAlt.getTime())) return "";
        return format(dateAlt, "dd/MM HH:mm", { locale: ptBR });
      }
      return format(date, "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  const renderError = () => {
    if (error === "connect") {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#e9e8e9] flex items-center justify-center mb-3">
            <MaterialIcon icon="link_off" size={28} className="text-[#4a3d3d]" />
          </div>
          <p className="text-sm font-semibold text-[#1b1c1d] mb-1">
            Histórico indisponível
          </p>
          <p className="text-xs text-[#4a3d3d] max-w-xs">
            Conecte o WhatsApp no Meu Vendedor para ver o histórico de conversas.
          </p>
        </div>
      );
    }
    if (error === "empty") {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#e9e8e9] flex items-center justify-center mb-3">
            <MaterialIcon icon="chat_bubble_outline" size={28} className="text-[#4a3d3d]" />
          </div>
          <p className="text-sm font-semibold text-[#1b1c1d] mb-1">
            Nenhuma mensagem encontrada
          </p>
          <p className="text-xs text-[#4a3d3d]">
            Não há mensagens recentes com este contato.
          </p>
        </div>
      );
    }
    if (error === "unavailable") {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#d97706]/10 flex items-center justify-center mb-3">
            <MaterialIcon icon="cloud_off" size={28} className="text-[#d97706]" />
          </div>
          <p className="text-sm font-semibold text-[#1b1c1d] mb-1">
            Histórico indisponível
          </p>
          <p className="text-xs text-[#4a3d3d] max-w-xs">
            Não foi possível conectar ao servidor de mensagens. Tente novamente mais tarde.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta flex items-center gap-2">
            <MaterialIcon icon="chat" size={20} className="text-[#16a34a]" />
            Conversa com {contactName || "Contato"}
          </DialogTitle>
          <p className="text-xs text-[#4a3d3d] font-mono-numbers">
            {formatPhone(contactPhone)}
          </p>
        </DialogHeader>

        {/* Refresh button */}
        <div className="flex justify-end -mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMessages}
            disabled={loading || !instanceName}
            className="text-[#4a3d3d] hover:text-[#b91c1c] rounded-xl gap-1"
          >
            <MaterialIcon
              icon="refresh"
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Atualizar
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[50vh] px-1 space-y-2">
          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#b91c1c] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-[#4a3d3d]">Carregando mensagens...</p>
            </div>
          ) : error ? (
            renderError()
          ) : (
            <>
              {messages.map((msg, index) => {
                const isFromMe = msg.fromMe || msg.key?.fromMe;
                return (
                  <div
                    key={msg.key?.id || msg.id || index}
                    className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        isFromMe
                          ? "bg-[#b91c1c] text-white rounded-br-md"
                          : "bg-[#f3f4f6] text-[#1b1c1d] rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.message?.conversation ||
                          msg.message?.extendedTextMessage?.text ||
                          msg.body ||
                          msg.text ||
                          msg.content ||
                          "[Midia]"}
                      </p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isFromMe ? "text-white/70" : "text-[#4a3d3d]/70"
                        } text-right`}
                      >
                        {formatMessageTime(msg.messageTimestamp || msg.timestamp || msg.t)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
