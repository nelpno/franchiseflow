import React, { useState, useEffect } from "react";
import { Franchise, DailyUniqueContact, User, FranchiseInvite } from "@/entities/all";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Phone, User as UserIcon, Activity, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FranchiseForm from "@/components/franchises/FranchiseForm";


export default function Franchises() {
  const [franchises, setFranchises] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadFranchises();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Erro ao carregar usuário atual:", error);
      setCurrentUser(null);
    }
  };

  const loadFranchises = async () => {
    setIsLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const [franchisesData, dailyContactsToday] = await Promise.all([
        Franchise.list(),
        DailyUniqueContact.filter({ date: todayStr })
      ]);

      const franchisesWithContacts = franchisesData.map(f => ({
        ...f,
        daily_unique_contacts: dailyContactsToday.filter(c => c.franchise_id === f.evolution_instance_id).length
      }));

      setFranchises(franchisesWithContacts);
    } catch (error) {
      console.error("Erro ao carregar franquias:", error);
      setFranchises([]);
    }
    setIsLoading(false);
  };

  const handleCreateFranchise = async (franchiseData, franchiseeEmail) => {
    if (currentUser?.role !== 'admin') {
      toast.error("Apenas administradores podem criar novas franquias.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Criar franquia (triggers auto-geram instance_id, config e estoque)
      const newFranchise = await Franchise.create({
        ...franchiseData,
        name: franchiseData.name || `MaxiMassas ${franchiseData.city}`
      });

      // 2. Se email fornecido, registrar convite
      if (franchiseeEmail) {
        try {
          await FranchiseInvite.create({
            franchise_id: newFranchise.evolution_instance_id,
            email: franchiseeEmail,
            status: 'pending'
          });
          toast.success(`Franquia criada! Convite enviado para ${franchiseeEmail}`);
        } catch (inviteError) {
          console.error("Erro ao criar convite:", inviteError);
          toast.success("Franquia criada! (convite não pôde ser enviado)");
        }
      } else {
        toast.success("Franquia criada com sucesso!");
      }

      setShowForm(false);
      loadFranchises();
    } catch (error) {
      console.error("Erro ao criar franquia:", error);
      toast.error("Erro ao criar franquia. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteFranchise = async (franchiseId, franchiseCity) => {
    if (currentUser?.role !== 'admin') {
      toast.error("Apenas administradores podem excluir franquias.");
      return;
    }

    if (window.confirm(`Tem certeza que deseja excluir a franquia de ${franchiseCity}? Esta ação não pode ser desfeita.`)) {
      try {
        await Franchise.delete(franchiseId);
        loadFranchises();
      } catch (error) {
        console.error("Erro ao excluir franquia:", error);
        toast.error("Erro ao excluir franquia. Verifique se você tem permissão.");
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800'; 
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'inactive': return 'Inativa';
      case 'suspended': return 'Suspensa';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-emerald-50 to-teal-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Franqueados MaxiMassas</h1>
            <p className="text-slate-600 mt-1">Gerencie todas as suas franquias</p>
          </div>
          {currentUser?.role === 'admin' && (
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Franquia
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            franchises.map((franchise) => (
              <Card key={franchise.id} className="bg-white/80 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold text-slate-900">
                      {franchise.city}
                    </CardTitle>
                    <Badge className={getStatusColor(franchise.status)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {getStatusText(franchise.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <UserIcon className="w-4 h-4" />
                    <span className="text-sm">{franchise.owner_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{franchise.city}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">{franchise.phone_number}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">Contatos Hoje: {franchise.daily_unique_contacts}</span>
                  </div>
                  
                  {currentUser?.role === 'admin' && (
                    <div className="pt-3 border-t border-slate-200 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFranchise(franchise.id, franchise.city);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Franquia
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {!isLoading && franchises.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserIcon className="w-12 h-12 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhuma franquia cadastrada</h3>
            {currentUser?.role === 'admin' && (
              <>
                <p className="text-slate-600 mb-6">Comece adicionando sua primeira franquia ao sistema</p>
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Franquia
                </Button>
              </>
            )}
            {currentUser?.role !== 'admin' && (
              <p className="text-slate-600 mb-6">Contate um administrador para adicionar novas franquias.</p>
            )}
          </div>
        )}

        {/* Modal do Formulário */}
        {showForm && currentUser?.role === 'admin' && (
          <FranchiseForm
            onSubmit={handleCreateFranchise}
            onCancel={() => setShowForm(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}