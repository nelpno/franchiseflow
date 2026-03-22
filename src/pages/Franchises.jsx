import React, { useState, useEffect } from "react";
import { Franchise, DailyUniqueContact, User, FranchiseInvite } from "@/entities/all";
import { inviteFranchisee } from "@/api/functions";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import FranchiseForm from "@/components/franchises/FranchiseForm";


export default function Franchises() {
  const [franchises, setFranchises] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Equipe section
  const [equipeOpen, setEquipeOpen] = useState(false);
  const [editingStaffRole, setEditingStaffRole] = useState(null); // { userId, currentRole }
  const [staffNewRole, setStaffNewRole] = useState("");
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [addStaffEmail, setAddStaffEmail] = useState("");
  const [addStaffRole, setAddStaffRole] = useState("manager");

  // Permissions dialog
  const [editingPermissions, setEditingPermissions] = useState(null); // franchise object
  const [selectedUserIds, setSelectedUserIds] = useState({}); // { userId: [franchiseIds] }
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Invite
  const [invitingFranchise, setInvitingFranchise] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Detail sheet
  const [selectedFranchise, setSelectedFranchise] = useState(null);

  // Delete franchise confirmation
  const [deletingFranchise, setDeletingFranchise] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const [franchisesData, dailyContactsToday, usersData, currentUserData] = await Promise.all([
        Franchise.list(),
        DailyUniqueContact.filter({ date: todayStr }),
        User.list(),
        User.me(),
      ]);

      const franchisesWithContacts = franchisesData.map((f) => ({
        ...f,
        daily_unique_contacts: dailyContactsToday.filter(
          (c) => c.franchise_id === f.evolution_instance_id
        ).length,
      }));

      setFranchises(franchisesWithContacts);
      setUsers(usersData);
      setCurrentUser(currentUserData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados das franquias.");
      setFranchises([]);
      setUsers([]);
    }
    setIsLoading(false);
  };

  // --- Franchise CRUD ---

  const isStaff = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleCreateFranchise = async (franchiseData, franchiseeEmail) => {
    if (!isStaff) {
      toast.error("Apenas a equipe pode criar novas franquias.");
      return;
    }
    setIsSubmitting(true);
    try {
      const newFranchise = await Franchise.create({
        ...franchiseData,
        name: franchiseData.name || `MaxiMassas ${franchiseData.city}`,
      });

      if (franchiseeEmail) {
        try {
          await FranchiseInvite.create({
            franchise_id: newFranchise.evolution_instance_id,
            email: franchiseeEmail,
            status: "pending",
          });
          await inviteFranchisee(franchiseeEmail);
          toast.success(`Franquia criada! Convite enviado para ${franchiseeEmail}`);
        } catch (inviteError) {
          console.error("Erro ao criar convite:", inviteError);
          toast.success("Franquia criada! (convite não pode ser enviado)");
        }
      } else {
        toast.success("Franquia criada com sucesso!");
      }

      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Erro ao criar franquia:", error);
      toast.error("Erro ao criar franquia. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteFranchise = async () => {
    if (!deletingFranchise) return;
    try {
      await Franchise.deleteCascade(deletingFranchise.id, deletingFranchise.evolution_instance_id);
      toast.success(`Franquia ${deletingFranchise.city} excluída com sucesso.`);
      setDeletingFranchise(null);
      setSelectedFranchise(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir franquia:", error);
      toast.error("Erro ao excluir franquia. Verifique se você tem permissão.");
    }
  };

  // --- Staff (Equipe) ---

  const staffUsers = users.filter((u) => u.role === "admin" || u.role === "manager");
  const franchiseeUsers = users.filter((u) => u.role === "franchisee" || (!u.role));

  const handleUpdateStaffRole = async () => {
    if (!editingStaffRole || !staffNewRole) return;
    try {
      await User.update(editingStaffRole.userId, { role: staffNewRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === editingStaffRole.userId ? { ...u, role: staffNewRole } : u))
      );
      toast.success("Cargo atualizado!");
      setEditingStaffRole(null);
      setStaffNewRole("");
    } catch (error) {
      console.error("Erro ao atualizar cargo:", error);
      toast.error("Erro ao atualizar cargo.");
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      await User.delete(deletingStaff.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingStaff.id));
      toast.success("Usuário removido.");
      setDeletingStaff(null);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast.error("Erro ao excluir usuário.");
    }
  };

  const handleAddStaff = async () => {
    if (!addStaffEmail) return;
    try {
      // Procurar usuário existente pelo email
      const existingUser = users.find((u) => u.email === addStaffEmail);
      if (existingUser) {
        await User.update(existingUser.id, { role: addStaffRole });
        toast.success(`${existingUser.full_name || addStaffEmail} agora é ${addStaffRole === "admin" ? "Admin" : "Gerente"}`);
      } else {
        toast.error("Usuário não encontrado. Ele precisa criar conta primeiro.");
        return;
      }
      setShowAddStaff(false);
      setAddStaffEmail("");
      setAddStaffRole("manager");
      loadData();
    } catch (error) {
      console.error("Erro ao adicionar membro:", error);
      toast.error("Erro ao adicionar membro à equipe.");
    }
  };

  const handleUnlinkUser = async (user, franchise) => {
    try {
      const currentIds = user.managed_franchise_ids || [];
      const newIds = currentIds.filter(
        (id) => id !== franchise.id && id !== franchise.evolution_instance_id
      );
      await User.update(user.id, { managed_franchise_ids: newIds });
      toast.success(`${user.full_name || user.email} desvinculado de ${franchise.city}`);
      loadData();
    } catch (error) {
      console.error("Erro ao desvincular:", error);
      toast.error("Erro ao desvincular usuário.");
    }
  };

  const handleDeleteFranchiseQuick = (e, franchise) => {
    e.stopPropagation();
    setDeletingFranchise(franchise);
  };

  // --- Permissions ---

  const getLinkedUsers = (franchise) => {
    return users.filter((u) => {
      const ids = u.managed_franchise_ids || [];
      return ids.includes(franchise.id) || ids.includes(franchise.evolution_instance_id);
    });
  };

  const openPermissionsDialog = (franchise) => {
    setEditingPermissions(franchise);
    // Build initial state: which users have this franchise in their managed_franchise_ids
    const initial = {};
    users.forEach((u) => {
      if (u.role === "admin") return; // admins see everything
      const ids = u.managed_franchise_ids || [];
      const hasAccess = ids.includes(franchise.id) || ids.includes(franchise.evolution_instance_id);
      if (hasAccess) {
        initial[u.id] = true;
      }
    });
    setSelectedUserIds(initial);
  };

  const handleToggleUserPermission = (userId) => {
    setSelectedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions) return;
    setIsSavingPermissions(true);
    try {
      const franchiseInstanceId = editingPermissions.evolution_instance_id;

      // For each non-admin user, update their managed_franchise_ids
      for (const user of users) {
        if (user.role === "admin") continue;

        const currentIds = user.managed_franchise_ids || [];
        const hasAccess =
          currentIds.includes(editingPermissions.id) ||
          currentIds.includes(franchiseInstanceId);
        const shouldHaveAccess = !!selectedUserIds[user.id];

        if (hasAccess && !shouldHaveAccess) {
          // Remove access
          const newIds = currentIds.filter(
            (id) => id !== editingPermissions.id && id !== franchiseInstanceId
          );
          await User.update(user.id, { managed_franchise_ids: newIds });
        } else if (!hasAccess && shouldHaveAccess) {
          // Add access (use evolution_instance_id)
          const newIds = [...currentIds, franchiseInstanceId];
          await User.update(user.id, { managed_franchise_ids: newIds });
        }
      }

      toast.success("Permissões atualizadas!");
      setEditingPermissions(null);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast.error("Erro ao salvar permissões.");
    }
    setIsSavingPermissions(false);
  };

  // --- Invite ---

  const handleSendInvite = async () => {
    if (!invitingFranchise || !inviteEmail) return;
    setIsSendingInvite(true);
    try {
      await FranchiseInvite.create({
        franchise_id: invitingFranchise.evolution_instance_id,
        email: inviteEmail,
        status: "pending",
      });
      await inviteFranchisee(inviteEmail);
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInvitingFranchise(null);
      setInviteEmail("");
    } catch (error) {
      console.error("Erro ao enviar convite:", error);
      toast.error("Erro ao enviar convite.");
    }
    setIsSendingInvite(false);
  };

  // --- Helpers ---

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-[#b91c1c]/10 text-[#b91c1c]";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "inactive":
        return "Inativa";
      case "suspended":
        return "Suspensa";
      default:
        return "Desconhecido";
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#a80012]/10 text-[#a80012]">
            Admin
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#d4af37]/15 text-[#8a7023]">
            Gerente
          </span>
        );
      case "franchisee":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#b91c1c]/10 text-[#b91c1c]">
            Franqueado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600">
            {role || "Sem role"}
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-plus-jakarta text-[#1b1c1d]">Franqueados</h1>
            <p className="text-sm sm:text-base text-[#4a3d3d] mt-1">Gerencie franquias, equipe e permissões</p>
          </div>
          {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 self-start sm:self-auto"
            >
              <MaterialIcon icon="add" size={16} className="mr-2" />
              Nova Franquia
            </Button>
          )}
        </div>

        {/* Equipe Section (Collapsible) */}
        {isStaff && !isLoading && (
          <Collapsible open={equipeOpen} onOpenChange={setEquipeOpen} className="mb-8">
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CollapsibleTrigger asChild>
                <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#fbf9fa]/50 transition-colors rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#d4af37]/15 rounded-lg flex items-center justify-center">
                      <MaterialIcon icon="shield_person" size={18} className="text-[#8a7023]" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-base font-bold font-plus-jakarta text-[#1b1c1d]">
                        Equipe
                      </h2>
                      <p className="text-xs text-[#534343]">
                        {staffUsers.length} {staffUsers.length === 1 ? "membro" : "membros"} (admins e gerentes)
                      </p>
                    </div>
                  </div>
                  <MaterialIcon
                    icon={equipeOpen ? "expand_less" : "expand_more"}
                    size={20}
                    className="text-[#534343]"
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-6 pb-5 border-t border-[#291715]/5">
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-end mb-2">
                      <Button
                        size="sm"
                        className="bg-[#d4af37] hover:bg-[#b8941f] text-white font-bold rounded-xl text-xs h-8"
                        onClick={() => setShowAddStaff(true)}
                      >
                        <MaterialIcon icon="person_add" size={14} className="mr-1" />
                        Adicionar Membro
                      </Button>
                    </div>
                    {staffUsers.length === 0 ? (
                      <p className="text-sm text-[#534343] py-4 text-center">Nenhum membro na equipe</p>
                    ) : (
                      staffUsers.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#705d00] flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {staff.full_name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-[#1b1c1d] truncate">
                                  {staff.full_name || "Sem nome"}
                                </p>
                                {getRoleBadge(staff.role)}
                              </div>
                              <p className="text-xs text-[#534343] truncate">{staff.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-3 shrink-0">
                            {staff.id !== currentUser?.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-[#534343] hover:text-[#1b1c1d] hover:bg-white"
                                  onClick={() => {
                                    setEditingStaffRole({ userId: staff.id, currentRole: staff.role });
                                    setStaffNewRole(staff.role);
                                  }}
                                  title="Editar cargo"
                                >
                                  <MaterialIcon icon="edit" size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setDeletingStaff(staff)}
                                  title="Remover"
                                >
                                  <MaterialIcon icon="delete" size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Franchise Cards Grid */}
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
            franchises.map((franchise) => {
              const linked = getLinkedUsers(franchise);
              return (
                <Card
                  key={franchise.id}
                  className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedFranchise(franchise)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold font-plus-jakarta text-[#1b1c1d]">
                        {franchise.city}
                      </CardTitle>
                      <Badge className={getStatusColor(franchise.status)}>
                        <MaterialIcon icon="monitoring" size={12} className="mr-1" />
                        {getStatusText(franchise.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="person" size={16} />
                      <span className="text-sm">{franchise.owner_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="phone" size={16} />
                      <span className="text-sm">{franchise.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="chat_bubble" size={16} />
                      <span className="text-sm">Contatos Hoje: {franchise.daily_unique_contacts}</span>
                    </div>

                    {/* Linked Users */}
                    <div className="pt-3 border-t border-[#291715]/5">
                      {linked.length > 0 ? (
                        <div className="space-y-2">
                          {linked.map((u) => (
                            <div key={u.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <MaterialIcon icon="account_circle" size={14} className="text-[#534343]" />
                                <span className="text-xs text-[#534343] truncate">{u.email}</span>
                                {getRoleBadge(u.role)}
                              </div>
                              {currentUser?.role === "admin" && u.role === "franchisee" && (
                                <button
                                  className="text-[#cac0c0] hover:text-[#b91c1c] transition-colors ml-2 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlinkUser(u, franchise);
                                  }}
                                  title="Desvincular"
                                >
                                  <MaterialIcon icon="link_off" size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#d4af37]">
                          <MaterialIcon icon="warning" size={14} />
                          <span className="text-xs font-medium">Sem usuário vinculado</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {isStaff && (
                      <div className="pt-3 border-t border-[#291715]/5 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 rounded-lg border-[#291715]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvitingFranchise(franchise);
                            setInviteEmail("");
                          }}
                        >
                          <MaterialIcon icon="mail" size={14} className="mr-1" />
                          Convidar
                        </Button>
                        {currentUser?.role === "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 rounded-lg text-[#b91c1c] hover:bg-[#b91c1c]/10"
                            onClick={(e) => handleDeleteFranchiseQuick(e, franchise)}
                          >
                            <MaterialIcon icon="delete" size={14} />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Empty state */}
        {!isLoading && franchises.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-[#b91c1c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <MaterialIcon icon="store" size={48} className="text-[#b91c1c]/40" />
            </div>
            <h3 className="text-xl font-semibold text-[#1b1c1d] mb-2">Nenhuma franquia cadastrada</h3>
            {isStaff ? (
              <>
                <p className="text-[#534343] mb-6">Comece adicionando sua primeira franquia ao sistema</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
                >
                  <MaterialIcon icon="add" size={16} className="mr-2" />
                  Adicionar Franquia
                </Button>
              </>
            ) : (
              <p className="text-[#534343] mb-6">Contate um administrador para adicionar novas franquias.</p>
            )}
          </div>
        )}

        {/* ===== DIALOGS & SHEETS ===== */}

        {/* New Franchise Form Modal */}
        {showForm && isStaff && (
          <FranchiseForm
            onSubmit={handleCreateFranchise}
            onCancel={() => setShowForm(false)}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Edit Staff Role Dialog */}
        <Dialog
          open={!!editingStaffRole}
          onOpenChange={(open) => {
            if (!open) {
              setEditingStaffRole(null);
              setStaffNewRole("");
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
                <MaterialIcon icon="edit" size={20} />
                Alterar Cargo
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#4a3d3d]">Novo cargo</Label>
                <Select value={staffNewRole} onValueChange={setStaffNewRole}>
                  <SelectTrigger className="bg-[#e9e8e9] border-none rounded-xl">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingStaffRole(null);
                    setStaffNewRole("");
                  }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateStaffRole}
                  disabled={!staffNewRole}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Staff Confirmation Dialog */}
        <Dialog
          open={!!deletingStaff}
          onOpenChange={(open) => {
            if (!open) setDeletingStaff(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-red-600">
                <MaterialIcon icon="warning" size={20} />
                Confirmar Exclusão
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-[#534343]">
                Tem certeza que deseja excluir o usuário{" "}
                <strong>{deletingStaff?.full_name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeletingStaff(null)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteStaff}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                >
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Franchise Confirmation Dialog */}
        <Dialog
          open={!!deletingFranchise}
          onOpenChange={(open) => {
            if (!open) setDeletingFranchise(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-red-600">
                <MaterialIcon icon="warning" size={20} />
                Excluir Franquia
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-[#534343]">
                Tem certeza que deseja excluir a franquia de{" "}
                <strong>{deletingFranchise?.city}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeletingFranchise(null)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteFranchise}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                >
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog
          open={!!editingPermissions}
          onOpenChange={(open) => {
            if (!open) setEditingPermissions(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
                <MaterialIcon icon="settings" size={20} />
                Permissões - {editingPermissions?.city}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-[#534343] mb-4">
                Selecione quais usuários podem gerenciar esta franquia:
              </p>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {users
                  .filter((u) => u.role !== "admin")
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5"
                    >
                      <Checkbox
                        id={`perm-user-${user.id}`}
                        checked={!!selectedUserIds[user.id]}
                        onCheckedChange={() => handleToggleUserPermission(user.id)}
                      />
                      <label
                        htmlFor={`perm-user-${user.id}`}
                        className="flex-1 text-sm font-medium cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#1b1c1d]">{user.full_name || "Sem nome"}</p>
                          {getRoleBadge(user.role)}
                        </div>
                        <p className="text-[#534343] text-xs">{user.email}</p>
                      </label>
                    </div>
                  ))}
                {users.filter((u) => u.role !== "admin").length === 0 && (
                  <p className="text-sm text-[#534343] text-center py-4">
                    Nenhum usuário disponível (exceto admins)
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setEditingPermissions(null)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={isSavingPermissions}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
              >
                <MaterialIcon icon="save" size={16} className="mr-2" />
                {isSavingPermissions ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite Dialog */}
        <Dialog
          open={!!invitingFranchise}
          onOpenChange={(open) => {
            if (!open) {
              setInvitingFranchise(null);
              setInviteEmail("");
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
                <MaterialIcon icon="mail" size={20} />
                Convidar - {invitingFranchise?.city}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#4a3d3d]">Email do franqueado</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-[#e9e8e9] border-none rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setInvitingFranchise(null);
                    setInviteEmail("");
                  }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail || isSendingInvite}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
                >
                  <MaterialIcon icon="send" size={16} className="mr-2" />
                  {isSendingInvite ? "Enviando..." : "Enviar Convite"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Staff Dialog */}
        <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
                <MaterialIcon icon="person_add" size={20} className="text-[#d4af37]" />
                Adicionar Membro à Equipe
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-[#1b1c1d]">Email do usuário</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={addStaffEmail}
                  onChange={(e) => setAddStaffEmail(e.target.value)}
                  className="mt-1 bg-[#e9e8e9] border-none rounded-xl"
                />
                <p className="text-xs text-[#534343] mt-1">O usuário precisa ter conta criada no sistema</p>
              </div>
              <div>
                <Label className="text-[#1b1c1d]">Cargo</Label>
                <Select value={addStaffRole} onValueChange={setAddStaffRole}>
                  <SelectTrigger className="mt-1 bg-[#e9e8e9] border-none rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — acesso total</SelectItem>
                    <SelectItem value="manager">Gerente — visualiza tudo, sem excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddStaff(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddStaff}
                  disabled={!addStaffEmail}
                  className="bg-[#d4af37] hover:bg-[#b8941f] text-white font-bold rounded-xl"
                >
                  <MaterialIcon icon="person_add" size={16} className="mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Franchise Detail Sheet */}
        <Sheet
          open={!!selectedFranchise}
          onOpenChange={(open) => {
            if (!open) setSelectedFranchise(null);
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-white">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-2">
                <MaterialIcon icon="store" size={22} className="text-[#b91c1c]" />
                {selectedFranchise?.city}
              </SheetTitle>
              <SheetDescription className="text-[#534343]">
                Detalhes da franquia e usuários vinculados
              </SheetDescription>
            </SheetHeader>

            {selectedFranchise && (
              <div className="space-y-6">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(selectedFranchise.status)}>
                    {getStatusText(selectedFranchise.status)}
                  </Badge>
                  {selectedFranchise.evolution_instance_id && (
                    <span className="text-[10px] font-mono text-[#534343] bg-[#fbf9fa] px-2 py-0.5 rounded">
                      {selectedFranchise.evolution_instance_id}
                    </span>
                  )}
                </div>

                {/* Dados */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#534343] uppercase tracking-wider">
                    Dados da Franquia
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="person" size={16} />
                      <span className="text-sm">{selectedFranchise.owner_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="location_on" size={16} />
                      <span className="text-sm">{selectedFranchise.city}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="phone" size={16} />
                      <span className="text-sm">{selectedFranchise.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#534343]">
                      <MaterialIcon icon="chat_bubble" size={16} />
                      <span className="text-sm">
                        Contatos Hoje: {selectedFranchise.daily_unique_contacts}
                      </span>
                    </div>
                    {selectedFranchise.name && (
                      <div className="flex items-center gap-3 text-[#534343]">
                        <MaterialIcon icon="apartment" size={16} />
                        <span className="text-sm">{selectedFranchise.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Users */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#534343] uppercase tracking-wider">
                    Usuários Vinculados
                  </h3>
                  {(() => {
                    const linked = getLinkedUsers(selectedFranchise);
                    if (linked.length === 0) {
                      return (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                          <MaterialIcon icon="warning" size={16} className="text-amber-600" />
                          <span className="text-sm text-amber-700">Nenhum usuário vinculado a esta franquia</span>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {linked.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#f2e7e7] flex items-center justify-center shrink-0">
                              <MaterialIcon icon="account_circle" size={16} className="text-[#534343]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-[#1b1c1d] truncate">
                                  {u.full_name || "Sem nome"}
                                </p>
                                {getRoleBadge(u.role)}
                              </div>
                              <p className="text-xs text-[#534343] truncate">{u.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                {currentUser?.role === "admin" && (
                  <div className="space-y-3 pt-4 border-t border-[#291715]/5">
                    <Button
                      className="w-full bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
                      onClick={() => {
                        openPermissionsDialog(selectedFranchise);
                      }}
                    >
                      <MaterialIcon icon="settings" size={16} className="mr-2" />
                      Editar Permissões
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl border-[#291715]/10"
                      onClick={() => {
                        setInvitingFranchise(selectedFranchise);
                        setInviteEmail("");
                      }}
                    >
                      <MaterialIcon icon="mail" size={16} className="mr-2" />
                      Convidar Franqueado
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                      onClick={() => {
                        setDeletingFranchise(selectedFranchise);
                      }}
                    >
                      <MaterialIcon icon="delete" size={16} className="mr-2" />
                      Excluir Franquia
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
