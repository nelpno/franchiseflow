// Canais de venda da rede (admin/gerente/CS): get_admin_canais_venda(p_periodo) —
// supabase/2026-11-10-admin-canais-venda.sql. Tudo agregado no banco, sem telefone nem cliente.
// Regras de tela em src/lib/canaisVenda.js. Mesma queryKey no cartão do Hoje e na página.
//
// Rapidez (10/11/2026, "demora um pouco para carregar"): a RPC leva 0,4-0,9 s no banco e 0,5-1,8 s pela rede.
// Para a tela abrir na hora: (1) o último resultado de cada período fica no navegador (localStorage, até 24 h)
// e entra como dado inicial, atualizado em segundo plano; (2) trocar de período mantém o que está na tela até o
// novo chegar (placeholderData); (3) prefetch no Hoje, ao passar o mouse no menu e dos outros períodos na página.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { withTimeout } from "@/entities/all";
import { periodoValido, PERIODOS } from "@/lib/canaisVenda";

// "Mês anterior" leva ~0,85 s no banco; 20 s de folga para rede ruim (o padrão do adapter é 15 s).
const QUERY_TIMEOUT_MS = 20000;
const VALIDADE_MS = 5 * 60 * 1000;
const GUARDA_MS = 24 * 60 * 60 * 1000;
const chaveLocal = (p) => `ff:canais-venda:v2:${p}`;

export async function getCanaisVenda(periodo = "7d", { signal } = {}) {
  let query = supabase.rpc("get_admin_canais_venda", { p_periodo: periodoValido(periodo) });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || null;
}

// Cópia local: só conveniência (tela abre com o último número enquanto o novo vem). Falhou = segue sem ela.
function lerLocal(p) {
  try {
    const bruto = window.localStorage.getItem(chaveLocal(p));
    if (!bruto) return undefined;
    const { em, dados } = JSON.parse(bruto);
    if (!dados || !Number.isFinite(em) || Date.now() - em > GUARDA_MS) return undefined;
    return { em, dados };
  } catch {
    return undefined;
  }
}
function gravarLocal(p, dados) {
  try {
    window.localStorage.setItem(chaveLocal(p), JSON.stringify({ em: Date.now(), dados }));
  } catch {
    /* sem espaço ou bloqueado: ignora */
  }
}

const opcoes = (p) => ({
  queryKey: ["canais-venda", p],
  queryFn: async ({ signal }) => {
    const dados = await getCanaisVenda(p, { signal });
    if (dados) gravarLocal(p, dados);
    return dados;
  },
  staleTime: VALIDADE_MS,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
});

export function useCanaisVenda(periodo = "7d", { enabled = true } = {}) {
  const p = periodoValido(periodo);
  return useQuery({
    ...opcoes(p),
    // dado inicial = a cópia local; com updatedAt antigo, o react-query busca o novo logo em seguida
    initialData: () => lerLocal(p)?.dados,
    initialDataUpdatedAt: () => lerLocal(p)?.em,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Busca antes de precisar (Hoje, mouse no menu, outros períodos). Respeita a validade: não repete à toa. */
export function prefetchCanaisVenda(queryClient, periodo = "7d") {
  const p = periodoValido(periodo);
  if (!queryClient) return Promise.resolve();
  if (queryClient.getQueryData(["canais-venda", p]) === undefined) {
    const local = lerLocal(p);
    if (local) queryClient.setQueryData(["canais-venda", p], local.dados, { updatedAt: local.em });
  }
  return queryClient.prefetchQuery(opcoes(p)).catch(() => {});
}

export const IDS_PERIODOS = PERIODOS.map((x) => x.id);
