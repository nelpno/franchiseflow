import { useState, useEffect, useRef } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import NotificationBell from "@/components/ui/NotificationBell";
import SubscriptionPaywall from "@/components/shared/SubscriptionPaywall";
import logoImg from "@/assets/logo-maxi-massas-optimized.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DailyUniqueContact, Sale, OnboardingChecklist } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { useAdminPendingCounts } from "@/hooks/useAdminPendingCounts";
import { format } from "date-fns";
import { getAvailableFranchises, getPrimaryFranchise, resolveActiveFranchise } from "@/lib/franchiseUtils";
import FranchiseSelector from "@/components/shared/FranchiseSelector";
import { listarFranquias } from "@/lib/franchisesCache";
import VoltarTrilhaBar from "@/components/onboarding/VoltarTrilhaBar";

// Todos os 4 papéis existentes — usado nos itens que aparecem para todo mundo (Hoje,
// Ajuda), só que com rótulo/posição diferente por papel.
const TODOS_OS_PAPEIS = ["admin", "manager", "customer_success", "franchisee"];

// Navigation items. `adminNav` só importa para admin/manager: "main" fica no menu
// principal (Fase 1, 26/09/2026), "mais" fica dentro do grupo colapsável "Mais".
// `showToAdminToo` deixa um item franchiseeOnly aparecer TAMBÉM pro admin (dentro de
// "Mais") sem deixar de ser a tela normal do franqueado.
const navigationItems = [
  {
    title: "Dashboard",
    franchiseeLabel: "Início",
    adminLabel: "Hoje",
    url: createPageUrl("Dashboard"),
    materialIcon: "wb_sunny",
    roles: TODOS_OS_PAPEIS,
    adminNav: "main",
  },
  {
    title: "Unidades",
    url: createPageUrl("Unidades"),
    materialIcon: "home_work",
    roles: ["admin", "manager", "customer_success"],
    adminNav: "main",
  },
  {
    title: "Customer Success",
    adminLabel: "Mural do CS",
    url: createPageUrl("CustomerSuccess"),
    materialIcon: "view_kanban",
    roles: ["customer_success", "admin", "manager"],
    adminNav: "main",
  },
  {
    title: "Pedidos",
    url: createPageUrl("PurchaseOrders"),
    materialIcon: "local_shipping",
    adminOnly: true,
    adminNav: "main",
    pendingBadgeKey: "pedidos_para_confirmar",
  },
  {
    title: "Financeiro",
    url: createPageUrl("Financeiro"),
    materialIcon: "account_balance",
    adminOnly: true,
    adminNav: "main",
  },
  {
    title: "Vendas",
    url: createPageUrl("Vendas"),
    materialIcon: "point_of_sale",
    franchiseeOnly: true,
    showToAdminToo: true,
    adminNav: "mais",
  },
  {
    title: "Gestão",
    url: createPageUrl("Gestao"),
    materialIcon: "bar_chart",
    franchiseeOnly: true,
    showToAdminToo: true,
    adminNav: "mais",
  },
  {
    title: "Meus Clientes",
    url: createPageUrl("MyContacts"),
    materialIcon: "people",
    franchiseeOnly: true,
    showToAdminToo: true,
    adminNav: "mais",
  },
  {
    title: "Marketing",
    url: createPageUrl("Marketing"),
    materialIcon: "campaign",
    adminNav: "main",
    pendingBadgeKey: "marketing_a_confirmar",
  },
  {
    title: "Meu Vendedor",
    url: createPageUrl("FranchiseSettings"),
    materialIcon: "smart_toy",
    franchiseeOnly: true,
  },
  {
    title: "Tutoriais",
    adminLabel: "Ajuda",
    url: createPageUrl("Tutoriais"),
    materialIcon: "help_outline",
    roles: TODOS_OS_PAPEIS,
  },
  {
    title: "Configurações",
    adminLabel: "Robôs das unidades",
    url: createPageUrl("FranchiseSettings"),
    materialIcon: "settings",
    adminOnly: true,
    adminNav: "mais",
  },
  {
    title: "Primeiros passos",
    url: createPageUrl("Onboarding"),
    materialIcon: "rocket_launch",
    showOnboarding: true,
    adminNav: "mais",
  },
  {
    title: "Franqueados",
    url: createPageUrl("Franchises"),
    materialIcon: "group",
    adminOnly: true,
    adminNav: "mais",
  },
];

