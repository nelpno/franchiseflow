import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import logoImg from "@/assets/logo-maxi-massas.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DailyUniqueContact, Sale, OnboardingChecklist } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";

// Navigation items with admin section grouping
const navigationItems = [
  {
    title: "Dashboard",
    franchiseeLabel: "Minha Loja",
    adminLabel: "Painel Geral",
    url: createPageUrl("Dashboard"),
    materialIcon: "dashboard",
    adminSection: "Principal",
  },
  {
    title: "Meus Clientes",
    url: createPageUrl("MyContacts"),
    materialIcon: "group",
    adminSection: "Principal",
  },
  {
    title: "Vendas",
    url: createPageUrl("Sales"),
    materialIcon: "shopping_cart",
    adminSection: "Principal",
  },
  {
    title: "Estoque",
    url: createPageUrl("Inventory"),
    materialIcon: "inventory_2",
    adminSection: "Principal",
  },
  {
    title: "Marketing",
    url: createPageUrl("Marketing"),
    materialIcon: "campaign",
    adminSection: "Principal",
  },
  {
    title: "Meu Checklist",
    franchiseeLabel: "Checklist",
    url: createPageUrl("MyChecklist"),
    materialIcon: "fact_check",
    adminSection: "Principal",
  },
  {
    title: "Relatórios",
    url: createPageUrl("Reports"),
    materialIcon: "bar_chart",
    adminOnly: true,
    adminSection: "Gestão",
  },
  {
    title: "Configurações",
    franchiseeLabel: "Meu Vendedor",
    url: createPageUrl("FranchiseSettings"),
    materialIcon: "support_agent",
    adminSection: "Gestão",
  },
  {
    title: "Onboarding",
    url: createPageUrl("Onboarding"),
    materialIcon: "school",
    showOnboarding: true,
    adminSection: "Gestão",
  },
  {
    title: "Acompanhamento",
    url: createPageUrl("Acompanhamento"),
    materialIcon: "visibility",
    adminOnly: true,
    adminSection: "Gestão",
  },
  {
    title: "Franqueados",
    url: createPageUrl("Franchises"),
    materialIcon: "group",
    adminOnly: true,
    adminSection: "Administração",
  },
];

