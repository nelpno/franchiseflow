import { Notification } from "@/entities/all";

/**
 * Uma busca de notificações para o app inteiro, não uma por sino.
 *
 * O Layout monta DOIS <NotificationBell> ao mesmo tempo (o do topo desktop e o do topo
 * mobile — um fica escondido por CSS, mas os dois montam), e o AdminDashboard monta um
 * terceiro pelo AdminHeader. Cada um tinha o seu próprio fetch e o seu próprio timer de
 * 2 minutos. Medido na produção em 07/09/2026: **duas requisições idênticas
 * `notifications?select=*` em UM único carregamento de página**, e o par se repetindo a
 * cada 2 min por aba aberta. Era a query mais chamada do app.
 *
 * Aqui a busca é uma só, compartilhada por quantos sinos existirem, com:
 *  - colunas enxutas (o `select=*` trazia `user_id`, que a tela não usa);
 *  - intervalo de 5 min em vez de 2;
 *  - pausa quando a aba está escondida, e recarga ao voltar se passou do intervalo;
 *  - deduplicação: chamadas concorrentes compartilham a mesma promessa.
 */

const COLUNAS = "id, title, message, type, icon, link, read, created_at";
const INTERVALO_MS = 300000; // 5 min
const LIMITE = 20;

let estado = { notificacoes: [], naoLidas: 0, carregando: true, jaCarregou: false };
const assinantes = new Set();
let emVoo = null;
let ultimaBusca = 0;
let timer = null;
let ouvindoVisibilidade = false;

function avisar() {
  for (const fn of assinantes) fn(estado);
}

function definir(parcial) {
  estado = { ...estado, ...parcial };
  avisar();
}

export function carregarNotificacoes({ force = false } = {}) {
  if (emVoo) return emVoo;
  if (!force && estado.jaCarregou && Date.now() - ultimaBusca < 5000) {
    return Promise.resolve(estado.notificacoes);
  }
  emVoo = Notification.list("-created_at", LIMITE, { columns: COLUNAS })
    .then((dados) => {
      ultimaBusca = Date.now();
      definir({
        notificacoes: dados,
        naoLidas: dados.filter((n) => !n.read).length,
        carregando: false,
        jaCarregou: true,
      });
      return dados;
    })
    .catch(() => {
      // silencioso de propósito: o sino não pode virar um toast de erro a cada 5 min
      definir({ carregando: false, jaCarregou: true });
      return estado.notificacoes;
    })
    .finally(() => {
      emVoo = null;
    });
  return emVoo;
}

function ligarTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (!document.hidden) carregarNotificacoes({ force: true });
  }, INTERVALO_MS);
}

function desligarTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function aoTrocarVisibilidade() {
  if (document.hidden) {
    desligarTimer();
    return;
  }
  if (assinantes.size === 0) return;
  if (Date.now() - ultimaBusca > INTERVALO_MS) carregarNotificacoes({ force: true });
  ligarTimer();
}

export function assinarNotificacoes(fn) {
  const primeiro = assinantes.size === 0;
  assinantes.add(fn);
  fn(estado);
  if (primeiro) {
    if (!ouvindoVisibilidade) {
      document.addEventListener("visibilitychange", aoTrocarVisibilidade);
      ouvindoVisibilidade = true;
    }
    carregarNotificacoes();
    ligarTimer();
  }
  return () => {
    assinantes.delete(fn);
    if (assinantes.size === 0) desligarTimer();
  };
}

/** Marca uma como lida. Atualiza a tela na hora e desfaz se o banco recusar. */
export async function marcarComoLida(id) {
  const antes = estado.notificacoes;
  definir({
    notificacoes: antes.map((n) => (n.id === id ? { ...n, read: true } : n)),
    naoLidas: Math.max(0, estado.naoLidas - 1),
  });
  try {
    await Notification.update(id, { read: true });
  } catch (e) {
    definir({ notificacoes: antes, naoLidas: antes.filter((n) => !n.read).length });
    throw e;
  }
}

export async function marcarTodasComoLidas() {
  const antes = estado.notificacoes;
  const naoLidas = antes.filter((n) => !n.read);
  if (naoLidas.length === 0) return;
  definir({ notificacoes: antes.map((n) => ({ ...n, read: true })), naoLidas: 0 });
  try {
    await Promise.all(naoLidas.map((n) => Notification.update(n.id, { read: true })));
  } catch (e) {
    definir({ notificacoes: antes, naoLidas: naoLidas.length });
    throw e;
  }
}

/** Só para teste: devolve o estado interno sem assinar. */
export function _estadoAtual() {
  return estado;
}
