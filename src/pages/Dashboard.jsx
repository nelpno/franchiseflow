import { lazy, Suspense } from "react";
import { useAuth } from "@/lib/AuthContext";
import FranchiseeDashboard from "@/components/dashboard/FranchiseeDashboard";

// AdminHoje e lazy de proposito: o Dashboard e import ESTATICO em pages.config.js,
// entao tudo que ele importa viaja no chunk de entrada. Como a decisao admin x franqueado
// so acontece em runtime, o painel do admin era baixado por TODO franqueado. Sao ~3
// admins/gerente/CS em desktop contra ~66 franqueadas no celular — quem tem de ficar
// leve e o franqueado. (Auditoria 07/09/2026, frente 01 §2.3.a; redesenho Fase 1 26/09)
const AdminHoje = lazy(() => import("@/components/dashboard/AdminHoje"));

const DashboardFallback = () => (
  <div className="p-4 md:p-8 space-y-4 animate-pulse">
    <div className="h-8 w-48 bg-brand/10 rounded-md" />
    <div className="h-64 bg-brand/10 rounded-xl" />
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const veTelaAdmin = user?.role === "admin" || user?.role === "manager" || user?.role === "customer_success";

  if (!veTelaAdmin) return <FranchiseeDashboard />;

  return (
    <Suspense fallback={<DashboardFallback />}>
      <AdminHoje />
    </Suspense>
  );
}
