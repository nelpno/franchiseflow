// Encomendas da unidade (17/11/2026). Uma consulta só, compartilhada pela aba de Vendas, pelo
// bloco da Reposição e pelo cartão da Início (mesma queryKey): gravou em um lugar, os outros
// se atualizam ao invalidar. Poucas linhas por unidade (dezenas por ano), então busca tudo.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Encomenda } from "@/entities/all";

export const chaveEncomendas = (franchiseId) => ["encomendas", franchiseId];

export function useEncomendas(franchiseId, { enabled = true } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: chaveEncomendas(franchiseId),
    queryFn: ({ signal }) =>
      Encomenda.filter({ franchise_id: franchiseId }, "entregar_em", null, { fetchAll: true, signal }),
    enabled: !!franchiseId && enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: chaveEncomendas(franchiseId) });
  return { ...query, encomendas: query.data || [], invalidar };
}
