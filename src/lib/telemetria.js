// Telemetria do app no NOSSO banco (04/11/2026, docs/revisao-uso-2026-11-04.md, itens 5 e 6).
// Os eventos iam só para o painel do Clarity, que ninguém lia e cuja API não entrega evento nem
// o seletor do clique sem resposta. Agora cada evento vai também para `app_eventos`, em lote,
// pela RPC `registrar_eventos_app` (supabase/2026-11-04-app-eventos.sql).
//
// LGPD: nunca texto da tela, nome, telefone ou query string (só ?tab=/?aba=/?abrir=).
// O alvo do clique é tag.classes, nunca o texto. Telemetria nunca derruba a tela.

import { supabase } from "@/api/supabaseClient";

const LOTE_MAX = 20;
const INTERVALO_MS = 10000;
const MAX_CLIQUES_POR_TIPO = 25; // por sessão: "parece clicável" e o resto têm tetos separados
const URL_RPC = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/registrar_eventos_app`;
const CHAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ESPERA_RESPOSTA_MS = 700;

let fila = [];
let timer = null;
let franquiaAtual = null;
let cliques = { parece: 0, outro: 0 };
let token = null;
let usuarioAtual = null;
let detectorLigado = false;

export function nomeDeEvento(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** Caminho + só a aba (tab/aba/abrir). Nada de telefone, id ou busca. */
export function telaDe(href) {
  try {
    const u = new URL(href);
    const chave = ["tab", "aba", "abrir"].find((k) => u.searchParams.get(k));
    const valor = chave ? nomeDeEvento(u.searchParams.get(chave)) : "";
    return (u.pathname + (chave && valor ? `?${chave}=${valor}` : "")).slice(0, 120);
  } catch {
    return null;
  }
}

function aparelho() {
  const w = window.innerWidth || 0;
  return w < 768 ? "celular" : w < 1024 ? "tablet" : "pc";
}

export function definirFranquiaTelemetria(id) {
  franquiaAtual = id || null;
}

// fetch com keepalive (supabase.rpc não tem): o lote mandado ao esconder/fechar a aba chega.
// Falhou (offline, sessão vencida)? O lote volta para a fila, até 200 eventos.
async function enviar() {
  timer = null;
  if (!fila.length || !token) return;
  const lote = fila.splice(0, 50);
  const dono = usuarioAtual;
  let ok = false;
  try {
    const resp = await fetch(URL_RPC, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", apikey: CHAVE_ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ p_eventos: lote }),
    });
    ok = resp.ok;
  } catch {
    /* telemetria não pode derrubar a tela */
  }
  if (!ok && dono === usuarioAtual) fila = [...lote, ...fila].slice(0, 200);
  else if (fila.length) agendar();
}

function agendar(imediato = false) {
  if (imediato) {
    if (timer) clearTimeout(timer);
    enviar();
    return;
  }
  if (!timer) timer = setTimeout(enviar, INTERVALO_MS);
}

/**
 * Grava um evento no Clarity (mesmo nome de antes) e no banco.
 * @param {string} nome ex.: "manual_pdf_baixado"
 * @param {{detalhe?: string, alvo?: string, semClarity?: boolean}} [opcoes]
 */
export function registrarEvento(nome, opcoes = {}) {
  const e = nomeDeEvento(nome);
  if (!e) return;
  if (!opcoes.semClarity) {
    try { window.clarity?.("event", e); } catch { /* sem Clarity */ }
  }
  try {
    fila.push({
      e,
      d: opcoes.detalhe ? String(opcoes.detalhe).slice(0, 80) : undefined,
      a: opcoes.alvo ? String(opcoes.alvo).slice(0, 200) : undefined,
      t: telaDe(window.location.href),
      dev: aparelho(),
      fid: franquiaAtual || undefined,
    });
    agendar(fila.length >= LOTE_MAX);
  } catch {
    /* idem */
  }
}

// ---------------------------------------------------------------- clique sem resposta
// Igual à ideia do "dead click" do Clarity: clique que em 700 ms não mudou nada na tela
// (nenhuma mutação no DOM, mesma URL, mesmo foco). Grava o seletor para achar o elemento.

// Campo (foco mostra a resposta), link, download e botão ativo (ação que demora > 700 ms, como
// gerar PDF, ou que no iOS não pega foco) ficam de fora: dariam falso "sem resposta".
const IGNORAR = "input, textarea, select, label, [contenteditable=''], [contenteditable='true'], a[href], [download], button:not([disabled])";

function parteDoSeletor(el) {
  const tag = el.tagName.toLowerCase();
  const classes = [...(el.classList || [])].slice(0, 2).map((c) => c.slice(0, 30));
  const pai = el.parentElement;
  let ordem = "";
  if (pai) {
    const irmaos = [...pai.children].filter((x) => x.tagName === el.tagName);
    if (irmaos.length > 1) ordem = `[${irmaos.indexOf(el) + 1}]`;
  }
  const papel = el.getAttribute?.("role");
  return `${tag}${classes.length ? "." + classes.join(".") : ""}${papel ? `(${papel})` : ""}${ordem}`;
}

export function seletorDe(el) {
  const partes = [];
  let atual = el;
  while (atual && atual.nodeType === 1 && partes.length < 3 && atual !== document.body) {
    partes.unshift(parteDoSeletor(atual));
    atual = atual.parentElement;
  }
  return partes.join(" > ").slice(0, 200);
}

function aoClicar(ev) {
  try {
    if (!ev.isTrusted || ev.detail > 1) return;
    const alvo = ev.target instanceof Element ? ev.target : null;
    if (!alvo || alvo === document.body || alvo === document.documentElement || alvo.id === "root") return;
    if (alvo.closest(IGNORAR)) return;

    const hrefAntes = window.location.href;
    const focoAntes = document.activeElement;
    let mudou = false;
    const obs = new MutationObserver(() => { mudou = true; obs.disconnect(); });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });

    setTimeout(() => {
      try {
        obs.disconnect();
        if (mudou || window.location.href !== hrefAntes || document.activeElement !== focoAntes) return;
        if (String(window.getSelection?.() || "").length > 0) return; // estava selecionando texto
        const pareceClicavel = getComputedStyle(alvo).cursor === "pointer";
        const tipo = pareceClicavel ? "parece" : "outro";
        if (cliques[tipo] >= MAX_CLIQUES_POR_TIPO) return;
        cliques[tipo] += 1;
        registrarEvento("clique_sem_resposta", {
          alvo: seletorDe(alvo),
          detalhe: pareceClicavel ? "parece_clicavel" : undefined,
          semClarity: true, // o Clarity já mede o dele
        });
      } catch { /* telemetria */ }
    }, ESPERA_RESPOSTA_MS);
  } catch {
    /* telemetria */
  }
}

export function ligarTelemetria() {
  if (detectorLigado || typeof document === "undefined") return;
  detectorLigado = true;
  // Troca de usuário (sair/entrar no mesmo aparelho): a fila do anterior não vai com o token do novo.
  supabase.auth.getSession().then(({ data }) => { token = data?.session?.access_token || null; usuarioAtual = data?.session?.user?.id || null; }).catch(() => {});
  supabase.auth.onAuthStateChange((_ev, sessao) => {
    const novo = sessao?.user?.id || null;
    if (usuarioAtual && novo !== usuarioAtual) { fila = []; franquiaAtual = null; cliques = { parece: 0, outro: 0 }; }
    usuarioAtual = novo;
    token = sessao?.access_token || null;
    if (token && fila.length) agendar();
  });
  document.addEventListener("click", aoClicar, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") agendar(true);
  });
}
