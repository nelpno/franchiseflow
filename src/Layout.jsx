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
import { OnboardingChecklist } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { useAdminPendingCounts } from "@/hooks/useAdminPendingCounts";
import { getAvailableFranchises, getPrimaryFranchise, resolveActiveFranchise } from "@/lib/franchiseUtils";
import FranchiseSelector from "@/components/shared/FranchiseSelector";
import { listarFranquias } from "@/lib/franchisesCache";
import VoltarTrilhaBar from "@/components/onboarding/VoltarTrilhaBar";
import { useFeatureFlagState } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { useIsMobile } from "@/hooks/use-mobile";
import { guiaDaRota } from "@/lib/ajudaRotaGuia";

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
    // Já está no menu de baixo do franqueado com ui_v2 — não repetir dentro do
    // Sheet "Mais" no celular (P3, 28/09/2026). Desktop e admin/CS ficam intactos.
    hideFromMaisSheetWhenV2: true,
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
    hideFromMaisSheetWhenV2: true,
  },
  {
    title: "Gestão",
    url: createPageUrl("Gestao"),
    materialIcon: "bar_chart",
    franchiseeOnly: true,
    showToAdminToo: true,
    adminNav: "mais",
    // Com ui_v2 ligada, o item "Estoque" abaixo cobre a aba tab=estoque — não pode
    // destacar os dois ao mesmo tempo (P3, 28/09/2026). Sem a chave, "Estoque" nem
    // existe no menu, então "Gestão" volta a acender pra qualquer aba (comportamento
    // de sempre) — daí o `excludeTabsWhenV2` só valer quando uiV2 está ligada.
    excludeTabsWhenV2: ["estoque"],
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
    // Menu novo (S9.1, atrás de ui_v2): "Meu robô" — decisão de 27/09/2026. Com a
    // chave desligada o rótulo segue "Meu Vendedor" (nada muda).
    franchiseeLabelV2: "Meu robô",
    url: createPageUrl("FranchiseSettings"),
    materialIcon: "smart_toy",
    franchiseeOnly: true,
  },
  {
    // Menu novo (S9.1): item direto pro Estoque (a aba já existe dentro de
    // Gestão — só ganha atalho próprio no menu, "Loja" nunca aparece). Some do
    // menu com a chave desligada (Gestão continua cobrindo o mesmo caminho).
    title: "Estoque",
    url: "/Gestao?tab=estoque",
    materialIcon: "package_2",
    franchiseeOnly: true,
    onlyWhenV2: true,
    // Mesma tela de sempre (rota /Gestao) — o destaque tem que casar path+tab, senão
    // acende em QUALQUER aba de Gestão (P3, 28/09/2026). Ver `tabMatch` no cálculo
    // de isActive. Já está no menu de baixo — não repetir dentro do Sheet "Mais".
    tabMatch: "estoque",
    hideFromMaisSheetWhenV2: true,
  },
  {
    // S11.1 (28/09/2026): Mais › Pagamentos — só no menu novo (ui_v2). Com a chave
    // desligada o cartão de sempre da Início continua sendo o lugar de pagar.
    title: "Pagamentos",
    url: createPageUrl("Pagamentos"),
    materialIcon: "payments",
    franchiseeOnly: true,
    onlyWhenV2: true,
  },
  {
    title: "Tutoriais",
    adminLabel: "Ajuda",
    // Onda 5 (28/09/2026): com o menu novo a tela já é a Ajuda (S10.1); o menu
    // chamava "Tutoriais" e a franqueada procurava "Ajuda" (teste com a chave ligada).
    franchiseeLabelV2: "Ajuda",
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

// Mobile bottom nav items for franchisee (chave ui_v2 DESLIGADA — comportamento atual)
const mobileBottomNav = [
  { label: "Início", materialIcon: "wb_sunny", url: createPageUrl("Dashboard") },
  { label: "Gestão", materialIcon: "bar_chart", url: createPageUrl("Gestao") },
  { label: "Vender", materialIcon: "add", url: "/Vendas?action=nova-venda", isFab: true },
  { label: "Clientes", materialIcon: "people", url: createPageUrl("MyContacts") },
  { label: "Vendedor", materialIcon: "smart_toy", url: createPageUrl("FranchiseSettings") },
];

// Mobile bottom nav para franqueado — menu novo (S9.1, 28/09/2026), atrás da
// chave ui_v2: Início · Vendas · + Nova venda · Estoque · Mais (nunca "Loja").
// "Mais" reusa o mesmo botão do admin (abre o Sheet do hambúrguer com o resto:
// Meus Clientes, Gestão, Marketing, Meu robô, Tutoriais, Primeiros passos).
const mobileBottomNavV2 = [
  { label: "Início", materialIcon: "wb_sunny", url: createPageUrl("Dashboard") },
  { label: "Vendas", materialIcon: "point_of_sale", url: createPageUrl("Vendas") },
  { label: "Nova venda", materialIcon: "add", url: "/Vendas?action=nova-venda", isFab: true },
  // tabMatch: mesmo critério do item da sidebar — só acende com tab=estoque, nunca
  // nas outras abas de Gestão (P3, 28/09/2026).
  { label: "Estoque", materialIcon: "package_2", url: "/Gestao?tab=estoque", tabMatch: "estoque" },
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
      aria-label="Mais"
      className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 text-ink-2 touch-manipulation active:opacity-60"
    >
      <MaterialIcon icon="menu" size={20} aria-hidden="true" />
      <span className="text-xs font-medium">Mais</span>
    </button>
  );
}

