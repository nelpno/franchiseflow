// Canais de venda da rede (admin/gerente/CS): get_admin_canais_venda(p_periodo) —
// supabase/2026-11-10-admin-canais-venda.sql. Tudo agregado no banco, sem telefone nem cliente.
// Regras de tela em src/lib/canaisVenda.js. Mesma queryKey no cartão do Hoje e na página.
//
// Rapidez (10/11/2026, "demora um pouco para carregar"): a RPC leva 0,4-0,9 s no banco e 0,5-1,8 s pela rede.
// Para a tela abrir na hora: (1) o último resultado de cada período fica no navegador (localStorage, até 24 h)
// e entra como dado inicial, atualizado em segundo plano; (2) trocar de período mantém o que está na tela até o
// novo chegar (placeholderData); (3) prefetch no Hoje, ao passar o mouse no menu e dos outros períodos na página.
import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { withTimeout } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { periodoValido, PERIODOS } from "@/lib/canaisVenda";

// "Mês anterior" leva ~0,85 s no banco; 20 s de folga para rede ruim (o padrão do adapter é 15 s).
const QUERY_TIMEOUT_MS = 20000;
const VALIDADE_MS = 5 * 60 * 1000;
const GUARDA_MS = 24 * 60 * 60 * 1000;
// Por usuário (PC compartilhado); o logout apaga tudo com o prefixo (limparCopiasLocais no AuthContext).
const chaveLocal = (uid, p) => `ff:canais-venda:v3:${uid}:${p}`;
const mesBR = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

export async function getCanaisVenda(periodo = "7d", { signal } = {}) {
  let query = supabase.rpc("get_admin_canais_venda", { p_periodo: periodoValido(periodo) });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || null;
}

// Cópia local: só conveniência (tela abre com o último número enquanto o novo vem). Falhou = segue sem ela.
// "Este mês"/"Mês anterior" gravados em outro mês não servem (31/10 viraria "este mês" em 01/11): descarta.
function lerLocal(uid, p) {
  if (!uid) return undefined;
  try {
    const bruto = window.localStorage.getItem(chaveLocal(uid, p));
    if (!bruto) return undefined;
    const { em, dados } = JSON.parse(bruto);
    if (!dados || !Number.isFinite(em) || Date.now() - em > GUARDA_MS) return undefined;
    if (p !== "7d" && mesBR(em) !== mesBR(Date.now())) return undefined;
    return { em, dados };
  } catch {
    return undefined;
  }
}
function gravarLocal(uid, p, dados) {
  if (!uid) return;
  try {
    window.localStorage.setItem(chaveLocal(uid, p), JSON.stringify({ em: Date.now(), dados }));
  } catch {
    /* sem espaço ou bloqueado: ignora */
  }
}

const opcoes = (uid, p) => ({
  queryKey: ["canais-venda", p],
  queryFn: async ({ signal }) => {
    const dados = await getCanaisVenda(p, { signal });
    if (dados) gravarLocal(uid, p, dados);
    return dados;
  },
  staleTime: VALIDADE_MS,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
});

/** true quando o dado na tela é mais velho que a validade (cópia local antiga sendo renovada). */
export const dadoVelho = (dataUpdatedAt) => !dataUpdatedAt || Date.now() - dataUpdatedAt > VALIDADE_MS;

export function useCanaisVenda(periodo = "7d", { enabled = true } = {}) {
  const p = periodoValido(periodo);
  const { user } = useAuth();
  const uid = user?.id;
  // uma leitura do localStorage por período/usuário (não a cada render)
  const local = useMemo(() => lerLocal(uid, p), [uid, p]);
  return useQuery({
    ...opcoes(uid, p),
    // dado inicial = a cópia local; com updatedAt antigo, o react-query busca o novo logo em seguida
    initialData: local?.dados,
    initialDataUpdatedAt: local?.em,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Busca antes de precisar (Hoje, mouse no menu, outros períodos). Respeita a validade: não repete à toa. */
export function prefetchCanaisVenda(queryClient, periodo = "7d", uid = null) {
  const p = periodoValido(periodo);
  if (!queryClient) return Promise.resolve();
  if (queryClient.getQueryData(["canais-venda", p]) === undefined) {
    const local = lerLocal(uid, p);
    if (local) queryClient.setQueryData(["canais-venda", p], local.dados, { updatedAt: local.em });
  }
  return queryClient.prefetchQuery(opcoes(uid, p)).catch(() => {});
}

export const IDS_PERIODOS = PERIODOS.map((x) => x.id);
