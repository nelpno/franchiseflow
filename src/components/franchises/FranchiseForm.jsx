import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// 7a — Máscara WhatsApp (XX) XXXXX-XXXX
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// 7c — Auto-sugerir nome "Maxi Massas - Cidade"
function suggestFranchiseName(city) {
  if (!city) return '';
  // Remove " - SP" etc. para usar só o nome da cidade
  const cityName = city.replace(/\s*-\s*[A-Z]{2}$/, '').trim();
  return `Maxi Massas - ${cityName}`;
}

function FieldHelp({ text }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <MaterialIcon icon="help" size={16} className="text-[#4a3d3d] cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function FranchiseForm({ onSubmit, onCancel, isSubmitting = false }) {
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone_number: '',
    city: '',
    status: 'active',
    franchisee_email: ''
  });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    // Não enviamos evolution_instance_id — o trigger do banco gera automaticamente
    // Também não enviamos franchisee_email como campo da franquia — será usado para o convite
    const { franchisee_email, ...franchiseData } = formData;
    onSubmit(franchiseData, franchisee_email);
  };

  const handleInputChange = (field, value) => {
    if (field === 'name') setNameManuallyEdited(true);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardHeader className="flex flex-row items-center justify-between bg-[#fbf9fa] border-b border-[#291715]/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#b91c1c] text-white rounded-lg">
              <MaterialIcon icon="apartment" size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-plus-jakarta text-[#1b1c1d]">Nova Franquia</CardTitle>
              <p className="text-sm text-[#4a3d3d] mt-1">
                Preencha os dados. O sistema configura tudo automaticamente.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <MaterialIcon icon="close" size={16} />
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados da Unidade */}
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

            {/* Dados do Franqueado */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#4a3d3d] uppercase tracking-wider">Dados do Franqueado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="phone" size={16} className="inline mr-1" />
                    WhatsApp *
                    <FieldHelp text="Número com DDD. Usado para o vendedor automático e contato." />
                  </Label>
                  <Input
                    id="phone_number"
                    placeholder="(11) 98765-4321"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', formatPhone(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="franchisee_email" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="mail" size={16} className="inline mr-1" />
                    Email do Franqueado
                    <FieldHelp text="Enviaremos um convite por email para acessar o dashboard. Se deixar vazio, poderá convidar depois." />
                  </Label>
                  <Input
                    id="franchisee_email"
                    type="email"
                    placeholder="joao@email.com (receberá convite de acesso)"
                    value={formData.franchisee_email}
                    onChange={(e) => handleInputChange('franchisee_email', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* O que acontece automaticamente */}
            <div className="bg-[#fbf9fa] border border-[#291715]/5 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[#b91c1c] mb-2">O que acontece ao criar:</h4>
              <ul className="text-sm text-[#4a3d3d] space-y-1">
                <li>✓ Configurações da unidade criadas automaticamente</li>
                <li>✓ Estoque populado com os 28 produtos padrão</li>
                <li>✓ ID do vendedor automático gerado</li>
                {formData.franchisee_email && <li>✓ Convite enviado para {formData.franchisee_email}</li>}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#291715]/5">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="border border-[#b91c1c] text-[#b91c1c] rounded-xl">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg"
              >
                {isSubmitting ? 'Criando...' : 'Criar Franquia'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
