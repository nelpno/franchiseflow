import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Contact, Franchise } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ActionPanel from "@/components/my-contacts/ActionPanel";

import FilterBar from "@/components/shared/FilterBar";
import { formatPhone, normalizePhone, getWhatsAppLink } from "@/lib/whatsappUtils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  novo_lead: {
    label: "Responder",
    badgeLabel: "Contato Novo",
    bg: "bg-[#b91c1c]/10",
    text: "text-[#b91c1c]",
  },
  em_negociacao: {
    label: "Negociando",
    badgeLabel: "Interessado",
    bg: "bg-[#d4af37]/10",
    text: "text-[#775a19]",
  },
  cliente: {
    label: "Clientes",
    badgeLabel: "Cliente",
    bg: "bg-[#16a34a]/10",
    text: "text-[#16a34a]",
  },
  recorrente: {
    label: "Fiéis",
    badgeLabel: "Cliente Fiel",
    bg: "bg-[#6b38d4]/10",
    text: "text-[#6b38d4]",
  },
  remarketing: {
    label: "Clientes Sumidos",
    badgeLabel: "Clientes Sumidos",
    bg: "bg-[#775a19]/10",
    text: "text-[#775a19]",
  },
  perdido: {
    label: "Perdido",
    badgeLabel: "Perdido",
    bg: "bg-[#e9e8e9]",
    text: "text-[#4a3d3d]",
  },
};

const FILTER_TABS = [
  { key: "todos", label: "Todos", status: null },
  { key: "novo_lead", label: "Responder", status: "novo_lead" },
  { key: "em_negociacao", label: "Negociando", status: "em_negociacao" },
  { key: "cliente", label: "Clientes", status: "cliente" },
  { key: "recorrente", label: "Fiéis", status: "recorrente" },
  { key: "remarketing", label: "Sumidos", status: "remarketing" },
];

const SOURCE_CONFIG = {
  manual: { label: "Manual", bg: "bg-[#e9e8e9]", text: "text-[#4a3d3d]" },
  bot: { label: "Bot", bg: "bg-[#16a34a]/10", text: "text-[#16a34a]" },
  whatsapp: { label: "WhatsApp", bg: "bg-[#075e54]/10", text: "text-[#075e54]" },
};

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

