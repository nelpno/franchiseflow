// Assessor do CS: estado das conversas FORA do componente (a pergunta continua viva se o painel fechar;
// a resposta que chegar depois aparece ao reabrir) e chamadas à Edge Function `cs-assessor`.
// Uma conversa por contexto: chave = id da unidade (Ficha) ou "geral" (Mural). Histórico só na sessão do navegador.
import { useSyncExternalStore } from "react";
import { supabase } from "@/api/supabaseClient";

const PREFIXO = "cs-assessor-v2:";
const MAX_MENSAGENS = 40;
const MAX_ENVIADAS = 16;
const VAZIO = Object.freeze({ mensagens: [], pendente: false, erro: "", naoLida: false });

const conversas = new Map(); // chave -> estado imutável
const ouvintes = new Set();
let versao = 0;

function ler(chave) {
  if (conversas.has(chave)) return conversas.get(chave);
  let mensagens = [];
  try {
    const bruto = sessionStorage.getItem(PREFIXO + chave);
    const lista = bruto ? JSON.parse(bruto) : [];
    if (Array.isArray(lista)) mensagens = lista;
  } catch { /* sem storage */ }
  const estado = { ...VAZIO, mensagens };
  conversas.set(chave, estado);
  return estado;
}

function gravar(chave, estado) {
  conversas.set(chave, estado);
  versao += 1;
  try {
    const leve = estado.mensagens.slice(-MAX_MENSAGENS).map((m) => (m.tabela && m.tabela.linhas.length > 300
      ? { ...m, tabela: { ...m.tabela, linhas: m.tabela.linhas.slice(0, 300) } } : m));
    sessionStorage.setItem(PREFIXO + chave, JSON.stringify(leve));
  } catch { /* sem storage ou cheio */ }
  ouvintes.forEach((f) => f());
}

const subscribe = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };

export const chaveDe = (franchiseEvo) => franchiseEvo || "geral";

/** Estado da conversa do contexto (re-renderiza quando muda). */
export function useConversa(chave) {
  return useSyncExternalStore(subscribe, () => ler(chave), () => VAZIO);
}

/** true se qualquer conversa está esperando resposta (selo no botão). */
export function useAssessorOcupado() {
  useSyncExternalStore(subscribe, () => versao, () => 0);
  return [...conversas.values()].some((c) => c.pendente);
}

export function marcarLida(chave) {
  const e = ler(chave);
  if (e.naoLida) gravar(chave, { ...e, naoLida: false });
}

export function limparConversa(chave) {
  gravar(chave, { ...VAZIO, pendente: ler(chave).pendente });
}

const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Atualiza uma mensagem da conversa (ex.: feedback, edição de proposta). */
export function atualizarMensagem(chave, id, patch) {
  const e = ler(chave);
  gravar(chave, { ...e, mensagens: e.mensagens.map((m) => (m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)) });
}

/** Atualiza uma proposta dentro de uma mensagem. */
export function atualizarProposta(chave, msgId, propId, patch) {
  atualizarMensagem(chave, msgId, (m) => ({
    propostas: (m.propostas || []).map((p) => (p.id === propId ? { ...p, ...patch } : p)),
  }));
}

async function invocar(corpo) {
  const { data, error } = await supabase.functions.invoke("cs-assessor", { body: corpo });
  if (error) {
    // A função escreve o motivo no corpo; o invoke só diz "non-2xx".
    let detalhe = "";
    try { detalhe = (await error.context?.json?.())?.error || ""; } catch { /* sem corpo */ }
    throw new Error(detalhe || "O Assessor não respondeu. Tente de novo.");
  }
  return data;
}

const textoParaHistorico = (m) => (m.mensagem ? `${m.content}\n\n[Rascunho de mensagem que você escreveu]\n${m.mensagem}` : m.content);

/**
 * Envia uma pergunta. `imagens` = data URLs já reduzidas; `anexos` = [{tipo:"audio", bytes}] (só metadado).
 * Roda no módulo: continua mesmo que o painel feche.
 */
