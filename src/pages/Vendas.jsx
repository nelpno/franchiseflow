import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Franchise, Sale, InventoryItem, Contact } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { getPrimaryFranchise } from "@/lib/franchiseUtils";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import TabLancar from "@/components/minha-loja/TabLancar";

const SALES_COLUMNS = 'id, value, delivery_fee, discount_amount, discount_type, discount_input, card_fee_amount, card_fee_percent, sale_date, contact_id, franchise_id, source, payment_method, payment_confirmed, confirmed_at, created_at, observacoes, customer_name, delivery_method, net_value';
const SALES_LOOKBACK_MONTHS = 6;
const getSalesCutoff = () => format(subMonths(new Date(), SALES_LOOKBACK_MONTHS), 'yyyy-MM-dd');

export default function Vendas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, selectedFranchise } = useAuth();
  const rawAction = searchParams.get("action");
  const actionParam = rawAction === "nova-venda" ? rawAction : null;
  const rawPhone = searchParams.get("phone");
  const phoneParam = rawPhone ? rawPhone.replace(/\D/g, "").slice(0, 11) : null;
  const rawContactId = searchParams.get("contact_id");
  const contactIdParam = rawContactId && /^[0-9a-f-]{36}$/i.test(rawContactId) ? rawContactId : null;

  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async (retryCount = 0) => {
    try {
      setLoading(true);
      setLoadError(null);

      // 1 round único — user vem do AuthContext (useAuth)
      const results = await Promise.allSettled([
        Franchise.list(null, null, { columns: 'id, evolution_instance_id, name, city, owner_name' }),
        Sale.list("-created_at", null, { columns: SALES_COLUMNS, fetchAll: true, gte: { sale_date: getSalesCutoff() } }),
        InventoryItem.list("-updated_at", null, { columns: 'id, product_name, quantity, cost_price, sale_price, franchise_id' }),
      ]);
      if (!mountedRef.current) return;

      const getValue = (r) => r.status === "fulfilled" ? r.value : [];
      const franchisesData = getValue(results[0]);
      if (results[0].status === "rejected") throw new Error("Não foi possível carregar franquias");
      setCurrentUser(user);
      setFranchises(franchisesData);
      setSales(getValue(results[1]));
      setInventoryItems(getValue(results[2]));

      const failed = results.slice(1).filter(r => r.status === "rejected");
      if (failed.length > 0) {
        console.warn("Algumas queries falharam:", failed.map(f => f.reason?.message));
        toast.error("Alguns dados não carregaram. Tente recarregar.");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (retryCount < 1) {
        await new Promise(r => setTimeout(r, 1000));
        if (mountedRef.current) return loadData(retryCount + 1);
        return;
      }
      console.error("Erro ao carregar dados:", error);
      const msg = error?.message || "Erro desconhecido";
      setLoadError(`Erro ao carregar dados de vendas: ${msg}`);
      toast.error(`Erro ao carregar dados de vendas: ${msg}`);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Load contacts scoped to franchise (scales independently of total contact count)
  const loadFranchiseContacts = useCallback(async (evoId) => {
    if (!evoId) return;
    try {
      const data = await Contact.filter(
        { franchise_id: evoId },
        '-created_at',
        null,
        { columns: 'id, nome, telefone, status, franchise_id, endereco, bairro' }
      );
      if (mountedRef.current) setContacts(data);
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
      if (mountedRef.current) toast.error("Erro ao carregar contatos.");
    }
  }, []);

  const handleRefreshSales = async () => {
    try {
      const refreshResults = await Promise.allSettled([
        Sale.list("-created_at", null, { columns: SALES_COLUMNS, fetchAll: true, gte: { sale_date: getSalesCutoff() } }),
        InventoryItem.list("-updated_at", null, { columns: 'id, product_name, quantity, cost_price, sale_price, franchise_id' }),
      ]);
      if (!mountedRef.current) return;
      const getVal = (r) => r.status === "fulfilled" ? r.value : [];
      setSales(getVal(refreshResults[0]));
      setInventoryItems(getVal(refreshResults[1]));
      // Refresh contacts for current franchise
      if (franchiseId) loadFranchiseContacts(franchiseId);
    } catch (error) {
      console.error("Erro ao recarregar vendas:", error);
    }
  };

  useVisibilityPolling(handleRefreshSales, 300000);

  const primaryFranchise = useMemo(() => {
    if (selectedFranchise) {
      const found = franchises.find((f) => f.id === selectedFranchise.id);
      if (found) return found;
    }
    return getPrimaryFranchise(franchises, currentUser);
  }, [franchises, currentUser, selectedFranchise]);

  const franchiseId = primaryFranchise?.evolution_instance_id;

  // Load contacts per franchise (not global) — scales regardless of total contact count
  useEffect(() => {
    if (franchiseId) loadFranchiseContacts(franchiseId);
  }, [franchiseId, loadFranchiseContacts]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#b91c1c]" />
        <span className="ml-3 text-[#4a3d3d]">Carregando...</span>
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
        <MaterialIcon icon="point_of_sale" size={48} className="text-[#cac0c0] mb-4" />
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
          <div className="p-2 bg-[#b91c1c]/10 rounded-xl">
            <MaterialIcon icon="point_of_sale" size={24} className="text-[#b91c1c]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">Vendas</h1>
            <p className="text-sm text-[#4a3d3d]">
              {primaryFranchise.city || primaryFranchise.name}
            </p>
          </div>
        </div>

        <TabLancar
          franchiseId={franchiseId}
          franchiseName={primaryFranchise.name}
          currentUser={currentUser}
          sales={franchiseSales}
          contacts={franchiseContacts}
          inventoryItems={franchiseInventory}
          onRefresh={handleRefreshSales}
          autoOpenForm={actionParam === "nova-venda"}
          onFormOpened={() => {
            if (actionParam) {
              setSearchParams({}, { replace: true });
            }
          }}
          initialContactId={contactIdParam}
          initialPhone={phoneParam}
        />
      </div>
    </div>
  );
}
