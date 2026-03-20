import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, Users, TrendingUp, Settings, Home, LogOut, SlidersHorizontal, ClipboardList, Activity, Rocket, Package, ImageIcon, Megaphone, UserCheck } from "lucide-react";
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
  SidebarTrigger } from
"@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DailyUniqueContact, Sale, User, OnboardingChecklist } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { format, startOfDay } from "date-fns";

const MaxiMassasLogo = ({ size }) => {
  const logoSize = size || "w-12 h-12";
  return (
    <div className={`${logoSize} relative`}>
      <img
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/1b9e005d3_ChatGPTImage30deagode202510_55_14.png"
        alt="MaxiMassas Logo"
        className="w-full h-full object-contain" />

    </div>);

};

const navigationItems = [
  {
    title: "Dashboard",
    franchiseeLabel: "Minha Loja",
    adminLabel: "Painel Geral",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    title: "Vendas",
    url: createPageUrl("Sales"),
    icon: TrendingUp,
  },
  {
    title: "Estoque",
    url: createPageUrl("Inventory"),
    icon: Package,
  },
  {
    title: "Catálogo",
    url: createPageUrl("Catalog"),
    icon: ImageIcon,
    adminOnly: true,
  },
  {
    title: "Marketing",
    url: createPageUrl("Marketing"),
    icon: Megaphone,
  },
  {
    title: "Meu Checklist",
    franchiseeLabel: "Checklist",
    url: createPageUrl("MyChecklist"),
    icon: ClipboardList,
  },
  {
    title: "Relatórios",
    url: createPageUrl("Reports"),
    icon: BarChart3,
    adminOnly: true,
  },
  {
    title: "Configurações",
    franchiseeLabel: "Minha Unidade",
    url: createPageUrl("FranchiseSettings"),
    icon: SlidersHorizontal,
  },
  {
    title: "Onboarding",
    url: createPageUrl("Onboarding"),
    icon: Rocket,
    showOnboarding: true,
  },
  {
    title: "Acompanhamento",
    url: createPageUrl("Acompanhamento"),
    icon: Activity,
    adminOnly: true,
  },
  {
    title: "Franqueados",
    url: createPageUrl("Franchises"),
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Usuários",
    url: createPageUrl("UserManagement"),
    icon: UserCheck,
    adminOnly: true,
  },
];


export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { logout } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [todayContacts, setTodayContacts] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [onboardingApproved, setOnboardingApproved] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      if (user.role === 'admin') {
        loadQuickStats();
      }
      // Check onboarding status for non-admin users
      if (user.role !== 'admin' && user.managed_franchise_ids?.length > 0) {
        const obs = await OnboardingChecklist.filter({
          franchise_id: user.managed_franchise_ids[0]
        });
        // Hide menu if no onboarding exists OR if it's already approved
        if (obs.length === 0 || obs[0].status === 'approved') {
          setOnboardingApproved(true);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadQuickStats = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [contactsData, salesData] = await Promise.all([
      DailyUniqueContact.filter({ date: today }),
      Sale.list('-sale_date', 50)]
      );

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

  const isAdmin = currentUser?.role === 'admin';

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
        ? (item.adminLabel || item.title)
        : (item.franchiseeLabel || item.title),
    }));


  return (
    <SidebarProvider>
        <style>{`
          .sidebar-menu-button[data-active="true"] {
            background-color: rgb(239 68 68);
            color: white;
          }
          .sidebar-menu-button[data-active="true"]:hover {
            background-color: rgb(220 38 38);
          }
        `}</style>
      
      <div className="min-h-screen flex w-full bg-gradient-to-br from-emerald-50 to-teal-50">
        <Sidebar className="border-r border-emerald-200/60 bg-white/95 backdrop-blur-sm">
          <SidebarHeader className="border-b border-emerald-200/60 p-6">
            <div className="flex items-center gap-3">
              <MaxiMassasLogo size="w-12 h-12" />
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Maxi Massas</h2>
                <p className="text-xs text-emerald-600 font-medium">Dashboard Inteligente</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-4 py-6">
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-3">
                NAVEGAÇÃO
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {filteredNavigationItems.map((item) => {
                    const isActive = location.pathname === item.url ||
                    item.url.includes(currentPageName) && currentPageName;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          data-active={isActive}
                          className="sidebar-menu-button hover:bg-emerald-100 transition-all duration-200 rounded-xl font-medium">

                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>);

                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-3">
                RESUMO DE HOJE
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200">
                  <div className="text-red-600 text-sm font-medium">Vendas</div>
                  <div className="text-red-800 text-2xl font-bold">{todaySales}</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200">
                  <div className="text-emerald-600 text-sm font-medium">Contatos</div>
                  <div className="text-emerald-800 text-2xl font-bold">{todayContacts}</div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-emerald-200/60 p-4">
            <div className="flex items-center justify-between">
              {currentUser ?
              <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                    {currentUser.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{currentUser.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                </div> :

              <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                    <div className="space-y-2">
                        <div className="h-3 w-24 bg-slate-200 rounded"></div>
                        <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    </div>
                 </div>
              }
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="w-5 h-5 text-red-500 hover:text-red-700" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/95 backdrop-blur-sm border-b border-emerald-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-emerald-100 p-2 rounded-xl transition-colors duration-200" />
              <MaxiMassasLogo size="w-8 h-8" />
              <h1 className="text-xl font-bold text-slate-900">MaxiMassas</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>);

}