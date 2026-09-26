import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getAdminNetworkOverview } from "@/entities/all";

// Visão da rede (get_admin_network_overview, ~50 KB, 1 linha por unidade) COMPARTILHADA por
// Hoje, Unidades e Marketing: a troca de tela reaproveita o cache em vez de baixar de novo.
// A RPC só devolve linhas para admin/gerente/CS (o guard é do banco); para os outros papéis
// nem chamamos.
export const ADMIN_OVERVIEW_KEY = ["admin-overview"];
export const ADMIN_PENDING_KEY = ["admin-pending-counts"];

const PAPEIS = new Set(["admin", "manager", "customer_success"]);

// refetchInterval: só quem precisa de número vivo (a "Hoje" usa 5 min). Padrão: sem polling.
export function useAdminNetworkOverview({ refetchInterval = false, enabled = true } = {}) {
  const { user } = useAuth();
  const pode = PAPEIS.has(user?.role);

  const query = useQuery({
    queryKey: ADMIN_OVERVIEW_KEY,
    queryFn: ({ signal }) => getAdminNetworkOverview({ signal }),
    enabled: enabled && pode,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });

  return { ...query, overview: query.data ?? [] };
}

// Toda mutação do admin que mexe em pedido, verba, campanha ou pendência chama isto depois
// de gravar: a overview e o badge de pendências se atualizam juntos.
export function invalidarAdmin(queryClient) {
  if (!queryClient) return Promise.resolve();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_KEY }),
    queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_KEY }),
  ]);
}
