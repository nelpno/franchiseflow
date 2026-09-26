// Wrappers para a página "Progresso do CS" (admin). RPCs do CONTRATO.md (Onda 2):
//   get_cs_progresso(p_ini, p_fim)  — Blocos 1-4 (atividade, fila, desfechos, decisões)
//   get_cs_impacto(p_ini, p_fim)    — Bloco 5 (placar de impacto, episódio × controle)
// Ambas SECURITY DEFINER, só admin. `p_ini`/`p_fim` em 'YYYY-MM-DD' — ver src/lib/csProgresso.js
// (periodoRange) para como a tela calcula o intervalo a partir de ?periodo=&ref=.
//
// NÃO importar daqui em src/entities/all.js: o orquestrador da Onda 2 reexporta depois.
import { supabase } from "@/api/supabaseClient";

const QUERY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  const parts = [promise, timeout];
  if (signal) {
    parts.push(
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      })
    );
  }
  return Promise.race(parts).finally(() => clearTimeout(timeoutId));
}

/** Blocos 1-4: atividade do Celso, estado da fila, desfechos, decisões do Nelson. */
export async function getCsProgresso(pIni, pFim, { signal } = {}) {
  let query = supabase.rpc("get_cs_progresso", { p_ini: pIni, p_fim: pFim });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data;
}

/** Bloco 5: placar de impacto (episódio × controle), por tipo reunião/mensagem. */
export async function getCsImpacto(pIni, pFim, { signal } = {}) {
  let query = supabase.rpc("get_cs_impacto", { p_ini: pIni, p_fim: pFim });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data;
}
