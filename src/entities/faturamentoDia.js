// Faturamento por dia do mês (admin/gerente/CS): get_faturamento_por_dia(p_franchise_id)
// — supabase/2026-09-27-admin-16-faturamento-dia.sql. Sem p_franchise_id = rede inteira
// (com unidades_por_dia); com ele = só aquela unidade (Ficha). Sem acesso, o banco devolve null.
// Lógica de tela em src/lib/faturamentoDia.js; hook useFaturamentoDia (1 carga por tela).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

const QUERY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function getFaturamentoPorDia(franchiseId = null, { signal } = {}) {
  let query = supabase.rpc("get_faturamento_por_dia", { p_franchise_id: franchiseId || null });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query);
  if (error) throw error;
  return data || null;
}

// A faixa e o detalhe usam o MESMO resultado (mesma queryKey). Fora do polling de 5 min
// da overview: 10 min de validade basta para "como foram os dias" (não é placar ao vivo).
export function useFaturamentoDia(franchiseId = null, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["faturamento-dia", franchiseId || "rede"],
    queryFn: ({ signal }) => getFaturamentoPorDia(franchiseId, { signal }),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}
