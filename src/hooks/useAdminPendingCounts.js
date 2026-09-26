import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getAdminPendingCounts } from "@/entities/all";

// get_admin_pending_counts() só existe para admin/gerente (42501 pro customer_success —
// nem chamamos para esse papel). Usado pelo badge do menu "Pedidos" (Layout.jsx) e pelo
// bloco "Pendências" da home (AdminHoje.jsx) — react-query dedupe evita 2 chamadas na
// mesma tela quando os dois montam juntos.
export function useAdminPendingCounts() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-pending-counts"],
    queryFn: () => getAdminPendingCounts(),
    enabled: isAdminOrManager,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return { pending: isAdminOrManager ? (data ?? null) : null, isLoading: isAdminOrManager && isLoading, error };
}