// Mobile bottom nav items for franchisee
const mobileBottomNav = [
  { label: "Início", materialIcon: "wb_sunny", url: createPageUrl("Dashboard") },
  { label: "Gestão", materialIcon: "bar_chart", url: createPageUrl("Gestao") },
  { label: "Vender", materialIcon: "add", url: "/Vendas?action=nova-venda", isFab: true },
  { label: "Clientes", materialIcon: "people", url: createPageUrl("MyContacts") },
  { label: "Vendedor", materialIcon: "smart_toy", url: createPageUrl("FranchiseSettings") },
];

// Mobile bottom nav para admin/gerente/CS: Hoje / Unidades / Mural / Mais (Mais abre
// o menu completo — reusa o mesmo Sheet do hambúrguer via toggleSidebar).
const adminMobileBottomNav = [
  { label: "Hoje", materialIcon: "wb_sunny", url: createPageUrl("Dashboard") },
  { label: "Unidades", materialIcon: "home_work", url: createPageUrl("Unidades") },
  { label: "Mural", materialIcon: "view_kanban", url: createPageUrl("CustomerSuccess") },
];

function MaisBottomNavButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 text-ink-2"
    >
      <MaterialIcon icon="menu" size={20} />
      <span className="text-xs font-medium">Mais</span>
    </button>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { logout, user: currentUser, selectedFranchise, setSelectedFranchise, welcomeSeen } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [todayContacts, setTodayContacts] = useState(0);
  const [onboardingApproved, setOnboardingApproved] = useState(false);
  const [hasActiveOnboarding, setHasActiveOnboarding] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [needsOnboardingWelcome, setNeedsOnboardingWelcome] = useState(false);
  const [onboardingChangeTick, setOnboardingChangeTick] = useState(0);
  const [availableFranchises, setAvailableFranchises] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Marca desta execução: resposta atrasada de uma unidade anterior é descartada.
    let cancelado = false;
    if (!currentUser) return;

    // Zera a cada nova avaliação (usuário OU unidade mudou, ou chegou o evento
    // onboarding-status-changed) — senão o item "Onboarding" e o redirect de
    // boas-vindas ficam grudados no estado da unidade anterior ao trocar de
    // franquia no seletor, ou depois que a equipe Maxi conclui pelo admin.
    setOnboardingApproved(false);
    setHasActiveOnboarding(false);
    setNeedsOnboardingWelcome(false);

    if (currentUser.role === "admin" || currentUser.role === "manager") {
      loadQuickStats();
      setOnboardingLoaded(true);
      return () => { cancelado = true; mountedRef.current = false; };
    }
    if (currentUser.managed_franchise_ids?.length > 0) {
      listarFranquias()
        .then((allFranchises) => {
          if (cancelado) return;
          const userFranchises = getAvailableFranchises(allFranchises, currentUser);
          setAvailableFranchises(userFranchises);

          // Initialize selectedFranchise if not set or invalid
          if (!selectedFranchise || !userFranchises.find((f) => f.id === selectedFranchise.id)) {
            const savedId = localStorage.getItem("selected_franchise_id");
            const savedFranchise = savedId ? userFranchises.find((f) => f.id === savedId) : null;
            setSelectedFranchise(savedFranchise || userFranchises[0] || null);
          }

          // Unidade ativa = a do seletor do topo (FranchiseSelector); só cai na
          // primária quando ainda não há seleção válida.
          const activeFranchise =
            resolveActiveFranchise(allFranchises, currentUser, selectedFranchise) ||
            getPrimaryFranchise(allFranchises, currentUser);
          const franchiseId = activeFranchise?.evolution_instance_id;
          if (!franchiseId) {
            if (!cancelado) setOnboardingLoaded(true);
            return;
          }
          return OnboardingChecklist.filter({ franchise_id: franchiseId });
        })
        .then((obs) => {
          if (cancelado) return;
          if (!obs) {
            // Sem evolution_instance_id nao da para dizer nada sobre o onboarding
            // desta unidade — e mandar para o tour com base so em localStorage era o
            // que jogava franqueada veterana nas 7 telas de boas-vindas em todo
            // aparelho novo (auditoria 07/09/2026).
            setOnboardingLoaded(true);
            return;
          }
          if (obs.length > 0 && obs[0].status === "approved") {
            setOnboardingApproved(true);
          }
          if (obs.length > 0 && obs[0].status !== "approved") {
            setHasActiveOnboarding(true);
          }

          // If onboarding not approved AND welcome not yet seen => show welcome
          if (obs.length > 0 && obs[0].status !== "approved" && !welcomeSeen) {
            setNeedsOnboardingWelcome(true);
          }
          // Sem linha de checklist = unidade de ANTES do trigger de Primeiros Passos
          // (16/09/2026): toda franquia nova nasce com checklist agora
          // (trg_franchise_onboarding_checklist), então "sem linha" não é mais sinal de
          // "unidade nova" — era essa a premissa da antiga heurística de 30 dias, que
          // jogava franqueada veterana nas telas de boas-vindas em todo aparelho novo
          // (auditoria 07/09/2026). Sem checklist agora = veterana mesmo; não mostra.

          setOnboardingLoaded(true);
        })
        .catch((error) => {
          console.error("Erro ao carregar onboarding:", error);
          if (!cancelado) setOnboardingLoaded(true);
        });
    } else {
      // Novo franqueado sem franchise vinculada ainda — mostrar onboarding welcome
      if (currentUser.role === "franchisee" && !welcomeSeen) {
        setNeedsOnboardingWelcome(true);
      }
      setOnboardingLoaded(true);
    }

    return () => { cancelado = true; mountedRef.current = false; };
    // selectedFranchise entra só pelo id: o objeto pode trocar de referência (novo
    // fetch) sem trocar de unidade, e isso reavaliaria à toa.
  }, [currentUser, selectedFranchise?.evolution_instance_id, selectedFranchise?.id, onboardingChangeTick, welcomeSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for onboarding-started event from Onboarding page
  useEffect(() => {
    const handler = () => setHasActiveOnboarding(true);
    window.addEventListener("onboarding-started", handler);
    return () => window.removeEventListener("onboarding-started", handler);
  }, []);

  // Admin concluiu/reabriu os primeiros passos (Onboarding.jsx) — reavaliar o
  // efeito acima (o item do menu e o redirect de boas-vindas usam esse estado).
  useEffect(() => {
    const handler = () => setOnboardingChangeTick((t) => t + 1);
    window.addEventListener("onboarding-status-changed", handler);
    return () => window.removeEventListener("onboarding-status-changed", handler);
  }, []);

  const loadQuickStats = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const results = await Promise.allSettled([
        DailyUniqueContact.filter({ date: today }),
        // Só as vendas de HOJE (id apenas): elimina o teto silencioso de 50/dia e o select('*').
        Sale.filter({ sale_date: today }, null, null, { columns: 'id' }),
      ]);
      if (!mountedRef.current) return;
      const contactsData = results[0].status === "fulfilled" ? results[0].value : [];
      const salesData = results[1].status === "fulfilled" ? results[1].value : [];
      setTodayContacts(contactsData.length);
      setTodaySales(salesData.length);
    } catch (error) {
      console.error("Erro ao carregar estatísticas rápidas:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('[Layout] Logout failed:', e);
    }
  };

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const isCS = currentUser?.role === "customer_success";
  // "/" tambem abre a home (App.jsx renderiza o MainPage sem redirecionar)
  const isHomePath = location.pathname === "/" || location.pathname === createPageUrl("Dashboard");
  const { pending: pendingCounts } = useAdminPendingCounts();

  const filteredNavigationItems = navigationItems
    .filter((item) => {
      // Itens com lista de papéis (ex: Hoje, Unidades, Mural do CS, Ajuda): só
      // aparecem para esses papéis, com posição/rótulo por papel (ver abaixo).
      if (item.roles) return item.roles.includes(currentUser?.role);
      // Customer Success só vê itens role-gated (acima); nada mais
      if (isCS) return false;
      // Hide items from admin sidebar (routes still work via URL)
      if (isAdmin && item.adminSidebarHidden) return false;
      if (item.adminOnly) return isAdmin;
      // franchiseeOnly some pro admin — exceto os marcados showToAdminToo (Vendas,
      // Gestão, Meus Clientes: o admin usa essas telas de franqueado e ficam em "Mais")
      if (item.franchiseeOnly) return !isAdmin || item.showToAdminToo === true;
      if (item.showOnboarding) {
        return isAdmin || hasActiveOnboarding;
      }
      return true;
    })
    .map((item) => ({
      ...item,
      title: isAdmin || isCS
        ? item.adminLabel || item.title
        : item.franchiseeLabel || item.title,
    }));

  // Franqueada com primeiros passos ativos: o item vai pro TOPO da lista (é a
  // próxima ação dela) — admin mantém a ordem normal (grupo "Mais").
  if (!isAdmin && !isCS && hasActiveOnboarding) {
    const onboardingIdx = filteredNavigationItems.findIndex((item) => item.showOnboarding);
    if (onboardingIdx > 0) {
      const [onboardingItem] = filteredNavigationItems.splice(onboardingIdx, 1);
      filteredNavigationItems.unshift(onboardingItem);
    }
  }

  // Get current page title for top bar
  const currentPageTitle = filteredNavigationItems.find(
    (item) =>
      location.pathname === item.url ||
      (item.url.includes(currentPageName) && currentPageName)
  )?.title || currentPageName || "Dashboard";

  // Ajuda vai pro rodapé (admin/gerente/CS); o resto do menu admin se divide em
  // "principal" (flat) e "Mais" (recolhido). Franqueado mantém a lista única de sempre.
  const ajudaItem = filteredNavigationItems.find((item) => item.url === createPageUrl("Tutoriais"));
  const itemsSemAjuda = filteredNavigationItems.filter((item) => item !== ajudaItem);
  const mainItems = isAdmin ? itemsSemAjuda.filter((item) => item.adminNav !== "mais") : itemsSemAjuda;
  const moreItems = isAdmin ? itemsSemAjuda.filter((item) => item.adminNav === "mais") : [];

  const renderNavItem = (item) => {
    const isActive =
      location.pathname === item.url ||
      (item.url.includes(currentPageName) && currentPageName);
    const badgeCount = item.pendingBadgeKey ? pendingCounts?.[item.pendingBadgeKey] : null;
    return (
      <SidebarMenuItem key={item.url + item.title}>
        <SidebarMenuButton asChild isActive={isActive} className={`h-11 px-3 gap-3 rounded-xl transition-all ${isActive ? "bg-brand/10 text-brand font-semibold shadow-sm" : "hover:bg-brand/5 text-ink-2"}`}>
          <Link to={item.url} className="flex items-center gap-3">
            <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} className={isActive ? "text-brand" : ""} />
            <span className="text-sm flex-1">{item.title}</span>
            {badgeCount > 0 && (
              <span className="text-[11px] font-bold bg-brand text-white rounded-full px-2 py-0.5 leading-none">
                {badgeCount}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Route guard: redirect franchisees who need onboarding welcome
  const isOnboardingPage = location.pathname === "/Onboarding" || location.pathname === "/OnboardingWelcome";
  if (!isAdmin && !isCS && onboardingLoaded && needsOnboardingWelcome && !isOnboardingPage) {
    return <Navigate to="/OnboardingWelcome" replace />;
  }

  return (
    <SidebarProvider>
      {/* Paywall: blocks franchisees with overdue subscription */}
      <SubscriptionPaywall />
      {/* Stitch-matched sidebar styles */}
      <style>{`
        [data-sidebar="menu-button"][data-active="true"] {
          background-color: #ffdad6 !important;
          color: #93000a !important;
          font-weight: 500;
          box-shadow: none;
        }
        [data-sidebar="menu-button"][data-active="true"]:hover {
          background-color: #ffdad6 !important;
          color: #93000a !important;
        }
        [data-sidebar="menu-button"]:not([data-active="true"]) {
          color: #4a3d3d;
        }
        [data-sidebar="menu-button"]:not([data-active="true"]):hover {
          background-color: #fdf8f8;
        }
        [data-sidebar="menu"] {
          gap: 2px;
        }
        [data-sidebar="content"] {
          background-color: #ffffff;
        }
        [data-sidebar="sidebar"] {
          background-color: #ffffff !important;
          border-right: 1px solid #f8eeee;
        }
        [data-sidebar="header"] {
          background-color: #ffffff;
        }
        [data-sidebar="footer"] {
          background-color: #ffffff;
        }
        [data-sidebar="group-label"] {
          color: rgba(83, 67, 67, 0.5);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="min-h-screen flex w-full bg-surface">
        {/* Desktop Sidebar */}
        <Sidebar className="w-[260px] border-r border-[#f8eeee]/50 bg-gradient-to-b from-surface via-white to-surface">
          <SidebarHeader className="px-4 h-32 flex items-center justify-center border-b border-brand/5">
            <div className="flex items-center gap-2.5">
              <img src={logoImg} alt="Maxi Massas" className="h-20 w-auto object-contain" />
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 pt-3 overflow-y-auto">
            {isAdmin ? (
              // Admin/gerente: menu principal liso + grupo "Mais" recolhido por padrão
              <div className="space-y-1 pb-6">
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">{mainItems.map(renderNavItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                {moreItems.length > 0 && (
                  <Collapsible defaultOpen={false} className="pt-2">
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-ink-2 hover:bg-brand/5 transition-colors [&[data-state=open]>svg]:rotate-180">
                      <span className="text-xs font-bold tracking-widest uppercase text-ink-2/70">Mais</span>
                      <MaterialIcon icon="expand_more" size={18} className="transition-transform" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <SidebarMenu className="space-y-1">{moreItems.map(renderNavItem)}</SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : (
              // Franchisee e Customer Success: flat navigation (CS só tem 3 itens hoje)
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {(isCS ? mainItems : filteredNavigationItems).map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-[#f2e7e7] p-4 mt-auto">
            {(isAdmin || isCS) && ajudaItem && (
              <SidebarMenu className="mb-2 pb-2 border-b border-[#f2e7e7]">{renderNavItem(ajudaItem)}</SidebarMenu>
            )}
            <div className="flex items-center gap-3 px-2 py-2">
              {currentUser ? (
                <>
                  {isAdmin || isCS ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-gold-ink flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {currentUser.full_name?.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f2e7e7] flex items-center justify-center shrink-0">
                      <MaterialIcon icon="account_circle" size={16} className="text-ink-2" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {currentUser.full_name}
                    </p>
                    <p className="text-[11px] text-ink-2 truncate">
                      {isAdmin ? "Admin" : isCS ? "Customer Success" : currentUser.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-ink-2 hover:text-brand transition-colors shrink-0"
                    title="Sair"
                  >
                    <MaterialIcon icon="logout" size={20} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#f2e7e7]" />
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-[#f2e7e7] rounded" />
                    <div className="h-3 w-32 bg-[#f2e7e7] rounded" />
                  </div>
                </div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top bar — desktop (hidden na Hoje do admin/CS: o cabeçalho da AdminHoje substitui) */}
          {!((isAdmin || isCS) && isHomePath) && (
            <header className="hidden md:flex fixed top-0 right-0 z-40 h-20 items-center justify-between px-8 bg-surface/80 backdrop-blur-md" style={{ width: "calc(100% - 16rem)" }}>
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold tracking-tight text-ink">
                  {currentPageTitle}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {!isAdmin && availableFranchises.length > 0 && (
                  <FranchiseSelector franchises={availableFranchises} />
                )}
                <NotificationBell size={20} />
              </div>
            </header>
          )}

          {/* Top bar — mobile */}
          <header className="md:hidden sticky top-0 z-40 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-4 border-b border-[#f8eeee]/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="p-2 rounded-xl text-ink-2 hover:bg-white/50 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center" />
              {!isAdmin && availableFranchises.length > 1 ? (
                <FranchiseSelector franchises={availableFranchises} />
              ) : (
                <h1 className="text-lg font-semibold text-ink">
                  {currentPageTitle}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="min-h-[40px] min-w-[40px] flex items-center justify-center">
                <NotificationBell size={20} />
              </div>
              {currentUser && (
                <div className="relative group">
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="w-9 h-9 rounded-full bg-[#f2e7e7] flex items-center justify-center text-ink-2 font-bold text-xs overflow-hidden"
                  >
                    {currentUser.full_name?.charAt(0).toUpperCase()}
                  </button>
                  {showMobileMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                      <div className="absolute right-0 top-11 z-50 bg-white rounded-xl shadow-lg border border-ink-shadow/10 w-56 py-2 overflow-hidden">
                        <div className="px-4 py-3 border-b border-ink-shadow/5">
                          <p className="font-semibold text-sm text-ink truncate">{currentUser.full_name || "Usuário"}</p>
                          <p className="text-xs text-ink-2 truncate">{currentUser.email}</p>
                        </div>
                        <button
                          onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-brand hover:bg-brand/5 transition-colors"
                        >
                          <MaterialIcon icon="logout" size={18} />
                          Sair da conta
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <div className={`flex-1 min-h-0 overflow-auto ${
            (isAdmin || isCS) && isHomePath ? "" : "md:pt-20"
          } pb-20 md:pb-0`}>
            <VoltarTrilhaBar />
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile bottom nav — franqueado */}
        {!isAdmin && !isCS && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-none shadow-[0_-4px_20px_-10px_rgba(185,28,28,0.1)] h-16 flex items-center justify-around px-4 z-40">
            {mobileBottomNav.map((item) => {
              if (item.isFab) {
                return (
                  <Link
                    key="fab"
                    to={item.url}
                    className="flex flex-col items-center -mt-10"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#9c4143] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-surface">
                      <MaterialIcon icon="add" size={24} />
                    </div>
                    <span className="text-xs font-bold text-[#9c4143] mt-1">{item.label}</span>
                  </Link>
                );
              }
              const isActive =
                location.pathname === item.url ||
                (item.url.includes(currentPageName) && currentPageName);
              return (
                <Link
                  key={item.label}
                  to={item.url}
                  // 48 px de altura e largura dividida: era ~40 px de area util no
                  // controle mais tocado do app
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 ${
                    isActive ? "text-[#9c4143]" : "text-ink-2"
                  }`}
                >
                  <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} />
                  <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Mobile bottom nav — admin/gerente/CS: Hoje / Unidades / Mural / Mais */}
        {(isAdmin || isCS) && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-none shadow-[0_-4px_20px_-10px_rgba(185,28,28,0.1)] h-16 flex items-center justify-around px-2 z-40">
            {adminMobileBottomNav.map((item) => {
              const isActive =
                location.pathname === item.url ||
                (item.url.includes(currentPageName) && currentPageName);
              return (
                <Link
                  key={item.label}
                  to={item.url}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 ${
                    isActive ? "text-brand" : "text-ink-2"
                  }`}
                >
                  <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} />
                  <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <MaisBottomNavButton />
          </nav>
        )}
      </div>
    </SidebarProvider>
  );
}
