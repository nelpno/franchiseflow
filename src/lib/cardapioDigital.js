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
  // 10f: com o checklist do servidor, o que trava (ligado mas quebrado, ex.: tirou o pagamento) vem dele; sem ele, o aviso antigo
  const travas = Array.isArray(painel.checklist) ? itensDoChecklist(painel).filter((i) => i.estado === "trava") : null;
  if (travas) {
    // desligado, as travas já aparecem no quadro de ligar (LinkCard/PrimeiroUso): aqui só com o cardápio no ar
    if (!painel.ativo) travas.length = 0;
    for (const t of travas) out.push({ id: t.id, tom: "err", destaque: `${t.titulo}:`, texto: t.motivo, acao: t.acao });
  } else if (!painel.tem_whatsapp) {
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

// ---------- Checklist de ligar (10f, rede aberta): a regra é do banco (cardapio_checklist); aqui só o botão de cada item ----------
// Cada item do servidor: {id, nivel: "trava"|"aviso", ok, titulo, motivo}. Trava aberta = vermelho e o servidor recusa ligar;
// aviso = amarelo, não trava. A tela só decide para onde o "Arrumar →" leva.
const MEU_ROBO = "/FranchiseSettings";
export const ACAO_CHECKLIST = {
  whatsapp: { tipo: "whatsapp", rotulo: "Pedir à Maxi →", mensagem: "falta o WhatsApp da unidade no cadastro" },
  chave: { tipo: "whatsapp", rotulo: "Falar com a Maxi →", mensagem: "o cardápio está pausado pela Maxi" },
  unidade: { tipo: "whatsapp", rotulo: "Falar com a Maxi →", mensagem: "a unidade não aparece como ativa" },
  modalidade: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=2` },
  horario_entrega: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=2` },
  horario_retirada: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=2` },
  frete: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=2` },
  raio: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=2` },
  pagamento_entrega: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=3` },
  pagamento_retirada: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=3` },
  endereco: { tipo: "rota", rotulo: "Arrumar no Meu robô →", to: `${MEU_ROBO}?etapa=1` },
  produtos: { tipo: "rota", rotulo: "Atualizar estoque →", to: "/Gestao?tab=estoque" },
  em_falta: { tipo: "rota", rotulo: "Atualizar estoque →", to: "/Gestao?tab=estoque&nivel=zerado" },
  robo: { tipo: "rota", rotulo: "Ver o robô →", to: MEU_ROBO },
};
const ORDEM_ESTADO = { trava: 0, aviso: 1, ok: 2 };

/** Itens do checklist com estado ("trava" | "aviso" | "ok") e o botão de arrumar. Ordem: vermelho, amarelo, verde. */
export function itensDoChecklist(painel) {
  const lista = Array.isArray(painel?.checklist) ? painel.checklist : [];
  return lista
    .filter((c) => c && c.id && c.titulo)
    .map((c, i) => {
      const estado = c.ok ? "ok" : c.nivel === "trava" ? "trava" : "aviso";
      // 10i: sem WhatsApp, com o robô conectado: o banco sugere o número do robô; a tela pede confirmação e grava
      const sugestao = estado !== "ok" && c.sugestao ? String(c.sugestao) : null;
      const acao = estado === "ok" ? null : sugestao ? { tipo: "robo", rotulo: "Usar o número do robô" } : ACAO_CHECKLIST[c.id] || null;
      return { id: c.id, estado, titulo: c.titulo, motivo: c.motivo || "", sugestao, acao, i };
    })
    .sort((a, b) => ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] || a.i - b.i);
}

/** Pode ligar? A mesma conta do servidor (pode_ligar); sem o campo, pela lista. */
export function podeLigarCardapio(painel) {
  if (!painel) return false;
  if (typeof painel.pode_ligar === "boolean") return painel.pode_ligar;
  return Array.isArray(painel.checklist) && !painel.checklist.some((c) => c && c.nivel === "trava" && !c.ok);
}

/** Link do cardápio sem o https:// (o que já existe ou o que vai nascer ao ligar). */
export function linkSemProtocolo(url) {
  return url ? String(url).replace(/^https?:\/\//, "") : "";
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
  "Esse horário já passou", "O prazo da entrega", "Cardápio:",
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
// O prazo vem pronto do banco (cardapio_prazo_entrega): a tela só exibe, nenhuma regra de prazo aqui.
// agoraMin = minuto de agora em Brasília: a pausa que já venceu com a tela aberta não aparece mais (code review 10/11).
export function situacaoPausa(pausaAte, hojeISO, agoraMin) {
  const m = String(pausaAte || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (!m || m[1] < hojeISO || (m[1] === hojeISO && Number(m[2]) * 60 + Number(m[3]) <= agoraMin)) return { pausada: false, texto: "" };
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
// só "é um número inteiro?": a faixa permitida (15 a 180) é do banco (cardapio_configurar), que devolve a mensagem
export function erroPrazo(v) {
  const n = Number(v);
  if (v === "" || v == null || !Number.isInteger(n)) return "Digite o prazo em minutos.";
  return "";
}
