import React, { useState, useMemo } from "react";
import { Contact } from "@/entities/all";
import { generateSmartActions, ACTION_RULES } from "@/lib/smartActions";
import { formatPhone, getWhatsAppLink } from "@/lib/whatsappUtils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: false,
      locale: ptBR,
    });
  } catch {
    return "";
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

const TAB_TYPES = ACTION_RULES.map((r) => ({
  type: r.type,
  label: r.label,
  color: r.color,
  icon: r.icon,
}));

export default function ActionPanel({ contacts, onContactUpdate }) {
  const [activeTab, setActiveTab] = useState(null);
  const [noteInputId, setNoteInputId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [loadingIds, setLoadingIds] = useState(new Set());

  const allActions = useMemo(
    () => generateSmartActions(contacts, 0),
    [contacts]
  );

  const groupedCounts = useMemo(() => {
    const counts = {};
    for (const action of allActions) {
      counts[action.type] = (counts[action.type] || 0) + 1;
    }
    return counts;
  }, [allActions]);

  const filteredActions = useMemo(() => {
    if (!activeTab) return allActions;
    return allActions.filter((a) => a.type === activeTab);
  }, [allActions, activeTab]);

  const handleWhatsApp = (contact) => {
    const phone = contact.telefone || contact.contact_phone;
    window.open(getWhatsAppLink(phone), "_blank");
  };

  const handleSaveNote = async (contact) => {
    if (!noteText.trim()) {
      setNoteInputId(null);
      return;
    }
    setLoadingIds((prev) => new Set([...prev, contact.id]));
    try {
      const existingNotes = contact.notas || "";
      const timestamp = new Date().toLocaleDateString("pt-BR");
      const updatedNotes = existingNotes
        ? `${existingNotes}\n[${timestamp}] ${noteText.trim()}`
        : `[${timestamp}] ${noteText.trim()}`;

      await Contact.update(contact.id, {
        notas: updatedNotes,
        last_contact_at: new Date().toISOString(),
      });
      toast.success("Nota salva");
      setNoteInputId(null);
      setNoteText("");
      if (onContactUpdate) onContactUpdate();
    } catch (err) {
      console.error("Erro ao salvar nota:", err);
      toast.error("Erro ao salvar nota");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set([...prev]);
        next.delete(contact.id);
        return next;
      });
    }
  };

  if (allActions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Tab filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveTab(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
            activeTab === null
              ? "bg-[#1b1c1d] text-white"
              : "bg-white text-[#534343] border border-[#291715]/10 hover:bg-[#fbf9fa]"
          }`}
        >
          Todas
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === null
                ? "bg-white/20 text-white"
                : "bg-[#e9e8e9] text-[#534343]"
            }`}
          >
            {allActions.length}
          </span>
        </button>
        {TAB_TYPES.map((tab) => {
          const count = groupedCounts[tab.type] || 0;
          if (count === 0) return null;
          const isActive = activeTab === tab.type;
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(isActive ? null : tab.type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 border ${
                isActive
                  ? "text-white border-transparent"
                  : "bg-white text-[#534343] border-[#291715]/10 hover:bg-[#fbf9fa]"
              }`}
              style={isActive ? { backgroundColor: tab.color } : undefined}
            >
              <MaterialIcon icon={tab.icon} size={14} />
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[#e9e8e9] text-[#534343]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action cards */}
      <div className="space-y-2">
        {filteredActions.map((action) => {
          const contact = action.contact;
          const phone = contact.telefone || contact.contact_phone;
          const name = contact.nome || contact.customer_name || "Sem nome";
          const isLoading = loadingIds.has(contact.id);
          const isNoting = noteInputId === contact.id;

          return (
            <div
              key={`${action.type}-${contact.id}`}
              className="rounded-xl border border-[#291715]/5 p-3 flex flex-col gap-2 shadow-sm"
              style={{ backgroundColor: action.bgColor }}
            >
              {/* Header with type badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${action.color}20` }}
                  >
                    <MaterialIcon
                      icon={action.icon}
                      size={16}
                      style={{ color: action.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1b1c1d] truncate">
                      {name}
                    </p>
                    <p className="text-xs text-[#534343] font-mono-numbers">
                      {formatPhone(phone)}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg shrink-0"
                  style={{
                    color: action.color,
                    backgroundColor: `${action.color}15`,
                  }}
                >
                  {action.label}
                </span>
              </div>

              {/* Message */}
              <p className="text-xs text-[#534343] leading-relaxed">
                {action.message}
              </p>

              {/* Contact details */}
              <div className="flex items-center gap-3 text-[11px] text-[#534343]/80">
                {contact.last_purchase_at && (
                  <span className="flex items-center gap-1">
                    <MaterialIcon icon="shopping_bag" size={12} />
                    Comprou há {timeAgo(contact.last_purchase_at)}
                  </span>
                )}
                {(contact.total_spent || 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <MaterialIcon icon="payments" size={12} />
                    {formatCurrency(contact.total_spent)}
                  </span>
                )}
                {contact.last_contact_at && (
                  <span className="flex items-center gap-1">
                    <MaterialIcon icon="schedule" size={12} />
                    Contato há {timeAgo(contact.last_contact_at)}
                  </span>
                )}
              </div>

              {/* Note input */}
              {isNoting && (
                <div className="flex items-center gap-2">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escreva uma nota..."
                    className="bg-white/80 border-none rounded-lg text-xs h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveNote(contact);
                      if (e.key === "Escape") {
                        setNoteInputId(null);
                        setNoteText("");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveNote(contact)}
                    disabled={isLoading}
                    className="text-xs font-medium text-[#16a34a] hover:text-[#15803d] disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Salvar"}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWhatsApp(contact)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                >
                  <MaterialIcon icon="chat" size={14} />
                  WhatsApp
                </button>
                {!isNoting && (
                  <button
                    onClick={() => {
                      setNoteInputId(contact.id);
                      setNoteText("");
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/60 text-[#534343] hover:bg-white/80 transition-colors"
                  >
                    <MaterialIcon icon="edit_note" size={14} />
                    Anotar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
