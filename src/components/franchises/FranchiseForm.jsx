import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MaterialIcon from "@/components/ui/MaterialIcon";
function formatCpfCnpj(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatCep(value) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
}

// 7c — Auto-sugerir nome "Maxi Massas - Cidade"
function suggestFranchiseName(city) {
  if (!city) return '';
  // Remove " - SP" etc. para usar só o nome da cidade
  const cityName = city.replace(/\s*-\s*[A-Z]{2}$/, '').trim();
  return `Maxi Massas - ${cityName}`;
}

// mode: "create" (default, admin cadastra nova franquia),
//       "fiscal-only" (franqueado edita só dados fiscais no onboarding — esconde identidade/operação).
// initialData: pré-preenche campos em "fiscal-only" (franquia já existente).
export default function FranchiseForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create",
  initialData = null,
}) {
  const isFiscalOnly = mode === "fiscal-only";
  const fiscalRequired = mode === "create" || isFiscalOnly;

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    owner_name: initialData?.owner_name || '',
    city: initialData?.city || '',
    status: initialData?.status || 'active',
    franchisee_email: initialData?.billing_email || '',
    cpf_cnpj: initialData?.cpf_cnpj || '',
  });
  const [addressData, setAddressData] = useState({
    cep: initialData?.cep || '',
    street_address: initialData?.street_address || '',
    address_number: initialData?.address_number || '',
    neighborhood: initialData?.neighborhood || '',
    state_uf: initialData?.state_uf || '',
  });
  const [cepLoading, setCepLoading] = useState(false);

  // 7b — Cidade autocomplete via IBGE
  const [municipalities, setMunicipalities] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const cityInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch municípios do IBGE (uma vez, cache no state)
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      .then(r => r.json())
      .then(data => {
        const mapped = data.map(m => ({
          name: m.nome,
          uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
          label: `${m.nome} - ${m.microrregiao?.mesorregiao?.UF?.sigla || ''}`
        }));
        setMunicipalities(mapped);
      })
      .catch(() => {}); // falha silenciosa — campo continua como texto livre
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          cityInputRef.current && !cityInputRef.current.contains(e.target)) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCityChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, city: value }));
    setHighlightedIndex(-1);
    if (value.length >= 2 && municipalities.length > 0) {
      const lower = value.toLowerCase();
      const filtered = municipalities
        .filter(m => m.name.toLowerCase().includes(lower) || m.label.toLowerCase().includes(lower))
        .slice(0, 8);
      setCitySuggestions(filtered);
      setShowCitySuggestions(filtered.length > 0);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  }, [municipalities]);

  const handleCitySelect = useCallback((city) => {
    setFormData(prev => {
      const updated = { ...prev, city: city.label };
      if (!nameManuallyEdited || !prev.name) {
        updated.name = suggestFranchiseName(city.label);
      }
      return updated;
    });
    setShowCitySuggestions(false);
  }, [nameManuallyEdited]);

  const handleCityKeyDown = useCallback((e) => {
    if (!showCitySuggestions || citySuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % citySuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev <= 0 ? citySuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleCitySelect(citySuggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowCitySuggestions(false);
    }
  }, [showCitySuggestions, citySuggestions, highlightedIndex, handleCitySelect]);

  const handleCepChange = useCallback(async (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setAddressData(prev => ({ ...prev, cep: digits }));
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddressData(prev => ({
            ...prev,
            street_address: data.logradouro || prev.street_address,
            neighborhood: data.bairro || prev.neighborhood,
            state_uf: data.uf || prev.state_uf,
          }));
        }
      } catch { /* falha silenciosa */ }
      finally { setCepLoading(false); }
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { franchisee_email, cpf_cnpj, ...rest } = formData;

    // Validação de campos fiscais (create e fiscal-only)
    if (fiscalRequired) {
      const emailTrim = (franchisee_email || "").trim();
      if (!emailTrim || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
        return; // browser já mostra mensagem via required/type=email
      }
      const cpfDigits = (cpf_cnpj || "").replace(/\D/g, "");
      if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
        return;
      }
    }

    const franchiseData = {
      ...rest,
      cpf_cnpj: cpf_cnpj.replace(/\D/g, "") || null,
      state_uf: addressData.state_uf || null,
      address_number: addressData.address_number || null,
      neighborhood: addressData.neighborhood || null,
      billing_email: (franchisee_email || "").trim() || null,
    };
    // addressData extras (cep, street_address) — gravados em franchise_configurations pelo caller
    onSubmit(franchiseData, franchisee_email, {
      cep: addressData.cep || null,
      street_address: addressData.street_address || null,
    });
  };

  const handleInputChange = (field, value) => {
    if (field === 'name') setNameManuallyEdited(true);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const wrapperClass = isFiscalOnly
    ? "w-full"
    : "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50";
  const cardClass = isFiscalOnly
    ? "w-full bg-white rounded-2xl shadow-sm border border-[#291715]/5"
    : "w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-[#291715]/5";

  return (
    <div className={wrapperClass}>
      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-center justify-between bg-[#fbf9fa] border-b border-[#291715]/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#b91c1c] text-white rounded-lg">
              <MaterialIcon icon={isFiscalOnly ? "receipt_long" : "apartment"} size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-plus-jakarta text-[#1b1c1d]">
                {isFiscalOnly ? "Seus dados de cobrança e NFe" : "Nova Franquia"}
              </CardTitle>
              <p className="text-sm text-[#4a3d3d] mt-1">
                {isFiscalOnly
                  ? "Confirme os dados usados na mensalidade e notas fiscais."
                  : "Preencha os dados. O sistema configura tudo automaticamente."}
              </p>
            </div>
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <MaterialIcon icon="close" size={16} />
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados da Unidade — ocultos em modo fiscal-only */}
            {!isFiscalOnly && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#4a3d3d] uppercase tracking-wider">Dados da Unidade</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="apartment" size={16} className="inline mr-1" />
                    Nome da Franquia *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Ex: MaxiMassas Sorocaba Centro"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="city" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="location_on" size={16} className="inline mr-1" />
                    Cidade *
                  </Label>
                  <Input
                    id="city"
                    ref={cityInputRef}
                    placeholder="Digite para buscar... Ex: Sorocaba"
                    value={formData.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    onKeyDown={handleCityKeyDown}
                    onFocus={() => formData.city.length >= 2 && citySuggestions.length > 0 && setShowCitySuggestions(true)}
                    autoComplete="off"
                    required
                  />
                  {showCitySuggestions && (
                    <div ref={suggestionsRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#291715]/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {citySuggestions.map((city, i) => (
                        <button
                          key={`${city.name}-${city.uf}-${i}`}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${i === highlightedIndex ? 'bg-[#b91c1c]/10 text-[#b91c1c]' : 'hover:bg-[#fbf9fa]'}`}
                          onClick={() => handleCitySelect(city)}
                          onMouseEnter={() => setHighlightedIndex(i)}
                        >
                          <MaterialIcon icon="location_on" size={14} className="inline mr-1 text-[#b91c1c]" />
                          {city.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Dados do Franqueado (nome + email + CPF) */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#4a3d3d] uppercase tracking-wider">
                {isFiscalOnly ? "Dados de Cobrança" : "Dados do Franqueado"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isFiscalOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="owner_name" className="text-sm font-semibold text-[#4a3d3d]">
                      <MaterialIcon icon="person" size={16} className="inline mr-1" />
                      Nome do Franqueado *
                    </Label>
                    <Input
                      id="owner_name"
                      placeholder="Ex: João Silva"
                      value={formData.owner_name}
                      onChange={(e) => handleInputChange('owner_name', e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="franchisee_email" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="mail" size={16} className="inline mr-1" />
                    Email de cobrança e NFe {fiscalRequired && "*"}
                  </Label>
                  <Input
                    id="franchisee_email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.franchisee_email}
                    onChange={(e) => handleInputChange('franchisee_email', e.target.value)}
                    required={fiscalRequired}
                  />
                  <p className="text-xs text-[#4a3d3d]">
                    Usado para mensalidade ASAAS e emissão de notas fiscais.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="badge" size={16} className="inline mr-1" />
                    CPF/CNPJ {fiscalRequired && "*"}
                  </Label>
                  <Input
                    id="cpf_cnpj"
                    placeholder="000.000.000-00"
                    value={formatCpfCnpj(formData.cpf_cnpj)}
                    onChange={(e) => handleInputChange('cpf_cnpj', e.target.value.replace(/\D/g, "").slice(0, 14))}
                    required={fiscalRequired}
                  />
                  <p className="text-xs text-[#4a3d3d]">
                    Prefira CNPJ (MEI) se tiver — usado na NFe.
                  </p>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#4a3d3d] uppercase tracking-wider">Endereço</h3>
              {isFiscalOnly && (
                <p className="text-xs text-[#4a3d3d]/80">
                  Aparece na ficha de separação e na NFe.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="pin_drop" size={16} className="inline mr-1" />
                    CEP {fiscalRequired && "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      value={formatCep(addressData.cep)}
                      onChange={(e) => handleCepChange(e.target.value)}
                      required={fiscalRequired}
                    />
                    {cepLoading && (
                      <MaterialIcon icon="sync" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="street" className="text-sm font-semibold text-[#4a3d3d]">Rua {fiscalRequired && "*"}</Label>
                  <Input
                    id="street"
                    placeholder="Logradouro"
                    value={addressData.street_address}
                    onChange={(e) => setAddressData(prev => ({ ...prev, street_address: e.target.value }))}
                    required={fiscalRequired}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number" className="text-sm font-semibold text-[#4a3d3d]">Número {fiscalRequired && "*"}</Label>
                  <Input
                    id="number"
                    placeholder="123"
                    value={addressData.address_number}
                    onChange={(e) => setAddressData(prev => ({ ...prev, address_number: e.target.value }))}
                    required={fiscalRequired}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-sm font-semibold text-[#4a3d3d]">Bairro {fiscalRequired && "*"}</Label>
                  <Input
                    id="neighborhood"
                    placeholder="Bairro"
                    value={addressData.neighborhood}
                    onChange={(e) => setAddressData(prev => ({ ...prev, neighborhood: e.target.value }))}
                    required={fiscalRequired}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_uf" className="text-sm font-semibold text-[#4a3d3d]">UF {fiscalRequired && "*"}</Label>
                  <Input
                    id="state_uf"
                    placeholder="SP"
                    maxLength={2}
                    value={addressData.state_uf}
                    onChange={(e) => setAddressData(prev => ({ ...prev, state_uf: e.target.value.toUpperCase() }))}
                    required={fiscalRequired}
                  />
                </div>
                {isFiscalOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="city_fiscal" className="text-sm font-semibold text-[#4a3d3d]">Cidade *</Label>
                    <Input
                      id="city_fiscal"
                      placeholder="Cidade"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* O que acontece automaticamente — só em criação */}
            {!isFiscalOnly && (
              <div className="bg-[#fbf9fa] border border-[#291715]/5 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[#b91c1c] mb-2">O que acontece ao criar:</h4>
                <ul className="text-sm text-[#4a3d3d] space-y-1">
                  <li>✓ Configurações da unidade criadas automaticamente</li>
                  <li>✓ Estoque populado com os 28 produtos padrão</li>
                  <li>✓ ID do vendedor automático gerado</li>
                  {formData.cpf_cnpj && <li>✓ Cadastro ASAAS + assinatura mensal criados</li>}
                  {formData.franchisee_email && <li>✓ Convite enviado para {formData.franchisee_email}</li>}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#291715]/5">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="border border-[#b91c1c] text-[#b91c1c] rounded-xl">
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg"
              >
                {isSubmitting
                  ? (isFiscalOnly ? 'Salvando...' : 'Criando...')
                  : (isFiscalOnly ? 'Salvar e continuar' : 'Criar Franquia')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
