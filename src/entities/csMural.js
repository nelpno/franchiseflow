// Mural do CS — wrappers das RPCs novas da Onda 2 (contrato `.tmp/onda2/CONTRATO.md`).
// NÃO mexer em src/entities/all.js — o orquestrador reexporta depois.
import { supabase } from "@/api/supabaseClient";

// Timeout local (mesma lógica de entities/all.js; withTimeout não é exportada de lá).
function withTimeout(promise, ms = 15000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Tempo limite excedido")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

/**
 * Lista de trabalho do dia do CS.
 * Devolve { hoje: 'YYYY-MM-DD', cards: [...], counts: {...} } — null se a RPC não devolver nada.
 */
export async function getCsMural() {
  const { data, error } = await withTimeout(supabase.rpc("get_cs_mural"), 20000);
  if (error) throw error;
  return data ?? null;
}

/**
 * Registra uma conversa/reunião. Sem `taskId`, o banco usa o cartão aberto da unidade
 * (ou grava só o evento, se não houver nenhum). `nextAt` em 'YYYY-MM-DD'.
 */
export async function registrarCsConversa(franchiseId, taskId, channel, outcome, commitment, nextAt, note, driveUrl) {
  const { data, error } = await withTimeout(
    supabase.rpc("registrar_cs_conversa", {
      p_franchise_id: franchiseId,
      p_task_id: taskId || null,
      p_channel: channel,
      p_outcome: outcome,
      p_commitment: commitment || null,
      p_next_at: nextAt || null,
      p_note: note || null,
      p_drive_url: driveUrl || null,
    }),
    30000
  );
  if (error) throw error;
  return data ?? null;
}

/**
 * Fecha o cartão (desfecho: resolvido | combinado_feito | recusou | nao_responde) ou
 * manda para o Nelson (desfecho: vai_para_nelson — não fecha, só marca escalated_at).
 */
export async function concluirCsCartao(taskId, desfecho, note) {
  const { data, error } = await withTimeout(
    supabase.rpc("concluir_cs_cartao", {
      p_task_id: taskId,
      p_desfecho: desfecho,
      p_note: note || null,
    }),
    30000
  );
  if (error) throw error;
  return data ?? null;
}

/** `ate` = null desestaciona. */
export async function estacionarCsCartao(taskId, ate, motivo) {
  const { data, error } = await withTimeout(
    supabase.rpc("estacionar_cs_cartao", {
      p_task_id: taskId,
      p_ate: ate || null,
      p_motivo: motivo || null,
    }),
    30000
  );
  if (error) throw error;
  return data ?? null;
}
