import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { SaleItem, Contact, AuditLog, FranchiseConfiguration } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { parseDeliveryFeeOptions } from "@/lib/deliveryFeeRules";
import { normalizePhone } from "@/lib/whatsappUtils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { toast } from "sonner";
import { format } from "date-fns";
import { calcSale } from "@/lib/saleCalc";

// ---------------------------------------------------------------------------
// Draft helpers (localStorage)
// ---------------------------------------------------------------------------
const DRAFT_KEY_PREFIX = "sale_draft_";

function getDraftKey(franchiseId) {
  return `${DRAFT_KEY_PREFIX}${franchiseId}`;
}

function saveDraft(franchiseId, data) {
  try {
    localStorage.setItem(getDraftKey(franchiseId), JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

function loadDraft(franchiseId) {
  try {
    const raw = localStorage.getItem(getDraftKey(franchiseId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Discard drafts older than 24 hours
    if (draft._ts && Date.now() - draft._ts > 86400000) {
      localStorage.removeItem(getDraftKey(franchiseId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function clearDraft(franchiseId) {
  try {
    localStorage.removeItem(getDraftKey(franchiseId));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Retry helper with exponential backoff
// ---------------------------------------------------------------------------
async function withRetry(fn, { maxRetries = 2, baseDelay = 2000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // 2s, 4s
        toast.error(`Falha ao salvar. Tentando novamente em ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function ProductSearch({ products, selectedId, onSelect, placeholder = "Buscar produto...", inputId }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selectedProduct = products.find((p) => p.id === selectedId);

  const filtered = useMemo(() => {
    let list = products;
    if (query) {
      const q = query.toLowerCase();
      list = products.filter(
        (p) => p.product_name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
      );
    }
    // Sort: products with stock first, then without
    return [...list].sort((a, b) => {
      const aHas = (a.quantity || 0) > 0 ? 0 : 1;
      const bHas = (b.quantity || 0) > 0 ? 0 : 1;
      return aHas - bHas;
    });
  }, [products, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center bg-white border border-input rounded-md cursor-text"
        onClick={() => setOpen(true)}
      >
        <Input
          ref={inputRef}
          id={inputId}
          value={open ? query : selectedProduct?.product_name || ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab" && open && filtered.length > 0) {
              e.preventDefault();
              onSelect(filtered[0].id);
              setQuery("");
              setOpen(false);
              // Focus next sibling input (quantity)
              const parent = ref.current?.closest("[data-sale-item]");
              if (parent) {
                const qtyInput = parent.querySelector("[data-qty-input]");
                if (qtyInput) setTimeout(() => qtyInput.focus(), 0);
              }
            }
          }}
          placeholder={placeholder}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <MaterialIcon icon="search" size={18} className="text-ink-2/50 mr-2 shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-fit bg-white border border-ink-shadow/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p.id);
                setQuery("");
                setOpen(false);
                // Focus quantity input
                const parent = ref.current?.closest("[data-sale-item]");
                if (parent) {
                  const qtyInput = parent.querySelector("[data-qty-input]");
                  if (qtyInput) setTimeout(() => qtyInput.focus(), 0);
                }
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors flex justify-between items-center ${
                p.id === selectedId ? "bg-brand/5 text-brand" : (p.quantity || 0) <= 0 ? "text-ink/40" : "text-ink"
              }`}
            >
              <span>
                {p.product_name}
                {(p.quantity || 0) <= 0 && (
                  <span className="text-brand text-xs ml-1.5 font-medium">(sem estoque)</span>
                )}
              </span>
              {p.sale_price > 0 && (
                <span className="text-xs text-ink-2/70 font-mono-numbers">
                  R$ {(p.sale_price || 0).toFixed(2).replace('.', ',')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full min-w-fit bg-white border border-ink-shadow/10 rounded-xl shadow-lg p-3 text-sm text-ink-2/70">
          Nenhum produto encontrado
        </div>
      )}
    </div>
  );
}

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

// Format phone for display
function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

// ---------------------------------------------------------------------------
// ContactAutocomplete — server-side search with debounce
// ---------------------------------------------------------------------------
function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  onCreateNew,
  franchiseId,
  placeholder = "Buscar por nome ou telefone...",
  className = "",
  id,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasQuery, setHasQuery] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const doSearch = useCallback(async (term) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setSearching(true);
      const digits = term.replace(/\D/g, "");
      const searchTerm = digits.length >= 3 ? digits : term.trim();
      const searchCols = digits.length >= 3 ? ["telefone"] : ["nome"];

      const results = await Contact.search(searchTerm, {
        columns: "id, nome, telefone, status, franchise_id, endereco, bairro",
        searchColumns: searchCols,
        criteria: franchiseId ? { franchise_id: franchiseId } : undefined,
        limit: 8,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSearchResults(results);
        setShowDropdown(true);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Erro na busca de contatos:", err);
        setSearchResults([]);
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [franchiseId]);

  const handleChange = (e) => {
    const inputVal = e.target.value;
    onChange(inputVal);

    if (inputVal.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      setHasQuery(false);
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      return;
    }

    setHasQuery(true);
    setShowDropdown(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(inputVal), 300);
  };

  const handleSelect = (contact) => {
    setShowDropdown(false);
    setSearchResults([]);
    setHasQuery(false);
    clearTimeout(debounceRef.current);
    onSelect(contact);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (searchResults.length > 0 || hasQuery) setShowDropdown(true);
        }}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (searchResults.length > 0 || hasQuery) && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-ink-shadow/10 max-h-60 overflow-y-auto">
          {searching && searchResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-3 flex items-center gap-2">
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              Buscando...
            </div>
          )}
          {searchResults.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelect(contact)}
              className="w-full text-left px-4 py-3 hover:bg-surface transition-colors first:rounded-t-xl flex items-center justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-ink truncate block">
                  {contact.nome || "Sem nome"}
                </span>
                <span className="text-sm text-ink-2">
                  {formatPhone(contact.telefone)}
                </span>
              </div>
            </button>
          ))}
          {!searching && hasQuery && searchResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-3">
              Nenhum contato encontrado
            </div>
          )}
          {hasQuery && onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                setHasQuery(false);
                onCreateNew();
              }}
              className="w-full text-left px-4 py-3 hover:bg-[#fffbeb] transition-colors last:rounded-b-xl flex items-center gap-2 border-t border-ink-shadow/5 text-brand"
            >
              <MaterialIcon icon="person_add" size={18} />
              <span className="font-medium text-sm">Novo contato</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaleForm
// ---------------------------------------------------------------------------
export default function SaleForm({
  sale,
  franchiseId,
  contacts,
  inventoryItems,
  currentUser,
  onSave,
  onCancel,
  initialContactId = null,
  initialPhone = null,
}) {
  const isEditing = !!sale;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Contact
  const [contactSearch, setContactSearch] = useState("");
  const [contactId, setContactId] = useState(null);
  const [newContactName, setNewContactName] = useState("");
  const [isNewContact, setIsNewContact] = useState(false);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineContactName, setInlineContactName] = useState("");
  const [inlineContactPhone, setInlineContactPhone] = useState("");
  const [isCreatingContact, setIsCreatingContact] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [paymentFees, setPaymentFees] = useState(null); // JSONB from franchise_configurations
  const [feePassedToCustomer, setFeePassedToCustomer] = useState(false); // override por venda
  const [franchiseChargesFee, setFranchiseChargesFee] = useState(false); // default config da franquia

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState("retirada");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryFeeOptions, setDeliveryFeeOptions] = useState([]);

  // Discount
  const [discountType, setDiscountType] = useState("fixed"); // "fixed" | "percent"
  const [discountInput, setDiscountInput] = useState(0);

  // Sale date
  const [saleDate, setSaleDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Observations
  const [observacoes, setObservacoes] = useState("");

  // Sale items rows
  const [items, setItems] = useState([
    { inventory_item_id: "", product_name: "", quantity: 1, unit_price: 0, cost_price: 0 },
  ]);

  // Track whether draft was already restored (avoid re-triggering)
  const draftRestoredRef = useRef(false);
  // Debounce timer ref for auto-save
  const draftTimerRef = useRef(null);

  // Pre-fill when editing
  useEffect(() => {
    if (!sale) return;

    setPaymentMethod(sale.payment_method || "pix");
    setCardFeePercent(sale.card_fee_percent ?? 0);
    // Edit: preserva false explícito do sale via ?? ; só cai pro franchise default se sale=null/undefined
    setFeePassedToCustomer(sale.fee_passed_to_customer ?? franchiseChargesFee ?? false);
    setDeliveryMethod(sale.delivery_method || "retirada");
    setDeliveryFee(sale.delivery_fee ?? 0);
    setDiscountType(sale.discount_type || "fixed");
    setDiscountInput(sale.discount_input ?? 0);
    if (sale.sale_date) setSaleDate(sale.sale_date);
    setObservacoes(sale.observacoes || "");
    setContactId(sale.contact_id || null);

    // Set contact search display
    if (sale.contact_id && contacts.length > 0) {
      const c = contacts.find((ct) => ct.id === sale.contact_id);
      if (c) setContactSearch(c.nome || formatPhone(c.telefone));
    }

    // Load existing sale items
    setLoadingItems(true);
    SaleItem.filter({ sale_id: sale.id })
      .then((existingItems) => {
        if (existingItems.length > 0) {
          setItems(
            existingItems.map((si) => ({
              inventory_item_id: si.inventory_item_id || "",
              product_name: si.product_name || "",
              quantity: si.quantity || 1,
              unit_price: si.unit_price || 0,
              cost_price: si.cost_price || 0,
            }))
          );
        }
      })
      .catch((err) => console.error("Erro ao carregar itens:", err))
      .finally(() => setLoadingItems(false));
  }, [sale, contacts]);

  // ---- Draft: restore on mount (new sale only) ----
  useEffect(() => {
    if (isEditing || draftRestoredRef.current || !franchiseId) return;
    draftRestoredRef.current = true;

    const draft = loadDraft(franchiseId);
    if (!draft) return;

    // Restore fields
    if (draft.items?.length) setItems(draft.items);
    if (draft.contactId) {
      setContactId(draft.contactId);
      const c = contacts.find((ct) => ct.id === draft.contactId);
      if (c) setContactSearch(c.nome || formatPhone(c.telefone));
    }
    if (draft.contactSearch) setContactSearch(draft.contactSearch);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.cardFeePercent != null) setCardFeePercent(draft.cardFeePercent);
    if (draft.feePassedToCustomer != null) setFeePassedToCustomer(draft.feePassedToCustomer);
    if (draft.deliveryMethod) setDeliveryMethod(draft.deliveryMethod);
    if (draft.deliveryFee != null) setDeliveryFee(draft.deliveryFee);
    if (draft.discountType) setDiscountType(draft.discountType);
    if (draft.discountInput != null) setDiscountInput(draft.discountInput);
    if (draft.saleDate) setSaleDate(draft.saleDate);
    if (draft.observacoes) setObservacoes(draft.observacoes);

    toast.info("Rascunho recuperado", {
      action: {
        label: "Descartar",
        onClick: () => {
          clearDraft(franchiseId);
          setItems([{ inventory_item_id: "", product_name: "", quantity: 1, unit_price: 0, cost_price: 0 }]);
          setContactId(null);
          setContactSearch("");
          setPaymentMethod("pix");
          setCardFeePercent(0);
          setFeePassedToCustomer(franchiseChargesFee);
          setDeliveryMethod("retirada");
          setDeliveryFee(0);
          setDiscountType("fixed");
          setDiscountInput(0);
          setObservacoes("");
          toast.success("Rascunho descartado");
        },
      },
      duration: 6000,
    });
  }, [isEditing, franchiseId, contacts]);

  // ---- Pre-select contact from URL params (e.g., MyContacts "+ Venda") ----
  useEffect(() => {
    if (isEditing || !contacts.length) return;
    if (!initialContactId && !initialPhone) return;

    let match = null;
    if (initialContactId) {
      match = contacts.find((c) => c.id === initialContactId);
    }
    if (!match && initialPhone) {
      const normalized = normalizePhone(initialPhone);
      match = contacts.find((c) => normalizePhone(c.telefone) === normalized);
    }
    if (match) {
      setContactId(match.id);
      setContactSearch(match.nome || formatPhone(match.telefone));
    }
  }, [isEditing, contacts, initialContactId, initialPhone]);

  // ---- Load payment_fees + charges_card_fee_to_customer from franchise config ----
  useEffect(() => {
    if (!franchiseId) return;
    FranchiseConfiguration.filter({ franchise_evolution_instance_id: franchiseId })
      .then((configs) => {
        const cfg = configs?.[0];
        const fees = cfg?.payment_fees;
        if (fees && typeof fees === "object") setPaymentFees(fees);
        // A regra de frete ja esta cadastrada em 61 das 67 unidades — mas ate 07/09/2026
        // so o robo a lia. Na venda manual o campo nascia vazio e 622 entregas em 90
        // dias sairam com frete R$ 0 (que e receita perdida no DRE).
        setDeliveryFeeOptions(parseDeliveryFeeOptions(cfg?.delivery_fee_rules));
        const charges = cfg?.charges_card_fee_to_customer ?? false;
        setFranchiseChargesFee(charges);
        // Sale NOVA: default vem da config. Sale EDIT: useEffect de hydrate já cuidou disso.
        if (!isEditing) {
          setFeePassedToCustomer(charges);
        }
      })
      .catch(() => {}); // silent — fallback to manual input
  }, [franchiseId, isEditing]);

  // Auto-set fee when payment method changes (if config has fees)
  useEffect(() => {
    if (!paymentFees) return;
    const fee = paymentFees[paymentMethod];
    if (fee != null) setCardFeePercent(parseFloat(fee) || 0);
  }, [paymentMethod, paymentFees]);

  // ---- Draft: auto-save with 1s debounce (new sale only) ----
  const draftData = useMemo(
    () => ({ items, contactId, contactSearch, paymentMethod, cardFeePercent, feePassedToCustomer, deliveryMethod, deliveryFee, discountType, discountInput, saleDate, observacoes }),
    [items, contactId, contactSearch, paymentMethod, cardFeePercent, feePassedToCustomer, deliveryMethod, deliveryFee, discountType, discountInput, saleDate, observacoes]
  );

  useEffect(() => {
    if (isEditing || !franchiseId) return;

    // Skip saving if form is completely empty (default state)
    const hasContent =
      items.some((it) => it.inventory_item_id) ||
      contactId ||
      (contactSearch && contactSearch.trim().length > 0);
    if (!hasContent) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraft(franchiseId, draftData);
    }, 1000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [draftData, isEditing, franchiseId]);

  // A conta da venda vive em lib/saleCalc.js (testada: node src/lib/saleCalc.test.mjs).
  // Ela estava aqui dentro, em quatro useMemo sem teste nenhum, e a regra de "quais metodos
  // tem taxa" estava copiada em QUATRO pontos deste arquivo — o calculo, dois campos do
  // payload e a linha do resumo. `cobraTaxa` agora e a mesma decisao nos quatro.
  const { subtotal, effectiveDeliveryFee, discountAmount, cardFeeAmount, netValue, cobraTaxa } =
    useMemo(
      () =>
        calcSale({
          items,
          discountInput,
          discountType,
          deliveryMethod,
          deliveryFee,
          paymentMethod,
          cardFeePercent,
          hasPaymentFeesConfig: Boolean(paymentFees),
          feePassedToCustomer,
        }),
      [
        items, discountInput, discountType, deliveryMethod, deliveryFee,
        paymentMethod, cardFeePercent, paymentFees, feePassedToCustomer,
      ]
    );

  // Item handlers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { inventory_item_id: "", product_name: "", quantity: 1, unit_price: 0, cost_price: 0 },
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        if (field === "inventory_item_id") {
          const inv = inventoryItems.find((p) => p.id === value);
          if (inv) {
            updated.product_name = inv.product_name;
            updated.unit_price = inv.sale_price || 0;
            updated.cost_price = inv.cost_price || 0;
          }
        }
        return updated;
      })
    );
  };

  // Contact select
  const handleContactSelect = (contact) => {
    setContactId(contact.id);
    setContactSearch(contact.nome || formatPhone(contact.telefone));
    setIsNewContact(false);
    setNewContactName("");
  };

  // Detect new contact when typing a phone number with no match
  const handleContactSearchChange = (val) => {
    setContactSearch(val);
    if (contactId) {
      setContactId(null); // user is typing again, clear selection
    }
    // isNewContact detection now simplified — "Novo contato" button is always in dropdown
    setIsNewContact(false);
  };

  // Open inline create dialog
  const handleOpenInlineCreate = () => {
    setShowInlineCreate(true);
    // Pre-fill phone if user typed digits
    const digits = contactSearch.replace(/\D/g, "");
    if (digits.length >= 8) {
      setInlineContactPhone(contactSearch);
      setInlineContactName("");
    } else {
      setInlineContactName(contactSearch);
      setInlineContactPhone("");
    }
  };

  // Create contact inline and select it
  const handleInlineContactCreate = async () => {
    if (!inlineContactName.trim() && !inlineContactPhone.trim()) {
      toast.error("Preencha pelo menos nome ou telefone.");
      return;
    }
    setIsCreatingContact(true);
    try {
      const phone = inlineContactPhone.trim()
        ? normalizePhone(inlineContactPhone.trim())
        : null;
      const newContact = await Contact.create({
        franchise_id: franchiseId,
        telefone: phone,
        nome: inlineContactName.trim() || null,
        status: "cliente",
        source: "manual",
      });
      setContactId(newContact.id);
      setContactSearch(inlineContactName.trim() || formatPhone(phone));
      setIsNewContact(false);
      setNewContactName("");
      setShowInlineCreate(false);
      setInlineContactName("");
      setInlineContactPhone("");
      toast.success("Contato criado!");
    } catch (err) {
      console.error("Erro ao criar contato:", err);
      if (err?.code === "23505" || err?.message?.includes("unique") || err?.message?.includes("duplicate")) {
        toast.error("Esse telefone já está cadastrado nesta franquia.");
      } else if (err?.code === "42501" || err?.message?.includes("policy")) {
        toast.error("Sem permissão para criar contato. Verifique sua franquia.");
      } else {
        toast.error(safeErrorMessage(err, "Não foi possível criar o contato"));
      }
    } finally {
      setIsCreatingContact(false);
    }
  };

  // Resolve or create contact
  const resolveContactId = async () => {
    if (contactId) return contactId;
    // If user typed something but didn't pick, try to match or skip
    if (!contactSearch || contactSearch.trim().length < 2) return null;

    // Server-side lookup by phone (canônico: só dígitos, sem DDI 55 — casa com o armazenado)
    const digits = contactSearch.replace(/\D/g, "");
    const normalized = normalizePhone(contactSearch);
    if (digits.length >= 8 && normalized) {
      try {
        const matches = await Contact.search(normalized, {
          columns: "id, telefone",
          searchColumns: ["telefone"],
          criteria: franchiseId ? { franchise_id: franchiseId } : undefined,
          limit: 1,
        });
        if (matches.length > 0) return matches[0].id;
      } catch { /* proceed to create */ }
    }

    // Create new contact from phone + name
    try {
      const isPhone = digits.length >= 8;
      const newContact = await Contact.create({
        franchise_id: franchiseId,
        telefone: isPhone ? normalized : null,
        nome: newContactName.trim() || (isPhone ? null : contactSearch) || null,
        status: "cliente",
        source: "manual",
      });
      return newContact.id;
    } catch (err) {
      console.warn("Erro ao criar contato:", err);
      return null;
    }
  };

  // Submit with retry
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.length === 0 || items.every((it) => !it.inventory_item_id)) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }

    setIsSubmitting(true);

    // Resolve contact before retry loop (avoid creating duplicates)
    let resolvedContactId;
    try {
      resolvedContactId = await resolveContactId();
    } catch (err) {
      console.error("Erro ao resolver contato:", err);
      toast.error("Erro ao processar contato. Tente novamente.");
      setIsSubmitting(false);
      return;
    }

    const submitSale = async () => {
      const saleData = {
        franchise_id: franchiseId,
        value: subtotal,
        contact_id: resolvedContactId || null,
        source: isEditing ? (sale.source || "manual") : "manual",
        payment_method: paymentMethod,
        card_fee_percent: cobraTaxa ? cardFeePercent : null,
        card_fee_amount: cobraTaxa ? cardFeeAmount : null,
        fee_passed_to_customer: cardFeeAmount > 0 ? feePassedToCustomer : null,
        delivery_method: deliveryMethod,
        delivery_fee: deliveryMethod === "delivery" ? deliveryFee : 0,
        discount_amount: discountAmount || 0,
        discount_type: discountInput > 0 ? discountType : null,
        discount_input: discountInput > 0 ? discountInput : null,
        net_value: netValue,
        sale_date: saleDate,
        observacoes: observacoes || null,
      };

      const itemsData = items
        .filter((it) => it.inventory_item_id)
        .map((it) => ({
          inventory_item_id: it.inventory_item_id,
          product_name: it.product_name,
          quantity: Number(it.quantity) || 1,
          unit_price: it.unit_price,
          cost_price: it.cost_price,
        }));

      // Atomic RPC: sale + items in single transaction (safe to retry)
      // 60s timeout matches previous Sale.create timeout (triggers affect 28 inventory items)
      const rpcPromise = supabase.rpc('save_sale_with_items', {
        p_sale_id: isEditing ? sale.id : null,
        p_sale_data: saleData,
        p_items: itemsData,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite excedido')), 60000)
      );
      const { data: saleId, error } = await Promise.race([rpcPromise, timeoutPromise]);
      if (error) throw error;

      // Audit log (non-critical — no retry needed)
      try {
        await AuditLog.create({
          user_id: currentUser?.id || null,
          user_name: currentUser?.full_name || currentUser?.email || "Desconhecido",
          franchise_id: franchiseId,
          action: isEditing ? "update" : "create",
          entity_type: "sale",
          entity_id: saleId,
          details: {
            value: subtotal,
            net_value: netValue,
            payment_method: paymentMethod,
            items_count: itemsData.length,
          },
        });
      } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
      }

      return saleId;
    };

    try {
      // O RPC save_sale_with_items DEVOLVE o id — ele so estava sendo jogado fora aqui.
      // Sem ele, imprimir o cupom logo apos salvar obrigava a cacar a venda na lista,
      // enquanto o tutorial "Registrando uma Venda" promete que o comprovante aparece
      // na tela. Auditoria 07/09/2026.
      const savedSaleId = await withRetry(submitSale);

      // Success — clear draft and notify
      clearDraft(franchiseId);
      toast.success(isEditing ? "Venda atualizada!" : "Venda registrada!");
      onSave(savedSaleId);
    } catch (error) {
      console.error("Erro ao salvar venda após retentativas:", error);
      // Ensure draft is saved so user doesn't lose data
      if (!isEditing) {
        saveDraft(franchiseId, draftData);
      }
      toast.error("Não foi possível salvar. Seu rascunho foi mantido.", {
        action: {
          label: "Tentar novamente",
          onClick: () => handleSubmit({ preventDefault: () => {} }),
        },
        duration: 8000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available products not yet selected
  const availableProducts = (currentItemId) => {
    const usedIds = items
      .map((it) => it.inventory_item_id)
      .filter((id) => id && id !== currentItemId);
    return inventoryItems.filter((p) => !usedIds.includes(p.id));
  };

  // Mobile collapsible sections
  const [expandedSections, setExpandedSections] = useState({});
  const toggleSection = useCallback((key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const MobileSection = useCallback(({ id, label, icon, summary, children }) => (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="md:hidden flex items-center justify-between w-full text-left"
      >
        <Label className="text-sm font-medium text-ink flex items-center gap-1.5 pointer-events-none">
          <MaterialIcon icon={icon} size={16} className="text-ink-3" />
          {label}
        </Label>
        <div className="flex items-center gap-2">
          {!expandedSections[id] && summary && (
            <span className="text-xs text-ink-3 max-w-[140px] truncate">{summary}</span>
          )}
          <MaterialIcon icon={expandedSections[id] ? "expand_less" : "expand_more"} size={18} className="text-ink-3" />
        </div>
      </button>
      <Label className="hidden md:block text-sm font-medium text-ink">{label}</Label>
      <div className={`${expandedSections[id] ? "" : "hidden md:block"}`}>
        {children}
      </div>
    </div>
  ), [expandedSections, toggleSection]);

  if (loadingItems) {
    return (
      <div className="flex items-center justify-center py-8">
        <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-brand" />
        <span className="ml-2 text-sm text-ink-2">Carregando...</span>
      </div>
    );
  }

  // Mobile section summaries
  const discountSummary = discountAmount > 0 ? `−${formatCurrency(discountAmount)}` : "Nenhum";
  const paymentSummary = PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label || "—";
  const deliverySummary = deliveryMethod === "delivery" ? `Delivery${effectiveDeliveryFee > 0 ? ` ${formatCurrency(effectiveDeliveryFee)}` : ""}` : "Retirada";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact */}
      <div className="space-y-2">
        <Label htmlFor="contact" className="text-sm font-medium text-ink">
          Cliente
        </Label>
        <ContactAutocomplete
          id="contact"
          value={contactSearch}
          onChange={handleContactSearchChange}
          onSelect={handleContactSelect}
          onCreateNew={handleOpenInlineCreate}
          franchiseId={franchiseId}
          className="bg-surface-line/50"
        />
        {isNewContact && !showInlineCreate && (
          <div className="flex items-center gap-2 p-3 bg-[#fffbeb] rounded-xl border border-brand-gold/30">
            <MaterialIcon icon="person_add" size={18} className="text-brand-gold shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[#92400e] mb-1">Novo contato — adicione o nome:</p>
              <Input
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Nome do cliente"
                className="bg-white h-9"
              />
            </div>
          </div>
        )}
        {showInlineCreate && (
          <div className="p-4 bg-surface rounded-xl border border-brand/20 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon icon="person_add" size={18} className="text-brand" />
              <span className="text-sm font-medium text-ink">Novo contato</span>
            </div>
            <div className="space-y-2">
              <Input
                value={inlineContactName}
                onChange={(e) => setInlineContactName(e.target.value)}
                placeholder="Nome do cliente"
                className="bg-white h-9"
                autoFocus
              />
              <Input
                value={inlineContactPhone}
                onChange={(e) => setInlineContactPhone(e.target.value)}
                placeholder="Telefone (opcional)"
                className="bg-white h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowInlineCreate(false);
                  setInlineContactName("");
                  setInlineContactPhone("");
                }}
                disabled={isCreatingContact}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleInlineContactCreate}
                disabled={isCreatingContact}
                className="bg-brand hover:bg-brand-dark text-white"
              >
                {isCreatingContact ? (
                  <>
                    <MaterialIcon icon="progress_activity" size={14} className="animate-spin mr-1" />
                    Criando...
                  </>
                ) : (
                  "Criar e selecionar"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Products */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-ink">Produtos</Label>

        {items.map((item, index) => {
          const selectedInv = item.inventory_item_id
            ? inventoryItems.find((p) => p.id === item.inventory_item_id)
            : null;
          const isZeroStock = selectedInv && (selectedInv.quantity || 0) <= 0;

          return (
          <div
            key={index}
            data-sale-item
            className="flex flex-col gap-2 p-3 bg-surface rounded-xl border border-ink-shadow/5"
          >
            <div className="flex flex-col md:flex-row gap-2">
            {/* Product search */}
            <div className="flex-1 min-w-0 sm:min-w-[160px]">
              <ProductSearch
                products={availableProducts(item.inventory_item_id)}
                selectedId={item.inventory_item_id}
                onSelect={(v) => handleItemChange(index, "inventory_item_id", v)}
                placeholder="Buscar produto..."
              />
            </div>

            {/* Quantity */}
            <div className="w-full md:w-24">
              <Input
                data-qty-input
                type="number"
                min={1}
                inputMode="numeric"
                value={item.quantity === "" ? "" : item.quantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    handleItemChange(index, "quantity", "");
                  } else {
                    const parsed = parseInt(raw);
                    if (!isNaN(parsed) && parsed >= 0) {
                      handleItemChange(index, "quantity", parsed);
                    }
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === "" || parseInt(e.target.value) < 1) {
                    handleItemChange(index, "quantity", 1);
                  }
                }}
                className="bg-white text-center"
                placeholder="Qtd"
              />
            </div>

            {/* Unit price */}
            <div className="w-full md:w-28">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.unit_price || ""}
                onChange={(e) =>
                  handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)
                }
                className="bg-white text-right font-mono-numbers"
                placeholder="R$ 0,00"
              />
            </div>

            {/* Line total — calculado automaticamente, NÃO é input */}
            <div className="flex items-center justify-between md:w-28">
              <span
                className="text-sm font-medium text-ink-2 font-mono-numbers md:text-right md:w-full px-2 py-1.5 bg-surface-2 rounded-md cursor-default select-none"
                title="Subtotal (quantidade × preço unitário)"
              >
                {formatCurrency((Number(item.quantity) || 0) * item.unit_price)}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="ml-2 p-1 rounded-lg hover:bg-brand/10 text-ink-2 hover:text-brand transition-colors"
                >
                  <MaterialIcon icon="close" size={18} />
                </button>
              )}
            </div>
            </div>

            {isZeroStock && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#fffbeb] rounded-lg border border-brand-gold/30">
                <MaterialIcon icon="warning" size={14} className="text-brand-gold shrink-0" />
                <span className="text-xs text-[#92400e]">Estoque zerado — atualize seu estoque</span>
              </div>
            )}
          </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="gap-1.5 text-brand border-brand/30 hover:bg-brand/5"
        >
          <MaterialIcon icon="add" size={16} />
          Adicionar produto
        </Button>
      </div>

      {/* Discount */}
      <MobileSection id="discount" label="Desconto" icon="sell" summary={discountSummary}>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-surface rounded-lg border border-ink-shadow/10">
            <button
              type="button"
              onClick={() => { setDiscountType("fixed"); setDiscountInput(0); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                discountType === "fixed"
                  ? "bg-white text-brand shadow-sm"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              R$
            </button>
            <button
              type="button"
              onClick={() => { setDiscountType("percent"); setDiscountInput(0); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                discountType === "percent"
                  ? "bg-white text-brand shadow-sm"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              %
            </button>
          </div>
          <Input
            type="number"
            min={0}
            max={discountType === "percent" ? 100 : undefined}
            step={discountType === "percent" ? 1 : 0.01}
            value={discountInput || ""}
            onChange={(e) => {
              let val = parseFloat(e.target.value) || 0;
              if (discountType === "percent") val = Math.min(val, 100);
              setDiscountInput(val);
            }}
            className="flex-1 bg-white text-right font-mono-numbers"
            placeholder={discountType === "percent" ? "0" : "0,00"}
          />
        </div>
        {discountAmount > 0 && (
          <p className="text-xs text-ink-3">
            −{formatCurrency(discountAmount)} no subtotal
          </p>
        )}
      </MobileSection>

      {/* Payment method */}
      <MobileSection id="payment" label="Pagamento" icon="payments" summary={paymentSummary}>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-xs min-h-[48px] ${
                paymentMethod === pm.value
                  ? "border-brand bg-brand/10 text-brand font-bold shadow-sm"
                  : "border-ink-shadow/10 bg-white text-ink-2 hover:bg-surface hover:border-ink-shadow/20"
              }`}
            >
              <MaterialIcon icon={pm.icon} size={16} />
              {pm.label}
            </button>
          ))}
        </div>

        {cobraTaxa && (
          <div className="mt-2 p-3 bg-surface rounded-xl border border-ink-shadow/5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-ink-2 whitespace-nowrap">Taxa (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={cardFeePercent}
                onChange={(e) => setCardFeePercent(parseFloat(e.target.value) || 0)}
                className="w-24 bg-white text-right font-mono-numbers"
              />
              <span className="text-sm text-ink-2 font-mono-numbers">
                = {formatCurrency(cardFeeAmount)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 pt-2 border-t border-ink-shadow/5">
              <div className="flex flex-col">
                <Label className="text-sm text-ink-2 cursor-pointer" htmlFor="fee-passed-toggle">
                  Cliente paga a taxa
                </Label>
                <span className="text-xs text-ink-3 mt-0.5">
                  Quando ativo, soma a taxa no total cobrado do cliente
                </span>
              </div>
              <Switch
                id="fee-passed-toggle"
                checked={feePassedToCustomer}
                onCheckedChange={(val) => setFeePassedToCustomer(val)}
              />
            </div>
          </div>
        )}
      </MobileSection>

      {/* Delivery method */}
      <MobileSection id="delivery" label="Entrega" icon="delivery_dining" summary={deliverySummary}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod("retirada")}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm ${
              deliveryMethod === "retirada"
                ? "border-brand bg-brand/5 text-brand font-medium"
                : "border-ink-shadow/10 bg-white text-ink-2 hover:bg-surface"
            }`}
          >
            <MaterialIcon icon="store" size={18} />
            Retirada
          </button>
          <button
            type="button"
            onClick={() => {
              setDeliveryMethod("delivery");
              // Preenche sozinho SO quando nao ha escolha a fazer. Com 2+ faixas nao
              // adivinha: a venda manual nao sabe a distancia ate o cliente, e chutar
              // uma faixa e inventar numero de dinheiro. Ver lib/deliveryFeeRules.js.
              if (deliveryFeeOptions.length === 1 && !deliveryFee) {
                setDeliveryFee(deliveryFeeOptions[0].fee);
              }
            }}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm ${
              deliveryMethod === "delivery"
                ? "border-brand bg-brand/5 text-brand font-medium"
                : "border-ink-shadow/10 bg-white text-ink-2 hover:bg-surface"
            }`}
          >
            <MaterialIcon icon="delivery_dining" size={18} />
            Delivery
          </button>
        </div>

        {deliveryMethod === "delivery" && (
          <div className="mt-2 p-3 bg-surface rounded-xl border border-ink-shadow/5">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-ink-2 whitespace-nowrap">Frete (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={deliveryFee || ""}
                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                className="w-28 bg-white text-right font-mono-numbers"
                placeholder="0,00"
              />
            </div>

            {deliveryFeeOptions.length > 1 && (
              <div className="mt-3">
                <p className="text-[11px] text-ink-3 mb-1.5">Sua tabela de frete:</p>
                <div className="flex flex-wrap gap-1.5">
                  {deliveryFeeOptions.map((opt) => {
                    const ativo = Number(deliveryFee) === opt.fee;
                    return (
                      <button
                        key={`${opt.label}-${opt.fee}`}
                        type="button"
                        onClick={() => setDeliveryFee(opt.fee)}
                        className={`px-3 min-h-[40px] rounded-lg border text-xs transition-colors ${
                          ativo
                            ? "border-brand bg-brand/5 text-brand font-semibold"
                            : "border-ink-shadow/10 bg-white text-ink-2 active:bg-surface-2"
                        }`}
                      >
                        {opt.label} · {opt.fee === 0 ? "grátis" : formatCurrency(opt.fee)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </MobileSection>

      {/* Sale date */}
      <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-ink-shadow/5">
        <MaterialIcon icon="calendar_today" size={18} className="text-ink-3" />
        <Label className="text-sm text-ink-2 whitespace-nowrap">Data da venda</Label>
        <Input
          type="date"
          value={saleDate}
          onChange={(e) => setSaleDate(e.target.value)}
          className="w-40 bg-white text-sm"
        />
      </div>

      {/* Observações */}
      <div className="p-3 bg-surface rounded-xl border border-ink-shadow/5">
        <div className="flex items-center gap-2 mb-2">
          <MaterialIcon icon="notes" size={18} className="text-ink-3" />
          <Label className="text-sm text-ink-2">Observações</Label>
        </div>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: Entregar sábado até às 12h, deixar na portaria..."
          rows={2}
          className="w-full text-sm rounded-lg border border-ink-shadow/10 bg-white px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/30"
        />
      </div>

      {/* Summary */}
      <div className="p-4 bg-surface rounded-xl border border-ink-shadow/5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-ink-2">Subtotal</span>
          <span className="font-medium text-ink font-mono-numbers">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">
              Desconto{discountType === "percent" ? ` (${discountInput}%)` : ""}
            </span>
            <span className="font-medium text-err font-mono-numbers">
              − {formatCurrency(discountAmount)}
            </span>
          </div>
        )}

        {cardFeeAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">
              Taxa {paymentMethod === "payment_link" ? "link" : paymentMethod === "pix" ? "PIX" : paymentMethod === "cash" ? "dinheiro" : "cartão"} ({cardFeePercent}%)
              {feePassedToCustomer && <span className="text-xs text-ink-3 ml-1">(cliente paga)</span>}
            </span>
            <span className={`font-medium font-mono-numbers ${feePassedToCustomer ? "text-ok" : "text-brand"}`}>
              {feePassedToCustomer ? "+" : "-"} {formatCurrency(cardFeeAmount)}
            </span>
          </div>
        )}

        {deliveryMethod === "delivery" && effectiveDeliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Frete (receita)</span>
            <span className="font-medium text-ok font-mono-numbers">
              + {formatCurrency(effectiveDeliveryFee)}
            </span>
          </div>
        )}

        <div className="border-t border-ink-shadow/10 pt-2 flex justify-between">
          <span className="font-medium text-ink">Total a receber</span>
          <span className="font-bold text-lg text-ink font-mono-numbers">
            {formatCurrency(netValue)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-brand hover:bg-brand-dark text-white"
        >
          {isSubmitting ? (
            <>
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin mr-2" />
              Salvando...
            </>
          ) : isEditing ? (
            "Atualizar Venda"
          ) : (
            "Registrar Venda"
          )}
        </Button>
      </div>
    </form>
  );
}