export async function enviarPergunta(chave, { texto, franchiseEvo, imagens = [], anexos = [] }) {
  const p = String(texto || "").trim();
  const atual = ler(chave);
  if (!p || atual.pendente) return;
  const minha = { id: novoId(), role: "user", content: p, imagens: imagens.length, audio: anexos.some((a) => a.tipo === "audio") };
  const mensagens = [...atual.mensagens, minha];
  gravar(chave, { ...atual, mensagens, pendente: true, erro: "", naoLida: false });
  try {
    const enviadas = mensagens.slice(-MAX_ENVIADAS).map((m) => ({
      role: m.role === "user" ? "user" : "ia", // a Edge converte "ia" em papel do modelo
      content: m.role === "user" ? (m.imagens ? `${m.content}\n[imagem anexada]` : m.content) : textoParaHistorico(m),
    }));
    const r = await invocar({ messages: enviadas, franchise_evo: franchiseEvo || undefined, imagens: imagens.length ? imagens : undefined, anexos: anexos.length ? anexos : undefined });
    const e = ler(chave);
    const resposta = {
      id: novoId(), role: "ia", content: r.answer || "Sem resposta.", tabela: r.tabela || null, mensagem: r.mensagem || null,
      propostas: (r.propostas || []).map((x) => ({ ...x, status: "pendente", orig: JSON.stringify(camposEditaveis(x)) })),
      logId: r.log_id || null, feedback: null, custo: r.custo_usd ?? null, ms: r.ms ?? null,
    };
    gravar(chave, { ...e, mensagens: [...e.mensagens, resposta], pendente: false, naoLida: true });
  } catch (err) {
    const e = ler(chave);
    gravar(chave, { ...e, pendente: false, erro: err.message || "Não foi possível falar com o Assessor." });
  }
}

/** Campos que a pessoa pode editar no cartão (para saber se houve edição). */
export function camposEditaveis(p) {
  switch (p.tipo) {
    case "registrar": return { canal: p.canal, resultado: p.resultado, combinado: p.combinado || "", proxima_data: p.proxima_data || "", nota: p.nota || "" };
    case "abrir_cartao": return { titulo: p.titulo || "", descricao: p.descricao || "" };
    case "estacionar": return { motivo: p.motivo || "", ate: p.ate || "" };
    default: return { desfecho: p.desfecho, nota: p.nota || "" };
  }
}

/** Transcreve um áudio (Blob/File) pela Edge. Devolve { texto, bytes }. */
export async function transcreverAudio(blob, nome) {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await invocar({ acao: "transcrever", audio: btoa(bin), mime: blob.type || "audio/webm", nome: nome || "audio" });
  return { texto: r.texto || "", bytes: bytes.length };
}

/** Feedback de uma resposta (RPC confere se a linha do log é do usuário). */
export async function enviarFeedback(logId, nota, comentario) {
  const { error } = await supabase.rpc("cs_assessor_feedback", { p_log_id: logId, p_nota: nota, p_comentario: comentario || null });
  if (error) throw error;
}

/** Marca no log que uma proposta foi confirmada (melhor esforço; não atrapalha o registro). */
export async function avisarConfirmada(logId, proposta, editado) {
  if (!logId) return;
  try {
    await supabase.rpc("cs_assessor_proposta_confirmada", {
      p_log_id: logId,
      p_proposta: { id: proposta.id, tipo: proposta.tipo, franchise_id: proposta.franchise_id, editado: !!editado },
    });
  } catch { /* log é secundário */ }
}

/** Reduz uma imagem no navegador (lado maior 1280 px, JPEG) e devolve a data URL. */
export async function reduzirImagem(file, ladoMax = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Não consegui abrir essa imagem."));
      i.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * escala));
    c.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG com fundo transparente vira branco no JPEG
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82;
    let dataUrl = c.toDataURL("image/jpeg", q);
    while (dataUrl.length > 1_600_000 && q > 0.4) { q -= 0.15; dataUrl = c.toDataURL("image/jpeg", q); }
    if (dataUrl.length > 2_300_000) throw new Error("Imagem grande demais, mesmo reduzida.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
