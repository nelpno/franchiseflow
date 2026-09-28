import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Franchise, Sale, InventoryItem, Contact } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { getAvailableFranchises, resolveActiveFranchise } from "@/lib/franchiseUtils";
import { resolveUnitWhatsApp } from "@/lib/receiptUtils";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FranchisePicker from "@/components/shared/FranchisePicker";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import TabLancar from "@/components/minha-loja/TabLancar";

const SALES_COLUMNS = 'id, sale_number, value, delivery_fee, discount_amount, discount_type, discount_input, card_fee_amount, card_fee_percent, fee_passed_to_customer, sale_date, contact_id, franchise_id, source, payment_method, payment_confirmed, confirmed_at, created_at, observacoes, customer_name, contact_phone, customer_address, customer_neighborhood, delivery_method, net_value, capi_sent';
// capi_sent (P3 S12, sem chave): sem ele o aviso "essa venda já foi contada no anúncio" antes de
// excluir nunca aparecia (deletingSale.capi_sent vinha sempre undefined).
const SALES_LOOKBACK_MONTHS = 6;
const getSalesCutoff = () => format(subMonths(new Date(), SALES_LOOKBACK_MONTHS), 'yyyy-MM-dd');

export default function Vendas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, selectedFranchise } = useAuth();
  const rawAction = searchParams.get("action");
  const actionParam = rawAction === "nova-venda" ? rawAction : null;
  // Telefone chega pelo state da navegacao, fora da URL: na URL ele ia parar no Clarity (LGPD, 27/09/2026).
  // O ?phone= continua aceito para links antigos (MinhaLoja).
  const location = useLocation();
  const rawPhone = location.state?.phone || searchParams.get("phone");
  const phoneParam = rawPhone ? rawPhone.replace(/\D/g, "").slice(0, 11) : null;
  const rawContactId = searchParams.get("contact_id");
  const contactIdParam = rawContactId && /^[0-9a-f-]{36}$/i.test(rawContactId) ? rawContactId : null;
  // S12.5: "Vendas hoje" da Início abre a lista em Hoje (só vale com a chave ui_v2; o TabLancar decide).
  const periodoParam = searchParams.get("periodo") === "hoje" ? "today" : null;

  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  // fase 2: vendas/estoque/contatos so carregam DEPOIS que sabemos qual unidade e, filtrados por ela
  const [loadingUnidade, setLoadingUnidade] = useState(true);
  // S8.1 (28/09/2026): "Nova venda" so precisa do estoque pra abrir — vendas (6 meses, fetchAll)
  // e contatos carregam DEPOIS, sem travar a tela. loadingUnidade cai assim que o estoque chega;
  // loadingHistorico segue true ate vendas+contatos terminarem (TabLancar mostra skeleton na lista).
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mountedRef = useRef(true);
  const franchiseIdRef = useRef(null); // o polling le daqui, nao do render atual
  // P2 (revisão S8-P3, 28/09/2026): pode haver mais de um loadDadosDaUnidade em voo ao mesmo
  // tempo — o polling de 5min, o refresh depois de salvar uma venda, e a troca de unidade
  // (franqueado com 2+) podem se sobrepor. Sem isso, uma resposta ATRASADA de uma carga velha
  // (de outra unidade, ou anterior a uma venda que acabou de ser salva) sobrescrevia sales/
  // inventoryItems/contacts e os flags de loading com dado que não é mais o vigente. Cada
  // chamada tira um número; só aplica o que responde ENQUANTO ainda é a mais recente.
  const geracaoRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async (retryCount = 0) => {
    try {
      setLoading(true);
      setLoadError(null);

      // Fase 1: só as franquias (query barata) — user vem do AuthContext (useAuth).
      // Vendas, estoque e contatos ficam para a fase 2, já com franchise_id explícito no WHERE:
      // sem ele o PostgREST varria a tabela inteira e deixava a RLS peneirar, e franqueado com
      // 2 unidades baixava as DUAS para descartar uma no client.
      const franchisesData = await Franchise.list(null, null, {
        columns: 'id, evolution_instance_id, name, city, owner_name, whatsapp_publico',
      });
      if (!mountedRef.current) return;
      setCurrentUser(user);
      setFranchises(franchisesData);
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

  // Fase 2: tudo da unidade escolhida, sempre com franchise_id no WHERE.
  // Estoque primeiro (rápido, é o que a "Nova venda" precisa pra abrir) — libera loadingUnidade
  // assim que chega. Vendas (6 meses, fetchAll) e contatos vêm depois, em paralelo, sem travar
  // a tela; loadingHistorico controla só o skeleton da lista/busca em TabLancar (S8.1).
  const loadDadosDaUnidade = useCallback(async (evoId, { silencioso = false } = {}) => {
    if (!evoId) return;
    const minhaGeracao = ++geracaoRef.current;
    const vigente = () => mountedRef.current && geracaoRef.current === minhaGeracao;

    if (!silencioso) {
      setLoadingUnidade(true);
      setLoadingHistorico(true);
    }
    try {
      const inventoryData = await InventoryItem.filter({ franchise_id: evoId }, "-updated_at", null, {
        columns: 'id, product_name, quantity, cost_price, sale_price, franchise_id',
      });
      if (!vigente()) return;
      setInventoryItems(inventoryData);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      if (!silencioso && vigente()) toast.error("Erro ao carregar o estoque.");
    } finally {
      if (vigente()) setLoadingUnidade(false);
    }

    try {
      const resultados = await Promise.allSettled([
        Sale.filter({ franchise_id: evoId }, "-created_at", null, {
          columns: SALES_COLUMNS, fetchAll: true, gte: { sale_date: getSalesCutoff() },
        }),
        Contact.filter({ franchise_id: evoId }, '-created_at', null, {
          columns: 'id, nome, telefone, status, franchise_id, endereco, bairro',
        }),
      ]);
      if (!vigente()) return;
      const valor = (r) => (r.status === "fulfilled" ? r.value : []);
      setSales(valor(resultados[0]));
      setContacts(valor(resultados[1]));
      const falhou = resultados.filter((r) => r.status === "rejected");
      if (falhou.length > 0) {
        console.warn("Algumas queries falharam:", falhou.map((f) => f.reason?.message));
        if (!silencioso) toast.error("Alguns dados não carregaram. Tente recarregar.");
      }
    } catch (error) {
      console.error("Erro ao carregar histórico da unidade:", error);
    } finally {
      if (vigente()) setLoadingHistorico(false);
    }
  }, []);

  const handleRefreshSales = async () => {
    if (franchiseIdRef.current) await loadDadosDaUnidade(franchiseIdRef.current, { silencioso: true });
  };

  useVisibilityPolling(handleRefreshSales, 300000);

  const availableFranchises = useMemo(
    () => getAvailableFranchises(franchises, currentUser),
    [franchises, currentUser]
  );

  const primaryFranchise = useMemo(
    () => resolveActiveFranchise(franchises, currentUser, selectedFranchise),
    [franchises, currentUser, selectedFranchise]
  );

  const franchiseId = primaryFranchise?.evolution_instance_id;

  useEffect(() => {
    franchiseIdRef.current = franchiseId || null;
    if (franchiseId) {
      loadDadosDaUnidade(franchiseId);
    } else if (!loading) {
      // sem unidade resolvida quem decide e o picker
      setLoadingUnidade(false);
      setLoadingHistorico(false);
    }
  }, [franchiseId, loadDadosDaUnidade, loading]);

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

  // Rodapé do cupom (S13.2): SÓ franchises.whatsapp_publico (número do robô, coluna própria).
  // NUNCA personal_phone_for_summary (celular PESSOAL do dono) nem phone_number (o CS usa para
  // chamar a franqueada). Regra e números em resolveUnitWhatsApp (receiptUtils.js).
  const unitWhatsApp = useMemo(() => resolveUnitWhatsApp(primaryFranchise), [primaryFranchise]);

  if (loading || (franchiseId && loadingUnidade)) {
    return (
      <div className="bg-surface">
        <div className="p-4 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <MaterialIcon icon="cloud_off" className="text-5xl text-ink-3" />
        <p className="text-ink-2 text-center">{loadError}</p>
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

  // 2+ unidades e nenhuma escolhida: perguntar, nunca abrir a primeira da lista
  if (!primaryFranchise && availableFranchises.length > 1) {
    return <FranchisePicker franchises={availableFranchises} title="Qual unidade você quer lançar?" />;
  }

  if (!primaryFranchise) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <MaterialIcon icon="point_of_sale" size={48} className="text-ink-4 mb-4" />
        <h3 className="text-lg font-medium text-ink mb-1 font-plus-jakarta">
          Nenhuma franquia vinculada
        </h3>
        <p className="text-sm text-ink-2 max-w-sm">
          Sua conta ainda não está vinculada a nenhuma franquia. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface">
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand/10 rounded-xl">
            <MaterialIcon icon="point_of_sale" size={24} className="text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink font-plus-jakarta">Vendas</h1>
            <p className="text-sm text-ink-2">
              {primaryFranchise.city || primaryFranchise.name}
            </p>
          </div>
        </div>

        <TabLancar
          franchiseId={franchiseId}
          franchiseName={primaryFranchise.name}
          unitWhatsApp={unitWhatsApp}
          currentUser={currentUser}
          sales={franchiseSales}
          contacts={franchiseContacts}
          inventoryItems={franchiseInventory}
          historicoLoading={loadingHistorico}
          onRefresh={handleRefreshSales}
          autoOpenForm={actionParam === "nova-venda"}
          onFormOpened={() => {
            if (actionParam) {
              setSearchParams({}, { replace: true });
            }
          }}
          initialContactId={contactIdParam}
          initialPhone={phoneParam}
          initialPeriod={periodoParam}
        />
      </div>
    </div>
  );
}