// Fecha o Sheet "Mais" (mobile) — só existe (é montado) pro franqueado com ui_v2
// ligada (P3, 28/09/2026, 2ª passada: admin/CS e franqueado com a chave desligada
// não têm esse sheet, então não precisam do listener nem do efeito de rota rodando
// à toa). Fica como componente à parte porque só um DESCENDENTE do SidebarProvider
// pode chamar useSidebar() — o próprio Layout está por fora dele.
//
// Dois gatilhos, cada um cobre um buraco que o outro não cobre:
// 1) evento `mais-sheet:close`, disparado no ONCLICK de cada link do menu — fecha
//    na hora, inclusive quando o destino é a ROTA ATUAL (clicar em "Gestão" já
//    estando em /Gestao?tab=resultado não muda path nem query, e o efeito de rota
//    abaixo não dispararia sozinho).
// 2) efeito de rota (path OU só query) — rede de segurança pra navegação que não
//    passa pelo clique (ex.: back/forward do navegador).
function FecharMaisAoNavegar() {
  const { setOpenMobile } = useSidebar();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setOpenMobile(false);
    window.addEventListener("mais-sheet:close", handler);
    return () => window.removeEventListener("mais-sheet:close", handler);
  }, [setOpenMobile]);

  useEffect(() => {
    setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
}

// Todo link do menu despacha isto ao ser tocado — sem custo pra quem não tem o
// listener montado (admin, CS, franqueado com a chave desligada: nada escuta).
const fecharMaisAoClicar = () => window.dispatchEvent(new Event("mais-sheet:close"));

// Critério único de "item ativo" (P3, 28/09/2026): item com `tabMatch` só acende
// quando o path bate E a query `tab` bate com esse valor exato — sem isso "Estoque"
// (url /Gestao?tab=estoque) acendia em QUALQUER aba de Gestão, porque a checagem
// antiga era só `url.includes(currentPageName)`. `excludeTabsWhenV2` apaga um item
// SEM tabMatch (ex: "Gestão") quando ui_v2 está ligada e a query bate uma das tabs
// listadas — impede os dois ficarem ativos ao mesmo tempo.
// Reserva a MESMA altura/estrutura do menu de baixo enquanto a chave ainda está
// carregando (P3, 28/09/2026) — em vez de mostrar o menu ANTIGO por um instante e
// trocar pro novo assim que a chave resolve ligada. Espaço em branco > flash.
function MobileNavSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={`esq-${i}`} className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1" aria-hidden="true">
          <div className="w-5 h-5 rounded-full bg-[#f2e7e7] animate-pulse" />
          <div className="w-10 h-2.5 rounded bg-[#f2e7e7] animate-pulse" />
        </div>
      ))}
      <div className="flex flex-col items-center -mt-10" aria-hidden="true">
        <div className="w-12 h-12 rounded-full bg-[#f2e7e7] border-4 border-surface animate-pulse" />
      </div>
      {[0, 1].map((i) => (
        <div key={`dir-${i}`} className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1" aria-hidden="true">
          <div className="w-5 h-5 rounded-full bg-[#f2e7e7] animate-pulse" />
          <div className="w-10 h-2.5 rounded bg-[#f2e7e7] animate-pulse" />
        </div>
      ))}
    </>
  );
}

