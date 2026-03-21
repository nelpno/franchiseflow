import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function FieldHelp({ text }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <MaterialIcon icon="help" size={16} className="text-slate-400 cursor-help inline ml-1" />
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

  const handleSubmit = (e) => {
    e.preventDefault();
    // Não enviamos evolution_instance_id — o trigger do banco gera automaticamente
    // Também não enviamos franchisee_email como campo da franquia — será usado para o convite
    const { franchisee_email, ...franchiseData } = formData;
    onSubmit(franchiseData, franchisee_email);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardHeader className="flex flex-row items-center justify-between bg-[#f5f3f4] border-b border-[#291715]/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#b91c1c] text-white rounded-lg">
              <MaterialIcon icon="apartment" size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-plus-jakarta text-[#1b1c1d]">Nova Franquia</CardTitle>
              <p className="text-sm text-[#534343] mt-1">
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
              <h3 className="text-sm font-semibold text-[#534343] uppercase tracking-wider">Dados da Unidade</h3>
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

                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-semibold text-[#4a3d3d]">
                    <MaterialIcon icon="location_on" size={16} className="inline mr-1" />
                    Cidade *
                  </Label>
                  <Input
                    id="city"
                    placeholder="Ex: Sorocaba - SP"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Dados do Franqueado */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#534343] uppercase tracking-wider">Dados do Franqueado</h3>
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
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
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
            <div className="bg-[#f5f3f4] border border-[#291715]/5 rounded-xl p-4">
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
