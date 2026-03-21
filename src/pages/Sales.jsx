import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sale, Franchise, User, SalesGoal } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import MaterialIcon from "@/components/ui/MaterialIcon";
import LeadAnalysisModal from "../components/sales/LeadAnalysisModal";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import ErrorBoundary from "../components/ErrorBoundary";

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Inline editable cell component
function InlineEdit({ value, onSave, type = "text", formatDisplay }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const newVal = type === "number" ? parseFloat(editValue) : editValue;
    if (newVal !== value && editValue !== '') {
      onSave(newVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 w-auto min-w-[80px] max-w-[200px] text-sm bg-[#e9e8e9] border-none rounded-xl focus:ring-2 focus:ring-[#b91c1c]/20"
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(value); setEditing(true); }}
      className="cursor-pointer hover:bg-[#d4af37]/10 hover:ring-1 hover:ring-[#d4af37]/40 rounded px-1 py-0.5 transition-all"
      title="Clique para editar"
    >
      {formatDisplay ? formatDisplay(value) : value}
    </span>
  );
}

function SalesContent() {
  const [sales, setSales] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFranchise, setFilterFranchise] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  // Performance stats
  const [monthStats, setMonthStats] = useState({ count: 0, revenue: 0, average: 0 });
  const [salesGoal, setSalesGoal] = useState(null);

  // Quick sale form
  const [quickForm, setQuickForm] = useState({
    value: '',
    customer_name: '',
    contact_phone: ''
  });

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

  const computeMonthStats = useCallback((salesData) => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const monthlySales = salesData.filter(s => {
      const d = s.sale_date?.substring(0, 10);
      return d && d >= monthStart && d <= monthEnd;
    });

    const count = monthlySales.length;
    const revenue = monthlySales.reduce((sum, s) => sum + (s.value || 0), 0);
    const average = count > 0 ? revenue / count : 0;

    setMonthStats({ count, revenue, average });
  }, []);

  const loadData = async () => {
    try {
      const [currentUserData, franchisesData] = await Promise.all([
        User.me(),
        Franchise.list()
      ]);

      setCurrentUser(currentUserData);
      setFranchises(franchisesData);

      // O RLS já filtra vendas e franquias por permissão do usuário
      const salesData = await Sale.list('-sale_date', 500);
      setSales(salesData);
      computeMonthStats(salesData);

      // Load sales goal for current month
      try {
        const currentMonth = format(new Date(), 'yyyy-MM-01');
        const goals = await SalesGoal.filter({ month: currentMonth });
        if (goals.length > 0) {
          setSalesGoal(goals[0]);
        }
      } catch (err) {
        console.warn("Sem meta de vendas configurada:", err);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados. Tente recarregar a página.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    // Pré-selecionar a franquia se o usuário só gerencia uma
    const defaultFranchiseId = availableFranchises.length === 1
      ? availableFranchises[0].evolution_instance_id
      : '';
    setFormData({
      franchise_id: defaultFranchiseId,
      contact_phone: '',
      customer_name: '',
      value: '',
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      source: 'whatsapp'
    });
  };

  const handleNewSale = () => {
    setEditingSale(null);
    resetForm();
    setShowForm(true);
  };

  const handleEditSale = (sale) => {
    setFormData({
      franchise_id: sale.franchise_id,
      contact_phone: sale.contact_phone,
      customer_name: sale.customer_name || '',
      value: sale.value.toString(),
      sale_date: sale.sale_date?.substring(0, 10) || '',
      source: sale.source
    });
    setEditingSale(sale);
    setShowForm(true);
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
        toast.success("Venda atualizada com sucesso!");
      } else {
        await Sale.create(saleData);
        toast.success("Venda registrada com sucesso!");
      }

      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      toast.error("Erro ao salvar venda. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleQuickSaleSubmit = async (e) => {
    e.preventDefault();
    if (!availableFranchises || availableFranchises.length === 0) {
      toast.error('Nenhuma franquia disponível para registrar venda.');
      return;
    }
    if (!quickForm.value || !quickForm.customer_name) return;
    setIsSubmitting(true);

    try {
      const defaultFranchiseId = availableFranchises.length === 1
        ? availableFranchises[0].evolution_instance_id
        : availableFranchises[0]?.evolution_instance_id || '';

      await Sale.create({
        franchise_id: defaultFranchiseId,
        customer_name: quickForm.customer_name,
        value: parseFloat(quickForm.value),
        contact_phone: quickForm.contact_phone || '',
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        source: 'whatsapp'
      });

      toast.success("Venda registrada com sucesso!");
      setShowQuickSale(false);
      setQuickForm({ value: '', customer_name: '', contact_phone: '' });
      loadData();
    } catch (error) {
      console.error("Erro ao registrar venda rápida:", error);
      toast.error("Erro ao registrar venda. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteSale = async () => {
    if (!editingSale) return;

    setIsSubmitting(true);
    try {
      await Sale.delete(editingSale.id);
      setShowForm(false);
      toast.success("Venda excluída.");
      loadData();
    } catch (error) {
      console.error("Erro ao deletar venda:", error);
      toast.error("Erro ao deletar venda. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  // Inline edit handler
  const handleInlineUpdate = async (saleId, field, value) => {
    try {
      await Sale.update(saleId, { [field]: value });
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, [field]: value } : s));
      computeMonthStats(sales.map(s => s.id === saleId ? { ...s, [field]: value } : s));
      toast.success("Atualizado!");
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar.");
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
      sale.sale_date?.substring(0, 10) === filterDate;

    return matchesSearch && matchesFranchise && matchesDate;
  });

  const getSourceBadge = (source) => {
    const colors = {
      whatsapp: 'bg-[#b91c1c]/10 text-[#b91c1c]',
      phone_call: 'bg-[#775a19]/10 text-[#775a19]',
      in_person: 'bg-[#534343]/10 text-[#534343]',
      website: 'bg-[#d4af37]/15 text-[#775a19]',
      other: 'bg-[#e9e8e9] text-[#534343]'
    };

    const labels = {
      whatsapp: 'WhatsApp',
      phone_call: 'Telefone',
      in_person: 'Presencial',
      website: 'Site',
      other: 'Outro'
    };

    return (
      <Badge className={`${colors[source] || colors.other} rounded-full px-2 py-0.5 text-[10px] font-bold`}>
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
    : franchises.filter(f =>
        currentUser?.managed_franchise_ids?.includes(f.id) ||
        currentUser?.managed_franchise_ids?.includes(f.evolution_instance_id)
      );

  const goalTarget = salesGoal?.target_value || 0;
  const goalProgress = goalTarget > 0 ? Math.min((monthStats.revenue / goalTarget) * 100, 100) : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header com botões */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1b1c1d] font-plus-jakarta flex items-center gap-3">
              <MaterialIcon icon="attach_money" size={32} className="text-[#b91c1c]" />
              Gerenciar Vendas
            </h1>
            <p className="text-[#534343] mt-1">Visualize, confirme e edite as vendas registradas</p>
          </div>

          {availableFranchises.length > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setQuickForm({ value: '', customer_name: '', contact_phone: '' });
                  setShowQuickSale(true);
                }}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg shadow-[#b91c1c]/20 text-base px-6 py-5"
              >
                <MaterialIcon icon="bolt" size={20} className="mr-2" />
                Venda Rápida
              </Button>
              <Button onClick={handleNewSale} variant="outline" className="border-[#b91c1c] text-[#b91c1c] rounded-xl hover:bg-[#b91c1c]/5">
                <MaterialIcon icon="add" size={18} className="mr-2" />
                Nova Venda
              </Button>
            </div>
          )}
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">Vendas do Mês</span>
                <MaterialIcon icon="shopping_cart" size={20} className="text-[#775a19]" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#1b1c1d]">{monthStats.count}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">Receita do Mês</span>
                <MaterialIcon icon="attach_money" size={20} className="text-[#b91c1c]" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#1b1c1d]">{formatCurrency(monthStats.revenue)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">Valor Médio</span>
                <MaterialIcon icon="trending_up" size={20} className="text-[#d4af37]" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#1b1c1d]">{formatCurrency(monthStats.average)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">Meta</span>
                <MaterialIcon icon="flag" size={20} className="text-[#9c4143]" />
              </div>
              {goalTarget > 0 ? (
                <>
                  <p className="text-lg font-bold text-[#1b1c1d] mb-2">
                    {formatCurrency(monthStats.revenue)}{' '}
                    <span className="text-sm font-normal text-[#534343]">/ {formatCurrency(goalTarget)}</span>
                  </p>
                  <Progress value={goalProgress} className="h-2.5" />
                  <p className="text-xs text-[#534343] mt-1">{goalProgress.toFixed(0)}% da meta</p>
                </>
              ) : (
                <p className="text-sm text-[#4a3d3d]/60 mt-1">Nenhuma meta definida</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <MaterialIcon icon="search" size={18} className="absolute left-3 top-3 text-[#4a3d3d]/50" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                />
              </div>

              {(availableFranchises.length > 1 || currentUser?.role === 'admin') && (
                <Select value={filterFranchise} onValueChange={setFilterFranchise}>
                  <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
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
              )}

              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filtrar por data"
                className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
              />

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterFranchise('all');
                  setFilterDate('');
                }}
                className="border-[#cac0c0] text-[#534343] rounded-xl hover:bg-[#f5f3f4]"
              >
                <MaterialIcon icon="filter_list_off" size={18} className="mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Vendas */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse bg-white rounded-2xl shadow-sm border border-[#291715]/5">
                <CardContent className="p-6">
                  <div className="h-4 bg-[#e9e8e9] rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-[#e9e8e9] rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSales.map((sale) => (
              <Card key={sale.id} className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-[#1b1c1d]">
                          <InlineEdit
                            value={sale.customer_name || 'Cliente não informado'}
                            onSave={(val) => handleInlineUpdate(sale.id, 'customer_name', val)}
                          />
                        </h3>
                        <Badge className="bg-[#b91c1c]/10 text-[#b91c1c] rounded-full px-2 py-0.5 text-[10px] font-bold">
                          <InlineEdit
                            value={sale.value || 0}
                            type="number"
                            onSave={(val) => handleInlineUpdate(sale.id, 'value', val)}
                            formatDisplay={(v) => `R$ ${(v || 0).toFixed(2)}`}
                          />
                        </Badge>
                        {getSourceBadge(sale.source)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[#4a3d3d]">
                        <div>
                          <span className="font-medium text-[#1b1c1d]">Telefone:</span> {sale.contact_phone}
                        </div>
                        <div>
                          <span className="font-medium text-[#1b1c1d]">Franquia:</span> {getFranchiseName(sale.franchise_id)}
                        </div>
                        <div>
                          <span className="font-medium text-[#1b1c1d]">Data:</span> {formatDateSafe(sale.sale_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <LeadAnalysisModal sale={sale} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSale(sale)}
                        className="border-[#cac0c0] text-[#534343] rounded-xl hover:bg-[#f5f3f4]"
                      >
                        <MaterialIcon icon="edit" size={16} className="mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredSales.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <MaterialIcon icon="attach_money" size={64} className="text-[#cac0c0] mx-auto mb-4 block" />
                <h3 className="text-xl font-semibold text-[#1b1c1d] mb-2 font-plus-jakarta">
                  Nenhuma venda encontrada
                </h3>
                <p className="text-[#534343]">
                  {sales.length === 0
                    ? 'Ainda não há vendas registradas.'
                    : 'Tente ajustar os filtros de busca.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal Venda Rápida */}
        <Dialog open={showQuickSale} onOpenChange={setShowQuickSale}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#b91c1c] font-plus-jakarta">
                <MaterialIcon icon="bolt" size={20} />
                Venda Rápida
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleQuickSaleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="quick_value" className="text-base text-[#1b1c1d]">Valor (R$) *</Label>
                <Input
                  id="quick_value"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={quickForm.value}
                  onChange={(e) => setQuickForm({ ...quickForm, value: e.target.value })}
                  className="text-lg h-12 mt-1 bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                  required
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="quick_customer" className="text-base text-[#1b1c1d]">Nome do Cliente *</Label>
                <Input
                  id="quick_customer"
                  placeholder="Nome do cliente"
                  value={quickForm.customer_name}
                  onChange={(e) => setQuickForm({ ...quickForm, customer_name: e.target.value })}
                  className="h-12 mt-1 bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                  required
                />
              </div>

              <div>
                <Label htmlFor="quick_phone" className="text-base text-[#1b1c1d]">Telefone <span className="text-[#4a3d3d]/60 text-sm">(opcional)</span></Label>
                <Input
                  id="quick_phone"
                  placeholder="(11) 99999-9999"
                  value={quickForm.contact_phone}
                  onChange={(e) => setQuickForm({ ...quickForm, contact_phone: e.target.value })}
                  className="h-12 mt-1 bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !quickForm.value || !quickForm.customer_name}
                className="w-full bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl text-lg h-14 shadow-lg shadow-[#b91c1c]/20"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal do Formulário Completo */}
        {showForm && (
          <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
            <DialogContent className="max-w-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between font-plus-jakarta text-[#1b1c1d]">
                  <span>{editingSale ? 'Editar Venda' : 'Nova Venda'}</span>
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="franchise_id" className="text-[#1b1c1d]">Franquia *</Label>
                    <Select
                      value={formData.franchise_id || undefined}
                      onValueChange={(value) => setFormData({...formData, franchise_id: value})}
                    >
                      <SelectTrigger id="franchise_id" className="bg-[#e9e8e9] border-none rounded-xl">
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
                    <Label htmlFor="value" className="text-[#1b1c1d]">Valor da Venda *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      required
                      className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_name" className="text-[#1b1c1d]">Nome do Cliente</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact_phone" className="text-[#1b1c1d]">Telefone</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                      className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sale_date" className="text-[#1b1c1d]">Data da Venda *</Label>
                    <Input
                      id="sale_date"
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) => setFormData({...formData, sale_date: e.target.value})}
                      required
                      className="bg-[#e9e8e9] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#b91c1c]/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="source" className="text-[#1b1c1d]">Canal de Venda</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({...formData, source: value})}
                    >
                      <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
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
                        className="rounded-xl"
                      >
                        <MaterialIcon icon="delete" size={16} className="mr-2" />
                        Excluir
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-[#cac0c0] text-[#534343] rounded-xl hover:bg-[#f5f3f4]">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl">
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