export default function MyContacts() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [newContactForm, setNewContactForm] = useState({ nome: "", telefone: "", endereco: "", bairro: "", notas: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState("recent");
  const [dateFilter, setDateFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const mountedRef = useRef(true);

  const capitalize = (str) => {
    if (!str) return str;
    const lower = ["da", "de", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "nas", "nos"];
    return str.trim().replace(/\s+/g, " ").split(" ").map((word, i) => {
      const w = word.toLowerCase();
      if (i > 0 && lower.includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  };

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão expirada. Faça login novamente.");
      return false;
    }
    return true;
  };

  const getErrorMessage = (error) => {
    const msg = error?.message || "";
    if (msg.includes("JWT") || msg.includes("token") || msg.includes("expired") || error?.status === 401) {
      return "Sessão expirada. Faça login novamente.";
    }
    if (msg.includes("duplicate") || msg.includes("unique") || error?.code === "23505") {
      return "Contato com este telefone já existe.";
    }
    if (msg.includes("Tempo limite")) {
      return "Servidor demorou para responder. Tente novamente.";
    }
    return msg || "Erro desconhecido";
  };

  useEffect(() => {
    mountedRef.current = true;
    loadContacts();
    loadInstanceName();
    return () => { mountedRef.current = false; };
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Contact.list("-created_at", 200);
      if (!mountedRef.current) return;
      setContacts(data);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar contatos:", error);
      setLoadError("Erro ao carregar contatos. Tente novamente.");
      toast.error("Erro ao carregar contatos");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadInstanceName = async () => {
    try {
      const franchiseId = currentUser?.managed_franchise_ids?.[0];
      if (!franchiseId) return;
      const franchises = await Franchise.list();
      if (!mountedRef.current) return;
      const myFranchise = franchises.find(
        (f) => f.id === franchiseId || f.evolution_instance_id === franchiseId
      );
    } catch {
      // Silently fail
    }
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const status of Object.keys(STATUS_CONFIG)) {
      counts[status] = contacts.filter((c) => c.status === status).length;
    }
    return counts;
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Filter by status tab
    if (activeFilter !== "todos") {
      result = result.filter((c) => c.status === activeFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.nome?.toLowerCase().includes(term) ||
          c.telefone?.includes(term) ||
          c.contact_phone?.includes(term) ||
          c.customer_name?.toLowerCase().includes(term)
      );
    }

    // Filter by source
    if (sourceFilter !== "all") {
      result = result.filter((c) => (c.source || "manual") === sourceFilter);
    }

    // Filter by last contact date
    if (dateFilter !== "all") {
      const now = new Date();
      const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[dateFilter];
      if (days) {
        const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
        result = result.filter(
          (c) => c.last_contact_at && c.last_contact_at >= cutoff
        );
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.nome || a.customer_name || "").localeCompare(
            b.nome || b.customer_name || ""
          );
        case "purchases":
          return (b.purchase_count || 0) - (a.purchase_count || 0);
        case "spent":
          return (b.total_spent || 0) - (a.total_spent || 0);
        case "recent":
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    return result;
  }, [contacts, activeFilter, searchTerm, dateFilter, sourceFilter, sortBy]);

  const openEdit = (contact) => {
    setEditingContact(contact);
    setEditForm({
      nome: contact.nome || contact.customer_name || "",
      telefone: contact.telefone || contact.contact_phone || "",
      endereco: contact.endereco || "",
      bairro: contact.bairro || "",
      notas: contact.notas || "",
    });
  };

  const handleCreate = async () => {
    if (!newContactForm.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      setIsSaving(true);
      if (!(await checkSession())) return;
      const franchises = await Franchise.list();
      const myFranchise = franchises.find(
        (f) => f.id === currentUser?.managed_franchise_ids?.[0] || f.evolution_instance_id === currentUser?.managed_franchise_ids?.[0]
      );
      if (!myFranchise?.evolution_instance_id) {
        toast.error("Franquia não encontrada");
        return;
      }
      await Contact.create({
        franchise_id: myFranchise.evolution_instance_id,
        nome: capitalize(newContactForm.nome),
        telefone: normalizePhone(newContactForm.telefone),
        endereco: capitalize(newContactForm.endereco) || null,
        bairro: capitalize(newContactForm.bairro) || null,
        notas: newContactForm.notas?.trim() || null,
        source: "manual",
      });
      toast.success("Contato criado");
      setIsCreating(false);
      setNewContactForm({ nome: "", telefone: "", endereco: "", bairro: "", notas: "" });
      loadContacts();
    } catch (error) {
      console.error("Erro ao criar contato:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editingContact) return;
    try {
      setIsSaving(true);
      if (!(await checkSession())) return;
      const updateData = {
        nome: capitalize(editForm.nome),
        telefone: normalizePhone(editForm.telefone),
        endereco: capitalize(editForm.endereco) || null,
        bairro: capitalize(editForm.bairro) || null,
        notas: editForm.notas?.trim() || null,
      };
      await Contact.update(editingContact.id, updateData);
      toast.success("Contato atualizado");
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const [deletingContactId, setDeletingContactId] = useState(null);

  const handleDelete = async (contact) => {
    if (deletingContactId) return;
    try {
      setDeletingContactId(contact.id);
      if (!(await checkSession())) return;
      await Contact.delete(contact.id);
      toast.success("Contato excluído");
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingContactId(null);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(null);

  const getContactName = (contact) =>
    contact.nome || contact.customer_name || "Sem nome";

  const getContactPhone = (contact) =>
    contact.telefone || contact.contact_phone || "";

  const getContactStatus = (contact) => contact.status || "novo_lead";

  const navigateToSales = (contact) => {
    const params = new URLSearchParams({ action: "nova-venda" });
    if (contact.id) params.set("contact_id", contact.id);
    const phone = getContactPhone(contact);
    if (phone) params.set("phone", phone);
    navigate(`/Vendas?${params.toString()}`);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 bg-[#e9e8e9] rounded-xl animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-28 bg-[#e9e8e9] rounded-xl animate-pulse shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-[#291715]/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MaterialIcon icon="cloud_off" className="text-5xl text-[#7a6d6d]" />
          <p className="text-[#4a3d3d] text-center">{loadError}</p>
          <Button variant="outline" onClick={() => { loadContacts(); loadInstanceName(); }} className="mt-2">
            <MaterialIcon icon="refresh" className="mr-2 text-lg" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#b91c1c]/10 flex items-center justify-center">
            <MaterialIcon icon="group" size={22} className="text-[#b91c1c]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-plus-jakarta text-[#1b1c1d]">
              Meus Clientes
            </h1>
            <p className="text-sm text-[#4a3d3d]">
              {contacts.length} {contacts.length === 1 ? "contato" : "contatos"}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl gap-2"
        >
          <MaterialIcon icon="person_add" size={18} />
          <span className="hidden sm:inline">Novo Cliente</span>
        </Button>
      </div>

      {/* Create Contact Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Nome *</Label>
              <Input
                value={newContactForm.nome}
                onChange={(e) => setNewContactForm({ ...newContactForm, nome: e.target.value })}
                placeholder="Nome do cliente"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Telefone</Label>
              <Input
                value={newContactForm.telefone}
                onChange={(e) => setNewContactForm({ ...newContactForm, telefone: e.target.value })}
                placeholder="(14) 99999-9999"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Endereço</Label>
              <Input
                value={newContactForm.endereco}
                onChange={(e) => setNewContactForm({ ...newContactForm, endereco: e.target.value })}
                placeholder="Rua das Flores, 123"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Bairro</Label>
              <Input
                value={newContactForm.bairro}
                onChange={(e) => setNewContactForm({ ...newContactForm, bairro: e.target.value })}
                placeholder="Ex: Centro"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Observações</Label>
              <Textarea
                value={newContactForm.notas}
                onChange={(e) => setNewContactForm({ ...newContactForm, notas: e.target.value })}
                placeholder="Anotações sobre o cliente..."
                rows={3}
                className="bg-[#e9e8e9] border-none rounded-xl resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsCreating(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSaving || !newContactForm.nome?.trim()}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl"
              >
                {isSaving ? "Criando..." : "Criar Contato"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Actions Panel */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setActionsExpanded(!actionsExpanded)}
            className="flex items-center gap-2 text-sm font-bold font-plus-jakarta text-[#1b1c1d] hover:text-[#b91c1c] transition-colors"
          >
            <MaterialIcon icon="bolt" size={18} className="text-[#d4af37]" />
            Ações Sugeridas
            <MaterialIcon
              icon={actionsExpanded ? "expand_less" : "expand_more"}
              size={18}
              className="text-[#4a3d3d]"
            />
          </button>
          {actionsExpanded && (
            <ActionPanel contacts={contacts} onContactUpdate={loadContacts} />
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {FILTER_TABS.map((tab) => {
          const count = tab.status ? statusCounts[tab.status] || 0 : contacts.length;
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? "bg-[#b91c1c] text-white shadow-sm"
                  : "bg-white text-[#4a3d3d] border border-[#291715]/10 hover:bg-[#fbf9fa]"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[#e9e8e9] text-[#4a3d3d]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nome ou telefone..."
        filters={[
          {
            key: "sourceFilter",
            label: "Origem",
            value: sourceFilter,
            onChange: setSourceFilter,
            options: [
              { value: "all", label: "Todas origens" },
              { value: "manual", label: "Manual" },
              { value: "bot", label: "Bot" },
              { value: "whatsapp", label: "WhatsApp" },
            ],
          },
          {
            key: "dateFilter",
            label: "Último contato",
            value: dateFilter,
            onChange: setDateFilter,
            options: [
              { value: "all", label: "Qualquer data" },
              { value: "7d", label: "Últimos 7 dias" },
              { value: "30d", label: "Últimos 30 dias" },
              { value: "90d", label: "Últimos 90 dias" },
            ],
          },
        ]}
        sortOptions={[
          { value: "recent", label: "Mais recentes" },
          { value: "name", label: "Nome A-Z" },
          { value: "purchases", label: "Mais compras" },
          { value: "spent", label: "Maior gasto" },
        ]}
        sortValue={sortBy}
        onSortChange={setSortBy}
      />

      {/* Contact Cards Grid */}
      {filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#e9e8e9] flex items-center justify-center mb-4">
            <MaterialIcon icon="group" size={32} className="text-[#4a3d3d]" />
          </div>
          <h3 className="text-lg font-semibold text-[#1b1c1d] mb-1">
            Nenhum contato encontrado
          </h3>
          <p className="text-sm text-[#4a3d3d] max-w-sm">
            {searchTerm || activeFilter !== "todos"
              ? "Tente ajustar seus filtros ou busca."
              : "Os contatos das suas vendas e conversas aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContacts.map((contact) => {
            const name = getContactName(contact);
            const phone = getContactPhone(contact);
            const status = getContactStatus(contact);
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.novo_lead;
            const hasPurchases = (contact.purchase_count || 0) > 0;

            return (
              <div
                key={contact.id}
                className="bg-white rounded-2xl border border-[#291715]/5 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Top row: name, phone, badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#1b1c1d] truncate text-base">
                      {name}
                    </h3>
                    <p className="text-sm text-[#4a3d3d] font-mono-numbers">
                      {formatPhone(phone)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(() => {
                      const src = contact.source || "manual";
                      const srcCfg = SOURCE_CONFIG[src] || SOURCE_CONFIG.manual;
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${srcCfg.bg} ${srcCfg.text}`}>
                          {srcCfg.label}
                        </span>
                      );
                    })()}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${config.bg} ${config.text}`}
                    >
                      {config.badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Purchase info or lead info */}
                <div className="text-sm text-[#4a3d3d]">
                  {hasPurchases ? (
                    <div className="flex items-center gap-1.5">
                      <MaterialIcon icon="shopping_bag" size={16} className="text-[#16a34a] shrink-0" />
                      <span>
                        {contact.purchase_count}{" "}
                        {contact.purchase_count === 1 ? "compra" : "compras"}
                        {contact.total_spent ? ` · ${formatCurrency(contact.total_spent)} total` : ""}
                        {contact.last_purchase_at
                          ? ` · última há ${timeAgo(contact.last_purchase_at)}`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <MaterialIcon icon="schedule" size={16} className="text-[#4a3d3d] shrink-0" />
                      <span>
                        Novo lead
                        {contact.created_at
                          ? ` · há ${timeAgo(contact.created_at)}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bairro */}
                {contact.bairro && (
                  <div className="flex items-center gap-1.5 text-sm text-[#4a3d3d]">
                    <MaterialIcon icon="location_on" size={16} className="shrink-0" />
                    <span className="truncate">{contact.bairro}</span>
                  </div>
                )}

                {/* Notes preview */}
                {contact.notas && (
                  <p className="text-xs text-[#4a3d3d]/70 line-clamp-2 italic">
                    {contact.notas.length > 80
                      ? contact.notas.slice(0, 80) + "..."
                      : contact.notas}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 pt-1 border-t border-[#291715]/5">
                  {phone ? (
                    <>
                      <a
                        href={getWhatsAppLink(phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                      >
                        <MaterialIcon icon="chat" size={16} />
                        <span className="hidden sm:inline">WhatsApp</span>
                        <span className="sm:hidden">Zap</span>
                      </a>
                    </>
                  ) : (
                    <button
                      onClick={() => openEdit(contact)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                      title="Adicionar telefone para usar WhatsApp"
                    >
                      <MaterialIcon icon="phone" size={16} />
                      <span className="hidden sm:inline">+ Telefone</span>
                      <span className="sm:hidden">+ Tel</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigateToSales(contact)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-[#d4af37]/10 text-[#775a19] hover:bg-[#d4af37]/20 transition-colors"
                  >
                    <MaterialIcon icon="point_of_sale" size={16} />
                    <span className="hidden sm:inline">+ Venda</span>
                    <span className="sm:hidden">Venda</span>
                  </button>
                  <button
                    onClick={() => openEdit(contact)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-[#e9e8e9] text-[#4a3d3d] hover:bg-[#e9e8e9]/80 transition-colors ml-auto"
                    title="Editar contato"
                  >
                    <MaterialIcon icon="edit" size={16} />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingContact}
        onOpenChange={(open) => {
          if (!open) setEditingContact(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-nome" className="text-[#1b1c1d]">Nome</Label>
              <Input
                id="edit-nome"
                value={editForm.nome || ""}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-telefone" className="text-[#1b1c1d]">Telefone</Label>
              <Input
                id="edit-telefone"
                value={editForm.telefone || ""}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>

            {/* Endereco */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-endereco" className="text-[#1b1c1d]">Endereço</Label>
              <Input
                id="edit-endereco"
                value={editForm.endereco || ""}
                onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
                placeholder="Rua das Flores, 123"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>

            {/* Bairro */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-bairro" className="text-[#1b1c1d]">Bairro</Label>
              <Input
                id="edit-bairro"
                value={editForm.bairro || ""}
                onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
                placeholder="Ex: Centro"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-notas" className="text-[#1b1c1d]">Notas</Label>
              <Textarea
                id="edit-notas"
                value={editForm.notas || ""}
                onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                rows={3}
                className="bg-[#e9e8e9] border-none rounded-xl resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center pt-2">
              {confirmDelete === editingContact?.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#4a3d3d]">Excluir?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-xl text-xs h-8"
                  >
                    Não
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setConfirmDelete(null); handleDelete(editingContact); }}
                    disabled={!!deletingContactId}
                    className="bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl text-xs h-8"
                  >
                    {deletingContactId ? "Excluindo..." : "Sim, excluir"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(editingContact?.id)}
                  className="text-[#dc2626] hover:text-[#b91c1c] hover:bg-red-50 rounded-xl text-xs h-8 px-2"
                >
                  <MaterialIcon icon="delete" className="text-base mr-1" />
                  Excluir
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => { setEditingContact(null); setConfirmDelete(null); }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
