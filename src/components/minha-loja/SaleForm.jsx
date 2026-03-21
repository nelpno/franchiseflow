import React, { useState, useEffect, useRef, useMemo } from "react";
import { Sale, SaleItem, Contact } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { toast } from "sonner";

function ProductSearch({ products, selectedId, onSelect, placeholder = "Buscar produto...", inputId }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selectedProduct = products.find((p) => p.id === selectedId);

  const filtered = useMemo(() => {
    if (!query) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.product_name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
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
        <MaterialIcon icon="search" size={18} className="text-[#534343]/50 mr-2 shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#291715]/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
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
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#fbf9fa] transition-colors flex justify-between items-center ${
                p.id === selectedId ? "bg-[#b91c1c]/5 text-[#b91c1c]" : "text-[#1b1c1d]"
              }`}
            >
              <span>{p.product_name}</span>
              {p.sale_price > 0 && (
                <span className="text-xs text-[#534343]/60 font-mono-numbers">
                  R$ {(p.sale_price || 0).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#291715]/10 rounded-xl shadow-lg p-3 text-sm text-[#534343]/60">
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

// Normalize phone to E.164-ish format (55 + DDD + number)
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length >= 10) return "55" + digits;
  return digits;
}

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
// ContactAutocomplete (reused pattern from Sales.jsx)
// ---------------------------------------------------------------------------
function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  contacts,
  placeholder = "Buscar por nome ou telefone...",
  className = "",
  id,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const inputVal = e.target.value;
    onChange(inputVal);

    if (inputVal.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const normalized = normalizePhone(inputVal);
    const lowerInput = inputVal.toLowerCase();

    const matches = contacts
      .filter((c) => {
        const cPhone = normalizePhone(c.telefone || "");
        const cName = (c.nome || "").toLowerCase();
        return (
          cPhone.includes(normalized) ||
          cName.includes(lowerInput) ||
          (c.telefone || "").includes(inputVal)
        );
      })
      .slice(0, 6);

    setSearchResults(matches);
    setShowDropdown(matches.length > 0);
  };

  const handleSelect = (contact) => {
    setShowDropdown(false);
    setSearchResults([]);
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
          if (searchResults.length > 0) setShowDropdown(true);
        }}
        className={className}
        autoComplete="off"
      />
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-[#291715]/10 max-h-60 overflow-y-auto">
          {searchResults.map((contact) => {
            const purchaseCount = contact.total_purchases || 0;
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelect(contact)}
                className="w-full text-left px-4 py-3 hover:bg-[#f5f3f4] transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-[#1b1c1d] truncate block">
                    {contact.nome || "Sem nome"}
                  </span>
                  <span className="text-sm text-[#534343]">
                    {formatPhone(contact.telefone)}
                  </span>
                </div>
                {purchaseCount > 0 && (
                  <Badge className="bg-[#d4af37]/15 text-[#775a19] rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {purchaseCount} {purchaseCount === 1 ? "compra" : "compras"}
                  </Badge>
                )}
              </button>
            );
          })}
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
  onSave,
  onCancel,
}) {
  const isEditing = !!sale;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Contact
  const [contactSearch, setContactSearch] = useState("");
  const [contactId, setContactId] = useState(null);
  const [newContactName, setNewContactName] = useState("");
  const [isNewContact, setIsNewContact] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [cardFeePercent, setCardFeePercent] = useState(3.5);

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState("retirada");
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Sale items rows
  const [items, setItems] = useState([
    { inventory_item_id: "", product_name: "", quantity: 1, unit_price: 0, cost_price: 0 },
  ]);

  // Pre-fill when editing
  useEffect(() => {
    if (!sale) return;

    setPaymentMethod(sale.payment_method || "pix");
    setCardFeePercent(sale.card_fee_percent ?? 3.5);
    setDeliveryMethod(sale.delivery_method || "retirada");
    setDeliveryFee(sale.delivery_fee ?? 0);
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

  // Calculations
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [items]
  );

  const cardFeeAmount = useMemo(() => {
    if (paymentMethod !== "card_machine") return 0;
    return subtotal * (cardFeePercent / 100);
  }, [subtotal, paymentMethod, cardFeePercent]);

  const effectiveDeliveryFee = deliveryMethod === "delivery" ? deliveryFee : 0;

  const netValue = subtotal - cardFeeAmount - effectiveDeliveryFee;

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
    const digits = val.replace(/\D/g, "");
    const hasEnoughDigits = digits.length >= 8;
    const hasMatch = contacts.some((c) => {
      const cPhone = normalizePhone(c.telefone || "");
      return cPhone.includes(normalizePhone(val)) || (c.nome || "").toLowerCase().includes(val.toLowerCase());
    });
    setIsNewContact(hasEnoughDigits && !hasMatch);
  };

  // Resolve or create contact
  const resolveContactId = async () => {
    if (contactId) return contactId;
    // If user typed something but didn't pick, try to match or skip
    if (!contactSearch || contactSearch.trim().length < 2) return null;

    const normalized = normalizePhone(contactSearch);
    const existing = contacts.find(
      (c) => normalizePhone(c.telefone || "") === normalized
    );
    if (existing) return existing.id;

    // Create new contact from phone + name
    try {
      const isPhone = /\d{8,}/.test(contactSearch.replace(/\D/g, ""));
      const newContact = await Contact.create({
        franchise_id: franchiseId,
        telefone: isPhone ? normalized : "",
        nome: newContactName.trim() || (isPhone ? "" : contactSearch),
        status: "cliente",
      });
      return newContact.id;
    } catch (err) {
      console.warn("Erro ao criar contato:", err);
      return null;
    }
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.length === 0 || items.every((it) => !it.inventory_item_id)) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedContactId = await resolveContactId();

      const saleData = {
        franchise_id: franchiseId,
        value: subtotal,
        contact_id: resolvedContactId || null,
        source: "manual",
        payment_method: paymentMethod,
        card_fee_percent: paymentMethod === "card_machine" ? cardFeePercent : null,
        card_fee_amount: paymentMethod === "card_machine" ? cardFeeAmount : null,
        delivery_method: deliveryMethod,
        delivery_fee: deliveryMethod === "delivery" ? deliveryFee : 0,
        net_value: netValue,
        sale_date: sale?.sale_date || new Date().toISOString().split("T")[0],
      };

      let saleId;
      if (isEditing) {
        await Sale.update(sale.id, saleData);
        saleId = sale.id;

        // Delete old sale items then re-insert
        const oldItems = await SaleItem.filter({ sale_id: sale.id });
        await Promise.all(oldItems.map((oi) => SaleItem.delete(oi.id)));
      } else {
        const created = await Sale.create(saleData);
        saleId = created.id;
      }

      // Insert sale items
      await Promise.all(
        items
          .filter((it) => it.inventory_item_id)
          .map((it) =>
            SaleItem.create({
              sale_id: saleId,
              inventory_item_id: it.inventory_item_id,
              product_name: it.product_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              cost_price: it.cost_price,
            })
          )
      );

      toast.success(isEditing ? "Venda atualizada!" : "Venda registrada!");
      onSave();
    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      toast.error("Erro ao salvar venda. Tente novamente.");
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

  if (loadingItems) {
    return (
      <div className="flex items-center justify-center py-8">
        <MaterialIcon icon="progress_activity" size={24} className="animate-spin text-[#b91c1c]" />
        <span className="ml-2 text-sm text-[#534343]">Carregando...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact */}
      <div className="space-y-2">
        <Label htmlFor="contact" className="text-sm font-medium text-[#1b1c1d]">
          Cliente
        </Label>
        <ContactAutocomplete
          id="contact"
          value={contactSearch}
          onChange={handleContactSearchChange}
          onSelect={handleContactSelect}
          contacts={contacts}
          className="bg-[#e9e8e9]/50"
        />
        {isNewContact && (
          <div className="flex items-center gap-2 p-3 bg-[#fffbeb] rounded-xl border border-[#d4af37]/30">
            <MaterialIcon icon="person_add" size={18} className="text-[#d4af37] shrink-0" />
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
      </div>

      {/* Products */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-[#1b1c1d]">Produtos</Label>

        {items.map((item, index) => (
          <div
            key={index}
            data-sale-item
            className="flex flex-col md:flex-row gap-2 p-3 bg-[#fbf9fa] rounded-xl border border-[#291715]/5"
          >
            {/* Product search */}
            <div className="flex-1 min-w-0">
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
                value={item.quantity}
                onChange={(e) =>
                  handleItemChange(index, "quantity", parseInt(e.target.value) || 1)
                }
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

            {/* Line total */}
            <div className="flex items-center justify-between md:w-28">
              <span className="text-sm font-medium text-[#534343] font-mono-numbers md:text-right md:w-full">
                {formatCurrency(item.quantity * item.unit_price)}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="ml-2 p-1 rounded-lg hover:bg-[#b91c1c]/10 text-[#534343] hover:text-[#b91c1c] transition-colors"
                >
                  <MaterialIcon icon="close" size={18} />
                </button>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="gap-1.5 text-[#b91c1c] border-[#b91c1c]/30 hover:bg-[#b91c1c]/5"
        >
          <MaterialIcon icon="add" size={16} />
          Adicionar produto
        </Button>
      </div>

      {/* Payment method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[#1b1c1d]">Forma de Pagamento</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm ${
                paymentMethod === pm.value
                  ? "border-[#b91c1c] bg-[#b91c1c]/5 text-[#b91c1c] font-medium"
                  : "border-[#291715]/10 bg-white text-[#534343] hover:bg-[#f5f3f4]"
              }`}
            >
              <MaterialIcon icon={pm.icon} size={18} />
              {pm.label}
            </button>
          ))}
        </div>

        {paymentMethod === "card_machine" && (
          <div className="flex items-center gap-3 mt-2 p-3 bg-[#fbf9fa] rounded-xl border border-[#291715]/5">
            <Label className="text-sm text-[#534343] whitespace-nowrap">Taxa do cartao (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={cardFeePercent}
              onChange={(e) => setCardFeePercent(parseFloat(e.target.value) || 0)}
              className="w-24 bg-white text-right font-mono-numbers"
            />
            <span className="text-sm text-[#534343] font-mono-numbers">
              = {formatCurrency(cardFeeAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Delivery method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[#1b1c1d]">Entrega</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod("retirada")}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm ${
              deliveryMethod === "retirada"
                ? "border-[#b91c1c] bg-[#b91c1c]/5 text-[#b91c1c] font-medium"
                : "border-[#291715]/10 bg-white text-[#534343] hover:bg-[#f5f3f4]"
            }`}
          >
            <MaterialIcon icon="store" size={18} />
            Retirada
          </button>
          <button
            type="button"
            onClick={() => setDeliveryMethod("delivery")}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm ${
              deliveryMethod === "delivery"
                ? "border-[#b91c1c] bg-[#b91c1c]/5 text-[#b91c1c] font-medium"
                : "border-[#291715]/10 bg-white text-[#534343] hover:bg-[#f5f3f4]"
            }`}
          >
            <MaterialIcon icon="local_shipping" size={18} />
            Delivery
          </button>
        </div>

        {deliveryMethod === "delivery" && (
          <div className="flex items-center gap-3 mt-2 p-3 bg-[#fbf9fa] rounded-xl border border-[#291715]/5">
            <Label className="text-sm text-[#534343] whitespace-nowrap">Frete (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={deliveryFee || ""}
              onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
              className="w-28 bg-white text-right font-mono-numbers"
              placeholder="0,00"
            />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-[#fbf9fa] rounded-xl border border-[#291715]/5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[#534343]">Subtotal</span>
          <span className="font-medium text-[#1b1c1d] font-mono-numbers">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {paymentMethod === "card_machine" && cardFeeAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#534343]">Taxa cartao ({cardFeePercent}%)</span>
            <span className="font-medium text-[#b91c1c] font-mono-numbers">
              - {formatCurrency(cardFeeAmount)}
            </span>
          </div>
        )}

        {deliveryMethod === "delivery" && effectiveDeliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#534343]">Frete</span>
            <span className="font-medium text-[#b91c1c] font-mono-numbers">
              - {formatCurrency(effectiveDeliveryFee)}
            </span>
          </div>
        )}

        <div className="border-t border-[#291715]/10 pt-2 flex justify-between">
          <span className="font-medium text-[#1b1c1d]">Valor liquido</span>
          <span className="font-bold text-lg text-[#1b1c1d] font-mono-numbers">
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
          className="flex-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white"
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
