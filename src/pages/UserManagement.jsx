import React, { useState, useEffect } from "react";
import { User, Franchise } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedFranchiseIds, setSelectedFranchiseIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, franchisesData, currentUserData] = await Promise.all([
        User.list(),
        Franchise.list(),
        User.me()
      ]);

      // Verificar se o usuário atual é admin
      if (currentUserData?.role !== 'admin') {
        toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
        return;
      }

      setUsers(usersData);
      setFranchises(franchisesData);
      setCurrentUser(currentUserData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setSelectedFranchiseIds(user.managed_franchise_ids || []);
  };

  const handleFranchiseToggle = (franchiseId) => {
    setSelectedFranchiseIds(prev => 
      prev.includes(franchiseId)
        ? prev.filter(id => id !== franchiseId)
        : [...prev, franchiseId]
    );
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${user.full_name}"? Esta ação não pode ser desfeita.`)) return;
    await User.delete(user.id);
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      await User.update(editingUser.id, {
        managed_franchise_ids: selectedFranchiseIds
      });
      
      // Atualizar a lista local
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { ...u, managed_franchise_ids: selectedFranchiseIds }
          : u
      ));
      
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast.error("Erro ao salvar permissões. Tente novamente.");
    }
    setIsSaving(false);
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="text-[#534343] mt-2">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-3">
            <MaterialIcon icon="how_to_reg" size={32} className="text-[#b91c1c]" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-[#4a3d3d] mt-1">Defina quais franquias cada usuário pode gerenciar</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {users.map((user) => (
              <Card key={user.id} className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[#1b1c1d]">{user.full_name}</h3>
                        <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                          {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </div>
                      <p className="text-[#534343] text-sm mb-3">{user.email}</p>
                      
                      <div>
                        <p className="text-sm font-medium text-[#4a3d3d] mb-2">Franquias permitidas:</p>
                        {user.managed_franchise_ids && user.managed_franchise_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {user.managed_franchise_ids.map((franchiseId) => {
                              const franchise = franchises.find(f => f.evolution_instance_id === franchiseId);
                              return (
                                <Badge key={franchiseId} variant="outline" className="bg-[#b91c1c]/10 text-[#b91c1c]">
                                  {franchise?.city || franchiseId}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[#534343] text-sm">Nenhuma franquia atribuída</p>
                        )}
                      </div>
                    </div>
                    
                    {user.role !== 'admin' && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          onClick={() => handleEditUser(user)}
                          variant="outline"
                          size="sm"
                        >
                          <MaterialIcon icon="settings" size={16} className="mr-2" />
                          Editar Permissões
                        </Button>
                        <Button
                          onClick={() => handleDeleteUser(user)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <MaterialIcon icon="delete" size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Edição */}
        {editingUser && (
          <Dialog open={true} onOpenChange={() => setEditingUser(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MaterialIcon icon="settings" size={20} />
                  Editar Permissões - {editingUser.full_name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-4">
                <p className="text-sm text-[#534343] mb-4">
                  Selecione quais franquias este usuário pode gerenciar:
                </p>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {franchises.map((franchise) => (
                    <div key={franchise.id} className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50">
                      <Checkbox
                        id={`franchise-${franchise.id}`}
                        checked={selectedFranchiseIds.includes(franchise.evolution_instance_id)}
                        onCheckedChange={() => handleFranchiseToggle(franchise.evolution_instance_id)}
                      />
                      <label 
                        htmlFor={`franchise-${franchise.id}`}
                        className="flex-1 text-sm font-medium cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold">{franchise.city}</p>
                          <p className="text-[#534343] text-xs">{franchise.owner_name}</p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  <MaterialIcon icon="close" size={16} className="mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSavePermissions} disabled={isSaving}>
                  <MaterialIcon icon="save" size={16} className="mr-2" />
                  {isSaving ? 'Salvando...' : 'Salvar Permissões'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}