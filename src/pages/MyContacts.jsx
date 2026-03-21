import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Contact, Franchise } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ActionPanel from "@/components/my-contacts/ActionPanel";
import { formatPhone, getWhatsAppLink } from "@/lib/whatsappUtils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  novo_lead: {
    label: "Responder",
    badgeLabel: "Novo Lead",
    bg: "bg-[#b91c1c]/10",
    text: "text-[#b91c1c]",
  },
  em_negociacao: {
    label: "Negociando",
    badgeLabel: "Em Negociação",
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
    label: "Recorrentes",
    badgeLabel: "Recorrente",
    bg: "bg-[#6b38d4]/10",
    text: "text-[#6b38d4]",
  },
  remarketing: {
    label: "Remarketing",
    badgeLabel: "Remarketing",
    bg: "bg-[#775a19]/10",
    text: "text-[#775a19]",
  },
  perdido: {
    label: "Perdido",
    badgeLabel: "Perdido",
    bg: "bg-[#e9e8e9]",
    text: "text-[#534343]",
  },
};

const STATUS_OPTIONS = [
  { value: "novo_lead", label: "Novo Lead" },
  { value: "em_negociacao", label: "Em Negociação" },
  { value: "cliente", label: "Cliente" },
  { value: "recorrente", label: "Recorrente" },
  { value: "remarketing", label: "Remarketing" },
  { value: "perdido", label: "Perdido" },
];

const FILTER_TABS = [
  { key: "todos", label: "Todos", status: null },
  { key: "novo_lead", label: "Responder", status: "novo_lead" },
  { key: "em_negociacao", label: "Negociando", status: "em_negociacao" },
  { key: "cliente", label: "Clientes", status: "cliente" },
  { key: "recorrente", label: "Recorrentes", status: "recorrente" },
  { key: "remarketing", label: "Remarketing", status: "remarketing" },
];

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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await Contact.list("-created_at");
      setContacts(data);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      toast.error("Erro ao carregar contatos");
    } finally {
      setLoading(false);
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

    return result;
  }, [contacts, activeFilter, searchTerm]);

  const openEdit = (contact) => {
    setEditingContact(contact);
    setEditForm({
      nome: contact.nome || contact.customer_name || "",
      telefone: contact.telefone || contact.contact_phone || "",
      status: contact.status || "novo_lead",
      bairro: contact.bairro || "",
      endereco: contact.endereco || "",
      notas: contact.notas || "",
      tags: contact.tags || "",
    });
  };

  const handleSave = async () => {
    if (!editingContact) return;
    try {
      setIsSaving(true);
      await Contact.update(editingContact.id, {
        nome: editForm.nome,
        status: editForm.status,
        bairro: editForm.bairro,
        endereco: editForm.endereco,
        notas: editForm.notas,
        tags: editForm.tags,
      });
      toast.success("Contato atualizado");
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      toast.error("Erro ao atualizar contato");
    } finally {
      setIsSaving(false);
    }
  };

  const getContactName = (contact) =>
    contact.nome || contact.customer_name || "Sem nome";

  const getContactPhone = (contact) =>
    contact.telefone || contact.contact_phone || "";

  const getContactStatus = (contact) => contact.status || "novo_lead";

  const navigateToSales = (contact) => {
    const phone = getContactPhone(contact);
    navigate("/MinhaLoja?tab=lancar" + (phone ? `&phone=${encodeURIComponent(phone)}` : ""));
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
            <p className="text-sm text-[#534343]">
              {contacts.length} {contacts.length === 1 ? "contato" : "contatos"}
            </p>
          </div>
        </div>
      </div>

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
              className="text-[#534343]"
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
                  : "bg-white text-[#534343] border border-[#291715]/10 hover:bg-[#fbf9fa]"
              }`}
            >
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

      {/* Search Bar */}
      <div className="relative">
        <MaterialIcon
          icon="search"
          size={20}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#534343]"
        />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-[#e9e8e9] border-none rounded-xl h-11"
        />
      </div>

      {/* Contact Cards Grid */}
      {filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#e9e8e9] flex items-center justify-center mb-4">
            <MaterialIcon icon="group" size={32} className="text-[#534343]" />
          </div>
          <h3 className="text-lg font-semibold text-[#1b1c1d] mb-1">
            Nenhum contato encontrado
          </h3>
          <p className="text-sm text-[#534343] max-w-sm">
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
                    <p className="text-sm text-[#534343] font-mono-numbers">
                      {formatPhone(phone)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${config.bg} ${config.text}`}
                  >
                    {config.badgeLabel}
                  </span>
                </div>

                {/* Purchase info or lead info */}
                <div className="text-sm text-[#534343]">
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
                      <MaterialIcon icon="schedule" size={16} className="text-[#534343] shrink-0" />
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
                  <div className="flex items-center gap-1.5 text-sm text-[#534343]">
                    <MaterialIcon icon="location_on" size={16} className="shrink-0" />
                    <span className="truncate">{contact.bairro}</span>
                  </div>
                )}

                {/* Notes preview */}
                {contact.notas && (
                  <p className="text-xs text-[#534343]/70 line-clamp-2 italic">
                    {contact.notas.length > 80
                      ? contact.notas.slice(0, 80) + "..."
                      : contact.notas}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#291715]/5">
                  <a
                    href={getWhatsAppLink(phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                  >
                    <MaterialIcon icon="chat" size={16} />
                    WhatsApp
                  </a>
                  <button
                    onClick={() => navigateToSales(contact)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-[#d4af37]/10 text-[#775a19] hover:bg-[#d4af37]/20 transition-colors"
                  >
                    <MaterialIcon icon="point_of_sale" size={16} />
                    Registrar Venda
                  </button>
                  <button
                    onClick={() => openEdit(contact)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-[#e9e8e9] text-[#534343] hover:bg-[#e9e8e9]/80 transition-colors ml-auto"
                  >
                    <MaterialIcon icon="edit" size={16} />
                    Editar
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

            {/* Telefone (read-only) */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-telefone" className="text-[#1b1c1d]">Telefone</Label>
              <Input
                id="edit-telefone"
                value={formatPhone(editForm.telefone)}
                readOnly
                className="bg-[#e9e8e9]/50 border-none rounded-xl text-[#534343] cursor-not-allowed"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-[#1b1c1d]">Status</Label>
              <Select
                value={editForm.status || "novo_lead"}
                onValueChange={(val) => setEditForm({ ...editForm, status: val })}
              >
                <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bairro */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-bairro" className="text-[#1b1c1d]">Bairro</Label>
              <Input
                id="edit-bairro"
                value={editForm.bairro || ""}
                onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
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

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-tags" className="text-[#1b1c1d]">Tags</Label>
              <Input
                id="edit-tags"
                value={editForm.tags || ""}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="Ex: vip, empresa, indicação"
                className="bg-[#e9e8e9] border-none rounded-xl"
              />
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingContact(null)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
