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
import { Plus, Edit, DollarSign, Search, Filter, Trash2, Zap, TrendingUp, Target, ShoppingCart } from "lucide-react";
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
        className="h-7 w-auto min-w-[80px] max-w-[200px] text-sm"
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(value); setEditing(true); }}
      className="cursor-pointer hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-300 rounded px-1 py-0.5 transition-all"
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
    }
    setIsLoading(false);
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

    if (window.confirm('Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.')) {
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
    }
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
    : franchises;

  const goalTarget = salesGoal?.target_value || 0;
  const goalProgress = goalTarget > 0 ? Math.min((monthStats.revenue / goalTarget) * 100, 100) : 0;

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header com botões */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              Gerenciar Vendas
            </h1>
            <p className="text-slate-600 mt-1">Visualize, confirme e edite as vendas registradas</p>
          </div>

          {availableFranchises.length > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setQuickForm({ value: '', customer_name: '', contact_phone: '' });
                  setShowQuickSale(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 text-base px-6 py-5"
              >
                <Zap className="w-5 h-5 mr-2" />
                Venda Rápida
              </Button>
              <Button onClick={handleNewSale} variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                <Plus className="w-4 h-4 mr-2" />
                Nova Venda
              </Button>
            </div>
          )}
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500">Vendas do Mês</span>
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{monthStats.count}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500">Receita do Mês</span>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatCurrency(monthStats.revenue)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500">Ticket Médio</span>
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatCurrency(monthStats.average)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500">Meta</span>
                <Target className="w-5 h-5 text-purple-500" />
              </div>
              {goalTarget > 0 ? (
                <>
                  <p className="text-lg font-bold text-slate-900 mb-2">
                    {formatCurrency(monthStats.revenue)}{' '}
                    <span className="text-sm font-normal text-slate-500">/ {formatCurrency(goalTarget)}</span>
                  </p>
                  <Progress value={goalProgress} className="h-2.5" />
                  <p className="text-xs text-slate-500 mt-1">{goalProgress.toFixed(0)}% da meta</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 mt-1">Nenhuma meta definida</p>
              )}
            </CardContent>
          </Card>
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
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-900">
                          <InlineEdit
                            value={sale.customer_name || 'Cliente não informado'}
                            onSave={(val) => handleInlineUpdate(sale.id, 'customer_name', val)}
                          />
                        </h3>
                        <Badge className="bg-green-100 text-green-800">
                          <InlineEdit
                            value={sale.value || 0}
                            type="number"
                            onSave={(val) => handleInlineUpdate(sale.id, 'value', val)}
                            formatDisplay={(v) => `R$ ${(v || 0).toFixed(2)}`}
                          />
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

        {/* Modal Venda Rápida */}
        <Dialog open={showQuickSale} onOpenChange={setShowQuickSale}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <Zap className="w-5 h-5" />
                Venda Rápida
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleQuickSaleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="quick_value" className="text-base">Valor (R$) *</Label>
                <Input
                  id="quick_value"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={quickForm.value}
                  onChange={(e) => setQuickForm({ ...quickForm, value: e.target.value })}
                  className="text-lg h-12 mt-1"
                  required
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="quick_customer" className="text-base">Nome do Cliente *</Label>
                <Input
                  id="quick_customer"
                  placeholder="Nome do cliente"
                  value={quickForm.customer_name}
                  onChange={(e) => setQuickForm({ ...quickForm, customer_name: e.target.value })}
                  className="h-12 mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="quick_phone" className="text-base">Telefone <span className="text-slate-400 text-sm">(opcional)</span></Label>
                <Input
                  id="quick_phone"
                  placeholder="(11) 99999-9999"
                  value={quickForm.contact_phone}
                  onChange={(e) => setQuickForm({ ...quickForm, contact_phone: e.target.value })}
                  className="h-12 mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !quickForm.value || !quickForm.customer_name}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg h-14 shadow-lg"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal do Formulário Completo */}
        {showForm && (
          <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{editingSale ? 'Editar Venda' : 'Nova Venda'}</span>
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="franchise_id">Franquia *</Label>
                    <Select
                      value={formData.franchise_id || undefined}
                      onValueChange={(value) => setFormData({...formData, franchise_id: value})}
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
