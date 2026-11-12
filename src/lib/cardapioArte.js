// Cardápio para imprimir e para o robô (Meu robô › Vendedor › Imagem do catálogo › "Gerar cardápio", 12/11/2026).
// Pedido do Nelson depois do cardápio feito à mão para Uberaba: em vez de cada unidade editar o Canva, o app monta
// a arte com os produtos e os preços do Estoque (cardapio_painel.produtos). Aqui só a regra (testável em node:
// node src/lib/cardapioArte.test.mjs); o desenho mora em cardapioArteDesenho.js.
import { situacaoProduto, telefoneBR, linkSemProtocolo } from "./cardapioDigital.js";

// Massas recheadas de 700 g: as linhas grandes, com foto. A ordem é a do cardápio.
export const RECHEADAS = [
  { chave: "sofioli", nome: "Sofioli", re: /^sofioli\b/i, foto: "prato-sofioli-720.webp" },
  { chave: "rondelli", nome: "Rondelli", re: /^rondel+i\b/i, foto: "prato-rondelli-720.webp" },
  { chave: "canelone", nome: "Canelone", re: /^canel+on[ei]s?\b/i, foto: "prato-canelone-720.webp" },
  { chave: "conchiglione", nome: "Conchiglione", re: /^conchiglione\b/i, foto: "prato-conchiglione-720.webp" },
  { chave: "nhoque_recheado", nome: "Nhoque recheado", re: /^nhoque recheado\b/i, foto: "prato-nhoque-recheado-720.webp" },
];

// O resto da linha da Maxi, em colunas embaixo. "nomeLinha" = o rótulo da linha quando o produto não tem sabor.
const DEMAIS = [
  { chave: "nhoque_batata", titulo: "Nhoque de batata", re: /^nhoque de batata\b/i },
  { chave: "pastel", titulo: "Massa de pastel", re: /^massa de pastel\b/i },
  { chave: "lasanha", titulo: "Massa de lasanha", re: /^massa de lasanha\b/i },
  { chave: "molho", titulo: "Molhos", re: /^molho\b\s*(de\s+)?/i },
  { chave: "queijo", titulo: "Queijo ralado", re: /^queijo\b/i, so: /ralado/i },
  { chave: "pao", titulo: "Pão de queijo", re: /^p[ãa]o\s+(de\s+)?(queijo|qjo\.?)\s*/i },
];

const UNIDADES_PESO = [
  { re: /^(kg|kl|quilos?)$/i, un: "kg", fator: 1000 },
  { re: /^(g|gr|grs|gs|gramas?)$/i, un: "g", fator: 1 },
  { re: /^ml$/i, un: "ml", fator: 1 },
  { re: /^(l|lt|lts|litros?)$/i, un: "L", fator: 1000 },
];
const RE_PESO = /(\d+(?:[.,]\d+)?)\s*(kg|kl|quilos?|gramas?|grs|gr|gs|g|ml|litros?|lts|lt|l)\b\.?/i;

/** "700g" -> { texto: "700 g", gramas: 700 }; "1kg" -> { texto: "1 kg", gramas: 1000 }; sem peso -> null. */
export function pesoDe(nome) {
  const m = String(nome || "").match(RE_PESO);
  if (!m) return null;
  const u = UNIDADES_PESO.find((x) => x.re.test(m[2]));
  if (!u) return null;
  const n = Number(m[1].replace(",", "."));
  return { texto: `${m[1].replace(".", ",")} ${u.un}`, gramas: Math.round(n * u.fator), bruto: m[0] };
}

