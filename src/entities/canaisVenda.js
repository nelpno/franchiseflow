// Canais de venda da rede (admin/gerente/CS): get_admin_canais_venda(p_dias) —
// supabase/2026-11-10-admin-canais-venda.sql. Tudo agregado no banco, sem telefone nem cliente.
// Regras de tela em src/lib/canaisVenda.js. Mesma queryKey no cartão do Hoje e na página.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { periodoValido } from "@/lib/canaisVenda";

const QUERY_TIMEOUT_MS = 20000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function getCanaisVenda(dias = 7, { signal } = {}) {
  let query = supabase.rpc("get_admin_canais_venda", { p_dias: periodoValido(dias) });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query);
  if (error) throw error;
  return data || null;
}

// 10 min de validade: é leitura de tendência (7/30 dias), não placar ao vivo; ~0,3 s (7) e ~0,9 s (30) no banco.
export function useCanaisVenda(dias = 7, { enabled = true } = {}) {
  const d = periodoValido(dias);
  return useQuery({
    queryKey: ["canais-venda", d],
    queryFn: ({ signal }) => getCanaisVenda(d, { signal }),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}