// Mobile bottom nav items for franchisee
const mobileBottomNav = [
  { label: "Início", materialIcon: "dashboard", url: createPageUrl("Dashboard") },
  { label: "Estoque", materialIcon: "inventory_2", url: createPageUrl("Inventory") },
  { label: "add", materialIcon: "add", url: createPageUrl("Sales"), isFab: true },
  { label: "Vendas", materialIcon: "shopping_cart", url: createPageUrl("Sales") },
  { label: "Perfil", materialIcon: "account_circle", url: createPageUrl("FranchiseSettings") },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { logout, user: currentUser } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [todayContacts, setTodayContacts] = useState(0);
  const [onboardingApproved, setOnboardingApproved] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "admin") {
      loadQuickStats();
    }
    if (currentUser.role !== "admin" && currentUser.managed_franchise_ids?.length > 0) {
      OnboardingChecklist.filter({
        franchise_id: currentUser.managed_franchise_ids[0],
      })
        .then((obs) => {
          if (obs.length === 0 || obs[0].status === "approved") {
            setOnboardingApproved(true);
          }
        })
        .catch((error) => {
          console.error("Erro ao carregar onboarding:", error);
        });
    }
  }, [currentUser]);

  const loadQuickStats = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const [contactsData, salesData] = await Promise.all([
        DailyUniqueContact.filter({ date: today }),
        Sale.list("-sale_date", 50),
      ]);
      setTodayContacts(contactsData.length);
      const todaySalesCount = salesData.filter((s) => s.sale_date === today).length;
      setTodaySales(todaySalesCount);
    } catch (error) {
      console.error("Erro ao carregar estatísticas rápidas:", error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const isAdmin = currentUser?.role === "admin";

  const filteredNavigationItems = navigationItems
    .filter((item) => {
      if (item.adminOnly) return isAdmin;
      if (item.showOnboarding) {
        return isAdmin || !onboardingApproved;
      }
      return true;
    })
    .map((item) => ({
      ...item,
      title: isAdmin
        ? item.adminLabel || item.title
        : item.franchiseeLabel || item.title,
    }));

  // Get current page title for top bar
  const currentPageTitle = filteredNavigationItems.find(
    (item) =>
      location.pathname === item.url ||
      (item.url.includes(currentPageName) && currentPageName)
  )?.title || currentPageName || "Dashboard";

  // Group items by admin section
  const groupedItems = isAdmin
    ? filteredNavigationItems.reduce((acc, item) => {
        const section = item.adminSection || "Principal";
        if (!acc[section]) acc[section] = [];
        acc[section].push(item);
        return acc;
      }, {})
    : null;

  const renderNavItem = (item) => {
    const isActive =
      location.pathname === item.url ||
      (item.url.includes(currentPageName) && currentPageName);
    return (
      <SidebarMenuItem key={item.url + item.title}>
        <SidebarMenuButton asChild isActive={isActive} className="h-10 px-3 gap-3 rounded-lg transition-colors">
          <Link to={item.url} className="flex items-center gap-3">
            <MaterialIcon icon={item.materialIcon} size={20} className="shrink-0" />
            <span className="text-sm">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider>
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
          color: #534343;
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

      <div className="min-h-screen flex w-full bg-[#fbf9fa]">
        {/* Desktop Sidebar */}
        <Sidebar className="w-[260px] border-r border-[#f8eeee] bg-white">
          <SidebarHeader className="px-4 h-32 flex items-center justify-center border-b-0">
            <img src={logoImg} alt="Maxi Massas" className="h-28 w-auto object-contain" />
          </SidebarHeader>

          <SidebarContent className="px-3 overflow-y-auto">
            {isAdmin && groupedItems ? (
              // Admin: sectioned navigation with spacing between sections
              <div className="space-y-6 pb-6">
                {Object.entries(groupedItems).map(([section, items]) => (
                  <SidebarGroup key={section} className="space-y-1">
                    <SidebarGroupLabel className="px-3 mb-2 text-[10px] font-bold text-[#534343]/50 tracking-widest uppercase">
                      {section}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>{items.map(renderNavItem)}</SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </div>
            ) : (
              // Franchisee: flat navigation
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {filteredNavigationItems.map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-[#f2e7e7] p-4 mt-auto">
            <div className="flex items-center gap-3 px-2 py-2">
              {currentUser ? (
                <>
                  {isAdmin ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#705d00] flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {currentUser.full_name?.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f2e7e7] flex items-center justify-center shrink-0">
                      <MaterialIcon icon="account_circle" size={16} className="text-[#534343]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#201a1a] truncate">
                      {currentUser.full_name}
                    </p>
                    <p className="text-[11px] text-[#534343] truncate">
                      {isAdmin ? "Admin" : currentUser.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-[#534343] hover:text-[#ba1a1a] transition-colors shrink-0"
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
          {/* Top bar — desktop (hidden on admin Dashboard since AdminHeader replaces it) */}
          {!(isAdmin && location.pathname === createPageUrl("Dashboard")) && (
            <header className="hidden md:flex fixed top-0 right-0 z-40 h-20 items-center justify-between px-8 bg-[#fbf9fa]/80 backdrop-blur-md" style={{ width: "calc(100% - 16rem)" }}>
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold tracking-tight text-[#1b1c1d]">
                  {currentPageTitle}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 text-[#4a3d3d] hover:text-[#9c4143] transition-colors rounded-lg hover:bg-white/50">
                  <MaterialIcon icon="notifications" size={20} />
                </button>
                {currentUser && (
                  <div className="w-10 h-10 rounded-full bg-[#f2e7e7] flex items-center justify-center text-[#534343] font-bold text-sm ml-2 overflow-hidden">
                    {currentUser.full_name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </header>
          )}

          {/* Top bar — mobile */}
          <header className="md:hidden sticky top-0 z-40 bg-[#fbf9fa]/80 backdrop-blur-md h-16 flex items-center justify-between px-4 border-b border-[#f8eeee]/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="p-2 rounded-xl text-[#534343] hover:bg-white/50 transition-colors" />
              <h1 className="text-lg font-semibold text-[#1b1c1d]">
                {currentPageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-[#534343] hover:text-[#9c4143] transition-colors">
                <MaterialIcon icon="notifications" size={20} />
              </button>
              {currentUser && (
                <div className="w-8 h-8 rounded-full bg-[#f2e7e7] flex items-center justify-center text-[#534343] font-bold text-xs overflow-hidden">
                  {currentUser.full_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <div className={`flex-1 overflow-auto ${
            isAdmin && location.pathname === createPageUrl("Dashboard") ? "" : "md:pt-20"
          } ${!isAdmin ? "pb-24 md:pb-0" : ""}`}>
            {children}
          </div>
        </main>

        {/* Mobile bottom nav — franchisee only */}
        {!isAdmin && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-none shadow-[0_-4px_20px_-10px_rgba(185,28,28,0.1)] h-16 flex items-center justify-around px-4 z-40">
            {mobileBottomNav.map((item) => {
              if (item.isFab) {
                return (
                  <Link
                    key="fab"
                    to={item.url}
                    className="w-12 h-12 -mt-10 rounded-full bg-[#9c4143] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-[#fbf9fa]"
                  >
                    <MaterialIcon icon="add" size={24} />
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
                  className={`flex flex-col items-center gap-1 ${
                    isActive ? "text-[#9c4143]" : "text-[#534343]"
                  }`}
                >
                  <MaterialIcon icon={item.materialIcon} size={20} filled={isActive} />
                  <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </SidebarProvider>
  );
}