function isNavItemActive(item, { pathname, search, currentPageName, uiV2 }) {
  const [itemPath] = item.url.split("?");
  const currentTab = new URLSearchParams(search).get("tab");
  if (item.tabMatch) {
    return pathname === itemPath && currentTab === item.tabMatch;
  }
  if (uiV2 && item.excludeTabsWhenV2?.includes(currentTab)) {
    return false;
  }
  return pathname === item.url || (item.url.includes(currentPageName) && currentPageName);
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { logout, user: currentUser, selectedFranchise, setSelectedFranchise, welcomeSeen } = useAuth();
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
  // Menu novo (S9.1, 28/09/2026) — botão de emergência da chave (CLAUDE.md § Voltar
  // atrás): SEM PILOTO, mas só vale pro franqueado (admin/gerente não mudam). A
  // franquia da chave é a `selectedFranchise` (o hook já cuida de desligada/erro).
  // `uiV2Pending` distingue "carregando" de "desligada/erro" (P3, 28/09/2026): sem
  // isso o menu de baixo mostrava o ANTIGO por um instante e trocava pro novo assim
  // que a chave resolvia ligada — pisca visível em toda troca de franquia/foco de
  // aba. A query key inclui a unidade (`useFeatureFlagState`), então trocar de
  // franquia sempre entra em loading de novo — nunca reaproveita o valor da anterior.
  const { value: uiV2Value, isLoading: uiV2Loading } = useFeatureFlagState(FEATURE_KEYS.UI_V2);
  const uiV2 = uiV2Value && !isAdmin && !isCS;
  const uiV2Pending = uiV2Loading && !isAdmin && !isCS;
  // "?" de ajuda no topo (S10.2, 28/09/2026): mapa PURO rota → guia (ajudaRotaGuia.js,
  // testado). Só franqueado, só atrás de ui_v2, só quando a tela tem guia mapeado —
  // com a chave desligada, `uiV2` já é false e o botão nem aparece.
  const guiaDaTela = uiV2 ? guiaDaRota(currentPageName, new URLSearchParams(location.search).get("tab")) : null;
  // Só usado pra tirar Início/Vendas/Estoque do Sheet "Mais" no celular com ui_v2
  // (P3, 28/09/2026) — eles já estão no menu de baixo, repetir é ruído. Desktop
  // (isMobile=false) mantém a lista cheia de sempre.
  const isMobile = useIsMobile();

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
      // Item exclusivo do menu novo (ex: "Estoque"): some com a chave desligada.
      // TEM que vir antes do franchiseeOnly abaixo — senão o `return true` dele
      // libera o item pro franqueado mesmo com a chave desligada (bug real, pego
      // no print do S9: "Estoque" aparecia na sidebar com ui_v2 OFF).
      if (item.onlyWhenV2 && !uiV2) return false;
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
        : (uiV2 && item.franchiseeLabelV2) || item.franchiseeLabel || item.title,
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
  const currentPageTitle = filteredNavigationItems.find((item) =>
    isNavItemActive(item, { pathname: location.pathname, search: location.search, currentPageName, uiV2 })
  )?.title || currentPageName || "Dashboard";

  // Ajuda vai pro rodapé (admin/gerente/CS); o resto do menu admin se divide em
  // "principal" (flat) e "Mais" (recolhido). Franqueado mantém a lista única de sempre.
  const ajudaItem = filteredNavigationItems.find((item) => item.url === createPageUrl("Tutoriais"));
  const itemsSemAjuda = filteredNavigationItems.filter((item) => item !== ajudaItem);
  const mainItems = isAdmin ? itemsSemAjuda.filter((item) => item.adminNav !== "mais") : itemsSemAjuda;
  const moreItems = isAdmin ? itemsSemAjuda.filter((item) => item.adminNav === "mais") : [];
  // Sheet "Mais" no celular do franqueado com ui_v2: tira o que já está no menu de
  // baixo (Início, Vendas, Estoque) — desktop/admin/CS usam `filteredNavigationItems`
  // sem filtro nenhum (P3, 28/09/2026).
  const franchiseeSidebarItems = (isMobile && uiV2)
    ? filteredNavigationItems.filter((item) => !item.hideFromMaisSheetWhenV2)
    : filteredNavigationItems;

  const renderNavItem = (item) => {
    const isActive = isNavItemActive(item, {
      pathname: location.pathname,
      search: location.search,
      currentPageName,
      uiV2,
    });
    const badgeCount = item.pendingBadgeKey ? pendingCounts?.[item.pendingBadgeKey] : null;
    return (
      <SidebarMenuItem key={item.url + item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={`h-11 px-3 gap-3 rounded-xl transition-all ${isActive ? "bg-brand/10 text-brand font-semibold shadow-sm" : "hover:bg-brand/5 text-ink-2"}`}
        >
          <Link
            to={item.url}
            className="flex items-center gap-3"
            aria-current={isActive ? "page" : undefined}
            onClick={uiV2 && isMobile ? fecharMaisAoClicar : undefined}
          >
            <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} className={isActive ? "text-brand" : ""} aria-hidden="true" />
            <span className="text-sm flex-1">{item.title}</span>
            {badgeCount > 0 && (
              // Neutro (R3 do padrão): nenhum dos contadores de hoje (pedidos pra confirmar,
              // verba a confirmar) é atraso — vermelho fica reservado pra isso.
              <span className="text-[11px] font-bold bg-surface-2 text-ink-2 border border-surface-line rounded-full px-2 py-0.5 leading-none">
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
      {/* Fecha o Sheet "Mais" ao navegar/clicar — só existe pro franqueado com a
          chave ligada (P3, 28/09/2026, 2ª passada) */}
      {uiV2 && <FecharMaisAoNavegar />}
      {/* Paywall: blocks franchisees with overdue subscription */}
      <SubscriptionPaywall availableFranchises={availableFranchises} />
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
                    {(isCS ? mainItems : franchiseeSidebarItems).map(renderNavItem)}
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
                {guiaDaTela && (
                  <Link
                    to={`/Tutoriais?abrir=${guiaDaTela}`}
                    aria-label="Ajuda desta tela"
                    className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-white/50"
                  >
                    <MaterialIcon icon="help_outline" size={20} />
                  </Link>
                )}
                <NotificationBell size={20} />
              </div>
            </header>
          )}

          {/* Top bar — mobile */}
          <header className="md:hidden sticky top-0 z-40 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-4 border-b border-[#f8eeee]/50">
            {/* min-w-0+flex-1 no grupo esquerdo (P3, S10): com 2+ unidades e nome
                comprido, o FranchiseSelector precisa poder encolher (o truncate dele
                só funciona se o pai admitir isso) — senão o "?" novo do lado direito
                empurra o cabeçalho pra fora dos 390px. */}
            <div className={uiV2 ? "flex min-w-0 flex-1 items-center gap-3" : "flex items-center gap-3"}>
              <SidebarTrigger className="p-2 rounded-xl text-ink-2 hover:bg-white/50 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center" />
              {!isAdmin && availableFranchises.length > 1 ? (
                <FranchiseSelector franchises={availableFranchises} encolher={uiV2} />
              ) : (
                <h1 className={uiV2 ? "min-w-0 truncate text-lg font-semibold text-ink" : "text-lg font-semibold text-ink"}>
                  {currentPageTitle}
                </h1>
              )}
            </div>
            <div className={uiV2 ? "flex shrink-0 items-center gap-2" : "flex items-center gap-2"}>
              {guiaDaTela && (
                <Link
                  to={`/Tutoriais?abrir=${guiaDaTela}`}
                  aria-label="Ajuda desta tela"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-white/50"
                >
                  <MaterialIcon icon="help_outline" size={20} />
                </Link>
              )}
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
          {/* pb-20 cobre a altura do menu de baixo (h-16); a area segura do iPhone
              (home indicator) soma por cima, senao o fim da tela fica atras do menu. */}
          <div className={`flex-1 min-h-0 overflow-auto ${
            (isAdmin || isCS) && isHomePath ? "" : "md:pt-20"
          } pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0`}>
            <VoltarTrilhaBar />
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile bottom nav — franqueado (S9.1: com ui_v2 ligada troca pro menu novo
            Início · Vendas · + Nova venda · Estoque · Mais; desligada = o de sempre).
            Enquanto a chave carrega (uiV2Pending), mostra só o esqueleto — nunca o
            antigo pra depois trocar pro novo (P3, 28/09/2026). */}
        {!isAdmin && !isCS && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-none shadow-[0_-4px_20px_-10px_rgba(185,28,28,0.1)] h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-4 z-40">
            {uiV2Pending ? (
              <MobileNavSkeleton />
            ) : (
              <>
                {(uiV2 ? mobileBottomNavV2 : mobileBottomNav).map((item) => {
                  if (item.isFab) {
                    return (
                      <Link
                        key="fab"
                        to={item.url}
                        aria-label={item.label}
                        className="flex flex-col items-center -mt-10"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#9c4143] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-surface">
                          <MaterialIcon icon="add" size={24} aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold text-[#9c4143] mt-1">{item.label}</span>
                      </Link>
                    );
                  }
                  const isActive = isNavItemActive(item, {
                    pathname: location.pathname,
                    search: location.search,
                    currentPageName,
                    uiV2,
                  });
                  return (
                    <Link
                      key={item.label}
                      to={item.url}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      // 48 px de altura e largura dividida: era ~40 px de area util no
                      // controle mais tocado do app
                      className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 touch-manipulation active:opacity-60 ${
                        isActive ? "text-[#9c4143]" : "text-ink-2"
                      }`}
                    >
                      <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} aria-hidden="true" />
                      <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
                {/* "Mais" do menu novo abre o mesmo Sheet do hambúrguer (Meus Clientes,
                    Gestão, Marketing, Meu robô, Tutoriais, Primeiros passos) */}
                {uiV2 && <MaisBottomNavButton />}
              </>
            )}
          </nav>
        )}

        {/* Mobile bottom nav — admin/gerente/CS: Hoje / Unidades / Mural / Mais */}
        {(isAdmin || isCS) && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-none shadow-[0_-4px_20px_-10px_rgba(185,28,28,0.1)] h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-2 z-40">
            {adminMobileBottomNav.map((item) => {
              const isActive = isNavItemActive(item, {
                pathname: location.pathname,
                search: location.search,
                currentPageName,
                uiV2,
              });
              return (
                <Link
                  key={item.label}
                  to={item.url}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 touch-manipulation active:opacity-60 ${
                    isActive ? "text-brand" : "text-ink-2"
                  }`}
                >
                  <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} aria-hidden="true" />
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
