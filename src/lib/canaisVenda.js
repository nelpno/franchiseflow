// Canais de venda da rede (admin/gerente/CS, 10/11/2026): robô × cardápio digital × lançada à mão.
// Dados prontos da RPC get_admin_canais_venda (supabase/2026-11-10-admin-canais-venda.sql); aqui só
// contas de tela, sinais e ordenação. Teste: node src/lib/canaisVenda.test.mjs
//
// Atribuição (regra da RPC, repetida aqui para quem lê a tela): cada venda entra em UM canal só.
//   cardápio = venda casada a um pedido #PED- que chegou no WhatsApp (mesmo telefone, até 72 h), fechada
//              pelo robô ou lançada à mão; robô = source 'bot' que não é do cardápio; à mão = o resto.

import { MESES } from "./adminFormat.js";

// Períodos iguais às outras telas do admin (10/11/2026): mês até agora contra o mesmo trecho do mês anterior.
export const PERIODOS = [
  { id: "7d", rotulo: "7 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_anterior", rotulo: "Mês anterior" },
];
/** Aceita o id; legado da URL/API: 30 → "mes", 7 → "7d". */
export function periodoValido(v) {
  if (PERIODOS.some((p) => p.id === v)) return v;
  return String(v) === "30" ? "mes" : "7d";
}

const nomeDoMes = (iso) => MESES[Number(String(iso || "").slice(5, 7)) - 1] || "";

/** Com o que o período é comparado, em poucas palavras: "semana anterior", "mesmo trecho de outubro", "setembro". */
export function baseComparacao(d) {
  if (!d) return "";
  if (d.periodo === "7d") return "semana anterior";
  const mes = nomeDoMes(d.inicio_anterior);
  if (d.periodo === "mes") return d.corte_anterior ? `mesmo trecho de ${mes}` : mes;
  return mes;
}

/**
 * Comparação curta de um número: { texto: "+16%" | "−8%" | "novo" | "—", tom: "ok" | "err" | "neutro" }.
 * Sem base (anterior 0): "novo" se agora tem, "—" se nem agora.
 */
export function comparacaoCurta(atual, anterior) {
  const a = num(atual), p = num(anterior);
  if (p <= 0) return a > 0 ? { texto: "novo", tom: "neutro" } : { texto: "—", tom: "neutro" };
  const v = ((a - p) / p) * 100;
  const r = Math.round(Math.abs(v));
  if (r === 0) return { texto: "0%", tom: "neutro" };
  return v > 0 ? { texto: `+${r}%`, tom: "ok" } : { texto: `−${r}%`, tom: "err" };
}

// Limiares dos sinais (mudou aqui, mude o texto do rodapé da página).
export const MIN_VISITAS_SEM_PEDIDO = 15;
export const MIN_PEDIDOS = 3;
export const MIN_CONTATOS_ROBO = 30;
export const QUEDA_CONVERSAO_PP = 5;
export const QUEDA_CONVERSAO_REL = 0.25; // e 25% da conversão anterior (5 pontos de 40% é ruído, de 15% não)
export const DIAS_LIGADO_SEM_VISITA = 2;

const num = (v) => Number(v) || 0;

/** R$ de todos os canais (cada venda conta uma vez). */
export function totalRs(m) {
  if (!m) return 0;
  return num(m.rs_robo) + num(m.rs_cardapio) + num(m.rs_manual);
}

export function totalVendas(m) {
  if (!m) return 0;
  return num(m.vendas_robo) + num(m.vendas_cardapio) + num(m.vendas_manual);
}

/** Conversão do robô em % (contatos que compraram ÷ contatos que escreveram); null sem contato. */
export function conversaoRobo(m) {
  const c = num(m?.robo_contatos);
  if (c <= 0) return null;
  return (100 * num(m.robo_compraram)) / c;
}

/** Variação % de atual contra anterior; null quando a base é 0 (não inventa "+∞%"). */
export function variacaoPct(atual, anterior) {
  const a = num(anterior);
  if (a <= 0) return null;
  return ((num(atual) - a) / a) * 100;
}

/** "26%", "menos de 1%" (fatia pequena que não é zero), "0%". */
export function textoFatia(pct) {
  const v = Number(pct) || 0;
  if (v > 0 && v < 1) return "menos de 1%";
  return `${Math.round(v)}%`;
}

/** Fatia de cada canal no R$ (0..100); null quando não houve venda. */
export function participacao(m) {
  const t = totalRs(m);
  if (t <= 0) return null;
  return { robo: (100 * num(m.rs_robo)) / t, cardapio: (100 * num(m.rs_cardapio)) / t, manual: (100 * num(m.rs_manual)) / t };
}

export const ESTADOS_CARDAPIO = {
  ligado: "Cardápio ligado",
  pronto: "Pronto para ligar",
  falta: "Falta configurar",
  nao_abriu: "Não abriu a página",
  pausado: "Desligou",
  pausado_maxi: "Sem cardápio",
  sem_config: "Sem configuração",
};

/** Contagem da adesão (o objeto `adesao` da RPC, que vem de cardapio_adesao). */
export function resumoAdesao(adesao) {
  const a = adesao || {};
  const r = Object.fromEntries(Object.keys(ESTADOS_CARDAPIO).map((k) => [k, num(a[k])]));
  // total = soma de TUDO que veio (estado novo da cardapio_adesao não some do total)
  r.total = Object.values(a).reduce((s, n) => s + num(n), 0);
  return r;
}

