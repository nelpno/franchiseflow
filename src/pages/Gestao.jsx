import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { User, Franchise, InventoryItem, SaleItem, Contact } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { getPrimaryFranchise } from "@/lib/franchiseUtils";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import TabEstoque from "@/components/minha-loja/TabEstoque";
import TabResultado from "@/components/minha-loja/TabResultado";
import TabReposicao from "@/components/minha-loja/TabReposicao";

const TAB_MAP = {
  resultado: "resultado",
  estoque: "estoque",
  reposicao: "reposicao",
};

export default function Gestao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedFranchise } = useAuth();
  const tabParam = searchParams.get("tab");
  const activeTab = TAB_MAP[tabParam] || "resultado";

  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Reload automático ao voltar para a aba (resolve reload manual no mobile)
  const reloadOnVisibility = useCallback(() => {
    if (!loading) loadData();
  }, [loading]);
  useVisibilityPolling(reloadOnVisibility, 300000); // 5 min

  const loadData = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setLoading(true);
      setLoadError(null);

      // Dados críticos — sem eles a página não funciona
      const [userResult, franchisesResult] = await Promise.allSettled([
        User.me({ signal }),
        Franchise.list(null, null, { signal }),
      ]);
      if (!mountedRef.current || signal.aborted) return;
      const userData = userResult.status === "fulfilled" ? userResult.value : null;
      const franchisesData = franchisesResult.status === "fulfilled" ? franchisesResult.value : [];
      if (!userData) throw new Error("Não foi possível carregar usuário");
      if (franchisesResult.status === "rejected" && !signal.aborted) {
        console.warn("Falha ao carregar franquias:", franchisesResult.reason?.message);
        toast.error(`Erro ao carregar franquias: ${franchisesResult.reason?.message || "Erro desconhecido"}`);
      }
      setCurrentUser(userData);
      setFranchises(franchisesData);

      // Dados de tabs — carregam em paralelo, falha não bloqueia a página
      const [inventoryResult, saleItemsResult] = await Promise.allSettled([
        InventoryItem.list("-updated_at", null, { signal }),
        SaleItem.list(null, null, { signal }),
      ]);
      if (!mountedRef.current || signal.aborted) return;

      if (inventoryResult.status === "fulfilled") {
        setInventoryItems(inventoryResult.value);
      } else {
        console.warn("Falha ao carregar estoque:", inventoryResult.reason?.message);
      }
      if (saleItemsResult.status === "fulfilled") {
        setSaleItems(saleItemsResult.value);
      } else {
        console.warn("Falha ao carregar itens de venda:", saleItemsResult.reason?.message);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (!mountedRef.current) return;
      console.error("Erro ao carregar dados:", error);
      const msg = error?.message || "Erro desconhecido";
      setLoadError(`Erro ao carregar dados de gestão: ${msg}`);
      toast.error(`Erro ao carregar dados de gestão: ${msg}`);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleRefreshInventory = async () => {
    try {
      const data = await InventoryItem.list("-updated_at");
      setInventoryItems(data);
    } catch (error) {
      console.error("Erro ao recarregar estoque:", error);
    }
  };

  const primaryFranchise = useMemo(() => {
    if (selectedFranchise) {
      const found = franchises.find((f) => f.id === selectedFranchise.id);
      if (found) return found;
    }
    return getPrimaryFranchise(franchises, currentUser);
  }, [franchises, currentUser, selectedFranchise]);

  const franchiseId = primaryFranchise?.evolution_instance_id;

  const franchiseInventory = useMemo(() => {
    if (!franchiseId) return [];
    return inventoryItems.filter((i) => i.franchise_id === franchiseId);
  }, [inventoryItems, franchiseId]);

  // Load contacts scoped to franchise (mesmo padrão de Vendas.jsx)
  // Necessário para resolver nome do cliente no export do TabResultado
  const loadFranchiseContacts = useCallback(async (evoId) => {
    if (!evoId) return;
    try {
      const data = await Contact.filter(
        { franchise_id: evoId },
        '-created_at',
        null,
        { columns: 'id, nome, franchise_id' }
      );
      if (mountedRef.current) setContacts(data);
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
    }
  }, []);

  useEffect(() => {
    if (franchiseId) loadFranchiseContacts(franchiseId);
  }, [franchiseId, loadFranchiseContacts]);

  const franchiseContacts = useMemo(() => {
    if (!franchiseId) return [];
    return contacts.filter((c) => c.franchise_id === franchiseId);
  }, [contacts, franchiseId]);

  if (loading) {
    return (
      <div className="bg-[#fbf9fa] p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <MaterialIcon icon="cloud_off" className="text-5xl text-[#7a6d6d]" />
        <p className="text-[#4a3d3d] text-center">{loadError}</p>
        <Button variant="outline" onClick={loadData} className="mt-2">
          <MaterialIcon icon="refresh" className="mr-2 text-lg" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (currentUser?.role === "admin" || currentUser?.role === "manager") {
    return <Navigate to="/Dashboard" replace />;
  }

  if (!primaryFranchise) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <MaterialIcon icon="bar_chart" size={48} className="text-[#cac0c0] mb-4" />
        <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
          Nenhuma franquia vinculada
        </h3>
        <p className="text-sm text-[#4a3d3d] max-w-sm">
          Sua conta ainda não está vinculada a nenhuma franquia. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#fbf9fa]">
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#775a19]/10 rounded-xl">
            <MaterialIcon icon="bar_chart" size={24} className="text-[#775a19]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">Gestão</h1>
            <p className="text-sm text-[#4a3d3d]">
              {primaryFranchise.city || primaryFranchise.name}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white border border-[#291715]/5 rounded-xl p-1 w-full md:w-auto flex">
            {[
              { value: "resultado", icon: "analytics", label: "Resultado", shortLabel: "Resultado" },
              { value: "estoque", icon: "inventory_2", label: "Estoque", shortLabel: "Estoque" },
              { value: "reposicao", icon: "local_shipping", label: "Reposição", shortLabel: "Reposição" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1 rounded-lg data-[state=active]:bg-[#b91c1c] data-[state=active]:text-white data-[state=active]:shadow-none px-2 md:px-4 flex-1 md:flex-none text-xs md:text-sm"
              >
                <MaterialIcon icon={tab.icon} size={14} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="resultado" className="mt-4">
            <TabResultado
              franchiseId={franchiseId}
              currentUser={currentUser}
              contacts={franchiseContacts}
            />
          </TabsContent>

          <TabsContent value="estoque" className="mt-4">
            <TabEstoque
              franchiseId={franchiseId}
              currentUser={currentUser}
              inventoryItems={franchiseInventory}
              saleItems={saleItems}
              franchises={franchises}
              onRefresh={handleRefreshInventory}
            />
          </TabsContent>

          <TabsContent value="reposicao" className="mt-4">
            <TabReposicao
              franchiseId={franchiseId}
              inventoryItems={franchiseInventory}
              saleItems={saleItems}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
