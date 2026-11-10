// Regras puras da página "Cardápio digital" (área da franqueada, 10/11/2026; ESPEC do cardápio § 4).
// Os dados vêm da RPC cardapio_painel (estado + produtos) e cardapio_resultado (funil); aqui só o que a tela decide:
// situação de cada produto, o que trava a venda (pendências), links de divulgar. Teste: node src/lib/cardapioDigital.test.mjs

export const DIAS_SOME = 30; // zerado há mais que isso some do cardápio (mesma regra da RPC cardapio_unidade v7)

const DIA_MS = 864e5;

/** Dias inteiros entre o timestamp e agora (0 = hoje). */
export function diasDesde(ts, agora = new Date()) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / DIA_MS));
}

/** Links do cardápio: divulgar (bio/perfil), QR (impresso) e "ver como o cliente vê" (o medidor marca teste). */
export function linksDoCardapio(url) {
  if (!url) return null;
  const base = url.endsWith("/") ? url : `${url}/`;
  return {
    base,
    semProtocolo: base.replace(/^https?:\/\//, ""),
    divulgar: `${base}?utm_source=bio&utm_medium=perfil`,
    qr: `${base}?utm_source=qr&utm_medium=impresso`,
    teste: `${base}?mx_teste=1`,
  };
}

/**
 * Situação do produto no cardápio do cliente:
 *   escondido   — a unidade tirou do cardápio (interruptor "Mostrar")
 *   fora        — zerado há mais de 30 dias: a RPC já não manda ao cliente
 *   acabou      — zerado (aparece como "Acabou", sem botão)
 *   no_cardapio — à venda
 */
export function situacaoProduto(p, agora = new Date()) {
  if (!p) return "no_cardapio";
  if (p.visivel === false) return "escondido";
  if (p.zerado) {
    // mesma conta da RPC (zerado_desde < now() - 30 days), em milissegundos: 30,5 dias já está fora
    const t = new Date(p.zerado_desde).getTime();
    return Number.isFinite(t) && agora.getTime() - t > DIAS_SOME * DIA_MS ? "fora" : "acabou";
  }
  return "no_cardapio";
}

export const ROTULO_SITUACAO = {
  no_cardapio: "No cardápio",
  acabou: "Em falta",
  escondido: "Escondido",
  fora: "Fora do cardápio",
};

// Família da massa pelo nome (para dizer "Conchiglione inteiro está fora"). Ordem importa: recheado antes de batata.
const FAMILIAS = [
  { nome: "Conchiglione", re: /^conchiglione/i },
  { nome: "Canelone", re: /^canel+one/i },
  { nome: "Sofioli", re: /^sofioli/i },
  { nome: "Rondelli", re: /^rondel+i/i },
  { nome: "Nhoque recheado", re: /^nhoque recheado/i },
  { nome: "Nhoque de batata", re: /^nhoque de batata/i },
  { nome: "Massa de lasanha", re: /^massa de lasanha/i },
  { nome: "Massa de pastel", re: /^massa de pastel/i },
];
export function familiaDe(nome) {
  return FAMILIAS.find((f) => f.re.test(String(nome || "").trim()))?.nome || null;
}

/** Zerados que o cliente VÊ ("Acabou"), sobre o que aparece no cardápio, e famílias inteiras zeradas. */
export function resumoZerados(produtos, agora = new Date()) {
  const lista = (produtos || []).map((p) => ({ ...p, situacao: situacaoProduto(p, agora) }));
  const aparecem = lista.filter((p) => p.situacao === "no_cardapio" || p.situacao === "acabou");
  const acabou = aparecem.filter((p) => p.situacao === "acabou");
  const porFamilia = {};
  for (const p of aparecem) {
    const f = familiaDe(p.produto);
    if (!f) continue;
    (porFamilia[f] = porFamilia[f] || []).push(p);
  }
  const familiasZeradas = Object.entries(porFamilia)
    .filter(([, itens]) => itens.length > 0 && itens.every((p) => p.situacao === "acabou"))
    .map(([f]) => f);
  return {
    acabou: acabou.length,
    aparecem: aparecem.length,
    pct: aparecem.length ? acabou.length / aparecem.length : 0,
    familiasZeradas,
    foraHaMais30: lista.filter((p) => p.situacao === "fora"),
  };
}

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function somaDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasEntre(deISO, ateISO) {
  return Math.round((new Date(`${ateISO}T12:00:00Z`) - new Date(`${deISO}T12:00:00Z`)) / DIA_MS);
}

/** Horários especiais desta semana (hoje..+6), um texto por dia. */
export function especiaisDaSemana(lista, hojeISO) {
  const fim = somaDias(hojeISO, 6);
  const porDia = new Map();
  for (const x of Array.isArray(lista) ? lista : []) {
    if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.de || "")) continue;
    const ate = /^\d{4}-\d{2}-\d{2}$/.test(x.ate || "") ? x.ate : x.de;
    if (ate < hojeISO || x.de > fim) continue;
    const chave = `${x.de}|${ate}|${x.tipo === "fechado" ? "fechado" : "horario"}`;
    const vale = x.vale === "entrega" || x.vale === "retirada" ? [x.vale] : ["entrega", "retirada"];
    const atual = porDia.get(chave) || { de: x.de, ate, fechado: x.tipo === "fechado", vale: new Set() };
    vale.forEach((v) => atual.vale.add(v));
    porDia.set(chave, atual);
  }
  return [...porDia.values()].sort((a, b) => a.de.localeCompare(b.de)).map((d) => {
    const quando = d.de === d.ate ? ddmm(d.de) : `${ddmm(d.de)} a ${ddmm(d.ate)}`;
    const vale = d.vale.size === 2 ? "entrega e retirada" : [...d.vale][0];
    return d.fechado
      ? `Fechado em ${quando} (${vale}): o cardápio não oferece esse dia.`
      : `Horário especial de ${quando} vale para ${vale}.`;
  });
}