/** Grafia do cardápio: muçarela, requeijão; frase com só a 1ª letra maiúscula ("4 queijos" fica igual). */
export function grafia(txt) {
  let t = String(txt || "")
    .replace(/\b(mussarela|musarela|mozarela|mozzarella|muzzarela|mu[çc]arela)\b/gi, "muçarela")
    .replace(/\brequeijao\b/gi, "requeijão")
    .replace(/\bbrocolis\b/gi, "brócolis")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Sabor = o nome sem a família, o peso, rolo/fatiado e os conectivos da ponta. */
export function saborDe(nome, reFamilia) {
  const peso = pesoDe(nome);
  let t = String(nome || "");
  if (reFamilia) t = t.replace(reFamilia, " ");
  if (peso) t = t.replace(peso.bruto, " ");
  t = t
    .replace(/\(\s*(rolo|fatiado)\s*\)/gi, " ")
    .replace(/\b(rolo|fatiado)\b/gi, " ")
    .replace(/\bpacote\b/gi, " ")
    .replace(/\s+-\s+|\s+-$|^-\s+/g, " ")
    .replace(/^\s*(recheado\s+)?(com|de)\s+/i, " ")
    .replace(/[\s,;:/-]+$/g, "")
    .replace(/^[\s,;:/-]+/g, "");
  return grafia(t);
}

// Nome de marca (produto próprio da unidade, queijo ralado): fica como a unidade escreveu, só arrumado.
const comoEsta = (txt) => {
  const t = String(txt || "").replace(/\s+-\s+|\s+-$/g, " ").replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

const varianteDe = (nome) => (/\bfatiado\b/i.test(nome) ? "fatiado" : /\brolo\b/i.test(nome) ? "rolo" : null);

// "4 queijos" por último na linha, como no cardápio da Uberaba; o resto em ordem alfabética.
const ordemSabor = (a, b) => {
  const qa = /^4 queijos/i.test(a), qb = /^4 queijos/i.test(b);
  if (qa !== qb) return qa ? 1 : -1;
  return a.localeCompare(b, "pt-BR");
};

export const precoBR = (v) => Number(v || 0).toFixed(2).replace(".", ",");

/** Junta os sabores de mesmo preço numa linha: [{ rotulo: "Brócolis e muçarela, frango e requeijão", preco: "39,80" }]. */
export function linhasPorPreco(itens, semSabor = "") {
  const porPreco = new Map();
  for (const it of itens) {
    const k = Number(it.preco).toFixed(2);
    if (!porPreco.has(k)) porPreco.set(k, []);
    const lista = porPreco.get(k);
    if (it.sabor && !lista.some((s) => s.toLowerCase() === it.sabor.toLowerCase())) lista.push(it.sabor);
  }
  return [...porPreco.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([preco, sabores]) => {
      const s = sabores.sort(ordemSabor);
      const rotulo = s.map((x, i) => (i === 0 ? x : x[0].toLowerCase() + x.slice(1))).join(", ") || semSabor;
      return { rotulo, preco: precoBR(preco) };
    });
}

/** Produto que entra no cardápio: visível, com preço, e não zerado há mais de 30 dias (a mesma regra do cardápio digital). */
export function entraNoCardapio(p, agora = new Date()) {
  if (!p || !(Number(p.preco) > 0)) return false;
  // zerado sem data de quando zerou: não dá para saber se volta; no material impresso fica de fora
  if (p.zerado && !Number.isFinite(new Date(p.zerado_desde).getTime())) return false;
  const s = situacaoProduto(p, agora);
  return s === "no_cardapio" || s === "acabou";
}

/**
 * Monta o cardápio a partir de cardapio_painel.produtos.
 * @returns {{ principais: Array<{chave,nome,foto,linhas}>, grupos: Array<{chave,titulo,tipo,linhas}>, outros: number, total: number }}
 */
export function montarCardapio(produtos, { incluirOutros = false, agora = new Date() } = {}) {
  const lista = (produtos || []).filter((p) => entraNoCardapio(p, agora));
  const principais = [];
  const gruposRecheada = [];
  const porDemais = new Map();
  const outros = [];

  const usados = new Set();
  for (const fam of RECHEADAS) {
    const itens = lista.filter((p) => fam.re.test(String(p.produto || "").trim()));
    itens.forEach((p) => usados.add(p));
    const principal = [];
    const resto = new Map(); // variante + peso -> itens
    for (const p of itens) {
      const peso = pesoDe(p.produto);
      const variante = varianteDe(p.produto);
      const item = { sabor: saborDe(p.produto, fam.re), preco: p.preco };
      if ((peso?.gramas === 700 || !peso) && variante !== "fatiado") principal.push(item);
      else {
        const k = `${variante || ""}|${peso?.texto || ""}`;
        if (!resto.has(k)) resto.set(k, { variante, peso, itens: [] });
        resto.get(k).itens.push(item);
      }
    }
    if (principal.length) principais.push({ chave: fam.chave, nome: fam.nome, foto: fam.foto, linhas: linhasPorPreco(principal, "Tradicional") });
    for (const r of resto.values()) {
      const titulo = [fam.nome, r.variante, r.peso?.texto].filter(Boolean).join(" ");
      gruposRecheada.push({ chave: `${fam.chave}-${r.variante || ""}-${r.peso?.gramas || ""}`, titulo, tipo: "lista", linhas: linhasPorPreco(r.itens, "Tradicional") });
    }
  }

  for (const p of lista) {
    if (usados.has(p)) continue;
    const nome = String(p.produto || "").trim();
    const fam = DEMAIS.find((f) => f.re.test(nome) && (!f.so || f.so.test(nome)));
    if (!fam) { outros.push(p); continue; }
    if (!porDemais.has(fam.chave)) porDemais.set(fam.chave, []);
    const peso = pesoDe(nome);
    let sabor = saborDe(nome, fam.re);
    if (fam.chave === "queijo") sabor = comoEsta(nome.replace(peso?.bruto || "", " ").replace(/^queijo\s+/i, ""));
    const rotulo = [sabor, peso?.texto].filter(Boolean).join(" ") || peso?.texto || grafia(nome);
    porDemais.get(fam.chave).push({ rotulo, preco: Number(p.preco) });
  }

  const grupos = [...gruposRecheada];
  for (const fam of DEMAIS) {
    const itens = porDemais.get(fam.chave);
    if (!itens?.length) continue;
    const vistos = new Set();
    const linhas = itens
      .filter((i) => { const k = i.rotulo.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
      .sort((a, b) => (fam.chave === "pao" ? a.preco - b.preco || a.rotulo.localeCompare(b.rotulo, "pt-BR") : b.preco - a.preco))
      .map((i) => ({ rotulo: i.rotulo, preco: precoBR(i.preco) }));
    grupos.push({ chave: fam.chave, titulo: fam.titulo, tipo: fam.chave === "pao" ? "pao" : "lista", linhas });
  }
  if (incluirOutros && outros.length) {
    grupos.push({
      chave: "outros", titulo: "Outros produtos", tipo: "lista",
      linhas: outros
        .map((p) => ({ rotulo: comoEsta(p.produto), preco: Number(p.preco) }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))
        .map((i) => ({ rotulo: i.rotulo, preco: precoBR(i.preco) })),
    });
  }
  return { principais, grupos, outros: outros.length, total: lista.length };
}

/** "Maxi Massas Cordeiro e Iracemápolis" -> "Cordeiro e Iracemápolis". */
export function nomeDaUnidade(nome, cidade) {
  const t = String(nome || "").replace(/^\s*maxi\s*massas\s*[-–:]?\s*/i, "").trim();
  return t || String(cidade || "").trim();
}

/** Rodapé: entrega/retirada. Endereço só de LOJA (pickup_is_store): casa da franqueada não vai impressa. */
export function linhaAtendimento({ temEntrega, temRetirada, ehLoja, rua, bairro }) {
  const retirada = temRetirada
    ? (ehLoja && rua ? `Retirada na ${[rua, bairro].filter(Boolean).join(", ")}` : null)
    : null;
  if (temEntrega && temRetirada && !retirada) return "Entrega e retirada";
  return [temEntrega ? "Entrega" : null, retirada || (temRetirada ? "Retirada" : null)].filter(Boolean).join(" · ");
}

/** Tudo o que o desenho precisa, a partir do cardapio_painel e da franchise_configurations da unidade. */
export function dadosDoCardapio(painel, config, { incluirOutros = false, agora = new Date() } = {}) {
  const pn = painel || {}, cf = config || {};
  const cardapio = montarCardapio(pn.produtos, { incluirOutros, agora });
  const num = String(pn.whatsapp_pedido || "").replace(/\D/g, "");
  const url = pn.ativo && pn.url ? String(pn.url) : "";
  const link = url ? linkSemProtocolo(url).replace(/\/$/, "") : "";
  const qrUrl = url
    ? `${url}${url.includes("?") ? "&" : "?"}utm_source=cardapio&utm_medium=impresso`
    : num
      ? `https://wa.me/${num.startsWith("55") ? num : `55${num}`}?text=${encodeURIComponent("Oi! Vi o cardápio da Maxi Massas.")}`
      : "";
  return {
    unidade: nomeDaUnidade(pn.nome || cf.franchise_name, cf.city),
    whatsapp: num ? telefoneBR(num) : "",
    link,
    qrUrl,
    atendimento: linhaAtendimento({
      temEntrega: Boolean(pn.tem_entrega ?? cf.has_delivery),
      temRetirada: Boolean(cf.has_pickup),
      ehLoja: Boolean(cf.pickup_is_store),
      rua: cf.street_address,
      bairro: cf.neighborhood,
    }),
    cardapio,
  };
}
