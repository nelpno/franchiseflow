// S18.1 (28/09/2026): leituras próprias da Início nova (chave ui_v2).
// Arquivo à parte (como csMural.js/faturamentoDia.js) para não mexer no entities/all.js.
import { supabase } from "@/api/supabaseClient";

const QUERY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

/**
 * A unidade já usou o "Quem chamar hoje" alguma vez? (1 linha em contact_actions basta.)
 * A policy de SELECT de contact_actions libera a franqueada para as unidades dela.
 * Devolve true/false; erro sobe (a tela trata como "não sei" e não mostra o convite).
 */
export async function unidadeJaUsouQuemChamar(franchiseId, { signal } = {}) {
  let query = supabase.from("contact_actions").select("id").eq("franchise_id", franchiseId).limit(1);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query);
  if (error) throw error;
  return (data || []).length > 0;
}
