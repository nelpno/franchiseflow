import { supabase } from "@/api/supabaseClient";

/**
 * Números que o robô NÃO responde na unidade (fornecedor, maquininha, família...).
 * Grava em bot_blocked_numbers pelas RPCs painel_robo_* (supabase/2026-09-30-robo-bloqueios.sql);
 * o firewall do robô lê a mesma tabela a cada mensagem.
 */

// Mesma chave do banco (public.normalize_phone_key): DDD + últimos 8 dígitos.
// Ignora +55, zero na frente, espaço, traço e o 9 extra — "(11) 9 8765-4321" e "551187654321" são o mesmo número.
export function chaveTelefone(valor) {
  let x = String(valor || "").replace(/\D/g, "").replace(/^0+/, "");
  if ((x.length === 12 || x.length === 13) && x.startsWith("55")) x = x.slice(2);
  return x.length === 10 || x.length === 11 ? x.slice(0, 2) + x.slice(-8) : null;
}

export async function listarBloqueios(franchiseEvoId) {
  const { data, error } = await supabase.rpc("painel_robo_bloqueios", { p_franchise: franchiseEvoId });
  if (error) throw error;
  return data || [];
}

export async function bloquearNumero(franchiseEvoId, telefone, rotulo) {
  const { data, error } = await supabase.rpc("painel_robo_bloquear", {
    p_franchise: franchiseEvoId,
    p_phone: telefone,
    p_label: rotulo || null,
  });
  if (error) throw error;
  return data;
}

export async function desbloquearNumero(id) {
  const { error } = await supabase.rpc("painel_robo_desbloquear", { p_id: id });
  if (error) throw error;
}
