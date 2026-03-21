import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { User, Franchise, Sale, Expense, InventoryItem, SaleItem, Contact } from "@/entities/all";
import { getAvailableFranchises, getPrimaryFranchise } from "@/lib/franchiseUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { startOfMonth, startOfDay, endOfDay, format } from "date-fns";
import TabEstoque from "@/components/minha-loja/TabEstoque";
import TabLancar from "@/components/minha-loja/TabLancar";
import TabResultado from "@/components/minha-loja/TabResultado";

const TAB_MAP = {
  lancar: "lancar",
  resultado: "resultado",
  estoque: "estoque",
};

export default function MinhaLoja() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TAB_MAP[tabParam] || "lancar";

  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, franchisesData] = await Promise.all([
        User.me(),
        Franchise.list(),
      ]);

      setCurrentUser(userData);
      setFranchises(franchisesData);

      // Load all data in parallel
      const [salesData, expensesData, inventoryData, saleItemsData, contactsData] = await Promise.all([
        Sale.list("-created_at"),
        Expense.list("-created_at"),
        InventoryItem.list("-updated_at"),
        SaleItem.list(),
        Contact.list(),
      ]);

      setSales(salesData);
      setExpenses(expensesData);
      setInventoryItems(inventoryData);
      setSaleItems(saleItemsData);
      setContacts(contactsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados da loja.");
    } finally {
      setLoading(false);
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

  const handleRefreshSales = async () => {
    try {
      const [salesData, saleItemsData, contactsData, inventoryData] = await Promise.all([
        Sale.list("-created_at"),
        SaleItem.list(),
        Contact.list(),
        InventoryItem.list("-updated_at"),
      ]);
      setSales(salesData);
      setSaleItems(saleItemsData);
      setContacts(contactsData);
      setInventoryItems(inventoryData);
    } catch (error) {
      console.error("Erro ao recarregar vendas:", error);
    }
  };

  // --- Derived data ---

  const availableFranchises = useMemo(
    () => getAvailableFranchises(franchises, currentUser),
    [franchises, currentUser]
  );

  const primaryFranchise = useMemo(
    () => getPrimaryFranchise(franchises, currentUser),
    [franchises, currentUser]
  );

  const franchiseId = primaryFranchise?.evolution_instance_id;

  // Filter data for current franchise
  const franchiseSales = useMemo(() => {
    if (!franchiseId) return [];
    return sales.filter((s) => s.franchise_id === franchiseId);
  }, [sales, franchiseId]);

  const franchiseInventory = useMemo(() => {
    if (!franchiseId) return [];
    return inventoryItems.filter((i) => i.franchise_id === franchiseId);
  }, [inventoryItems, franchiseId]);

  const franchiseContacts = useMemo(() => {
    if (!franchiseId) return [];
    return contacts.filter((c) => c.franchise_id === franchiseId);
  }, [contacts, franchiseId]);

  // --- Summary stats ---

  const todaySales = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return franchiseSales.filter((s) => {
      const saleDate = s.created_at?.substring(0, 10);
      return saleDate === todayStr;
    });
  }, [franchiseSales]);

  const todaySalesCount = todaySales.length;
  const todaySalesValue = todaySales.reduce(
    (sum, s) => sum + (parseFloat(s.total_amount) || 0),
    0
  );

  const monthSalesValue = useMemo(() => {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    return franchiseSales
      .filter((s) => (s.created_at?.substring(0, 10) || "") >= monthStart)
      .reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
  }, [franchiseSales]);

  const monthExpensesValue = useMemo(() => {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    return expenses
      .filter(
        (e) =>
          e.franchise_id === franchiseId &&
          (e.created_at?.substring(0, 10) || "") >= monthStart
      )
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [expenses, franchiseId]);

  const estimatedProfit = monthSalesValue - monthExpensesValue;

  const lowStockCount = franchiseInventory.filter(
    (i) => i.min_stock > 0 && i.quantity < i.min_stock
  ).length;

  // --- Guards ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#b91c1c]" />
        <span className="ml-3 text-[#534343]">Carregando...</span>
      </div>
    );
  }

  if (currentUser?.role === "admin") {
    return <Navigate to="/Dashboard" replace />;
  }

  if (!primaryFranchise) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <MaterialIcon icon="store" size={64} className="text-[#cac0c0] mb-4" />
        <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
          Nenhuma franquia vinculada
        </h3>
        <p className="text-sm text-[#534343] max-w-sm">
          Sua conta ainda nao esta vinculada a nenhuma franquia. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  const formatBRL = (value) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);

  return (
    <div className="min-h-screen bg-[#fbf9fa]">
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#b91c1c]/10 rounded-xl">
            <MaterialIcon icon="store" size={24} className="text-[#b91c1c]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">
              Minha Loja
            </h1>
            <p className="text-sm text-[#534343]">
              {primaryFranchise.city || primaryFranchise.name}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Vendas Hoje */}
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-4 md:p-6">
            <CardContent className="p-0 flex items-center gap-3">
              <div className="p-2 bg-[#b91c1c]/10 rounded-xl shrink-0">
                <MaterialIcon icon="point_of_sale" size={20} className="text-[#b91c1c]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                  Vendas Hoje
                </p>
                <p className="text-lg md:text-xl font-bold text-[#1b1c1d] font-mono-numbers">
                  {todaySalesCount}
                </p>
                <p className="text-[10px] md:text-xs text-[#534343] font-mono-numbers truncate">
                  {formatBRL(todaySalesValue)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Faturamento do Mes */}
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-4 md:p-6">
            <CardContent className="p-0 flex items-center gap-3">
              <div className="p-2 bg-[#775a19]/10 rounded-xl shrink-0">
                <MaterialIcon icon="payments" size={20} className="text-[#775a19]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                  Faturamento
                </p>
                <p className="text-lg md:text-xl font-bold text-[#1b1c1d] font-mono-numbers truncate">
                  {formatBRL(monthSalesValue)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lucro Estimado */}
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-4 md:p-6">
            <CardContent className="p-0 flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${estimatedProfit >= 0 ? "bg-[#9c4143]/10" : "bg-[#b91c1c]/10"}`}>
                <MaterialIcon
                  icon={estimatedProfit >= 0 ? "trending_up" : "trending_down"}
                  size={20}
                  className={estimatedProfit >= 0 ? "text-[#9c4143]" : "text-[#b91c1c]"}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                  Lucro Estimado
                </p>
                <p className={`text-lg md:text-xl font-bold font-mono-numbers truncate ${estimatedProfit >= 0 ? "text-[#9c4143]" : "text-[#b91c1c]"}`}>
                  {formatBRL(estimatedProfit)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Estoque Baixo */}
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-4 md:p-6">
            <CardContent className="p-0 flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${lowStockCount > 0 ? "bg-[#b91c1c]/10" : "bg-[#9c4143]/10"}`}>
                <MaterialIcon
                  icon={lowStockCount > 0 ? "warning" : "check_circle"}
                  size={20}
                  className={lowStockCount > 0 ? "text-[#b91c1c]" : "text-[#9c4143]"}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                  Estoque Baixo
                </p>
                <p className={`text-lg md:text-xl font-bold font-mono-numbers ${lowStockCount > 0 ? "text-[#b91c1c]" : "text-[#9c4143]"}`}>
                  {lowStockCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white border border-[#291715]/5 rounded-xl p-1 w-full md:w-auto">
            <TabsTrigger
              value="lancar"
              className="gap-1.5 rounded-lg data-[state=active]:bg-[#b91c1c] data-[state=active]:text-white data-[state=active]:shadow-none px-4"
            >
              <MaterialIcon icon="add_circle" size={16} />
              Lancar
            </TabsTrigger>
            <TabsTrigger
              value="resultado"
              className="gap-1.5 rounded-lg data-[state=active]:bg-[#b91c1c] data-[state=active]:text-white data-[state=active]:shadow-none px-4"
            >
              <MaterialIcon icon="analytics" size={16} />
              Resultado
            </TabsTrigger>
            <TabsTrigger
              value="estoque"
              className="gap-1.5 rounded-lg data-[state=active]:bg-[#b91c1c] data-[state=active]:text-white data-[state=active]:shadow-none px-4"
            >
              <MaterialIcon icon="inventory_2" size={16} />
              Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lancar" className="mt-4">
            <TabLancar
              franchiseId={franchiseId}
              currentUser={currentUser}
              sales={franchiseSales}
              contacts={franchiseContacts}
              inventoryItems={franchiseInventory}
              onRefresh={handleRefreshSales}
            />
          </TabsContent>

          <TabsContent value="resultado" className="mt-4">
            <TabResultado
              franchiseId={franchiseId}
              currentUser={currentUser}
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
        </Tabs>
      </div>
    </div>
  );
}
