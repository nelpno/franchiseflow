import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Building2 } from "lucide-react";

export default function FranchiseForm({ onSubmit, onCancel, isSubmitting = false }) {
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone_number: '',
    city: '',
    status: 'active',
    evolution_instance_id: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 text-white rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl text-slate-900">Nova Franquia MaxiMassas</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nome da Franquia *
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: MaxiMassas Centro"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className="border-slate-300 focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_name" className="text-sm font-semibold text-slate-700">
                  Nome do Franqueado *
                </Label>
                <Input
                  id="owner_name"
                  placeholder="Ex: João Silva"
                  value={formData.owner_name}
                  onChange={(e) => handleInputChange('owner_name', e.target.value)}
                  required
                  className="border-slate-300 focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-sm font-semibold text-slate-700">
                  WhatsApp da Franquia *
                </Label>
                <Input
                  id="phone_number"
                  placeholder="Ex: +5511987654321"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  required
                  className="border-slate-300 focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-semibold text-slate-700">
                  Cidade *
                </Label>
                <Input
                  id="city"
                  placeholder="Ex: São Paulo - SP"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  required
                  className="border-slate-300 focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-slate-700">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger className="border-slate-300 focus:border-red-500">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                    <SelectItem value="suspended">Suspensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution_instance_id" className="text-sm font-semibold text-slate-700">
                  ID da Instância Evolution
                </Label>
                <Input
                  id="evolution_instance_id"
                  placeholder="Ex: instance_12345"
                  value={formData.evolution_instance_id}
                  onChange={(e) => handleInputChange('evolution_instance_id', e.target.value)}
                  className="border-slate-300 focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
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