const diasEntre = (iso, agora) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? (agora.getTime() - t) / 86400000 : null;
};

/**
 * Sinais acionáveis de uma unidade (ordem = prioridade). Cada um: { id, rotulo, tom }.
 * tom: "err" (queda), "warn" (olhar). "Pronto para ligar" não é sinal: é estado (coluna Cardápio e filtro).
 */
export function sinaisUnidade(u, agora = new Date()) {
  const a = u?.atual || {};
  const p = u?.anterior || {};
  const out = [];
  const visitas = num(a.visitas);
  const enviados = num(a.pedidos_enviados);
  const chegaram = num(a.pedidos_chegaram);

  if (u?.estado === "ligado") {
    const dias = diasEntre(u.cardapio_desde, agora);
    if (visitas === 0 && (dias === null || dias >= DIAS_LIGADO_SEM_VISITA)) {
      out.push({ id: "sem_visita", rotulo: "Cardápio ligado e ninguém abriu: divulgar o link", tom: "warn" });
    }
  }
  if (visitas >= MIN_VISITAS_SEM_PEDIDO && enviados === 0) {
    out.push({ id: "visita_sem_pedido", rotulo: `${visitas} visitas e nenhum pedido: olhar estoque e página`, tom: "warn" });
  }
  if (enviados >= MIN_PEDIDOS && chegaram === 0) {
    out.push({ id: "pedido_nao_chega", rotulo: "Pedidos enviados não chegam ao WhatsApp: conferir o número", tom: "warn" });
  }
  if (chegaram >= MIN_PEDIDOS && num(a.pedidos_viraram_venda) === 0) {
    out.push({ id: "pedido_sem_venda", rotulo: `${chegaram} pedidos chegaram e nenhuma venda lançada`, tom: "warn" });
  }
  const ca = conversaoRobo(a);
  const cp = conversaoRobo(p);
  if (
    ca !== null && cp !== null &&
    num(a.robo_contatos) >= MIN_CONTATOS_ROBO && num(p.robo_contatos) >= MIN_CONTATOS_ROBO &&
    cp - ca >= QUEDA_CONVERSAO_PP && (cp - ca) / cp >= QUEDA_CONVERSAO_REL
  ) {
    out.push({ id: "robo_caindo", rotulo: `Conversão do robô caiu de ${Math.round(cp)}% para ${Math.round(ca)}%`, tom: "err" });
  }
  return out;
}

export const FILTROS_LISTA = [
  { id: "todas", rotulo: "Todas", match: () => true },
  { id: "sinal", rotulo: "Com sinal", match: (u, agora) => sinaisUnidade(u, agora).length > 0 },
  { id: "ligado", rotulo: "Cardápio ligado", match: (u) => u.estado === "ligado" },
  { id: "pronto", rotulo: "Pronto para ligar", match: (u) => u.estado === "pronto" },
];
export const filtroValido = (id) => (FILTROS_LISTA.some((f) => f.id === id) ? id : "todas");

const quedaConversao = (u) => {
  const ca = conversaoRobo(u.atual);
  const cp = conversaoRobo(u.anterior);
  if (ca === null || cp === null || num(u.atual?.robo_contatos) < MIN_CONTATOS_ROBO || num(u.anterior?.robo_contatos) < MIN_CONTATOS_ROBO) return null;
  return cp - ca;
};

export const ORDENS = [
  { id: "rs", rotulo: "Maior faturamento" },
  { id: "cardapio", rotulo: "Mais R$ pelo cardápio" },
  { id: "visitas", rotulo: "Mais visitas no cardápio" },
  { id: "conversao", rotulo: "Menor conversão do robô" },
  { id: "queda", rotulo: "Maior queda na conversão" },
  { id: "nome", rotulo: "Nome" },
];
export const ordemValida = (id) => (ORDENS.some((o) => o.id === id) ? id : "rs");

const porNome = (a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");

/** Ordena sem mexer no array original. Quem não tem o número (null) vai para o fim. */
export function ordenarUnidades(lista, ordem) {
  const arr = [...(lista || [])];
  const desc = (f) => (a, b) => {
    const x = f(a), y = f(b);
    if (x === null && y === null) return porNome(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || porNome(a, b);
  };
  const asc = (f) => (a, b) => {
    const x = f(a), y = f(b);
    if (x === null && y === null) return porNome(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y || porNome(a, b);
  };
  switch (ordemValida(ordem)) {
    case "cardapio": return arr.sort(desc((u) => num(u.atual?.rs_cardapio)));
    case "visitas": return arr.sort(desc((u) => num(u.atual?.visitas)));
    // conversão: só quem teve base (MIN_CONTATOS_ROBO) entra no topo; sem base vai para o fim
    case "conversao": return arr.sort(asc((u) => (num(u.atual?.robo_contatos) >= MIN_CONTATOS_ROBO ? conversaoRobo(u.atual) : null)));
    case "queda": return arr.sort(desc(quedaConversao));
    case "nome": return arr.sort(porNome);
    default: return arr.sort(desc((u) => totalRs(u.atual)));
  }
}
