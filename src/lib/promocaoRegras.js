// Promoção estruturada do cardápio digital (10/11/2026, ESPEC do cardápio § 4.5–4.6).
// A franqueada escolhe da lista, não digita regra. Dois tipos na v1:
//   kit        {tipo:"kit", nome, itens:[{product_name, qtd}], preco, vale_ate}
//   percentual {tipo:"percentual", nome, itens:[{product_name, qtd:1}], min_qtd, pct, vale_ate}
// O BANCO é quem manda: o trigger franchise_configurations_promocao_texto valida (promocao_regras_erro) e grava o texto
// que o robô lê (promocao_texto) em promotions_combo. Aqui fica a MESMA regra e o MESMO texto, para a prévia e para
// avisar antes de salvar (site/pedido/supabase/2026-11-10-cardapio-rede.sql). Mudou um lado, mude o outro:
// node src/lib/promocaoRegras.test.mjs compara com textos gerados pelo SQL.

export const TETO_DESCONTO = 0.35; // o mesmo teto do robô
export const MAX_ITENS = 6;
export const MAX_PROMOS = 3; // 12/11/2026: até 3 promoções ao mesmo tempo (o banco recusa a 4ª)
export const NOME_MAX = 40;

export const TIPOS = [
  { id: "kit", rotulo: "Kit com preço fechado" },
  { id: "percentual", rotulo: "Leve N e ganhe %" },
];

const arred = (v) => Math.round(v * 100) / 100;
export const reais = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");

/** Preço de venda de agora, pelo nome exato do estoque (só ativo e com preço). */
export function precoDe(produtos, nome) {
  const p = (produtos || []).find((x) => x.produto === nome && x.ativo !== false && Number(x.preco) > 0);
  return p ? Number(p.preco) : null;
}

/** "Preço normal" do kit = soma dos preços de agora × quantidade (nunca inventado). null se faltar preço. */
export function precoNormal(regra, produtos) {
  const itens = regra?.itens || [];
  if (!itens.length) return null;
  let soma = 0;
  for (const it of itens) {
    const p = precoDe(produtos, it.product_name);
    if (p == null) return null;
    soma += p * (Number(it.qtd) || 0);
  }
  return arred(soma);
}

export function regraVazia(tipo = "kit") {
  return tipo === "percentual"
    ? { tipo, nome: "", itens: [], min_qtd: 2, pct: 5, vale_ate: null }
    : { tipo, nome: "", itens: [], preco: null, vale_ate: null };
}

export function regraAtiva(regras) {
  return Array.isArray(regras) && regras.length > 0 && regras[0] && typeof regras[0] === "object" ? regras[0] : null;
}

/** A lista de promoções ativas (até 3), na ordem em que o banco guarda e o cardápio mostra. */
export function regrasAtivas(regras) {
  return Array.isArray(regras) ? regras.filter((r) => r && typeof r === "object") : [];
}

/** Lista nova com a promoção `indice` trocada por `nova`; indice < 0 = acrescenta no fim. As outras seguem como estão. */
export function trocaRegra(regras, indice, nova) {
  const lista = regrasAtivas(regras);
  if (indice < 0 || indice >= lista.length) return [...lista, nova];
  return lista.map((r, i) => (i === indice ? nova : r));
}

/** Lista sem a promoção `indice`. */
export function tiraRegra(regras, indice) {
  return regrasAtivas(regras).filter((_, i) => i !== indice);
}

/** Produtos que a promoção `indice` divide com outra: [{produto, com: [nomes das outras promoções]}]. Aviso na tela, não bloqueia. */
export function produtosDivididos(regras, indice) {
  const lista = regrasAtivas(regras);
  const eu = lista[indice];
  if (!eu) return [];
  return (eu.itens || []).map((it) => ({
    produto: it.product_name,
    com: lista.filter((o, j) => j !== indice && (o.itens || []).some((x) => x.product_name === it.product_name)).map((o) => String(o.nome || "").trim()),
  })).filter((x) => x.com.length);
}

const chaveNome = (n) => String(n ?? "").trim().toLowerCase();

const inteiro = (v) => /^\d{1,2}$/.test(String(v ?? ""));

/** Mesmo texto e mesma ordem de checagem de public.promocao_regras_erro / promocao_regra_erro. null = pode salvar.
 *  `outras` = as outras promoções da lista (para o limite de 3 e o nome que não repete). */
