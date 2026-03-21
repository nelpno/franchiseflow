import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Contact } from "@/entities/all";
import { generateSmartActions } from "@/lib/smartActions";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { createPageUrl } from "@/utils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";

export default function SmartActions({ contacts, franchiseId }) {
  const navigate = useNavigate();
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [loadingIds, setLoadingIds] = useState(new Set());

  const actions = useMemo(() => {
    const all = generateSmartActions(contacts, 5);
    return all.filter((a) => !dismissedIds.has(a.contact.id));
  }, [contacts, dismissedIds]);

  const handleDone = async (action) => {
    const contactId = action.contact.id;
    setLoadingIds((prev) => new Set([...prev, contactId]));
    try {
      await Contact.update(contactId, {
        last_contact_at: new Date().toISOString(),
      });
      setDismissedIds((prev) => new Set([...prev, contactId]));
      toast.success("Marcado como feito");
    } catch (err) {
      console.error("Erro ao marcar acao:", err);
      toast.error("Erro ao atualizar contato");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set([...prev]);
        next.delete(contactId);
        return next;
      });
    }
  };

  if (actions.length === 0) {
    return (
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MaterialIcon icon="bolt" size={20} className="text-[#d4af37]" />
          <h2 className="text-base font-bold font-plus-jakarta text-[#1b1c1d]">
            Ações Sugeridas
          </h2>
        </div>
        <div className="bg-white rounded-2xl border border-[#291715]/5 p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-3">
            <MaterialIcon icon="check_circle" size={28} className="text-[#16a34a]" />
          </div>
          <p className="text-sm font-medium text-[#1b1c1d]">Tudo em dia!</p>
          <p className="text-xs text-[#534343] mt-1">
            Nenhuma ação pendente.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <MaterialIcon icon="bolt" size={20} className="text-[#d4af37]" />
        <h2 className="text-base font-bold font-plus-jakarta text-[#1b1c1d]">
          Ações Sugeridas
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#b91c1c]/10 text-[#b91c1c] font-bold">
          {actions.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action) => {
          const isLoading = loadingIds.has(action.contact.id);
          return (
            <div
              key={action.contact.id}
              className="rounded-2xl border border-[#291715]/5 p-4 flex flex-col gap-3 shadow-sm"
              style={{ backgroundColor: action.bgColor }}
            >
              {/* Action header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${action.color}20` }}
                >
                  <MaterialIcon
                    icon={action.icon}
                    size={18}
                    style={{ color: action.color }}
                  />
                </div>
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: action.color }}
                >
                  {action.label}
                </span>
              </div>

              {/* Message */}
              <p className="text-sm text-[#1b1c1d] font-medium leading-snug">
                {action.message}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-auto">
                <button
                  onClick={() =>
                    window.open(
                      getWhatsAppLink(
                        action.contact.telefone || action.contact.contact_phone
                      ),
                      "_blank"
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                >
                  <MaterialIcon icon="chat" size={16} />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleDone(action)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-white/60 text-[#534343] hover:bg-white/80 transition-colors disabled:opacity-50"
                >
                  <MaterialIcon icon="check" size={16} />
                  {isLoading ? "..." : "Feito"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to MyContacts */}
      <button
        onClick={() => navigate(createPageUrl("MyContacts"))}
        className="flex items-center gap-1 mt-3 text-sm font-medium text-[#b91c1c] hover:text-[#991b1b] transition-colors"
      >
        Ver todos
        <MaterialIcon icon="arrow_forward" size={16} />
      </button>
    </section>
  );
}
