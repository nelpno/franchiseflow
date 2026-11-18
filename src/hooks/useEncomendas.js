// Encomendas da unidade (17/11/2026). Poucas linhas por unidade (dezenas por ano).
// Dois escopos, para a Início e a Reposição não baixarem histórico à toa:
//   "ativas" (padrão): só `aberta` e `pedida` — Início, bloco e aviso da Reposição, contador da aba.
//   "historico": as ativas + `entregue` e `cancelada` dos últimos 60 dias — só a aba de Vendas.
// Gravou em um lugar? `invalidar()` derruba os dois escopos (prefixo da chave), e as outras telas se atualizam.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { Encomenda } from "@/entities/all";

export const DIAS_HISTORICO_ENCOMENDAS = 60;

export const chaveEncomendasPrefixo = (franchiseId) => ["encomendas", franchiseId];
export const chaveEncomendas = (franchiseId, escopo = "ativas") => ["encomendas", franchiseId, escopo];

async function buscar(franchiseId, escopo, signal) {
  const ativas = await Encomenda.filter(
    { franchise_id: franchiseId, status: ["aberta", "pedida"] },
    "entregar_em",
    null,
    { fetchAll: true, signal }
  );
  if (escopo !== "historico") return ativas;
  // updated_at muda quando a encomenda é entregue ou cancelada (trigger update_updated_at)
  const encerradas = await Encomenda.filter(
    { franchise_id: franchiseId, status: ["entregue", "cancelada"] },
    "-entregar_em",
    null,
    { fetchAll: true, signal, gte: { updated_at: subDays(new Date(), DIAS_HISTORICO_ENCOMENDAS).toISOString() } }
  );
  return [...ativas, ...encerradas];
}

export function useEncomendas(franchiseId, { enabled = true, escopo = "ativas" } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: chaveEncomendas(franchiseId, escopo),
    queryFn: ({ signal }) => buscar(franchiseId, escopo, signal),
    enabled: !!franchiseId && enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: chaveEncomendasPrefixo(franchiseId) });
  return { ...query, encomendas: query.data || [], invalidar };
}
