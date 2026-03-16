import React, { useState, useEffect } from "react";
import { Sale, Franchise, User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, DollarSign, Search, Filter, Trash2, BrainCircuit } from "lucide-react";
import LeadAnalysisModal from "../components/sales/LeadAnalysisModal";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import ErrorBoundary from "../components/ErrorBoundary";

function SalesContent() {
  const [sales, setSales] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Renamed from isSaving in outline to reuse isSubmitting for all form actions
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFranchise, setFilterFranchise] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    franchise_id: '',
    contact_phone: '',
    customer_name: '',
    value: '',
    sale_date: '',
    source: 'whatsapp'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUserData, franchisesData] = await Promise.all([
        User.me(),
        Franchise.list()
      ]);

      setCurrentUser(currentUserData);
      setFranchises(franchisesData);

      // Determinar quais franquias o usuário pode ver
      let allowedFranchiseIds;
      if (currentUserData.role === 'admin') {
        allowedFranchiseIds = franchisesData.map(f => f.evolution_instance_id);
      } else {
        allowedFranchiseIds = currentUserData.managed_franchise_ids || [];
      }

      // Buscar vendas filtradas
      const salesData = await Sale.list('-sale_date', 500);
      const filteredSales = salesData.filter(sale => 
        allowedFranchiseIds.includes(sale.franchise_id)
      );

      setSales(filteredSales);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      franchise_id: '',
      contact_phone: '',
      customer_name: '',
      value: '',
      sale_date: '',
      source: 'whatsapp'
    });
  };

  const handleNewSale = () => {
    resetForm();
    setEditingSale(null);
    // Pequeno delay para garantir que o estado seja limpo antes de mostrar o modal
    setTimeout(() => {
      setShowForm(true);
    }, 50);
  };

  const handleEditSale = (sale) => {
    setFormData({
      franchise_id: sale.franchise_id,
      contact_phone: sale.contact_phone,
      customer_name: sale.customer_name || '',
      value: sale.value.toString(),
      sale_date: sale.sale_date,
      source: sale.source
    });
    setEditingSale(sale);
    // Pequeno delay para garantir que o estado seja atualizado antes de mostrar o modal
    setTimeout(() => {
      setShowForm(true);
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const saleData = {
        ...formData,
        value: parseFloat(formData.value)
      };

      if (editingSale) {
        await Sale.update(editingSale.id, saleData);
      } else {
        await Sale.create(saleData);
      }

      setShowForm(false);
      loadData(); // Recarregar dados
    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      alert("Erro ao salvar venda. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteSale = async () => {
    if (!editingSale) return;
    
    if (window.confirm('Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.')) {
      setIsSubmitting(true); // Reuse isSubmitting for delete operation
      try {
        await Sale.delete(editingSale.id);
        setShowForm(false);
        loadData(); // Recarregar dados
      } catch (error) {
        console.error("Erro ao deletar venda:", error);
        alert("Erro ao deletar venda. Tente novamente.");
      }
      setIsSubmitting(false);
    }
  };

  // Filtrar vendas baseado na busca e filtros
  const filteredSales = sales.filter(sale => {
    const matchesSearch = !searchTerm || 
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.contact_phone?.includes(searchTerm);
    
    const matchesFranchise = filterFranchise === 'all' || 
      sale.franchise_id === filterFranchise;
    
    const matchesDate = !filterDate || 
      sale.sale_date === filterDate;
    
    return matchesSearch && matchesFranchise && matchesDate;
  });

  const getSourceBadge = (source) => {
    const colors = {
      whatsapp: 'bg-green-100 text-green-800',
      phone_call: 'bg-blue-100 text-blue-800',
      in_person: 'bg-purple-100 text-purple-800',
      website: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      whatsapp: 'WhatsApp',
      phone_call: 'Telefone',
      in_person: 'Presencial',
      website: 'Site',
      other: 'Outro'
    };

    return (
      <Badge className={colors[source] || colors.other}>
        {labels[source] || source}
      </Badge>
    );
  };

  const getFranchiseName = (franchiseId) => {
    const franchise = franchises.find(f => f.evolution_instance_id === franchiseId);
    return franchise?.city || franchiseId;
  };

  const formatDateSafe = (dateString) => {
    if (!dateString) return 'Data não informada';
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
          return 'Data inválida';
      }
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
      return 'Erro na data';
    }
  };

  // Determinar quais franquias o usuário pode criar vendas
  const availableFranchises = currentUser?.role === 'admin' 
    ? franchises 
    : franchises.filter(f => currentUser?.managed_franchise_ids?.includes(f.evolution_instance_id));

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              Gerenciar Vendas
            </h1>
            <p className="text-slate-600 mt-1">Visualize, confirme e edite as vendas registradas</p>
          </div>
          
          {availableFranchises.length > 0 && (
            <Button onClick={handleNewSale} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Venda
            </Button>
          )}
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterFranchise} onValueChange={setFilterFranchise}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por franquia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Franquias</SelectItem>
                  {availableFranchises.map(f => (
                    <SelectItem key={f.id} value={f.evolution_instance_id}>
                      {f.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filtrar por data"
              />
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFilterFranchise('all');
                  setFilterDate('');
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Vendas */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSales.map((sale) => (
              <Card key={sale.id} className="bg-white/90 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {sale.customer_name || 'Cliente não informado'}
                        </h3>
                        <Badge className="bg-green-100 text-green-800">
                          R$ {sale.value?.toFixed(2) || '0.00'}
                        </Badge>
                        {getSourceBadge(sale.source)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">Telefone:</span> {sale.contact_phone}
                        </div>
                        <div>
                          <span className="font-medium">Franquia:</span> {getFranchiseName(sale.franchise_id)}
                        </div>
                        <div>
                          <span className="font-medium">Data:</span> {formatDateSafe(sale.sale_date)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <LeadAnalysisModal sale={sale} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSale(sale)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredSales.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Nenhuma venda encontrada
                </h3>
                <p className="text-slate-600">
                  {sales.length === 0 
                    ? 'Ainda não há vendas registradas.' 
                    : 'Tente ajustar os filtros de busca.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal do Formulário - Renderizar apenas quando showForm for true E dados estiverem prontos */}
        {showForm && availableFranchises.length > 0 && (
          <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{editingSale ? 'Editar Venda' : 'Nova Venda'}</span>
                  {/* Botão Excluir foi removido daqui */}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="franchise_id">Franquia *</Label>
                    <Select 
                      value={formData.franchise_id} 
                      onValueChange={(value) => setFormData({...formData, franchise_id: value})}
                      required
                    >
                      <SelectTrigger id="franchise_id">
                        <SelectValue placeholder="Selecione a franquia" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFranchises.map(f => (
                          <SelectItem key={f.id} value={f.evolution_instance_id}>
                            {f.city} - {f.owner_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="value">Valor da Venda *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="customer_name">Nome do Cliente</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact_phone">Telefone *</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="sale_date">Data da Venda *</Label>
                    <Input
                      id="sale_date"
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) => setFormData({...formData, sale_date: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="source">Origem do Lead</Label>
                    <Select 
                      value={formData.source} 
                      onValueChange={(value) => setFormData({...formData, source: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="phone_call">Telefone</SelectItem>
                        <SelectItem value="in_person">Presencial</SelectItem>
                        <SelectItem value="website">Site</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <div>
                    {editingSale && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSale}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Salvando...' : editingSale ? 'Atualizar' : 'Criar Venda'}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// Exportar com Error Boundary
export default function Sales() {
  return (
    <ErrorBoundary>
      <SalesContent />
    </ErrorBoundary>
  );
}