export function erroDaRegra(regra, produtos, hojeISO, outras = []) {
  if (!regra || typeof regra !== "object") return "Promoção em formato inválido.";
  if (outras.length >= MAX_PROMOS) return "No máximo 3 promoções ao mesmo tempo. Encerre uma para criar outra.";
  if (outras.some((o) => chaveNome(o?.nome) === chaveNome(regra.nome))) return "Duas promoções com o mesmo nome. Dê um nome diferente a cada uma.";
  if (!["kit", "percentual"].includes(regra.tipo)) return "Escolha o tipo da promoção.";
  const nome = String(regra.nome || "").trim();
  if (nome.length < 3 || nome.length > NOME_MAX) return "O nome da promoção precisa ter de 3 a 40 letras.";
  const itens = Array.isArray(regra.itens) ? regra.itens : [];
  if (!itens.length) return "Escolha pelo menos um produto.";
  if (itens.length > MAX_ITENS) return "No máximo 6 produtos na promoção.";
  if (new Set(itens.map((i) => i.product_name)).size !== itens.length) return "O mesmo produto aparece duas vezes.";
  let normal = 0;
  let total = 0;
  for (const it of itens) {
    if (!inteiro(it.qtd) || Number(it.qtd) < 1 || Number(it.qtd) > 20) return "Quantidade de cada produto: de 1 a 20.";
    const p = precoDe(produtos, it.product_name);
    if (p == null) return `O produto "${String(it.product_name || "").slice(0, 60)}" não está no seu estoque.`;
    // escondido do cardápio não entra (o kit sumiria de tudo, robô incluído); nome repetido: vale o visível, como no SQL
    const visivel = (produtos || []).some((x) => x.produto === it.product_name && x.ativo !== false && Number(x.preco) > 0 && x.visivel !== false);
    if (!visivel) return `O produto "${String(it.product_name || "").slice(0, 60)}" está escondido do cardápio.`;
    normal += p * Number(it.qtd);
    total += Number(it.qtd);
  }
  if (regra.vale_ate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(regra.vale_ate)) return "Data de validade inválida.";
    if (hojeISO && regra.vale_ate < hojeISO) return "A data de validade já passou.";
  }
  if (regra.tipo === "kit") {
    if (total < 2) return "O kit precisa de pelo menos 2 itens.";
    const preco = regra.preco == null || regra.preco === "" ? null : arred(Number(regra.preco));
    if (preco == null || !Number.isFinite(preco) || preco <= 0) return "Digite o preço do kit.";
    if (preco >= normal) return "O preço do kit precisa ser menor que o preço normal.";
    // em centavos, como o numeric do banco (16,80 / 48,00 é 35% exato e passa)
    if (Math.round((normal - preco) * 100) * 100 > Math.round(normal * 100) * Math.round(TETO_DESCONTO * 100)) return "O desconto passou de 35%.";
  } else {
    const min = Number(regra.min_qtd);
    const pct = Number(regra.pct);
    if (!Number.isInteger(min) || min < 2 || min > 10) return "Quantas: de 2 a 10.";
    if (!Number.isInteger(pct) || pct < 1 || pct > 35) return "Desconto: de 1% a 35%, número inteiro.";
  }
  return null;
}

function ddmmaaaa(iso) {
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
}

/** Mesmo texto de public.promocao_texto_um (o que o robô lê em PROMOÇÃO, uma linha por promoção; o banco junta com quebra de linha). */
export function textoDaRegra(regra, produtos) {
  if (!regra || typeof regra !== "object") return null;
  const itens = Array.isArray(regra.itens) ? regra.itens : [];
  const ate = regra.vale_ate && /^\d{4}-\d{2}-\d{2}$/.test(regra.vale_ate) ? ` Válido até ${ddmmaaaa(regra.vale_ate)}.` : "";
  if (regra.tipo === "kit") {
    const lista = itens.map((i) => `${i.qtd} ${i.product_name}`).join(" + ");
    const preco = arred(Number(regra.preco));
    // como o SQL: soma só o que achou no estoque (sum ignora nulo)
    const achados = itens.map((i) => ({ p: precoDe(produtos, i.product_name), q: Number(i.qtd) || 0 })).filter((x) => x.p != null);
    const normal = achados.length ? arred(achados.reduce((s, x) => s + x.p * x.q, 0)) : null;
    return `${String(regra.nome || "").trim()}: ${lista} por R$ ${reais(preco)}`
      + (normal != null && normal > preco ? ` (de R$ ${reais(normal)})` : "")
      + "." + ate;
  }
  if (regra.tipo === "percentual") {
    const nomes = itens.map((i) => i.product_name);
    const meio = nomes.length === 1
      ? ` ${nomes[0]} ou mais e ganhe `
      : ` ou mais, somando ${nomes.join(" e ")}, e ganhe `;
    return `Leve ${regra.min_qtd}${meio}${regra.pct}% de desconto.${ate}`;
  }
  return null;
}

/** Regra pronta para gravar: só os campos do tipo, números como número. */
export function limparRegra(regra) {
  const base = {
    tipo: regra.tipo,
    nome: String(regra.nome || "").trim(),
    itens: (regra.itens || []).map((i) => ({ product_name: i.product_name, qtd: regra.tipo === "percentual" ? 1 : Number(i.qtd) || 1 })),
    vale_ate: regra.vale_ate || null,
  };
  if (regra.tipo === "kit") return { ...base, preco: arred(Number(regra.preco)) };
  return { ...base, min_qtd: Number(regra.min_qtd), pct: Number(regra.pct) };
}

/** O que o robô lê em PROMOÇÃO com a lista toda: uma linha por promoção (igual a public.promocao_texto). */
export function textoDasRegras(regras, produtos) {
  return regrasAtivas(regras).map((r) => textoDaRegra(r, produtos)).filter(Boolean).join("\n") || null;
}