/** Quando a promoção vence: "vale até" da regra; sem regra, a 1ª data dd/mm[/aa] depois de "até" no texto livre. */
export function vencimentoPromocao(regra, texto, hojeISO) {
  let iso = regra?.vale_ate && /^\d{4}-\d{2}-\d{2}$/.test(regra.vale_ate) ? regra.vale_ate : null;
  if (!iso && texto) {
    const m = String(texto).match(/at[ée]\s+(?:o\s+dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
    if (m) {
      const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hojeISO.slice(0, 4);
      const d = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!Number.isNaN(new Date(`${d}T12:00:00Z`).getTime())) iso = d;
    }
  }
  if (!iso) return null;
  return { iso, dias: diasEntre(hojeISO, iso), ddmm: ddmm(iso) };
}

/**
 * O que trava a venda AGORA (bloco 2), na ordem do efeito. Cada item: {id, texto, destaque?, tom, acao}.
 * acao.tipo: "rota" (to), "whatsapp" (link de pedir à Maxi), "bio" (botão "Já coloquei"), "promocao" (rola ao bloco 4).
 */
export function pendencias(painel, { hojeISO, agora = new Date() } = {}) {
  if (!painel) return [];
  const out = [];
  if (!painel.tem_whatsapp) {
    out.push({ id: "whatsapp", tom: "err", destaque: "Sem WhatsApp público cadastrado:", texto: "o cardápio não tem para onde mandar o pedido.",
      acao: { tipo: "whatsapp", rotulo: "Pedir cadastro à Maxi →" } });
  }
  const z = resumoZerados(painel.produtos, agora);
  if (z.acabou > 0) {
    const fam = z.familiasZeradas.length
      ? ` ${z.familiasZeradas.length === 1 ? `${z.familiasZeradas[0]} inteiro está em falta.` : `${z.familiasZeradas.slice(0, -1).join(", ")} e ${z.familiasZeradas.at(-1)} estão inteiros em falta.`}`
      : "";
    out.push({ id: "zerados", tom: z.pct >= 0.4 ? "err" : "warn",
      destaque: `${z.acabou} de ${z.aparecem} ${z.aparecem === 1 ? "produto do cardápio está" : "produtos do cardápio estão"} em falta.`, texto: fam.trim(),
      acao: { tipo: "rota", rotulo: "Atualizar estoque →", to: "/Gestao?tab=estoque&nivel=zerado" } });
  }
  for (const t of especiaisDaSemana(painel.horario_especial, hojeISO)) {
    out.push({ id: `especial-${t}`, tom: "info", texto: t, acao: { tipo: "rota", rotulo: "Ver no Meu robô →", to: "/FranchiseSettings" } });
  }
  if (painel.ativo && !painel.link_bio_em) {
    out.push({ id: "bio", tom: "warn", destaque: "Link na bio?", texto: "Coloque o link na bio do Instagram e no perfil do Google.",
      acao: { tipo: "bio", rotulo: "Já coloquei" } });
  }
  const regra = Array.isArray(painel.promocao_regras) && painel.promocao_regras[0] ? painel.promocao_regras[0] : null;
  const v = vencimentoPromocao(regra, regra ? null : painel.promocao_texto, hojeISO);
  if (v && v.dias >= 0 && v.dias <= 3) {
    const quando = v.dias === 0 ? "hoje" : v.dias === 1 ? "amanhã" : `em ${v.dias} dias`;
    out.push({ id: "promo-vence", tom: "warn", texto: `Promoção vence ${quando} (${v.ddmm}).`,
      acao: { tipo: "promocao", rotulo: "Editar promoção →" } });
  }
  return out;
}

/** Checklist do primeiro uso (antes de ligar). */
export function checklistPrimeiroUso(painel, agora = new Date()) {
  if (!painel) return [];
  const z = resumoZerados(painel.produtos, agora);
  return [
    { id: "whatsapp", ok: !!painel.tem_whatsapp, texto: "WhatsApp público da unidade" },
    { id: "horarios", ok: !!painel.tem_horarios && !!painel.tem_pagamento, texto: "Horários e pagamento (do Meu robô)" },
    { id: "estoque", ok: z.acabou === 0, texto: z.acabou === 0 ? "Estoque atualizado" : `Estoque atualizado (${z.acabou} ${z.acabou === 1 ? "produto em falta" : "produtos em falta"})` },
  ];
}

/** "Nhoque de Batata - 1kg" -> "Nhoque de Batata 1kg" (linhas de resumo). */
export function nomeCurtoProduto(nome) {
  return String(nome || "").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();
}

/** Filtro da lista de produtos (bloco 5), pela URL (?produtos=em-falta|todos|escondidos). A MESMA base do aviso do bloco 2
 * e do cliente: "Todos" = o que aparece no cardápio; zerado há +30 dias (já some para o cliente) conta em "Escondidos". */
export const FILTROS_PRODUTOS = [
  { id: "em-falta", rotulo: "Em falta", teste: (s) => s === "acabou" },
  { id: "todos", rotulo: "Todos", teste: (s) => s === "no_cardapio" || s === "acabou" },
  { id: "escondidos", rotulo: "Escondidos", teste: (s) => s === "escondido" || s === "fora" },
];

/** Aplica por cima do painel as gravações de "Mostrar" ainda em voo ({id: visivel}): um refetch não desfaz o toque. */
export function comPendentes(painel, pendentes) {
  if (!painel || !pendentes || !pendentes.size) return painel;
  return { ...painel, produtos: (painel.produtos || []).map((p) => (pendentes.has(p.id) ? { ...p, visivel: pendentes.get(p.id) } : p)) };
}

// Frases que as RPCs do cardápio escrevem PARA a franqueada (errcode 22023/42501): vão inteiras à tela.
// Qualquer outro erro vira a frase genérica (nunca SQL, tabela ou coluna).
const FRASES_DO_BANCO = [
  "O nome da promoção", "Escolha ", "No máximo", "O mesmo produto", "Quantidade de cada", "O produto \"", "Data de validade",
  "A data de validade", "O kit precisa", "Digite o preço", "O preço do kit", "O desconto passou", "Quantas:", "Desconto:",
  "Uma promoção por vez", "Promoção em formato", "Falta o WhatsApp", "O link do seu cardápio", "O cardápio digital ainda",
  "Esse horário já passou", "O prazo da entrega",
];
export function mensagemErroCardapio(erro, padrao = "Não deu para salvar. Tente de novo.") {
  const msg = String(erro?.message || "");
  if (FRASES_DO_BANCO.some((f) => msg.startsWith(f))) return msg;
  if (/Failed to fetch|NetworkError|Tempo limite/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  if (erro?.code === "42501") return "Sem permissão para mudar o cardápio desta unidade.";
  return padrao;
}

// Entrega de hoje (v8, 10/11/2026): pausa da entrega e prazo do "o quanto antes" no cardápio.
// pausaAte = 'AAAA-MM-DDTHH:MI' (Brasília) do cardapio_painel, null = entrega funcionando (o banco já some com a vencida).
export const PRAZO_PADRAO = 60;
export function situacaoPausa(pausaAte, hojeISO) {
  const m = String(pausaAte || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return { pausada: false, texto: "" };
  if (m[1] > hojeISO) return { pausada: true, texto: "Entrega pausada hoje. Volta sozinha amanhã." };
  const hora = `${Number(m[2])}h${m[3] === "00" ? "" : m[3]}`;
  return { pausada: true, texto: `Entrega pausada até as ${hora}. Volta sozinha.` };
}
// valida o campo "pausar até" (HH:MM, depois de agora, hoje); devolve a mensagem de erro ou ""
export function erroPausaAte(hhmm, agoraMin) {
  const m = String(hhmm || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return "Escolha o horário em que a entrega volta.";
  if (Number(m[1]) * 60 + Number(m[2]) <= agoraMin) return "Esse horário já passou. Escolha um horário mais tarde.";
  return "";
}
export function erroPrazo(v) {
  const n = Number(v);
  if (v === "" || v == null || !Number.isInteger(n) || n < 15 || n > 180) return "O prazo da entrega vai de 15 a 180 minutos.";
  return "";
}
